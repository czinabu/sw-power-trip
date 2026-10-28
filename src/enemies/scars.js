// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Saber damage that stays. A blade that lands burns a cut into the armour where it crossed (glowing at first, then
// cooling to a black char that the unit wears for the rest of the fight), and a killing cut can take a foe's sword
// arm off at the shoulder. Called from the hero's blades: the Jedi saber (player/jedi/combat.js, aerial.js) and the
// Mandalorian's darksaber (player/mando/darksaber.js). Visual only: nothing here touches health or the AI.
//
// A cut is drawn by the unit's own armour material (enemies/kit.js wearArmor, up to SCARS of them). It is stored in
// the body's REST pose, pinned to the bone under it (chest, head, a thigh, a shin...), so it rides the plate it landed
// on however the body then bends.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rand, clamp } from '../utils.js';
import { SCARS } from './kit.js';
import { bladePointNear } from '../player/jedi/clash.js';
import { groundAt } from '../world/collision.js';
import { burst } from '../fx/particles.js';

export const scarClock = () => performance.now() / 1000;

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
const _c = new THREE.Vector3(), _b = new THREE.Vector3(), _w = new THREE.Vector3(), _dir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// world → the body's rest pose, through bone bi of skinned mesh sm (a direction when dir is set)
function toRest(sm, bi, v, out, dir){
  const sk = sm.skeleton;
  _m.copy(sk.bones[bi].matrixWorld).multiply(sk.boneInverses[bi]).multiply(sm.bindMatrix);
  _inv.copy(_m).invert();
  return dir ? out.copy(v).transformDirection(_inv) : out.copy(v).applyMatrix4(_inv);
}
// each named bone's joint in the rest pose (cached on the mesh)
function restJoints(sm){
  if (sm.userData.joints) return sm.userData.joints;
  const J = {};
  sm.skeleton.bones.forEach((b, i) => {
    if (!b.name) return;
    J[b.name] = { i, o: new THREE.Vector3().applyMatrix4(_m.copy(sm.skeleton.boneInverses[i]).invert()).applyMatrix4(sm.bindMatrixInverse) };
  });
  return (sm.userData.joints = J);
}
// which bone carries the skin at world point v: the helmet, the chest, a foot, shin or thigh, else the pelvis
function boneAt(sm, v){
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

/* burn a cut where the hero's blade crossed `group`'s body. f: the blow's direction (the hero's facing); dirKey: the
   cut's line ('left' / 'right' sweep across, else a diagonal); heavy: a finisher or a heavy form, more upright */
export function scarBody(group, f, dirKey, heavy){
  const u = group.userData, sm = u.bodySkin, W = u.bodyMat && u.bodyMat.userData.wear;
  if (!sm || !W) return;
  group.updateMatrixWorld(true);
  const H = group.scale.x * (u.vis ? u.vis.scale.y : 1) * (u.legScale || 1), gp = group.position;
  // the height: where your blade passes the body (else somewhere on the torso), on the plate facing the blow
  _c.set(gp.x, gp.y + 1.4 * H, gp.z);
  let y = gp.y + rand(1.05, 1.65) * H;
  if (bladePointNear(_c, _b)) y = clamp(_b.y, gp.y + 0.45 * H, gp.y + 1.85 * H);
  const side = rand(-0.09, 0.09) * H;
  _w.set(gp.x - f.x * 0.2 * H + f.z * side, y, gp.z - f.z * 0.2 * H - f.x * side);
  // the line of the cut: a sweep goes across, a plain cut runs on a slant, a heavy blow comes down near upright
  _dir.set(f.z, 0, -f.x);
  if (heavy) _dir.multiplyScalar(0.35).addScaledVector(UP, Math.random() < 0.5 ? 1 : -1);
  else if (dirKey !== 'left' && dirKey !== 'right') _dir.addScaledVector(UP, rand(0.6, 1.1) * (Math.random() < 0.5 ? 1 : -1));
  else _dir.addScaledVector(UP, rand(-0.25, 0.25));
  _dir.normalize();
  const bi = boneAt(sm, _w);
  const rp = toRest(sm, bi, _w, _p);
  if (rp.y < 0.25 * (u.legScale || 1)) return;   // (the boots: below where a sword arm's own rest pose lives, see kit.js)
  const rd = toRest(sm, bi, _dir, _q, true);
  const k = (W.scarNext || 0) % SCARS; W.scarNext = k + 1;
  W.uScar.value[k].set(rp.x, rp.y, rp.z, scarClock());
  W.uScarDir.value[k].set(rd.x, rd.y, rd.z, rand(0.11, 0.18) * (u.legScale || 1) * (heavy ? 1.2 : 1));
}

/* ---------- severed sword arms ---------- */
const CAP = new THREE.CircleGeometry(0.075, 10);
const pieces = [];   // { o, v, spin, t, caps, rest }

/* a killing cut: maybe take the sword arm off. Returns true if it did */
export function severArm(e, f, chance){
  const u = e.group.userData, arm = u.weaponArm;
  if (!arm || !arm.parent || Math.random() >= chance) return false;
  const host = arm.parent, at = arm.position.clone();
  scene.attach(arm);
  u.weaponArm = null;
  // the cut glows on both sides of the wound, then cools
  const caps = [];
  const cap = (parent, pos, faceDown) => {
    const m = new THREE.Mesh(CAP, new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.copy(pos); m.rotation.x = faceDown ? Math.PI / 2 : -Math.PI / 2; m.userData.noAO = true;
    parent.add(m); caps.push(m);
  };
  cap(host, at, false); cap(arm, new THREE.Vector3(0, 0.02, 0), true);
  burst(arm.getWorldPosition(_c), 0xffa040, 10, 6, 4, 0.5);
  pieces.push({ o: arm, v: new THREE.Vector3(f.x * rand(2.5, 4.5), rand(3.5, 5.5), f.z * rand(2.5, 4.5)),
                spin: new THREE.Vector3(rand(-9, 9), rand(-6, 6), rand(-9, 9)), t: 0, caps, rest: false });
  return true;
}

const HOLD = 7, SINK = 1.2;   // seconds an arm lies there, then how long it takes to sink away
export function updateSevered(dt){
  for (let i = pieces.length - 1; i >= 0; i--){
    const P = pieces[i], o = P.o;
    P.t += dt;
    for (const c of P.caps) c.material.opacity = Math.max(0, 1 - P.t / 2.2);
    if (!P.rest){
      P.v.y -= 22 * dt;
      o.position.addScaledVector(P.v, dt);
      o.rotation.x += P.spin.x * dt; o.rotation.y += P.spin.y * dt; o.rotation.z += P.spin.z * dt;
      const floor = groundAt(o.position.x, o.position.z, o.position.y + 0.5) + 0.12;
      if (o.position.y <= floor && P.v.y < 0){
        o.position.y = floor;
        if (Math.abs(P.v.y) > 3){ P.v.y *= -0.3; P.v.x *= 0.5; P.v.z *= 0.5; P.spin.multiplyScalar(0.4); }   // one bounce
        else { P.rest = true; o.rotation.x = Math.PI / 2 * Math.sign(o.rotation.x || 1); o.rotation.z = 0; }   // lies flat
      }
    }
    if (P.t > HOLD) o.position.y -= dt * 0.5 / SINK;
    if (P.t > HOLD + SINK){ dropPiece(P); pieces.splice(i, 1); }
  }
}
function dropPiece(P){
  for (const c of P.caps){ c.parent && c.parent.remove(c); c.material.dispose(); }
  if (P.o.parent) P.o.parent.remove(P.o);
}
/* a new arena: clear them all */
export function clearSevered(){ for (const P of pieces) dropPiece(P); pieces.length = 0; }
