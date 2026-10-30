// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mouse and keyboard handlers.

import { CFG } from '../data/config.js';
import { renderer } from './renderer.js';
import { cycleQuality } from './quality.js';
import { audioInit, sfx } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3, clamp } from '../utils.js';
import { floater } from '../fx/floaters.js';
import { shared, G, keys, player } from '../state.js';
import { MANDO_WEAPON_ORDER, weaponUnlocked } from '../data/mando.js';
import { fwd, rightV, playerPos, stance } from '../player/helpers.js';
import { switchSlot, cycleSlot, swapVariant } from '../player/jedi/stance.js';
import { FORMS } from '../data/forms.js';
import { tryAttack, cancelSwing, forceKick } from '../player/jedi/combat.js';
import {
  forcePush, saberThrow, forcePull, forceRepulse, forceBarrier, forceMend, forceJudgement, forceSlam
} from '../player/jedi/force.js';
import { airCut } from '../player/jedi/aerial.js';
import { forceDash, doJump } from '../player/movement.js';
import { trySlide } from '../player/parkour.js';
import { pullPress, pullRelease, graspThrow, graspDrop } from '../player/jedi/grasp.js';
import { toggleLock } from '../player/lockon.js';
import {
  bactaStim, mandoRocket, mandoJetMissile, whistlingBirds, thermalDetonator, grappleHook, jetSlam
} from '../player/mando/gadgets.js';
import { mandoShift } from '../player/mando/mobility.js';
import { darksaberThrow } from '../player/mando/darksaber.js';
import { mandoMelee } from '../player/mando/melee.js';
import { lockPress, lockKick, lockPush } from '../enemies/duel.js';
import { mandoWeapon, switchWeapon, startReload, fireTrigger, mandoFlame } from '../player/mando/weapons.js';
import { startLevel, retryLevel } from '../game/flow.js';
import { startMission, retryMission } from '../game/mission.js';
import { showBanner } from '../ui/banners.js';
import { overlay, setSaberGrip } from '../ui/menus.js';
import { startSwitch } from '../player/anim/saber.js';
import { tutEvent } from '../game/tutor-bus.js';
import { diffWindow } from '../data/difficulty.js';
import { toggleHolster } from '../player/holster.js';
import { strikePress, strikeRelease, holsteredKick } from '../player/jedi/palm.js';
import { squadOrder } from '../allies/squad.js';
import { noteFlick } from '../player/jedi/cutaim.js';

const inputActive = () => document.pointerLockElement === renderer.domElement || (shared.lockFallback && G.mode === 'play');
document.addEventListener('mousemove', (e) => {
  if (!inputActive()) return;
  // scoped in (the disruptor's 30° zoom) the look slows to the SCOPE SENS setting, or the reticle flies off the target
  const sens = G.mouseSens * (G.hero === 'mando' && player.zoom ? G.adsSens : 1);
  G.yaw -= e.movementX * 0.0023 * sens;
  // allow looking well UP (was capped at -0.15, so you couldn't aim high on the ground) as well as down
  G.pitch = clamp(G.pitch + e.movementY * 0.0021 * sens, -0.62, 1.2);
  noteFlick(e.movementX, e.movementY);   // a flick just before a cut aims it (player/jedi/cutaim.js)
});
document.addEventListener('mousedown', (e) => {
  if (!inputActive()) return;
  if (player.downed) return;   // down: nothing to fight with until you're back up (game/revive.js)
  if (player.saberLock){ if (e.button === 0) lockPress(); return; }   // blades bound: LMB drives (enemies/duel.js)
  if (G.hero === 'mando'){
    if (e.button === 0){
      // LMB while guarding with the Darksaber hurls it; the grappling line reels it back (player/mando/darksaber.js)
      if (player.weapon === 'darksaber' && player.blockHeld){ darksaberThrow(); return; }
      const W = mandoWeapon();
      player.trigHeld = true;                        // single: a held trigger keeps the shield down
      if (W.fire === 'auto') player.firing = true;   // dual: hold to spray
      else fireTrigger();                            // single (semi) & disruptor (bolt-action): one shot per click
    }
    if (e.button === 2){
      if (mandoWeapon().twoHand) player.zoom = true;  // disruptor: raise the scope (only then is it a rifle)
      else if (player.weapon === 'darksaber'){
        if (player.gbT > 0) return;   // guard broken: nothing guards for a beat
        if (shared.darkProj) return;   // the blade is out on the line: nothing in hand to guard with
        // DARKSABER guards & PARRIES like a lightsaber — RMB interrupts a swing at any point into the guard
        cancelSwing();
        player.blockHeld = true; player.blockT = 0;
        if (!(player.parryLockT > 0)) player.parryT = CFG.player.parryWindow + (stance().parryBonus || 0) + (player.up.parry || 0) + diffWindow();
      } else if (!(player.gbT > 0)) player.blockHeld = true;   // beskar brace — pure damage soak, no parry
    }
    return;
  }
  if (e.button === 1){ e.preventDefault(); toggleLock(); return; }   // middle mouse: soft lock-on (Jedi)
  // LMB while guarding (RMB held) hurls the saber; otherwise it's a normal swing (holstered: a Force strike)
  if (e.button === 0){
    if (player.holstered) strikePress();   // tap: the strike string · hold: a charged palm, let go on release (jedi/palm.js)
    else if (player.blockHeld && G.unlocked.throw) saberThrow();
    else if (!airCut()) tryAttack();   // in the air with the blade out: the AERIAL CUT, a dash at the foe ahead (jedi/aerial.js)
  }
  if (e.button === 2 && G.mode === 'play'){
    if (player.exhausted || player.gbT > 0){   // guard broken — can't defend until stamina recovers
      if (G.gt - player.lastWinded > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'GUARD BROKEN', '#ff6a3a'); sfx(120, 0.12, 'square', 0.06, 70); }
    } else {
      const cancelled = cancelSwing();   // RMB interrupts a swing at any point — feint straight into the guard
      if (cancelled) tutEvent('cancel');
      // HOLD = block (absorb only). Each fresh CLICK opens a brief, timed DEFLECT/PARRY window —
      // land it on an incoming bolt or a melee strike to send it back / stagger the attacker.
      player.blockHeld = true;
      player.blockT = 0;
      let pwin = CFG.player.parryWindow + (stance().parryBonus || 0) + player.up.parry + diffWindow();
      if (cancelled){
        // STANCE-SPECIFIC CANCEL FEEL
        if (G.stance === 'ataru'){
          // ATARU — a quick repositioning step in the way you're moving (or hop back if still)
          const d = V3(0,0,0);
          if (keys['w']) d.add(fwd()); if (keys['s']) d.sub(fwd());
          if (keys['d']) d.add(rightV()); if (keys['a']) d.sub(rightV());
          if (d.lengthSq() < 0.01) d.copy(fwd()).multiplyScalar(-1);
          d.normalize(); player.vel.addScaledVector(d, 13);
        } else if (G.stance === 'makashi'){
          player.vel.addScaledVector(fwd(), -8);   // MAKASHI — the fencer's retreat: a quick step back off the line
          pwin += 0.04;
        } else if (G.stance === 'soresu'){
          pwin += 0.08;                 // SORESU — straight back behind the blade, the guard already up
        } else if (G.stance === 'niman'){
          pwin += 0.06;                 // NIMAN — a clean cancel leaves a wider parry window after
        } else if (G.stance === 'djemso'){
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
  if (e.button === 0){ player.firing = false; player.trigHeld = false; if (player.palmHold) strikeRelease(); }
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
  cycleSlot(e.deltaY > 0 ? 1 : -1);   // the next earned form along the loadout
}, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;   // typing in a text box (the co-op room code) is not play
  const k = e.key.toLowerCase();
  if (player.downed && G.mode === 'play' && k !== 'p' && k !== 'm' && k !== 'escape') return;   // down: wait for your squad
  keys[k] = true;
  if (k === 'alt') e.preventDefault();   // ALT is the STRAFE hold (player/animation.js): keep the browser from grabbing it for its menu bar
  if (k === 'p' && !e.repeat){ cycleQuality(); return; }   // graphics quality — works anywhere
  if (k === 'm' && !e.repeat){ audioInit(); const on = MUSIC.toggle(); showBanner('', '♪ MUSIC ' + (on ? 'ON' : 'OFF'), 1.0); return; }   // music on/off (persists)
  if (k === ' ' && !e.repeat) doJump();
  if (k === '4' && !e.repeat) toggleHolster();
  if (k === 'h' && !e.repeat) squadOrder();   // SQUAD: hold the spot under the crosshair, or on me (allies/squad.js)   // HOLSTER: the Jedi fights with the Force alone, the Mando with fists and gadgets (player/holster.js)
  if (G.hero === 'mando'){
    if (k === 'shift' && !e.repeat) mandoShift();        // combat roll / rocket boost / air dodge (mando/mobility.js); held in the air it boosts
    if (G.mode === 'play'){
      if (k === 'f') mandoFlame();
      if (k === 'q') mandoRocket();
      // ADAPTIVE FORK KEYS — each either/or pair shares ONE bind (you only ever own one of the pair).
      if (k === 'x'){ if (G.unlocked.slam) jetSlam(); else if (G.unlocked.grapple) grappleHook(); }                 // MID: jetpack SLAM or GRAPPLE
      if (k === 'v'){ if (G.unlocked.birds) whistlingBirds(); else if (G.unlocked.deto) thermalDetonator(); }       // LATE: BIRDS or DETONATOR
      if (k === 'z') mandoJetMissile();
      if (k === 'c' && !e.repeat) trySlide();   // SLIDE out of a run (parkour.js)
      if (k === 'e' && !e.repeat) mandoMelee();   // close quarters: string, catch, charge, dive kick, takedown (melee.js)
      if (k === 'g' && !e.repeat) bactaStim();        // bacta stim self-heal (store unlock) — G sits right beside F, in reach of WASD
      if (k === 'r' && !e.repeat) startReload();
      if (k === '1') switchWeapon('single');   // (from holstered, 1 / 2 / 3 draw that weapon)
      if (k === '2') switchWeapon('dual');
      // 3 = the SIGNATURE WEAPON — Disruptor OR Darksaber (mutually exclusive; you own exactly one after the wave-8 fork)
      if (k === '3') switchWeapon(player.up.darksaber ? 'darksaber' : 'disruptor');
    }
  } else {
    // SHIFT dashes any way you're pressing (or rolls out of a hard landing). Sprinting has its own key: Q toggles it
    // between run (the default) and walk (locomotion.js runs it). Z out of a sprint slides; hold ALT to strafe.
    if (k === 'shift' && !e.repeat) forceDash();
    if (k === 'q' && !e.repeat && G.mode === 'play'){
      player.sprintOn = !player.sprintOn;
      showBanner('', player.sprintOn ? 'RUN' : 'WALK', 0.6);
    }
    if (k === 'z' && !e.repeat && !graspDrop()) trySlide();   // the FORCE SLIDE out of a sprint (parkour.js); holding a foe, it drops them
    if (k === 't' && !e.repeat) toggleLock();          // soft lock-on
    if (k === 'f'){ if (!(player.saberLock && lockPush()) && !graspThrow()) forcePush(); }   // in a saber lock: a point-blank shove that breaks it
    if (k === 'c' && !e.repeat) pullPress();   // tap = Force Pull on release; hold = Force GRASP (grasp.js)
    if (k === 'e' && !e.repeat){ if (player.saberLock) lockKick(); else if (!(player.holstered && holsteredKick())) forceKick(); }   // holstered: mid-string a spin kick, in the air a stomp   // FRONT KICK — always-available melee, shares 'E' with the Mando's punch
    if (k === 'v') forceBarrier();     // Force Barrier — the defensive bubble (its fork-sibling SABER THROW is RMB+LMB)
    // ADAPTIVE FORK KEYS — each either/or pair shares ONE bind (you only ever own one of the pair).
    if (k === 'x' && !e.repeat && G.mode === 'play'){ if (G.unlocked.slam) forceSlam(); else if (G.unlocked.mend) forceMend(); }   // UTIL: JUMP ATTACK or MEND
    if (k === 'r' && G.mode === 'play'){ if (G.unlocked.judge) forceJudgement(); else if (G.unlocked.repulse) forceRepulse(); }   // ULT: JUDGEMENT or REPULSE ('R' still restarts when dead/victory below)
    if (k === 'g' && !e.repeat && G.mode === 'play'){   // GRIP — in a Form V slot G swaps Djem So ⇄ Shien (the reverse-grip variant); in Niman it flips
      // between a regular and a reverse (Starkiller-style) grip; every other form holds its own forward grip (data/forms.js)
      const own = G.hero !== 'mando' && FORMS[G.stance] && FORMS[G.stance].grip;
      if (swapVariant()){ /* swapped: the new form brings its own grip and guard */ }
      else if (own){ showBanner('', FORMS[G.stance].name + ' HOLDS A ' + (own === 'reverse' ? 'REVERSE' : 'FORWARD') + ' GRIP', 1.0); sfx(200, 0.06, 'triangle', 0.03, 160); }
      else {
        setSaberGrip(G.saberGrip === 'reverse' ? 'regular' : 'reverse');
        startSwitch();   // the saber turns straight into the new grip's guard
        showBanner('', G.saberGrip === 'reverse' ? 'REVERSE GRIP' : 'REGULAR GRIP', 0.8);
        sfx(520, 0.06, 'triangle', 0.04, 760);
      }
    }
    if (k === '1') switchSlot(0);   // the form loadout (data/forms.js): whatever sits in each slot
    if (k === '2') switchSlot(1);
    if (k === '3') switchSlot(2);
  }
  if (k === 'r' && (G.mode === 'dead' || G.mode === 'victory')){
    const again = G.mode === 'victory';
    G.mode = 'play'; G.slowmo = 1;
    overlay.style.display = 'none';
    document.getElementById('banner').style.opacity = '0';
    if (G.mission){ if (again) startMission(G.missionId); else retryMission(); }
    else if (again) startLevel(0); else retryLevel();
    try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){}
  }
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; if (e.key.toLowerCase() === 'c' && G.hero !== 'mando') pullRelease(); if (e.key === 'Alt') e.preventDefault(); });
