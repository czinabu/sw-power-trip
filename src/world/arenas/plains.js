// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Level 3 arena: the Sith wastes before the altar (Throne of Exegol), the boss arena.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared, solids, hazardZones } from '../../state.js';
import { spawnVent, spawnBarrel } from '../hazards.js';
import { arenaKit, seeded, at } from './kit.js';

const RING = 22;   // radius of the cover pods

/* LEVEL 3 — the THRONE (half-size 36), built around the boss. Rings, from the inside out:
     · the DUELLING GROUND (r < 11) stays completely open, so the Herald / the Magistrate and their dash, blink, pulse
       rings and barrage always have room, and so do you;
     · four SITH VENTS on the cardinals at r 12 mark its edge (violet when they fire): fight the boss across them,
       or knock the army into them;
     · seven COVER PODS at r 22 (a broken wall plus a low step block) break the long sightlines the snipers and
       blaster troops would otherwise own; the eighth slot is the OVERWATCH gantry (east-south-east). The eight
       radial lanes between them stay open, the north one is the spawn lane;
     · two climbable RUIN PLATFORMS in the north-west and south-east diagonal lanes;
     · the ALTAR at the far south: the boss rises in front of it, and its pulse punishes anyone who chases him back;
       two FUEL DRUMS on its approach catch him as he advances;
     · broken COLUMNS at r 26 in the lanes (wall-kicks), and low rubble you step over. */
export function buildPlainsArena(L){
  const pal = L.pal || {};   // the world theme's colours (data/worlds.js); the defaults are the original look
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x4a3b3f, roughness: 0.92, metalness: 0.06 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x2e2227, roughness: 0.95, metalness: 0.04 });
  const dark   = new THREE.MeshStandardMaterial({ color: pal.dark ?? 0x1a1016, roughness: 0.9, metalness: 0.12 });
  const voidC  = pal.voidGlow ?? 0x9a3bff;
  const voidGlow = new THREE.MeshBasicMaterial({ color: voidC, fog: false });   // ominous violet void-rifts (bloom)
  const K = arenaKit(), R = seeded(37);

  // ---- the ALTAR — a broken spire at the far south with violet rifts, flanked by two shattered pillars. The boss
  // spawns at z = -(half-6), in front of it, and advances out ----
  const mz = -shared.arenaHalf * 0.92;
  K.box(0, mz, 2.4, 2.0, 3.0, dark);
  K.deco(new THREE.CylinderGeometry(0.5, 1.6, 11, 6), dark, 0, 6.5, mz, 0, 0, 0.05);
  solids.push({ x: 0, z: mz, r: 1.6, h: 12 });   // the spire collides as a column (not a wall-kick pillar)
  solids.push({ x: 0, z: mz, r: 2.0, h: 4.2 }, { x: 0, z: mz, r: 1.5, h: 7.5 });   // (its lean puts the foot a little wider)
  for (let i = 0; i < 5; i++) K.deco(new THREE.BoxGeometry(0.18, 1.5 + R()*1.3, 0.18), voidGlow, -0.6 + R()*1.2, 3 + R()*6.5, mz - 0.3 + R()*0.6, 0, 0, -0.3 + R()*0.6);
  hazardZones.push({ kind:'point', cx:0, cz:mz, r:3.0, period:7, warnDur:1.3, activeDur:1.1, dmg:20, color:voidC, flash:true, t:2.4 });
  for (const sx of [-1, 1]) K.column(sx*4.6, mz - 1.0, 0.8, 5 + R()*2.5, stoneD, { taper: 0.7, seg: 7 });

  // ---- SITH VENTS — the cardinals at r 12, the edge of the duelling ground ----
  for (let i = 0; i < 4; i++){ const [x, z] = at(i * Math.PI/2, 12); spawnVent(V3(x, 0, z)); }

  // ---- COVER PODS — a broken wall across the radial line plus a low step block on its inner side (step 1.1, then
  // the wall: a two-move parkour climb). Slot 7 (ESE) is the gantry ----
  for (let k = 0; k < 8; k++){
    const a = Math.PI/8 + k * Math.PI/4;
    if (k === 7) continue;
    const [x, z] = at(a, RING), alongZ = Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a));
    const len = 4.6, th = 0.6, h = k % 2 ? 2.4 : 1.7;
    K.box(x, z, alongZ ? th/2 : len/2, alongZ ? len/2 : th/2, h, k % 3 ? stone : stoneD);
    K.deco(new THREE.BoxGeometry(alongZ ? th*1.1 : len*0.45, 0.3, alongZ ? len*0.45 : th*1.1), stoneD,
      x + (R()-0.5)*0.4, h + 0.12, z + (R()-0.5)*0.4, 0, (R()-0.5)*0.5, 0);   // broken cap stone
    // the step block sits inward of the wall, off-centre toward the clockwise end
    const [ix, iz] = at(a, RING - 1.4);
    K.box(ix - Math.sin(a)*1.2, iz + Math.cos(a)*1.2, 0.7, 0.7, 1.1, stone);
    // fuel drums behind the pods away from the north spawn lane
    if (Math.sin(a) < 0.8){ const [bx, bz] = at(a, RING - 3.4); spawnBarrel(V3(bx, 0, bz)); }
  }
  // two drums on the altar approach, where the boss walks out
  for (const sx of [-1, 1]) spawnBarrel(V3(sx * 7, 0, mz + 8));

  // ---- OVERWATCH gantry — the eighth pod slot (east-south-east), climbing inward ----
  { const [gx, gz] = at(-Math.PI/8, RING - 1); K.gantry(gx, gz, { a: stoneD, b: stone, strut: dark, beacon: pal.beacon ?? voidC }, [-1, 1]); }

  // ---- two climbable RUIN PLATFORMS in the NW and SE diagonal lanes (0.5 then 1.0) ----
  for (const a of [3*Math.PI/4, -Math.PI/4]){
    const [x, z] = at(a, 17);
    K.box(x, z, 2.4, 2.4, 0.5, stoneD, { climbable: true });
    K.box(x, z, 1.6, 1.6, 1.0, stone, { climbable: true });
  }

  // ---- broken COLUMNS at r 26 in the lanes (wall-kicks); the north lane and the altar lane stay open ----
  for (let k = 0; k < 8; k++){
    const a = k * Math.PI/4;
    if (k === 2 || k === 6) continue;
    const [x, z] = at(a, 26), h = 3.2 + R()*2.6;
    K.column(x, z, 0.8, h, stone, { taper: 0.8, seg: 7 });
  }

  // ---- RUBBLE you step over ----
  for (const [x, z, len, ax] of [[6, 16, 1.6, true], [-17, -4, 1.8, false], [15, 15, 1.4, true], [-3, -13, 1.7, true], [-24, 14, 1.5, false], [9, -25, 1.6, false]]){
    K.rubble(x, z, len, 0.3, stoneD, ax);
  }
}
