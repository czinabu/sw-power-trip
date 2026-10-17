// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// hurtPlayer() and kill streaks.

import { CFG } from '../data/config.js';
import { abil } from '../data/mastery.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { shared, G, enemies, player } from '../state.js';
import { MANDO } from '../data/mando.js';
import { fwd, playerPos, stance, maxHp } from './helpers.js';
import { flinchEnemy, staggerEnemy } from '../enemies/damage.js';
import { FOCUS, addFocus } from './jedi/focus.js';
import { deflectAnim, cancelSwing } from './jedi/combat.js';
import { sparks, clashFlash } from '../fx/ink.js';
import { spawnHitSpark, spawnParryFlash, spawnGroundShock } from '../fx/vfx.js';
import { updateBoonStrip } from '../game/boons.js';
import { endRun } from '../game/summary.js';
import { showBanner } from '../ui/banners.js';
import { overlay, setOverlayState } from '../ui/menus.js';
import { diffDmgMul, diffWindow } from '../data/difficulty.js';
import { masteryXp } from '../game/progression.js';
import { DUEL } from '../data/duel.js';
import { startLock } from '../enemies/duel.js';
import { mandoCatch } from './mando/melee.js';
import { tutEvent } from '../game/tutor-bus.js';
import { mandoShielding } from './mando/weapons.js';

const MELEE_REACH_UP = 1.7;   // a melee foe can't strike you if you're perched higher than this above their feet
/* PERFECT DODGE — a blow that arrives in the first instant of a dash: time slows, the dash is refunded and (Jedi)
   the next cut is a riposte. Called by anything that would have hit you while the dash's i-frames were up. */
export function perfectDodge(fromPos){
  const P = CFG.player.perfectDodge;
  if (G.mode !== 'play' || !fromPos) return false;
  if (G.gt - (player.dashStartT ?? -9) > P.window + diffWindow() || G.gt - (player.lastPerfectT ?? -9) < P.cd) return false;
  player.lastPerfectT = G.gt;
  G.slowmo = Math.min(G.slowmo, P.slowmo); G.slowmoT = Math.max(G.slowmoT, P.slowT);
  if (G.hero === 'mando') player.jet = Math.min(player.jetMax, player.jet + MANDO.boostDash.fuel * P.refund);
  else {
    player.force = clamp(player.force + CFG.abilities.dash.cost * P.refund, 0, CFG.player.maxForce);
    player.riposteT = CFG.player.riposteTime;   // the next cut answers it
    player.cds.dash = 0;
    addFocus(FOCUS.gainParry);
  }
  const pp = playerPos();
  burst(V3(pp.x, 1.3, pp.z), 0x9fe6ff, 14, 7, 3, 0.8);
  screenFlash('radial-gradient(ellipse at center, transparent 45%, rgba(140,210,255,.35) 100%)', 0.8, 0.4);
  floater(pp, 'PERFECT DODGE', '#9fe6ff');
  sfx(1400, 0.1, 'sine', 0.05, 700); sfx(300, 0.25, 'sine', 0.06, 150);
  if (G.stats) G.stats.perfectDodges = (G.stats.perfectDodges || 0) + 1;
  masteryXp('perfectDodge');
  tutEvent('perfectDodge');
  return true;
}

/* BLADE CLASH — your cut is mid-arc when a foe's strike lands from in front: the blades meet, neither blow lands,
   and both fighters are thrown apart. Heavy forms (Djem So, the darksaber) win the clash and stagger the foe. */
function bladeClash(fromPos){
  const C = CFG.player.clash;
  let foe = null, bd = 1.3;
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    const d = Math.hypot(e.group.position.x - fromPos.x, e.group.position.z - fromPos.z);
    if (d < bd){ bd = d; foe = e; }
  }
  if (!foe) return false;   // the boss's blows aren't clashable — parry those
  // a duellist's blade BINDS with yours instead: a saber lock (enemies/duel.js)
  if (foe.dp && foe.dp.lock && Math.random() < DUEL.lock.chance && startLock(foe)) return true;
  const pp = playerPos();
  TMP.subVectors(fromPos, pp); TMP.y = 0; TMP.normalize();
  const dir = TMP.clone();
  cancelSwing();
  player.vel.addScaledVector(dir, -C.push);
  player.stam = Math.max(0, player.stam - C.stam); player.stamDelay = CFG.player.stamDelay;
  const heavy = (G.hero !== 'mando' && G.stance === 'strong') || G.hero === 'mando';
  if (heavy) staggerEnemy(foe, dir.x, dir.z);
  else flinchEnemy(foe, dir, C.knock * 0.12);
  const cp = V3(pp.x + dir.x * 1.2, pp.y + 1.5, pp.z + dir.z * 1.2);
  clashFlash(cp, stance().blade, true);
  sparks(cp, 0xffe9b0, 14, 12, { life: 0.3 });
  G.hitstop = Math.max(G.hitstop, 0.08); G.shake = Math.max(G.shake, 0.45);
  S.clash(cp, true);
  if (G.stats) G.stats.clashes = (G.stats.clashes || 0) + 1;
  masteryXp('clash');
  return true;
}

export function hurtPlayer(dmg, fromPos, silent, melee, chip, opts){
  const pierce = !!(opts && opts.unblockable);   // a THRUST (or a lost lock): a held guard can't stop it, only a parry
  if (G.mode !== 'play') return 'none';
  if (player.dashT > 0){ if (!silent) perfectDodge(fromPos); return 'none'; }
  const raw = dmg;
  // a cut in flight meets a melee strike from in front: CLASH (before any guard, since a swing can't be guarding)
  if (melee && fromPos && !silent && !(opts && opts.noClash) && player.swing && player.atkT > 0 && (G.hero !== 'mando' || player.weapon === 'darksaber')){
    const k = player.swing.t / player.swing.dur, C = CFG.player.clash;
    TMP.subVectors(fromPos, playerPos()); TMP.y = 0;
    if (k >= C.from && k <= C.to && TMP.lengthSq() > 0.001 && TMP.normalize().dot(fwd()) > 0.2 && bladeClash(fromPos)) return 'clashed';
  }
  // perched on high ground — a grounded melee attacker simply can't reach up to you
  if (melee && fromPos && playerPos().y - fromPos.y > MELEE_REACH_UP){
    if (!silent) floater(playerPos(), 'OUT OF REACH', '#bfe8ff');
    return 'none';
  }
  // MANDO — beskar brace: hold RMB to soak frontal damage (no parry). DEFENSE IS A SINGLE-BLASTER PRIVILEGE: only
  // the SINGLE blaster raises the beskar SHIELD (player.isShielding). DUAL bracing is purely offensive — an
  // aggressive gunslinger stance with NO damage reduction. The DARKSABER skips this and uses the full lightsaber
  // block/parry path below instead (it guards & parries just like the Jedi medium stance).
  // MANDO — the VAMBRACE CATCH: a blow that lands just after E is turned on the beskar, and the attacker reels
  if (G.hero === 'mando' && melee && fromPos && !silent && player.catchT > 0){
    TMP.subVectors(fromPos, playerPos()); TMP.y = 0;
    if (TMP.lengthSq() < 0.001 || TMP.normalize().dot(fwd()) > -0.2){ mandoCatch(fromPos); return 'parried'; }
  }
  if (G.hero === 'mando' && player.weapon !== 'darksaber'){
    if (!silent && !pierce && mandoShielding() && fromPos){
      TMP.subVectors(fromPos, playerPos()); TMP.y = 0;
      if (TMP.lengthSq() < 0.001 || TMP.normalize().dot(fwd()) > -0.25){
        const pp = playerPos(), cpp = V3(pp.x + fwd().x*0.55, 1.5, pp.z + fwd().z*0.55);
        // STAMINA-GATED, like the bolt-catch path right above (same 5-per-hit cost) and like the Jedi's block —
        // this melee soak used to be entirely free regardless of stamina, the one hole in an otherwise-costed
        // defense economy. Runs dry → the beskar can't soak this swing, full damage bleeds through.
        if (player.stam > 0){
          const dr = MANDO.braceDR + (player.up.braceDR || 0);   // skill can push the soak higher
          dmg *= (1 - Math.min(0.88, dr));
          player.stam = Math.max(0, player.stam - 5 * player.up.blockStam);
          player.stamDelay = CFG.player.stamDelay;
          // ENERGY SHIELD soak — a blue ripple across the disc + a metallic beskar ring underneath
          burst(cpp, 0x6fd0ff, 8, 9, 4, 0.8); burst(cpp, 0xcfe0ec, 5, 5, 3);
          spawnHitSpark(cpp, 0x9fe6ff, 0.9);
          G.shake = Math.max(G.shake, 0.18); G.hitstop = Math.max(G.hitstop, 0.03);
          player.braceFlash = 0.12;   // chest plate glints (drawn in updatePlayer)
          player.shieldFlash = 0.18;  // the gauntlet disc ripples on the hit
          sfx(1100, 0.06, 'square', 0.05, 700); sfx(240, 0.08, 'triangle', 0.05, 90);
        } else {
          spawnHitSpark(cpp, 0x556070, 0.6);   // GUARD CRUSHED — dim spark, no soak, no flares
          sfx(180, 0.08, 'square', 0.05, 90);
        }
      }
    }
  }
  // defense: hold RMB to BLOCK (absorb only); a freshly-timed RMB CLICK opens the parry window
  else if (!silent && (player.blockHeld || player.parryT > 0) && fromPos){
    TMP.subVectors(fromPos, playerPos()); TMP.y = 0;
    if (TMP.lengthSq() > 0.001 && TMP.normalize().dot(fwd()) > 0.1){
      const pp = playerPos();
      if (player.parryT > 0 || (player.blockHeld && player.stam > 0)) deflectAnim(V3(fromPos.x, pp.y + 1.4, fromPos.z));
      if (player.parryT > 0){
        player.parryT = 0;   // a parry consumes the window
        player.riposteT = CFG.player.riposteTime;
        player.cancelRiposte = (G.gt - (player.cancelT || -9)) < 0.45;   // parried straight out of a swing-cancel → a stronger answer
        player.force = clamp(player.force + 12 + player.up.parryForce + (stance().parryRefund || 0), 0, CFG.player.maxForce);   // skillful defense feeds the Force (NIMAN refunds extra)
        G.hitstop = Math.max(G.hitstop, 0.24);
        G.shake = Math.max(G.shake, 1.0);
        G.slowmo = Math.min(G.slowmo, 0.18); G.slowmoT = Math.max(G.slowmoT, 0.36);   // a dramatic beat of clarity on a perfect parry
        const fp = V3(pp.x + fwd().x, 1.6, pp.z + fwd().z);
        burst(fp, 0xffe9a8, 38, 13, 7); burst(fp, 0xffffff, 22, 16, 5);
        for (let n = 0; n < 10; n++) burst(V3(fp.x+rand(-0.4,0.4), fp.y+rand(-0.3,0.4), fp.z+rand(-0.4,0.4)), 0xffd24a, 1, 11, 4, 0.9);
        spawnParryFlash(fp, 0xffd24a);
        spawnHitSpark(fp, 0xffffff, 2.2);
        screenFlash('radial-gradient(ellipse at center, rgba(255,240,180,.7), rgba(255,200,80,.18) 50%, transparent 72%)', 1.0, 0.45);
        floater(pp, (player.cancelRiposte ? 'PARRY! ⟲ CRUSHING RIPOSTE' : 'PARRY! ⟲ RIPOSTE READY'), '#ffe27a');
        S.parry(fp);   // a bright ringing clash
        if (G.stats) G.stats.parries++;
        masteryXp('parry');
        addFocus(FOCUS.gainParry);   // a perfect parry is the biggest FOCUS spike
        tutEvent('parry');
        return 'parried';
      }
      if (player.blockHeld && pierce){
        floater(pp, 'GUARD PIERCED', '#ff6a3a');   // it drove straight through the block: full force
        sfx(160, 0.12, 'square', 0.06, 70);
      } else if (player.blockHeld && player.stam > 0){
        // a heavy blow (a brute's maul) jars the guard far harder than a grunt's chop
        const heavy = Math.max(1, dmg / CFG.player.blockHeavy);
        player.stam = Math.max(0, player.stam - CFG.player.blockStamCost * heavy * player.up.blockStam * (stance().blockStamMul || 1));
        player.stamDelay = CFG.player.stamDelay;
        burst(V3(pp.x + fwd().x, 1.5, pp.z + fwd().z), stance().blade, 5, 4, 3);
        G.shake = Math.max(G.shake, 0.15 * heavy);
        player.vel.addScaledVector(fwd(), -2.5 * heavy);   // the blow drives you back a step
        sfx(900, 0.07, 'square', 0.05, 500);
        // a block is not a parry: some of a melee blow still gets through the guard
        if (melee && CFG.player.blockChip > 0) hurtPlayer(dmg * CFG.player.blockChip, null, true, false, true);
        return 'blocked';
      }
      else if (player.blockHeld) dmg *= 0.5;   // guard crushed (out of stamina) — half damage bleeds through
    }
  }
  dmg *= (1 - (player.up.dr || 0));   // UNSTOPPABLE damage reduction
  if (player.boon && player.boon.adrenal && player.hp < maxHp()*0.35) dmg *= 0.75;   // ADRENALINE boon — tougher when cornered
  if (player.atkT > 0 && G.hero !== 'mando' && stance().atkDR) dmg *= (1 - stance().atkDR);   // DJEM SO: armored commitment mid-swing
  if (player.cancelDR > 0) dmg *= 0.55;   // DJEM SO heavy cancel — soaks the blow during its committed recovery
  if (player.barrierT > 0){            // FORCE BARRIER soaks most of what gets through
    dmg *= (1 - abil('barrier').dr);
    if (!silent){ burst(V3(playerPos().x, 1.5, playerPos().z), 0x6fd0ff, 5, 5, 3); sfx(900, 0.08, 'sine', 0.05, 1400); }
  }
  dmg *= diffDmgMul();   // DIFFICULTY scales all incoming damage (enemies, boss, blasts)
  player.hp -= dmg;
  if (G.stats) G.stats.dmgTaken += dmg;
  G.waveDmg = (G.waveDmg || 0) + dmg; if (!chip) G.waveHits = (G.waveHits || 0) + 1;   // a blocked blow's chip doesn't spoil a flawless wave
  player.lastHurt = G.gt;
  if (G.hero !== 'mando' && !chip) player.focus = (player.focus || 0) * FOCUS.hitLoss;   // FORCE FOCUS — a clean trade is broken when you're hit (not by block chip)
  if (fromPos){ player.hitFrom = V3(fromPos.x, 1.4, fromPos.z); player.dmgIndT = 1.0; }   // THREAT — point the damage arc at the source
  // HIT REACTION — a blow that lands knocks the swing loose and slows your feet for a beat. A short immunity after
  // each flinch stops a pack from stun-locking you, and Djem So's armored commitment shrugs off light hits mid-swing.
  if (!silent && !chip && fromPos){
    const F = CFG.player.flinch, heavyHit = raw >= F.heavyDmg;
    const armored = player.atkT > 0 && G.hero !== 'mando' && stance().atkDR && !heavyHit;
    if (!armored && G.gt - (player.flinchAt ?? -9) > F.immune){
      player.flinchT = player.flinchMax = melee ? (heavyHit ? F.heavy : F.light) : F.ranged;
      player.flinchAt = G.gt;
      // which way the blow drives the body (animation.js reels it that way, not always backwards)
      TMP.subVectors(playerPos(), fromPos); TMP.y = 0;
      player.flinchDir = TMP.lengthSq() > 0.001 ? { x: TMP.x / TMP.length(), z: TMP.z / TMP.length() } : null;
      player.flinchHeavy = melee && heavyHit;
      if (melee){
        if (player.atkT > 0 || player.darkT > 0) cancelSwing();
        TMP.subVectors(playerPos(), fromPos); TMP.y = 0;
        if (TMP.lengthSq() > 0.001) player.vel.addScaledVector(TMP.normalize(), F.knock * (heavyHit ? 1.6 : 1));
      }
    }
  }
  if (!silent){
    G.shake = Math.max(G.shake, 0.45);
    if (fromPos){ player.camKickT = G.gt; player.camKickX = fromPos.x; player.camKickZ = fromPos.z; }   // the camera recoils away from the blow
    S.hurt();
    const v = document.getElementById('vig');
    v.style.opacity = '1';
    setTimeout(()=>{ v.style.opacity = '0'; }, 120);
  }
  // TRAINING — nobody dies in the training grounds: the teacher pulls you back up
  if (G.training && player.hp < 1){ player.hp = maxHp() * 0.4; floater(playerPos(), 'AGAIN', '#ffe27a'); }
  if (player.hp <= 0 && G.mode === 'play'){
    // PHOENIX boon — cheat death once per run: revive at half vitality and blow the field back
    if (player.phoenixReady){
      player.phoenixReady = false; player.hp = maxHp()*0.5;
      G.hitstop = Math.max(G.hitstop, 0.2); G.slowmo = 0.3; G.slowmoT = 0.8; G.shake = 1.4;
      const pp0 = playerPos();
      burst(V3(pp0.x,1.4,pp0.z), 0xffd24a, 40, 14, 8); burst(V3(pp0.x,1.4,pp0.z), 0xffffff, 24, 16, 6);
      spawnGroundShock(V3(pp0.x,0.1,pp0.z), 0xffd24a, 7, 0.7, 0.6);
      screenFlash('radial-gradient(ellipse at center, rgba(255,230,150,.8), rgba(255,200,80,.2) 50%, transparent 72%)', 1.0, 0.6);
      floater(pp0, 'PHOENIX — RISE AGAIN!', '#ffd24a'); S.stun(); sfx(300,0.3,'sine',0.18,1200); sfx(700,0.2,'triangle',0.1,1600);
      for (const e of enemies){ if (e.dead) continue; const d = e.group.position.clone().sub(pp0).setY(0); if (d.length() < 7) flinchEnemy(e, d, 1.2); }
      updateBoonStrip();
      return 'phoenix';
    }
    player.hp = 0;
    G.mode = 'dead';
    G.slowmo = 0.2;
    endRun(false);
    showBanner(G.hero === 'mando' ? 'THE HUNT IS OVER' : 'THE FORCE FALLS SILENT', '', 999);
    setTimeout(()=>{
      if (G.mode !== 'dead') return;
      document.exitPointerLock();
      if (shared.lockFallback){
        overlay.style.display = 'flex';
        setOverlayState('dead');
      }
    }, 1200);
  }
  return 'hit';
}

export function addStreak(n){
  G.streak += n; G.streakT = CFG.killStreakTimeout;
  if (G.stats && G.streak > G.stats.bestStreak) G.stats.bestStreak = G.streak;
  const el = document.getElementById('streak');
  if (G.streak >= 3){
    const label = G.streak >= 20 ? 'LEGENDARY' : G.streak >= 12 ? 'UNSTOPPABLE' : G.streak >= 6 ? 'RAMPAGE' : 'FLOW STATE';
    el.textContent = '×' + G.streak + '  ' + label;
    el.style.opacity = '1';
  }
}
