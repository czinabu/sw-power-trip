// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Agility animation: flips, dash twirls and slides, jump phases, the Force leap and glide, dives, landings and the
// run's counter-twist, per form (data/agility.js). Presentation only: nothing here moves the hero or changes a
// timer the game reads; it poses `vis` and the rig while movement.js and locomotion.js do the moving.

import * as THREE from 'three';
import { clamp } from '../../utils.js';
import { G, player } from '../../state.js';
import { AGILITY, MANDO_AGILITY } from '../../data/agility.js';
import { FORM_OF } from '../../data/poses.js';

const TAU = Math.PI * 2;
const COM = 1.12;   // centre of mass above the feet in the hero group's space (rig hips × model scale): flips turn here
const _e = new THREE.Euler(), _v = new THREE.Vector3();

export const formNow = () => FORM_OF[G.stance] || 'niman';
export const agilityOf = (form = formNow()) => AGILITY[form] || AGILITY.niman;

/* The style a move uses for the current form: kind = dash | evade | wall | double, dir = side | fwd | back. */
export function flipStyle(kind, dir){
  const A = agilityOf()[kind];
  return { ...(dir ? (A[dir] || A.fwd || A.back) : A) };
}

const flipEase = p => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;   // hangs at take-off and landing, whips through the tuck
const twirlEase = p => 0.5 - 0.5 * Math.cos(Math.PI * p);

/* WHOLE-BODY FLIP — advance the flip and pose `vis`, rotating about the centre of mass (not the feet), so a
   somersault reads as a body turning in the air instead of a plank swinging off its heels. */
export function flipBody(dt, vis, fl){
  fl.t += dt;
  const p = clamp(fl.t / fl.dur, 0, 1);
  if (p >= 1){ vis.rotation.set(0, 0, 0); vis.position.set(0, 0, 0); player.flip = null; return; }
  const e = fl.ease === 'twirl' ? twirlEase(p) : flipEase(p);
  const arc = Math.sin(Math.PI * p);
  const s = fl.side || 1;
  const hold = Math.sqrt(arc);   // a tilt or bank that gets there early and stays through the middle
  const rx = (fl.somer || 0) * TAU * e + (fl.pitch || 0) * hold;
  const ry = ((fl.spin || 0) + (fl.twist || 0)) * s * TAU * (fl.twist && !fl.spin ? clamp((e - 0.15) / 0.7, 0, 1) : e);
  const rz = (fl.roll || 0) * s * TAU * e + ((fl.tilt || 0) + (fl.bank || 0)) * s * hold;
  vis.rotation.set(rx, ry, rz);
  // turning in place about the hips means moving the feet: rotate the centre of mass back to where it started
  const piv = (fl.somer || fl.roll) ? COM : fl.spin ? COM * 0.55 : 0;
  _v.set(0, piv, 0).applyEuler(_e.set(rx, ry, rz));
  vis.position.set(-_v.x, piv - _v.y + (fl.lift || 0) * arc, -_v.z);
  fl.p = p; fl.env = arc;
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

/* JEDI LEGS off the ground (and through a flip): returns true when it posed them. */
export function jediAirLegs(dt, dr, R){
  const A = agilityOf();
  const fl = player.flip;
  if (fl && !player.slamming){
    // shape opens at take-off and landing, closes through the middle; a held tuck (Djem So leap) stays closed
    const env = fl.tuckHold ? Math.min(1, Math.sin(Math.PI * clamp(fl.t / fl.dur, 0, 1)) * 2.2) : Math.pow(fl.env || 0, 0.6);
    poseLegs(R, dr, mixLegs(LEGS.reach, LEGS[fl.legs] || LEGS.tuck, env), 1, 22);
    return true;
  }
  if (player.grounded) return false;
  if (player.slamming){ poseLegs(R, dr, LEGS[A.slam.legs] || LEGS.tuck, 0.7, 14); return true; }
  if (player.gliding){
    poseLegs(R, dr, player.vy > 1 ? LEGS.hurdle : (LEGS[A.glide.legs] || LEGS.float), A.glide.legs === 'tuck' && player.vy <= 1 ? 0.75 : 1, 7);
    return true;
  }
  // a plain jump reads its phase off the vertical speed: drive the knee on the way up, tuck at the top, reach down
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
  if (player.slamLandT > 0) return { key: A.slam.land, rate: 2.4 };
  if (player.slamming) return { key: A.slam.arms, rate: 2.4 };
  if (player.flip) return { key: player.flip.arms, rate: 2.2 };
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
  if (player.flip && !player.slamming) flipBody(dt, vis, player.flip);
  else if (player._airSpin){
    const sp = player._airSpin; sp.t += dt;
    const p = clamp(sp.t / sp.dur, 0, 1);
    vis.rotation.y = twirlEase(p) * TAU * A.jump.spin * sp.side;
    if (p >= 1){ vis.rotation.y = 0; player._airSpin = null; }
  } else if (!player.slamming){
    vis.position.x = dr(vis.position.x, 0, 14); vis.position.z = dr(vis.position.z, 0, 14);
  }
  // after a slam: the knee goes down and the blade (or palm) stays planted, then he rises out of it
  slamLanding(dt, dr, R, A.slam.kneel, ctx.inten);
  // a driven slide (Djem So's dash) sinks the hips through the move
  if (player.flip && player.flip.drop) player._agiDrop = Math.max(player._agiDrop, player.flip.drop * Math.sqrt(player.flip.env || 0));
  // the run: hips swing with the legs and the shoulders counter them; the free hand pumps (sway.off in animateArms)
  const run = player.grounded && !player.flip && player.atkT <= 0 && !ctx.planted ? clamp(ctx.inten, 0, 1.2) : 0;
  const tw = Math.sin(ctx.ph) * run * (A.run.twist || 1);
  R.hips.rotation.y = dr(R.hips.rotation.y, tw * 0.16, 16);
  if (run > 0.05 && player.castT <= 0) R.torso.rotation.y = -tw * 0.24;
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
/* After the Mando pose: the ground dodge becomes a thruster-shoved slide, a hop tucks the knees, ignition snaps the
   legs together under the pack, and a jet slam drops into a three-point landing. Arms stay with the weapon code. */
export function mandoAgilityPost(dt, dr, vis, R, f, r){
  const M = MANDO_AGILITY;
  if (player.slamming) poseLegs(R, dr, LEGS.tuck, 0.6, 14);
  slamLanding(dt, dr, R, M.slam.kneel, 0);
  if (player.grounded && player.dashT > 0 && !player.slamming){
    // DODGE — the jets shove him: he drops, the lead leg reaches into the slide and the trail leg skids
    const vx = player.vel.x, vz = player.vel.z, sp = Math.hypot(vx, vz) || 1;
    const vF = (vx*f.x + vz*f.z) / sp, vR = (vx*r.x + vz*r.z) / sp;
    const w = clamp(sp / 12, 0, 1);
    const side = Math.abs(vR) > Math.abs(vF);
    poseLegs(R, dr, side ? [-0.5, 0.95, 0.35, 0.3, 0.42] : (vF >= 0 ? LEGS.slide : [0.35, 0.3, -0.85, 1.0, 0.2]), w, 22);
    player._agiDrop = Math.max(player._agiDrop || 0, M.dodge.drop * w);
  }
  // a hop is an airborne stint that started without the jets; lighting them ends it
  if (player.grounded || player.jetActive || player.hovering || player.boosting || player.slamming) player._hop = false;
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
