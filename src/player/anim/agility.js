// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Agility animation: flips, dash twirls and slides, jump phases, the Force leap and glide, dives, landings and the
// run's counter-twist, per form (data/agility.js). Presentation only: nothing here moves the hero or changes a
// timer the game reads; it poses `vis` and the rig while movement.js and locomotion.js do the moving.

import * as THREE from 'three';
import { clamp } from '../../utils.js';
import { G, player } from '../../state.js';
import { AGILITY, MANDO_AGILITY } from '../../data/agility.js';
import { FORM_OF } from '../../data/poses.js';
import { MOCAP_ON, mocapAirLegs, airPhase, mocapFlip, flipTurn, flipLegs } from './mocap.js';
import { MOCAP_MOVES } from '../../data/mocap.js';
import { MANDO_MOBILITY } from '../../data/mobility.js';
import { mandoAimPoint } from '../mando/weapons.js';

const TAU = Math.PI * 2;
const COM = 1.12;   // centre of mass above the feet in the hero group's space (rig hips × model scale): flips turn here
const _e = new THREE.Euler(), _v = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qe = new THREE.Euler(), _hp = new THREE.Vector3();

/* The helmet turned onto a world point (the reticle's), whatever the body is doing under it: the look it wants in the
   world, taken into the neck's frame (which sits inside the rig's mirrored scale, so y/z flip), held to what a neck
   can turn and eased in. For the lay-outs: the dive, the flight lean. */
export function headToReticle(R, aim, dt, rate = 12, maxA = 1.6){
  const h = R.head, par = h.parent;
  par.updateWorldMatrix(true, false);
  par.getWorldPosition(_hp);
  const dx = aim.x - _hp.x, dy = aim.y - _hp.y - 0.25, dz = aim.z - _hp.z;
  _q1.setFromEuler(_qe.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ'));
  par.getWorldQuaternion(_q2).invert().multiply(_q1);
  _q2.set(_q2.x, -_q2.y, -_q2.z, _q2.w);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(_q2.w)));
  if (ang > maxA) _q2.copy(_q3.identity().slerp(_q2, maxA / ang));
  h.quaternion.slerp(_q2, Math.min(1, dt * rate));
}

export const formNow = () => FORM_OF[G.stance] || 'niman';
export const agilityOf = (form = formNow()) => AGILITY[form] || AGILITY.niman;

/* The style a move uses for the current form: kind = dash | evade | wall | double, dir = side | fwd | back. */
export function flipStyle(kind, dir){
  const A = agilityOf()[kind];
  return { ...(dir ? (A[dir] || A.fwd || A.back) : A) };
}

const flipEase = p => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;   // hangs at take-off and landing, whips through the tuck
const twirlEase = p => 0.5 - 0.5 * Math.cos(Math.PI * p);

/* Start a flip facing the way it travels. A flip turns about the body's own axes, so the body has to face the right
   way for it to go where the hero is going: a front flip faces the travel, a back flip faces away from it, a
   cartwheel or side twist faces across it (fl.side = which side the travel is on: +1 right). The body turns there
   quickly while the flip is still leaving the ground (animation.js), and stays there until it lands, so chaining a
   dash, a flip and a wall kick never leaves a somersault turning sideways to the motion. A flip started while
   another is still turning carries that one's rotation and eases it out instead of snapping square.
   dir: fwd | back | side, or null for a flip that doesn't care (a vault, a slide). */
export function launchFlip(fl, dir){
  const vis = player.vis;
  const vx = player.vel.x + player.moveVel.x, vz = player.vel.z + player.moveVel.z;
  if (dir && Math.hypot(vx, vz) > 1.5){
    const t = Math.atan2(vx, vz);
    fl.face = dir === 'back' ? t + Math.PI : dir === 'side' ? t + (fl.side || 1) * Math.PI / 2 : t;
  }
  const old = player.flip;
  if (old && vis && (old.p || 0) < 1){
    const w = a => Math.atan2(Math.sin(a), Math.cos(a));
    fl.from = { x: w(vis.rotation.x), y: w(vis.rotation.y), z: w(vis.rotation.z), px: vis.position.x, py: vis.position.y, pz: vis.position.z };
  }
  player.flip = fl;
  return fl;
}

/* How far down into the slide he is: sitting back into it over the first fifth, riding it, then rising out over the last
   third in one smooth curve (no corner where the lean lets go). */
const slideHold = p => { const a = clamp(p / 0.2, 0, 1), b = clamp((p - 0.68) / 0.32, 0, 1); return a * a * (3 - 2 * a) * (1 - b * b * (3 - 2 * b)); };

/* how far through its flip `fl` is. A RUSHED flip (rushFlip) runs out its remaining turn over `rush.w` instead. */
const flipP = fl => fl.rush ? clamp(fl.rush.p0 + (1 - fl.rush.p0) * (fl.t - fl.rush.t0) / fl.rush.w, 0, 1) : clamp(fl.t / fl.dur, 0, 1);
/* An air attack (the aerial cut, the jump attack) fired mid-flip: rather than dropping the flip (the body would unwind
   backwards out of it, reading as the flip restarting), the flip carries on and finishes its somersault over the
   attack's wind-up, `w` seconds plus a beat for every bit of turn left. Returns the time it takes, 0 with no flip. */
export function rushFlip(w){
  const fl = player.flip;
  if (!fl || player.grounded) return 0;
  const p0 = fl.p || 0;
  if (p0 >= 0.97){ player.flip = null; player.vis.rotation.set(0, 0, 0); player.vis.position.set(0, 0, 0); return 0; }
  const dur = w + 0.14 * (1 - p0);
  fl.rush = { p0, t0: fl.t, w: dur };
  return dur;
}
/* WHOLE-BODY FLIP — advance the flip and pose `vis`, rotating about the centre of mass (not the feet), so a
   somersault reads as a body turning in the air instead of a plank swinging off its heels. */
export function flipBody(dt, vis, fl){
  fl.t += dt;
  const p = flipP(fl);
  if (p >= 1){ vis.rotation.set(0, 0, 0); vis.position.set(0, 0, 0); player.flip = null; return; }
  // the captured flip's turn (anim/mocap.js): a real flip turns slowly off the ground, whips round and eases into the
  // landing; otherwise a symmetric ease
  const cap = mocapFlip(fl);
  const e = cap ? flipTurn(cap, p) : fl.ease === 'twirl' ? twirlEase(p) : flipEase(p);
  const arc = Math.sin(Math.PI * p);
  const s = fl.side || 1;
  // a tilt or bank that gets there early and stays through the middle; a slide drops in fast (a runner sits into it
  // in about a sixth of a second), holds, and rises out at the end
  const hold = fl.legs === 'kneeslide' ? slideHold(p) : Math.sqrt(arc);
  const rx = (fl.somer || 0) * TAU * e + (fl.pitch || 0) * hold;
  const ry = ((fl.spin || 0) + (fl.twist || 0)) * s * TAU * (fl.twist && !fl.spin ? clamp((e - 0.15) / 0.7, 0, 1) : e);
  const rz = (fl.roll || 0) * s * TAU * e + ((fl.tilt || 0) + (fl.bank || 0)) * s * hold;
  vis.rotation.set(rx, ry, rz);
  // turning in place about the hips means moving the feet: rotate the centre of mass back to where it started
  const piv = (fl.somer || fl.roll || fl.legs === 'kneeslide') ? COM : fl.spin ? COM * 0.55 : 0;
  _v.set(0, piv, 0).applyEuler(_e.set(rx, ry, rz));
  vis.position.set(-_v.x, piv - _v.y + (fl.lift || 0) * arc, -_v.z);
  if (fl.from){   // the flip this one cut short, easing out over its first fifth
    const k = 1 - clamp(p / 0.2, 0, 1), o = k * k * (3 - 2 * k), f = fl.from;
    vis.rotation.x += f.x * o; vis.rotation.y += f.y * o; vis.rotation.z += f.z * o;
    vis.position.x += f.px * o; vis.position.y += f.py * o; vis.position.z += f.pz * o;
  }
  fl.p = p; fl.env = arc; fl.hold = hold;
}

/* ---------------- legs ---------------- */
// leg shapes: [L hip, L knee, R hip, R knee, splay]. − hip = thigh forward, + knee = the shin folds back (a bend).
const LEGS = {
  tuck:   [-1.75, 2.2, -1.6, 2.25, 0.08],
  pike:   [-1.55, 0.08, -1.5, 0.08, 0.04],
  layout: [0.12, 0.12, 0.18, 0.2, 0.02],
  split:  [-1.15, 0.25, 0.65, 0.35, 0.3],
  stride: [-0.7, 1.0, 0.4, 0.55, 0.1],
  slide:  [-0.95, 0.9, 0.62, 0.18, 0.28],
  float:  [-0.35, 0.65, -0.12, 0.4, 0.06],
  hurdle: [-1.45, 1.35, 0.5, 0.95, 0.04],
  reach:  [-0.42, 0.5, -0.12, 0.28, 0.08],
  kneel:  [-1.25, 1.45, 0.25, 2.25, 0.18],   // the R (back) knee goes down: a superhero landing
  kneeslide: [-0.95, 2.15, -0.3, 0.04, 0.3],   // a sprint slide: the right leg straight out along the ground, the left knee out and its shin folded under the lead leg, a baseball slide
};
function poseLegs(R, dr, shape, w, rate){
  const [lh, lk, rh, rk, sp] = shape;
  R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  lh * w, rate);
  R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, lk * w, rate);
  R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  rh * w, rate);
  R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, rk * w, rate);
  R.legL.hip.rotation.z  = dr(R.legL.hip.rotation.z, -sp * w, rate);
  R.legR.hip.rotation.z  = dr(R.legR.hip.rotation.z,  sp * w, rate);
}
const mixLegs = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/* The slide's legs: the lead leg shoots out first, the trailing leg folds under a beat behind it, and on the way out the
   folded leg unfolds first to plant the foot. `shape` is the slide's [L hip, L knee, R hip, R knee, splay]. */
function slideLegs(R, dr, p, w, shape = LEGS.kneeslide){
  const fold = w * smoothK(clamp((p - 0.04) / 0.2, 0, 1)) * (1 - smoothK(clamp((p - 0.6) / 0.3, 0, 1)));
  const lead = w;
  poseLegs(R, dr, [shape[0] * fold, shape[1] * fold, shape[2] * lead, shape[3] * lead, shape[4]], 1, 20);
  // the lead foot flexes, toes up, the heel skimming the floor (set after the ankles' own pass: jediAgilityPost)
  player._ankPose = [0.9 * fold, -0.7 * lead];
}
const smoothK = k => k * k * (3 - 2 * k);

/* ---------------- the wall-run ---------------- */
const WALL_STRIDE = 12.5;   // rad/s the legs cycle at: about three foot-plants over the longest run
/* The wall-run's pose weight and geometry, kept a moment after the run ends so the body eases off the wall (and eases
   onto it) instead of snapping. `wx` is where the wall is across the body: +1 on his left (the free-hand side), -1 on
   his right (the weapon side). null when there's none of it left. */
export function wallState(dt, dr){
  const wr = player.wallRun;
  let W = player._wall;
  if (wr){
    if (!W) W = player._wall = { w: 0, wx: 0, t: 0 };
    const c = Math.cos(player.faceYaw), sn = Math.sin(player.faceYaw);
    W.wx = clamp(-(wr.nx * c - wr.nz * sn), -1, 1);
    W.t = wr.t;
    W.w = dr(W.w, 1, 11);
  } else if (W){
    W.w = dr(W.w, 0, 9);
    if (W.w < 0.01) W = player._wall = null;
  }
  return W;
}
/* Feet on the wall, one then the other: each leg cycles a stride, swinging forward with the knee lifted, then planting
   and driving back. The leg on the wall side reaches out to meet it; the far leg stays under the body. */
function wallLegs(dr, R, W){
  const ph = W.t * WALL_STRIDE, side = Math.sign(W.wx) || 1;
  const leg = (off, onWall) => {
    const s = Math.sin(ph + off), c = Math.cos(ph + off);
    return [-0.32 - 0.62 * s, 0.5 + 0.95 * Math.max(0, c), (onWall ? 0.2 : -0.04) * side];
  };
  const l = leg(0, side > 0), r = leg(Math.PI, side < 0);   // (legL is the body's left, the wall side when wx > 0)
  const w = W.w;
  R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  l[0] * w, 24);
  R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, l[1] * w, 24);
  R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  r[0] * w, 24);
  R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, r[1] * w, 24);
  R.legL.hip.rotation.z  = dr(R.legL.hip.rotation.z, -l[2] * w, 24);
  R.legR.hip.rotation.z  = dr(R.legR.hip.rotation.z, -r[2] * w, 24);
  player._ankPose = [-0.1 * w, -0.1 * w];
}

/* JEDI LEGS off the ground (and through a flip): returns true when it posed them. */
export function jediAirLegs(dt, dr, R){
  const A = agilityOf();
  const fl = player.flip;
  const W = wallState(dt, dr);
  if (W && W.w > 0.02 && !fl && !player.slamming && !player.hang && !player.airCut && !player.gliding){ wallLegs(dr, R, W); return true; }
  if (fl && (!player.slamming || fl.rush)){   // (a flip rushed into a jump attack plays out through its wind-up)
    // shape opens at take-off and landing, closes through the middle; a held tuck (Djem So leap) stays closed
    const env = fl.tuckHold ? Math.min(1, Math.sin(Math.PI * flipP(fl)) * 2.2) : fl.legs === 'kneeslide' ? (fl.hold || 0) : Math.pow(fl.env || 0, 0.6);
    // the captured flip's own legs where its shape is the one the style asks for (a tucked back or front flip, a
    // tucked roll, an aerial's split); a pike or layout keeps its authored shape
    const cap = !fl.tuckHold && mocapFlip(fl), legs = fl.legs || 'tuck';
    const capLegs = cap && (cap === MOCAP_MOVES.side ? legs === 'split' || legs === 'tuck' : legs === 'tuck');
    if (capLegs){
      const m = cap === MOCAP_MOVES.front ? MOCAP_MOVES.back : cap;   // (a front tuck folds like a back tuck)
      poseLegs(R, dr, flipLegs(m, flipP(fl)), 1, 22);
    } else if (fl.legs === 'kneeslide') slideLegs(R, dr, flipP(fl), env);
    else poseLegs(R, dr, mixLegs(LEGS.reach, LEGS[legs] || LEGS.tuck, env), 1, 22);
    return true;
  }
  if (player.grounded) return false;
  if (player.hang){ poseLegs(R, dr, LEGS.float, 1, 10); return true; }   // hanging: legs loose against the face
  if (player.slamming){ poseLegs(R, dr, player.slamWind > 0 ? LEGS.tuck : LEGS[A.slam.legs] || LEGS.tuck, player.slamWind > 0 ? 1 : 0.7, 14); return true; }
  // the AERIAL CUT (jedi/aerial.js): a running stride through the wind-up, then the lead knee drives into the dash
  if (player.airCut && player.airCut.phase !== 'fall' && !player.flip){ poseLegs(R, dr, player.airCut.phase === 'wind' ? LEGS.stride : LEGS.hurdle, 1, 18); return true; }
  if (player.gliding){
    poseLegs(R, dr, player.vy > 1 ? LEGS.hurdle : (LEGS[A.glide.legs] || LEGS.float), A.glide.legs === 'tuck' && player.vy <= 1 ? 0.75 : 1, 7);
    return true;
  }
  // a plain jump: the captured jump's legs (anim/mocap.js), unless the style turns a twist through a tuck
  if (MOCAP_ON && !player._airSpin){
    poseLegs(R, dr, [...mocapAirLegs(airPhase(player._vy0, player.vy), player._vy0), 0.05], 1, 16);
    return true;
  }
  // otherwise it reads its phase off the vertical speed: drive the knee on the way up, tuck at the top, reach down
  const vy = player.vy;
  const up = clamp((vy - 1) / 6, 0, 1), down = clamp((-vy - 2) / 6, 0, 1);
  const top = LEGS.tuck.map(v => v * A.jump.tuck * 0.8);
  const shape = up > 0 ? mixLegs(top, LEGS.hurdle.map(v => v * 0.75), up) : mixLegs(top, LEGS.reach, down);
  poseLegs(R, dr, shape, 1, 11);
  return true;
}

/* which agility guard the saber hand(s) take right now (an AIR_GUARDS key), and how quickly */
export function jediAgilityArms(running){
  const A = agilityOf();
  // WIND-UP — the blade raised high overhead in both hands before the jump attack comes down; drawn back low and level
  // for the aerial cut's dash
  if (player.slamWind > 0) return { key: 'windup', rate: 3.2 };
  if (player.airCut && player.airCut.phase !== 'fall') return { key: 'cock', rate: 3.2 };
  if (player.slamLandT > 0) return { key: A.slam.land, rate: 2.4 };
  if (player.slamming) return { key: A.slam.arms, rate: 2.4 };
  if (player.hang) return { key: 'hang', rate: 3 };   // both hands up on the lip
  if (player.flip) return { key: player.flip.arms, rate: player.flip.arms === 'slide' ? 5 : 2.2 };
  if (player._wall && player._wall.w > 0.05) return { key: player._wall.wx > 0 ? 'wallO' : 'wallW', rate: 5 };
  if (!player.grounded){
    if (player.gliding) return { key: player.vy > 1 ? A.rise.arms : A.glide.arms, rate: 1.2 };
    return { key: A.jump.arms, rate: 1.6 };
  }
  if (running) return { key: A.run.arms, rate: 1 };
  return null;
}

/* ---------------- after the arms: whole-body touches that must win over the guard's damping ---------------- */
export function jediAgilityPost(dt, dr, vis, R, ctx){
  const A = agilityOf();
  // take-off: an Ataru tap jump turns a full twist through its tuck (a pure visual — no flip state, no physics)
  if (!player.grounded && player._agiGrounded && player.vy > 5 && !player.flip && !player.gliding && !player.slamming && A.jump.spin)
    player._airSpin = { t: 0, dur: 0.56, side: player.moveVel.x * Math.cos(G.yaw) - player.moveVel.z * Math.sin(G.yaw) > 0 ? -1 : 1 };
  player._agiGrounded = player.grounded;
  if (player.flip || player.slamming || player.grounded) player._airSpin = null;
  if (player.flip && (!player.slamming || player.flip.rush)) flipBody(dt, vis, player.flip);
  else if (player._airSpin){
    const sp = player._airSpin; sp.t += dt;
    const p = clamp(sp.t / sp.dur, 0, 1);
    vis.rotation.y = twirlEase(p) * TAU * A.jump.spin * sp.side;
    if (p >= 1){ vis.rotation.y = 0; player._airSpin = null; }
  } else if (!player.slamming){
    vis.position.x = dr(vis.position.x, 0, 14); vis.position.z = dr(vis.position.z, 0, 14);
  }
  // the slide's and the wall-run's ankles (the ankles' own pass runs before this, and would point the toes)
  if (player._ankPose){ R.legL.ank.rotation.x = dr(R.legL.ank.rotation.x, player._ankPose[0], 18); R.legR.ank.rotation.x = dr(R.legR.ank.rotation.x, player._ankPose[1], 18); player._ankPose = null; }
  // saber holstered: no guard to carry the arms, so the slide and the wall-run pose them directly
  if (player.holstered) bareArms(dr, R);
  // after a slam: the knee goes down and the blade (or palm) stays planted, then he rises out of it
  slamLanding(dt, dr, R, A.slam.kneel, ctx.inten);
  // a driven slide (Djem So's dash) sinks the hips through the move
  if (player.flip && player.flip.drop) player._agiDrop = Math.max(player._agiDrop, player.flip.drop * (player.flip.hold ?? Math.sqrt(player.flip.env || 0)));
  // the run: hips swing with the legs and the shoulders counter them; the free hand pumps (sway.off in animateArms)
  const run = player.grounded && !player.flip && player.atkT <= 0 && !ctx.planted ? clamp(ctx.inten, 0, 1.2) : 0;
  const tw = Math.sin(ctx.ph) * run * (A.run.twist || 1);
  if (!(player._gait && player._gait.body)){   // (the motion-captured stride turns the hips and shoulders itself)
    R.hips.rotation.y = dr(R.hips.rotation.y, tw * 0.16, 16);
    if (run > 0.05 && player.castT <= 0) R.torso.rotation.y = -tw * 0.24;
  }
}

/* Arms of a bare-handed slide or wall-run. armR is the body's right, so swinging out is +y on it, -y on armL. */
function bareArms(dr, R){
  const W = player._wall, sl = player.flip && player.flip.legs === 'kneeslide';
  const arm = (A, x, y, e) => { A.sh.rotation.x = dr(A.sh.rotation.x, x, 16); A.sh.rotation.y = dr(A.sh.rotation.y, y, 16); A.el.rotation.x = dr(A.el.rotation.x, e, 16); };
  if (sl){
    arm(R.armR, -1.0, 0.45, -0.7);    // up and out in front for balance
    arm(R.armL, 1.15, -0.45, -0.1);   // the free hand propped behind on the ground
  } else if (W && W.w > 0.3){
    const wallLeft = W.wx > 0;
    arm(R.armL, wallLeft ? -1.0 : -0.3, wallLeft ? 0.2 : -1.15, wallLeft ? -0.9 : -0.3);   // wall side: in and forward; far side: thrown wide
    arm(R.armR, wallLeft ? -0.3 : -1.0, wallLeft ? 1.15 : -0.2, wallLeft ? -0.3 : -0.9);
  }
}

function slamLanding(dt, dr, R, kneel, inten){
  if (player._agiSlam && !player.slamming && player.grounded) player.slamLandT = SLAM_LAND_T;
  player._agiSlam = player.slamming;
  if (!(player.slamLandT > 0)) { player._agiDrop = dr(player._agiDrop || 0, 0, 8); return; }
  player.slamLandT -= dt;
  const k = 1 - clamp(player.slamLandT / SLAM_LAND_T, 0, 1);
  const w = Math.min(1, k * 6) * (k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1) * kneel * (1 - clamp(inten, 0, 1) * 0.8);
  poseLegs(R, dr, LEGS.kneel, w, 30);
  player._agiDrop = 0.42 * w;
  for (const L of [R.legL, R.legR]) L.ank.rotation.x = -(L.hip.rotation.x + L.knee.rotation.x) * 0.9;
}
export const SLAM_LAND_T = 0.62;

/* how far the body pitches over in a slam dive (about the feet, as before: the dive is short and straight down) */
export function slamPitch(){
  return G.hero === 'mando' ? MANDO_AGILITY.slam.pitch : agilityOf().slam.pitch;
}

/* landing depth/recovery multipliers for the current hero/form (locomotion's touchdown curve reads these) */
export function landingStyle(){
  if (G.hero === 'mando') return MANDO_AGILITY.land;
  return agilityOf().land;
}

/* ---------------- MANDO ---------------- */
/* The Mando's whole-body moves (data/mobility.js MANDO_MOBILITY), posed about the hips and lowered to the floor:
   DIVE — the Helldivers leap with a Max Payne lay-out, the way you press: off the ground and flat in the air
          (face-down forward, on his back backward, on his side left or right), down on the plate with a skid, then up
          off one knee. No somersaults.
   SLIDE — feet first into base: leaning back, the lead leg out straight, the other folded under, hips near the floor. */
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const DIVE_LEGS = [0.12, 0.28, 0.06, 0.45, 0.14];     // laid out behind in the throw, knees soft
const DIVE_LEGS_BACK = [-0.55, 0.85, -0.3, 0.55, 0.16];   // on his back: knees up, boots toward the target
const GETUP_LEGS = [-1.2, 1.9, 0.15, 1.5, 0.18];      // one knee planted, pushing up
const BASE_LEGS = [-0.95, 2.1, -0.3, 0.04, 0.3];      // the right leg out, the left folded under (the body leans back on top)
function mandoBody(dt, dr, vis, R, fl){
  fl.t += dt;
  const p = clamp(fl.t / fl.dur, 0, 1);
  if (fl.kind === 'dive' && !fl.landT && fl.t > 0.08 && player.grounded) fl.landT = fl.t;   // the plate hits the deck
  const D = MANDO_MOBILITY.dive, upT = fl.landT ? fl.t - fl.landT - D.skid : -1;   // into the get-up
  if (p >= 1 || (fl.kind === 'slide' && !(player.slideT > 0)) || (fl.kind === 'dive' && upT >= D.getup)){
    vis.rotation.set(0, 0, 0); vis.position.set(0, 0, 0); player.flip = null; return;
  }
  let pitch = 0, bank = 0, low, legs, lw = 1, drop;
  if (fl.kind === 'dive'){
    // Helldivers leap, Max Payne lay-out: no somersaults. He pushes off into real air (mando/mobility.js gives the
    // jump), squared to the reticle, and lays out flat the way he dives (FORWARD face-down, BACK on his back with his
    // boots toward the target, LEFT / RIGHT on his side, head first), held high through the flight. When the plate
    // hits the deck the body drops the rest of the way (the impact), skids, then gets up off one knee. Smooth curves
    // throughout: tipping over through the take-off, the drop at touchdown, easing back up.
    // He stays squared to the reticle, so turning it mid-air rolls the lay-out round the way he's flying: dive left,
    // look left and he comes over onto his back (the dive's world way against where the body faces, eased).
    if (fl.dx != null){
      const sy = Math.sin(player.faceYaw), cy = Math.cos(player.faceYaw);
      fl.df = dr(fl.df, fl.dx * sy + fl.dz * cy, D.turn);
      fl.dr = dr(fl.dr, -fl.dx * cy + fl.dz * sy, D.turn);
    }
    const flat = upT < 0 ? smooth(fl.t / D.layout) : 1 - smooth(upT / D.getup);
    pitch = (fl.df >= 0 ? D.tilt.fwd : D.tilt.back) * fl.df * flat;
    bank = D.tilt.side * fl.dr * flat;
    pitch -= D.tilt.sideUp * fl.dr * fl.dr * flat;   // a side dive lies a little on its back, chest to the target
    // in the air the body lies at chest height; at touchdown it comes down onto the plate
    const hit = fl.landT ? smooth((fl.t - fl.landT) / D.impact) : 0;
    low = flat * (D.airDrop + (1 - D.airDrop) * hit); drop = COM - D.hips;
    legs = upT < 0 ? mixLegs(DIVE_LEGS, DIVE_LEGS_BACK, smooth(clamp((-fl.df - 0.2) / 0.6, 0, 1))) : GETUP_LEGS;
    lw = upT < 0 ? flat : Math.sin(Math.PI * clamp(upT / D.getup, 0, 1));
  } else {
    const S = MANDO_MOBILITY.slide;
    const sp = Math.hypot(player.moveVel.x, player.moveVel.z);
    if (sp > 1) fl.face = Math.atan2(player.moveVel.x, player.moveVel.z);   // the skid steers: keep facing it
    const hold = smooth(p / 0.2) * (1 - smooth((p - 0.66) / 0.34));
    pitch = -S.lean * hold;
    bank = -S.roll * hold;   // onto the left hip, the free side, the way a runner slides into base
    low = hold; drop = COM - S.hips;
    slideLegs(R, dr, p, hold, BASE_LEGS);
  }
  // turn about the hips, then bring them down toward the floor
  vis.rotation.set(pitch, 0, bank);
  _v.set(0, COM, 0).applyEuler(_e.set(pitch, 0, bank));
  vis.position.set(-_v.x, COM - _v.y - drop * low, -_v.z);
  if (legs) poseLegs(R, dr, legs, lw, 20);
  // the visor stays on the reticle through the lay-out, however it's rolled
  if (fl.kind === 'dive') headToReticle(R, mandoAimPoint(), dt, 18);
}

/* After the Mando pose: the dive and the slide pose the whole body (mandoBody), the rocket boost becomes a
   thruster-shoved skid, a hop tucks the knees, ignition snaps the legs together under the pack, and a jet slam drops
   into a three-point landing. Arms stay with the weapon code. */
export function mandoAgilityPost(dt, dr, vis, R, f, r){
  const M = MANDO_AGILITY;
  if (player.flip && !player.slamming) mandoBody(dt, dr, vis, R, player.flip);
  if (player._ankPose){ R.legL.ank.rotation.x = dr(R.legL.ank.rotation.x, player._ankPose[0], 18); R.legR.ank.rotation.x = dr(R.legR.ank.rotation.x, player._ankPose[1], 18); player._ankPose = null; }
  if (player.slamming) poseLegs(R, dr, LEGS.tuck, player.slamWind > 0 ? 1 : 0.35, player.slamWind > 0 ? 12 : 18);   // knees up in the wind-up, braced near-straight for the impact
  slamLanding(dt, dr, R, M.slam.kneel, 0);
  if (player.grounded && player.dashT > 0 && !player.slamming && !player.flip){
    // ROCKET BOOST — he drops, the lead leg reaches into the skid and the trail leg drags
    const vx = player.vel.x, vz = player.vel.z;
    const sp = Math.hypot(vx, vz) || 1;
    const vF = (vx*f.x + vz*f.z) / sp, vR = (vx*r.x + vz*r.z) / sp;
    const w = clamp(sp / 12, 0, 1);
    const side = Math.abs(vR) > Math.abs(vF);
    poseLegs(R, dr, side ? [-0.5, 0.95, 0.35, 0.3, 0.42] : (vF >= 0 ? LEGS.slide : [0.35, 0.3, -0.85, 1.0, 0.2]), w, 22);
    player._agiDrop = Math.max(player._agiDrop || 0, M.dodge.drop * w);
  }
  // a hop is an airborne stint that started without the jets; lighting them ends it
  if (player.grounded || player.jetActive || player.hovering || player.boosting || player.slamming || player.flip) player._hop = false;
  else if (player._agiGrounded) player._hop = true;
  player._agiGrounded = player.grounded;
  if (player._hop){
    // a plain HOP (or coasting off the jets): knees come up, then reach for the ground
    const down = clamp((-player.vy - 1) / 6, 0, 1);
    poseLegs(R, dr, mixLegs(LEGS.tuck.map(v => v * M.hop.tuck), LEGS.reach, down), 1, 10);
  } else if (player.jetActive && !player.boosting){
    // IGNITION / CLIMB — legs straight and together under the pack, toes pointed (Boba Fett on the rise)
    const climb = clamp(player.vy / 8, 0, 1);
    poseLegs(R, dr, mixLegs([-0.06, 0.22, 0.14, 0.42, 0.02], [0.02, 0.05, 0.08, 0.12, 0.0], climb), 1, 9);
  }
}
