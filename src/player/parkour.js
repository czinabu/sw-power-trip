// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Parkour: ledge mantle and vault, the slide, the Jedi wall-run, the landing roll / hard-landing stagger, and FLOW
// (parkour refunds Force / jet fuel, sets up a harder next blow, and surges the run on a story chase).

import { MOVE } from '../data/movement.js';
import { MANDO_MOBILITY } from '../data/mobility.js';
import { CFG } from '../data/config.js';
import { S } from '../audio/sfx.js';
import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, solids, keys, player, enemies } from '../state.js';
import { staggerEnemy } from '../enemies/damage.js';
import { fwd, rightV, playerPos } from './helpers.js';
import { launchFlip } from './anim/agility.js';
import { STEP_UP } from '../world/collision.js';
import { tutEvent } from '../game/tutor-bus.js';

const smooth = k => k * k * (3 - 2 * k);
const easeOut = k => 1 - (1 - k) * (1 - k);

/* one solid seen from `pp`: distance to its face, the outward face normal, the nearest point on the face, and a spot
   to stand on its top just inside that lip. null when `pp` is already over it. */
function probeSolid(c, pp){
  if (c.box){
    const fx = clamp(pp.x, c.x - c.hx, c.x + c.hx), fz = clamp(pp.z, c.z - c.hz, c.z + c.hz);
    const dx = pp.x - fx, dz = pp.z - fz, d = Math.hypot(dx, dz);
    if (d < 0.001) return null;
    const nx = dx / d, nz = dz / d;
    const inX = Math.min(0.6, c.hx * 0.9), inZ = Math.min(0.6, c.hz * 0.9);
    return { d, nx, nz, fx, fz, x: clamp(fx - nx * 0.6, c.x - c.hx + inX, c.x + c.hx - inX), z: clamp(fz - nz * 0.6, c.z - c.hz + inZ, c.z + c.hz - inZ) };
  }
  const dx = pp.x - c.x, dz = pp.z - c.z, dc = Math.hypot(dx, dz);
  if (dc < 0.001) return null;
  const nx = dx / dc, nz = dz / dc, ins = Math.max(0, c.r - 0.6);
  return { d: dc - c.r, nx, nz, fx: c.x + nx * c.r, fz: c.z + nz * c.r, x: c.x + nx * ins, z: c.z + nz * ins };
}

/* LEDGE PROBE — the nearest solid in front of the body (along unit `dir`) whose top sits between `minUp` and `maxUp`
   above the feet and whose face is within grabbing distance. Returns where to stand on top, or null. */
export function findLedge(pp, dir, minUp, maxUp){
  const reach = MOVE.grabDist + 0.55;   // body radius + grab
  let best = null, bestD = 1e9;
  for (const c of solids){
    if (c.mound) continue;   // a hill is walked up, not climbed
    const up = c.h - pp.y;
    if (up <= minUp || up > maxUp) continue;
    const pr = probeSolid(c, pp);
    if (!pr || pr.d > reach) continue;
    if (-(pr.nx * dir.x + pr.nz * dir.z) < 0.55) continue;   // must be heading into its face
    if (pr.d < bestD){ bestD = pr.d; best = { c, top: c.h, ...pr }; }
  }
  return best;
}

/* FLOW — a parkour move refunds a little Force (Jedi) or jet fuel (Mando), more when it chains off a different one,
   and opens a MOMENTUM window for the next blow (momentumStrike / momentumShot). */
export function flowLink(kind){
  const F = MOVE.flow, last = player.flowLast || {};
  const fresh = G.gt - (last[kind] ?? -99) >= F.sameCd;
  last[kind] = G.gt; player.flowLast = last;
  player.momentum = { kind, until: G.gt + Math.max(F.strikeWindow, kind === 'slide' ? MOVE.slideTime + 0.2 : 0) };
  if (!fresh) return;
  player.flowN = G.gt - (player.flowT ?? -99) < F.window && player.flowKind !== kind ? (player.flowN || 0) + 1 : 1;
  player.flowT = G.gt; player.flowKind = kind;
  const pay = F.refund * (player.flowN > 1 ? F.chainMul : 1);
  if (G.hero === 'mando') player.jet = Math.min(player.jetMax, player.jet + pay * F.fuelMul);
  else player.force = Math.min(CFG.player.maxForce, player.force + pay);
  if (player.flowN > 1) floater(playerPos(), 'FLOW ×' + player.flowN, '#9fe0c8');
  // on a chase (a story pursuit), each move also SURGES the run: faster for a moment, more when it chains
  if (G.gt < (G.chaseSurgeT ?? -1)){
    player.surgeT = G.gt + F.surgeTime;
    player.surgeMul = Math.min(F.surgeMax, F.surge + (player.flowN - 1) * F.surgeChain);
  }
}
// The cut struck out of a parkour move: spends the window and says which move it came from (null if none).
export function momentumStrike(){
  const m = player.momentum;
  if (!m || G.gt > m.until) return null;
  player.momentum = null;
  return m.kind;
}
// The Mando's shots: every bolt fired inside the window hits harder (it isn't spent per shot).
export function momentumShot(){
  const m = player.momentum;
  return m && G.gt <= m.until ? MOVE.flow.shotDmg : 1;
}

/* MANTLE / VAULT — a scripted pull-up onto `ledge`. Vaults keep their running speed on the far side of the move. */
export function startMantle(pp, ledge, vault){
  const up = ledge.top - pp.y;
  const dur = vault ? MOVE.vaultTime : MOVE.mantleTime * clamp(0.55 + up / MOVE.reach * 0.45, 0.6, 1);
  const hs = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  player.mantle = { t: 0, dur, x0: pp.x, y0: pp.y, z0: pp.z, x1: ledge.x, y1: ledge.top, z1: ledge.z,
                    keep: vault ? Math.max(hs, MOVE.vaultSpeed) : 0, vault };
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  player.wallRun = null; player.gliding = false;
  if (G.hero !== 'mando'){
    // the body folds over the lip: pitched forward, knees tucked under, blade hugged in
    player.flip = vault ? { t: 0, dur, pitch: 0.5, roll: 0, legs: 'pike', arms: 'tuck', side: 1, ease: 'twirl' }
                        : { t: 0, dur, pitch: 0.55, legs: 'tuck', arms: 'tuck', side: 1, ease: 'twirl' };
  }
  burst(V3(ledge.x, ledge.top + 0.05, ledge.z), 0x9a9288, 4, 2.5, 1.5, 0.8);
  tutEvent(up <= MOVE.vaultHeight ? 'vault' : 'climb');   // over something low counts as a vault, whatever the run-up
  flowLink(up <= MOVE.vaultHeight ? 'vault' : 'climb');
  S.jump();
}

// Advances an active mantle. Returns true while it owns the body (locomotion skips steering, gravity and collision).
export function updateMantle(dt, pp){
  const m = player.mantle;
  if (!m) return false;
  m.t += dt;
  const k = clamp(m.t / m.dur, 0, 1);
  // the hips rise first, then travel over the lip
  const yk = easeOut(clamp(k / 0.7, 0, 1)), hk = smooth(clamp((k - 0.2) / 0.8, 0, 1));
  pp.y = m.y0 + (m.y1 - m.y0) * yk;
  pp.x = m.x0 + (m.x1 - m.x0) * hk;
  pp.z = m.z0 + (m.z1 - m.z0) * hk;
  player.vy = 0; player.grounded = false;
  if (k >= 1){
    pp.set(m.x1, m.y1, m.z1);
    player.grounded = true; player.groundY = m.y1; player.lastGroundT = G.gt;
    player.airLeft = 1; player.doubleJumped = false; player.fjUsed = false; player.wallRunUsed = false;
    if (m.keep > 0){   // a vault carries the run straight off the top
      const f = V3(m.x1 - m.x0, 0, m.z1 - m.z0);
      if (f.lengthSq() < 0.01) f.copy(fwd()); f.normalize();
      player.moveVel.copy(f.multiplyScalar(m.keep));
    }
    player.mantle = null;
  }
  return true;
}

/* Every airborne frame: holding forward into a ledge within reach catches it. The Mando only grabs off a plain
   hop or a fall, never under thrust. */
export function tryAutoMantle(pp){
  if (player.grounded || player.mantle || player.slamming || !keys['w'] || G.mode !== 'play') return false;
  if (G.hero === 'mando' && (player.jetActive || player.hovering || player.boosting)) return false;
  if (player.vy > 7) return false;   // still rocketing up off a jump: let the arc carry you first
  if (G.gt < (player.hangCdT ?? -9)) return false;   // just let go of a ledge: don't snatch it straight back
  const ledge = findLedge(pp, moveDir(), STEP_UP, MOVE.reach);
  if (!ledge) return false;
  // a high lip (the Jedi): catch it and HANG; anything lower is pulled straight up onto
  if (G.hero !== 'mando' && ledge.top - pp.y > MOVE.hangFrom) startHang(ledge);
  else startMantle(pp, ledge, false);
  return true;
}

/* LEDGE HANG (Jedi) — hands on the lip, feet against the face. A/D shimmy along it, W (held) or SPACE pulls up,
   S lets go. The hang owns the body until one of those. */
function startHang(ledge){
  player.hang = { c: ledge.c, nx: ledge.nx, nz: ledge.nz, held: 0 };
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  player.wallRun = null; player.gliding = false; player.flip = null;
  hangPlace(playerPos(), ledge);
  burst(V3(ledge.fx, ledge.top, ledge.fz), 0x9a9288, 4, 2, 1.5, 0.8);
  S.land(0.15);
}
function hangPlace(pp, pr){
  pp.set(pr.fx + pr.nx * 0.6, player.hang.c.h - MOVE.hangDrop, pr.fz + pr.nz * 0.6);
}
export function hangClimb(){
  const h = player.hang; if (!h) return;
  const pp = playerPos(), pr = probeSolid(h.c, pp);
  player.hang = null;
  if (!pr) return;
  startMantle(pp, { top: h.c.h, x: pr.x, z: pr.z }, false);
  player.mantle.dur = MOVE.hangClimbTime;
}
export function hangDrop(){
  if (!player.hang) return;
  const pp = playerPos();
  pp.x += player.hang.nx * 0.25; pp.z += player.hang.nz * 0.25;   // push off the face so collision doesn't snag
  player.hang = null; player.hangCdT = G.gt + 0.45;
}
// Advances an active hang. Returns true while it owns the body.
export function updateHang(dt, pp){
  const h = player.hang;
  if (!h) return false;
  player.vy = 0; player.grounded = false;
  if (keys['s']){ hangDrop(); return false; }
  if (keys['w']){ h.held += dt; if (h.held >= MOVE.hangClimbHold){ hangClimb(); return true; } } else h.held = 0;
  // SHIMMY — A/D along the face (relative to the camera, so A is always screen-left)
  const side = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
  if (side){
    const r = rightV(), tx = -h.nz, tz = h.nx;
    const sgn = Math.sign(r.x * tx + r.z * tz) || 1;
    const ox = pp.x, oz = pp.z;
    pp.x += tx * sgn * side * MOVE.shimmySpeed * dt; pp.z += tz * sgn * side * MOVE.shimmySpeed * dt;
    const pr = probeSolid(h.c, pp);
    // the hands stay on the same face: rounding a corner (or running out of lip) stops the shimmy
    if (!pr || pr.nx * h.nx + pr.nz * h.nz < 0.97 || pr.d > 0.9){ pp.x = ox; pp.z = oz; }
    else { hangPlace(pp, pr); if (Math.random() < 0.08) burst(V3(pr.fx, h.c.h, pr.fz), 0x9a9288, 1, 1.5, 1, 0.6); }
  }
  return true;
}

/* SLIDE — ALT out of a sprint (Jedi) or out of any run (Mando, who can also use C): drop low and skid, keeping the
   run's speed and ducking under blaster fire. A cut out of it is a sweep that floors what it hits.
   The Jedi's is the FORCE SLIDE: the Force drives it much farther, and it bowls over the troops in its way.
   The Mando's is the TACTICAL SLIDE (data/mobility.js MANDO_MOBILITY.slide): a jet-kicked skid that starts from any
   run, braced too, carries far, steers a little, keeps his aim dead steady, and a jump out of it is a long hop. */
export function trySlide(){
  if (!player.grounded || player.slideT > 0 || player.mantle || player.hang || G.mode !== 'play') return;
  const jedi = G.hero !== 'mando', SL = MANDO_MOBILITY.slide;
  if (!jedi && (player.dashT > 0 || player.meleeT > 0 || player.stabT > 0 || player.cds.slide > 0)) return;
  const hs = Math.hypot(player.moveVel.x, player.moveVel.z);
  if (hs < (jedi ? MOVE.slideMinSpeed : SL.minSpeed)) return;
  player.slideT = jedi ? MOVE.forceSlideTime : SL.time;
  player.slideBowled = jedi ? new Set() : null;
  if (!jedi) player.cds.slide = SL.time + SL.cd;
  tutEvent('slide');
  flowLink('slide');
  player.moveVel.multiplyScalar((jedi ? hs + MOVE.forceSlideBoost : Math.max(SL.speed, hs + SL.boost)) / hs);
  player.sprinting = false;
  if (jedi) player.flip = { t: 0, dur: MOVE.forceSlideTime, pitch: -0.3, drop: 0.5, legs: 'kneeslide', arms: null, side: 1, ease: 'twirl' };
  // the Mando's goes in feet first, like sliding into base, facing the way he skids (anim/agility.js mandoBody)
  else player.flip = { kind: 'slide', t: 0, dur: SL.time, face: Math.atan2(player.moveVel.x, player.moveVel.z) };
  const pp = playerPos();
  burst(V3(pp.x, 0.15, pp.z), jedi ? 0x88ddff : 0x9a9288, jedi ? 12 : 8, 4, 1, 0.9);
  S.dash();
}
// Every frame of a Force slide: anything standing just ahead of the hips is knocked off its feet, once per slide
export function updateForceSlide(pp){
  if (!player.slideBowled || !(player.slideT > 0)) return;
  const vx = player.moveVel.x, vz = player.moveVel.z, sp = Math.hypot(vx, vz);
  if (sp < 1) return;
  const dx = vx / sp, dz = vz / sp;
  for (const e of enemies){
    if (e.dead || e.converted || player.slideBowled.has(e)) continue;
    const ox = e.group.position.x - pp.x, oz = e.group.position.z - pp.z;
    const ahead = ox * dx + oz * dz, side = Math.abs(ox * dz - oz * dx);
    if (ahead < -0.3 || ahead > MOVE.bowl || side > 0.9) continue;
    player.slideBowled.add(e);
    if (e.t && e.t.heavy) continue;   // a brute just takes the knock: there's no sweeping it off its feet
    staggerEnemy(e, dx, dz, 'BOWLED OVER');
    burst(V3(e.group.position.x, 0.5, e.group.position.z), 0x88ddff, 8, 4, 2, 0.7);
  }
}

/* VAULT — a jump pressed while running at low cover goes up and over it in one move. */
export function tryVault(pp){
  if (!keys['w']) return false;
  const d = moveDir();
  const fs = (player.moveVel.x + player.vel.x) * d.x + (player.moveVel.z + player.vel.z) * d.z;
  const ledge = findLedge(pp, d, STEP_UP, fs >= MOVE.vaultSpeed ? MOVE.vaultHeight : 0.9);
  if (!ledge) return false;
  startMantle(pp, ledge, fs >= MOVE.vaultSpeed);
  return true;
}

// the input direction on the ground plane (W/A/S/D relative to the camera), falling back to straight ahead
function moveDir(){
  const f = fwd(), r = rightV(), d = V3(0, 0, 0);
  if (keys['w']) d.add(f); if (keys['s']) d.sub(f);
  if (keys['d']) d.add(r); if (keys['a']) d.sub(r);
  if (d.lengthSq() < 0.01) d.copy(f);
  return d.normalize();
}

/* WALL SURFACE — a horizontal unit normal pointing away from a wall face beside the body that rises well above it
   (a pillar, a tall crate, the arena wall), or null. */
export function wallBeside(pp, range){
  let best = null, bestD = range;
  for (const c of solids){
    if (c.mound || c.h < pp.y + 1.4) continue;   // needs wall above the shoulders to run on
    if (c.y0 && c.y0 > pp.y + 0.3) continue;      // an overhead slab has no face down where the feet are
    let d, nx, nz;
    if (c.box){
      const cx = clamp(pp.x, c.x - c.hx, c.x + c.hx), cz = clamp(pp.z, c.z - c.hz, c.z + c.hz);
      const dx = pp.x - cx, dz = pp.z - cz; d = Math.hypot(dx, dz);
      if (d < 0.001) continue; nx = dx / d; nz = dz / d;
      if (Math.abs(nx) < 0.97 && Math.abs(nz) < 0.97) continue;   // off a corner, not beside a face
    } else {
      if (c.r < 1.2) continue;          // thin columns are too round to run along
      const dx = pp.x - c.x, dz = pp.z - c.z, dc = Math.hypot(dx, dz);
      if (dc < 0.001) continue; d = dc - c.r; nx = dx / dc; nz = dz / dc;
    }
    if (d < bestD){ bestD = d; best = V3(nx, 0, nz); }
  }
  if (best) return best;
  const h = shared.arenaHalf - 1, hz = shared.arenaHalfZ - 1;
  if (pp.x >  h - range) return V3(-1, 0, 0);
  if (pp.x < -h + range) return V3( 1, 0, 0);
  if (pp.z >  hz - range) return V3( 0, 0, -1);
  if (pp.z < -hz + range) return V3( 0, 0,  1);
  return null;
}

/* WALL-RUN (Jedi) — jump alongside a wall at speed with W held and the feet catch it: a short run along the face
   that barely loses height. SPACE kicks off it (movement.js), letting go of W or running out of time drops you. */
export function updateWallRun(dt, pp){
  if (G.hero === 'mando') return;
  const wr = player.wallRun;
  if (wr){
    wr.t += dt;
    const n = wallBeside(pp, 1.5);
    // the face must stay the same one: rounding a corner or the wall ending drops you off
    if (player.grounded || !keys['w'] || !n || n.x * wr.nx + n.z * wr.nz < 0.9 || wr.t > MOVE.wallRunTime || player.mantle || player.slamming){
      player.wallRun = null;
      return;
    }
    // run along the face at a steady speed, the normal component pinned to zero so you hug it
    const ax = -n.z * wr.dir, az = n.x * wr.dir;
    player.moveVel.set(ax * MOVE.wallRunSpeed, 0, az * MOVE.wallRunSpeed);
    const vn = player.vel.x * n.x + player.vel.z * n.z;
    player.vel.x -= n.x * vn; player.vel.z -= n.z * vn;
    if (Math.random() < 0.35) burst(V3(pp.x - n.x * 0.5, pp.y + 0.3, pp.z - n.z * 0.5), 0x9a9288, 1, 2, 1, 0.6);
    return;
  }
  if (player.grounded || player.wallRunUsed || player.gliding || player.flip || player.mantle || player.slamming || !keys['w']) return;
  if (player.vy < -6) return;   // already falling hard: too late to catch the wall
  const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z, sp = Math.hypot(vx, vz);
  if (sp < MOVE.wallRunMinSpeed) return;
  const n = wallBeside(pp, 1.3);
  if (!n) return;
  if (Math.abs(vx * n.x + vz * n.z) / sp > 0.55) return;   // heading into (or away from) the wall, not along it
  const dir = Math.sign(-n.z * vx + n.x * vz) || 1;          // which way along the face
  player.wallRun = { t: 0, nx: n.x, nz: n.z, dir };
  player.wallRunUsed = true;
  tutEvent('wallrun');
  flowLink('wallrun');
  player.vy = MOVE.wallRunLift;   // the feet catch the wall: a small, fixed lift (not the jump's full rise)
  S.dash();
}

/* LANDING — a hard touchdown buckles the knees for a beat (slow, no jump or dash) unless a roll was called for
   just before it. Returns true if it rolled. Called by locomotion on the frame the Jedi lands. */
export function landingImpact(impact){
  if (G.hero === 'mando' || player.slamming || player.airCut) return false;   // (the aerial cut lands in its own follow-through)
  if (impact < MOVE.staggerImpact) return false;
  if (G.gt - (player.rollReqT ?? -9) < MOVE.rollWindow){ landingRoll(); return true; }
  const s = clamp((impact - MOVE.staggerImpact) / MOVE.staggerSpan, 0, 1);
  player.landStagT = MOVE.staggerMin + (MOVE.staggerMax - MOVE.staggerMin) * s;
  player.landStagAt = G.gt;
  player.landDip = Math.max(player.landDip || 0, 0.22 + s * 0.3);
  player.moveVel.multiplyScalar(0.35); player.vel.multiplyScalar(0.35);
  return false;
}

/* The dash key (SHIFT) in the air near the ground (or during the first instant of a stagger) asks for a roll instead of a dash. */
export function requestRoll(pp){
  if (G.hero === 'mando') return false;
  if (player.landStagT > 0 && G.gt - (player.landStagAt ?? -9) < MOVE.rollWindow * 0.6){ landingRoll(); return true; }
  if (player.grounded || player.mantle) return false;
  const h = pp.y - (player.groundY || 0);
  if (player.vy < -6 && h < Math.max(1.2, -player.vy * MOVE.rollWindow)){ player.rollReqT = G.gt; return true; }
  return false;
}

function landingRoll(){
  player.rollReqT = -9; player.landStagT = 0;
  tutEvent('roll');
  flowLink('roll');
  const f = fwd();
  let dx = player.moveVel.x + player.vel.x, dz = player.moveVel.z + player.vel.z;
  if (dx * dx + dz * dz < 1){ dx = f.x; dz = f.z; }
  const d = Math.hypot(dx, dz); dx /= d; dz /= d;
  player.vel.x += dx * MOVE.rollSpeed; player.vel.z += dz * MOVE.rollSpeed;
  player.dashT = Math.max(player.dashT, MOVE.rollIframes);
  player.landDip = 0.12;
  // a forward roll along the way you're going (the body turns to face it), whichever way the camera looks
  launchFlip({ t: 0, dur: MOVE.rollTime, somer: 1, lift: -0.45, legs: 'tuck', arms: 'tuck', side: 1 }, 'fwd');
  S.land(0.3);
}
