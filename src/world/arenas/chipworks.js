// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the chip foundry in a dead volcano's shadow, where the Empire is making new inhibitor chips (the
// ARC trooper's THE CHIP FOUNDRY, data/missions.js chipworks). The chips were never retired. They are being remade.

import * as THREE from 'three';
import { solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';

/* THE FOUNDRY FLOOR (60 across, half 30), under an ash sky.
     · the LOADING DOCK in the south (z −30…−12): the band's shuttle comes in over the ash field, crates and ore carts
       for cover, the dock's guard post in the west;
     · the FOUNDRY in the middle and north: three CHIP PRESSES (tall, hard cover, a console on the south face of each)
       in a ring round the cooling tanks, with low CONVEYOR lines (1.6) between them and a gantry in the north-east;
     · the volcano's black cone and smokestacks past the north edge.
   Every lane between solids is at least 3 m. */
export const CHIPWORKS_SPOTS = {
  start: [0, -25, 0],                        // off the shuttle's ramp, facing the foundry
  dock: [-11, -17],                          // the dock's guard post
  presses: [[-16, 2], [16, 2], [0, 15]],     // where you stand to set each charge (the press's console)
  exfil: [0, -20],                           // where the shuttle comes back for you
};

export function buildChipworksArena(L){
  const pal = L.pal || {};
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x2a2624, roughness: 0.95 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5a5e64, roughness: 0.55, metalness: 0.5 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x2a2e34, roughness: 0.6, metalness: 0.45 });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46, roughness: 0.6, metalness: 0.4 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x5a5040, roughness: 0.85 });
  const belt   = new THREE.MeshStandardMaterial({ color: pal.belt ?? 0x1e1e20, roughness: 0.8 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd0a030, roughness: 0.6, metalness: 0.3 });
  const glow   = new THREE.MeshBasicMaterial({ color: pal.glow ?? 0xff7a2a });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const screen = new THREE.MeshBasicMaterial({ color: pal.screen ?? 0x4ad2ff });
  const chip   = new THREE.MeshBasicMaterial({ color: pal.chip ?? 0x8aff8a });
  const K = arenaKit(), R = seeded(83);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the LOADING DOCK: the guard post, crates and ore carts ----
  { const [x, z] = CHIPWORKS_SPOTS.dock;   // the guard post: a sandbagged booth with a low wall in front
    K.box(x - 3.2, z + 1.5, 1.2, 1.2, 2.6, imp);
    K.box(x + 1.5, z - 3.4, 2.4, 0.6, 1.6, metalD);
    picture(K.deco(new THREE.BoxGeometry(2.42, 0.2, 2.42), red, x - 3.2, 2.5, z + 1.5)); }
  for (const [x, z, ax] of [[12, -18, 1], [-3, -27, 1], [24, -25, 0], [-25, -24, 0]]) K.box(x, z, ax ? 2.4 : 1.1, ax ? 1.1 : 2.4, 1.6, crate);
  for (const [x, z] of [[20, -14], [7, -28]]){ K.box(x, z, 0.9, 0.9, 2.2, crate); K.box(x + 1.7, z + 0.2, 0.8, 0.8, 1.1, crate); }
  for (const [x, z] of [[-20, -10], [6, -13]]) K.rubble(x, z, 2.6, 0.5, metalD, true);   // toppled ore carts: steps
  for (const x of [-4.6, 4.6]) picture(K.deco(new THREE.PlaneGeometry(0.3, 18), stripe, x, 0.02, -21, -Math.PI / 2));
  for (const [x, z] of [[-14, -27], [26, -16], [-27, -3]]) spawnBarrel(V3(x, 0, z));

  // ---- the CHIP PRESSES: a tall block each, its console on the south face, a green line of new chips on top ----
  for (const [x, z] of CHIPWORKS_SPOTS.presses){
    const cz = z + 3.4;   // the press stands north of where you set the charge
    K.box(x, cz, 2.4, 1.6, 4.2, imp);
    K.deco(new THREE.BoxGeometry(3.6, 0.6, 2.2), metalD, x, 4.5, cz); solids[solids.length - 1].h = 4.8;
    picture(K.deco(new THREE.BoxGeometry(4.6, 0.12, 0.06), glow, x, 2.4, cz - 1.62));
    picture(K.deco(new THREE.PlaneGeometry(1.2, 0.6), screen, x, 1.5, cz - 1.63, 0, Math.PI, 0));
    for (let k = -2; k <= 2; k++) picture(K.deco(new THREE.BoxGeometry(0.25, 0.05, 0.25), chip, x + k * 0.6, 4.84, cz));
  }
  // the CONVEYOR lines between the presses (1.6: still stops a bolt), with gaps to run through
  for (const [x, z, hx, hz] of [[-7, -2, 3.5, 0.7], [7, -2, 3.5, 0.7], [-9, 13, 0.7, 3.0], [9, 13, 0.7, 3.0]]){
    K.box(x, z, hx, hz, 1.6, metalD);
    picture(K.deco(new THREE.BoxGeometry(hx * 2 - 0.2, 0.1, hz * 2 - 0.2), belt, x, 1.65, z));
  }
  // the COOLING TANKS in the middle: two columns, a pipe between them overhead
  for (const [x, z] of [[-3.5, 6], [3.5, 6]]){
    K.column(x, z, 1.5, 5.5, metal, { seg: 14, taper: 1 });
    picture(K.deco(new THREE.CylinderGeometry(1.52, 1.52, 0.3, 14, 1, true), stripe, x, 3.6, z));
  }
  picture(K.deco(new THREE.CylinderGeometry(0.3, 0.3, 7, 8), metalD, 0, 6.2, 6, 0, 0, Math.PI / 2));
  K.gantry(22, 20, { a: metal, b: metalD, strut: metalD, beacon: 0xff7a2a }, [-1, -1]);
  K.box(-22, 22, 2.4, 1.4, 1.6, crate); K.box(-22, 15, 1.1, 2.4, 2.6, imp);
  // ore bins along the open lanes: the side edges, south of the presses, and under the volcano (1.6: stops a bolt)
  for (const [x, z, ax] of [[-25, 6, 0], [25, -3, 0], [26, 12, 0], [0, -9, 1], [-12, 26, 1], [11, 25, 1], [-15, -5, 1], [17, -8, 1]])
    K.box(x, z, ax ? 2.2 : 1.0, ax ? 1.0 : 2.2, 1.6, crate);

  // ---- the volcano's foot past the north edge, slag channels glowing in the floor, ash on the ground ----
  picture(K.deco(new THREE.BoxGeometry(62, 7, 1), rock, 0, 3.5, 30.6));
  for (const sx of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(1, 6, 40), rock, sx * 30.6, 3, 10));
  for (const [x, z, len, ax] of [[-14, 27.5, 18, 1], [14, 27.5, 18, 1], [28.5, 6, 12, 0], [-28.5, 12, 12, 0]])
    picture(K.deco(new THREE.PlaneGeometry(ax ? len : 0.7, ax ? 0.7 : len), glow, x, 0.03, z, -Math.PI / 2)).receiveShadow = false;
  const ash = new THREE.MeshStandardMaterial({ color: 0x5a5654, roughness: 1, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 12; i++){
    const r = 1 + R() * 2;
    picture(K.deco(new THREE.CircleGeometry(r, 12), ash, (R() - 0.5) * 54, 0.015, (R() - 0.5) * 54, -Math.PI / 2)).receiveShadow = false;
  }
}
