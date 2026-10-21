// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// updatePlayer(): the per-frame player update, run as meters → movement → Mando weapons/flight → Force jump → gravity/landing → animation.

import { CFG } from '../data/config.js';
import { abil } from '../data/mastery.js';
import { sfx } from '../audio/sfx.js';
import { V3, rand, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { shared, G, player } from '../state.js';
import { fwd, rightV, playerPos, stance, maxHp } from './helpers.js';
import { focusRegenMul, updateFocus } from './jedi/focus.js';
import { barrierShove, mendComplete, updateJudgement, updateJumpAttack } from './jedi/force.js';
import { updateAirCut } from './jedi/aerial.js';
import { updateGrasp } from './jedi/grasp.js';
import { updateMandoCombat } from './mando/weapons.js';
import { updateMovement, updateForceJump, updateGravityAndLanding } from './locomotion.js';
import { updateMandoFlight } from './mando/flight.js';
import { animatePlayer } from './animation.js';
import { updateLockOn } from './lockon.js';
import { holstered } from './holster.js';
import { updateDashCharges } from './mobility.js';
import { updateJetCharges } from './mando/mobility.js';
import { updateForceStrike } from './jedi/palm.js';

// Per-frame player update. Each step below runs in this exact order every frame; the order matters
// (e.g. movement feeds the jetpack, both feed gravity/landing, and the pose reads the landed state).
export function updatePlayer(dt){
  const pp = playerPos();
  const st = stance();
  updatePlayerMeters(dt, pp, st);
  updateLockOn(dt);   // a soft lock steers the view before anything reads fwd()
  const f = fwd(), r = rightV();
  const moving = updateMovement(dt, pp, st, f, r);
  if (G.hero === 'mando'){
    updateMandoCombat(dt, f, r);
    updateMandoFlight(dt, pp, f, r);
  } else updateForceStrike(dt);   // the holstered Force strike string (jedi/palm.js)
  updateForceJump(dt, pp, f, r);
  updateGravityAndLanding(dt, pp);
  animatePlayer(dt, pp, st, f, r, moving);
}

// Cooldowns, regen, Force barrier/mend upkeep, and the low-stamina guard break + danger vignette.
function updatePlayerMeters(dt, pp, st){
  // cooldowns / meters
  for (const k in player.cds) player.cds[k] = Math.max(0, player.cds[k] - dt);
  G.stanceCd = Math.max(0, G.stanceCd - dt);
  if (player.cancelDR > 0) player.cancelDR -= dt;       // DJEM SO cancel — brief damage soak through recovery
  if (player.swingLock > 0) player.swingLock -= dt;     // DJEM SO cancel — slow to swing again
  // NO Force regen while Force-gliding — otherwise regen would outpace the glide cost and the descent would be free
  if (!player.gliding)
    player.force = clamp(player.force + CFG.player.forceRegen * (st.forceRegen || 1) * player.up.forceRegen * focusRegenMul() * (holstered() ? CFG.holster.regen : 1) * (G.mut === 'windfall' ? 2 : 1) * dt, 0, CFG.player.maxForce);
  if (G.gt - player.lastHurt > CFG.player.hpRegenDelay)
    player.hp = clamp(player.hp + CFG.player.hpRegen * dt, 0, maxHp());
  if (player.stamDelay > 0) player.stamDelay -= dt;
  else player.stam = clamp(player.stam + CFG.player.stamRegen * player.up.stamRegen * (player.exhausted ? 0.7 : 1) * dt, 0, CFG.player.maxStam);
  if (player.dashT > 0) player.dashT -= dt;
  updateDashCharges(dt);   // Force dash charges refill (player/mobility.js)
  updateJetCharges(dt);    // the Mando's air-dodge charges (mando/mobility.js)
  if (player.riposteT > 0) player.riposteT -= dt;
  // a parry window that runs out without catching anything was a GUESS: the guard is slow to re-time for a moment
  // (a parry that lands zeroes parryT itself, so it never reaches this)
  if (player.parryT > 0){ player.parryT -= dt; if (player.parryT <= 0) player.parryLockT = CFG.player.parryWhiffLock; }
  if (player.parryLockT > 0) player.parryLockT -= dt;
  if (player.landStagT > 0) player.landStagT -= dt;   // HARD LANDING recovery
  if (player.flinchT > 0) player.flinchT -= dt;        // HIT REACTION recovery
  if (player.blockHeld) player.blockT += dt;
  // FORCE BARRIER bubble — track its life and animate the shimmering shell around the player
  if (player.barrierT > 0){
    const wasUp = player.barrierT;
    player.barrierT -= dt;
    if (player.barrierT <= 0 && wasUp > 0) barrierShove(0.45, abil('barrier').expireKnock);   // EXPIRY — a small parting shove
    if (shared._barrierMesh){
      shared._barrierMesh.visible = true;
      shared._barrierMesh.position.set(pp.x, pp.y + 1.4, pp.z);
      shared._barrierMesh.scale.setScalar(1 + Math.sin(G.gt*9)*0.04);
      shared._barrierMesh.rotation.y += dt*0.8;
      shared._barrierMesh.material.opacity = (player.barrierT < 0.5 ? Math.max(0,player.barrierT)/0.5 : 1) * 0.22;   // fade out at the end
    }
  } else if (shared._barrierMesh && shared._barrierMesh.visible) shared._barrierMesh.visible = false;
  // FORCE MEND channel — a stream of blue force + green healing motes rises while it winds up; the heal lands at the end
  if (player.mendT > 0){
    player.mendT -= dt;
    if (Math.random() < 0.7) burst(V3(pp.x + rand(-0.5,0.5), rand(0.3,2.1), pp.z + rand(-0.5,0.5)), Math.random() < 0.5 ? 0x7bffae : 0x6fd0ff, 1, 2, 5, 0.7);
    if (player.mendT <= 0) mendComplete();
  }
  updateJudgement(dt);
  if (G.hero !== 'mando'){ updateJumpAttack(dt); updateAirCut(dt); updateGrasp(dt); }   // the jump attack's wind-up, the aerial cut, the Force grasp
  if (player.momentumT > 0){ player.momentumT -= dt; if (player.momentumT <= 0) player.momentumStacks = 0; }   // MOMENTUM boon decay
  updateFocus(dt);   // FORCE FOCUS meter (decay/ebb/tier-ups)
  if (player.dmgIndT > 0) player.dmgIndT -= dt * 1.6;   // THREAT — fade the directional damage arc
  if (player.landDip > 0) player.landDip = Math.max(0, player.landDip - dt * 1.7);   // TOUCHDOWN — camera dip springs back
  if (player.hitMarkT > 0){ player.hitMarkT -= dt * 4.5; if (player.hitMarkT <= 0) player._hmRank = 0; }   // HIT MARKER fade
  if (player.dryT > 0) player.dryT -= dt;   // overheat dry-fire click throttle

  // --- LOW STAMINA = DANGER. Run the bar dry and your guard SHATTERS: it drops, you can't
  //     block or parry, and you must recover before defending again. ---
  const stamFrac = player.stam / CFG.player.maxStam;
  if (player.stam <= 0.5 && !player.exhausted){
    player.exhausted = true;
    player.blockHeld = false; player.parryT = 0;
    G.shake = Math.max(G.shake, 0.55);
    screenFlash('radial-gradient(ellipse at center, transparent 38%, rgba(255,46,0,.5) 100%)', 0.9, 0.55);
    const ex = document.getElementById('exhaust'); ex.textContent = 'GUARD BROKEN'; ex.style.opacity = '1';
    setTimeout(() => { if (document.getElementById('exhaust')) document.getElementById('exhaust').style.opacity = '0'; }, 850);
    sfx(68, 0.6, 'sawtooth', 0.2, 28); sfx(200, 0.32, 'square', 0.09, 60);
    floater(pp, 'EXHAUSTED', '#ff6a3a');
  }
  if (player.exhausted && player.stam > CFG.player.maxStam * 0.4) player.exhausted = false;   // recovered
  // danger vignette + rising heartbeat as the bar runs low (Jedi stamina only — Mando uses this bar for JET FUEL)
  const sv = document.getElementById('stamvig');
  const smbar = document.getElementById('smbar');
  if (G.hero === 'mando'){ sv.style.opacity = '0'; }
  else if (stamFrac < 0.32 || player.exhausted){
    const base = player.exhausted ? 0.9 : (0.32 - stamFrac) / 0.32;
    sv.style.opacity = (base * (0.6 + 0.4 * Math.sin(G.gt * 11))).toFixed(2);
    if (smbar) smbar.style.background = player.exhausted ? '#ff3010' : 'linear-gradient(90deg,#ff5a1a,#ffd2a8)';
    player.heartT -= dt;
    if (player.heartT <= 0){ player.heartT = player.exhausted ? 0.42 : 0.42 + stamFrac * 0.7; sfx(54, 0.16, 'sine', 0.14, 36); }
  } else {
    sv.style.opacity = '0';
    if (smbar) smbar.style.background = 'linear-gradient(90deg,#e8a23a,#ffe2a8)';
  }
}
