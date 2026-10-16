// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Blade contact: a cut lands on what the blade actually sweeps through, frame by frame, not on a radius around the hero.

import * as THREE from 'three';
import { shared, G, enemies, barrels, player } from '../../state.js';
import { stance } from '../helpers.js';

/* BODIES — each target is an upright capsule: radius and height scale with the unit (enemy.t.scale). A floored foe
   is a low, wide slab. EDGE pads the blade by its glow, so a hit that LOOKS like it touched does. */
export const BODY = { r: 0.42, h: 2.05, downR: 0.95, downH: 0.75, edge: 0.12, bossR: 0.75, bossH: 3.2, barrelR: 0.55, barrelH: 1.3 };
const ALONG = 7, SWEEP = 4;   // points sampled along the blade, and sub-steps between last frame's blade and this one's
const B = new THREE.Vector3(), T = new THREE.Vector3(), PB = new THREE.Vector3(), PT = new THREE.Vector3();
const DOWN = { knockdown: 1, getup: 1, ragdoll: 1 };

// the live blade, base → tip, in world space (the same line the swing trail draws). false when no blade is in hand.
export function bladeSegment(outB, outT){
  const dark = G.hero === 'mando';
  const node = dark ? (player.darksaberMesh && player.darksaberMesh.visible ? player.darksaberMesh : null)
                    : (player.saberBladeRoot || player.saberHand);
  if (!node) return false;
  const len = dark ? 1.3 : 0.18 + 1.6 * (stance().bladeLen || 1);
  node.updateWorldMatrix(true, false);
  outB.set(0, 0.12 * len, 0); node.localToWorld(outB);
  outT.set(0, len, 0); node.localToWorld(outT);
  return true;
}

/* Sweep the blade from where it was last frame to where it is now; return the targets it passed through for the first
   time this swing (enemies, the boss, barrels). The swing remembers who it has already cut. `live` is false outside
   the stroke: the blade is still tracked, so the stroke's first frame sweeps from where it really was. */
export function sweepBlade(sw, live){
  if (!bladeSegment(B, T)) return null;
  if (!sw.pb){ sw.pb = B.clone(); sw.pt = T.clone(); }
  PB.copy(sw.pb); PT.copy(sw.pt);
  sw.pb.copy(B); sw.pt.copy(T);
  if (!live) return null;   // the chamber and the follow-through only track the blade; the stroke between them cuts
  const cut = sw.cutSet || (sw.cutSet = new Set());
  const out = [];
  // the blade swings AROUND the hero, so between two frames its base and tip travel along arcs, not straight chords:
  // interpolate each in cylindrical coordinates about the hero (angle, distance, height). A slow frame still can't
  // let a cut skip over a body it visibly passed through.
  const c = player.group.position;
  const cyl = (v, o) => { o.a = Math.atan2(v.z - c.z, v.x - c.x); o.r = Math.hypot(v.x - c.x, v.z - c.z); o.y = v.y; return o; };
  const b0 = cyl(PB, {}), b1 = cyl(B, {}), t0 = cyl(PT, {}), t1 = cyl(T, {});
  const da = (p, q) => { let d = q.a - p.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const dB = da(b0, b1), dT = da(t0, t1);
  const steps = Math.max(SWEEP, Math.ceil(Math.max(Math.abs(dB), Math.abs(dT)) / 0.2));   // a sample every ~11° of swing
  const pts = [];
  for (let i = 1; i <= steps; i++){
    const s = i / steps;
    const ab = b0.a + dB * s, rb = b0.r + (b1.r - b0.r) * s, yb = b0.y + (b1.y - b0.y) * s;
    const at = t0.a + dT * s, rt = t0.r + (t1.r - t0.r) * s, yt = t0.y + (t1.y - t0.y) * s;
    const bx = c.x + Math.cos(ab) * rb, bz = c.z + Math.sin(ab) * rb, tx = c.x + Math.cos(at) * rt, tz = c.z + Math.sin(at) * rt;
    for (let j = 0; j < ALONG; j++){ const a = j / (ALONG - 1); pts.push(bx + (tx - bx) * a, yb + (yt - yb) * a, bz + (tz - bz) * a); }
  }
  const test = (obj, x, z, y0, y1, r) => {
    if (cut.has(obj)) return;
    r += BODY.edge;
    for (let k = 0; k < pts.length; k += 3){
      const py = pts[k + 1];
      if (py < y0 || py > y1) continue;
      const dx = pts[k] - x, dz = pts[k + 2] - z;
      if (dx * dx + dz * dz < r * r){ cut.add(obj); out.push(obj); return; }
    }
  };
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const p = e.group.position, s = e.t.scale || 1;
    if (DOWN[e.state]) test(e, p.x, p.z, p.y - 0.2, p.y + BODY.downH * s, BODY.downR * s);
    else test(e, p.x, p.z, p.y, p.y + BODY.h * s, BODY.r * s);
  }
  const boss = shared.boss;
  if (boss && boss.hp > 0){ const p = boss.group.position; test(boss, p.x, p.z, p.y, p.y + BODY.bossH, BODY.bossR); }
  for (const b of barrels){ const p = b.mesh.position; test(b, p.x, p.z, p.y - BODY.barrelH / 2, p.y + BODY.barrelH / 2, BODY.barrelR); }
  return out;
}

// how far a fist, boot or blade at `reach` from the hero's centre gets into a body (for the Mando's melee and the kick)
export const bodyRadius = e => (DOWN[e.state] ? BODY.downR : BODY.r) * (e.t.scale || 1);
