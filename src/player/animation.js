// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Player animation: stance posture, body facing, flips, and the rig pose (legs, torso, arms, Force cast, Mando weapon/flight poses).

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { clamp, dampAngle, V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, G, player } from '../state.js';
import { MANDO } from '../data/mando.js';
import { stance } from './helpers.js';
import { tryAttack, applySwingDamage } from './jedi/combat.js';
import { mandoAimPoint, mandoWeapon, mandoShielding } from './mando/weapons.js';
import { DARK_DUR } from './mando/darksaber.js';
import { FORM_OF, FOOTWORK } from '../data/poses.js';
import { pistolPose, riflePose, rifleLowered, restGun } from './anim/guns.js';
import { MIRROR } from './model/rig.js';
import { saberPose, guardPose, swingPose, applySaberPose, releaseSaberPose, airGuard } from './anim/saber.js';
import { jediAirLegs, jediAgilityArms, jediAgilityPost, mandoAgilityPost, landingStyle, slamPitch } from './anim/agility.js';

export function animatePlayer(dt, pp, st, f, r, moving){
  const dr = (cur, tgt, l) => cur + (tgt - cur) * Math.min(1, l*dt);
  // --- stance posture: distinct footwork & carriage, read even at a standstill ---
  // settled = idle or blocking (not mid-swing / flip / slam / channel)
  // planted = settled AND holding ground (standing still or block-walking) — drives footwork
  const settled = player.atkT <= 0 && !player.flip && !player.slamming && player.judgeT <= 0;
  const planted = settled && player.grounded && (!moving || player.blockHeld);
  const POSE = footwork();

  const vis = player.vis, R = player.rig;
  poseBody(dt, dr, vis, planted, POSE, moving);
  const { ph, inten, gait } = animateLegsAndTorso(dt, dr, R, planted, POSE);
  animateArms(dt, dr, vis, R, st, planted, moving, ph, inten, gait);
  animateForceCast(dt, dr, R);
  // agility (anim/agility.js) poses flips, dives and landings after the arms, so the guard's damping can't blunt them
  if (G.hero !== 'mando') jediAgilityPost(dt, dr, vis, R, { ph, inten, planted });
  if (G.hero === 'mando'){ animateMandoPose(dt, dr, vis, R, pp, f, r); mandoAgilityPost(dt, dr, vis, R, f, r); }
  secondaryMotion(dt, vis, R);
  player.arcMesh.material.opacity = Math.max(0, player.arcMesh.material.opacity - dt*4);

  // saber hum swells with the action
  if (shared.humGain) shared.humGain.gain.value = (G.mode === 'play' && G.hero === 'jedi') ? 0.025 + (player.atkT > 0 ? 0.05 : 0) + (player.blockHeld ? 0.02 : 0) : 0;
}

// Body facing, plus the whole-body moves: slam dive, flips/twirls, and the Jedi's lean into velocity.
function poseBody(dt, dr, vis, planted, POSE, moving){
  // --- body facing ---
  // The MANDO is a third-person SHOOTER: he ALWAYS squares to the camera/crosshair and strafes around it, so
  // walking + tapping fire never snaps his body between "facing movement" and "facing aim". The JEDI instead
  // turns to face his movement direction when roaming free (and squares up only in combat).
  // The one exception: running AWAY from the reticle he turns and runs like the Jedi does (backRun), shooting back
  // over his shoulder one-handed (anim/guns.js) instead of backpedalling square to the camera.
  const mandoAimLock = G.hero === 'mando' && (player.aiming > 0 || player.zoom || player.firing);
  const inCombatPose = player.atkT > 0 || player.dashT > 0 || player.blockHeld || player.judgeT > 0 || player.castT > 0 || mandoAimLock;
  player.backRun = mandoBackRun();
  let face = G.yaw;
  if ((G.hero !== 'mando' && !inCombatPose && moving) || player.backRun)
    face = Math.atan2(player.moveVel.x, player.moveVel.z);
  player.faceYaw = dampAngle(player.faceYaw, face, player.backRun ? 13 : (inCombatPose || G.hero === 'mando') ? 26 : 11, dt);
  player.group.rotation.y = player.faceYaw;

  if (player.slamming){
    // --- aerial slam DIVE: a committed forward tuck plunging straight down. NO spin (vis.rotation.y stays put) so
    // it can't leave the body twisted off-axis on landing — it must come down clean & square.
    vis.rotation.x = dr(vis.rotation.x, slamPitch(), 12);   // each form drops its own way (data/agility.js)
    vis.rotation.y = dr(vis.rotation.y, 0, 14);
    vis.rotation.z = dr(vis.rotation.z, 0, 14);
    vis.position.y = dr(vis.position.y, 0, 10);
  } else if (player.flip){
    // acrobatic flips, twirls and slides: posed per form in anim/agility.js (flipBody), after the arms
  } else if (G.hero !== 'mando') {
    // --- lean into velocity (relative to body facing) --- JEDI ONLY.
    // (The Mando's body rotation is fully driven by the flight/ground pose block below; running this too would
    //  fight it each frame and the two damped writes settle at a half-lean instead of the intended flat prone.)
    const ffx = Math.sin(player.faceYaw), ffz = Math.cos(player.faceYaw);
    const lf = player.moveVel.x*ffx + player.moveVel.z*ffz;
    const lr = player.moveVel.x*(-ffz) + player.moveVel.z*ffx;
    const leanG = (stance().gait && stance().gait.lean) || 1;   // FAST leans eagerly into the run; STRONG runs upright & heavy
    vis.rotation.x = dr(vis.rotation.x, lf*0.024*leanG + (planted ? POSE.lean : 0), 9);
    vis.rotation.z = dr(vis.rotation.z, lr*0.018*leanG, 9);   // bank INTO the strafe (was inverted — leaned the wrong way)
    vis.position.y = dr(vis.position.y, 0, 10);
  }

}

// Is the Mando running away from the reticle? Only on foot with nothing else claiming the body (RMB aim, scope, a
// swing, dash, stab, punch, flame); it kicks in past ~120° off the aim line and lets go near a pure strafe, so
// circling the reticle doesn't flicker between the two.
function mandoBackRun(){
  if (G.hero !== 'mando' || !player.grounded || player.flip || player.slamming) return false;
  if (player.blockHeld || player.zoom || player.atkT > 0 || player.dashT > 0 || player.stabT > 0 || player.meleeT > 0 || player.darkT > 0 || player.flaming) return false;
  const vx = player.moveVel.x, vz = player.moveVel.z, sp = Math.hypot(vx, vz);
  if (sp < 1) return false;
  const along = (vx * Math.sin(G.yaw) + vz * Math.cos(G.yaw)) / sp;   // +1 toward the reticle, -1 straight away
  return player.backRun ? along < -0.15 : (sp > 2 && along < -0.5);
}

// Legs (stride, air tuck, stance splay, front kick), hips/robe, breathing and head look.
function animateLegsAndTorso(dt, dr, R, planted, POSE){
  /* ================= rig animation ================= */
  const hSpeed = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  player.runPhase += hSpeed * dt * 1.7;
  const ph = player.runPhase;
  const inten = clamp(hSpeed / CFG.player.speed, 0, 1.2);
  // PER-STANCE GAIT — same skeleton, different run: FAST is light & high-kneed, STRONG is long & planted (mando = neutral)
  const gait = (G.hero === 'mando' || !stance().gait) ? { amp: 1, lift: 1, bob: 0.35 } : stance().gait;

  // TOUCHDOWN — the knees soak a landing (harder falls sink deeper), then spring back up
  if (player.grounded && player._wasGrounded === false){
    const LS = landingStyle();   // Djem So sinks deep and rises slow; Ataru lands soft and springs straight back up
    player.landDur = LAND_T / (LS.spring || 1);
    player.landT = player.landDur; player.landAmt = clamp(0.3 + (player.landDip || 0) * 1.6, 0.3, 1) * (LS.depth || 1);
    if (player.landAmt > 0.45 && !player.slamming){   // a real drop kicks up a ring of dust at the feet
      const pp = player.group.position;
      for (let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2;
        burst(V3(pp.x + Math.cos(a)*0.45, pp.y + 0.08, pp.z + Math.sin(a)*0.45), 0x8f8578, 1, 2.5 * player.landAmt, 0.6, 0.9); }
    }
  }
  player._wasGrounded = player.grounded;
  if (player.landT > 0) player.landT -= dt;
  const land = player.landT > 0 ? Math.sin((1 - player.landT / (player.landDur || LAND_T)) * Math.PI) * player.landAmt : 0;
  player._land = land;
  // legs: stride + knee lift; the Jedi's air, flip and dive legs come from anim/agility.js
  if (G.hero !== 'mando' && jediAirLegs(dt, dr, R)){
    // posed: jump phases, Force leap and glide, flip tuck/pike/layout, slam dive
  } else if (player.grounded && !player.flip){
    const lead = planted ? POSE.lead : 0;   // bladed/staggered footing when planted, neutral when moving
    // a swing steps into the cut: the off-side foot drives forward, the back leg loads
    const step = (player._swingDrop || 0) * 2.2;
    // the JEDI's stride runs backwards when he moves away from where he faces (backing off in his guard)
    const q = ph * (G.hero !== 'mando' && strideBack() ? -1 : 1);
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  Math.sin(q) * 0.55 * inten * gait.amp - lead - step - land*0.5, 14);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x, -Math.sin(q) * 0.55 * inten * gait.amp + lead + step*0.6 - land*0.35, 14);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, -Math.max(0, -Math.sin(q - 0.4)) * 0.9 * inten * gait.lift - step*0.8 - land*0.95, 14);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, -Math.max(0,  Math.sin(q - 0.4)) * 0.9 * inten * gait.lift - step*1.1 - land*0.8, 14);
  } else if (player.airDive){
    // PRONE flight — legs DEAD STRAIGHT and in line with the torso so the whole body reads as one long flat plank.
    // Forward superman: legs trail straight back (hip ~0). Reclined back-fall: feet kick out front.
    const backFall = player.airDive === 3;
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  backFall ? -0.6 : 0.0, 10);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  backFall ? -0.5 : 0.0, 10);
    R.legL.hip.rotation.z  = dr(R.legL.hip.rotation.z,  0.04, 10);   // a hair of splay so the legs read as two, not one
    R.legR.hip.rotation.z  = dr(R.legR.hip.rotation.z, -0.04, 10);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, -0.04, 10);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, -0.04, 10);
  } else if (G.hero === 'mando' && !player.grounded){
    // UPRIGHT JETPACK — legs hang loose under the pack, one a touch ahead of the other, trailing as you lean
    const trail = (player._airLean || 0) * 0.6;
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  -0.06 + trail + Math.sin(G.gt * 1.3) * 0.04, 6);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,   0.14 + trail, 6);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, -0.22 - trail * 0.5, 6);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, -0.42 - trail * 0.6, 6);
  } else {
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  -0.5, 8);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  -0.35, 8);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, -1.0, 8);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, -0.9, 8);
  }
  // stance width — feet splay out for the wide STRONG guard, stay close for FAST
  if (player.grounded && !player.flip){
    const lsp = land * (landingStyle().splay || 0);   // a heavy landing spreads the feet
    R.legL.hip.rotation.z = dr(R.legL.hip.rotation.z, (planted ? -POSE.splay : 0) - lsp, 9);
    R.legR.hip.rotation.z = dr(R.legR.hip.rotation.z, (planted ?  POSE.splay : 0) + lsp, 9);
  } else if (G.hero === 'mando' && !player.airDive){
    R.legL.hip.rotation.z = dr(R.legL.hip.rotation.z, 0, 9);
    R.legR.hip.rotation.z = dr(R.legR.hip.rotation.z, 0, 9);
  }
  // ANKLES — feet stay planted flat on the ground under the leg angles; in the air the toes point
  for (const L of [R.legL, R.legR]){
    const flat = -(L.hip.rotation.x + L.knee.rotation.x) * 0.9;
    L.ank.rotation.x = dr(L.ank.rotation.x, player.grounded && !player.flip ? flat : 0.45, 14);
  }
  // JEDI FRONT KICK — the right leg SNAPS forward (hard-set, overriding the stride pose above) and the torso leans
  // back to counterweight it. `ext` is a 0→1→0 envelope so the leg shoots out and recovers within kickT.
  if (G.hero !== 'mando' && player.kickT > 0){
    const ext = Math.sin((1 - clamp(player.kickT / (player.kickMax || 0.4), 0, 1)) * Math.PI);
    R.legR.hip.rotation.x  = -1.55 * ext;
    R.legR.knee.rotation.x = -0.1 - (1 - ext) * 0.7;
    R.legL.knee.rotation.x = -0.28 * ext;
    R.torso.rotation.x = -0.22 * ext;
  }
  // hips bob + robe flare with speed; crouch lowers the center of gravity per stance
  player._crouch = dr(player._crouch || 0, planted ? POSE.crouch : 0, 8);
  R.hips.position.y = 1.04 + player._crouch - (player._swingDrop || 0) - land*0.2 - (player._agiDrop || 0) + (player.grounded ? Math.abs(Math.sin(ph)) * 0.05 * inten : 0.05);
  R.skirt.rotation.x = dr(R.skirt.rotation.x, 0.13 * inten, 8);   // Jedi-only robe (hidden for the Mando)
  R.skirt.rotation.z = dr(R.skirt.rotation.z, Math.sin(ph) * 0.05 * inten, 8);
  // robe FLARE reads the stance silhouette: wide for DJEM SO, slim for ATARU (relaxes toward neutral while running)
  const skirtW = planted ? (POSE.width || 1) : 1;
  R.skirt.scale.x = dr(R.skirt.scale.x, skirtW, 7);
  R.skirt.scale.z = dr(R.skirt.scale.z, skirtW, 7);
  // breathing — z-lunge and torso twist relax here; the swing block overrides them when active
  // idle breathing + a stride-synced run bob (two dips per stride at the footfalls) — STRONG stomps heaviest, FAST springs lightest
  R.torso.position.y = 0.16 + Math.sin(G.gt * 1.7) * 0.012 - Math.abs(Math.sin(ph)) * 0.05 * inten * (gait.bob || 0.35);
  R.torso.position.z = dr(R.torso.position.z, 0, 11);
  R.torso.rotation.y = dr(R.torso.rotation.y, 0, 11);
  // the master's gaze tracks the camera even when the body doesn't
  const lookDiff = ((G.yaw - player.faceYaw + Math.PI*3) % (Math.PI*2)) - Math.PI;
  if (!player.backRun) R.head.rotation.y = dr(R.head.rotation.y, clamp(lookDiff, -0.7, 0.7) * MIRROR, 10);   // (running away: anim/guns.js turns it to the target)
  if (G.hero !== 'mando') R.head.rotation.x = dr(R.head.rotation.x, 0, 9);   // JEDI level head; the Mando pose drives its own head pitch (don't fight it)
  return { ph, inten, gait };
}

// Arms: saber swings, guard/parry, idle and run carriage.
// Bladed weapons (the Jedi saber in either grip, the Mando's darksaber) are posed by anim/saber.js from the guards
// and swing keyframes in data/poses.js; Force gestures, Mend and Judgement stay plain joint poses here.
function animateArms(dt, dr, vis, R, st, planted, moving, ph, inten, gait){
  const held = heldBlade();
  const form = FORM_OF[G.hero === 'mando' ? 'darksaber' : G.stance] || 'niman';
  const grip = form === 'darksaber' ? 'regular' : (G.saberGrip === 'reverse' ? 'reverse' : 'regular');
  if (player.atkT > 0){
    // saber swing: the keyframed cut for this form, grip and direction
    player.atkT -= dt;
    const sw = player.swing;
    sw.t += dt;
    // (no blade in hand — e.g. the weapon was swapped mid-swing — just run the swing's clock out)
    const cue = held ? swingPose(R, held, grip, form, sw) : { k: Math.min(1, sw.t / sw.dur), env: 0, cut: 0, spin: 0, hop: 0, drop: 0 };
    if (held) applySaberPose(R, held, player.castT <= 0);
    // the body turns with the blade; a finisher spins all the way round (Ataru leaps into it)
    const turn = Math.sign(sw.pat.yT - sw.pat.yF);
    if (!player.flip){
      if (cue.spin) vis.rotation.y = easeInOut(cue.cut) * Math.PI * 2 * cue.spin * (turn || 1);
      else vis.rotation.y = cue.env * st.twist * turn * 0.55;
      if (cue.hop) vis.position.y = Math.sin(Math.PI * cue.k) * cue.hop;
    }
    // drive in on the strike: the weapon shoulder reaches, the hips sink for the power forms
    R.torso.position.z = dr(R.torso.position.z, cue.env * 0.12 * (sw.riposte ? 1.6 : 1), 14);
    R.torso.rotation.y = dr(R.torso.rotation.y, 0, 12);
    vis.rotation.x = dr(vis.rotation.x, saberPose.lean, 14);
    player._swingDrop = cue.drop * cue.env;
    if (!sw.applied && cue.k > 0.35){ sw.applied = true; applySwingDamage(sw.step); }
    if (player.atkT <= 0){
      player.lastAtkEnd = G.gt;
      vis.rotation.y = 0;
      player._swingDrop = 0;
      if (player.queuedAtk){ player.queuedAtk = false; tryAttack(); }   // buffered combo
    }
    return;
  }
  player._swingDrop = 0;
  if (player.mendT > 0){
    // FORCE MEND channel — both hands drawn in over the heart, gathering the Force inward (a clear wind-up)
    releaseSaberPose(R, dt);
    const k = 1 - clamp(player.mendT / (player.mendMax || 0.7), 0, 1);   // 0→1 as the channel completes
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.15, 16);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.55, 16);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.25, 16);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.15, 16);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, -0.55, 16);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.25, 16);
    vis.rotation.x = dr(vis.rotation.x, 0.12 - k*0.04, 12);   // hunch in, then straighten as it releases
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else if (G.hero !== 'mando' && player.judgeT > 0 && !player.blockHeld){
    // left palm forward, lightning pouring from the fingers; the saber drops to a low trailing guard
    releaseSaberPose(R, dt);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.5, 12);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.15, 12);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.1, 12);
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.2, 10);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.4, 10);
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else if (held){
    // GUARD — each form holds its own recognizable ready guard, and its own block (data/poses.js)
    const blocking = player.blockHeld;
    // a moving hero isn't a statue — the guard rides the stride a little (the shape still reads)
    const sway = { y: moving && !blocking ? Math.sin(ph * 2) * 0.025 * inten : Math.sin(G.gt * 1.9) * 0.01,
                   z: moving && !blocking ? Math.sin(ph) * 0.04 * inten * gait.amp : 0, off: 0 };
    // AGILITY guards: flips hug the hilt in or open the arms, the dive cocks or plunges the blade, the run carries it
    // the form's way with the free hand pumping against the stride (data/agility.js AIR_GUARDS)
    const running = G.hero !== 'mando' && moving && !planted && player.grounded && inten > 0.5;
    const ag = G.hero !== 'mando' ? jediAgilityArms(running) : null;
    const over = ag && airGuard(grip, form, ag.key);
    if (running && over){ sway.z = -Math.sin(ph) * 0.05 * inten; sway.off = Math.sin(ph) * 0.17 * inten * ((stance().gait && stance().gait.amp) || 1); }
    const body = guardPose(dt, R, held, grip, form, blocking, sway, over, ag ? ag.rate : 1);
    // a free off hand swings with the stride when running (two-handed guards keep it on the hilt)
    applySaberPose(R, held, player.castT <= 0);
    R.torso.rotation.y = dr(R.torso.rotation.y, planted ? body.torso : 0, 9);
    if (blocking || planted) vis.rotation.x = dr(vis.rotation.x, saberPose.lean + (planted ? footwork().lean : 0), 12);
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else {
    releaseSaberPose(R, dt);
  }
}

// the bladed weapon in hand right now (or null): the Jedi saber, or the Mando's darksaber when it's equipped
function heldBlade(){
  if (G.hero !== 'mando') return player.saberHand ? { node: player.saberHand, root: player.saberBladeRoot } : null;
  if (player.weapon === 'darksaber' && player.darksaberMesh) return { node: player.darksaberMesh, root: null };
  return null;
}
// moving away from the way the body faces (more than sideways)?
function strideBack(){
  const ffx = Math.sin(player.faceYaw), ffz = Math.cos(player.faceYaw);
  return player.moveVel.x*ffx + player.moveVel.z*ffz < -0.6 * Math.hypot(player.moveVel.x, player.moveVel.z) - 0.3;
}
export function footwork(){
  return FOOTWORK[(G.hero === 'mando' && player.weapon === 'darksaber') ? 'darksaber' : (FORM_OF[G.stance] || 'niman')];
}
const _IDQ = new THREE.Quaternion();
const LAND_T = 0.34;
const easeInOut = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;

function animateForceCast(dt, dr, R){
  // --- force-cast gesture: the off-hand reaches out to project the power ---
  if (player.castT > 0){
    player.castT -= dt;
    const r = clamp(player.castT / player.castMax, 0, 1);
    const pk = Math.sin(r * Math.PI);                 // 0→1→0 envelope
    const pulling = player.castKind === 'pull';
    const out = pulling ? r : pk;                     // pull: extended at the start, then claws back
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.55, 20);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, pulling ? -0.05 : 0.12, 20);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.12 - (1 - out) * (pulling ? 1.35 : 0.18), 20);
    const lean = player.castKind === 'push' ? 0.26 : pulling ? -0.06 : 0.16;
    R.torso.position.z = dr(R.torso.position.z, lean * pk, 18);
    R.torso.rotation.y = dr(R.torso.rotation.y, 0.16 * pk, 18);
  }
}

function animateMandoPose(dt, dr, vis, R, pp, f, r){
  // --- MANDO pose: hold the weapon out toward the reticle; weapon-specific poses ---
  player.recoil = Math.max(0, (player.recoil || 0) - dt*1.2);
  const w = player.weapon, twoH = (w === 'disruptor');
  // RE-CENTER the body twist when idle. The swing block owns vis.rotation.y while atkT>0; the Jedi auto-recenters
  // each frame but the Mando didn't, so a CANCELED darksaber swing (RMB-guard / dash / push out of a stroke) left
  // the body twisted off-axis. Damp it back to square whenever we're not mid-swing / slam / flip.
  if (player.atkT <= 0 && !player.slamming && !player.flip) vis.rotation.y = dr(vis.rotation.y, 0, 12);
  // FREE-FLIGHT superman: hand the arms ENTIRELY to the flight pose below (running the aim pose too would
  // fight it each frame and the arms would settle half-raised instead of thrust forward).
  const _vx = player.moveVel.x + player.vel.x, _vz = player.moveVel.z + player.vel.z;
  const _spd = Math.hypot(_vx, _vz);
  const _aiming = player.zoom || player.aiming > 0 || player.blockHeld || player.firing;
  // FREE FLIGHT (the superman lay-out) is for a hard BOOST only — Boba Fett, not Superman: cruising and hovering
  // stay upright with the weapon still held (see the flight pose below).
  const flyingFree = !player.grounded && !player.slamming && !player.flip && !_aiming && player.boosting && _spd > 1.2 && w !== 'darksaber';
  // (aimed fire — RMB — stays on the IK aim too: the old joint-angle brace left the muzzles pointing at the sky)
  const gunsIK = !flyingFree && player.meleeT <= 0 && player.darkT <= 0;
  if (!flyingFree){
  if (w === 'darksaber'){
    // DARKSABER: animateArms (anim/saber.js) owns both arms — heavy two-handed guards and swings
  } else if (player.darkT > 0){
    // DARKSABER ABILITY SLASH (drawn just for the cut) — the darksaber form's heavy diagonal, keyframed like a swing
    if (!player._darkSw) player._darkSw = { t: 0, dur: DARK_DUR, step: 0, dir: 'ability', pat: { id: 'diagR' } };
    player._darkSw.t = DARK_DUR - Math.max(0, player.darkT);
    swingPose(R, { node: player.darksaberMesh, root: null }, 'regular', 'darksaber', player._darkSw);
    applySaberPose(R, { node: player.darksaberMesh, root: null }, true);
  } else if (twoH && player.stabT > 0){
    // SPEAR STAB — both arms drive the rifle forward like a pike
    const ext = Math.sin((1 - Math.max(0,player.stabT)/0.24) * Math.PI);
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.25 - ext*0.55, 22);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.1, 18);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.1, 20);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.15 - ext*0.45, 20);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.32, 16);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.45, 16);
  } else if (twoH && !player.zoom && player.aiming <= 0){
    // DISRUPTOR REST — carried low across the body; the barrel only swings OUT when you aim (RMB) or attack
    rifleLowered();
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.42, 12);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.06, 12);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.1, 12);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.95, 12);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.55, 12);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.12, 12);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.75, 12);
  } else if (gunsIK){
    // GUNSLINGER — blasters at the hip until he shoots, then up one-handed down the aim line; the disruptor shouldered
    const aimPt = mandoAimPoint();   // also refreshes the reticle lock state (player.lockOn)
    if (twoH) riflePose(dt, R, player, aimPt);
    else pistolPose(dt, R, player, aimPt, w === 'dual', { braced: player.blockHeld, backRun: player.backRun });
  } else {
    mandoAimPoint();
  }
  if (player.darkT <= 0) player._darkSw = null;
  }   // end !flyingFree (the flight pose below owns the arms during a boosted superman)
  if (!gunsIK || flyingFree || w === 'darksaber'){
    // an FK pose owns the arms: settle the guns back into their holds and the wrists square
    if (w !== 'darksaber' && player.darkT <= 0){ R.armR.wr.quaternion.slerp(_IDQ, Math.min(1, dt*12)); R.armL.wr.quaternion.slerp(_IDQ, Math.min(1, dt*12)); }
    restGun(player.pistols.R, dt); restGun(player.pistols.L, dt);
    if (w !== 'darksaber' && player.darkT <= 0) R.chest.rotation.y = dr(R.chest.rotation.y, 0, 10);
  }
  // DISRUPTOR barrel: aimed by riflePose while shouldered; otherwise lies back along the forearm at rest
  if (player.rifleMesh && !(gunsIK && twoH && (player.zoom || player.aiming > 0))){
    const out = player.zoom || player.aiming > 0 || player.stabT > 0;
    player.rifleMesh.rotation.x = dr(player.rifleMesh.rotation.x, out ? 1.15 : -0.35, 9);
    player.rifleMesh.rotation.y = dr(player.rifleMesh.rotation.y, 0, 9);
    player.rifleMesh.rotation.z = dr(player.rifleMesh.rotation.z, 0, 9);
  }
  // AIR FLIGHT POSE (docs/animation-guidelines.md: "Boba Fett, not Superman, unless boosting")
  //  • CRUISE / HOVER: upright, leaning a little into the way you travel, with small hover corrections.
  //  • BOOST: the committed lay-out — body toward horizontal (needs speed AND altitude), arms thrust ahead.
  //  • AIMING / BRACING: upright and steady, a slight tactical cant; the helmet stays level on the target.
  // Pitch/roll pivot about the torso (we lift `vis`) so a lean reads as the body tilting, not a nose-dive.
  const AIRREF = MANDO.airSpeed || 12;
  player.airDive = 0;
  if (!player.grounded && !player.slamming && !player.flip){
    const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z;
    const vF = vx*f.x + vz*f.z, vR = vx*r.x + vz*r.z;
    const pivot = 1.05;                 // ~torso height above the rig origin — rotate around here so the body lies flat
    const FLAT = Math.PI / 2;           // horizontal — 0° to the ground (full lay-out at cruise speed)
    const HEAD_UP = 0.5;                // how far above level the visor cranes when fully flat
    const speed = Math.hypot(vF, vR);
    const speedF = clamp((speed - 0.5) / 5.2, 0, 1);
    const altF = clamp((pp.y - (player.groundY || 0) - 0.5) / 4.0, 0, 1);
    const lvl = speedF * altF;
    const liftFor = a => pivot * (1 - Math.cos(a));
    if (flyingFree && lvl > 0.001){
      // BOOST — forward superman (always forward, regardless of drift)
      const pitchAmount = clamp(Math.abs(vF) / AIRREF, 0, 1);
      const pitchScale = 0.45 + (lvl * 0.30);
      const pitch = (FLAT * pitchScale) * pitchAmount * (vF >= 0 ? 1 : -1);
      vis.rotation.x = dr(vis.rotation.x, pitch, 8);
      vis.rotation.z = dr(vis.rotation.z, clamp(vR * 0.065, -0.42, 0.42), 10);
      vis.position.y = dr(vis.position.y, liftFor(pitch), 8);
      R.head.rotation.x = dr(R.head.rotation.x, -pitch - HEAD_UP*lvl, 11);     // counter the body + crane UP
      R.head.rotation.z = dr(R.head.rotation.z, 0, 11);
      player.airDive = lvl > 0.4 ? 2 : 0;
      // SUPERMAN arms — ALWAYS reach forward in WORLD space: the shoulder angle tracks the body pitch
      const armX = -1.45 - pitch * 0.9;
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, armX, 11);
      R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, 0.16, 11);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, -0.14, 11);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.22, 11);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, armX, 11);
      R.armL.sh.rotation.z = dr(R.armL.sh.rotation.z, -0.16, 11);
      R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.14, 11);
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.22, 11);
    } else {
      // UPRIGHT — lean modestly into travel, bank into a strafe, and keep making the small corrections of a
      // jetpack holding station. Aiming steadies it (less lean, a slight cant toward the gun).
      const aiming = player.zoom || player.aiming > 0 || player.blockHeld || player.firing;
      const calm = aiming ? 0.55 : 1;
      const wob = player.hovering || speed < 2 ? 1 : 0.4;
      const pitch = clamp(vF / AIRREF, -1, 1) * 0.34 * calm + Math.sin(G.gt * 2.1) * 0.03 * wob;
      const roll  = clamp(vR / AIRREF, -1, 1) * 0.3 * calm + Math.cos(G.gt * 1.7) * 0.028 * wob + (aiming ? 0.06 : 0);
      vis.rotation.x = dr(vis.rotation.x, pitch, 6);
      vis.rotation.z = dr(vis.rotation.z, roll, 6);
      vis.position.y = dr(vis.position.y, liftFor(Math.max(Math.abs(pitch), Math.abs(roll))), 8);
      R.head.rotation.x = dr(R.head.rotation.x, -pitch * 0.8, 10);   // visor stays on the horizon
      R.head.rotation.z = dr(R.head.rotation.z, -roll * 0.8 * MIRROR, 10);
      player._airLean = pitch;
    }
  } else if (!player.slamming && !player.flip){
    if (player.dashT > 0){
      // GROUND DASH = a DODGE: bank/pitch hard into the dash direction, just like the flight lean
      const vx = player.vel.x, vz = player.vel.z;   // the dash impulse dominates the velocity
      const vF = vx*f.x + vz*f.z, vR = vx*r.x + vz*r.z;
      vis.rotation.x = dr(vis.rotation.x, clamp(vF*0.05, -0.55, 0.6), 13);   // lean INTO the dash (forward / back)
      vis.rotation.z = dr(vis.rotation.z, clamp(vR*0.06, -0.7, 0.7), 13);    // bank into a side dodge
      R.head.rotation.z = dr(R.head.rotation.z, 0, 10);
    } else {
      // GROUND — a Max-Payne STRAFE LEAN (the body banks into sideways movement), plus a slight RIGHT tactical
      // tilt + a forward plant while aiming. The head counters most of the lean so the visor stays on target.
      const aimingNow = (player.blockHeld || player.zoom) && !mandoWeapon().melee && player.grounded;

      if (aimingNow) {
        // Grounded bracing — completely stable, zero lean (DO NOT CHANGE)
        vis.rotation.x = dr(vis.rotation.x, 0.0, 20);
        vis.rotation.z = dr(vis.rotation.z, 0.0, 20);
        R.head.rotation.z = dr(R.head.rotation.z, 0.0, 20);

        // (the arms are on the IK aim: pistolPose in anim/guns.js, braced)
      } else if (player.grounded) {
        // (slam landing is reset at the touchdown site above, so the body is already square here)
        const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z;
        const latV = vx*r.x + vz*r.z;
        const strafeLean = player.backRun ? 0 : clamp(latV * 0.035, -0.5, 0.5);   // running away: a straight run, no bank
        vis.rotation.x = dr(vis.rotation.x, player.backRun ? 0.06 : 0, 9);
        vis.rotation.z = dr(vis.rotation.z, strafeLean, 10);
        R.head.rotation.z = dr(R.head.rotation.z, -strafeLean * 0.65 * MIRROR, 10);
      }

      // (the gauntlet SHIELD disc is driven below, OUTSIDE the grounded branch, so it also shows mid-flight)
    }
    vis.position.y = dr(vis.position.y, 0, 10);   // settle the body height (the jedi-only lean block no longer does this for us)
    R.head.rotation.x = dr(R.head.rotation.x, 0, 9);   // level the head when grounded
  }
  // GAUNTLET PUNCH — the right arm drives a forward cross and the torso leans into it (overrides the weapon pose)
  if (player.meleeT > 0){
    const mk = 1 - clamp(player.meleeT / (player.meleeMax || 0.32), 0, 1);   // 0→1 through the punch
    const ext = Math.sin(mk * Math.PI);                                      // 0→1→0 punch envelope
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.5 - ext*0.25, 26);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, -0.12, 22);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.05, 22);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.95 + ext*0.9, 28);    // elbow snaps straight on the punch
    R.torso.position.z = dr(R.torso.position.z, ext * 0.32, 24);             // shoulder drives forward for weight
    R.torso.rotation.y = dr(R.torso.rotation.y, -ext * 0.22, 22);
  }
  // === SINGLE-BLASTER GAUNTLET SHIELD — projected energy disc on the left forearm. Driven here (not in the
  // grounded branch) so it holds whether you're standing OR flying. Flares on a catch; warns amber when stamina
  // runs low (the shield can't deflect once it's dry).
  player.isShielding = mandoShielding();
  player.shieldFlash = Math.max(0, (player.shieldFlash || 0) - dt * 3.2);
  if (player.isShielding){
    if (!player.shieldMesh){
      const sg = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40),
        new THREE.MeshBasicMaterial({ color: 0x4bd2ff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.72, 40),
        new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      // concentric "deflector web" rings — the layered energy look from the lore
      const r2 = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.40, 36),
        new THREE.MeshBasicMaterial({ color: 0x8fe0ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      const r3 = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.18, 28),
        new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      sg.add(disc, rim, r2, r3); sg.renderOrder = 6;
      player.shieldMesh = sg; player.shieldDisc = disc; player.shieldRim = rim;
      // ATTACH to the visual body (player.vis) so it tracks EVERY pose — including the flight lift/lean — instead of
      // floating at a fixed world offset. vis-local +z is the way you face (group yaw), so the disc faces the threat.
      player.vis.add(sg);
      sg.position.set(-0.12, 1.5, 0.95);   // gauntlet side, out in front of the chest
    }
    const sg = player.shieldMesh;
    const flare = player.shieldFlash, shimmer = 0.05 * Math.sin(G.gt * 9);
    sg.scale.setScalar(1 + flare * 1.5);
    const lowStam = player.stam < CFG.player.maxStam * 0.18;   // shield failing — out of juice to deflect
    player.shieldDisc.material.color.setHex(lowStam ? 0xff8a4a : 0x4bd2ff);
    player.shieldRim.material.color.setHex(lowStam ? 0xffb866 : 0x9fe6ff);
    player.shieldDisc.material.opacity = (lowStam ? 0.16 : 0.26) + shimmer + flare * 2.0;
    player.shieldRim.material.opacity  = (lowStam ? 0.4 : 0.7) + flare * 1.8;
    sg.visible = true;
  } else if (player.shieldMesh){
    player.shieldMesh.visible = false;
  }
}

/* SECONDARY MOTION — cloth that follows the body instead of being bolted to it. Each robe panel and the cape is a
   damped spring chasing a target set by how the body moves: running streams them back, a spin flares them out,
   falling lifts them, and stopping lets them swing through and settle. */
const _sv = new THREE.Vector3();
function spring(o, key, target, dt, k = 90, c = 9){
  const s = o.userData[key] || (o.userData[key] = { a: 0, w: 0 });
  const h = Math.min(dt, 1/30);
  s.w += (k * (target - s.a) - c * s.w) * h;
  s.a += s.w * h;
  return s.a;
}
function secondaryMotion(dt, vis, R){
  if (dt <= 0) return;
  const yaw = player.faceYaw + vis.rotation.y;
  const yawRate = player._lastYaw == null ? 0 : (((yaw - player._lastYaw + Math.PI*3) % (Math.PI*2)) - Math.PI) / dt;
  player._lastYaw = yaw;
  _sv.set(player.moveVel.x + player.vel.x, 0, player.moveVel.z + player.vel.z);
  const vf = _sv.x * Math.sin(yaw) + _sv.z * Math.cos(yaw);
  const vr = (_sv.x * Math.cos(yaw) - _sv.z * Math.sin(yaw)) * MIRROR;   // in the (mirrored) rig's own sideways
  const flare = Math.min(0.9, Math.abs(yawRate) * 0.06);
  const spinR = yawRate * MIRROR;          // a spin throws every panel outward
  const lift = Math.min(0.6, Math.max(0, -player.vy) * 0.03);     // falling lifts the hem
  const F = R.flaps;
  if (F && R.skirt.visible){
    // + rotates a panel's hem back toward the body's rear in its own frame (YXZ), − lifts it outward
    F.F.rotation.x = spring(F.F, 'sp', clamp(vf * 0.045, -0.5, 0.7) - flare - lift, dt);
    F.B.rotation.x = spring(F.B, 'sp', -clamp(vf * 0.06, -0.3, 0.9) - flare - lift, dt);
    F.L.rotation.x = spring(F.L, 'sp', clamp(vr * 0.05, -0.6, 0.6) - flare - lift, dt);
    F.R.rotation.x = spring(F.R, 'sp', -clamp(vr * 0.05, -0.6, 0.6) - flare - lift, dt);
  }
  // CAPE — trails behind with speed and climb, flutters when moving fast, swings out on a turn
  if (R.cape && R.cape.children.length){
    const base = R.cape.userData.base || (R.cape.userData.base = R.cape.rotation.clone());
    const climb = player.grounded ? 0 : Math.max(0, player.vy) * 0.03;
    const sp = Math.hypot(vf, vr);
    const flutter = Math.sin(G.gt * 11) * Math.min(0.08, sp * 0.006);
    const trail = clamp(Math.max(0, vf) * 0.05 + climb + lift * 0.8, 0, 1.1) + flutter;
    const sway = clamp(-vr * 0.03 - spinR * 0.04, -0.5, 0.5);
    const hem = R.cape.userData.hem;
    if (hem){
      // worn under the jetpack (model/mando.js): the top panel may only sway sideways in the gap, since any swing
      // back would put it through the pack; the hem below the pack takes the trail, never forward into the legs
      R.cape.rotation.x = base.x + clamp(spring(R.cape, 'cx', trail * 0.04, dt, 60, 7), 0, 0.04);
      R.cape.rotation.z = base.z + spring(R.cape, 'cz', sway * 0.3, dt, 60, 7);
      hem.rotation.x = clamp(spring(hem, 'hx', 0.06 + trail, dt, 60, 7), 0, 1.2);
      hem.rotation.z = spring(hem, 'hz', sway, dt, 60, 7);
    } else {
      R.cape.rotation.x = base.x + spring(R.cape, 'cx', trail, dt, 60, 7);
      R.cape.rotation.z = base.z + spring(R.cape, 'cz', sway, dt, 60, 7);
    }
  }
}
