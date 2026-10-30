// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: the exercise yard of the Imperial prison outpost on Lothal, where the freed Acrobat tests you (chapter TRIAL OF THE ACROBAT).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit } from './kit.js';

/* THE PRISON YARD (half-size 26). A grey Imperial yard walled in cell blocks, built for a fight that never stays on the
   ground:
     · the CELL BLOCKS just past the edge: plated walls with a row of cell doors, a guard walk along the top and a
       searchlight tower at each corner; the yard's blast gate in the south wall, behind the player;
     · CARGO CONTAINERS (2.5, too tall to vault: hard cover and wall-kick faces), one stacked two high in the west;
     · two GUARD TOWERS (the overwatch climb), north-west and south-east, so there is always somewhere higher to go;
     · the HOLDING PENS along the east wall: short partitions (1.3, vault them);
     · four SHOCK GRATES set into the deck round the roll-call ring: they arc on a slow, telegraphed cycle;
     · supply crates you step over, lamp posts, fuel drums.
   The player comes in from the south (z +13), facing north across the open middle. */
export const PRISON = { half: 26, wallH: 8 };

export function buildPrisonArena(L){
  const pal = L.pal || {};
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0x7a8088, roughness: 0.75, metalness: 0.3 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x50565e, roughness: 0.8, metalness: 0.3 });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46, roughness: 0.6, metalness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6 });
  const conts  = (pal.containers || [0x5a6a5e, 0x7a5a3a, 0x4a5a72]).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.25 }));
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x7e6a50, roughness: 0.9 });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffd090 });
  const shockC = pal.shock ?? 0x6ad8ff;
  const shock  = new THREE.MeshBasicMaterial({ color: shockC, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const paint  = new THREE.MeshBasicMaterial({ color: pal.paint ?? 0xc8c0a8, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const K = arenaKit();
  const H = PRISON.half, W = PRISON.wallH, off = H + 1.0;

  // ---- the CELL BLOCKS: plated walls, a row of cell doors, the guard walk along the top ----
  for (const side of ['n', 's', 'e', 'w']){
    const ns = side === 'n' || side === 's', s = side === 'n' || side === 'e' ? 1 : -1, len = H*2 + 2.6;
    // (+z is south here: the player's side. 'n' at -z, so flip s for the z walls)
    const sz = side === 'n' ? -1 : side === 's' ? 1 : s;
    const put = (geo, mat, a, y, d) => ns ? K.deco(geo, mat, a, y, sz*d) : K.deco(geo, mat, sz*d, y, a, 0, Math.PI/2, 0);
    put(new THREE.BoxGeometry(len, W, 0.8), wallD, 0, W/2, off + 0.6);
    put(new THREE.BoxGeometry(len, 0.7, 0.6), imp, 0, 0.35, off);
    put(new THREE.BoxGeometry(len, 0.5, 1.8), imp, 0, W - 0.25, off - 0.2);           // the guard walk
    put(new THREE.BoxGeometry(len, 0.9, 0.12), wall, 0, W + 0.45, off - 1.0);          // its rail
    for (let a = -H + 2; a <= H - 2 + 0.01; a += 4){
      if (side === 's' && Math.abs(a) < 5) continue;                                     // the gate
      put(new THREE.BoxGeometry(2.2, 3.2, 0.3), wall, a, 2.3, off + 0.1);               // a cell door's frame
      put(new THREE.PlaneGeometry(1.5, 2.6), imp, a, 2.0, off - 0.06);                  // the door
      put(new THREE.BoxGeometry(1.2, 0.12, 0.06), red, a, 3.55, off - 0.06);            // its lock light
      put(new THREE.BoxGeometry(2.4, 0.3, 0.3), stripe, a, W*0.62, off);                 // the upper tier's ledge
    }
    if (side === 's'){   // the blast gate the player came through, sealed behind them
      put(new THREE.BoxGeometry(8, 6, 0.5), imp, 0, 3, off);
      for (let k = -3; k <= 3; k += 1.5) put(new THREE.BoxGeometry(0.5, 6, 0.1), stripe, k, 3, off - 0.3);
    }
  }
  // searchlight towers at the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]){
    const x = sx*(off + 0.6), z = sz*(off + 0.6);
    K.deco(new THREE.BoxGeometry(3, W + 4, 3), wallD, x, (W + 4)/2, z);
    K.deco(new THREE.BoxGeometry(3.6, 1.6, 3.6), imp, x, W + 4.8, z);
    K.deco(new THREE.SphereGeometry(0.5, 10, 8), lamp, x - sx*1.6, W + 4.8, z - sz*1.6).userData.noBake = true;
  }

  // ---- the roll-call ring painted on the deck, and the four SHOCK GRATES round it ----
  K.deco(new THREE.RingGeometry(6.2, 6.6, 48), paint, 0, 0.03, 0, -Math.PI/2);
  K.deco(new THREE.RingGeometry(1.2, 1.5, 6), paint, 0, 0.03, 0, -Math.PI/2);
  [[-8, -8], [8, -8], [-8, 8], [8, 8]].forEach(([x, z], i) => {
    K.deco(new THREE.PlaneGeometry(3.2, 3.2), shock, x, 0.04, z, -Math.PI/2);
    for (let k = -1.2; k <= 1.21; k += 0.6) K.deco(new THREE.BoxGeometry(3.2, 0.04, 0.1), imp, x, 0.05, z + k);
    hazardZones.push({ kind: 'point', cx: x, cz: z, r: 1.9, period: 7, warnDur: 1.4, activeDur: 0.9, dmg: 14, color: shockC, flash: true, t: i * 1.75 });
  });

  // ---- CARGO CONTAINERS: [x, z, half-length, alongX, colour] ----
  const container = (x, z, hl, ax, mat, y = 0) => {
    const hx = ax ? hl : 1.25, hz = ax ? 1.25 : hl, h = 2.5;
    K.box(x, z, hx, hz, h, mat, { y });
    for (let t = -hl + 0.5; t <= hl - 0.5 + 0.01; t += 0.75){   // corrugated ribs down both long sides
      for (const sd of [-1, 1]) K.deco(new THREE.BoxGeometry(ax ? 0.12 : 0.06, h - 0.3, ax ? 0.06 : 0.12), mat, ax ? x + t : x + sd*(hx + 0.02), y + h/2, ax ? z + sd*(hz + 0.02) : z + t);
    }
    K.deco(new THREE.BoxGeometry(hx*2 + 0.06, 0.16, hz*2 + 0.06), imp, x, y + h - 0.06, z);
    K.deco(new THREE.BoxGeometry(ax ? 0.08 : 1.6, 0.3, ax ? 1.6 : 0.08), stripe, ax ? x + hl + 0.02 : x, y + 1.6, ax ? z : z + hl + 0.02);   // stencil on the doors
  };
  container(-13, -3, 3.0, 0, conts[0]);
  container(-13, -3, 2.8, 0, conts[1], 2.5);   // stacked: the yard's tallest climb that isn't a tower
  container(13, 3, 3.0, 0, conts[2]);
  container(-5, -17, 3.0, 1, conts[1]);
  container(15, -14, 3.0, 1, conts[0]);
  container(-15, 14, 3.0, 1, conts[2]);

  // ---- the GUARD TOWERS (the overwatch climb) ----
  K.gantry(-21, -21, { a: imp, b: wallD, strut: wall, beacon: pal.red ?? 0xff3a2a }, [1, 1]);
  K.gantry(21, 21, { a: imp, b: wallD, strut: wall, beacon: pal.red ?? 0xff3a2a }, [-1, -1]);

  // ---- the HOLDING PENS along the east wall: short partitions you vault ----
  for (const z of [-7, -1, 5]){
    K.box(22.5, z, 3.0, 0.3, 1.3, wall);
    K.deco(new THREE.BoxGeometry(6.06, 0.12, 0.66), stripe, 22.5, 1.3, z);
  }

  // ---- supply crates you step over, lamp posts, fuel drums ----
  for (const [x, z, s] of [[-4, 8, 0.45], [5, -9, 0.4], [-20, 4, 0.5], [6, 21, 0.45], [-9, -22, 0.4], [17, -8, 0.45]]){
    K.box(x, z, s, s, s*1.4, crate, { climbable: true });
  }
  for (const [x, z] of [[-6, -6], [6, 6], [-19, -10], [19, 12]]){
    K.column(x, z, 0.18, 4.6, imp, { wallKick: false, seg: 8, taper: 1 });
    K.deco(new THREE.BoxGeometry(0.7, 0.24, 0.4), imp, x, 4.7, z);
    K.deco(new THREE.BoxGeometry(0.5, 0.08, 0.3), lamp, x, 4.56, z).userData.noBake = true;
  }
  for (const [x, z] of [[-21, -13], [10, -22], [21, 9]]) spawnBarrel(V3(x, 0, z));
}
