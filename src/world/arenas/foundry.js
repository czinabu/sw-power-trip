// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Level 2 arena: the forge floor (Mustafar Forge).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared, hazardZones } from '../../state.js';
import { spawnVent, spawnBarrel } from '../hazards.js';
import { arenaKit, seeded, at } from './kit.js';

const D = Math.PI / 4;   // the diagonals

/* LEVEL 2 — the FORGE FLOOR (half-size 26). "The forge itself is a weapon": the plan is split into SAFE LANES and
   DANGER LANES so hazards are something you aim foes into, not something you trip over.
     · the central SMELTER: a tall hard-cover landmark everything flows around;
     · four MOLTEN CHANNELS run out from the smelter along the diagonals (r 3.6 → 12) and each one ends in a LAVA-GEYSER
       VENT (r 15.5): the diagonals are the danger lanes. Push, kick or blast a crowd along a diagonal;
     · the four cardinal lanes are safe ground: the player spawns in the north lane, and the two stepped catwalk
       PLATFORMS sit in the east and west lanes, clear of every hazard;
     · eight MACHINE BLOCKS (r 13.5) flank the channel mouths, alternating tall (2.8, hard cover and wall-kick) and low
       (1.4, vaultable), so foes funnel past the lava toward you;
     · six FUEL DRUMS sit on the inside of the blocks where blaster troopers take cover. Shoot the drum, not the man;
     · six support GIRDERS (r 17.5) for wall-kicks and the cavernous read, and the OVERWATCH crane in the south lane.
     · a BASTION in each corner (kit.js, level-design pass): steps up to a raised fall-back spot behind a wall, so the
       corners past the round edge ring are a vantage, not dead floor 20 m from cover.
   Nothing sits in the spawn ring's lanes except girders and the gantry, which spawns route around. */
export function buildFoundryArena(L){
  const pal = L.pal || {};   // the world theme's colours (data/worlds.js); the defaults are the original look
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x3c424b, roughness: 0.55, metalness: 0.75 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x24282e, roughness: 0.6, metalness: 0.7 });
  const rust   = new THREE.MeshStandardMaterial({ color: pal.rust ?? 0x6b4a32, roughness: 0.85, metalness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xc9a23a, roughness: 0.6, metalness: 0.5 });
  const moltenC = pal.molten ?? 0xff7a1e;
  const molten = new THREE.MeshBasicMaterial({ color: moltenC, fog: false });   // bloom turns it into a glow
  const K = arenaKit(), R = seeded(23);
  // the plan is authored at 52 m across; a bigger arena spreads every piece out by the same share (sizes stay)
  const S = L.arena / 52;

  // ---- central SMELTER — base housing + stack (collides as one cylinder), a molten band and gold rings ----
  K.box(0, 0, 2.8, 2.8, 1.2, metalD);
  K.column(0, 0, 2.0, 6, metal, { wallKick: false });
  K.deco(new THREE.CylinderGeometry(1.32, 1.32, 1.5, 12), molten, 0, 1.95, 0);
  for (const sy of [4.2, 5.0]) K.deco(new THREE.TorusGeometry(2.05, 0.12, 8, 16), stripe, 0, sy, 0, Math.PI/2);

  // ---- MOLTEN CHANNELS — the diagonals, from the smelter's edge out to r 12. They SURGE on a staggered cycle
  // (1.0s amber warning, 1.1s burn) so the four never flare together ----
  for (let i = 0; i < 4; i++){
    const a = D + i * Math.PI/2, r0 = 3.6, r1 = 12 * S, len = r1 - r0, [cx, cz] = at(a, (r0 + r1) / 2);
    K.deco(new THREE.PlaneGeometry(0.6, len), molten, cx, 0.05, cz, -Math.PI/2, 0, -a + Math.PI/2).castShadow = false;
    for (const s of [-1, 1]){   // a dark iron lip along both banks so the channel reads as a trench
      const [ox, oz] = [Math.cos(a + Math.PI/2) * 0.45 * s, Math.sin(a + Math.PI/2) * 0.45 * s];
      K.deco(new THREE.BoxGeometry(0.16, 0.12, len), metalD, cx + ox, 0.06, cz + oz, 0, -a + Math.PI/2, 0);
    }
    hazardZones.push({ kind:'line', cx, cz, dirX: Math.cos(a), dirZ: Math.sin(a), halfLen: len/2, halfW: 0.55,
      period: 5.5, warnDur: 1.0, activeDur: 1.1, dmg: 15, color: moltenC, t: i * 1.4 });
    // the channel ends in a LAVA-GEYSER vent
    const [vx, vz] = at(a, 15.5 * S);
    spawnVent(V3(vx, 0, vz));
  }

  // ---- two stepped catwalk PLATFORMS in the east and west lanes (climbable: 0.5 then 1.0) ----
  for (const sx of [-1, 1]){
    const px = sx * 10.5 * S;
    K.box(px, 0, 2.4, 2.4, 0.5, metal, { climbable: true });
    K.box(px, 0, 1.6, 1.6, 1.0, metalD, { climbable: true });
    K.deco(new THREE.BoxGeometry(3.3, 0.08, 3.3), stripe, px, 1.0, 0);
  }

  // ---- MACHINE BLOCKS — eight, flanking the four channel mouths; tall and low alternate ----
  const blocks = [];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]){
    const a = D + i * Math.PI/2 + s * 0.35, [x, z] = at(a, 13.5 * S);
    const tall = s > 0, hx = 1.4 + R()*0.3, hz = 1.1 + R()*0.2, h = tall ? 2.8 : 1.4;
    K.box(x, z, hx, hz, h, (i + (s > 0 ? 1 : 0)) % 3 === 0 ? rust : metal);
    K.deco(new THREE.BoxGeometry(0.2, 0.1, hz*1.8), stripe, x, h*0.5, z);   // a hazard-stripe pipe across it
    blocks.push(a);
  }

  // ---- FUEL DRUMS — on the inner side of six blocks (the two by the north spawn lane are left out) ----
  for (const a of blocks){
    if (Math.sin(a) > 0.85) continue;   // the blocks either side of the north lane
    const [x, z] = at(a, 11 * S);
    spawnBarrel(V3(x, 0, z));
  }

  // ---- SUPPORT GIRDERS — six at r 17.5 (wall-kick, cavernous read), on the cardinal lines and between ----
  for (let i = 0; i < 6; i++){
    const a = (i / 6) * Math.PI*2, [x, z] = at(a, 17.5 * S), h = 9 + R()*3;
    K.column(x, z, 0.7, h, metalD, { seg: 6, taper: 1 });
    K.deco(new THREE.CylinderGeometry(0.91, 0.91, 0.5, 6), stripe, x, 1.0, z);
  }

  // ---- OVERWATCH CRANE — the gantry in the south lane, climbing toward the smelter ----
  K.gantry(-1.8, -17 * S, { a: metalD, b: metal, strut: stripe, beacon: pal.beacon ?? 0xff5040 });

  // ---- a BASTION in each corner: plate steps behind a blast wall ----
  { const c = shared.arenaHalf - 7;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) K.bastion(sx*c, sz*c, sx, sz, { a: metalD, b: rust }); }
}
