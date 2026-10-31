// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Training arena (Jedi): the open-air training hall on the temple terrace.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { arenaKit, seeded, at } from './kit.js';

/* THE TRAINING HALL (half-size 24). An open stone terrace high on the temple mountain, laid out as stations round a
   duelling circle, each one the surface a lesson needs (data/tutorial.js names the spots; game/tutorial.js walks the
   player through them). Lit kyber lanes in the floor lead from the entry to each station, and a sign over each names it.
     · the TEMPLE GATE on the north edge, behind the spawn, and the HOLOCRON beside the spawn (where the lessons are kept);
     · the DUELLING CIRCLE in the centre: a low dais with the Order's sigil inlaid, ringed in kyber light, where the
       bladework and Force lessons run;
     · THE LANES on the west: the SLIDE GATE (a low bar to Force-slide under, the gauntlet's first stop) and three low
       VAULTING BLOCKS down the lane (under vaultHeight, so a run and a jump goes up and over);
     · the WATCHTOWER in the south-west: three stone tiers stepping west (2.4 / 4.9 / 7.4), each lip within a jump's reach,
       so it teaches the ledge catch and climb. Its north face is sheer, and the drop off the top (past the ~5.9 m where a
       landing buckles) teaches the roll;
     · the RUNNING WALL on the east: a long, tall face to wall-run along and kick off;
     · the BOLT RANGE on the south: a raised gallery where the training remotes hover, facing the circle (the blaster
       sparring partner stands in front of it);
     · the MEDITATION GARDEN in the south-east and the SABER RACKS in the north-east: the read of a place people train in;
     · a balustrade round the terrace's edge, columns with the Order's banners, and kyber braziers.
   The player spawns north (0, +12), facing the circle. */
export const HALL_SPOTS = {
  circle: [0, 0],
  vault: { x: -12, z: [5, 0, -5] },       // block centres along the west lane
  vaultEnd: [-12, -8.5],                   // past the last block
  tower: [[-10.6, -16, 2.4, 2.0], [-14.2, -16, 4.9, 1.6], [-17.4, -16, 7.4, 1.6]],   // x, z, top, half-width (all 2.0 deep)
  towerDrop: [-17.4, -11],                 // the floor below the top's sheer north face
  wall: { x: 14, z: 0, hz: 6.5, h: 5 },
  gate: [-8, 11],                          // the slide gate on the north lane (the agility course's first stop)
  range: { z: -20.5, hx: 7.5 },            // the bolt range's gallery
  garden: [15, -15],
  racks: [15, 15],
  holocron: [3.6, 14.6],
};

export function buildHallArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x9aa4ac, roughness: 0.9, metalness: 0.05 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x6e7882, roughness: 0.94, metalness: 0.04 });
  const stoneL = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.85, metalness: 0.04 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xd8c48a, roughness: 0.5, metalness: 0.55 });
  const wood   = new THREE.MeshStandardMaterial({ color: 0x6a4630, roughness: 0.8, metalness: 0.05 });
  const leaf   = new THREE.MeshStandardMaterial({ color: 0x5e8a5a, roughness: 0.85, metalness: 0, flatShading: true });
  const kyber  = pal.kyber ?? 0x5ad2ff;
  const glow   = new THREE.MeshBasicMaterial({ color: kyber });
  const flame  = new THREE.MeshBasicMaterial({ color: 0x9ae6ff });
  const water  = new THREE.MeshStandardMaterial({ color: 0x3a6a8c, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 });
  const BANNER = 0x2a3e6a, CREAM = 0xe8dcc0;
  const K = arenaKit(), R = seeded(31);
  const flat = (m) => { m.userData.passThrough = true; m.castShadow = false; return m; };   // floor inlays: pictures, not props

  /* ---------------- the DUELLING CIRCLE — a low walkable dais (under STEP_UP) ringed in kyber light ---------------- */
  K.box(0, 0, 3.4, 3.4, 0.3, stoneD, { climbable: true });
  K.deco(new THREE.BoxGeometry(6.85, 0.05, 6.85), trim, 0, 0.3, 0);
  K.deco(new THREE.BoxGeometry(6.2, 0.04, 6.2), stoneL, 0, 0.33, 0);
  // the Order's sigil inlaid in the dais: a ring, the wings and the blade
  flat(K.deco(new THREE.RingGeometry(1.15, 1.35, 40), new THREE.MeshBasicMaterial({ color: kyber, transparent: true, opacity: 0.75, side: THREE.DoubleSide }), 0, 0.36, 0, -Math.PI/2));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++)
    flat(K.deco(new THREE.BoxGeometry(1.5 - k * 0.3, 0.012, 0.09), trim, s * (1.35 + 0.6 - k * 0.12), 0.36, -0.15 - k * 0.24, 0, s * 0.35, 0));
  flat(K.deco(new THREE.BoxGeometry(0.12, 0.012, 2.9), trim, 0, 0.365, 0));
  flat(K.deco(new THREE.RingGeometry(4.6, 5.0, 64), new THREE.MeshBasicMaterial({ color: kyber, transparent: true, opacity: 0.45, side: THREE.DoubleSide }), 0, 0.03, 0, -Math.PI/2));
  flat(K.deco(new THREE.RingGeometry(5.6, 5.7, 64), new THREE.MeshBasicMaterial({ color: pal.trim ?? 0xd8c48a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0.03, 0, -Math.PI/2));
  for (let i = 0; i < 8; i++){   // eight lamps set in the floor round the ring
    const [x, z] = at(i / 8 * Math.PI*2 + Math.PI/8, 5.35);
    flat(K.deco(new THREE.CircleGeometry(0.22, 12), glow, x, 0.035, z, -Math.PI/2));
  }

  /* ---------------- the TEMPLE GATE and the HOLOCRON — the north edge, behind the spawn ---------------- */
  for (const sx of [-1, 1]){
    K.box(sx * 5.4, 21.2, 1.1, 1.1, 9.5, stone);
    K.deco(new THREE.BoxGeometry(2.6, 0.5, 2.6), stoneD, sx * 5.4, 0.25, 21.2);
    K.deco(new THREE.BoxGeometry(2.7, 0.6, 2.7), trim, sx * 5.4, 9.2, 21.2);
    K.banner(sx * 5.4, 6, 20.08, Math.PI, 1.4, 5.0, BANNER, CREAM, kyber);
  }
  K.deco(new THREE.BoxGeometry(14.4, 1.4, 2.6), stoneD, 0, 10.2, 21.2);       // the lintel
  K.slab(0, 21.2, 7.2, 1.3, 9.5, 10.9);
  K.deco(new THREE.BoxGeometry(14.6, 0.14, 2.7), trim, 0, 9.5, 21.2);
  K.sign('THE TRAINING HALL', 0, 10.2, 19.85, Math.PI, { w: 6.2 });
  { const [x, z] = HALL_SPOTS.holocron;   // the holocron that keeps the lessons
    K.column(x, z, 0.5, 1.05, stoneD, { wallKick: false, seg: 8, taper: 0.8 });
    K.deco(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 8), trim, x, 1.08, z);
    const holo = K.deco(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: kyber, transparent: true, opacity: 0.9 }), x, 1.62, z, 0.3, 0.5, 0);
    holo.userData.passThrough = true;
    flat(K.deco(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: kyber, transparent: true, opacity: 0.18, depthWrite: false }), x, 0.03, z, -Math.PI/2)); }

  /* ---------------- the LANES — lit strips from the entry to each station ---------------- */
  const lane = (pts, w = 0.12) => { for (let i = 1; i < pts.length; i++) K.strip(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1], w, kyber, 0.35); };
  lane([[0, 18], [0, 5.8]]);
  lane([[-1.2, 16], [-8, 13.2], [-12, 9]]);                       // to the west lane and the slide gate
  lane([[1.2, 16], [10.5, 10.5], [11.8, 7.5]]);                   // to the running wall
  lane([[-4, -5.5], [-9, -12.5]]);                                // to the watchtower
  lane([[0, -5.8], [0, -18.5]]);                                  // to the bolt range
  lane([[4, -5.5], [11.5, -12.5]]);                               // to the garden
  for (const x of [-14.2, -9.8]) K.strip(x, 8.5, x, -8.5, 0.08, pal.trim ?? 0xd8c48a, 0.45);   // the west lane's edges

  /* ---------------- VAULTING BLOCKS — three low blocks across the west lane, spaced for a run between each ---------------- */
  for (const z of HALL_SPOTS.vault.z){
    K.box(HALL_SPOTS.vault.x, z, 1.8, 0.35, 1.05, stone);
    K.deco(new THREE.BoxGeometry(3.65, 0.05, 0.75), trim, HALL_SPOTS.vault.x, 1.05, z);
    K.deco(new THREE.BoxGeometry(3.62, 0.08, 0.04), glow, HALL_SPOTS.vault.x, 0.55, z + 0.36).userData.passThrough = true;   // a kyber line on the face you run at
  }
  K.sign('THE LANES', -12, 4.6, 9.4, 0, { w: 3.4 });

  /* ---------------- the SLIDE GATE — a low kyber-lit bar across the north lane ---------------- */
  K.slideGate(HALL_SPOTS.gate[0], HALL_SPOTS.gate[1], 1.6, trim, glow);
  for (const s of [-1, 1]) K.deco(new THREE.SphereGeometry(0.14, 8, 6), glow, HALL_SPOTS.gate[0], 1.82, HALL_SPOTS.gate[1] + s * 1.6).userData.passThrough = true;
  K.sign('SLIDE', HALL_SPOTS.gate[0], 2.35, HALL_SPOTS.gate[1], Math.PI/2, { w: 1.6, size: 64 });

  /* ---------------- the WATCHTOWER — three tiers stepping up into the south-west corner ---------------- */
  HALL_SPOTS.tower.forEach(([x, z, h, s], i) => {
    K.box(x, z, s, 2.0, h, i % 2 ? stone : stoneD);
    K.deco(new THREE.BoxGeometry(s*2 + 0.06, 0.08, 4.06), trim, x, h, z);
    for (let y = 1.2; y < h - 0.4; y += 1.2) flat(K.deco(new THREE.BoxGeometry(s*2 + 0.02, 0.05, 4.02), stoneL, x, y, z));   // coursed stone
  });
  { const [x, z, h] = HALL_SPOTS.tower[2];   // lanterns on the summit's back corners: the climb's goal reads from the floor
    for (const dx of [-1.3, 1.3]){
      K.column(x + dx, z - 1.65, 0.16, h + 1.5, trim, { wallKick: false, seg: 8, taper: 1 });
      K.deco(new THREE.SphereGeometry(0.26, 10, 8), glow, x + dx, h + 1.75, z - 1.65).userData.passThrough = true;
    }
    K.banner(HALL_SPOTS.tower[0][0] + 2.02, 1.4, HALL_SPOTS.tower[0][1], Math.PI/2, 1.2, 1.9, BANNER, CREAM, kyber); }
  K.sign('WATCHTOWER', -14.2, 9.4, -16, 0, { w: 3.6 });

  /* ---------------- the RUNNING WALL — a long tall face on the east lane, carved with a frieze ---------------- */
  { const W = HALL_SPOTS.wall;
    K.box(W.x, W.z, 0.6, W.hz, W.h, stoneD);
    for (const y of [1.6, 3.4]) K.deco(new THREE.BoxGeometry(0.08, 0.14, W.hz*2), trim, W.x - 0.62, y, W.z);
    const relief = new THREE.MeshStandardMaterial({ color: 0x7c766c, roughness: 0.95 });
    for (let z = -W.hz + 1.6; z < W.hz - 1; z += 3.2) flat(K.deco(new THREE.BoxGeometry(0.04, 1.2, 2.2), relief, W.x - 0.62, 2.5, W.z + z + 0.8));   // relief panels between the lines
    K.deco(new THREE.BoxGeometry(1.4, 0.3, W.hz*2 + 0.4), stone, W.x, W.h + 0.15, W.z);
    for (const z of [-4.5, 0, 4.5]) K.banner(W.x + 0.62, 3.0, W.z + z, Math.PI/2, 1.2, 3.6, BANNER, CREAM, kyber);   // on its back, over the edge
    K.sign('RUNNING WALL', W.x - 0.66, 4.3, W.z, -Math.PI/2, { w: 3.8 }); }

  /* ---------------- the BOLT RANGE — a raised gallery on the south edge where the training remotes hover ---------------- */
  { const F = HALL_SPOTS.range;
    K.box(0, F.z, F.hx, 1.6, 1.3, stoneD, { climbable: false });
    K.deco(new THREE.BoxGeometry(F.hx*2 + 0.06, 0.1, 3.26), trim, 0, 1.3, F.z);
    for (const sx of [-1, 0, 1]){
      const x = sx * 4.6;
      K.column(x, F.z - 0.4, 0.22, 2.6, trim, { wallKick: false, seg: 8, taper: 1 });
      K.deco(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.35, metalness: 0.8 }), x, 3.35, F.z - 0.4).userData.passThrough = true;
      K.deco(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5040 }), x, 3.35, F.z - 0.08).userData.passThrough = true;   // the remote's eye
    }
    K.sign('BOLT RANGE', 0, 0.66, F.z + 1.62, 0, { w: 3.6 }); }

  /* ---------------- the MEDITATION GARDEN — a still pool, a tree and stone benches in the south-east ---------------- */
  { const [gx, gz] = HALL_SPOTS.garden;
    for (const [dx, dz, hx, hz] of [[0, 2.3, 2.6, 0.2], [0, -2.3, 2.6, 0.2], [2.4, 0, 0.2, 2.1], [-2.4, 0, 0.2, 2.1]]) K.box(gx + dx, gz + dz, hx, hz, 0.3, stoneL, { climbable: true });
    flat(K.deco(new THREE.PlaneGeometry(4.6, 4.2), water, gx, 0.12, gz, -Math.PI/2));
    for (let i = 0; i < 5; i++) flat(K.deco(new THREE.CircleGeometry(0.22 + R() * 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x8ab47a, roughness: 0.8 }), gx - 1.6 + R() * 3.2, 0.14, gz - 1.4 + R() * 2.8, -Math.PI/2));
    const tx = gx + 4.6, tz = gz - 3.2;   // the tree, in a round planter
    K.column(tx, tz, 1.1, 0.55, stoneD, { wallKick: false, seg: 12, taper: 1 });
    K.column(tx, tz, 0.28, 3.4, wood, { wallKick: false, seg: 7, taper: 0.6 });
    for (const [dx, dy, dz, r] of [[0, 4.0, 0, 1.4], [0.9, 3.6, 0.5, 0.95], [-0.8, 3.7, -0.4, 1.0], [0.2, 4.7, -0.3, 0.9]])
      K.deco(new THREE.IcosahedronGeometry(r, 0), leaf, tx + dx, dy, tz + dz, R(), R(), R()).userData.passThrough = true;
    for (const [bx, bz] of [[gx - 1.2, gz + 4.2], [gx + 1.8, gz + 4.2]]){   // benches facing the pool
      K.box(bx, bz, 0.9, 0.3, 0.42, stoneL, { climbable: true });
      K.deco(new THREE.BoxGeometry(1.9, 0.06, 0.7), trim, bx, 0.45, bz);
    }
    for (const [cx, cz] of [[gx - 3.6, gz - 2.8], [gx - 4.0, gz + 1.6]]){   // kyber crystals growing from the stone
      K.column(cx, cz, 0.55, 0.3, stoneD, { wallKick: false, seg: 7, taper: 1 });
      for (let k = 0; k < 4; k++) K.deco(new THREE.ConeGeometry(0.12 + R() * 0.08, 0.8 + R() * 0.7, 5), glow, cx + (R() - 0.5) * 0.6, 0.6 + R() * 0.3, cz + (R() - 0.5) * 0.6, (R() - 0.5) * 0.6, 0, (R() - 0.5) * 0.6).userData.passThrough = true;
    }
    K.sign('MEDITATION GARDEN', gx, 2.5, gz + 4.6, 0, { w: 3.8 }); }

  /* ---------------- the SABER RACKS — practice blades on stands in the north-east ---------------- */
  { const [rx, rz] = HALL_SPOTS.racks;
    for (const dz of [-1.6, 1.6]){
      K.box(rx, rz + dz, 1.8, 0.25, 1.15, wood);
      K.deco(new THREE.BoxGeometry(3.7, 0.08, 0.6), trim, rx, 1.15, rz + dz);
      for (let k = 0; k < 6; k++){   // hilts standing in the rack, a training emitter glowing on each
        const x = rx - 1.5 + k * 0.6;
        K.deco(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.85 }), x, 1.42, rz + dz).userData.passThrough = true;
        K.deco(new THREE.SphereGeometry(0.05, 6, 4), glow, x, 1.7, rz + dz).userData.passThrough = true;
      }
    }
    K.sign('SABER RACKS', rx, 2.5, rz - 2.2, 0, { w: 3.2 }); }

  /* ---------------- the BALUSTRADE — a low parapet round the terrace's edge, the clouds beyond ---------------- */
  { const E = 23.4, gateGap = 6.6;
    const runX = (z, x0, x1) => { const hx = (x1 - x0) / 2; K.box((x0 + x1) / 2, z, hx, 0.22, 0.95, stone); K.deco(new THREE.BoxGeometry(hx*2 + 0.1, 0.12, 0.58), trim, (x0 + x1) / 2, 0.95, z); };
    const runZ = (x, z0, z1) => { const hz = (z1 - z0) / 2; K.box(x, (z0 + z1) / 2, 0.22, hz, 0.95, stone); K.deco(new THREE.BoxGeometry(0.58, 0.12, hz*2 + 0.1), trim, x, 0.95, (z0 + z1) / 2); };
    runX(E, -E, -gateGap); runX(E, gateGap, E); runX(-E, -E, E); runZ(E, -E, E); runZ(-E, -E, E);
    for (let k = -E; k <= E + 0.01; k += 5.85) for (const [x, z] of [[k, E], [k, -E], [E, k], [-E, k]]){
      if (z === E && Math.abs(x) < gateGap) continue;
      K.deco(new THREE.BoxGeometry(0.62, 1.25, 0.62), stoneD, x, 0.62, z);
      K.deco(new THREE.SphereGeometry(0.16, 8, 6), glow, x, 1.38, z).userData.passThrough = true;
    } }

  /* ---------------- COLUMNS and BANNERS — the hall's ring, slender (not runnable) and clear of every station ---------------- */
  for (let i = 0; i < 12; i++){
    const a = (i / 12) * Math.PI*2 + Math.PI/12, [x, z] = at(a, 20.2);
    if (z < -12 && x < -8) continue;                                                          // the tower's side
    if (x < -12 && z < 2) continue;                                                           // the run-out below the tower's drop
    if (Math.abs(x - HALL_SPOTS.wall.x) < 6 && Math.abs(z) < 9) continue;                     // behind the wall
    if (z > 17 && Math.abs(x) < 9) continue;                                                  // the gate
    if (Math.hypot(x - HALL_SPOTS.garden[0], z - HALL_SPOTS.garden[1]) < 6.5) continue;       // the garden
    if (z < -17 && Math.abs(x) < 9) continue;                                                 // the bolt range
    const h = 8.5 + R()*1.5;
    K.column(x, z, 0.65, h, stone, { taper: 0.9 });
    K.deco(new THREE.BoxGeometry(1.8, 0.35, 1.8), stoneD, x, 0.17, z);
    K.deco(new THREE.BoxGeometry(2.0, 0.4, 2.0), stoneD, x, h - 0.2, z);
    K.slab(x, z, 1.0, 1.0, h - 0.45, h);   // (the capital overhangs the shaft: stand on all of it)
    K.deco(new THREE.BoxGeometry(2.05, 0.08, 2.05), trim, x, h - 0.42, z);
    const n = Math.hypot(x, z), ry = Math.atan2(-x / n, -z / n);   // a banner on the side that faces the circle
    K.banner(x - x / n * 0.68, h - 3.2, z - z / n * 0.68, ry, 1.1, 3.8, BANNER, CREAM, kyber);
  }

  /* ---------------- BRAZIERS — four kyber fires on the circle's diagonals ---------------- */
  for (const [x, z] of [[-6.5, 9], [6.5, 9], [-6.5, -9], [6.5, -9]]){
    K.column(x, z, 0.4, 1.1, stoneD, { wallKick: false, seg: 8 });
    K.deco(new THREE.CylinderGeometry(0.62, 0.38, 0.3, 10), trim, x, 1.22, z);
    const f = K.deco(new THREE.ConeGeometry(0.34, 0.75, 8), flame, x, 1.72, z);
    f.userData.passThrough = true;
    K.deco(new THREE.SphereGeometry(0.3, 10, 8), glow, x, 1.5, z).userData.passThrough = true;
  }
  shared.templeBrazier = null;
}
