// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The CLONE ARC TROOPER outfit (testing only), modelled on an ARC trooper like Fives or Captain Rex: Phase II plastoid
// over a black bodysuit, grey ARC pauldrons, a chest ammo pouch, the white utility belt, a kama, blue legion markings
// and the bucket with its crest and rangefinder. Slots and variants work like mando.js; its own palette keys
// (appearance.js DEFAULT_LOOK.trooper) are styled apart from the Mando's, so the two never share a colour.
//   plate = the white armour · grey = the ARC plates · suit = the bodysuit · mark = the legion colour

import * as THREE from 'three';
import { loft, limb, plate, block, chamfer, ngon, KEEL, SHIELD, HEAD } from './shapes.js';
import { hand } from './jedi.js';
import { seg, rounded } from './skin.js';
import { DIM } from './rig.js';

// rounded sections, as the hero and NPC passes use (enemies/mesh.js SOFT*): pressed armour, not cut blocks
const SOFT = rounded(chamfer(0.42)), SOFT_HEAD = rounded(HEAD), SOFT_BODY = rounded(SHIELD), SOFT_LIMB = rounded(chamfer(0.4));
const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();

export const TROOPER_PARTS = {
  legs: {
    // bodysuit, white thigh plates with a legion stripe, knee cops in the legion colour, white shin greaves with a
    // legion stripe, white boots
    arc(R, k){ legs(R, k, true); },
    // standard Phase II: white greaves, no straps
    phase2(R, k){ legs(R, k, false); },
  },
  torso: {
    // white chest and back plates, abdomen plates, grey ARC plate over the chest and the black ammo pouch, the belt
    arc(R, k){ torso(R, k, true); },
    phase2(R, k){ torso(R, k, false); },
  },
  arms: {
    // big grey ARC pauldrons on both shoulders, grey bracers with a legion band
    arc(R, k){ arms(R, k, 'arc'); },
    // a captain's single pauldron in the legion colour (Rex)
    captain(R, k){ arms(R, k, 'captain'); },
    phase2(R, k){ arms(R, k, false); },
  },
  helmet: {
    // Phase II bucket with the crest, rangefinder stalk and brow markings (Fives)
    arc(R, k){ helmet(R, k, { crest: true, rangefinder: true, brow: true }); },
    // rangefinder and markings, no crest (Rex)
    captain(R, k){ helmet(R, k, { rangefinder: true, brow: true }); },
    phase2(R, k){ helmet(R, k, {}); },
  },
  kama: {
    // the long black kama, open at the front, trimmed in the legion colour
    long(R, k){ kama(R, k); },
    none(){},
  },
};

function legs(R, k, arc){
  for (const L of [R.legL, R.legR]){
    k.skin('suit', [
      ...seg(DIM.thigh, [[-0.06,0.18,0.18],[0.2,0.17,0.17],[0.75,0.13,0.14],[1,0.11,0.12]]),
      ...seg(DIM.shin, [[0.1,0.14,0.15],[0.45,0.135,0.145],[0.8,0.115,0.125],[1,0.115,0.125]], DIM.thigh),
    ], { bones: [L.hip, L.knee], at: [DIM.thigh] });
    // the thigh: a wrapped plate, front and outside, with a legion stripe across it
    k.add(limb(DIM.thigh - 0.11, [[0,0.17,0.16,0.01],[0.5,0.165,0.155,0.012],[1,0.135,0.13,0.01]], KEEL), 'plate', L.hip, [0, -0.06, 0.005]);
    k.add(block(0.15, 0.035, 0.012, 0.2), 'mark', L.hip, [0.01 * L.side, -DIM.thigh * 0.67, 0.095], [-0.05, 0, 0], { outline: false });
    k.add(plate([[-0.06,0.05],[0.06,0.05],[0.07,-0.03],[0,-0.08],[-0.07,-0.03]], 0.035, 0.012), 'mark', L.knee, [0, 0.0, 0.075]);   // knee cop
    k.add(limb(DIM.shin - 0.08, [[0,0.13,0.12,0.02],[0.3,0.15,0.135,0.02],[1,0.12,0.105,0.02]], KEEL), 'plate', L.knee, [0, -0.07, 0]);
    if (arc) k.add(block(0.03, 0.16, 0.012, 0.2), 'mark', L.knee, [0, -0.18, 0.075], [0, 0, 0], { outline: false });
    // the boot: white, a rounded toe
    k.add(plate([[-0.075,0.04],[-0.09,-0.075],[0.15,-0.085],[0.2,-0.05],[0.12,0.0],[0.03,0.04]], 0.12, 0.016), 'plate', L.ank, [0, 0, 0], [0, -Math.PI/2, 0]);
  }
}

function torso(R, k, arc){
  k.skin('suit', [
    { t:-0.12, w:0.3, d:0.2 }, { t:0, w:0.34, d:0.22 }, { t:DIM.torsoY, w:0.31, d:0.2 }, { t:DIM.torsoY + DIM.chestY - 0.1, w:0.29, d:0.19 },
    ...seg(1, [[0,0.33,0.22],[0.14,0.45,0.265],[0.27,0.505,0.255],[0.35,0.36,0.2],[0.4,0.2,0.15]], DIM.torsoY + DIM.chestY),
  ], { bones: [R.hips, R.torso, R.chest], at: [DIM.torsoY, DIM.torsoY + DIM.chestY], blend: 0.07, profile: SHIELD, dir: 1 });
  // codpiece and the white utility belt with its boxes
  k.add(plate([[-0.08,0.02],[0.08,0.02],[0.05,-0.12],[-0.05,-0.12]], 0.04, 0.012), 'plate', R.hips, [0, -0.04, 0.12], [-0.12, 0, 0]);
  k.add(loft([{ y:0.0, w:0.4, d:0.27 }, { y:0.075, w:0.39, d:0.265 }], SOFT_BODY), 'plate', R.torso, [0, -0.02, 0]);
  // the layered waist (as the NPC troopers'): a dark strap cinched over the white belt, so it reads light-dark-light
  k.add(loft([{ y:0.0, w:0.408, d:0.276 }, { y:0.026, w:0.406, d:0.274 }], SOFT_BODY), 'grey', R.torso, [0, 0.005, 0], [0, 0, 0], { outline: false });
  for (const bx of [-0.15, -0.075, 0.075, 0.15]) k.add(block(0.06, 0.07, 0.05, 0.25), 'plate', R.torso, [bx, 0.015, 0.14 - Math.abs(bx) * 0.25]);
  for (const sx of [-1, 1]) k.add(block(0.07, 0.06, 0.12, 0.25), 'plate', R.torso, [0.205 * sx, 0.015, 0.02]);
  // abdomen plates
  const ab = plate([[-0.12,-0.035],[0.12,-0.035],[0.13,0.03],[-0.13,0.03]], 0.03, 0.008);
  k.add(ab, 'plate', R.torso, [0, 0.16, 0.108], [0.03, 0, 0]);
  k.add(ab, 'plate', R.torso, [0, 0.235, 0.112], [0.06, 0, 0], { scale: [1.06, 1, 1] });
  k.add(ab, 'plate', R.torso, [0, 0.31, 0.114], [0.08, 0, 0], { scale: [1.12, 1, 1] });
  // the chest plate: two pec plates and the collar; the back plate
  const pec = [[0.0,-0.02],[0.19,0.0],[0.235,0.15],[0.2,0.25],[0.0,0.24]];
  k.add(plate(pec, 0.05, 0.016), 'plate', R.chest, [0.005, 0.06, 0.128], [-0.06, 0.2, 0]);
  k.add(plate(mirror(pec), 0.05, 0.016), 'plate', R.chest, [-0.005, 0.06, 0.128], [-0.06, -0.2, 0]);
  // the sternum ridge and the upper ab plate that joins the chest to the abdomen
  k.add(plate([[-0.14,0.0],[0.14,0.0],[0.12,0.07],[-0.12,0.07]], 0.035, 0.01), 'plate', R.chest, [0, -0.02, 0.118], [0.05, 0, 0]);
  k.add(loft([{ y:0.33, w:0.25, d:0.21 }, { y:0.45, w:0.17, d:0.16 }], SOFT), 'suit', R.chest);
  k.add(plate([[-0.18,0],[0.18,0],[0.16,0.27],[-0.16,0.27]], 0.04, 0.012), 'plate', R.chest, [0, 0.04, -0.125]);
  k.add(block(0.2, 0.12, 0.08, 0.3), 'plate', R.chest, [0, 0.22, -0.16]);   // the back pack
  if (arc){
    // the ARC's black collar plate across the top of the chest and shoulders, with two ammo pouches hanging off it
    k.add(loft([{ y:0.29, w:0.44, d:0.29 }, { y:0.34, w:0.46, d:0.29 }, { y:0.39, w:0.36, d:0.25 }, { y:0.43, w:0.22, d:0.18 }], SOFT_BODY), 'grey', R.chest);
    // the two ammo pouches hanging off it, on the chest plate's upper edge, each with a white snap
    for (const bx of [-0.06, 0.06]){
      k.add(block(0.075, 0.1, 0.045, 0.3), 'grey', R.chest, [bx, 0.27, 0.172], [-0.12, 0, 0]);
      k.add(block(0.016, 0.016, 0.01, 0.2), 'plate', R.chest, [bx, 0.3, 0.198], [-0.12, 0, 0], { outline: false });
    }
  }
}

function arms(R, k, kind){
  for (const A of [R.armL, R.armR]){
    const s = A.side;
    k.skin('suit', [
      ...seg(0.34, [[-0.18,0.14,0.14],[0.06,0.15,0.15],[0.5,0.125,0.125],[1,0.1,0.105]]),
      ...seg(0.3, [[0.5,0.095,0.095],[1,0.08,0.08]], 0.34),
    ], { bones: [A.sh, A.el], at: [0.34], blend: 0.05, profile: SOFT_LIMB });
    // white bicep plate
    k.add(limb(0.2, [[0,0.13,0.125],[1,0.115,0.11]], KEEL), 'plate', A.sh, [0, -0.08, 0]);
    // pauldrons: the ARC's big one in the legion colour on the left shoulder (the right keeps a plain white cap), or
    // a captain's smaller one, or a plain Phase II cap on each
    if (kind === 'arc' && s < 0){
      // the ARC pauldron: a curved shell capping the shoulder and flaring out over the upper arm, in two layers
      const P = k.group(A.sh, [0.04*s, 0.03, 0], [0, 0, -0.34*s]);
      P.scale.setScalar(0.78);
      k.add(loft([{ y:-0.2, w:0.27, d:0.3, x:0.035*s }, { y:-0.04, w:0.29, d:0.3, x:0.02*s }, { y:0.08, w:0.24, d:0.26 }, { y:0.15, w:0.14, d:0.17 }, { y:0.175, w:0.04, d:0.06 }], SOFT), 'mark', P);
      k.add(loft([{ y:-0.24, w:0.25, d:0.29, x:0.045*s }, { y:-0.17, w:0.27, d:0.3, x:0.04*s }], SOFT), 'mark', P);   // the lower lame
      k.add(loft([{ y:-0.18, w:0.275, d:0.305, x:0.036*s }, { y:-0.165, w:0.275, d:0.305, x:0.036*s }], SOFT), 'grey', P, [0, 0, 0], [0, 0, 0], { outline: false });   // the dark seam between them
    }
    else if (kind === 'captain' && s < 0) k.add(loft([{ y:-0.1, w:0.28, d:0.26 }, { y:0.03, w:0.27, d:0.25 }, { y:0.1, w:0.16, d:0.18 }], SOFT), 'mark', A.sh, [0.05*s, 0.045, 0], [0, 0, -0.42*s]);
    else k.add(loft([{ y:-0.05, w:0.2, d:0.19 }, { y:0.03, w:0.19, d:0.18 }, { y:0.07, w:0.12, d:0.14 }], SOFT), 'plate', A.sh, [0.02*s, 0.03, 0], [0, 0, -0.3*s]);
    // a rounded elbow cop over the joint, as the NPC arms have
    k.add(loft([{ y:-0.045, w:0.11, d:0.115 }, { y:0.0, w:0.12, d:0.128 }, { y:0.045, w:0.105, d:0.112 }], SOFT_LIMB), 'plate', A.el, [0, 0.0, 0.012]);
    // forearm bracer with a legion band; the ARC's is grey
    k.add(limb(0.24, [[0,0.11,0.105],[0.6,0.118,0.112],[1,0.1,0.097]], KEEL), 'plate', A.el, [0, -0.04, 0]);
    if (kind === 'arc' && s > 0) k.add(block(0.05, 0.11, 0.02, 0.2), 'mark', A.el, [0, -0.15, 0.06], [0, 0, 0], { outline: false });   // the wrist comlink
    k.add(limb(0.035, [[0,0.122,0.117],[1,0.12,0.115]], KEEL), 'mark', A.el, [0, -0.25, 0], [0, 0, 0], { outline: false });
    hand(A, k, 'strap');
  }
}

/* the bucket: dome, the T-visor's brow and cheek drops, the sloped jaw and the two breather bulbs under the chin,
   then the optional crest fin, rangefinder stalk (on the left, as Rex and Fives wear it) and brow markings */
function helmet(R, k, { crest, rangefinder, brow }){
  const helm = k.group(R.head);
  k.add(loft([{ y:-0.1, w:0.12, d:0.12 }, { y:0.04, w:0.11, d:0.11 }], ngon(10, Math.PI/10)), 'suit', helm);
  // the dome, a little taller and rounder than a beskar bucket
  k.add(loft([
    { y:0.02, w:0.215, d:0.235, z:-0.01 },
    { y:0.14, w:0.235, d:0.25 },
    { y:0.26, w:0.24, d:0.255 },
    { y:0.32, w:0.22, d:0.24, z:-0.005 },
    { y:0.365, w:0.17, d:0.195, z:-0.008 },
    { y:0.39, w:0.08, d:0.1, z:-0.01 },
  ], SOFT_HEAD), 'plate', helm);
  // the jaw: sloped forward and narrowing to the chin, under the visor
  k.add(loft([{ y:0.02, w:0.2, d:0.12 }, { y:0.1, w:0.2, d:0.1 }, { y:0.16, w:0.16, d:0.05 }], SOFT), 'plate', helm, [0, 0.0, 0.085], [0.18, 0, 0]);
  // the T-visor: a wide brow slot, the centre drop, and the angled cheek drops of a Phase II
  k.add(plate([[-0.11,0.026],[0.11,0.026],[0.115,-0.014],[-0.115,-0.014]], 0.024, 0.003), 'visor', helm, [0, 0.225, 0.124], [0, 0, 0], { outline: false });
  k.add(plate([[-0.026,0],[0.026,0],[0.018,-0.13],[-0.018,-0.13]], 0.024, 0.003), 'visor', helm, [0, 0.214, 0.127], [-0.16, 0, 0], { outline: false });
  for (const sx of [-1, 1]) k.add(plate([[-0.014,0],[0.014,0],[0.006,-0.035],[-0.008,-0.03]], 0.024, 0.003), 'visor', helm, [0.098*sx, 0.214, 0.112], [0, sx*0.45, 0], { outline: false, scale: [sx, 1, 1] });
  // the vocoder slot and the two breather bulbs
  k.add(block(0.04, 0.03, 0.02, 0.3), 'suit', helm, [0, 0.07, 0.138], [0.3, 0, 0], { outline: false });
  for (const sx of [-1, 1]){
    k.add(loft([{ y:-0.02, w:0.05, d:0.05 }, { y:0.02, w:0.05, d:0.05 }], ngon(10)), 'plate', helm, [0.055*sx, 0.04, 0.13], [Math.PI/2 - 0.3, 0, 0], { outline: false });
    k.add(loft([{ y:-0.006, w:0.03, d:0.03 }, { y:0.006, w:0.03, d:0.03 }], ngon(8)), 'suit', helm, [0.055*sx, 0.034, 0.152], [Math.PI/2 - 0.3, 0, 0], { outline: false });
  }
  // the ear caps
  for (const sx of [-1, 1]) k.add(loft([{ y:-0.012, w:0.08, d:0.08 }, { y:0.012, w:0.07, d:0.07 }], ngon(10)), 'plate', helm, [0.122*sx, 0.17, -0.01], [0, 0, Math.PI/2]);
  if (crest){
    // the ARC crest: a fin from brow to nape in the legion colour, tallest over the brow
    k.add(plate([[-0.16,-0.02],[0.13,-0.02],[0.12,0.03],[0.0,0.06],[-0.14,0.03]], 0.026, 0.008), 'mark', helm, [0, 0.37, 0.0], [0, -Math.PI/2, 0]);
  }
  if (rangefinder){
    // the stalk over the left ear, its eyepiece swung up
    const fin = k.group(helm, [0.13, 0.17, -0.01], [0, 0, -0.06]);
    k.add(block(0.016, 0.3, 0.02, 0.3), 'grey', fin, [0, 0.15, 0]);
    k.add(block(0.022, 0.03, 0.09, 0.3), 'grey', fin, [0, 0.3, 0.03]);
  }
  if (brow){
    // the legion paint framing the T: a band down each side of the centre drop and along the cheeks
    for (const sx of [-1, 1]){
      k.add(plate([[-0.012,0.03],[0.012,0.03],[0.02,-0.1],[-0.004,-0.1]], 0.008, 0.002), 'mark', helm, [0.04*sx, 0.214, 0.125], [0.1, sx*0.18, 0], { outline: false, scale: [sx, 1, 1] });
      k.add(plate([[0,0.012],[0.06,0.012],[0.06,-0.012],[0,-0.012]], 0.008, 0.002), 'mark', helm, [0.055*sx, 0.268, 0.119], [-0.2, sx*0.35, 0], { outline: false, scale: [sx, 1, 1] });
    }
    // a band over the brow that runs back over the dome, and two marks above the visor
    k.add(plate([[-0.03,0],[0.03,0],[0.02,0.12],[-0.02,0.12]], 0.008, 0.002), 'mark', helm, [0, 0.27, 0.118], [-0.35, 0, 0], { outline: false });
    for (const sx of [-1, 1]) k.add(plate([[0,0],[0.07,0.01],[0.06,0.03],[0.0,0.02]], 0.008, 0.002), 'mark', helm, [0.025*sx, 0.262, 0.12], [-0.25, sx*0.4, 0], { outline: false, scale: [sx, 1, 1] });
  }
}

/* the kama: a long, open-fronted panel down the front-outside of each thigh to the shin, trimmed in the legion colour
   along its inner edge and riding that leg so it swings with the stride, and a wide panel behind */
function kama(R, k){
  // the kama hangs from the belt round the hips and behind, open at the front: a panel on each hip that rides that
  // leg (so it swings with the stride), trimmed in the legion colour down its front edge and along the hem, and a
  // wide panel behind
  for (const L of [R.legL, R.legR]){
    const s = L.side;
    const g = k.group(L.hip, [0.085*s, 0.09, -0.02], [0, s*1.3, 0.06*s]);
    k.add(plate([[-0.1,0],[0.1,0],[0.115,-0.76],[-0.115,-0.76]], 0.012, 0.003), 'cloth', g);
    k.add(plate([[-0.012,0],[0.012,0],[0.012,-0.76],[-0.012,-0.76]], 0.014, 0.002), 'mark', g, [0.1*s, 0, 0.003], [0, 0, 0], { outline: false });
    k.add(plate([[-0.115,0.018],[0.115,0.018],[0.115,0],[-0.115,0]], 0.014, 0.002), 'mark', g, [0, -0.76, 0.003], [0, 0, 0], { outline: false });
  }
  const back = k.group(R.hips, [0, 0.03, -0.14], [0.12, 0, 0]);
  k.add(plate([[-0.19,0],[0.19,0],[0.22,-0.8],[-0.22,-0.8]], 0.012, 0.003), 'cloth', back);
  k.add(plate([[-0.22,0.018],[0.22,0.018],[0.22,0],[-0.22,0]], 0.014, 0.002), 'mark', back, [0, -0.8, -0.003], [0, 0, 0], { outline: false });
}
