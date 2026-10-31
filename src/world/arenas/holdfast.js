// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena (the Mandalorian's story): THE OLD HOLDFAST, a ruined Mandalorian watch-fort in the cedar forest of Thane
// (data/campaign-mando.js: THE HOLDFAST and BRAKKA; data/missions.js holdfast).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* THE OLD HOLDFAST (half-size 30). A clearing in a cedar forest at misty dawn, and in it the ruin of a fort the clans
   built when they still held this world:
     · the WALLS: a square of old stone around the courtyard (x ±15, z −11 to 19), broken in places, with the GATE in the
       south wall (open for |x| < 4) where the hunters come at it;
     · the WATCHTOWER at the north wall, the courtyard's well and a fallen statue of a helmeted warrior inside;
     · the two SIGNAL CAIRNS out in the clearing (west and east of the gate), stone beacons to light for the ship;
     · the FOREST round the clearing: cedar trunks and their canopies, the hunters' camp in the south;
     · a scaffold on the east wall as the overwatch. The middle of the courtyard is open ground for a duel. */
export const HOLDFAST_SPOTS = {
  gate: [0, -11],
  hold: [0, -9],
  cairns: [[-20, -17], [20, -15]],
  walls: { x: 15, z0: -11, z1: 19, gap: 4 },
  tower: [0, 21.5],
};

export function buildHoldfastArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x8a8a7a, roughness: 0.95, flatShading: true });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x5e604e, roughness: 0.97, flatShading: true });
  const moss   = new THREE.MeshStandardMaterial({ color: pal.moss ?? 0x4a6a32, roughness: 1 });
  const bark   = new THREE.MeshStandardMaterial({ color: pal.bark ?? 0x4a3424, roughness: 1 });
  const leaf   = new THREE.MeshStandardMaterial({ color: pal.leaf ?? 0x2e4a2a, roughness: 1, flatShading: true });
  const leafL  = new THREE.MeshStandardMaterial({ color: pal.leafL ?? 0x3e5e32, roughness: 1, flatShading: true });
  const wood   = new THREE.MeshStandardMaterial({ color: pal.wood ?? 0x6a4e34, roughness: 0.9 });
  const beskar = new THREE.MeshStandardMaterial({ color: pal.beskar ?? 0xa8b0b8, roughness: 0.35, metalness: 0.88 });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46, roughness: 0.5, metalness: 0.7 });
  const cloth  = new THREE.MeshStandardMaterial({ color: pal.tent ?? 0x5a5a4a, roughness: 1, side: THREE.DoubleSide });
  const fire   = new THREE.MeshBasicMaterial({ color: pal.fire ?? 0xff8a3a });
  const ember  = new THREE.MeshBasicMaterial({ color: pal.ember ?? 0xffc060 });
  const water  = new THREE.MeshBasicMaterial({ color: pal.water ?? 0x1e3a3a });
  const K = arenaKit(), R = seeded(57), H = L.arena / 2, W = HOLDFAST_SPOTS.walls;
  const flame = (x, y, z, s = 1) => { for (let n = 0; n < 3; n++){
    const f = K.deco(new THREE.ConeGeometry(0.3*s, (0.8 + R()*0.5)*s, 7), n % 2 ? fire : ember, x + (n - 1)*0.35*s, y + 0.4*s, z + (R() - 0.5)*0.4*s);
    f.userData.noBake = true; f.userData.passThrough = true; f.castShadow = false; } };

  // ---- the WALLS: old stone, broken in places; the gate in the south wall ----
  const wall = (x0, z0, x1, z1) => {   // one straight run, in blocks of uneven height (some fallen to rubble)
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3.2)), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let i = 0; i < n; i++){
      const t0 = i / n, t1 = (i + 1) / n, cx = x0 + (x1 - x0)*(t0 + t1)/2, cz = z0 + (z1 - z0)*(t0 + t1)/2, half = len / n / 2;
      const r = R(), h = r < 0.16 ? 0.9 : 2.6 + R()*1.4;
      K.box(cx, cz, alongX ? half : 0.6, alongX ? 0.6 : half, h, R() < 0.5 ? stone : stoneD, { climbable: h < 1 });
      if (h > 1 && R() < 0.5) K.deco(new THREE.BoxGeometry(alongX ? half*2 + 0.02 : 1.24, 0.14, alongX ? 1.24 : half*2 + 0.02), moss, cx, h + 0.07, cz);
    }
  };
  wall(-W.x, W.z1, W.x, W.z1);                 // north
  wall(-W.x, W.z0, -W.x, W.z1);                // west
  wall(W.x, W.z0, W.x, W.z1);                  // east
  wall(-W.x, W.z0, -W.gap, W.z0);              // south, west of the gate
  wall(W.gap, W.z0, W.x, W.z0);                // south, east of the gate
  for (const sx of [-1, 1]){                   // the gate's posts, and the clan's mark over where the gate stood
    K.column(sx * (W.gap + 0.4), W.z0, 1.0, 5.2, stoneD, { seg: 8, taper: 0.9 });
    K.deco(new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI*2, 0, Math.PI/2), beskar, sx * (W.gap + 0.4), 5.2, W.z0);
  }
  K.deco(new THREE.BoxGeometry(2.6, 0.12, 2.6), stoneD, 0, 0.06, W.z0);   // the threshold

  // ---- the WATCHTOWER at the north wall, its top broken off ----
  { const [tx, tz] = HOLDFAST_SPOTS.tower;
    K.column(tx, tz, 3.2, 11, stone, { seg: 10, taper: 0.92 });
    K.deco(new THREE.TorusGeometry(3.0, 0.3, 6, 20), stoneD, tx, 7.5, tz, Math.PI/2);
    K.deco(new THREE.PlaneGeometry(1.4, 2.6), new THREE.MeshBasicMaterial({ color: 0x0a0a08 }), tx, 1.3, tz - 3.0, 0, Math.PI, 0);
    K.banner(tx, 5.2, tz - 3.0, Math.PI, 1.8, 2.6, 0x3a3a2a, 0xa8b0b8, 0xa8b0b8); }

  // ---- the COURTYARD: the well, a fallen statue, the camp Brakka kept, braziers ----
  K.column(-7, 11, 1.5, 0.9, stoneD, { wallKick: false, seg: 12, taper: 1 });
  K.deco(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 12), water, -7, 0.88, 11);
  for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.16, 2.0, 0.16), wood, -7 + sx*1.3, 1.9, 11);
  K.deco(new THREE.BoxGeometry(2.9, 0.16, 0.16), wood, -7, 2.9, 11).userData.passThrough = true;
  // the statue of a helmeted warrior, toppled across the courtyard's west side: its plinth, its body, its helmet
  K.box(-9, 4, 1.4, 1.4, 1.2, stoneD);
  K.rubble(-9.4, -0.6, 5.0, 0.9, stone, false);
  K.column(-9.6, -4.2, 1.0, 1.6, stone, { wallKick: false, seg: 10, taper: 1 });
  K.deco(new THREE.BoxGeometry(1.2, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0x141414 }), -9.6, 1.2, -5.19);   // its T-visor, face to the gate
  K.deco(new THREE.BoxGeometry(0.18, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: 0x141414 }), -9.6, 0.92, -5.19);
  // Brakka's camp by the tower: a bedroll, a cookfire, ammunition crates
  K.box(-8, 15.8, 1.0, 0.7, 1.0, wood, { climbable: true });
  K.box(-5.4, 16.2, 0.7, 0.7, 0.8, wood, { climbable: true });
  K.column(5, 14, 0.8, 0.4, stoneD, { wallKick: false, seg: 10, taper: 1.1 });
  flame(5, 0.4, 14, 0.8);
  for (const [x, z] of [[-11, -6], [11, -6], [-11, 15], [11, 15]]){   // braziers
    K.column(x, z, 0.55, 1.2, stoneD, { wallKick: false, seg: 8, taper: 1.15 });
    flame(x, 1.2, z, 0.8);
  }
  K.rubble(-3, 4, 3.4, 0.55, stoneD, true);   // fallen stones you step over
  K.rubble(5, -5, 2.6, 0.5, stone, false);

  // ---- the SIGNAL CAIRNS out in the clearing: stacked stone, a fire bowl on top, cold until lit ----
  for (const [x, z] of HOLDFAST_SPOTS.cairns){
    K.column(x, z, 1.4, 1.4, stoneD, { seg: 8, taper: 0.8 });
    K.column(x, z, 0.9, 2.6, stone, { seg: 8, taper: 0.75 });
    K.deco(new THREE.CylinderGeometry(0.9, 0.6, 0.4, 10), beskar, x, 2.8, z);
    solids.push({ x, z, r: 0.9, y0: 2.6, h: 3.0 });
  }

  // ---- the HUNTERS' CAMP in the south of the clearing: a pre-fab shelter, a speeder, a comms mast ----
  K.box(-6, -24, 3.0, 2.0, 2.4, imp);
  K.deco(new THREE.BoxGeometry(6.2, 0.3, 4.2), imp, -6, 2.55, -24);
  K.box(7, -25, 2.0, 0.8, 1.0, imp, { climbable: true });
  K.deco(new THREE.BoxGeometry(1.0, 0.3, 1.2), imp, 7.8, 1.15, -25);
  K.column(13, -22, 0.25, 6.5, imp, { wallKick: false, seg: 6, taper: 0.5 });
  K.deco(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a }), 13, 6.7, -22);
  for (const [x, z] of [[-1, -21], [2, -27]]) K.box(x, z, 0.7, 0.7, 1.0, wood, { climbable: true });

  // ---- the FOREST: cedar trunks round the clearing, canopies high over them ----
  const keep = [[0, 4, 17.5], [...HOLDFAST_SPOTS.cairns[0], 4.5], [...HOLDFAST_SPOTS.cairns[1], 4.5], [-6, -24, 5], [7, -25, 4], [0, -18, 6], [22, 22, 6]];
  const clear = (x, z, r) => keep.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + r);
  let n = 0;
  for (let i = 0; i < 160 && n < 34; i++){
    const x = (R()*2 - 1) * (H - 1.5), z = (R()*2 - 1) * (H - 1.5);
    if (Math.hypot(x, z - 4) < 19 || !clear(x, z, 1.2)) continue;
    if (Math.abs(x) < 6 && z < -10) continue;   // the lane the hunters come up to the gate
    const r = 0.5 + R()*0.4, h = 17.5 + R()*5, top = h - 1.2, cr = 2.6 + R()*1.4;   // tall cedars: the canopy is out of anyone's reach
    K.column(x, z, r, h, bark, { seg: 8, taper: 0.7 });
    const c = K.deco(new THREE.ConeGeometry(cr, 4.6, 8), R() < 0.5 ? leaf : leafL, x, top + 2.3, z);
    c.rotation.y = R() * 3;
    K.deco(new THREE.ConeGeometry(cr*0.75, 3.4, 8), leafL, x, top + 4.6, z);
    keep.push([x, z, 1.2]); n++;
  }
  // the forest wall past the clearing's edge
  for (let a = 0; a < Math.PI*2; a += 0.21){
    const d = (H + 3 + R()*3) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))), x = Math.cos(a)*d, z = Math.sin(a)*d, h = 12 + R()*6;   // (out past the square's edge, corners too)
    K.deco(new THREE.CylinderGeometry(0.6, 0.8, h, 7), bark, x, h/2, z);
    K.deco(new THREE.ConeGeometry(3.6 + R(), 7, 8), R() < 0.5 ? leaf : leafL, x, h + 1.5, z);
  }

  // ---- the OVERWATCH scaffold against the east wall, inside ----
  K.gantry(11, 8, { a: wood, b: stoneD, strut: wood, beacon: pal.fire ?? 0xff8a3a }, [-1, 1]);

  // ---- the hunters' fuel cells, dumped by their camp ----
  for (const [x, z] of [[-11, -22], [4, -20], [17, -24]]) spawnBarrel(V3(x, 0, z));
  void cloth;
}
