// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: the rebel hangar cut into the glacier on Hoth, emptied for the last transports (chapter TRIAL OF THE KNIGHT).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones, solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* THE HANGAR CAVE (half-size 24). The base's last hangar, half packed up: a duelling floor with its cover pushed to the
   walls, so a blade-to-blade fight has room in the middle and somewhere to break off at the edges.
     · the CAVE WALLS just past the edge: ice slabs and rock, steel arches holding the roof up, the hangar's lit blast
       door in the north;
     · the HANGAR MOUTH in the south, behind the player: the magnetic shield's blue curtain across it, the snowfield
       and the evening beyond;
     · two parked SNOWSPEEDERS (hull 1.2, vault them; the wings hold you too), east and west of centre;
     · CARGO PODS stacked by the walls (2.4: hard cover, wall-kick faces) and a COOLANT TANK to kick off;
     · a maintenance gantry in the north-east (the overwatch climb);
     · the roof SHEDS ICE: two marked spots where it comes down on a slow, telegraphed cycle;
     · supply crates you step over, fuel drums.
   The player comes in from the south (z +12), facing the blast door. */
export const HANGAR = { half: 24, wallH: 12 };

export function buildHangarArena(L){
  const pal = L.pal || {};
  const ice    = new THREE.MeshStandardMaterial({ color: pal.ice ?? 0x9ab4cc, roughness: 0.35, metalness: 0.1 });
  const iceD   = new THREE.MeshStandardMaterial({ color: pal.iceD ?? 0x6e88a4, roughness: 0.5 });
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x5a6474, roughness: 0.95 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x8a929c, roughness: 0.6, metalness: 0.4 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x4a525c, roughness: 0.65, metalness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd06a2a, roughness: 0.6 });
  const pod    = new THREE.MeshStandardMaterial({ color: pal.pod ?? 0xb0aa9a, roughness: 0.8 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x6a5a48, roughness: 0.9 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const shield = new THREE.MeshBasicMaterial({ color: pal.shield ?? 0x7ad8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const snowO  = new THREE.MeshBasicMaterial({ color: pal.outside ?? 0xc8d4e0, fog: false, side: THREE.DoubleSide });
  const skyO   = new THREE.MeshBasicMaterial({ color: pal.dusk ?? 0x5a6e8a, fog: false, side: THREE.DoubleSide });
  const mark   = new THREE.MeshBasicMaterial({ color: pal.mark ?? 0xd06a2a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const K = arenaKit(), R = seeded(57);
  const H = HANGAR.half, W = HANGAR.wallH, off = H + 1.0;

  // ---- the CAVE WALLS: ice and rock slabs, steel arches; the blast door north, the open mouth south ----
  for (const side of ['n', 's', 'e', 'w']){
    const ns = side === 'n' || side === 's', sz = side === 'n' || side === 'w' ? -1 : 1, len = H*2 + 2.6;
    const put = (geo, mat, a, y, d, ry = 0) => ns ? K.deco(geo, mat, a, y, sz*d, 0, ry, 0) : K.deco(geo, mat, sz*d, y, a, 0, Math.PI/2 + ry, 0);
    if (side === 's'){
      // the hangar mouth: rock shoulders either side, the shield's curtain across, the snowfield beyond
      for (const sa of [-1, 1]) put(new THREE.BoxGeometry(10, W, 3), rock, sa*(H - 3), W/2, off + 1.2);
      put(new THREE.BoxGeometry(len, 2.5, 3), rock, 0, W - 1.25, off + 1.2);
      put(new THREE.PlaneGeometry(H*2 - 16, W - 2.5), shield, 0, (W - 2.5)/2, off);
      put(new THREE.PlaneGeometry(200, 18), skyO, 0, 9, off + 70);
      put(new THREE.PlaneGeometry(200, 70), snowO, 0, -0.05, off + 35).rotation.x = -Math.PI/2;
      continue;
    }
    // ice slabs in front of the rock, uneven, so the wall reads as a cave and not a room
    put(new THREE.BoxGeometry(len, W, 1.2), rock, 0, W/2, off + 1.0);
    for (let a = -H; a < H; a += 3.2){
      const h = W*(0.55 + R()*0.45), d = off + 0.2 + R()*0.4;
      put(new THREE.BoxGeometry(3.4, h, 0.9), R() < 0.5 ? ice : iceD, a + 1.6, h/2, d, (R() - 0.5)*0.2);
      if (R() < 0.45) put(new THREE.ConeGeometry(0.25, 1.6 + R(), 5), ice, a + R()*3, W*0.9, off - 0.2);   // icicles off the lip
    }
    // the steel arches that hold the roof up
    for (let a = -H + 4; a <= H - 4 + 0.01; a += 8){
      put(new THREE.BoxGeometry(0.7, W, 0.7), metalD, a, W/2, off - 0.3);
      put(new THREE.BoxGeometry(0.35, W*0.8, 0.1), stripe, a, W*0.4, off - 0.7);
      put(new THREE.SphereGeometry(0.22, 8, 6), lamp, a, W*0.55, off - 0.75).userData.noBake = true;
    }
    if (side === 'n'){   // the blast door into the base, lit
      put(new THREE.BoxGeometry(10, 7, 0.6), metalD, 0, 3.5, off - 0.2);
      put(new THREE.PlaneGeometry(8, 0.3), lamp, 0, 7.3, off - 0.55);
      for (let k = -4; k <= 4; k += 2) put(new THREE.BoxGeometry(0.2, 6.6, 0.1), metal, k, 3.3, off - 0.55);
    }
  }
  // the roof's steel ribs, high overhead (the dark above them is the cave's vault)
  for (const z of [-16, -6, 4, 14]){ K.deco(new THREE.BoxGeometry(H*2 + 2.4, 0.9, 0.7), metalD, 0, W + 0.2, z); K.slab(0, z, H, 0.35, W - 0.25, W + 0.65); }

  // ---- the SNOWSPEEDERS: a low hull and stubby wings you vault, a gun pod at the nose ----
  for (const [x, z, f] of [[-12, -2, 1], [12, 1, -1]]){
    K.box(x, z, 1.3, 2.6, 1.2, metal);
    K.deco(new THREE.BoxGeometry(4.6, 0.22, 1.6), metal, x, 0.95, z + 0.4);
    solids.push({ x, z: z + 0.4, hx: 2.3, hz: 0.8, h: 1.25, box: true });   // the wings stick out past the hull
    K.deco(new THREE.BoxGeometry(1.0, 0.4, 0.9), stripe, x, 1.35, z - 1.4*f);
    K.deco(new THREE.BoxGeometry(1.6, 0.3, 1.4), metalD, x, 1.35, z + 0.8*f);
    for (const sx of [-1, 1]) K.deco(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6), metalD, x + sx*1.9, 0.7, z + 0.4, Math.PI/2, 0, 0);   // gun pods under the wings
  }

  // ---- CARGO PODS by the walls, and the COOLANT TANK ----
  const podAt = (x, z, hx, hz, y = 0) => {
    K.box(x, z, hx, hz, 2.4, pod, { y });
    K.deco(new THREE.BoxGeometry(hx*2 + 0.06, 0.24, hz*2 + 0.06), stripe, x, y + 1.9, z);
  };
  podAt(-18, -16, 1.6, 1.6); podAt(-14.6, -17.5, 1.4, 1.4); podAt(-18, -16, 1.4, 1.4, 2.4);
  podAt(18, 12, 1.6, 1.6); podAt(16, 15.6, 1.4, 1.4);
  podAt(-19, 10, 1.5, 2.6);
  K.column(17, -6, 1.4, 4.4, metal, { seg: 14, taper: 1 });
  K.deco(new THREE.CylinderGeometry(1.45, 1.45, 0.3, 14), stripe, 17, 3.2, -6);
  K.deco(new THREE.CylinderGeometry(0.9, 1.4, 0.6, 14), metalD, 17, 4.7, -6);

  // ---- the maintenance GANTRY (the overwatch climb) in the north-east ----
  K.gantry(19, -20, { a: metalD, b: metal, strut: stripe, beacon: pal.lamp ?? 0xffc070 }, [-1, 1]);

  // ---- the roof SHEDS ICE: two marked spots under the ribs where it comes down ----
  [[-7, -6], [8, -16]].forEach(([x, z], i) => {
    K.deco(new THREE.RingGeometry(1.8, 2.1, 24), mark, x, 0.03, z, -Math.PI/2);
    K.deco(new THREE.ConeGeometry(0.5, 2.2, 6), ice, x, W - 1.1, z, Math.PI, 0, 0).castShadow = false;
    hazardZones.push({ kind: 'point', cx: x, cz: z, r: 2.0, period: 10, warnDur: 1.6, activeDur: 0.8, dmg: 16, color: pal.shed ?? 0xbfe8ff, flash: true, t: i * 5 });
  });

  // ---- supply crates you step over, fuel drums ----
  for (const [x, z, s] of [[-5, 7, 0.45], [6, -3, 0.4], [-20, -4, 0.5], [9, 20, 0.45], [-8, -20, 0.45], [21, 4, 0.4]]){
    K.box(x, z, s, s, s*1.4, crate, { climbable: true });
  }
  for (const [x, z] of [[-21, 3], [21, -12], [-10, 20]]) spawnBarrel(V3(x, 0, z));
}
