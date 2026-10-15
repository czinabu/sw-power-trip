// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The bladed-weapon pose driver: guards and keyframed swings for the Jedi saber (both grips) and the Mando's darksaber.
// Poses come from data/poses.js as hand positions + blade directions in chest space; this solves them onto the rig.

import * as THREE from 'three';
import { SABER_GUARDS, SABER_SWINGS, SWING_STYLE } from '../../data/poses.js';
import { AIR_GUARDS } from '../../data/agility.js';
import { solveArm, aimHeld, pointInChest, wristInChest, axisInChest, slerpDir, arcLerp } from './ik.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const PIVOT = new THREE.Vector3(0, 0.12, 0.04);   // the arc centre of a cut: between the shoulders, a touch forward
const OFF_REST = new THREE.Vector3(-0.3, -0.42, 0.12), OFF_POLE = new THREE.Vector3(-0.55, -0.8, -0.25);
const Y = new THREE.Vector3(0, 1, 0);
const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _ax = new THREE.Vector3(), _grip = new THREE.Vector3();

// cache the data as vectors once
const vecPose = p => p && ({ ...p, hand: V(p.hand), blade: V(p.blade).normalize(), pole: V(p.pole || [0.55, -0.8, -0.25]).normalize(),
  off: p.off && { hand: V(p.off.hand), pole: V(p.off.pole || [-0.55, -0.8, -0.25]).normalize() } });
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

const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t * t;   // a cut accelerates into contact

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
  const k = Math.min(1, dt * (blocking ? 18 : 9) * rate);
  _t.copy(g.hand); _t.y += sway.y; _t.z += sway.z;
  saberPose.hand.lerp(_t, k);
  slerpDir(saberPose.blade, g.blade, k, saberPose.blade);
  saberPose.pole.lerp(g.pole, k).normalize();
  saberPose.two += ((g.two ? 1 : 0) - saberPose.two) * Math.min(1, dt * 14);
  if (g.off){
    _p.copy(g.off.hand); if (sway.off){ _p.z += sway.off; _p.y += Math.abs(sway.off) * 0.3; }
    saberPose.off.lerp(_p, Math.min(1, dt * 8 * rate)); saberPose.offPole.lerp(g.off.pole, k).normalize();
  }
  saberPose.twist += ((g.twist || 0) - saberPose.twist) * Math.min(1, dt * 9 * rate);
  saberPose.lean += ((g.lean || 0) - saberPose.lean) * Math.min(1, dt * 10 * rate);
  return { torso: g.torso || 0 };
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
  }
  const A = sw.anim, [C, S, F] = A.keys;
  const k = Math.min(1, sw.t / sw.dur);
  let a, b, t, ta, tb;
  if (k < A.tc){ a = A.start; b = C; t = easeOut(k / A.tc); ta = A.start.twist; tb = C.twist; }
  else if (k < A.ts){ a = C; b = S; t = easeIn((k - A.tc) / (A.ts - A.tc)); ta = C.twist; tb = S.twist; }
  else if (k < A.tf){ a = S; b = F; t = easeOut((k - A.ts) / (A.tf - A.ts)); ta = S.twist; tb = F.twist; }
  else { a = F; b = F; t = 0; ta = tb = F.twist; }
  arcLerp(a.hand, b.hand, t, PIVOT, saberPose.hand);
  slerpDir(a.blade, b.blade, t, saberPose.blade);
  // a heavy blade drags PAST the follow-through, then gets hauled back (overshoot), with a wobble
  if (style.overshoot && k > A.ts){
    const o = Math.sin(Math.min(1, (k - A.ts) / (1 - A.ts)) * Math.PI) * style.overshoot;
    _p.subVectors(F.hand, S.hand).multiplyScalar(o * 0.5);
    saberPose.hand.add(_p);
    _ax.subVectors(F.blade, S.blade).multiplyScalar(o * 0.6);
    saberPose.blade.add(_ax).normalize();
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
  return { k, env: Math.sin(Math.PI * k), cut, spin: A.spin, hop: A.hop, drop: style.drop || 0, fin: A.fin, strike: k > A.tc && k < A.tf };
}

/* Solve the live pose onto the rig: weapon arm by IK, blade aimed, off hand on the hilt (two-handed) or free. */
export function applySaberPose(R, held, offFree = true){
  R.chest.rotation.y = saberPose.twist;
  solveArm(R.armR, saberPose.hand, saberPose.pole);
  R.armR.wr.updateWorldMatrix(true, false);
  aimHeld(R.chest, R.armR.wr, held.node, bladeAxis(held, _ax), saberPose.blade, 0.4);
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
