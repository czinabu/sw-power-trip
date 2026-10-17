// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Training arena (Jedi): the open-air training hall on the temple terrace.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { arenaKit, seeded, at } from './kit.js';

/* THE TRAINING HALL (half-size 22). An open stone terrace laid out as stations, each one the surface a lesson needs
   (data/tutorial.js names the spots; game/tutorial.js walks the player through them):
     · the DUELLING CIRCLE in the centre: a low dais with a kyber-blue inlay, where the bladework and Force lessons run;
     · the VAULTING BLOCKS on the west lane: three low practice blocks across the lane (under vaultHeight, so a run
       and a jump goes up and over);
     · the WATCHTOWER on the south side: three stone tiers stepping west (2.4 / 4.9 / 7.4), each lip within a jump's
       reach, so it teaches the ledge catch and climb. Its north face is sheer, and the drop off the top (past the
       ~5.9 m where a landing buckles) teaches the roll;
     · the RUNNING WALL on the east lane: a long, tall face to wall-run along and kick off;
     · a ring of slender columns and kyber braziers for the read of a hall, too thin to run on.
   The player spawns north (0, +11), facing the circle. */
export const HALL_SPOTS = {
  circle: [0, 0],
  vault: { x: -12, z: [5, 0, -5] },       // block centres along the west lane
  vaultEnd: [-12, -8.5],                   // past the last block
  tower: [[-10.6, -16, 2.4, 2.0], [-14.2, -16, 4.9, 1.6], [-17.4, -16, 7.4, 1.6]],   // x, z, top, half-width (all 2.0 deep)
  towerDrop: [-17.4, -11],                 // the floor below the top's sheer north face
  wall: { x: 14, z: 0, hz: 6.5, h: 5 },
};

export function buildHallArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x9aa4ac, roughness: 0.9, metalness: 0.05 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x6e7882, roughness: 0.94, metalness: 0.04 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xd8c48a, roughness: 0.5, metalness: 0.55 });
  const kyber  = pal.kyber ?? 0x5ad2ff;
  const glow   = new THREE.MeshBasicMaterial({ color: kyber });
  const K = arenaKit(), R = seeded(31);

  // ---- the DUELLING CIRCLE — a low walkable dais (under STEP_UP) ringed in kyber light ----
  K.box(0, 0, 3.4, 3.4, 0.3, stoneD, { climbable: true });
  K.deco(new THREE.BoxGeometry(6.85, 0.05, 6.85), trim, 0, 0.3, 0);
  K.deco(new THREE.RingGeometry(4.6, 5.0, 48),
    new THREE.MeshBasicMaterial({ color: kyber, transparent: true, opacity: 0.45, side: THREE.DoubleSide }), 0, 0.03, 0, -Math.PI/2);
  K.deco(new THREE.RingGeometry(1.2, 1.35, 32),
    new THREE.MeshBasicMaterial({ color: kyber, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0.33, 0, -Math.PI/2);

  // ---- VAULTING BLOCKS — three low blocks across the west lane, spaced for a run between each ----
  for (const z of HALL_SPOTS.vault.z){
    K.box(HALL_SPOTS.vault.x, z, 1.8, 0.35, 1.05, stone);
    K.deco(new THREE.BoxGeometry(3.65, 0.05, 0.75), trim, HALL_SPOTS.vault.x, 1.05, z);
  }

  // ---- the WATCHTOWER — three tiers stepping up into the south-west corner ----
  HALL_SPOTS.tower.forEach(([x, z, h, s], i) => {
    K.box(x, z, s, 2.0, h, i % 2 ? stone : stoneD);
    K.deco(new THREE.BoxGeometry(s*2 + 0.06, 0.08, 4.06), trim, x, h, z);
  });
  { const [x, z, h] = HALL_SPOTS.tower[2];   // a kyber lantern on the summit: the climb's goal reads from the floor
    K.deco(new THREE.CylinderGeometry(0.16, 0.22, 1.2, 8), trim, x - 0.9, h + 0.6, z - 1.3);
    K.deco(new THREE.SphereGeometry(0.26, 10, 8), glow, x - 0.9, h + 1.35, z - 1.3); }

  // ---- the RUNNING WALL — a long tall face on the east lane, carved with a frieze line ----
  { const W = HALL_SPOTS.wall;
    K.box(W.x, W.z, 0.6, W.hz, W.h, stoneD);
    for (const y of [1.6, 3.4]) K.deco(new THREE.BoxGeometry(0.08, 0.14, W.hz*2), trim, W.x - 0.62, y, W.z);
    K.deco(new THREE.BoxGeometry(1.4, 0.3, W.hz*2 + 0.4), stone, W.x, W.h + 0.15, W.z); }

  // ---- COLUMNS and BRAZIERS — the hall's ring, slender (not runnable) and clear of every station ----
  for (let i = 0; i < 10; i++){
    const a = (i / 10) * Math.PI*2 + Math.PI/10, [x, z] = at(a, 18.5);
    if (z < -12 && x < -5) continue;                                                           // the tower's side
    if (Math.abs(x - HALL_SPOTS.wall.x) < 5 && Math.abs(z) < 9) continue;                      // behind the wall
    const h = 8 + R()*1.5;
    K.column(x, z, 0.65, h, stone, { taper: 0.9 });
    K.deco(new THREE.BoxGeometry(1.8, 0.35, 1.8), stoneD, x, 0.17, z);
    K.deco(new THREE.BoxGeometry(2.0, 0.4, 2.0), stoneD, x, h - 0.2, z);
  }
  for (const [x, z] of [[-6.5, 9], [6.5, 9], [-6.5, -9], [6.5, -9]]){
    K.column(x, z, 0.4, 1.1, stoneD, { wallKick: false, seg: 8 });
    K.deco(new THREE.CylinderGeometry(0.55, 0.35, 0.25, 10), trim, x, 1.2, z);
    K.deco(new THREE.SphereGeometry(0.32, 10, 8), glow, x, 1.5, z);
  }
  shared.templeBrazier = null;
}
