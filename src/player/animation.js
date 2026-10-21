// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Player animation: stance posture, body facing, flips, and the rig pose (legs, torso, arms, Force cast, Mando weapon/flight poses).

import { sweepBlade } from './jedi/bladehit.js';
import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { clamp, dampAngle, wrapAngle, V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { G, player } from '../state.js';
import { MANDO } from '../data/mando.js';
import { MANDO_MELEE } from '../data/duel.js';
import { MOVE, GAIT } from '../data/movement.js';
import { stance } from './helpers.js';
import { tryAttack, applySwingDamage, FLOW } from './jedi/combat.js';
import { mandoAimPoint, mandoWeapon, mandoShielding } from './mando/weapons.js';
import { DARK_DUR } from './mando/darksaber.js';
import { FORM_OF, FOOTWORK } from '../data/poses.js';
import { pistolPose, riflePose, rifleLowered, restGun } from './anim/guns.js';
import { MIRROR } from './model/rig.js';
import { solveArm } from './anim/ik.js';
import { saberPose, guardPose, swingPose, deflectPose, applySaberPose, releaseSaberPose, airGuard } from './anim/saber.js';
import { advanceGait, gaitLegs, gaitHipOffset, releaseGait } from './anim/gait.js';
import { MOCAP_ON, MOCAP_LAND_T, mocapLand, mocapAirLegs, airPhase, mocapCut } from './anim/mocap.js';
import { footingLegs, releaseFooting } from './anim/footing.js';
import { stepCloth } from './model/cloth.js';
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
  mocapUpper(R, null);   // take last frame's captured chest twist off, so every pose below works from its own values
  poseBody(dt, dr, vis, planted, POSE, moving);
  const { ph, inten, gait } = animateLegsAndTorso(dt, dr, R, planted, POSE);
  animateArms(dt, dr, vis, R, st, planted, moving, ph, inten, gait);
  animateForceCast(dt, dr, R);
  // agility (anim/agility.js) poses flips, dives and landings after the arms, so the guard's damping can't blunt them
  if (G.hero !== 'mando') jediAgilityPost(dt, dr, vis, R, { ph, inten, planted });
  if (G.hero === 'mando'){ animateMandoPose(dt, dr, vis, R, pp, f, r); mandoAgilityPost(dt, dr, vis, R, f, r); }
  mocapUpper(R, player._gait);
  secondaryMotion(dt, vis, R);
  stepCloth(player, dt, player.group.position.y + 0.02);   // the robe panels and cape hem (model/cloth.js), after the pose
  player.arcMesh.material.opacity = Math.max(0, player.arcMesh.material.opacity - dt*4);

  // (the saber hum is driven from audio/director.js)
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
  const inCombatPose = player.atkT > 0 || player.dashT > 0 || player.blockHeld || player.judgeT > 0 || player.castT > 0 || player.palmT > 0 || mandoAimLock;
  const wasBackRun = player.backRun;
  player.backRun = mandoBackRun();
  if (wasBackRun && !player.backRun) player._unwindT = 0.35;   // turning back to the reticle: ease round, don't whip
  if (player._unwindT > 0) player._unwindT -= dt;
  let face = G.yaw;
  if ((G.hero !== 'mando' && !inCombatPose && moving) || player.backRun)
    face = Math.atan2(player.moveVel.x, player.moveVel.z);
  // (the dive and the slide turn him the way they go: anim/agility.js mandoBody)
  if (G.hero === 'mando') player.faceYaw = mandoTurn(player.flip && player.flip.face != null ? player.flip.face : face, player.flip ? 30 : player.backRun ? 11 : player._unwindT > 0 ? 12 : 26, dt);
  else {
    // TURNING WEIGHT — the Jedi eases round at a capped rate (slower still at a sprint) instead of snapping; on a
    // ledge he faces the wall
    if (player.hang) face = Math.atan2(-player.hang.nx, -player.hang.nz);
    // a flip launched along the travel (anim/agility.js launchFlip) faces it fast, so the flip turns the way you go
    // the AERIAL CUT (jedi/aerial.js) squares up to the foe it flies at, just as fast
    const flipFace = (player.flip && player.flip.face != null && !player.hang) || (player.airCut && player.airCut.phase !== 'fall');
    if (flipFace) face = player.airCut && player.airCut.phase !== 'fall' ? player.airCut.face : player.flip.face;
    const rate = flipFace ? 25 : player.sprinting ? MOVE.sprintTurn : inCombatPose ? MOVE.combatTurnRate : MOVE.turnRate;
    const step = wrapAngle(dampAngle(player.faceYaw, face, flipFace ? 30 : inCombatPose ? 26 : 11, dt) - player.faceYaw);
    player.faceYaw += clamp(step, -rate * dt, rate * dt);
  }
  player.group.rotation.y = player.faceYaw;

  if (player.slamming && !player.flip){
    // --- aerial slam DIVE: a committed forward tuck plunging straight down. NO spin (vis.rotation.y stays put) so
    // it can't leave the body twisted off-axis on landing — it must come down clean & square.
    vis.rotation.x = dr(vis.rotation.x, player.slamWind > 0 ? -0.24 : slamPitch(), 12);   // arched back through the wind-up, then each form drops its own way (data/agility.js)
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
    // a PIVOT sits the hips down against the old momentum
    // HIT REACTION — the body is driven the way the blow pushes it: reeling back from the front, pitched forward from
    // behind, knocked sideways from the flank; a heavy blow harder
    const fk = player.flinchT > 0 ? (player.flinchT / (player.flinchMax || 0.3)) * (player.flinchHeavy ? 1.35 : 1) : 0;
    const fdir = player.flinchDir;
    const hf = fdir ? fdir.x*ffx + fdir.z*ffz : -1, hr = fdir ? fdir.x*(-ffz) + fdir.z*ffx : 0;
    const reel = 0.32 * hf * fk, reelSide = 0.28 * hr * fk;
    const plant = player.pivotT > 0 ? -0.18 : 0;
    // WEIGHT — pushing off to start tips the body into it, braking sits it back, a turn banks into the curve
    const gs = player._gait, gm = GAIT.accelMax;
    const af = gs && player.grounded ? clamp((gs.ax*ffx + gs.az*ffz) * GAIT.accelLean, -gm, gm) : 0;
    const ar = gs && player.grounded ? clamp((gs.ax*(-ffz) + gs.az*ffx) * GAIT.accelBank, -gm, gm) : 0;
    vis.rotation.x = dr(vis.rotation.x, lf*0.024*leanG + af + (planted ? POSE.lean : 0) + reel + plant + (player.airCut && player.airCut.phase === 'dash' ? 0.38 : 0), reel ? 22 : 9);   // (the aerial cut's dash drives in shoulder-first)
    // WALL-RUN — feet on the wall, body tipped out away from it (the normal in the body's own left/right)
    const wallLean = player.wallRun ? -0.5 * (player.wallRun.nx * Math.cos(player.faceYaw) - player.wallRun.nz * Math.sin(player.faceYaw)) : 0;
    vis.rotation.z = dr(vis.rotation.z, player.wallRun ? wallLean : lr*0.018*leanG + ar + reelSide, player.wallRun ? 14 : reelSide ? 22 : 9);   // bank INTO the strafe (was inverted — leaned the wrong way)
    vis.position.y = dr(vis.position.y, 0, 10);
  }

}

// Is the Mando running away from the reticle? Only on foot with nothing else claiming the body (RMB aim, scope, a
// swing, dash, stab, punch, flame); it kicks in past ~120° off the aim line and lets go near a pure strafe, so
// circling the reticle doesn't flicker between the two.
function mandoBackRun(){
  if (G.hero !== 'mando' || !player.grounded || player.flip || player.slamming) return false;
  if (player.blockHeld || player.zoom || player.atkT > 0 || player.dashT > 0 || player.stabT > 0 || player.meleeT > 0 || player.darkT > 0 || player.flaming) return false;
  if (player.weapon === 'disruptor' && player.aiming > 0) return false;   // a shouldered rifle can't point back over the shoulder: he squares up to fire it
  const vx = player.moveVel.x, vz = player.moveVel.z, sp = Math.hypot(vx, vz);
  if (sp < 1) return false;
  const along = (vx * Math.sin(G.yaw) + vz * Math.cos(G.yaw)) / sp;   // +1 toward the reticle, -1 straight away
  return player.backRun ? along < -0.15 : (sp > 2 && along < -0.5);
}

// The Mando's body yaw, eased toward `face`. Measured from the reticle and wrapped on the off-hand side, so the big
// turns into and out of a back-run always swing the same way: he pivots over his off-hand shoulder, the gun side
// stays toward the target the whole way round, and turning back retraces the same path (no spinning the other way
// when the turn is near 180° and the shortest way round flips).
function mandoTurn(face, lambda, dt){
  const fromAim = a => wrapAngle(a - G.yaw, -Math.PI/2);   // [-π/2, 3π/2): the off-hand side wraps past 180°
  const cur = fromAim(player.faceYaw), tgt = fromAim(face);
  return G.yaw + cur + (tgt - cur) * (1 - Math.exp(-lambda*dt));
}

// Legs (stride, air tuck, stance splay, front kick), hips/robe, breathing and head look.
function animateLegsAndTorso(dt, dr, R, planted, POSE){
  const vis = player.vis;
  /* ================= rig animation ================= */
  // (a blow's shove isn't the legs' doing: while reeling the footing steps to catch the body instead of running it out)
  const shoved = player.flinchT > 0 ? 0 : 1;
  const tvx = player.moveVel.x + player.vel.x * shoved, tvz = player.moveVel.z + player.vel.z * shoved;
  const hSpeed = Math.hypot(tvx, tvz);
  // PER-STANCE GAIT — same skeleton, different run: FAST is light & high-kneed, STRONG is long & planted, the Mando heavy
  const gait = (G.hero === 'mando' || !stance().gait) ? MANDO_GAIT : stance().gait;
  // the stride clock runs on distance travelled (anim/gait.js); it also sets player.runPhase for the arms and twist
  const GS = advanceGait(dt, hSpeed, gait);
  const ph = player.runPhase;
  const inten = clamp(hSpeed / CFG.player.speed, 0, 1.2);

  // TOUCHDOWN — the knees soak a landing (harder falls sink deeper), then spring back up
  if (player.grounded && player._wasGrounded === false){
    const LS = landingStyle();   // Djem So sinks deep and rises slow; Ataru lands soft and springs straight back up
    player.landDur = (MOCAP_ON ? MOCAP_LAND_T : LAND_T) / (LS.spring || 1);
    player.landT = player.landDur; player.landAmt = clamp(0.3 + (player.landDip || 0) * 1.6, 0.3, 1) * (LS.depth || 1);
    if (player.landAmt > 0.45 && !player.slamming){   // a real drop kicks up a ring of dust at the feet
      const pp = player.group.position;
      for (let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2;
        burst(V3(pp.x + Math.cos(a)*0.45, pp.y + 0.08, pp.z + Math.sin(a)*0.45), 0x8f8578, 1, 2.5 * player.landAmt, 0.6, 0.9); }
    }
  }
  // the flight's phase reads off the vertical speed against the take-off's (a second jump in the air restarts it)
  if (!player.grounded && (player._wasGrounded !== false || player.vy > (player._vyPrev || 0) + 2)) player._vy0 = Math.max(0, player.vy);
  player._vyPrev = player.vy;
  player._wasGrounded = player.grounded;
  if (player.landT > 0) player.landT -= dt;
  const landU = player.landT > 0 ? 1 - player.landT / (player.landDur || LAND_T) : 1;
  // captured: the knees give fast and the body rises back slowly, tipping forward over the feet; else a plain sine
  const LC = MOCAP_ON && player.landT > 0 ? mocapLand(landU) : null;
  const land = player.landT > 0 ? (LC ? LC.drop : Math.sin(landU * Math.PI)) * player.landAmt : 0;
  player._land = land;
  player._landPitch = LC ? LC.pitch * player.landAmt * 2 : 0;
  // hips: crouch lowers the center of gravity per stance; on the move they sit lower and dip at each footfall
  // (set before the legs, which are solved down from here)
  player._crouch = dr(player._crouch || 0, planted ? POSE.crouch : 0, 8);
  R.hips.position.y = 1.04 + player._crouch - (player._swingDrop || 0) - land*0.2 - (player._agiDrop || 0)
                      + (player.grounded && !player.flip ? gaitHipOffset(GS, gait) : 0.05);
  // a foot standing lower than the body (off a step, one foot down from a crate) needs the hips to come down to it
  const fd = player.grounded && !player.flip && player._footDrop ? Math.min(0, player._footDrop[0], player._footDrop[1]) : 0;
  player._hipSink = dr(player._hipSink || 0, fd * GAIT.hipSink / 1.18, 14);
  R.hips.position.y += player._hipSink;
  // the captured stride's pelvis (anim/mocap.js): it bobs, sways, surges and rolls over each stance foot, turning with
  // the legs. Set before the legs, which are solved in its frame. Fades out with the gait
  const B = GS.body && player.grounded && !player.flip ? GS.body : null, bw = B ? GS.w : 0;
  const along = hSpeed > 1e-3 ? Math.abs((tvx*Math.sin(player.faceYaw) + tvz*Math.cos(player.faceYaw)) / hSpeed) : 1;   // running, not strafing
  player._mcAlong = along;
  const calm = player._mcCalm = player.walking ? GAIT.walkSway : 1;   // walk mode keeps the hips level
  R.hips.position.x = dr(R.hips.position.x, B ? B.sway * bw * calm : 0, 20);
  R.hips.position.z = dr(R.hips.position.z, B ? B.surge * bw : 0, 20);
  R.hips.rotation.x = dr(R.hips.rotation.x, (B ? B.pitch * bw : 0) + player._landPitch, 20);
  R.hips.rotation.z = dr(R.hips.rotation.z, B ? -B.roll * bw * calm : 0, 20);
  if (GS.body) R.hips.rotation.y = dr(R.hips.rotation.y, B ? B.yaw * bw * along : 0, 20);   // (else anim/agility.js turns the Jedi's)
  player._legIK = null;   // set below while the feet are solved onto the floor (ankle angles per leg)
  // legs: stride + knee lift (+ knee = the shin folds back, a real knee bend); the Jedi's air, flip and dive legs come from anim/agility.js
  if (G.hero !== 'mando' && jediAirLegs(dt, dr, R)){
    // posed: jump phases, Force leap and glide, flip tuck/pike/layout, slam dive
  } else if (player.grounded && !player.flip){
    const lead = planted ? POSE.lead : 0;   // bladed/staggered footing when planted, neutral when moving
    // a swing steps into the cut: the off-side foot drives forward, the back leg loads
    const step = (player._swingDrop || 0) * 2.2;
    // the stance's own leg shape and width (feet splay for the wide STRONG guard, stay close for FAST; a heavy landing
    // spreads them): standing, the footing (anim/footing.js) keeps the feet planted and steps them to this shape
    const still = [-lead - step - land*0.5, step*0.8 + land*0.95, lead + step*0.6 - land*0.35, step*1.1 + land*0.8];
    const lsp = land * (landingStyle().splay || 0);
    const splay = [(planted ? -POSE.splay : 0) - lsp, (planted ? POSE.splay : 0) + lsp];
    // moving: the planted-foot gait (anim/gait.js); the two blend by speed
    const w = GS.w;
    let gaitA = null;
    if (w > 0){
      const ffx = Math.sin(player.faceYaw), ffz = Math.cos(player.faceYaw);
      const fwd = hSpeed > 1e-3 ? (tvx*ffx + tvz*ffz) / hSpeed : 1, right = hSpeed > 1e-3 ? (tvx*(-ffz) + tvz*ffx) / hSpeed : 0;
      gaitA = gaitLegs(GS, fwd, right, R, vis);
      gaitA[0][0] -= step; gaitA[0][1] += step*0.8; gaitA[1][0] += step*0.6; gaitA[1][1] += step*1.1;
    }
    else releaseGait(GS);
    let idleA = null;
    if (w < 1) idleA = footingLegs(dt, R, vis, still, splay);
    else releaseFooting();
    // the solved angles are exact (no damping lag, or a planted foot would skate); coming down out of the air eases in
    GS.inT = Math.min(1, (GS.inT || 0) + dt * 7);
    const k = Math.max(GS.inT, Math.min(1, dt * 14));
    player._legIK = [R.legL, R.legR].map((L, i) => {
      const g = gaitA && gaitA[i], f = idleA && idleA[i];
      const mix = j => g && f ? lerp(f[j], g[j], w) : (g || f)[j];
      L.hip.rotation.x  += (mix(0) - L.hip.rotation.x) * k;
      L.knee.rotation.x += (mix(1) - L.knee.rotation.x) * k;
      L.hip.rotation.z  += (mix(2) - L.hip.rotation.z) * k;
      L.ank.rotation.y  += ((f ? f[4] * (1 - w) : 0) - L.ank.rotation.y) * k;   // a locked foot keeps its heading
      return mix(3);
    });
  } else if (player.airDive){
    // PRONE flight — legs DEAD STRAIGHT and in line with the torso so the whole body reads as one long flat plank.
    // Forward superman: legs trail straight back (hip ~0). Reclined back-fall: feet kick out front.
    const backFall = player.airDive === 3;
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  backFall ? -0.6 : 0.0, 10);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  backFall ? -0.5 : 0.0, 10);
    R.legL.hip.rotation.z  = dr(R.legL.hip.rotation.z,  0.04, 10);   // a hair of splay so the legs read as two, not one
    R.legR.hip.rotation.z  = dr(R.legR.hip.rotation.z, -0.04, 10);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, 0.04, 10);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, 0.04, 10);
  } else if (G.hero === 'mando' && !player.grounded && MOCAP_ON && !player.jetActive && !player.hovering && !player.boosting){
    // a plain jump or fall, jets off: the captured jump's legs (anim/mocap.js)
    const [lh, lk, rh, rk] = mocapAirLegs(airPhase(player._vy0, player.vy), player._vy0);
    R.legL.hip.rotation.x = dr(R.legL.hip.rotation.x, lh, 16); R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, lk, 16);
    R.legR.hip.rotation.x = dr(R.legR.hip.rotation.x, rh, 16); R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, rk, 16);
  } else if (G.hero === 'mando' && !player.grounded){
    // UPRIGHT JETPACK — legs hang loose under the pack, one a touch ahead of the other, trailing as you lean
    const trail = (player._airLean || 0) * 0.6;
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  -0.06 + trail + Math.sin(G.gt * 1.3) * 0.04, 6);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,   0.14 + trail, 6);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, 0.22 + trail * 0.5, 6);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, 0.42 + trail * 0.6, 6);
  } else {
    R.legL.hip.rotation.x  = dr(R.legL.hip.rotation.x,  -0.5, 8);
    R.legR.hip.rotation.x  = dr(R.legR.hip.rotation.x,  -0.35, 8);
    R.legL.knee.rotation.x = dr(R.legL.knee.rotation.x, 1.0, 8);
    R.legR.knee.rotation.x = dr(R.legR.knee.rotation.x, 0.9, 8);
  }
  if (!player._legIK){
    releaseFooting(); releaseGait(GS); GS.inT = 0;
    R.legL.ank.rotation.y = dr(R.legL.ank.rotation.y, 0, 12); R.legR.ank.rotation.y = dr(R.legR.ank.rotation.y, 0, 12);
    if (G.hero === 'mando' && !player.airDive){
      R.legL.hip.rotation.z = dr(R.legL.hip.rotation.z, 0, 9);
      R.legR.hip.rotation.z = dr(R.legR.hip.rotation.z, 0, 9);
    }
  }
  // ANKLES — feet stay planted flat on the ground under the leg angles; in the air the toes point
  // (on the ground the solver sets them: flat under a planted foot, heel strike and toe-off in the stride)
  [R.legL, R.legR].forEach((L, i) => {
    if (player._legIK) L.ank.rotation.x += (player._legIK[i] - L.ank.rotation.x) * Math.min(1, GS.inT + dt * 14);
    else L.ank.rotation.x = dr(L.ank.rotation.x, 0.45, 14);
  });
  // JEDI FRONT KICK — the right leg SNAPS forward (hard-set, overriding the stride pose above) and the torso leans
  // back to counterweight it. `ext` is a 0→1→0 envelope so the leg shoots out and recovers within kickT.
  if (G.hero !== 'mando' && player.kickT > 0){
    const ext = Math.sin((1 - clamp(player.kickT / (player.kickMax || 0.4), 0, 1)) * Math.PI);
    R.legR.hip.rotation.x  = -1.55 * ext;
    R.legR.knee.rotation.x = 0.1 + (1 - ext) * 0.7;
    R.legL.knee.rotation.x = 0.28 * ext;
    R.torso.rotation.x = -0.22 * ext;
  } else if (G.hero !== 'mando' && !(player.atkT > 0)) R.torso.rotation.x = dr(R.torso.rotation.x, 0, 12);   // settle a swing's lean
  // robe flare with speed
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
  const lookDiff = wrapAngle(G.yaw - player.faceYaw);
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
  const dfl = player.deflectAnim;
  if (dfl){ dfl.t += dt; if (dfl.t >= dfl.dur || !held) player.deflectAnim = null; }
  if (player.atkT > 0){
    // saber swing: the keyframed cut for this form, grip and direction
    const sw = player.swing;
    // BITE — when the blade meets a body it drags for an instant (the cut has to go THROUGH something), then carries on
    const sdt = sw.bite > 0 ? dt * BITE.slow : dt;
    if (sw.bite > 0) sw.bite -= dt;
    player.atkT -= sdt;
    sw.t += sdt;
    // (no blade in hand — e.g. the weapon was swapped mid-swing — just run the swing's clock out)
    const cue = held ? swingPose(R, held, grip, form, sw) : { k: Math.min(1, sw.t / sw.dur), env: 0, cut: 0, spin: 0, hop: 0, drop: 0 };
    if (held) applySaberPose(R, held, player.castT <= 0, dt);
    // the body turns with the blade; a finisher spins all the way round (Ataru leaps into it)
    const turn = Math.sign(sw.pat.yT - sw.pat.yF);
    // a cut that flows out of the last one starts from that one's body turn, hop and drop and eases out of them by
    // its chamber, so a linked string never snaps back to square between strokes
    if (!sw.body) sw.body = { ry: Math.atan2(Math.sin(vis.rotation.y), Math.cos(vis.rotation.y)), py: vis.position.y, drop: player._swingDrop || 0 };
    const tc = (sw.anim && sw.anim.tc) || 0.25, inB = cue.k < tc ? 1 - easeInOut(cue.k / tc) : 0;
    // captured (anim/mocap.js): the hips lead the cut and the shoulders whip through after them
    const MC = MOCAP_ON && sw.anim && !cue.spin ? mocapCut(cue.k, sw.anim.tc, sw.anim.ts, sw.anim.tf) : null;
    if (!player.flip){
      if (cue.spin) vis.rotation.y = easeInOut(cue.cut) * Math.PI * 2 * cue.spin * (turn || 1);
      else vis.rotation.y = MC ? MC.turn * st.twist * turn * 0.75 : cue.env * st.twist * turn * 0.55;
      if (cue.hop) vis.position.y = Math.sin(Math.PI * cue.k) * cue.hop;
      vis.rotation.y += sw.body.ry * inB;
      vis.position.y += sw.body.py * inB;
    }
    // the body LOADS into the chamber (weapon shoulder drawn back) and THROWS its weight through the strike: the
    // shoulder reaches and the knees give, harder for a riposte; a spin or a leap carries its own body
    const coil = cue.coil || 0, drive = cue.drive || 0;
    R.torso.position.z = dr(R.torso.position.z, (drive * 0.17 - coil * 0.06) * (sw.riposte ? 1.5 : 1), 30);
    R.torso.rotation.x = dr(R.torso.rotation.x, drive * 0.1 - coil * 0.05, 24);
    if (!player.flip && !cue.hop && player.grounded) vis.position.y = dr(vis.position.y, -0.07 * drive, 26);
    R.torso.rotation.y = dr(R.torso.rotation.y, MC ? MC.chest * 0.22 * (turn || 1) : 0, MC ? 30 : 12);
    vis.rotation.x = dr(vis.rotation.x, saberPose.lean, 14);
    player._swingDrop = cue.drop * cue.env + sw.body.drop * inB;
    // CONTACT — the cut lands on what the blade actually sweeps through this frame (jedi/bladehit.js), during the
    // stroke itself (not the chamber or the follow-through); the strike point still runs the swing's one-off effects
    if (held){
      const touched = sweepBlade(sw, cue.k >= ((sw.anim && sw.anim.tc) || 0.25) * 0.6 && cue.k <= 0.92);
      if (touched && touched.length && !sw.noHit){ applySwingDamage(sw.step, touched); sw.bite = BITE.time; }
    }
    if (!sw.applied && cue.k > 0.35){ sw.applied = true; applySwingDamage(sw.step, held || sw.cutSet || sw.noHit ? [] : undefined); }   // (noHit: the aerial cut struck on contact, jedi/aerial.js)
    // IN-RHYTHM LINK (Jedi): one well-timed press this swing → the next cut leaves from the follow-through
    if (player.queuedAtk && !sw.rushed && G.hero !== 'mando' && sw.applied && cue.k >= FLOW.at){
      player.atkT = 0; player.queuedAtk = false; player.lastAtkEnd = G.gt;
      tryAttack(true);
      if (player.atkT <= 0){ vis.rotation.y = 0; player._swingDrop = 0; }   // the link failed (winded…): settle as normal
      return;
    }
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
    // left palm forward, lightning pouring from the fingers; the saber drops to a low trailing guard. Holstered, both
    // hands pour it out together, arms thrust forward and the fingers hooked (the Emperor's way)
    releaseSaberPose(R, dt);
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.5, 12);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.15, 12);
    R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.1, 12);
    if (player.holstered){
      const sh = Math.sin(G.gt * 31) * 0.03;   // the arms shudder with the current
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.4 + sh, 12);
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.4 - sh, 12);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, -0.15, 12);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.25, 12);
      R.torso.position.z = dr(R.torso.position.z, 0.1, 10);
    } else {
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.2, 10);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.4, 10);
    }
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else if (held){
    // GUARD — each form holds its own recognizable ready guard, and its own block (data/poses.js)
    const blocking = player.blockHeld;
    // a moving hero isn't a statue — the guard rides the stride a little (the shape still reads)
    const sway = { y: moving && !blocking ? Math.sin(ph * 2) * 0.025 * inten : Math.sin(G.gt * 1.9) * 0.01,
                   z: moving && !blocking ? Math.sin(ph) * 0.04 * inten * gait.amp : 0,
                   off: moving && !blocking ? -Math.sin(ph) * 0.08 * inten : 0, moving: moving && !blocking };   // a free hand swings with the step
    // AGILITY guards: flips hug the hilt in or open the arms, the dive cocks or plunges the blade, the run carries it
    // the form's way with the free hand pumping against the stride (data/agility.js AIR_GUARDS)
    const running = G.hero !== 'mando' && moving && !planted && player.grounded && inten > 0.5;
    const ag = G.hero !== 'mando' ? jediAgilityArms(running) : null;
    const over = ag && airGuard(grip, form, ag.key);
    if (running && over){ sway.z = -Math.sin(ph) * 0.05 * inten; sway.off = Math.sin(ph) * 0.17 * inten * ((stance().gait && stance().gait.amp) || 1); }
    // a bolt (or blow) just met the blade: the catch for where it arrived, then back into the guard
    const body = player.deflectAnim && G.hero !== 'mando'
      ? deflectPose(dt, R, held, grip, form, player.deflectAnim)
      : guardPose(dt, R, held, grip, form, blocking, sway, over, ag ? ag.rate : 1);
    // a free off hand swings with the stride when running (two-handed guards keep it on the hilt)
    applySaberPose(R, held, player.castT <= 0, dt);
    R.torso.rotation.y = dr(R.torso.rotation.y, planted ? body.torso : 0, 9);
    if (blocking || planted) vis.rotation.x = dr(vis.rotation.x, saberPose.lean + (planted ? footwork().lean : 0), 12);
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
  } else {
    releaseSaberPose(R, dt);
    if (G.hero !== 'mando' && player.holstered) forceHands(dr, vis, R, planted, moving, ph, inten);
  }
}

/* SABER HOLSTERED — the Jedi fights with his hands: both palms up and open before him; every Force power is thrown
   with both hands (animateForceCast) and the lightning poured from both; RMB lifts both palms into a ward; running, the arms pump with the stride; a Force strike (jedi/palm.js) drives one palm out
   off a short hip turn, alternating hands, and the burst throws both. Plain joint poses, like the Force gestures. */
function forceHands(dr, vis, R, planted, moving, ph, inten){
  const P = player.palm;
  if (P && player.palmT > 0){
    const k = 1 - player.palmT / player.palmMax, c = P.B.contact;
    const ext = k < c ? Math.sin((k / c) * Math.PI / 2) : 1 - (k - c) / (1 - c) * 0.85;   // out fast, back slower
    const ch = k < c * 0.4 ? 1 - k / (c * 0.4) : 0;                                      // the brief draw-back
    const arm = (A, out, sy) => {
      A.sh.rotation.x = dr(A.sh.rotation.x, -0.9 - out * 0.65 + ch * 0.3, 40);
      A.sh.rotation.y = dr(A.sh.rotation.y, sy * (0.12 + out * 0.12), 40);
      A.el.rotation.x = dr(A.el.rotation.x, -1.6 + out * 1.5, 40);
    };
    const guardArm = (A) => { A.sh.rotation.x = dr(A.sh.rotation.x, -0.7, 18); A.el.rotation.x = dr(A.el.rotation.x, -1.5, 18); };
    if (P.hand === 'both'){ arm(R.armL, ext, -1); arm(R.armR, ext, 1); }
    else if (P.hand === 'L'){ arm(R.armL, ext, -1); guardArm(R.armR); }
    else { arm(R.armR, ext, 1); guardArm(R.armL); }
    const turn = P.hand === 'L' ? 1 : P.hand === 'R' ? -1 : 0;
    R.torso.rotation.y = dr(R.torso.rotation.y, turn * 0.28 * ext, 30);
    R.torso.position.z = dr(R.torso.position.z, ext * (P.hand === 'both' ? 0.2 : 0.12), 30);
    vis.rotation.y = dr(vis.rotation.y, 0, 14);
    return;
  }
  if (player.blockHeld){
    // the ward: both palms up and out at chest height, turning blows and bolts on the Force
    for (const [A, s] of [[R.armL, -1], [R.armR, 1]]){
      A.sh.rotation.x = dr(A.sh.rotation.x, -1.35, 16);
      A.sh.rotation.y = dr(A.sh.rotation.y, s * 0.3, 16);
      A.el.rotation.x = dr(A.el.rotation.x, -0.45, 16);
    }
    vis.rotation.y = dr(vis.rotation.y, 0, 12);
    return;
  }
  if (moving && !planted && player.grounded && inten > 0.5){
    const sw = Math.sin(ph) * 0.55 * inten;   // opposite arm to the leg
    R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, sw - 0.15, 14);  R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.9, 14);
    R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -sw - 0.15, 14); R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.9, 14);
    R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0, 12); R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0, 12);
    return;
  }
  // ready: both hands up and open before him, palms out toward the foe, a faint breath in both (no hilt to hold:
  // the hands ARE the weapon now)
  const br = Math.sin(G.gt * 1.9) * 0.03;
  R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.95 + br, 10); R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, -0.22, 10);
  R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -0.8, 10);
  R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.85 - br, 10);  R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.22, 10);
  R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.85, 10);
  vis.rotation.y = dr(vis.rotation.y, 0, 12);
}

// the bladed weapon in hand right now (or null): the Jedi saber, or the Mando's darksaber when it's equipped
function heldBlade(){
  if (G.hero !== 'mando') return player.saberHand && !player.holstered ? { node: player.saberHand, root: player.saberBladeRoot } : null;
  if (player.weapon === 'darksaber' && player.darksaberMesh) return { node: player.darksaberMesh, root: null };
  return null;
}
export function footwork(){
  if (G.hero === 'mando' && player.weapon === 'fists') return FOOTWORK.brawler;
  return FOOTWORK[(G.hero === 'mando' && player.weapon === 'darksaber') ? 'darksaber' : (FORM_OF[G.stance] || 'niman')];
}
const _IDQ = new THREE.Quaternion();
const LAND_T = 0.34;
const MANDO_GAIT = { amp: 0.95, lift: 0.7, bob: 0.45 };   // armour and a pack: shorter, lower, heavier steps than the Jedi
const BITE = { time: 0.05, slow: 0.3 };   // a saber cut drags this long, at this speed, as it passes through a body
const SHIELD_SIZE = 0.6;   // gauntlet shield disc scale (visual only; what it blocks is decided in player/damage.js)
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
/* A THROWN BLOW in four beats, over seconds since the press: a short CHAMBER that loads it (→ -1), a SNAP that
   accelerates into the target and arrives at full extension exactly on the contact frame (→ +1, when melee.js lands
   the hit), a HOLD on the impact, then the RECOVERY home (→ 0). Real strikes are fast out and slower back. */
const BLOW_CONTACT = { ...Object.fromEntries([...MANDO_MELEE.string, ...MANDO_MELEE.fists, ...MANDO_MELEE.guard.string].map(b => [b.name, b.contact])), takedown: 0.12, catch: 0.04, charge: 0, dive: 0 };
const HACK_T = new THREE.Vector3(), HACK_POLE = new THREE.Vector3(0.6, -0.8, -0.1).normalize();
const BLADE_OUT = { blade: 1, takedown: 1, hackA: 1, hackB: 1 };   // the beats that spring the wrist vibroblade
function blowCurve(age, c, dur){
  const w = c * 0.55, hold = 0.05;
  if (age < w) return -Math.sin((age / w) * Math.PI / 2);
  if (age < c){ const t = (age - w) / (c - w); return -1 + 2 * t * t; }
  if (age < c + hold) return 1;
  return 1 - easeInOut(clamp((age - c - hold) / Math.max(0.05, dur - c - hold), 0, 1));
}

/* the WRIST VIBROBLADE: a short beskar blade that springs from the right vambrace along the forearm and past the
   fist for the blade beats (the cut that ends the string, takedowns, and every cut of shield and blade) */
function wristBlade(dt, R, out){
  let b = player.wristBlade;
  if (!b && !out) return;
  if (!b || b.parent !== R.armR.el){
    const g = new THREE.Group();
    // flat side-on to the sweep, so both its edges cut; the violet sliver behind the steel is the humming edge
    const steel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.014), new THREE.MeshStandardMaterial({ color: 0xaab4bc, metalness: 0.85, roughness: 0.3 }));
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.5, 0.006),
      new THREE.MeshBasicMaterial({ color: 0xc9a6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    steel.position.y = edge.position.y = -0.25;   // grows down the forearm from the mount
    g.add(steel, edge);
    g.position.set(0.055, -0.12, 0);   // outer side of the forearm, a hand's width below the elbow
    R.armR.el.add(g);
    player.wristBlade = b = g; g.userData.k = 0;
  }
  const k = b.userData.k += ((out ? 1 : 0) - b.userData.k) * Math.min(1, dt * (out ? 40 : 10));
  b.visible = k > 0.02;
  b.scale.set(1, Math.max(0.01, k), 1);
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
    if (G.hero !== 'mando' && player.holstered){
      // saber holstered: no hilt to hold, so BOTH hands throw the power (Yoda's two open palms), a touch wider apart
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.5, 20);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, pulling ? 0.05 : -0.08, 20);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -0.15 - (1 - out) * (pulling ? 1.35 : 0.18), 20);
    }
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
  const gunsIK = !flyingFree && player.meleeT <= 0 && player.darkT <= 0 && w !== 'fists';
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
  } else if (w === 'fists'){
    // HOLSTERED — a fighting stance between blows: side-on with the left shoulder leading, the lead fist out at eye
    // height and the rear one tucked by the chin, bouncing on the knees (the footing comes from FOOTWORK.brawler; the
    // close-quarters beats below pose the swings)
    mandoAimPoint();
    if (player.meleeT <= 0){
      const bob = Math.sin(G.gt * 4.4) * 0.035, sh = player.isShielding;   // RMB: the lead forearm holds the gauntlet's disc out across the front
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, sh ? -1.5 : -1.4 - bob, 12); R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, sh ? 0.25 : 0.05, 12);
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, sh ? -1.6 : -1.25, 12);
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.1 + bob, 12); R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.2, 12);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.9, 12);
      R.torso.rotation.y = dr(R.torso.rotation.y, 0.32, 10);   // bladed: the lead shoulder turned to the foe
      if (player.grounded) vis.position.y = dr(vis.position.y, -0.03 + Math.abs(bob) * 0.6, 10);
    }
  } else if (gunsIK){
    // GUNSLINGER — blasters at the hip until he shoots, then up one-handed down the aim line; the disruptor shouldered
    const aimPt = mandoAimPoint();   // also refreshes the reticle lock state (player.lockOn)
    if (twoH) riflePose(dt, R, player, aimPt);
    else pistolPose(dt, R, player, aimPt, w === 'dual', { braced: player.blockHeld, backRun: player.backRun });
  } else {
    mandoAimPoint();
  }
  if (player.darkT <= 0) player._darkSw = null;
  if (w !== 'fists' && w !== 'darksaber' && player.darkT <= 0 && !(player.meleeT > 0)) R.torso.rotation.y = dr(R.torso.rotation.y, 0, 10);   // square up out of the fighting stance
  }   // end !flyingFree (the flight pose below owns the arms during a boosted superman)
  if (!gunsIK || flyingFree || w === 'darksaber'){
    // an FK pose owns the arms: settle the guns back into their holds and the wrists square
    if (w !== 'darksaber' && player.darkT <= 0){ R.armR.wr.quaternion.slerp(_IDQ, Math.min(1, dt*12)); R.armL.wr.quaternion.slerp(_IDQ, Math.min(1, dt*12)); }
    if (w !== 'fists'){ restGun(player.pistols.R, dt); restGun(player.pistols.L, dt); }   // (holstered guns hang still)
    if (w !== 'darksaber' && player.darkT <= 0) R.chest.rotation.y = dr(R.chest.rotation.y, 0, 10);
  }
  // DISRUPTOR barrel: aimed by riflePose while shouldered; otherwise lies back along the forearm at rest
  if (player.rifleMesh && w !== 'fists' && !(gunsIK && twoH && (player.zoom || player.aiming > 0))){
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
  // CLOSE QUARTERS (E, player/mando/melee.js) — each beat of the kit has its own body: a left jab, a right cross, a
  // rising knee, the vibroblade slash, the shoulder-first jet charge, the boot-first dive, the vambrace catch
  if (!(player.meleeT > 0)) R.torso.rotation.x = dr(R.torso.rotation.x, player.weapon === 'fists' && player.grounded ? 0.1 : 0, 12);   // settle a knee/charge/dive hunch (the fighting stance keeps the chin down)
  wristBlade(dt, R, player.meleeT > 0 && BLADE_OUT[player.meleeKind]);
  player.bashOut = 0;
  if (player.meleeT > 0){
    const dur = player.meleeMax || 0.32, age = dur - player.meleeT + (player.meleeSkip || 0);
    const mk = clamp(age / dur, 0, 1);                                       // 0→1 through the move
    const kind = player.meleeKind || 'cross';
    const c = BLOW_CONTACT[kind] ?? 0.1;
    const v = blowCurve(age, c, dur);   // -1 chambered … +1 full extension AT the contact frame … 0 back on guard
    const ld = Math.max(0, v), ch = Math.max(0, -v);                         // the drive and the load, split
    const snap = age > c * 0.55 && age < c + 0.05 ? 70 : 30;                // joints follow hard through the snap
    if (kind === 'jab'){
      // lead hand: tucked to the chin, then fired straight out off a short hip turn, then snapped back to guard
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.35 - ld*0.32 + ch*0.12, snap);
      R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.12 + ld*0.06, snap);
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.45 + ld*1.4 - ch*0.2, snap);
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.2, 20); R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.75, 20);   // rear hand guards
      R.torso.position.z = dr(R.torso.position.z, ld * 0.24 - ch * 0.04, snap);
      R.torso.rotation.y = dr(R.torso.rotation.y, ld * 0.26 - ch * 0.08, snap);
      R.torso.rotation.x = dr(R.torso.rotation.x, ld * 0.06, 24);
    } else if (kind === 'knee'){
      // grab, haul the head down, drive the knee up into it: the hip loads back, then the whole body rises through it
      // (legs are set outright: the gait writes them every frame, so easing toward a target would fight it)
      R.legR.hip.rotation.x = 0.35 * ch - 1.8 * ld;
      R.legR.knee.rotation.x = 0.5 + ch * 0.4 + ld * 1.55;
      R.legL.knee.rotation.x = 0.25 * ch + 0.1 * ld;   // the standing leg sits, then pushes up
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.45 + ld * 0.35, 26); R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.3 - ld * 0.35, 26);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.45 + ld * 0.35, 26); R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.3 - ld * 0.35, 26);
      R.torso.rotation.x = dr(R.torso.rotation.x, -0.12 * ch + 0.3 * ld, snap);   // lean back to load, fold over the knee
      vis.position.y = dr(vis.position.y, -0.06 * ch + 0.07 * ld, 30);
    } else if (kind === 'blade' || kind === 'takedown'){
      // the wrist blade carves across: wound high over the right shoulder, ripped through to the left hip, the torso
      // unwinding behind it and the follow-through carrying past the target
      const sweep = clamp(v >= 0 && age > c ? 1 + (1 - v) * 0.25 : (v + 1) / 2, 0, 1.25);
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -2.55 + sweep * 1.7, snap);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.75 - sweep * 1.5, snap);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.2 + Math.min(1, sweep) * 1.0, snap);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.1 + sweep * 0.5, 20); R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.5, 20);
      R.torso.rotation.y = dr(R.torso.rotation.y, 0.45 - sweep * 0.9, snap);
      R.torso.rotation.x = dr(R.torso.rotation.x, ld * 0.12, 24);
      R.torso.position.z = dr(R.torso.position.z, ld * (kind === 'takedown' ? 0.42 : 0.3), snap);
      vis.position.y = dr(vis.position.y, -0.08 * ld, 26);   // sinks into the cut
    } else if (kind === 'hackA' || kind === 'hackB'){
      // SHIELD AND BLADE: the gun hand carves a flat cut out from behind the disc while the shield arm holds its
      // guard. hackA is the forehand (wound out right, ripped across to the left), hackB the backhand that answers it
      // the fist is IK'd round a flat arc at chest height (chest space: + x is his right, + z ahead), so the blade
      // springing past it carves level through the front rank; the arm reaches out straight through the middle
      const sweep = clamp(v >= 0 && age > c ? 1 + (1 - v) * 0.2 : (v + 1) / 2, 0, 1.2);
      const s = kind === 'hackA' ? 1 : -1, mid = Math.sin(Math.min(1, sweep) * Math.PI);
      const from = s > 0 ? 1.35 : -0.95, to = s > 0 ? -0.95 : 1.35, a = from + (to - from) * sweep;
      const rad = 0.38 + mid * 0.22;
      solveArm(R.armR, HACK_T.set(0.1 + Math.sin(a) * rad, 0.24 - mid * 0.04, 0.08 + Math.cos(a) * rad), HACK_POLE);
      R.armR.wr.quaternion.identity();
      R.torso.rotation.y = dr(R.torso.rotation.y, s * (0.4 - sweep * 0.8), snap);
      R.torso.position.z = dr(R.torso.position.z, ld * 0.18, snap);
      vis.position.y = dr(vis.position.y, -0.06 * ld, 26);
    } else if (kind === 'bash'){
      // the shield arm drives the disc out into the front rank, the left shoulder and the body's weight behind it
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.5 - ld * 0.1, snap);
      R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.25 - ld * 0.2, snap);
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.6 + ld * 1.25 - ch * 0.15, snap);
      R.torso.position.z = dr(R.torso.position.z, ld * 0.42 - ch * 0.1, snap);
      R.torso.rotation.y = dr(R.torso.rotation.y, ld * 0.35 - ch * 0.2, snap);
      R.torso.rotation.x = dr(R.torso.rotation.x, ld * 0.1, 24);
      vis.position.y = dr(vis.position.y, -0.06 * ld, 26);
      player.bashOut = ld;
    } else if (kind === 'hookL' || kind === 'hookR'){
      // HOLSTERED HOOK: the elbow up level with the fist, the arm bent like a bow, swung round in a flat arc from out
      // wide to across the front with the hips and shoulders whipping behind it (the other fist stays by the chin)
      const s = kind === 'hookL' ? -1 : 1, A = s < 0 ? R.armL : R.armR, O = s < 0 ? R.armR : R.armL;
      const sweep = clamp(v >= 0 && age > c ? 1 + (1 - v) * 0.15 : (v + 1) / 2, 0, 1.15);   // 0 wound out … 1 through the target
      A.sh.rotation.x = dr(A.sh.rotation.x, -1.45 - ld * 0.12, snap);
      A.sh.rotation.y = dr(A.sh.rotation.y, s * (0.95 - sweep * 1.45), snap);
      A.el.rotation.x = dr(A.el.rotation.x, -1.5 + ld * 0.25, snap);
      O.sh.rotation.x = dr(O.sh.rotation.x, -1.2, 20); O.el.rotation.x = dr(O.el.rotation.x, -1.85, 20);
      R.torso.rotation.y = dr(R.torso.rotation.y, s * (0.5 - sweep * 1.0), snap);
      R.torso.position.z = dr(R.torso.position.z, ld * 0.2, snap);
      vis.position.y = dr(vis.position.y, -0.06 * ld, 26);
    } else if (kind === 'upper'){
      // UPPERCUT: dip the right shoulder and sink the knees, then drive up through the legs, the fist rising close to
      // the body and up under the chin, the elbow staying bent
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.35 + ch * 0.2 - ld * 1.75, snap);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 0.1 - ld * 0.2, snap);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.85 + ld * 0.55, snap);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.25, 20); R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.75, 20);
      R.torso.rotation.y = dr(R.torso.rotation.y, 0.3 * ch - 0.25 * ld, snap);
      R.torso.rotation.x = dr(R.torso.rotation.x, 0.22 * ch - 0.14 * ld, snap);   // hunched to load, lifting back through it
      R.torso.position.z = dr(R.torso.position.z, ld * 0.16, snap);
      vis.position.y = dr(vis.position.y, -0.12 * ch + 0.05 * ld, 30);
    } else if (kind === 'haymaker'){
      // HAYMAKER: the whole right side wound far back and up, then the fist thrown over the top and down across the
      // body, the body turning right through it and the weight landing on the lead foot, carrying well past the target
      const sweep = clamp(v >= 0 && age > c ? 1 + (1 - v) * 0.3 : (v + 1) / 2, 0, 1.3);
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -2.1 + Math.sin(Math.min(1, sweep) * Math.PI) * 0.35 + Math.max(0, sweep - 1) * 1.2, snap);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, 1.15 - sweep * 1.7, snap);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.7 + Math.min(1, sweep) * 1.35, snap);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.1 + ld * 0.4, 20); R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.6, 20);
      R.torso.rotation.y = dr(R.torso.rotation.y, 0.7 - sweep * 1.25, snap);
      R.torso.rotation.x = dr(R.torso.rotation.x, -0.1 * ch + 0.22 * ld, snap);
      R.torso.position.z = dr(R.torso.position.z, ld * 0.38 - ch * 0.08, snap);
      vis.position.y = dr(vis.position.y, -0.1 * ld, 26);
    } else if (kind === 'charge'){
      R.torso.rotation.y = dr(R.torso.rotation.y, -0.55, 18);
      R.torso.position.z = dr(R.torso.position.z, 0.3, 18);
      R.torso.rotation.x = dr(R.torso.rotation.x, 0.3, 18);
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -0.7, 20); R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.9, 20);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.9, 20); R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.6, 20);
    } else if (kind === 'dive'){
      R.legR.hip.rotation.x = -1.25; R.legR.knee.rotation.x = 0.1;   // the lead boot driven out at the target
      R.legL.hip.rotation.x = 0.35;  R.legL.knee.rotation.x = 1.4;
      R.torso.rotation.x = dr(R.torso.rotation.x, -0.2, 18);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -0.4, 16); R.armL.sh.rotation.z = dr(R.armL.sh.rotation.z, 0.6, 16);
    } else if (kind === 'catch'){
      // the left vambrace thrown up across the face, the blow turned on the beskar: it jars back on the impact
      const jar = Math.max(0, 1 - mk * 3);
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.75 + jar * 0.2, 34);
      R.armL.sh.rotation.y = dr(R.armL.sh.rotation.y, 0.65, 34);
      R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.65 - jar * 0.2, 34);
      R.torso.rotation.y = dr(R.torso.rotation.y, 0.22, 24);
      R.torso.position.z = dr(R.torso.position.z, -0.12 * jar, 30);
    } else {
      // the rear CROSS: weight loads onto the back foot with the shoulder turned away, then the hips and shoulder
      // whip through and the fist lands at full reach with the body behind it, then it snaps home to the chin
      R.armR.sh.rotation.x = dr(R.armR.sh.rotation.x, -1.3 - ld*0.42 + ch*0.1, snap);
      R.armR.sh.rotation.y = dr(R.armR.sh.rotation.y, -0.16 * ld + 0.1 * ch, snap);
      R.armR.sh.rotation.z = dr(R.armR.sh.rotation.z, -0.05, 22);
      R.armR.el.rotation.x = dr(R.armR.el.rotation.x, -1.6 + ld*1.55 - ch*0.15, snap);   // elbow snaps straight on the punch
      R.armL.sh.rotation.x = dr(R.armL.sh.rotation.x, -1.25, 20); R.armL.el.rotation.x = dr(R.armL.el.rotation.x, -1.7, 20);   // lead hand pulls back to guard
      R.torso.position.z = dr(R.torso.position.z, ld * 0.36 - ch * 0.08, snap);   // shoulder drives forward for weight
      R.torso.rotation.y = dr(R.torso.rotation.y, -ld * 0.42 + ch * 0.3, snap);   // the hip-and-shoulder turn
      R.torso.rotation.x = dr(R.torso.rotation.x, ld * 0.1, 24);
      vis.position.y = dr(vis.position.y, -0.05 * ld, 26);   // the knees give into the punch
    }
  }
  // === SINGLE-BLASTER GAUNTLET SHIELD — projected energy disc on the left forearm. Driven here (not in the
  // grounded branch) so it holds whether you're standing OR flying. Flares on a catch; warns amber when stamina
  // runs low (the shield can't deflect once it's dry).
  const wasShielding = player.isShielding;
  player.isShielding = mandoShielding();
  if (player.isShielding && !wasShielding) player.shieldFlash = Math.max(player.shieldFlash || 0, 0.1);   // the disc pops up as it re-forms
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
    sg.position.z = 0.95 + (player.bashOut || 0) * 0.45;   // the bash throws the disc out ahead of the arm
    const flare = player.shieldFlash, shimmer = 0.05 * Math.sin(G.gt * 9);
    sg.scale.setScalar(SHIELD_SIZE * (1 + flare * 1.5));
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

/* CAPTURED UPPER BODY — with the motion-captured stride the chest twists against the pelvis and the head holds
   steady, laid on top of whatever pose the arms and torso are in. When the hands are busy (a swing, a block, a cast,
   the Mando aiming) the shoulders instead stay square while the pelvis turns under them. Called with no gait to
   take the last frame's layer off before posing. */
function mocapUpper(R, g){
  const A = player._mcUp || (player._mcUp = { ty: 0, tz: 0, hy: 0 });
  R.torso.rotation.y -= A.ty; R.torso.rotation.z -= A.tz; R.head.rotation.y -= A.hy;
  A.ty = A.tz = A.hy = 0;
  const B = g && g.body;
  if (!B || !player.grounded || player.flip) return;
  const w = g.w * (player._mcAlong ?? 1);
  const free = G.hero !== 'mando' && player.atkT <= 0 && !player.blockHeld && player.castT <= 0 && player.judgeT <= 0 ? 1 : 0;
  const yaw = lerp(-B.yaw, B.cyaw, free) * w, roll = lerp(-B.roll, B.croll, free) * g.w * (player._mcCalm ?? 1);
  A.ty = yaw; A.tz = -roll; A.hy = -(B.yaw * w + yaw) * 0.8;
  R.torso.rotation.y += A.ty; R.torso.rotation.z += A.tz; R.head.rotation.y += A.hy;
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
  const yawRate = player._lastYaw == null ? 0 : wrapAngle(yaw - player._lastYaw) / dt;
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
