// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Jedi outfit, split into SLOTS (legs, waist, torso, head, hair, arms). Each slot has named variants; the look in
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

// the same, open at the BACK: a beard wraps the jaw and cheeks but leaves the neck behind bare
const JAW = (() => {
  const outer = [], inner = [], N = 9, open = 0.9;
  for (let i = 0; i <= N; i++){
    const a = -Math.PI/2 + open + (i / N) * (Math.PI*2 - open*2);
    outer.push([Math.cos(a), Math.sin(a)]);
    inner.push([Math.cos(a) * 0.86, Math.sin(a) * 0.86]);
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

  hair: {
    // none: the bare scalp (Mace Windu)
    bald(){},
    // close-cropped: a thin cap over the crown, no ink line so it reads as stubble
    buzz(R, k){ cap(R, k, 0.004, { outline: false }); },
    // short and full, swept back from a high hairline
    short(R, k){ cap(R, k, 0.014); },
    // short sides with a knot tied on the crown
    topknot(R, k){
      cap(R, k, 0.008);
      k.add(loft([{ y:-0.035, w:0.07, d:0.07 }, { y:0.0, w:0.095, d:0.095 }, { y:0.04, w:0.08, d:0.08 }, { y:0.06, w:0.03, d:0.03 }], ngon(8, Math.PI/8)), 'hair', R.head, [0, 0.37, -0.05], [-0.35, 0, 0]);
      k.add(block(0.08, 0.02, 0.05, 0.3), k.mat('leather'), R.head, [0, 0.345, -0.04], [-0.35, 0, 0]);   // the tie
    },
    // shoulder-length, falling behind the ears to the nape
    long(R, k){
      cap(R, k, 0.016);
      k.add(loft([
        { y:-0.1, w:0.2, d:0.07, z:-0.085 }, { y:0.02, w:0.235, d:0.1, z:-0.08 },
        { y:0.16, w:0.25, d:0.15, z:-0.06 }, { y:0.26, w:0.23, d:0.17, z:-0.05 },
      ], chamfer(0.45)), 'hair', R.head);
      for (const sx of [-1, 1]) k.add(loft([{ y:0.02, w:0.03, d:0.07 }, { y:0.24, w:0.04, d:0.12 }], chamfer(0.4)), 'hair', R.head, [0.112*sx, 0, -0.03]);
    },
    // a Padawan's crop with the learner's braid hanging behind the right ear
    braid(R, k){
      cap(R, k, 0.004, { outline: false });
      const b = k.group(R.head, [0.1, 0.2, -0.05], [0, 0, 0.12]);
      for (let i = 0; i < 6; i++) k.add(block(0.026, 0.045, 0.026, 0.45), 'hair', b, [0, -i * 0.04, 0.003 * i], [0.1 * (i % 2 ? 1 : -1), 0, 0]);
      k.add(shard(0.022, 0.04, 0.022), 'hair', b, [0, -0.25, 0.02], [Math.PI, 0, 0]);
    },
  },

  beard: {
    none(){},
    // a few days' growth: a thin shadow along the jaw and over the lip, no ink line
    stubble(R, k){ const o = { outline: false, mat: k.mat('skin', { shade: 0.62 }), noBurns: true }; jaw(R, k, 0.002, o); moustache(R, k, 0.004, o); },
    // a pointed tuft on the chin under a moustache
    goatee(R, k){
      k.add(loft([{ y:-0.035, w:0.03, d:0.03, z:0.1 }, { y:0.0, w:0.06, d:0.05, z:0.098 }, { y:0.06, w:0.07, d:0.045, z:0.092 }], chamfer(0.4)), 'hair', R.head);
      moustache(R, k, 0.012);
    },
    // full and squared off along the jaw, the moustache over it
    full(R, k){ jaw(R, k, 0.018); moustache(R, k, 0.014); },
    // just the moustache, its ends turned down past the mouth
    moustache(R, k){ moustache(R, k, 0.014); },
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

/* the face: a chiselled skull, then eyes that look back (white, a dark iris, an upper lid that blinks: model/life.js),
   brows set in a frown, a nose with a bridge and wings, lips, cheekbones and a chin. All of it sits just proud of the
   skull and draws no ink line of its own, so it reads as features rather than parts stuck on */
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
  const flat = { outline: false }, dark = k.mat('skin', { shade: 0.62 }), deep = k.mat('skin', { shade: 0.42 });
  k.add(block(0.17, 0.03, 0.04, 0.45), k.mat('skin', { shade: 0.8 }), R.head, [0, 0.192, 0.1], [0.25, 0, 0], flat);   // brow ridge
  // the nose: a bridge down from the brow, the tip, and a wing either side
  k.add(loft([{ y:-0.035, w:0.044, d:0.05, z:0.014 }, { y:-0.02, w:0.038, d:0.046, z:0.012 }, { y:0.02, w:0.024, d:0.028, z:0.004 }, { y:0.05, w:0.02, d:0.016 }], ngon(3, Math.PI/2)),
    'skin', R.head, [0, 0.15, 0.106], [-0.08, 0, 0], flat);
  const lids = [];
  for (const sx of [-1, 1]){
    k.add(block(0.03, 0.055, 0.045, 0.4), 'skin', R.head, [0.105*sx, 0.15, -0.005]);   // ears
    k.add(block(0.016, 0.016, 0.02, 0.4), dark, R.head, [0.017*sx, 0.118, 0.115], [0, 0, 0], flat);   // nostril wing
    // the eye: a socket in shadow, the white, the iris, and the lid (scaled down open, to full when it blinks)
    k.add(plate([[-0.034,0.004],[-0.012,0.016],[0.02,0.014],[0.036,0.002],[0.016,-0.012],[-0.016,-0.012]], 0.008, 0.002), dark, R.head, [0.046*sx, 0.168, 0.108], [0, 0.22*sx, 0], flat);
    k.add(plate([[-0.021,0],[-0.007,0.007],[0.01,0.006],[0.021,0],[0.007,-0.006],[-0.009,-0.006]], 0.006, 0.0015), k.mat('skin', { c: 0xb9ae9e }), R.head, [0.046*sx, 0.168, 0.113], [0, 0.22*sx, 0], flat);
    k.add(block(0.013, 0.013, 0.006, 0.35), 'eyes', R.head, [0.043*sx, 0.167, 0.117], [0, 0.22*sx, 0], flat);
    const lid = k.group(R.head, [0.046*sx, 0.178, 0.115], [0, 0.22*sx, 0]);
    k.add(plate([[-0.028,0.002],[0.028,0.002],[0.026,-0.02],[0,-0.024],[-0.026,-0.02]], 0.008, 0.002), dark, lid, [0, 0, 0], [0, 0, 0], flat);
    lid.scale.y = 0.3; lids.push(lid);
    // brows: hair, low at the inner end (a Jedi's level frown)
    k.add(block(0.05, 0.012, 0.014, 0.4), 'hair', R.head, [0.048*sx, 0.193, 0.114], [0, 0.22*sx, 0.14*sx], flat);
    k.add(block(0.04, 0.022, 0.03, 0.45), 'skin', R.head, [0.068*sx, 0.128, 0.088], [0, 0.55*sx, 0], flat);   // cheekbone
  }
  R.head.userData.lids = lids;
  // the mouth: a dark line between an upper lip and a fuller lower one, over a squared chin
  k.add(block(0.056, 0.012, 0.012, 0.4), dark, R.head, [0, 0.094, 0.108], [0, 0, 0], flat);
  k.add(block(0.054, 0.006, 0.01, 0.2), deep, R.head, [0, 0.087, 0.111], [0, 0, 0], flat);
  k.add(block(0.046, 0.014, 0.014, 0.45), k.mat('skin', { shade: 0.85 }), R.head, [0, 0.078, 0.105], [0, 0, 0], flat);
  k.add(block(0.07, 0.036, 0.04, 0.45), 'skin', R.head, [0, 0.046, 0.085], [-0.2, 0, 0], flat);
}

/* hair over the crown and back of the skull, `lift` proud of it. The low rings sit back on the head so the hairline
   rises at the forehead and the face stays clear; the ears and brow stay bare */
function cap(R, k, lift, o){
  const L = lift * 2;
  k.add(loft([
    { y:0.15, w:0.2 + L, d:0.17 + L, z:-0.045 },
    { y:0.21, w:0.218 + L, d:0.214 + L, z:-0.022 },
    { y:0.26, w:0.208 + L, d:0.232 + L, z:-0.005 },
    { y:0.3,  w:0.17 + L, d:0.194 + L, z:-0.01 },
    { y:0.33 + lift, w:0.08, d:0.1, z:-0.01 },
  ], HEAD), 'hair', R.head, [0, 0, 0], [0, 0, 0], o);
}

/* a beard along the jaw, `lift` proud of the skin: from the sideburns down round the chin, open over the mouth's
   line (drawn again on top, so the face keeps its expression) */
function jaw(R, k, lift, o){
  const L = lift * 2;
  k.add(loft([
    { y:-0.03 - lift, w:0.06 + L, d:0.05 + L, z:0.085 },
    { y:0.02, w:0.12 + L, d:0.14 + L, z:0.045 },
    { y:0.07, w:0.17 + L, d:0.19 + L, z:0.018 },
    { y:0.1,  w:0.2 + L, d:0.215 + L, z:0.004 },
  ], JAW, { capTop: false, capBottom: false }), o?.mat || 'hair', R.head, [0, 0, 0], [0, 0, 0], o);
  if (!o?.noBurns) for (const sx of [-1, 1]) k.add(block(0.016 + lift, 0.07, 0.05, 0.4), 'hair', R.head, [0.098*sx, 0.13, 0.01], [0, 0, 0], { outline: false });   // sideburns
  if (lift > 0.01) k.add(block(0.05, 0.006, 0.01, 0.2), k.mat('skin', { shade: 0.42 }), R.head, [0, 0.087, 0.114 + lift], [0, 0, 0], { outline: false });
}
function moustache(R, k, t, o = { outline: false }){
  k.add(plate([[-0.04,0.008],[0,0.012],[0.04,0.008],[0.046,-0.018],[0.034,-0.02],[0.026,-0.002],[-0.026,-0.002],[-0.034,-0.02],[-0.046,-0.018]], t, 0.002),
    o.mat || 'hair', R.head, [0, 0.1, 0.11], [-0.1, 0, 0], o);
}

/* a hand on the wrist joint (shared with the Mando, who wears gloves): a palm, the four fingers as one skinned strip
   that curls at the knuckle and both finger joints, and a two-jointed thumb. The palm faces in toward the body (−x
   for the right hand), the thumb rides the front edge. The joints rest open; model/life.js closes them each frame
   (curl 1 is a fist round the hilt, 0 a flat open palm), and the rig records them on the wrist for it */
const FINGERS = (() => {   // the strip's section: four knuckle ridges across the back of the hand and the palm side
  const pts = [], N = 4;
  for (let i = 0; i <= N * 2; i++){ const z = 1 - i / N; pts.push([1 - (i % 2 ? 0.5 : 0), z]); }
  for (let i = 0; i <= N * 2; i++){ const z = -1 + i / N; pts.push([-1 + (i % 2 ? 0.35 : 0), z]); }
  pts.unshift(pts.pop());   // start on the flat front edge, so the loft reads the winding off a face that isn't a ridge
  return pts;
})();
export function hand(A, k, mat){
  const s = A.side, w = k.group(A.wr);
  w.scale.setScalar(1.15);
  k.add(loft([{ y:-0.098, w:0.05, d:0.078 }, { y:-0.07, w:0.056, d:0.086, x:-0.002*s }, { y:-0.02, w:0.054, d:0.08 }, { y:0.012, w:0.048, d:0.064 }], chamfer(0.35)), mat, w);
  const kn = k.group(w, [-0.003*s, -0.094, 0]), mid = k.group(kn, [0, -0.042, 0]), tip = k.group(mid, [0, -0.032, 0]);
  k.skin(mat, seg(0.102, [[0,0.032,0.076],[0.35,0.024,0.072],[0.72,0.02,0.066],[1,0.014,0.056]]),
    { bones: [kn, mid, tip], at: [0.042, 0.074], blend: 0.008, profile: s > 0 ? FINGERS : FINGERS.map(([x, z]) => [-x, z]) });
  // the thumb: off the heel of the palm at the front, angled out and down
  const tb = k.group(w, [-0.012*s, -0.03, 0.036], [0.35, 0, 0.3*s]), tt = k.group(tb, [0, -0.034, 0]);
  k.skin(mat, seg(0.062, [[0,0.03,0.032],[0.5,0.026,0.028],[1,0.019,0.02]]), { bones: [tb, tt], at: [0.034], blend: 0.008, profile: chamfer(0.4) });
  const h = { kn, mid, tip, tb, tt, side: s, curl: -1 };
  (A.wr.userData.hands || (A.wr.userData.hands = [])).push(h);
  curlHand(h, s > 0 ? 1 : 0.4);
}

/* close one hand to `c` (0 open → 1 fist): the fingers fold in toward the palm, the thumb comes across them */
export function curlHand(h, c){
  if (Math.abs(c - h.curl) < 1e-3) return;
  h.curl = c;
  const s = -h.side;
  h.kn.rotation.z = s * (0.12 + 1.2 * c); h.mid.rotation.z = s * (0.15 + 1.25 * c); h.tip.rotation.z = s * (0.1 + 0.65 * c);
  h.tb.rotation.z = h.side * 0.3 * (1 - c) + s * 0.55 * c; h.tt.rotation.z = s * 0.8 * c;
}
