// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The bladed-weapon pose driver: guards and keyframed swings for the Jedi saber (both grips) and the Mando's darksaber.
// Poses come from data/poses.js as hand positions + blade directions in chest space; this solves them onto the rig.

import * as THREE from 'three';
import { SABER_GUARDS, SABER_SWINGS, SWING_STYLE, SWING_OFF, SABER_DEFLECTS } from '../../data/poses.js';
import { AIR_GUARDS } from '../../data/agility.js';
import { CUT_ANGLE } from '../../data/stances.js';
import { DIM } from '../model/rig.js';
import { solveArm, aimHeld, pointInChest, wristInChest, axisInChest, slerpDir, arcLerp } from './ik.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const PIVOT = new THREE.Vector3(0, 0.12, 0.04);   // the arc centre of a cut: between the shoulders, a touch forward
const OFF_REST = new THREE.Vector3(-0.3, -0.42, 0.12), OFF_POLE = new THREE.Vector3(-0.55, -0.8, -0.25);
const Y = new THREE.Vector3(0, 1, 0);
const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _ax = new THREE.Vector3(), _grip = new THREE.Vector3();

// cache the data as vectors once
const vecOff = o => o && { hand: V(o.hand), pole: V(o.pole || [-0.55, -0.8, -0.25]).normalize() };
const vecPose = p => p && ({ ...p, hand: V(p.hand), blade: V(p.blade).normalize(), pole: V(p.pole || [0.55, -0.8, -0.25]).normalize(),
  off: vecOff(p.off), offMove: vecOff(p.offMove), offFight: vecOff(p.offFight) });
const GUARDS = {}, SWINGS = {};
for (const g in SABER_GUARDS){ GUARDS[g] = {}; for (const f in SABER_GUARDS[g]) GUARDS[g][f] = { ready: vecPose(SABER_GUARDS[g][f].ready), block: vecPose(SABER_GUARDS[g][f].block), block2: vecPose(SABER_GUARDS[g][f].block2) }; }
const AIR = {};
for (const g in AIR_GUARDS){ AIR[g] = {}; for (const f in AIR_GUARDS[g]){ AIR[g][f] = {}; for (const k in AIR_GUARDS[g][f]) AIR[g][f][k] = vecPose(AIR_GUARDS[g][f][k]); } }
/* an agility guard (data/agility.js AIR_GUARDS) for this grip and form, or null to keep the form's ready guard. A form
   without its own (the newer forms) borrows the same grip's Niman, Ataru or Djem So pose for that key, so it still
   hangs from a ledge with its hands up or hammers down with the blade raised. */
const AIR_BORROW = ['niman', 'ataru', 'djemso'];
export function airGuard(grip, form, key){
  if (!key || !AIR[grip]) return null;
  const A = AIR[grip];
  if (A[form] && A[form][key]) return A[form][key];
  if (form === 'darksaber') return null;
  for (const f of AIR_BORROW) if (A[f] && A[f][key]) return A[f][key];
  return null;
}
for (const g in SABER_SWINGS){ SWINGS[g] = {}; for (const p in SABER_SWINGS[g]) SWINGS[g][p] = SABER_SWINGS[g][p].map(vecPose); }
/* ANGLE CUTS (data/stances.js CUT_ANGLE): the keyframes of a cut from `ang` degrees, blended between the tuned cuts
   either side of it on the clock and lifted or dropped for its height. The reverse grip takes the nearest tuned cut. */
const D2R = Math.PI / 180;
const HEIGHT_ID = { left: { high: 'leftHigh', low: 'leftLow' }, right: { high: 'rightHigh', low: 'rightLow' } };
function angleKeys(set, grip, ang, h){
  const A = CUT_ANGLE.anchors;
  ang = ((ang % 360) + 360) % 360;
  let i = A.length - 1;
  while (i > 0 && A[i][0] > ang) i--;
  const [a0, id0] = A[i], [n1, id1] = A[(i + 1) % A.length], a1 = n1 <= a0 ? n1 + 360 : n1;
  const t = (ang - a0) / (a1 - a0);
  if (grip !== 'regular'){
    const id = t < 0.5 ? id0 : id1, hid = HEIGHT_ID[id] && HEIGHT_ID[id][h];
    return set[hid] || set[id] || set.right;
  }
  const k0 = set[id0], k1 = set[id1], off = CUT_ANGLE[h];
  const w = CUT_ANGLE.vert + (1 - CUT_ANGLE.vert) * Math.abs(Math.cos(ang * D2R));
  return k0.map((p, j) => {
    const q = k1[j], hand = p.hand.clone().lerp(q.hand, t), blade = p.blade.clone().lerp(q.blade, t);
    if (off){ hand.y += off[j][0] * w; blade.y += off[j][1] * w; }
    return { hand, blade: blade.normalize(), twist: p.twist + (q.twist - p.twist) * t };
  });
}
const OFF_KEYS = { fore: SWING_OFF.fore.map(V), back: SWING_OFF.back.map(V) };   // (data arrays → vectors once)
const DEFLECTS = {};
for (const g in SABER_DEFLECTS){ DEFLECTS[g] = {}; for (const z in SABER_DEFLECTS[g]) DEFLECTS[g][z] = SABER_DEFLECTS[g][z].map(p => ({ ...vecPose(p), flick: V(p.flick || [0, 0, 0]) })); }
/* the over-the-top wrap a blade takes when the next cut chambers on the far side from where the last one finished:
   the hand rises past the head and the blade rolls up and back (regular) or lies back along the forearm (reverse) */
const WRAP_LIFT = new THREE.Vector3(0, 0.24, -0.1);
const WRAP_BLADE = { regular: new THREE.Vector3(0, 0.78, -0.62).normalize(), reverse: new THREE.Vector3(0, -0.55, -0.83).normalize() };

const TWIRL_AXIS = new THREE.Vector3(0.25, 0, 1).normalize();   // a wheel in front of the chest, just canted
const easeOut = t => 1 - (1 - t) * (1 - t);
const COIL_HOLD = 0.22;   // the share of the stroke's time the blade hangs at the top of the chamber before it goes
/* A CUT IS ONE MOTION, not a bat swung at a ball (data/poses.js SWING_STYLE: load, accel, lag, recover):
   the wind-up eases into a chamber loaded a little deeper than its key, so the hang at the top is a slow settle, never a
   dead stop. The stroke accelerates into contact and CARRIES THROUGH: the follow-through leaves the strike at the speed
   the blade arrived with and bleeds it off over the rest of the arc, instead of slamming to a halt on contact. The wrist
   leads: the hilt starts the stroke with the tip trailing, the tip whips past at contact and leads out into the
   follow-through. The recovery flows back toward the guard and hands over at the speed the guard picks it up at. */
const TIP = 0.9;   // where along the blade the eye follows (the tip's travel sets the stroke's speed)
const _ta = new THREE.Vector3(), _tb = new THREE.Vector3();
const tipGap = (a, b) => _ta.copy(a.hand).addScaledVector(a.blade, TIP).distanceTo(_tb.copy(b.hand).addScaledVector(b.blade, TIP));
const powIn = (x, e) => Math.pow(x, e), powOut = (x, e) => 1 - Math.pow(1 - x, e);
// a Hermite ease from rest that leaves at slope m1 (≤ 3 keeps it from overshooting)
const settle = (x, m1) => x * x * (3 - 2 * x) + (x * x * x - x * x) * m1;
const GUARD_RATE = 9;   // guardPose's own blend rate, which the recovery hands over to

/* live, smoothed pose state (chest space) */
export const saberPose = {
  live: false,
  hand: new THREE.Vector3(), blade: new THREE.Vector3(0, 1, 0), pole: new THREE.Vector3(0.55, -0.8, -0.25),
  off: new THREE.Vector3().copy(OFF_REST), offPole: new THREE.Vector3().copy(OFF_POLE), two: 0,
  twist: 0, lean: 0,
  palm: 0,   // how open the free hand is held (1: the flat Force palm of Niman's reaching guard), for the fingers
};

/* the held weapon: { node, axis } — axis is the blade direction in the node's own frame (flips with the grip) */
function bladeAxis(held, out){
  if (held.root) return out.copy(Y).applyQuaternion(held.root.quaternion);
  return out.copy(Y);
}

/* Seed the pose from wherever the arm currently is, so blending in from an FK pose (Force cast, mend…) is smooth. */
function seed(R, held){
  wristInChest(R.chest, R.armR, saberPose.hand);
  axisInChest(R.chest, held.node, bladeAxis(held, _ax), saberPose.blade);
  wristInChest(R.chest, R.armL, saberPose.off);
  saberPose.twist = R.chest.rotation.y;
  saberPose.two = 0;
  saberPose.live = true;
}

/* GUARD — damp the live pose toward the form's ready or block guard. `sway` adds stride carriage while moving
   (sway.off swings a free off hand with the stride). `over` swaps in an agility guard (airGuard) for flips, dives,
   landings and the run; `rate` scales how fast the pose gets there. */
export function guardPose(dt, R, held, grip, form, blocking, sway, over = null, rate = 1){
  if (!saberPose.live) seed(R, held);
  const G0 = (GUARDS[grip] && (GUARDS[grip][form] || GUARDS[grip].niman)) || GUARDS.regular.niman;
  if (blocking && !wasBlocking && G0.block2) blockAlt = !blockAlt;
  wasBlocking = blocking;
  const g = (!blocking && over) || (blocking ? (blockAlt && G0.block2) || G0.block : G0.ready);
  switchT = Math.max(0, switchT - dt);
  const k = Math.min(1, dt * (blocking ? 18 : switchT > 0 ? SWITCH_RATE : 9) * rate);
  _t.copy(g.hand); _t.y += sway.y; _t.z += sway.z;
  // mid-switch the blade swings out round the weapon side, never across the body or face
  const out = switchT > 0 ? Math.sin(Math.PI * switchT / SWITCH_TIME) : 0;
  if (out){ _t.x += 0.12 * out; _t.z += 0.08 * out; }
  saberPose.hand.lerp(_t, k);
  slerpDir(saberPose.blade, out ? _ax.copy(g.blade).addScaledVector(OUTX, SWITCH_OUT * out).normalize() : g.blade, k, saberPose.blade);
  saberPose.pole.lerp(g.pole, k).normalize();
  saberPose.two += ((g.two ? 1 : 0) - saberPose.two) * Math.min(1, dt * 14);
  // a guard can rest its free hand while idle and bring it up as soon as the hero moves (offMove) or a fight is on (offFight)
  const off = (sway.fight && g.offFight) || (sway.moving && g.offMove) || g.off;
  if (off){
    _p.copy(off.hand); if (sway.off){ _p.z += sway.off; _p.y += Math.abs(sway.off) * 0.3; }
    saberPose.off.lerp(_p, Math.min(1, dt * 8 * rate)); saberPose.offPole.lerp(off.pole, k).normalize();
  }
  saberPose.palm += ((g.palm && off === g.off ? g.palm : 0) - saberPose.palm) * Math.min(1, dt * 8);
  saberPose.twist += ((g.twist || 0) - saberPose.twist) * Math.min(1, dt * 9 * rate);
  saberPose.lean += ((g.lean || 0) - saberPose.lean) * Math.min(1, dt * 10 * rate);
  return { torso: g.torso || 0 };
}

/* SWITCH — changing form or grip turns the saber straight into the new guard in one quick, efficient rotation
   (the guard blend runs much faster for a moment) instead of drifting there. */
const SWITCH_TIME = 0.22, SWITCH_RATE = 24;   // seconds the fast blend lasts; its rate (the guard's own is 9)
const GRIP_TURN = Math.PI / 0.16;   // rad/s the hilt turns over in the fingers on a grip change (half a turn in 0.16 s)
const SWITCH_OUT = 1.1, OUTX = new THREE.Vector3(1, 0, 0);   // how far out to the weapon side the blade swings mid-switch
let switchT = 0;
// a form with a second block (block2, Makashi) alternates between the two each time the guard goes up
let blockAlt = true, wasBlocking = false;
export function startSwitch(){ switchT = SWITCH_TIME; }

/* KEEP CLEAR — the blade never passes through the hero. The body is an upright elliptic column in chest space (a
   narrower one for the head); a hand inside it is pushed out, and a blade crossing it is turned out around the hand
   by how deep its deepest point sits. Runs on every pose (guards, cuts, form and grip switches, the blends between them). */
const BODY_RX = 0.3, BODY_RZ = 0.24, BODY_LO = -1.5, BODY_TOP = 0.36, HEAD_R = 0.2, HEAD_TOP = 0.7, BLADE_LEN = 1.55;
const _n = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3(), _ch = new THREE.Vector3(), _cd = new THREE.Vector3();
// how deep a point sits inside the body (0 = outside), with the way out (level) in _n
function depth(p){
  if (p.y < BODY_LO || p.y > HEAD_TOP) return 0;
  const head = p.y > BODY_TOP, rx = head ? HEAD_R : BODY_RX, rz = head ? HEAD_R : BODY_RZ;
  const q = Math.hypot(p.x / rx, p.z / rz);
  if (q >= 1) return 0;
  if (q < 1e-4) _n.set(0, 0, 1); else _n.set(p.x / (rx * rx), 0, p.z / (rz * rz)).normalize();
  return (1 - q) * Math.min(rx, rz);
}
function keepClear(h, d){
  const dh = depth(h);
  if (dh > 0) h.addScaledVector(_n, dh);
  for (let it = 0; it < 6; it++){
    let worst = 0, ws = 0;
    for (let s = 0.15; s <= BLADE_LEN; s += 0.1){
      const dp = depth(_s.copy(h).addScaledVector(d, s));
      if (dp > worst){ worst = dp; ws = s; _w.copy(_n); }
    }
    if (!worst) break;
    d.addScaledVector(_w, worst / ws).normalize();
  }
}

/* SWING — evaluate the keyframed cut at the swing's progress. Returns body cues for the caller (envelope, spin,
   hop, drop) so legs and the whole-body turn stay in step with the blade. */
export function swingPose(R, held, grip, form, sw){
  if (!saberPose.live) seed(R, held);
  const style = SWING_STYLE[form] || SWING_STYLE.niman;
  if (!sw.anim){
    const fin = sw.step === 2 && sw.dir === 'neutral' && !sw.riposte;
    const pid = sw.riposte && !sw.ripLine ? 'forward' : fin ? style.finisher.pattern : (sw.pat.id || 'right');   // (a riposte on a line: jedi/guardline.js)
    const set = SWINGS[grip] || SWINGS.regular;
    const keys = sw.pat.ang != null && !sw.riposte && !fin ? angleKeys(set, grip, sw.pat.ang, sw.h) : (set[pid] || set.right);
    // reach scales the chamber and follow-through out from the arc centre (committed forms swing bigger)
    const scaled = keys.map((kf, i) => i === 1 ? kf : { ...kf, hand: kf.hand.clone().sub(PIVOT).multiplyScalar(style.reach).add(PIVOT) });
    sw.anim = {
      keys: scaled, fin, spin: fin ? style.finisher.spin : 0, hop: fin ? style.finisher.hop : style.spinHop,
      tc: style.tc * (sw.riposte ? 0.45 : sw.flowCut ? CUT_ANGLE.flow.chamber : 1), ts: style.ts, tf: style.tf,
      start: { hand: saberPose.hand.clone(), blade: saberPose.blade.clone(), twist: saberPose.twist },
    };
    // FLOW: the blade carries on from wherever the last cut left it. Finishing on the far side from this cut's
    // chamber, it wraps over the top to get there (the films' twirl between strokes) instead of dragging back
    // across the front like a second, backwards cut.
    const st0 = sw.anim.start.hand, c0 = scaled[0].hand;
    sw.anim.wrap = !sw.flowCut && st0.x * c0.x < 0 && Math.abs(st0.x - c0.x) > 0.3;
    // the follow-through settles a little toward the form's guard instead of freezing (the recovery)
    const G0 = (GUARDS[grip] && (GUARDS[grip][form] || GUARDS[grip].niman)) || GUARDS.regular.niman;
    sw.anim.rest = G0.ready;
    // which way across the body the cut travels (chest +x is the weapon side): spins and twirls turn into it. A cut
    // that runs straight down the middle has none of its own and turns toward the weapon side.
    const dx = scaled[2].hand.x - scaled[0].hand.x;
    sw.anim.side = Math.abs(dx) > 0.15 ? Math.sign(dx) : 1;
    // the LOADED chamber: the hang at the top keeps drawing back a touch past the key (a riposte is already moving)
    const A0 = sw.anim, [C0, S0, F0] = scaled, ld = sw.riposte ? 0 : (style.load ?? 0.08);
    A0.hold = sw.riposte ? 0 : COIL_HOLD * (A0.ts - A0.tc);
    A0.wind = A0.tc + A0.hold;
    A0.load = { hand: arcLerp(S0.hand, C0.hand, 1 + ld, PIVOT, new THREE.Vector3()), blade: slerpDir(S0.blade, C0.blade, 1 + ld, new THREE.Vector3()), twist: C0.twist };
    // CARRY THROUGH: the strike accelerates as x^a and the follow-through decelerates as 1-(1-y)^b, with a and b picked
    // so the tip leaves contact at the speed it arrived (a long arc after contact = a long, controlled glide out)
    const tin = Math.max(0.02, A0.ts - A0.wind), tout = Math.max(0.02, A0.tf - A0.ts);
    const l1 = Math.max(0.05, tipGap(A0.load, S0)), l2 = Math.max(0.05, tipGap(S0, F0));
    let a = style.accel || 2.4, b = a * l1 * tout / (l2 * tin);
    if (b > 7 || b < 1.6){ b = THREE.MathUtils.clamp(b, 1.6, 7); a = THREE.MathUtils.clamp(b * l2 * tin / (l1 * tout), 1.3, 4); }
    A0.a = a; A0.b = b;
    // the recovery's hand-over speed: it reaches `recover` of the way to the guard and leaves at the guard blend's pace
    const R0 = style.recover ?? 0.55, trec = (1 - A0.tf) * (sw.dur || 0.4);
    A0.rec = R0; A0.recM = Math.min(3, GUARD_RATE * (1 - R0) * trec / R0);
    A0.start.off = saberPose.off.clone();
  }
  const A = sw.anim, [C, S, F] = A.keys, L = A.load;
  const k = Math.min(1, sw.t / sw.dur);
  const lag = style.lag || 0;
  // t: the hand's progress through this leg of the cut; tb: the blade's (the wrist leading, the tip trailing then whipping past)
  let a, b, t, tb, ta, tw, ph;
  if (k < A.wind){
    // WIND-UP — eases into the loaded chamber; the hilt draws first and the tip follows it round
    ph = 0; a = A.start; b = L; const x = k / A.wind;
    t = powOut(x, 3); tb = powOut(x, 3 / (1 + lag)); ta = A.start.twist; tw = C.twist;
  } else if (k < A.ts){
    // STROKE — accelerating into contact, the tip trailing the hilt until it whips through
    ph = 1; a = L; b = S; const x = (k - A.wind) / (A.ts - A.wind);
    t = powIn(x, A.a); tb = powIn(x, A.a * (1 + lag)); ta = C.twist; tw = S.twist;
  } else if (k < A.tf){
    // FOLLOW-THROUGH — carried on at the contact speed, the tip leading out, then bled off over the arc
    ph = 2; a = S; b = F; const x = (k - A.ts) / (A.tf - A.ts);
    t = powOut(x, A.b); tb = powOut(x, A.b * (1 + lag)); ta = S.twist; tw = F.twist;
  } else {
    // RECOVERY — the blade flows back toward the guard and is still travelling as the guard takes it over
    ph = 3; a = F; b = A.rest; const x = (k - A.tf) / (1 - A.tf);
    t = A.rec * settle(x, A.recM); tb = t; ta = F.twist; tw = (A.rest.twist || 0) / (style.twist || 1);
  }
  arcLerp(a.hand, b.hand, t, PIVOT, saberPose.hand);
  if (ph === 0 && A.wrap){
    // wind-up wrap: lift the hand past the head and roll the blade up and back through the middle of it
    const wb = WRAP_BLADE[grip] || WRAP_BLADE.regular;
    saberPose.hand.addScaledVector(WRAP_LIFT, Math.sin(Math.PI * t));
    if (tb < 0.5) slerpDir(a.blade, wb, tb * 2, saberPose.blade);
    else slerpDir(wb, b.blade, tb * 2 - 1, saberPose.blade);
  } else slerpDir(a.blade, b.blade, tb, saberPose.blade);
  // a heavy blade drags PAST the follow-through, then gets hauled back (overshoot), with a wobble
  if (style.overshoot && k > A.ts){
    const o = Math.sin(Math.min(1, (k - A.ts) / (1 - A.ts)) * Math.PI) * style.overshoot;
    _p.subVectors(F.hand, S.hand).multiplyScalar(o * 0.5);
    saberPose.hand.add(_p);
    _ax.subVectors(F.blade, S.blade).multiplyScalar(o * 0.6);
    saberPose.blade.add(_ax).normalize();
  }
  // TWIRL — the blade wheels about the hand in front of the chest while it coils, and is back on the chamber's line by
  // the strike (whole turns only, so it leaves and returns on the same line). The reverse grip keeps its blade along the forearm.
  const sp = sw.spin;
  if (sp && sp.twirl && grip === 'regular' && k < A.ts){
    // the wheel carries the blade over the top toward the cut's side (the top of the wheel moves with the cut, so the
    // tip comes round into the chamber already travelling the way the stroke goes)
    const p = k / A.ts;
    saberPose.blade.applyAxisAngle(TWIRL_AXIS, -Math.PI * 2 * sp.twirl * A.side * (p - Math.sin(Math.PI * 2 * p) / (Math.PI * 2))).normalize();
  }
  saberPose.pole.set(0.55, -0.8, -0.25).normalize();
  saberPose.twist = (ta + (tw - ta) * t) * style.twist;
  saberPose.two = style.two ? 1 : 0;
  saberPose.lean = (style.drop || 0) * Math.sin(Math.PI * k) * 1.6;
  // the free hand works against the blade (data/poses.js SWING_OFF): a forehand reaches it out at the foe on the wind-up
  // and draws it back to the hip as the blade comes through (the counter-pull that turns the body), a backhand tucks it in
  // and flings it out the other way; it opens for balance on the follow-through and returns to the guard's place
  if (!style.two){
    const O = style.offKeys ? (style.offV || (style.offV = style.offKeys.map(V))) : OFF_KEYS[A.side > 0 ? 'back' : 'fore'], fl = style.offFlare;
    const rOff = A.rest.offFight || A.rest.off, guardOff = (rOff && rOff.hand) || OFF_REST;
    const key = i => _p.copy(guardOff).lerp(O[i], fl);
    if (ph === 0){ _t.copy(A.start.off).lerp(key(0), t); }
    else if (ph === 1){ _t.copy(key(0)); _t.lerp(key(1), t); }
    else if (ph === 2){ _t.copy(key(1)); _t.lerp(key(2), t); }
    else { _t.copy(key(2)); _t.lerp(guardOff, t / A.rec); }
    saberPose.off.copy(_t);
    saberPose.offPole.copy(OFF_POLE);
    // the reaching hand is open; it closes as it pulls back through the strike
    saberPose.palm = A.side > 0 ? 0 : ph === 0 ? Math.max(saberPose.palm, t) : ph === 1 ? 1 - t : 0;
  } else saberPose.palm = 0;
  // progress through the actual cut (chamber → follow), for spins
  const cut = THREE.MathUtils.clamp((k - A.tc) / (A.tf - A.tc), 0, 1);
  // the body's beats for animation.js: coil (loaded back into the chamber) and drive (the weight thrown through the
  // strike, peaking as the blade reaches the strike key, then carried out by the follow-through)
  const coil = ph === 0 ? t : ph === 1 ? 1 - t : 0;
  const drive = ph === 0 ? 0 : ph === 1 ? t : ph === 2 ? 1 - 0.6 * t : 0.4 * (1 - easeOut((k - A.tf) / (1 - A.tf)));
  return { k, env: Math.sin(Math.PI * k), cut, spin: A.spin, hop: A.hop, drop: (style.drop || 0) + (A.fin ? 0 : sw.pat.drop || 0), fin: A.fin, strike: k > A.tc && k < A.tf, coil, drive, side: A.side };
}

/* DEFLECT — the blade snaps to catch a bolt and flicks it away. Which catch is picked from where the bolt arrives
   (d.side: + weapon side; d.h: height against the chest) and from the last few catches, so a volley moves the blade
   between covers like the films instead of repeating one block. Returns the same body cue as guardPose. */
const ZONE_CYCLE = ['mid', 'high', 'mid', 'low'];
const _pick = { side: 1, cyc: 0, last: {} };
function pickDeflect(grip, d){
  const set = DEFLECTS[grip] || DEFLECTS.regular;
  // a bolt clearly off to one side is caught on that side; a bolt down the middle alternates forehand / cross-body
  const side = Math.abs(d.side) > 0.25 ? Math.sign(d.side) : -_pick.side;
  _pick.side = side;
  const h = d.h > 0.35 ? 'high' : d.h < -0.35 ? 'low' : ZONE_CYCLE[_pick.cyc++ % ZONE_CYCLE.length];
  const zone = h + (side > 0 ? 'R' : 'L'), list = set[zone], key = grip + zone;
  // never the same catch twice running in a zone
  const last = _pick.last[key] ?? -1;
  const i = (last + 1 + (list.length > 2 && Math.random() < 0.5 ? 1 : 0)) % list.length;
  _pick.last[key] = i;
  return list[i];
}
/* MEET THE BLADE — fit a catch to where the foe's blade really is (d.contact, a world point from jedi/clash.js
   parryContact). The picked cover keeps its character (which side, what angle) but the hand is moved, within the arm's
   reach, and the blade turned just enough that the saber's length passes through the contact point. */
const ARM_SLACK = 0.04, BLADE_NEAR = 0.3, BLADE_FAR = 1.35;
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _cc = new THREE.Vector3(), _m = new THREE.Vector3(), _d = new THREE.Vector3();
function fitContact(R, P, world){
  // the contact in chest space AS THE CATCH WILL HAVE THE CHEST: the cover turns the chest by its twist, so undo that
  // turn rather than reading the chest where it happens to stand this frame
  const ch = R.chest;
  ch.parent.updateWorldMatrix(true, false);
  _e.copy(ch.rotation); _e.y = P.twist;
  const C = ch.parent.worldToLocal(_cc.copy(world)).sub(ch.position).applyQuaternion(_q.setFromEuler(_e).invert());
  const hand = P.hand, blade = P.blade;
  // slide the hand so the cover's own blade line crosses the contact at a point along the blade
  const s = THREE.MathUtils.clamp(_m.subVectors(C, hand).dot(blade), BLADE_NEAR, BLADE_FAR);
  hand.add(_m.copy(C).addScaledVector(blade, -s).sub(hand));
  // …but only as far as the arm goes
  const sh = R.armR.sh.position, reach = DIM.upper + DIM.fore - ARM_SLACK;
  _d.subVectors(hand, sh);
  if (_d.length() > reach) hand.copy(sh).addScaledVector(_d.normalize(), reach);
  // what the arm couldn't cover, the wrist makes up: turn the blade toward the contact
  const to = _d.subVectors(C, hand), dist = to.length();
  if (dist > 0.05){
    to.divideScalar(dist);
    const miss = _m.copy(C).addScaledVector(blade, -Math.min(Math.max(dist, BLADE_NEAR), BLADE_FAR)).sub(hand).length();
    if (miss > 0.02) blade.copy(to);
  }
  P.flick.multiplyScalar(0.3);   // the flick is for sending a bolt away: against a blade the saber stays on it
  P.flickHand.copy(hand).add(P.flick);
  P.flickBlade.copy(blade).addScaledVector(P.flick, 2.4).normalize();
}

export function deflectPose(dt, R, held, grip, form, d){
  if (!saberPose.live) seed(R, held);
  const G0 = (GUARDS[grip] && (GUARDS[grip][form] || GUARDS[grip].niman)) || GUARDS.regular.niman;
  const bg = G0.block;
  if (!d.pose){
    const p = pickDeflect(grip, d);
    const j = () => (Math.random() - 0.5) * 0.06;
    const hand = p.hand.clone().add(_t.set(j(), j(), j()));
    const blade = p.blade.clone().add(_t.set(j() * 2, j() * 2, j() * 2)).normalize();
    d.pose = {
      hand, blade, pole: p.pole, twist: p.twist || 0,
      // the flick carries the hand on and turns the tip further the same way, sending the bolt back out
      flickHand: hand.clone().add(p.flick), flickBlade: blade.clone().addScaledVector(p.flick, 2.4).normalize(),
      from: { hand: saberPose.hand.clone(), blade: saberPose.blade.clone(), twist: saberPose.twist },
      flick: p.flick.clone(),
    };
    if (d.contact) fitContact(R, d.pose, d.contact);
  } else if (d.refit){   // a held guard on a duellist's line turned into the real catch: re-aim the held cover at the blade
    d.refit = false;
    d.pose.from.hand.copy(saberPose.hand); d.pose.from.blade.copy(saberPose.blade); d.pose.from.twist = saberPose.twist;
    if (d.contact) fitContact(R, d.pose, d.contact);
  }
  // an anticipated twirl (jedi/combat.js anticipateDeflect) leads the catch by d.lead seconds: until the bolt lands the
  // blade stays on its guard and wheels toward the bottom; the catch itself runs from the landing on
  const lead = d.lead || 0, tp = Math.max(0, d.t - lead);
  // a HELD catch (jedi/guardline.js: the guard waiting on a duellist's line) gets there fast and stays, no flick
  const P = d.pose, k = d.hold ? Math.min(0.3, d.t / 0.1 * 0.3) : Math.min(1, tp / (d.dur - lead));
  if (k < 0.3){
    const t = easeOut(k / 0.3);
    arcLerp(P.from.hand, P.hand, t, PIVOT, saberPose.hand);
    slerpDir(P.from.blade, P.blade, t, saberPose.blade);
    saberPose.twist = P.from.twist + (P.twist - P.from.twist) * t;
  } else {
    const t = easeOut(Math.min(1, (k - 0.3) / 0.3));
    saberPose.hand.copy(P.hand).lerp(P.flickHand, t);
    slerpDir(P.blade, P.flickBlade, t, saberPose.blade);
    saberPose.twist = P.twist;
  }
  // a catch turned into a twirl (data/poses.js DEFLECT_SPINS): the blade wheels once about the hand and is on the
  // catch's line again by the flick. Anticipated, the half turn to the bottom of the wheel is done at the landing (the
  // blade sweeping through it at speed) and the rest follows. The reverse grip keeps its blade along the forearm.
  const sp = d.spin;
  if (sp && sp.twirl && grip === 'regular'){
    let ang;
    if (lead){
      const w = Math.max(lead, 0.14);
      if (d.t < lead){ const u = d.t / lead; ang = Math.PI * (0.4 * u + 0.6 * u * u); }
      else { const v = Math.min(1, (d.t - lead) / w); ang = Math.PI + Math.PI * (0.4 * v + 0.6 * (1 - (1 - v) * (1 - v))); }
    } else { const p = Math.min(1, k / 0.6); ang = Math.PI * 2 * (p - Math.sin(Math.PI * 2 * p) / (Math.PI * 2)); }
    saberPose.blade.applyAxisAngle(TWIRL_AXIS, -sp.twirl * sp.side * ang).normalize();
  }
  saberPose.pole.lerp(P.pole, Math.min(1, dt * 30)).normalize();
  // the form's block decides the hands: Djem So closes both on the hilt, Ataru and Niman keep the free hand out
  saberPose.two += ((bg.two ? 1 : 0) - saberPose.two) * Math.min(1, dt * 14);
  const off = bg.off || G0.ready.off;
  if (off){ saberPose.off.lerp(off.hand, Math.min(1, dt * 12)); saberPose.offPole.lerp(off.pole, Math.min(1, dt * 12)).normalize(); }
  saberPose.lean += ((bg.lean || 0) - saberPose.lean) * Math.min(1, dt * 12);
  return { torso: 0 };
}

/* Solve the live pose onto the rig: weapon arm by IK, blade aimed, off hand on the hilt (two-handed) or free. */
export function applySaberPose(R, held, offFree = true, dt = 1 / 60){
  // a grip change turns the hilt over in the hand; the wrist follows it round, so the blade itself stays on course
  // (the Darksaber has no flippable root: it's always held regular)
  const r = held.root, to = r ? r.userData.gripTo : undefined;
  if (to !== undefined && r.rotation.x !== to){
    const d = to - r.rotation.x, st = GRIP_TURN * dt;
    r.rotation.x = Math.abs(d) <= st ? to : r.rotation.x + Math.sign(d) * st;
  }
  R.chest.rotation.y = saberPose.twist;
  keepClear(_ch.copy(saberPose.hand), _cd.copy(saberPose.blade));
  solveArm(R.armR, _ch, saberPose.pole);
  R.armR.wr.updateWorldMatrix(true, false);
  aimHeld(R.chest, R.armR.wr, held.node, bladeAxis(held, _ax), _cd, 0.4);
  if (!offFree) return;
  // off hand: blend between its own target and the pommel end of the hilt
  bladeAxis(held, _ax).multiplyScalar(-0.15);
  pointInChest(R.chest, held.node, _ax, _grip);
  _t.copy(saberPose.off).lerp(_grip, saberPose.two);
  _p.copy(saberPose.offPole);
  // two-handed, the off elbow flares out to its own side (as a real two-handed grip does), so the arm reads past the
  // body from the camera behind instead of tucking out of sight in front of the chest
  if (saberPose.two > 0.5) _p.set(-0.85, -0.5, -0.15).normalize();
  solveArm(R.armL, _t, _p);
  R.armL.wr.quaternion.identity();
}

/* hand the arms back to plain joint animation (Force casts, flight…); the next guard re-seeds from there */
export function releaseSaberPose(R, dt){
  saberPose.live = false;
  R.armR.wr.quaternion.slerp(IDQ, Math.min(1, dt * 10));
  R.chest.rotation.y += (0 - R.chest.rotation.y) * Math.min(1, dt * 10);
}
const IDQ = new THREE.Quaternion();
