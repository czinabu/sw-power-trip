// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Ink VFX kit: pooled cel-shaded flare sprites (stars, discs, rings, smoke puffs) with a hot core, a flat colour band
// and a dark ink rim, so ability and weapon effects match the heroes' Ink look (cel bands + ink outline).

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { rand } from '../utils.js';
import { acquireParticle } from './particles.js';
import { G, player } from '../state.js';

/* ============================================================
   INK SPRITES — one shader draws every shape, banded like the hero models' toon ramp:
     core (white-hot, over 1.0 so it blooms) → colour band → ink rim (the same near-black as the model outlines).
   Shapes: 0 disc · 1 star (n spikes) · 2 ring (shock fronts) · 3 puff (lumpy cel ball with a shadow crescent).
   Opacity and colour change in STEPS rather than smooth ramps, which is what makes it read as cel animation.
   A fixed pool (no runtime allocation): every sprite owns its mesh + material, built once at startup.
   ============================================================ */
const INK = 0x07060a;
const VERT = /* glsl */`
  uniform float uBill, uRot;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    if (uBill > 0.5){
      vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
      float c = cos(uRot), s = sin(uRot);
      vec2 p = position.xy * sc;
      mv.xy += vec2(c*p.x - s*p.y, s*p.x + c*p.y);
      gl_Position = projectionMatrix * mv;
    } else {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  }`;
const FRAG = /* glsl */`
  uniform vec3 uColor, uCore, uInk;
  uniform float uOpacity, uShape, uPoints, uSharp, uInner, uCoreW, uInkW, uArc, uShade, uDissolve, uSeed;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float R = 1.0;
    if (uShape > 0.5 && uShape < 1.5) R = mix(uSharp, 1.0, pow(abs(cos(a * uPoints * 0.5)), 8.0));
    else if (uShape > 2.5) R = 0.9 + 0.05 * sin(a * 5.0 + uSeed) + 0.05 * sin(a * 3.0 - uSeed * 2.0);
    float d = r / R;
    if (d > 1.0) discard;
    if (uArc < 3.1 && abs(atan(p.x, p.y)) > uArc) discard;          // crescent: keep an arc centred on +y
    if (uDissolve > 0.0 && vnoise(p * 3.5 + uSeed * 7.0) < uDissolve) discard;   // cel break-up as a puff dies
    float aa = fwidth(d) * 1.5;
    vec3 col; float alpha = 1.0;
    if (uShape > 1.5 && uShape < 2.5){
      float t = (d - uInner) / (1.0 - uInner);                      // 0 at the inner edge → 1 at the shock front
      if (t < 0.0) discard;
      col = mix(uColor, uCore, step(1.0 - uInkW - uCoreW, t));      // white-hot leading edge
      alpha = t < 0.45 ? 0.32 : 0.9;                                 // stepped body, no soft gradient
      col = mix(col, uInk, smoothstep(1.0 - uInkW - aa, 1.0 - uInkW, t));
    } else {
      col = mix(uCore, uColor, smoothstep(uCoreW - aa, uCoreW, d));
      if (uShade > 0.0 && length(p - vec2(-0.28, 0.3) * R) > 0.92 * R) col *= 1.0 - uShade;   // cel shadow crescent
      col = mix(col, uInk, smoothstep(1.0 - uInkW - aa, 1.0 - uInkW, d));
    }
    alpha *= 1.0 - smoothstep(1.0 - aa, 1.0, d);
    gl_FragColor = vec4(col, alpha * uOpacity);
  }`;
const SHAPE = { disc: 0, star: 1, ring: 2, puff: 3 };
const POOL = 260;
const quad = new THREE.PlaneGeometry(1, 1);
const sprites = [];
let head = 0;
for (let i = 0; i < POOL; i++){
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color() }, uCore: { value: new THREE.Color() }, uInk: { value: new THREE.Color(INK) },
      uOpacity: { value: 1 }, uShape: { value: 0 }, uPoints: { value: 4 }, uSharp: { value: 0.2 }, uInner: { value: 0.7 },
      uCoreW: { value: 0.3 }, uInkW: { value: 0.12 }, uArc: { value: 4 }, uShade: { value: 0 }, uDissolve: { value: 0 },
      uSeed: { value: 0 }, uBill: { value: 1 }, uRot: { value: 0 },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(quad, mat);
  m.visible = false; m.frustumCulled = false; m.renderOrder = 2;
  m.userData = { active: false, vel: new THREE.Vector3(), o: null, age: 0 };
  scene.add(m);
  sprites.push(m);
}
const _z = new THREE.Vector3(0, 0, 1), _hot = new THREE.Color();
// a colour pushed past 1.0 so the bloom pass catches it (the composer renders in half-float)
function hot(hex, k){ return _hot.setHex(hex).multiplyScalar(k); }

/* spawn one ink sprite. o:
   pos, vel, grav, drag · life, delay · size: [from, to], ease (power of the ease-out) · color, core (hex), coreHot,
   ink · shape ('disc'|'star'|'ring'|'puff'), points, sharp, inner, coreW, inkW, arc, shade · dissolve: [from, to]
   rot, spin · normal (flat sprite facing this way, turned by rot; billboards when absent) · op, fadeAt, steps · ramp: [[k, hex], …]
   (stepped colour over life, e.g. fire cooling to smoke) · follow (Object3D to ride) */
export function inkSprite(o){
  const m = sprites[head]; head = (head + 1) % POOL;
  const u = m.userData, U = m.material.uniforms;
  u.active = true; u.o = o; u.age = 0; u.delay = o.delay || 0;
  m.position.copy(o.pos);
  u.vel.copy(o.vel || _zero);
  U.uShape.value = SHAPE[o.shape || 'disc'];
  U.uPoints.value = o.points || 4;
  U.uSharp.value = o.sharp != null ? o.sharp : 0.18;
  U.uInner.value = o.inner != null ? o.inner : 0.72;
  U.uCoreW.value = o.coreW != null ? o.coreW : 0.32;
  U.uInkW.value = o.inkW != null ? o.inkW : 0.14;
  U.uArc.value = o.arc || 4;
  U.uShade.value = o.shade || 0;
  U.uSeed.value = Math.random() * 10;
  U.uColor.value.setHex(o.color != null ? o.color : 0xffffff);
  U.uCore.value.copy(hot(o.core != null ? o.core : 0xffffff, o.coreHot != null ? o.coreHot : (o.shape === 'ring' ? 1.35 : 2)));
  U.uInk.value.setHex(o.ink != null ? o.ink : INK);
  U.uDissolve.value = o.dissolve ? o.dissolve[0] : 0;
  U.uRot.value = o.rot != null ? o.rot : rand(0, Math.PI * 2);
  if (o.normal){ U.uBill.value = 0; m.quaternion.setFromUnitVectors(_z, o.normal); if (o.rot != null) m.rotateZ(o.rot); }
  else { U.uBill.value = 1; m.quaternion.identity(); }
  apply(m, 0);
  m.visible = u.delay <= 0;
  return m;
}
const _zero = new THREE.Vector3();
function apply(m, k){
  const u = m.userData, o = u.o, U = m.material.uniforms;
  const s0 = o.size[0], s1 = o.size[1];
  const e = 1 - Math.pow(1 - k, o.ease || 2);
  const s = s0 + (s1 - s0) * e;
  m.scale.set(s, s, s);
  // stepped fade: hold full strength, then drop in a few hard steps (cel timing, not a smooth tween)
  const fa = o.fadeAt != null ? o.fadeAt : 0.4, steps = o.steps || 3;
  let f = k < fa ? 1 : 1 - (k - fa) / (1 - fa);
  f = Math.ceil(f * steps) / steps;
  U.uOpacity.value = (o.op != null ? o.op : 1) * f;
  if (o.ramp){
    let hex = o.ramp[0][1];
    for (const st of o.ramp) if (k >= st[0]) hex = st[1];
    U.uColor.value.setHex(hex);
    if (o.rampCore) U.uCore.value.setHex(hex).multiplyScalar(o.rampCore);
  }
  if (o.dissolve) U.uDissolve.value = o.dissolve[0] + (o.dissolve[1] - o.dissolve[0]) * k * k;
}
export function updateInk(dt){
  for (let i = 0; i < POOL; i++){
    const m = sprites[i], u = m.userData;
    if (!u.active) continue;
    if (u.delay > 0){ u.delay -= dt; if (u.delay > 0) continue; m.visible = true; }
    const o = u.o;
    u.age += dt;
    const k = u.age / o.life;
    if (k >= 1){ u.active = false; m.visible = false; u.o = null; continue; }
    if (o.follow){ o.follow.getWorldPosition(m.position); if (o.offset) m.position.add(o.offset); }
    else {
      if (o.grav) u.vel.y -= o.grav * dt;
      if (o.drag) u.vel.multiplyScalar(Math.max(0, 1 - o.drag * dt));
      m.position.addScaledVector(u.vel, dt);
    }
    if (o.spin) m.material.uniforms.uRot.value += o.spin * dt;
    apply(m, k);
  }
}

/* ---------- streak sparks — pooled particles stretched along their velocity ---------- */
export function sparks(pos, color, count, speed, o = {}){
  for (let i = 0; i < count; i++){
    const m = acquireParticle();
    m.material.color.setHex(color);
    m.material.blending = THREE.AdditiveBlending; m.material.depthWrite = false;
    m.position.copy(pos);
    const u = m.userData;
    if (o.dir){
      const c = o.cone != null ? o.cone : 0.5;
      u.vel.set(o.dir.x + rand(-c, c), o.dir.y + rand(-c, c), o.dir.z + rand(-c, c)).normalize().multiplyScalar(speed * rand(0.5, 1));
    } else {
      const a = Math.random() * Math.PI * 2, e = rand(-0.5, 1);
      u.vel.set(Math.cos(a) * Math.cos(e), Math.sin(e) + (o.up || 0.3), Math.sin(a) * Math.cos(e)).multiplyScalar(speed * rand(0.45, 1));
    }
    u.life = rand(o.life ? o.life * 0.6 : 0.16, o.life || 0.34);
    u.streak = o.stretch || 3.2;
    u.grav = o.grav != null ? o.grav : 14;
    m.scale.setScalar((o.size || 0.55) * rand(0.7, 1.1));
  }
}

/* ============================================================
   COMPOSED EFFECTS — built from the sprites above
   ============================================================ */
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _ang = new THREE.Vector3();
// the on-screen angle of a world direction, so flat spikes can point the way something travels
export function screenAngle(dir){
  _ang.copy(dir).transformDirection(camera.matrixWorldInverse);
  return Math.atan2(_ang.y, _ang.x);
}
const UP = new THREE.Vector3(0, 1, 0);

/* MUZZLE FLASH — a two-frame cel flash: a four-point star, a spike thrown down the barrel line and a puff of sparks */
export function muzzleFlash(pos, dir, color, size = 1){
  const ang = screenAngle(dir);
  inkSprite({ pos, shape: 'star', points: 4, sharp: 0.22, color, size: [0.55 * size, 0.85 * size], life: 0.07, fadeAt: 0.5, steps: 2,
              rot: ang + Math.PI / 4 + rand(-0.3, 0.3), coreW: 0.42, inkW: 0.16 });
  inkSprite({ pos: _v.copy(pos).addScaledVector(dir, 0.22 * size), shape: 'star', points: 2, sharp: 0.08, color, size: [0.9 * size, 1.25 * size],
              life: 0.06, fadeAt: 0.5, steps: 2, rot: ang, coreW: 0.38, inkW: 0.18 });
  sparks(pos, color, 3, 9 * size, { dir, cone: 0.35, life: 0.14, grav: 0, size: 0.4 });
}

/* HIT SPARK — a cel impact star, a thin shock ring and a spray of streaks */
export function hitSpark(pos, color, power = 1){
  inkSprite({ pos, shape: 'star', points: 6 + (power > 1.2 ? 2 : 0), sharp: 0.2, color, size: [0.5 + 0.35 * power, 1.1 + 0.5 * power],
              life: 0.13, fadeAt: 0.3, steps: 3, coreW: 0.4 });
  inkSprite({ pos, shape: 'ring', inner: 0.78, color, size: [0.4, 1.3 + 1.1 * power], life: 0.18, ease: 3, coreW: 0.25, inkW: 0.22, op: 0.9 });
  sparks(pos, color, Math.round(4 + 3 * power), 8 + 4 * power, { life: 0.26, grav: 10, size: 0.5 });
}

/* BOLT IMPACT — a small cel splash where a blaster bolt lands, sparks kicked back off the surface */
export function boltImpact(pos, color, dir){
  inkSprite({ pos, shape: 'star', points: 5, sharp: 0.25, color, size: [0.45, 0.9], life: 0.1, steps: 2, coreW: 0.45 });
  inkSprite({ pos, shape: 'ring', inner: 0.75, color, size: [0.3, 1.2], life: 0.14, ease: 3, inkW: 0.24, coreW: 0.2, op: 0.85 });
  sparks(pos, color, 4, 7, { dir: dir ? _d.copy(dir).negate() : null, cone: 0.9, life: 0.2, size: 0.4 });
}

/* BLOCK / PARRY — the clash: a big eight-point star, a white flash disc, a ring and a hard spray of sparks */
export function clashFlash(pos, color, big = true){
  inkSprite({ pos, shape: 'disc', color: 0xffffff, size: [0.8, 1.6], life: 0.08, steps: 2, coreW: 0.75, inkW: 0.1 });
  inkSprite({ pos, shape: 'star', points: 8, sharp: 0.14, color, size: [1.4, big ? 3.2 : 2.2], life: 0.24, fadeAt: 0.3, steps: 3, coreW: 0.34, spin: 2 });
  inkSprite({ pos, shape: 'ring', inner: 0.8, color, core: color, coreHot: 1.2, size: [0.6, big ? 5.4 : 3.6], life: 0.3, ease: 3, inkW: 0.22, coreW: 0.2 });
  sparks(pos, color, big ? 12 : 7, 13, { life: 0.32, size: 0.55 });
}

/* GROUND SHOCK — a flat ink ring racing outward along the floor */
export function groundRing(pos, color, maxR, dur, op = 1, o = {}){
  inkSprite({ pos: _v.set(pos.x, (pos.y || 0) + 0.12 + rand(0, 0.02), pos.z), normal: UP, shape: 'ring', inner: o.inner || 0.86,
              color, size: [o.r0 || 1.1, maxR * 2], ease: 3, life: dur, op: Math.min(1, op * 1.3), fadeAt: 0.3, coreW: 0.1, inkW: 0.18, coreHot: 1.1,
              delay: o.delay });
}

/* SMOKE / DUST PUFF — a lumpy cel ball with a shadow crescent that breaks up as it fades */
export function puff(pos, color, size, life, vel, o = {}){
  return inkSprite({ pos, vel, shape: 'puff', color, core: color, coreHot: 1, coreW: 0, shade: o.shade != null ? o.shade : 0.38,
                     size: [size * (o.grow0 || 0.5), size], ease: 2, life, fadeAt: 0.55, steps: 2, dissolve: [0, 0.85],
                     drag: o.drag != null ? o.drag : 2.5, grav: o.grav || 0, inkW: o.inkW != null ? o.inkW : 0.1, delay: o.delay,
                     ramp: o.ramp, rampCore: o.ramp ? 1 : 0, op: o.op });
}

/* EXPLOSION — the anime fireball: white flash → a cluster of toon fire puffs that cool in hard steps
   (white, yellow, orange, ember) into ink-rimmed smoke, a ground shock and a spray of debris streaks */
const FIRE = [[0, 0xffe08a], [0.07, 0xffd34a], [0.3, 0xff8a2a], [0.5, 0xc2401c], [0.66, 0x4a3a34]];
export function explosion(pos, radius, big = false){
  const R = radius * (big ? 0.45 : 0.42);
  inkSprite({ pos, shape: 'star', points: 8, sharp: 0.18, color: 0xffd34a, size: [R * 1.2, R * 3], life: 0.14, fadeAt: 0.25, steps: 2, coreW: 0.4, coreHot: 1.5 });
  inkSprite({ pos, shape: 'disc', color: 0xffe9a0, size: [R * 1.4, R * 2], life: 0.06, steps: 1, coreW: 0.6, coreHot: 1.3, inkW: 0.08 });
  const n = big ? 11 : 7;
  for (let i = 0; i < n; i++){
    const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), out = rand(0.25, 0.8) * R;
    _d.set(Math.cos(a) * out, rand(0.1, 0.9) * R, Math.sin(a) * out);
    puff(_v.copy(pos).add(_d), FIRE[0][1], R * rand(0.9, 1.3), rand(0.55, 0.85) * (big ? 1.25 : 1),
         _d.clone().multiplyScalar(rand(2.5, 4)).setY(rand(1.5, 3.5)), { ramp: FIRE, drag: 3.2, grav: -1.5, delay: rand(0, 0.05) });
  }
  puff(_v.copy(pos).setY(pos.y + R * 0.4), FIRE[0][1], R * 1.6, big ? 0.9 : 0.7, _d.set(0, 2.5, 0), { ramp: FIRE, drag: 2, grav: -2 });
  groundRing(pos, 0xffb04a, radius + 1.5, 0.36 * (big ? 1.4 : 1), 1);
  groundRing(pos, 0xff7a2a, radius + 4, 0.55 * (big ? 1.4 : 1), 0.7, { delay: 0.04 });
  sparks(pos, 0xffd06a, big ? 22 : 14, big ? 22 : 17, { life: 0.5, up: 0.6, size: 0.7 });
  sparks(pos, 0xff8a2a, big ? 12 : 8, 12, { life: 0.4, up: 0.5, size: 0.6 });
}

/* RISING MOTES — a column of small glints drifting up (healing, channelling) */
export function motes(pos, color, n, spread, o = {}){
  for (let i = 0; i < n; i++){
    inkSprite({ pos: _v.set(pos.x + rand(-spread, spread), pos.y + rand(0.1, o.h || 1.6), pos.z + rand(-spread, spread)),
                vel: _d.set(0, rand(1.5, 3.5), 0), shape: 'star', points: 4, sharp: 0.2, color, size: [0.35, 0.18], life: rand(0.45, 0.8),
                fadeAt: 0.5, steps: 3, delay: rand(0, o.delay || 0.2), rot: 0, coreW: 0.45, inkW: 0.16 });
  }
}

/* JETPACK — cel thruster flames: a short flickering spike from each nozzle, licks of flame shed down the exhaust line
   and a thin trail of smoke. power ~0.4 (hover) … 1.4 (boost); `back` tilts the plume against a boost direction. */
let thrustAcc = 0;
const DOWN = new THREE.Vector3(0, -1, 0), _tdn = new THREE.Vector3();
export function thrust(dt, power, back){
  if (!player.jetGlow) return;
  thrustAcc += dt * 34 * power;
  for (; thrustAcc >= 1; thrustAcc--){
    const dn = back ? _tdn.set(-back.x * 0.7, -1, -back.z * 0.7).normalize() : _tdn.copy(DOWN);
    const ang = screenAngle(dn);
    for (const nz of player.jetGlow){
      nz.getWorldPosition(_v);
      inkSprite({ pos: _v, vel: dn.clone().multiplyScalar(rand(6, 9) * power), shape: 'star', points: 2, sharp: 0.3, color: 0x59c6ff,
                  size: [0.5 + 0.35 * power, 0.12], life: rand(0.08, 0.13), steps: 2, rot: ang, coreW: 0.5, inkW: 0.18 });
    }
    if (Math.random() < 0.35){
      player.jetGlow[0].getWorldPosition(_v);
      puff(_v.addScaledVector(dn, 0.5), 0x9fb4c4, 0.45 + 0.2 * power, rand(0.35, 0.5), dn.clone().multiplyScalar(4 * power), { grow0: 0.5, shade: 0.3 });
    }
  }
}
// ignition: a flat blue ring kicked off the ground under the boots and a quick puff of dust
export function jetIgnite(pp){
  groundRing(pp, 0x9ad8ff, 2.2, 0.3, 0.9);
  for (let n = 0; n < 6; n++){
    const a = (n / 6) * Math.PI * 2;
    puff(_v.set(pp.x + Math.cos(a) * 0.5, pp.y + 0.25, pp.z + Math.sin(a) * 0.5), 0xbcc4c8, 0.7, 0.4,
         new THREE.Vector3(Math.cos(a) * 5, 0.4, Math.sin(a) * 5), { drag: 4, grow0: 0.4 });
  }
}

// a ring of cel dust puffs kicked out along the ground from a landing
export function dustRing(pp, radius, color = 0x8a7f72){
  for (let n = 0; n < 9; n++){
    const a = (n / 9) * Math.PI * 2 + rand(-0.25, 0.25), r = rand(0.8, 1.4);
    puff(_v.set(pp.x + Math.cos(a)*r, (pp.y || 0) + 0.4, pp.z + Math.sin(a)*r), color, rand(1.5, 2.1), rand(0.5, 0.75),
         new THREE.Vector3(Math.cos(a) * radius * 1.6, rand(0.5, 1.5), Math.sin(a) * radius * 1.6), { drag: 3.4, grow0: 0.45, shade: 0.3, op: 0.7, inkW: 0.03 });
  }
}

/* FORCE BARRIER bubble — an Ink force field: clear in the middle, cel bands toward the silhouette (colour, then a
   white-hot band, then an ink outline) with faint energy lines climbing the shell. The game fades it by writing
   material.opacity (0.22 = full strength), which this maps onto the bands. */
export function barrierMaterial(color){
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.7).multiplyScalar(2) },
                uInk: { value: new THREE.Color(INK) }, uFade: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vN, vV; varying float vY;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uCore, uInk; uniform float uFade, uTime;
      varying vec3 vN, vV; varying float vY;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        vec3 col = uColor; float a = 0.1;
        float lines = step(0.86, fract(vY * 2.6 - uTime * 0.9));
        a += lines * 0.22;
        if (f > 0.55){ col = uColor; a = 0.55; }
        if (f > 0.8){ col = uCore; a = 0.95; }
        if (f > 0.93){ col = uInk; a = 0.9; }
        gl_FragColor = vec4(col, a * uFade);
      }`,
    transparent: true, depthWrite: false,
  });
  return mat;
}
// hook a barrier mesh so its bands follow the game's opacity writes and the energy lines crawl
export function bindBarrier(mesh){
  mesh.onBeforeRender = () => {
    const U = mesh.material.uniforms;
    U.uFade.value = Math.min(1, mesh.material.opacity / 0.22);
    U.uTime.value = G.gt;
  };
}
