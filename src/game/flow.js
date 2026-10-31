// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Level and wave flow: startLevel, startWave, updateFlow, ability unlock gates.

import { endLock } from '../enemies/duel.js';
import { removeEnemy } from '../enemies/cleanup.js';
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
import { playerPos, maxHp, maxStam } from '../player/helpers.js';
import { setStanceHud, switchStance, setLoadout } from '../player/jedi/stance.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { damageEnemy } from '../enemies/damage.js';
import { spawnBoss } from '../boss/boss.js';
import { findClearSpawn, edgeSpawn } from '../world/collision.js';
import { buildArena } from '../world/arena.js';
import { spawnChampion, startEndlessWave, endlessWaveCleared } from './survival.js';
import { applyJetTier, payWaveClear } from './progression.js';
import { MANDO_AUTO, JEDI_AUTO } from '../data/store.js';
import { DEFAULT_LOADOUT, RUN_LOADOUT, STARTING_FORMS } from '../data/forms.js';
import { queueMeditation, formsTaught, autoLoadout, tickMeditation, clearMeditation } from './meditation.js';
import { chapterOrder } from '../data/campaign.js';
import { openSkillTree } from '../ui/store-ui.js';
import { earnWavePoint, noteWavePoint, resetUpgrades } from './upgrades.js';
import { showBanner } from '../ui/banners.js';
import { diffBossCheckpoint } from '../data/difficulty.js';
import { catchDarksaber } from '../player/mando/darksaber.js';
import { resetGrasp } from '../player/jedi/grasp.js';
import { resetAirCut } from '../player/jedi/aerial.js';
import { hideThrownSaber, stowHandSaber } from '../player/jedi/force.js';
import { clearSquad } from '../allies/squad.js';
import { clearDowned } from './revive.js';
import { playBossIntro } from './cutscene.js';
import { coopRun } from '../net/run.js';
import { resetReadout, beginWave } from './readout.js';
import { nextChapter, retryChapter } from './campaign.js';
import { storyBeat, clearComms, commsBusy } from './story.js';

/* ============================================================
   LEVEL / WAVE FLOW
   ============================================================ */
// opts.at() picks where it arrives (default: anywhere on the edge ring) · opts.then(e) is handed the new foe
export function queueSpawn(typeName, opts){
  G.spawnQueue.push({ type: typeName, t: G.spawnQueue.length * 0.22, at: opts && opts.at, then: opts && opts.then });
}

// opts.level runs another level definition in place of LEVELS[idx] (the training grounds, game/tutorial.js; a story
// mission, game/mission.js, which also passes opts.mission; the sandbox, game/sandbox.js, with opts.sandbox);
// opts.retry restarts the level from its checkpoint after a death (see the CHECKPOINT note below); opts.resume keeps
// the build a loaded save put back (game/saves.js), even on level 1; opts.chapter: a campaign chapter (game/campaign.js)
// is starting, which keeps G.chapter (anything else leaves the chapters); opts.waves: [from, to] plays only that stretch
// of the level's waves (to is exclusive)
// the boss steps in after a beat; in a shared run it waits for both heroes to close their upgrade screens first
function spawnBossWhenReady(still, ms){
  setTimeout(function go(){
    if (!still()) return;
    if (coopRun.live && (G.skillSelect || coopRun.guestPicking)) return void setTimeout(go, 500);
    spawnBoss();
    if (G.chapter >= 0) playBossIntro();   // the campaign's last boss gets his entrance (game/cutscene.js)
  }, ms);
}
export function startLevel(idx, opts){
  const fresh = idx === 0 && !(opts && opts.resume);   // a brand-new campaign: reset the hero's build
  G.levelIdx = idx;
  if (!(opts && opts.chapter)) G.chapter = -1;
  clearComms();
  G.endless = false; G.mut = null;   // campaign — never in survival mode (startEndless re-flags after this)
  G.coopGuest = false;               // and not following a host's run until a join says so (startEndless)
  G.training = !!(opts && opts.training);
  G.mission = !!(opts && opts.mission);
  G.sandbox = !!(opts && opts.sandbox);
  const L = (opts && opts.level) || LEVELS[idx];
  // clear battlefield
  for (const e of enemies) removeEnemy(e);
  enemies.length = 0;
  clearSquad(); clearDowned();   // the squad and anyone downed don't carry into a new level (a mode calls its own squad in)
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
  if (shared.saberProj){ hideThrownSaber(); shared.saberProj = null; stowHandSaber(false); }
  for (const rk of rockets) scene.remove(rk.mesh);
  rockets.length = 0;
  G.spawnQueue.length = 0;
  // reset transient combat state
  player.slamming = false; player.slamWind = 0; player.slamBig = false; resetAirCut();
  resetGrasp();
  player.doubleJumped = false;
  player.firing = false; player.trigHeld = false; player.shieldDropT = 0; player.fireCd = 0; player.flaming = false; player.jetActive = false; player.boosting = false; player.meleeT = 0; player.lockOn = false;
  catchDarksaber(true);   // a thrown Darksaber goes back in the hand before the next fight
  player.darkT = 0; player.darkApplied = false; if (player.darksaberMesh) player.darksaberMesh.visible = false;
  player.zoom = false; player.aiming = 0; player.recoilKick = 0; player.stabT = 0; player.stabQ = false; player.stabCdT = 0; player.missileT = 0; player.heat = 0; player.overheat = false; player.ventT = 0;
  player.jet = player.jetMax;
  // a fresh campaign starts with the basic blasters; mid-campaign keep the equipped (if still unlocked)
  if (fresh || !weaponUnlocked(player.weapon)) player.weapon = 'single';
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
  player.stam = maxStam();
  player.exhausted = false; player.gbT = 0;
  document.getElementById('stamvig').style.opacity = '0';
  player.blockHeld = false;
  player.parryT = 0; player.parryLockT = 0;
  player.riposteT = 0;
  player.mantle = null; player.wallRun = null; player.wallRunUsed = false; player.landStagT = 0;   // parkour state
  player.jetCharges = null; player.dodgeKind = null;   // the Mando's air-dodge charges refill to full
  player.hang = null; player.slideT = 0; player.sprinting = false; player.sprintOn = true; player.pivotT = 0; player.flinchT = 0;
  player.lockTarget = null;
  resetMandoMelee();
  player.judgeT = 0;
  player.palmT = 0; player.palm = null; player.palmQueued = false; player.palmHold = null; player.pullStrikeT = 0; player.stomp = false;   // the holstered string (jedi/palm.js)
  player.judgeTargets = [];
  player.barrierT = 0; if (shared._barrierMesh) shared._barrierMesh.visible = false;
  player.mendT = 0;
  player.cancelDR = 0; player.swingLock = 0; player.dashCharges = null; player.dashRecharge = 0; player.cancelRiposte = false;
  player.cds.mend = 0;
  if (fresh) switchStance(G.training || G.mission || G.sandbox ? 'niman' : STARTING_FORMS[0], true);   // a run starts on Form I; the training grounds teach from Niman
  setStanceHud();
  G.yaw = Math.PI;  // face arena center
  player.faceYaw = Math.PI;
  G.wave = G.waveFrom = (opts && opts.waves) ? opts.waves[0] : 0;
  G.waveEnd = (opts && opts.waves) ? opts.waves[1] : L.waves.length;
  G.streak = 0;
  document.getElementById('streak').style.opacity = '0';
  if (fresh){
    // fresh campaign — STARTING KIT only; the rest auto-unlocks or is bought with XP.
    //  Jedi: Saber + Block + Push + Dash (Pull auto-unlocks after wave 2).  Mando: Single blaster + weak jetpack +
    //  Brace (RMB) + Rocket (Dual auto-unlocks after wave 1, Flame after wave 2).
    G.unlocked = G.hero === 'jedi' ? { push: true, dash: true } : { rocket: true };
    G.stanceUnlocked = G.training ? { niman: true } : {};   // SHII-CHO is known from the start; the rest is learned (data/forms.js FORM_PATH). The training grounds teach from Niman
    G.formFork = null; clearMeditation();   // the run's Form VII choice; nothing left waiting from the last run
    // a run (campaign or survival) starts on the forms the hero knows and grows; the training grounds and the missions
    // keep the old three (a mission then slots what its kit teaches)
    G.loadout = [...(G.training || G.mission || G.sandbox ? DEFAULT_LOADOUT : RUN_LOADOUT)];
    G.waveTotal = -1; G.mandoChoiceShown = false;
    G.xp = 0; G.xpEarned = 0; G.skillPoints = 0; G.powerLv = {}; G.mastery = {}; G.seenTypes = {}; resetUpgrades();
    G.boonOffer = null; G.boonPicked = false;
    player.up = { dmg: 1, forceRegen: 1, move: 1, knock: 1, parry: 0, lifesteal: 0, hpMax: 0, dashCdMult: 1, stamRegen: 1, maxStam: 0,
                  atkSpeed: 1, dr: 0, blockStam: 1, riposte: 1, parryForce: 0,
                  fireRate: 1, fuelEff: 1, flameDmg: 1, flameRange: 1, rocketDmg: 1, rocketR: 1, braceDR: 0, aim: 0, darksaber: false, abilityCostMul: 1,
                  jetTier: 0, jetPow: 0.62, fjTier: 0, cellTier: 0, heatCap: 1, heatCool: 1 };
    player.boon = {}; player.boons = {}; player.momentumStacks = 0; player.momentumT = 0; player.phoenixReady = false;   // ROGUELITE BOONS
    player.focus = 0; player.focusHitT = 0; player._focusTier = 0;   // FORCE FOCUS meter
    player.skills = {};
    G.skillPoints = 0; G.skillSpent = 0;
    // RUN STATS — drive the end-of-run summary + score. Reset only on a fresh campaign (idx 0).
    resetReadout();
    G.stats = { kills: 0, dmgTaken: 0, parries: 0, deflects: 0, perfectDodges: 0, flawless: 0, cleanWaves: 0, shotsFired: 0, shotsHit: 0, bestStreak: 0, bossKilled: false, startGt: G.gt, summary: null };
  }
  /* CHECKPOINT — a retry puts the run back where the level began: the same wave count, so the army isn't tougher
     and more elite for every death (enemy HP and elite odds climb with waveTotal). Died to the boss on Padawan or
     Knight → the retry goes straight to the boss instead of replaying all four waves. */
  const cp = G.checkpoint, retry = !!(opts && opts.retry) && !G.training && !G.mission && !G.sandbox && cp && cp.idx === idx && (cp.ch == null || cp.ch === G.chapter);
  const bossRetry = retry && cp.boss;
  if (retry) G.waveTotal = bossRetry ? cp.bossWaveTotal : cp.waveTotal;
  else if (!G.training && !G.mission && !G.sandbox) G.checkpoint = { idx, ch: G.chapter, waveTotal: G.waveTotal, boss: false };
  applyJetTier();   // size the jetpack to the current booster tier
  document.getElementById('xpval').textContent = (G.xp || 0);
  checkUnlocks();
  shared.levelPhase = G.training ? 'training' : G.mission ? 'mission' : G.sandbox ? 'sandbox' : 'between'; shared.phaseT = 2.6;   // training, missions and the sandbox run their own steps, no waves
  { const [lvl, place] = L.name.split('—').map(t => t.trim());   // 'LEVEL 1 — TEMPLE STEPS' → tag + headline
    showBanner(place || lvl, L.sub, 2.6, place ? { kicker: lvl } : null); }
  if (bossRetry){
    G.wave = G.waveEnd; shared.levelPhase = 'bossfight';
    spawnBossWhenReady(() => G.mode === 'play' && G.levelIdx === idx && shared.levelPhase === 'bossfight' && !shared.boss, 2600);
  }
}
// after a death: restart this level from its checkpoint (the boss itself, if that's what killed you)
export function retryLevel(){ if (G.chapter >= 0) retryChapter(); else startLevel(G.levelIdx, { retry: true }); }
export function retryIsBoss(){ return !!(G.checkpoint && G.checkpoint.boss && G.checkpoint.idx === G.levelIdx && !G.endless && !G.training && !G.mission && !G.sandbox); }

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
      const reached = (u.chapter && G.chapter >= 0) ? chapterCleared(u.chapter) : (G.waveTotal || 0) >= u.stage;   // the campaign: the chapter that hands it over (data/store.js)
      if (reached && !u.has()){ u.grant(); announce.push(u); }
    }
    syncMandoChips();
  } else {
    const meditates = formsTaught();
    for (const u of JEDI_AUTO){
      const reached = (G.endless || (G.mission && G.chapter < 0)) ? ((G.waveTotal || 0) >= u.stage)   // (a campaign chapter keeps the campaign's level/wave gates)
                                : (u.chapter && G.chapter >= 0) ? chapterCleared(u.chapter)          // a form or a power: the chapter that teaches it
                                : (G.levelIdx > u.level || (G.levelIdx === u.level && G.wave >= u.wave));
      if (!reached || u.has()) continue;
      if (u.fork && !meditates) continue;   // Form VII is a choice: only a run that can stop to make it offers it
      u.grant(); announce.push(u);
    }
    syncJediChips();
    setStanceHud();
  }
  // a mission's forms come with its kit, already in hand: slot the best of them (no meditation, no fanfare)
  if (G.hero !== 'mando' && G.mission && G.chapter < 0){
    if (G.missionForms){   // chosen before the fight (ui/forms-ui.js): the mission hands them over
      G.stanceUnlocked = G.stanceUnlocked || {};
      for (const id of G.missionForms) if (id) G.stanceUnlocked[id] = true;
      setLoadout(G.missionForms);
    } else setLoadout(autoLoadout());
  }
  if (G.training || (G.mission && G.chapter < 0) || G.sandbox) return;   // the training grounds teach the starting kit, a mission and the sandbox hand out their kit up front: no fanfare
  if (G.cardUp){ heldUnlocks.push(...announce); return; }   // a chapter card is up: they wait for it to close (releaseUnlockBanners)
  announceUnlocks(announce, bannerDelay);
}
// a chapter of this run (by id) is behind the hero: the run is on a later chapter
const chapterPos = (id) => chapterOrder(G.actTwo).findIndex(c => c.id === id);
function chapterCleared(id){ const at = chapterPos(id); return at >= 0 && G.chapter > at; }
// ...or it has just closed (G.chapterClosed): its closing upgrade page already offers what it hands out (data/store.js)
export function chapterClosed(id){ const at = chapterPos(id); return at >= 0 && (G.chapter > at || (G.chapter === at && G.chapterClosed === at)); }
// unlocks that landed while a chapter card was up (game/campaign.js), announced once it closes
const heldUnlocks = [];
export function releaseUnlockBanners(){ announceUnlocks(heldUnlocks.splice(0), 1200); }
function announceUnlocks(announce, bannerDelay){
  // a learned form isn't a banner: it's a moment of meditation, where the hero can re-slot the loadout (meditation.js)
  const forms = announce.filter(u => u.form);
  if (forms.length) queueMeditation(forms.map(u => u.key));
  announce = announce.filter(u => !u.form);
  announce.forEach((u, i) => {
    setTimeout(() => { if (G.mode !== 'play') return;
      showBanner(u.name, /^HOLD /.test(u.hud) ? '' : 'PRESS', 3.0, { kicker: 'UNLOCKED', key: u.hud });
      MUSIC.unlockSting(); S.reward(1);
    }, (bannerDelay || 0) + i * 3200);   // stagger 3.2s apart (just past the 3.0s display dur) so each gets its own beat
  });
}

// A LONG wave is split in two with a deliberate lull: the first half spawns as usual, and once it is cleared the rest
// is held for LULL seconds behind a "SECOND WAVE" beat (updateFlow). Call it right after queueing a wave's foes.
export const LULL = 3.6;
export function splitWaveWithLull(fromIdx){
  const q = G.spawnQueue, n = q.length - fromIdx;
  if (n < 6) return;
  const at = fromIdx + Math.ceil(n / 2), t0 = q[at].t;
  for (let i = at; i < q.length; i++){ q[i].t = Math.max(0.2, q[i].t - t0 + 0.2); q[i].held = true; }
  q.splice(at, 0, { type: '__lull', barrier: true, t: 0, hold: LULL });
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
  const q0 = G.spawnQueue.length;
  for (let i = 0; i < list.length; i++){
    t += (i > 0 && i % pulse === 0) ? 2.8 : 0.2;   // big gap between surges, quick trickle within one
    G.spawnQueue.push({ type: list[i], t });
  }
  if (L.lullWaves && L.lullWaves.includes(G.wave)) splitWaveWithLull(q0);   // the longest campaign waves breathe halfway
  shared.levelPhase = 'fighting';
  G.waveHits = 0; G.waveDmg = 0;   // how cleanly this wave is fought (payWaveClear)
  beginWave('L' + (G.levelIdx + 1) + ' · WAVE ' + (G.wave + 1));
  G.waveTotal++;   // cumulative wave count drives Mando ability unlocks
  showBanner('', waveLine(), 1.5);
  MUSIC.waveSting();
  checkUnlocks(1600);
  storyBeat('wave', { n: G.wave - (G.waveFrom || 0) });   // the chapter's line for this wave, if it has one (game/story.js)
}
// 'WAVE 2 / 4', counted within the chapter's stretch of the level
const waveLine = () => 'WAVE ' + (G.wave - (G.waveFrom || 0) + 1) + ' / ' + ((G.waveEnd ?? LEVELS[G.levelIdx].waves.length) - (G.waveFrom || 0));
const chapterEnds = () => G.wave >= (G.waveEnd ?? LEVELS[G.levelIdx].waves.length);
const bossDue = (L) => L.boss && (G.waveEnd ?? L.waves.length) >= L.waves.length;

// a campaign wave is cleared: its XP and a second wind (also what a co-op guest does when the host's wave ends, and a
// mission chapter's close, game/campaign.js)
export function chapterRewards(){ campaignWaveRewards(); }
function campaignWaveRewards(){
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
}

/* CO-OP CAMPAIGN (net/foes.js) — the host runs the level's waves; a guest follows. Joining puts the guest on the host's
   level (their build starts from the kit that wave count earns); each wave and level change after that follows the host. */
export function startCoopCampaign(lv, wave, waveTotal){
  startLevel(0);   // a full fresh setup (kit, build, stats)
  G.waveTotal = waveTotal;
  if (lv > 0) startLevel(lv, { resume: true });   // the same level as the host, keeping that build
  G.coopGuest = true; G.coopWasGuest = true; G.coopJoin = false;
  G.wave = wave; shared.levelPhase = 'between'; shared.phaseT = 0;
  checkUnlocks();
  showBanner('CO-OP CAMPAIGN', 'Fighting alongside the host.', 3.0);
}
// the host's wave began (campaign): this browser's wave banner and readout
export function coopCampaignWave(wave, waveTotal){
  G.wave = wave; G.waveTotal = waveTotal;
  shared.levelPhase = 'fighting'; G.waveHits = 0; G.waveDmg = 0;
  beginWave('L' + (G.levelIdx + 1) + ' · WAVE ' + (wave + 1));
  showBanner('', waveLine(), 1.5);
  MUSIC.waveSting();
  checkUnlocks(1600);
}
// the host's wave is down (campaign): this browser's own clear bonus and skill point, and its upgrade page at the chapter's close
export function coopCampaignCleared(){
  const L = LEVELS[G.levelIdx];
  G.wave++;
  campaignWaveRewards();
  earnWavePoint();
  shared.levelPhase = 'between';
  if (chapterEnds() && !bossDue(L)){ G.chapterClosed = G.chapter; showBanner(G.chapter >= 0 ? 'CHAPTER COMPLETE' : 'AREA CLEARED', 'The Force flows onward.', 1.6); openSkillTree(); }
  else noteWavePoint();
}

export function updateFlow(dt){
  tickMeditation();   // a learned form waits for the screens in front of it to close (meditation.js)
  if (G.coopGuest) return;   // the host runs this run's spawns and waves: net/foes.js tells this browser what they did
  // the lull: once the first half of a long wave is down, hold the rest behind a short beat, then release it
  const bar = G.spawnQueue.find(s => s.barrier);
  if (bar && !G.spawnQueue.some(s => !s.barrier && !s.held) && !enemies.some(e => !e.dead && !e.converted)){
    if (!bar.began){
      bar.began = true;
      showBanner('', 'SECOND WAVE', bar.hold);
      MUSIC.waveSting();
      player.force = CFG.player.maxForce;
    }
    bar.hold -= dt;
    if (bar.hold <= 0){ G.spawnQueue.splice(G.spawnQueue.indexOf(bar), 1); for (const s of G.spawnQueue) s.held = false; }
  }
  // drain spawn queue → spawn at arena edge
  for (let i = G.spawnQueue.length-1; i >= 0; i--){
    const s = G.spawnQueue[i];
    if (s.barrier || s.held) continue;
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
  // a shared run waits in the lull until both heroes have closed their upgrade screens
  const holdForPicks = coopRun.live && (G.skillSelect || coopRun.guestPicking);
  if (holdForPicks && (shared.levelPhase === 'between' || shared.levelPhase === 'travel')) shared.phaseT = Math.max(shared.phaseT, 1.4);   // a beat after the last screen closes
  if (shared.levelPhase === 'between' && shared.phaseT <= 0 && !holdForPicks){
    if (G.endless) startEndlessWave(); else startWave();
  } else if (shared.levelPhase === 'chapterdone' && shared.phaseT <= 0 && !holdForPicks && (!commsBusy() || shared.phaseT < -8)){   // a chapter's close (game/campaign.js): its last line said, then the upgrade screen
    shared.levelPhase = 'travel'; shared.phaseT = 1.6;
    openSkillTree();
  } else if (shared.levelPhase === 'travel' && shared.phaseT <= 0 && !holdForPicks){
    shared.levelPhase = 'idle';
    if (G.chapter >= 0) nextChapter(); else startLevel(G.levelIdx + 1);
  } else if (shared.levelPhase === 'fighting'){
    let hostiles = 0;
    for (const e of enemies) if (!e.converted) hostiles++;
    if (hostiles === 0 && G.spawnQueue.length === 0){
      for (const e of enemies) if (!e.dead) damageEnemy(e, 9999, V3(0,0,1), 6);   // converted expire with the wave
      if (enemies.length > 0) return;
      if (G.endless){ endlessWaveCleared(); return; }   // survival has its own clear/escalation path
      G.wave++;
      campaignWaveRewards();
      earnWavePoint();   // a skill point for the clear (game/upgrades.js); it is spent when the chapter ends
      if (!chapterEnds()){
        shared.levelPhase = 'between'; shared.phaseT = 2.2;
        player.force = CFG.player.maxForce;
        noteWavePoint();   // no screen mid-chapter: a note in the corner, and the fight goes on
      } else if (bossDue(L)){
        noteWavePoint();
        shared.levelPhase = 'bossfight';
        if (G.checkpoint){ G.checkpoint.boss = diffBossCheckpoint(); G.checkpoint.bossWaveTotal = G.waveTotal; }
        showBanner('', '...something approaches.', 2.4);
        storyBeat('boss');
        spawnBossWhenReady(() => G.mode === 'play' && !shared.boss, 2400);
      } else {
        // LEVEL CLEARED — the chapter's upgrade page opens (its skill points + a chance to shop), then the
        // 'travel' beat runs out on sim time (frozen while the overlay is up) and the next world loads.
        showBanner(G.chapter >= 0 ? 'CHAPTER COMPLETE' : 'AREA CLEARED', 'The Force flows onward.', 1.6);
        if (G.chapter >= 0){ G.chapterClosed = G.chapter; shared.levelPhase = 'chapterdone'; shared.phaseT = 2.2; storyBeat('clear'); }   // (a chapter: the voice's last word first)
        else { shared.levelPhase = 'travel'; shared.phaseT = 1.6; openSkillTree(); }
      }
    }
  }
  // bossfight phase: boss drives its own flow (adds from summon use the same queue)
}
