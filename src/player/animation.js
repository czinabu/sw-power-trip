// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Player animation: stance posture, body facing, flips, and the rig pose (legs, torso, arms, Force cast, Mando weapon/flight poses).

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { clamp, dampAngle } from '../utils.js';
import { shared, G, player } from '../state.js';
import { MANDO } from '../data/mando.js';
import { stance } from './helpers.js';
import { tryAttack, applySwingDamage } from './jedi/combat.js';
import { mandoAimPoint, mandoWeapon, mandoShielding } from './mando/weapons.js';
import { DARK_DUR } from './mando/darksaber.js';

export function animatePlayer(dt, pp, st, f, r, moving){
  const dr = (cur, tgt, l) => cur + (tgt - cur) * Math.min(1, l*dt);
  // --- stance posture: distinct footwork & carriage, read even at a standstill ---
  // settled = idle or blocking (not mid-swing / flip / slam / channel)
  // planted = settled AND holding ground (standing still or block-walking) — drives footwork
  const settled = player.atkT <= 0 && !player.flip && !player.slamming && player.judgeT <= 0;
  const planted = settled && player.grounded && (!moving || player.blockHeld);
  const POSE = (G.hero === 'mando' && player.weapon === 'darksaber')
    ? { crouch: -0.16, splay: 0.4, lead: 0.16, lean: 0.16, width: 1.5 }   // DARKSABER — low, wide, aggressive duelist's stance
    : ({
    fast:   { crouch: -0.24, splay: 0.10, lead: 0.40, lean: 0.18, width: 0.86 },   // LOW aggressive crouch, slim robe, light on the feet
    medium: { crouch:  0.00, splay: 0.12, lead: 0.02, lean: 0.00, width: 1.10 },   // clean upright, balanced, square — classic guard
    strong: { crouch: -0.16, splay: 0.54, lead: -0.05, lean: 0.20, width: 1.62 },  // WIDE planted stance, robe flared, leaning into the blow
  })[G.stance];

  const vis = player.vis, R = player.rig;
  poseBody(dt, dr, vis, planted, POSE, moving);
  const { ph, inten, gait } = animateLegsAndTorso(dt, dr, R, planted, POSE);
  animateArms(dt, dr, vis, R, st, planted, moving, ph, inten, gait);
  animateForceCast(dt, dr, R);
  if (G.hero === 'mando') animateMandoPose(dt, dr, vis, R, pp, f, r);
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
  const mandoAimLock = G.hero === 'mando' && (player.aiming > 0 || player.zoom || player.firing);
  const inCombatPose = player.atkT > 0 || player.dashT > 0 || player.blockHeld || player.judgeT > 0 || player.castT > 0 || mandoAimLock;
  let face = G.yaw;
  if (G.hero !== 'mando' && !inCombatPose && moving)
    face = Math.atan2(player.moveVel.x, player.moveVel.z);
  player.faceYaw = dampAngle(player.faceYaw, face, (inCombatPose || G.hero === 'mando') ? 26 : 11, dt);
  player.group.rotation.y = player.faceYaw;

  if (player.slamming){
    // --- aerial slam DIVE: a committed forward tuck plunging straight down. NO spin (vis.rotation.y stays put) so
    // it can't leave the body twisted off-axis on landing — it must come down clean & square.
    vis.rotation.x = dr(vis.rotation.x, 0.5, 12);
    vis.rotation.y = dr(vis.rotation.y, 0, 14);
    vis.rotation.z = dr(vis.rotation.z, 0, 14);
    vis.position.y = dr(vis.position.y, 0, 10);
  } else if (player.flip){
    // --- acrobatic spins/twirls (Y), spinning flip, or legacy somersaults ---
    const fl = player.flip;
    fl.t += dt;
    const p = clamp(fl.t / fl.dur, 0, 1);
    const ease = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
    const turns = fl.turns || 1;
    const arc = Math.sin(p * Math.PI);
    if (fl.axis === 'y'){                 // dash twirl
      vis.rotation.y = fl.sign * ease * Math.PI * 2 * turns;
      vis.rotation.z = arc * (fl.lean || 0) * fl.sign;
      vis.rotation.x = arc * (fl.pitch || 0);
      vis.position.y = arc * 0.55;
    } else if (fl.axis === 'spin'){       // double-jump spinning force flip
      vis.rotation.x = fl.sign * ease * Math.PI * 2 * turns;
      vis.rotation.y = ease * Math.PI * 2 * turns;
      vis.position.y = arc * 0.7;
    } else if (fl.axis === 'backflip'){   // backward somersault (block + jump)
      vis.rotation.x = -ease * Math.PI * 2 * turns;   // tip over backwards
      vis.position.y = arc * 1.15;                    // a tall, clean arc
    } else if (fl.axis === 'x'){          // forward handspring
      vis.rotation.x = fl.sign * ease * Math.PI * 2 * turns;
      vis.position.y = arc * 1.0;
    } else {                              // side flip (cartwheel)
      vis.rotation.z = fl.sign * ease * Math.PI * 2 * turns;
      vis.rotation.x = arc * 0.12;        // a touch of pitch keeps the cartwheel from reading flat
      vis.position.y = arc * 1.0;
    }
    if (p >= 1){ vis.rotation.set(0, 0, 0); vis.position.y = 0; player.flip = null; }
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

// Legs (stride, air tuck, stance splay, front kick), hips/robe, breathing and head look.
function animateLegsAndTorso(dt, dr, R, planted, POSE){
  /* ================= rig animation ================= */
  const hSpeed = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  player.runPhase += hSpeed * dt * 1.7;
  const ph = player.runPhase;
  const inten = clamp(hSpeed / CFG.player.speed, 0, 1.2);
  // PER-STANCE GAIT — same skeleton, different run: FAST is light & high-kneed, STRONG is long & planted (mando = neutral)
  const gait = (G.hero === 'mando' || !stance().gait) ? { amp: 1, lift: 1, bob: 0.35 } : stance().gait;

  // legs: stride + knee lift, tuck in the air or during flips
  if (player.grounded && !player.flip){
    const lead = planted ? POSE.lead : 0;   // bladed/staggered footing when planted, neutral when moving
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  Math.sin(ph) * 0.55 * inten * gait.amp - lead, 14);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x, -Math.sin(ph) * 0.55 * inten * gait.amp + lead, 14);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, -Math.max(0, -Math.sin(ph - 0.4)) * 0.9 * inten * gait.lift, 14);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, -Math.max(0,  Math.sin(ph - 0.4)) * 0.9 * inten * gait.lift, 14);
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
    // LOW / SLOW FLIGHT — thighs trail BACK and the lower legs fold backward (not a knees-forward tuck)
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  0.28, 9);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  0.24, 9);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, -0.8, 9);   // calf folds back/up behind the thigh
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, -0.75, 9);
  } else {
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  -0.5, 8);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  -0.35, 8);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, -1.0, 8);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, -0.9, 8);
  }
  // stance width — feet splay out for the wide STRONG guard, stay close for FAST
  R.legL.hip.rotation.z = dr(R.legL.hip.rotation.z, planted ? -POSE.splay : 0, 9);
  R.legR.hip.rotation.z = dr(R.legR.hip.rotation.z, planted ?  POSE.splay : 0, 9);
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
  R.hips.position.y = 1.04 + player._crouch + (player.grounded ? Math.abs(Math.sin(ph)) * 0.05 * inten : 0.05);
  R.skirt.rotation.x = dr(R.skirt.rotation.x, 0.13 * inten, 8);   // Jedi-only robe (hidden for the Mando)
  R.skirt.rotation.z = dr(R.skirt.rotation.z, Math.sin(ph) * 0.05 * inten, 8);
  // robe FLARE reads the stance silhouette: wide for DJEM SO, slim for SHII-CHO (relaxes toward neutral while running)
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
  R.head.rotation.y = dr(R.head.rotation.y, clamp(lookDiff, -0.7, 0.7), 10);
  if (G.hero !== 'mando') R.head.rotation.x = dr(R.head.rotation.x, 0, 9);   // JEDI level head; the Mando pose drives its own head pitch (don't fight it)
  return { ph, inten, gait };
}

// Arms: saber swings, guard/parry, idle and run carriage.
function animateArms(dt, dr, vis, R, st, planted, moving, ph, inten, gait){
  // --- arms ---
  if (player.atkT > 0){
    // saber swing driven through the right arm, pattern chosen by movement direction
    player.atkT -= dt;
    const sw = player.swing;
    sw.t += dt;
    const k = clamp(sw.t / sw.dur, 0, 1);
    const p = sw.pat;
    // PER-STANCE SWING IDENTITY — same pattern, different body language:
    //   SHII-CHO (fast): shallow coil, light follow, a lot of WRIST — whippy flurries.
    //   NIMAN (balanced): textbook 1.0 across the board.
    //   DJEM SO (strong): a deep coil and a heavy, lingering FOLLOW-THROUGH, almost no wrist — it's all shoulder & weight.
    const coil = sw.riposte ? 0.5 : (st.swingCoil || 1);          // a riposte barely winds up — it's an instant answer
    const follow = st.swingFollow || 1, wrist = st.wristSnap || 1;
    // anticipation: coil back in the first ~30%, then explode through the cut
    const wind = k < 0.3 ? -(1 - k/0.3) * 0.4 * coil : 0;          // STRONG coils deep; FAST/riposte barely pull back
    // STRONG holds the cut a touch longer (heavier release curve); FAST snaps through (a sharper curve)
    const relExp = 0.6 / (follow > 1 ? follow : 1) * (wrist > 1 ? 0.85 : 1);
    const rel = k < 0.3 ? 0 : Math.pow((k-0.3)/0.7, relExp);       // accelerating release, shaped by the form
    const punch = Math.sin(k * Math.PI);                          // 0→1→0 reach/whip envelope
    const turn = Math.sign(p.yT - p.yF);                          // which way the cut travels (R→L = -1, L→R = +1)
    // RIGHT ARM drives the blade — shoulder sweep + raise + roll, elbow whip, wrist snap
    R.armR.sh.rotation.y = p.yF + (p.yT - p.yF) * rel + wind * Math.sign(p.yF || 1);
    R.armR.sh.rotation.x = p.xF + (p.xT - p.xF) * rel - punch * 0.25 * follow;   // STRONG drops the shoulder deeper through the cut
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, p.zF + (p.zT - p.zF) * rel, 16);
    R.armR.el.rotation.x = -(0.95 - punch * (0.85 + p.reach));    // elbow extends hard mid-swing
    R.armR.el.rotation.y = dr(R.armR.el.rotation.y, (p.zT - p.zF) * 0.4 * rel, 14);
    // wrist snaps the saber through the arc — FAST whips with the wrist, STRONG barely rolls it
    player.saberHand.rotation.x = dr(player.saberHand.rotation.x, 0.15 + punch * 0.5 * wrist, 16);
    player.saberHand.rotation.z = p.wF + (p.wT - p.wF) * rel;
    player.saberHand.rotation.y = dr(player.saberHand.rotation.y, punch * 0.55 * turn * wrist, 16);   // wrist yaw snaps the way the cut travels
    // the whole right shoulder punches forward so the strike reads as a reaching lunge — STRONG/riposte drive in harder
    R.torso.position.z = dr(R.torso.position.z, punch * p.reach * 0.35 * (sw.riposte ? 1.5 : follow), 14);
    // torso COILS toward the start side, then UNWINDS through the cut — sells left vs right
    R.torso.rotation.y = dr(R.torso.rotation.y, turn * (-0.28 * (1 - rel) + 0.5 * rel), 16);
    // off-hand counterbalances the cut
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.4 - punch * 0.5, 13);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.25 + punch * 0.2, 13);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.4 - punch * 0.3, 13);
    if (!player.flip){
      if (sw.dir === 'neutral' && sw.step === 2) vis.rotation.y = rel * Math.PI * 2;   // only the neutral combo finisher does a full spin
      else vis.rotation.y = punch * st.twist * turn;                                    // directional swings turn the body the way the blade travels
    }
    if (!sw.applied && k > 0.35){ sw.applied = true; applySwingDamage(sw.step); }
    if (player.atkT <= 0){
      player.lastAtkEnd = G.gt;
      vis.rotation.y = 0;
      if (player.queuedAtk){ player.queuedAtk = false; tryAttack(); }   // buffered combo
    }
  } else if (player.mendT > 0){
    // FORCE MEND channel — both hands drawn in over the heart, gathering the Force inward (a clear wind-up)
    const k = 1 - clamp(player.mendT / (player.mendMax || 0.7), 0, 1);   // 0→1 as the channel completes
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.15, 16);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.55, 16);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.25, 16);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.15, 16);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, -0.55, 16);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.25, 16);
    vis.rotation.x = dr(vis.rotation.x, 0.12 - k*0.04, 12);   // hunch in, then straighten as it releases
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else if (G.hero !== 'mando' && player.blockHeld){
    // guard pose differs per form — nimble one-hander, balanced two-hander, or a braced wall (JEDI only;
    // the Mando block below fully owns the Mando's arms — running these too would fight & dilute its poses)
    let b;
    if (G.stance === 'fast'){
      // SHII-CHO: quick one-handed high guard, blade slashed across at an angle, off-hand free & trailing
      b = { rShx:-1.78, rShy:-0.12, rShz:0.34, rElx:-0.5, sabx:-0.55, sabz:0.85,
            lShx:-0.15, lShy:-0.42, lElx:-0.7, lean:0.04, twist:-0.2 };
    } else if (G.stance === 'strong'){
      // DJEM SO: heavy committed two-hander, blade angled low & defensive, leaning HARD into the impact
      b = { rShx:-1.38, rShy:-0.55, rShz:-0.34, rElx:-0.5, sabx:-1.5, sabz:0.2,
            lShx:-1.32, lShy:0.55, lElx:-0.5, lean:0.32, twist:0.0 };
    } else {
      // NIMAN: clean balanced two-handed guard, blade vertical before the chest
      b = { rShx:-1.45, rShy:-0.45, rShz:-0.1, rElx:-0.3, sabx:-1.25, sabz:0.0,
            lShx:-1.2, lShy:0.5, lElx:-0.4, lean:0.07, twist:0.0 };
    }
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, b.rShx, 14);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, b.rShy, 14);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, b.rShz, 14);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, b.rElx, 14);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, b.lShx, 14);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, b.lShy, 14);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, b.lElx, 14);
    player.saberHand.rotation.x = dr(player.saberHand.rotation.x, b.sabx, 14);
    player.saberHand.rotation.z = dr(player.saberHand.rotation.z, b.sabz, 14);
    R.torso.rotation.y = dr(R.torso.rotation.y, b.twist, 12);
    vis.rotation.x = dr(vis.rotation.x, b.lean, 12);
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else if (G.hero !== 'mando' && player.judgeT > 0){
    // left palm forward, lightning pouring from the fingers
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.5, 12);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.15, 12);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.1, 12);
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.2, 10);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.4, 10);
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else if (G.hero !== 'mando'){
    // stance-flavored ready pose — each form holds a distinct, recognizable guard at rest (JEDI only)
    const breath = Math.sin(G.gt*1.9)*0.04;
    let a;
    if (G.stance === 'fast'){
      // SHII-CHO: low aggressive guard, saber carried forward & down, blade-side shoulder leading
      a = { rShx:-0.52, rShy:0.55, rShz:0.06, rElx:-0.35, sabx:0.95, sabz:-0.1,
            lShx:0.2, lShy:-0.3, lElx:-0.6, twist:-0.28 };
    } else if (G.stance === 'strong'){
      // DJEM SO: heavy high guard — saber held up & out to the right, tip skyward (not across the body)
      a = { rShx:-1.05, rShy:-0.95, rShz:-0.5, rElx:-1.2, sabx:0.15, sabz:-0.35,
            lShx:-0.45, lShy:0.3, lElx:-0.85, twist:0.05 };
    } else {
      // NIMAN: classic upright ready, saber held at a natural angle before the body
      a = { rShx:-0.42, rShy:0.05, rShz:-0.12, rElx:-0.5, sabx:0.25, sabz:-0.4,
            lShx:-0.05, lShy:0.0, lElx:-0.25, twist:0.04 };
    }
    // a moving Jedi isn't a statue — the saber arm sways gently in counter to the stride (subtle, the guard still reads)
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, a.rShx + breath + (moving ? Math.sin(ph) * 0.13 * inten * gait.amp : 0), 9);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, a.rShy, 8);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, a.rShz, 8);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, a.rElx, 8);
    R.armR.el.rotation.y = dr(R.armR.el.rotation.y, 0, 8);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, (moving ? -Math.sin(ph) * 0.5 * inten * gait.amp : a.lShx + breath), 10);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, a.lShy, 8);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, a.lElx, 8);
    player.saberHand.rotation.x = dr(player.saberHand.rotation.x, a.sabx, 8);
    player.saberHand.rotation.z = dr(player.saberHand.rotation.z, a.sabz, 8);
    player.saberHand.rotation.y = dr(player.saberHand.rotation.y, 0, 8);
    R.torso.rotation.y = dr(R.torso.rotation.y, planted ? a.twist : 0, 9);
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  }
}

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
  const flyingFree = !player.grounded && !player.slamming && !player.flip && !_aiming && _spd > 1.2 && w !== 'darksaber';
  if (!flyingFree){
  if (w === 'darksaber'){
    // DARKSABER drives the shared Jedi saber rig: the swing block (player.atkT>0) already animated the arm.
    // When idle, hold an AGGRESSIVE low guard — blade cocked back & out to the side, ready to strike. Bracing
    // (RMB parry) snaps to a tighter, forward, two-handed-ish wall guard — sharper than a classic Jedi guard.
    if (player.atkT <= 0){
      if (player.blockHeld){
        // BLOCK — a heavy braced WALL guard: both hands hauling the blade up high & forward, hard forward lean,
        // wide low base. He's bracing to TANK the hit, not standing politely upright.
        R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.35, 16);
        R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.0, 16);
        R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.15, 16);
        R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.7, 16);
        R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.3, 14);
        R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.5, 14);   // off-hand wraps onto the hilt
        R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.35, 14);
        vis.rotation.x = dr(vis.rotation.x, 0.26, 12);              // braced forward lean
        R.torso.position.z = dr(R.torso.position.z, 0.18, 12);
      } else {
        // IDLE READY — a HEAVY, aggressive high guard: blade reared up & out to the strong side, shoulders tense,
        // both hands committed to the hilt. Reads as a weighty weapon held with effort, not a casual saber.
        R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.0, 12);
        R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.34, 12);
        R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.6, 12);   // reared up to the side, tip skyward
        R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.15, 12);
        R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.85, 11);
        R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.45, 11);   // support hand toward the hilt
        R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.95, 11);
        vis.rotation.x = dr(vis.rotation.x, 0.08, 10);               // a slight forward, coiled lean
      }
    }
  } else if (player.darkT > 0){
    const k = 1 - Math.max(0, player.darkT) / DARK_DUR;   // overhead → diagonal cut
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -2.7 + k*3.7, 24);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, 0.9 - k*2.0, 24);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, -0.1, 18);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.25, 18);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.7, 14);
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
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.42, 12);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.06, 12);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.1, 12);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.95, 12);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.55, 12);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.12, 12);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.75, 12);
  } else {
    const aimX = -1.45 + player.recoil * 4;   // arms RAISED — gun held up at shoulder level, not the waist
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, aimX, 16);
    R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, -0.12, 14);
    R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.18, 14);
    R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.15, 14);
    if (w === 'dual'){
      // DUAL — aggressive GUNSLINGER: off-hand held LOW & out to the side, body open (no support, less lean)
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.65 + player.recoil*2, 14);
      R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, -0.45, 14);   // splayed outward
      R.armL.sh.rotation.z = dr(R.armL.sh.rotation.z, 0.2, 14);
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.35, 14);
    } else {
      // SINGLE / DISRUPTOR — braced two-hand: the LEFT hand comes across to SUPPORT the blaster
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, aimX, 16);
      R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, twoH ? -0.16 : 0.16, 14);   // brought toward centre, under the gun
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, twoH ? -0.55 : -0.7, 14);
    }
    mandoAimPoint();   // refresh the reticle lock state (sets player.lockOn)
  }
  }   // end !flyingFree (the flight pose below owns the arms during a free-flight superman)
  // DISRUPTOR barrel: swings OUT to aim, lies back along the forearm at rest (attached to the hands)
  if (player.rifleMesh){
    const out = player.zoom || player.aiming > 0 || player.stabT > 0;
    player.rifleMesh.rotation.x = dr(player.rifleMesh.rotation.x, out ? 1.15 : -0.35, 9);
  }
  // AIR FLIGHT POSE — lays the body out toward HORIZONTAL as you pick up speed (scales in naturally, not a snap).
  //  • FREE FLIGHT: a forward superman — arms thrust ahead, head craned UP to look where you're going.
  //  • AIMING/BRACING: leans flat toward your DRIFT (pitch from fwd/back, roll from side) blended smoothly so
  //    swapping directions is fluid; the HELMET counter-rotates so its top always stays up & looks forward.
  // Pitch/roll pivot about the torso (we lift `vis`) so it reads as a flat body at altitude, not a nose-dive.
  const AIRREF = MANDO.airSpeed || 12;
  player.airDive = 0;
  if (!player.grounded && !player.slamming && !player.flip){
    const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z;
    const vF = vx*f.x + vz*f.z, vR = vx*r.x + vz*r.z;
    const pivot = 1.05;                 // ~torso height above the rig origin — rotate around here so the body lies flat
    const FLAT = Math.PI / 2;           // horizontal — 0° to the ground (full lay-out at cruise speed)
    const HEAD_UP = 0.5;                // how far above level the visor cranes when fully flat
    const speed = Math.hypot(vF, vR);
    // flatness needs BOTH speed AND ALTITUDE — skim low and you stay fairly upright; only a decent height
    // off the ground lets the body lay all the way out into a flat prone.
    const speedF = clamp((speed - 0.5) / 5.2, 0, 1);   // early-game slight leaning
    const altF = clamp((pp.y - (player.groundY || 0) - 0.5) / 4.0, 0, 1);
    const lvl = speedF * altF;
    const aiming = player.zoom || player.aiming > 0 || player.blockHeld || player.firing;
    const liftFor = a => pivot * (1 - Math.cos(a));
    if (lvl <= 0.001){
      // hovering / barely moving — upright, feet down
      vis.rotation.x = dr(vis.rotation.x, 0, 7);
      vis.rotation.z = dr(vis.rotation.z, 0, 7);
      vis.position.y = dr(vis.position.y, 0, 7);
      R.head.rotation.x = dr(R.head.rotation.x, 0, 8);
      R.head.rotation.z = dr(R.head.rotation.z, 0, 8);
    } else if (!aiming){
      // FREE FLIGHT — forward superman (always forward, regardless of drift)
      const pitchAmount = clamp(Math.abs(vF) / AIRREF, 0, 1);
      const pitchScale = 0.45 + (lvl * 0.30);
      const pitch = (FLAT * pitchScale) * pitchAmount * (vF >= 0 ? 1 : -1);
      vis.rotation.x = dr(vis.rotation.x, pitch, 8);
      vis.rotation.z = dr(vis.rotation.z, clamp(vR * 0.065, -0.42, 0.42), 10);  // stronger side lean to better match forward/back pitch intensity
      vis.position.y = dr(vis.position.y, liftFor(pitch), 8);
      R.head.rotation.x = dr(R.head.rotation.x, -pitch - HEAD_UP*lvl, 11);     // counter the body + crane UP
      R.head.rotation.z = dr(R.head.rotation.z, 0, 11);
      player.airDive = lvl > 0.4 ? 2 : 0;
      // SUPERMAN arms — ALWAYS reach forward in WORLD space: the shoulder angle tracks the body pitch so the
      // arms point ahead whether you're flat (high) or upright (low), never straight up.
      const armX = -1.45 - pitch * 0.9;   // pitch 0 → ~-1.45 (forward-horizontal) · pitch π/2 → ~-2.86 (overhead = forward)
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, armX, 11);
      R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, 0.16, 11);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, -0.14, 11);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.22, 11);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, armX, 11);
      R.armL.sh.rotation.z = dr(R.armL.sh.rotation.z, -0.16, 11);
      R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.14, 11);
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.22, 11);
    } else {
      // AIMING / BRACING — flat lean BLENDED from drift: pitch (fwd/back) + roll (side) at once → fluid swaps.
      // Plus a small constant RIGHT lean (a tactical aim-stance tilt) on top of the drift roll.
      const AIM_LEAN = 0.16;
      const pitch = clamp(vF / AIRREF, -1, 1) * FLAT * lvl;
      const roll  = clamp(vR / AIRREF, -1, 1) * FLAT * lvl + AIM_LEAN;
      vis.rotation.x = dr(vis.rotation.x, pitch, 9);
      vis.rotation.z = dr(vis.rotation.z, roll, 9);                            // bank INTO the strafe (right→right) + a base right lean
      vis.position.y = dr(vis.position.y, liftFor(Math.max(Math.abs(pitch), Math.abs(roll))), 9);
      // HELMET looks FORWARD where you're aiming (fully counter the body so the visor is level — works even when
      // reclined back), and counters the roll so its top stays up.
      R.head.rotation.x = dr(R.head.rotation.x, -pitch, 11);
      R.head.rotation.z = dr(R.head.rotation.z, -roll, 11);                    // cancels body roll → top of head stays up
      player.airDive = Math.abs(roll) > Math.abs(pitch) ? (roll >= 0 ? 1 : -1) : (pitch >= 0 ? 2 : 3);
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

        // === SINGLE vs DUAL BRACING POSE ===
        const isDual = player.weapon === 'dual';

        if (isDual) {
          // DUAL — aggressive gunslinger brace
          R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.85, 14);
          R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.75, 14);
          R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.35, 14);
          R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.75, 14);

          R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.85, 14);
          R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, -0.75, 14);
          R.armL.sh.rotation.z = dr(R.armL.sh.rotation.z, 0.35, 14);
          R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.75, 14);
        } else {
          // SINGLE — shield brace
          R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.25, 14);
          R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.25, 14);
          R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.1, 14);
          R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.15, 14);

          R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.65, 14);
          R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, -0.85, 14);
          R.armL.sh.rotation.z = dr(R.armL.sh.rotation.z, 0.55, 14);
          R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.35, 14);
        }
      } else if (player.grounded) {
        // (slam landing is reset at the touchdown site above, so the body is already square here)
        const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z;
        const latV = vx*r.x + vz*r.z;
        const strafeLean = clamp(latV * 0.035, -0.5, 0.5);
        vis.rotation.x = dr(vis.rotation.x, 0, 9);
        vis.rotation.z = dr(vis.rotation.z, strafeLean, 10);
        R.head.rotation.z = dr(R.head.rotation.z, -strafeLean * 0.65, 10);
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
