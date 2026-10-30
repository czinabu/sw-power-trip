// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Atmosphere: a theme's lighting, fog and sky, plus the live parts. The fight's progress (wave → final wave → boss)
// shifts the mood toward the theme's `beats` target, and storm themes throw lightning. Visual only: nothing here
// touches gameplay.

import * as THREE from 'three';
import { renderer, scene, camera, hemi, sun, rim, glow, setSceneGlow, setGrade, aoFade } from '../engine/renderer.js';
import { rand, clamp } from '../utils.js';
import { shared, G, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { HAZE } from './ink.js';
import { SABER_LIGHT, DARK_LIGHT } from '../player/model/weapons.js';
import { LEVELS } from '../data/levels.js';
import { thunder } from '../audio/director.js';
import { missionProgress } from '../game/mission.js';

const A = { T: null, sky: null, base: null, p: 0, flash: 0, nextBolt: 0, bolt: 0, strike: null, half: 20 };

/* the visible lightning strike: one jagged ribbon, rebuilt in place on every flash (no allocation) */
const SEG = 14;
function makeStrike(color){
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
  const idx = [];
  for (let i = 0; i < SEG; i++){ const a = i*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); }
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.visible = false; m.userData.noBake = true;
  return m;
}
function placeStrike(m, half){
  const az = Math.random() * Math.PI * 2, r = half * rand(2.0, 2.8);
  const cx = Math.cos(az) * r, cz = Math.sin(az) * r, tx = -Math.sin(az), tz = Math.cos(az);   // ribbon width runs along the tangent
  const p = m.geometry.attributes.position, top = half * 2.2;
  let off = 0;
  for (let i = 0; i <= SEG; i++){
    const t = i / SEG, y = top * (1 - t), w = 0.5 + (1 - t) * 0.5;
    if (i) off += rand(-1, 1) * half * 0.09;
    p.setXYZ(i*2,   cx + tx * (off - w), y, cz + tz * (off - w));
    p.setXYZ(i*2+1, cx + tx * (off + w), y, cz + tz * (off + w));
  }
  p.needsUpdate = true;
}
const _c = new THREE.Color(), _d = new THREE.Color();

/* how bright the arena reads, 0 (dark: lava basalt, night ash) → 1 (bright: Jedha's sunlit stone, Ilum's ice): the
   floor's luminance under the key + fill light, the bulk of every frame. Drives the bloom and blade-light easing
   (setSceneGlow in engine/renderer.js). A theme can pin it with `glow: 0..1`. */
function brightness(T){
  if (T.glow != null) return T.glow;
  const base = T.floor && T.floor.base;
  if (base == null) return 0;
  _c.setHex(base);   // linear
  const key = (0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b) * (T.light.sunI + T.light.fill);
  const t = clamp((key - 0.3) / 0.45, 0, 1);
  return t * t * (3 - 2 * t);
}
function applyGlow(b){
  setSceneGlow(b);
  // the hero's blade lights are already built: rescale them (a stowed saber stays dark, see player/holster.js)
  if (player.blade && player.blade.light.intensity > 0) player.blade.light.intensity = SABER_LIGHT * glow.light;
  if (player.darkLight) player.darkLight.intensity = DARK_LIGHT * glow.light;
}

/* the arena's colour grade (engine/renderer.js setGrade): shadows lean toward the sky fill, highlights toward the sun,
   so Jedha's dusk warms, Ilum's ice cools and Mustafar burns without hand-picking a grade per world. A theme can
   override any of it with `grade: { sat, contrast, shadow, high }` (shadow/high as hex). */
const _gs = new THREE.Color(), _gh = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
function tintOf(out, hex, k){
  out.setHex(hex, THREE.LinearSRGBColorSpace);   // the grade runs on the display image: take the hex as it reads
  const m = Math.max(out.r, out.g, out.b, 1e-3);
  out.multiplyScalar(1 / m);
  return out.lerp(WHITE, 1 - k);
}
function gradeFor(T){
  const g = T.grade || {};
  return {
    sat: g.sat ?? 1.1, contrast: g.contrast ?? 1.08,
    shadow: g.shadow != null ? g.shadow : tintOf(_gs, T.light.hemiSky, 0.14),
    high: g.high != null ? g.high : tintOf(_gh, T.light.sun, 0.22),
  };
}

/* set lights, fog and clear colour for a theme. sky: the dome mesh (its material colour is used as a tint) */
export function applyAtmosphere(T, L, sky){
  const lt = T.light;
  scene.fog = new THREE.Fog(T.fog, L.arena * (T.fogStart ?? 0.5), L.arena * (T.fogEnd ?? 1.9));
  // ambient occlusion fades out before the fog thickens (engine/renderer.js)
  // the backdrop's aerial haze (world/ink.js farHaze): how fast it builds past the fog's near distance, and its cap
  HAZE.len.value = T.haze?.len ?? L.arena * 3; HAZE.max.value = T.haze?.max ?? 0.8;
  aoFade.near = Math.max(12, scene.fog.near * 0.5); aoFade.far = Math.max(aoFade.near + 10, scene.fog.near * 1.1);
  setGrade(gradeFor(T));
  renderer.setClearColor(T.clear ?? T.fog);
  sun.color.setHex(lt.sun); sun.intensity = lt.sunI;
  const d = lt.dir || [30, 50, 20];
  sun.position.set(d[0], d[1], d[2]);
  // a long arena (the pursuit route) or a battle map is far bigger than the sun's shadow box: the light and its box
  // follow the hero there, and the sky dome follows the camera. Everywhere else the light is fixed over the middle
  A.dir = d; A.long = (L.arenaZ || L.arena) > L.arena || shared.arenaBig;
  if (!sun.target.parent) scene.add(sun.target);
  sun.target.position.set(0, 0, 0);
  hemi.color.setHex(lt.hemiSky); hemi.groundColor.setHex(lt.hemiGround); hemi.intensity = lt.fill;
  rim.color.setHex(lt.rim ?? 0x5a7fd8); rim.intensity = lt.rimI ?? 0.5;
  A.T = T; A.sky = sky; A.p = 0; A.flash = 0; A.bolt = 0; A.half = L.arena / 2;
  A.strike = null;
  if (T.storm){ A.strike = makeStrike(T.storm.color ?? 0xeae4ff); shared.arenaGroup.add(A.strike); }
  A.nextBolt = T.storm ? rand(T.storm.every[0], T.storm.every[1]) : 0;
  A.base = { fog: new THREE.Color(T.fog), fill: lt.fill, sunI: lt.sunI };
  applyGlow(brightness(T));
}

/* an unthemed arena: stop driving the lights */
export function clearAtmosphere(){ applyGlow(0); setGrade(); aoFade.near = 18; aoFade.far = 46; A.T = null; A.sky = null; A.strike = null; A.long = false; sun.target.position.set(0, 0, 0); }

/* how far into this level's fight we are, 0 (first wave) → 1 (final wave / boss) */
function progress(){
  if (shared.boss && shared.boss.hp > 0) return 1;
  if (G.mission) return missionProgress();
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
    if (A.nextBolt <= 0){
      A.bolt = 0.38; A.nextBolt = rand(T.storm.every[0], T.storm.every[1]);
      if (A.strike) placeStrike(A.strike, A.half);
      thunder();
    }
    if (A.strike) A.strike.visible = A.bolt > 0.1;
    if (A.bolt > 0){
      A.bolt -= dt;
      const k = (A.bolt > 0.26 || (A.bolt < 0.16 && A.bolt > 0.08)) ? 1 : 0.15;
      fill += k * (T.storm.fill ?? 1.2);
      skyK += k * (T.storm.sky ?? 0.9);
    }
  }
  hemi.intensity = fill;
  if (A.long){
    const p = playerPos(), sx = Math.round(p.x / 4) * 4, sz = Math.round(p.z / 4) * 4;   // in steps, so shadow edges don't crawl
    sun.target.position.set(sx, 0, sz);
    sun.position.set(sx + A.dir[0], A.dir[1], sz + A.dir[2]);
    if (A.sky) A.sky.position.set(camera.position.x, 0, camera.position.z);
  }
  if (A.sky){
    A.sky.material.color.setScalar(skyK);
    if (b.tint != null){ _c.setHex(b.tint); A.sky.material.color.lerp(_c.multiplyScalar(skyK), A.p * 0.6); }
  }
}
