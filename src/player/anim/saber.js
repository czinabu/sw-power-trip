// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The bladed-weapon pose driver: guards and keyframed swings for the Jedi saber (both grips) and the Mando's darksaber.
// Poses come from data/poses.js as hand positions + blade directions in chest space; this solves them onto the rig.

import * as THREE from 'three';
import { SABER_GUARDS, SABER_SWINGS, SWING_STYLE, SABER_DEFLECTS } from '../../data/poses.js';
import { AIR_GUARDS } from '../../data/agility.js';
import { solveArm, aimHeld, pointInChest, wristInChest, axisInChest, slerpDir, arcLerp } from './ik.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const PIVOT = new THREE.Vector3(0, 0.12, 0.04);   // the arc centre of a cut: between the shoulders, a touch forward
const OFF_REST = new THREE.Vector3(-0.3, -0.42, 0.12), OFF_POLE = new THREE.Vector3(-0.55, -0.8, -0.25);
const Y = new THREE.Vector3(0, 1, 0);
const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _ax = new THREE.Vector3(), _grip = new THREE.Vector3();

// cache the data as vectors once
const vecOff = o => o && { hand: V(o.hand), pole: V(o.pole || [-0.55, -0.8, -0.25]).normalize() };
const vecPose = p => p && ({ ...p, hand: V(p.hand), blade: V(p.blade).normalize(), pole: V(p.pole || [0.55, -0.8, -0.25]).normalize(),
  off: vecOff(p.off), offMove: vecOff(p.offMove) });
const GUARDS = {}, SWINGS = {};
for (const g in SABER_GUARDS){ GUARDS[g] = {}; for (const f in SABER_GUARDS[g]) GUARDS[g][f] = { ready: vecPose(SABER_GUARDS[g][f].ready), block: vecPose(SABER_GUARDS[g][f].block) }; }
const AIR = {};
for (const g in AIR_GUARDS){ AIR[g] = {}; for (const f in AIR_GUARDS[g]){ AIR[g][f] = {}; for (const k in AIR_GUARDS[g][f]) AIR[g][f][k] = vecPose(AIR_GUARDS[g][f][k]); } }
/* an agility guard (data/agility.js AIR_GUARDS) for this grip and form, or null to keep the form's ready guard */
export function airGuard(grip, form, key){
  if (!key) return null;
  return (AIR[grip] && AIR[grip][form] && AIR[grip][form][key]) || null;
}
for (const g in SABER_SWINGS){ SWINGS[g] = {}; for (const p in SABER_SWINGS[g]) SWINGS[g][p] = SABER_SWINGS[g][p].map(vecPose); }
const DEFLECTS = {};
for (const g in SABER_DEFLECTS){ DEFLECTS[g] = {}; for (const z in SABER_DEFLECTS[g]) DEFLECTS[g][z] = SABER_DEFLECTS[g][z].map(p => ({ ...vecPose(p), flick: V(p.flick || [0, 0, 0]) })); }
/* the over-the-top wrap a blade takes when the next cut chambers on the far side from where the last one finished:
   the hand rises past the head and the blade rolls up and back (regular) or lies back along the forearm (reverse) */
const WRAP_LIFT = new THREE.Vector3(0, 0.24, -0.1);
const WRAP_BLADE = { regular: new THREE.Vector3(0, 0.78, -0.62).normalize(), reverse: new THREE.Vector3(0, -0.55, -0.83).normalize() };

const TWIRL_AXIS = new THREE.Vector3(0.25, 0, 1).normalize();   // a wheel in front of the chest, just canted
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t * t;   // a cut accelerates into contact
const COIL_HOLD = 0.22;   // the share of the stroke's time the blade hangs at the top of the chamber before it goes

/* live, smoothed pose state (chest space) */
export const saberPose = {
  live: false,
  hand: new THREE.Vector3(), blade: new THREE.Vector3(0, 1, 0), pole: new THREE.Vector3(0.55, -0.8, -0.25),
  off: new THREE.Vector3().copy(OFF_REST), offPole: new THREE.Vector3().copy(OFF_POLE), two: 0,
  twist: 0, lean: 0,
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
  const G0 = (GUARDS[grip] && GUARDS[grip][form]) || GUARDS.regular.niman;
  const g = (!blocking && over) || (blocking ? G0.block : G0.ready);
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
  // a guard can rest its free hand while idle and bring it up as soon as the hero moves (offMove)
  const off = (sway.moving && g.offMove) || g.off;
  if (off){
    _p.copy(off.hand); if (sway.off){ _p.z += sway.off; _p.y += Math.abs(sway.off) * 0.3; }
    saberPose.off.lerp(_p, Math.min(1, dt * 8 * rate)); saberPose.offPole.lerp(off.pole, k).normalize();
  }
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
    const pid = sw.riposte ? 'forward' : fin ? style.finisher.pattern : (sw.pat.id || 'right');
    const set = SWINGS[grip] || SWINGS.regular;
    const keys = set[pid] || set.right;
    // reach scales the chamber and follow-through out from the arc centre (committed forms swing bigger)
    const scaled = keys.map((kf, i) => i === 1 ? kf : { ...kf, hand: kf.hand.clone().sub(PIVOT).multiplyScalar(style.reach).add(PIVOT) });
    sw.anim = {
      keys: scaled, fin, spin: fin ? style.finisher.spin : 0, hop: fin ? style.finisher.hop : style.spinHop,
      tc: style.tc * (sw.riposte ? 0.45 : 1), ts: style.ts, tf: style.tf,
      start: { hand: saberPose.hand.clone(), blade: saberPose.blade.clone(), twist: saberPose.twist },
    };
    // FLOW: the blade carries on from wherever the last cut left it. Finishing on the far side from this cut's
    // chamber, it wraps over the top to get there (the films' twirl between strokes) instead of dragging back
    // across the front like a second, backwards cut.
    const st0 = sw.anim.start.hand, c0 = scaled[0].hand;
    sw.anim.wrap = st0.x * c0.x < 0 && Math.abs(st0.x - c0.x) > 0.3;
    // the follow-through settles a little toward the form's guard instead of freezing (the recovery)
    const G0 = (GUARDS[grip] && GUARDS[grip][form]) || GUARDS.regular.niman;
    sw.anim.rest = G0.ready;
    // which way across the body the cut travels (chest +x is the weapon side): spins and twirls turn into it. A cut
    // that runs straight down the middle has none of its own and turns toward the weapon side.
    const dx = scaled[2].hand.x - scaled[0].hand.x;
    sw.anim.side = Math.abs(dx) > 0.15 ? Math.sign(dx) : 1;
  }
  const A = sw.anim, [C, S, F] = A.keys;
  const k = Math.min(1, sw.t / sw.dur);
  // COIL — the blade settles into the chamber and HANGS there for a beat before it snaps through (a riposte, already
  // moving, doesn't pause); the stroke then accelerates hard into the strike key
  const hold = sw.riposte ? 0 : COIL_HOLD * (A.ts - A.tc);
  let a, b, t, ta, tb;
  if (k < A.tc){ a = A.start; b = C; t = easeOut(k / A.tc); ta = A.start.twist; tb = C.twist; }
  else if (k < A.ts){ a = C; b = S; t = easeIn(Math.max(0, k - A.tc - hold) / (A.ts - A.tc - hold)); ta = C.twist; tb = S.twist; }
  else if (k < A.tf){ a = S; b = F; t = easeOut((k - A.ts) / (A.tf - A.ts)); ta = S.twist; tb = F.twist; }
  else { a = F; b = A.rest; t = 0.3 * easeOut((k - A.tf) / (1 - A.tf)); ta = tb = F.twist; }
  arcLerp(a.hand, b.hand, t, PIVOT, saberPose.hand);
  if (k < A.tc && A.wrap){
    // wind-up wrap: lift the hand past the head and roll the blade up and back through the middle of it
    const wb = WRAP_BLADE[grip] || WRAP_BLADE.regular;
    saberPose.hand.addScaledVector(WRAP_LIFT, Math.sin(Math.PI * t));
    if (t < 0.5) slerpDir(a.blade, wb, t * 2, saberPose.blade);
    else slerpDir(wb, b.blade, t * 2 - 1, saberPose.blade);
  } else slerpDir(a.blade, b.blade, t, saberPose.blade);
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
  saberPose.twist = (ta + (tb - ta) * t) * style.twist;
  saberPose.two = style.two ? 1 : 0;
  saberPose.lean = (style.drop || 0) * Math.sin(Math.PI * k) * 1.6;
  // the free hand: Niman flings an open palm out against the cut, Ataru throws it out for balance
  if (!style.two){
    const env = Math.sin(Math.PI * Math.min(1, k * 1.2));
    _t.set(-0.4 - 0.12 * style.offFlare * env, -0.05 + 0.18 * style.offFlare * env, 0.16 + 0.2 * style.offFlare * env);
    saberPose.off.lerp(_t, 0.35);
    saberPose.offPole.copy(OFF_POLE);
  }
  // progress through the actual cut (chamber → follow), for spins
  const cut = THREE.MathUtils.clamp((k - A.tc) / (A.tf - A.tc), 0, 1);
  // the body's beats for animation.js: coil (loaded back into the chamber) and drive (the weight thrown through the
  // strike, peaking as the blade reaches the strike key, then carried out by the follow-through)
  const coil = k < A.tc ? easeOut(k / A.tc) : k < A.tc + hold ? 1 : k < A.ts ? 1 - (k - A.tc - hold) / (A.ts - A.tc - hold) : 0;
  const drive = k < A.tc + hold ? 0 : k < A.ts ? easeIn((k - A.tc - hold) / (A.ts - A.tc - hold)) : k < A.tf ? 1 - 0.6 * easeOut((k - A.ts) / (A.tf - A.ts)) : 0.4 * (1 - easeOut((k - A.tf) / (1 - A.tf)));
  return { k, env: Math.sin(Math.PI * k), cut, spin: A.spin, hop: A.hop, drop: style.drop || 0, fin: A.fin, strike: k > A.tc && k < A.tf, coil, drive, side: A.side };
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
export function deflectPose(dt, R, held, grip, form, d){
  if (!saberPose.live) seed(R, held);
  const G0 = (GUARDS[grip] && GUARDS[grip][form]) || GUARDS.regular.niman;
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
    };
  }
  const P = d.pose, k = Math.min(1, d.t / d.dur);
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
  // a catch turned into a twirl (data/poses.js DEFLECT_SPINS): the blade wheels once about the hand on its way to the
  // catch and back, and is on the catch's line again by the flick. The reverse grip keeps its blade along the forearm.
  const sp = d.spin;
  if (sp && sp.twirl && grip === 'regular'){
    const p = Math.min(1, k / 0.6);
    saberPose.blade.applyAxisAngle(TWIRL_AXIS, -Math.PI * 2 * sp.twirl * sp.side * (p - Math.sin(Math.PI * 2 * p) / (Math.PI * 2))).normalize();
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
  if (saberPose.two > 0.5) _p.set(-0.4, -0.85, 0.1).normalize();
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
