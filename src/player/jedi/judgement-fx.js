// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Force Judgement lightning visuals.

import * as THREE from 'three';
import { CFG } from '../../data/config.js';
import { scene } from '../../engine/renderer.js';
import { rand } from '../../utils.js';
import { G, player } from '../../state.js';

/* ---------- Force Judgement lightning visuals (pooled lines) ---------- */
const judgeLines = [];
export function ensureJudgeLines(){
  if (judgeLines.length) return;
  for (let i = 0; i < CFG.abilities.judge.targets; i++){
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9*3), 3));
    const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x6effa0, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending }));   // Electric Judgment burns GREEN
    ln.visible = false;
    ln.frustumCulled = false;
    scene.add(ln);
    judgeLines.push(ln);
  }
}
const JHAND = new THREE.Vector3();
export function updateJudgeFX(){
  const active = player.judgeT > 0 && G.mode === 'play';
  for (let i = 0; i < judgeLines.length; i++){
    const ln = judgeLines[i];
    const tgt = active ? player.judgeTargets[i] : null;
    if (!tgt){ ln.visible = false; continue; }
    ln.visible = true;
    player.rig.armL.el.updateWorldMatrix(true, false);
    JHAND.set(0, -0.33, 0);
    player.rig.armL.el.localToWorld(JHAND);
    const a = ln.geometry.attributes.position;
    for (let s = 0; s < 9; s++){
      const k = s / 8;
      const jx = s === 0 || s === 8 ? 0 : rand(-0.35, 0.35);
      a.setXYZ(s,
        JHAND.x + (tgt.x - JHAND.x)*k + jx,
        JHAND.y + (tgt.y - JHAND.y)*k + (s === 0 || s === 8 ? 0 : rand(-0.3, 0.3)),
        JHAND.z + (tgt.z - JHAND.z)*k + (s === 0 || s === 8 ? 0 : rand(-0.35, 0.35)));
    }
    a.needsUpdate = true;
    ln.material.opacity = rand(0.5, 1);
  }
}
