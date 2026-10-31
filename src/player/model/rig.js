// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The hero skeleton: bare joint groups, no meshes. Both heroes dress the same rig, so every animation works for both.
//
//   vis ─ hips ─┬─ legL/legR.hip ─ knee ─ ank
//               ├─ skirt (Jedi robe panels hang here; flapF/flapB/flapL/flapR swing for cloth follow-through)
//               └─ torso ─ chest ─┬─ head
//                                 ├─ armL/armR.sh ─ el ─ wr
//                                 ├─ back (jetpack mount)
//                                 └─ cape (cape pivot)
//
// Poses are joint ANGLES, so they carry over when DIM's lengths change (see DIM).
// chest, wr, ank, the skirt flaps and the cape rest at zero; animation.js drives them (upper-body twist, wrist snap,
// foot plant, cloth follow-through).

import * as THREE from 'three';

/* The joints are built with armR at +x, which (facing +z) is the body's LEFT. Rather than re-sign every pose, the
   whole model is mirrored on x (model/index.js), which puts armR, the weapon hand, on his right. Anything in the
   rig that reacts to a WORLD side (strafe lean, head look, cloth swing) multiplies by MIRROR; poses authored
   relative to the weapon hand need nothing. */
export const MIRROR = -1;

/* Proportions: the legs are ~47% of the figure (they were 44%, which read stubby next to the shoulders) and the
   shoulders sit a little narrower, the waist joint a touch lower. The chest, neck and arms are as they were, so every authored pose (all angles)
   lands the same; the hips simply ride higher. Everything that measures the legs (gait, foot planting, mocap, IK,
   the outfits) reads these numbers, so change them here only. */
export const DIM = {
  hipY: 1.12, hipX: 0.105, thigh: 0.49, shin: 0.45,
  torsoY: 0.13, chestY: 0.3, headY: 0.48, shX: 0.258, shY: 0.32, upper: 0.34, fore: 0.3,
};

export function buildRig(){
  const G = () => new THREE.Group();
  const vis = G();
  const hips = G(); hips.position.y = DIM.hipY; vis.add(hips);

  const leg = side => {
    const hip = G(); hip.position.set(DIM.hipX * side, -0.06, 0); hips.add(hip);
    const knee = G(); knee.position.y = -DIM.thigh; hip.add(knee);
    const ank = G(); ank.position.y = -DIM.shin; knee.add(ank);
    return { hip, knee, ank, side };
  };
  const legL = leg(-1), legR = leg(1);

  const skirt = G(); skirt.position.y = 0.04; hips.add(skirt);
  const flap = (x, z, ry) => { const f = G(); f.position.set(x, 0, z); f.rotation.order = 'YXZ'; f.rotation.y = ry; skirt.add(f); return f; };   // YXZ: rotation.x swings the panel in its own frame
  const flaps = { F: flap(0, 0.12, 0), B: flap(0, -0.12, Math.PI), L: flap(-0.17, 0, -Math.PI/2), R: flap(0.17, 0, Math.PI/2) };

  const torso = G(); torso.position.y = DIM.torsoY; hips.add(torso);
  const chest = G(); chest.position.y = DIM.chestY; torso.add(chest);
  const head = G(); head.position.y = DIM.headY; chest.add(head);
  const back = G(); back.position.set(0, 0.16, -0.14); chest.add(back);
  const cape = G(); chest.add(cape);   // cape pivot: the cape variant sets where it hangs from

  const arm = side => {
    const sh = G(); sh.position.set(DIM.shX * side, DIM.shY, 0); chest.add(sh);
    const el = G(); el.position.y = -DIM.upper; sh.add(el);
    const wr = G(); wr.position.y = -DIM.fore; el.add(wr);
    return { sh, el, wr, side };
  };
  const armL = arm(-1), armR = arm(1);
  armL.sh.rotation.z = 0.12; armR.sh.rotation.z = -0.12;

  // SOCKETS — named mount points for weapons and gear (see weapons.js). Hands are the wrists; the hip sockets ride
  // the thighs (the Mando's holsters), the belt sits on the pelvis at his left (a clipped saber hilt), and the back
  // is the jetpack mount. Holstered weapons hang here (player/holster.js).
  const hipSocket = L => { const s = G(); s.position.set(0.07 * L.side, -0.12, 0.02); L.hip.add(s); return s; };
  const belt = G(); belt.position.set(-0.2, 0.06, 0.05); hips.add(belt);
  const sockets = { handR: armR.wr, handL: armL.wr, back, belt, hipL: hipSocket(legL), hipR: hipSocket(legR) };

  return { vis, hips, torso, chest, head, back, cape, skirt, flaps, legL, legR, armL, armR, sockets };
}
