// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mandalorian gun holds, Din Djarin style: blasters ride low at the hip until he shoots, then snap up one-handed
// (point-shooting down the arm at the reticle); the disruptor is shouldered with the off hand on the foregrip.
// Same chest-space IK as the saber (anim/ik.js); visual only, bolts still leave from muzzleOrigin() in weapons.js.

import * as THREE from 'three';
import { solveArm, aimHeld, pointInChest } from './ik.js';
import { DIM } from '../model/rig.js';

const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
const _aim = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();
const POLE_R = new THREE.Vector3(0.6, -0.8, -0.1).normalize(), POLE_L = new THREE.Vector3(-0.6, -0.8, -0.1).normalize();
const LOW_DIR = new THREE.Vector3(0.05, -0.75, 0.66).normalize();

/* per-gun live state: how "drawn" it is (0 hip → 1 aimed), smoothed so the draw is a fast snap, the re-holster slow */
const draw = { R: 0, L: 0, rifle: 0 };

/* the reticle point (world) → a unit aim direction from a shoulder, in chest space */
function aimFrom(chest, shoulder, worldPoint, out){
  chest.updateWorldMatrix(true, false);
  out.copy(worldPoint).applyMatrix4(_m.copy(chest.matrixWorld).invert());
  return out.sub(shoulder).normalize();
}

/* One pistol arm. side: 'R' (gun hand) or 'L' (off-hand gun). drawn: 0..1. recoil kicks the hand up and back. */
function pistolArm(R, arm, gun, aimDir, k, recoil, pole){
  const sh = arm.sh.position;
  const sx = Math.sign(sh.x);
  // hip: a low ready by the holster, muzzle angled at the ground ahead
  const hip = _h.set(0.24 * sx, -0.42, 0.16);
  // drawn: arm nearly straight down the aim line from the shoulder (point shooting), recoil lifts it
  const reach = DIM.upper + DIM.fore - 0.04 - recoil * 0.12;
  _p.copy(sh).addScaledVector(aimDir, reach);
  _p.y += recoil * 0.06;
  hip.lerp(_p, k);
  solveArm(arm, hip, pole);
  arm.wr.updateWorldMatrix(true, false);
  _d.copy(LOW_DIR).lerp(aimDir, k).normalize();
  _d.y += recoil * 0.5; _d.normalize();          // muzzle flip
  aimHeld(R.chest, arm.wr, gun, Z, _d, 0.3, Y, Y);
}

/* SINGLE or DUAL blasters. firing/aiming → draw; idle → back to the hip.
   mode.braced (RMB, aimed fire): both guns stay drawn down the aim line; the single blaster's off arm comes up as
   the gauntlet-shield arm. mode.backRun (running away from the reticle): only one hand draws, the chest twists that
   shoulder back toward the target and the head turns to it, while the legs keep running the other way. The single
   blaster always shoots back with the gun hand; dual blasters shoot back with whichever hand is on the target's
   side (player.backHand, which weapons.js fires from). */
export function pistolPose(dt, R, player, worldAim, dual, mode = {}){
  const { braced, backRun } = mode;
  const hot = braced || player.firing || player.aiming > 0 || player.zoom;
  const twoGuns = dual && !backRun;
  player.backHand = backRun && dual ? backHand(R, worldAim, player.backHand) : 'R';
  const backL = player.backHand === 'L';
  const tgtR = hot && !backL ? 1 : 0, tgtL = hot && (twoGuns || backL) ? 1 : 0;
  draw.R += (tgtR - draw.R) * Math.min(1, dt * (tgtR > draw.R ? 22 : 4));   // quick draw, unhurried re-holster
  draw.L += (tgtL - draw.L) * Math.min(1, dt * (tgtL > draw.L ? (backL ? 22 : 18) : 4));
  // gunslinger blade-on: the gun shoulder turns toward the target when one-handed
  const side = backL ? -1 : 1, k = backL ? draw.L : draw.R;
  const twist = backRun ? backTwist(R, worldAim, side) * k : (twoGuns ? 0 : -0.32 * draw.R);
  R.chest.rotation.y += (twist - R.chest.rotation.y) * Math.min(1, dt * 12);
  if (backRun) lookAtAim(dt, R, worldAim, k, side);
  const rec = player.recoil || 0;
  const fired = player.firePistol || 1;   // dual: the gun that just fired kicks
  const aimR = aimFrom(R.chest, R.armR.sh.position, worldAim, _aim);
  if (backRun) overShoulder(aimR, 1);
  pistolArm(R, R.armR, player.pistols.R, aimR, draw.R, twoGuns ? (fired < 0 ? rec : rec * 0.3) : backL ? 0 : rec, POLE_R);
  if (dual){
    const aimL = aimFrom(R.chest, R.armL.sh.position, worldAim, _aim);
    if (backRun) overShoulder(aimL, -1);
    pistolArm(R, R.armL, player.pistols.L, aimL, draw.L, backRun ? (backL ? rec : 0) : fired > 0 ? rec : rec * 0.3, POLE_L);
  } else if (braced){
    // shield arm: forearm up across the chest, fist forward, behind the gauntlet's energy disc
    solveArm(R.armL, _h.set(-0.14, 0.08, 0.42), POLE_L);
    R.armL.wr.quaternion.identity();
  } else {
    // free hand: relaxed by the belt, a little out from the body
    solveArm(R.armL, _h.set(-0.3, -0.44, 0.08 + draw.R * 0.06), POLE_L);
    R.armL.wr.quaternion.identity();
  }
}

/* The target's bearing in `node`'s frame, measured round from the front toward `side` (+1 the gun hand's side, -1
   the off hand's): 0 ahead, π/2 square to that shoulder, π dead behind. It wraps on the far side (past -π/2), never
   behind, so a target near dead behind reads as about π, not as π on one frame and -π on the next (which used to
   swing the chest and the helmet from one shoulder to the other as the crosshair drifted across). */
function sideBearing(node, worldAim, side, from = null){
  node.updateWorldMatrix(true, false);
  _p.copy(worldAim).applyMatrix4(_m.copy(node.matrixWorld).invert());
  if (from) _p.sub(from);
  const a = Math.atan2(_p.x * side, _p.z);
  return a < -Math.PI / 2 ? a + Math.PI * 2 : a;
}

/* Dual back-run: shoot back with the hand on the target's side. Changes hands only once the target is well across
   the line behind him, so a target dead behind doesn't flick the guns from hand to hand. */
function backHand(R, worldAim, cur){
  const g = sideBearing(R.torso, worldAim, 1);   // ≈ π dead behind; more = round toward the off hand
  if (cur === 'L') return g < Math.PI - 0.3 ? 'R' : 'L';
  return g > Math.PI + 0.3 ? 'L' : 'R';
}

/* Running away while shooting: how far the chest turns (rig y) so the shooting shoulder faces the target behind. A
   real torso only twists so far; the gun arm and the head make up the rest. */
function backTwist(R, worldAim, side){
  return side * THREE.MathUtils.clamp(sideBearing(R.torso, worldAim, side) - Math.PI / 2, -0.35, 0.95);
}
/* ...and the helmet turns to the reticle, over the shooting shoulder (k fades it in with the draw). */
function lookAtAim(dt, R, worldAim, k, side){
  const a = sideBearing(R.chest, worldAim, side, R.head.position);
  const yaw = side * Math.min(a, 1.4) * k;
  R.head.rotation.y += (yaw - R.head.rotation.y) * Math.min(1, dt * 14);
}
/* A gun arm can only reach so far round behind: past ~150° from the chest's front it would swing through the back,
   so the arm stops there and points back over the shoulder (bolts still fly from muzzleOrigin to the reticle). */
const BEHIND_MAX = 2.6;
function overShoulder(dir, side){
  let a = Math.atan2(dir.x * side, dir.z);
  if (a < -Math.PI / 2) a += Math.PI * 2;
  if (a <= BEHIND_MAX) return dir;
  const flat = Math.hypot(dir.x, dir.z);
  dir.x = Math.sin(BEHIND_MAX) * flat * side; dir.z = Math.cos(BEHIND_MAX) * flat;
  return dir;
}

/* DISRUPTOR shouldered: gun hand by the weapon-side collarbone, rifle down the aim line, off hand on the foregrip. */
export function riflePose(dt, R, player, worldAim){
  draw.rifle += (1 - draw.rifle) * Math.min(1, dt * 14);
  R.chest.rotation.y += (-0.38 - R.chest.rotation.y) * Math.min(1, dt * 10);   // bladed behind the stock
  const dir = aimFrom(R.chest, _p.set(0.1, 0.3, 0), worldAim, _aim);
  const rec = player.recoil || 0;
  _h.set(0.13, 0.17 - rec * 0.05, 0.2 - rec * 0.1).addScaledVector(dir, 0.08);
  solveArm(R.armR, _h, POLE_R);
  R.armR.wr.updateWorldMatrix(true, false);
  _d.copy(dir); _d.y += rec * 0.35; _d.normalize();
  aimHeld(R.chest, R.armR.wr, player.rifleMesh, Z, _d, 0.25, Y, Y);
  // off hand under the barrel, about a forearm out from the trigger hand
  pointInChest(R.chest, player.rifleMesh, _p.set(0, 0.06, 0.42), _h);
  solveArm(R.armL, _h, _p.set(-0.3, -0.9, 0.1).normalize());
  R.armL.wr.quaternion.identity();
}
export function rifleLowered(){ draw.rifle = 0; }

/* hand a gun back to its mount rotation (when an FK pose — brace, flight, punch — owns the arm) */
export function restGun(gun, dt){
  if (!gun) return;
  if (!gun.userData.restQ) gun.userData.restQ = gun.quaternion.clone();
  gun.quaternion.slerp(gun.userData.restQ, Math.min(1, dt * 14));
}
export function rememberRest(gun){ if (gun && !gun.userData.restQ) gun.userData.restQ = gun.quaternion.clone(); }
