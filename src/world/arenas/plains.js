// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Plains arena.

import * as THREE from 'three';
import { V3, rand } from '../../utils.js';
import { shared, pillars, solids, hazardZones } from '../../state.js';
import { spawnVent, spawnBarrel } from '../hazards.js';

/* LEVEL 3 — "THE SCARRED PLAIN": an open war-torn battlefield. Scattered RUINS for cover, a looming dark MONUMENT at
   the back ("something darker stands behind it"), two climbable ruin platforms, and scattered munitions. The CENTRE
   is kept open for the boss fight. */
export function buildPlainsArena(L){
  const stone  = new THREE.MeshStandardMaterial({ color: 0x4a3b3f, roughness: 0.92, metalness: 0.06 });
  const stoneD = new THREE.MeshStandardMaterial({ color: 0x2e2227, roughness: 0.95, metalness: 0.04 });
  const dark   = new THREE.MeshStandardMaterial({ color: 0x1a1016, roughness: 0.9, metalness: 0.12 });
  const voidGlow = new THREE.MeshBasicMaterial({ color: 0x9a3bff, fog: false });   // ominous violet void-rifts (bloom)
  const addBox = (x, z, hx, hz, h, mat, solid, climbable) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(hx*2, h, hz*2), mat || stone);
    m.position.set(x, h/2, z); m.castShadow = true; m.receiveShadow = true; shared.arenaGroup.add(m);
    if (solid) solids.push({ x, z, hx, hz, h, box: true, climbable: !!climbable });
    return m;
  };
  function farSpot(minR, maxR, gap, tries){
    for (let t = 0; t < (tries||22); t++){
      const a = Math.random()*Math.PI*2, r = rand(minR, maxR), x = Math.cos(a)*r, z = Math.sin(a)*r;
      let ok = true;
      for (const s of solids){ const sr = s.box ? Math.hypot(s.hx, s.hz) : s.r; if (Math.hypot(x-s.x, z-s.z) < gap + sr){ ok = false; break; } }
      if (ok) return { x, z };
    }
    return null;
  }
  // ---- the DARK MONUMENT — a looming broken spire at the FAR BACK (the Herald's altar): a tall landmark with violet
  // void-rifts, flanked by two shattered pillars. Placed BEHIND the boss's spawn (z≈-30) so the Herald advances out
  // from in front of it ("something darker stands behind it") and never clips through it. ----
  const mz = -shared.arenaHalf * 0.92;
  addBox(0, mz, 2.4, 2.0, 3.0, dark, true);                          // altar base
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 11, 6), dark);
  spire.position.set(0, 6.5, mz); spire.rotation.z = 0.05; spire.castShadow = true; shared.arenaGroup.add(spire);
  solids.push({ x:0, z:mz, r:1.6, h:11 });
  for (let i = 0; i < 5; i++){                                       // glowing void-rifts up the spire
    const rift = new THREE.Mesh(new THREE.BoxGeometry(0.18, rand(1.5,2.8), 0.18), voidGlow);
    rift.position.set(rand(-0.6,0.6), rand(3,9.5), mz + rand(-0.3,0.3)); rift.rotation.z = rand(-0.3,0.3); shared.arenaGroup.add(rift);
  }
  // the altar PULSES — approach the monument and you're punished for it ("something darker stands behind it")
  hazardZones.push({ kind:'point', cx:0, cz:mz, r:3.0, period:7, warnDur:1.3, activeDur:1.1,
    dmg:20, color:0x9a3bff, flash:true, t:2.4 });
  for (const sx of [-1, 1]){                                         // flanking shattered pillars
    const px = sx * 4.6, h = rand(5, 7.5);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, h, 7), stoneD);
    p.position.set(px, h/2, mz - 1.0); p.rotation.z = sx * 0.08; p.castShadow = true; shared.arenaGroup.add(p);
    solids.push({ x: px, z: mz - 1.0, r: 0.8, h });
  }
  // ---- OVERWATCH GANTRY — the same hero-skewed verticality as the Foundry's (Pass 50/57), re-sited here. Same
  // tier-height/offset deltas (already physics-validated). Placed at (18,8), r≈19.7-24.1 from centre — clear of the
  // monument (z≈-33), both flanking pillars, and both fixed ruin-platform spots (~(-9,15.5) / ~(9.7,-15.2)) by a
  // wide margin. Inserted BEFORE the farSpot-driven ruins/stubs/barrels/vents loops below — same ordering trick the
  // Foundry build uses — so farSpot's own gap-check naturally keeps that procedural cover off of it. ----
  {
    const gx = 18, gz = 8;
    const t1 = { x: gx,        z: gz,        h: 2.6, hx: 1.3, hz: 1.3 };
    const t2 = { x: gx + 1.8,  z: gz + 1.4,  h: 5.1, hx: 1.2, hz: 1.2 };
    const t3 = { x: gx + 3.6,  z: gz + 2.6,  h: 7.7, hx: 1.9, hz: 1.9 };   // the lookout deck
    addBox(t1.x, t1.z, t1.hx, t1.hz, t1.h, stoneD, true);
    addBox(t2.x, t2.z, t2.hx, t2.hz, t2.h, stone, true);
    addBox(t3.x, t3.z, t3.hx, t3.hz, t3.h, stoneD, true);
    for (const [a, b] of [[t1, t2], [t2, t3]]){
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.h - a.h, len = Math.hypot(dx, dy, dz);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 6), dark);
      strut.position.set((a.x+b.x)/2, (a.h+b.h)/2, (a.z+b.z)/2);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(dx,dy,dz).normalize());
      shared.arenaGroup.add(strut);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.1), dark);
    rail.position.set(t3.x, t3.h + 0.7, t3.z + 1.7); shared.arenaGroup.add(rail);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9a3bff }));
    beacon.position.set(t3.x, t3.h + 1.3, t3.z); shared.arenaGroup.add(beacon);
  }
  // ---- SCATTERED RUINS — broken walls (sightline cover for the ranged/flyer fights). Axis-aligned (collision
  // matches), kept OUT of the open centre so the boss has room to maneuver. ----
  for (let i = 0; i < 11; i++){
    const spot = farSpot(shared.arenaHalf*0.28, shared.arenaHalf*0.82, 5.5); if (!spot) continue;
    const horiz = Math.random() < 0.5;
    const len = rand(3.0, 5.0), th = 0.6, h = rand(1.2, 2.0);
    const hx = horiz ? len/2 : th/2, hz = horiz ? th/2 : len/2;
    addBox(spot.x, spot.z, hx, hz, h, Math.random()<0.5?stone:stoneD, true);
    const cap = new THREE.Mesh(new THREE.BoxGeometry((horiz?len:th)*0.5, 0.3, (horiz?th:len)*0.5), stoneD);
    cap.position.set(spot.x+rand(-0.3,0.3), h+0.1, spot.z+rand(-0.3,0.3)); cap.rotation.y = rand(-0.4,0.4); cap.castShadow = true; shared.arenaGroup.add(cap);
  }
  // ---- toppled COLUMN stubs — extra cover / wall-jump surfaces ----
  for (let i = 0; i < 6; i++){
    const spot = farSpot(shared.arenaHalf*0.3, shared.arenaHalf*0.85, 4.5); if (!spot) continue;
    const h = rand(1.6, 3.2), rad = rand(0.6, 0.9);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad*1.1, h, 7), stone);
    c.position.set(spot.x, h/2, spot.z); c.rotation.z = rand(-0.12, 0.12); c.castShadow = true; shared.arenaGroup.add(c);
    solids.push({ x: spot.x, z: spot.z, r: rad, h }); pillars.push({ x: spot.x, z: spot.z, r: rad, h });
  }
  // ---- two CLIMBABLE ruin platforms — broken stepped stone for verticality/positioning (mid-field flanks) ----
  for (const ang of [2.1, -1.0]){
    const px = Math.cos(ang)*shared.arenaHalf*0.5, pz = Math.sin(ang)*shared.arenaHalf*0.5;
    addBox(px, pz, 2.4, 2.4, 0.5, stoneD, true, true);
    addBox(px, pz, 1.6, 1.6, 1.0, stone, true, true);
  }
  // ---- munitions + burning fissures — barrels (chain blasts) + a few vents, all out of the open centre ----
  for (let i = 0; i < 9; i++){ const s = farSpot(shared.arenaHalf*0.28, shared.arenaHalf*0.82, 3.0); if (s) spawnBarrel(V3(s.x, 0, s.z)); }
  for (let i = 0; i < 3; i++){ const s = farSpot(shared.arenaHalf*0.35, shared.arenaHalf*0.7, 4.0); if (s) spawnVent(V3(s.x, 0, s.z)); }
}
