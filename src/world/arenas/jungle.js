// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the jungle firebase on the night of the order (the ARC trooper's prologue, data/missions.js
// order66). Built like the refuge: a PLAN-free authored layout, its spots exported for the mission to read.

import * as THREE from 'three';
import { solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';
import { fieldKit } from './field.js';

/* THE JUNGLE FIREBASE (76 across, half 38), at night. The company's camp under giant trees, laid out for the prologue:
     · the FIREBASE in the south (z −18…−34): prefab huts, a sandbag line at z −18 with the middle open, and the
       company's two COMMS RELAYS (west and east), each with a console to slice so they can't call the gunships;
     · the RUIN west of centre: an old stone platform with broken walls and columns, where the General fell back
       when the company turned. The hero starts in its courtyard, facing the firebase;
     · the JUNGLE between: giant trunks (wall-kick columns with a root skirt you step onto), fallen logs to vault,
       mossy boulders, ferns and glowing fungus. The General's walk winds north from the ruin through it;
     · the LANDING ZONE in the north (z +22…+34): a cleared pad with landing lamps, where the ship comes down.
   Every lane between solids is at least 3 m, so the General and a brute both get through. */
export const JUNGLE_SPOTS = {
  start: [-11, 2, Math.PI],                       // the ruin's courtyard, facing south at the firebase
  relays: [[-22, -25], [21, -26]],                // the comms relays' consoles
  walk: [[-14, 6], [-14, 14], [-6, 19], [2, 22], [6, 25]],   // the General's way out: ruin → jungle → the pad's edge
  lz: [8, 28],
  duel: [4, 12],
};

const TREES = [   // [x, z, trunk radius, height]
  [-28, -8, 2.2, 20], [-30, 14, 2.6, 22], [-24, 26, 1.8, 18], [-3, 8, 1.6, 17], [3, -9, 2.4, 21], [15, 4, 2.0, 19],
  [25, -10, 2.2, 20], [28, 13, 2.6, 23], [21, 21, 1.7, 17], [-8, 31, 2.0, 19], [30, 31, 2.2, 21], [-33, -29, 2.0, 19],
  [33, -31, 2.2, 20], [-3, -23, 1.4, 15], [-33, 0, 1.8, 18], [34, 0, 1.9, 19],
];
const LOGS = [[11, -4, 4.5, 1], [-28, 5, 3.5, 0], [22, 6, 3.5, 0], [12, 15, 3.5, 1], [-17, -11, 4, 1], [-22, 18, 3, 1]];   // [x, z, half-length, alongX]
const ROCKS = [[-8, -10, 1.4, 1.6], [17, -3, 1.3, 1.5], [27, 1, 1.5, 1.8], [-30, 21, 1.4, 1.7], [19, 33, 1.3, 1.5], [-31, -17, 1.5, 1.8], [10, 6, 1.1, 1.3]];

export function buildJungleArena(L){
  const pal = L.pal || {};
  const bark   = new THREE.MeshStandardMaterial({ color: pal.bark ?? 0x4a3a2c, roughness: 0.95 });
  const barkD  = new THREE.MeshStandardMaterial({ color: pal.barkD ?? 0x30261c, roughness: 0.95 });
  const leaf   = new THREE.MeshStandardMaterial({ color: pal.leaf ?? 0x1e4a2a, roughness: 0.9 });
  const leafD  = new THREE.MeshStandardMaterial({ color: pal.leafD ?? 0x163a20, roughness: 0.9 });
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x5a6a5a, roughness: 0.93 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x3e4a3e, roughness: 0.95 });
  const moss   = new THREE.MeshStandardMaterial({ color: pal.moss ?? 0x3a6a32, roughness: 0.95 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5a6252, roughness: 0.6, metalness: 0.5 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x3a4036, roughness: 0.6, metalness: 0.5 });
  const bag    = new THREE.MeshStandardMaterial({ color: pal.bag ?? 0x6a6448, roughness: 0.95 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x5a5038, roughness: 0.85 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xb08a2a, roughness: 0.6, metalness: 0.3 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const fungus = new THREE.MeshBasicMaterial({ color: pal.fungus ?? 0x5affd0 });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const K = arenaKit(), R = seeded(66), F = fieldKit(K, R);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };   // only a picture (ferns, canopy)

  // ---- the JUNGLE: giant trunks with a root skirt, a canopy far overhead, buttress roots ----
  for (const [x, z, r, h] of TREES){
    K.column(x, z, r, h, bark, { taper: 0.7, seg: 9 });
    solids.push({ x, z, r: r * 1.45, h: 0.45, climbable: true });   // the root skirt: a step up to the trunk
    K.deco(new THREE.CylinderGeometry(r * 1.2, r * 1.6, 0.45, 9), barkD, x, 0.22, z, 0, R() * 3, 0);
    for (let i = 0; i < 4; i++){   // buttress roots flaring out (inside the skirt's footprint, no higher than a step over it)
      const a = i / 4 * Math.PI * 2 + R();
      K.deco(new THREE.BoxGeometry(0.35, 0.8, r * 0.9), barkD, x + Math.sin(a) * r * 0.9, 0.4, z + Math.cos(a) * r * 0.9, 0, a, 0);   // (low: the skirt's step holds you over it)
    }
    // the canopy: flat layered crowns high above the fight (pictures: nothing up there to land on)
    for (let k = 0; k < 3; k++){
      const cr = r * (3.2 - k * 0.7), cy = h - 1 + k * 1.6;
      picture(K.deco(new THREE.CylinderGeometry(cr * 0.8, cr, 1.4, 9), k % 2 ? leafD : leaf, x + (R() - 0.5) * 2, cy, z + (R() - 0.5) * 2, 0, R() * 3, 0));
    }
    // hanging vines
    for (let i = 0; i < 3; i++){
      const vx = x + (R() - 0.5) * r * 5, vz = z + (R() - 0.5) * r * 5, len = 4 + R() * 6;
      picture(K.deco(new THREE.CylinderGeometry(0.05, 0.05, len, 4), leafD, vx, h - 1 - len / 2, vz));
    }
  }
  for (const [x, z, hl, ax] of LOGS){
    K.rubble(x, z, hl * 2, 0.4, barkD, ax);
    picture(K.deco(new THREE.BoxGeometry(ax ? hl * 1.6 : 0.5, 0.08, ax ? 0.5 : hl * 1.6), moss, x, 0.72, z));   // moss along its back
  }
  for (const [x, z, r, h] of ROCKS) F.rock(x, z, r, h, stoneD, moss);
  // ferns and glowing fungus scattered over the floor, kept off the lanes the fight runs along
  for (let i = 0; i < 70; i++){
    const x = (R() - 0.5) * 70, z = (R() - 0.5) * 70;
    if (Math.abs(z - 28) < 7 && Math.abs(x - 8) < 9) continue;   // not on the pad
    const s = 0.5 + R() * 0.7;
    picture(K.deco(new THREE.ConeGeometry(0.7 * s, 0.9 * s, 5, 1, true), R() < 0.5 ? leaf : leafD, x, 0.4 * s, z, Math.PI, R() * 3, 0));
    if (R() < 0.35) picture(K.deco(new THREE.SphereGeometry(0.12, 6, 4), fungus, x + 0.5, 0.1, z + 0.3));
  }

  // ---- the RUIN: a stone platform (a low step), broken walls round it, the General's last stand ----
  K.box(-14, 2, 6, 5, 0.4, stone, { climbable: true });
  F.wall([-20.5, 2, 4, 2.4, 0], { body: stone, cap: stoneD }, { jag: true });
  F.wall([-18, 7.6, 2.2, 2.0, 1], { body: stone, cap: stoneD }, { jag: true });   // the north wall, open on the east for the walk
  F.wall([-14, -3.6, 3, 1.5, 1], { body: stone, cap: moss }, { jag: true });
  for (const [x, z, h] of [[-19, -2.6, 4.6], [-8.6, -2.6, 3.0], [-19, 6.6, 3.6], [-8.6, 6.6, 5.2]]){
    K.column(x, z, 0.6, h, stone, { taper: 0.95, seg: 8 });
    K.deco(new THREE.BoxGeometry(1.5, 0.35, 1.5), stoneD, x, h + 0.17, z);
    solids.push({ x, z, hx: 0.75, hz: 0.75, h: h + 0.35, box: true });   // the capital you stand on
  }
  picture(K.deco(new THREE.CircleGeometry(2.4, 18), moss, -14, 0.42, 2, -Math.PI / 2));   // an old mosaic, grown over

  // ---- the FIREBASE: prefab huts, the sandbag line, crates and the camp's lamps ----
  for (const w of [[-26, -18, 4, 1.1, 1], [-12, -18, 3.5, 1.1, 1], [12, -18, 3.5, 1.1, 1], [26, -18, 4, 1.1, 1]]) F.wall(w, { body: bag, cap: bag }, { bags: true });
  for (const [x, z, hx, hz] of [[-11, -30, 3.2, 2.2], [10, -31, 3.2, 2.2], [-1, -33.5, 2.6, 1.8]]){
    K.box(x, z, hx, hz, 2.8, metal);
    K.deco(new THREE.BoxGeometry(hx * 2 + 0.3, 0.25, hz * 2 + 0.3), metalD, x, 2.92, z);
    solids[solids.length - 1].h = 3.05;
    K.deco(new THREE.BoxGeometry(hx * 2 + 0.02, 0.2, 0.06), stripe, x, 2.2, z + hz + 0.01);   // the company's stripe
    K.deco(new THREE.PlaneGeometry(1.0, 0.5), lamp, x, 2.35, z + hz + 0.03);
  }
  for (const [x, z, f] of [[27, -33, -1], [-30, -22, 1], [5, -25, -1]]) F.crates(x, z, crate, metalD, f);
  for (const [x, z] of [[-7, -21], [7, -21], [-17, -26], [16, -24]]){   // camp lamps on posts
    K.column(x, z, 0.12, 2.4, metalD, { wallKick: false, seg: 6, taper: 1 });
    K.deco(new THREE.SphereGeometry(0.2, 8, 6), lamp, x, 2.55, z);
  }
  // the COMMS RELAYS: lattice masts with a red beacon, set just behind each console
  for (const [x, z] of JUNGLE_SPOTS.relays){
    const mz = z - 2.6;
    K.box(x, mz, 1.1, 1.1, 0.6, metalD);
    K.column(x, mz, 0.45, 11, metalD, { wallKick: false, seg: 4, taper: 0.4 });
    for (const y of [3.5, 6, 8.5]) K.deco(new THREE.BoxGeometry(2.4, 0.12, 0.12), metalD, x, y, mz);
    K.deco(new THREE.SphereGeometry(0.22, 8, 6), red, x, 11.6, mz);
    K.box(x, z - 0.9, 0.5, 0.3, 1.1, metal);   // the console
    K.deco(new THREE.PlaneGeometry(0.7, 0.35), fungus, x, 0.95, z - 0.58, -0.5, 0, 0);
  }
  for (const [x, z] of [[-4, -27], [14, -27], [-24, -14]]) spawnBarrel(V3(x, 0, z));

  // ---- the LANDING ZONE: a cleared pad with landing lamps, a few crates at its edge ----
  { const [px, pz] = JUNGLE_SPOTS.lz;
    K.box(px, pz, 6, 5, 0.22, metal, { climbable: true });
    for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.3, 0.04, 9.6), stripe, px + sx * 5.7, 0.23, pz);
    for (const sx of [-1, 1]) for (const dz of [-4.4, 0, 4.4]) K.deco(new THREE.SphereGeometry(0.16, 8, 6), lamp, px + sx * 5.5, 0.32, pz + dz);
    F.crates(px + 9, pz + 2, crate, metalD, -1); }
}
