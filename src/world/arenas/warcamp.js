// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the Marshal's war camp, a purge company's fortress on a cold plateau (the ARC trooper's THE
// MARSHAL'S GARRISON, data/missions.js warcamp). The band takes the gate, holds it, and pushes for his command post.

import * as THREE from 'three';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';

/* THE WAR CAMP (64 across, half 32), on a grey plateau at dusk.
     · the APPROACH in the south (z −32…−12): rocks and the band's dropped supply crates;
     · the CAMP WALL across the plateau at z −10 (4 m), with the GATE in the middle (x −5…5, two gate towers to climb)
       and breaches at both ends (|x| > 26), so it never makes one choke;
     · the YARD inside: two BARRACKS blocks (hard cover), sandbag lines (1.6), stacked ammo crates, a walker's
       repair frame in the west;
     · the COMMAND POST in the north: a raised deck (a step up) under the comms mast, where the Marshal gives his orders.
   Every lane between solids is at least 3 m. */
export const WARCAMP_SPOTS = {
  start: [0, -26, 0],       // below the wall, facing the gate
  gate: [0, -7],            // just inside the gate
  command: [0, 19],         // the command post's deck
  duel: [0, 12],            // where the Marshal comes down to meet you
};

export function buildWarcampArena(L){
  const pal = L.pal || {};
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0x4a4e54, roughness: 0.85, metalness: 0.2 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x2a2e34, roughness: 0.9 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x6a7078, roughness: 0.55, metalness: 0.5 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x2e3238, roughness: 0.6, metalness: 0.45 });
  const sand   = new THREE.MeshStandardMaterial({ color: pal.sand ?? 0x6a6250, roughness: 1 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x4a4a42, roughness: 0.85 });
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x5a5a5e, roughness: 0.95 });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffe0b0 });
  const cloth  = pal.cloth ?? 0x8a1a1a;
  const K = arenaKit(), R = seeded(97);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the APPROACH: rocks and the band's dropped crates ----
  for (const [x, z, r] of [[-18, -22, 2.2], [20, -26, 2.6], [-27, -19, 1.8], [10, -18, 1.6]]){
    K.column(x, z, r, 1.9, rock, { seg: 7, taper: 0.8 });
  }
  for (const [x, z, ax] of [[-8, -20, 1], [24, -16, 0], [-4, -29, 1]]) K.box(x, z, ax ? 2.2 : 1.1, ax ? 1.1 : 2.2, 1.6, crate);
  for (const [x, z] of [[4, -24], [-14, -28]]) spawnBarrel(V3(x, 0, z));

  // ---- the CAMP WALL, the GATE and its towers ----
  for (const [x0, x1] of [[-26, -5], [5, 26]]){
    K.box((x0 + x1) / 2, -10, (x1 - x0) / 2, 0.6, 4, wall);
    picture(K.deco(new THREE.BoxGeometry(x1 - x0, 0.3, 1.25), wallD, (x0 + x1) / 2, 4.1, -10));
    for (let x = x0 + 2.5; x < x1 - 1; x += 3.5) picture(K.deco(new THREE.BoxGeometry(0.9, 0.5, 1.25), wallD, x, 4.45, -10));   // the battlements
  }
  for (const sx of [-1, 1]){   // the gate towers: step up from the inside (a crate), stand over the gate
    K.box(sx * 6.4, -10, 1.4, 1.4, 5.0, wallD);
    K.box(sx * 6.4, -7.4, 1.0, 0.9, 1.3, crate, { climbable: true });
    K.box(sx * 6.4, -6.2, 0.6, 0.5, 2.6, crate, { climbable: true });
    picture(K.deco(new THREE.BoxGeometry(0.3, 0.3, 0.3), red, sx * 6.4, 5.3, -10));
    K.banner(sx * 6.4, 3.4, -11.45, Math.PI, 1.6, 2.4, cloth, 0x1a1a1a);
  }
  picture(K.deco(new THREE.BoxGeometry(10, 0.6, 1.4), metalD, 0, 4.6, -10));   // the gate's lintel (overhead)
  for (const sx of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(4.6, 0.12, 0.12), metalD, sx * 2.6, 0.06, -10));   // the blown gate's rails

  // ---- the YARD: barracks, sandbag lines, crates, the walker's frame ----
  for (const sx of [-1, 1]){
    K.box(sx * 17, 6, 4.5, 2.6, 3.4, wall);
    K.deco(new THREE.BoxGeometry(9.4, 0.3, 5.6), wallD, sx * 17, 3.55, 6);
    for (const k of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(1.4, 0.4, 0.05), lamp, sx * 17 + k * 2.6, 2.6, 3.37));
  }
  for (const [x, z, ax] of [[-8, -1, 1], [8, -1, 1], [0, 8, 1], [-24, 18, 0], [24, 18, 0], [-10, 16, 0], [10, 16, 0]])
    K.box(x, z, ax ? 2.4 : 0.6, ax ? 0.6 : 2.4, 1.6, sand);
  for (const [x, z] of [[26, -4], [-6, 25], [14, 26]]){ K.box(x, z, 0.9, 0.9, 2.2, crate); K.box(x + 1.6, z - 0.3, 0.8, 0.8, 1.1, crate); }
  { const fx = -25, fz = 4;   // the walker's repair frame: two legs and a crossbeam (a climb), a dead walker leg hanging in it
    for (const s of [-1, 1]) K.column(fx, fz + s * 3, 0.5, 6, metalD, { seg: 6, taper: 1 });
    picture(K.deco(new THREE.BoxGeometry(1.2, 0.8, 7.2), metal, fx, 6.2, fz));
    picture(K.deco(new THREE.CylinderGeometry(0.45, 0.6, 3.6, 8), metal, fx, 3.6, fz)); }
  for (const [x, z] of [[22, 0], [-14, -4]]) spawnBarrel(V3(x, 0, z));

  // ---- the COMMAND POST: a raised deck under the comms mast ----
  { const [cx, cz] = WARCAMP_SPOTS.command;
    K.box(cx, cz + 2, 6, 3.5, 1.2, metal, { climbable: true });
    K.box(cx - 4.5, cz + 4.6, 1.2, 0.6, 1.5, metalD); K.box(cx + 4.5, cz + 4.6, 1.2, 0.6, 1.5, metalD);   // its consoles (on the deck)
    K.column(cx, cz + 6.5, 0.45, 14, metalD, { seg: 8, taper: 0.6 });
    for (const y of [6, 10, 13.6]) picture(K.deco(new THREE.BoxGeometry(2.4 - y * 0.08, 0.12, 0.12), metalD, cx, y, cz + 6.5));
    picture(K.deco(new THREE.SphereGeometry(0.3, 8, 6), red, cx, 14.2, cz + 6.5));
    K.banner(cx, 4.2, cz + 5.9, Math.PI, 2.4, 3.2, cloth, 0x1a1a1a); }

  // ---- the plateau's rim past the edge, and scattered snow ----
  for (const sx of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(1.4, 3, 64), rock, sx * 32.8, 1.2, 0));
  picture(K.deco(new THREE.BoxGeometry(66, 3, 1.4), rock, 0, 1.2, 32.8));
  const snow = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 1, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 14; i++){
    const r = 0.8 + R() * 2;
    picture(K.deco(new THREE.CircleGeometry(r, 12), snow, (R() - 0.5) * 58, 0.015, (R() - 0.5) * 58, -Math.PI / 2)).receiveShadow = false;
  }
}
