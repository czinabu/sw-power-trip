// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the hidden refuge, a landing field in a mountain valley (data/missions.js, game/mission.js).

import * as THREE from 'three';
import { shared, solids } from '../../state.js';
import { arenaKit, seeded, at } from './kit.js';
import { toon, inkify } from '../ink.js';

/* THE HIDDEN REFUGE (half-size 32). A wide valley floor in front of a refuge cut into the mountain, laid out for the
   mission's three objectives:
     · the LANDING PAD in the north: a broad deck with the TRANSPORT on it, its ramp lowered toward the field;
     · the REFUGE on the west: a stone shelter whose lit doorway the younglings (or foundlings) file out of, along
       the path to the ramp. The ground between the path and the ramp is the spot to hold;
     · three UPLINK MASTS the Empire has planted round the field (west, east, south), each with a console to slice;
     · the open FIELD in the middle, scattered with low cover, where the duel is fought.
   The player starts south of the pad, facing the transport. */
export const REFUGE_SPOTS = {
  pad: [0, 19],
  ramp: [[0, 13.0], [0, 16.0]],                                      // foot of the ramp, then the hatch
  path: [[-19.2, 10.5], [-13, 10], [-6, 11.2], [-1.2, 12.4]],        // shelter door → foot of the ramp
  uplinks: [[-23, -6], [23, -2], [5, -23]],
  wall: { z: 4.5, gap: 9.5 },   // the barricade line across the field: open only for |x| < gap
};

export function buildRefugeArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x8c8a86, roughness: 0.93, metalness: 0.05 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x64625e, roughness: 0.95, metalness: 0.04 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5c6470, roughness: 0.55, metalness: 0.7 });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46, roughness: 0.5, metalness: 0.7 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a, roughness: 0.6, metalness: 0.4 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x7a6a52, roughness: 0.85, metalness: 0.1 });
  const warm   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const red    = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  const K = arenaKit(), R = seeded(57);

  // ---- the LANDING PAD — a broad, low deck (walkable) with hazard-striped edges and landing lights ----
  { const [px, pz] = REFUGE_SPOTS.pad;
    K.box(px, pz, 9, 7.5, 0.22, metal, { climbable: true });
    for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.35, 0.04, 15), stripe, px + sx*8.6, 0.23, pz);
    K.deco(new THREE.BoxGeometry(17.5, 0.04, 0.35), stripe, px, 0.23, pz - 7.2);
    for (const sx of [-1, 1]) for (const dz of [-6.6, 0, 6.6]) K.deco(new THREE.SphereGeometry(0.16, 8, 6), warm, px + sx*8.3, 0.32, pz + dz); }

  buildTransport();

  // ---- the REFUGE — a stone shelter in the west with a lit doorway facing the pad ----
  { const [dx, dz] = REFUGE_SPOTS.path[0];
    const cx = dx - 3.6;
    K.box(cx, dz, 3.4, 4.5, 4.2, stoneD);
    K.deco(new THREE.BoxGeometry(7.4, 0.5, 9.6), stone, cx, 4.45, dz);
    K.deco(new THREE.BoxGeometry(5.2, 1.6, 7.2), stone, cx - 0.4, 5.5, dz);   // upper storey, set back
    K.deco(new THREE.PlaneGeometry(1.7, 2.5), warm, cx + 3.42, 1.25, dz, 0, Math.PI/2, 0);   // the lit doorway
    K.deco(new THREE.BoxGeometry(0.5, 0.35, 2.6), stone, cx + 3.55, 2.65, dz);
    for (const sz of [-1, 1]){ K.column(cx + 3.9, dz + sz*1.6, 0.25, 1.4, stoneD, { wallKick: false, seg: 8 }); K.deco(new THREE.SphereGeometry(0.22, 8, 6), warm, cx + 3.9, 1.6, dz + sz*1.6); } }
  // the path to the ramp: worn flagstones and low lamps
  { const P = REFUGE_SPOTS.path;
    for (let i = 0; i < P.length - 1; i++){
      const [ax, az] = P[i], [bx, bz] = P[i+1], len = Math.hypot(bx - ax, bz - az);
      K.deco(new THREE.BoxGeometry(len + 0.6, 0.03, 1.5), stone, (ax+bx)/2, 0.02, (az+bz)/2, 0, -Math.atan2(bz - az, bx - ax), 0);
    } }

  // ---- UPLINK MASTS — the Empire's antenna towers, set just outside each console's spot ----
  for (const [x, z] of REFUGE_SPOTS.uplinks){
    const d = Math.hypot(x, z), mx = x + x/d*2.4, mz = z + z/d*2.4;
    K.column(mx, mz, 0.5, 9, imp, { wallKick: false, seg: 6, taper: 0.4 });
    K.box(mx, mz, 1.0, 1.0, 0.5, imp);
    for (const y of [3.5, 5.8]) K.deco(new THREE.BoxGeometry(2.2, 0.12, 0.12), imp, mx, y, mz, 0, Math.atan2(x, z), 0);
    K.deco(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 4), imp, mx, 9.8, mz);
    K.deco(new THREE.SphereGeometry(0.2, 8, 6), red, mx, 10.6, mz);
  }

  // ---- the BARRICADE LINE — blast walls across the field either side of the ramp approach, out to the valley sides,
  // so from the south the only way to the ship is the gap in the middle (where the hero holds) ----
  { const W = REFUGE_SPOTS.wall, half = L.arena / 2;
    for (const sx of [-1, 1]){
      const x0 = W.gap, x1 = half + 0.5, cx = sx * (x0 + x1) / 2, hx = (x1 - x0) / 2;
      K.box(cx, W.z, hx, 0.5, 2.6, imp);
      K.deco(new THREE.BoxGeometry(hx * 2 + 0.05, 0.12, 1.05), stripe, cx, 2.62, W.z);
      for (let x = x0 + 2; x < x1 - 1; x += 4.5) K.deco(new THREE.BoxGeometry(0.4, 2.7, 1.2), metal, sx * x, 1.35, W.z);   // buttresses
      K.column(sx * x0, W.z, 0.6, 3.4, imp, { wallKick: false, seg: 8, taper: 1 });                                       // the gate posts
      K.deco(new THREE.SphereGeometry(0.22, 8, 6), warm, sx * x0, 3.6, W.z);
    } }

  // ---- COVER on the field — supply crates and low stone walls in a loose ring, the middle left open ----
  for (let i = 0; i < 9; i++){
    const a = (i / 9) * Math.PI*2 + 0.2, r = 12 + R()*5, [x, z] = at(a, r);
    if (z > REFUGE_SPOTS.wall.z - 2.5) continue;   // south of the barricade only: the ramp side stays clear for the line
    if (i % 3 === 0){ const ax = R() < 0.5; K.box(x, z, ax ? 2.4 : 0.35, ax ? 0.35 : 2.4, 1.3, stone); }   // low wall
    else { K.box(x, z, 0.8, 0.8, 1.1, crate); if (R() < 0.6) K.box(x + 1.3, z + 0.3, 0.6, 0.6, 0.8, crate); }
  }
  // ---- boulders round the rim: the valley walls closing in (solid, out of the lanes) ----
  for (let i = 0; i < 14; i++){
    const a = (i / 14) * Math.PI*2 + R()*0.2, [x, z] = at(a, 26 + R()*3);
    if (z > 14 && Math.abs(x) < 11) continue;   // behind the transport stays open
    if (REFUGE_SPOTS.uplinks.some(([ux, uz]) => Math.hypot(x - ux, z - uz) < 6)) continue;
    const r = 1.2 + R()*1.2;
    K.column(x, z, r, 1.4 + R()*2.2, stoneD, { wallKick: false, seg: 7, taper: 0.7 });
  }
  shared.templeBrazier = null;
}

/* THE TRANSPORT — a live prop (not baked, it lifts off): hull, cockpit, wings, engines and a lowered ramp.
   shared.refugeShip = { group, ramp, glow, solid } for game/mission.js to animate. */
function buildTransport(){
  const [px, pz] = REFUGE_SPOTS.pad;
  const g = new THREE.Group(); g.userData.noBake = true;
  const hullM = toon(0xd8d4cc), trimM = toon(0x9c2a24), darkM = toon(0x4a4e56), glassM = toon(0x2a4a6a, { emissive: 0x204060, ei: 0.4 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0x8ad0ff, toneMapped: false });
  const part = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; g.add(mesh); if (m !== glowM) inkify(mesh, 0.05); return mesh;
  };
  part(new THREE.BoxGeometry(4.4, 3.0, 10), hullM, 0, 2.6, 0);                         // main hull
  part(new THREE.BoxGeometry(4.5, 0.5, 10.1), trimM, 0, 3.2, 0);                       // the red band
  part(new THREE.CylinderGeometry(2.2, 2.2, 4.4, 14, 1, false, 0, Math.PI), hullM, 0, 2.6, 5.0, 0, 0, Math.PI/2);   // rounded nose
  part(new THREE.BoxGeometry(2.6, 1.0, 1.4), glassM, 0, 3.7, 5.6, -0.4);              // cockpit glass
  part(new THREE.BoxGeometry(0.4, 2.6, 4), hullM, 0, 5.2, -2.6, 0.25);                // dorsal fin
  for (const sx of [-1, 1]){
    part(new THREE.BoxGeometry(5.2, 0.35, 3.6), hullM, sx*4.6, 2.9, -1.2, 0, 0, sx*0.12);   // wing
    part(new THREE.BoxGeometry(0.4, 0.38, 3.6), trimM, sx*7.1, 3.2, -1.2, 0, 0, sx*0.12);   // wingtip
    part(new THREE.CylinderGeometry(0.9, 1.0, 3.6, 12), darkM, sx*3.0, 2.0, -4.6, Math.PI/2);   // engine pod
    const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.75, 14), glowM);
    nozzle.position.set(sx*3.0, 2.0, -6.42); nozzle.rotation.y = Math.PI; g.add(nozzle);
    for (const dz of [-3, 3]) part(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 6), darkM, sx*1.6, 0.6, dz);   // landing struts
  }
  // the ramp: hinged at the hull's rear-bottom edge, facing the field (the ship's tail points south)
  const ramp = new THREE.Group(); ramp.position.set(0, 1.15, -5.0); g.add(ramp);
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 3.2), darkM);
  rampMesh.position.set(0, 0, -1.6); rampMesh.castShadow = true; inkify(rampMesh, 0.05); ramp.add(rampMesh);
  ramp.rotation.x = -0.36;   // lowered: the lip rests on the deck
  const hatch = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.9), new THREE.MeshBasicMaterial({ color: 0xffd8a0 }));
  hatch.position.set(0, 2.1, -5.02); hatch.rotation.y = Math.PI; g.add(hatch);
  g.position.set(px, 0.22, pz + 2);   // built nose north (+z), so the tail and its ramp face the field
  shared.arenaGroup.add(g);
  // the hull blocks movement (wings are overhead); mission.js drops this when the ship lifts off
  const solid = { x: px, z: pz + 2, hx: 2.4, hz: 6.2, h: 4.2, box: true };
  solids.push(solid);
  shared.refugeShip = { group: g, ramp, glow: glowM, hatch, solid };
}

/* an EVACUEE — a small robed figure (a youngling) or a little cloaked foundling in a helmet. Live, not baked. */
export function makeEvacuee(kind, seed){
  const g = new THREE.Group();
  const robe = kind === 'foundling' ? [0x6a5a4a, 0x5a5048][seed % 2] : [0xc8b48e, 0x9a7a56, 0xb8a080][seed % 3];
  const skin = [0xe8c0a0, 0xb07a58, 0x7a5038, 0xd8a888][seed % 4];
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 10), toon(robe)); body.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), toon(kind === 'foundling' ? 0x9aa2aa : skin)); head.position.y = 0.92;
  for (const m of [body, head]){ m.castShadow = true; inkify(m, 0.025); g.add(m); }
  if (kind === 'foundling'){   // a T-visor on the little helmet
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.02), toon(0x101418)); visor.position.set(0, 0.95, 0.165); g.add(visor);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.02), toon(0x101418)); stem.position.set(0, 0.89, 0.165); g.add(stem);
  } else {                     // a padawan braid
    const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 4), toon(0x5a3a22)); braid.position.set(0.12, 0.8, -0.05); g.add(braid);
  }
  return g;
}
