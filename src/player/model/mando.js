// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Mandalorian: dark flight suit under faceted beskar plates, T-visor helmet, half-cape, and the jetpack.
// Everything starts hidden; setHero() shows the returned parts for the bounty hunter.

import * as THREE from 'three';
import { loft, limb, plate, block, shard, chamfer, ngon, KEEL, SHIELD, HEAD } from './shapes.js';

export function dressMando(R, S, player){
  const parts = [];
  const add = (geo, mat, parent, p, r, o) => { const m = S.add(geo, mat, parent, p, r, o); parts.push(m); return m; };
  const group = (parent, p = [0,0,0], r = [0,0,0]) => {
    const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...r); parent.add(g); parts.push(g); return g;
  };
  const seam = (...a) => { const m = S.seam(...a); if (m) parts.push(m); return m; };
  const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();

  /* ---- legs: suit, thigh plate, knee cop, shin greave, armored boot ---- */
  for (const L of [R.legL, R.legR]){
    add(limb(0.45, [[-0.06,0.18,0.18],[0.2,0.17,0.17],[0.75,0.13,0.14],[1,0.11,0.12]], KEEL), 'suit', L.hip);
    add(plate([[-0.07,0],[0.07,0],[0.078,-0.2],[0,-0.25],[-0.078,-0.2]], 0.03, 0.01), 'beskar2', L.hip, [0, -0.07, 0.085], [-0.06, 0, 0]);
    add(plate([[-0.055,0.04],[0.055,0.04],[0.065,-0.02],[0,-0.07],[-0.065,-0.02]], 0.03, 0.01), 'beskar', L.knee, [0, 0, 0.07]);
    add(limb(0.41, [[0.04,0.11,0.12],[0.1,0.14,0.15],[0.45,0.135,0.145],[0.8,0.115,0.125],[1,0.115,0.125]], KEEL), 'suit', L.knee);
    add(limb(0.32, [[0,0.125,0.11,0.02],[0.3,0.15,0.13,0.02],[1,0.12,0.1,0.02]], KEEL), 'beskar2', L.knee, [0, -0.08, 0]);
    add(plate([[-0.075,0.035],[-0.09,-0.075],[0.16,-0.085],[0.21,-0.05],[0.1,0.0],[0.03,0.04]], 0.115, 0.014),
      'strap', L.ank, [0, 0, 0], [0, -Math.PI/2, 0]);
  }
  add(block(0.075, 0.17, 0.09, 0.35), 'strap', R.legR.hip, [0.06, -0.28, 0.04]);   // holster

  /* ---- hips + torso ---- */
  add(loft([{ y:-0.12, w:0.3, d:0.2 }, { y:0, w:0.34, d:0.22 }, { y:0.14, w:0.31, d:0.2 }], SHIELD), 'suit', R.hips);
  add(loft([{ y:0, w:0.31, d:0.2 }, { y:0.2, w:0.29, d:0.19 }, { y:0.36, w:0.33, d:0.21 }], SHIELD), 'suit', R.torso);
  add(loft([{ y:0.04, w:0.38, d:0.26 }, { y:0.17, w:0.37, d:0.255 }], SHIELD), 'strap', R.torso);   // belt
  for (const bx of [-0.12, 0.12]) add(block(0.085, 0.1, 0.06, 0.3), 'beskar2', R.torso, [bx, 0.08, 0.14]);
  const abPlate = plate([[-0.115,-0.035],[0.115,-0.035],[0.125,0.03],[-0.125,0.03]], 0.028, 0.008);
  add(abPlate, 'beskar2', R.torso, [0, 0.25, 0.108], [0.05, 0, 0]);
  add(abPlate, 'beskar2', R.torso, [0, 0.32, 0.112], [0.08, 0, 0], { scale: [1.08, 1, 1] });

  add(loft([{ y:0, w:0.33, d:0.22 }, { y:0.14, w:0.46, d:0.27 }, { y:0.27, w:0.52, d:0.26 }, { y:0.35, w:0.36, d:0.2 }, { y:0.4, w:0.2, d:0.15 }], SHIELD), 'suit', R.chest);
  const pec = [[0.0,0.0],[0.165,0.02],[0.19,0.13],[0.15,0.19],[0.02,0.17]];
  add(plate(pec, 0.04, 0.012), 'beskar', R.chest, [0.012, 0.12, 0.125], [-0.06, 0.22, 0]);
  add(plate(mirror(pec), 0.04, 0.012), 'beskar', R.chest, [-0.012, 0.12, 0.125], [-0.06, -0.22, 0]);
  add(shard(0.05, 0.11, 0.03), 'accent', R.chest, [0, 0.03, 0.14], [0, 0, 0]);   // keystone
  add(loft([{ y:0.33, w:0.24, d:0.2 }, { y:0.43, w:0.17, d:0.16 }], chamfer(0.45)), 'suit', R.chest);   // gorget
  // back plate
  add(plate([[-0.17,0],[0.17,0],[0.15,0.24],[-0.15,0.24]], 0.03, 0.01), 'beskar2', R.chest, [0, 0.06, -0.125]);
  // half-cape off the left shoulder — on its own pivot so it can trail later
  const capePivot = group(R.chest, [-0.1, 0.36, -0.14], [0.14, 0.2, 0.04]);
  add(plate([[-0.16,0.0],[0.14,0.0],[0.19,-0.62],[0.02,-0.7],[-0.2,-0.6]], 0.012, 0.004), 'cloth', capePivot, [0, 0, 0], [0, 0, 0], { outline: false });
  // straps tying the pack to the chest
  for (const sx of [-1, 1]) add(block(0.05, 0.42, 0.03, 0.2), 'strap', R.chest, [0.13*sx, 0.18, 0.13], [-0.25, 0, 0]);

  /* ---- arms: suit, pauldrons (red on the right), bracers, gloves ---- */
  for (const A of [R.armL, R.armR]){
    const s = A.side;
    add(limb(0.34, [[-0.18,0.14,0.14],[0.06,0.15,0.15],[0.5,0.125,0.125],[1,0.1,0.105]], chamfer(0.4)), 'suit', A.sh);
    add(loft([{ y:-0.06, w:0.21, d:0.2 }, { y:0.03, w:0.2, d:0.19 }, { y:0.08, w:0.13, d:0.15 }], chamfer(0.42)),
      s > 0 ? 'accent' : 'beskar', A.sh, [0.025*s, 0.035, 0], [0, 0, -0.32*s]);
    add(limb(0.3, [[0,0.1,0.1],[0.5,0.095,0.095],[1,0.08,0.08]], chamfer(0.35)), 'suit', A.el);
    add(limb(0.24, [[0,0.11,0.105],[0.6,0.115,0.11],[1,0.098,0.095]], KEEL), 'beskar2', A.el, [0, -0.04, 0]);
    add(plate([[-0.04,0],[0.04,0],[0.045,-0.12],[-0.045,-0.12]], 0.02, 0.006), 'beskar', A.el, [0, -0.08, 0.058]);
    add(loft([{ y:-0.13, w:0.072, d:0.06 }, { y:-0.09, w:0.09, d:0.064 }, { y:-0.02, w:0.082, d:0.058 }, { y:0.02, w:0.07, d:0.055 }], chamfer(0.3)), 'strap', A.wr, [0,0,0], [0,0,0], { scale: 1.15 });
    add(block(0.03, 0.06, 0.032, 0.3), 'strap', A.wr, [0, -0.05, 0.035], [0.4, 0, 0]);
  }

  /* ---- helmet: T-visor, chiseled dome, comm caps, rangefinder ---- */
  const helm = group(R.head);
  add(loft([{ y:-0.1, w:0.12, d:0.12 }, { y:0.04, w:0.11, d:0.11 }], ngon(6, Math.PI/6)), 'suit', helm);
  add(loft([
    { y:0.0,  w:0.205, d:0.225, z:0.005 },
    { y:0.07, w:0.215, d:0.235, z:0.005 },
    { y:0.2,  w:0.235, d:0.25 },
    { y:0.3,  w:0.222, d:0.24, z:-0.005 },
    { y:0.36, w:0.165, d:0.19, z:-0.01 },
    { y:0.385,w:0.08,  d:0.1,  z:-0.01 },
  ], HEAD), 'beskar', helm);
  add(plate([[-0.098,0.026],[0.098,0.026],[0.104,-0.01],[0.026,-0.02],[-0.026,-0.02],[-0.104,-0.01]], 0.02, 0.003), 'visor', helm, [0, 0.205, 0.121], [0, 0, 0], { outline: false });
  add(plate([[-0.024,0],[0.024,0],[0.019,-0.11],[-0.019,-0.11]], 0.02, 0.003), 'visor', helm, [0, 0.192, 0.12], [0.07, 0, 0], { outline: false });
  add(block(0.13, 0.05, 0.07, 0.4), 'beskar2', helm, [0, 0.03, 0.08]);   // chin guard
  for (const sx of [-1, 1]) add(block(0.03, 0.07, 0.075, 0.35), 'suit', helm, [0.118*sx, 0.15, 0.0]);
  const fin = group(helm, [-0.13, 0.25, 0.01], [0, 0, 0.22]);
  add(block(0.016, 0.17, 0.024, 0.3), 'suit', fin, [0, 0.085, 0]);
  add(shard(0.03, 0.05, 0.03), 'accent', fin, [0, 0.17, 0]);
  seam(new THREE.BoxGeometry(0.17, 0.006, 0.006), 0x5fd8ff, helm, [0, 0.205, 0.134]);

  /* ---- jetpack (its -z faces the camera); hooks: jetGlow, jetFuelSegs, jetMissileMesh ---- */
  const jet = group(R.back, [0, 0, -0.22]);
  add(block(0.4, 0.58, 0.18, 0.3), 'suit', jet);
  add(block(0.24, 0.48, 0.1, 0.3), 'beskar2', jet, [0, 0, -0.1]);
  for (const sx of [-1, 1]){
    add(block(0.08, 0.44, 0.06, 0.35), 'beskar', jet, [0.055*sx, 0, -0.16]);
    for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.088, 0.012, 0.03), 'suit', jet, [0.055*sx, -0.17 + k*0.085, -0.19], [0,0,0], { outline: false });
    add(loft([{ y:-0.25, w:0.2, d:0.2 }, { y:0.2, w:0.2, d:0.2 }, { y:0.26, w:0.16, d:0.16 }, { y:0.32, w:0.06, d:0.06 }], ngon(8, Math.PI/8)), 'beskar2', jet, [0.2*sx, -0.02, 0]);
    add(loft([{ y:-0.09, w:0.09, d:0.09 }, { y:0.08, w:0.17, d:0.17 }], ngon(8, Math.PI/8)), 'beskar', jet, [0.2*sx, -0.35, 0.01], [0, 0, -0.1*sx]);
  }
  add(block(0.028, 0.46, 0.03, 0.3), 'accent', jet, [0, 0, -0.2]);
  add(loft([{ y:-0.15, w:0.03, d:0.03 }, { y:0.15, w:0.022, d:0.022 }], ngon(6)), 'beskar', jet, [0.13, 0.46, -0.02]);
  add(shard(0.04, 0.07, 0.04), 'accent', jet, [0.13, 0.6, -0.02]);
  add(loft([{ y:-0.05, w:0.17, d:0.17 }, { y:0.05, w:0.12, d:0.12 }], ngon(8, Math.PI/8)), 'beskar', jet, [0, 0.32, 0]);
  const jmiss = new THREE.Group(); jmiss.position.set(0, 0.43, -0.03); jet.add(jmiss);
  S.add(loft([{ y:-0.15, w:0.124, d:0.124 }, { y:0.15, w:0.124, d:0.124 }], ngon(8, Math.PI/8)), 'beskar2', jmiss);
  S.add(loft([{ y:0.15, w:0.124, d:0.124 }, { y:0.28, w:0.001, d:0.001 }], ngon(8, Math.PI/8)), 'accent', jmiss);
  for (let fi = 0; fi < 3; fi++){ const a = fi/3*Math.PI*2;
    S.add(plate([[0,0],[0.05,-0.02],[0.05,-0.1],[0,-0.07]], 0.012, 0.003), 'beskar', jmiss, [Math.cos(a)*0.05, -0.08, Math.sin(a)*0.05], [0, -a, 0]); }
  jmiss.visible = false; player.jetMissileMesh = jmiss;
  const glowMat = () => new THREE.MeshBasicMaterial({ color: 0x59c6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const nozzles = [];
  for (const sx of [-1, 1]){
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.025, 0.13, 8), glowMat());
    g.position.set(0.18*sx, -0.47, 0.01); g.rotation.z = -0.1*sx; jet.add(g); nozzles.push(g);
  }
  player.jetGlow = nozzles;
  const fuelSegs = [], SEG_N = 6;
  for (const sx of [-1, 1]) for (let i = 0; i < SEG_N; i++){
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    seg.position.set(0.2*sx, -0.17 + i*0.072, -0.105); jet.add(seg);
    fuelSegs.push({ mesh: seg, thr: i / SEG_N });
  }
  player.jetFuelSegs = fuelSegs;

  // FORGED seams — thin glowing lines along the armor edges (no-ops for the other styles)
  for (const sx of [-1, 1]) seam(new THREE.BoxGeometry(0.006, 0.2, 0.006), 0x5fd8ff, jet, [0.055*sx, 0, -0.195]);
  seam(new THREE.BoxGeometry(0.22, 0.008, 0.008), 0xff7a3d, R.torso, [0, 0.285, 0.13]);
  for (const sx of [-1, 1]){
    seam(new THREE.BoxGeometry(0.008, 0.16, 0.008), 0x5fd8ff, R.chest, [0.19*sx, 0.2, 0.1], [0, 0, 0.25*sx]);       // pec plate edges
    seam(new THREE.BoxGeometry(0.008, 0.18, 0.008), 0x5fd8ff, R[sx < 0 ? 'armL' : 'armR'].el, [0, -0.16, 0.07]);   // gauntlet line
    seam(new THREE.BoxGeometry(0.008, 0.2, 0.008), 0x5fd8ff, R[sx < 0 ? 'legL' : 'legR'].knee, [0, -0.2, 0.085]);  // greave line
  }

  for (const p of parts) p.visible = false;
  return { parts, cape: capePivot };
}
