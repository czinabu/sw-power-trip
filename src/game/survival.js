// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Survival / endless mode: waves, mutators, champions, arena rotation.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { scene } from '../engine/renderer.js';
import { sfx } from '../audio/sfx.js';
import { V3, rand } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, bolts, player } from '../state.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { makeBossBar, spawnEnemy } from '../enemies/spawn.js';
import { findClearSpawn } from '../world/collision.js';
import { buildArena } from '../world/arena.js';
import { startLevel, checkUnlocks } from './flow.js';
import { MUTATORS } from '../data/mutators.js';
import { gainXp } from './progression.js';
import { openSkillTree } from '../ui/store-ui.js';
import { showBanner } from '../ui/banners.js';

/* ============================================================
   SURVIVAL / ENDLESS MODE — escalating waves, mutators, milestone spikes, arena rotation, repeatable power-ups.
   ============================================================ */
// Enemy DAMAGE scaling — campaign is UNTOUCHED (returns 1); survival ramps damage as waves climb (HP already scales
// via enemyHpScale). The Frenzy mutator stacks on top. Applied wherever an enemy deals damage.
export function enemyDmgScale(){
  if (!G.endless) return 1;
  const n = G.endlessWave || 0;
  // COMPOUNDS past wave ~5 so a late-game mistake actually hurts even through stacked Vitality / damage-reduction.
  return (1 + n*0.03) * Math.pow(1.035, Math.max(0, n-5)) * (G.mut === 'frenzy' ? 1.3 : 1);
}
const ENDLESS_ARENAS = [0, 1, 2];   // rotate through the three authored arenas
function pickMutator(n){
  if (n < 3 || n % 5 === 0) return null;     // early waves & milestone surges run clean
  if (Math.random() < 0.34) return null;     // not every wave is mutated
  return MUTATORS[(Math.random()*MUTATORS.length)|0].id;
}
// a survival wave's enemy list — a composition that SHIFTS toward deadlier types as the run deepens
export function genEndlessWave(n){
  const total = Math.min(34, 5 + Math.floor(n * 1.5));   // more bodies on the field, later cap — survival pressure
  const w = {
    grunt:   Math.max(1.0, 6 - n*0.22),
    blaster: n >= 2 ? 0.8 + n*0.13 : 0,
    duelist: n >= 3 ? 0.5 + n*0.11 : 0,
    flyer:   n >= 3 ? 0.4 + n*0.09 : 0,
    phalanx: n >= 4 ? 0.3 + (n-3)*0.08 : 0,   // sentinels anchor the line from wave 4
    brute:   n >= 5 ? 0.3 + (n-4)*0.14 : 0,
    bomber:  n >= 6 ? 0.3 + (n-5)*0.07 : 0,    // saboteurs harass from wave 6
    sniper:  n >= 7 ? 0.25 + (n-6)*0.06 : 0,   // marksmen pick at you from wave 7
  };
  if (G.mut === 'swarm')    w.grunt *= 2.3;
  if (G.mut === 'marksmen'){ w.blaster *= 2.2; w.flyer *= 1.9; w.sniper *= 2.4; }
  if (G.mut === 'skyfall')   w.flyer = (w.flyer || 0.5) * 3.2;
  const types = Object.keys(w).filter(t => w[t] > 0);
  let sum = 0; for (const t of types) sum += w[t];
  const list = [];
  for (let i = 0; i < total; i++){
    let r = Math.random()*sum, pick = types[0];
    for (const t of types){ r -= w[t]; if (r <= 0){ pick = t; break; } }
    list.push(pick);
  }
  return list;
}
// milestone every 5 waves: ELITE SURGE (whole wave comes elite) or, every 10, a CHAMPION mini-boss + a smaller pack
function applyMilestone(n, list){
  if (n % 10 === 0){ G.pendingChampion = true; return list.slice(0, Math.max(4, Math.floor(list.length * 0.5))); }
  G.eliteSurge = true; return list;
}
// THE WARBRINGER — a true MID-BOSS: a wall of HP, a floating health bar, and a signature telegraphed LEAP-SLAM
// (a tall pounce that quakes the ground where you stood — dash or jump it). Headlines every endless milestone.
export function spawnChampion(){
  const a = Math.random()*Math.PI*2, r = shared.arenaHalf*0.85;
  spawnEnemy('brute', V3(Math.cos(a)*r, 0, Math.sin(a)*r));
  const e = enemies[enemies.length-1]; if (!e) return;
  e.champion = true; e.warbringer = true; e.leapCd = rand(3.5, 5.5);
  e.hp = Math.round(e.hp * 4.5);                                  // a wall of HP
  e.maxHp = e.hp;
  e.t = Object.assign({}, e.t, { dmg: e.t.dmg * 1.4, score: 16 });   // per-enemy copy: hits harder, pays big (don't mutate the shared type)
  e.group.scale.multiplyScalar(1.55);
  e.group.userData.bodyMat.color.lerp(new THREE.Color(0xff2a2a), 0.4);   // a menacing crimson cast
  // a crowning crest so the silhouette reads as "the big one"
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 }));
  crest.position.set(0, 2.55, 0); e.group.add(crest);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.2, 28), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.08; e.group.add(ring); e.group.userData.eliteRing = ring;
  makeBossBar(e);
  G.shake = Math.max(G.shake, 0.9);
  showBanner('', 'A WARBRINGER RISES', 2.2);
  sfx(70, 0.7, 'sawtooth', 0.2, 30); sfx(140, 0.5, 'square', 0.1, 60);
}

export function startEndless(){
  startLevel(0);                                   // full fresh setup (kit/build/stats) on the first arena (temple)
  G.endless = true; G.endlessWave = 0; G.arenaRot = 0; G.mut = null;
  G.eliteSurge = false; G.pendingChampion = false;
  showBanner('SURVIVAL', 'They will not stop coming. Neither will you.', 3.0);
}
// rebuild the arena in place at a milestone — clear the field, build, recentre the player (NO run reset)
function rotateEndlessArena(L){
  for (const e of enemies) scene.remove(e.group); enemies.length = 0;
  for (const b of bolts) scene.remove(b.mesh); bolts.length = 0;
  G.spawnQueue.length = 0;
  buildArena(L);
  { const spot = findClearSpawn(0, shared.arenaHalf*0.42, CFG.player.radius + 1.0); playerPos().set(spot.x, 0, spot.z); }
  player.vel.set(0,0,0); player.moveVel.set(0,0,0); player.vy = 0;
  showBanner('', 'A NEW KILLING GROUND', 1.8);
}
export function startEndlessWave(){
  G.endlessWave++; G.waveTotal++;
  const n = G.endlessWave;
  if (n > 1 && (n - 1) % 5 === 0){ G.arenaRot = (G.arenaRot + 1) % ENDLESS_ARENAS.length; rotateEndlessArena(LEVELS[ENDLESS_ARENAS[G.arenaRot]]); }
  G.eliteSurge = false; G.pendingChampion = false;
  G.mut = pickMutator(n);
  const milestone = (n % 5 === 0);
  let list = genEndlessWave(n);
  if (milestone) list = applyMilestone(n, list);
  for (let i = list.length-1; i>0; i--){ const j=(Math.random()*(i+1))|0; const t=list[i]; list[i]=list[j]; list[j]=t; }
  const pulse = Math.max(4, Math.ceil(list.length/3));
  const surgeGap = Math.max(1.3, 2.6 - n*0.05);   // surges arrive faster as the run deepens — relentless late pressure
  let t = 0;
  for (let i = 0; i < list.length; i++){ t += (i>0 && i%pulse===0) ? surgeGap : 0.2; G.spawnQueue.push({ type:list[i], t }); }
  if (G.pendingChampion){ G.pendingChampion = false; spawnChampion(); }
  shared.levelPhase = 'fighting';
  checkUnlocks(1600);   // survival earns the same auto-kit (stances, Force jump/pull, dual blasters, jetpack tiers) as waves climb
  const mut = G.mut ? MUTATORS.find(m => m.id === G.mut) : null;
  const head = milestone ? (n % 10 === 0 ? '◈ CHAMPION ◈' : '◈ ELITE SURGE ◈') : '';
  if (!milestone) showBanner(head, 'WAVE ' + n + (mut ? '  ·  ' + mut.name : ''), 1.6);
  if (mut) floater(V3(playerPos().x, 2.2, playerPos().z), mut.name + ' — ' + mut.tip, mut.col);
  updateEndlessHud();
}
export function endlessWaveCleared(){
  gainXp(120 + G.endlessWave * 34);
  if (player.hp > 0 && player.hp < maxHp()){
    const healed = Math.min(maxHp()-player.hp, Math.round(maxHp()*((player.boon && player.boon.secwind) ? 0.60 : 0.30)));   // SECOND WIND boon heals extra
    player.hp += healed; const pp0 = playerPos();
    floater(V3(pp0.x,1.0,pp0.z), '+'+healed, '#7bffae'); burst(V3(pp0.x,1.2,pp0.z), 0x7bffae, 12, 5, 4);
  }
  player.force = CFG.player.maxForce;
  if (G.hero === 'mando') player.jet = Math.min(player.jetMax, player.jet + player.jetMax*0.6);
  G.mut = null; G.eliteSurge = false;   // the mutator / surge ends with the wave
  shared.levelPhase = 'between'; shared.phaseT = 2.2;
  openSkillTree();
}
function updateEndlessHud(){
  const wi = document.getElementById('waveinfo'); if (!wi) return;
  const mut = G.mut ? MUTATORS.find(m => m.id === G.mut) : null;
  wi.innerHTML = 'SURVIVAL · WAVE <b>' + G.endlessWave + '</b>' + (mut ? '  ·  <span style="color:'+mut.col+'">'+mut.name+'</span>' : '');
}
