// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SANDBOX: the post-campaign training room (the Jedi's temple training room, the Mandalorian's throne room). No waves and no clock: call in any foe (data/sandbox.js), switch any
// ability on or off, clear the floor and go again. ui/sandbox-ui.js is the panel that drives it.

import { scene } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, player } from '../state.js';
import { CFG } from '../data/config.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { cleanupDuel } from '../enemies/duel.js';
import { cleanupTactics } from '../enemies/tactics.js';
import { findClearSpawn } from '../world/collision.js';
import { spawnBoss } from '../boss/boss.js';
import { spawnChampion } from './survival.js';
import { startLevel, syncJediChips, syncMandoChips } from './flow.js';
import { showBanner } from '../ui/banners.js';
import { SANDBOX_LEVELS, SANDBOX_KIT } from '../data/sandbox.js';

// the panel's settings: how many foes a pick calls in, whether they come elite or stand still as dummies
// (god mode is G.sandboxGod, so player/damage.js can read it)
export const SB = { count: 1, elite: false, dummy: false };

// unlocked once the campaign has been beaten with either hero (summary.js records each win)
export function sandboxUnlocked(){
  try { return localStorage.getItem('sw_camp_jedi') === '1' || localStorage.getItem('sw_camp_mando') === '1'; } catch(e){ return false; }
}

export function startSandbox(){
  startLevel(0, { level: SANDBOX_LEVELS[G.hero] || SANDBOX_LEVELS.jedi, sandbox: true });   // fresh hero and starting kit, in the hero's room
  G.waveTotal = 0;   // foes at their base toughness (HP and elite odds climb with waveTotal)
  const s = findClearSpawn(0, -10, CFG.player.radius + 1.0);
  playerPos().set(s.x, 0, s.z); G.yaw = player.faceYaw = 0;   // south of centre, facing the north wall (the crest, or the throne)
  const kit = savedKit();
  if (kit) applyKit(kit); else sandboxKitAll(true);   // the first visit: everything (the first of each key-sharing pair)
}

/* ---------- the kit ---------- */
const kitRows = () => SANDBOX_KIT[G.hero] || [];
// the last kit this hero used here, or null the first time
function savedKit(){
  try { const v = JSON.parse(localStorage.getItem('sw_sandbox_kit_' + G.hero)); if (Array.isArray(v)) return v; } catch(e){}
  return null;
}
function saveKit(){
  try { localStorage.setItem('sw_sandbox_kit_' + G.hero, JSON.stringify(kitRows().filter(r => r.has()).map(r => r.id))); } catch(e){}
}
function syncChips(){ if (G.hero === 'mando') syncMandoChips(); else syncJediChips(); }
function applyKit(ids){
  const on = new Set(ids);
  for (const r of kitRows()) if (r.has() !== on.has(r.id)) r.set(on.has(r.id));
  syncChips();
}
export function kitAvailable(r){ return !r.needs || !!kitRows().find(o => o.id === r.needs)?.has(); }
// switch one ability on or off: its key-sharing partner goes off, and an upgrade goes with what it upgrades
export function setSandboxKit(id, on){
  const r = kitRows().find(o => o.id === id); if (!r || !kitAvailable(r)) return;
  if (on && r.slot) for (const o of kitRows()) if (o !== r && o.slot === r.slot && o.has()) o.set(false);
  r.set(on);
  for (const o of kitRows()) if (o.needs && o.has() && !kitAvailable(o)) o.set(false);
  syncChips(); saveKit();
}
export function sandboxKitAll(on){
  const taken = new Set();
  for (const r of kitRows()){
    const want = on && (!r.slot || !taken.has(r.slot)) && (!r.needs || taken.has('#' + r.needs));
    if (want){ if (r.slot) taken.add(r.slot); taken.add('#' + r.id); }
    if (r.has() !== want) r.set(want);
  }
  syncChips(); saveKit();
}

/* ---------- foes ---------- */
// call in a foe (or a few, fanned out) a short way in front of the hero
export function sandboxSpawn(id){
  if (!G.sandbox) return;
  const p = playerPos(), fx = Math.sin(G.yaw), fz = Math.cos(G.yaw), lim = shared.arenaHalf - 3;
  const spot = (i, n) => {
    const side = (i - (n - 1) / 2) * 2.4, d = 9 + (i % 2) * 1.5;
    const x = Math.max(-lim, Math.min(lim, p.x + fx*d + fz*side)), z = Math.max(-lim, Math.min(lim, p.z + fz*d - fx*side));
    return findClearSpawn(x, z, 0.9);
  };
  if (id === 'boss'){
    if (shared.boss){ showBanner('', 'ONE BOSS AT A TIME', 1.2); return; }
    spawnBoss();
    const s = spot(0, 1);
    if (shared.boss) shared.boss.group.position.set(s.x, 0, s.z);
    return;
  }
  G.forceElite = SB.elite;
  for (let i = 0; i < SB.count; i++){
    if (id === 'warbringer'){ spawnChampion(); continue; }
    const s = spot(i, SB.count);
    spawnEnemy(id, V3(s.x, 0, s.z));
    const e = enemies[enemies.length - 1];
    e.home = { x: s.x, z: s.z }; e.dummy = SB.dummy;
  }
  G.forceElite = false;
}
// DUMMIES: every foe on the floor (and every new one) stands still and takes it, or fights back again
export function setSandboxDummy(on){
  SB.dummy = on;
  for (const e of enemies){ e.dummy = on; if (on) e.home = { x: e.group.position.x, z: e.group.position.z }; }
}
// sweep the floor: every foe and the boss go in a puff, without counting as kills
export function sandboxClear(){
  for (const e of enemies){
    if (!e.dead) burst(V3(e.group.position.x, 1.2, e.group.position.z), 0xffd28a, 10, 4, 3, 0.8);
    scene.remove(e.group); cleanupDuel(e); cleanupTactics(e);
    if (e.hpBar) scene.remove(e.hpBar);
    if (e.aimLine) scene.remove(e.aimLine);
  }
  enemies.length = 0;
  G.spawnQueue.length = 0;
  if (shared.boss){
    scene.remove(shared.boss.group); shared.boss = null;
    if (shared.bossLight) shared.bossLight.visible = false;
    document.getElementById('bosswrap').style.display = 'none';
  }
}
export function sandboxHeal(){
  player.hp = maxHp(); player.force = CFG.player.maxForce; player.stam = CFG.player.maxStam;
  if (G.hero === 'mando') player.jet = player.jetMax;
  floater(V3(playerPos().x, 1.2, playerPos().z), 'RESTORED', '#7bffae');
}

/* called every frame in play: god mode keeps the hero topped up, and the room's remotes drift */
export function updateSandbox(dt){
  if (!G.sandbox) return;
  if (G.sandboxGod){ player.hp = maxHp(); player.force = CFG.player.maxForce; }
  for (const r of shared.dojoRemotes || []){
    const b = r.userData.base, t = G.gt + r.userData.ph;
    r.position.set(b.x + Math.sin(t*0.4)*0.8, b.y + Math.sin(t*1.3)*0.25, b.z + Math.cos(t*0.33)*0.8);
    r.rotation.y += dt * 0.6;
  }
}
