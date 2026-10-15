// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Pose solvers for the hero rig: two-bone arm IK and "point this held thing that way" for blades and guns.
//
// Everything here works in CHEST space (the rig's chest joint: +x is the weapon-hand side, +y up, +z the way the
// hero faces), so a pose authored as "hand here, blade pointing there" turns with the upper body for free.

import * as THREE from 'three';
import { DIM } from '../model/rig.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _m = new THREE.Matrix4();

/* Two-bone IK: put the arm's wrist at `target` (chest space), bending the elbow toward `pole` (a chest-space
   direction the elbow should point, e.g. down and out). Writes sh.quaternion and el.rotation; leaves wr alone. */
export function solveArm(arm, target, pole){
  const a = DIM.upper, b = DIM.fore;
  const S = arm.sh.position;
  const d = _a.subVectors(target, S);
  const dist = THREE.MathUtils.clamp(d.length(), 0.08, a + b - 0.002);
  const dn = d.normalize();
  // elbow bend from the law of cosines; the forearm folds toward the arm's local +z
  const inner = Math.acos(THREE.MathUtils.clamp((a*a + b*b - dist*dist) / (2*a*b), -1, 1));
  const bend = Math.PI - inner;
  arm.el.rotation.set(-bend, 0, 0);
  // the wrist in the shoulder's rest frame, then the swing that lays that onto the target direction
  const h = _b.set(0, -a - b*Math.cos(bend), b*Math.sin(bend)).normalize();
  _q.setFromUnitVectors(h, dn);
  // twist about the shoulder→wrist line so the elbow points toward the pole
  const e = _c.set(0, -a, 0).applyQuaternion(_q);
  e.addScaledVector(dn, -e.dot(dn));
  const p = _d.copy(pole).addScaledVector(dn, -pole.dot(dn));
  if (e.lengthSq() > 1e-8 && p.lengthSq() > 1e-8){
    e.normalize(); p.normalize();
    const ang = Math.atan2(_b.crossVectors(e, p).dot(dn), e.dot(p));
    _q2.setFromAxisAngle(dn, ang);
    _q.premultiply(_q2);
  }
  arm.sh.quaternion.copy(_q);
}

/* Point a held node so its local `axis` (e.g. the blade's +y) lies along `dir` (chest space), splitting the turn
   between the wrist joint (`wristShare` of it, the visible wrist snap) and the node itself. Call after the arm is
   posed. `chest` and the arm must have up-to-date world matrices (updateWorldMatrix). */
export function aimHeld(chest, wr, node, axis, dir, wristShare = 0.35, upAxis = null, upHint = null){
  // chest-space dir → the elbow's frame (the wrist joint's parent)
  const el = wr.parent;
  el.updateWorldMatrix(true, false);
  chest.getWorldQuaternion(_q2);
  el.getWorldQuaternion(_q3).invert();
  _q2.premultiply(_q3);   // chest → elbow frame
  const want = _a.copy(dir).applyQuaternion(_q2).normalize();
  const full = _q.setFromUnitVectors(_b.copy(axis).normalize(), want);
  if (upAxis && upHint){
    // roll about the aim line so the node's upAxis leans toward upHint (keeps a gun upright instead of canted)
    const cur = _c.copy(upAxis).applyQuaternion(full);
    const hint = _d.copy(upHint).applyQuaternion(_q2);
    cur.addScaledVector(want, -cur.dot(want)); hint.addScaledVector(want, -hint.dot(want));
    if (cur.lengthSq() > 1e-8 && hint.lengthSq() > 1e-8){
      cur.normalize(); hint.normalize();
      const ang = Math.atan2(_b.crossVectors(cur, hint).dot(want), cur.dot(hint));
      full.premultiply(_q3.setFromAxisAngle(want, ang));
    }
  }
  wr.quaternion.identity().slerp(full, wristShare);
  node.quaternion.copy(wr.quaternion).invert().multiply(full);   // node = wr⁻¹ · full
}

/* A point on a held node (node-local), expressed in chest space — e.g. where the off-hand closes on the hilt. */
export function pointInChest(chest, node, local, out){
  node.updateWorldMatrix(true, false);
  out.copy(local).applyMatrix4(node.matrixWorld);
  chest.updateWorldMatrix(true, false);
  return out.applyMatrix4(_m.copy(chest.matrixWorld).invert());
}

/* The wrist's position in chest space (for seeding an IK pose from wherever FK left the arm). */
export function wristInChest(chest, arm, out){
  arm.wr.updateWorldMatrix(true, false);
  out.setFromMatrixPosition(arm.wr.matrixWorld);
  chest.updateWorldMatrix(true, false);
  return out.applyMatrix4(_m.copy(chest.matrixWorld).invert());
}
/* A held node's axis direction in chest space. */
export function axisInChest(chest, node, axis, out){
  node.updateWorldMatrix(true, false);
  node.getWorldQuaternion(_q3);
  chest.getWorldQuaternion(_q2).invert();
  return out.copy(axis).applyQuaternion(_q3).applyQuaternion(_q2).normalize();
}

/* Direction slerp (handles the long sweeps of a cut without collapsing through the middle). */
export function slerpDir(a, b, t, out){
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (dot > 0.9995) return out.copy(a).lerp(b, t).normalize();
  const th = Math.acos(dot);
  if (th > Math.PI - 1e-3){   // opposite: go round through UP-ish
    const mid = _c.crossVectors(a, UP).lengthSq() > 1e-6 ? _c.crossVectors(a, UP).normalize() : _c.set(1, 0, 0);
    return t < 0.5 ? slerpDir(a, mid, t*2, out) : slerpDir(mid, b, t*2 - 1, out);
  }
  const s = Math.sin(th);
  return out.copy(a).multiplyScalar(Math.sin((1-t)*th) / s).addScaledVector(b, Math.sin(t*th) / s).normalize();
}

/* Hand path: interpolate around a pivot (the chest centre) so cuts travel on an arc, not a straight chord. */
export function arcLerp(a, b, t, pivot, out){
  const ra = _c.subVectors(a, pivot), la = ra.length();
  const rb = _d.subVectors(b, pivot), lb = rb.length();
  if (la < 1e-4 || lb < 1e-4) return out.copy(a).lerp(b, t);
  const da = ra.clone().divideScalar(la), db = rb.clone().divideScalar(lb);
  slerpDir(da, db, t, out);
  return out.multiplyScalar(la + (lb - la) * t).add(pivot);
}
