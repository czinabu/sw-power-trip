// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Motion-captured stride (the Phase 3 prototype). Real walk, jog, run and sprint cycles (data/mocap.js, converted
// from the CMU mocap library by tools/mocap/convert.mjs) are blended by speed and played by distance travelled.
// They don't drive the joints directly: they give the gait (anim/gait.js) the path each foot takes, its heel strike
// and toe-off, and the pelvis' bob, sway and rotation, so the planted-foot locks, ground IK and every combat pose
// still work on top. animation.js adds the chest's counter-twist (mocapUpper). A captured jump gives the legs through
// a plain jump's flight (anim/agility.js for the Jedi, animation.js for the Mando with the jets off) and the landing.
//
// Off with ?mocap=0 in the URL, to compare against the procedural stride.

import { MOCAP, MOCAP_N, MOCAP_JUMP, MOCAP_JUMP_N, MOCAP_MOVES, MOCAP_SWORD } from '../../data/mocap.js';
import { DIM } from '../model/rig.js';

const SCALE = 1.18;
export const LEG = DIM.thigh + DIM.shin;                 // rig units per leg length
const LEG_M = LEG * SCALE;                               // metres per leg length
const CLIPS = Object.values(MOCAP).sort((a, b) => a.speed - b.speed);
// how far each foot actually travels back while it's down in the clip (strike to toe-off), leg lengths: the contact
// test counts the touch-down and the roll off the toes, so this is shorter than stride × duty
for (const c of CLIPS) for (const F of ['left', 'right']) c[F].sweep = c[F].s[0] - at(c[F].s, c[F].duty);
export const MOCAP_ON = typeof location === 'undefined' || !/[?&]mocap=0\b/.test(location.search);

// the clips either side of this speed (m/s) and how much of each
function weights(speed){
  const v = speed / LEG_M;   // in leg lengths per second, like the clips
  if (v <= CLIPS[0].speed) return [[CLIPS[0], 1]];
  for (let i = 0; i + 1 < CLIPS.length; i++){
    const a = CLIPS[i], b = CLIPS[i + 1];
    if (v <= b.speed){ const t = (v - a.speed) / (b.speed - a.speed); return [[a, 1 - t], [b, t]]; }
  }
  return [[CLIPS[CLIPS.length - 1], 1]];
}

// a sample of one channel at cycle phase p (0..1), linear between the samples, wrapping
function at(arr, p){
  const x = ((p % 1) + 1) % 1 * MOCAP_N, i = Math.floor(x), t = x - i;
  return arr[i] + (arr[(i + 1) % MOCAP_N] - arr[i]) * t;
}
const blend = (W, get, p) => W.reduce((s, [c, w]) => s + at(get(c), p) * w, 0);

/* The stride for this speed: length (metres per cycle, two steps) and each foot's share of the cycle on the ground.
   Past the fastest clip a runner quickens rather than lengthens: the stride grows a little, the cadence takes the
   rest, and each foot spends less of the cycle on the ground (so the stance still fits under the leg). Below the
   slowest clip the steps shorten and slow. */
export function mocapStride(speed){
  const W = weights(speed);
  const natural = W.reduce((s, [c, w]) => s + c.speed * w, 0) * LEG_M;
  let stride = W.reduce((s, [c, w]) => s + c.stride * w, 0) * LEG_M, dutyK = 1;
  if (speed > natural){ stride *= Math.pow(speed / natural, 0.25); dutyK = Math.pow(natural / speed, 0.8); }
  else if (speed > 0.05) stride *= Math.pow(Math.max(speed, 0.3) / natural, 0.55);
  return {
    W, stride,
    sweep: W.reduce((s, [c, w]) => s + (c.left.sweep + c.right.sweep) / 2 * w, 0),   // clip stance length, leg lengths
    hipH: W.reduce((s, [c, w]) => s + c.hipH * w, 0),   // hip above the planted ankle, leg lengths
    duty: [W.reduce((s, [c, w]) => s + c.left.duty * w, 0) * dutyK, W.reduce((s, [c, w]) => s + c.right.duty * w, 0) * dutyK],
  };
}

// a clip's own phase for the runtime phase p of foot F: the stance and the swing are each stretched to fit
function clipPhase(c, F, p, D){
  const d = c[F].duty;
  return p < D ? p / D * d : d + (p - D) / (1 - D) * (1 - d);
}

/* One foot's path at its own phase p (0 = its heel strike): forward offset from the hip `s` (rig units, scaled so the
   stance sweeps back at exactly the body's speed), sideways offset `x`, lift `h` above the stance, and the toe angle
   (+ = toes down). */
export function mocapFoot(m, i, p, strideRig){
  const F = i === 0 ? 'left' : 'right', D = m.duty[i];
  const k = strideRig * D / m.sweep;   // rig units per clip leg length along the travel
  const b = key => m.W.reduce((s, [c, w]) => s + at(c[F][key], clipPhase(c, F, p, D)) * w, 0);
  return { s: b('s') * k, x: b('x') * LEG, h: b('h') * LEG * Math.min(1.4, Math.sqrt(k / LEG)), toe: b('toe') };
}

/* The pelvis and chest at cycle phase p (0 = left heel strike): pelvis offsets in rig units (y up, sway right, surge
   forward) and rotations (yaw + = left hip forward, roll + = left hip up, pitch + = tipped forward); the chest's
   twist relative to the pelvis the same way. */
export function mocapBody(m, p){
  const g = (part, key) => blend(m.W, c => c[part][key], p);
  return {
    y: g('pelvis', 'y') * LEG, sway: g('pelvis', 'sway') * LEG, surge: g('pelvis', 'surge') * LEG,
    yaw: g('pelvis', 'yaw'), roll: g('pelvis', 'roll'), pitch: g('pelvis', 'pitch'),
    cyaw: g('chest', 'yaw'), croll: g('chest', 'roll'),
  };
}

// a sample of a non-wrapping channel (the jump's) at u (0..1), linear between the samples
function along(arr, u){
  const x = Math.min(1, Math.max(0, u)) * (MOCAP_JUMP_N - 1), i = Math.min(Math.floor(x), MOCAP_JUMP_N - 2), t = x - i;
  return arr[i] + (arr[i + 1] - arr[i]) * t;
}

/* The legs through a jump's flight at phase u (0 = take-off, 1 = touchdown), as [left hip, left knee, right hip,
   right knee] in the rig's angles (hip − = thigh forward, knee + = bent): they trail off the push, fold a little at
   the top, then swing forward and straighten to reach for the ground. */
export function mocapAirLegs(u, vy0){
  const F = MOCAP_JUMP.flight;
  // the capture is a person hopping about a foot high: a hero's bigger jump drives the knees and reaches further
  const k = Math.min(2.4, Math.max(1, 0.8 + (vy0 || 0) * 0.15));
  return [along(F.lt, u) * k, along(F.lk, u) * k, along(F.rt, u) * k, along(F.rk, u) * k];
}

/* How far through a jump's flight (0 = take-off, 1 = touchdown) from the vertical speed against the take-off's: the
   arc is symmetric, so the top is halfway. A fall with no jump, or one dropping past where it started, reads 1. */
export const airPhase = (vy0, vy) => vy0 > 1 ? Math.min(1, Math.max(0, (vy0 - vy) / (2 * vy0))) : 1;

/* The landing at phase u (0 = touchdown, 1 = back up): how far down the hips are (0..1 of the deepest) and how far
   the pelvis tips forward (radians). The knees give fast and the body rises back slowly. */
export const MOCAP_LAND_T = MOCAP_JUMP.land.dur * 0.7;   // a touch quicker than the capture: it's an action game
export function mocapLand(u){
  const L = MOCAP_JUMP.land;
  return { drop: along(L.drop, u), pitch: along(L.pitch, u) };
}

/* ---------------- flips and rolls ---------------- */
/* The captured flip for a flip state (anim/agility.js), or null: a somersault backward is the back tuck, forward the
   front handspring (or the dive roll, for a roll along the ground), and a cartwheel turn is the side flip. A twirl
   (a spin dodge, a slide) isn't a flip and keeps its own timing. */
export function mocapFlip(fl){
  if (!MOCAP_ON || fl.ease === 'twirl') return null;
  if (fl.somer) return MOCAP_MOVES[(fl.lift || 0) < 0 ? 'roll' : fl.somer < 0 ? 'back' : 'front'];
  if (fl.roll) return MOCAP_MOVES.side;
  return null;
}

// how far through its turn the body is at phase p of the move (0..1, exactly 0 and 1 at the ends)
export function flipTurn(m, p){
  const e = m.e, a = e[0], b = e[e.length - 1];
  return Math.min(1, Math.max(0, (along(e, p) - a) / (b - a)));
}

// the legs at phase p, [left hip, left knee, right hip, right knee, spread] like anim/agility.js' LEGS shapes
export function flipLegs(m, p){
  const L = m.legs;
  return [along(L.lt, p), along(L.lk, p), along(L.rt, p), along(L.rk, p), along(L.sp, p)];
}

/* ---------------- sword cuts ---------------- */
// a sample of a sword channel at u (0..1 across the captured window, contact at 0.5)
function cutAt(arr, u){
  const n = arr.length, x = Math.min(1, Math.max(0, u)) * (n - 1), i = Math.min(Math.floor(x), n - 2), t = x - i;
  return arr[i] + (arr[i + 1] - arr[i]) * t;
}
const smooth01 = x => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };

/* The body behind a cut at swing progress k, with the swing's chamber / strike / follow-through times (data/poses.js
   SWING_STYLE): the hips lead (already turning through the strike, still going after contact) and the shoulders
   trail them, then whip past at contact. turn: the whole body's turn toward the cut (about −0.3 at the start, wound
   back, to 0.7 at the follow-through); chest: the shoulders against the hips (−1 trailing … 1 leading). Both ease in
   over the chamber and out over the recovery, so a cut starts and ends square. */
export function mocapCut(k, tc, ts, tf){
  const u = k < ts ? 0.5 * k / ts : 0.5 + 0.5 * Math.min(1, (k - ts) / (tf - ts));
  const back = k > tf ? 1 - smooth01((k - tf) / (1 - tf)) : 1;
  const w = smooth01(k / tc) * back;
  return { turn: (cutAt(MOCAP_SWORD.pel, u) - 0.3) * w, chest: cutAt(MOCAP_SWORD.chest, u) * w };
}
