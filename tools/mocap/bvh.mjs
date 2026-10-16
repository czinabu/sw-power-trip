// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Minimal BVH reader for the mocap converter: the joint tree, its channels and every frame's world positions and
// orientations (forward kinematics). Node only; not part of the game build.

import * as THREE from 'three';

export function parseBVH(text){
  const tok = text.split(/\s+/).filter(Boolean);
  let i = 0;
  const joints = [];
  function joint(parent){
    const name = tok[i++];
    const j = { name, parent, offset: null, channels: [], children: [] };
    joints.push(j);
    i++;   // {
    while (tok[i] !== '}'){
      const t = tok[i++];
      if (t === 'OFFSET'){ j.offset = new THREE.Vector3(+tok[i], +tok[i+1], +tok[i+2]); i += 3; }
      else if (t === 'CHANNELS'){ const n = +tok[i++]; j.channels = tok.slice(i, i + n); i += n; }
      else if (t === 'JOINT'){ j.children.push(joint(j)); }
      else if (t === 'End'){ i++; i++; i++; j.end = new THREE.Vector3(+tok[i], +tok[i+1], +tok[i+2]); i += 3; i++; }
    }
    i++;   // }
    return j;
  }
  while (tok[i] !== 'ROOT') i++;
  i++;
  const root = joint(null);
  while (tok[i] !== 'Frames:') i++;
  const nFrames = +tok[i + 1];
  const dt = +tok[i + 4];
  i += 5;
  const nCh = joints.reduce((a, j) => a + j.channels.length, 0);
  const frames = [];
  for (let f = 0; f < nFrames; f++){ frames.push(tok.slice(i, i + nCh).map(Number)); i += nCh; }
  return { root, joints, frames, dt };
}

/* world position + orientation of every joint on frame f: { name: { p: Vector3, q: Quaternion } } */
export function pose(bvh, f){
  const vals = bvh.frames[f];
  let k = 0;
  const out = {};
  const e = new THREE.Euler(), qa = new THREE.Quaternion();
  for (const j of bvh.joints){
    const pos = j.offset.clone();
    const q = new THREE.Quaternion();
    for (const c of j.channels){
      const v = vals[k++];
      if (c === 'Xposition') pos.x = v; else if (c === 'Yposition') pos.y = v; else if (c === 'Zposition') pos.z = v;
      else {
        const axis = c[0] === 'X' ? new THREE.Vector3(1,0,0) : c[0] === 'Y' ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
        q.multiply(qa.setFromAxisAngle(axis, v * Math.PI / 180));   // channels apply in listed order (intrinsic)
      }
    }
    const P = j.parent ? out[j.parent.name] : null;
    const wq = P ? P.q.clone().multiply(q) : q;
    const wp = P ? P.p.clone().add(pos.clone().applyQuaternion(P.q)) : pos;
    out[j.name] = { p: wp, q: wq, joint: j };
  }
  return out;
}
