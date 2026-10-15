// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// One-shot VFX: push waves, hit sparks, parry flashes, ground shocks (drawn with the Ink kit in ink.js).

import { scene } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { vfx } from '../state.js';
import { flashLight } from './lights.js';
import { inkSprite, sparks, puff, hitSpark, clashFlash, groundRing, updateInk } from './ink.js';

/* ---------- pooled flourish VFX (shockwaves, ground rings, flashes) — driven by the main loop so they respect slow-mo ---------- */
export function updateVFX(dt){
  updateInk(dt);
  for (let i = vfx.length-1; i >= 0; i--){
    const v = vfx[i];
    v.t += dt;
    const k = v.t / v.dur;
    if (k >= 1){
      if (v.mesh) scene.remove(v.mesh);
      if (v.light){ if (v.pooled) v.light.intensity = 0; else scene.remove(v.light); }   // pooled lights stay in the scene
      vfx.splice(i,1); continue;
    }
    v.update(k, dt);
  }
}
// an expanding shockwave projected forward — a wall of force leaving the hand.
// power (~0.5 basic … 1.5 mighty) scales how big, far-travelling and bright it is.
// Drawn in Ink: concentric ripple rings with an ink rim and a hot leading edge, plus speed-line streaks.
export function spawnPushWave(pos, dir, color, power){
  power = power || 1;
  dir = dir.clone().setY(0).normalize();
  const start = V3(pos.x + dir.x, (pos.y || 0) + 1.45, pos.z + dir.z);
  const ripple = (delay, op, lead) => {
    inkSprite({ pos: start, normal: dir, shape: 'ring', inner: 0.7, color, size: [0.9, 2.4 + 3.6*power], ease: 2,
                life: 0.36, delay, op, fadeAt: 0.3, coreW: 0.14, inkW: 0.16,
                vel: dir.clone().multiplyScalar((14 + 12*power) * lead) });
  };
  ripple(0, 1, 1);
  ripple(0.06, 0.7, 0.8);
  // the shove itself: a wedge of translucent, blade-tinted air puffs that tumble forward and break up
  for (let i = 0; i < 4; i++){
    const side = (i - 1.5) * 0.45;
    puff(V3(start.x + dir.z*side, start.y + (i % 2 ? 0.25 : -0.2), start.z - dir.x*side), color, 1.3 + 0.7*power, 0.34,
         V3(dir.x*(20 + 8*power) + dir.z*side*4, 0, dir.z*(20 + 8*power) - dir.x*side*4), { grow0: 0.35, drag: 3, shade: 0.25, op: 0.45, delay: i*0.015 });
  }
  // the palm burst + speed lines thrown down the push
  inkSprite({ pos: start, shape: 'star', points: 6, sharp: 0.3, color, size: [0.35, 0.9 + 0.4*power], life: 0.14, steps: 2, coreW: 0.45 });
  sparks(start, color, Math.round(6 + 6*power), 26 + 10*power, { dir, cone: 0.28, life: 0.22, grav: 0, stretch: 4, size: 0.45 });
}
// a bright impact at the point a blade connects — cel star, shock ring and streak sparks
export function spawnHitSpark(pos, color, power){
  hitSpark(pos, color, power || 1);
}
// a bright clash burst at chest height — perfect-parry flash
export function spawnParryFlash(pos, color){
  clashFlash(V3(pos.x, pos.y, pos.z), color, true);
  flashLight(color, 7, 8, V3(pos.x, pos.y, pos.z), 0.28);
}
// a flat expanding ring on the ground — slam shockwave
export function spawnGroundShock(pos, color, maxR, dur, op){
  groundRing(pos, color, maxR, dur, op);
}
