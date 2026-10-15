// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Jedi (Mace Windu): tan tunic, dark tabards, split robe panels that can swing, tall boots, bare head.
// Every mesh hangs off a rig joint; the returned list is what setHero() shows for the Jedi.

import { loft, limb, plate, block, shard, chamfer, ngon, KEEL, SHIELD, HEAD } from './shapes.js';

export function dressJedi(R, S){
  const parts = [];
  const add = (geo, mat, parent, p, r, o) => { const m = S.add(geo, mat, parent, p, r, o); parts.push(m); return m; };
  const browSkin = S.mat('skin', { c: 0x3e2418 });

  /* ---- legs: dark trousers into tall chiseled boots ---- */
  for (const L of [R.legL, R.legR]){
    add(limb(0.45, [[-0.06,0.205,0.2],[0.2,0.19,0.19],[0.75,0.145,0.155],[1,0.125,0.13]], KEEL), 'robe', L.hip);
    add(block(0.11, 0.08, 0.11, 0.4), 'robe', L.knee, [0, 0, 0.015]);
    add(limb(0.41, [[0.05,0.125,0.135],[0.12,0.145,0.155],[0.4,0.13,0.14,-0.005],[0.82,0.1,0.11],[1,0.1,0.11]], KEEL), 'boot', L.knee);
    add(block(0.155, 0.05, 0.165, 0.4), 'boot', L.knee, [0, -0.07, 0]);   // boot cuff
    // foot: a side-profile wedge with a pointed toe, extruded across the width
    add(plate([[-0.07,0.03],[-0.085,-0.075],[0.15,-0.085],[0.2,-0.055],[0.09,-0.005],[0.03,0.035]], 0.1, 0.012),
      'boot', L.ank, [0, 0, 0], [0, -Math.PI/2, 0]);
  }

  /* ---- hips, robe skirt, belt ---- */
  add(loft([{ y:-0.12, w:0.3, d:0.2 }, { y:0, w:0.34, d:0.22 }, { y:0.14, w:0.31, d:0.2 }], SHIELD), 'robe', R.hips);
  add(loft([{ y:-0.44, w:0.46, d:0.36 }, { y:-0.12, w:0.38, d:0.27 }, { y:0.02, w:0.33, d:0.23 }], chamfer(0.42)), 'robe', R.skirt);
  const panel = (w, len) => plate([[-w,0.03],[w,0.03],[w*1.25,-len*0.88],[0,-len],[-w*1.25,-len*0.88]], 0.022, 0.008);
  add(panel(0.11, 0.6), 'tabard', R.flaps.F, [0, 0, 0.02], [-0.14, 0, 0]);
  add(panel(0.16, 0.7), 'robe',   R.flaps.B, [0, 0, 0.02], [-0.12, 0, 0]);
  add(panel(0.09, 0.52), 'robe',  R.flaps.L, [0, 0, 0.02], [-0.16, 0, 0]);
  add(panel(0.09, 0.52), 'robe',  R.flaps.R, [0, 0, 0.02], [-0.16, 0, 0]);

  /* ---- torso: abdomen + obi belt on the torso joint, chest on the chest joint ---- */
  add(loft([{ y:0, w:0.32, d:0.21 }, { y:0.2, w:0.3, d:0.2 }, { y:0.36, w:0.34, d:0.22 }], SHIELD), 'tunic', R.torso);
  add(loft([{ y:0.04, w:0.37, d:0.255 }, { y:0.21, w:0.355, d:0.245 }], SHIELD), 'leather', R.torso);
  add(plate([[-0.035,-0.045],[0.035,-0.045],[0.045,0],[0.035,0.045],[-0.035,0.045],[-0.045,0]], 0.02, 0.006), 'trim', R.torso, [0, 0.125, 0.128]);
  add(loft([{ y:0, w:0.34, d:0.225 }, { y:0.14, w:0.47, d:0.27 }, { y:0.27, w:0.53, d:0.26 }, { y:0.35, w:0.37, d:0.2 }, { y:0.4, w:0.2, d:0.15 }], SHIELD), 'tunic', R.chest);
  add(plate([[-0.085,0.39],[0.085,0.39],[0,0.16]], 0.02, 0.004), 'leather', R.chest, [0, 0, 0.122], [0.08, 0, 0]);   // V-neck undershirt
  // tabards over each shoulder, front and back
  const strip = plate([[-0.045,0.4],[0.045,0.4],[0.055,-0.24],[0,-0.29],[-0.055,-0.24]], 0.018, 0.005);
  for (const sx of [-1, 1]){
    add(strip, 'tabard', R.chest, [0.105*sx, 0, 0.133], [0.02, 0, 0]);
    add(strip, 'tabard', R.chest, [0.105*sx, 0, -0.133], [-0.02, 0, 0]);
  }
  add(loft([{ y:0.32, w:0.31, d:0.23 }, { y:0.41, w:0.22, d:0.18 }, { y:0.44, w:0.19, d:0.16 }], chamfer(0.45)), 'robe', R.chest);   // collar wrap

  /* ---- head: chiseled skull, brow ridge, nose, ears ---- */
  add(loft([{ y:-0.1, w:0.11, d:0.11 }, { y:0.06, w:0.1, d:0.1 }], ngon(6, Math.PI/6)), 'skin', R.head);
  const skull = add(loft([
    { y:0.02, w:0.1,  d:0.11, z:0.035 },
    { y:0.06, w:0.16, d:0.17, z:0.015 },
    { y:0.12, w:0.2,  d:0.215 },
    { y:0.19, w:0.215,d:0.235 },
    { y:0.25, w:0.205,d:0.23, z:-0.005 },
    { y:0.3,  w:0.165,d:0.19, z:-0.01 },
    { y:0.33, w:0.07, d:0.09, z:-0.01 },
  ], HEAD), 'skin', R.head);
  add(block(0.17, 0.032, 0.04, 0.45), browSkin, R.head, [0, 0.188, 0.1], [0.25, 0, 0]);
  add(shard(0.045, 0.05, 0.035), 'skin', R.head, [0, 0.16, 0.1], [1.95, 0, 0]);
  for (const sx of [-1, 1]){
    add(block(0.03, 0.055, 0.045, 0.4), 'skin', R.head, [0.105*sx, 0.15, -0.005]);
    add(block(0.034, 0.012, 0.01, 0.2), 'hair', R.head, [0.042*sx, 0.168, 0.112], [0, 0, -0.18*sx], { outline: false });
  }
  add(block(0.06, 0.014, 0.01, 0.3), 'hair', R.head, [0, 0.085, 0.112], [0, 0, 0], { outline: false });   // set mouth

  /* ---- arms: tunic sleeves flaring at the forearm, leather bracers, blocky hands ---- */
  for (const A of [R.armL, R.armR]){
    const s = A.side;
    add(loft([{ y:-0.08, w:0.2, d:0.19 }, { y:0.02, w:0.195, d:0.185 }, { y:0.075, w:0.11, d:0.13 }], chamfer(0.42)), 'tunic', A.sh, [0.02*s, 0.03, 0], [0, 0, -0.3*s]);   // shoulder wrap
    add(limb(0.34, [[-0.2,0.15,0.15],[0.06,0.165,0.16],[0.5,0.135,0.135],[1,0.105,0.11]], chamfer(0.4)), 'tunic', A.sh);
    add(limb(0.3, [[0,0.1,0.1],[0.45,0.12,0.12],[0.78,0.16,0.155]], KEEL), 'tunic', A.el);
    add(limb(0.3, [[0.6,0.085,0.085],[1,0.075,0.075]], chamfer(0.3)), 'leather', A.el);
    add(loft([{ y:-0.13, w:0.068, d:0.058 }, { y:-0.09, w:0.088, d:0.062 }, { y:-0.02, w:0.08, d:0.056 }, { y:0.01, w:0.064, d:0.05 }], chamfer(0.3)), 'skin', A.wr, [0,0,0], [0,0,0], { scale: 1.15 });
    add(block(0.03, 0.06, 0.032, 0.3), 'skin', A.wr, [0, -0.05, 0.035], [0.4, 0, 0]);   // thumb
  }

  return { parts, head: [skull] };
}
