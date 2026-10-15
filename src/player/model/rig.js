// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The hero skeleton: bare joint groups, no meshes. Both heroes dress the same rig, so every animation works for both.
//
//   vis ─ hips ─┬─ legL/legR.hip ─ knee ─ ank
//               ├─ skirt (Jedi robe panels hang here; flapF/flapB/flapL/flapR swing for cloth follow-through)
//               └─ torso ─ chest ─┬─ head
//                                 ├─ armL/armR.sh ─ el ─ wr
//                                 └─ back (jetpack / cape mount)
//
// Joint positions match the original rig exactly, so the existing poses in animation.js land the same.
// chest, wr, ank and the skirt flaps are new joints that rest at zero (nothing drives them yet).

import * as THREE from 'three';

export const DIM = {
  hipY: 1.04, hipX: 0.11, thigh: 0.45, shin: 0.41,
  torsoY: 0.16, chestY: 0.3, headY: 0.48, shX: 0.27, shY: 0.32, upper: 0.34, fore: 0.3,
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
  const flap = (x, z, ry) => { const f = G(); f.position.set(x, 0, z); f.rotation.y = ry; skirt.add(f); return f; };
  const flaps = { F: flap(0, 0.12, 0), B: flap(0, -0.12, Math.PI), L: flap(-0.17, 0, -Math.PI/2), R: flap(0.17, 0, Math.PI/2) };

  const torso = G(); torso.position.y = DIM.torsoY; hips.add(torso);
  const chest = G(); chest.position.y = DIM.chestY; torso.add(chest);
  const head = G(); head.position.y = DIM.headY; chest.add(head);
  const back = G(); back.position.set(0, 0.16, -0.14); chest.add(back);

  const arm = side => {
    const sh = G(); sh.position.set(DIM.shX * side, DIM.shY, 0); chest.add(sh);
    const el = G(); el.position.y = -DIM.upper; sh.add(el);
    const wr = G(); wr.position.y = -DIM.fore; el.add(wr);
    return { sh, el, wr, side };
  };
  const armL = arm(-1), armR = arm(1);
  armL.sh.rotation.z = 0.12; armR.sh.rotation.z = -0.12;

  return { vis, hips, torso, chest, head, back, skirt, flaps, legL, legR, armL, armR };
}
