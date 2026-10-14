// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Per-frame locomotion: movement with momentum, the Jedi Force jump/glide, and gravity + landing.

import { CFG } from '../data/config.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../utils.js';
import { burst } from '../fx/particles.js';
import { G, keys, player } from '../state.js';
import { MANDO, JEDI_FORCE, JUMP_HOLD_THRESH, forceJumpPow } from '../data/mando.js';
import { stance, maxHp } from './helpers.js';
import { focusMoveMul } from './jedi/focus.js';
import { slamImpact } from './jedi/force.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { clampToArena, collideSolids } from '../world/collision.js';
import { mandoSlamImpact } from './mando/gadgets.js';

// Horizontal movement: WASD steering on the ground (or Mando air momentum), plus lunge/dash impulse velocity.
// Returns whether there is movement input this frame (the pose code reads it).
export function updateMovement(dt, pp, st, f, r){
  // --- movement with momentum; blocking and channeling root you in ---
  const speedMul = (st.move || 1) * player.up.move * (player.blockHeld ? 0.5 : 1) * (player.zoom ? 0.4 : 1) * (player.judgeT > 0 ? 0.45 : 1)
                   * (player.atkT > 0 && st.moveAtk ? st.moveAtk : 1)              // SHII-CHO keeps its feet moving mid-swing
                   * (player.atkT > 0 && st.moveAtkPenalty ? st.moveAtkPenalty : 1)    // DARKSABER crawls while committed to a swing
                   * (1 + (player.momentumStacks || 0) * 0.06)                          // MOMENTUM boon — kills build speed
                   * (player.boon && player.boon.adrenal && player.hp < maxHp()*0.35 ? 1.18 : 1)    // ADRENALINE boon — desperate burst
                   * focusMoveMul();                                                     // FORCE FOCUS — lighter on the feet in flow
  const want = V3(0,0,0);
  if (keys['w']) want.add(f);
  if (keys['s']) want.sub(f);
  if (keys['d']) want.add(r);
  if (keys['a']) want.sub(r);
  const moving = want.lengthSq() > 0.01;
  const mandoAir = G.hero === 'mando' && !player.grounded;
  if (mandoAir){
    // MOMENTUM FLIGHT — WASD ADDS horizontal thrust; release and the speed CARRIES (low drag). A soft cap keeps
    // top speed sane; HOVERING (RMB) brakes hard into a steady firing platform. The SPACE look-thrust (below)
    // adds the divey forward/vertical momentum.
    if (moving){ want.normalize(); player.moveVel.addScaledVector(want, MANDO.airAccel * dt); }
    const cap = player.hovering ? MANDO.airSpeed * 0.5 : MANDO.airSpeedMax;
    let hsp = Math.hypot(player.moveVel.x, player.moveVel.z);
    if (hsp > cap){ const s2 = Math.max(cap/hsp, 1 - dt*5); player.moveVel.x *= s2; player.moveVel.z *= s2; }   // ease back to the cap
    const drag = player.hovering ? 5.0 : MANDO.airDrag;   // hover = brake to a platform; free flight = momentum carries
    const k = Math.max(0, 1 - dt*drag);
    player.moveVel.x *= k; player.moveVel.z *= k;
    pp.addScaledVector(player.moveVel, dt);
  } else {
    // GROUND (or Jedi): steer toward the input direction at the stance's acceleration; quick decel on release
    const topSpeed = CFG.player.speed * speedMul;
    if (moving) want.normalize().multiplyScalar(topSpeed);
    TMP.subVectors(want, player.moveVel);
    const dl = TMP.length();
    const accelMul = (st.accel || 1) * (moving ? 1 : 1.6);
    if (dl > 0.001) player.moveVel.addScaledVector(TMP.normalize(), Math.min(dl, CFG.player.accel * accelMul * dt));
    pp.addScaledVector(player.moveVel, dt);
  }
  // impulse velocity (lunge/dash) with damping — a flip/dash GLIDES (low drag) so it actually carries you
  pp.addScaledVector(player.vel, dt);
  const velDrag = (player.flip || player.dashT > 0) ? 2.6 : 9;
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
  // gravity / landing — gentled while the Jedi is gliding (graceful arc), fully cancelled during the Mando hover
  player.vy -= CFG.player.gravity * (player.hovering ? 0 : player.gliding ? JEDI_FORCE.riseGravity : 1) * dt;
  if (player.gliding && player.vy < -JEDI_FORCE.glideFall) player.vy = -JEDI_FORCE.glideFall;   // graceful (not floaty) descent
  pp.y += player.vy * dt;
  // resolve solid obstacles horizontally + find the surface underfoot (floor or a platform top)
  const wasGrounded = player.grounded;
  const support = collideSolids(pp, CFG.player.radius, player.vy <= 0.01);
  player.groundY = support;   // surface height directly beneath us — the pose code measures flight altitude from HERE
                              // (so hovering just over a tall pillar reads as low, not high)
  if (pp.y <= support + 0.001){
    const impact = Math.max(0, -player.vy);   // how hard you came down (drives the touchdown beat)
    pp.y = support; player.vy = 0;
    if (player.slamming){
      (G.hero === 'mando' ? mandoSlamImpact : slamImpact)();
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
      if (G.hero === 'mando') burst(lp, 0x9ad8ff, Math.round(2 + dustAmt*5), 3 + dustAmt*4, -2, 0.7);   // jetpack exhaust wash
      sfx(80 - dustAmt*34, 0.1 + dustAmt*0.1, 'sine', 0.045 + dustAmt*0.1, 30);   // a low thud, deeper the harder you land
      if (impact > 13){
        const hard = clamp((impact - 13) / 16, 0, 1);
        spawnGroundShock(lp, G.hero === 'mando' ? 0x9ad8ff : 0xbfe8ff, 2.6 + hard*4, 0.34, 0.45 + hard*0.4);
        G.shake = Math.max(G.shake, 0.25 + hard*0.45);
        player.landDip = 0.16 + hard*0.34;        // the view drops on the impact, then recovers
        sfx(150, 0.1, 'square', 0.05, 60);        // an extra crunch on a heavy drop
      }
    }
    player.grounded = true; player.airLeft = CFG.player.airJumps;
    player.doubleJumped = false; player.fjUsed = false;   // re-arm the Force-jump takeoff for the next leap
  } else player.grounded = false;
  clampToArena(pp, null, null);
}
