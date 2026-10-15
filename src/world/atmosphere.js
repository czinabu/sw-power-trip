// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Atmosphere: a theme's lighting, fog and sky, plus the live parts. The fight's progress (wave → final wave → boss)
// shifts the mood toward the theme's `beats` target, and storm themes throw lightning. Visual only: nothing here
// touches gameplay.

import * as THREE from 'three';
import { renderer, scene, hemi, sun, rim } from '../engine/renderer.js';
import { rand, clamp } from '../utils.js';
import { shared, G } from '../state.js';
import { LEVELS } from '../data/levels.js';

const A = { T: null, sky: null, base: null, p: 0, flash: 0, nextBolt: 0, bolt: 0 };
const _c = new THREE.Color(), _d = new THREE.Color();

/* set lights, fog and clear colour for a theme. sky: the dome mesh (its material colour is used as a tint) */
export function applyAtmosphere(T, L, sky){
  const lt = T.light;
  scene.fog = new THREE.Fog(T.fog, L.arena * (T.fogStart ?? 0.5), L.arena * (T.fogEnd ?? 1.9));
  renderer.setClearColor(T.clear ?? T.fog);
  sun.color.setHex(lt.sun); sun.intensity = lt.sunI;
  const d = lt.dir || [30, 50, 20];
  sun.position.set(d[0], d[1], d[2]);
  hemi.color.setHex(lt.hemiSky); hemi.groundColor.setHex(lt.hemiGround); hemi.intensity = lt.fill;
  rim.color.setHex(lt.rim ?? 0x5a7fd8); rim.intensity = lt.rimI ?? 0.5;
  A.T = T; A.sky = sky; A.p = 0; A.flash = 0; A.bolt = 0;
  A.nextBolt = T.storm ? rand(T.storm.every[0], T.storm.every[1]) : 0;
  A.base = { fog: new THREE.Color(T.fog), fill: lt.fill, sunI: lt.sunI };
}

/* how far into this level's fight we are, 0 (first wave) → 1 (final wave / boss) */
function progress(){
  if (shared.boss && shared.boss.hp > 0) return 1;
  if (G.endless) return (((G.endlessWave || 1) - 1) % 5) / 4;
  const L = LEVELS[G.levelIdx], n = L ? L.waves.length : 4;
  return clamp(((G.wave || 1) - 1) / Math.max(1, n - 1), 0, 1);
}

export function updateAtmosphere(dt){
  const T = A.T;
  if (!T || !A.base) return;
  // mood follows the fight: ease toward the beat target as the waves climb
  const want = G.mode === 'play' ? progress() : 0;
  A.p += (want - A.p) * Math.min(1, dt * 0.6);
  const b = T.beats || {};
  if (scene.fog){
    _c.copy(A.base.fog); if (b.fog != null) _c.lerp(_d.setHex(b.fog), A.p);
    scene.fog.color.copy(_c);
  }
  let fill = A.base.fill * (1 + ((b.fill ?? 1) - 1) * A.p);
  let skyK = 1 + ((b.sky ?? 1) - 1) * A.p;
  // lightning: a double flicker that lights the whole field, more often as the fight climbs
  if (T.storm){
    A.nextBolt -= dt * (1 + A.p * (T.storm.ramp ?? 1.5));
    if (A.nextBolt <= 0){ A.bolt = 0.38; A.nextBolt = rand(T.storm.every[0], T.storm.every[1]); }
    if (A.bolt > 0){
      A.bolt -= dt;
      const k = (A.bolt > 0.26 || (A.bolt < 0.16 && A.bolt > 0.08)) ? 1 : 0.15;
      fill += k * (T.storm.fill ?? 1.2);
      skyK += k * (T.storm.sky ?? 0.9);
    }
  }
  hemi.intensity = fill;
  if (A.sky){
    A.sky.material.color.setScalar(skyK);
    if (b.tint != null){ _c.setHex(b.tint); A.sky.material.color.lerp(_c.multiplyScalar(skyK), A.p * 0.6); }
  }
}
