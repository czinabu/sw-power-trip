// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Battle map: the Starship Graveyard on Jakku, a wreck field between a scavenger camp and an Imperial salvage yard.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { solids } from '../../state.js';
import { spawnBarrel, spawnVent } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { fieldKit, coverSpots } from './field.js';

/* THE STARSHIP GRAVEYARD (160 across, half 80). The biggest field: long sightlines over the sand, broken up by the
   wreckage of an old battle. Built for squads moving from wreck to wreck:
     · the SCAVENGER CAMP in the north (z +46…+76): tents, a parked freighter, and a SCRAP LINE at z +38;
     · the WRECK FIELD (z −40…+30): tall HULL PLATES standing in the sand (hard cover, 4–6 tall, too high to vault;
       wall-kick them), low DEBRIS between them you can vault, and dunes you walk over;
       a buried ENGINE BELL west of centre, the high ground (debris step, step, rim) with three plasma VENTS on its
       south side; a crashed TIE east of it (its fallen wing is a step) and a downed fighter in the south;
     · the IMPERIAL SALVAGE YARD in the south (z −46…−76): a scrap wall with four gaps, container stacks and a crane
       gantry for overwatch. */
const PLAN = {
  scrap: [[-46, 38, 5, 1.4, 1], [-26, 38, 5, 1.4, 1], [-11, 38, 3, 1.4, 1], [11, 38, 3, 1.4, 1], [26, 38, 5, 1.4, 1], [46, 38, 5, 1.4, 1]],
  plates: [   // tall hull plates: hard cover
    [-40, 22, 4, 4.5, 1], [-14, 20, 3, 5.5, 0], [4, 24, 4, 3.8, 1], [26, 22, 3.5, 5, 0], [54, 22, 4, 4.2, 1],
    [-58, 0, 3.5, 5, 0], [36, 0, 4, 4.6, 1], [10, -4, 2.5, 6, 0],
    [-46, -22, 4, 5.2, 1], [-22, -26, 3, 4, 0], [8, -24, 4.5, 4.6, 1], [32, -22, 3, 5.6, 0], [58, -26, 4, 4.4, 1],
  ],
  debris: [   // low debris: vault it
    [-32, 6, 3, 1.3, 1], [22, 8, 3, 1.2, 1], [-4, -12, 3.5, 1.4, 1], [48, -10, 3, 1.3, 1], [-36, -38, 3, 1.3, 1], [20, -38, 3, 1.3, 1],
    [-62, 22, 3, 1.3, 1], [66, 2, 3, 1.3, 0],
  ],
  yard: [[-30, -46, 6, 2.2, 1], [-8, -46, 4, 2.2, 1], [14, -46, 5, 2.2, 1], [38, -46, 5, 2.2, 1]],
  dunes: [[-50, -8, 4, 2.5], [50, -40, 4, 2.5], [64, 14, 3.5, 2.2], [-66, 34, 3.5, 2.2], [-62, -44, 3.5, 2.2], [0, 6, 3.5, 2],
          [-24, 32, 3, 2], [40, 30, 3, 2], [-16, -32, 3, 2]],
  engine: [-22, 2, 4, 5],   // x, z, radius, height
  tie: [42, 12],
  fighter: [-6, -37],
};

export const GRAVEYARD_SPOTS = {
  allyStart: [0, 46, Math.PI],                                     // the camp, behind the scrap line, facing the wrecks
  enemyStart: [[0, -62], [-36, -62], [36, -62], [-64, -56], [64, -56]],
  fronts: [[0, 38], [0, 22], [-10, 2], [0, -12], [0, -46], [0, -62]],
  points: { camp: [0, 46], scrapLine: [0, 41], engine: [-22, 9], tie: [42, 18], fighter: [-10, -33], yard: [0, -56] },
  cover: coverSpots([...PLAN.scrap, ...PLAN.plates, ...PLAN.debris], 1),
  enemyCover: coverSpots([...PLAN.yard, ...PLAN.plates, ...PLAN.debris], -1),
  vents: [[-30, -5], [-14, -5], [-22, -10]],
};

export function buildGraveyardArena(L){
  const pal = L.pal || {};
  const hull   = new THREE.MeshStandardMaterial({ color: pal.hull ?? 0x8a8a84 });
  const hullD  = new THREE.MeshStandardMaterial({ color: pal.hullD ?? 0x5e5e5a });
  const rust   = new THREE.MeshStandardMaterial({ color: pal.rust ?? 0x7a5236 });
  const sand   = new THREE.MeshStandardMaterial({ color: pal.sand ?? 0xb0905e });
  const cloth  = new THREE.MeshStandardMaterial({ color: pal.cloth ?? 0x9a6a46, side: THREE.DoubleSide });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a });
  const dark   = new THREE.MeshStandardMaterial({ color: pal.dark ?? 0x2a2622 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const plasma = new THREE.MeshBasicMaterial({ color: pal.plasma ?? 0x6ad8ff });
  const red    = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  const K = arenaKit(), R = seeded(97), F = fieldKit(K, R);

  // ---- the SCAVENGER CAMP — tents, the freighter, the scrap line ----
  for (const [x, z, hx, hz, h] of [[-22, 62, 3, 2.5, 2.4], [-8, 70, 2.5, 2, 2.2], [24, 64, 3, 2.5, 2.4], [40, 56, 2.2, 2, 2.0]]){
    K.box(x, z, hx, hz, h, rust);
    K.deco(new THREE.ConeGeometry(Math.hypot(hx, hz)*1.08, 1.4, 4, 1, true), cloth, x, h + 0.62, z, 0, Math.PI/4, 0);
    K.deco(new THREE.PlaneGeometry(1.2, 1.6), lamp, x, 0.85, z - hz - 0.02, 0, Math.PI, 0);
  }
  // the freighter: a saucer on the sand (collides as one wide drum), cockpit off the starboard side, a lit ramp
  K.column(6, 60, 6, 2.6, hull, { wallKick: false, seg: 20, taper: 0.94 });
  K.deco(new THREE.CylinderGeometry(4.6, 5.8, 0.8, 20), hullD, 6, 3.0, 60);
  K.deco(new THREE.CylinderGeometry(1.0, 1.0, 3.6, 10), hullD, 12.6, 1.4, 56.6, Math.PI/2, 0, 0.5);
  solids.push({ x: 12.6, z: 56.6, r: 1.3, h: 2.4 });   // the cockpit reaches the sand past the drum: it collides too
  K.deco(new THREE.BoxGeometry(2.4, 0.2, 3), lamp, 6, 0.12, 52.6);
  for (const [x, z, f] of [[-34, 50, 1], [30, 48, -1], [-12, 52, -1]]) F.crates(x, z, rust, hullD, f);
  for (const w of PLAN.scrap) F.wall(w, { body: rust, cap: hullD }, { jag: true });

  // ---- the WRECK FIELD ----
  for (const w of PLAN.plates) F.wall(w, { body: hull, cap: hullD }, { plate: true });
  for (const w of PLAN.debris) F.wall(w, { body: hullD, cap: rust }, { jag: true });
  for (const [x, z, hx, hz] of PLAN.dunes) F.drift(x, z, hx, hz, sand);
  // the buried ENGINE BELL: a wide round rim (collides as a column), its dark throat, and two debris steps up the
  // north side (1.6, then 3.3, then the rim at 5)
  { const [x, z, r, h] = PLAN.engine;
    K.column(x, z, r, h, hullD, { wallKick: false, seg: 18, taper: 0.86 });
    K.deco(new THREE.TorusGeometry(r*0.9, 0.35, 6, 18), hull, x, h, z, Math.PI/2);
    K.deco(new THREE.CircleGeometry(r*0.8, 18), dark, x, h + 0.02, z, -Math.PI/2);
    for (let i = 0; i < 6; i++) K.deco(new THREE.BoxGeometry(0.6, h*0.8, 0.3), hull, x + Math.cos(i*1.05)*r*0.92, h*0.45, z + Math.sin(i*1.05)*r*0.92, 0, -i*1.05, 0);
    K.box(x - 1.8, z + 5.6, 1.1, 1.1, 1.6, rust);
    K.box(x + 0.4, z + 4.4, 1.1, 1.1, 3.3, hull);
    for (const [vx, vz] of GRAVEYARD_SPOTS.vents) spawnVent(V3(vx, 0, vz));
    K.deco(new THREE.BoxGeometry(0.5, 0.2, 2.8), plasma, x, 0.3, z - r - 0.4); }
  // the crashed TIE: cockpit ball, one wing standing, one fallen flat (step onto it, double jump or fly onto the ball)
  { const [x, z] = PLAN.tie;
    K.column(x, z, 1.6, 3.0, imp, { wallKick: false, seg: 12, taper: 1 });
    K.deco(new THREE.SphereGeometry(1.9, 12, 10), imp, x, 1.9, z);
    K.deco(new THREE.CircleGeometry(0.9, 8), dark, x, 1.9, z - 1.95, 0, Math.PI, 0);
    K.box(x + 4.6, z, 0.25, 3.0, 6.0, imp);
    K.deco(new THREE.CylinderGeometry(3.1, 3.1, 0.2, 6), hullD, x + 4.6, 3.0, z, 0, 0, Math.PI/2);
    K.box(x - 5, z + 1.5, 2.6, 2.6, 0.4, imp, { climbable: true });
    K.deco(new THREE.CylinderGeometry(0.4, 0.4, 3.4, 8), hullD, x + 2.9, 1.9, z, 0, 0, Math.PI/2); }
  // the downed fighter: a long vaultable fuselage and its wings in the sand
  { const [x, z] = PLAN.fighter;
    K.box(x, z, 0.9, 5, 1.4, hull);
    K.deco(new THREE.ConeGeometry(0.9, 2.6, 8), hull, x, 0.8, z + 6.2, Math.PI/2, 0, 0);
    K.deco(new THREE.BoxGeometry(0.5, 0.3, 1.6), red, x, 1.5, z - 1);
    for (const sx of [-1, 1]){
      K.box(x + sx*3.4, z - 2.6, 2.4, 0.8, 0.35, hullD, { climbable: true });
      K.deco(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8), hullD, x + sx*5.6, 0.5, z - 3.0, Math.PI/2, 0, 0);
    } }

  // ---- the IMPERIAL SALVAGE YARD ----
  for (const w of PLAN.yard) F.wall(w, { body: imp, cap: stripe }, { buttress: true });
  // container stacks: a tall stack (5.2) beside a single container (2.6)
  for (const [x, z, f] of [[-36, -58, 1], [36, -60, -1], [-4, -68, 1]]){
    K.box(x, z, 3.2, 1.4, 5.2, imp);
    K.deco(new THREE.BoxGeometry(6.5, 0.12, 2.9), stripe, x, 2.6, z);
    K.box(x + f*6.4, z + 0.4, 3.2, 1.4, 2.6, rust);
  }
  K.gantry(16, -64, { a: imp, b: hullD, strut: imp, beacon: pal.beacon ?? 0xff5040 }, [1, 1]);
  for (const [x, z] of [[-20, -50], [26, -50], [6, -56], [-50, -48], [-40, 30], [34, 30]]) spawnBarrel(V3(x, 0, z));
  // the lit command shack between the stacks
  K.box(-14, -60, 2.4, 2, 2.6, hullD);
  K.deco(new THREE.PlaneGeometry(2.4, 0.8), lamp, -14, 1.9, -57.98);
}
