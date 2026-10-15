// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Entry point: imports every module in the original load order, then runs the main loop (tick) and exposes window.GAME.

import * as THREE from 'three';
import { CFG } from './data/config.js';
import { STANCES } from './data/stances.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { LEVELS } from './data/levels.js';
import { BOSS_CFG, BOSS_MANDO } from './data/bosses.js';
import { camera, composer } from './engine/renderer.js';
import { cycleQuality } from './engine/quality.js';
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
import { updateBolts, updateOrbs } from './enemies/bolts.js';
import './boss/light.js';
import { updateVents, updateBarrels, hazardContains, updateHazardZones } from './world/hazards.js';
import { spawnBoss, damageBoss, bossStagger, updateBoss, updateRings } from './boss/boss.js';
import { FOCUS, focusTier, focusDmgMul, focusRegenMul, addFocus, updateFocus } from './player/jedi/focus.js';
import { tryAttack, applySwingDamage } from './player/jedi/combat.js';
import {
  castGesture, forcePush, forceSlam, updateSaberThrow, forceRepulse, forceBarrier, forceMend
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
import './world/arenas/temple.js';
import './world/arenas/foundry.js';
import './world/arenas/plains.js';
import { queueSpawn, startLevel, checkUnlocks, startWave, updateFlow } from './game/flow.js';
import {
  enemyDmgScale, genEndlessWave, spawnChampion, startEndless, startEndlessWave
} from './game/survival.js';
import { MUTATORS } from './data/mutators.js';
import { SKILLS } from './data/skills.js';
import { nextStoreGoal, buyPower, masteryOffers, buyMastery } from './game/progression.js';
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
import './data/difficulty.js';
import './engine/input.js';
import { updateCamera } from './engine/camera.js';

setHero(G.hero);   // initialise control text + crosshair for the default hero

/* ============================================================
   MAIN LOOP
   ============================================================ */
const clock = new THREE.Clock();
function tick(){
  requestAnimationFrame(tick);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  let dt = rawDt;
  if (G.slowmoT > 0){
    G.slowmoT -= rawDt;
    if (G.slowmoT <= 0 && (!shared.boss || shared.boss.state !== 'dying')) G.slowmo = 1;
  }
  if (G.hitstop > 0){ G.hitstop -= dt; dt *= 0.08; }
  dt *= G.slowmo;
  if (G.paused || G.skillSelect) dt = 0;   // overlay up — freeze the simulation entirely (still renders)
  if (!G.paused && !G.skillSelect && (G.mode === 'play' || G.mode === 'dead')){
    G.gt += dt;
    if (G.mode === 'play'){
      updatePlayer(dt);
      updateFlow(dt);
    }
    updateEnemies(dt);
    updateBolts(dt);
    updateOrbs(dt);
    updateBoss(dt);
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
  updateTrail(dt);
  updateJudgeFX();
  updateAmbient(G.paused ? 0 : rawDt);
  updateParticles(dt);
  updateVFX(dt);
  updateCamera(dt);
  MUSIC.updateState();   // adaptive score follows the fight (menu → combat → boss surge → victory/death)
  updateAudio(rawDt);    // saber hum, jetpack, flamethrower, ambience, muffle
  composer.render();
}
tick();

/* expose configs + API for live tweaking and future edits (dev console) */
window.GAME = { CFG, ENEMY_TYPES, LEVELS, BOSS_CFG, BOSS_MANDO, STANCES, SKILLS, MANDO, MANDO_WEAPONS, G, enemies, player, pillars, solids, rockets, bolts,
  startLevel, startWave, spawnEnemy, spawnBoss, queueSpawn, checkUnlocks, switchStance, setHero,
  openSkillTree, damageEnemy, damageBoss, updateHud, nextStoreGoal, enemyHpScale, eliteChance, ELITES, cycleQuality, forceBarrier, forceMend, updatePlayer, updateEnemies, updateBolts, endRun, updateFlow, startEndless, startEndlessWave, genEndlessWave, MUTATORS, ENDLESS_POWERS, buyPower, keys, camera,
  tryAttack, castGesture, forcePush, forceSlam, forceRepulse, stance, applySwingDamage, spawnChampion, startWave, bomberExplode, MUSIC, audioInit,
  spawnBoss, updateBoss, bossStagger, BOSS_CFG, BOSS_MANDO, rings,
  BOONS, BOON_BY_ID, rollBoons, pickBoon, hurtPlayer, abil, MASTERY_JEDI, MASTERY_MANDO, masteryOffers, buyMastery,
  FOCUS, focusTier, focusDmgMul, focusRegenMul, addFocus, updateFocus, enemyDmgScale, applySwingDamage,
  hitMarker, spawnBlasterBolt, mandoWeapon, updateBolts, updateHud,
  hazardZones, updateHazardZones, hazardContains, setOverlayState,
  get boss(){ return shared.boss; }, get saberProj(){ return shared.saberProj; } };
