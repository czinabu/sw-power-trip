// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIVE HOLDS: hands that stay on what they hold while it moves on its own. A Magnaguard's staff guards, spins and
// strikes on its own slot (enemies/duel.js) while both hands stay on its grips. Each frame the holding arm is
// re-aimed (the same two-bone solve the models are built with: enemies/mesh.js reachPose) so its wrist lands on the
// grip marker baked on the held thing, and the hand is turned to match it, so the fingers stay closed round the grip.
// Holds are listed per model (enemies/mesh.js HOLDS); every mode and co-op guests run them through enemies/upper.js.
// Holds are listed per model (enemies/mesh.js HOLDS); every mode and co-op guests run them through enemies/upper.js.

import * as THREE from 'three';
import { reachPose } from './mesh.js';

const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
const QE = new THREE.Quaternion(), out = { b: 0 }, Y = new THREE.Vector3(), V = new THREE.Vector3();
const REACH = 0.78;   // upper arm + forearm (enemies/mesh.js UPPER + FORE), less a touch

export function solveHolds(u){
  for (const h of u.holds){
    const sh = u[h.slot], el = u[h.elbow], hand = u[h.hand], grip = u[h.grip];
    if (!sh || !el || !hand || !grip) continue;
    // a saber cut took the arm (or the held thing) off: it's a loose piece now, leave it be
    if (!h.home) h.home = new WeakMap();
    if (!h.home.has(sh)) h.home.set(sh, [sh.parent, grip.parent]);
    const [shHome, gripHome] = h.home.get(sh);
    if (sh.parent !== shHome || grip.parent !== gripHome || !grip.parent.visible) continue;
    // the grip marker (its origin is where the wrist goes, its axes the hand's) in the shoulder's parent space
    sh.parent.updateWorldMatrix(true, false);
    grip.updateWorldMatrix(true, false);
    M.copy(sh.parent.matrixWorld).invert().multiply(grip.matrixWorld).decompose(P, Q, S);
    // out of reach (a high guard, the far end of a spin): the hand slides along the grip toward the shoulder, up to
    // h.slide either way, rather than letting go
    if (h.slide && P.distanceTo(sh.position) > REACH){
      Y.set(0, 1, 0).applyQuaternion(Q);
      P.addScaledVector(Y, Math.max(-h.slide, Math.min(h.slide, V.subVectors(sh.position, P).dot(Y))));
    }
    reachPose(sh.position, P, h.twist, out, sh.quaternion);
    el.rotation.set(-out.b, 0, 0);
    // the hand: the grip's own turn, undone through the shoulder and the elbow
    hand.quaternion.copy(QE.copy(sh.quaternion).multiply(el.quaternion).invert().multiply(Q));
  }
}
