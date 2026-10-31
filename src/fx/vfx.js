// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// One-shot VFX: push waves, hit sparks, parry flashes, ground shocks (drawn with the Ink kit in ink.js).

import { scene } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { vfx } from '../state.js';
import { flashLight } from './lights.js';
import { inkSprite, sparks, hitSpark, clashFlash, groundRing, updateInk } from './ink.js';
import { castFrom, castHands, updatePalmCasts } from './palms.js';

/* ---------- pooled flourish VFX (shockwaves, ground rings, flashes) — driven by the main loop so they respect slow-mo ---------- */
export function updateVFX(dt){
  updatePalmCasts(dt);
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
// a wall of force thrown from the palm: ripple rings born in the hand that grow as they run out down the push, a flare
// in the palm and speed lines. power (~0.2 a jab … 1.5 mighty) scales how big, far-travelling and bright it is.
// hands: which palms throw it (fx/palms.js; default: the free hand, or both with the saber holstered). The rings leave
// a beat after the cast, once the arm is out. hero: whose palms (a co-op partner's puppet: net/partner-fx.js). Drawn in
// Ink: an ink rim and a hot leading edge.
export function spawnPushWave(pos, dir, color, power, hands, hero){
  power = power || 1;
  dir = dir.clone().normalize();   // pitch kept: a push aimed up at a jetpacker ripples up toward it (player/aim.js)
  castFrom(hands || castHands(), 0.05, pts => {
    const k = pts.length > 1 ? 0.75 : 1;   // two palms share the shove: each throws a little less of it
    for (const at of pts){
      const ripple = (delay, op, lead) => {
        inkSprite({ pos: _w.copy(at).addScaledVector(dir, 0.15), normal: dir, shape: 'ring', inner: 0.66, color, size: [0.22, (1.4 + 2.2*power) * k], ease: 2,
                    life: 0.3, delay, op, fadeAt: 0.25, coreW: 0.12, coreHot: 1.1, inkW: 0.2,
                    vel: dir.clone().multiplyScalar((14 + 12*power) * lead) });
      };
      ripple(0, 1, 1);
      ripple(0.06, 0.7, 0.8);
      inkSprite({ pos: at, shape: 'star', points: 6, sharp: 0.3, color, size: [0.16, (0.4 + 0.2*power) * k], life: 0.12, steps: 2, coreW: 0.45 });
      sparks(at, color, Math.round((8 + 6*power) * k), 24 + 10*power, { dir, cone: 0.25, life: 0.24, grav: 0, stretch: 5, size: 0.42 });
    }
  }, hero);
}
const _w = V3();
// a small, bright flash right where a blade connects
export function spawnHitSpark(pos, color, power){
  hitSpark(pos, color, power || 1);
}
// the perfect-parry flash at the point the blades meet, with a quick local glow
export function spawnParryFlash(pos, color){
  clashFlash(V3(pos.x, pos.y, pos.z), color, true);
  flashLight(color, 1.6, 3, V3(pos.x, pos.y, pos.z), 0.1);
}
// a flat expanding ring on the ground — slam shockwave
export function spawnGroundShock(pos, color, maxR, dur, op){
  groundRing(pos, color, maxR, dur, op);
}
