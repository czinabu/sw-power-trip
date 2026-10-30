// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: the temple archive on Jedha, its roof burned away, the stacks on fire (chapter 2, THE BURNING ARCHIVE).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* THE BURNING ARCHIVE (half-size 24). The great reading hall under the temple, open to the sky now the roof has gone:
     · the READING DAIS in the middle: a low stepped round of stone with the archive's holocron plinth on top;
     · the STACKS: eight tall shelf runs (3.4, too tall to vault: hard cover, wall-kick faces) in two rings, laid
       along the walls' grain so the lanes between them run straight to the dais. Three of them are BURNING: stand in
       front of one and it flares on a slow, telegraphed cycle;
     · fallen shelves (1.1, vault them) and scattered scroll cases you step over;
     · the hall's WALLS just past the edge: sandstone bays with tall arched windows, the gallery broken overhead;
     · a scaffold in the north-west corner (the archivists' lift) as the overwatch climb, fuel drums by the doors.
   The player comes in from the south (z +12), facing the dais. */
export const ARCHIVE = { half: 24, wallH: 11 };

export function buildArchiveArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0xb89a70, roughness: 0.92 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x8e7250, roughness: 0.95 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xd8b46a, roughness: 0.5, metalness: 0.5 });
  const wood   = new THREE.MeshStandardMaterial({ color: pal.wood ?? 0x5a3a24, roughness: 0.85 });
  const woodD  = new THREE.MeshStandardMaterial({ color: pal.woodD ?? 0x3a2416, roughness: 0.9 });
  const char   = new THREE.MeshStandardMaterial({ color: pal.char ?? 0x241a14, roughness: 1 });
  const scroll = new THREE.MeshStandardMaterial({ color: pal.scroll ?? 0xd8c8a0, roughness: 0.8 });
  const fire   = new THREE.MeshBasicMaterial({ color: pal.fire ?? 0xff8a2a });
  const ember  = new THREE.MeshBasicMaterial({ color: pal.ember ?? 0xffc060 });
  const holo   = new THREE.MeshBasicMaterial({ color: pal.holo ?? 0x7ad8ff });
  const glass  = new THREE.MeshBasicMaterial({ color: pal.sky ?? 0x5a4a5a, side: THREE.DoubleSide });
  const K = arenaKit(), R = seeded(29);
  const H = ARCHIVE.half, W = ARCHIVE.wallH, off = H + 1.0;

  // ---- the hall's WALLS: sandstone bays and tall arched windows, the gallery's broken ledge above ----
  for (const side of ['n', 's', 'e', 'w']){
    const ns = side === 'n' || side === 's', s = side === 'n' || side === 'e' ? 1 : -1, len = H*2 + 2.6;
    const put = (geo, mat, a, y, d, rz = 0) => ns ? K.deco(geo, mat, a, y, s*d, 0, 0, rz) : K.deco(geo, mat, s*d, y, a, 0, Math.PI/2, rz);
    put(new THREE.BoxGeometry(len, W, 0.8), stoneD, 0, W/2, off + 0.6);
    put(new THREE.BoxGeometry(len, 0.9, 0.7), stone, 0, 0.45, off);
    put(new THREE.BoxGeometry(len, 0.5, 1.6), stone, 0, W*0.62, off - 0.3);   // the gallery's ledge, half fallen in
    for (let a = -H; a <= H + 0.01; a += 6){
      put(new THREE.BoxGeometry(1.4, W + (R() < 0.3 ? -3 : 0), 1.0), stone, a, W/2, off);
      if (a >= H) continue;
      const c = a + 3;
      put(new THREE.PlaneGeometry(2.6, W*0.42), glass, c, W*0.3, off + 0.15);
      put(new THREE.CircleGeometry(1.3, 12, 0, Math.PI), glass, c, W*0.51, off + 0.15);
      put(new THREE.BoxGeometry(2.9, 0.18, 0.3), trim, c, 0.95, off - 0.2);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.deco(new THREE.BoxGeometry(2, W + 1, 2), stoneD, sx*(off + 0.3), (W + 1)/2, sz*(off + 0.3));

  // ---- the READING DAIS: three low walkable rounds, the holocron plinth on top ----
  for (const [r, h] of [[3.4, 0.35], [2.6, 0.7], [1.8, 1.05]]){
    K.box(0, 0, r, r, h, stone, { climbable: true });
    K.deco(new THREE.BoxGeometry(r*2 + 0.06, 0.06, r*2 + 0.06), trim, 0, h, 0);
  }
  K.box(0, 0, 0.45, 0.45, 2.0, stoneD);
  const cube = K.deco(new THREE.BoxGeometry(0.42, 0.42, 0.42), holo, 0, 2.35, 0, Math.PI/4, Math.PI/4, 0);
  cube.userData.noBake = true;

  // ---- the STACKS: tall shelf runs, [x, z, half-length, alongX, burning] ----
  const stacks = [
    [-9, -9, 3.2, 1, 0], [9, -9, 3.2, 1, 1], [-9, 9, 3.2, 1, 1], [9, 9, 3.2, 1, 0],
    [-16, -2, 3.6, 0, 0], [16, 2, 3.6, 0, 1], [-3, -17, 3.4, 1, 0], [4, 17.5, 2.8, 1, 0],
  ];
  for (const [x, z, hl, ax, burn] of stacks){
    const hx = ax ? hl : 0.55, hz = ax ? 0.55 : hl, h = 3.4;
    K.box(x, z, hx, hz, h, burn ? char : wood);
    // the shelves' faces: ledges full of scroll ends, both sides
    for (const sd of [-1, 1]) for (let k = 0; k < 4; k++){
      const y = 0.45 + k*0.8;
      if (ax) K.deco(new THREE.BoxGeometry(hl*2 - 0.2, 0.07, 0.1), woodD, x, y, z + sd*(hz + 0.02));
      else K.deco(new THREE.BoxGeometry(0.1, 0.07, hl*2 - 0.2), woodD, x + sd*(hx + 0.02), y, z);
      if (!burn) for (let n = 0; n < 5; n++){
        const t = (R() - 0.5) * (hl*2 - 0.6);
        K.deco(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 6), scroll, ax ? x + t : x + sd*(hx + 0.05), y + 0.22, ax ? z + sd*(hz + 0.05) : z + t, Math.PI/2, ax ? 0 : Math.PI/2, 0);
      }
    }
    K.deco(new THREE.BoxGeometry(hx*2 + 0.2, 0.25, hz*2 + 0.2), trim, x, h + 0.12, z);
    if (burn){
      // flames along the top, and the run flares on a cycle: don't stand in front of it
      for (let n = 0; n < 4; n++){
        const t = (n / 3 - 0.5) * (hl*2 - 1), fx = ax ? x + t : x, fz = ax ? z : z + t;
        const f = K.deco(new THREE.ConeGeometry(0.42, 1.1 + R()*0.6, 7), n % 2 ? fire : ember, fx, h + 0.75, fz);
        f.userData.noBake = true; f.castShadow = false;
      }
      hazardZones.push({ kind: 'line', cx: x, cz: z, dirX: ax ? 1 : 0, dirZ: ax ? 0 : 1, halfLen: hl, halfW: 1.6,
                         period: 9, warnDur: 1.5, activeDur: 1.1, dmg: 18, color: pal.fire ?? 0xff8a2a, flash: true, t: R() * 9 });
    }
  }

  // ---- FALLEN SHELVES (vault them) and scroll cases you step over ----
  for (const [x, z, hl, ax] of [[-5, 4.5, 2.2, 1], [6, -4, 2.0, 0], [-12, 15, 2.4, 1], [13, -15, 2.2, 0], [17, 11, 1.8, 1]]){
    K.box(x, z, ax ? hl : 0.5, ax ? 0.5 : hl, 1.1, woodD);
    for (let n = 0; n < 3; n++) K.deco(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), scroll, x + (R() - 0.5)*hl, 1.14, z + (R() - 0.5), Math.PI/2, R()*3, 0);
  }
  for (const [x, z, len, ax] of [[-1, 11, 1.4, true], [11, 4, 1.2, false], [-13, -11, 1.5, true], [3, -12, 1.3, false]]) K.rubble(x, z, len, 0.28, stoneD, ax);

  // ---- the archivists' SCAFFOLD (the overwatch climb) in the north-west ----
  K.gantry(-18, -18, { a: wood, b: woodD, strut: trim, beacon: pal.fire ?? 0xff8a2a }, [1, 1]);

  // ---- FUEL DRUMS the Empire brought to burn it with, by the doors ----
  for (const [x, z] of [[-20, 6], [20, -6], [8, -20]]) spawnBarrel(V3(x, 0, z));
}
