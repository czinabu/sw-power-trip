// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Chiseled geometry kit for the hero models: lofted prisms (limbs, torsos, helmets) and bevelled plates (armor).
// Everything is built along +Y from cross-sections, so a limb is described the way you'd sketch it:
// "narrow at the knee, widest at the calf, pinched at the ankle".

import * as THREE from 'three';

/* ---------- cross-section profiles (unit space, x right, z forward; listed counter-clockwise from above) ---------- */

// a square with its corners cut — c = 0 is a box, c = 0.5 is an even octagon
export function chamfer(c = 0.35){
  const a = 1 - c;
  return [[1,-a],[1,a],[a,1],[-a,1],[-1,a],[-1,-a],[-a,-1],[a,-1]];
}

// a regular n-gon (rot in radians); used for chiseled "cylinders"
export function ngon(n = 6, rot = 0){
  const pts = [];
  for (let i = 0; i < n; i++){ const a = rot + i / n * Math.PI * 2; pts.push([Math.cos(a), Math.sin(a)]); }
  return pts;
}

// sharp ridge running down the FRONT (+z), flat back: shins, forearms, thighs, sleeves
export const KEEL = [[0,1],[0.72,0.55],[1,-0.15],[0.62,-1],[-0.62,-1],[-1,-0.15],[-0.72,0.55]];
// ridge on the BACK (calves, back of the skull)
export const KEEL_BACK = KEEL.map(([x, z]) => [x, -z]).reverse();
// wide flat front, angled flanks: chests, pelvis, belts
export const SHIELD = [[0.7,1],[1,0.35],[1,-0.45],[0.6,-1],[-0.6,-1],[-1,-0.45],[-1,0.35],[-0.7,1]];
// a head: flat-ish face, angled cheeks, rounded-off back
export const HEAD = [[0,1],[0.55,0.86],[0.92,0.35],[1,-0.25],[0.72,-0.82],[0,-1],[-0.72,-0.82],[-1,-0.25],[-0.92,0.35],[-0.55,0.86]];

/* ---------- loft: stack cross-sections into a closed prism ----------
   sections: [{ y, w, d, x?, z?, p? }] bottom → top. w/d are full width/depth. p (optional) overrides the profile
   for that ring (must have the same point count). Returns an INDEXED geometry with smooth normals; styles
   decide whether to facet it (flatShading) or crease it. */
export function loft(sections, profile = chamfer(), { capTop = true, capBottom = true } = {}){
  const n = profile.length;
  const pos = [], idx = [];
  for (const s of sections){
    const prof = s.p || profile;
    for (const [px, pz] of prof) pos.push((s.x || 0) + px * s.w * 0.5, s.y, (s.z || 0) + pz * s.d * 0.5);
  }
  const rings = sections.length;
  for (let r = 0; r < rings - 1; r++){
    for (let i = 0; i < n; i++){
      const a = r*n + i, b = r*n + (i+1)%n, c = (r+1)*n + i, d = (r+1)*n + (i+1)%n;
      idx.push(a, c, b, b, c, d);
    }
  }
  const cap = (r, up) => {
    const s = sections[r], ci = pos.length / 3;
    pos.push(s.x || 0, s.y, s.z || 0);
    for (let i = 0; i < n; i++){
      const a = r*n + i, b = r*n + (i+1)%n;
      if (up) idx.push(ci, a, b); else idx.push(ci, b, a);
    }
  };
  if (capBottom) cap(0, false);
  if (capTop) cap(rings - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  fixWinding(g, sections);
  g.computeVertexNormals();
  return g;
}

// profiles may be listed either way round — flip the triangles if the first side face points inward
function fixWinding(g, sections){
  const p = g.attributes.position, ix = g.index.array;
  const v = i => new THREE.Vector3().fromBufferAttribute(p, ix[i]);
  const a = v(0), b = v(1), c = v(2);
  const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const s = sections[0];
  const out = a.clone().sub(new THREE.Vector3(s.x || 0, a.y, s.z || 0));
  if (nrm.dot(out) < 0){
    for (let i = 0; i < ix.length; i += 3){ const t = ix[i+1]; ix[i+1] = ix[i+2]; ix[i+2] = t; }
  }
}

// a limb segment hanging DOWN from its joint: rings at fractions of len, each [t, w, d] (t 0 = joint, 1 = far end)
export function limb(len, rings, profile = KEEL, ox = 0, oz = 0){
  const secs = rings.map(([t, w, d, dz = 0]) => ({ y: -t * len, w, d, x: ox, z: oz + dz })).reverse();
  return loft(secs, profile);
}

/* ---------- plate: an extruded 2D outline with a chamfered edge — armor plates, pauldrons, visors, blades ----------
   outline: [[x,y], ...] in the plate's own plane (extruded along +z, centred on z = 0). */
export function plate(outline, depth = 0.04, bevel = 0.012){
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// a chiseled box (chamfered loft between two equal rings) — the workhorse for blocks that shouldn't read as boxes
export function block(w, h, d, c = 0.3, taper = 1){
  return loft([{ y: -h/2, w, d }, { y: h/2, w: w * taper, d: d * taper }], chamfer(c));
}

// a sharp wedge / shard: a pointed tip, used for spikes, finials, beard, nose
export function shard(w, h, d){
  return loft([{ y: 0, w, d }, { y: h * 0.35, w: w * 1.1, d: d * 1.1 }, { y: h, w: 0.001, d: 0.001 }], ngon(4, Math.PI/4));
}
