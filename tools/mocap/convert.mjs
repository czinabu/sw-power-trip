// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mocap converter (dev only): turns CMU motion-capture BVH clips into the compact gait cycles in
// src/data/mocap.js. Usage: node tools/mocap/convert.mjs <bvh folder>
//
// It keeps what the procedural rig can use rather than raw joint rotations: one steady stride cycle per clip
// (left heel strike to the next), the path each ankle takes relative to its hip, the foot's roll, the pelvis'
// bob/sway/surge and rotation, and the chest's counter-twist, all in leg lengths and radians in the body's own frame
// (+x right, +z forward), so the clips fit any leg length and the game's foot locks and ground IK still apply.
//
// The data is from the CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), free for research and
// commercial use. BVH conversion by B. Hahne.

import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { parseBVH, pose } from './bvh.mjs';

const N = 40;   // samples per cycle
const CLIPS = [
  // name, file, what it is
  ['walk', '08_01', 'subject 8: walk'],
  ['jog',  '16_35', 'subject 16: run/jog'],
  ['run',  '09_01', 'subject 9: run'],
  ['sprint', '16_46', 'subject 16: run/jog (fast)'],
];

const JUMP = ['13_11', 'subject 13: forward jump'];
const NJ = 24;   // samples across the flight, and across the landing
// acrobatics: name, file, rough frame range to look in, the axis it turns about (som = somersault, roll = cartwheel)
const MOVES = [
  ['back',  '88_01',  [0, 200],   'som',  'subject 88: backflip'],
  ['front', '90_14',  [400, 700], 'som',  'subject 90: front handspring'],
  ['side',  '90_08',  [150, 300], 'roll', 'subject 90: side flip'],
  ['roll',  '127_23', [0, 240],   'som',  'subject 127: run, dive over, roll'],
];

// sword cuts: every strike in these swordplay clips, lined up on the moment the hand is fastest (contact)
const SWORD = [['02_08', 'subject 2: swordplay'], ['02_09', 'subject 2: swordplay']];
const NS = 19, SW_WIN = 0.45;   // samples across a cut, seconds either side of contact

const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const r3 = v => Math.round(v * 1000) / 1000;
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const ang = a => Math.atan2(Math.sin(a), Math.cos(a));

function analyse(file){
  const bvh = parseBVH(fs.readFileSync(file, 'utf8'));
  const J = n => bvh.joints.find(j => j.name === n);
  const L = J('LeftLeg').offset.length() + J('LeftFoot').offset.length();
  const P = bvh.frames.map((_, f) => pose(bvh, f)).slice(1);   // frame 0 is the calibration T-pose
  const n = P.length, dt = bvh.dt;
  const hv = f => { const a = P[Math.max(0, f - 2)].Hips.p, b = P[Math.min(n - 1, f + 2)].Hips.p; return Math.hypot(b.x - a.x, b.z - a.z) / ((Math.min(n - 1, f + 2) - Math.max(0, f - 2)) * dt); };
  // contacts: the ankle or the ball of the foot low and (nearly) still in the world
  const contact = side => {
    const A = side + 'Foot', T = side + 'ToeBase';
    const aMin = Math.min(...P.map(p => p[A].p.y)), tMin = Math.min(...P.map(p => p[T].p.y));
    return P.map((p, f) => {
      const q = P[Math.min(n - 1, f + 1)], o = P[Math.max(0, f - 1)];
      const sp = j => Math.hypot(q[j].p.x - o[j].p.x, q[j].p.z - o[j].p.z) / (2 * dt);
      const low = Math.min((p[A].p.y - aMin) / L, (p[T].p.y - tMin) / L) < 0.06;
      return low && Math.min(sp(A), sp(T)) < 0.5 * hv(f) + 0.3 * L;
    });
  };
  const cL = contact('Left'), cR = contact('Right');
  const strikes = c => c.map((v, f) => v && f >= 3 && !c[f-1] && !c[f-2] && !c[f-3] ? f : -1).filter(f => f >= 0);
  const sL = strikes(cL), sR = strikes(cR);
  // the steadiest full cycle of either foot (strike to its next strike): speed closest to the clip's median.
  // Short clips may hold only one full cycle, and it may start on the right foot
  const med = median(P.map((_, f) => hv(f)));
  let best = null;
  for (const [lead, st] of [['Left', sL], ['Right', sR]]) for (let k = 0; k + 1 < st.length; k++){
    const a = st[k], b = st[k + 1];
    if ((b - a) * dt > 2) continue;
    const d = Math.hypot(P[b].Hips.p.x - P[a].Hips.p.x, P[b].Hips.p.z - P[a].Hips.p.z) / ((b - a) * dt);
    if (!best || Math.abs(d - med) < Math.abs(best.v - med)) best = { a, b, v: d, lead };
  }
  if (!best) throw new Error(`${file}: no full stride cycle (strikes L ${sL} R ${sR})`);
  const { a, b } = best, T = (b - a) * dt;
  const disp = P[b].Hips.p.clone().sub(P[a].Hips.p); disp.y = 0;
  const fwd = disp.clone().normalize(), right = fwd.clone().cross(UP).normalize();
  const v = disp.length() / T;
  // the cycle's moving frame: origin glides along at the average speed from the first strike's hip position
  const origin = t => P[a].Hips.p.clone().setY(0).addScaledVector(fwd, v * t);
  const frameAt = u => a + u * (b - a);   // fractional frame for cycle phase u (0..1)
  const lerpP = (fu, j) => { const f0 = Math.floor(fu), f1 = Math.min(n - 1, f0 + 1), w = fu - f0; return P[f0][j].p.clone().lerp(P[f1][j].p, w); };
  const local = (p, t) => { const d = p.clone().sub(origin(t)); return { f: d.dot(fwd), r: d.dot(right), y: p.y }; };

  // feet: each foot's own cycle starts at its own strike
  // phase of each foot's strike within the cycle (the lead foot's is 0)
  const offOf = st => { const f = st.find(f => f > a && f < b); return f != null ? (f - a) / (b - a) : 0.5; };
  const lOff = best.lead === 'Left' ? 0 : offOf(sL), rOff = best.lead === 'Right' ? 0 : offOf(sR);
  const hipMean = side => { let s = 0, l = 0; for (let k = 0; k < N; k++){ const u = k / N, q = local(lerpP(frameAt(u), side + 'UpLeg'), u * T); s += q.f; l += q.r; } return { f: s / N, r: l / N }; };
  const foot = (side, off, c) => {
    const hm = hipMean(side);
    const A = side + 'Foot', B = side + 'ToeBase';
    const raw = [];
    for (let k = 0; k < N; k++){
      const u = (k / N + off) % 1, fu = frameAt(u), t = u * T;
      const an = local(lerpP(fu, A), t), ba = lerpP(fu, B), ap = lerpP(fu, A);
      const toeVec = ba.clone().sub(ap), horiz = Math.hypot(toeVec.dot(fwd), toeVec.dot(right));
      raw.push({ s: (an.f - hm.f) / L, x: (an.r - hm.r) / L, y: an.y, pitch: Math.atan2(-toeVec.y, horiz), c: c[Math.round(fu)] });
    }
    const stance = raw.filter(q => q.c);
    const yStance = median(stance.map(q => q.y)), pFlat = median(stance.map(q => q.pitch));
    const duty = raw.filter(q => q.c).length;   // (counted, not run-length: a walk's heel-to-toe roll can flicker)
    return {
      yStance,
      duty: r3(duty / N),
      s: raw.map(q => r3(q.s)), x: raw.map(q => r3(q.x)),
      h: raw.map(q => r3(Math.max(0, (q.y - yStance) / L))), toe: raw.map(q => r3(q.pitch - pFlat)),
    };
  };
  // pelvis + chest orientation from joint lines: yaw + = left side forward, roll + = left side up, pitch + = top forward
  const orient = (fu, lj, rj, lo, hi) => {
    const l = lerpP(fu, lj), r = lerpP(fu, rj), across = l.clone().sub(r);   // right → left
    const yaw = Math.atan2(across.dot(fwd), -across.dot(right));
    const roll = Math.atan2(across.y, Math.hypot(across.dot(fwd), across.dot(right)));
    const up = lerpP(fu, hi).sub(lerpP(fu, lo));
    const pitch = Math.atan2(up.dot(fwd), up.y);
    return { yaw, roll, pitch };
  };
  const pel = [], chest = [];
  for (let k = 0; k < N; k++){
    const u = (k / N + lOff) % 1, fu = frameAt(u), h = local(lerpP(fu, 'Hips'), u * T);   // from the LEFT strike
    const po = orient(fu, 'LeftUpLeg', 'RightUpLeg', 'Hips', 'Spine');
    const co = orient(fu, 'LeftArm', 'RightArm', 'Spine1', 'Neck');
    pel.push({ ...po, f: h.f / L, r: h.r / L, y: h.y / L });
    chest.push({ yaw: ang(co.yaw - po.yaw), roll: ang(co.roll - po.roll), pitch: ang(co.pitch - po.pitch) });
  }
  // how high the hip joints ride above the planted ankle, on average: a runner's legs are never straight
  let hy = 0;
  for (let k = 0; k < N; k++){ const fu = frameAt(k / N); hy += (lerpP(fu, 'LeftUpLeg').y + lerpP(fu, 'RightUpLeg').y) / 2; }
  const fL = foot('Left', lOff, cL), fR = foot('Right', rOff, cR);
  const hipH = (hy / N - (fL.yStance + fR.yStance) / 2) / L;
  delete fL.yStance; delete fR.yStance;
  const centred = (arr, key) => { const m = arr.reduce((s, q) => s + q[key], 0) / arr.length; return arr.map(q => r3(q[key] - m)); };
  return {
    L, v: v / L, stride: disp.length() / L, T, frames: [a, b], rOff,
    left: fL, right: fR, lOff, hipH,
    pelvis: { y: centred(pel, 'y'), sway: centred(pel, 'r'), surge: centred(pel, 'f'), yaw: centred(pel, 'yaw'), roll: centred(pel, 'roll'), pitch: centred(pel, 'pitch') },
    chest: { yaw: centred(chest, 'yaw'), roll: centred(chest, 'roll'), pitch: centred(chest, 'pitch') },
  };
}

/* A jump: the legs through the flight (take-off to touchdown) and the knees soaking the landing. Leg angles are the
   rig's: thigh swing from hanging straight down (− = forward), knee fold (+ = bent), relative to the clip's own
   standing pose. The landing is the hips' drop below standing (normalised to its deepest) and the pelvis tipping
   forward, from touchdown until he's back up. */
function analyseJump(file){
  const bvh = parseBVH(fs.readFileSync(file, 'utf8'));
  const J = n => bvh.joints.find(j => j.name === n);
  const L = J('LeftLeg').offset.length() + J('LeftFoot').offset.length();
  const F = bvh.frames.length, P = [];
  for (let f = 1; f < F; f++) P.push(pose(bvh, f));
  const floor = Math.min(...P.map(q => Math.min(q.LeftFoot.p.y, q.LeftToeBase.p.y, q.RightFoot.p.y, q.RightToeBase.p.y)));
  const footUp = (q, s) => (Math.min(q[s + 'Foot'].p.y, q[s + 'ToeBase'].p.y) - floor) / L;
  const air = P.map(q => footUp(q, 'Left') > 0.04 && footUp(q, 'Right') > 0.04);
  const off = air.indexOf(true), down = air.indexOf(false, off);
  const angles = q => {
    const p = n => q[n].p.clone();
    const across = p('LeftUpLeg').sub(p('RightUpLeg')).normalize();
    const up0 = p('Spine').sub(p('Hips')), up = up0.sub(across.clone().multiplyScalar(up0.dot(across))).normalize();
    const back = up.clone().cross(across).normalize();   // (points backward: + swing = behind, like the rig's hip.x)
    const a = v => Math.atan2(v.dot(back), -v.dot(up));
    const leg = s => { const th = a(p(s + 'Leg').sub(p(s + 'UpLeg'))), sh = a(p(s + 'Foot').sub(p(s + 'Leg'))); return [th, sh - th]; };
    const tr = p('Neck').sub(p('Hips'));
    return { L: leg('Left'), R: leg('Right'), pitch: -Math.atan2(tr.dot(back), tr.y), hip: q.Hips.p.y / L };
  };
  const A = P.map(angles);
  const stand = A.slice(0, 30), avg = f => stand.reduce((s, x) => s + f(x), 0) / stand.length;
  const s0 = { lt: avg(x => x.L[0]), lk: avg(x => x.L[1]), rt: avg(x => x.R[0]), rk: avg(x => x.R[1]), pitch: avg(x => x.pitch), hip: avg(x => x.hip) };
  const at = (k0, k1, u) => { const x = k0 + (k1 - k0) * u, i = Math.min(Math.floor(x), k1 - 1), t = x - i; return [A[i], A[i + 1], t]; };
  const mix = (u, k0, k1, f) => { const [a, b, t] = at(k0, k1, u); return f(a) + (f(b) - f(a)) * t; };
  const flight = { lt: [], lk: [], rt: [], rk: [] };
  for (let k = 0; k < NJ; k++){
    const u = k / (NJ - 1);
    flight.lt.push(r3(mix(u, off, down, x => x.L[0]) - s0.lt)); flight.lk.push(r3(mix(u, off, down, x => x.L[1]) - s0.lk));
    flight.rt.push(r3(mix(u, off, down, x => x.R[0]) - s0.rt)); flight.rk.push(r3(mix(u, off, down, x => x.R[1]) - s0.rk));
  }
  // the landing lasts until the hips are back within 3% of their deepest drop of standing height
  let deep = down; for (let f = down; f < A.length; f++) if (A[f].hip < A[deep].hip) deep = f;
  const depth = s0.hip - A[deep].hip;
  let end = deep; while (end < A.length - 1 && s0.hip - A[end].hip > depth * 0.03) end++;
  const land = { drop: [], pitch: [] };
  for (let k = 0; k < NJ; k++){
    const u = k / (NJ - 1);
    land.drop.push(r3(Math.max(0, s0.hip - mix(u, down, end, x => x.hip)) / depth));
    land.pitch.push(r3(mix(u, down, end, x => x.pitch) - s0.pitch));
  }
  return { flightT: (down - off) * bvh.dt, rise: (A[off + Math.round((down - off) / 2)].hip - s0.hip), depth, landT: (end - down) * bvh.dt, deepAt: (deep - down) / (end - down), flight, land };
}

/* A flip or roll: how far through its turn the whole body is (0..1, head-over-feet axis, so a crouch doesn't count as
   turning) and the legs, both across the move from the first ~6% of the turn to the last ~6% (the crouch before and the settle after happen on the ground). Legs are the rig's angles
   relative to the clip's T-pose (straight legs, like the rig at rest): thigh swing (− = forward), knee fold, and the
   legs' spread (+ = apart). */
function analyseMove(file, [a, b], axis){
  const bvh = parseBVH(fs.readFileSync(file, 'utf8'));
  const P = [];
  for (let f = 0; f < bvh.frames.length; f++) P.push(pose(bvh, f));
  const mid = (q, x, y) => q[x].p.clone().add(q[y].p).multiplyScalar(0.5);
  const body = q => {   // the whole body's frame: across the hips, up from the feet to the head
    const ac = q.LeftUpLeg.p.clone().sub(q.RightUpLeg.p).normalize();
    const up = q.Head.p.clone().sub(mid(q, 'LeftFoot', 'RightFoot')); up.sub(ac.clone().multiplyScalar(up.dot(ac))).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ac, up, ac.clone().cross(up).normalize()));
  };
  const lo = Math.max(1, a), hi = Math.min(b, P.length - 1);
  const b0 = body(P[lo]), ax = new THREE.Vector3(axis === 'som' ? 1 : 0, 0, axis === 'som' ? 0 : 1).applyQuaternion(b0);
  ax.y = 0; ax.normalize();
  const rot = [0];
  let prev = b0, A = 0;
  for (let f = lo + 1; f <= hi; f++){   // integrate the turn about the starting axis (no wrap-around at upside down)
    const cur = body(P[f]), d = cur.clone().multiply(prev.clone().invert());
    if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
    const an = 2 * Math.acos(Math.min(1, d.w)), sn = Math.sin(an / 2);
    if (sn > 1e-6) A += an * (d.x * ax.x + d.y * ax.y + d.z * ax.z) / sn;
    prev = cur; rot.push(A);
  }
  const total = rot[rot.length - 1], frac = rot.map(r => r / total);
  const half = frac.findIndex(x => x > 0.5);
  let s0 = half; while (s0 > 0 && frac[s0] > 0.06) s0--;
  let s1 = half; while (s1 < frac.length - 1 && frac[s1] < 0.94) s1++;
  const angles = q => {
    const p = n => q[n].p.clone();
    const across = p('LeftUpLeg').sub(p('RightUpLeg')).normalize();
    const up0 = p('Spine').sub(p('Hips')), up = up0.sub(across.clone().multiplyScalar(up0.dot(across))).normalize();
    const back = up.clone().cross(across).normalize();
    const sw = v => Math.atan2(v.dot(back), -v.dot(up));
    const leg = (s, out) => {
      const th = p(s + 'Leg').sub(p(s + 'UpLeg')), sh = p(s + 'Foot').sub(p(s + 'Leg'));
      return [sw(th), sw(sh) - sw(th), Math.atan2(th.dot(across) * out, th.length())];
    };
    return { L: leg('Left', 1), R: leg('Right', -1) };
  };
  const T = angles(P[0]);   // the T-pose
  const legs = { lt: [], lk: [], rt: [], rk: [], sp: [] }, e = [];
  for (let k = 0; k < NJ; k++){
    const x = s0 + (s1 - s0) * k / (NJ - 1), i = Math.min(Math.floor(x), s1 - 1), t = x - i;
    const lerp = f => f(i) + (f(i + 1) - f(i)) * t;
    e.push(r3(Math.min(1, Math.max(0, lerp(j => frac[j])))));
    const an = j => angles(P[lo + j]);
    const A0 = an(i), A1 = an(Math.min(i + 1, frac.length - 1));
    const m = (a, b) => a + (b - a) * t;
    legs.lt.push(r3(m(A0.L[0], A1.L[0]) - T.L[0])); legs.lk.push(r3(m(A0.L[1], A1.L[1]) - T.L[1]));
    legs.rt.push(r3(m(A0.R[0], A1.R[0]) - T.R[0])); legs.rk.push(r3(m(A0.R[1], A1.R[1]) - T.R[1]));
    legs.sp.push(r3((m(A0.L[2], A1.L[2]) - T.L[2] + m(A0.R[2], A1.R[2]) - T.R[2]) / 2));
  }
  return { turn: total / (2 * Math.PI), T: (s1 - s0) * bvh.dt, e, legs };
}

/* Sword cuts: how the hips and shoulders move through a cut, averaged over every strike (a hand-speed peak) in the
   clips, from SW_WIN seconds before contact to SW_WIN after. pel: the pelvis' turn toward the cut, as a fraction of
   its whole turn over the window (it leads: already turning well before contact and still going after); chest: the
   shoulders' twist against the pelvis toward the cut, as a fraction of its largest (wound back behind the hips
   before contact, whipping ahead of them after). */
function analyseSwords(files){
  const strikes = [];
  for (const file of files){
    const bvh = parseBVH(fs.readFileSync(file, 'utf8'));
    const J = n => bvh.joints.find(j => j.name === n);
    const L = J('LeftLeg').offset.length() + J('LeftFoot').offset.length();
    const P = [];
    for (let f = 1; f < bvh.frames.length; f++) P.push(pose(bvh, f));
    const dt = bvh.dt, W = Math.round(SW_WIN / dt);
    const sp = P.map((_, i) => {
      if (i < 2 || i > P.length - 3) return 0;
      const a = P[i - 2].RightHand.p.clone().sub(P[i - 2].Hips.p), b = P[i + 2].RightHand.p.clone().sub(P[i + 2].Hips.p);
      return b.sub(a).length() / (4 * dt) / L;
    });
    const across = (q, a, b) => q[a].p.clone().sub(q[b].p);
    const yaw = v => Math.atan2(-v.z, v.x);
    for (let c = W; c < P.length - W; c++){
      if (sp[c] < 2 || sp[c] < Math.max(...sp.slice(c - 30, c + 31))) continue;   // a strike: the fastest hand around
      const q0 = P[c - W], ac0 = across(q0, 'LeftUpLeg', 'RightUpLeg').setY(0).normalize();
      const dir = Math.sign(P[c + 3].RightHand.p.clone().sub(P[c - 3].RightHand.p).dot(ac0)) || 1;   // + = cutting to the left
      const pel0 = yaw(across(q0, 'LeftUpLeg', 'RightUpLeg'));
      const st = { pel: [], chest: [] };
      for (let k = 0; k < NS; k++){
        const q = P[c - W + Math.round(2 * W * k / (NS - 1))], pel = yaw(across(q, 'LeftUpLeg', 'RightUpLeg'));
        st.pel.push(ang(pel - pel0) * dir);
        st.chest.push(ang(yaw(across(q, 'LeftArm', 'RightArm')) - pel) * dir);
      }
      strikes.push(st);
    }
  }
  const mean = key => [...Array(NS)].map((_, k) => strikes.reduce((s, x) => s + x[key][k], 0) / strikes.length);
  const pel = mean('pel'), chest = mean('chest');
  const pEnd = pel[NS - 1], cMax = Math.max(...chest.map(Math.abs));
  return { n: strikes.length, turn: pEnd, twist: cMax, pel: pel.map(v => r3(v / pEnd)), chest: chest.map(v => r3(v / cMax)) };
}

const dir = process.argv[2];
const out = {};
for (const [name, id, desc] of CLIPS){
  const c = analyse(path.join(dir, id + '.bvh'));
  console.log(`${name.padEnd(6)} ${id}  ${c.v.toFixed(2)} leg/s  stride ${c.stride.toFixed(2)}  hipH ${c.hipH.toFixed(3)}  cycle ${c.T.toFixed(2)}s  duty L ${c.left.duty} R ${c.right.duty}  strikes L ${c.lOff.toFixed(2)} R ${c.rOff.toFixed(2)}  frames ${c.frames}`);
  out[name] = { src: `CMU ${id} (${desc})`, speed: r3(c.v), stride: r3(c.stride), hipH: r3(c.hipH), left: c.left, right: c.right, pelvis: c.pelvis, chest: c.chest };
}
const jc = analyseJump(path.join(dir, JUMP[0] + '.bvh'));
console.log(`jump   ${JUMP[0]}  flight ${jc.flightT.toFixed(2)}s  rise ${jc.rise.toFixed(2)}  landing ${jc.landT.toFixed(2)}s, deepest ${jc.depth.toFixed(2)} at ${jc.deepAt.toFixed(2)}`);
const moves = {};
for (const [name, id, range, axis, desc] of MOVES){
  const m = analyseMove(path.join(dir, id + '.bvh'), range, axis);
  console.log(`${name.padEnd(6)} ${id}  turn ${m.turn.toFixed(2)}  over ${m.T.toFixed(2)}s  e ${m.e.filter((_, i) => i % 4 === 0).join(' ')}`);
  moves[name] = { src: `CMU ${id} (${desc})`, dur: r3(m.T), e: m.e, legs: m.legs };
}
const sw = analyseSwords(SWORD.map(([id]) => path.join(dir, id + '.bvh')));
console.log(`sword  ${SWORD.map(([id]) => id).join('+')}  ${sw.n} cuts  pelvis turn ${sw.turn.toFixed(2)}  shoulder twist ±${sw.twist.toFixed(2)}`);
const sword = { src: SWORD.map(([id, d]) => `CMU ${id} (${d})`).join(', '), win: SW_WIN, pel: sw.pel, chest: sw.chest };
const jump = { src: `CMU ${JUMP[0]} (${JUMP[1]})`, flight: jc.flight, land: { dur: r3(jc.landT), depth: r3(jc.depth), ...jc.land } };
const js = `// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// GENERATED by tools/mocap/convert.mjs: do not edit by hand. Motion-captured stride cycles (see player/anim/mocap.js).
// One cycle per clip, ${N} samples, starting at each foot's own heel strike. Distances in leg lengths, angles in
// radians, in the body's frame (+x right, +z forward). speed: leg lengths per second; stride: per cycle (two steps).
//
// The data used here was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF
// EIA-0196217. (CMU Graphics Lab Motion Capture Database; BVH conversion by B. Hahne.)

export const MOCAP_N = ${N};
export const MOCAP = ${JSON.stringify(out)};

// One jump, ${NJ} samples across the flight (take-off to touchdown) and ${NJ} across the landing (touchdown to standing).
// flight: thigh swing (lt/rt, − = forward) and knee fold (lk/rk) relative to standing; land: the hips' drop below
// standing (0..1 of its deepest, \`depth\` leg lengths) and the pelvis tipping forward (radians). dur: seconds.
export const MOCAP_JUMP_N = ${NJ};
export const MOCAP_JUMP = ${JSON.stringify(jump)};

// Flips and rolls, ${NJ} samples across each (from the first of the turn to the last): e, how far through its turn the whole
// body is (0..1); legs, thigh swing (lt/rt, − = forward), knee fold (lk/rk) and spread (sp, + = apart) from straight.
// back: a back tuck; front: a front handspring; side: a side flip; roll: a dive roll.
export const MOCAP_MOVES = ${JSON.stringify(moves)};

// Sword cuts, ${NS} samples from \`win\` seconds before contact to \`win\` after (contact in the middle), averaged over every
// strike in the clips: pel, the pelvis' turn toward the cut (0..1 of its whole turn); chest, the shoulders' twist
// against the pelvis toward the cut (−1..1: wound back before contact, whipping through after).
export const MOCAP_SWORD = ${JSON.stringify(sword)};
`;
fs.writeFileSync(new URL('../../src/data/mocap.js', import.meta.url), js);
console.log('wrote src/data/mocap.js', (js.length / 1024).toFixed(1) + ' KB');
