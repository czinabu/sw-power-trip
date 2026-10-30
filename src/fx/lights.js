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
  for (let i = 0; i < VFX_LIGHT_MAX && !vfxLights[_vlHead].visible; i++) _vlHead = (_vlHead + 1) % VFX_LIGHT_MAX;   // skip any stood down (below)
  const l = vfxLights[_vlHead]; _vlHead = (_vlHead + 1) % VFX_LIGHT_MAX;
  l.color.setHex(color); l.intensity = intensity; l.distance = distance; l.position.copy(pos);
  vfx.push({ light: l, pooled: true, t: 0, dur: dur || 0.3, update(k){ l.intensity = intensity * (1 - k); } });
  return l;
}

/* ---------- HOLD THE COUNT ---------- Other lights still come and go: a boss brings two (his blade and his aura), the
   darksaber one, a co-op partner's saber one. Each would change the count and recompile every material in the arena,
   so every arena used to build all its shaders twice up front (with and without the boss), a large share of each
   load. Instead, while extra lights are in the scene, as many pool lights stand down (flashes use the rest, never
   fewer than MIN_POOL), and step back in when they leave: the count the arena was built with holds. */
const MIN_POOL = 4;
let held = -1;   // the point-light count the arena's shaders were built for (holdLightCount, at each arena build)
function pointLights(){ let n = 0; scene.traverseVisible(o => { if (o.isPointLight) n++; }); return n; }
export function holdLightCount(){
  for (const l of vfxLights) l.visible = true;
  held = pointLights();
}
// before every draw of the scene (three.js counts the lights right after this)
scene.onBeforeRender = () => {
  if (held < 0) return;
  let extra = pointLights() - held;
  for (let i = 0; i < VFX_LIGHT_MAX && extra < 0; i++) if (!vfxLights[i].visible){ vfxLights[i].visible = true; extra++; }
  let down = vfxLights.filter(l => !l.visible).length;
  // stand down the dimmest first, so a flash in progress is the last to go
  for (const l of [...vfxLights].sort((a, b) => a.intensity - b.intensity)){
    if (extra <= 0 || down >= VFX_LIGHT_MAX - MIN_POOL) break;
    if (l.visible){ l.visible = false; extra--; down++; }
  }
};
