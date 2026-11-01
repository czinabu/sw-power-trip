// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Battle map: the Grass Sea of Lothal, a wide open plain between an allied landing field and an Imperial outpost.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { fieldKit, coverSpots, strike } from './field.js';

/* THE GRASS SEA (150 across, half 75). A big open battle from one end to the other, built for squads:
     · the LANDING FIELD in the north (z +48…+68): the allied pad, supply crates and a SANDBAG LINE at z +40 with
       the middle lane open. The hero and the squads start here;
     · the GRASS (z −30…+30): broken stone RIDGES in three loose lines (z +18, −2, −20), every one under the single
       jump apex so it can be vaulted, with wide lanes between them; tall rock SPIRES for wall-kicks and sightline
       breaks; a DOWNED WALKER west of centre whose hull is the high ground of the whole field (crate, leg stump,
       hull); three scorched CRATERS where the outpost's mortars land (amber warning, then the blast);
     · the IMPERIAL OUTPOST in the south (z −42…−68): a perimeter wall with three gates, a command bunker you can
       climb, a comms mast and an overwatch gantry, fuel drums by the gates.
   Every gap between solids is at least 3 m, so a brute walks through anywhere a trooper can. */
const PLAN = {
  // cover walls: [x, z, half-length, height, alongX]
  bags: [   // the allied sandbag line (z +40), the middle lane open
    [-42, 40, 5, 1.15, 1], [-26, 40, 5, 1.15, 1], [-12, 40, 4, 1.15, 1], [12, 40, 4, 1.15, 1], [26, 40, 5, 1.15, 1], [42, 40, 5, 1.15, 1],
  ],
  ridges: [   // broken stone ridges across the grass
    [-52, 22, 3.5, 1.55, 1], [-30, 18, 4, 1.55, 1], [-6, 20, 3.5, 1.7, 1], [16, 18, 4.5, 1.55, 1], [42, 20, 3.5, 1.6, 1],
    [-34, -2, 3.5, 1.55, 1], [24, -2, 4, 1.6, 1], [44, 1, 3, 1.55, 1], [-56, -6, 3, 1.55, 0],
    [-42, -20, 4, 1.55, 1], [-14, -22, 4.5, 1.6, 1], [8, -18, 3.5, 1.55, 1], [34, -20, 4, 1.7, 1], [56, -24, 3.5, 1.55, 1],
  ],
  outpost: [   // the outpost's perimeter (2.6 tall: hard cover, double jump or fly to get on it)
    [-34, -42, 10, 2.6, 1], [-11, -42, 5, 2.6, 1], [11, -42, 5, 2.6, 1], [34, -42, 10, 2.6, 1],
    [-44, -49.5, 7.05, 2.6, 0], [44, -49.5, 7.05, 2.6, 0], [-44, -66, 3, 2.6, 0], [44, -66, 3, 2.6, 0],
  ],
  barricades: [   // inside the outpost: metal barricades behind the gates
    [0, -48, 3, 1.55, 1], [-20, -52, 2.5, 1.55, 1], [20, -52, 2.5, 1.55, 1],
  ],
  spires: [[30, 10, 2.2, 14], [36, 13, 1.3, 8.5], [-40, 6, 2.4, 16], [-46, 11, 1.2, 7.5], [22, -32, 1.8, 11],
           [-24, 30, 1.6, 10], [52, -8, 2.0, 13], [-60, 26, 2.0, 12], [62, 34, 1.8, 11], [-62, -32, 2.2, 14]],
  rocks: [[8, 12, 1.4, 1.8], [-50, 4, 1.6, 2.2], [54, 30, 1.5, 1.9], [6, -32, 1.3, 1.7], [-25, 3, 1.2, 1.6], [40, -32, 1.5, 2.0],
          [-30, -32, 1.4, 1.8], [64, -2, 1.3, 1.6], [-64, 8, 1.6, 2.1], [-8, 30, 1.1, 1.4], [30, 30, 1.2, 1.5]],
  walker: [-10, 4],        // the downed walker's hull centre (it lies along x)
  craters: [[14, 8, 3.6], [-24, 12, 3.6], [32, -10, 3.6]],
};

export const GRASSLAND_SPOTS = {
  allyStart: [0, 50, Math.PI],                                     // the landing field, facing the grass
  enemyStart: [[0, -66], [-30, -56], [30, -56], [-58, -30], [58, -30]],
  // the line the fight moves along, from the allied line to the outpost
  fronts: [[0, 40], [-4, 20], [0, -2], [0, -20], [0, -42], [0, -56]],
  points: { ridge: [-6, 23], walker: [-10, 10], crossroads: [20, -6], gate: [0, -39], bunker: [0, -51] },
  cover: coverSpots([...PLAN.bags, ...PLAN.ridges, ...PLAN.outpost], 1),
  enemyCover: coverSpots([...PLAN.ridges, ...PLAN.barricades, ...PLAN.bags], -1),
  craters: PLAN.craters.map(([x, z]) => [x, z]),
};

export function buildGrasslandArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x8a7e66 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x665c4a });
  const bag    = new THREE.MeshStandardMaterial({ color: pal.bag ?? 0x9a8a62 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x6a727e });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x7a6a52 });
  const scorch = new THREE.MeshBasicMaterial({ color: pal.scorch ?? 0x3a3428, transparent: true, opacity: 0.75, depthWrite: false });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const red    = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  const K = arenaKit(), R = seeded(71), F = fieldKit(K, R);

  // ---- the LANDING FIELD — the allied pad (walkable), supply crates, the sandbag line ----
  K.box(0, 58, 10, 7, 0.24, metal, { climbable: true });
  for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.4, 0.04, 13.4), stripe, sx*9.5, 0.25, 58);
  for (const sx of [-1, 1]) for (const dz of [-6, 0, 6]) K.deco(new THREE.SphereGeometry(0.18, 8, 6), lamp, sx*9.2, 0.36, 58 + dz);
  for (const [x, z, f] of [[-16, 52, 1], [16, 54, -1], [-28, 60, 1], [28, 60, -1], [-6, 46, -1], [38, 50, 1]]) F.crates(x, z, crate, stoneD, f);
  for (const w of PLAN.bags) F.wall(w, { body: bag, cap: bag }, { bags: true });
  // a comms mast by the pad
  K.column(-14, 64, 0.35, 9, metal, { wallKick: false, seg: 6, taper: 0.5 });
  K.deco(new THREE.SphereGeometry(0.22, 8, 6), lamp, -14, 9.4, 64);

  // ---- the GRASS — ridges, spires, boulders ----
  for (const w of PLAN.ridges) F.wall(w, { body: stone, cap: stoneD }, { jag: true });
  for (const [x, z, r, h] of PLAN.spires) F.spire(x, z, r, h, stone, stoneD);
  for (const [x, z, r, h] of PLAN.rocks) F.rock(x, z, r, h, stoneD, stone);

  // ---- the DOWNED WALKER — the high ground of the field ----
  F.walkerHulk(PLAN.walker[0], PLAN.walker[1], true, { hull: metal, dark: imp, plate: metal, crate, glow: red });

  // ---- the CRATERS and the mortar strikes that keep landing on them (staggered, so they never fire together) ----
  PLAN.craters.forEach(([x, z, r], i) => {
    F.crater(x, z, r + 0.6, scorch);
    hazardZones.push(strike(x, z, r, i * 3.7, pal.blast ?? 0xff7a30));
  });

  // ---- the IMPERIAL OUTPOST ----
  for (const w of PLAN.outpost) F.wall(w, { body: imp, cap: stripe }, { buttress: true });
  for (const w of PLAN.barricades) F.wall(w, { body: metal, cap: stripe });
  // the command bunker: climbs crate (1.1) → step (2.2) → roof (3.4)
  K.box(0, -57, 6, 4, 3.4, imp);
  K.deco(new THREE.BoxGeometry(12.2, 0.2, 8.2), stripe, 0, 3.45, -57);
  K.deco(new THREE.PlaneGeometry(3, 1.2), lamp, 0, 2.1, -52.98);
  K.box(7.2, -54.6, 1.2, 1.2, 2.2, metal); K.box(9.2, -53.6, 0.8, 0.8, 1.1, crate);
  // the comms mast and its dish
  K.column(16, -60, 0.7, 12, imp, { wallKick: false, seg: 6, taper: 0.5 });
  K.box(16, -60, 1.4, 1.4, 0.6, imp);
  K.deco(new THREE.CylinderGeometry(2.2, 0.4, 0.8, 12, 1, true), metal, 16, 11.4, -59.4, 0.9, 0, 0);
  K.deco(new THREE.SphereGeometry(0.24, 8, 6), red, 16, 12.6, -60);
  // the overwatch gantry, west of the bunker
  K.gantry(-24, -60, { a: imp, b: metal, strut: imp, beacon: pal.beacon ?? 0xff5040 }, [1, 1]);
  // fuel drums by the gates and on the walker's approach
  for (const [x, z] of [[-8, -45], [8, -45], [-28, -46], [30, -46], [-21, 0], [-26, -7]]) spawnBarrel(V3(x, 0, z));
}
