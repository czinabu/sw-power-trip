// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Marks that stay on a unit's armour, pinned to the body's REST pose so they ride the plate they landed on however the
// body bends: the saber cuts (enemies/scars.js) and the HIT MARKS below. Drawn by the unit's armour material
// (enemies/kit.js wearArmor). Kept free of the game's state so the enemy lab can stamp them too.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rand } from '../utils.js';
import { HITS } from './kit.js';
import { burst } from '../fx/particles.js';

export const scarClock = () => performance.now() / 1000;

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _dir = new THREE.Vector3();

// world → the body's rest pose, through bone bi of skinned mesh sm (a direction when dir is set)
export function toRest(sm, bi, v, out, dir){
  const sk = sm.skeleton;
  _m.copy(sk.bones[bi].matrixWorld).multiply(sk.boneInverses[bi]).multiply(sm.bindMatrix);
  _inv.copy(_m).invert();
  return dir ? out.copy(v).transformDirection(_inv) : out.copy(v).applyMatrix4(_inv);
}
// each named bone's joint in the rest pose (cached on the mesh)
export function restJoints(sm){
  if (sm.userData.joints) return sm.userData.joints;
  const J = {};
  sm.skeleton.bones.forEach((b, i) => {
    if (!b.name) return;
    J[b.name] = { i, o: new THREE.Vector3().applyMatrix4(_m.copy(sm.skeleton.boneInverses[i]).invert()).applyMatrix4(sm.bindMatrixInverse) };
  });
  return (sm.userData.joints = J);
}
// which bone carries the skin at world point v: the helmet, the chest, a foot, shin or thigh, else the pelvis
export function boneAt(sm, v){
  const J = restJoints(sm), S = J.thighL ? J.thighL.o.y / 0.94 : 1;   // the bosses' body is the trooper kit scaled up
  const at = j => toRest(sm, j.i, v, _q);
  if (J.head && at(J.head).y >= J.head.o.y - 0.05 * S) return J.head.i;
  if (J.chest && at(J.chest).y >= J.chest.o.y) return J.chest.i;
  for (const n of ['L', 'R']){
    for (const part of ['foot', 'shin', 'thigh']){
      const j = J[part + n]; if (!j) continue;
      const p = at(j);
      if (Math.sign(p.x) === Math.sign(j.o.x) && Math.abs(p.x - j.o.x) < 0.2 * S && p.y <= j.o.y + 0.04 * S) return j.i;
    }
  }
  return 0;
}

/* ---------- hit marks: locational damage that stays ----------
   A blaster bolt leaves a sooty scorch with a hot core; a fist or a blunt blow dents the plate and knocks the paint off;
   a hit on a helmet cracks it; a heavy blow or a blast can tear a plate off, so it spins away and the dark suit shows
   where it was. Each mark is pinned to the plate it landed on in the rest pose (like the saber cuts above), drawn by
   the unit's armour material (enemies/kit.js), up to HITS of them. kind: 'scorch' | 'dent' | 'crack' | 'tear'.
   o.heavy makes a dent bigger and, now and then, tears the plate off instead. Visual only. */
const MARK = { scorch: [1, 0.07], dent: [2, 0.065], crack: [3, 0.1], tear: [4, 0.1] };
export function markHit(group, at, dir, kind = 'scorch', o = {}){
  const u = group.userData, sm = u.bodySkin, W = u.bodyMat && u.bodyMat.userData.wear;
  if (!sm || !W || !at) return;
  group.updateMatrixWorld(true);
  const bi = boneAt(sm, at), J = restJoints(sm), head = J.head && bi === J.head.i;
  if (head && u.lids) return;                                       // a bare face takes no plate marks
  if (head && kind !== 'tear' && (kind === 'dent' || Math.random() < 0.5)) kind = 'crack';   // a helmet cracks
  if (kind === 'dent' && o.heavy && !head && Math.random() < 0.45) kind = 'tear';
  const rp = toRest(sm, bi, at, _p);
  const S = (u.legScale || 1);
  if (rp.y < 0.25 * S) return;
  // pull it onto the surface: from the hit point a little way into the body, so it lands on the plate, not in the air
  const M = MARK[kind], k = (W.hitNext || 0) % HITS; W.hitNext = k + 1;
  W.uHit.value[k].set(rp.x, rp.y, rp.z, scarClock());
  W.uHitK.value[k].set(M[1] * S * (o.heavy ? 1.35 : 1) * (o.size || 1), M[0], Math.random() * 50, 0);
  if (kind === 'tear') flingPlate(group, at, dir);
}
// the torn plate: a curved shard in the unit's own armour, thrown off the way the blow went, spinning, then it
// lies on the floor for a while like the severed limbs
const SHARD = (() => {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape([[-0.08,-0.06],[0.07,-0.07],[0.09,0.03],[0.02,0.08],[-0.07,0.05]].map(([x, y]) => new THREE.Vector2(x, y))),
    { depth: 0.022, bevelEnabled: false });
  g.translate(0, 0, -0.011); g.computeVertexNormals(); return g;
})();
function flingPlate(group, at, dir){
  const u = group.userData;
  const m = new THREE.Mesh(SHARD, u.bodyMat);
  m.castShadow = true;
  m.position.copy(at);
  m.scale.setScalar(group.scale.x * (u.legScale || 1));
  scene.add(m);
  const d = dir ? _dir.set(dir.x, 0, dir.z) : _dir.set(rand(-1, 1), 0, rand(-1, 1));
  if (d.lengthSq() < 1e-4) d.set(1, 0, 0);
  d.normalize();
  const v = new THREE.Vector3(d.x * rand(3, 5.5) + rand(-1, 1), rand(3, 5.5), d.z * rand(3, 5.5) + rand(-1, 1));
  plates.push({ o: m, v, spin: new THREE.Vector3(rand(-14, 14), rand(-10, 10), rand(-14, 14)), t: 0, rest: false, floor: group.position.y + 0.02 });   // (lands at the unit's feet)
  burst(at, 0x9aa3ad, 4, 5, 4, 0.5);
}


// the torn plates in flight, then lying on the floor a while (stepped with the severed limbs: enemies/scars.js)
const plates = [];
const HOLD = 6, SINK = 1.2;
export function updatePlates(dt){
  for (let i = plates.length - 1; i >= 0; i--){
    const P = plates[i], o = P.o;
    P.t += dt;
    if (!P.rest){
      P.v.y -= 22 * dt;
      o.position.addScaledVector(P.v, dt);
      o.rotation.x += P.spin.x * dt; o.rotation.y += P.spin.y * dt; o.rotation.z += P.spin.z * dt;
      const floor = P.floor;
      if (o.position.y <= floor && P.v.y < 0){
        o.position.y = floor;
        if (Math.abs(P.v.y) > 3){ P.v.y *= -0.3; P.v.x *= 0.5; P.v.z *= 0.5; P.spin.multiplyScalar(0.4); }
        else { P.rest = true; o.rotation.x = Math.PI / 2; o.rotation.z = 0; }   // lies flat
      }
    }
    if (P.t > HOLD) o.position.y -= dt * 0.1 / SINK;
    if (P.t > HOLD + SINK){ scene.remove(o); plates.splice(i, 1); }
  }
}
export function clearPlates(){ for (const P of plates) scene.remove(P.o); plates.length = 0; }
