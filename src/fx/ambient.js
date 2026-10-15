// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Drifting ambient embers / ash / dust.

import * as THREE from 'three';
import { rand } from '../utils.js';
import { shared, G } from '../state.js';
import { makeEmberSprite } from '../world/textures.js';
import { updateAtmosphere } from '../world/atmosphere.js';

/* L.ambient (from the world theme): { kind: 'embers' (rise) | 'ash' | 'snow' (fall) | 'dust' (drift), color, count, size } */
export function buildAmbient(L){
  const am = L.ambient || {};
  const fall = am.kind === 'snow' || am.kind === 'ash';
  const N = am.count || 170;   // denser drifting embers/dust → thicker, more immersive air
  const pos = new Float32Array(N*3);
  const vel = new Float32Array(N);
  for (let i = 0; i < N; i++){
    pos[i*3]   = rand(-shared.arenaHalf, shared.arenaHalf);
    pos[i*3+1] = rand(0.2, 11);
    pos[i*3+2] = rand(-shared.arenaHalf, shared.arenaHalf);
    vel[i] = (fall ? -1 : 1) * rand(0.2, 0.9) * (am.kind === 'dust' ? 0.3 : 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: am.color || L.ember || 0x99aabb, size: am.size || 0.34, map: makeEmberSprite(), transparent: true, opacity: am.opacity || 0.5,
    blending: fall ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }));
  shared.arenaGroup.add(pts);
  shared.ambient = { pts, vel, t: 0 };
}
export function updateAmbient(dt){
  updateAtmosphere(dt);
  if (shared.templeBrazier){   // the temple brazier breathes/flickers (bloom turns it into a glow)
    shared.templeBrazier.scale.set(0.9 + 0.12*Math.sin(G.gt*9.3), 1 + 0.14*Math.sin(G.gt*13) + 0.06*Math.sin(G.gt*27), 0.9 + 0.12*Math.cos(G.gt*11.1));
  }
  if (!shared.ambient) return;
  shared.ambient.t += dt;
  const a = shared.ambient.pts.geometry.attributes.position;
  for (let i = 0; i < a.count; i++){
    let y = a.getY(i) + shared.ambient.vel[i]*dt;
    if (y < 0.1) y = 9;   // falling snow / ash wraps back to the top
    if (y > 9){ y = 0.2; a.setX(i, rand(-shared.arenaHalf, shared.arenaHalf)); a.setZ(i, rand(-shared.arenaHalf, shared.arenaHalf)); }
    a.setY(i, y);
    a.setX(i, a.getX(i) + Math.sin(shared.ambient.t*0.8 + i)*dt*0.3);
  }
  a.needsUpdate = true;
}
