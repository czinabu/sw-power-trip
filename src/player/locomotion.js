// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Per-frame locomotion: movement with momentum, the Jedi Force jump/glide, and gravity + landing.

import { CFG } from '../data/config.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../utils.js';
import { burst } from '../fx/particles.js';
import { G, keys, player, isGunner } from '../state.js';
import { MANDO, JEDI_FORCE, JUMP_HOLD_THRESH, forceJumpPow } from '../data/mando.js';
import { stance, maxHp } from './helpers.js';
import { focusMoveMul } from './jedi/focus.js';
import { slamImpact } from './jedi/force.js';
import { stompImpact } from './jedi/palm.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { clampToArena, collideSolids, ceilHit, BODY_H } from '../world/collision.js';
import { mandoSlamImpact } from './mando/gadgets.js';
import { MOVE } from '../data/movement.js';
import { MANDO_MOBILITY, MOBILITY } from '../data/mobility.js';
import { updateMantle, tryAutoMantle, updateWallRun, landingImpact, updateHang, updateForceSlide } from './parkour.js';
import { doJump } from './movement.js';
import { swingMoveMul, airControlMul, inCombat } from './mobility.js';
import { padMove } from '../engine/gamepad.js';

// Horizontal movement: WASD steering on the ground (or Mando air momentum), plus lunge/dash impulse velocity.
// Returns whether there is movement input this frame (the pose code reads it).
export function updateMovement(dt, pp, st, f, r){
  // --- movement with momentum; blocking and channeling root you in ---
  const speedMul = (st.move || 1) * player.up.move * (player.blockHeld ? 0.5 : 1) * (player.zoom ? 0.4 : 1) * (player.judgeT > 0 ? 0.45 : 1) * (player.clinch ? player.clinch.move : 1)   // a foe held in the Mando's clinch drags his feet (mando/melee.js)
                   * (player.atkT > 0 && st.moveAtk ? st.moveAtk : 1)              // ATARU keeps its feet moving mid-swing
                   * (player.atkT > 0 && st.moveAtkPenalty ? st.moveAtkPenalty : 1)    // DARKSABER crawls while committed to a swing
                   * (1 + (player.momentumStacks || 0) * 0.06)                          // MOMENTUM boon — kills build speed
                   * (player.surgeT > G.gt ? player.surgeMul : 1)                      // CHASE SURGE — parkour on a story pursuit
                   * (player.boon && player.boon.adrenal && player.hp < maxHp()*0.35 ? 1.18 : 1)    // ADRENALINE boon — desperate burst
                   * focusMoveMul()                                                      // FORCE FOCUS — lighter on the feet in flow
                   * (player.gunSlow || 1)                                               // the HEAVY REPEATER weighs him down while it fires (mando/weapons.js)
                   * (player.atkT > 0 && !isGunner() ? swingMoveMul() : 1)       // a swing plants the feet: spacing is yours to manage (Djem So walks its cuts in)
                   * (player.landStagT > 0 ? MOVE.staggerMove : 1)                      // HARD LANDING — the knees are still buckled
                   * (player.flinchT > 0 ? CFG.player.flinch.move : 1)                  // HIT REACTION — reeling from a blow
                   * (player.saberLock ? 0 : 1)                                          // SABER LOCK — feet planted in the bind
                   * (player.airCut && player.airCut.phase !== 'fall' ? 0 : 1);          // AERIAL CUT — the dash steers itself (jedi/aerial.js)
  const want = V3(0,0,0);
  if (keys['w']) want.add(f);
  if (keys['s']) want.sub(f);
  if (keys['d']) want.add(r);
  if (keys['a']) want.sub(r);
  if (padMove.on) want.set(0, 0, 0).addScaledVector(f, padMove.y).addScaledVector(r, padMove.x);   // a gamepad's stick steers any way, not just 8
  const moving = want.lengthSq() > 0.01;
  // RUN / WALK (Jedi) — Q toggles between them; every life starts in RUN. Running forward (W) on the ground sprints:
  // faster and heavier to steer, and it never costs stamina, fight or no fight. In WALK the
  // Jedi paces, a brisk purposeful walk, fight or no fight: the Vader walk, cutting down whatever comes into reach.
  const wasSprinting = player.sprinting;
  player.sprinting = !isGunner() && !!player.sprintOn && !!keys['w'] && (player.grounded || wasSprinting)
                     && !keys['alt'] && !player.blockHeld && player.atkT <= 0 && !(player.flinchT > 0)
                     && !(player.landStagT > 0) && !(player.slideT > 0) && !player.mantle && !player.hang;
  player.walking = !isGunner() && !player.sprintOn && player.grounded;
  // PIVOT — reversing hard at speed plants the feet: you brake to a stop before the new direction takes
  if (player.pivotT > 0) player.pivotT -= dt;
  else if (!isGunner() && player.grounded && moving && !(player.slideT > 0)){
    const sp = Math.hypot(player.moveVel.x, player.moveVel.z);
    if (sp > MOVE.pivotMinSpeed){
      const wl = Math.hypot(want.x, want.z), cosA = (want.x * player.moveVel.x + want.z * player.moveVel.z) / (wl * sp);
      if (cosA < Math.cos(MOVE.pivotAngle)) player.pivotT = MOVE.pivotTime;
    }
  }
  if (player.slideT > 0) player.slideT -= dt;
  const mandoAir = isGunner() && !player.grounded && !player.wallRun && !player.hang;
  if (mandoAir){
    // MOMENTUM FLIGHT — WASD ADDS horizontal thrust; release and the speed CARRIES (low drag). Pressing against the
    // momentum counter-thrusts, so he turns on a dime. A soft cap keeps top speed sane; HOVERING (RMB) is a firing
    // platform that strafes quickly and holds still when you let go. Tuning: data/mobility.js MANDO_MOBILITY.air.
    const AM = MANDO_MOBILITY.air;
    if (moving){
      want.normalize();
      let acc = MANDO.airAccel * (player.hovering ? AM.hoverAccel : AM.accel);
      if (want.x * player.moveVel.x + want.z * player.moveVel.z < 0) acc *= AM.counter;
      player.moveVel.addScaledVector(want, acc * dt);
    }
    const cap = player.hovering ? AM.hoverSpeed : MANDO.airSpeedMax;
    let hsp = Math.hypot(player.moveVel.x, player.moveVel.z);
    if (hsp > cap){ const s2 = Math.max(cap/hsp, 1 - dt*5); player.moveVel.x *= s2; player.moveVel.z *= s2; }   // ease back to the cap
    const drag = player.hovering ? (moving ? AM.hoverDrift : AM.hoverStop) : MANDO.airDrag;   // hover = a platform; free flight = momentum carries
    const k = Math.max(0, 1 - dt*drag);
    player.moveVel.x *= k; player.moveVel.z *= k;
    pp.addScaledVector(player.moveVel, dt);
  } else if (player.mantle || player.hang){
    // a ledge pull-up / vault / hang owns the body (parkour.js)
  } else if (player.slideT > 0 && player.grounded){
    // SLIDE — the skid carries the run's speed and bleeds it off. The Jedi's doesn't steer; the Mando's bends a little
    // toward the keys (data/mobility.js MANDO_MOBILITY.slide)
    const SL = MANDO_MOBILITY.slide;
    if (isGunner() && moving){
      const sp = Math.hypot(player.moveVel.x, player.moveVel.z);
      if (sp > 0.5){
        const cur = Math.atan2(player.moveVel.x, player.moveVel.z), tgt = Math.atan2(want.x, want.z);
        let d = tgt - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < 2.2){   // (pulling back doesn't spin the skid round)
          const a = cur + clamp(d, -SL.steer * dt, SL.steer * dt);
          player.moveVel.x = Math.sin(a) * sp; player.moveVel.z = Math.cos(a) * sp;
        }
      }
    }
    player.moveVel.multiplyScalar(Math.max(0, 1 - dt * (isGunner() ? SL.drag : MOVE.forceSlideDrag)));
    pp.addScaledVector(player.moveVel, dt);
    // dust thrown up off the floor by the hip and the lead heel, thinning as the skid slows
    const ssp = Math.hypot(player.moveVel.x, player.moveVel.z);
    if (Math.random() < dt * ssp * 2.2) burst(V3(pp.x + rand(-0.25, 0.25), 0.08, pp.z + rand(-0.25, 0.25)), isGunner() ? 0x9a9288 : 0xa89a86, 1, 1.6, 0.5, 0.7);
    updateForceSlide(pp);
  } else {
    // GROUND (or Jedi): steer toward the input direction at the stance's acceleration. Speed BUILDS, and planting to
    // stop or turn back against your momentum brakes harder. In the AIR the jump keeps its takeoff momentum: WASD
    // only nudges it (no input = no steering at all), so a leap is a commitment instead of a floaty drift.
    const airborne = !player.grounded && !player.wallRun;
    const topSpeed = CFG.player.speed * speedMul * (player.sprinting ? MOVE.sprintMul : player.walking ? MOVE.walkMul : 1);
    if (moving && !(player.pivotT > 0)) want.normalize().multiplyScalar(topSpeed);
    else if (player.pivotT > 0) want.set(0, 0, 0);   // planted: kill the old momentum first
    if (!(airborne && !moving)){
      TMP.subVectors(want, player.moveVel);
      const dl = TMP.length();
      const against = !moving || want.dot(player.moveVel) < 0 || player.pivotT > 0;
      // RUN mode (Jedi, on the ground): a very short wind-up and wind-down, full speed in a fraction of a second
      const run = !isGunner() && player.sprintOn && !airborne;
      const gunRun = isGunner() && !airborne;   // Mando and trooper on their feet: quick start, firm plant
      let accel = gunRun ? (against ? MOVE.gunnerBrake : MOVE.gunnerAccel) * (st.accel || 1) : run ? (against ? MOVE.runBrake : MOVE.runAccel) * (st.accel || 1)
                      : (against ? MOVE.brake : MOVE.accel) * (st.accel || 1) * (player.sprinting && !against ? MOVE.sprintAccel : 1);
      if (airborne) accel = MOVE.accel * (st.accel || 1) * (player.gliding ? 0.5 : MOVE.airControl) * airControlMul();   // a leap in a fight steers less
      if (dl > 0.001) player.moveVel.addScaledVector(TMP.normalize(), Math.min(dl, accel * dt));
    }
    pp.addScaledVector(player.moveVel, dt);
  }
  // impulse velocity (lunge/dash) with damping — a flip/dash GLIDES (low drag) so it actually carries you
  pp.addScaledVector(player.vel, dt);
  // ROOT MOTION — a grounded cut carries the body through the swing: little in the chamber, most of it driving into
  // the strike, settling by the follow-through (the distance is set in jedi/combat.js stepIntoCut)
  const sw = player.atkT > 0 && player.swing, tr = sw && sw.travel;
  if (tr){
    const k = clamp((sw.t / sw.dur - MOVE.cutTravel[0]) / (MOVE.cutTravel[1] - MOVE.cutTravel[0]), 0, 1);
    const f = k * k * (3 - 2 * k), df = f - tr.done;
    tr.done = f;
    pp.x += tr.x * df; pp.z += tr.z * df;
    player._rootVX = tr.x * df / Math.max(dt, 1e-4); player._rootVZ = tr.z * df / Math.max(dt, 1e-4);
  } else player._rootVX = player._rootVZ = 0;
  const skid = player.flip && player.flip.kind === 'dive' && player.flip.landT && isGunner();
  // a ROLL / DIVE is a burst that eases out (fast off the mark, planted by the end), not a flat glide
  const rolling = player.dodgeKind === 'roll' && G.gt - (player.rollAt ?? -9) < MOBILITY.roll.time;
  const diving = isGunner() && player.dodgeKind === 'dive' && player.flip && player.flip.kind === 'dive' && !player.flip.landT;
  const velDrag = skid ? MANDO_MOBILITY.dive.skidDrag : rolling ? MOBILITY.roll.drag : diving ? MANDO_MOBILITY.dive.airDrag : (player.flip || player.dashT > 0) ? 2.6 : (!player.grounded && !isGunner()) ? 1.2 : 9;   // airborne impulses (wall kicks, leaps) carry
  player.vel.multiplyScalar(Math.max(0, 1 - dt*velDrag));
  if (player.kickT > 0) player.kickT -= dt;   // JEDI front-kick recovery (hero-agnostic so it always winds down)
  return moving;
}

export function updateForceJump(dt, pp, f, r){
  // --- JEDI Force jump: only when you HOLD space (a tap is just a normal jump). The TAKEOFF eats the bulk of
  //     the Force up front, then it sips slowly while held; arcs up then glides down. Power auto-levels (fjTier).
  if (G.hero === 'jedi' && !!keys[' '] && !player.grounded) player.jumpHoldT = (player.jumpHoldT || 0) + dt;
  else player.jumpHoldT = 0;
  const wasGliding = player.gliding;
  player.gliding = false;
  // ASCENDING needs a held space (past the tap threshold) to trigger the TAKEOFF leap; once DESCENDING, holding
  // space simply FLOATS you down — engages instantly (no takeoff), and always costs Force.
  const descending = player.vy <= 0.3;
  const forceJumpHeld = G.hero === 'jedi' && !!keys[' '] && !player.grounded && !player.slamming && G.mode === 'play' && player.force > 1
                        && (player.jumpHoldT > JUMP_HOLD_THRESH || (descending && wasGliding));
  if (forceJumpHeld){
    const pow = forceJumpPow();
    player.gliding = true;
    // drift in the input direction (or straight ahead) — gentle, not a thrust
    const sdir = V3(0,0,0);
    if (keys['w']) sdir.add(f); if (keys['s']) sdir.sub(f);
    if (keys['d']) sdir.add(r); if (keys['a']) sdir.sub(r);
    if (sdir.lengthSq() < 0.01) sdir.copy(f);
    sdir.normalize();
    if (Math.hypot(player.moveVel.x, player.moveVel.z) < JEDI_FORCE.soarMax)
      player.moveVel.addScaledVector(sdir, JEDI_FORCE.soarAccel * dt);
    if (!wasGliding && !descending && !player.fjUsed){
      // TAKEOFF — ONCE per airborne stint (fjUsed), on the way up. Use MAX (never ADD) so it can't stack on a
      // double-jump's velocity and rocket away — it lifts you TO the leap speed, no higher.
      player.fjUsed = true;
      player.vy = Math.max(player.vy, pow.takeoff);   // lift TO the leap speed (never add → no rocket stacking)
      player.force = Math.max(0, player.force - pow.initCost);
      // a burst of blue/white Force energy off the feet on take-off
      S.dash(); burst(V3(pp.x, pp.y + 0.1, pp.z), 0x9fd0ff, 14, 7, -2, 0.9); burst(V3(pp.x, pp.y + 0.1, pp.z), 0xffffff, 8, 9, -1, 0.8);
      spawnGroundShock(V3(pp.x, 0.08, pp.z), 0x9fd0ff, 3.5, 0.3, 0.5);
      sfx(520, 0.14, 'sine', 0.06, 900);
    } else {
      // sustained hold / a descending float — always sips Force (no free descent), slower on the way down
      player.force = Math.max(0, player.force - (player.vy > 0 ? pow.holdCost : pow.glideCost) * dt);
    }
    if (Math.random() < 0.6) burst(V3(pp.x + rand(-0.5,0.5), pp.y + rand(-0.2,0.6), pp.z + rand(-0.5,0.5)), stance().blade, 1, 2, 2, 0.8);
  }
}

export function updateGravityAndLanding(dt, pp){
  if (updateHang(dt, pp)){ player.groundY = 0; return; }   // hanging off a ledge
  if (updateMantle(dt, pp)){ player.groundY = player.mantle ? player.mantle.y1 : pp.y; return; }   // a pull-up owns the body
  if (tryAutoMantle(pp)) return;
  updateWallRun(dt, pp);
  // gravity / landing — gentled while the Jedi is gliding (graceful arc), fully cancelled during the Mando hover.
  // A plain Jedi jump falls HARDER than it rose (no hang at the apex) and a wall-run barely loses height.
  const jediFall = !isGunner() && !player.gliding && player.vy < 0;
  const gMul = player.hovering || (player.airCut && player.airCut.phase !== 'fall') ? 0 :   // (the aerial cut flies its own line: jedi/aerial.js)
               player.wallRun ? MOVE.wallRunGravity : player.gliding ? JEDI_FORCE.riseGravity : jediFall ? MOVE.fallGravity : 1;
  player.vy -= CFG.player.gravity * gMul * dt;
  if (player.gliding && player.vy < -JEDI_FORCE.glideFall) player.vy = -JEDI_FORCE.glideFall;   // graceful (not floaty) descent
  if (player.vy < -MOVE.maxFall) player.vy = -MOVE.maxFall;
  pp.y += player.vy * dt;
  // resolve solid obstacles horizontally + find the surface underfoot (floor or a platform top)
  const wasGrounded = player.grounded;
  const support = collideSolids(pp, CFG.player.radius, player.vy <= 0.01);
  if (ceilHit < Infinity){ pp.y = Math.min(pp.y, ceilHit - BODY_H); if (player.vy > 0) player.vy = 0; }   // the head met an awning / a wing from under it
  // keep the feet on the ground walking down a hill (or off a low step) instead of skipping off it in little hops
  if (wasGrounded && player.vy <= 0 && pp.y > support && pp.y - support < 0.3) pp.y = support;
  player.groundY = support;   // surface height directly beneath us — the pose code measures flight altitude from HERE
                              // (so hovering just over a tall pillar reads as low, not high)
  if (pp.y <= support + 0.001){
    const impact = Math.max(0, -player.vy);   // how hard you came down (drives the touchdown beat)
    const slammed = player.slamming || player.stomp;
    pp.y = support; player.vy = 0;
    if (player.stomp){   // the holstered Jedi's Force stomp lands where you come down (jedi/palm.js)
      player.stomp = false;
      stompImpact();
      player.moveVel.set(0, 0, 0);
    } else if (player.slamming){
      (isGunner() ? mandoSlamImpact : slamImpact)();
      player.slamming = false;
      player.vis.rotation.set(0, 0, 0); player.vis.position.y = 0;   // land CLEAN & square — clear any leftover dive tuck
      player.moveVel.set(0, 0, 0);                                    // kill horizontal drift so the pound lands under you
    } else if (!wasGrounded && impact > 5){
      // TOUCHDOWN. A routine hop (impact ≈ jumpVel 10) just kicks dust + a soft tap; a real DROP — a jetpack descent,
      // a dive, a long fall (well past a normal jump) — lands with weight: a camera DIP that springs back, a quake and
      // a ground ring. So the flight loop finally has impact without jarring the view on every little jump.
      const dustAmt = clamp((impact - 5) / 18, 0, 1);
      const lp = pp.clone().setY(support + 0.15);
      burst(lp, 0xb9c2cc, Math.round(4 + dustAmt*16), 4 + dustAmt*8, 2, 0.85);
      if (isGunner()) burst(lp, 0x9ad8ff, Math.round(2 + dustAmt*5), 3 + dustAmt*4, -2, 0.7);   // jetpack exhaust wash
      S.land(dustAmt);   // a low thud, deeper the harder you land
      if (impact > 13){
        const hard = clamp((impact - 13) / 16, 0, 1);
        spawnGroundShock(lp, isGunner() ? 0x9ad8ff : 0xbfe8ff, 2.6 + hard*4, 0.34, 0.45 + hard*0.4);
        G.shake = Math.max(G.shake, 0.25 + hard*0.45);
        player.landDip = 0.16 + hard*0.34;        // the view drops on the impact, then recovers
        S.heavy();                                 // an extra crunch on a heavy drop
      }
    }
    // HARD LANDING (Jedi) — a long drop buckles the knees unless you rolled out of it (parkour.js)
    if (!wasGrounded && !slammed) landingImpact(impact);
    player.grounded = true; player.airLeft = CFG.player.airJumps;
    player.doubleJumped = false; player.fjUsed = false;   // re-arm the Force-jump takeoff for the next leap
    player.airCutUsed = false;                             // and the aerial cut (jedi/aerial.js)
    player.wallRunUsed = false; player.wallRun = null;
    player.lastGroundT = G.gt;
    // JUMP BUFFER — a jump pressed just before touchdown fires now
    if (!wasGrounded && G.gt - (player.jumpBufT ?? -9) < MOVE.jumpBuffer){ player.jumpBufT = -9; doJump(); }
  } else player.grounded = false;
  clampToArena(pp, null, null);
}
