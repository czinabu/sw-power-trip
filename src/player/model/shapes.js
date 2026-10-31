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
/* DETAIL: how smooth every lofted part is (heroes, NPCs, bosses: everything built here).
   rings: up to this many extra rings per segment, on a Catmull-Rom curve through the authored rings, so a calf or a
          helmet's crown bulges in a curve instead of a straight chamfer. Added only where the curve actually leaves
          the straight line (more than EPS per ring), so straight limbs, hilts and plates cost nothing extra.
   round: Chaikin passes on every profile under 24 corners (chamfered boxes, KEEL limbs, hilts, the rounded helms), so a
          cross-section reads as a pressed curve. Finer profiles (already rounded twice) are left alone.
   The authored rings stay exactly where they were, so joints, sizes and hitboxes don't move. Lab: ?rings=&round= */
export const DETAIL = { rings: 3, round: 1 };
const EPS = 0.004;
const chaikin = pr => { const o = []; for (let i = 0; i < pr.length; i++){ const [ax, az] = pr[i], [bx, bz] = pr[(i+1) % pr.length]; o.push([ax*0.75+bx*0.25, az*0.75+bz*0.25], [ax*0.25+bx*0.75, az*0.25+bz*0.75]); } return o; };
const cr = (a, b, c, d, t) => 0.5 * ((2*b) + (-a + c)*t + (2*a - 5*b + 4*c - d)*t*t + (-a + 3*b - 3*c + d)*t*t*t);
function densify(sec){
  const out = [];
  for (let i = 0; i < sec.length - 1; i++){
    const a = sec[Math.max(0, i-1)], b = sec[i], c = sec[i+1], d = sec[Math.min(sec.length-1, i+2)];
    out.push(b);
    if (Math.abs(c.y - b.y) < 1e-4) continue;   // a step (a lip, a rim): keep it sharp
    const f = (key, t) => cr(a[key] || 0, b[key] || 0, c[key] || 0, d[key] || 0, t);
    // how far the curve bows off the straight line at mid-segment (half-width / half-depth / offset)
    let dev = 0;
    for (const key of ['w', 'd', 'x', 'z']){
      const k = key === 'w' || key === 'd' ? 0.5 : 1;
      dev = Math.max(dev, Math.abs(f(key, 0.5) - ((b[key] || 0) + (c[key] || 0)) / 2) * k);
    }
    const n = Math.min(DETAIL.rings, Math.floor(dev / EPS));
    for (let j = 1; j <= n; j++){
      const t = j / (n + 1);
      out.push({ y: b.y + (c.y - b.y) * t, w: Math.max(0.001, f('w', t)), d: Math.max(0.001, f('d', t)), x: f('x', t), z: f('z', t),
        p: b.p && c.p ? b.p.map((q, m) => [q[0] + (c.p[m][0]-q[0])*t, q[1] + (c.p[m][1]-q[1])*t]) : (b.p || c.p) });
    }
  }
  out.push(sec[sec.length - 1]);
  return out;
}
export function loft(sections, profile = chamfer(), { capTop = true, capBottom = true } = {}){
  if (DETAIL.rings && sections.length > 2) sections = densify(sections);
  for (let r = 0; r < DETAIL.round && profile.length < 24; r++){ profile = chaikin(profile); sections = sections.map(s => s.p ? { ...s, p: chaikin(s.p) } : s); }
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
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: DETAIL.round ? 3 : 1, curveSegments: 1,   // 3: a rolled edge that catches the light
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

/* ---------- gripHand: a gloved hand closed round a grip (a hilt, a haft, a rifle's grip, a shield's handle) ----------
   In the grip's own frame: the grip runs along y through the origin, its cross-section an ellipse rx × rz (half-widths).
   Four fingers curl round it from the palm side (-z) the long way, each a tube with a rounded tip, stacked down the
   grip (the little finger a touch thinner); the thumb closes over them the other way at the top, and the palm sits
   on -z. One geometry, so a hand costs nothing per finger once baked. */
export function gripHand({ rx = 0.025, rz = 0.025, t = 0.0125 } = {}){
  const parts = [];
  const ring = (y, r, a0, a1, rad, seg = 9) => {
    const pts = [];
    for (let i = 0; i <= seg; i++){
      const a = a0 + (a1 - a0) * i / seg;
      pts.push(new THREE.Vector3(Math.sin(a) * (rx + r), y, -Math.cos(a) * (rz + r)));
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, rad, 6, false));
    const tip = new THREE.SphereGeometry(rad, 6, 4); tip.translate(pts[seg].x, pts[seg].y, pts[seg].z);
    parts.push(tip);
  };
  const step = t * 1.9;
  for (let i = 0; i < 4; i++){
    const rad = t * (i === 3 ? 0.82 : 1);
    ring(step * (1.5 - i) - t * 0.4, rad * 0.9, 0.55, Math.PI * 2 - 0.75, rad);
  }
  ring(step * 1.5 + t * 1.5, t * 1.05, -0.35, -Math.PI * 0.95, t * 1.05, 6);   // the thumb, closing over the top
  // the palm: a rounded pad on -z, as tall as the fingers, its far edge where they leave it
  const palm = new THREE.SphereGeometry(1, 8, 6);
  palm.scale(rx + t * 1.6, step * 2.4, t * 1.8); palm.translate(0, step * 0.15, -(rz + t * 1.4));
  parts.push(palm);
  return mergeAll(parts);
}
function mergeAll(gs){
  // a tiny local merge (positions + normals + index) so this file needs no addons
  let n = 0; const pos = [], nor = [], idx = [];
  for (const g of gs){
    const p = g.attributes.position, q = g.attributes.normal, ix = g.index;
    for (let i = 0; i < p.count; i++){ pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(q.getX(i), q.getY(i), q.getZ(i)); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + n);
    n += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
