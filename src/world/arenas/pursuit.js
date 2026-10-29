// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the spaceport at Khel Dar, one long chase route through a sandstone port town (data/missions.js).

import * as THREE from 'three';
import { shared, solids } from '../../state.js';
import { spawnVent, spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { mound } from '../collision.js';
import { arenaKit, seeded } from './kit.js';
import { toon, inkify } from '../ink.js';

/* THE SPACEPORT RUN (56 wide × 320 long: x −28…28, z −160…160). Not a battlefield but a ROUTE: one street that snakes
   north through the town to the docking bay, every other square metre packed with buildings. The quarry runs it a
   few seconds ahead of you; the set pieces along it are there to be crossed fast (vault, climb, slide, wall-run,
   leap). The running stretches are clear of troops: the fighting happens in three open squares where the quarry
   stops to cut through a sealed way and leaves its guard (data/missions.js `standoff`), and each leg has a SHORTCUT
   lane that only parkour gets through, cutting a corner off its line. South to north:
     LEG 1 (to the plaza)
     · the START YARD and the MARKET STREET: stall counters and carts to vault, a barricade, then the MARKET SQUARE
       (a standoff) where the street widens before the cross;
     · the ROOFLINE LANE (shortcut): straight north from the cross to the canal, walls and a raised run to climb;
     · the WEST CROSS, then the ALLEY: eight metres wide between sheer walls (wall-runs), a fence to clear;
     · the CANAL WALK east: a row of low barriers down the middle, open round the sides;
     · the TERRACES north: three climbable tiers up onto a high walkway (and a stair lane for foes), then a drop;
     · the PLAZA: a fountain, planters, a standoff, the checkpoint.
     LEG 2 (to the docks)
     · the CAUSEWAY STREET: a raised walkway with two gaps to leap, the street below it full of troops;
     · the HANGAR ROW east (widened: a standoff): cargo containers to climb over or weave round, fuel drums;
     · the STACK LANE (shortcut): north from the west end of the hangars straight into the docking bay;
     · the SERVICE CUT north: a narrow passage with steam vents firing in turn;
     · the DOCKING BAY: open ground round the quarry's ship, where the run ends.
   Corridors are authored as open rectangles; the buildings are generated to fill everything else. */
const CORRIDORS = [
  [-9, 9, -159, -138],     // start yard
  [-7, 7, -140, -90],      // market street
  [-14, 14, -112, -94],    // the market square (a standoff)
  [-25, 7, -100, -88],     // west cross
  [-23, -15, -90, -46],    // the alley
  [-3, 2, -88, -50],       // the roofline lane (shortcut)
  [-23, 25, -50, -38],     // canal walk
  [11, 25, -40, -4],       // the terraces
  [-25, 25, -6, 30],       // the plaza
  [-25, -7, 28, 80],       // causeway street
  [-25, 25, 72, 94],       // hangar row (a standoff)
  [-24, -17, 94, 121],     // the stack lane (shortcut)
  [13, 22, 88, 124],       // the service cut
  [-26, 26, 120, 159],     // the docking bay
];

/* the quarry's line, one polyline per leg. A point is [x, z] or [x, z, 'leap']: the stretch ENDING at a leap point
   is jumped (a gap, a fence, a drop) instead of run along the ground */
export const PURSUIT_SPOTS = {
  start: [0, -152, 0],
  quarryStart: [0, -140],
  legs: [
    [[0, -140], [0, -95], [-19, -93], [-19, -71.2], [-19, -68.8, 'leap'], [-19, -46], [-14, -44], [18, -44], [18, -17],
     [18, -12, 'leap'], [6, 6], [0, 12]],
    [[0, 12], [-12, 24], [-20, 29], [-20, 47], [-20, 50.5, 'leap'], [-20, 61], [-20, 64.5, 'leap'], [-20, 76],
     [-19, 80, 'leap'], [-14, 83], [17, 83], [17.5, 90], [17.5, 121], [8, 130], [0, 135]],
  ],
  // per leg, the parkour lanes that cut a corner off the quarry's line: zone [x0, x1, z0, z1], at: the entry beacon
  shortcuts: [
    [{ zone: [-3, 2, -88, -50], at: [-0.5, -90] }],
    [{ zone: [-24, -17, 94, 121], at: [-20.5, 92] }],
  ],
  checkpoint: [-2, 4, -0.7],   // where a retry of leg 2 puts the hero (x, z, yaw): the plaza
  pad: [0, 146],
};

export function buildPursuitArena(L){
  const pal = L.pal || {};
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0xc8a67c, roughness: 0.95, metalness: 0.02 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0xa8845c, roughness: 0.95, metalness: 0.02 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0x8a6440, roughness: 0.9, metalness: 0.05 });
  const roof   = new THREE.MeshStandardMaterial({ color: pal.roof ?? 0x7a5236, roughness: 0.9, metalness: 0.05 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x6a727e, roughness: 0.55, metalness: 0.7 });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46, roughness: 0.5, metalness: 0.7 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6, metalness: 0.4 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x8a7458, roughness: 0.85, metalness: 0.1 });
  const dark   = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.9, metalness: 0.05 });
  const cloth  = (pal.cloth || [0xb8402a, 0x2a6a8a, 0xd8a03a]).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
  const warm   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const glass  = new THREE.MeshBasicMaterial({ color: 0x1c2630 });
  const K = arenaKit(), R = seeded(91);
  const half = L.arena / 2, halfZ = (L.arenaZ || L.arena) / 2;

  // ---- THE TOWN — every metre outside the corridors becomes a building block ----
  const W = Math.round(half * 2), D = Math.round(halfZ * 2);
  const open = new Uint8Array(W * D), used = new Uint8Array(W * D);
  const cell = (x, z) => (z + halfZ) * W + (x + half);   // integer metre cells, by their low corner
  for (const [x0, x1, z0, z1] of CORRIDORS) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) open[cell(x, z)] = 1;
  const isOpen = (x, z) => x >= -half && x < half && z >= -halfZ && z < halfZ && open[cell(Math.floor(x), Math.floor(z))];
  for (let z = -halfZ; z < halfZ; z++) for (let x = -half; x < half; x++){
    const k = cell(x, z);
    if (open[k] || used[k]) continue;
    // grow a block east, then north, up to a house-sized footprint
    let w = 1; while (w < 12 && x + w < half && !open[cell(x + w, z)] && !used[cell(x + w, z)]) w++;
    let d = 1;
    grow: while (d < 12 && z + d < halfZ){ for (let i = 0; i < w; i++){ const j = cell(x + i, z + d); if (open[j] || used[j]) break grow; } d++; }
    for (let a = 0; a < d; a++) for (let i = 0; i < w; i++) used[cell(x + i, z + a)] = 1;
    house(x, z, w, d);
  }
  // a block: walls, a parapet, and windows / doors / awnings on the faces that look onto the street
  function house(x, z, w, d){
    const cx = x + w/2, cz = z + d/2, h = 5.6 + R() * 5.2;
    const m = R() < 0.5 ? wall : wallD;
    K.box(cx, cz, w/2, d/2, h, m);
    const block = solids[solids.length - 1];
    const faces = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let street = false;
    for (const [fx, fz] of faces){
      const len = fx ? d : w, ox = cx + fx * (w/2 + 0.6), oz = cz + fz * (d/2 + 0.6);
      // does this face look onto a street? sample along it, just outside
      if (![-0.4, 0, 0.4].some(t => isOpen(ox + (fz ? t * len : 0), oz + (fx ? t * len : 0)))) continue;
      street = true;
      const ry = fx ? Math.PI/2 : 0, px = cx + fx * (w/2 + 0.04), pz = cz + fz * (d/2 + 0.04);
      // a row of windows on the upper storey, a door (sometimes lit, sometimes with an awning) at street level
      for (let u = -len/2 + 1.6; u < len/2 - 1.2; u += 2.6 + R()){
        const wx = px + (fz ? u : 0), wz = pz + (fx ? u : 0);
        if (h > 6.5 && R() < 0.7) K.deco(new THREE.BoxGeometry(0.9, 1.2, 0.1), glass, wx, h - 2.2, wz, 0, ry, 0);
        if (R() < 0.18){
          const lit = R() < 0.4;
          K.deco(new THREE.BoxGeometry(1.3, 2.3, 0.1), lit ? warm : dark, wx, 1.15, wz, 0, ry, 0);
          if (R() < 0.5){   // an awning over the door: walk under it, land on it
            K.deco(new THREE.BoxGeometry(fx ? 1.3 : 2.2, 0.06, fx ? 2.2 : 1.3), cloth[Math.floor(R() * cloth.length)],
              wx + fx * 0.65, 2.6, wz + fz * 0.65, fz ? -fz * 0.25 : 0, 0, fx ? fx * 0.25 : 0);
            solids.push({ x: wx + fx * 0.65, z: wz + fz * 0.65, hx: fx ? 0.65 : 1.1, hz: fx ? 1.1 : 0.65, y0: 2.4, h: 2.78, box: true, soft: true });
          }
        }
      }
    }
    // parapet and roof clutter (only where it can be seen: blocks on the street)
    if (!street) return;
    K.deco(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), trim, cx, h + 0.17, cz);
    block.h = h + 0.35;   // the roof you run on is the parapet's top
    if (R() < 0.35){   // a dome on the roof: a hill you run up and over
      const r = Math.min(w, d) * 0.32;
      K.deco(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI*2, 0, Math.PI/2), roof, cx, h + 0.3, cz);
      solids.push(mound(cx, cz, r, r, 0, h + 0.3, h + 0.3 + r));
    }
    else if (R() < 0.4) K.deco(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4), metal, cx + (R() - 0.5) * w * 0.6, h + 1.4, cz + (R() - 0.5) * d * 0.6);
  }

  // the skyline past the town: tall port towers either side of the run and a control spire over the docks (no collision)
  for (let z = -150; z < 150; z += 16 + R() * 10) for (const sx of [-1, 1]){
    const x = sx * (36 + R() * 18), h = 14 + R() * 22, r = 2.2 + R() * 2.2;
    K.deco(new THREE.CylinderGeometry(r * 0.75, r, h, 8), R() < 0.5 ? wall : wallD, x, h/2, z);
    K.deco(new THREE.CylinderGeometry(r * 1.15, r * 0.8, 1.2, 8), trim, x, h + 0.6, z);
    if (R() < 0.5) K.deco(new THREE.SphereGeometry(r * 0.8, 10, 6, 0, Math.PI*2, 0, Math.PI/2), roof, x, h + 1.2, z);
  }
  { const sx = 40, sz = 150; K.deco(new THREE.CylinderGeometry(2.2, 3.4, 40, 10), wallD, sx, 20, sz);
    K.deco(new THREE.CylinderGeometry(6, 4.5, 3.2, 12), trim, sx, 41.6, sz);
    K.deco(new THREE.CylinderGeometry(6.1, 6.1, 1.2, 12), glass, sx, 41.4, sz); }

  // small helpers for street furniture
  const stall = (x, z, alongZ, ci) => {   // a market counter (vaultable) under a cloth awning on two poles
    const hx = alongZ ? 0.7 : 1.6, hz = alongZ ? 1.6 : 0.7;
    K.box(x, z, hx, hz, 1.0, crate);
    const side = alongZ ? Math.sign(x) : 0;
    for (const s of [-1, 1]){
      const px = x + (alongZ ? side * 0.8 : s * 1.5), pz = z + (alongZ ? s * 1.5 : 0.8 * -Math.sign(z));
      K.deco(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4), trim, px, 1.25, pz);
    }
    K.deco(new THREE.BoxGeometry(alongZ ? 2.0 : 3.6, 0.06, alongZ ? 3.6 : 2.0), cloth[ci % cloth.length], x, 2.55, z, 0, 0, alongZ ? -side * 0.18 : 0);
    solids.push({ x, z, hx: alongZ ? 1.0 : 1.8, hz: alongZ ? 1.8 : 1.0, y0: 2.35, h: 2.75, box: true, soft: true });   // the awning: walk under it, land on it
  };
  const crates = (x, z, tall) => {        // a stack: a low crate beside a taller one (a two-move climb)
    K.box(x, z, 0.75, 0.75, 1.1, crate);
    if (tall) K.box(x + 1.4, z + 0.2, 0.7, 0.7, 2.1, crate);
  };
  const lamp = (x, z) => { K.column(x, z, 0.12, 3.2, metal, { wallKick: false, seg: 6 }); K.deco(new THREE.SphereGeometry(0.22, 8, 6), warm, x, 3.35, z); };
  const banner = (x0, x1, z, y, ci) => K.deco(new THREE.BoxGeometry(Math.abs(x1 - x0), 0.9, 0.04), cloth[ci % cloth.length], (x0 + x1)/2, y, z);

  // ---- START YARD: your ride, parked ----
  K.box(-5.2, -151, 1.1, 2.4, 0.9, metal);
  K.deco(new THREE.BoxGeometry(1.8, 0.5, 1.4), glass, -5.2, 1.15, -149.6);
  solids.push({ x: -5.2, z: -149.6, hx: 0.9, hz: 0.7, h: 1.4, box: true });   // the windscreen
  crates(5.5, -146, true); lamp(-7.6, -141); lamp(7.6, -141);

  // ---- MARKET STREET: stalls down both sides, carts and crates in the lane, a barricade half way ----
  for (let z = -134, i = 0; z < -92; z += 7, i++){
    if (z > -112 && z < -100) continue;   // clear round the barricade
    stall(i % 2 ? 5.3 : -5.3, z, true, i);
    if (i % 3 === 1) stall(i % 2 ? -5.3 : 5.3, z + 3.5, true, i + 1);
  }
  K.box(-1.5, -126, 1.7, 0.9, 1.1, metal);          // an overturned cart
  K.deco(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 10), dark, -3.0, 0.55, -126, 0, 0, Math.PI/2);
  crates(2.0, -118, true);
  K.rubble(-2.5, -113, 2.4, 0.32, wallD, true);
  // the barricade: Imperial blast panels across the middle (vault it), the gaps at the sides are where foes go round
  K.box(0, -106, 4.6, 0.35, 1.2, imp);
  K.deco(new THREE.BoxGeometry(9.3, 0.1, 0.75), stripe, 0, 1.22, -106);
  crates(-3.2, -98, false);
  for (const z of [-130, -116, -98]) banner(-7, 7, z, 5.4, Math.round(z) & 3);

  // ---- WEST CROSS: a water tower, a dead speeder bike, crates ----
  K.column(-10, -98, 1.3, 3.2, metal, { seg: 10 });
  K.deco(new THREE.CylinderGeometry(1.6, 1.6, 2.2, 12), metal, -10, 4.3, -98);
  solids.push({ x: -10, z: -98, r: 1.6, h: 5.4 });   // the tank, wider than its stand
  K.box(-6, -91.2, 1.6, 0.6, 1.0, imp);
  crates(-22, -97, true); lamp(4, -89);

  // ---- THE ALLEY: sheer walls both sides, laundry overhead, a fence across (gap at the east wall), crates ----
  for (let z = -86; z < -48; z += 6) K.deco(new THREE.BoxGeometry(8, 0.03, 0.9), cloth[(z / 6) & 3], -19, 4.4 + (z & 1) * 0.6, z, 0.05, 0, 0).userData.passThrough = true;   // laundry on a line: brushed through
  K.box(-20, -70, 3, 0.18, 2.1, trim);                                     // the fence: mantle it, or the gap at x −17…−15
  for (let x = -22.6; x < -17; x += 1.1) K.deco(new THREE.BoxGeometry(0.1, 2.3, 0.3), dark, x, 1.15, -70);
  crates(-21.5, -82, false); crates(-17, -57, true);
  for (const z of [-80, -60]) K.deco(new THREE.CylinderGeometry(0.12, 0.12, 8, 6), metal, -22.85, 3.2, z, Math.PI/2, 0, 0);   // a pipe on the wall

  // ---- THE ROOFLINE LANE (shortcut): a crate climb, a wall to mantle, a raised run along the top, a barrier to vault ----
  crates(-2.2, -84, true);
  K.box(-0.5, -78, 2.5, 0.3, 2.0, trim);
  K.box(-0.5, -65, 2.5, 5, 2.2, wallD);
  K.box(-0.5, -55, 2.5, 0.3, 1.0, imp);
  K.deco(new THREE.BoxGeometry(5, 0.1, 0.4), stripe, -0.5, 1.02, -55);
  for (const z of [-82, -72, -62]) K.deco(new THREE.BoxGeometry(5, 0.03, 0.9), cloth[(z / 5) & 3], -0.5, 5.2, z, 0.05, 0, 0).userData.passThrough = true;

  // ---- CANAL WALK: low barriers down the middle (vault the line), the sides open; a vaporator ----
  for (const x of [-8, 0, 8, 16]) K.box(x, -44, 0.3, 2.8, 0.95, wallD);
  K.column(-14, -40, 0.4, 5.2, metal, { wallKick: false, seg: 8 });
  for (const y of [1.6, 3.2]) K.deco(new THREE.CylinderGeometry(0.75, 0.75, 0.25, 10), metal, -14, y, -40);
  solids.push({ x: -14, z: -40, r: 0.75, h: 3.33 });   // its collector rings
  K.deco(new THREE.SphereGeometry(0.16, 8, 6), warm, -14, 5.4, -40);
  crates(22, -48, true); lamp(-20, -39.5);

  // ---- THE TERRACES: three tiers up to a high walkway (climb them), a stair lane on the east side for foes (the
  // only pieces marked climbable here are ones a foe can walk up: the stairs, the lane, the pad) ----
  K.box(16, -33, 5, 1.0, 0.9, wall);
  K.box(16, -28, 5, 4.0, 1.8, wallD);
  K.box(16, -20, 5, 4.0, 2.7, wall);
  K.box(23, -20, 2, 4.0, 2.7, wall, { climbable: true });   // the stair lane's top runs on to the drop
  for (let i = 0; i < 6; i++) K.box(23, -37.5 + i, 2, 0.5, 0.45 * (i + 1), trim, { climbable: true });   // the stairs
  K.box(23, -28, 2, 4.0, 2.7, wall, { climbable: true });
  K.deco(new THREE.BoxGeometry(14.2, 0.12, 0.3), trim, 18, 2.76, -16.1);
  for (const x of [12, 24]) lamp(x, -14);

  // ---- THE PLAZA: a fountain and its statue, planters, a gate arch to the north-west ----
  K.column(7, 18, 2.8, 0.8, wallD, { wallKick: false, seg: 16, taper: 1 });
  K.deco(new THREE.CylinderGeometry(2.5, 2.5, 0.1, 16), new THREE.MeshBasicMaterial({ color: 0x5aa0c0 }), 7, 0.82, 18);
  K.column(7, 18, 0.7, 4.6, wall, { seg: 8 });
  K.deco(new THREE.SphereGeometry(0.75, 10, 8), wall, 7, 5.1, 18);
  solids.push({ x: 7, z: 18, r: 0.7, h: 5.8 });   // the statue's head
  for (const [x, z] of [[-20, 4], [20, 10], [16, 26], [-4, 26], [-20, 18]]){
    K.box(x, z, 1.2, 1.2, 0.9, trim);
    K.deco(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 0.9 }), x, 1.3, z);
    solids.push({ x, z, r: 0.85, h: 2.1 });   // the shrub in it
  }
  { const ax = -16; for (const sx of [-1, 1]) K.column(ax + sx * 8.6, 29.5, 0.6, 6.5, wallD, { seg: 8, taper: 1 });
    K.deco(new THREE.BoxGeometry(18.4, 1.2, 1.4), wallD, ax, 7.0, 29.5);
    solids.push({ x: ax, z: 29.5, hx: 9.2, hz: 0.7, y0: 6.4, h: 7.6, box: true }); }   // the arch's lintel, overhead
  for (const [x, z] of [[-24, -4], [24, -4], [-24, 28], [24, 28]]) lamp(x, z);

  // ---- CAUSEWAY STREET: a raised walkway down the west side with two gaps, steps up at the south end ----
  K.box(-20, 31, 2.5, 1.0, 0.8, wallD);
  K.box(-20, 33, 2.5, 1.0, 1.6, wall);
  for (const [z0, z1] of [[34, 47], [50.5, 61], [64.5, 76]]){
    K.box(-20, (z0 + z1)/2, 2.5, (z1 - z0)/2, 2.4, wall);
    K.deco(new THREE.BoxGeometry(0.2, 0.5, z1 - z0), trim, -17.6, 2.65, (z0 + z1)/2);   // a kerb on the open side
  }
  // the street below: crates, a speeder, lamps
  crates(-11, 40, true); K.box(-12, 58, 1.0, 2.2, 0.9, metal); crates(-9.5, 70, false);
  lamp(-8, 48); lamp(-8, 64);
  banner(-25, -7, 55, 6.2, 1);

  // ---- HANGAR ROW: cargo containers staggered down the row, fuel drums, a gantry crane overhead ----
  for (const [x, z, ax] of [[-6, 79.5, true], [3, 86.5, true], [12, 79.5, false], [-15, 87.5, true]]){
    K.box(x, z, ax ? 3 : 1.25, ax ? 1.25 : 3, 2.6, R() < 0.5 ? metal : crate);
    K.deco(new THREE.BoxGeometry(ax ? 6.05 : 2.55, 0.12, ax ? 2.55 : 6.05), stripe, x, 2.62, z);
  }
  spawnBarrel(V3(8, 0, 88)); spawnBarrel(V3(-10, 0, 78)); spawnBarrel(V3(21, 0, 78));
  for (const x of [-24.4, 24.4]) K.box(x, 83, 0.3, 0.3, 9, imp);
  K.deco(new THREE.BoxGeometry(48, 0.8, 0.8), imp, 0, 9.2, 83);
  solids.push({ x: 0, z: 83, hx: 24, hz: 0.4, y0: 8.8, h: 9.6, box: true });   // the crane's beam, overhead

  // ---- THE STACK LANE (shortcut): crates up, a wall, a raised run, a barrier, then down into the bay ----
  crates(-22.6, 98, true);
  K.box(-20.5, 104, 3.5, 0.3, 2.0, trim);
  K.box(-20.5, 112, 3.5, 4, 2.3, crate);
  K.box(-20.5, 119, 3.5, 0.3, 1.0, imp);
  K.deco(new THREE.BoxGeometry(7, 0.1, 0.4), stripe, -20.5, 1.02, 119);

  // ---- THE SERVICE CUT: steam vents firing in turn down a narrow passage, pipes on the walls ----
  for (const [x, z] of [[15.6, 97], [19.4, 104], [15.6, 111], [19.4, 117]]) spawnVent(V3(x, 0, z));
  for (const y of [1.2, 2.0]) K.deco(new THREE.CylinderGeometry(0.16, 0.16, 34, 8), metal, 21.8, y, 106, Math.PI/2, 0, 0);
  solids.push({ x: 21.8, z: 106, hx: 0.16, hz: 17, h: 2.16, box: true });   // the pipes on the wall
  lamp(14, 92);

  // ---- THE DOCKING BAY: the landing pad, the quarry's ship on it, crates round the walls ----
  { const [px, pz] = PURSUIT_SPOTS.pad;
    K.box(px, pz, 10, 9, 0.22, metal, { climbable: true });
    for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.35, 0.04, 17.4), stripe, px + sx * 9.6, 0.23, pz);
    K.deco(new THREE.BoxGeometry(19.6, 0.04, 0.35), stripe, px, 0.23, pz - 8.6);
    for (const sx of [-1, 1]) for (const dz of [-8, 0, 8]) K.deco(new THREE.SphereGeometry(0.16, 8, 6), warm, px + sx * 9.3, 0.32, pz + dz);
    buildShip(px, pz + 2); }
  crates(-22, 126, true); crates(20, 130, false); crates(-23, 152, true); crates(21, 154, true);
  K.box(-14, 124, 1.2, 1.2, 1.4, metal); K.box(14, 152, 1.2, 1.2, 1.4, metal);
  for (const [x, z] of [[-25, 140], [25, 140]]) lamp(x, z);

  shared.templeBrazier = null;
}

/* THE QUARRY'S SHIP — a sleek, dark courier on the pad (a solid hull; its wings are overhead) */
function buildShip(x, z){
  const g = new THREE.Group();
  const hull = toon(0x3a3e46), trimM = toon(0x8a1a1a), glassM = toon(0x1a2a3a, { emissive: 0x102030, ei: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff6a4a, toneMapped: false });
  const part = (geo, m, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(px, py, pz); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; g.add(mesh); if (m !== glow) inkify(mesh, 0.05); return mesh;
  };
  part(new THREE.ConeGeometry(2.2, 11, 4), hull, 0, 2.4, 0.5, -Math.PI/2, Math.PI/4, 0);     // the arrowhead hull, nose south
  part(new THREE.BoxGeometry(1.8, 0.9, 2.2), glassM, 0, 3.4, -1.0, 0.2);                       // canopy
  for (const sx of [-1, 1]){
    part(new THREE.BoxGeometry(5.5, 0.25, 3.2), hull, sx * 3.6, 2.6, 2.6, 0, 0, sx * 0.3);     // swept wings
    part(new THREE.BoxGeometry(0.3, 2.6, 2.4), trimM, sx * 6.2, 3.6, 3.0, 0, 0, sx * 0.1);    // wingtip fins
    const n = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), glow); n.position.set(sx * 1.1, 2.3, 6.05); g.add(n);
    for (const dz of [-2, 3]) part(new THREE.CylinderGeometry(0.14, 0.18, 1.6, 6), hull, sx * 1.3, 0.8, dz);
  }
  g.position.set(x, 0.22, z); g.userData.noBake = true;
  shared.arenaGroup.add(g);
  solids.push({ x, z: z + 0.5, hx: 1.6, hz: 5, h: 4.0, box: true });
  for (const sx of [-1, 1]){   // the wings and their fins, overhead: walk under them, land on them
    solids.push({ x: x + sx * 3.6, z: z + 2.6, hx: 2.75, hz: 1.6, y0: 2.1, h: 3.7, box: true });
    solids.push({ x: x + sx * 6.2, z: z + 3.0, hx: 0.2, hz: 1.2, y0: 2.5, h: 5.1, box: true });
  }
}
