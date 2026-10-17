// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Training arena (Mandalorian): the Armorer's forge, an open covert yard under the night sky.

import * as THREE from 'three';
import { arenaKit, seeded, at } from './kit.js';

/* THE ARMORER'S FORGE (half-size 22). An open yard around the covert's forge, laid out as stations
   (data/tutorial.js names the spots; game/tutorial.js walks the player through them):
     · the FORGE in the centre: the hearth and its molten crucible under a hood on four posts, two anvils beside it;
     · the CRATE ROW on the west lane: low beskar crates (under vaultHeight) to hop over;
     · the LOOKOUT on the south-east: the three-tier overwatch gantry, the jetpack's first climb;
     · the FIRING LINE on the south lane: a low sandbag wall to shoot over at the targets beyond it;
     · ingot racks and quench tanks round the edge for the read of a workshop.
   The player spawns north (0, +11), facing the forge. */
export const FORGE_SPOTS = {
  forge: [0, 0],
  crates: { x: -11, z: [4, -1] },
  lookout: [10, -12],   // gantry base; the deck (7.7) sits at +3.6, +2.6 from it
  line: { z: -8.5, hx: 7 },
};

export function buildForgeArena(L){
  const pal = L.pal || {};
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5a6068, roughness: 0.55, metalness: 0.75 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x2e3238, roughness: 0.6, metalness: 0.7 });
  const beskar = new THREE.MeshStandardMaterial({ color: pal.beskar ?? 0xa8b0b8, roughness: 0.32, metalness: 0.9 });
  const sand   = new THREE.MeshStandardMaterial({ color: pal.sand ?? 0x7a6650, roughness: 0.95, metalness: 0.02 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6, metalness: 0.5 });
  const molten = new THREE.MeshBasicMaterial({ color: pal.molten ?? 0xff7a1e, fog: false });
  const K = arenaKit(), R = seeded(41);

  // ---- the FORGE — a round hearth with a molten crucible, a hood on four posts, two anvils ----
  K.column(0, 0, 2.0, 1.3, metalD, { wallKick: false, seg: 14, taper: 1.05 });
  K.deco(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 16), molten, 0, 1.33, 0);
  K.deco(new THREE.TorusGeometry(1.55, 0.14, 8, 18), stripe, 0, 1.36, 0, Math.PI/2);
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) K.column(x, z, 0.18, 5.6, metalD, { wallKick: false, seg: 6, taper: 1 });
  K.deco(new THREE.CylinderGeometry(1.1, 2.6, 1.4, 4, 1, true), metal, 0, 6.2, 0, 0, Math.PI/4).material.side = THREE.DoubleSide;
  K.deco(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 10), metalD, 0, 8.0, 0);
  for (const [x, z, r] of [[3.6, 1.2, 0.3], [-3.4, -1.6, -0.5]]){
    K.box(x, z, 0.5, 0.32, 0.55, metalD);
    K.deco(new THREE.BoxGeometry(1.5, 0.3, 0.55), beskar, x, 0.7, z, 0, r, 0);
  }

  // ---- the CRATE ROW — low beskar crates across the west lane ----
  for (const z of FORGE_SPOTS.crates.z){
    K.box(FORGE_SPOTS.crates.x, z, 1.7, 0.45, 1.0, metal);
    K.deco(new THREE.BoxGeometry(3.45, 0.08, 0.95), stripe, FORGE_SPOTS.crates.x, 0.55, z);
  }

  // ---- the LOOKOUT — the overwatch gantry, the first place the jetpack takes you ----
  K.gantry(FORGE_SPOTS.lookout[0], FORGE_SPOTS.lookout[1], { a: metalD, b: metal, strut: stripe, beacon: pal.beacon ?? 0xff8a3a });

  // ---- the FIRING LINE — a low sandbag wall (cover you shoot over) facing the target range ----
  { const F = FORGE_SPOTS.line;
    K.box(0, F.z, F.hx, 0.45, 0.95, sand, { climbable: false });
    for (let i = 0; i < 9; i++) K.deco(new THREE.CapsuleGeometry(0.28, 1.1, 2, 6), sand, -F.hx + 0.8 + i * (F.hx*2 - 1.6) / 8, 1.05, F.z, 0, 0, Math.PI/2); }

  // ---- INGOT RACKS and QUENCH TANKS round the edge (all solid, none in a lane) ----
  for (let i = 0; i < 8; i++){
    const a = (i / 8) * Math.PI*2 + Math.PI/8, [x, z] = at(a, 18.5);
    if (Math.hypot(x - FORGE_SPOTS.lookout[0], z - FORGE_SPOTS.lookout[1]) < 6) continue;
    if (i % 2){
      K.column(x, z, 1.1, 1.6, metalD, { wallKick: false, seg: 12, taper: 1 });   // quench tank
      K.deco(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 12), new THREE.MeshBasicMaterial({ color: 0x2a4a5a }), x, 1.62, z);
    } else {
      const ax = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
      K.box(x, z, ax ? 0.5 : 1.6, ax ? 1.6 : 0.5, 2.2 + R()*0.4, metal);              // ingot rack
      for (let k = 0; k < 3; k++) K.deco(new THREE.BoxGeometry(ax ? 0.9 : 2.8, 0.14, ax ? 2.8 : 0.9), beskar, x, 0.6 + k*0.6, z);
    }
  }
}
