// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The air of a world: a second cloud layer drifting across the painted sky, banks of low mist rolling over the
// ground, and the sun's light shafts (the god-ray pass in engine/renderer.js, aimed here each frame). Built per
// arena by world/arena.js (buildWorld), updated from fx/ambient.js. Visual only.
//
// Theme keys (data/worlds.js), all optional:
//   mist:   false | { color, opacity, count, height }   (default: on, tinted from the fog)
//   shafts: false | 0..1 strength                         (default: on wherever the sky has a sun)
//   drift:  false | radians per second the upper cloud layer turns (default 0.004)

import * as THREE from 'three';
import { camera, shaftPass, aoPass } from '../engine/renderer.js';
import { rand } from '../utils.js';
import { shared, player } from '../state.js';

const A = { clouds: null, drift: 0, mist: null, sunDir: new THREE.Vector3(), shafts: 0 };

/* ---------- the drifting cloud layer: flat Ink clouds on a transparent dome just inside the sky ---------- */
const css = h => '#' + ('000000' + (h >>> 0).toString(16)).slice(-6);
function paintCloudLayer(cl, seed){
  const W = 1024, H = 512, HZ = H / 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = seed >>> 0 || 1;
  const R = () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0) % 100000) / 100000;
  const blob = (cx, cy, len, th) => {
    x.beginPath();
    const n = 6;
    for (let i = 0; i < n; i++){
      const px = cx - len / 2 + (i + 0.5) * len / n, rr = th * (0.7 + R() * 0.6) * (i === 0 || i === n - 1 ? 0.7 : 1);
      x.ellipse(px, cy, len / n * 0.9, rr, 0, 0, 7);
    }
    x.fill();
  };
  const lo = cl.lo ?? 0.45, hi = cl.hi ?? 0.85, n = Math.max(6, Math.round((cl.count || 14) * 0.6));
  for (let i = 0; i < n; i++){
    // a little higher and bigger than the painted ones, so the two layers sit apart
    const cx = R() * W, cy = HZ * (lo * 0.8 + R() * (hi - lo) * 0.8), len = 120 + R() * 240, th = 9 + R() * 14;
    for (const du of [-W, 0, W]){
      x.globalAlpha = 0.85; x.fillStyle = css(cl.under); blob(cx + du, cy + th * 0.4, len, th);
      x.globalAlpha = 0.9;  x.fillStyle = css(cl.color); blob(cx + du, cy, len * 0.93, th * 0.78);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cloudCache = new WeakMap();

/* ---------- ground mist: soft upright billboards that roll slowly with the wind ---------- */
const MIST_VERT = /* glsl */`
  attribute vec4 aMist;   // seed, width, height, opacity
  uniform float uNear, uFar;
  varying vec2 vUv; varying float vA, vSeed;
  void main(){
    vUv = uv; vSeed = aMist.x;
    vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 toCam = cameraPosition - c; toCam.y = 0.0;
    vec3 side = normalize(vec3(toCam.z, 0.0, -toCam.x) + 1e-5);
    vec3 p = c + side * position.x * aMist.y + vec3(0.0, (position.y + 0.5) * aMist.z, 0.0);
    float d = length(cameraPosition - c);
    vA = aMist.w * smoothstep(2.5, 9.0, d) * (1.0 - smoothstep(uNear, uFar, d));   // never fills the lens; gone in the fog
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const MIST_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uTime;
  varying vec2 vUv; varying float vA, vSeed;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
    return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float shape = (1.0 - smoothstep(0.35, 1.0, abs(p.x))) * smoothstep(-1.0, -0.55, p.y) * (1.0 - smoothstep(-0.1, 1.0, p.y));
    float wisp = n(vec2(vUv.x * 3.0 + uTime * 0.05 + vSeed * 9.0, vUv.y * 2.0 + vSeed * 3.0)) * 0.6
               + n(vec2(vUv.x * 7.0 - uTime * 0.08 + vSeed * 4.0, vUv.y * 5.0)) * 0.4;
    float a = shape * smoothstep(0.3, 0.75, wisp) * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }`;
const MIST_MAX = 44, NEAR = 30;
let mistMesh = null;
const mistMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uNear: { value: 40 }, uFar: { value: 90 } },
  vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false,
});
function buildMist(T, L){
  const mi = T.mist === false ? null : (T.mist || {});
  if (!mi) return null;
  if (!mistMesh){
    const g = new THREE.PlaneGeometry(1, 1);
    g.setAttribute('aMist', new THREE.InstancedBufferAttribute(new Float32Array(MIST_MAX * 4), 4));
    mistMesh = new THREE.InstancedMesh(g, mistMat, MIST_MAX);
    mistMesh.frustumCulled = false; mistMesh.renderOrder = 2; mistMesh.userData.noBake = true; mistMesh.userData.noAO = true;
    mistMesh.userData.keepGeo = true;
  }
  const count = Math.min(MIST_MAX, mi.count ?? 30), am = mistMesh.geometry.attributes.aMist;
  const half = shared.arenaBig ? NEAR : Math.max(shared.arenaHalf, shared.arenaHalfZ || 0);
  const pos = [];
  for (let i = 0; i < MIST_MAX; i++){
    am.setXYZW(i, Math.random(), rand(7, 13), (mi.height ?? 1.8) * rand(0.7, 1.3), i < count ? (mi.opacity ?? 0.22) * rand(0.6, 1) : 0);
    pos.push(new THREE.Vector3(rand(-half, half), 0, rand(-(shared.arenaHalfZ || half), shared.arenaHalfZ || half)));
  }
  am.needsUpdate = true;
  // tinted from the fog, a touch lighter, so it reads as the same air coming down to the ground
  mistMat.uniforms.uColor.value.setHex(mi.color ?? T.fog).lerp(new THREE.Color(0xffffff), mi.color != null ? 0 : 0.18);
  const wind = rand(0, Math.PI * 2);
  return { pos, half, vel: new THREE.Vector2(Math.cos(wind), Math.sin(wind)).multiplyScalar(0.6), count };
}

/* build the air for a themed world. sky: the dome mesh (the cloud layer rides on it); sunDir: the painted sun's
   direction (or null) */
export function buildAir(T, L, sky, sunDir){
  A.clouds = null; A.mist = null; A.shafts = 0;
  // the drifting upper clouds
  const cl = T.sky && T.sky.clouds;
  if (cl && T.drift !== false){
    if (!cloudCache.has(T)) cloudCache.set(T, new THREE.MeshBasicMaterial({ map: paintCloudLayer(cl, (cl.seed || 11) * 7 + 3),
      side: THREE.BackSide, fog: false, transparent: true, depthWrite: false }));   // painted once per world, kept for rebuilds
    const dome = new THREE.Mesh(sky.geometry, cloudCache.get(T));
    dome.scale.setScalar(0.97); dome.rotation.y = rand(0, Math.PI * 2);
    dome.userData.noBake = true; dome.userData.keepGeo = true;   // shares the sky's geometry: disposed with the sky
    sky.add(dome);
    A.clouds = dome; A.drift = T.drift ?? 0.004;
  }
  // ground mist
  A.mist = buildMist(T, L);
  if (A.mist){
    mistMat.uniforms.uNear.value = (L.arena || 60) * (T.fogStart ?? 0.5) * 0.8;
    mistMat.uniforms.uFar.value = (L.arena || 60) * (T.fogEnd ?? 1.9) * 0.7;
    shared.arenaGroup.add(mistMesh);
    placeMist(0);
  }
  // light shafts toward the painted sun
  if (sunDir && T.shafts !== false){
    A.sunDir.copy(sunDir);
    A.shafts = typeof T.shafts === 'number' ? T.shafts : 0.5;
    shaftPass.uniforms.color.value.setHex(T.light.sun);
  }
}
export function clearAir(){ A.clouds = null; A.mist = null; A.shafts = 0; shaftPass.uniforms.strength.value = 0; shaftPass.enabled = false; }

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _f = new THREE.Vector3();
function placeMist(dt){
  const M = A.mist, big = shared.arenaBig, p = player.group.position;
  const cx = big ? p.x : 0, cz = big ? p.z : 0, hx = M.half, hz = big ? M.half : (shared.arenaHalfZ || M.half);
  for (let i = 0; i < M.count; i++){
    const q = M.pos[i];
    q.x += M.vel.x * dt * (0.7 + (i % 5) * 0.12); q.z += M.vel.y * dt * (0.7 + (i % 5) * 0.12);
    if (q.x < cx - hx) q.x += hx * 2; else if (q.x > cx + hx) q.x -= hx * 2;
    if (q.z < cz - hz) q.z += hz * 2; else if (q.z > cz + hz) q.z -= hz * 2;
    mistMesh.setMatrixAt(i, _m.makeTranslation(q.x, 0, q.z));
  }
  for (let i = M.count; i < MIST_MAX; i++) mistMesh.setMatrixAt(i, _m.makeTranslation(0, -50, 0));
  mistMesh.instanceMatrix.needsUpdate = true;
}

export function updateAir(dt){
  if (A.clouds) A.clouds.rotation.y += A.drift * dt;
  if (A.mist){ mistMat.uniforms.uTime.value += dt; placeMist(dt); }
  // aim the shafts: the sun's place on screen, faded out as it leaves the view or swings behind the camera
  const u = shaftPass.uniforms;
  if (!A.shafts || !aoPass.enabled){ u.strength.value = 0; shaftPass.enabled = false; return; }
  _v.copy(A.sunDir).multiplyScalar(150).add(camera.position).project(camera);
  const behind = _v.z > 1 || camera.getWorldDirection(_f).dot(A.sunDir) < 0;
  const sx = _v.x * 0.5 + 0.5, sy = _v.y * 0.5 + 0.5;
  const off = Math.max(0, Math.abs(sx - 0.5) - 0.5, Math.abs(sy - 0.5) - 0.5);   // how far past the screen edge
  u.sunUv.value.set(sx, sy);
  u.strength.value = behind ? 0 : A.shafts * Math.max(0, 1 - off / 0.45);
  shaftPass.enabled = u.strength.value > 0.002;   // the depth it marches through only exists with the AO (HIGH)
}
