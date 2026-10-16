// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Skinned chains: one continuous lofted surface along a run of rig joints (hip → knee, shoulder → elbow,
// hips → torso → chest) that bends at each joint instead of showing a gap between two rigid pieces.
//
// A chain is described like a limb: rings at a distance t along it (metres from the first joint, growing down a
// limb or up a spine), and the joints it bends at (`at`, the same distances). Around each joint the rings are packed
// closer and the skin weight hands over from one bone to the next across ±blend, so the bend is a smooth curve.

import { loft } from './shapes.js';

/* rings for one segment of a chain, written like limb(): [t, w, d, dz] with t a fraction of the segment's `len`,
   starting `from` metres down the chain */
export const seg = (len, rings, from = 0) => rings.map(([t, w, d, dz = 0]) => ({ t: from + t * len, w, d, z: dz }));

// round a chiselled profile off (one Chaikin pass): twice the corners at half the angle, so it shades smooth
export function rounded(profile){
  const out = [];
  for (let i = 0; i < profile.length; i++){
    const [ax, az] = profile[i], [bx, bz] = profile[(i + 1) % profile.length];
    out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
  }
  return out;
}

const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

/* how much each bone carries a point t along the chain: bone i owns the stretch between joints at[i-1] and at[i],
   handing over to the next bone across at[i] ± blend */
export function chainWeights(t, at, blend){
  const out = [];
  let prev = 1;
  for (let i = 0; i <= at.length; i++){
    const s = i < at.length ? smooth(at[i] - blend, at[i] + blend, t) : 0;
    if (prev - s > 1e-4) out.push([i, prev - s]);
    prev = s;
  }
  const sum = out.reduce((a, [, w]) => a + w, 0);
  for (const o of out) o[1] /= sum;
  return out;
}

/* the chain's geometry in its first joint's frame: rings at y = dir·t (dir -1 down a limb, +1 up a spine), with
   extra rings packed round each joint so the bend has edges to curve with */
export function chainGeo(rings, at, blend, profile, dir){
  const src = [...rings].sort((a, b) => a.t - b.t);
  const ts = src.map(r => r.t);
  for (const j of at) for (let k = -3; k <= 3; k++) ts.push(j + k * blend / 2);
  ts.sort((a, b) => a - b);
  const lo = src[0].t, hi = src[src.length - 1].t;
  const keep = [];
  for (const t of ts){
    if (t < lo - 1e-6 || t > hi + 1e-6) continue;
    if (keep.length && t - keep[keep.length - 1] < 0.008) continue;
    keep.push(t);
  }
  const at_ = t => {   // linear between the authored rings, so packing rings in never changes the shape
    let i = 0;
    while (i < src.length - 2 && src[i + 1].t < t) i++;
    const a = src[i], b = src[i + 1] || a, u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    const l = (p, q) => (p || 0) + ((q || 0) - (p || 0)) * u;
    return { y: dir * t, w: l(a.w, b.w), d: l(a.d, b.d), x: l(a.x, b.x), z: l(a.z, b.z) };
  };
  const secs = keep.map(at_);
  if (dir < 0) secs.reverse();   // loft wants them bottom → top
  return loft(secs, profile);
}
