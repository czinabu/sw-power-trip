// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// One-shot VFX: push waves, hit sparks, parry flashes, ground shocks.

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { vfx } from '../state.js';
import { flashLight } from './lights.js';

/* ---------- pooled flourish VFX (shockwaves, ground rings, flashes) — driven by the main loop so they respect slow-mo ---------- */
export function updateVFX(dt){
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
export function spawnPushWave(pos, dir, color, power){
  power = power || 1;
  dir = dir.clone().setY(0).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0,0,1), dir);
  const ring = (r0, r1, dur, op, lead) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:op, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false });
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 36), mat);
    m.quaternion.copy(q);
    const start = V3(pos.x + dir.x, 1.45, pos.z + dir.z);
    m.position.copy(start);
    scene.add(m);
    vfx.push({ mesh:m, t:0, dur, update(kk){
      const e = 1 - Math.pow(1-kk, 2);
      const sc = 1 + e * (4 + 4*power);
      m.scale.set(sc, sc, 1);
      m.position.copy(start).addScaledVector(dir, lead + e * (6 + 7*power));   // ride forward off the hand
      mat.opacity = op * (1 - kk);
    }});
  };
  ring(0.45, 0.72, 0.4,  0.42, 0);            // restrained leading wave
  ring(0.35, 0.6,  0.48, 0.26, -1.0*power);   // faint trailing wave
  // a small energy flash at the hand, sized to the power — no scene light, kept subtle
  const fmat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.42, blending:THREE.AdditiveBlending, depthWrite:false });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.13 + 0.06*power, 12, 8), fmat);
  flash.position.set(pos.x + dir.x, 1.45, pos.z + dir.z);
  scene.add(flash);
  vfx.push({ mesh:flash, t:0, dur:0.26, update(kk){
    flash.scale.setScalar(1 + kk*1.6);
    fmat.opacity = 0.42 * (1 - kk);
  }});
}
// a bright impact at the point a blade connects — flash + camera-facing shock ring
export function spawnHitSpark(pos, color, power){
  power = power || 1;
  const fmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false });
  const fl = new THREE.Mesh(new THREE.SphereGeometry(0.14 + 0.08*power, 8, 6), fmat);
  fl.position.copy(pos); scene.add(fl);
  vfx.push({ mesh:fl, t:0, dur:0.13, update(kk){ fl.scale.setScalar(1 + kk*2.2); fmat.opacity = 0.9*(1-kk); }});
  const rmat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.8, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.4, 18), rmat);
  ring.position.copy(pos); ring.lookAt(camera.position);   // face the player
  scene.add(ring);
  vfx.push({ mesh:ring, t:0, dur:0.2, update(kk){ const r = 1 + kk*(3 + power*1.6); ring.scale.set(r, r, 1); rmat.opacity = 0.8*(1-kk); }});
}
// a bright clash burst at chest height — perfect-parry flash
export function spawnParryFlash(pos, color){
  const fmat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), fmat);
  s.position.set(pos.x, pos.y, pos.z); scene.add(s);
  flashLight(color, 7, 8, s.position, 0.28);
  vfx.push({ mesh:s, t:0, dur:0.28, update(kk){ s.scale.setScalar(1 + kk*3); fmat.opacity = 0.95*(1-kk); }});
  const rmat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.85, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.72, 28), rmat);
  ring.position.copy(s.position); ring.rotation.x = Math.PI/2; scene.add(ring);
  vfx.push({ mesh:ring, t:0, dur:0.32, update(kk){ const r = 1 + kk*5; ring.scale.set(r, r, 1); rmat.opacity = 0.85*(1-kk); }});
}
// a flat expanding ring on the ground — slam shockwave
export function spawnGroundShock(pos, color, maxR, dur, op){
  const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:op, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false });
  const m = new THREE.Mesh(new THREE.RingGeometry(0.55, 1.0, 48), mat);
  m.rotation.x = -Math.PI/2;
  m.position.set(pos.x, 0.12, pos.z);
  scene.add(m);
  vfx.push({ mesh:m, t:0, dur, update(kk){
    const e = 1 - Math.pow(1-kk, 3);
    const r = 0.55 + e * maxR;
    m.scale.set(r, r, 1);
    mat.opacity = op * (1 - kk);
  }});
}
