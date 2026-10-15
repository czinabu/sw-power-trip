// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Parkour: ledge mantle and vault, the Jedi wall-run, and the landing roll / hard-landing stagger.

import { MOVE } from '../data/movement.js';
import { S } from '../audio/sfx.js';
import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, G, solids, keys, player } from '../state.js';
import { fwd, rightV } from './helpers.js';
import { STEP_UP } from '../world/collision.js';

const smooth = k => k * k * (3 - 2 * k);
const easeOut = k => 1 - (1 - k) * (1 - k);

/* LEDGE PROBE — the nearest solid in front of the body (along unit `dir`) whose top sits between `minUp` and `maxUp`
   above the feet and whose face is within grabbing distance. Returns where to stand on top, or null. */
export function findLedge(pp, dir, minUp, maxUp){
  const reach = MOVE.grabDist + 0.55;   // body radius + grab
  let best = null, bestD = 1e9;
  for (const c of solids){
    const up = c.h - pp.y;
    if (up <= minUp || up > maxUp) continue;
    let nx, nz, d, tx, tz;
    if (c.box){
      const cx = clamp(pp.x, c.x - c.hx, c.x + c.hx), cz = clamp(pp.z, c.z - c.hz, c.z + c.hz);
      const dx = pp.x - cx, dz = pp.z - cz; d = Math.hypot(dx, dz);
      if (d < 0.001) continue;                       // already over it — collision handles that
      nx = dx / d; nz = dz / d;
      const inX = Math.min(0.6, c.hx * 0.9), inZ = Math.min(0.6, c.hz * 0.9);
      tx = clamp(cx - nx * 0.6, c.x - c.hx + inX, c.x + c.hx - inX);
      tz = clamp(cz - nz * 0.6, c.z - c.hz + inZ, c.z + c.hz - inZ);
    } else {
      const dx = pp.x - c.x, dz = pp.z - c.z, dc = Math.hypot(dx, dz);
      if (dc < 0.001) continue;
      d = dc - c.r; nx = dx / dc; nz = dz / dc;
      const ins = Math.max(0, c.r - 0.6);
      tx = c.x + nx * ins; tz = c.z + nz * ins;
    }
    if (d > reach) continue;
    if (-(nx * dir.x + nz * dir.z) < 0.55) continue;   // must be heading into its face
    if (d < bestD){ bestD = d; best = { c, top: c.h, x: tx, z: tz }; }
  }
  return best;
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
  const ledge = findLedge(pp, moveDir(), STEP_UP, MOVE.reach);
  if (!ledge) return false;
  startMantle(pp, ledge, false);
  return true;
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
    if (c.h < pp.y + 1.4) continue;   // needs wall above the shoulders to run on
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
  const h = shared.arenaHalf - 1;
  if (pp.x >  h - range) return V3(-1, 0, 0);
  if (pp.x < -h + range) return V3( 1, 0, 0);
  if (pp.z >  h - range) return V3( 0, 0, -1);
  if (pp.z < -h + range) return V3( 0, 0,  1);
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
  player.vy = MOVE.wallRunLift;   // the feet catch the wall: a small, fixed lift (not the jump's full rise)
  S.dash();
}

/* LANDING — a hard touchdown buckles the knees for a beat (slow, no jump or dash) unless a roll was called for
   just before it. Returns true if it rolled. Called by locomotion on the frame the Jedi lands. */
export function landingImpact(impact){
  if (G.hero === 'mando' || player.slamming) return false;
  if (impact < MOVE.staggerImpact) return false;
  if (G.gt - (player.rollReqT ?? -9) < MOVE.rollWindow){ landingRoll(); return true; }
  const s = clamp((impact - MOVE.staggerImpact) / MOVE.staggerSpan, 0, 1);
  player.landStagT = MOVE.staggerMin + (MOVE.staggerMax - MOVE.staggerMin) * s;
  player.landStagAt = G.gt;
  player.landDip = Math.max(player.landDip || 0, 0.22 + s * 0.3);
  player.moveVel.multiplyScalar(0.35); player.vel.multiplyScalar(0.35);
  return false;
}

/* SHIFT in the air near the ground (or during the first instant of a stagger) asks for a roll instead of a dash. */
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
  const f = fwd(), r = rightV();
  let dx = player.moveVel.x + player.vel.x, dz = player.moveVel.z + player.vel.z;
  if (dx * dx + dz * dz < 1){ dx = f.x; dz = f.z; }
  const d = Math.hypot(dx, dz); dx /= d; dz /= d;
  player.vel.x += dx * MOVE.rollSpeed; player.vel.z += dz * MOVE.rollSpeed;
  player.dashT = Math.max(player.dashT, MOVE.rollIframes);
  player.landDip = 0.12;
  const df = dx * f.x + dz * f.z, drr = dx * r.x + dz * r.z, side = Math.abs(drr) > Math.abs(df);
  player.flip = side ? { t: 0, dur: MOVE.rollTime, roll: 1, side: drr >= 0 ? 1 : -1, lift: -0.35, legs: 'tuck', arms: 'tuck' }
                     : { t: 0, dur: MOVE.rollTime, somer: df >= 0 ? 1 : -1, lift: -0.45, legs: 'tuck', arms: 'tuck', side: 1 };
  S.land(0.3);
}
