// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Enemy hitboxes: one body shape per model that every attack tests against (bolts, blasts, abilities, the blade).

import * as THREE from 'three';
import { HITBOX } from '../data/bodyshape.js';

/* A foe's body is a stack of upright elliptic cylinders (legs, torso, head) in the model's OWN space: they turn, scale
   (elites included) and fall over with it, because every test happens in the foe's local frame. A shot that clips a
   shoulder hits; one that passes between the legs and the arm doesn't. */
const INV = new THREE.Matrix4(), A = new THREE.Vector3(), B = new THREE.Vector3();
const DOWN = { knockdown: 1, getup: 1, ragdoll: 1 };

export const partsOf = e => HITBOX[e.t.model] || HITBOX.default;
export const scaleOf = e => e.group.scale.x || 1;

// world → this foe's model space (the group sits in the scene root, so its matrix is its world matrix)
function toLocal(e, v, out){
  e.group.updateMatrix();
  INV.copy(e.group.matrix).invert();
  return out.copy(v).applyMatrix4(INV);
}

// the widest half-width of the torso, in world units: how far from its centre a foe's body reaches (melee and AOE reach)
export function bodyRadius(e){
  const P = partsOf(e), t = P[1] || P[0];
  return (DOWN[e.state] ? P.downR : Math.max(t.hx, t.hz)) * scaleOf(e);
}
// the top of the head above its feet, in world units
export const bodyHeight = e => partsOf(e)[partsOf(e).length - 1].y1 * scaleOf(e);
// where a hit on a part of it shows (the centre of the head, the chest)
export function headPos(e, out = new THREE.Vector3()){
  const P = partsOf(e), h = P.find(p => p.head) || P[P.length - 1];
  out.set(0, (h.y0 + h.y1) / 2, 0);
  e.group.updateMatrix();
  return out.applyMatrix4(e.group.matrix);
}
export function chestPos(e, out = new THREE.Vector3()){
  const P = partsOf(e), t = P[1] || P[0];
  out.set(0, t.y0 + (t.y1 - t.y0) * 0.55, 0);
  e.group.updateMatrix();
  return out.applyMatrix4(e.group.matrix);
}

/* Sweep a projectile from `a` to `b` (world) with radius `pad`: the first point it touches the body, as
   { t: 0..1 along a→b, part, head } — or null. Fast bolts can't skip through a body between two frames. */
export function sweepHit(e, a, b, pad = 0){
  toLocal(e, a, A); toLocal(e, b, B);
  const s = scaleOf(e), pl = pad / s;
  const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
  let best = null;
  for (const p of partsOf(e)){
    const hx = p.hx + pl, hz = p.hz + pl, y0 = p.y0 - pl, y1 = p.y1 + pl;
    // the segment against the ellipse (x/hx)² + (z/hz)² ≤ 1 …
    const ax = A.x / hx, az = A.z / hz, ux = dx / hx, uz = dz / hz;
    const qa = ux * ux + uz * uz, qb = 2 * (ax * ux + az * uz), qc = ax * ax + az * az - 1;
    let t0, t1;
    if (qa < 1e-9){ if (qc > 0) continue; t0 = 0; t1 = 1; }
    else {
      const disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const r = Math.sqrt(disc);
      t0 = (-qb - r) / (2 * qa); t1 = (-qb + r) / (2 * qa);
    }
    // … clipped to the part's height band
    if (Math.abs(dy) < 1e-9){ if (A.y < y0 || A.y > y1) continue; }
    else {
      let s0 = (y0 - A.y) / dy, s1 = (y1 - A.y) / dy;
      if (s0 > s1){ const k = s0; s0 = s1; s1 = k; }
      t0 = Math.max(t0, s0); t1 = Math.min(t1, s1);
    }
    t0 = Math.max(t0, 0); t1 = Math.min(t1, 1);
    if (t0 > t1) continue;
    if (!best || t0 < best.t) best = { t: t0, part: p, head: !!p.head };
  }
  return best;
}

// is world point `v` inside the body (grown by `pad`)? → the part it's in, or null
export function pointHit(e, v, pad = 0){
  toLocal(e, v, A);
  const pl = pad / scaleOf(e);
  for (const p of partsOf(e)){
    if (A.y < p.y0 - pl || A.y > p.y1 + pl) continue;
    const x = A.x / (p.hx + pl), z = A.z / (p.hz + pl);
    if (x * x + z * z <= 1) return p;
  }
  return null;
}

// distance (world units) from point `v` to the nearest point of the body: 0 inside. A blast reaches a foe when its
// radius reaches the body, not the foe's feet.
export function distToBody(e, v){
  toLocal(e, v, A);
  let best = Infinity;
  for (const p of partsOf(e)){
    const k = Math.hypot(A.x / p.hx, A.z / p.hz);
    const dh = k <= 1 ? 0 : Math.hypot(A.x - A.x / k, A.z - A.z / k);
    const dv = Math.max(0, p.y0 - A.y, A.y - p.y1);
    best = Math.min(best, Math.hypot(dh, dv));
  }
  return best * scaleOf(e);
}

/* A level, horizontal reach test for cones and rings (pushes, slashes, the flame): is any of the body within `range`
   of `from`, inside the cone of half-angle acos(cosLim) around `f` (omit f for a full ring)? The body's width widens
   the cone the closer it is, so a brute's shoulder in the arc counts even when its centre is just outside. */
export function inReach(e, from, range, f, cosLim){
  const p = e.group.position, x = p.x - from.x, z = p.z - from.z, d = Math.hypot(x, z), r = bodyRadius(e);
  if (d - r > range) return false;
  if (!f || d <= r) return true;
  const half = Math.acos(Math.max(-1, Math.min(1, cosLim)));
  const ang = Math.acos(Math.max(-1, Math.min(1, (x * f.x + z * f.z) / (d * Math.hypot(f.x, f.z) || 1))));
  return ang <= half + Math.asin(Math.min(1, r / d));
}

/* DEBUG — ?hitbox in the URL draws every foe's hitbox as a wireframe that rides along with it */
const SHOW = typeof location !== 'undefined' && /[?&]hitbox\b/.test(location.search);
const WIRE = new THREE.MeshBasicMaterial({ color: 0x40ff90, wireframe: true, transparent: true, opacity: 0.55, depthTest: false });
const HEAD = new THREE.MeshBasicMaterial({ color: 0xffd24a, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
export function attachHitboxDebug(e){
  if (!SHOW) return;
  for (const p of partsOf(e)){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), p.head ? HEAD : WIRE);
    m.scale.set(p.hx, p.y1 - p.y0, p.hz); m.position.y = (p.y0 + p.y1) / 2; m.renderOrder = 999;
    e.group.add(m);
  }
}
