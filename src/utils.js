// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Small math helpers: V3, rand, clamp, angle/vector damping.

import * as THREE from 'three';

/* ---------- helpers ---------- */
export const V3 = (x,y,z) => new THREE.Vector3(x,y,z);
export const rand = (a,b) => a + Math.random()*(b-a);
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export const TMP = new THREE.Vector3();
export function dampAngle(a, b, lambda, dt){
  const d = ((b - a + Math.PI*3) % (Math.PI*2)) - Math.PI;
  return a + d * (1 - Math.exp(-lambda*dt));
}
// frame-rate independent ease toward a target value
export function dampToward(cur, tgt, dt, lambda){ return cur + (tgt - cur) * (1 - Math.exp(-(lambda||8)*dt)); }
