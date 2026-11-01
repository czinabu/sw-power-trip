// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the Imperial garrison block at the Vorran yards (the ARC trooper's THE KILL HOUSE,
// data/missions.js killhouse). A walled cell block of three rooms the squad breaches one after another
// (world/doors.js), and the yard in front of it where the gunship comes down.

import * as THREE from 'three';
import { shared, solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';
import { fieldKit } from './field.js';
import { addDoor } from '../doors.js';

/* THE GARRISON (60 across, half 30), at night in the rain.
     · the CELL BLOCK in the north (x −21…21, z 2…16): 4.2 m walls, no roof (the camera looks in from above), split
       into three rooms in a row: A the guard room (west), B the interrogation hall, C the cells (east). Its doors, in
       the order they're breached: 0 the block's front door into A (south wall), 1 A→B, 2 B→C (the partitions); then
       3 the cell's bars (Brisk's cell in C's north-east corner) and 4 C's own door back out to the yard;
     · the YARD in the south: the hero comes in through the gate (z −27), past a parked troop carrier, barricades and two
       guard towers (the overwatch climb), to the landing pad in the south-west where the gunship comes down.
   The stacking spot outside each door is clear on both sides; every lane is at least 3 m. */
export const GARRISON_SPOTS = {
  start: [0, -21, 0],                                         // inside the gate, facing the block (north)
  stack: [[-14, -1.4], [-9.4, 9], [4.6, 9]],                  // where the squad stacks up on doors 0, 1, 2
  rooms: [
    { at: [-14, 9], spots: [[-18, 12.5], [-11, 13.5], [-17, 4.5], [-10, 5], [-14, 13]] },     // A: the guard room
    { at: [0, 9],   spots: [[-4, 13.5], [4, 13.5], [-3.5, 5], [3.5, 5], [0, 11], [-1, 6.5]] }, // B: the interrogation hall
    { at: [14, 9],  spots: [[10, 13.5], [12.5, 5], [17.5, 5], [10, 6.5], [15, 9.5], [19, 8]] },  // C: the cells
  ],
  cell: [18.6, 13.9],                                         // Brisk's cell
  pad: [-13, -14],                                            // the landing pad
};
const H = 4.2, T = 0.3;   // the block's walls: height, half-thickness

export function buildGarrisonArena(L){
  const pal = L.pal || {};
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0x6a6e74, roughness: 0.85 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x4a4e56, roughness: 0.9 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x8a9098, roughness: 0.55, metalness: 0.45 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x3a3e46, roughness: 0.6, metalness: 0.45 });
  const door   = new THREE.MeshStandardMaterial({ color: pal.door ?? 0x5a5e66, roughness: 0.5, metalness: 0.55 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x5a5a52, roughness: 0.85 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xc8a03a, roughness: 0.6, metalness: 0.3 });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xd8e8ff });
  const screen = new THREE.MeshBasicMaterial({ color: pal.screen ?? 0x4ad2ff });
  const K = arenaKit(), R = seeded(13), F = fieldKit(K, R);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the CELL BLOCK's walls (gaps where the doors go) ----
  const wx = (x0, x1, z) => { K.box((x0 + x1) / 2, z, (x1 - x0) / 2, T, H, wall); K.deco(new THREE.BoxGeometry(x1 - x0, 0.2, T * 2 + 0.2), wallD, (x0 + x1) / 2, H + 0.1, z); };
  const wz = (z0, z1, x) => { K.box(x, (z0 + z1) / 2, T, (z1 - z0) / 2, H, wall); K.deco(new THREE.BoxGeometry(T * 2 + 0.2, 0.2, z1 - z0), wallD, x, H + 0.1, (z0 + z1) / 2); };
  wx(-21.3, -15.3, 2); wx(-12.7, 12.7, 2); wx(15.3, 21.3, 2);   // the front: door 0 at x −14, door 4 at x 14
  wx(-21.3, 21.3, 16);
  wz(2, 16, -21); wz(2, 16, 21);
  wz(2, 7.7, -7); wz(10.3, 16, -7);   // A | B, door 1 at z 9
  wz(2, 7.7, 7); wz(10.3, 16, 7);     // B | C, door 2 at z 9
  // the IMPERIAL trim: a dark band and red lamps along the front, a stripe over each door
  picture(K.deco(new THREE.BoxGeometry(42.6, 0.5, 0.05), wallD, 0, 1.0, 1.68));
  for (const x of [-19, -9, 0, 9, 19]) picture(K.deco(new THREE.BoxGeometry(0.5, 0.18, 0.08), red, x, 3.6, 1.66));

  // ---- the DOORS, in breach order: a blast door in each gap, a lintel over it ----
  const blastDoor = (x, z, alongX) => {
    const hx = alongX ? 1.3 : 0.22, hz = alongX ? 0.22 : 1.3, dh = 3.3;
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, dh, hz * 2), door); leaf.position.y = dh / 2; g.add(leaf);
    const band = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + (alongX ? 0 : 0.04), 0.22, hz * 2 + (alongX ? 0.04 : 0)), stripe);
    band.position.y = 1.6; g.add(band);
    for (const y of [0.8, 2.5]){ const r = new THREE.Mesh(new THREE.BoxGeometry(alongX ? hx * 1.6 : hx * 2 + 0.06, 0.08, alongX ? hz * 2 + 0.06 : hz * 1.6), metalD); r.position.y = y; g.add(r); }
    g.position.set(x, 0, z); g.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; } });
    K.deco(new THREE.BoxGeometry(alongX ? 2.6 : T * 2, H - dh, alongX ? T * 2 : 2.6), wall, x, dh + (H - dh) / 2, z);   // the lintel
    K.slab(x, z, alongX ? 1.3 : T, alongX ? T : 1.3, dh, H);
    const solid = { x, z, hx, hz, h: dh, box: true };
    solids.push(solid);
    K.deco(new THREE.BoxGeometry(alongX ? 0.6 : 0.06, 0.25, alongX ? 0.06 : 0.6), red, x + (alongX ? 0 : 0.34), dh + 0.25, z + (alongX ? -0.34 : 0)).userData.passThrough = true;
    return { g, solid };
  };
  const mkDoor = (x, z, alongX) => { const d = blastDoor(x, z, alongX); shared.arenaGroup.add(d.g); addDoor(d.g, d.solid, [x, z]); };
  mkDoor(-14, 2, true); mkDoor(-7, 9, false); mkDoor(7, 9, false);
  // door 3: the cell's bars (a solid row of bars across the cell's mouth)
  const bars = new THREE.Group();
  for (let i = 0; i < 9; i++){ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), metal); b.position.set(-2 + i * 0.5, 1.5, 0); bars.add(b); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.14), metalD); rail.position.y = 2.9; bars.add(rail);
  bars.position.set(18.6, 0, 11.6);
  const barsSolid = { x: 18.6, z: 11.6, hx: 2.2, hz: 0.15, h: 3, box: true }; solids.push(barsSolid);
  K.box(16.25, 13.8, 0.15, 2.2, 3, metalD);   // the cell's side wall
  bars.traverse(m => { if (m.isMesh) m.castShadow = true; });
  shared.arenaGroup.add(bars); addDoor(bars, barsSolid, [18.6, 11.6]);
  mkDoor(14, 2, true);

  // ---- inside the block: A the guard room, B the interrogation hall, C the cells ----
  K.box(-18, 6, 1.2, 0.6, 1.1, metal);                          // A: the duty desk
  picture(K.deco(new THREE.PlaneGeometry(0.9, 0.5), screen, -18, 1.4, 5.38, -0.4, Math.PI, 0));
  K.box(-20.2, 12, 0.5, 2.2, 2.3, metalD);                      // A: lockers on the west wall
  K.box(-11, 13.8, 0.9, 0.9, 1.6, crate);                       // A: a crate of riot batons
  K.box(0, 13.4, 2.2, 0.7, 1.0, metal);                         // B: the interrogation table
  K.box(-4.2, 4.4, 0.8, 0.8, 1.6, crate); K.box(4.2, 4.4, 0.8, 0.8, 1.6, crate);
  for (const x of [-5.6, 5.6]){ K.box(x, 15.3, 0.6, 0.5, 2.4, metalD); picture(K.deco(new THREE.PlaneGeometry(0.8, 0.6), screen, x, 1.7, 14.78, 0, Math.PI, 0)); }   // B: console banks
  K.box(10.2, 5, 0.9, 0.9, 1.6, crate);                         // C: crates and the jailer's desk
  K.box(10.6, 13.6, 1.2, 0.6, 1.1, metal);
  for (const x of [-14, 0, 14]) for (const z of [5, 13]) picture(K.deco(new THREE.BoxGeometry(1.4, 0.08, 0.4), lamp, x, H - 0.2, z));   // ceiling strips (no ceiling: on the wall tops' line)

  // ---- the YARD: the gate, the troop carrier, barricades, two guard towers and the landing pad ----
  for (const sx of [-1, 1]){
    K.box(sx * 7, -27.5, 3, 0.6, 3.6, wallD);                  // the gate's walls, open between
    K.column(sx * 4.2, -27.5, 0.6, 5, metalD, { wallKick: false, seg: 8, taper: 1 });
    K.deco(new THREE.SphereGeometry(0.22, 8, 6), red, sx * 4.2, 5.3, -27.5);
  }
  { // the troop carrier: a long boxy hull on its landing struts (hull 2.6: hard cover, a roof to fight from)
    const cx = 10, cz = -13;
    K.box(cx, cz, 4.2, 1.8, 2.6, metal);
    K.deco(new THREE.BoxGeometry(8.6, 0.3, 3.8), metalD, cx, 2.75, cz); solids[solids.length - 1].h = 2.9;
    K.box(cx - 4.9, cz, 0.7, 1.2, 1.4, metalD, { climbable: true });   // the ramp's step
    picture(K.deco(new THREE.BoxGeometry(8.4, 0.25, 0.05), stripe, cx, 1.6, cz - 1.82));
  }
  for (const w of [[-4, -8, 2.6, 1.6, 1], [3, -18, 2.4, 1.6, 1], [-19, -4, 2.2, 1.6, 0], [20, -4, 2.2, 1.6, 0], [-5, -19, 1.8, 1.6, 0]]) F.wall(w, { body: metal, cap: metalD });   // (1.6: tall enough to stop a bolt)
  K.gantry(-24, -24, { a: metal, b: metalD, strut: metalD, beacon: 0xff3a2a }, [1, 1]);
  K.gantry(23, -23, { a: metal, b: metalD, strut: metalD, beacon: 0xff3a2a }, [-1, 1]);
  for (const [x, z, f] of [[-24, -10, 1], [25, -12, -1], [18, -26, -1]]) F.crates(x, z, crate, metalD, f);
  { const [px, pz] = GARRISON_SPOTS.pad;   // the landing pad: a low deck with lamps round it
    K.box(px, pz, 5, 4.5, 0.22, metalD, { climbable: true });
    for (const sx of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(0.3, 0.04, 8.6), stripe, px + sx * 4.6, 0.23, pz));
    for (const sx of [-1, 1]) for (const dz of [-3.8, 0, 3.8]) picture(K.deco(new THREE.SphereGeometry(0.15, 8, 6), lamp, px + sx * 4.5, 0.32, pz + dz)); }
  for (const [x, z] of [[-2, -12], [17, -21], [-23, -16]]) spawnBarrel(V3(x, 0, z));
  // floodlight masts over the yard
  for (const [x, z] of [[-26, 0], [26, 0], [0, -24]]){
    K.column(x, z, 0.2, 7, metalD, { wallKick: false, seg: 6, taper: 1 });
    picture(K.deco(new THREE.BoxGeometry(1.2, 0.5, 0.5), lamp, x, 7.2, z));
  }
}
