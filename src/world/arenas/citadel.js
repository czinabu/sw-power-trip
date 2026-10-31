// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena (the Mandalorian's story): THE IRON CITADEL on Duren, the Magistrate's throne yard, where the last waves
// and the Magistrate himself are fought (data/campaign-mando.js: THE IRON THRONE).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared, hazardZones, solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* THE IRON CITADEL (half-size 32). An iron-walled yard at the heart of the Magistrate's fortress, open to a sky of
   foundry smoke. Laid out like the other throne fight (world/arenas/sith.js), so the boss comes down off the dais the
   same way:
     · the THRONE at the far end (−z): a seat built of stacked helmets, every one taken from a covert he broke, on three
       walkable rises; the foundlings' cage beside it;
     · the WALLS past the edge: riveted iron, buttresses, his mark on hanging plates, the Iron Guard watching from the
       walk along the top;
     · two rows of IRON PILLARS down the yard (x ±14), fire baskets on top: wall-kick faces, cover;
     · ARMOUR RACKS and ingot stacks as low cover; the yard's SLAG GRATES vent on a slow, telegraphed cycle;
     · a lift tower in the south-west corner as the overwatch. The player comes in from the south (z +16). */
export const CITADEL = { half: 32 };

export function buildCitadelArena(L){
  const pal = L.pal || {};
  const iron   = new THREE.MeshStandardMaterial({ color: pal.iron ?? 0x4a4c54, roughness: 0.6, metalness: 0.7 });
  const ironD  = new THREE.MeshStandardMaterial({ color: pal.ironD ?? 0x2a2c32, roughness: 0.65, metalness: 0.6 });
  const rivet  = new THREE.MeshStandardMaterial({ color: pal.rivet ?? 0x6a6e78, roughness: 0.4, metalness: 0.85 });
  const beskar = new THREE.MeshStandardMaterial({ color: pal.beskar ?? 0xa8b0b8, roughness: 0.35, metalness: 0.88 });
  const rust   = new THREE.MeshStandardMaterial({ color: pal.rust ?? 0x6a3e2a, roughness: 0.85, metalness: 0.3 });
  const cloth  = pal.cloth ?? 0x4a1a18;
  const fireC  = pal.fire ?? 0xff7a2a;
  const fire   = new THREE.MeshBasicMaterial({ color: fireC });
  const ember  = new THREE.MeshBasicMaterial({ color: pal.ember ?? 0xffc060 });
  const molten = new THREE.MeshBasicMaterial({ color: pal.molten ?? 0xff6a1a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const visor  = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
  const K = arenaKit(), R = seeded(73), H = CITADEL.half, off = H + 1.0;
  const flame = (x, y, z, s = 1) => { for (let n = 0; n < 3; n++){
    const f = K.deco(new THREE.ConeGeometry(0.34*s, (0.9 + R()*0.6)*s, 7), n % 2 ? fire : ember, x + (n - 1)*0.4*s, y + 0.45*s, z + (R() - 0.5)*0.4*s);
    f.userData.noBake = true; f.userData.passThrough = true; f.castShadow = false; } };
  // a helmet: a dome, a T-visor (facing +z unless turned)
  const helmet = (x, y, z, s = 1, ry = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32*s, 10, 8), R() < 0.7 ? beskar : rivet); dome.scale.y = 1.15; g.add(dome);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.4*s, 0.08*s, 0.04), visor); t1.position.set(0, 0.04*s, 0.31*s); g.add(t1);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.08*s, 0.24*s, 0.04), visor); t2.position.set(0, -0.08*s, 0.31*s); g.add(t2);
    g.traverse(m => { m.castShadow = true; m.userData.passThrough = true; });   // (a relief on what it sits on: the collision audit skips it)
    shared.arenaGroup.add(g);
    return g;
  };

  // ---- the WALLS: riveted iron just past the yard on every side, buttresses, plates with his mark, the guard above ----
  for (const side of ['n', 's', 'e', 'w']){
    const ns = side === 'n' || side === 's', s = side === 's' || side === 'e' ? 1 : -1;
    const put = (geo, mat, a, y, d) => ns ? K.deco(geo, mat, a, y, s*d) : K.deco(geo, mat, s*d, y, a, 0, Math.PI/2, 0);
    put(new THREE.BoxGeometry(H*2 + 6, 12, 2), iron, 0, 6, off + 1);
    put(new THREE.BoxGeometry(H*2 + 6, 0.6, 3), ironD, 0, 12.3, off + 1);
    for (let a = -H; a <= H; a += 8){
      if (side === 'n' && Math.abs(a) < 10) continue;
      put(new THREE.BoxGeometry(1.4, 12, 1.2), ironD, a, 6, off - 0.2);
      for (let y = 2; y < 12; y += 2.5) put(new THREE.SphereGeometry(0.12, 6, 4), rivet, a, y, off - 0.85);
    }
    for (let a = -H + 4; a <= H - 4; a += 8){
      if (side === 'n' && Math.abs(a) < 10) continue;
      if (R() < 0.6) K.banner(ns ? a : s*(off - 0.02), 7.5, ns ? s*(off - 0.02) : a, ns ? (s > 0 ? Math.PI : 0) : (s > 0 ? -Math.PI/2 : Math.PI/2), 2.2, 4.0, cloth, 0x8a8e96, 0xc0c4cc);
      // the Iron Guard on the wall walk
      if (R() < 0.55) { put(new THREE.CylinderGeometry(0.3, 0.36, 1.6, 8), ironD, a + 2, 13.4, off + 1); helmet(ns ? a + 2 : s*(off + 1), 14.5, ns ? s*(off + 1) : a + 2, 1, ns ? (s > 0 ? Math.PI : 0) : (s > 0 ? -Math.PI/2 : Math.PI/2)); }
    }
  }

  // ---- the THRONE: a seat of stacked helmets on three rises, his furnace glowing behind it ----
  K.deco(new THREE.BoxGeometry(20, 18, 2), ironD, 0, 9, -(off + 1.2));
  K.deco(new THREE.CircleGeometry(4.2, 28), molten, 0, 10, -(off + 0.15));   // the furnace's eye, through the wall
  for (const [hx, hz, h, z] of [[8, 2.6, 0.4, -(H - 2.6)], [6, 2.0, 0.8, -(H - 2.0)], [4, 1.4, 1.2, -(H - 1.4)]]){
    K.box(0, z, hx, hz, h, iron, { climbable: true });
    K.deco(new THREE.BoxGeometry(hx*2 + 0.06, 0.06, 0.12), new THREE.MeshBasicMaterial({ color: fireC }), 0, h + 0.01, z + hz).userData.noBake = true;
  }
  { const z = -(H - 0.9);
    K.box(0, z, 1.5, 0.9, 2.2, ironD);   // the seat
    K.box(0, -(off - 0.4), 2.6, 0.6, 7.2, ironD);   // its back, a wall of helmets on it
    for (let y = 3.0; y < 7.2; y += 0.72) for (let x = -2.2; x <= 2.21; x += 0.74) helmet(x + (R() - 0.5)*0.1, y, -(off - 0.4) + 0.75, 0.95);
    for (const sx of [-1, 1]){ K.box(sx*1.7, z, 0.3, 0.9, 3.0, beskar); helmet(sx*1.7, 3.4, z, 1.1); }
  }
  // braziers flanking the dais
  for (const sx of [-1, 1]){
    K.column(sx*9.5, -(H - 3), 0.8, 1.6, ironD, { wallKick: false, seg: 8, taper: 1.2 });
    flame(sx*9.5, 1.6, -(H - 3), 1.1);
  }
  // the foundlings' cage, empty now, by the throne's east side
  { const cx = 13, cz = -(H - 4);
    K.box(cx, cz, 2.2, 2.2, 0.3, ironD, { climbable: true });
    for (let a = 0; a < Math.PI*2; a += Math.PI/8) K.deco(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), ironD, cx + Math.cos(a)*2.1, 2.0, cz + Math.sin(a)*2.1);
    K.deco(new THREE.CylinderGeometry(2.3, 2.3, 0.2, 16), ironD, cx, 3.7, cz);
    solids.push({ x: cx, z: cz, r: 2.15, h: 3.8 });   // (the bars stand all round it: a solid drum you can stand on)
  }

  // ---- the IRON PILLARS: two rows down the yard, fire baskets on top ----
  for (const x of [-14, 14]) for (const z of [-17, -3, 11]){
    const h = 9 + R()*1.5, r = 1.1;
    K.column(x, z, r, h, iron, { taper: 0.9, seg: 8 });
    K.box(x, z, r*1.35, r*1.35, 0.6, ironD, { climbable: true });
    for (let y = 1.5; y < h; y += 2.2) K.deco(new THREE.TorusGeometry(r*0.96, 0.08, 4, 16), rivet, x, y, z, Math.PI/2);
    K.deco(new THREE.CylinderGeometry(1.1, 0.7, 0.8, 8), ironD, x, h + 0.4, z);
    solids.push({ x, z, r: 1.1, y0: h, h: h + 0.8 });
    flame(x, h + 0.7, z, 1.2);
  }

  // ---- ARMOUR RACKS and INGOT STACKS: low cover across the yard ----
  for (const [x, z, alongX] of [[-6, 4, true], [7, -9, false], [-22, -14, false], [22, 6, true], [-4, 22, true], [23, 22, false]]){
    const hx = alongX ? 2.2 : 0.45, hz = alongX ? 0.45 : 2.2;
    K.box(x, z, hx, hz, 1.2, rust);
    for (let t = -1.6; t <= 1.6; t += 0.8) helmet(x + (alongX ? t : 0), 1.52, z + (alongX ? 0 : t), 0.85, alongX ? 0 : Math.PI/2);
  }
  for (const [x, z] of [[-24, 8], [9, 16], [24, -18], [-10, -20]]){
    K.box(x, z, 1.0, 0.6, 0.9, beskar, { climbable: true });
    K.deco(new THREE.BoxGeometry(1.6, 0.3, 0.9), beskar, x, 1.05, z, 0, 0.3, 0);
  }

  // ---- the SLAG GRATES: the furnace vents through them on a cycle ----
  [[-20, -4], [20, 12], [-6, 14]].forEach(([x, z], i) => {
    K.deco(new THREE.BoxGeometry(4.6, 0.06, 4.6), ironD, x, 0.03, z);
    for (let t = -1.8; t <= 1.8; t += 0.6) K.deco(new THREE.BoxGeometry(0.12, 0.07, 4.2), new THREE.MeshBasicMaterial({ color: fireC }), x + t, 0.04, z).userData.noBake = true;
    hazardZones.push({ kind: 'point', cx: x, cz: z, r: 2.4, period: 10, warnDur: 1.6, activeDur: 1.0, dmg: 18, color: fireC, flash: true, t: i * 3.3 });
  });

  // ---- the LIFT TOWER (the overwatch climb) in the south-west ----
  K.gantry(-27, 26, { a: ironD, b: iron, strut: rust, beacon: fireC }, [1, -1]);

  // ---- fuel drums for the guard's flamers ----
  for (const [x, z] of [[-9, -24], [11, 22], [-27, -22], [27, 14]]) spawnBarrel(V3(x, 0, z));
}
