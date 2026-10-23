// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Battle map: the Ice Front on Hoth, two allied trench lines in front of the shield generator, walkers coming in.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { fieldKit, coverSpots, strike } from './field.js';

/* THE ICE FRONT (140 across, half 70). A trench defence in a snowfield, built for squads holding a line:
     · the ALLIED BASE in the north (z +44…+66): the SHIELD GENERATOR (the thing being defended), an ion cannon and
       the hangar's blast wall;
     · TWO TRENCH LINES of packed-snow berms topped with sandbags, the rear one at z +32 and the forward one at z +10, staggered so
       the gaps never line up: an attack that breaks through one gap meets a berm, not a free run to the generator.
       Berms are 1.3 tall (vault them, fight over them);
     · NO-MAN'S LAND (z −8…−44): open snow with ice boulders, drifts you walk over, a wrecked snowspeeder and a downed
       walker (climb it: crate, stump, hull), and three craters where the walkers' cannons keep landing;
     · the IMPERIAL FORWARD LINE in the south (z −48…−66): metal barricades, a drop-ship pad, an overwatch gantry. */
const PLAN = {
  rear: [[-50, 32, 6, 1.3, 1], [-30, 32, 6, 1.3, 1], [-11, 32, 4, 1.3, 1], [11, 32, 4, 1.3, 1], [30, 32, 6, 1.3, 1], [50, 32, 6, 1.3, 1]],
  forward: [[-42, 10, 6, 1.3, 1], [-20, 10, 6, 1.3, 1], [0, 10, 5, 1.3, 1], [20, 10, 6, 1.3, 1], [42, 10, 6, 1.3, 1],
            [-62, 18, 4, 1.3, 0], [62, 18, 4, 1.3, 0]],   // the line's ends bend back toward the base
  imperial: [[-36, -50, 5, 1.5, 1], [-14, -50, 5, 1.5, 1], [14, -50, 5, 1.5, 1], [36, -50, 5, 1.5, 1]],
  rocks: [[-20, -8, 1.8, 2.4], [-38, -24, 2.2, 3.0], [6, -16, 1.6, 2.0], [-8, -32, 1.9, 2.6], [44, -10, 1.7, 2.2],
          [-54, -12, 2.0, 2.8], [54, -38, 2.2, 3.0], [-2, -42, 1.4, 1.8], [-50, -40, 1.6, 2.2], [36, -30, 1.4, 1.9],
          [-60, 44, 2.4, 3.4], [62, 50, 2.6, 3.6], [-30, 20, 1.4, 1.8], [32, 22, 1.4, 1.8]],
  drifts: [[-30, -14, 3, 2], [6, -28, 3.5, 2], [-46, -30, 2.5, 2], [28, -42, 3, 2.2], [-16, -44, 2.5, 1.8], [52, 0, 2.5, 2],
           [-8, 20, 2.5, 1.6], [12, 46, 3, 1.8], [-40, 50, 3, 1.8]],
  walker: [22, -20],     // the downed walker's hull centre (it lies along z, head to the north)
  speeder: [-12, -2],
  craters: [[-4, -4, 3.6], [32, 0, 3.6], [-30, -2, 3.6]],
};

export const ICEFRONT_SPOTS = {
  allyStart: [0, 44, Math.PI],                                     // behind the rear trench, facing the field
  enemyStart: [[0, -60], [-32, -58], [42, -58], [-58, -48], [58, -48]],
  fronts: [[0, 32], [0, 10], [-12, -6], [0, -24], [0, -50], [0, -60]],
  points: { generator: [0, 49], rearTrench: [0, 35], forwardTrench: [0, 13], walker: [17, -20], pad: [0, -60] },
  cover: coverSpots([...PLAN.rear, ...PLAN.forward], 1),
  enemyCover: coverSpots([...PLAN.imperial, ...PLAN.forward, ...PLAN.rear], -1),
  craters: PLAN.craters.map(([x, z]) => [x, z]),
};

export function buildIcefrontArena(L){
  const pal = L.pal || {};
  const snow   = new THREE.MeshStandardMaterial({ color: pal.snow ?? 0x9aa8ba });
  const snowD  = new THREE.MeshStandardMaterial({ color: pal.snowD ?? 0x76859a });   // packed berms, a shade under the floor so they read
  const bag    = new THREE.MeshStandardMaterial({ color: pal.bag ?? 0x8a7a5e });
  const ice    = new THREE.MeshStandardMaterial({ color: pal.ice ?? 0x7e96b0 });
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x5a6474 });
  const plank  = new THREE.MeshStandardMaterial({ color: pal.plank ?? 0x6a5a48 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x8a929c });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x4a525c });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a });
  const scorch = new THREE.MeshBasicMaterial({ color: pal.scorch ?? 0x3a4252, transparent: true, opacity: 0.7, depthWrite: false });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const shield = new THREE.MeshBasicMaterial({ color: pal.shield ?? 0x7ad8ff });
  const red    = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  const K = arenaKit(), R = seeded(83), F = fieldKit(K, R);

  // ---- the ALLIED BASE — shield generator, ion cannon, the hangar's blast wall ----
  K.column(0, 56, 3.2, 6.5, metalD, { wallKick: false, seg: 12, taper: 0.8 });
  K.box(0, 56, 4.4, 4.4, 1.2, metal);
  K.deco(new THREE.SphereGeometry(3.0, 14, 8, 0, Math.PI*2, 0, Math.PI/2), metal, 0, 6.5, 56);
  K.deco(new THREE.CylinderGeometry(0.35, 0.5, 4, 8), metalD, 0, 10.5, 56);
  K.deco(new THREE.SphereGeometry(0.7, 10, 8), shield, 0, 12.8, 56);
  for (let i = 0; i < 6; i++) K.deco(new THREE.BoxGeometry(0.3, 1.1, 0.12), shield, Math.cos(i*1.05)*3.25, 3.8, 56 + Math.sin(i*1.05)*3.25, 0, -i*1.05 + Math.PI/2, 0);
  // the ion cannon (west): a ball turret on a squat drum
  K.column(-32, 58, 2.6, 4, metalD, { wallKick: false, seg: 10, taper: 0.9 });
  K.deco(new THREE.SphereGeometry(3.4, 14, 10), metal, -32, 6.2, 58);
  K.deco(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), metalD, -32, 7.6, 54.6, Math.PI/2 - 0.5, 0, 0);
  // the hangar blast wall along the back, with a lit door slot and two supply stacks
  K.box(26, 64, 14, 1.2, 4.6, rock);
  K.deco(new THREE.PlaneGeometry(10, 2.6), lamp, 26, 1.4, 62.78, 0, Math.PI, 0);
  for (const [x, z, f] of [[14, 52, 1], [40, 54, -1]]) F.crates(x, z, plank, metalD, f);

  // ---- the TRENCH LINES — packed-snow berms topped with sandbags ----
  for (const w of [...PLAN.rear, ...PLAN.forward]) F.wall(w, { body: snowD, cap: bag }, { bags: true });
  // turret emplacements on the rear line
  for (const x of [-30, 30]){ K.deco(new THREE.BoxGeometry(1.4, 0.8, 1.2), metalD, x, 1.7, 32); K.deco(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), metalD, x, 1.9, 31, Math.PI/2, 0, 0); }

  // ---- NO-MAN'S LAND ----
  for (const [x, z, r, h] of PLAN.rocks) F.rock(x, z, r, h, rock, ice);
  for (const [x, z, hx, hz] of PLAN.drifts) F.drift(x, z, hx, hz, snow);
  // the wrecked snowspeeder: a low hull you vault, stubby wings and a gun pod
  { const [x, z] = PLAN.speeder;
    K.box(x, z, 1.4, 2.6, 1.2, metal);
    K.deco(new THREE.BoxGeometry(4.6, 0.22, 1.6), metal, x, 0.9, z + 0.6, 0, 0, 0.12);
    K.deco(new THREE.BoxGeometry(1.0, 0.5, 0.8), stripe, x, 1.35, z - 1.6);
    K.deco(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 6), metalD, x - 1.2, 0.5, z - 2.4, Math.PI/2, 0, 0); }
  F.walkerHulk(PLAN.walker[0], PLAN.walker[1], false, { hull: metal, dark: metalD, plate: metal, crate: imp, glow: red });
  PLAN.craters.forEach(([x, z, r], i) => {
    F.crater(x, z, r + 0.6, scorch);
    hazardZones.push(strike(x, z, r, 2 + i * 3.6, pal.blast ?? 0xff7a40, { period: 12 }));
  });

  // ---- the IMPERIAL FORWARD LINE ----
  for (const w of PLAN.imperial) F.wall(w, { body: imp, cap: stripe });
  K.box(0, -60, 8, 6, 0.24, metalD, { climbable: true });   // the drop-ship pad
  for (const sx of [-1, 1]) for (const dz of [-5, 0, 5]) K.deco(new THREE.SphereGeometry(0.18, 8, 6), red, sx*7.6, 0.36, -60 + dz);
  K.gantry(34, -62, { a: imp, b: metalD, strut: imp, beacon: pal.beacon ?? 0xff5040 }, [-1, 1]);
  for (const [x, z, f] of [[-22, -60, 1], [-44, -60, -1]]) F.crates(x, z, imp, metalD, f);
  for (const [x, z] of [[-24, -46], [24, -46], [-4, -52], [6, -52], [-14, 28], [14, 28]]) spawnBarrel(V3(x, 0, z));
}
