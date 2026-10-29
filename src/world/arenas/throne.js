// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Sandbox arena (Mandalorian): the throne room of the palace at Sundari, a wide dark-green hall walled in tall windows.

import * as THREE from 'three';
import { arenaKit, seeded } from './kit.js';

/* THE THRONE ROOM (half-size 24). The Mandalorian's sandbox floor (game/sandbox.js), after the Clone Wars throne room
   on Mandalore: one big open floor with nothing in the middle to snag a fight.
     · the FLOOR: dark green plates (the theme's 'deck' floor) with lit amber dashes set into the seams;
     · the WALLS just past the playable edge: weathered green panels between pilasters, each bay a tall window onto the
       domed city, its frame chamfered at the corners the way Sundari's are;
     · the THRONE on the north wall: a stepped dais with amber light strips (each step a walkable rise), a red throne
       before a tall back-panel of glowing orange glass, two flower lamps either side;
     · dark ceiling girders overhead.
   The player spawns south of centre facing north, toward the throne. */
export const THRONE = { half: 24, wallH: 13, dais: { z: 22.2, w: 5.2 } };

export function buildThroneArena(L){
  const pal = L.pal || {};
  const green  = new THREE.MeshStandardMaterial({ color: pal.green ?? 0x4a6a60, roughness: 0.8, metalness: 0.25 });
  const greenD = new THREE.MeshStandardMaterial({ color: pal.greenD ?? 0x2a3a36, roughness: 0.75, metalness: 0.3 });
  const frame  = new THREE.MeshStandardMaterial({ color: pal.frame ?? 0x1a2220, roughness: 0.6, metalness: 0.4 });
  const throne = new THREE.MeshStandardMaterial({ color: pal.throne ?? 0x7a3a2a, roughness: 0.6, metalness: 0.15 });
  const glass  = new THREE.MeshBasicMaterial({ color: pal.glass ?? 0x9aaab2, fog: false, side: THREE.DoubleSide });
  const city   = [0x7a8a94, 0x6a7a86, 0x8a98a0].map(c => new THREE.MeshBasicMaterial({ color: c, fog: false, side: THREE.DoubleSide }));
  const amber  = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffd23a, side: THREE.DoubleSide });
  const glow   = new THREE.MeshBasicMaterial({ color: pal.glow ?? 0xe0703a, side: THREE.DoubleSide });
  const K = arenaKit(), R = seeded(73);
  const H = THRONE.half, W = THRONE.wallH, off = H + 0.9;

  // a bar from (a0, y0) to (a1, y1) laid in a wall's plane (a: along the wall), for the window frames' chamfers
  const bar = (put, a0, y0, a1, y1, t, mat, d) => {
    const len = Math.hypot(a1 - a0, y1 - y0);
    put(new THREE.BoxGeometry(len, t, 0.16), mat, (a0 + a1) / 2, (y0 + y1) / 2, d, Math.atan2(y1 - y0, a1 - a0));
  };

  // ---- the WALLS — green pilasters, and between them tall windows onto the city ----
  const wallAt = (side) => {
    const ns = side === 'n' || side === 's', s = side === 'n' || side === 'e' ? 1 : -1, len = H*2 + 2.4;
    // put(geo, mat, along, y, depth from the edge, roll in the wall's plane)
    const put = (geo, mat, a, y, d, roll = 0) => ns
      ? K.deco(geo, mat, a, y, s*d, 0, 0, roll)
      : K.deco(geo, mat, s*d, y, a, 0, Math.PI/2, -roll);   // turned a quarter, a piece's own x runs along -z
    put(new THREE.BoxGeometry(len, W, 0.6), greenD, 0, W/2, off + 0.6);        // the back of the wall
    put(new THREE.BoxGeometry(len, 0.8, 0.5), green, 0, 0.4, off - 0.1);         // the plinth
    put(new THREE.BoxGeometry(len, 1.2, 1.0), greenD, 0, W - 0.6, off - 0.2);    // the cornice
    for (let a = -H; a <= H + 0.01; a += 6){
      put(new THREE.BoxGeometry(1.6, W, 0.7), green, a, W/2, off - 0.05);       // pilaster
      put(new THREE.BoxGeometry(0.12, W - 2.4, 0.08), frame, a - 0.5, W/2, off - 0.42);   // its inlaid lines
      put(new THREE.BoxGeometry(0.12, W - 2.4, 0.08), frame, a + 0.5, W/2, off - 0.42);
      if (a >= H) continue;
      // the window in the next bay (skipped behind the throne, where the wall carries the dais)
      const c = a + 3;
      if (side === 'n' && Math.abs(c) < THRONE.dais.w + 1) continue;
      const x0 = c - 2.0, x1 = c + 2.0, y0 = 0.8, y1 = W - 1.4, ch = 1.1, d = off + 0.25;
      put(new THREE.PlaneGeometry(4.0, y1 - y0), glass, c, (y0 + y1) / 2, d + 0.02);
      // the city beyond: a few tower silhouettes standing up from the sill
      for (let k = 0; k < 3; k++){
        const w = 0.6 + R()*0.9, h = 2 + R()*(y1 - y0 - 3), cx = x0 + 0.4 + R()*3.2;
        put(new THREE.PlaneGeometry(w, h), city[k % 3], cx, y0 + h/2, d);
      }
      // the frame: jambs, a transom, and chamfers cutting the top and bottom corners
      for (const fx of [x0, x1]) put(new THREE.BoxGeometry(0.22, y1 - y0 - ch*2, 0.16), frame, fx, (y0 + y1) / 2, d - 0.1);
      put(new THREE.BoxGeometry(4.0 - ch*2, 0.22, 0.16), frame, c, y1, d - 0.1);
      put(new THREE.BoxGeometry(4.0 - ch*2, 0.22, 0.16), frame, c, y0, d - 0.1);
      put(new THREE.BoxGeometry(4.0, 0.16, 0.16), frame, c, y0 + 2.4, d - 0.1);
      put(new THREE.BoxGeometry(0.14, 2.4, 0.16), frame, c, y0 + 1.2, d - 0.1);
      bar(put, x0, y1 - ch, x0 + ch, y1, 0.22, frame, d - 0.1); bar(put, x1 - ch, y1, x1, y1 - ch, 0.22, frame, d - 0.1);
      bar(put, x0, y0 + ch, x0 + ch, y0, 0.22, frame, d - 0.1); bar(put, x1 - ch, y0, x1, y0 + ch, 0.22, frame, d - 0.1);
      // amber running lights on the plinth under each window
      for (const dx of [-0.5, 0.5]) put(new THREE.BoxGeometry(0.7, 0.08, 0.04), amber, c + dx, 0.55, off - 0.37);
    }
  };
  for (const s of ['n', 's', 'e', 'w']) wallAt(s);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.deco(new THREE.BoxGeometry(1.8, W, 1.8), greenD, sx*(H + 0.9), W/2, sz*(H + 0.9));
  // ceiling girders, high over the floor
  for (const z of [-15, -5, 5, 15]){ K.deco(new THREE.BoxGeometry(H*2 + 2.4, 1.0, 0.8), frame, 0, W + 0.3, z); K.slab(0, z, H, 0.4, W - 0.2, W + 0.8); }

  // ---- the THRONE — a stepped dais against the north wall, the throne, its glowing back-panel and two lamps ----
  { const D = THRONE.dais, zb = H;   // the wall's face
    // the alcove: a broad green tower standing out of the wall, carrying the back-panel
    K.deco(new THREE.BoxGeometry(D.w*2 + 1.2, W, 1.2), green, 0, W/2, zb + 0.5);
    for (const sx of [-1, 1]){
      K.deco(new THREE.BoxGeometry(0.5, W, 0.4), greenD, sx*(D.w + 0.2), W/2, zb - 0.2);
      for (let k = 0; k < 4; k++) K.deco(new THREE.BoxGeometry(0.06, W - 3, 0.06), frame, sx*(2.6 + k*0.18), W/2 + 0.6, zb - 0.12);
    }
    // the steps: five walkable rises, each a little narrower and deeper into the alcove, an amber strip on each riser
    const steps = 5, rise = 0.32, run = 0.85;
    for (let i = 0; i < steps; i++){
      const hz = (steps - i) * run / 2 + 0.6, z = zb - hz, hx = D.w - i*0.55, h = (i + 1) * rise;
      K.box(0, z, hx, hz, h, i % 2 ? greenD : green, { climbable: true });
      for (const dx of [-1.6, 0, 1.6]) K.deco(new THREE.BoxGeometry(1.0, 0.06, 0.04), amber, dx * (hx / D.w), h - rise/2, z - hz - 0.02);
    }
    const top = steps * rise, zt = zb - 1.0;
    // the throne: a seat, two blocky arms and a tall back
    K.box(0, zt, 0.9, 0.55, top + 0.55, throne);
    for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.35, 1.0, 1.2), throne, sx*1.05, top + 0.5, zt);
    K.deco(new THREE.BoxGeometry(1.4, 2.6, 0.25), throne, 0, top + 1.3, zt + 0.45);
    K.deco(new THREE.BoxGeometry(0.5, 0.06, 0.04), amber, 0, top + 0.12, zt - 0.6);
    // the glowing back-panel: an elongated octagon of orange glass in a dark frame, a lattice laid over it
    const py = top + 4.6, ph = 6.2, pw = 1.6;
    K.deco(new THREE.BoxGeometry(pw*2 + 0.5, ph + 0.5, 0.1), frame, 0, py, zb - 0.12);
    K.deco(new THREE.PlaneGeometry(pw*2, ph), glow, 0, py, zb - 0.18, 0, Math.PI);
    for (const y of [-2, -0.6, 0.8, 2.2]) K.deco(new THREE.BoxGeometry(pw*2, 0.07, 0.05), frame, 0, py + y, zb - 0.21);
    for (const x of [-0.8, 0, 0.8]) K.deco(new THREE.BoxGeometry(0.07, ph, 0.05), frame, x, py, zb - 0.21);
    K.deco(new THREE.OctahedronGeometry(0.55, 0), frame, 0, py + 0.1, zb - 0.22, 0, 0, Math.PI/4);
    // the flower lamps either side of the throne
    for (const sx of [-1, 1]){
      K.deco(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), frame, sx*2.6, top + 2.6, zb - 0.3);
      K.deco(new THREE.ConeGeometry(0.42, 0.55, 7, 1, true), amber, sx*2.6, top + 3.1, zb - 0.35, Math.PI);
    }
  }

  // ---- amber light dashes set into the floor seams (flat, never in the way) ----
  for (let i = 0; i < 16; i++){
    const x = (R() - 0.5) * (H*2 - 6), z = (R() - 0.5) * (H*2 - 10) - 2, along = R() < 0.5;
    for (let k = 0; k < 3; k++) K.deco(new THREE.BoxGeometry(along ? 0.18 : 0.06, 0.02, along ? 0.06 : 0.18), amber,
      x + (along ? k*0.3 : 0), 0.012, z + (along ? 0 : k*0.3));
  }
}
