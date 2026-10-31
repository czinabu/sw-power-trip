// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SANDBOX: the training room (the Jedi's temple training room, the Mandalorian's throne room). No waves and no clock: call in any foe (data/sandbox.js), switch any
// ability on or off, clear the floor and go again. ui/sandbox-ui.js is the panel that drives it. It opens after Act I with
// what the story has shown so far, and opens up entirely once the campaign is beaten (game/sandbox-unlocks.js).

import { scene } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, player, bolts, isGunner, heroKey } from '../state.js';
import { CFG } from '../data/config.js';
import { playerPos, maxHp, maxStam } from '../player/helpers.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { findClearSpawn } from '../world/collision.js';
import { spawnBoss } from '../boss/boss.js';
import { spawnChampion } from './survival.js';
import { startLevel, syncJediChips, syncMandoChips } from './flow.js';
import { showBanner } from '../ui/banners.js';
import { SANDBOX_LEVELS, SANDBOX_KIT } from '../data/sandbox.js';
import { BATTLE_MAPS } from '../data/battlemaps.js';
import { buildArena } from '../world/arena.js';
import { clearGrenades } from '../enemies/grenades.js';
import { regroupSquad } from '../allies/squad.js';
import { FORMS, LOADOUT_SLOTS, DEFAULT_LOADOUT, STARTING_FORMS, migrateForm, cleanLoadout } from '../data/forms.js';
import { setLoadout } from '../player/jedi/stance.js';
import { refreshSandboxScope, foeOffered, mapOffered, kitOffered, formOffered } from './sandbox-unlocks.js';
import { battleMapChanged, battleAfterRestart, updateBattle } from './battlesim.js';
export { sandboxUnlocked } from './sandbox-unlocks.js';

// the panel's settings: how many foes a pick calls in, whether they come elite or stand still as dummies
// (god mode is G.sandboxGod, so player/damage.js can read it)
// map: 'room' (the hero's own room) or a battle map's id, remembered across visits
export const SB = { count: 1, elite: false, dummy: false, map: savedMap() };
function savedMap(){ try { const m = localStorage.getItem('sw_sandbox_map'); if (m && BATTLE_MAPS[m]) return m; } catch(e){} return 'room'; }

// opts.replay: the fallen screen's retry, which goes back into the battle that was set up (game/battlesim.js)
export function startSandbox(opts){
  refreshSandboxScope();
  if (!mapOffered(SB.map)) SB.map = 'room';   // a world the story hasn't reached yet
  startLevel(0, { level: sandboxLevel(), sandbox: true });   // fresh hero and starting kit, in the hero's room (or the picked battle map)
  G.waveTotal = 0;   // foes at their base toughness (HP and elite odds climb with waveTotal)
  placeHero();
  const kit = savedKit();
  if (kit) applyKit(kit); else sandboxKitAll(true);   // the first visit: everything (the first of each key-sharing pair)
  if (!isGunner()) applyForms(savedForms());
  battleAfterRestart(!!(opts && opts.replay));
}

/* ---------- the forms loadout ---------- */
// the room is for trying things: every form the story has shown is known and can go in any slot (G swaps Djem So ⇄
// Shien in place)
export const sandboxForms = () => Object.keys(FORMS).filter(formOffered);
function savedForms(){
  let list = DEFAULT_LOADOUT;
  try { const v = JSON.parse(localStorage.getItem('sw_sandbox_forms')); if (Array.isArray(v)) list = v; } catch(e){}
  list = cleanLoadout(list).map(id => id && formOffered(id) ? id : null);
  if (!list.some(Boolean)) list[0] = STARTING_FORMS[0];   // the starting form, always open
  return list;
}
function applyForms(list){
  G.stanceUnlocked = G.stanceUnlocked || {};
  for (const id of sandboxForms()) G.stanceUnlocked[id] = true;
  setLoadout(list);
}
// a click on a slot steps it to the next ready form not already slotted (then empty, then round again); the slot
// holding the form in hand can't be emptied
export function cycleSandboxSlot(i){
  if (i < 0 || i >= LOADOUT_SLOTS) return;
  const cur = G.loadout.slice(), opts = [...sandboxForms(), null];
  let at = opts.indexOf(cur[i]);
  for (let n = 0; n < opts.length; n++){
    at = (at + 1) % opts.length;
    const id = opts[at];
    if (id && cur.some((c, j) => j !== i && c && (c === id || (FORMS[id].variant && FORMS[c].variant === FORMS[id].variant)))) continue;   // (one Form V at a time: G swaps it)
    if (!id && (cur[i] === G.stance || cur.filter(Boolean).length <= 1)) continue;
    cur[i] = id; break;
  }
  applyForms(cur);
  try { localStorage.setItem('sw_sandbox_forms', JSON.stringify(G.loadout)); } catch(e){}
}

/* ---------- the arena ---------- */
function sandboxLevel(){ const m = BATTLE_MAPS[SB.map]; return m ? m.level : (heroKey(SANDBOX_LEVELS) || SANDBOX_LEVELS.jedi); }
// the room: south of centre, facing the north wall (the crest, or the throne) · a battle map: where the allies start
export function placeHero(){
  const m = BATTLE_MAPS[SB.map], [x, z, yaw] = m ? m.spots.allyStart : [0, -10, 0];
  const s = findClearSpawn(x, z, CFG.player.radius + 1.0);
  playerPos().set(s.x, 0, s.z); G.yaw = player.faceYaw = yaw;
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
}
// switch arenas from the panel: the floor is cleared and the new one is built in place (the kit stays as it is)
export function setSandboxMap(id){
  if ((id !== 'room' && !BATTLE_MAPS[id]) || !mapOffered(id)) return;
  SB.map = id;
  battleMapChanged();   // a battle set up on the old map doesn't carry over
  try { localStorage.setItem('sw_sandbox_map', id); } catch(e){}
  if (!G.sandbox) return;
  sandboxClear();
  for (const b of bolts) scene.remove(b.mesh); bolts.length = 0;
  clearGrenades();
  const L = sandboxLevel();
  buildArena(L);
  placeHero();
  regroupSquad();   // the squad comes along
  showBanner((L.name.split('—')[1] || L.name).trim(), L.sub, 2.2);
}

/* ---------- the kit ---------- */
// only the rows the story has reached (game/sandbox-unlocks.js)
const kitRows = () => (heroKey(SANDBOX_KIT) || []).filter(kitOffered);
// the last kit this hero used here, or null the first time
function savedKit(){
  try { const v = JSON.parse(localStorage.getItem('sw_sandbox_kit_' + G.hero)); if (Array.isArray(v)) return v.map(migrateForm); } catch(e){}   // older kits named the forms fast / strong
  return null;
}
function saveKit(){
  try { localStorage.setItem('sw_sandbox_kit_' + G.hero, JSON.stringify(kitRows().filter(r => r.has()).map(r => r.id))); } catch(e){}
}
function syncChips(){ if (isGunner()) syncMandoChips(); else syncJediChips(); }
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
  if (!foeOffered(id)) return;
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
    removeEnemy(e);
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
  player.hp = maxHp(); player.force = CFG.player.maxForce; player.stam = maxStam();
  if (isGunner()) player.jet = player.jetMax;
  floater(V3(playerPos().x, 1.2, playerPos().z), 'RESTORED', '#7bffae');
}

/* called every frame in play: god mode keeps the hero topped up, and the room's remotes drift */
export function updateSandbox(dt){
  if (!G.sandbox) return;
  updateBattle();
  if (G.sandboxGod){ player.hp = maxHp(); player.force = CFG.player.maxForce; }
  for (const r of shared.dojoRemotes || []){
    const b = r.userData.base, t = G.gt + r.userData.ph;
    r.position.set(b.x + Math.sin(t*0.4)*0.8, b.y + Math.sin(t*1.3)*0.25, b.z + Math.cos(t*0.33)*0.8);
    r.rotation.y += dt * 0.6;
  }
}
