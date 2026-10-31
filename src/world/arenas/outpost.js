// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena (the Mandalorian's story): SALT HOLLOW, a frontier trade town on the salt flats of Orvane, at noon
// (data/campaign-mando.js, chapter 1: A JOB IN SALT HOLLOW).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared, solids } from '../../state.js';
import { toon, inkify } from '../ink.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* SALT HOLLOW (half-size 30). A one-street salt town built round a market square, laid out as an ambush:
     · the LANDING PAD in the north (+z), the hero's ship the CINDERWAKE on it, ramp down: where the hero comes in;
     · the MARKET SQUARE in the middle, round the town's CONDENSER (a tall moisture tower, hard cover);
     · the CANTINA in the south: a long whitewashed block under a shallow dome, its lit door facing the square;
     · the GUILD HALL on the east: two storeys, the broker's balcony over the square (a slab you can land on);
     · MARKET STALLS down the west side: counters to vault and awnings overhead, crates and a salt cart;
     · domed SHACKS in the corners, a parked LANDSPEEDER and cargo for cover, the guild's water-tower gantry as the
       overwatch climb (south-west), fuel drums by the cantina and the pad.
   Streets run out to every edge between the buildings, so the Magistrate's troops come in from all sides. */
export const OUTPOST_SPOTS = {
  pad: [0, 22],
  condenser: [0, 0],
  cantina: [0, -19],
  guild: [19, -5],
  stalls: [[-17, 6], [-17, -2], [-17, -10]],
};

export function buildOutpostArena(L){
  const pal = L.pal || {};
  const adobe  = new THREE.MeshStandardMaterial({ color: pal.adobe ?? 0xd8ccb6, roughness: 0.95 });
  const adobeD = new THREE.MeshStandardMaterial({ color: pal.adobeD ?? 0xb2a48a, roughness: 0.95 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0x7a5a3c, roughness: 0.8 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x7a828a, roughness: 0.55, metalness: 0.6 });
  const rust   = new THREE.MeshStandardMaterial({ color: pal.rust ?? 0x8a5a3a, roughness: 0.8, metalness: 0.35 });
  const hullD  = new THREE.MeshStandardMaterial({ color: pal.hullD ?? 0x4a4e52, roughness: 0.6, metalness: 0.5 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6, metalness: 0.4 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x8a7458, roughness: 0.85 });
  const glass  = new THREE.MeshBasicMaterial({ color: pal.glass ?? 0x2a3a4a });
  const warm   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const cloths = (pal.cloth || [0xb8402a, 0x2a6a8a, 0xd8a03a, 0x5a7a3a]).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
  const K = arenaKit(), R = seeded(73);
  const H = L.arena / 2;
  const pic = (m) => { m.userData.passThrough = true; return m; };

  // ---- the LANDING PAD and the CINDERWAKE: a low deck, and the hero's gunship standing on it, ramp down to the south ----
  { const [px, pz] = OUTPOST_SPOTS.pad;
    K.box(px, pz, 8, 6, 0.2, metal, { climbable: true });
    for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.3, 0.04, 12), stripe, px + sx*7.7, 0.21, pz);
    for (const sx of [-1, 1]) for (const dz of [-5.5, 0, 5.5]) K.deco(new THREE.SphereGeometry(0.15, 8, 6), warm, px + sx*7.5, 0.3, pz + dz);
    buildGunship(px, pz + 2.2, { hull: pal.hull, dark: pal.hullD, stripe: pal.stripe }); }

  // ---- the CONDENSER: the town's moisture tower in the middle of the square, banded, with a ring of water drums ----
  { const [cx, cz] = OUTPOST_SPOTS.condenser;
    K.column(cx, cz, 1.0, 1.0, adobeD, { wallKick: false, seg: 14, taper: 1 });
    K.column(cx, cz, 0.55, 7.5, metal, { seg: 10, taper: 0.7 });
    for (const y of [2.4, 4.0, 5.6]) K.deco(new THREE.CylinderGeometry(0.6, 0.6, 0.22, 12), rust, cx, y, cz);
    K.deco(new THREE.CylinderGeometry(0.45, 0.3, 0.5, 10), rust, cx, 7.75, cz);   // the cap
    for (let k = 0; k < 3; k++){   // condenser fins down the mast (thin: pictures)
      const a = k * Math.PI * 2 / 3;
      pic(K.deco(new THREE.BoxGeometry(0.08, 3.6, 0.9), metal, cx + Math.cos(a)*0.7, 4.6, cz + Math.sin(a)*0.7, 0, Math.PI/2 - a, 0));
    }
    for (const a of [0.5, 2.6, 4.4]){
      const x = cx + Math.cos(a)*2.4, z = cz + Math.sin(a)*2.4;
      K.column(x, z, 0.45, 1.05, rust, { wallKick: false, seg: 10, taper: 1 });
    } }

  // ---- the CANTINA: a long whitewashed block under a shallow dome, its lit door and an awning facing the square ----
  { const [cx, cz] = OUTPOST_SPOTS.cantina;
    K.box(cx, cz, 7, 4.2, 4.4, adobe);
    K.deco(new THREE.SphereGeometry(4.2, 18, 8, 0, Math.PI*2, 0, Math.PI/2), adobeD, cx, 4.3, cz).scale.y = 0.5;
    solids.push({ x: cx, z: cz, r: 4.2, y0: 4.3, h: 6.4 });   // (the dome: stand on it)
    K.deco(new THREE.PlaneGeometry(2.2, 2.7), warm, cx, 1.35, cz + 4.22);
    K.deco(new THREE.BoxGeometry(3.0, 0.4, 0.4), trim, cx, 2.9, cz + 4.3);
    for (const sx of [-1, 1]) K.deco(new THREE.PlaneGeometry(1.1, 0.8), glass, cx + sx*4.6, 2.2, cz + 4.21);
    // the awning out over the doorstep: two posts and a cloth on a frame (a slab: land on it, walk under it)
    for (const sx of [-1, 1]) K.column(cx + sx*3.2, cz + 7.2, 0.14, 3.1, trim, { wallKick: false, seg: 6, taper: 1 });
    K.deco(new THREE.BoxGeometry(7.0, 0.12, 3.2), cloths[0], cx, 3.15, cz + 5.7);
    K.slab(cx, cz + 5.7, 3.5, 1.6, 3.0, 3.25);
    K.sign('CANTINA', cx, 3.8, cz + 4.5, 0, { w: 3.4 });
    // tables on the doorstep: low drums with a top (vault them)
    for (const [x, z] of [[cx - 5.2, cz + 6.2], [cx + 5.4, cz + 6.6]]){
      K.column(x, z, 0.72, 0.95, adobeD, { wallKick: false, seg: 10, taper: 1 });
      K.deco(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 12), trim, x, 0.99, z);
    } }

  // ---- the GUILD HALL: two storeys on the east side, the broker's balcony over the square ----
  { const [gx, gz] = OUTPOST_SPOTS.guild;
    K.box(gx + 1, gz, 4.5, 5.5, 3.6, adobeD);
    K.box(gx + 2.2, gz, 3.3, 4.2, 6.6, adobe);                  // the upper storey, set back
    K.deco(new THREE.BoxGeometry(2.0, 0.5, 9.6), trim, gx - 4.5, 3.85, gz);   // the balcony's deck, out over the square…
    K.slab(gx - 4.5, gz, 1.0, 4.8, 3.6, 4.1);
    K.deco(new THREE.BoxGeometry(0.12, 0.8, 9.6), trim, gx - 5.45, 4.5, gz);  // …its rail (thin: only a picture)…
    for (const sz of [-1, 1]) K.column(gx - 5.2, gz + sz*4.4, 0.18, 3.6, trim, { wallKick: false, seg: 6, taper: 1 });   // …and its posts
    K.deco(new THREE.PlaneGeometry(1.8, 2.4), warm, gx - 3.52, 1.2, gz, 0, -Math.PI/2, 0);   // the door to the square
    for (const sz of [-1, 1]) K.deco(new THREE.PlaneGeometry(1.0, 0.9), glass, gx - 1.08, 4.6, gz + 2.6 + (sz > 0 ? 0 : -6.6), 0, -Math.PI/2, 0);
    K.sign('BOUNTY GUILD', gx - 1.16, 6.0, gz - 2.2, -Math.PI/2, { w: 2.6 });
    K.banner(gx - 1.12, 4.9, gz + 0.9, -Math.PI/2, 1.0, 2.2, 0x2a3a4a, 0xd9a43a, 0xd9a43a);
    // cargo stacked against the hall's north end: the climb to the balcony
    K.box(gx - 2.6, gz + 7.0, 1.0, 1.0, 1.1, crate, { climbable: true });
    K.box(gx - 1.6, gz + 7.4, 0.9, 0.9, 2.2, crate); }

  // ---- MARKET STALLS down the west side: a counter to vault, two posts, an awning overhead, goods on the counter ----
  OUTPOST_SPOTS.stalls.forEach(([sx, sz], i) => {
    K.box(sx + 1.4, sz, 0.5, 2.4, 1.05, trim);                 // the counter, facing the square
    for (const dz of [-2.4, 2.4]) K.column(sx - 0.9, sz + dz, 0.12, 2.9, trim, { wallKick: false, seg: 6, taper: 1 });
    for (const dz of [-2.4, 2.4]) K.column(sx + 1.8, sz + dz, 0.12, 2.6, trim, { wallKick: false, seg: 6, taper: 1 });
    pic(K.deco(new THREE.BoxGeometry(3.4, 0.08, 5.4), cloths[(i + 1) % cloths.length], sx + 0.45, 2.8, sz, 0, 0, -0.12));
    K.slab(sx + 0.45, sz, 1.7, 2.7, 2.6, 3.0);
    for (let n = 0; n < 4; n++) K.deco(new THREE.BoxGeometry(0.35, 0.3, 0.35), cloths[(i + n) % cloths.length], sx + 1.4, 1.2, sz - 1.6 + n*1.05);
    K.box(sx - 2.0, sz + (i % 2 ? 1.2 : -1.2), 0.6, 0.6, 0.9, crate, { climbable: true });
  });
  // the salt cart: a low flatbed of salt blocks behind the stalls
  K.box(-24, -5, 1.4, 2.6, 1.0, rust, { climbable: true });
  for (let n = 0; n < 3; n++) K.deco(new THREE.BoxGeometry(1.1, 0.38, 1.2), adobe, -24, 1.19, -6.6 + n*1.6);

  // ---- SHACKS: domed huts in the corners and along the streets ----
  for (const [x, z, r] of [[-21, 18, 2.8], [22, 17, 2.6], [-22, -22, 3.0], [23, -21, 2.7], [10, -25, 2.2], [-11, 24, 2.0]]){
    K.column(x, z, r, 2.6, adobe, { wallKick: false, seg: 14, taper: 1 });
    K.deco(new THREE.SphereGeometry(r, 14, 6, 0, Math.PI*2, 0, Math.PI/2), adobeD, x, 2.6, z).scale.y = 0.55;
    solids.push({ x, z, r: r * 0.92, y0: 2.6, h: 2.6 + r * 0.5 });
    const a = Math.atan2(-z, -x);   // the door faces the square
    K.deco(new THREE.PlaneGeometry(1.0, 1.8), R() < 0.5 ? warm : trim, x + Math.cos(a)*(r + 0.02), 0.9, z + Math.sin(a)*(r + 0.02), 0, Math.PI/2 - a, 0);
    K.deco(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8), metal, x - Math.cos(a)*r*0.4, 2.6 + r*0.5, z - Math.sin(a)*r*0.4);   // a vent on the dome
  }

  // ---- COVER in the square and the streets: a parked landspeeder, cargo, low salt-block walls ----
  { const sx = 8, sz = 8;   // the landspeeder, nose to the pad
    K.box(sx, sz, 1.2, 2.4, 0.95, rust);
    K.deco(new THREE.BoxGeometry(2.0, 0.38, 1.6), hullD, sx, 1.14, sz - 0.6);
    K.deco(new THREE.BoxGeometry(1.8, 0.4, 0.1), glass, sx, 1.28, sz + 0.2, -0.5, 0, 0);
    for (const dx of [-0.85, 0.85]) K.deco(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8), metal, sx + dx, 0.62, sz - 1.4, Math.PI/2, 0, 0); }
  for (const [x, z, hx, hz, h] of [[-7, 10, 1.4, 0.6, 1.0], [10, -9, 0.6, 1.6, 1.1], [-9, -8, 0.7, 0.7, 1.4], [6, -13, 1.2, 0.6, 0.9], [-4, 5, 0.6, 0.6, 0.8], [14, 9, 0.7, 0.7, 1.3]]){
    K.box(x, z, hx, hz, h, crate, { climbable: h <= 1.1 });
    K.deco(new THREE.BoxGeometry(hx*2 + 0.04, 0.08, hz*2 + 0.04), stripe, x, h*0.55, z);
  }
  // low salt-block walls along the streets
  for (const [x, z, hx, hz] of [[-12, 14, 2.6, 0.45], [13, 14, 2.4, 0.45], [-11, -16, 0.45, 2.4], [12, -16, 0.45, 2.2]]) K.box(x, z, hx, hz, 1.0, adobeD, { climbable: true });

  // ---- the guild's LOOKOUT scaffold: the overwatch climb (south-west) ----
  K.gantry(-16, -18, { a: adobeD, b: rust, strut: trim, beacon: pal.lamp ?? 0xffc070 }, [-1, 1]);

  // ---- the town's EDGE: low adobe walls and lean-tos just past the play space, broken where the streets run out ----
  for (const side of ['n', 's', 'e', 'w']){
    const ns = side === 'n' || side === 's', s = side === 'n' || side === 'e' ? 1 : -1, d = H + 2.2;
    for (let a = -H + 2; a < H - 1; a += 6.5){
      if (Math.abs(a) < 6) continue;   // the main street runs straight out
      const len = 3 + R() * 2, h = 1.6 + R() * 2.4, m = R() < 0.5 ? adobe : adobeD;
      if (ns) K.deco(new THREE.BoxGeometry(len, h, 2.2), m, a, h/2, s*d); else K.deco(new THREE.BoxGeometry(2.2, h, len), m, s*d, h/2, a);
    }
  }

  // ---- FUEL DRUMS: by the cantina's wall, the guild and the pad ----
  for (const [x, z] of [[-8.5, -13.5], [13.5, -12], [9, 18], [-20, 2]]) spawnBarrel(V3(x, 0, z));
}

/* the CINDERWAKE: the hero's gunship, a blunt hull on landing legs, cockpit forward (+z), engines on the stub wings,
   the ramp lowered to the south from its tail. The covert's last ship is the same make (world/arenas/covert.js), and
   lifts off when its hold is done (game/mission.js liftOff), so it's a live prop like the refuge's transport: it
   returns { group, ramp, glow, hatch, solids } (the shape shared.refugeShip takes). c: its colours. Every part you
   could land on has collision: the hull to the ground, the wings and engines as slabs, the ramp as three steps. */
export function buildGunship(x, z, c = {}){
  const g = new THREE.Group(); g.userData.noBake = true;
  const hullM = toon(c.hull ?? 0x8c8e88), darkM = toon(c.dark ?? 0x4a4e52), trimM = toon(c.stripe ?? 0xd9a43a);
  const glassM = toon(0x2a3a4a, { emissive: 0x203040, ei: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x7ad0ff, toneMapped: false });
  const part = (geo, m, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(px, py, pz); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; g.add(mesh); inkify(mesh, 0.05); return mesh;
  };
  const W = 2.4, L = 4.2, B = 1.15;   // half-width, half-length, the belly's height (the ramp's hinge)
  part(new THREE.BoxGeometry(W*2, 3.2, L*2), hullM, 0, B + 1.6, 0);                       // the hull
  part(new THREE.BoxGeometry(W*2 + 0.1, 0.45, L*2 + 0.1), trimM, 0, B + 2.4, 0);           // the clan's band
  part(new THREE.BoxGeometry(W*2, 0.5, L*1.4), darkM, 0, B + 3.45, 0.2);                   // the roof spine
  part(new THREE.BoxGeometry(3.6, 1.4, 2.2), hullM, 0, 3.0, L + 0.8, 0.35);                // the nose…
  part(new THREE.BoxGeometry(2.6, 0.6, 0.12), glassM, 0, 3.45, L + 1.75, -0.6);            // …and its canopy
  for (const sx of [-1, 1]){
    part(new THREE.BoxGeometry(2.0, 0.35, 4.2), darkM, sx*(W + 1.0), 2.8, -0.6, 0, 0, sx*0.18);   // stub wings
    part(new THREE.CylinderGeometry(0.6, 0.7, 3.0, 10), darkM, sx*(W + 1.5), 3.5, -1.2, Math.PI/2);   // engines on the wings
    const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), glow);
    nozzle.position.set(sx*(W + 1.5), 3.5, -2.72); nozzle.rotation.y = Math.PI; g.add(nozzle);
    for (const dz of [-2.8, 2.8]) part(new THREE.CylinderGeometry(0.2, 0.24, B, 6), darkM, sx*1.7, B/2, dz);   // landing legs
  }
  // the ramp: hinged at the hull's tail, lowered toward -z until its lip rests on the ground
  const ramp = new THREE.Group(); ramp.position.set(0, B, -L); g.add(ramp);
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 3.2), darkM);
  rampMesh.position.set(0, 0, -1.6); rampMesh.castShadow = true; inkify(rampMesh, 0.05); ramp.add(rampMesh);
  ramp.rotation.x = -0.36;
  const hatch = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: 0xffd8a0 }));
  hatch.position.set(0, B + 1.1, -L - 0.02); hatch.rotation.y = Math.PI; g.add(hatch);
  g.position.set(x, 0, z);
  shared.arenaGroup.add(g);
  const list = [
    { x, z, hx: W, hz: L, h: B + 3.7, box: true },                                    // the hull and its spine, to the ground
    { x, z: z + L + 0.8, hx: 1.8, hz: 1.1, y0: 2.2, h: 3.8, box: true },              // the nose, overhead
  ];
  for (const sx of [-1, 1]){
    list.push({ x: x + sx*(W + 1.0), z: z - 0.6, hx: 1.0, hz: 2.1, y0: 2.55, h: 3.15, box: true });   // a wing
    list.push({ x: x + sx*(W + 1.5), z: z - 1.2, hx: 0.65, hz: 1.5, y0: 3.15, h: 4.2, box: true });  // its engine
  }
  for (let i = 0; i < 3; i++){   // the ramp, as three steps up to the hatch
    const d0 = i * 1.07, d1 = d0 + 1.07, slope = Math.sin(0.36), run = Math.cos(0.36);
    list.push({ x, z: z - L - (d0 + d1)/2 * run, hx: 1.1, hz: 1.07 * run / 2, h: B - d0 * slope, box: true, climbable: true });
  }
  solids.push(...list);
  return { group: g, ramp, glow, hatch, solids: list };
}
