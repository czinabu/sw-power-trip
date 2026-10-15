// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Lightsaber swing trail.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { player } from '../state.js';
import { stance } from '../player/helpers.js';

/* ---------- saber motion trail ---------- */
const trailGeo = new THREE.BufferGeometry();
export const trailMesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({
  color: 0x55ccff, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true }));
trailMesh.frustumCulled = false;
trailMesh.visible = false;
scene.add(trailMesh);
const trailPts = [];
const TRMAX = 0.17;   // trail lifetime — longer reads the arc more clearly
const TRB = new THREE.Vector3(), TRT = new THREE.Vector3();
export function updateTrail(dt){
  for (const p of trailPts) p.age += dt;
  while (trailPts.length && trailPts[0].age > TRMAX) trailPts.shift();
  // follow whichever blade is actually swinging — the Jedi saber OR the Mando darksaber — so the ribbon
  // traces the real arc (and thus the correct side) for both heroes
  const bladeNode = (player.saberHand && player.saberHand.visible) ? player.saberHand
                  : (player.darksaberMesh && player.darksaberMesh.visible) ? player.darksaberMesh : null;
  if (player.atkT > 0 && bladeNode){
    const tipY = bladeNode === player.saberHand ? 1.85 : 1.3;   // the darksaber blade is a touch shorter
    // sample the Jedi blade in its own root so the trail follows a reverse grip too
    const sampleNode = bladeNode === player.saberHand ? (player.saberBladeRoot || bladeNode) : bladeNode;
    sampleNode.updateWorldMatrix(true, false);
    TRB.set(0, 0.1, 0);    sampleNode.localToWorld(TRB);
    TRT.set(0, tipY, 0);   sampleNode.localToWorld(TRT);   // sample hilt→tip of the blade
    trailPts.push({ b: TRB.clone(), t: TRT.clone(), age: 0 });
    if (trailPts.length > 24) trailPts.shift();
    trailMesh.material.color.setHex((player.swing && player.swing.riposte) ? 0xffe27a
      : (bladeNode === player.darksaberMesh ? 0xc9a6ff : stance().blade));   // a riposte cuts a brilliant GOLD arc
  }
  if (trailPts.length < 2){ trailMesh.visible = false; return; }
  trailMesh.visible = true;
  const n = trailPts.length;
  const pos = new Float32Array((n-1)*18);
  const col = new Float32Array((n-1)*18);
  // intensity per sample: newest = bright, oldest = faded — gives the ribbon a tapering arc
  const inten = (p) => { const f = Math.max(0, 1 - p.age / TRMAX); return f * f; };
  let o = 0, c = 0;
  for (let i = 0; i < n-1; i++){
    const a = trailPts[i], b = trailPts[i+1];
    const ia = inten(a) * (i / (n-1)) , ib = inten(b) * ((i+1) / (n-1));   // also brighten toward the leading edge
    pos[o++]=a.b.x; pos[o++]=a.b.y; pos[o++]=a.b.z;
    pos[o++]=a.t.x; pos[o++]=a.t.y; pos[o++]=a.t.z;
    pos[o++]=b.t.x; pos[o++]=b.t.y; pos[o++]=b.t.z;
    pos[o++]=a.b.x; pos[o++]=a.b.y; pos[o++]=a.b.z;
    pos[o++]=b.t.x; pos[o++]=b.t.y; pos[o++]=b.t.z;
    pos[o++]=b.b.x; pos[o++]=b.b.y; pos[o++]=b.b.z;
    // grayscale vertex intensities (material.color tints them to the blade color)
    col[c++]=ia; col[c++]=ia; col[c++]=ia;
    col[c++]=ia; col[c++]=ia; col[c++]=ia;
    col[c++]=ib; col[c++]=ib; col[c++]=ib;
    col[c++]=ia; col[c++]=ia; col[c++]=ia;
    col[c++]=ib; col[c++]=ib; col[c++]=ib;
    col[c++]=ib; col[c++]=ib; col[c++]=ib;
  }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
