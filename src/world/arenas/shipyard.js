// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: the Vorran shipyard in the rain, where the ARC trooper's band hid as dock hands (the trooper's story,
// chapter DOCK SHIFT: a wave chapter staged here, data/campaign-trooper.js).

import * as THREE from 'three';
import { solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';

/* THE YARD (64 across, half 32), at dusk in the rain.
     · a FREIGHTER in its cradle in the middle (hull 3.4 along x: hard cover with a roof, a stack of crates to climb it
       from the south), its nose to the east;
     · the big CRANE straddling it: two legs (wall-kick columns) and a beam far overhead;
     · CARGO CONTAINERS in rows and stacks round the edges (2.6: hard cover), with short ones (1.6) out in the
       open lanes, and fuel TANKS in the south-east;
     · a loading GANTRY in the north-west (the overwatch climb), lamps on posts, painted lanes on the deck.
   The hero starts in the south (z −22), facing the freighter. Every lane between solids is at least 3 m. */
export const SHIPYARD_SPOTS = { start: [0, -22, 0] };

const CONTAINERS = [   // [x, z, alongX, stacked]
  [-22, -9, 1, 1], [-15, -18, 0, 0], [16, -19, 1, 1], [25, 3, 0, 1], [-26, 8, 0, 0], [21, 22, 1, 0], [-8, 25, 1, 1], [5, 26, 1, 0],
];
const LOW = [[9, -8, 1], [-9, -7, 1], [-17, 1, 0], [15, 12, 0]];   // short containers (1.6: still stops a bolt): [x, z, alongX]
const COLORS = [0x8a4a2a, 0x2a5a7a, 0x6a6a3a, 0x7a2a2a, 0x3a6a4a];

export function buildShipyardArena(L){
  const pal = L.pal || {};
  const hull   = new THREE.MeshStandardMaterial({ color: pal.hull ?? 0x8a8c8e, roughness: 0.55, metalness: 0.45 });
  const hullD  = new THREE.MeshStandardMaterial({ color: pal.hullD ?? 0x4a4e54, roughness: 0.6, metalness: 0.45 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x6a7078, roughness: 0.6, metalness: 0.5 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x33383e, roughness: 0.65, metalness: 0.45 });
  const yellow = new THREE.MeshStandardMaterial({ color: pal.yellow ?? 0xd0a030, roughness: 0.6, metalness: 0.3 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x5a5040, roughness: 0.85 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffd890 });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const glow   = new THREE.MeshBasicMaterial({ color: pal.glow ?? 0x6ac8ff });
  const box = COLORS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.25 }));
  const K = arenaKit(), R = seeded(31);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the FREIGHTER in its cradle: a long hull, a raised bridge at the back, its nose cone to the east ----
  K.box(0, 6, 8, 3.2, 3.4, hull);
  K.deco(new THREE.BoxGeometry(16.2, 0.3, 6.6), hullD, 0, 3.55, 6); solids[solids.length - 1].h = 3.7;
  K.box(-5, 6, 2.2, 2.2, 5.2, hullD);                                          // the bridge
  picture(K.deco(new THREE.BoxGeometry(0.06, 0.6, 3.2), glow, -2.76, 4.4, 6));  // its viewport
  picture(K.deco(new THREE.ConeGeometry(3.2, 4, 10), hull, 10, 1.9, 6, 0, 0, -Math.PI / 2));   // the nose (over the cradle's end: a picture)
  K.box(9.3, 6, 1.2, 2.4, 2.4, hullD);                                         // the nose's solid root
  for (const x of [-6, 0, 6]) K.deco(new THREE.BoxGeometry(0.6, 1.0, 6.3), yellow, x, 0.5, 6);   // the cradle's arms under the hull
  K.box(-1, 1.9, 0.9, 0.9, 1.2, crate, { climbable: false }); K.box(1, 1.6, 0.8, 0.7, 2.3, crate);   // crates to climb the hull from the south
  for (const x of [-7, -3, 3, 7]) picture(K.deco(new THREE.BoxGeometry(1.2, 0.3, 0.06), red, x, 3.0, 2.78));

  // ---- the CRANE: two legs and a beam overhead, a hanging hook block ----
  for (const sx of [-1, 1]){
    K.column(sx * 13, 6, 0.9, 16, yellow, { seg: 8, taper: 1 });
    K.box(sx * 13, 6, 1.1, 1.1, 0.6, metalD, { climbable: true });   // its foot: a step
  }
  picture(K.deco(new THREE.BoxGeometry(28, 1.2, 1.6), yellow, 0, 16.4, 6));
  picture(K.deco(new THREE.BoxGeometry(1.4, 1.0, 1.4), metalD, 3, 13.5, 6));
  picture(K.deco(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 4), metalD, 3, 15, 6));

  // ---- CONTAINERS: stacks round the edges, half-height ones in the lanes ----
  for (const [x, z, ax, stacked] of CONTAINERS){
    const hx = ax ? 3 : 1.25, hz = ax ? 1.25 : 3, mat = box[Math.floor(R() * box.length)];
    K.box(x, z, hx, hz, 2.6, mat);
    for (const k of [-0.6, 0, 0.6]) picture(K.deco(new THREE.BoxGeometry(ax ? 0.08 : hx * 2 + 0.04, 2.2, ax ? hz * 2 + 0.04 : 0.08), metalD, x + (ax ? k * hx : 0), 1.3, z + (ax ? 0 : k * hz)));
    if (stacked){ K.box(x + (ax ? 0.3 : 0), z + (ax ? 0 : 0.3), hx, hz, 2.6, box[Math.floor(R() * box.length)], { y: 2.6 }); }
  }
  for (const [x, z, ax] of LOW) K.box(x, z, ax ? 2.6 : 1.2, ax ? 1.2 : 2.6, 1.6, box[Math.floor(R() * box.length)]);

  // ---- the fuel TANKS (south-east) and the loading GANTRY (north-west) ----
  for (const [x, z, r] of [[23, -12, 2.2], [27, -6, 1.8]]){
    K.column(x, z, r, 5, metal, { seg: 12, taper: 1 });
    K.deco(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), metal, x, 5, z);
    solids[solids.length - 1].h = 5 + r * 0.85;   // (the dome is part of its top)
    picture(K.deco(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.3, 12, 1, true), yellow, x, 3.2, z));
  }
  K.gantry(-24, 18, { a: metal, b: metalD, strut: metalD, beacon: 0xffb040 }, [1, -1]);

  // ---- lamps on posts, painted lanes, drums and puddles ----
  for (const [x, z] of [[-10, -14], [10, -14], [-20, 15], [20, 14], [0, 20], [-28, -20], [28, 18]]){
    K.column(x, z, 0.14, 4.2, metalD, { wallKick: false, seg: 6, taper: 1 });
    K.deco(new THREE.SphereGeometry(0.24, 8, 6), lamp, x, 4.35, z);
  }
  for (const x of [-4.6, 4.6]) picture(K.deco(new THREE.PlaneGeometry(0.3, 44), yellow, x, 0.02, -2, -Math.PI / 2));
  for (const [x, z] of [[-5, -12], [6, 16], [19, -2], [-20, 22]]) spawnBarrel(V3(x, 0, z));
  const wet = new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 14; i++){
    const r = 0.8 + R() * 1.8;
    picture(K.deco(new THREE.CircleGeometry(r, 14), wet, (R() - 0.5) * 56, 0.015, (R() - 0.5) * 56, -Math.PI / 2)).receiveShadow = false;
  }
}
