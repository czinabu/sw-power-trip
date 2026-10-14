// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Pooled transient VFX point lights (flashLight).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { vfx } from '../state.js';

/* ---------- POOLED VFX point-lights ---------- ADDING or REMOVING a light at runtime changes the scene's light
   count, which forces three.js to RECOMPILE every affected material's shader — the frame hitches you feel when a
   burst of explosions/parries fire at once. Fix: keep a FIXED ring of lights permanently in the scene and only
   FADE their intensity (count never changes → zero recompiles). Transient flashes call flashLight() instead of
   `new THREE.PointLight`. */
const VFX_LIGHT_MAX = 8;
const vfxLights = [];
let _vlHead = 0;
for (let i = 0; i < VFX_LIGHT_MAX; i++){ const l = new THREE.PointLight(0xffffff, 0, 10); scene.add(l); vfxLights.push(l); }
export function flashLight(color, intensity, distance, pos, dur){
  const l = vfxLights[_vlHead]; _vlHead = (_vlHead + 1) % VFX_LIGHT_MAX;
  l.color.setHex(color); l.intensity = intensity; l.distance = distance; l.position.copy(pos);
  vfx.push({ light: l, pooled: true, t: 0, dur: dur || 0.3, update(k){ l.intensity = intensity * (1 - k); } });
  return l;
}
