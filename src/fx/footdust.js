// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOOTSTEP DUST: a small cel puff kicked up where a foot comes down at a run (the hero: player/anim/gait.js; the
// troopers and bosses: enemies/gait.js), tinted by the arena's own ground light so it reads as that floor's dust,
// snow or ash. Off on bare metal floors. Quiet by design: only near the camera, only at speed, and a capped number a
// second, so a charging squad kicks up a haze rather than a storm.

import * as THREE from 'three';
import { camera, hemi } from '../engine/renderer.js';
import { shared } from '../state.js';
import { puff } from './ink.js';
import { rand } from '../utils.js';

const NO_DUST = new Set(['foundry']);   // metal grating
const DUST = new THREE.Color(0x9a8c78), _c = new THREE.Color(), _v = new THREE.Vector3(), _d = new THREE.Vector3();
let budget = 0, last = 0;

/* a foot lands at `pos` (world) at `speed` m/s; w: how heavy the step (0.6 a light trooper … 1.6 a brute) */
export function footDust(pos, speed, w = 1){
  if (speed < 2.4 || NO_DUST.has(shared.arenaLayout)) return;
  const now = performance.now() / 1000;
  budget = Math.min(10, budget + (now - last) * 14); last = now;   // ~14 puffs a second at most
  if (budget < 1) return;
  if (camera.position.distanceToSquared(pos) > 28 * 28) return;
  budget--;
  const k = Math.min(1, (speed - 2.4) / 6) * w;
  _c.copy(DUST).lerp(hemi.groundColor, 0.45).lerp(new THREE.Color(0xffffff), 0.15);
  _v.set(pos.x + rand(-0.06, 0.06), pos.y + 0.06, pos.z + rand(-0.06, 0.06));
  _d.set(rand(-1, 1) * (0.6 + k), 0.3 + 0.5 * k, rand(-1, 1) * (0.6 + k));
  puff(_v, _c.getHex(), 0.28 + 0.35 * k, 0.32 + 0.2 * k, _d, { drag: 4.5, grow0: 0.35, shade: 0.25, op: 0.35 + 0.3 * Math.min(1, k), inkW: 0.02 });
}
