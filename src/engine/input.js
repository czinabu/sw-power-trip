// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mouse and keyboard handlers.

import { CFG } from '../data/config.js';
import { STANCE_ORDER } from '../data/stances.js';
import { renderer } from './renderer.js';
import { cycleQuality } from './quality.js';
import { audioInit, sfx } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3, clamp } from '../utils.js';
import { floater } from '../fx/floaters.js';
import { shared, G, keys, player } from '../state.js';
import { MANDO_WEAPON_ORDER, weaponUnlocked } from '../data/mando.js';
import { fwd, rightV, playerPos, stance } from '../player/helpers.js';
import { switchStance } from '../player/jedi/stance.js';
import { tryAttack, cancelSwing, forceKick } from '../player/jedi/combat.js';
import {
  forcePush, forceSlam, saberThrow, forcePull, forceRepulse, forceBarrier, forceMend, forceJudgement
} from '../player/jedi/force.js';
import { forceDash, doJump } from '../player/movement.js';
import { trySlide } from '../player/parkour.js';
import { toggleLock } from '../player/lockon.js';
import {
  bactaStim, mandoRocket, mandoJetMissile, whistlingBirds, thermalDetonator, grappleHook, jetSlam,
  mandoBoostDash
} from '../player/mando/gadgets.js';
import { mandoMelee } from '../player/mando/melee.js';
import { lockPress, lockKick, lockPush } from '../enemies/duel.js';
import { mandoWeapon, switchWeapon, startReload, fireTrigger, mandoFlame } from '../player/mando/weapons.js';
import { startLevel } from '../game/flow.js';
import { showBanner } from '../ui/banners.js';
import { overlay, setSaberGrip } from '../ui/menus.js';

const inputActive = () => document.pointerLockElement === renderer.domElement || (shared.lockFallback && G.mode === 'play');
document.addEventListener('mousemove', (e) => {
  if (!inputActive()) return;
  G.yaw -= e.movementX * 0.0023 * G.mouseSens;
  // allow looking well UP (was capped at -0.15, so you couldn't aim high on the ground) as well as down
  G.pitch = clamp(G.pitch + e.movementY * 0.0021 * G.mouseSens, -0.62, 1.2);
});
document.addEventListener('mousedown', (e) => {
  if (!inputActive()) return;
  if (player.saberLock){ if (e.button === 0) lockPress(); return; }   // blades bound: LMB drives (enemies/duel.js)
  if (G.hero === 'mando'){
    if (e.button === 0){
      const W = mandoWeapon();
      if (W.fire === 'auto') player.firing = true;   // dual: hold to spray
      else fireTrigger();                            // single (semi) & disruptor (bolt-action): one shot per click
    }
    if (e.button === 2){
      if (mandoWeapon().twoHand) player.zoom = true;  // disruptor: raise the scope (only then is it a rifle)
      else if (player.weapon === 'darksaber'){
        // DARKSABER guards & PARRIES like a lightsaber — RMB interrupts a swing at any point into the guard
        cancelSwing();
        player.blockHeld = true; player.blockT = 0;
        if (!(player.parryLockT > 0)) player.parryT = CFG.player.parryWindow + (stance().parryBonus || 0) + (player.up.parry || 0);
      } else player.blockHeld = true;                 // beskar brace — pure damage soak, no parry
    }
    return;
  }
  if (e.button === 1){ e.preventDefault(); toggleLock(); return; }   // middle mouse: soft lock-on (Jedi)
  // LMB while guarding (RMB held) hurls the saber; otherwise it's a normal swing
  if (e.button === 0){
    if (player.blockHeld && G.unlocked.throw) saberThrow();
    else tryAttack();
  }
  if (e.button === 2 && G.mode === 'play'){
    if (player.exhausted){   // guard broken — can't defend until stamina recovers
      if (G.gt - player.lastWinded > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'GUARD BROKEN', '#ff6a3a'); sfx(120, 0.12, 'square', 0.06, 70); }
    } else {
      const cancelled = cancelSwing();   // RMB interrupts a swing at any point — feint straight into the guard
      // HOLD = block (absorb only). Each fresh CLICK opens a brief, timed DEFLECT/PARRY window —
      // land it on an incoming bolt or a melee strike to send it back / stagger the attacker.
      player.blockHeld = true;
      player.blockT = 0;
      let pwin = CFG.player.parryWindow + (stance().parryBonus || 0) + player.up.parry;
      if (cancelled){
        // STANCE-SPECIFIC CANCEL FEEL
        if (G.stance === 'fast'){
          // ATARU — a quick repositioning step in the way you're moving (or hop back if still)
          const d = V3(0,0,0);
          if (keys['w']) d.add(fwd()); if (keys['s']) d.sub(fwd());
          if (keys['d']) d.add(rightV()); if (keys['a']) d.sub(rightV());
          if (d.lengthSq() < 0.01) d.copy(fwd()).multiplyScalar(-1);
          d.normalize(); player.vel.addScaledVector(d, 13);
        } else if (G.stance === 'medium'){
          pwin += 0.06;                 // NIMAN — a clean cancel leaves a wider parry window after
        } else if (G.stance === 'strong'){
          pwin += 0.1;                  // DJEM SO — committed cancel: the biggest parry window…
          player.cancelDR = 0.4;        // …soak damage through the heavy recovery…
          player.swingLock = 0.2;       // …but you're slow to swing again
        }
      }
      // a parry that just whiffed leaves the guard un-timed for a moment: this click only blocks
      if (player.parryLockT > 0) sfx(260, 0.05, 'triangle', 0.025, 200);
      else player.parryT = pwin;
    }
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) player.firing = false;
  if (e.button === 2){ player.blockHeld = false; player.zoom = false; }
});
document.addEventListener('wheel', (e) => {
  if (!inputActive()) return;
  e.preventDefault();
  if (G.hero === 'mando'){   // cycle to the next UNLOCKED loadout
    const dir = e.deltaY > 0 ? 1 : -1; let i = MANDO_WEAPON_ORDER.indexOf(player.weapon);
    for (let n = 0; n < MANDO_WEAPON_ORDER.length; n++){
      i = (i + dir + MANDO_WEAPON_ORDER.length) % MANDO_WEAPON_ORDER.length;
      if (weaponUnlocked(MANDO_WEAPON_ORDER[i])){ switchWeapon(MANDO_WEAPON_ORDER[i]); break; }
    }
    return;
  }
  const i = STANCE_ORDER.indexOf(G.stance);
  const n = (i + (e.deltaY > 0 ? 1 : -1) + STANCE_ORDER.length) % STANCE_ORDER.length;
  switchStance(STANCE_ORDER[n]);
}, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'p' && !e.repeat){ cycleQuality(); return; }   // graphics quality — works anywhere
  if (k === 'm' && !e.repeat){ audioInit(); const on = MUSIC.toggle(); showBanner('', '♪ MUSIC ' + (on ? 'ON' : 'OFF'), 1.0); return; }   // music on/off (persists)
  if (k === ' ' && !e.repeat) doJump();
  if (G.hero === 'mando'){
    if (k === 'shift') mandoBoostDash();                 // jetpack boost-dash (no Force)
    if (G.mode === 'play'){
      if (k === 'f') mandoFlame();
      if (k === 'q') mandoRocket();
      // ADAPTIVE FORK KEYS — each either/or pair shares ONE bind (you only ever own one of the pair).
      if (k === 'x'){ if (G.unlocked.slam) jetSlam(); else if (G.unlocked.grapple) grappleHook(); }                 // MID: jetpack SLAM or GRAPPLE
      if (k === 'v'){ if (G.unlocked.birds) whistlingBirds(); else if (G.unlocked.deto) thermalDetonator(); }       // LATE: BIRDS or DETONATOR
      if (k === 'z') mandoJetMissile();
      if (k === 'e' && !e.repeat) mandoMelee();   // close quarters: string, catch, charge, dive kick, takedown (melee.js)
      if (k === 'h' && !e.repeat) bactaStim();        // bacta stim self-heal (store unlock)
      if (k === 'r' && !e.repeat) startReload();
      if (k === '1') switchWeapon('single');
      if (k === '2') switchWeapon('dual');
      // 3 = the SIGNATURE WEAPON — Disruptor OR Darksaber (mutually exclusive; you own exactly one after the wave-7 fork)
      if (k === '3') switchWeapon(player.up.darksaber ? 'darksaber' : 'disruptor');
    }
  } else {
    // SHIFT with W on the ground SPRINTS (held; locomotion.js reads it); any other SHIFT is the dash (or a landing roll)
    if (k === 'shift' && !e.repeat && !(keys['w'] && player.grounded && !player.blockHeld && !(player.landStagT > 0))) forceDash();
    if (k === 'q' && !e.repeat) trySlide();            // SLIDE out of a sprint
    if (k === 't' && !e.repeat) toggleLock();          // soft lock-on
    if (k === 'f'){ if (!(player.saberLock && lockPush())) forcePush(); }   // in a saber lock: a point-blank shove that breaks it
    if (k === 'c') forcePull();
    if (k === 'e' && !e.repeat){ if (player.saberLock) lockKick(); else forceKick(); }   // FRONT KICK — always-available melee, shares 'E' with the Mando's punch
    if (k === 'v') forceBarrier();     // Force Barrier — the defensive bubble (its fork-sibling SABER THROW is RMB+LMB)
    // ADAPTIVE FORK KEYS — each either/or pair shares ONE bind (you only ever own one of the pair).
    if (k === 'x'){ if (G.unlocked.slam) forceSlam(); else if (G.unlocked.mend) forceMend(); }                         // UTIL: force SLAM or MEND
    if (k === 'r' && G.mode === 'play'){ if (G.unlocked.judge) forceJudgement(); else if (G.unlocked.repulse) forceRepulse(); }   // ULT: JUDGEMENT or REPULSE ('R' still restarts when dead/victory below)
    if (k === 'g' && !e.repeat && G.mode === 'play'){   // GRIP — flip between a regular and a reverse (Shien) saber grip mid-fight
      setSaberGrip(G.saberGrip === 'reverse' ? 'regular' : 'reverse');
      showBanner('', G.saberGrip === 'reverse' ? 'REVERSE GRIP' : 'REGULAR GRIP', 0.8);
      sfx(520, 0.06, 'triangle', 0.04, 760);
    }
    if (k === '1') switchStance('fast');
    if (k === '2') switchStance('medium');
    if (k === '3') switchStance('strong');
  }
  if (k === 'r' && (G.mode === 'dead' || G.mode === 'victory')){
    const again = G.mode === 'victory';
    G.mode = 'play'; G.slowmo = 1;
    overlay.style.display = 'none';
    document.getElementById('banner').style.opacity = '0';
    startLevel(again ? 0 : G.levelIdx);
    try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){}
  }
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
