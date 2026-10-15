// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Force Judgement lightning visuals.

import * as THREE from 'three';
import { CFG } from '../../data/config.js';
import { scene, camera } from '../../engine/renderer.js';
import { rand } from '../../utils.js';
import { G, player } from '../../state.js';
import { inkSprite } from '../../fx/ink.js';

/* ---------- Force Judgement lightning visuals (pooled ribbons) ----------
   Each arc is a camera-facing ribbon drawn in Ink bands: a white-hot core, the green body and a dark ink edge, with a
   side fork. The jagged path re-rolls on a stepped beat (not every frame), so the bolt snaps between shapes like
   hand-drawn lightning instead of fizzing. */
const SEG = 10, FORK = 5;
const MAIN_W = 0.17, FORK_W = 0.1;
const COLOR = 0x38f070;   // Electric Judgement burns GREEN
const mat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(COLOR) }, uCore: { value: new THREE.Color(0xd8ffe2).multiplyScalar(1.5) },
              uInk: { value: new THREE.Color(0x07060a) }, uOpacity: { value: 1 } },
  vertexShader: /* glsl */`
    attribute float across; varying float vA;
    void main(){ vA = across; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor, uCore, uInk; uniform float uOpacity; varying float vA;
    void main(){
      float a = abs(vA);
      vec3 col = a < 0.2 ? uCore : (a < 0.7 ? uColor : uInk);
      gl_FragColor = vec4(col, uOpacity * (a < 0.72 ? 1.0 : 0.85));
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
});
const judgeLines = [];
function makeRibbon(){
  const nv = (SEG + 1 + FORK + 1) * 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  const across = new Float32Array(nv);
  for (let i = 0; i < nv; i++) across[i] = i % 2 ? 1 : -1;
  geo.setAttribute('across', new THREE.BufferAttribute(across, 1));
  const idx = [];
  const strip = (start, n) => { for (let i = 0; i < n; i++){ const a = (start + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } };
  strip(0, SEG); strip(SEG + 1, FORK);
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false; m.visible = false; m.renderOrder = 2;
  m.userData = { pts: Array.from({ length: SEG + 1 + FORK + 1 }, () => new THREE.Vector3()), beat: -1 };
  scene.add(m);
  return m;
}
export function ensureJudgeLines(){
  if (judgeLines.length) return;
  for (let i = 0; i < CFG.abilities.judge.targets + 3; i++) judgeLines.push(makeRibbon());   // +3 for the Storm upgrade
}
const JHAND = new THREE.Vector3(), _seg = new THREE.Vector3(), _toCam = new THREE.Vector3(), _side = new THREE.Vector3();
// write a camera-facing ribbon through pts[from .. from+n] into the position buffer
function ribbon(pos, pts, from, n, width){
  for (let i = 0; i <= n; i++){
    const p = pts[from + i];
    const a = pts[from + Math.max(0, i - 1)], b = pts[from + Math.min(n, i + 1)];
    _seg.subVectors(b, a);
    _toCam.subVectors(camera.position, p);
    _side.crossVectors(_seg, _toCam).normalize().multiplyScalar(width * (i === n ? 0.35 : 1));   // tapers to a point
    const v = (from + i) * 2;
    pos.setXYZ(v,     p.x - _side.x, p.y - _side.y, p.z - _side.z);
    pos.setXYZ(v + 1, p.x + _side.x, p.y + _side.y, p.z + _side.z);
  }
}
export function updateJudgeFX(){
  const active = player.judgeT > 0 && G.mode === 'play';
  const beat = Math.floor(G.gt / 0.055);   // the stepped re-roll
  for (let i = 0; i < judgeLines.length; i++){
    const ln = judgeLines[i];
    const tgt = active ? player.judgeTargets[i] : null;
    if (!tgt){ ln.visible = false; continue; }
    ln.visible = true;
    player.rig.armL.el.updateWorldMatrix(true, false);
    JHAND.set(0, -0.33, 0);
    player.rig.armL.el.localToWorld(JHAND);
    const u = ln.userData, P = u.pts;
    if (u.beat !== beat){
      u.beat = beat;
      for (let s = 0; s <= SEG; s++){
        const k = s / SEG, j = s === 0 || s === SEG ? 0 : 1;
        P[s].set(JHAND.x + (tgt.x - JHAND.x)*k + rand(-0.42, 0.42)*j,
                 JHAND.y + (tgt.y - JHAND.y)*k + rand(-0.36, 0.36)*j,
                 JHAND.z + (tgt.z - JHAND.z)*k + rand(-0.42, 0.42)*j);
      }
      // a fork splits off part-way along and stabs out to the side
      const at = 3 + Math.floor(Math.random() * 4);
      P[SEG + 1].copy(P[at]);
      for (let s = 1; s <= FORK; s++){
        const prev = P[SEG + s];
        P[SEG + 1 + s].set(prev.x + (P[at + 1].x - P[at].x) * 0.7 + rand(-0.35, 0.35), prev.y + rand(-0.3, 0.2),
                           prev.z + (P[at + 1].z - P[at].z) * 0.7 + rand(-0.35, 0.35));
      }
      // a cel crackle where it bites
      inkSprite({ pos: tgt, shape: 'star', points: 5, sharp: 0.12, color: COLOR, size: [0.7, 1.1], life: 0.07, steps: 1, coreW: 0.4 });
      if (i === 0) inkSprite({ pos: JHAND, shape: 'star', points: 6, sharp: 0.15, color: COLOR, size: [0.5, 0.7], life: 0.06, steps: 1, coreW: 0.45 });
    } else P[0].copy(JHAND);   // keep the root in the palm between re-rolls
    const pos = ln.geometry.attributes.position;
    ribbon(pos, P, 0, SEG, MAIN_W);
    ribbon(pos, P, SEG + 1, FORK, FORK_W);
    pos.needsUpdate = true;
  }
}
