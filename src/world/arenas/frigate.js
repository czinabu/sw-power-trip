// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the HALCYON, a dead Republic medical frigate adrift in the Vorran system (the ARC trooper's
// WHAT THE CHIP SAYS and BROTHERS IN ARMS, data/missions.js chipfiles and drill). The ship that fitted the clones'
// chips kept the records; its power is out and its decks are open to whoever docks.

import * as THREE from 'three';
import { solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';

/* THE MEDICAL DECK (56 across, half 28), in emergency light.
     · the HANGAR in the south (z −28…−9): the band's shuttle docked on the west side, cargo, a lift platform; the hero
       comes off the shuttle's ramp facing north;
     · a BULKHEAD across the deck at z −9 (4 m), open in the middle (x −6…6) and at both ends (|x| > 22);
     · the MEDICAL BAY beyond: two rows of BACTA TANKS (x ±15), low surgical COTS in the aisles (steps, 0.7), and the
       RECORDS CORE in the middle (z 10), a ring of consoles round the data column that held every chip's file;
     · two power BREAKERS on the side walls (x ±24, z 4) that bring the core back up;
     · the north end: the sealed med-bay doors (a picture on the far wall), a raised OBSERVATION GALLERY (1.2, a step up)
       across the back.
   Every lane between solids is at least 3 m. */
export const FRIGATE_SPOTS = {
  start: [-10, -21, 0],                 // at the foot of the shuttle's ramp, facing the bay
  core: [0, 10],                        // the records core
  breakers: [[-23.5, 4], [23.5, 4]],
  hangar: [10, -18], aisle: [15, 8], gallery: [0, 21],   // the drill's posts (BROTHERS IN ARMS)
};

export function buildFrigateArena(L){
  const pal = L.pal || {};
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0xb8bcc0, roughness: 0.6, metalness: 0.3 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x6a7078, roughness: 0.6, metalness: 0.4 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x8a9098, roughness: 0.5, metalness: 0.5 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x3a4048, roughness: 0.6, metalness: 0.45 });
  const red    = new THREE.MeshStandardMaterial({ color: pal.redPaint ?? 0x8a2a24, roughness: 0.6, metalness: 0.3 });   // the Republic's medical red
  const glass  = new THREE.MeshStandardMaterial({ color: pal.glass ?? 0x7ad8c8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.45 });
  const bacta  = new THREE.MeshBasicMaterial({ color: pal.bacta ?? 0x3ac8a8, transparent: true, opacity: 0.55 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x5a5a52, roughness: 0.85 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xff6a4a });   // emergency light
  const screen = new THREE.MeshBasicMaterial({ color: pal.screen ?? 0x6ac8ff });
  const K = arenaKit(), R = seeded(57);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the BULKHEAD across the deck, open in the middle and at both ends ----
  for (const [x0, x1] of [[-22, -6], [6, 22]]){
    K.box((x0 + x1) / 2, -9, (x1 - x0) / 2, 0.5, 4, wallD);
    picture(K.deco(new THREE.BoxGeometry(x1 - x0, 0.3, 1.02), red, (x0 + x1) / 2, 2.2, -9));
    for (const x of [x0 + 2, x1 - 2]) picture(K.deco(new THREE.BoxGeometry(0.5, 0.2, 1.04), lamp, x, 3.5, -9));
  }
  for (const sx of [-1, 1]) K.column(sx * 6.6, -9, 0.7, 4.6, metalD, { seg: 8, taper: 1 });   // the frame of the open middle
  picture(K.deco(new THREE.BoxGeometry(14, 0.6, 1.2), metalD, 0, 4.6, -9));

  // ---- the HANGAR: the band's shuttle, cargo and the lift ----
  { const sx = -16, sz = -19;   // the shuttle: a squat hull nose-in, its ramp down toward the deck
    K.box(sx, sz, 4, 3, 3.0, metal);
    K.deco(new THREE.BoxGeometry(8.2, 0.4, 6.2), metalD, sx, 3.2, sz); solids[solids.length - 1].h = 3.4;
    for (const s of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(2.6, 0.25, 5), metalD, sx + s * 5.2, 2.0, sz, 0, 0, s * -0.4));   // folded wings
    K.box(sx + 4.9, sz - 1.5, 0.9, 1.0, 0.5, metalD, { climbable: true });   // the ramp's foot
    picture(K.deco(new THREE.PlaneGeometry(2.2, 0.8), screen, sx + 4.02, 2.2, sz, 0, Math.PI / 2, 0)); }
  for (const [x, z, f] of [[20, -22, -1], [4, -25, 1], [24, -14, -1]]) { K.box(x, z, 0.9, 0.9, 2.2, crate); K.box(x + 1.7 * f, z + 0.2, 0.8, 0.8, 1.1, crate); }
  K.box(10, -14, 2.4, 2.4, 0.5, metalD, { climbable: true });   // the cargo lift, stopped half up
  for (const [x, z] of [[-3, -16], [16, -25]]) spawnBarrel(V3(x, 0, z));

  // ---- the MEDICAL BAY: bacta tank rows, cots, the records core ----
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++){
    const x = sx * 15, z = -2 + i * 6.5;
    K.column(x, z, 1.0, 3.2, glass, { seg: 12, taper: 1 });
    picture(K.deco(new THREE.CylinderGeometry(0.85, 0.85, 2.4 - (i % 2) * 0.9, 12), bacta, x, 1.6 - (i % 2) * 0.45, z));   // two drained, two still full
    K.deco(new THREE.CylinderGeometry(1.15, 1.15, 0.4, 12), metalD, x, 0.2, z);
    K.deco(new THREE.CylinderGeometry(1.15, 1.15, 0.45, 12), metalD, x, 3.4, z);
  }
  for (const sx of [-1, 1]) for (const z of [0, 7, 16]) K.box(sx * 8, z, 1.0, 1.9, 0.7, wall, { climbable: true });   // cots
  { const [cx, cz] = FRIGATE_SPOTS.core;   // the core: a data column in a ring of console desks
    K.column(cx, cz, 1.0, 6, metalD, { seg: 10, taper: 1 });
    for (let k = 0; k < 6; k++) picture(K.deco(new THREE.BoxGeometry(0.15, 3.6, 0.15), screen, cx + Math.cos(k) * 1.02, 3.6, cz + Math.sin(k) * 1.02));
    for (const [dx, dz, ry] of [[0, -3, 0], [2.6, 1.6, -2.1], [-2.6, 1.6, 2.1]]){
      K.box(cx + dx, cz + dz, dz ? 0.5 : 1.3, dz ? 1.3 : 0.5, 1.5, wallD);
      picture(K.deco(new THREE.PlaneGeometry(1.0, 0.45), screen, cx + dx * 0.85, 1.7, cz + dz * 0.85, -0.6, ry, 0));
    }
  }
  // the breakers: tall panels on the side walls, a striped box under each
  for (const [x, z] of FRIGATE_SPOTS.breakers){
    const s = Math.sign(x);
    K.box(x + s * 1.6, z, 0.6, 1.4, 3.2, metalD);
    picture(K.deco(new THREE.PlaneGeometry(1.6, 0.9), lamp, x + s * 0.98, 2.2, z, 0, -s * Math.PI / 2, 0));
  }
  // the OBSERVATION GALLERY across the back: a step up, a rail, and the sealed doors behind
  K.box(0, 25.5, 14, 2.5, 1.2, wall, { climbable: true });
  picture(K.deco(new THREE.BoxGeometry(28, 0.08, 0.08), metalD, 0, 2.3, 23.1));
  for (const x of [-12, -6, 0, 6, 12]) picture(K.deco(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), metalD, x, 1.75, 23.1));
  // the deck's side walls and the far wall, past the edge (pictures beyond the play space)
  for (const sx of [-1, 1]){
    picture(K.deco(new THREE.BoxGeometry(1, 8, 60), wall, sx * 28.6, 4, 0));
    for (let z = -24; z <= 24; z += 8) picture(K.deco(new THREE.BoxGeometry(0.2, 0.3, 2.4), lamp, sx * 28, 6.4, z));
  }
  picture(K.deco(new THREE.BoxGeometry(60, 8, 1), wall, 0, 4, 28.6));
  picture(K.deco(new THREE.BoxGeometry(8, 6, 0.2), red, 0, 3, 28));
  // ribs overhead (out of reach) and a scatter of dropped trays and gurneys
  for (let z = -24; z <= 24; z += 8) picture(K.deco(new THREE.BoxGeometry(56, 0.6, 0.8), metalD, 0, 9, z));
  for (let i = 0; i < 10; i++) picture(K.deco(new THREE.BoxGeometry(0.6, 0.05, 0.4), metal, (R() - 0.5) * 40, 0.03, (R() - 0.5) * 40, 0, R() * 3, 0));
}
