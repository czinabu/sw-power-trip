// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Sandbox arena: the temple's indoor training room, a wide open duelling floor walled in warm wood.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { arenaKit, seeded } from './kit.js';
import { toon } from '../ink.js';

/* THE TRAINING ROOM (half-size 24). One big open floor for the sandbox (game/sandbox.js), after the Jedi Temple's
   training rooms: nothing in the middle to snag a fight.
     · the DUELLING MAT: a pale circle across most of the floor, inlaid with two dark rings, a cross and a centre ring;
     · the WALLS just past the playable edge: cream panels in dark wood frames, a rail at head height and a second at
       the gallery line, with a Jedi crest and a sealed door on the north wall;
     · two tiers of BENCHES along the east and west walls (the low seat steps up, the back tier needs a hop);
     · a few TRAINING REMOTES hovering high along the walls, clear of the floor (decoration; game/sandbox.js bobs them, via shared.dojoRemotes).
   The player spawns south of centre facing north, toward the crest. */
export const DOJO = { half: 24, wallH: 12, mat: 15.5, benchZ: 13 };

export function buildDojoArena(L){
  const pal = L.pal || {};
  const wood   = new THREE.MeshStandardMaterial({ color: pal.wood ?? 0x5a2a1c, roughness: 0.7, metalness: 0.05 });
  const woodD  = new THREE.MeshStandardMaterial({ color: pal.woodD ?? 0x3a1a12, roughness: 0.75, metalness: 0.05 });
  const panel  = new THREE.MeshStandardMaterial({ color: pal.panel ?? 0xcfc4ae, roughness: 0.9, metalness: 0.0 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x8a8a86, roughness: 0.45, metalness: 0.6 });
  const crest  = new THREE.MeshStandardMaterial({ color: pal.crest ?? 0x2a140e, roughness: 0.6, metalness: 0.1 });
  const K = arenaKit(), R = seeded(57);
  const H = DOJO.half, W = DOJO.wallH;

  // ---- the DUELLING MAT — flat inlays on the wooden floor (live, not baked: a flat disc needs no outline) ----
  const flat = (geo, color, y, rz = 0) => {
    const m = new THREE.Mesh(geo, toon(color));
    m.rotation.set(-Math.PI/2, 0, rz); m.position.y = y; m.receiveShadow = true; m.userData.noBake = true;
    shared.arenaGroup.add(m); return m;
  };
  const inlay = pal.inlay ?? 0x6a2618;
  flat(new THREE.CircleGeometry(DOJO.mat, 72), pal.mat ?? 0xe6dcc6, 0.015);
  flat(new THREE.RingGeometry(DOJO.mat - 0.7, DOJO.mat - 0.35, 72), inlay, 0.025);
  flat(new THREE.RingGeometry(9.2, 9.8, 64), inlay, 0.025);
  flat(new THREE.RingGeometry(2.6, 3.0, 40), inlay, 0.025);
  flat(new THREE.CircleGeometry(2.6, 40), pal.matHi ?? 0xf0e8d6, 0.02);
  for (const rz of [0, Math.PI/2]) flat(new THREE.PlaneGeometry((DOJO.mat - 0.5) * 2, 0.32), inlay, 0.022, rz);

  // ---- the WALLS — a cream face set in dark wood: posts, a skirting, a head-height rail and the gallery rail ----
  // each wall is solid only as a picture (the movement clamp keeps everyone inside); the faces run just past the edge
  const wallAt = (side) => {   // side: 'n' | 's' | 'e' | 'w'
    const ns = side === 'n' || side === 's', s = side === 'n' || side === 'e' ? 1 : -1;
    const off = H + 0.9, len = H*2 + 2.4;
    const put = (geo, mat, a, y, b) => ns ? K.deco(geo, mat, a, y, s*b) : K.deco(geo, mat, s*b, y, a, 0, Math.PI/2);
    put(new THREE.BoxGeometry(len, W, 0.6), panel, 0, W/2, off + 0.3);
    put(new THREE.BoxGeometry(len, 0.7, 0.3), woodD, 0, 0.35, off - 0.1);    // skirting
    put(new THREE.BoxGeometry(len, 0.35, 0.34), wood, 0, 4.3, off - 0.12);   // head-height rail
    put(new THREE.BoxGeometry(len, 0.5, 0.5), wood, 0, 8.2, off - 0.2);      // the gallery rail
    put(new THREE.BoxGeometry(len, 0.6, 1.4), woodD, 0, W - 0.3, off - 0.4); // the cornice
    for (let a = -H; a <= H + 0.01; a += 4){
      put(new THREE.BoxGeometry(0.45, W, 0.4), a % 12 === 0 ? woodD : wood, a, W/2, off - 0.15);
      // small slatted vents low on every other bay, like the room's air grilles
      if (Math.abs(a) % 8 === 4) for (let k = 0; k < 3; k++) put(new THREE.BoxGeometry(0.5, 0.06, 0.1), woodD, a + 1.6, 1.5 + k*0.16, off - 0.05);
    }
  };
  for (const s of ['n', 's', 'e', 'w']) wallAt(s);
  // the corners: tall square posts where the walls meet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.deco(new THREE.BoxGeometry(1.6, W, 1.6), woodD, sx*(H + 0.9), W/2, sz*(H + 0.9));
  // ceiling beams over the floor, high enough to stay out of a jetpack's way
  for (const x of [-16, -8, 0, 8, 16]){ K.deco(new THREE.BoxGeometry(0.7, 0.9, H*2 + 2.4), woodD, x, W + 0.2, 0); K.slab(x, 0, 0.35, H, W - 0.25, W + 0.65); }

  // ---- the JEDI CREST on the north wall, over the centre line ----
  { const z = H + 0.55, y = 8.6;
    K.deco(new THREE.BoxGeometry(5.4, 5.2, 0.12), panel, 0, y, z);
    const ex = (shape, depth = 0.12) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    // the blade: a long thin diamond pointing up
    const blade = new THREE.Shape(); blade.moveTo(0, 2.2); blade.lineTo(0.22, -0.3); blade.lineTo(0, -1.9); blade.lineTo(-0.22, -0.3); blade.closePath();
    K.deco(ex(blade), crest, 0, y, z - 0.14, 0, Math.PI);
    // the wings: three swept fins each side, curving up and out from the blade's foot
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++){
      const f = new THREE.Shape(), r0 = 0.5 + k*0.42, r1 = r0 + 0.26;
      f.moveTo(0.3, -0.9 - k*0.1);
      f.quadraticCurveTo(r1 + 0.6, -0.6, r1 + 0.2, 1.3 - k*0.25);
      f.quadraticCurveTo(r0 + 0.5, -0.2, 0.3, -0.62 - k*0.1);
      f.closePath();
      K.deco(ex(f), crest, 0, y, z - 0.14, 0, sx > 0 ? Math.PI : 0);
    }
    // the star under it
    const star = new THREE.Shape(); star.moveTo(0, 0.42); star.lineTo(0.09, 0.09); star.lineTo(0.42, 0); star.lineTo(0.09, -0.09);
    star.lineTo(0, -0.42); star.lineTo(-0.09, -0.09); star.lineTo(-0.42, 0); star.lineTo(-0.09, 0.09); star.closePath();
    K.deco(ex(star), crest, 0, y - 1.15, z - 0.14, 0, Math.PI);
  }

  // ---- the DOOR — a sealed round-topped hatch in the north wall, east of the crest ----
  { const x = 12, z = H + 0.6;
    K.deco(new THREE.BoxGeometry(4.2, 5.4, 0.2), metal, x, 2.7, z - 0.1);
    K.deco(new THREE.CylinderGeometry(2.1, 2.1, 0.2, 24), metal, x, 5.4, z - 0.02, Math.PI/2);   // the round top (its lower half sits behind the frame)
    K.deco(new THREE.BoxGeometry(3.2, 4.9, 0.12), panel, x, 2.45, z - 0.24);
    K.deco(new THREE.BoxGeometry(0.08, 4.9, 0.14), woodD, x, 2.45, z - 0.3);   // the seam where the leaves meet
    K.deco(new THREE.BoxGeometry(4.6, 0.3, 0.6), wood, x, 0.15, z - 0.4); }

  // ---- BENCHES — two tiers along the east and west walls, like the viewing benches round the old training rooms ----
  for (const sx of [-1, 1]){
    for (const z of [-DOJO.benchZ/2 - 0.5, DOJO.benchZ/2 + 0.5]){
      K.box(sx*21.6, z, 0.55, 5.6, 0.45, wood, { climbable: true });   // the seat: steps straight up
      K.box(sx*22.8, z, 0.65, 5.6, 0.95, woodD);                        // the back tier: a hop up
      K.deco(new THREE.BoxGeometry(1.2, 0.08, 11.3), woodD, sx*21.6, 0.47, z);
    }
  }

  // ---- TRAINING REMOTES — small hovering seeker droids, live so they can drift ----
  const remotes = [];
  const shell = toon(pal.remote ?? 0xb8b8b2), band = toon(0x3a3a3c);
  for (let i = 0; i < 6; i++){
    // they keep to the room's edge, over the benches and the corners, and well above head height: never in the fight
    const g = new THREE.Group(), a = i / 6 * Math.PI*2 + Math.PI/6 + (R() - 0.5)*0.3, r = 19.5 + R()*2;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), shell));
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 18), band); b.rotation.x = Math.PI/2; g.add(b);
    for (const s of [-1, 1]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), band); p.position.y = s*0.36; g.add(p); }
    g.position.set(Math.cos(a)*r, 6.2 + R()*1.4, Math.sin(a)*r);
    g.userData = { noBake: true, base: g.position.clone(), ph: R()*6 };
    g.traverse(o => { o.userData.noBake = true; });
    shared.arenaGroup.add(g); remotes.push(g);
  }
  shared.dojoRemotes = remotes;
}
