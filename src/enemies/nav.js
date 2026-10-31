// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Enemy navigation: a grid over the arena and a flow field that leads every grounded foe to the player around cover.
//
// The old chase walked straight at the player and only steered around the one solid right in front of it, so a foe
// on the far side of a wall, an L-shaped ruin or a cover pod ground into it forever. Now:
//   · buildNav() lays a grid over the arena when it's built and measures each cell's CLEARANCE (distance to the
//     nearest real solid; shallow climbable steps don't count, foes walk up those);
//   · updateNav() runs a Dijkstra out from the player several times a second, once per body size (a brute needs a wider
//     gap than a trooper), so every cell knows its walking distance to the player. Hazard zones and vents cost extra
//     while they're about to fire, warning or firing, so foes walk around a lava surge instead of through it. A fill
//     stops a few metres past the farthest body that walks by it (the rest of the map is never asked), and a size
//     nobody on the field has isn't filled at all: a duel up close costs a sliver of a whole-map fill. A big fill (a
//     wave spread over a battle map) runs a slice per frame into a spare buffer and swaps in when it's done;
//   · navSteer() is what the AI asks each frame: straight at the player when the way is open, otherwise toward the
//     farthest cell down the field it can walk to in a straight line (smooth, not grid-zigzag).

import { shared, solids, hazardZones, vents, enemies } from '../state.js';
import { allies } from '../allies/squad.js';
import { clamp } from '../utils.js';
import { hazardContains } from '../world/hazards.js';

const CS = 0.6;                         // cell size (world units)
const CLASSES = [0.62, 0.95];           // passable clearance: troopers, and big bodies (brutes, vital elites)
export const BIG_RADIUS = 0.85;         // a body radius above this paths as a big body
const REBUILD = 0.12;
const REBUILD_BIG = 0.18;               // a battle map's fill is the big one: refresh it a little less often                   // seconds between flow-field refreshes (the two sizes take turns)
const HOT_COST = 7;                     // extra cost per cell of a warning/firing hazard (avoid, but never a wall)
const IDLE_COST = 0.25;                 // a resting hazard is only mildly disliked
const LINE_PAD = 0.12;                  // straight-line moves keep this much more room than the grid needs
const INF = 1e9;
const BIG_RANGE = 46;                   // a battle map's flow field reaches this far (walking metres) from the hero
const BUDGET = 1.5;                     // ms of a frame a fill may take; a bigger one carries on next frame
const MARGIN = 6;                       // a fill reaches this far (walking metres) past the last body that reads it
const REACH = 3;                        // cells: navSteer's search round a body standing on a closed cell

const nav = {
  n: 0, nz: 0, half: 0, halfZ: 0, ox: 0, oz: 0,   // cells across (x) and along (z), arena half-sizes, grid origin (−half)
  clear: null,                          // Float32Array clearance per cell
  hz: null,                             // Int16Array: hazard index + 1 per cell (0 = none); vents come after zones
  dist: [null, null],                   // Float32Array walking distance to the player, per class
  back: [null, null],                   // the spare per class, which a fill under way writes
  t: 0, flip: 0,
  heap: null, heapN: 0,
  near: null, stamp: 0,                 // Uint16Array: cells within REACH of a body, stamped per fill
  fresh: [false, false],                // was this size's field filled for where the hero is now?
};
const wants = [[], []];                 // per size: the cells (x, z pairs) of the bodies that walk by its field

const cellOf = v => Math.floor((v - nav.ox) / CS);
const cellOfZ = v => Math.floor((v - nav.oz) / CS);
const centre = i => nav.ox + (i + 0.5) * CS;
const centreZ = i => nav.oz + (i + 0.5) * CS;
const inGrid = (ix, iz) => ix >= 0 && iz >= 0 && ix < nav.n && iz < nav.nz;

/* distance from a point to the nearest real solid (0 inside one) */
function clearanceAt(x, z){
  let best = 99;
  for (const c of solids){
    if (c.climbable || c.y0) continue;   // steps and hills are walked over, an overhead slab under
    let d;
    if (c.box){
      const dx = Math.max(Math.abs(x - c.x) - c.hx, 0), dz = Math.max(Math.abs(z - c.z) - c.hz, 0);
      d = Math.hypot(dx, dz);
    } else d = Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r);
    if (d < best) best = d;
  }
  return best;
}

/* call after an arena is built (solids, hazard zones and vents are all in place) */
export function buildNav(){
  nav.half = shared.arenaHalf; nav.halfZ = shared.arenaHalfZ || shared.arenaHalf;   // a long arena (the pursuit route) is deeper than it is wide
  nav.ox = -nav.half; nav.oz = -nav.halfZ;
  nav.n = Math.ceil((nav.half * 2) / CS); nav.nz = Math.ceil((nav.halfZ * 2) / CS);
  const N = nav.n * nav.nz;
  nav.clear = new Float32Array(N);
  nav.hz = new Int16Array(N);
  nav.dist = [new Float32Array(N).fill(INF), new Float32Array(N).fill(INF)];
  nav.back = [new Float32Array(N), new Float32Array(N)];   // the field a fill is writing (swapped in when it's done)
  job.on = false;
  nav.done = new Uint8Array(N);
  nav.heap = new Int32Array(N * 9 + 64);   // room for every relaxation (stale entries stay queued)
  nav.near = new Uint16Array(N); nav.stamp = 0;
  const edge = nav.half - 1, edgeZ = nav.halfZ - 1;   // clampToArena keeps bodies inside this rectangle
  for (let iz = 0; iz < nav.nz; iz++) for (let ix = 0; ix < nav.n; ix++){
    const x = centre(ix), z = centreZ(iz), k = iz * nav.n + ix;
    nav.clear[k] = (Math.abs(x) > edge || Math.abs(z) > edgeZ) ? 0 : clearanceAt(x, z);
    let h = 0;
    for (let i = 0; i < hazardZones.length && !h; i++) if (hazardContains(hazardZones[i], x, z)) h = i + 1;
    for (let i = 0; i < vents.length && !h; i++){
      const p = vents[i].group.position;
      if (Math.hypot(x - p.x, z - p.z) < 2.6) h = hazardZones.length + i + 1;
    }
    nav.hz[k] = h;
  }
  // a long route (the pursuit) is mostly far behind or far ahead: fill only this far out, so a refresh stays cheap
  // and so is a battle map (shared.arenaBig): only the fight around the hero needs routing; foes further out walk
  // straight in until they reach the filled stretch
  nav.range = nav.halfZ > nav.half * 1.5 ? 70 : shared.arenaBig ? BIG_RANGE : INF;
  nav.t = 0; nav.primed = false; nav.fresh = [false, false];
}

/* is hazard h (index + 1) about to warn, warning or firing? The lead time stops a foe stepping onto a vent or
   channel that will flare before it's across (a vent runs a 3s cycle: 1.5 idle, 0.5 warning, 1.0 firing) */
const LEAD = 0.8;
function hazardHot(h){
  if (h <= hazardZones.length){
    const z = hazardZones[h - 1], cyc = z.t % z.period;
    return cyc >= z.period - z.activeDur - z.warnDur - LEAD;
  }
  const v = vents[h - hazardZones.length - 1];
  return !!v && v.cycle > 1.5 - LEAD;
}

// ---- binary min-heap of cell indices keyed by the dist array being filled ----
function push(d, k){
  const H = nav.heap; let i = nav.heapN++;
  H[i] = k;
  while (i > 0){ const p = (i - 1) >> 1; if (d[H[p]] <= d[k]) break; H[i] = H[p]; H[p] = k; i = p; }
}
function pop(d){
  const H = nav.heap, top = H[0], last = H[--nav.heapN];
  let i = 0;
  if (nav.heapN > 0){
    H[0] = last;
    for (;;){
      const l = i*2 + 1, r = l + 1; let m = i;
      if (l < nav.heapN && d[H[l]] < d[H[m]]) m = l;
      if (r < nav.heapN && d[H[r]] < d[H[m]]) m = r;
      if (m === i) break;
      const tmp = H[i]; H[i] = H[m]; H[m] = tmp; i = m;
    }
  }
  return top;
}

const NBX = [1, -1, 0, 0, 1, 1, -1, -1], NBZ = [0, 0, 1, -1, 1, -1, 1, -1];   // 4 straight, then 4 diagonal
const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];

/* A fill runs as a JOB: it writes into a spare buffer a slice per frame (BUDGET ms), and the finished field swaps in
   whole, so what the foes read is always a complete field and no frame pays for a whole one. */
const job = { on: false, cls: 0, d: null, W: [], hot: new Uint8Array(64), left: 0, limit: 0 };
let gotScratch = new Uint8Array(64);
function beginFill(cls, px, pz, hot){
  const d = nav.back[cls], need = CLASSES[cls], n = nav.n, C = nav.clear;
  d.fill(INF);
  nav.heapN = 0;
  // seed every open cell near the player (they may be on a crate or the gantry, whose own cells are closed)
  const pcx = cellOf(px), pcz = cellOfZ(pz);
  for (const R of [1.6, 4, 8]){
    const rc = Math.ceil(R / CS);
    for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++){
      const ix = pcx + dx, iz = pcz + dz;
      if (!inGrid(ix, iz)) continue;
      const k = iz*n + ix;
      if (C[k] < need) continue;
      const g = Math.hypot(centre(ix) - px, centreZ(iz) - pz);
      if (g > R || g >= d[k]) continue;
      d[k] = g; push(d, k);
    }
    if (nav.heapN) break;
  }
  nav.done.fill(0);
  // the bodies that will read this field (copied: the live list is gathered afresh while the job runs): once the
  // fill has reached every one, it goes MARGIN further and stops
  const W = job.W; W.length = 0; for (const v of wants[cls]) W.push(v);
  if (gotScratch.length < W.length / 2) gotScratch = new Uint8Array(W.length);
  if (job.hot.length < hot.length) job.hot = new Uint8Array(hot.length);
  job.hot.set(hot);
  const near = nav.near;
  if (++nav.stamp > 65000){ nav.stamp = 1; near.fill(0); }
  // a body is reached when its own cell is; one on a closed cell (pressed into cover) when a cell navSteer would
  // look to from there is
  for (let w = 0; w < W.length; w += 2){
    gotScratch[w >> 1] = 0;
    if (C[W[w+1]*n + W[w]] >= need){ near[W[w+1]*n + W[w]] = nav.stamp; continue; }
    for (let jz = Math.max(0, W[w+1] - REACH); jz <= Math.min(nav.nz - 1, W[w+1] + REACH); jz++)
      for (let jx = Math.max(0, W[w] - REACH); jx <= Math.min(n - 1, W[w] + REACH); jx++) near[jz*n + jx] = nav.stamp;
  }
  job.on = true; job.cls = cls; job.d = d;
  job.left = W.length >> 1; job.limit = job.left ? nav.range : -1;
}
// work the job for up to `budget` ms; true once the field is finished and in use
function runFill(budget){
  const cls = job.cls, d = job.d, need = CLASSES[cls], n = nav.n, C = nav.clear, W = job.W, got = gotScratch, hot = job.hot;
  const done = nav.done, near = nav.near, stamp = nav.stamp, hzc = nav.hz, D1 = CS, D2 = CS * Math.SQRT2;
  const closed = w => C[W[w+1]*n + W[w]] < need;
  const t0 = performance.now();
  let pops = 0;
  while (nav.heapN){
    if ((++pops & 255) === 0 && performance.now() - t0 > budget) return false;   // the rest next frame
    const k = pop(d);
    if (done[k]) continue;   // a stale queue entry
    done[k] = 1;
    const ix = k % n, iz = (k - ix) / n, dk = d[k];
    if (dk > job.limit) break;   // past everyone who walks by it, or (a long arena) past the stretch around the player
    if (job.left && near[k] === stamp){
      for (let w = 0; w < W.length; w += 2){
        if (got[w >> 1]) continue;
        if (closed(w) ? Math.abs(W[w] - ix) <= REACH && Math.abs(W[w+1] - iz) <= REACH : W[w] === ix && W[w+1] === iz){ got[w >> 1] = 1; job.left--; }
      }
      if (!job.left) job.limit = Math.min(nav.range, dk + MARGIN);
    }
    for (let q = 0; q < 8; q++){
      const ox = NBX[q], oz = NBZ[q], jx = ix + ox, jz = iz + oz;
      if (jx < 0 || jz < 0 || jx >= n || jz >= nav.nz) continue;
      const j = k + oz*n + ox;
      if (C[j] < need || done[j]) continue;
      if (q >= 4 && (C[k + ox] < need || C[k + oz*n] < need)) continue;   // no cutting a corner
      let step = q < 4 ? D1 : D2;
      const h = hzc[j];
      if (h) step += (hot[h] ? HOT_COST : IDLE_COST) * CS;
      const nd = dk + step;
      if (nd < d[j]){ d[j] = nd; push(d, j); }
    }
  }
  nav.back[cls] = nav.dist[cls]; nav.dist[cls] = d;   // swap the finished field in
  job.on = false; nav.fresh[cls] = true;
  return true;
}

// who walks by which field: the grounded foes (by body size, as ai.js and director.js ask) and the squad (troopers' size)
function gatherWants(){
  wants[0].length = 0; wants[1].length = 0;
  for (const e of enemies){
    if (e.dead || e.t.fly || !e.group) continue;
    const p = e.group.position;
    wants[navClass(0.7 * (e.t.scale || 1))].push(clamp(cellOf(p.x), 0, nav.n - 1), clamp(cellOfZ(p.z), 0, nav.nz - 1));
  }
  for (const a of allies) if (a.group){ const p = a.group.position; wants[0].push(clamp(cellOf(p.x), 0, nav.n - 1), clamp(cellOfZ(p.z), 0, nav.nz - 1)); }
}
// does this size's field still reach everyone who reads it? (a body on a closed cell, pressed into cover, is never reached)
function covers(cls){
  const W = wants[cls], d = nav.dist[cls], need = CLASSES[cls];
  for (let w = 0; w < W.length; w += 2){ const k = W[w+1]*nav.n + W[w]; if (d[k] >= INF && nav.clear[k] >= need) return false; }
  return true;
}
// start a size's fill (and its first slice); `now`: finish it on the spot (the first fills, under the load)
function fill(cls, pp, now){
  if (!wants[cls].length){ nav.fresh[cls] = false; return; }   // nobody this size on the field: skip it
  beginFill(cls, pp.x, pp.z, nav.hotNow);
  runFill(now ? Infinity : BUDGET);
}

const hotSig = a => { let h = 0; for (let i = 1; i < a.length; i++) h = (h * 3 + a[i]) | 0; return h; };   // which hazards are hot, as one number
const hotScratch = { a: new Uint8Array(64) };
function hotTable(){
  const m = hazardZones.length + vents.length + 1;
  if (hotScratch.a.length < m) hotScratch.a = new Uint8Array(m * 2);
  const a = hotScratch.a;
  for (let h = 1; h < m; h++) a[h] = hazardHot(h) ? 1 : 0;
  return a;
}

/* once per frame from updateEnemies: a fill under way gets its slice; otherwise refresh one size's field on a short
   timer (the two sizes take turns, so each is at most ~0.25s old, plus the few frames a big fill is spread over) */
export function updateNav(dt, pp){
  if (!nav.n || nav.half !== shared.arenaHalf || nav.halfZ !== (shared.arenaHalfZ || shared.arenaHalf)) buildNav();
  nav.t -= dt;
  if (job.on){ runFill(BUDGET); return; }
  if (nav.t > 0) return;
  nav.t = shared.arenaBig ? REBUILD_BIG : REBUILD;
  nav.hotNow = hotTable();
  gatherWants();
  if (!nav.primed){ fill(0, pp, true); fill(1, pp, true); nav.primed = true; nav.at = [cellOf(pp.x), cellOfZ(pp.z)]; nav.hotSig = hotSig(nav.hotNow); nav.still = 0; nav.pending = -1; return; }
  // standing still with no hazard changing: the field is already right, so don't pay for a re-fill (up to 2 s, to be
  // safe), unless a body has walked (or spawned) past where the last fill stopped
  const cx = cellOf(pp.x), cz = cellOfZ(pp.z), sig = hotSig(nav.hotNow);
  if (cx === nav.at[0] && cz === nav.at[1] && sig === nav.hotSig && nav.still < 16){
    nav.still++;
    if (nav.pending >= 0){ fill(nav.pending, pp); nav.pending = -1; }   // the other size catches up with where we stopped
    else for (let c = 0; c < 2; c++) if (wants[c].length && (!nav.fresh[c] || !covers(c))){ fill(c, pp); break; }
    return;
  }
  nav.at[0] = cx; nav.at[1] = cz; nav.hotSig = sig; nav.still = 0;
  nav.flip ^= 1;
  if (!wants[nav.flip].length) nav.flip ^= 1;   // a size nobody has: the other one refreshes in its turn
  fill(nav.flip, pp);
  nav.pending = wants[nav.flip ^ 1].length ? nav.flip ^ 1 : -1;
  if (nav.pending < 0) nav.fresh[nav.flip ^ 1] = false;
}

export const navClass = radius => radius > BIG_RADIUS ? 1 : 0;

/* is this exact point open for a body of this class (and not on a live hazard)? Clearance is stored at cell centres,
   so take off the distance to the centre: a straight line then never grazes a corner the cell grid rounds away */
function openPoint(cls, x, z){
  const ix = cellOf(x), iz = cellOfZ(z);
  if (!inGrid(ix, iz)) return false;
  const k = iz*nav.n + ix;
  if (nav.clear[k] - Math.hypot(x - centre(ix), z - centreZ(iz)) < CLASSES[cls] + LINE_PAD) return false;
  return !(nav.hz[k] && nav.hotNow && nav.hotNow[nav.hz[k]]);
}

/* can a body of this class walk the straight line a → b (open ground, no live hazard)? The last `short` units are
   not checked: the player's own spot may be tight against cover, and that must not count as a blocked approach. */
export function navLineClear(ax, az, bx, bz, cls, short = 0){
  if (!nav.n) return true;
  const L = Math.hypot(bx - ax, bz - az), steps = Math.ceil(L / (CS * 0.5)), end = L > 0 ? 1 - short / L : 0;
  for (let s = 1; s <= steps; s++){
    const t = s / steps;
    if (t > end) break;
    if (!openPoint(cls, ax + (bx - ax)*t, az + (bz - az)*t)) return false;
  }
  return true;
}

/* walking distance to the player from here (falls back to Infinity off the field) */
export function navDist(x, z, cls){
  if (!nav.n) return Infinity;
  const ix = clamp(cellOf(x), 0, nav.n - 1), iz = clamp(cellOfZ(z), 0, nav.nz - 1);
  const d = nav.dist[cls][iz*nav.n + ix];
  return d >= INF ? Infinity : d;
}

/* which way should a foe at (x, z) walk to reach the player at (px, pz)? Writes a unit vector into out and returns
   true when the straight line is open (the AI keeps its own approach, stalking and circling then), false when it is
   following the field around something. */
export function navSteer(x, z, px, pz, cls, out){
  if (!nav.n || navLineClear(x, z, px, pz, cls, 1.3)){
    const dx = px - x, dz = pz - z, l = Math.hypot(dx, dz) || 1;
    out.x = dx / l; out.z = dz / l;
    return true;
  }
  const d = nav.dist[cls], n = nav.n;
  let ix = clamp(cellOf(x), 0, n - 1), iz = clamp(cellOfZ(z), 0, nav.nz - 1);
  // standing in a closed cell (pressed against cover, or knocked onto a crate)? start from the best open neighbour
  if (d[iz*n + ix] >= INF){
    let best = INF, bx = ix, bz = iz;
    for (let r = 1; r <= 3 && best >= INF; r++)
      for (let oz = -r; oz <= r; oz++) for (let ox = -r; ox <= r; ox++){
        const jx = ix + ox, jz = iz + oz;
        if (!inGrid(jx, jz)) continue;
        const v = d[jz*n + jx] + Math.hypot(ox, oz) * CS;
        if (v < best){ best = v; bx = jx; bz = jz; }
      }
    if (best >= INF){   // nowhere to go (sealed in): head straight for the player and let collision sort it out
      const dx = px - x, dz = pz - z, l = Math.hypot(dx, dz) || 1;
      out.x = dx / l; out.z = dz / l;
      return true;
    }
    const tx = centre(bx) - x, tz = centreZ(bz) - z, l = Math.hypot(tx, tz) || 1;
    out.x = tx / l; out.z = tz / l;
    return false;
  }
  // walk downhill up to 10 cells, then aim at the farthest one still reachable in a straight line
  let cx = ix, cz = iz, aimX = centre(ix), aimZ = centreZ(iz);
  for (let s = 0; s < 10; s++){
    let best = d[cz*n + cx], nx = -1, nz = -1;
    for (const [ox, oz] of NB){
      const jx = cx + ox, jz = cz + oz;
      if (!inGrid(jx, jz)) continue;
      const v = d[jz*n + jx];
      if (v < best){ best = v; nx = jx; nz = jz; }
    }
    if (nx < 0) break;
    cx = nx; cz = nz;
    const wx = centre(cx), wz = centreZ(cz);
    if (s > 0 && !navLineClear(x, z, wx, wz, cls)) break;
    aimX = wx; aimZ = wz;
  }
  const tx = aimX - x, tz = aimZ - z, l = Math.hypot(tx, tz);
  if (l < 0.05){ const dx = px - x, dz = pz - z, m = Math.hypot(dx, dz) || 1; out.x = dx / m; out.z = dz / m; return true; }
  out.x = tx / l; out.z = tz / l;
  return false;
}

/* open space around a point (for picking which way to sidestep) */
export function navClearance(x, z){
  if (!nav.n) return 99;
  const ix = cellOf(x), iz = cellOfZ(z);
  return inGrid(ix, iz) ? nav.clear[iz*nav.n + ix] : 0;
}

export const NAV = nav;   // debug handle (window.GAME.nav)
