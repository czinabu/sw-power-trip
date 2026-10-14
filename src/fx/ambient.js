// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Drifting ambient embers / ash / dust.

import * as THREE from 'three';
import { rand } from '../utils.js';
import { shared, G } from '../state.js';
import { makeEmberSprite } from '../world/textures.js';

export function buildAmbient(L){
  const N = 170;   // denser drifting embers/dust → thicker, more immersive air
  const pos = new Float32Array(N*3);
  const vel = new Float32Array(N);
  for (let i = 0; i < N; i++){
    pos[i*3]   = rand(-shared.arenaHalf, shared.arenaHalf);
    pos[i*3+1] = rand(0.2, 11);
    pos[i*3+2] = rand(-shared.arenaHalf, shared.arenaHalf);
    vel[i] = rand(0.2, 0.9);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: L.ember || 0x99aabb, size: 0.34, map: makeEmberSprite(), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  shared.arenaGroup.add(pts);
  shared.ambient = { pts, vel, t: 0 };
}
export function updateAmbient(dt){
  if (shared.templeBrazier){   // the temple brazier breathes/flickers (bloom turns it into a glow)
    shared.templeBrazier.scale.set(0.9 + 0.12*Math.sin(G.gt*9.3), 1 + 0.14*Math.sin(G.gt*13) + 0.06*Math.sin(G.gt*27), 0.9 + 0.12*Math.cos(G.gt*11.1));
  }
  if (!shared.ambient) return;
  shared.ambient.t += dt;
  const a = shared.ambient.pts.geometry.attributes.position;
  for (let i = 0; i < a.count; i++){
    let y = a.getY(i) + shared.ambient.vel[i]*dt;
    if (y > 9){ y = 0.2; a.setX(i, rand(-shared.arenaHalf, shared.arenaHalf)); a.setZ(i, rand(-shared.arenaHalf, shared.arenaHalf)); }
    a.setY(i, y);
    a.setX(i, a.getX(i) + Math.sin(shared.ambient.t*0.8 + i)*dt*0.3);
  }
  a.needsUpdate = true;
}
