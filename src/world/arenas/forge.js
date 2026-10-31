// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Training arena (Mandalorian): the Armorer's forge, an open covert yard under the night sky.

import * as THREE from 'three';
import { solids } from '../../state.js';
import { arenaKit, seeded, at } from './kit.js';

/* THE ARMORER'S FORGE (half-size 24). The covert's yard in a canyon, laid out as stations round the forge, each one
   the surface a lesson needs (data/tutorial.js names the spots; game/tutorial.js walks the player through them).
   Hazard-striped lanes lead from the covert door to each station, and a sign over each names it.
     · the COVERT DOOR on the north edge, behind the spawn: a round blast door in the rock with the clan's signet;
     · the FORGE in the centre: the hearth and its molten crucible under a hood on four posts, anvils and a quench tank;
     · the CRATE ROW on the west lane: low beskar crates (under vaultHeight) to climb over, and the SLIDE GATE on the
       north lane (a low bar to slide under, the course's first stop);
     · the LOOKOUT in the south-east: the three-tier overwatch gantry, the jetpack's first climb;
     · the FIRING LINE on the south: a low sandbag wall to shoot over, and the RANGE beyond it, closed by a plated berm
       with the targets' silhouettes on it;
     · the ARMOURY racks in the north-east and the INGOT STORE in the south-west, a fence of lamp posts round the yard.
   The player spawns north (0, +12), facing the forge. */
export const FORGE_SPOTS = {
  forge: [0, 0],
  crates: { x: -11, z: [4, -1] },
  lookout: [10, -12],   // gantry base; the deck (7.7) sits at +3.6, +2.6 from it
  line: { z: -8.5, hx: 7 },
  berm: { z: -20, hx: 9 },
  gate: [-7, 11],       // the slide gate on the north lane (the agility course's first stop)
  armoury: [15.5, 13],
  ingots: [-16, -14],
};

export function buildForgeArena(L){
  const pal = L.pal || {};
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5a6068, roughness: 0.55, metalness: 0.75 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x2e3238, roughness: 0.6, metalness: 0.7 });
  const beskar = new THREE.MeshStandardMaterial({ color: pal.beskar ?? 0xa8b0b8, roughness: 0.32, metalness: 0.9 });
  const sand   = new THREE.MeshStandardMaterial({ color: pal.sand ?? 0x7a6650, roughness: 0.95, metalness: 0.02 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6, metalness: 0.5 });
  const rock   = new THREE.MeshStandardMaterial({ color: 0x3a2c28, roughness: 0.95, metalness: 0.02, flatShading: true });
  const molten = new THREE.MeshBasicMaterial({ color: pal.molten ?? 0xff7a1e, fog: false });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.beacon ?? 0xff8a3a });
  const ORANGE = pal.stripe ?? 0xd9a43a, CLOTH = 0x5a2a20;
  const K = arenaKit(), R = seeded(41);
  const SIGN = { ink: '#ffcf8a', edge: 'rgba(255,160,70,.9)', plate: 'rgba(20,12,10,.85)' };
  const pic = (m) => { m.userData.passThrough = true; return m; };

  /* ---------------- the FORGE — a round hearth with a molten crucible, a hood on four posts, anvils, a quench tank ---------------- */
  K.column(0, 0, 2.0, 1.3, metalD, { wallKick: false, seg: 14, taper: 1.05 });
  K.deco(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 16), molten, 0, 1.33, 0);
  K.deco(new THREE.TorusGeometry(1.55, 0.14, 8, 18), stripe, 0, 1.36, 0, Math.PI/2);
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]){
    K.column(x, z, 0.18, 5.6, metalD, { wallKick: false, seg: 6, taper: 1 });
    pic(K.deco(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 4), metal, x * 0.62, 4.4, z * 0.62));   // chains down to the crucible's rim
  }
  K.deco(new THREE.CylinderGeometry(1.1, 2.6, 1.4, 4, 1, true), metal, 0, 6.2, 0, 0, Math.PI/4).material.side = THREE.DoubleSide;
  K.deco(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 10), metalD, 0, 8.0, 0);
  K.slab(0, 0, 2.0, 2.0, 5.5, 6.9);                     // the hood over the hearth: walk under it, land on it
  solids.push({ x: 0, z: 0, r: 0.7, y0: 6.8, h: 9.2 });   // and its flue
  for (const [x, z, r] of [[3.6, 1.2, 0.3], [-3.4, -1.6, -0.5]]){
    K.box(x, z, 0.5, 0.32, 0.55, metalD);
    K.deco(new THREE.BoxGeometry(1.5, 0.3, 0.55), beskar, x, 0.7, z, 0, r, 0);
  }
  K.column(-3.2, 2.4, 0.75, 0.9, metalD, { wallKick: false, seg: 12, taper: 1 });   // the quench tank
  K.deco(new THREE.CylinderGeometry(0.66, 0.66, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0x2a4a5a }), -3.2, 0.9, 2.4);
  for (let i = 0; i < 6; i++){   // the glow of the hearth spilling over the floor
    const [x, z] = at(i / 6 * Math.PI*2, 2.7);
    pic(K.deco(new THREE.CircleGeometry(0.16, 8), molten, x, 0.03, z, -Math.PI/2));
  }
  K.sign('THE FORGE', 0, 9.6, 0, Math.PI, { ...SIGN, w: 3.2 });

  /* ---------------- the COVERT DOOR — a round blast door in the rock behind the spawn ---------------- */
  K.box(0, 23.0, 9.5, 1.0, 9, rock);
  for (const sx of [-1, 1]) K.box(sx * 12.5, 22.4, 3.5, 1.6, 7 + R() * 2, rock);
  pic(K.deco(new THREE.CylinderGeometry(3.6, 3.6, 0.4, 28), metalD, 0, 4.0, 21.95, Math.PI/2));   // (set into the rock face)
  pic(K.deco(new THREE.TorusGeometry(3.6, 0.22, 8, 32), stripe, 0, 4.0, 21.75));
  pic(K.deco(new THREE.TorusGeometry(1.2, 0.12, 6, 24), beskar, 0, 4.4, 21.72));   // the signet: a ring and two horns
  for (const sx of [-1, 1]) pic(K.deco(new THREE.ConeGeometry(0.22, 1.4, 6), beskar, sx * 0.85, 5.6, 21.72, 0, 0, -sx * 0.5));
  pic(K.deco(new THREE.BoxGeometry(7.0, 0.14, 0.1), stripe, 0, 4.0, 21.7));
  K.sign('THE ARMORER\'S FORGE', 0, 8.6, 21.9, Math.PI, { ...SIGN, w: 5.6 });

  /* ---------------- the LANES — hazard strips from the door to each station ---------------- */
  const lane = (pts) => { for (let i = 1; i < pts.length; i++) K.strip(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1], 0.14, ORANGE, 0.5); };
  lane([[0, 19], [0, 3.2]]);
  lane([[-1.2, 16], [-7, 13], [-11, 7]]);
  lane([[2.4, -2.6], [9.2, -9.6]]);
  lane([[0, -3.2], [0, -7.6]]);
  for (const x of [-13.2, -8.8]) K.strip(x, 7, x, -4, 0.08, ORANGE, 0.5);

  /* ---------------- the CRATE ROW — low beskar crates across the west lane ---------------- */
  for (const z of FORGE_SPOTS.crates.z){
    K.box(FORGE_SPOTS.crates.x, z, 1.7, 0.45, 1.0, metal);
    K.deco(new THREE.BoxGeometry(3.45, 0.08, 0.95), stripe, FORGE_SPOTS.crates.x, 0.55, z);
  }
  K.sign('CRATE ROW', -11, 3.8, 7.6, 0, { ...SIGN, w: 3.0 });

  /* ---------------- the LOOKOUT — the overwatch gantry, the first place the jetpack takes you ---------------- */
  K.gantry(FORGE_SPOTS.lookout[0], FORGE_SPOTS.lookout[1], { a: metalD, b: metal, strut: stripe, beacon: pal.beacon ?? 0xff8a3a });
  K.sign('LOOKOUT', 13.6, 10.2, -9.4, 0, { ...SIGN, w: 2.8 });

  /* ---------------- the FIRING LINE — a low sandbag wall (cover you shoot over) facing the range ---------------- */
  { const F = FORGE_SPOTS.line;
    K.box(0, F.z, F.hx, 0.45, 0.95, sand, { climbable: false });
    for (let i = 0; i < 9; i++) K.deco(new THREE.CapsuleGeometry(0.28, 1.1, 2, 6), sand, -F.hx + 0.8 + i * (F.hx*2 - 1.6) / 8, 1.05, F.z, 0, 0, Math.PI/2);
    K.sign('FIRING LINE', 0, 0.55, F.z + 0.47, 0, { ...SIGN, w: 2.6 }); }
  // the RANGE: a plated berm closes it, the targets' silhouettes painted on the plates, a lamp at each end
  { const B = FORGE_SPOTS.berm;
    K.box(0, B.z, B.hx, 0.8, 2.8, metalD);
    K.deco(new THREE.BoxGeometry(B.hx*2 + 0.1, 0.12, 1.7), stripe, 0, 2.8, B.z);
    for (let k = -3; k <= 3; k++){
      pic(K.deco(new THREE.BoxGeometry(2.4, 2.4, 0.04), metal, k * 2.55, 1.35, B.z + 0.82));
      pic(K.deco(new THREE.RingGeometry(0.42, 0.56, 16), new THREE.MeshBasicMaterial({ color: 0xc8402a, side: THREE.DoubleSide }), k * 2.55, 1.7, B.z + 0.85));
      pic(K.deco(new THREE.CircleGeometry(0.14, 10), new THREE.MeshBasicMaterial({ color: 0xc8402a }), k * 2.55, 1.7, B.z + 0.86));
    }
    for (const sx of [-1, 1]){
      K.column(sx * (B.hx + 0.6), B.z, 0.2, 3.6, metalD, { wallKick: false, seg: 6, taper: 1 });
      pic(K.deco(new THREE.SphereGeometry(0.22, 8, 6), lamp, sx * (B.hx + 0.6), 3.75, B.z));
    }
    K.sign('THE RANGE', 0, 3.9, B.z + 0.4, 0, { ...SIGN, w: 3.0 }); }

  /* ---------------- the SLIDE GATE — a low hazard-striped bar across the north lane ---------------- */
  K.slideGate(FORGE_SPOTS.gate[0], FORGE_SPOTS.gate[1], 1.6, metalD, stripe);
  K.sign('SLIDE', FORGE_SPOTS.gate[0], 2.35, FORGE_SPOTS.gate[1], Math.PI/2, { ...SIGN, w: 1.6, size: 64 });

  /* ---------------- the ARMOURY — weapon racks in the north-east ---------------- */
  { const [ax, az] = FORGE_SPOTS.armoury;
    for (const dx of [-1.8, 1.8]){
      K.box(ax + dx, az, 0.3, 1.6, 2.2, metalD);
      for (let k = 0; k < 4; k++){   // rifles and blasters standing in the rack
        const z = az - 1.2 + k * 0.8;
        pic(K.deco(new THREE.BoxGeometry(0.12, 1.3, 0.16), metal, ax + dx - Math.sign(dx) * 0.36, 1.3, z, 0, 0, -Math.sign(dx) * 0.12));
        pic(K.deco(new THREE.BoxGeometry(0.08, 0.3, 0.1), stripe, ax + dx - Math.sign(dx) * 0.4, 1.9, z));
      }
    }
    K.banner(ax, 3.1, az + 1.62, 0, 1.4, 2.4, CLOTH, ORANGE, 0xd8d0c8);
    K.box(ax, az + 1.62, 2.1, 0.08, 4.1, metalD);   // the banner's frame
    K.sign('ARMOURY', ax, 4.6, az - 1.7, 0, { ...SIGN, w: 2.6 }); }

  /* ---------------- the INGOT STORE — beskar stacked on pallets in the south-west ---------------- */
  { const [ix, iz] = FORGE_SPOTS.ingots;
    for (const [dx, dz] of [[0, 0], [2.6, -0.6], [-0.6, 2.4]]){
      K.box(ix + dx, iz + dz, 1.0, 0.7, 0.75, sand, { climbable: true });   // a pallet of sacks and ingots, waist-high
      for (let k = 0; k < 3; k++) K.deco(new THREE.BoxGeometry(0.5, 0.18, 1.1), beskar, ix + dx - 0.6 + k * 0.6, 0.84, iz + dz);
    }
    K.column(ix + 3.4, iz + 2.6, 0.55, 1.1, metalD, { wallKick: false, seg: 10, taper: 1 });   // drums
    K.column(ix + 4.4, iz + 2.2, 0.55, 1.1, metal, { wallKick: false, seg: 10, taper: 1 });
    K.sign('INGOTS', ix + 1.2, 2.4, iz + 3.7, 0, { ...SIGN, w: 2.2 }); }

  /* ---------------- the FENCE — lamp posts and a low rail round the yard (the canyon walls beyond) ---------------- */
  { const E = 23.2;
    for (let k = -E; k <= E + 0.01; k += 4.64) for (const [x, z] of [[k, -E], [E, k], [-E, k]]){
      K.column(x, z, 0.14, 2.6, metalD, { wallKick: false, seg: 6, taper: 1 });
      pic(K.deco(new THREE.BoxGeometry(0.34, 0.22, 0.34), lamp, x, 2.7, z));
    }
    const rail = (x, z, hx, hz) => { K.box(x, z, hx, hz, 0.9, metalD); K.deco(new THREE.BoxGeometry(hx*2 + 0.04, 0.1, hz*2 + 0.04), stripe, x, 0.9, z); };
    rail(0, -E, E, 0.12); rail(E, 2, 0.12, E - 2); rail(-E, 2, 0.12, E - 2); }

  /* ---------------- quench tanks and crates round the edge (all solid, none in a lane) ---------------- */
  for (let i = 0; i < 8; i++){
    const a = (i / 8) * Math.PI*2 + Math.PI/8, [x, z] = at(a, 19.2);
    if (Math.hypot(x - FORGE_SPOTS.lookout[0], z - FORGE_SPOTS.lookout[1]) < 7) continue;
    if (Math.hypot(x - FORGE_SPOTS.armoury[0], z - FORGE_SPOTS.armoury[1]) < 5) continue;
    if (Math.hypot(x - FORGE_SPOTS.ingots[0], z - FORGE_SPOTS.ingots[1]) < 6) continue;
    if (z > 15 && Math.abs(x) < 10) continue;   // the door
    if (i % 2){
      K.column(x, z, 1.1, 1.6, metalD, { wallKick: false, seg: 12, taper: 1 });   // quench tank
      K.deco(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 12), new THREE.MeshBasicMaterial({ color: 0x2a4a5a }), x, 1.62, z);
    } else {
      const ax = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
      K.box(x, z, ax ? 0.5 : 1.6, ax ? 1.6 : 0.5, 2.2 + R()*0.4, metal);              // ingot rack
      for (let k = 0; k < 3; k++) K.deco(new THREE.BoxGeometry(ax ? 0.9 : 2.8, 0.14, ax ? 2.8 : 0.9), beskar, x, 0.6 + k*0.6, z);
    }
  }
}
