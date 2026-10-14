// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Pooled particle bursts.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rand, clamp } from '../utils.js';

/* ============================================================
   PARTICLES — a fixed POOL (ring buffer). Every particle owns a reusable
   mesh + material built once at startup, so spawning a burst allocates
   NOTHING at runtime (no GC churn mid-combat). Each material is per-particle
   so callers can still override colour / opacity / blending freely.
   ============================================================ */
const PARTICLE_MAX = 420;
const partGeo = new THREE.TetrahedronGeometry(0.14);
const particles = [];
let _partHead = 0;          // ring cursor — wraps and recycles the oldest when full
for (let i = 0; i < PARTICLE_MAX; i++){
  const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ transparent: true }));
  m.visible = false;
  m.userData = { vel: new THREE.Vector3(), life: 0, active: false };
  scene.add(m);
  particles.push(m);
}
// hand out the next pooled particle, reset to sane defaults; caller sets pos/scale/vel/life
export function acquireParticle(){
  const m = particles[_partHead];
  _partHead = (_partHead + 1) % PARTICLE_MAX;
  m.visible = true;
  m.userData.active = true;
  m.material.opacity = 1;
  m.material.blending = THREE.NormalBlending;   // reset in case it was reused from a flame puff
  m.material.depthWrite = true;
  m.rotation.set(0, 0, 0);
  return m;
}
export function burst(pos, color, count, speed, up, size){
  for (let i=0;i<count;i++){
    const m = acquireParticle();
    m.material.color.setHex(color);
    m.position.copy(pos);
    m.scale.setScalar(size || rand(0.7,1.6));
    const a = Math.random()*Math.PI*2, e = rand(-0.4,1);
    m.userData.vel.set(Math.cos(a)*speed*rand(.3,1), (up||4)*rand(.2,1)+e, Math.sin(a)*speed*rand(.3,1));
    m.userData.life = rand(0.3,0.7);
  }
}
export function updateParticles(dt){
  for (let i=0;i<PARTICLE_MAX;i++){
    const p = particles[i], u = p.userData;
    if (!u.active) continue;
    u.life -= dt;
    if (u.life <= 0){ u.active = false; p.visible = false; continue; }
    u.vel.y -= 14*dt;
    p.position.addScaledVector(u.vel, dt);
    if (p.position.y < 0.05){ p.position.y = 0.05; u.vel.y *= -0.4; u.vel.x *= 0.7; u.vel.z *= 0.7; }
    p.material.opacity = clamp(u.life*2.5, 0, 1);
    p.rotation.x += dt*6; p.rotation.z += dt*5;
  }
}
