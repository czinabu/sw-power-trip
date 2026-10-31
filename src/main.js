// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Entry point: imports every module in the original load order, then runs the main loop (tick) and exposes window.GAME.

import * as THREE from 'three';
import { switchWeapon, beskarPress } from './player/mando/weapons.js';
import { setKit, grantGun } from './game/armory.js';
import { heroAim, aimFrom, crosshairPoint, inAim, bossInAim, lastAim } from './player/aim.js';
import { CFG } from './data/config.js';
import { STANCES } from './data/stances.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { LEVELS } from './data/levels.js';
import { BOSS_CFG, BOSS_MANDO } from './data/bosses.js';
import { camera, composer, renderer, scene } from './engine/renderer.js';
import { cycleQuality, qualityGovernor } from './engine/quality.js';
import { audioInit } from './audio/sfx.js';
import { MUSIC } from './audio/music.js';
import { updateAudio } from './audio/director.js';
import './utils.js';
import { updateParticles } from './fx/particles.js';
import './fx/floaters.js';
import {
  shared, G, rockets, enemies, bolts, rings, pillars, solids, hazardZones, keys, player
} from './state.js';
import { MANDO, MANDO_WEAPONS } from './data/mando.js';
import './fx/lights.js';
import './engine/prewarm.js';
import './player/mesh.js';
import { setHero } from './player/hero.js';
import { updateTrail } from './fx/trail.js';
import { stance } from './player/helpers.js';
import { switchStance } from './player/jedi/stance.js';
import { updateJudgeFX } from './player/jedi/judgement-fx.js';
import './enemies/mesh.js';
import { enemyHpScale, ELITES, eliteChance } from './enemies/elites.js';
import { bomberExplode } from './enemies/specials.js';
import { spawnEnemy } from './enemies/spawn.js';
import { damageEnemy } from './enemies/damage.js';
import { updateEnemies } from './enemies/ai.js';
import { updateBolts, updateOrbs, fireBolt } from './enemies/bolts.js';
import { updateGrenades, grenades, pushGrenades } from './enemies/grenades.js';
import { RAMP, TROOP_MELEE, TROOP_FIRE, PINCER, ORDERS, GRENADE, LUNGE } from './data/tactics.js';
import { tacticsRamp } from './enemies/tactics.js';
import './boss/light.js';
import { updateVents, updateBarrels, hazardContains, updateHazardZones } from './world/hazards.js';
import { spawnBoss, damageBoss, bossStagger, updateBoss, updateRings } from './boss/boss.js';
import { FOCUS, focusTier, focusDmgMul, focusRegenMul, addFocus, updateFocus } from './player/jedi/focus.js';
import { tryAttack, applySwingDamage } from './player/jedi/combat.js';
import {
  castGesture, saberThrow, forcePush, forceSlam, updateSaberThrow, forceRepulse, forceBarrier, forceMend
} from './player/jedi/force.js';
import { updateVFX } from './fx/vfx.js';
import './player/movement.js';
import './world/collision.js';
import { updateRockets, updateBirds, updateDetos, updateGrapple } from './player/mando/gadgets.js';
import { mandoWeapon, spawnBlasterBolt, hitMarker } from './player/mando/weapons.js';
import './player/mando/darksaber.js';
import { hurtPlayer } from './player/damage.js';
import { updatePlayer } from './player/update.js';
import './world/arena.js';
import './world/textures.js';
import { updateAmbient } from './fx/ambient.js';
import { updateScorch } from './fx/scorch.js';
import { updateSevered, scarBody, severLimbs } from './enemies/scars.js';
import './world/arenas/temple.js';
import './world/arenas/foundry.js';
import './world/arenas/plains.js';
import { queueSpawn, startLevel, checkUnlocks, startWave, updateFlow } from './game/flow.js';
import { startTutorial, updateTutorial, skipStep, trainingProgress, lessonList, openLessonBoard } from './game/tutorial.js';
import { startCampaign, campaignWon, startChapter, nextChapter, chapters } from './game/campaign.js';
import { startMission, updateMission, skipObjective, missionState } from './game/mission.js';
import { startSandbox, updateSandbox, sandboxSpawn, sandboxClear, setSandboxKit, sandboxKitAll } from './game/sandbox.js';
import {
  enemyDmgScale, genEndlessWave, spawnChampion, startEndless, startEndlessWave
} from './game/survival.js';
import { MUTATORS } from './data/mutators.js';
import { SKILLS } from './data/skills.js';
import { nextStoreGoal, buyPower } from './game/progression.js';
import { trainAbility, masteryNext, earnWavePoint } from './game/upgrades.js';
import { abil, MASTERY_JEDI, MASTERY_MANDO } from './data/mastery.js';
import { ENDLESS_POWERS } from './data/store.js';
import { openSkillTree } from './ui/store-ui.js';
import { BOONS, BOON_BY_ID } from './data/boons.js';
import { rollBoons, pickBoon } from './game/boons.js';
import { endRun } from './game/summary.js';
import './ui/banners.js';
import './ui/threats.js';
import { updateHud } from './ui/hud.js';
import { setOverlayState } from './ui/menus.js';
import './ui/roadmap.js';   // the ROADMAP panel (its button on the main menu)
import './ui/forms-ui.js';   // the FORMS page: before the fight (BEGIN) and on the pause screen
import { showcaseActive, renderShowcase, leaveShowcase } from './ui/showcase.js';
import './ui/customizer.js';
import './data/difficulty.js';
import './engine/input.js';
import './engine/gamepad.js';
import { updateCamera } from './engine/camera.js';
import { updateCutscene } from './game/cutscene.js';
import { SEE } from './world/ink.js';
import { NAV, buildNav, updateNav, navSteer, navDist } from './enemies/nav.js';
import { DUEL, DUEL_PROFILES, MANDO_MELEE } from './data/duel.js';
import { LOCK, startLock, endLock, duelDefend, eliteRamp } from './enemies/duel.js';
import { foeBlade, bossBlade, contactPoint } from './player/jedi/clash.js';
import { updateCoop, partnerShown, partnerInfo, partnerMate } from './net/partner.js';
import { allies, updateSquad, updateSquadHud, spawnSquad, addSquadmate, squadOrder, hurtAlly, giveOrder, squadOrderName, squadFormation, grenadeLeft } from './allies/squad.js';
import { updateWheel, wheelOpen } from './allies/wheel.js';
import { downed } from './game/revive.js';
import { updateComms, clearComms, commsBusy, storyBeat } from './game/story.js';
import './ui/coop-ui.js';
import { updateFoes, updatePuppets, coopLive } from './net/foes.js';
import './net/foefire.js';
import { updateSquadNet } from './net/squad.js';
import { updatePings, pingHere, pingInfo } from './net/ping.js';
import { dropLink as coopDrop, net as coopNet } from './net/session.js';
import { hooks as coopHooks, coopRun } from './net/run.js';
import './ui/saves-ui.js';   // NEW GAME / SAVE GAME / LOAD GAME and the save-slot panel

setHero(G.hero);   // initialise control text + crosshair for the default hero

/* ============================================================
   MAIN LOOP
   ============================================================ */
const clock = new THREE.Clock();
function tick(){
  requestAnimationFrame(tick);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  let dt = rawDt;
  updateWheel();   // the squad's command wheel: opens on a held H and slows the world while it's up (allies/wheel.js)
  if (G.slowmoT > 0){
    G.slowmoT -= rawDt;
    if (G.slowmoT <= 0 && (!shared.boss || shared.boss.state !== 'dying')) G.slowmo = 1;
  }
  if (G.hitstop > 0){ G.hitstop -= dt; dt *= 0.08; }
  dt *= G.slowmo;
  // overlay up: freeze the simulation entirely (still renders). In a shared fight the OTHER hero is still playing, so only
  // this hero stops (and feels their own hitstop and slow motion): the foes, their shots and the waves run on real time
  const frozen = G.paused || G.skillSelect || G.cutscene, live = coopLive();
  // a cutscene (either hero's, in co-op) holds the whole fight: foes, shots and waves stand still until it ends
  const wdt = G.cutscene || coopRun.guestScene ? 0 : live ? rawDt : frozen ? 0 : dt;
  if (frozen) dt = 0;
  if ((!frozen || live) && (G.mode === 'play' || G.mode === 'dead')){
    G.gt += wdt;
    if (G.mode === 'play'){
      updatePlayer(dt);
      updateFlow(wdt);
      updateMission(dt);
      updateSandbox(dt);
      updateSquad(dt);   // the hero's squad, and anyone downed waiting to be got up (allies/squad.js, game/revive.js)
    }
    if (G.coopGuest) updatePuppets(wdt); else updateEnemies(wdt);   // co-op guest: the host's foes, followed rather than thought for (net/foes.js)
    updateBolts(wdt);
    updateGrenades(wdt);
    updateOrbs(dt);
    updateBoss(live && shared.boss && shared.boss.state === 'dying' ? wdt : dt);   // co-op: a felled boss finishes dying even while this hero picks upgrades, so the partner's fight ends
    updateRings(dt);
    updateVents(dt);
    updateBarrels(dt);
    updateHazardZones(dt);
    updateSaberThrow(dt);
    updateRockets(dt);
    updateBirds(dt); updateDetos(dt); updateGrapple(dt);
    if (G.streakT > 0){
      G.streakT -= dt;
      if (G.streakT <= 0){ G.streak = 0; document.getElementById('streak').style.opacity = '0'; }
    }
    updateHud();
  }
  updateSquadHud();
  updateComms(G.paused || G.skillSelect || G.cutscene ? 0 : rawDt);   // the voice in your ear during a campaign chapter (game/story.js)
  updateTutorial(G.paused || G.skillSelect || G.cutscene ? 0 : dt);   // the training lessons, and the unlock drills in a real run
  updateFoes();
  updateSquadNet();   // online co-op: the host's squad, sent to the guest and commanded from both screens (net/squad.js)
  updateCoop(rawDt);     // online co-op: send my pose, pose the partner's hero (net/partner.js)
  updatePings();         // pings: yours and the other players' (net/ping.js)
  updateTrail(dt);
  updateJudgeFX();
  updateAmbient(G.paused ? 0 : rawDt);
  updateScorch(dt);
  updateSevered(dt);
  updateParticles(dt);
  updateVFX(dt);
  updateCutscene();   // a cutscene's lens, actors and words (game/cutscene.js); the play camera stands down while one is on
  updateCamera(dt);
  MUSIC.updateState();   // adaptive score follows the fight (menu → combat → boss surge → victory/death)
  updateAudio(rawDt);    // saber hum, jetpack, flamethrower, ambience, muffle
  // the title screen draws its own stage (painted backdrop + the hero on a turntable) instead of the arena
  if (showcaseActive()) renderShowcase(rawDt); else { leaveShowcase(); composer.render(); }
  qualityGovernor(!showcaseActive() && !G.paused && !G.skillSelect && !G.cutscene && G.mode === 'play');
}
tick();

/* expose configs + API for live tweaking and future edits (dev console) */
window.GAME = { shared, coopRun, coopHooks, partnerShown, partnerInfo, partnerMate, CFG, ENEMY_TYPES, LEVELS, BOSS_CFG, BOSS_MANDO, STANCES, SKILLS, MANDO, MANDO_WEAPONS, G, enemies, player, pillars, solids, rockets, bolts,
  startLevel, startWave, spawnEnemy, startTutorial, startMission, skipObjective, startSandbox, sandboxSpawn, sandboxClear, setSandboxKit, sandboxKitAll, missionState, skipStep, trainingProgress, lessonList, openLessonBoard, spawnBoss, queueSpawn, checkUnlocks, switchStance, setHero,
  openSkillTree, damageEnemy, damageBoss, updateHud, nextStoreGoal, enemyHpScale, eliteChance, ELITES, cycleQuality, forceBarrier, forceMend, updatePlayer, updateEnemies, updateBolts, fireBolt, endRun, updateFlow, startEndless, startEndlessWave, genEndlessWave, MUTATORS, ENDLESS_POWERS, buyPower, keys, camera, SEE,
  tryAttack, castGesture, saberThrow, forcePush, forceSlam, forceRepulse, stance, applySwingDamage, spawnChampion, startWave, bomberExplode, MUSIC, audioInit,
  spawnBoss, updateBoss, bossStagger, BOSS_CFG, BOSS_MANDO, rings,
  BOONS, BOON_BY_ID, rollBoons, pickBoon, hurtPlayer, abil, MASTERY_JEDI, MASTERY_MANDO, trainAbility, masteryNext, earnWavePoint,
  FOCUS, focusTier, focusDmgMul, focusRegenMul, addFocus, updateFocus, enemyDmgScale, applySwingDamage,
  hitMarker, spawnBlasterBolt, mandoWeapon, updateBolts, updateHud,
  hazardZones, updateHazardZones, hazardContains, setOverlayState, nav: { NAV, buildNav, updateNav, navSteer, navDist },
  duel: { DUEL, DUEL_PROFILES, MANDO_MELEE, LOCK, startLock, endLock, duelDefend, eliteRamp, foeBlade, bossBlade, contactPoint },
  scars: { scarBody, severLimbs },
  tactics: { RAMP, TROOP_MELEE, TROOP_FIRE, PINCER, ORDERS, GRENADE, LUNGE, tacticsRamp, grenades, pushGrenades },
  squad: { allies, spawnSquad, addSquadmate, squadOrder, hurtAlly, giveOrder, squadOrderName, squadFormation, grenadeLeft, wheelOpen, downed },
  aim: { heroAim, aimFrom, crosshairPoint, inAim, bossInAim, lastAim },
  get boss(){ return shared.boss; }, get saberProj(){ return shared.saberProj; }, get darkProj(){ return shared.darkProj; } };

/* the battle maps (data/battlemaps.js): what's built and what it costs, for the console and tools/smoke/maps.mjs */
import { arenaInfo } from './world/arena.js';
import { ENDLESS_ARENAS } from './game/survival.js';
import { BATTLE_MAPS } from './data/battlemaps.js';
import { setSandboxMap } from './game/sandbox.js';
Object.assign(window.GAME, { pingHere, pingInfo, coopDrop, coopNet, arena: arenaInfo, ENDLESS_ARENAS, BATTLE_MAPS, setSandboxMap, gfx: { renderer, composer, scene } });
Object.assign(window.GAME, { startCampaign, startChapter, nextChapter, chapters, campaignWon });
import { BS as battleSim, placeAt as battlePlace, enterSetup as battleEnter, startBattle, replayBattle, saveSetup as battleSave, loadSetup as battleLoad, clearSetup as battleClear } from './game/battlesim.js';
import { openBattleSetup } from './ui/battlesim-ui.js';
Object.assign(window.GAME, { battle: { BS: battleSim, open: openBattleSetup, enter: battleEnter, place: battlePlace, start: startBattle, replay: replayBattle, save: battleSave, load: battleLoad, clear: battleClear } });   // the sandbox's battle simulator (game/battlesim.js), for tests
Object.assign(window.GAME, { switchWeapon, setKit, grantGun, beskarPress });   // the Mando's loadout and beskar parry (game/armory.js, mando/weapons.js), for tests   // the campaign's chapters (game/campaign.js), for tests
Object.assign(window.GAME, { clearComms, commsBusy, storyBeat });   // the story's voice lines (game/story.js), for tests
import { playScene, playOpening, playDuelIntro, playBossIntro, skipScene, sceneOn } from './game/cutscene.js';
Object.assign(window.GAME, { cutscene: { playScene, playOpening, playDuelIntro, playBossIntro, skipScene, sceneOn } });   // the cutscenes (game/cutscene.js), for tests

/* the form loadout (data/forms.js): the seven forms and what sits on 1 / 2 / 3 */
import { FORMS } from './data/forms.js';
import { setLoadout } from './player/jedi/stance.js';
Object.assign(window.GAME, { FORMS, setLoadout });

/* every map's level, for the art capture tool (tools/shots/maps.mjs): build any arena in place and frame it */
import { buildArena } from './world/arena.js';
import { findClearSpawn, edgeSpawn } from './world/collision.js';
import { TRAINING_LEVELS } from './data/tutorial.js';
import { SANDBOX_LEVELS } from './data/sandbox.js';
import { MISSIONS } from './data/missions.js';
const byLayout = id => Object.values(MISSIONS).find(m => m.level && m.level.layout === id).level;
Object.assign(window.GAME, { buildArena, findClearSpawn, edgeSpawn, mapLevels: () => ({
  temple: LEVELS[0], foundry: LEVELS[1], plains: LEVELS[2],
  archive: { ...LEVELS[0], layout: 'archive', arena: 48 }, sith: { ...LEVELS[2], layout: 'sith', arena: 64 },
  hall: TRAINING_LEVELS.jedi, forge: TRAINING_LEVELS.mando, dojo: SANDBOX_LEVELS.jedi, throne: SANDBOX_LEVELS.mando,
  refuge: MISSIONS.refuge.level, pursuit: MISSIONS.pursuit.level, prison: byLayout('prison'), pens: MISSIONS.pens.level,
  hangar: byLayout('hangar'), approach: MISSIONS['strike-exegol'].level,
  outpost: { ...LEVELS[0], layout: 'outpost', arena: 60 }, covert: MISSIONS.covert.level,   // (the Mando's story: data/campaign-mando.js)
  grassland: BATTLE_MAPS.grassland.level, icefront: BATTLE_MAPS.icefront.level, graveyard: BATTLE_MAPS.graveyard.level,
}) });
import { arcadeContract, arcadeBoard, missionById } from './data/arcade.js';
Object.assign(window.GAME, { arcade: { arcadeContract, arcadeBoard, missionById } });   // the arcade's dealt contracts (data/arcade.js), for tests
