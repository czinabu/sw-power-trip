// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mando jetpack flight: SPACE thrust, RMB hover, SHIFT boost/dive, fuel drain/refuel and feedback, and the pack visuals.

import { camera } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, clamp, dampToward } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater } from '../../fx/floaters.js';
import { G, keys, player } from '../../state.js';
import { MANDO } from '../../data/mando.js';
import { _look, _lh } from './weapons.js';
import { thrust, jetIgnite } from '../../fx/ink.js';

export function updateMandoFlight(dt, pp, f, r){
  // JETPACK — its OWN limited fuel (player.jet). Drains fast in the air, recovers on the ground.
  const fuelMul = player.up.fuelEff || 1;
  const holdJet = !!keys[' '] && player.jet > 0 && G.mode === 'play' && player.darkT <= 0;
  const wasJet = player.jetActive;
  player.jetActive = holdJet && (!player.grounded || player.vy > -0.2);
  // HOVER engages while airborne and holding RMB (brace OR disruptor scope), not thrusting, with fuel left —
  // so you can hold a steady shot or scoped snipe in mid-air.
  const wantHover = !player.grounded && !player.jetActive && (player.blockHeld || player.zoom) && player.jet > 0 && G.mode === 'play' && player.darkT <= 0;
  player.hovering = false;
  if (player.jetActive){
    if (!wasJet){ S.jetIgnite(); jetIgnite(pp); G.shake = Math.max(G.shake, 0.12); }   // ignition pop
    player.grounded = false; player.doubleJumped = false;
    const jetPow = player.up.jetPow || 0.62;                              // booster-tier power (weak until upgraded)
    // SPACE = pure VERTICAL thrust: a controlled hover/climb. Looking up climbs a little more; no diving here
    // (diving lives on SHIFT-boost). Horizontal momentum is whatever you carry / boost into.
    camera.getWorldDirection(_look);
    const climbExtra = Math.max(0, _look.y + 0.18) * MANDO.climbRange;
    player.vy = dampToward(player.vy, (MANDO.climbBase + climbExtra) * jetPow, dt, 6);
    // DARKSABER jetpack synergy — the thrusters sip fuel while you're mid-swing (an aerial saber assault)
    const meleeEff = (player.weapon === 'darksaber' && player.atkT > 0) ? 0.45 : 1;
    player.jet = Math.max(0, player.jet - MANDO.jetDrain * fuelMul * meleeEff * dt);
    thrust(dt, 1);
    // the roar is a continuous loop in audio/director.js, steered by jetActive / boosting / hovering
  } else if (wantHover){
    // HOVER — hold RMB (aim/brace) mid-air to LOCK altitude and strafe. Burns fuel with NO regen, so it
    // runs dry and drops you when the tank empties (limiting early, efficient once upgraded).
    player.hovering = true;
    player.vy = dampToward(player.vy, 0, dt, 9);                            // arrest the fall → hold position
    player.jet = Math.max(0, player.jet - MANDO.jetHover * (player.up.jetHoverMul || 1.7) * fuelMul * dt);
    thrust(dt, 0.4);
  } else {
    // recover fuel — a trickle in the air, fast on the ground (so you can't fly/hover forever)
    player.jet = Math.min(player.jetMax, player.jet + (player.grounded ? MANDO.jetRegenGround : MANDO.jetRegen) * dt);
  }
  // DIRECTIONAL BOOST — HOLD SHIFT in the air to drive HARD where you're moving/facing; look DOWN to DIVE. This
  // is the committed, momentum-building, fuel-hungry thrust (the ground SHIFT tap is a dodge, handled on keydown).
  // (the SHIFT that started a ground dive doesn't count until it's let go: mando/mobility.js)
  if (!keys['shift']) player.shiftGround = false;
  const boostHeld = !!keys['shift'] && !player.shiftGround && !player.grounded && player.jet > 0 && G.mode === 'play' && player.darkT <= 0;
  player.boosting = boostHeld;
  if (boostHeld){
    const jetPow = player.up.jetPow || 0.62;
    camera.getWorldDirection(_look);
    _lh.set(0,0,0);
    if (keys['w']) _lh.add(f); if (keys['s']) _lh.sub(f); if (keys['d']) _lh.add(r); if (keys['a']) _lh.sub(r);
    if (_lh.lengthSq() < 1e-3) _lh.copy(f);                 // no WASD → boost the way you FACE
    _lh.normalize();
    player.moveVel.addScaledVector(_lh, MANDO.boostThrust * jetPow * dt);    // strong horizontal momentum (carries)
    if (_look.y < -0.1) player.vy += _look.y * MANDO.boostDiveAccel * dt;    // looking down while boosting → DIVE, building speed
    player.jet = Math.max(0, player.jet - MANDO.boostDrain * fuelMul * dt);
    thrust(dt, 1.4, _lh);
  }
  // a jet dive's kick (mando/mobility.js jetDive) burns hot for a beat
  if (player.jetKickT > 0){ player.jetKickT -= dt; if (player.flip && player.flip.dx != null) thrust(dt, 1.4, _lh.set(player.flip.dx, 0, player.flip.dz)); }
  const flying = player.jetActive || player.boosting || player.jetKickT > 0;
  const descCap = flying ? MANDO.diveCap : MANDO.fallCap;   // DIVING (boost + look down) lets you fall much faster
  if (!player.grounded && player.vy < -descCap) player.vy = -descCap;
  // FUEL FEEDBACK — a low warning chirp as the tank runs down, and a SPUTTER the instant it goes dry mid-air
  const wasFlyingFuel = player._wasFlying; player._wasFlying = flying || player.hovering;
  if (player.jet > 5) player.jetEmptyShown = false;
  if ((flying || player.hovering) && player.jet > 0 && player.jet < player.jetMax * 0.22){
    player.lowFuelBeep = (player.lowFuelBeep || 0) - dt;
    if (player.lowFuelBeep <= 0){ player.lowFuelBeep = 0.4; sfx(900, 0.05, 'square', 0.04, 880); }
  }
  if (wasFlyingFuel && player.jet <= 0 && !player.grounded && !player.jetEmptyShown){
    player.jetEmptyShown = true;
    floater(V3(pp.x, pp.y + 1.0, pp.z), 'FUEL OUT', '#ff7a3a');
    burst(V3(pp.x, pp.y + 0.4, pp.z), 0x888888, 8, 5, -2, 0.9); burst(V3(pp.x, pp.y + 0.4, pp.z), 0xff7a3a, 4, 4, -1, 0.7);
    sfx(180, 0.18, 'sawtooth', 0.07, 40); sfx(90, 0.12, 'square', 0.05, 50);   // a thruster cough as it dies
    G.shake = Math.max(G.shake, 0.15);
  }
  // JET FLAMES scale with THRUST level — a hot, long plume when climbing/diving/boosting hard, a soft glow at a hover
  if (player.jetGlow){
    const thrustLvl = flying ? clamp(0.6 + (Math.abs(player.vy) + (player.boosting ? 8 : 0)) / 14, 0.6, 2.0) : (player.hovering ? 0.4 : 0);
    const on = flying ? 0.95 : (player.hovering ? 0.4 : 0);
    for (const gN of player.jetGlow){
      gN.material.opacity += (on - gN.material.opacity) * Math.min(1, dt*14);
      gN.scale.y = 1 + thrustLvl * 2.6 + (flying ? Math.random()*0.8 : 0);
      gN.material.color.setHex(flying && (Math.abs(player.vy) > 9 || player.boosting) ? 0x9fe0ff : 0x59c6ff);   // hotter blue under load
    }
  }
  // ON-PACK FUEL GAUGE — fill the LED strip bottom→top with the tank; cyan full → amber → pulsing red when low
  if (player.jetFuelSegs){
    const frac = clamp(player.jet / player.jetMax, 0, 1), low = frac < 0.25;
    const pulse = low ? 0.45 + Math.abs(Math.sin(G.gt*9)) * 0.55 : 1;
    const litCol = low ? 0xff5230 : (frac < 0.5 ? 0xffc24a : 0x59e0ff);
    for (const s of player.jetFuelSegs){
      const lit = frac > s.thr;
      s.mesh.material.opacity = lit ? (low ? 0.35 + pulse*0.55 : 0.92) : 0.05;
      s.mesh.material.color.setHex(lit ? litCol : 0x16242f);
    }
  }
  // LOADED MISSILE — visible on the pack only when the ability is UNLOCKED and OFF cooldown (it "launches" away on fire)
  if (player.jetMissileMesh) player.jetMissileMesh.visible = !!G.unlocked.jetmissile && (player.cds.missile || 0) <= 0;
}
