// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The boss's Force lightning visuals.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rand } from '../utils.js';
import { shared } from '../state.js';

/* Sith force lightning — a forked beam from the boss's hand. Catch it on your guard
   (hold RMB facing him) or PUSH it to throw it back and stun him. */

const BL_SEG = 13;
function ensureBossLight(){
  if (shared.bossLight) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BL_SEG*3), 3));
  shared.bossLight = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: 0xcc66ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
  shared.bossLight.visible = false; shared.bossLight.frustumCulled = false;
  scene.add(shared.bossLight);
}
const BLA = new THREE.Vector3(), BLB = new THREE.Vector3();
export function updateBossLightFX(from, to, color){
  ensureBossLight();
  shared.bossLight.visible = true;
  shared.bossLight.material.color.setHex(color);
  shared.bossLight.material.opacity = rand(0.6, 1);
  BLA.copy(from); BLB.copy(to);
  const a = shared.bossLight.geometry.attributes.position;
  for (let s = 0; s < BL_SEG; s++){
    const k = s / (BL_SEG - 1);
    const jit = (s === 0 || s === BL_SEG-1) ? 0 : (1 - Math.abs(k-0.5)*1.2) * 0.7;
    a.setXYZ(s,
      BLA.x + (BLB.x - BLA.x)*k + rand(-jit, jit),
      BLA.y + (BLB.y - BLA.y)*k + rand(-jit, jit),
      BLA.z + (BLB.z - BLA.z)*k + rand(-jit, jit));
  }
  a.needsUpdate = true;
}
