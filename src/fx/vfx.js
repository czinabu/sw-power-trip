// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// One-shot VFX: push waves, hit sparks, parry flashes, ground shocks (drawn with the Ink kit in ink.js).

import { scene } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { vfx, G, player } from '../state.js';
import { flashLight } from './lights.js';
import { inkSprite, sparks, hitSpark, clashFlash, groundRing, updateInk } from './ink.js';

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
  dir = dir.clone().normalize();   // pitch kept: a push aimed up at a jetpacker ripples up toward it (player/aim.js)
  const start = V3(pos.x + dir.x, (pos.y || 0) + 1.45 + dir.y, pos.z + dir.z);
  const front = V3(pos.x + dir.x*2.2, (pos.y || 0) + 1.3 + dir.y*2.2, pos.z + dir.z*2.2);   // ripples form ahead of the palm, clear of the body
  const ripple = (delay, op, lead) => {
    inkSprite({ pos: front, normal: dir, shape: 'ring', inner: 0.66, color, size: [0.8, 2.6 + 3*power], ease: 2,
                life: 0.3, delay, op, fadeAt: 0.25, coreW: 0.12, coreHot: 1.1, inkW: 0.2,
                vel: dir.clone().multiplyScalar((14 + 12*power) * lead) });
  };
  ripple(0, 1, 1);
  ripple(0.06, 0.7, 0.8);
  // the palm burst + speed lines thrown down the push
  // saber holstered: both palms throw the push, so the burst and speed lines leave a hand each
  const hands = player.holstered && G.hero !== 'mando' ? [-0.3, 0.3] : [0];
  for (const side of hands){
    const at = hands.length > 1 ? V3(start.x - dir.z*side, start.y - 0.15, start.z + dir.x*side) : start;
    inkSprite({ pos: at, shape: 'star', points: 6, sharp: 0.3, color, size: [0.35, 0.9 + 0.4*power], life: 0.14, steps: 2, coreW: 0.45 });
    sparks(at, color, Math.round((10 + 8*power) / hands.length), 28 + 10*power, { dir, cone: 0.32, life: 0.26, grav: 0, stretch: 5, size: 0.5 });
  }
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
