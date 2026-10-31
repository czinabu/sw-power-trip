// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Drifting ambient embers / ash / dust.

import * as THREE from 'three';
import { rand } from '../utils.js';
import { shared, G, player } from '../state.js';
import { makeEmberSprite } from '../world/textures.js';
import { updateAtmosphere } from '../world/atmosphere.js';
import { updateAir } from '../world/air.js';
import { updateWarfront } from '../world/warfront.js';
import { sparks } from './ink.js';
import { gust } from '../audio/director.js';
import { V3 } from '../utils.js';

/* L.ambient (from the world theme): { kind: 'embers' (rise) | 'ash' | 'snow' | 'rain' (fall) | 'dust' (drift), color, count, size } */
export function buildAmbient(L){
  const am = L.ambient || {};
  shared.ambientKind = am.kind || '';   // the audio director layers a matching wind / grit bed (audio/director.js)
  const fall = am.kind === 'snow' || am.kind === 'ash' || am.kind === 'rain';
  const N = am.count || 170;   // denser drifting embers/dust → thicker, more immersive air
  const pos = new Float32Array(N*3);
  const vel = new Float32Array(N);
  const b = box();
  for (let i = 0; i < N; i++){
    pos[i*3]   = rand(b.x - b.hx, b.x + b.hx);
    pos[i*3+1] = rand(0.2, 11);
    pos[i*3+2] = rand(b.z - b.hz, b.z + b.hz);
    vel[i] = am.kind === 'rain' ? -rand(11, 15) : (fall ? -1 : 1) * rand(0.2, 0.9) * (am.kind === 'dust' ? 0.3 : 1);   // (rain comes straight down, fast)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: am.color || L.ember || 0x99aabb, size: am.size || 0.34, map: makeEmberSprite(), transparent: true, opacity: am.opacity || 0.5,
    blending: fall ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;   // the points move (on a battle map they travel with the hero): never cull on a stale bound
  shared.arenaGroup.add(pts);
  shared.ambient = { pts, vel, t: 0 };
  buildMist(L);
}
/* L.mist: a few big soft low sprites drifting along the ground (Exegol's ghostly fog). Cheap: ~50 points, no per-frame allocation */
function buildMist(L){
  shared.mist = null;
  const m = L.mist;
  if (!m) return;
  const b = box(), N = m.count || 40;
  const pos = new Float32Array(N*3);
  for (let i = 0; i < N; i++){
    pos[i*3] = rand(b.x - b.hx, b.x + b.hx); pos[i*3+1] = rand(0.6, 4); pos[i*3+2] = rand(b.z - b.hz, b.z + b.hz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: m.color || 0x8090a8, size: m.size || 10, map: makeEmberSprite(), transparent: true, opacity: m.opacity || 0.15,
    depthWrite: false }));
  pts.frustumCulled = false;
  shared.arenaGroup.add(pts);
  shared.mist = { pts, t: 0 };
}
/* where the drift lives: the whole arena, or on a battle map (shared.arenaBig) a box round the hero that travels with
   them, so the air stays as thick as in a small arena without spreading the particles over 150 m */
const NEAR = 36;
const big0 = () => !!shared.arenaBig;
function box(){
  if (!shared.arenaBig) return { x: 0, z: 0, hx: shared.arenaHalf, hz: shared.arenaHalfZ };
  const p = player.group.position;
  return { x: p.x, z: p.z, hx: NEAR, hz: NEAR };
}
/* WIND GUSTS — now and then (every 7-14 s) a gust sweeps through: a loose handful of long streaks skimming past in one
   steady wind direction (snow spindrift, dust, drifting ash, embers) with a swell of wind to match. Sparse and quiet on
   purpose: the air should feel alive, never busy. Only in a fight's calm moments of play, never in menus or cutscenes. */
const GUST = { snow: 0xdfe9ff, dust: 0xe8c890, ash: 0xb8b0b0, embers: 0xff9a50 };
const _gp = V3(), _gd = V3();
let gustT = 2;   // (the first gust comes soon after a fight starts)
function updateGusts(dt){
  const col = GUST[shared.ambientKind];
  if (!col || G.mode !== 'play' || G.paused || G.cutscene){ return; }
  if ((gustT -= dt) > 0) return;
  gustT = rand(7, 14);
  // the wind blows across the view (a steady side per arena) so the streaks are seen crossing the scene, ahead of the hero
  const pp = player.group.position, side = (shared.windSide ?? (shared.windSide = Math.random() < 0.5 ? -1 : 1));
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);   // the way the camera looks along the ground
  _gd.set(-fz * side, rand(-0.02, 0.04), fx * side);
  for (let i = 0; i < 5; i++){   // five bursts staggered along the gust's front, each a few streaks
    const ahead = rand(5, 22);
    _gp.set(pp.x + fx * ahead - _gd.x * 14 + rand(-3, 3), rand(0.4, 3.5), pp.z + fz * ahead - _gd.z * 14 + rand(-3, 3));
    sparks(_gp, col, 5, 24, { dir: _gd, cone: 0.05, life: 1.2, grav: 0, stretch: 10, size: 0.3 });
  }
  gust(shared.ambientKind);
}
export function updateAmbient(dt){
  updateGusts(dt);
  updateAtmosphere(dt);
  updateAir(dt);
  updateWarfront(dt);
  if (shared.templeBrazier){   // the temple brazier breathes/flickers (bloom turns it into a glow)
    shared.templeBrazier.scale.set(0.9 + 0.12*Math.sin(G.gt*9.3), 1 + 0.14*Math.sin(G.gt*13) + 0.06*Math.sin(G.gt*27), 0.9 + 0.12*Math.cos(G.gt*11.1));
  }
  if (shared.mist){   // the mist crawls slowly one way, wrapping round the arena
    const mp = shared.mist.pts.geometry.attributes.position, mb = box(); shared.mist.t += dt;
    for (let i = 0; i < mp.count; i++){
      let x = mp.getX(i) + dt*(0.5 + (i % 5)*0.12);
      if (x > mb.x + mb.hx) x -= mb.hx*2;
      mp.setX(i, x); mp.setY(i, 0.6 + 1.8*(1 + Math.sin(shared.mist.t*0.15 + i*1.7)) + (i % 3));
      if (big0()) { const z = mp.getZ(i); if (z < mb.z - mb.hz) mp.setZ(i, z + mb.hz*2); else if (z > mb.z + mb.hz) mp.setZ(i, z - mb.hz*2); }
    }
    mp.needsUpdate = true;
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
