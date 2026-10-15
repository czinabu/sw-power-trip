// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Level 1 arena: the temple courtyard (Holy City of Jedha).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared, hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded, at } from './kit.js';

/* LEVEL 1 — the TEMPLE COURTYARD (half-size 21). The opener teaches the toolkit on a readable, symmetric plan:
     · a walkable ZIGGURAT in the centre: contested high ground with a summit brazier that ERUPTS on a slow, telegraphed
       cycle (the first hazard the player meets, and it only punishes camping the top);
     · a ring of eight grand COLUMNS (r 13): wall-kick surfaces and cover from blaster fire, spaced so even a brute
       walks between them;
     · two straight broken WALLS east and west and four L-shaped corner RUINS on the diagonals (all under the 1.93
       single-jump apex, so they can be vaulted): cover that faces outward, toward where the enemy pours in;
     · the OVERWATCH gantry in the south-east corner for the Mando (fly) and the Jedi (chained double-jumps);
     · three Imperial FUEL DRUMS beside the walls to teach Push / kick / shoot-to-detonate before the Forge;
     · low rubble you step over (climbable, never a snag).
   The player spawns north (0, +10.5), facing the dais; the north lane is kept clear. */
export function buildTempleArena(L){
  const pal = L.pal || {};   // the world theme's colours (data/worlds.js); the defaults are the original look
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x7c715a, roughness: 0.93, metalness: 0.05 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x564b39, roughness: 0.95, metalness: 0.04 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xb89a5a, roughness: 0.5, metalness: 0.55 });
  const fireC  = pal.brazier ?? 0xff8a2a;
  const K = arenaKit(), R = seeded(11);

  // ---- central ZIGGURAT — stepped and walkable (each step under STEP_UP), summit 1.5. The base is deliberately tight:
  // a foe blocked at the base can still reach a player on the summit, so the dais is contested, never a safe perch ----
  for (const t of [ {r:3.2, h:0.4}, {r:2.6, h:0.8}, {r:2.0, h:1.2}, {r:1.5, h:1.5} ]){
    K.box(0, 0, t.r, t.r, t.h, stone, { climbable: true });   // foes walk up the steps; avoidance ignores climbables
    K.deco(new THREE.BoxGeometry(t.r*2+0.05, 0.06, t.r*2+0.05), trim, 0, t.h, 0);   // a crisp gold lip on each step
  }
  // a gold inlay ring set into the floor around the dais — a focal anchor
  K.deco(new THREE.RingGeometry(3.7, 4.2, 40),
    new THREE.MeshBasicMaterial({ color: pal.inlay ?? 0x8a6e2e, transparent: true, opacity: 0.5, side: THREE.DoubleSide }), 0, 0.03, 0, -Math.PI/2);
  // ---- SUMMIT BRAZIER — the courtyard's glowing landmark; the flame is live (flickered in updateAmbient) ----
  K.deco(new THREE.CylinderGeometry(0.46, 0.3, 0.34, 12), stoneD, 0, 1.5 + 0.17, 0);
  shared.templeBrazier = K.deco(new THREE.ConeGeometry(0.38, 0.8, 10), new THREE.MeshBasicMaterial({ color: fireC }), 0, 1.5 + 0.66, 0);
  // the summit ERUPTS on a slow cycle (1.4s amber warning): it only punishes standing on top
  hazardZones.push({ kind:'point', cx:0, cz:0, r:2.3, period:8, warnDur:1.4, activeDur:1.0, dmg:24, color:fireC, flash:true, t:0 });

  // ---- GRAND COLUMNS — eight at r 13, offset so the north spawn lane and the cardinal lanes stay open ----
  for (let i = 0; i < 8; i++){
    const a = (i / 8) * Math.PI*2 + Math.PI/8, [x, z] = at(a, 13), h = 8.4 + R()*1.1, rad = 0.85;
    K.column(x, z, rad, h, stone, { taper: 0.84 });
    K.deco(new THREE.BoxGeometry(rad*2.4, 0.4, rad*2.4), stoneD, x, 0.2, z);            // plinth
    K.deco(new THREE.BoxGeometry(rad*2.7, 0.45, rad*2.7), stoneD, x, h - 0.22, z);       // capital
    if (i % 2 === 0){   // a hanging banner on every other column, on the courtyard side
      const ban = K.deco(new THREE.PlaneGeometry(1.0, 3.2),
        new THREE.MeshStandardMaterial({ color: pal.banner ?? 0x6e1f24, roughness: 0.9, side: THREE.DoubleSide }),
        x - Math.cos(a)*(rad+0.02), h - 2.4, z - Math.sin(a)*(rad+0.02), 0, -a + Math.PI/2, 0);
      ban.castShadow = false;
      const hem = K.deco(new THREE.PlaneGeometry(1.0, 0.28),
        new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xb89a5a, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }),
        ban.position.x, h - 4.0, ban.position.z, 0, ban.rotation.y, 0);
      hem.castShadow = false;
    }
  }

  // ---- BROKEN WALLS — east and west, along z (axis-aligned so collision matches the mesh), vaultable at 1.5 ----
  for (const sx of [-1, 1]){
    K.box(sx*8.5, 0, 0.3, 2.0, 1.5, stoneD);
    K.deco(new THREE.BoxGeometry(0.34, 0.3, 1.6), stone, sx*8.5, 1.6, -0.6 + R()*0.4, 0, 0.12*sx, 0);   // askew cap stone
  }
  // ---- CORNER RUINS — an L on each diagonal, corner outward, so the inside faces the dais and the outside faces the
  // edge where foes arrive. One arm is lower (1.2) to vault, one taller (1.65) to hide behind ----
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
    const cx = sx*7.5, cz = sz*7.5;
    K.box(cx - sx*1.3, cz, 1.3, 0.3, 1.65, stoneD);          // arm along x, toward the centre line
    K.box(cx, cz - sz*1.4, 0.3, 1.1, 1.2, stone);             // arm along z
    K.deco(new THREE.BoxGeometry(0.7, 0.3, 0.5), stone, cx - sx*0.5, 1.8, cz, 0, 0.3, 0);
  }

  // ---- OVERWATCH gantry — south-east, between two columns, clear of the cardinal lanes ----
  K.gantry(10, -12, { a: stoneD, b: stone, strut: trim, beacon: fireC });

  // ---- low RUBBLE you step over (toppled drums, all under STEP_UP) ----
  for (const [x, z, len, ax] of [[-4.5, 4.8, 1.6, true], [5.2, -5.0, 1.4, false], [-11.5, -6.5, 1.8, true], [12.0, 7.5, 1.5, false], [-2.5, -15.5, 1.7, true], [15.5, -2.5, 1.4, false]]){
    K.rubble(x, z, len, 0.3, stoneD, ax);
  }

  // ---- FUEL DRUMS — beside the walls and the south lane, where foes bunch up on their way in ----
  for (const [x, z] of [[10.2, -1.0], [-10.2, -1.0], [0, -10.2]]) spawnBarrel(V3(x, 0, z));
}
