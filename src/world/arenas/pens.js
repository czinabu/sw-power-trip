// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: TESSARIL, the Inquisitor prison moon where the Empire holds the children taken from the Ledger's list
// (the Jedi's chapter THE PENS, mission `pens`). A wet black rock under a gas giant, at night, in the rain.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones, solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* THE PENS ON TESSARIL (half-size 32). The player lands at the south pad (+z) and looks north at the prison (-z):
     · the LANDING PAD at the south edge, where the ship waits to take the children off (the evacuees run to it);
     · a long ROCK SPINE in the east of the middle ground, so the way in from the pad bends west round it: the causeway
       the slicer droid walks, lit by a row of guide lamps;
     · the PRISON WALL across the north third (z -12), its blast gate in the middle (x -4..4), slid open once the droid
       is through. Behind it three domed CELL BLOCKS with a door panel each, and the Inquisitors' black spire beyond;
     · two GUARD TOWERS (the overwatch climb): one on the causeway, one in the prison yard;
     · SHOCK PYLONS that arc on a slow, telegraphed cycle, boulders, puddles, floodlights and supply crates. */
export const PENS = { half: 32, wallZ: -12, wallH: 6, gate: 4 };

export function buildPensArena(L){
  const pal = L.pal || {};
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x3a3c44, roughness: 0.9, metalness: 0.05, flatShading: true });
  const rockD  = new THREE.MeshStandardMaterial({ color: pal.rockD ?? 0x2a2c34, roughness: 0.9, metalness: 0.05, flatShading: true });
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0x4a4e58, roughness: 0.7, metalness: 0.35 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x2e3138, roughness: 0.75, metalness: 0.35 });
  const black  = new THREE.MeshStandardMaterial({ color: pal.spire ?? 0x15161b, roughness: 0.45, metalness: 0.6 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xb83a2a, roughness: 0.6 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x5a5448, roughness: 0.9 });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffe0b0 });
  const guide  = new THREE.MeshBasicMaterial({ color: pal.guide ?? 0x7ad8ff });
  const wet    = new THREE.MeshStandardMaterial({ color: pal.puddle ?? 0x1a2230, roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.75, depthWrite: false });
  const shockC = pal.shock ?? 0x9a7aff;
  const K = arenaKit(), R = seeded(73);
  const H = PENS.half, WZ = PENS.wallZ, WH = PENS.wallH, GT = PENS.gate;
  const glow = (m) => { m.userData.noBake = true; return m; };

  // a boulder: a lumpy rock you can see, with a round solid to match (low ones climbable from the side by a jump)
  const boulder = (x, z, r, h, mat = rock) => {
    K.deco(new THREE.DodecahedronGeometry(1, 0), mat, x, h*0.42, z, R()*3, R()*3, R()*3).scale.set(r, h*0.62, r*(0.8 + R()*0.3));
    solids.push({ x, z, r: r*0.92, h: h*0.9 });
  };

  // ---- the LANDING PAD, south: a ring of lit deck where the ship sets down ----
  K.deco(new THREE.CylinderGeometry(6, 6.3, 0.18, 32), wallD, 0, 0.09, 25).receiveShadow = true;
  K.deco(new THREE.RingGeometry(4.6, 4.9, 40), new THREE.MeshBasicMaterial({ color: 0xd9a43a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0.2, 25, -Math.PI/2);
  for (let k = 0; k < 8; k++){ const a = k / 8 * Math.PI*2; glow(K.deco(new THREE.BoxGeometry(0.4, 0.1, 0.4), guide, Math.cos(a)*5.6, 0.22, 25 + Math.sin(a)*5.6)); }

  // ---- the ROCK SPINE, east of the middle: the way in bends west round it (one solid mass: no pocket between the rocks to hide in) ----
  for (const [x, z, r, h] of [[10, 10, 3.2, 5.5], [13, 5, 3.6, 7], [15, -1, 3.0, 6], [19, 7, 2.8, 4.5], [11, 1, 2.0, 3.2], [22, 1, 3.4, 8], [25, 9, 2.6, 5], [18, 3, 2.0, 4]]) boulder(x, z, r, h, R() < 0.5 ? rock : rockD);
  // and scattered rocks: cover in the open, low ones to vault
  for (const [x, z, r, h] of [[-22, 18, 2.2, 3.4], [-26, 4, 2.6, 4.2], [-6, 4, 1.1, 1.6], [6, 16, 1.2, 1.8], [-14, -4, 1.0, 1.4], [26, 22, 2.8, 5], [-27, -6, 1.6, 2.4], [4, -4, 0.9, 1.3]]) boulder(x, z, r, h, R() < 0.5 ? rock : rockD);

  // ---- the CAUSEWAY: guide lamps along the droid's walk, pad → west of the spine → the gate ----
  const way = [[0, 20], [-11, 14], [-17, 3], [-12, -6], [0, -9]];
  for (let i = 0; i < way.length - 1; i++){
    const [x0, z0] = way[i], [x1, z1] = way[i + 1];
    K.strip(x0, z0, x1, z1, 3.4, 0x2a3140, 0.55);
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 4);
    for (let k = 1; k < n; k++){
      const t = k / n, x = x0 + (x1 - x0)*t, z = z0 + (z1 - z0)*t, nx = -(z1 - z0), nz = x1 - x0, nl = Math.hypot(nx, nz);
      for (const s of [-1, 1]) glow(K.deco(new THREE.BoxGeometry(0.22, 0.14, 0.22), guide, x + s*nx/nl*2.1, 0.08, z + s*nz/nl*2.1));
    }
  }

  // ---- the PRISON WALL across the north third, its blast gate in the middle ----
  for (const s of [-1, 1]){
    const x0 = s*GT, x1 = s*(H + 1.5), cx = (x0 + x1)/2, hx = Math.abs(x1 - x0)/2;
    K.box(cx, WZ, hx, 0.7, WH, wall);
    K.deco(new THREE.BoxGeometry(hx*2, 0.5, 1.8), wallD, cx, WH + 0.25, WZ);                     // the guard walk on top
    K.deco(new THREE.BoxGeometry(hx*2, 0.25, 0.08), stripe, cx, WH*0.55, WZ + 0.74);            // a red band at chest height of the wall
    for (let x = s*(GT + 4); Math.abs(x) < H; x += s*6){                                          // buttresses: wall-kick faces
      K.box(x, WZ + 1.1, 0.6, 0.45, WH - 0.6, wallD);
      glow(K.deco(new THREE.BoxGeometry(0.5, 0.12, 0.06), red, x, WH - 1.1, WZ + 1.58));
    }
    // the gate's posts and its doors, slid back into the wall
    K.box(s*(GT + 0.6), WZ, 0.6, 1.1, WH + 2.4, wallD);
    K.deco(new THREE.BoxGeometry(3.6, WH - 0.4, 0.3), wallD, s*(GT + 2.6), (WH - 0.4)/2, WZ + 0.95);
    for (let k = 0; k < 4; k++) K.deco(new THREE.BoxGeometry(0.25, WH - 0.6, 0.06), stripe, s*(GT + 1.2 + k*0.9), (WH - 0.4)/2, WZ + 1.12);
    glow(K.deco(new THREE.BoxGeometry(0.6, 0.6, 0.6), red, s*(GT + 0.6), WH + 2.7, WZ));
  }
  // the lintel over the gate: overhead, a slab you can land on
  K.deco(new THREE.BoxGeometry(GT*2 + 2.4, 1.2, 2.2), wallD, 0, WH + 1.8, WZ);
  K.slab(0, WZ, GT + 1.2, 1.1, WH + 1.2, WH + 2.4);
  K.sign('DETENTION LEVEL', 0, WH + 1.8, WZ + 1.12, 0, { ink: '#ff9a8a', edge: 'rgba(255,90,70,.85)', w: 4.6 });

  // ---- the CELL BLOCKS behind the wall: domed bunkers with a sealed door and its panel ----
  const block = (x, z) => {
    K.box(x, z, 4, 3, 3.6, wall);
    const dome = K.deco(new THREE.SphereGeometry(3.4, 18, 8, 0, Math.PI*2, 0, Math.PI/2), wallD, x, 3.6, z);
    dome.scale.set(1.12, 0.62, 0.86);
    K.deco(new THREE.BoxGeometry(2.6, 3.0, 0.2), black, x, 1.5, z + 3.08);          // the door
    K.deco(new THREE.BoxGeometry(2.9, 0.2, 0.24), stripe, x, 3.1, z + 3.08);
    glow(K.deco(new THREE.BoxGeometry(1.4, 0.14, 0.1), red, x, 3.35, z + 3.16));
    for (const s of [-1, 1]) glow(K.deco(new THREE.BoxGeometry(0.5, 0.3, 0.06), lamp, x + s*3.2, 2.6, z + 3.04));   // barred windows, lit
  };
  block(-20, -25); block(20, -25); block(0, -28.5);

  // ---- the INQUISITORS' SPIRE: black, beyond the north edge, a red slit of light running up it ----
  K.deco(new THREE.CylinderGeometry(1.6, 6, 34, 6), black, 0, 17, -H - 9);
  K.deco(new THREE.CylinderGeometry(2.6, 2.6, 2, 6), black, 0, 35, -H - 9);
  glow(K.deco(new THREE.BoxGeometry(0.4, 26, 0.2), red, 0, 15, -H - 5.4, -0.11, 0, 0));
  for (const s of [-1, 1]) K.deco(new THREE.CylinderGeometry(0.8, 3, 18, 6), black, s*9, 9, -H - 6);

  // ---- the GUARD TOWERS ----
  K.gantry(-27, 12, { a: wall, b: wallD, strut: wallD, beacon: pal.red ?? 0xff3a2a }, [1, -1]);
  K.gantry(26, -16, { a: wall, b: wallD, strut: wallD, beacon: pal.red ?? 0xff3a2a }, [-1, -1]);

  // ---- SHOCK PYLONS: a post with a coil, arcing on a slow cycle round its foot ----
  [[-7, -2], [9, -18], [-9, -19], [-20, 10]].forEach(([x, z], i) => {
    K.column(x, z, 0.3, 2.6, wallD, { wallKick: false, seg: 6, taper: 0.7 });
    glow(K.deco(new THREE.TorusGeometry(0.42, 0.08, 6, 14), new THREE.MeshBasicMaterial({ color: shockC }), x, 2.3, z, Math.PI/2));
    hazardZones.push({ kind: 'point', cx: x, cz: z, r: 2.2, period: 8, warnDur: 1.5, activeDur: 0.9, dmg: 14, color: shockC, flash: true, t: i * 2 });
  });

  // ---- floodlights on poles, puddles in the low ground, crates and drums ----
  for (const [x, z] of [[-6, 10], [6, -14], [-24, -16], [16, -20], [-28, 22], [8, 22]]){
    K.column(x, z, 0.18, 5.2, wallD, { wallKick: false, seg: 8, taper: 1 });
    K.deco(new THREE.BoxGeometry(0.8, 0.3, 0.5), wallD, x, 5.3, z);
    glow(K.deco(new THREE.BoxGeometry(0.6, 0.08, 0.36), lamp, x, 5.14, z));
  }
  for (const [x, z, w, d] of [[-4, 8, 4, 2.4], [-18, -2, 3, 3.6], [3, -6, 3.2, 1.8], [-10, 20, 4.4, 2.2], [14, -24, 3, 2], [-14, -22, 2.6, 2.6]]){
    const p = K.deco(new THREE.CircleGeometry(1, 18), wet, x, 0.03, z, -Math.PI/2);
    p.scale.set(w/2, d/2, 1); p.castShadow = false; p.userData.passThrough = true;
  }
  for (const [x, z, s] of [[-3, 16, 0.5], [5, 12, 0.45], [-12, -16, 0.5], [12, -15, 0.45], [-29, -20, 0.5], [28, 16, 0.45], [-22, 0, 0.4]]){
    K.box(x, z, s, s, s*1.4, crate, { climbable: true });
  }
  for (const [x, z] of [[-6, -16], [24, -8], [-16, 22]]) spawnBarrel(V3(x, 0, z));
}
