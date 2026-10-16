// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Jedi outfit, split into SLOTS (legs, waist, torso, head, arms). Each slot has named variants; the look in
// appearance.js picks one per slot. A character creator only has to change that look object and rebuild.
//
// Add a variant: write a function (R, k) => { ...k.add(...) } under the slot below, then name it in a look.
// k.add() places a styled mesh and records it as a Jedi part; k.mat() reads the look's palette. k.skin() lays one
// continuous skinned surface over several joints (trousers over hip and knee, a sleeve over shoulder and elbow).

import * as THREE from 'three';
import { loft, limb, plate, block, shard, chamfer, ngon, KEEL, SHIELD, HEAD } from './shapes.js';
import { seg } from './skin.js';

// a C-shaped section (open at the front) so a hood can be lofted around the head without covering the face
const HOOD = (() => {
  const outer = [], inner = [], N = 9, open = 0.62;
  for (let i = 0; i <= N; i++){
    const a = Math.PI/2 + open + (i / N) * (Math.PI*2 - open*2);
    outer.push([Math.cos(a), Math.sin(a)]);
    inner.push([Math.cos(a) * 0.84, Math.sin(a) * 0.84]);
  }
  return outer.concat(inner.reverse());
})();

export const JEDI_PARTS = {
  legs: {
    // dark trousers into tall chiseled boots
    boots(R, k){
      for (const L of [R.legL, R.legR]){
        // trousers: one surface over hip and knee that bends with the leg, tucked into the boot top
        k.skin('robe', [
          ...seg(0.45, [[-0.06,0.205,0.2],[0.2,0.19,0.19],[0.75,0.145,0.155],[1,0.125,0.13]]),
          ...seg(0.41, [[0.12,0.115,0.12]], 0.45),
        ], { bones: [L.hip, L.knee], at: [0.45] });
        k.add(limb(0.41, [[0.05,0.125,0.135],[0.12,0.145,0.155],[0.4,0.13,0.14,-0.005],[0.82,0.1,0.11],[1,0.1,0.11]], KEEL), 'boot', L.knee);
        k.add(block(0.155, 0.05, 0.165, 0.4), 'boot', L.knee, [0, -0.07, 0]);   // boot cuff
        // foot: a side-profile wedge with a pointed toe, extruded across the width
        k.add(plate([[-0.07,0.03],[-0.085,-0.075],[0.15,-0.085],[0.2,-0.055],[0.09,-0.005],[0.03,0.035]], 0.1, 0.012),
          'boot', L.ank, [0, 0, 0], [0, -Math.PI/2, 0]);
      }
    },
  },

  waist: {
    // split robe panels: each hangs from its own flap joint so it can swing on its own
    panels(R, k){
      k.add(loft([{ y:-0.12, w:0.3, d:0.2 }, { y:0, w:0.34, d:0.22 }, { y:0.14, w:0.31, d:0.2 }], SHIELD), 'robe', R.hips);
      k.add(loft([{ y:-0.44, w:0.46, d:0.36 }, { y:-0.12, w:0.38, d:0.27 }, { y:0.02, w:0.33, d:0.23 }], chamfer(0.42)), 'robe', R.skirt);
      // the four panels are real cloth: pinned at the belt, kicked by the legs, streaming and settling on their own
      const body = k.bodyCapsules([[R.skirt, robeLow(R, k), 0.14]]);
      k.cloth('tabard', R.skirt, { W: 4, H: 8, rest: panel(R.flaps.F, 0.11, 0.6, 0.14), thick: 0.022, capsules: body });
      k.cloth('robe',   R.skirt, { W: 5, H: 8, rest: panel(R.flaps.B, 0.16, 0.7, 0.12), thick: 0.022, capsules: body });
      k.cloth('robe',   R.skirt, { W: 3, H: 7, rest: panel(R.flaps.L, 0.09, 0.52, 0.16), thick: 0.022, capsules: body });
      k.cloth('robe',   R.skirt, { W: 3, H: 7, rest: panel(R.flaps.R, 0.09, 0.52, 0.16), thick: 0.022, capsules: body });
    },
    // one long robe to the shin, no split
    long(R, k){
      k.add(loft([{ y:-0.12, w:0.3, d:0.2 }, { y:0, w:0.34, d:0.22 }, { y:0.14, w:0.31, d:0.2 }], SHIELD), 'robe', R.hips);
      k.add(loft([{ y:-0.78, w:0.58, d:0.46 }, { y:-0.4, w:0.46, d:0.34 }, { y:-0.12, w:0.38, d:0.27 }, { y:0.02, w:0.33, d:0.23 }], chamfer(0.42)), 'robe', R.skirt);
      k.cloth('tabard', R.skirt, { W: 4, H: 9, rest: panel(R.flaps.F, 0.1, 0.72, 0.2, 0.05, 0.2), thick: 0.02,
        capsules: k.bodyCapsules([[R.skirt, robeLow(R, k), 0.2]]) });
    },
  },

  torso: {
    // tan tunic with a V-neck, obi belt, and tabards over each shoulder
    tunic(R, k){
      // the tunic is one surface from waist to collar that bends and twists between the torso and chest joints
      k.skin('tunic', [
        { t:0, w:0.32, d:0.21 }, { t:0.2, w:0.3, d:0.2 },
        ...seg(1, [[0,0.34,0.225],[0.14,0.47,0.27],[0.27,0.53,0.26],[0.35,0.37,0.2],[0.4,0.2,0.15]], 0.3),
      ], { bones: [R.torso, R.chest], at: [0.3], blend: 0.08, profile: SHIELD, dir: 1 });
      k.add(loft([{ y:0.04, w:0.37, d:0.255 }, { y:0.21, w:0.355, d:0.245 }], SHIELD), 'leather', R.torso);
      k.add(plate([[-0.035,-0.045],[0.035,-0.045],[0.045,0],[0.035,0.045],[-0.035,0.045],[-0.045,0]], 0.02, 0.006), 'trim', R.torso, [0, 0.125, 0.128]);
      k.add(plate([[-0.085,0.39],[0.085,0.39],[0,0.16]], 0.02, 0.004), 'leather', R.chest, [0, 0, 0.122], [0.08, 0, 0]);
      const strip = plate([[-0.045,0.4],[0.045,0.4],[0.055,-0.24],[0,-0.29],[-0.055,-0.24]], 0.018, 0.005);
      for (const sx of [-1, 1]){
        k.add(strip, 'tabard', R.chest, [0.105*sx, 0, 0.133], [0.02, 0, 0]);
        k.add(strip, 'tabard', R.chest, [0.105*sx, 0, -0.133], [-0.02, 0, 0]);
      }
      k.add(loft([{ y:0.32, w:0.31, d:0.23 }, { y:0.41, w:0.22, d:0.18 }, { y:0.44, w:0.19, d:0.16 }], chamfer(0.45)), 'robe', R.chest);   // collar wrap
    },
  },

  head: {
    // bare head: chiseled skull, brow ridge, nose, ears
    bald(R, k){ face(R, k); },
    // the same face under a raised hood
    hood(R, k){
      face(R, k);
      k.add(loft([
        { y:-0.02, w:0.34, d:0.32, z:-0.03 }, { y:0.14, w:0.29, d:0.3, z:-0.02 },
        { y:0.3, w:0.27, d:0.28, z:-0.025 }, { y:0.39, w:0.15, d:0.18, z:-0.04 }, { y:0.42, w:0.02, d:0.03, z:-0.05 },
      ], HOOD, { capTop: false, capBottom: false }), 'robe', R.head);
    },
  },

  arms: {
    // tunic sleeves flaring at the forearm, leather bracers, blocky hands
    sleeves(R, k){
      for (const A of [R.armL, R.armR]){
        const s = A.side;
        k.add(loft([{ y:-0.08, w:0.2, d:0.19 }, { y:0.02, w:0.195, d:0.185 }, { y:0.075, w:0.11, d:0.13 }], chamfer(0.42)), 'tunic', A.sh, [0.02*s, 0.03, 0], [0, 0, -0.3*s]);
        k.skin('tunic', [
          ...seg(0.34, [[-0.2,0.15,0.15],[0.06,0.165,0.16],[0.5,0.135,0.135],[1,0.105,0.11]]),
          ...seg(0.3, [[0.1,0.1,0.1],[0.45,0.12,0.12],[0.78,0.16,0.155]], 0.34),
        ], { bones: [A.sh, A.el], at: [0.34], blend: 0.05, profile: chamfer(0.4) });
        k.add(limb(0.3, [[0.6,0.085,0.085],[1,0.075,0.075]], chamfer(0.3)), 'leather', A.el);
        hand(A, k, 'skin');
      }
    },
  },
};

/* a robe panel's rest shape in the skirt's frame (u across, v down): hangs from the belt where `flap` sits, widening
   to a pointed hem, tilted out by `tilt`, `z` in front of the flap. The cloth hangs from the skirt itself; the flap
   joint only says where (its springs would otherwise drag the cloth's rest shape around) */
function panel(flap, w, len, tilt, z = 0.02, flare = 0.25){
  const c = Math.cos(-tilt), s = Math.sin(-tilt);
  flap.updateMatrix();
  const M = flap.matrix.clone(), p = new THREE.Vector3();
  return (u, v) => {
    const x = u * w * (1 + flare * v);
    const y = 0.03 - v * len * (0.88 + 0.12 * (1 - Math.abs(u)));
    return p.set(x, y * c - z * s, y * s + z * c).applyMatrix4(M).toArray();
  };
}

// the bottom of the robe's under-tube, for the panels to drape over
function robeLow(R, k){ return R.skirt.userData.low || (R.skirt.userData.low = k.group(R.skirt, [0, -0.36, 0])); }

function face(R, k){
  k.add(loft([{ y:-0.1, w:0.11, d:0.11 }, { y:0.06, w:0.1, d:0.1 }], ngon(6, Math.PI/6)), 'skin', R.head);
  k.add(loft([
    { y:0.02, w:0.1,  d:0.11, z:0.035 },
    { y:0.06, w:0.16, d:0.17, z:0.015 },
    { y:0.12, w:0.2,  d:0.215 },
    { y:0.19, w:0.215,d:0.235 },
    { y:0.25, w:0.205,d:0.23, z:-0.005 },
    { y:0.3,  w:0.165,d:0.19, z:-0.01 },
    { y:0.33, w:0.07, d:0.09, z:-0.01 },
  ], HEAD), 'skin', R.head);
  k.add(block(0.17, 0.032, 0.04, 0.45), k.mat('skin', { shade: 0.7 }), R.head, [0, 0.188, 0.1], [0.25, 0, 0]);   // brow ridge
  k.add(shard(0.045, 0.05, 0.035), 'skin', R.head, [0, 0.16, 0.1], [1.95, 0, 0]);   // nose
  for (const sx of [-1, 1]){
    k.add(block(0.03, 0.055, 0.045, 0.4), 'skin', R.head, [0.105*sx, 0.15, -0.005]);
    k.add(block(0.034, 0.012, 0.01, 0.2), 'hair', R.head, [0.042*sx, 0.168, 0.112], [0, 0, -0.18*sx], { outline: false });
  }
  k.add(block(0.06, 0.014, 0.01, 0.3), 'hair', R.head, [0, 0.085, 0.112], [0, 0, 0], { outline: false });   // set mouth
}

// a blocky fist + thumb on the wrist joint (shared with the Mando, who wears gloves)
export function hand(A, k, mat){
  k.add(loft([{ y:-0.13, w:0.068, d:0.058 }, { y:-0.09, w:0.088, d:0.062 }, { y:-0.02, w:0.08, d:0.056 }, { y:0.01, w:0.064, d:0.05 }], chamfer(0.3)), mat, A.wr, [0,0,0], [0,0,0], { scale: 1.15 });
  k.add(block(0.03, 0.06, 0.032, 0.3), mat, A.wr, [0, -0.05, 0.035], [0.4, 0, 0]);
}
