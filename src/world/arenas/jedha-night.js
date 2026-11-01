// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: the temple courtyard on Jedha, burned and empty at night, with the old Sith gate under the dais waking
// (the Jedi's chapter RETURN TO JEDHA, mission `jedha-night`). The courtyard is the siege's (world/arenas/temple.js),
// in the night theme (data/worlds.js MISSION_WORLDS.jedhaNight); this lays the gate's signs over it.

import * as THREE from 'three';
import { arenaKit, seeded } from './kit.js';
import { buildTempleArena } from './temple.js';

/* THE GATE: violet cracks running out from the dais across the flagstones, a ring of light round its foot, a pale
   column standing up out of the summit into the sky (the way through), and four broken seal-stones at the dais's
   corners. All pictures (flat on the floor or a beam of light): the courtyard's own solids are the temple's. */
export function buildJedhaNightArena(L){
  buildTempleArena(L);
  const pal = L.pal || {};
  const K = arenaKit(), R = seeded(29);
  const glowC = pal.gate ?? 0x9a6aff;
  const crack = new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false });
  const flat = (m) => { m.userData.passThrough = true; m.userData.noBake = true; m.castShadow = false; m.receiveShadow = false; return m; };
  // the cracks: jagged runs out from the dais, a few branches each
  for (let i = 0; i < 9; i++){
    let a = i / 9 * Math.PI * 2 + R() * 0.4, r = 3.4, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const n = 4 + Math.floor(R() * 4);
    for (let k = 0; k < n; k++){
      a += (R() - 0.5) * 0.6;
      const len = 1.2 + R() * 1.6, nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len;
      K.strip(x, z, nx, nz, 0.12 + R() * 0.1, glowC, 0.8 - k * 0.08);
      x = nx; z = nz;
    }
  }
  flat(K.deco(new THREE.RingGeometry(3.4, 3.75, 48), crack, 0, 0.04, 0, -Math.PI / 2));
  // the way through: a column of pale light up out of the summit
  const beam = flat(K.deco(new THREE.CylinderGeometry(0.55, 1.1, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 0, 31.5, 0));
  beam.renderOrder = 2;
  // broken seal-stones at the dais's corners, the Inquisitors' marks on them still lit red
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){
    const x = sx * 4.6, z = sz * 4.6;
    K.deco(new THREE.BoxGeometry(0.7, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x2e2a36, roughness: 0.95 }), x, 0.25, z, 0, R() * 3, 0.3);
    flat(K.deco(new THREE.BoxGeometry(0.3, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: pal.seal ?? 0xff3a2a }), x, 0.52, z));
  }
}
