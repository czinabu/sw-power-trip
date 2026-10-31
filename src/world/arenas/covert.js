// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena (the Mandalorian's story): THE COVERT, the clan's hidden home in a red canyon on Orvane, burning at dusk
// (data/campaign-mando.js: SMOKE OVER THE COVERT, THE LAST SHIP and THE EXILE'S CHALLENGE; data/missions.js covert).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared, solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { buildGunship } from './outpost.js';

/* THE COVERT (half-size 30). The canyon floor in front of the clan's hangar, the night the Magistrate found it:
     · the HANGAR MOUTH in the north (+z): a great cut in the canyon wall, the clan's LAST SHIP on the pad in front of
       it, ramp lowered south toward the yard;
     · the TUNNEL DOOR in the west: a round blast door in a rock spur, the clan's signet over it, where the foundlings
       come up from the lower halls and file along the path to the ramp. The ground in front of the ramp is the spot
       to hold;
     · the BLAST WALL: beskar plates across the yard either side of the ramp approach, open only in the middle;
     · the YARD to the south: the clan's domed dwellings (some of them burning), the old FORGE's hearth, boulders
       fallen from the rim, and three JAMMER masts the Magistrate planted on the canyon floor to keep the ship from
       calling the rest of the clan (west, east, south), each with a console to slice;
     · the open ground in the middle of the yard, where a duel is fought, and a scaffold on the rim as the overwatch.
   The Magistrate's troops came down the canyon walls on cables; they still hang from the rim. */
export const COVERT_SPOTS = {
  ship: [0, 22],
  ramp: [[0, 14.6], [0, 17.4]],                                     // foot of the ramp, then the hatch
  door: [-19.4, 13],
  path: [[-19.2, 13], [-13, 11.6], [-6, 11.8], [-1.2, 13.4]],       // tunnel door → foot of the ramp
  hold: [0, 10],
  jammers: [[-24, -2], [24, -6], [4, -24]],
  wall: { z: 5, gap: 8 },   // the blast wall across the yard: open only for |x| < gap
  forge: [15, 14],
};

export function buildCovertArena(L){
  const pal = L.pal || {};
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x7a3e2a, roughness: 0.95, flatShading: true });
  const rockD  = new THREE.MeshStandardMaterial({ color: pal.rockD ?? 0x52281c, roughness: 0.97, flatShading: true });
  const clay   = new THREE.MeshStandardMaterial({ color: pal.clay ?? 0x9a6a4e, roughness: 0.92 });
  const clayD  = new THREE.MeshStandardMaterial({ color: pal.clayD ?? 0x6e4836, roughness: 0.95 });
  const char   = new THREE.MeshStandardMaterial({ color: pal.char ?? 0x2e2220, roughness: 1 });
  const beskar = new THREE.MeshStandardMaterial({ color: pal.beskar ?? 0xa8b0b8, roughness: 0.35, metalness: 0.88 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5a6068, roughness: 0.55, metalness: 0.7 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x30343a, roughness: 0.6, metalness: 0.6 });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46, roughness: 0.5, metalness: 0.7 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6, metalness: 0.4 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x6a5a48, roughness: 0.85 });
  const glass  = new THREE.MeshBasicMaterial({ color: pal.glass ?? 0x1a2430 });
  const warm   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffa860 });
  const fire   = new THREE.MeshBasicMaterial({ color: pal.fire ?? 0xff7a2a });
  const ember  = new THREE.MeshBasicMaterial({ color: pal.ember ?? 0xffc060 });
  const molten = new THREE.MeshBasicMaterial({ color: pal.molten ?? 0xff7a1e });
  const red    = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  const dark   = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const K = arenaKit(), R = seeded(88), H = L.arena / 2;
  const flame = (x, y, z, s = 1) => { for (let n = 0; n < 3; n++){
    const f = K.deco(new THREE.ConeGeometry(0.34*s, (0.9 + R()*0.6)*s, 7), n % 2 ? fire : ember, x + (n - 1)*0.45*s, y + 0.45*s, z + (R() - 0.5)*0.5*s);
    f.userData.noBake = true; f.userData.passThrough = true; f.castShadow = false; } };

  // ---- the CANYON WALLS: sheer red rock just past the play space (east, west, north), the hangar's mouth cut in the north ----
  for (const side of ['e', 'w', 'n']){
    for (let a = -H - 2; a <= H + 2; a += 4.5){
      if (side === 'n' && Math.abs(a) < 9) continue;   // (the hangar's mouth)
      const h = 18 + R()*10, d = H + 2.5 + R()*2, w = 4.6 + R()*1.4, th = 3 + R()*2, m = R() < 0.5 ? rock : rockD;
      if (side === 'n') K.deco(new THREE.BoxGeometry(w, h, th), m, a, h/2, d, 0, (R() - 0.5)*0.2, 0);
      else K.deco(new THREE.BoxGeometry(th, h, w), m, (side === 'e' ? 1 : -1) * d, h/2, a, 0, (R() - 0.5)*0.2, 0);
    }
  }
  // the hangar's mouth: a dark arch in the north wall, a beskar lintel, work lamps either side
  K.deco(new THREE.PlaneGeometry(18, 13), dark, 0, 6.5, H + 3.4, 0, Math.PI, 0);
  K.deco(new THREE.BoxGeometry(20, 3.2, 3), rockD, 0, 14.6, H + 3.2);
  K.deco(new THREE.BoxGeometry(18.4, 0.6, 0.6), beskar, 0, 13.0, H + 1.8);
  for (const sx of [-1, 1]){
    K.deco(new THREE.BoxGeometry(2.2, 13, 3.4), rockD, sx*10.2, 6.5, H + 3.2);
    K.deco(new THREE.SphereGeometry(0.3, 8, 6), warm, sx*8.6, 9.5, H + 1.6);
  }

  // ---- the LAST SHIP on its pad in the hangar mouth, ramp down to the yard ----
  { const [sx, sz] = COVERT_SPOTS.ship;
    K.box(sx, sz - 1, 8.5, 6.5, 0.2, metalD, { climbable: true });
    for (const dx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.3, 0.04, 12.6), stripe, sx + dx*8.2, 0.21, sz - 1);
    shared.refugeShip = buildGunship(sx, sz, { hull: pal.hull ?? 0x6e7a70, dark: pal.metalD ?? 0x30343a, stripe: pal.stripe ?? 0xd9a43a }); }   // (it lifts off when the hold is done: game/mission.js)

  // ---- the TUNNEL DOOR: a rock spur in the west with a round blast door, the clan's signet over it ----
  { const [dx, dz] = COVERT_SPOTS.door, cx = dx - 4.4;
    K.box(cx, dz, 4.0, 5.2, 7.0, rock);
    K.box(cx - 1.4, dz + 1.0, 3.0, 3.6, 10.0, rockD);
    K.deco(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 20), beskar, cx + 4.05, 1.7, dz, 0, 0, Math.PI/2);   // the door
    K.deco(new THREE.TorusGeometry(1.75, 0.18, 8, 24), stripe, cx + 4.1, 1.7, dz, 0, Math.PI/2, 0);
    K.deco(new THREE.PlaneGeometry(1.2, 2.2), warm, cx + 4.22, 1.2, dz, 0, Math.PI/2, 0);                    // ajar: the halls lit behind it
    K.banner(cx + 4.06, 5.0, dz, Math.PI/2, 1.6, 2.2, 0x3a2420, 0xd9a43a, 0xd9a43a);                          // the signet
    for (const sz of [-1, 1]) K.deco(new THREE.SphereGeometry(0.22, 8, 6), warm, cx + 4.2, 3.6, dz + sz*2.2); }
  // the path from the door to the ramp: plates laid in the sand
  { const P = [...COVERT_SPOTS.path, COVERT_SPOTS.ramp[0]];
    for (let i = 0; i < P.length - 1; i++){
      const [ax, az] = P[i], [bx, bz] = P[i+1], len = Math.hypot(bx - ax, bz - az);
      K.deco(new THREE.BoxGeometry(len + 0.6, 0.03, 1.5), clayD, (ax+bx)/2, 0.02, (az+bz)/2, 0, -Math.atan2(bz - az, bx - ax), 0);
    } }

  // ---- the BLAST WALL: beskar plates across the yard either side of the approach to the ramp ----
  { const W = COVERT_SPOTS.wall;
    for (const sx of [-1, 1]){
      const x0 = W.gap, x1 = H + 0.5, cx = sx * (x0 + x1) / 2, hx = (x1 - x0) / 2;
      K.box(cx, W.z, hx, 0.45, 2.4, metal);
      K.deco(new THREE.BoxGeometry(hx*2 + 0.04, 0.14, 0.94), stripe, cx, 2.42, W.z);
      for (let x = x0 + 1.5; x < x1 - 0.5; x += 3.2) K.deco(new THREE.BoxGeometry(0.16, 2.2, 0.96), beskar, sx * x, 1.2, W.z);   // the plates' seams
      K.column(sx * (x0 + 0.5), W.z, 0.7, 3.2, beskar, { seg: 8, taper: 0.9 });   // a post at the gap
    } }

  // ---- the old FORGE's hearth in the north-east of the yard, still glowing, an anvil beside it ----
  { const [fx, fz] = COVERT_SPOTS.forge;
    K.column(fx, fz, 1.7, 1.2, metalD, { wallKick: false, seg: 14, taper: 1.05 });
    K.deco(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 16), molten, fx, 1.23, fz).userData.noBake = true;
    K.deco(new THREE.TorusGeometry(1.35, 0.12, 8, 18), stripe, fx, 1.25, fz, Math.PI/2);
    K.box(fx + 3.2, fz - 1.0, 0.5, 0.32, 0.6, metalD);
    K.deco(new THREE.BoxGeometry(1.5, 0.3, 0.6), beskar, fx + 3.2, 0.75, fz - 1.0);
    K.box(fx - 3.0, fz + 1.4, 0.9, 0.9, 1.0, crate, { climbable: true });
    K.deco(new THREE.BoxGeometry(1.2, 0.3, 0.8), beskar, fx - 3.0, 1.15, fz + 1.4); }

  // ---- the DWELLINGS: domed clay houses in the yard, some of them burning ----
  for (const [x, z, r, burning] of [[-17, -12, 2.6, 1], [-8, -24, 2.2, 0], [17, -19, 2.8, 1], [15, -1, 2.0, 0], [-24, 22, 2.2, 0], [22, 24, 2.0, 1]]){
    K.column(x, z, r, 2.4, burning ? char : clay, { wallKick: false, seg: 14, taper: 1 });
    K.deco(new THREE.SphereGeometry(r, 14, 6, 0, Math.PI*2, 0, Math.PI/2), burning ? char : clayD, x, 2.4, z).scale.y = 0.5;
    solids.push({ x, z, r: r * 0.92, y0: 2.4, h: 2.4 + r * 0.45 });
    const a = Math.atan2(-z, -x);
    K.deco(new THREE.PlaneGeometry(0.9, 1.7), burning ? fire : warm, x + Math.cos(a)*(r + 0.02), 0.85, z + Math.sin(a)*(r + 0.02), 0, Math.PI/2 - a, 0);
    if (burning) flame(x, 2.4 + r*0.45, z, 1.3);
  }

  // ---- BOULDERS fallen from the rim, and the clan's cargo: cover across the yard ----
  for (const [x, z, r, h] of [[-9, -11, 1.3, 1.5], [10, -11, 1.5, 2.2], [-13, 1, 1.1, 2.6], [8, -26, 1.2, 1.3], [-26, -14, 1.6, 2.8], [26, 12, 1.4, 2.0]]){
    K.column(x, z, r, h, R() < 0.5 ? rock : rockD, { seg: 7, taper: 0.75 });
  }
  for (const [x, z, hx, hz, h] of [[-7, -2, 0.7, 0.7, 1.0], [7, -4, 1.2, 0.6, 0.9], [12, 8, 0.7, 1.3, 1.1], [-11, 8, 1.2, 0.6, 1.0], [-3, -16, 0.8, 0.8, 1.3], [20, 2, 0.6, 0.6, 1.4]]){
    K.box(x, z, hx, hz, h, crate, { climbable: h <= 1.1 });
    K.deco(new THREE.BoxGeometry(hx*2 + 0.04, 0.08, hz*2 + 0.04), stripe, x, h*0.55, z);
  }

  // ---- the JAMMERS: the Magistrate's masts on the canyon floor, red-lit, a console at each one's foot ----
  for (const [x, z] of COVERT_SPOTS.jammers){
    const d = Math.hypot(x, z), mx = x + x/d*2.4, mz = z + z/d*2.4;
    K.column(mx, mz, 0.5, 8.5, imp, { wallKick: false, seg: 6, taper: 0.4 });
    K.box(mx, mz, 1.0, 1.0, 0.5, imp);
    for (const y of [3.2, 5.4]) K.deco(new THREE.BoxGeometry(2.4, 0.12, 0.12), imp, mx, y, mz, 0, Math.atan2(x, z), 0);
    K.deco(new THREE.TorusGeometry(0.6, 0.06, 6, 14), imp, mx, 7.0, mz, Math.PI/2);
    K.deco(new THREE.SphereGeometry(0.2, 8, 6), red, mx, 9.0, mz);
  }

  // ---- the CABLES the Magistrate's troops came down on, still hanging from the rim ----
  for (const [x, z] of [[-27, 4], [-27, -20], [27, -14], [27, 18], [-10, 30], [14, 30]]){
    const top = 26 + R()*4, gx = x * 0.9, gz = z * 0.94;
    const dx = gx - x, dz = gz - z, len = Math.hypot(dx, top, dz);
    const c = K.deco(new THREE.CylinderGeometry(0.04, 0.04, len, 4), metalD, (x + gx)/2, top/2, (z + gz)/2);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x - gx, top, z - gz).normalize());
    c.userData.passThrough = true;
  }

  // ---- the LOOKOUT scaffold on the canyon's west side (the overwatch climb) ----
  K.gantry(-24, -21, { a: metalD, b: metal, strut: stripe, beacon: pal.lamp ?? 0xffa860 }, [1, 1]);

  // ---- FUEL DRUMS the troops brought down to burn the covert out ----
  for (const [x, z] of [[-20, -4], [21, -12], [-2, -26], [9, 3]]) spawnBarrel(V3(x, 0, z));
}
