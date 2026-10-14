// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Foundry arena.

import * as THREE from 'three';
import { V3, rand } from '../../utils.js';
import { shared, pillars, solids, hazardZones } from '../../state.js';
import { spawnVent, spawnBarrel } from '../hazards.js';

/* LEVEL 2 — "FOUNDRY ASSAULT": an industrial foundry. A tall glowing central SMELTER (landmark + hard cover to flow
   around), two CLIMBABLE machinery platforms (verticality + sightlines), machine-block cover that carves the floor
   into LANES, support GIRDERS (wall-jump), molten floor channels, and INTENTIONAL hazards (fire vents + explosive
   barrels) woven through the lanes. "The machinery itself is a weapon." */
export function buildFoundryArena(L){
  const metal  = new THREE.MeshStandardMaterial({ color: 0x3c424b, roughness: 0.55, metalness: 0.75 });
  const metalD = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.6, metalness: 0.7 });
  const rust   = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.85, metalness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xc9a23a, roughness: 0.6, metalness: 0.5 });
  const molten = new THREE.MeshBasicMaterial({ color: 0xff7a1e, fog: false });   // bloom turns it into a glow
  const addBox = (x, z, hx, hz, h, mat, solid, climbable) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(hx*2, h, hz*2), mat || metal);
    m.position.set(x, h/2, z); m.castShadow = true; m.receiveShadow = true; shared.arenaGroup.add(m);
    if (solid) solids.push({ x, z, hx, hz, h, box: true, climbable: !!climbable });
    return m;
  };
  function farSpot(minR, maxR, gap, tries){
    for (let t = 0; t < (tries||20); t++){
      const a = Math.random()*Math.PI*2, r = rand(minR, maxR), x = Math.cos(a)*r, z = Math.sin(a)*r;
      let ok = true;
      for (const s of solids){ const sr = s.box ? Math.hypot(s.hx, s.hz) : s.r; if (Math.hypot(x-s.x, z-s.z) < gap + sr){ ok = false; break; } }
      if (ok) return { x, z };
    }
    return null;
  }
  // ---- central SMELTER — a tall glowing machine core: the landmark + a hard cover block to flow around ----
  addBox(0, 0, 2.8, 2.8, 1.2, metalD, true);                         // base housing
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 5.2, 12), metal);
  stack.position.set(0, 3.2, 0); stack.castShadow = true; shared.arenaGroup.add(stack);
  solids.push({ x:0, z:0, r:2.0, h:6 });                             // collide as a central cylinder
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 1.5, 12), molten);
  core.position.set(0, 1.95, 0); shared.arenaGroup.add(core);               // glowing molten band
  for (const sy of [4.2, 5.0]){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.12, 8, 16), stripe);
    ring.rotation.x = Math.PI/2; ring.position.set(0, sy, 0); shared.arenaGroup.add(ring);
  }
  // ---- two CLIMBABLE machinery platforms — stepped catwalk daises on the flanks (verticality + sightlines) ----
  for (const sx of [-1, 1]){
    const px = sx * 9.5, pz = 0;
    addBox(px, pz, 2.4, 2.4, 0.5, metal, true, true);
    addBox(px, pz, 1.6, 1.6, 1.0, metalD, true, true);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 3.3), stripe); lip.position.set(px, 1.0, pz); shared.arenaGroup.add(lip);
    const vein = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 3.0), molten); vein.position.set(px - sx*1.6, 0.5, pz); shared.arenaGroup.add(vein);
  }
  // ---- OVERWATCH GANTRY — a broken crane stack, genuinely hero-skewed verticality. MANDO just flies straight up
  // (sustained jet thrust trivially clears any height — zero tuning needed). JEDI has no flight, so the climb is
  // gated to chained DOUBLE-JUMPS: each tier sits >2.4u above the last — comfortably beyond a single jump's ~1.93u
  // apex (jumpVel 10.2 / gravity 27) so a plain hop can't mount it, but well inside the ~3.5-5.4u a timed double-jump
  // reaches (DJUMP_FORCE 14, affordable for 3 chained jumps out of a 100 Force bar with regen between landings).
  // GROUND MELEE PHYSICALLY CANNOT FOLLOW: collideSolids only treats a solid as "standing surface" when the foe's
  // current y is already within STEP_UP(0.5) of its top — grounded AI never gains the airtime to enter that window,
  // so the climb is a real Jedi/Mando edge, not decoration. Deck reward: line-of-sight over the whole floor, clear
  // of the molten channels and melee crowding below (ranged foes — snipers/flyers — can still reach you up there,
  // so it's a tactical option, not a cheese spot). ----
  {
    const gx = -3, gz = 14;
    const t1 = { x: gx,        z: gz,        h: 2.6, hx: 1.3, hz: 1.3 };
    const t2 = { x: gx + 1.8,  z: gz + 1.4,  h: 5.1, hx: 1.2, hz: 1.2 };
    const t3 = { x: gx + 3.6,  z: gz + 2.6,  h: 7.7, hx: 1.9, hz: 1.9 };   // the lookout deck
    addBox(t1.x, t1.z, t1.hx, t1.hz, t1.h, metalD, true);
    addBox(t2.x, t2.z, t2.hx, t2.hz, t2.h, metal, true);
    addBox(t3.x, t3.z, t3.hx, t3.hz, t3.h, metalD, true);
    // diagonal support struts between tiers — visual only (no collision), sell the "broken crane" read
    for (const [a, b] of [[t1, t2], [t2, t3]]){
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.h - a.h, len = Math.hypot(dx, dy, dz);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 6), stripe);
      strut.position.set((a.x+b.x)/2, (a.h+b.h)/2, (a.z+b.z)/2);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(dx,dy,dz).normalize());
      shared.arenaGroup.add(strut);
    }
    // guard rail + warning beacon on the deck — a landmark visible across the foundry floor
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xc9a23a, roughness: 0.5, metalness: 0.6 }));
    rail.position.set(t3.x, t3.h + 0.7, t3.z + 1.7); shared.arenaGroup.add(rail);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5040 }));
    beacon.position.set(t3.x, t3.h + 1.3, t3.z); shared.arenaGroup.add(beacon);
  }
  // ---- MACHINE-BLOCK COVER — boxes of varied height that carve the floor into LANES & chokepoints ----
  for (let i = 0; i < 9; i++){
    const spot = farSpot(shared.arenaHalf*0.28, shared.arenaHalf*0.72, 5.0); if (!spot) continue;
    const tall = Math.random() < 0.45;
    const w = rand(1.2, 2.2), d = rand(1.0, 1.8), h = tall ? rand(2.4, 3.4) : rand(1.2, 1.7);
    addBox(spot.x, spot.z, w, d, h, Math.random()<0.4?rust:metal, true);
    if (Math.random() < 0.5){ const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, d*1.8), stripe); pipe.position.set(spot.x, h*0.5, spot.z); shared.arenaGroup.add(pipe); }
  }
  // ---- SUPPORT GIRDERS — tall metal columns ringing the foundry (wall-jump + the cavernous interior) ----
  const gN = 6, gR = Math.min(shared.arenaHalf*0.82, 21);
  for (let i = 0; i < gN; i++){
    const a = (i/gN)*Math.PI*2 + 0.3, x = Math.cos(a)*gR, z = Math.sin(a)*gR, h = rand(9, 12), rad = 0.7;
    const gird = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 6), metalD); gird.position.set(x, h/2, z); gird.castShadow = true; shared.arenaGroup.add(gird);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rad*1.3, rad*1.3, 0.5, 6), stripe); band.position.set(x, 1.0, z); shared.arenaGroup.add(band);
    solids.push({ x, z, r: rad, h }); pillars.push({ x, z, r: rad, h });
  }
  // ---- MOLTEN FLOOR CHANNELS — glowing veins across the floor; periodically SURGE (telegraph → damage tick) so
  // they're a real hazard to dodge or shove a foe into, not just mood lighting. Staggered phase (t:i*1.7) so the
  // 5 channels don't all flare in sync. ----
  for (let i = 0; i < 5; i++){
    const a = (i/5)*Math.PI*2 + 0.4, len = rand(8, 14);
    const ch = new THREE.Mesh(new THREE.PlaneGeometry(0.6, len), molten);
    ch.rotation.x = -Math.PI/2; ch.rotation.z = a; ch.position.set(Math.cos(a)*len*0.4, 0.05, Math.sin(a)*len*0.4); shared.arenaGroup.add(ch);
    hazardZones.push({ kind:'line', cx: ch.position.x, cz: ch.position.z, dirX: Math.cos(a), dirZ: Math.sin(a),
      halfLen: len*0.4, halfW: 0.55, period: 5.5, warnDur: 1.0, activeDur: 1.1, dmg: 15, color: 0xff7a1e, t: i*1.7 });
  }
  // ---- HAZARDS woven into the lanes — fire VENTS + explosive BARRELS at open spots between the machinery ----
  for (let i = 0; i < 5; i++){ const s = farSpot(shared.arenaHalf*0.3, shared.arenaHalf*0.7, 4.0); if (s) spawnVent(V3(s.x, 0, s.z)); }
  for (let i = 0; i < 7; i++){ const s = farSpot(shared.arenaHalf*0.25, shared.arenaHalf*0.8, 3.0); if (s) spawnBarrel(V3(s.x, 0, s.z)); }
}
