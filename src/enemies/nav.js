// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Enemy navigation: a grid over the arena and a flow field that leads every grounded foe to the player around cover.
//
// The old chase walked straight at the player and only steered around the one solid right in front of it, so a foe
// on the far side of a wall, an L-shaped ruin or a cover pod ground into it forever. Now:
//   · buildNav() lays a grid over the arena when it's built and measures each cell's CLEARANCE (distance to the
//     nearest real solid; shallow climbable steps don't count, foes walk up those);
//   · updateNav() runs a Dijkstra out from the player several times a second, once per body size (a brute needs a wider
//     gap than a trooper), so every cell knows its walking distance to the player. Hazard zones and vents cost extra
//     while they're about to fire, warning or firing, so foes walk around a lava surge instead of through it;
//   · navSteer() is what the AI asks each frame: straight at the player when the way is open, otherwise toward the
//     farthest cell down the field it can walk to in a straight line (smooth, not grid-zigzag).

import { shared, solids, hazardZones, vents } from '../state.js';
import { clamp } from '../utils.js';
import { hazardContains } from '../world/hazards.js';

const CS = 0.6;                         // cell size (world units)
const CLASSES = [0.62, 0.95];           // passable clearance: troopers, and big bodies (brutes, vital elites)
export const BIG_RADIUS = 0.85;         // a body radius above this paths as a big body
const REBUILD = 0.12;                   // seconds between flow-field refreshes (the two sizes take turns)
const HOT_COST = 7;                     // extra cost per cell of a warning/firing hazard (avoid, but never a wall)
const IDLE_COST = 0.25;                 // a resting hazard is only mildly disliked
const LINE_PAD = 0.12;                  // straight-line moves keep this much more room than the grid needs
const INF = 1e9;

const nav = {
  n: 0, nz: 0, half: 0, halfZ: 0, ox: 0, oz: 0,   // cells across (x) and along (z), arena half-sizes, grid origin (−half)
  clear: null,                          // Float32Array clearance per cell
  hz: null,                             // Int16Array: hazard index + 1 per cell (0 = none); vents come after zones
  dist: [null, null],                   // Float32Array walking distance to the player, per class
  t: 0, flip: 0,
  heap: null, heapN: 0,
};

const cellOf = v => Math.floor((v - nav.ox) / CS);
const cellOfZ = v => Math.floor((v - nav.oz) / CS);
const centre = i => nav.ox + (i + 0.5) * CS;
const centreZ = i => nav.oz + (i + 0.5) * CS;
const inGrid = (ix, iz) => ix >= 0 && iz >= 0 && ix < nav.n && iz < nav.nz;

/* distance from a point to the nearest real solid (0 inside one) */
function clearanceAt(x, z){
  let best = 99;
  for (const c of solids){
    if (c.climbable) continue;
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
  nav.done = new Uint8Array(N);
  nav.heap = new Int32Array(N * 9 + 64);   // room for every relaxation (stale entries stay queued)
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
  nav.range = nav.halfZ > nav.half * 1.5 ? 70 : INF;
  nav.t = 0; nav.primed = false;
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

function fillField(cls, px, pz, hot){
  const d = nav.dist[cls], need = CLASSES[cls], n = nav.n, C = nav.clear;
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
  const done = nav.done; done.fill(0);
  const hzc = nav.hz, D1 = CS, D2 = CS * Math.SQRT2;
  while (nav.heapN){
    const k = pop(d);
    if (done[k]) continue;   // a stale queue entry
    done[k] = 1;
    const ix = k % n, iz = (k - ix) / n, dk = d[k];
    if (dk > nav.range) continue;   // a long arena only fills the stretch around the player
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
}

const hotScratch = { a: new Uint8Array(64) };
function hotTable(){
  const m = hazardZones.length + vents.length + 1;
  if (hotScratch.a.length < m) hotScratch.a = new Uint8Array(m * 2);
  const a = hotScratch.a;
  for (let h = 1; h < m; h++) a[h] = hazardHot(h) ? 1 : 0;
  return a;
}

/* once per frame from updateEnemies: refresh one size's field on a short timer (the two sizes take turns, so each
   is at most ~0.25s old and no frame pays for both) */
export function updateNav(dt, pp){
  if (!nav.n || nav.half !== shared.arenaHalf || nav.halfZ !== (shared.arenaHalfZ || shared.arenaHalf)) buildNav();
  nav.t -= dt;
  if (nav.t > 0) return;
  nav.t = REBUILD;
  nav.hotNow = hotTable();
  if (!nav.primed){ fillField(0, pp.x, pp.z, nav.hotNow); fillField(1, pp.x, pp.z, nav.hotNow); nav.primed = true; return; }
  nav.flip ^= 1;
  fillField(nav.flip, pp.x, pp.z, nav.hotNow);
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
