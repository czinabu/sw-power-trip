// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Small math helpers: V3, rand, clamp, angle/vector damping.

import * as THREE from 'three';

/* ---------- helpers ---------- */
export const V3 = (x,y,z) => new THREE.Vector3(x,y,z);
export const rand = (a,b) => a + Math.random()*(b-a);
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export const TMP = new THREE.Vector3();
// wrap an angle into [lo, lo + 2π). Uses floor, not %, so it also holds for big negative angles (JS % keeps the
// sign, so the old `(d + 3π) % 2π - π` broke once the camera had turned more than ~1.5 turns one way).
export const wrapAngle = (d, lo = -Math.PI) => d - Math.PI*2 * Math.floor((d - lo) / (Math.PI*2));
export function dampAngle(a, b, lambda, dt){
  const d = wrapAngle(b - a);
  return a + d * (1 - Math.exp(-lambda*dt));
}
// frame-rate independent ease toward a target value
export function dampToward(cur, tgt, dt, lambda){ return cur + (tgt - cur) * (1 - Math.exp(-(lambda||8)*dt)); }
