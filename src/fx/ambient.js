// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Drifting ambient embers / ash / dust.

import * as THREE from 'three';
import { rand } from '../utils.js';
import { shared, G, player } from '../state.js';
import { makeEmberSprite } from '../world/textures.js';
import { updateAtmosphere } from '../world/atmosphere.js';
import { updateAir } from '../world/air.js';

/* L.ambient (from the world theme): { kind: 'embers' (rise) | 'ash' | 'snow' (fall) | 'dust' (drift), color, count, size } */
export function buildAmbient(L){
  const am = L.ambient || {};
  const fall = am.kind === 'snow' || am.kind === 'ash';
  const N = am.count || 170;   // denser drifting embers/dust → thicker, more immersive air
  const pos = new Float32Array(N*3);
  const vel = new Float32Array(N);
  const b = box();
  for (let i = 0; i < N; i++){
    pos[i*3]   = rand(b.x - b.hx, b.x + b.hx);
    pos[i*3+1] = rand(0.2, 11);
    pos[i*3+2] = rand(b.z - b.hz, b.z + b.hz);
    vel[i] = (fall ? -1 : 1) * rand(0.2, 0.9) * (am.kind === 'dust' ? 0.3 : 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: am.color || L.ember || 0x99aabb, size: am.size || 0.34, map: makeEmberSprite(), transparent: true, opacity: am.opacity || 0.5,
    blending: fall ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;   // the points move (on a battle map they travel with the hero): never cull on a stale bound
  shared.arenaGroup.add(pts);
  shared.ambient = { pts, vel, t: 0 };
}
/* where the drift lives: the whole arena, or on a battle map (shared.arenaBig) a box round the hero that travels with
   them, so the air stays as thick as in a small arena without spreading the particles over 150 m */
const NEAR = 36;
function box(){
  if (!shared.arenaBig) return { x: 0, z: 0, hx: shared.arenaHalf, hz: shared.arenaHalfZ };
  const p = player.group.position;
  return { x: p.x, z: p.z, hx: NEAR, hz: NEAR };
}
export function updateAmbient(dt){
  updateAtmosphere(dt);
  updateAir(dt);
  if (shared.templeBrazier){   // the temple brazier breathes/flickers (bloom turns it into a glow)
    shared.templeBrazier.scale.set(0.9 + 0.12*Math.sin(G.gt*9.3), 1 + 0.14*Math.sin(G.gt*13) + 0.06*Math.sin(G.gt*27), 0.9 + 0.12*Math.cos(G.gt*11.1));
  }
  if (!shared.ambient) return;
  shared.ambient.t += dt;
  const a = shared.ambient.pts.geometry.attributes.position, b = box(), big = shared.arenaBig;
  for (let i = 0; i < a.count; i++){
    let y = a.getY(i) + shared.ambient.vel[i]*dt;
    if (y < 0.1) y = 9;   // falling snow / ash wraps back to the top
    if (y > 9){ y = 0.2; a.setX(i, rand(b.x - b.hx, b.x + b.hx)); a.setZ(i, rand(b.z - b.hz, b.z + b.hz)); }
    a.setY(i, y);
    let x = a.getX(i) + Math.sin(shared.ambient.t*0.8 + i)*dt*0.3;
    if (big){   // wrap round the hero's box as they move
      if (x < b.x - b.hx) x += b.hx*2; else if (x > b.x + b.hx) x -= b.hx*2;
      const z = a.getZ(i);
      if (z < b.z - b.hz) a.setZ(i, z + b.hz*2); else if (z > b.z + b.hz) a.setZ(i, z - b.hz*2);
    }
    a.setX(i, x);
  }
  a.needsUpdate = true;
}
