// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Verlet cloth for the heroes' loose fabric (the Jedi's robe panels, the hem of the Mando's cape).
//
// Each piece is a small grid of particles simulated in world space: the top row is pinned to a rig joint, the rest
// falls under gravity, keeps its weave with distance constraints, and is pushed out of the legs and hips (capsules
// on the rig). So the robe swings because the body moved, the legs kick it on a stride, it piles up and slides off
// the thighs in a crouch, and it settles by itself when the hero stops. animation.js steps it every frame after
// the pose is set (stepCloth); the model lab drapes it once over a still pose (settleCloth).
//
// It renders as a thin closed slab (front, back and edge), so the Ink outline hull works on it like any mesh.

import * as THREE from 'three';

const H = 1 / 120;           // fixed simulation step
const ITER = 6;              // constraint passes per step
const GRAVITY = -9.8;
const DAMP = 0.985;          // velocity kept per step (air drag)
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();

/* opts: anchor (rig joint the top row is pinned to), W×Hn grid, rest(u, v) → [x, y, z] in the anchor's frame
   (u -1..1 across, v 0..1 down), thick (slab thickness), capsules [[jointA, jointB, radius]] in model units,
   root (vis: the mesh lives under it so it hides with the hero) */
export function makeCloth({ anchor, W, Hn, rest, thick, capsules, root, material, outlineMaterial, slack = 0.5, pull = 0.004 }){
  const n = W * Hn;
  const local = [];
  for (let r = 0; r < Hn; r++) for (let c = 0; c < W; c++)
    local.push(new THREE.Vector3(...rest(c / (W - 1) * 2 - 1, r / (Hn - 1))));
  const pos = new Float32Array(n * 3), prev = new Float32Array(n * 3);

  // constraints from the rest shape (model units; scaled to world on reset): weave, shear, and a tether to the
  // pinned top of each column so the cloth can't stretch out of shape however hard it's whipped
  const links = [];
  const link = (a, b, k) => links.push([a, b, local[a].distanceTo(local[b]), k]);
  for (let r = 0; r < Hn; r++) for (let c = 0; c < W; c++){
    const i = r * W + c;
    if (c < W - 1) link(i, i + 1, 1);
    if (r < Hn - 1) link(i, i + W, 1);
    if (c < W - 1 && r < Hn - 1){ link(i, i + W + 1, 0.5); link(i + 1, i + W, 0.5); }
    if (r < Hn - 2) link(i, i + 2 * W, 0.3);   // bend: a little body, so it folds rather than crumples
  }
  const tether = local.map((p, i) => p.distanceTo(local[i % W]));
  // how far each particle may stray from where the animated body would carry it: a little at the belt, more at the
  // hem. A heavy robe swings and flares but never flies out flat like a flag.
  const reach = tether.map(t => t * slack + 0.01);

  // slab geometry: front layer, back layer, then the edge walls between them
  const geo = new THREE.BufferGeometry();
  const vpos = new Float32Array(n * 2 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(vpos, 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let r = 0; r < Hn - 1; r++) for (let c = 0; c < W - 1; c++){
    const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
    idx.push(a, b, d, b, e, d);                       // front faces +normal
    idx.push(n + a, n + d, n + b, n + b, n + d, n + e);   // back faces −normal
  }
  const ring = [];   // the boundary, walked once round the grid
  for (let c = 0; c < W; c++) ring.push(c);
  for (let r = 1; r < Hn; r++) ring.push(r * W + W - 1);
  for (let c = W - 2; c >= 0; c--) ring.push((Hn - 1) * W + c);
  for (let r = Hn - 2; r > 0; r--) ring.push(r * W);
  for (let k = 0; k < ring.length; k++){
    const u = ring[k], v = ring[(k + 1) % ring.length];
    idx.push(u, n + u, v, v, n + u, n + v);
  }
  geo.setIndex(idx);

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true; mesh.frustumCulled = false;
  root.add(mesh);
  if (outlineMaterial){ const hull = new THREE.Mesh(geo, outlineMaterial); hull.frustumCulled = false; mesh.add(hull); }

  const C = { mesh, anchor, root, W, Hn, n, local, pos, prev, links, tether, reach, pull, thick, capsules, acc: 0, live: false, wound: null, scale: 1 };
  resetCloth(C);
  return C;
}

function pinned(C, i, out){ return out.copy(C.local[i]).applyMatrix4(C.anchor.matrixWorld); }

// put every particle back on its rest shape, at rest (spawn, hero switch, a teleport)
export function resetCloth(C){
  C.root.updateWorldMatrix(true, true);
  C.scale = new THREE.Vector3().setFromMatrixScale(C.anchor.matrixWorld).y;
  for (let i = 0; i < C.n; i++){
    pinned(C, i, _p);
    C.pos[i*3] = C.prev[i*3] = _p.x; C.pos[i*3+1] = C.prev[i*3+1] = _p.y; C.pos[i*3+2] = C.prev[i*3+2] = _p.z;
  }
  C.acc = 0;
  writeMesh(C);
}

function collide(C, segs){
  const P = C.pos;
  for (let i = C.W; i < C.n; i++){
    _p.set(P[i*3], P[i*3+1], P[i*3+2]);
    for (const [a, b, r] of segs){
      // closest point on the capsule's bone
      _b.subVectors(b, a);
      const t = Math.max(0, Math.min(1, _p.clone().sub(a).dot(_b) / Math.max(1e-6, _b.lengthSq())));
      _a.copy(a).addScaledVector(_b, t);
      const dx = _p.x - _a.x, dy = _p.y - _a.y, dz = _p.z - _a.z, d = Math.hypot(dx, dy, dz);
      if (d < r && d > 1e-6){ const k = r / d; _p.set(_a.x + dx * k, _a.y + dy * k, _a.z + dz * k); }
    }
    P[i*3] = _p.x; P[i*3+1] = _p.y; P[i*3+2] = _p.z;
  }
}

function step(C, segs, floor){
  const P = C.pos, Q = C.prev, W = C.W;
  for (let i = 0; i < C.n; i++){
    if (i < W){ pinned(C, i, _p); Q[i*3] = P[i*3]; Q[i*3+1] = P[i*3+1]; Q[i*3+2] = P[i*3+2]; P[i*3] = _p.x; P[i*3+1] = _p.y; P[i*3+2] = _p.z; continue; }
    for (let k = 0; k < 3; k++){
      const v = (P[i*3+k] - Q[i*3+k]) * DAMP;
      Q[i*3+k] = P[i*3+k];
      P[i*3+k] += v + (k === 1 ? GRAVITY * H * H : 0);
    }
  }
  const s = C.scale;
  for (let it = 0; it < ITER; it++){
    for (const [a, b, len, k] of C.links){
      const dx = P[b*3] - P[a*3], dy = P[b*3+1] - P[a*3+1], dz = P[b*3+2] - P[a*3+2];
      const d = Math.hypot(dx, dy, dz) || 1e-6, diff = (d - len * s) / d * k;
      const wa = a < W ? 0 : (b < W ? 1 : 0.5), wb = b < W ? 0 : (a < W ? 1 : 0.5);
      P[a*3] += dx * diff * wa; P[a*3+1] += dy * diff * wa; P[a*3+2] += dz * diff * wa;
      P[b*3] -= dx * diff * wb; P[b*3+1] -= dy * diff * wb; P[b*3+2] -= dz * diff * wb;
    }
    for (let i = W; i < C.n; i++){
      const t = i % W, max = C.tether[i] * s * 1.03;
      const dx = P[i*3] - P[t*3], dy = P[i*3+1] - P[t*3+1], dz = P[i*3+2] - P[t*3+2], d = Math.hypot(dx, dy, dz);
      if (d > max){ const k = max / d; P[i*3] = P[t*3] + dx * k; P[i*3+1] = P[t*3+1] + dy * k; P[i*3+2] = P[t*3+2] + dz * k; }
    }
    for (let i = W; i < C.n; i++){
      pinned(C, i, _a);
      if (it === 0){ const k = C.pull; P[i*3] += (_a.x - P[i*3]) * k; P[i*3+1] += (_a.y - P[i*3+1]) * k; P[i*3+2] += (_a.z - P[i*3+2]) * k; }
      const dx = P[i*3] - _a.x, dy = P[i*3+1] - _a.y, dz = P[i*3+2] - _a.z, d = Math.hypot(dx, dy, dz), max = C.reach[i] * s;
      if (d > max){ const k = max / d; P[i*3] = _a.x + dx * k; P[i*3+1] = _a.y + dy * k; P[i*3+2] = _a.z + dz * k; }
    }
    collide(C, segs);
  }
  for (let i = W; i < C.n; i++) if (P[i*3+1] < floor) P[i*3+1] = floor;
}

// the slab: each particle's normal from its neighbours, front and back layers half a thickness either side
const _n = new THREE.Vector3(), _du = new THREE.Vector3(), _dv = new THREE.Vector3();
function writeMesh(C){
  const P = C.pos, W = C.W, Hn = C.Hn, n = C.n, V = C.mesh.geometry.attributes.position.array;
  C.root.updateWorldMatrix(true, false);
  _inv.copy(C.root.matrixWorld).invert();
  const at = (c, r) => { c = Math.max(0, Math.min(W - 1, c)); r = Math.max(0, Math.min(Hn - 1, r)); const i = (r * W + c) * 3; return _p.set(P[i], P[i+1], P[i+2]); };
  const half = C.thick * 0.5 * C.scale;
  for (let r = 0; r < Hn; r++) for (let c = 0; c < W; c++){
    _du.copy(at(c + 1, r)).sub(at(c - 1, r));
    _dv.copy(at(c, r + 1)).sub(at(c, r - 1));
    _n.crossVectors(_du, _dv).normalize();
    const i = r * W + c;
    _a.set(P[i*3], P[i*3+1], P[i*3+2]);
    _b.copy(_a).addScaledVector(_n, half).applyMatrix4(_inv);
    V[i*3] = _b.x; V[i*3+1] = _b.y; V[i*3+2] = _b.z;
    _b.copy(_a).addScaledVector(_n, -half).applyMatrix4(_inv);
    V[(n+i)*3] = _b.x; V[(n+i)*3+1] = _b.y; V[(n+i)*3+2] = _b.z;
  }
  const g = C.mesh.geometry;
  g.attributes.position.needsUpdate = true;
  const sign = Math.sign(C.root.matrixWorld.determinant());
  if (C.wound !== sign){
    // the faces were wound for the world; the model is mirrored (after it's dressed), so whenever the mirroring
    // changes, check which way they face in its frame
    g.computeVertexNormals();
    const nr = g.attributes.normal, mid = Math.floor(Hn / 2) * W + Math.floor(W / 2);
    _a.set(V[mid*3] - V[(n+mid)*3], V[mid*3+1] - V[(n+mid)*3+1], V[mid*3+2] - V[(n+mid)*3+2]);   // back → front
    if (_a.dot(_b.fromBufferAttribute(nr, mid)) < 0){
      const ix = g.index.array;
      for (let k = 0; k < ix.length; k += 3){ const t = ix[k+1]; ix[k+1] = ix[k+2]; ix[k+2] = t; }
      g.index.needsUpdate = true;
    }
    C.wound = sign;
  }
  g.computeVertexNormals();
}

// shown = the mesh and the joint it hangs from are both visible (the Jedi's robe hides with the skirt)
function shown(C){
  if (!C.mesh.visible) return false;
  for (let o = C.anchor; o && o !== C.root; o = o.parent) if (!o.visible) return false;
  return true;
}

function capsules(C){
  return C.capsules.map(([a, b, r]) => [
    new THREE.Vector3().setFromMatrixPosition(a.matrixWorld),
    new THREE.Vector3().setFromMatrixPosition(b.matrixWorld),
    r * C.scale,
  ]);
}

/* advance every visible cloth on `target` (player) by dt; `floor` = world height the hem can't sink under */
export function stepCloth(target, dt, floor = -Infinity){
  if (!target.cloth) return;
  let updated = false;
  for (const C of target.cloth){
    if (!shown(C)){ C.live = false; continue; }
    if (!updated){ target.vis.updateWorldMatrix(true, true); updated = true; }
    pinned(C, 0, _p);
    const jump = Math.hypot(_p.x - C.pos[0], _p.y - C.pos[1], _p.z - C.pos[2]);
    if (!C.live || jump > 1.5){ resetCloth(C); C.live = true; continue; }   // shown again, or teleported
    const segs = capsules(C);
    C.acc = Math.min(C.acc + dt, 4 * H);
    while (C.acc >= H){ step(C, segs, floor); C.acc -= H; }
    writeMesh(C);
  }
}

/* drape every visible cloth over the current (still) pose: the model lab's posed figures */
export function settleCloth(target, seconds = 1.5){
  if (!target.cloth) return;
  target.vis.updateWorldMatrix(true, true);
  for (const C of target.cloth){
    if (!shown(C)) continue;
    resetCloth(C);
    const segs = capsules(C);
    for (let t = 0; t < seconds; t += H) step(C, segs, -Infinity);
    writeMesh(C);
    C.live = true;
  }
}
