// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena (the Mandalorian's story): THE GALLOWS, the Magistrate's prison barge, anchored on the storm sea of Vell
// (data/campaign-mando.js: THE GALLOWS and SKYE; data/missions.js gallows).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { buildGunship } from './outpost.js';

/* THE GALLOWS (half-size 30). The top deck of a prison barge riding out a storm at night:
     · the LANDING PAD in the north (+z): Skye's impounded gunship, chained down, its ramp toward the deck. The ground
       in front of the ramp is the spot to hold while the prisoners board;
     · the CELL BLOCKS west and east: long steel blocks, barred fronts facing the deck, a LOCK console at each one's
       middle. The prisoners come out of the west block's door and file across the deck to the ramp;
     · the WARDEN'S TOWER in the south: the block the warden runs the barge from, the third lock at its foot;
     · the DECK between them: cargo, a loading crane over the middle, floodlights, and an open stretch for a duel;
     · RAILS and bollards round the edge, the sea past them, and a gantry in the south-east as the overwatch. */
export const BARGE_SPOTS = {
  ship: [0, 22],
  ramp: [[0, 14.6], [0, 17.4]],                                       // foot of the ramp, then the hatch
  door: [-15.6, 6],                                                   // the west block's door
  path: [[-15.6, 6], [-11, 9.4], [-5, 11.6], [-1.2, 13.4]],           // block door → foot of the ramp
  hold: [0, 10],
  locks: [[-13.6, -4], [13.6, -4], [0, -17.4]],
};

export function buildBargeArena(L){
  const pal = L.pal || {};
  const steel  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5a646e, roughness: 0.55, metalness: 0.7 });
  const steelD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x2e343c, roughness: 0.6, metalness: 0.6 });
  const rust   = new THREE.MeshStandardMaterial({ color: pal.rust ?? 0x6a4a3a, roughness: 0.85, metalness: 0.3 });
  const hullM  = new THREE.MeshStandardMaterial({ color: pal.hullM ?? 0x3a4450, roughness: 0.7, metalness: 0.5 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6, metalness: 0.4 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x4a5a5a, roughness: 0.8 });
  const bar    = new THREE.MeshStandardMaterial({ color: pal.bar ?? 0x1e2228, roughness: 0.4, metalness: 0.8 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xe8f0ff });
  const red    = new THREE.MeshBasicMaterial({ color: pal.alarm ?? 0xff3a2a });
  const cell   = new THREE.MeshBasicMaterial({ color: pal.cell ?? 0x6a8aa0 });
  const dark   = new THREE.MeshBasicMaterial({ color: 0x06080a });
  const K = arenaKit(), R = seeded(41), H = L.arena / 2;

  // ---- the RAILS round the deck's edge, posts along them, bollards for the mooring lines ----
  for (const side of ['n', 's', 'e', 'w']){
    const ns = side === 'n' || side === 's', s = side === 'n' || side === 'e' ? 1 : -1, d = H + 0.4;
    if (ns) K.box(0, s*d, H + 0.8, 0.25, 1.1, steelD); else K.box(s*d, 0, 0.25, H + 0.8, 1.1, steelD);
    for (let a = -H; a <= H; a += 4){
      if (ns) K.deco(new THREE.BoxGeometry(0.2, 1.3, 0.56), stripe, a, 0.65, s*d); else K.deco(new THREE.BoxGeometry(0.56, 1.3, 0.2), stripe, s*d, 0.65, a);
    }
    // the hull's flank, falling away to the sea past the rail
    if (ns) K.deco(new THREE.BoxGeometry(H*2 + 4, 6, 1.2), hullM, 0, -3.0, s*(d + 0.9)); else K.deco(new THREE.BoxGeometry(1.2, 6, H*2 + 4), hullM, s*(d + 0.9), -3.0, 0);
  }
  for (const [x, z] of [[-26, 27], [26, 27], [-27, -10], [27, 8], [-12, -27], [12, -27]]) K.column(x, z, 0.45, 0.9, steelD, { wallKick: false, seg: 8, taper: 0.8 });

  // ---- the LANDING PAD and Skye's gunship, ramp down to the deck ----
  { const [sx, sz] = BARGE_SPOTS.ship;
    K.box(sx, sz - 1, 8.5, 6.5, 0.2, steelD, { climbable: true });
    for (const dx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.3, 0.04, 12.6), stripe, sx + dx*8.2, 0.21, sz - 1);
    K.deco(new THREE.TorusGeometry(4.2, 0.14, 6, 32), stripe, sx, 0.22, sz - 1, Math.PI/2);
    shared.refugeShip = buildGunship(sx, sz, { hull: pal.hull ?? 0x8a6a4a, dark: pal.metalD ?? 0x2e343c, stripe: pal.skye ?? 0x3aa8d8 });   // (it lifts off when the hold is done: game/mission.js)
    for (const dx of [-1, 1]) K.column(sx + dx*7.6, sz - 6.2, 0.35, 0.8, bar, { wallKick: false, seg: 6 });   // the impound clamps
  }

  // ---- the CELL BLOCKS, west and east: barred fronts on the deck, a lock console in each one's middle ----
  for (const sx of [-1, 1]){
    const cx = sx * 20.8, front = sx * 16.4, hx = 4.4, hz = 10, h = 4.6;
    K.box(cx, -2, hx, hz, h, steel);
    K.deco(new THREE.BoxGeometry(hx*2 + 0.3, 0.4, hz*2 + 0.3), steelD, cx, h + 0.2, -2);
    for (let z = -11; z <= 7; z += 3){
      if (sx < 0 && Math.abs(z - (BARGE_SPOTS.door[1])) < 1.6) continue;
      K.deco(new THREE.PlaneGeometry(2.4, 3.2), dark, front + sx*0.02*-1, 1.7, z, 0, sx < 0 ? Math.PI/2 : -Math.PI/2, 0);
      for (let b = -1; b <= 1; b += 0.4) K.deco(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5), bar, front - sx*0.06, 1.7, z + b);
      K.deco(new THREE.BoxGeometry(0.1, 0.12, 0.5), cell, front - sx*0.04, 3.6, z);
    }
    K.deco(new THREE.SphereGeometry(0.24, 8, 6), red, front - sx*0.1, 4.0, -4);   // the lock's alarm over its console
    K.sign(sx < 0 ? 'BLOCK A' : 'BLOCK B', front - sx*0.06, 4.0, 4.5, sx < 0 ? Math.PI/2 : -Math.PI/2, { w: 2.6, plate: 'rgba(30,10,8,.85)', ink: '#ffd0a0', edge: 'rgba(255,90,60,.9)' });
  }
  // the west block's door: open, lit, the prisoners' way out
  { const [dx, dz] = BARGE_SPOTS.door;
    K.deco(new THREE.PlaneGeometry(2.2, 3.2), cell, dx - 0.78, 1.6, dz, 0, Math.PI/2, 0);
    K.deco(new THREE.BoxGeometry(0.3, 0.3, 2.8), stripe, dx - 0.76, 3.35, dz); }
  // the deck walk the prisoners take: a painted lane
  { const P = [...BARGE_SPOTS.path, BARGE_SPOTS.ramp[0]];
    for (let i = 0; i < P.length - 1; i++){
      const [ax, az] = P[i], [bx, bz] = P[i+1], len = Math.hypot(bx - ax, bz - az);
      K.strip(ax, az, bx, bz, 1.2, pal.lane ?? 0xd9a43a, 0.22);
    } }

  // ---- the WARDEN'S TOWER in the south: a steel block, a lit window band, a searchlight on its roof ----
  { const tz = -24;
    K.box(0, tz, 6, 3.2, 6.8, steel);
    K.deco(new THREE.BoxGeometry(12.1, 0.9, 6.5), lamp, 0, 4.8, tz).userData.noBake = true;
    K.deco(new THREE.BoxGeometry(12.06, 0.4, 6.46), steelD, 0, 6.62, tz);
    K.column(3.6, tz, 0.5, 8.2, steelD, { wallKick: false, seg: 8 });
    K.deco(new THREE.CylinderGeometry(0.7, 0.5, 0.8, 10), steelD, 3.6, 8.6, tz, Math.PI/2.6, 0, 0);
    K.deco(new THREE.CircleGeometry(0.55, 12), lamp, 3.6, 8.75, tz + 0.42, -0.4).userData.passThrough = true;
    K.deco(new THREE.PlaneGeometry(2.4, 3), dark, 0, 1.5, tz + 3.22);
    K.banner(-3.6, 3.0, tz + 3.24, 0, 1.6, 2.2, 0x3a2a2a, 0x8a8e96, 0xc0c4cc);   // the Magistrate's iron mark
    K.banner(3.6, 3.0, tz + 3.24, 0, 1.6, 2.2, 0x3a2a2a, 0x8a8e96, 0xc0c4cc); }

  // ---- the LOADING CRANE over the middle of the deck, a container hanging off it ----
  { const cx = -6, cz = -12, top = 10.5, reach = 12;
    K.column(cx, cz, 0.7, top, rust, { seg: 8, taper: 0.8 });
    K.box(cx, cz, 1.4, 1.4, 0.8, steelD);
    K.deco(new THREE.BoxGeometry(reach, 0.8, 0.9), rust, cx + reach/2 - 0.6, top + 0.4, cz);
    K.slab(cx + reach/2 - 0.6, cz, reach/2, 0.45, top, top + 0.8);
    const hx = cx + reach - 2.4;
    K.deco(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 4), bar, hx, top - 1.8, cz).userData.passThrough = true;
    K.deco(new THREE.BoxGeometry(4.2, 2.2, 2.2), crate, hx, top - 4.7, cz);
    K.slab(hx, cz, 2.1, 1.1, top - 5.8, top - 3.6); }

  // ---- CARGO on the deck: containers and crates for cover, leaving the middle open ----
  for (const [x, z, hx, hz, h, m] of [[-9, 3, 1.3, 0.8, 1.1, crate], [9, 4, 0.8, 1.3, 1.0, crate], [12, -14, 2.4, 1.1, 2.6, rust],
                                      [-14, -18, 1.1, 2.4, 2.6, crate], [7, -17, 0.8, 0.8, 1.2, crate], [-10, -20, 1.2, 0.7, 1.0, rust],
                                      [24, 20, 1.2, 1.2, 1.4, crate], [-24, 20, 2.0, 1.1, 2.6, rust], [10, 15, 0.8, 0.8, 1.1, crate]]){
    K.box(x, z, hx, hz, h, m, { climbable: h <= 1.1 });
    K.deco(new THREE.BoxGeometry(hx*2 + 0.04, 0.1, hz*2 + 0.04), stripe, x, h*0.6, z);
  }
  // FLOODLIGHT poles, white light raking the deck through the rain
  for (const [x, z] of [[-11, 14], [11, 12], [-9, -7], [10, -7], [-22, -24], [22, -24]]){
    K.column(x, z, 0.22, 7, steelD, { wallKick: false, seg: 6, taper: 1 });
    K.deco(new THREE.BoxGeometry(1.0, 0.4, 0.4), steelD, x, 7.1, z);
    K.deco(new THREE.BoxGeometry(0.8, 0.22, 0.06), lamp, x, 7.0, z + Math.sign(-z || 1) * 0.22).userData.noBake = true;
  }
  // hatches into the hold, flush in the deck
  for (const [x, z] of [[-2, -6], [6, 2], [-4, 18 - 26]]) K.deco(new THREE.BoxGeometry(2.4, 0.04, 2.4), steelD, x, 0.02, z);

  // ---- the OVERWATCH gantry in the south-east corner ----
  K.gantry(18, -22, { a: steelD, b: steel, strut: stripe, beacon: pal.alarm ?? 0xff3a2a }, [1, 1]);

  // ---- fuel drums the guard keep on deck ----
  for (const [x, z] of [[-18, 13], [17, -9], [-9, -27], [20, 6]]) spawnBarrel(V3(x, 0, z));
  void R;
}
