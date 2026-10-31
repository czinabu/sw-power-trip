// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: the Sith amphitheatre on Exegol, Vexis's throne at the north end (chapter THRONE OF EXEGOL).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* THE SITH AMPHITHEATRE (half-size 32). A sunken duelling floor in the Citadel, open to the storm, ringed with tiered
   stands where the cult watches. The last waves are fought on the floor and Vexis steps down off his throne for the end:
     · the THRONE DAIS against the north wall: three walkable rises, the throne behind them between two hooded colossi.
       The boss comes down off it (it spawns at z −26, just in front);
     · the STANDS just past the edge: dark stone tiers rising on three sides, robed figures on them, violet braziers;
     · two rows of GREAT PILLARS (x ±14) down the floor: wall-kick faces, cover from his lightning;
     · LOW WALLS on the diagonals (1.3, vault them) and toppled drums you step over;
     · a stepped OBELISK in the south-west (the overwatch climb);
     · three LIGHTNING RODS: the storm grounds itself through them on a slow, telegraphed cycle.
   The player comes in from the south (z +16), facing the throne. */
export const SITH = { half: 32, wallH: 9, dais: { z: -29.5 } };

export function buildSithArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x5a5262, roughness: 0.9 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x3a3442, roughness: 0.95 });
  const dark   = new THREE.MeshStandardMaterial({ color: pal.dark ?? 0x1a1620, roughness: 0.8, metalness: 0.2 });
  const robe   = new THREE.MeshStandardMaterial({ color: pal.robe ?? 0x141018, roughness: 1 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x4a4652, roughness: 0.5, metalness: 0.6 });
  const glowC  = pal.voidGlow ?? 0x9a3bff;
  const glow   = new THREE.MeshBasicMaterial({ color: glowC });
  const inlay  = new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const K = arenaKit(), R = seeded(66);
  const H = SITH.half, W = SITH.wallH, off = H + 1.0;

  // ---- the STANDS: tiers rising on every side but the throne's ----
  for (const side of ['n', 's', 'e', 'w']){
    const ns = side === 'n' || side === 's', sz = side === 'n' || side === 'w' ? -1 : 1;
    const put = (geo, mat, a, y, d) => ns ? K.deco(geo, mat, a, y, sz*d) : K.deco(geo, mat, sz*d, y, a, 0, Math.PI/2, 0);
    for (let k = 0; k < 6; k++){
      const len = (H + k*1.6)*2 + 2, h = 1.2 + k*1.3, d = off + k*1.6;
      if (side === 'n'){   // the throne's wall takes the middle of the north side
        for (const sa of [-1, 1]) put(new THREE.BoxGeometry(len/2 - 10, h, 1.6), k % 2 ? stoneD : stone, sa*(len/4 + 5), h/2, d);
      } else put(new THREE.BoxGeometry(len, h, 1.6), k % 2 ? stoneD : stone, 0, h/2, d);
      // the cult, standing on the tiers
      for (let a = -H + 2; a < H - 2; a += 3.4 + R()*2.4){
        if (R() < 0.45 || (side === 'n' && Math.abs(a) < 11)) continue;
        put(new THREE.ConeGeometry(0.42, 1.9, 7), robe, a, h + 0.95, d);
        put(new THREE.SphereGeometry(0.2, 7, 6), robe, a, h + 1.95, d);
      }
    }
    // violet braziers along the front of the stands
    for (let a = -H + 6; a <= H - 6 + 0.01; a += 13){
      if (side === 'n' && Math.abs(a) < 11) continue;
      put(new THREE.CylinderGeometry(0.5, 0.35, 1.2, 8), dark, a, 0.6 + 1.2, off);
      put(new THREE.ConeGeometry(0.35, 0.9, 8), glow, a, 2.85, off).userData.noBake = true;
    }
  }
  // the corners of the stands, filled
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.deco(new THREE.BoxGeometry(10, 6, 10), stoneD, sx*(off + 4), 3, sz*(off + 4));

  // ---- the THRONE: a wall, two hooded colossi, the seat, and the dais in front ----
  K.deco(new THREE.BoxGeometry(22, W + 6, 2), dark, 0, (W + 6)/2, -(off + 2));
  K.deco(new THREE.BoxGeometry(0.4, W + 4, 0.1), glow, 0, (W + 4)/2, -(off + 0.95)).userData.noBake = true;
  for (const sx of [-1, 1]){
    const x = sx*8.5, z = -(off + 1.5);
    K.deco(new THREE.CylinderGeometry(0.9, 2.6, 15, 8), robe, x, 7.5, z);
    K.deco(new THREE.ConeGeometry(1.5, 3.2, 8), robe, x, 16.4, z);
    K.deco(new THREE.BoxGeometry(2.8, 1.2, 2.8), stoneD, x, 0.6, z);
  }
  K.deco(new THREE.BoxGeometry(3.2, 6, 1.2), dark, 0, 1.2 + 3, -(off - 0.2));          // the throne's back
  K.box(0, -(H - 0.9), 1.4, 0.9, 1.2 + 1.0, dark);                                     // its seat (on the top rise)
  for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.3, 1.5, 1.6), metal, sx*1.55, 2.6, -(H - 0.9));
  for (const [hx, hz, h, z] of [[7, 2.6, 0.4, -(H - 2.6)], [5.4, 2.0, 0.8, -(H - 2.0)], [3.6, 1.4, 1.2, -(H - 1.4)]]){
    K.box(0, z, hx, hz, h, stone, { climbable: true });
    K.deco(new THREE.BoxGeometry(hx*2 + 0.06, 0.06, 0.12), glow, 0, h + 0.01, z + hz);
  }

  // ---- the floor's inlay: a violet ring and a line from the south gate to the dais ----
  K.deco(new THREE.RingGeometry(9.4, 9.9, 64), inlay, 0, 0.03, 0, -Math.PI/2);
  K.deco(new THREE.PlaneGeometry(0.5, H*2 - 6), inlay, 0, 0.03, 1.5, -Math.PI/2);

  // ---- the GREAT PILLARS: two rows down the floor ----
  for (const x of [-14, 14]) for (const z of [-17, -3, 11]){
    const h = 13 + R()*3, r = 1.2;
    if (x > 0 && z === 11){   // one of them has fallen: the stump, and the shaft lying across the floor
      K.column(x, z, r, 3.2, stone, { taper: 0.95 });
      K.rubble(x - 5.4, z + 1.5, 7.5, 0.55, stone, true);
      continue;
    }
    K.column(x, z, r, h, stone, { taper: 0.82 });
    K.box(x, z, r*1.3, r*1.3, 0.5, stoneD, { climbable: true });   // its plinth
    K.deco(new THREE.BoxGeometry(0.16, h*0.6, 0.06), glow, x, h*0.45, z + r*0.85).userData.noBake = true;
  }

  // ---- LOW WALLS on the diagonals: L-shaped, vault them ----
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
    const cx = sx*22, cz = sz*20;
    K.box(cx - sx*1.6, cz, 1.6, 0.35, 1.3, stoneD);
    K.box(cx, cz - sz*1.5, 0.35, 1.2, 1.3, stoneD);
    K.deco(new THREE.BoxGeometry(0.8, 0.35, 0.6), stone, cx - sx*0.6, 1.45, cz, 0, 0.4, 0);
  }
  for (const [x, z, len, ax] of [[-7, 6, 1.6, true], [6, -8, 1.4, false], [-24, -6, 1.8, false], [25, 4, 1.5, true], [-4, 24, 1.6, true]]){
    K.rubble(x, z, len, 0.3, stoneD, ax);
  }

  // ---- BROKEN PIECES across the lane from the south gate to the dais (1.4, vault them): no straight shot down it ----
  for (const [x, z, hx, ry] of [[-3.2, 0.5, 1.8, 0.0], [3.4, -12.5, 1.6, 0.0]]){
    K.box(x, z, hx, 0.5, 1.4, stoneD);
    K.deco(new THREE.BoxGeometry(hx*1.1, 0.4, 0.7), stone, x + 0.4, 1.55, z, 0.2, 0.3 + ry, 0.12);   // a chunk fallen on it
  }

  // ---- the OBELISK (the overwatch climb) in the south-west ----
  K.gantry(-28, 28, { a: dark, b: stoneD, strut: metal, beacon: glowC }, [1, -1]);

  // ---- LIGHTNING RODS: the storm comes down through them ----
  [[-21, 5], [21, -9], [8, 21]].forEach(([x, z], i) => {
    K.column(x, z, 0.22, 6.5, metal, { wallKick: false, seg: 6, taper: 0.4 });
    K.deco(new THREE.SphereGeometry(0.32, 8, 6), glow, x, 6.7, z).userData.noBake = true;
    K.deco(new THREE.RingGeometry(2.4, 2.7, 24), inlay, x, 0.03, z, -Math.PI/2);
    hazardZones.push({ kind: 'point', cx: x, cz: z, r: 2.6, period: 9, warnDur: 1.5, activeDur: 0.9, dmg: 20, color: glowC, flash: true, t: i * 3 });
  });

  // ---- fuel drums the army brought up ----
  for (const [x, z] of [[-9, -22], [10, 17], [-26, -18], [27, 16]]) spawnBarrel(V3(x, 0, z));
}
