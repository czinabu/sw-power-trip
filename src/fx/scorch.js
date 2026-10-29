// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Scorch marks that stay: blasts, grenades, slams and blaster bolts leave a burnt Ink mark on the floor or the wall
// they hit. A fresh mark glows with embers that cool to black, and each one fades out after a while. One instanced
// mesh draws them all (a fixed ring, the oldest is reused), so a long fight costs a single draw call.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rand } from '../utils.js';
import { solids } from '../state.js';
import { groundAt } from '../world/collision.js';

const MAX = 72;
const HOLD = 22, FADE = 6;   // seconds a mark stays at full strength, then how long it takes to fade
const COOL = 2.2;            // seconds for the embers to go out

/* the scorch atlas: 2×2 variants. Red = how burnt (hard Ink steps: a black core, a dark band, a ragged splatter
   rim), green = the ember cracks that glow while the mark is fresh */
function paintAtlas(){
  const T = 128, N = T * 2;
  const burnt = document.createElement('canvas'), ember = document.createElement('canvas');
  burnt.width = burnt.height = ember.width = ember.height = N;
  const b = burnt.getContext('2d'), e = ember.getContext('2d');
  b.fillStyle = '#000'; b.fillRect(0, 0, N, N); e.fillStyle = '#000'; e.fillRect(0, 0, N, N);
  let s = 9;
  const R = () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0) % 100000) / 100000;
  const blob = (x, cx, cy, r, jag, n) => {
    x.beginPath();
    for (let i = 0; i <= n; i++){ const a = i / n * Math.PI * 2, rr = r * (1 - jag + R() * jag * 2); i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.fill();
  };
  for (let v = 0; v < 4; v++){
    const ox = (v % 2) * T, oy = (v >> 1) * T, cx = ox + T / 2, cy = oy + T / 2;
    b.save(); b.beginPath(); b.rect(ox, oy, T, T); b.clip();
    // splatter spikes thrown out from the centre
    b.fillStyle = 'rgb(110,0,0)';
    for (let i = 0; i < 9 + v * 2; i++){
      const a = R() * Math.PI * 2, l = T * (0.32 + R() * 0.16), w = 0.08 + R() * 0.1;
      b.beginPath(); b.moveTo(cx + Math.cos(a - w) * T * 0.2, cy + Math.sin(a - w) * T * 0.2);
      b.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); b.lineTo(cx + Math.cos(a + w) * T * 0.2, cy + Math.sin(a + w) * T * 0.2); b.fill();
      if (R() < 0.6){ b.beginPath(); b.arc(cx + Math.cos(a) * l * 1.08, cy + Math.sin(a) * l * 1.08, 1.5 + R() * 3, 0, 7); b.fill(); }
    }
    b.fillStyle = 'rgb(150,0,0)'; blob(b, cx, cy, T * 0.34, 0.2, 18);
    b.fillStyle = 'rgb(200,0,0)'; blob(b, cx, cy, T * 0.25, 0.22, 16);
    b.fillStyle = 'rgb(240,0,0)'; blob(b, cx, cy, T * 0.14, 0.3, 12);
    b.restore();
    // ember cracks: a few wandering lines out of the core, plus a hot centre
    e.save(); e.beginPath(); e.rect(ox, oy, T, T); e.clip();
    e.strokeStyle = '#fff'; e.lineCap = 'round';
    for (let i = 0; i < 6; i++){
      let x = cx, y = cy, h = R() * Math.PI * 2;
      e.lineWidth = 2.2; e.beginPath(); e.moveTo(x, y);
      for (let k = 0; k < 4; k++){ h += (R() - 0.5) * 1.2; const l = T * (0.04 + R() * 0.05); x += Math.cos(h) * l; y += Math.sin(h) * l; e.lineTo(x, y); }
      e.stroke();
    }
    e.fillStyle = '#fff'; blob(e, cx, cy, T * 0.07, 0.3, 10);
    e.restore();
  }
  const bd = b.getImageData(0, 0, N, N).data, ed = e.getImageData(0, 0, N, N).data;
  const out = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++){ out[i*4] = bd[i*4]; out[i*4+1] = ed[i*4] * (bd[i*4] > 180 ? 1 : 0); out[i*4+3] = 255; }   // embers only inside the black core
  const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  t.flipY = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const state = new Float32Array(MAX * 4);   // per mark: strength, heat, atlas tile u, v
const life = new Float32Array(MAX).fill(-1), peak = new Float32Array(MAX), hot = new Float32Array(MAX);
let head = 0;

const mat = new THREE.MeshBasicMaterial({ color: 0x0e0a08, map: paintAtlas(), transparent: true, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
mat.onBeforeCompile = sh => {
  sh.vertexShader = 'attribute vec4 aState;\nvarying vec4 vState;\n' + sh.vertexShader
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = vMapUv * 0.5 + aState.zw;\n  vState = aState;');
  sh.fragmentShader = 'varying vec4 vState;\n' + sh.fragmentShader
    .replace('#include <map_fragment>', `
      vec4 sc = texture2D(map, vMapUv);
      float burn = sc.r * vState.x;
      if (burn < 0.01) discard;
      float glow = clamp(sc.g * vState.y * 1.6, 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(2.6, 0.75, 0.2), glow);   // over 1.0, so the bloom catches it
      diffuseColor.a *= max(burn, glow);`);
};
mat.customProgramCacheKey = () => 'scorch';

const geo = new THREE.PlaneGeometry(1, 1);
const aState = new THREE.InstancedBufferAttribute(state, 4);
aState.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute('aState', aState);
const mesh = new THREE.InstancedMesh(geo, mat, MAX);
mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.userData.noAO = true;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
scene.add(mesh);


/* leave a mark. pos: where it struck; size: diameter in metres; normal: the surface's facing (default the floor);
   o.heat: 0..1 how much it glows when fresh; o.strength: how dark it is */
export function scorch(pos, size, normal = UP, o = {}){
  const i = head; head = (head + 1) % MAX;
  _q.setFromUnitVectors(Z, normal);
  _q2.setFromAxisAngle(Z, rand(0, Math.PI * 2));
  _q.multiply(_q2);
  _p.copy(pos).addScaledVector(normal, 0.02);
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(size, size, 1)));
  mesh.instanceMatrix.needsUpdate = true;
  const v = Math.floor(Math.random() * 4);
  life[i] = 0; peak[i] = o.strength ?? 0.85; hot[i] = o.heat ?? 1;
  state[i*4+2] = (v % 2) * 0.5; state[i*4+3] = (v >> 1) * 0.5;
}

/* a mark on the ground under a blast: on the floor, or on top of the crate/step it landed on (kept inside its edges).
   Nothing if the blast went off well clear of any surface (an air burst) */
export function scorchGround(pos, size, o = {}){
  const g = groundAt(pos.x, pos.z, pos.y + 0.5);
  if (pos.y - g > (o.reach ?? 1.6)) return;
  let s = size;
  if (g > 0){
    for (const c of solids){
      if (c.mound || c.h !== g) continue;
      const room = c.box ? Math.min(c.hx - Math.abs(pos.x - c.x), c.hz - Math.abs(pos.z - c.z)) : c.r - Math.hypot(pos.x - c.x, pos.z - c.z);
      if (room >= 0){ s = Math.min(s, room * 2); break; }
    }
    if (s < 0.4) return;
  }
  scorch(_p.set(pos.x, g, pos.z), s, UP, o);
}

/* a bolt burn on the face of a solid it struck (pillar, wall, crate) */
const _n = new THREE.Vector3(), _w = new THREE.Vector3();
export function scorchSolid(c, pos, size = 0.7){
  if (c.box){
    const dx = (pos.x - c.x) / c.hx, dz = (pos.z - c.z) / c.hz;
    if (Math.abs(dx) > Math.abs(dz)){ _n.set(Math.sign(dx), 0, 0); _w.set(c.x + c.hx * Math.sign(dx), pos.y, pos.z); }
    else { _n.set(0, 0, Math.sign(dz)); _w.set(pos.x, pos.y, c.z + c.hz * Math.sign(dz)); }
  } else {
    _n.set(pos.x - c.x, 0, pos.z - c.z);
    if (_n.lengthSq() < 1e-6) return;
    _n.normalize(); _w.set(c.x + _n.x * c.r, pos.y, c.z + _n.z * c.r);
  }
  scorch(_w, size, _n, { heat: 0.7, strength: 0.75 });
}

/* a new arena: wipe every mark */
export function clearScorch(){
  life.fill(-1); state.fill(0); aState.needsUpdate = true;
  for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
  mesh.instanceMatrix.needsUpdate = true;
}

export function updateScorch(dt){
  let any = false;
  for (let i = 0; i < MAX; i++){
    if (life[i] < 0) continue;
    life[i] += dt; any = true;
    const t = life[i];
    if (t > HOLD + FADE){ life[i] = -1; state[i*4] = state[i*4+1] = 0; continue; }
    state[i*4] = peak[i] * (t < HOLD ? 1 : 1 - (t - HOLD) / FADE) * Math.min(1, t * 12);   // snaps in, then fades
    state[i*4+1] = hot[i] * Math.max(0, 1 - t / COOL) ** 1.5;
  }
  if (any) aState.needsUpdate = true;
}
