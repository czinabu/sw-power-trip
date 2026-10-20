// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Level and wave flow: startLevel, startWave, updateFlow, ability unlock gates.

import { cleanupDuel, endLock } from '../enemies/duel.js';
import { cleanupTactics } from '../enemies/tactics.js';
import { clearGrenades } from '../enemies/grenades.js';
import { resetMandoMelee } from '../player/mando/melee.js';
import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { scene } from '../engine/renderer.js';
import { S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, rockets, birds, detos, enemies, bolts, orbs, rings, vfx, player } from '../state.js';
import { weaponUnlocked } from '../data/mando.js';
import { setHero } from '../player/hero.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { setStanceHud, switchStance } from '../player/jedi/stance.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { damageEnemy } from '../enemies/damage.js';
import { spawnBoss } from '../boss/boss.js';
import { findClearSpawn, edgeSpawn } from '../world/collision.js';
import { buildArena } from '../world/arena.js';
import { spawnChampion, startEndlessWave, endlessWaveCleared } from './survival.js';
import { applyJetTier, payWaveClear } from './progression.js';
import { MANDO_AUTO, JEDI_AUTO } from '../data/store.js';
import { openSkillTree } from '../ui/store-ui.js';
import { showBanner } from '../ui/banners.js';
import { diffBossCheckpoint } from '../data/difficulty.js';
import { catchDarksaber } from '../player/mando/darksaber.js';
import { resetGrasp } from '../player/jedi/grasp.js';

/* ============================================================
   LEVEL / WAVE FLOW
   ============================================================ */
// opts.at() picks where it arrives (default: anywhere on the edge ring) · opts.then(e) is handed the new foe
export function queueSpawn(typeName, opts){
  G.spawnQueue.push({ type: typeName, t: G.spawnQueue.length * 0.22, at: opts && opts.at, then: opts && opts.then });
}

// opts.level runs another level definition in place of LEVELS[idx] (the training grounds, game/tutorial.js; a story
// mission, game/mission.js, which also passes opts.mission);
// opts.retry restarts the level from its checkpoint after a death (see the CHECKPOINT note below)
export function startLevel(idx, opts){
  G.levelIdx = idx;
  G.endless = false; G.mut = null;   // campaign — never in survival mode (startEndless re-flags after this)
  G.training = !!(opts && opts.training);
  G.mission = !!(opts && opts.mission);
  const L = (opts && opts.level) || LEVELS[idx];
  // clear battlefield
  for (const e of enemies){ scene.remove(e.group); cleanupDuel(e); cleanupTactics(e); }
  enemies.length = 0;
  endLock();
  for (const b of bolts) scene.remove(b.mesh);
  bolts.length = 0;
  clearGrenades();
  G.flankUntil = 0; G.orderBusy = 0;
  for (const o of orbs) scene.remove(o.mesh);
  orbs.length = 0;
  for (const r of rings) scene.remove(r.mesh);
  rings.length = 0;
  for (const v of vfx){ if (v.mesh) scene.remove(v.mesh); if (v.light){ if (v.pooled) v.light.intensity = 0; else scene.remove(v.light); } }
  vfx.length = 0;
  if (shared.boss){ scene.remove(shared.boss.group); shared.boss = null; }
  if (shared.bossLight) shared.bossLight.visible = false;
  document.getElementById('bosswrap').style.display = 'none';
  if (shared.saberProj){ scene.remove(shared.saberProj.mesh); shared.saberProj = null; player.saberHand.visible = true; }
  for (const rk of rockets) scene.remove(rk.mesh);
  rockets.length = 0;
  G.spawnQueue.length = 0;
  // reset transient combat state
  player.slamming = false; player.leapAtk = false; player.slamBig = false;
  resetGrasp();
  player.doubleJumped = false;
  player.firing = false; player.trigHeld = false; player.shieldDropT = 0; player.fireCd = 0; player.flaming = false; player.jetActive = false; player.boosting = false; player.meleeT = 0; player.lockOn = false;
  catchDarksaber(true);   // a thrown Darksaber goes back in the hand before the next fight
  player.darkT = 0; player.darkApplied = false; if (player.darksaberMesh) player.darksaberMesh.visible = false;
  player.zoom = false; player.aiming = 0; player.recoilKick = 0; player.stabT = 0; player.heat = 0; player.overheat = false; player.ventT = 0;
  player.jet = player.jetMax;
  // a fresh campaign starts with the basic blasters; mid-campaign keep the equipped (if still unlocked)
  if (idx === 0 || !weaponUnlocked(player.weapon)) player.weapon = 'single';
  player.grappleActive = null;
  for (const bd of birds) scene.remove(bd.mesh); birds.length = 0;
  for (const dt2 of detos) scene.remove(dt2.mesh); detos.length = 0;
  if (shared._grappleLine) shared._grappleLine.visible = false;
  setHero(G.hero);   // make sure the rig + HUD match the chosen hero on (re)start

  buildArena(L);
  { const spot = findClearSpawn(0, shared.arenaHalf*0.5, CFG.player.radius + 1.0); playerPos().set(spot.x, 0, spot.z); }
  player.hp = maxHp();
  player.force = CFG.player.maxForce;
  player.vel.set(0,0,0);
  player.moveVel.set(0,0,0);
  player.atkT = 0;
  player.flip = null;
  player.queuedAtk = false;
  player.vis.rotation.set(0,0,0);
  player.vis.position.y = 0;
  player.stam = CFG.player.maxStam;
  player.exhausted = false;
  document.getElementById('stamvig').style.opacity = '0';
  player.blockHeld = false;
  player.parryT = 0; player.parryLockT = 0;
  player.riposteT = 0;
  player.mantle = null; player.wallRun = null; player.wallRunUsed = false; player.landStagT = 0;   // parkour state
  player.hang = null; player.slideT = 0; player.sprinting = false; player.sprintOn = false; player.pivotT = 0; player.flinchT = 0;
  player.lockTarget = null;
  resetMandoMelee();
  player.judgeT = 0;
  player.judgeTargets = [];
  player.barrierT = 0; if (shared._barrierMesh) shared._barrierMesh.visible = false;
  player.mendT = 0;
  player.cancelDR = 0; player.swingLock = 0; player.cancelRiposte = false;
  player.cds.mend = 0;
  if (idx === 0) switchStance('medium', true);   // a fresh legend starts balanced
  setStanceHud();
  G.yaw = Math.PI;  // face arena center
  player.faceYaw = Math.PI;
  G.wave = 0;
  G.streak = 0;
  document.getElementById('streak').style.opacity = '0';
  if (idx === 0){
    // fresh campaign — STARTING KIT only; the rest auto-unlocks or is bought with XP.
    //  Jedi: Saber + Block + Push + Dash (Pull auto-unlocks after wave 2).  Mando: Single blaster + weak jetpack +
    //  Brace (RMB) + Rocket (Dual auto-unlocks after wave 1, Flame after wave 2).
    G.unlocked = G.hero === 'jedi' ? { push: true, dash: true } : { rocket: true };
    G.stanceUnlocked = {};   // NIMAN is always available; ATARU/DJEM SO auto-unlock
    G.waveTotal = -1; G.mandoChoiceShown = false;
    G.xp = 0; G.xpEarned = 0; G.skillPoints = 0; G.powerLv = {}; G.mastery = {}; G.seenTypes = {};
    G.boonOffer = null; G.boonPicked = false;
    player.up = { dmg: 1, forceRegen: 1, move: 1, knock: 1, parry: 0, lifesteal: 0, hpMax: 0, dashCdMult: 1, stamRegen: 1,
                  atkSpeed: 1, dr: 0, blockStam: 1, riposte: 1, parryForce: 0, tempest: false,
                  fireRate: 1, fuelEff: 1, flameDmg: 1, flameRange: 1, rocketDmg: 1, rocketR: 1, braceDR: 0, aim: 0, darksaber: false, abilityCostMul: 1,
                  jetTier: 0, jetPow: 0.62, fjTier: 0 };
    player.boon = {}; player.boons = {}; player.momentumStacks = 0; player.momentumT = 0; player.phoenixReady = false;   // ROGUELITE BOONS
    player.focus = 0; player.focusHitT = 0; player._focusTier = 0;   // FORCE FOCUS meter
    player.skills = {};
    G.skillPoints = 0; G.skillSpent = 0;
    // RUN STATS — drive the end-of-run summary + score. Reset only on a fresh campaign (idx 0).
    G.stats = { kills: 0, dmgTaken: 0, parries: 0, deflects: 0, perfectDodges: 0, flawless: 0, cleanWaves: 0, shotsFired: 0, shotsHit: 0, bestStreak: 0, bossKilled: false, startGt: G.gt, summary: null };
  }
  /* CHECKPOINT — a retry puts the run back where the level began: the same wave count, so the army isn't tougher
     and more elite for every death (enemy HP and elite odds climb with waveTotal). Died to the boss on Padawan or
     Knight → the retry goes straight to the boss instead of replaying all four waves. */
  const cp = G.checkpoint, retry = !!(opts && opts.retry) && !G.training && !G.mission && cp && cp.idx === idx;
  const bossRetry = retry && cp.boss;
  if (retry) G.waveTotal = bossRetry ? cp.bossWaveTotal : cp.waveTotal;
  else if (!G.training && !G.mission) G.checkpoint = { idx, waveTotal: G.waveTotal, boss: false };
  applyJetTier();   // size the jetpack to the current booster tier
  document.getElementById('xpval').textContent = (G.xp || 0);
  checkUnlocks();
  shared.levelPhase = G.training ? 'training' : G.mission ? 'mission' : 'between'; shared.phaseT = 2.6;   // training and missions run their own steps, no waves
  { const [lvl, place] = L.name.split('—').map(t => t.trim());   // 'LEVEL 1 — TEMPLE STEPS' → tag + headline
    showBanner(place || lvl, L.sub, 2.6, place ? { kicker: lvl } : null); }
  if (bossRetry){
    G.wave = L.waves.length; shared.levelPhase = 'bossfight';
    setTimeout(()=>{ if (G.mode === 'play' && G.levelIdx === idx && shared.levelPhase === 'bossfight' && !shared.boss) spawnBoss(); }, 2600);
  }
}
// after a death: restart this level from its checkpoint (the boss itself, if that's what killed you)
export function retryLevel(){ startLevel(G.levelIdx, { retry: true }); }
export function retryIsBoss(){ return !!(G.checkpoint && G.checkpoint.boss && G.checkpoint.idx === G.levelIdx && !G.endless && !G.training && !G.mission); }

/* ---------- HUD chip sync + AUTOMATIC unlocks (weapons/stances/jetpack) ---------- */
// [unlock-key, chip-id] — 'slam' uses ab-mslam to avoid colliding with the Jedi ab-slam.
// Abilities are PURCHASED in the XP store; these just reveal the matching HUD chip once owned.
const MANDO_GATED = [['grapple','ab-grapple'],['flame','ab-flame'],['rocket','ab-rocket'],['birds','ab-birds'],
                     ['deto','ab-deto'],['slam','ab-mslam'],['dark','ab-dark'],['dark','ab-dthrow'],['jetmissile','ab-missile'],['bacta','ab-bacta']];
const JEDI_GATED  = [['slam','ab-slam'],['throw','ab-throw'],['pull','ab-pull'],['judge','ab-judge'],
                     ['repulse','ab-repulse'],['barrier','ab-barrier'],['mend','ab-mend']];
export function syncMandoChips(){   // reveal exactly the ability chips the Mando owns
  for (const [key, id] of MANDO_GATED){
    const chip = document.getElementById(id);
    if (chip) chip.style.display = (key === 'dark' ? player.up.darksaber : G.unlocked[key]) ? '' : 'none';
  }
}
export function syncJediChips(){
  for (const [key, id] of JEDI_GATED){
    const chip = document.getElementById(id);
    if (chip) chip.style.display = G.unlocked[key] ? '' : 'none';
  }
}
// Weapons / stances / jetpack tiers unlock AUTOMATICALLY as the run deepens — no store, no choice. Abilities
// stay customised (the XP store). This keeps gear progression effortless and the build choices deliberate.
export function checkUnlocks(bannerDelay){
  // an ARRAY, not a single slot — two unlocks can share the same trigger (e.g. FORCE PULL + FAST FORM both land at
  // level0/wave2; Mando's FLAMETHROWER + WRIST ROCKET both land at stage0) and the old single-`announce` version
  // only ever showed the FIRST one found, leaving the other granted but silently un-announced — no banner, ever.
  const announce = [];
  if (G.hero === 'mando'){
    for (const u of MANDO_AUTO){
      if ((G.waveTotal || 0) >= u.stage && !u.has()){ u.grant(); announce.push(u); }
    }
    syncMandoChips();
  } else {
    for (const u of JEDI_AUTO){
      const reached = (G.endless || G.mission) ? ((G.waveTotal || 0) >= u.stage)
                                : (G.levelIdx > u.level || (G.levelIdx === u.level && G.wave >= u.wave));
      if (reached && !u.has()){ u.grant(); announce.push(u); }
    }
    syncJediChips();
    setStanceHud();
  }
  if (G.training || G.mission) return;   // the training grounds teach the starting kit, a mission hands out its kit up front: no fanfare
  announce.forEach((u, i) => {
    setTimeout(() => { if (G.mode !== 'play') return;
      showBanner(u.name, /^HOLD /.test(u.hud) ? '' : 'PRESS', 3.0, { kicker: 'UNLOCKED', key: u.hud });
      MUSIC.unlockSting(); S.reward(1);
    }, (bannerDelay || 0) + i * 3200);   // stagger 3.2s apart (just past the 3.0s display dur) so each gets its own beat
  });
}

export function startWave(){
  const L = LEVELS[G.levelIdx];
  const w = L.waves[G.wave];
  // flatten the wave into a list, then SHUFFLE so each surge is a mix of types (not all grunts, then all blasters)
  const list = [];
  for (const tn in w) for (let i = 0; i < w[tn]; i++) list.push(tn);
  for (let i = list.length - 1; i > 0; i--){ const j = (Math.random()*(i+1))|0; const t = list[i]; list[i] = list[j]; list[j] = t; }
  // deal them out in PULSES — the wave arrives as ~3 reinforcing surges instead of one front-loaded rush,
  // so pressure stays even across the wave. A surge that's cleared fast simply lets the next one arrive.
  const pulse = Math.max(4, Math.ceil(list.length / 3));
  let t = 0;
  for (let i = 0; i < list.length; i++){
    t += (i > 0 && i % pulse === 0) ? 2.8 : 0.2;   // big gap between surges, quick trickle within one
    G.spawnQueue.push({ type: list[i], t });
  }
  shared.levelPhase = 'fighting';
  G.waveHits = 0; G.waveDmg = 0;   // how cleanly this wave is fought (payWaveClear)
  G.waveTotal++;   // cumulative wave count drives Mando ability unlocks
  showBanner('', 'WAVE ' + (G.wave+1) + ' / ' + L.waves.length, 1.5);
  MUSIC.waveSting();
  checkUnlocks(1600);
}

export function updateFlow(dt){
  // drain spawn queue → spawn at arena edge
  for (let i = G.spawnQueue.length-1; i >= 0; i--){
    const s = G.spawnQueue[i];
    s.t -= dt;
    if (s.t <= 0){
      if (s.type === 'warbringer') spawnChampion();   // a campaign mid-boss — picks its own arena-edge spot
      else {
        spawnEnemy(s.type, s.at ? s.at() : edgeSpawn(0.75, 0.92, 0.8));   // a clear spot on the edge ring (never inside cover or a hazard)
        if (s.then) s.then(enemies[enemies.length - 1]);
      }
      G.spawnQueue.splice(i,1);
    }
  }
  shared.phaseT -= dt;
  const L = LEVELS[G.levelIdx];
  if (shared.levelPhase === 'between' && shared.phaseT <= 0){
    if (G.endless) startEndlessWave(); else startWave();
  } else if (shared.levelPhase === 'travel' && shared.phaseT <= 0){
    shared.levelPhase = 'idle';
    startLevel(G.levelIdx + 1);
  } else if (shared.levelPhase === 'fighting'){
    let hostiles = 0;
    for (const e of enemies) if (!e.converted) hostiles++;
    if (hostiles === 0 && G.spawnQueue.length === 0){
      for (const e of enemies) if (!e.dead) damageEnemy(e, 9999, V3(0,0,1), 6);   // converted expire with the wave
      if (enemies.length > 0) return;
      if (G.endless){ endlessWaveCleared(); return; }   // survival has its own clear/escalation path
      G.wave++;
      MUSIC.clearSting();
      payWaveClear(140 + (G.waveTotal + 1) * 28);   // WAVE CLEAR — the main XP source (more for a clean wave), scales as the run deepens
      // a real second wind on each wave clear — a meaningful patch-up + a Force / jetpack top-off
      if (player.hp > 0 && player.hp < maxHp()){
        const healed = Math.min(maxHp() - player.hp, Math.round(maxHp() * ((player.boon && player.boon.secwind) ? 0.68 : 0.38)));   // SECOND WIND boon heals extra
        player.hp += healed;
        const pp0 = playerPos();
        floater(V3(pp0.x, 1.0, pp0.z), '+' + healed, '#7bffae');
        burst(V3(pp0.x, 1.2, pp0.z), 0x7bffae, 12, 5, 4);
      }
      player.force = CFG.player.maxForce;                                       // top off the Force
      if (G.hero === 'mando') player.jet = Math.min(player.jetMax, player.jet + player.jetMax * 0.6);   // refuel the jetpack
      if (G.wave < L.waves.length){
        shared.levelPhase = 'between'; shared.phaseT = 2.2;
        player.force = CFG.player.maxForce;
        openSkillTree();   // choose an upgrade before the next wave
      } else if (L.boss){
        shared.levelPhase = 'bossfight';
        if (G.checkpoint){ G.checkpoint.boss = diffBossCheckpoint(); G.checkpoint.bossWaveTotal = G.waveTotal; }
        showBanner('', '...something approaches.', 2.4);
        setTimeout(()=>{ if (G.mode === 'play' && !shared.boss) spawnBoss(); }, 2400);
      } else {
        // LEVEL CLEARED — the upgrade screen still opens (this wave's skill point + a chance to shop), then the
        // 'travel' beat runs out on sim time (frozen while the overlay is up) and the next world loads.
        shared.levelPhase = 'travel'; shared.phaseT = 1.6;
        showBanner('AREA CLEARED', 'The Force flows onward.', 1.6);
        openSkillTree();
      }
    }
  }
  // bossfight phase: boss drives its own flow (adds from summon use the same queue)
}
