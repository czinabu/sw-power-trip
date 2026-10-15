// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Jedi Temple arena.

import * as THREE from 'three';
import { rand } from '../../utils.js';
import { shared, pillars, solids, hazardZones } from '../../state.js';

/* LEVEL 1 — "TEMPLE STEPS": an AUTHORED arena (vs the scattered procedural cover). A central walkable ZIGGURAT (a
   landmark + contested high ground — sized so ground melee can still tag you up top, so it's a sightline/positioning
   edge, not a melee-proof perch), a ring of grand COLUMNS (cover + wall-jump + grandeur), low broken WALLS that
   break blaster/flyer line-of-sight, and set dressing (brazier, banners, rubble, a gold floor inlay). */

export function buildTempleArena(L){
  const pal = L.pal || {};   // the world theme's colours (data/worlds.js); the defaults are the original look
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x7c715a, roughness: 0.93, metalness: 0.05 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x564b39, roughness: 0.95, metalness: 0.04 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xb89a5a, roughness: 0.5, metalness: 0.55 });
  const fireC  = pal.brazier ?? 0xff8a2a;
  const addBox = (x, z, hx, hz, h, mat, solid, climbable) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(hx*2, h, hz*2), mat || stone);
    m.position.set(x, h/2, z); m.castShadow = true; m.receiveShadow = true; shared.arenaGroup.add(m);
    if (solid) solids.push({ x, z, hx, hz, h, box: true, climbable: !!climbable });
    return m;
  };
  // ---- central TEMPLE ZIGGURAT — stepped, walkable (each step < STEP_UP), summit 1.4. Base r=2.8 is deliberately
  // tight: a foe blocked at the base is still within melee range of a player on the summit (and your saber reaches
  // them), so the dais is CONTESTED — a sightline/positioning edge, never a melee-proof perch ----
  const tiers = [ {r:3.2, h:0.4}, {r:2.6, h:0.8}, {r:2.0, h:1.2}, {r:1.5, h:1.5} ];
  for (const t of tiers){
    addBox(0, 0, t.r, t.r, t.h, stone, true, true);   // CLIMBABLE: foes walk up the steps & the avoidance ignores it
    const edge = new THREE.Mesh(new THREE.BoxGeometry(t.r*2+0.05, 0.06, t.r*2+0.05), trim);
    edge.position.y = t.h; shared.arenaGroup.add(edge);   // a crisp gold lip on each step
  }
  // a gold inlay ring set into the floor around the dais — a focal anchor
  const inlay = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.2, 40),
    new THREE.MeshBasicMaterial({ color: pal.inlay ?? 0x8a6e2e, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  inlay.rotation.x = -Math.PI/2; inlay.position.y = 0.03; shared.arenaGroup.add(inlay);
  // ---- SUMMIT BRAZIER — the level's glowing landmark (bloom does the glow; flickered in updateAmbient) ----
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.3, 0.34, 12), stoneD);
  bowl.position.set(0, 1.5 + 0.17, 0); bowl.castShadow = true; shared.arenaGroup.add(bowl);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.8, 10),
    new THREE.MeshBasicMaterial({ color: fireC }));
  fire.position.set(0, 1.5 + 0.66, 0); shared.arenaGroup.add(fire);
  shared.templeBrazier = fire;
  // the dais is deliberately contested (see note above) — a periodic ERUPTION punishes camping the summit
  hazardZones.push({ kind:'point', cx:0, cz:0, r:2.3, period:8, warnDur:1.4, activeDur:1.0,
    dmg:24, color:fireC, flash:true, t:0 });
  // ---- GRAND COLUMNS — a temple ring: cover, wall-jump surfaces, and vertical grandeur ----
  const colN = 8, colR = Math.min(shared.arenaHalf * 0.62, 13.5);
  for (let i = 0; i < colN; i++){
    const a = (i / colN) * Math.PI*2 + Math.PI/colN;
    const x = Math.cos(a)*colR, z = Math.sin(a)*colR, h = rand(8, 9.5), rad = 0.85;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad*0.84, rad, h, 10), stone);
    shaft.position.set(x, h/2, z); shaft.castShadow = true; shaft.receiveShadow = true; shared.arenaGroup.add(shaft);
    addBox(x, 0.2, rad*1.2, rad*1.2, 0.4, stoneD, false);           // plinth
    const cap = new THREE.Mesh(new THREE.BoxGeometry(rad*2.7, 0.45, rad*2.7), stoneD);
    cap.position.set(x, h - 0.22, z); cap.castShadow = true; shared.arenaGroup.add(cap);   // capital
    solids.push({ x, z, r: rad, h }); pillars.push({ x, z, r: rad, h });
    // a hanging banner on every other column — deep crimson with a gold hem
    if (i % 2 === 0){
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.2),
        new THREE.MeshStandardMaterial({ color: pal.banner ?? 0x6e1f24, roughness: 0.9, side: THREE.DoubleSide }));
      ban.position.set(x - Math.cos(a)*(rad+0.02), h - 2.4, z - Math.sin(a)*(rad+0.02));
      ban.rotation.y = a + Math.PI/2; shared.arenaGroup.add(ban);
      const hem = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.28),
        new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xb89a5a, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }));
      hem.position.set(ban.position.x, h - 4.0, ban.position.z); hem.rotation.y = ban.rotation.y; shared.arenaGroup.add(hem);
    }
  }
  // ---- OVERWATCH GANTRY — the same hero-skewed verticality as the Foundry's (Pass 50/57), re-sited here. Same
  // tier-height/offset deltas (already physics-validated against single/double-jump apex — see the Foundry gantry's
  // comment for the full reasoning, unchanged). Placed at r≈15.6-16.5 from centre — beyond the column ring (colR=
  // 13.02) by 2.6+ on every tier, and the random low walls below never reach past r=arenaHalf*0.5=10.5 — so neither
  // the fixed columns nor the randomized walls can ever clip it, regardless of roll. ----
  {
    const gx = 10, gz = -12;
    const t1 = { x: gx,        z: gz,        h: 2.6, hx: 1.3, hz: 1.3 };
    const t2 = { x: gx + 1.8,  z: gz + 1.4,  h: 5.1, hx: 1.2, hz: 1.2 };
    const t3 = { x: gx + 3.6,  z: gz + 2.6,  h: 7.7, hx: 1.9, hz: 1.9 };   // the lookout deck
    addBox(t1.x, t1.z, t1.hx, t1.hz, t1.h, stoneD, true);
    addBox(t2.x, t2.z, t2.hx, t2.hz, t2.h, stone, true);
    addBox(t3.x, t3.z, t3.hx, t3.hz, t3.h, stoneD, true);
    for (const [a, b] of [[t1, t2], [t2, t3]]){
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.h - a.h, len = Math.hypot(dx, dy, dz);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 6), trim);
      strut.position.set((a.x+b.x)/2, (a.h+b.h)/2, (a.z+b.z)/2);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(dx,dy,dz).normalize());
      shared.arenaGroup.add(strut);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.1), trim);
    rail.position.set(t3.x, t3.h + 0.7, t3.z + 1.7); shared.arenaGroup.add(rail);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: fireC }));
    beacon.position.set(t3.x, t3.h + 1.3, t3.z); shared.arenaGroup.add(beacon);
  }
  // ---- LOW BROKEN WALLS — ruined temple stonework that breaks blaster/flyer sightlines into the mid-field.
  // Axis-aligned so the box collision matches the mesh; oriented roughly tangential to cut radial lines. ----
  const wallN = 6;
  for (let i = 0; i < wallN; i++){
    const a = (i / wallN) * Math.PI*2 + 0.45;
    const r = rand(shared.arenaHalf*0.34, shared.arenaHalf*0.5);
    const x = Math.cos(a)*r, z = Math.sin(a)*r;
    const len = rand(3.0, 4.4), th = 0.55, h = rand(1.25, 1.7);
    const alongZ = Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a));   // pick the axis that best blocks the radial line
    const hx = alongZ ? th/2 : len/2, hz = alongZ ? len/2 : th/2;
    addBox(x, z, hx, hz, h, stoneD, true);
    // a broken cap-stone sitting askew on top — reads as ruined, not a clean wall
    const cap = new THREE.Mesh(new THREE.BoxGeometry((alongZ?th:len)*0.5, 0.3, (alongZ?len:th)*0.5), stone);
    cap.position.set(x + rand(-0.3,0.3), h + 0.1, z + rand(-0.3,0.3)); cap.rotation.y = rand(-0.4,0.4);
    cap.castShadow = true; shared.arenaGroup.add(cap);
  }
  // ---- RUBBLE — toppled column stubs scattered for ruin/atmosphere (no collision; small & low) ----
  for (let i = 0; i < 7; i++){
    const a = Math.random()*Math.PI*2, r = rand(shared.arenaHalf*0.25, shared.arenaHalf*0.85);
    const x = Math.cos(a)*r, z = Math.sin(a)*r;
    if (Math.hypot(x, z) < 5) continue;   // keep the dais clear
    const len = rand(1.0, 2.2);
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(rand(0.3,0.5), rand(0.35,0.55), len, 8), stoneD);
    stub.position.set(x, len*0.28, z); stub.rotation.set(Math.PI/2 + rand(-0.3,0.3), rand(0,6.28), rand(-0.3,0.3));
    stub.castShadow = true; stub.receiveShadow = true; shared.arenaGroup.add(stub);
  }
}
