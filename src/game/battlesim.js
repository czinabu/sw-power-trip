// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BATTLE SIMULATOR — the sandbox as a battle you set up and then fight. The setup holds the sim still under an overhead
// view of the map (engine/camera.js reads shared.planCam): put foes (any the panel can call in, bosses too), squadmates
// and yourself where you want them, press START, and it plays out. The setup is kept, so the battle can be replayed or
// changed, and saved to one of three slots. ui/battlesim-ui.js is the screen and its controls; data/battlesim.js the
// tuning and the palette.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { shared, G, enemies, player, bolts, isGunner, heroKey } from '../state.js';
import { CFG } from '../data/config.js';
import { playerPos, maxHp, maxStam } from '../player/helpers.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { findClearSpawn } from '../world/collision.js';
import { fadeOverhead } from '../world/camblock.js';
import { spawnBoss } from '../boss/boss.js';
import { spawnChampion } from './survival.js';
import { showBanner } from '../ui/banners.js';
import { clearGrenades } from '../enemies/grenades.js';
import { allies, addSquadmate, removeSquadmate, clearSquad } from '../allies/squad.js';
import { clearDowned } from './revive.js';
import { restartReadout } from './readout.js';
import { SB, sandboxClear, placeHero, setSandboxMap } from './sandbox.js';
import { foeOffered, mapOffered } from './sandbox-unlocks.js';
import { BATTLE_SIM, battlePalette } from '../data/battlesim.js';
import { BATTLE_MAPS } from '../data/battlemaps.js';

/* the setup: `plan` is what's been placed ({ kind: 'foe' | 'ally', id, x, z, elite }, each with `ref`, the unit standing
   for it now), `hero` where you start ({ x, z } or null: the map's own start). `pick` is the palette entry in hand.
   armed: a battle has been started from this setup, so it can be replayed · live: it's being fought · won: its foes are
   all down */
export const BS = { open: false, plan: [], hero: null, pick: 0, armed: false, live: false, won: false, hadFoes: false };
export const palette = () => battlePalette(G.hero);
export const pickable = (p) => p.kind !== 'foe' || foeOffered(p.id);
export const unitName = (p) => typeof p.nm === 'object' ? heroKey(p.nm) : p.nm;

/* ---------- the overhead view (engine/camera.js poses the lens from this while G.sbPlan is up) ---------- */
const cam = shared.planCam = { x: 0, z: 0, h: 30, yaw: 0, pitch: BATTLE_SIM.cam.pitch };
const halfX = () => shared.arenaHalf, halfZ = () => shared.arenaHalfZ || shared.arenaHalf;
export const camFar = () => Math.max(BATTLE_SIM.cam.near * 2, Math.max(halfX(), halfZ()) * 2 * BATTLE_SIM.cam.farMul);
export function panCam(right, fwd){
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -fz, rz = fx;
  cam.x = Math.max(-halfX(), Math.min(halfX(), cam.x + rx * right + fx * fwd));
  cam.z = Math.max(-halfZ(), Math.min(halfZ(), cam.z + rz * right + fz * fwd));
}
export function zoomCam(k){ cam.h = Math.max(BATTLE_SIM.cam.near, Math.min(camFar(), cam.h * k)); }
export function turnCam(a){ cam.yaw += a; }
// the lens's ground point under a screen position (NDC, -1..1), or null when it points at the sky
const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
export function groundAt(camera, nx, ny){
  camera.updateMatrixWorld();
  _ray.setFromCamera({ x: nx, y: ny }, camera);
  return _ray.ray.intersectPlane(_plane, _hit) ? { x: _hit.x, z: _hit.z } : null;
}

/* ---------- the marks: a ring under everything placed (red foes, blue squad, gold you) and the cursor ---------- */
const marks = new THREE.Group(); marks.visible = false; scene.add(marks);
const ringGeo = new THREE.RingGeometry(0.85, 1.15, 36);
const ringMat = (c, o = 0.85) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
const MAT = { foe: ringMat(BATTLE_SIM.colors.foe), ally: ringMat(BATTLE_SIM.colors.ally), hero: ringMat(BATTLE_SIM.colors.hero) };
const cursor = new THREE.Mesh(ringGeo, ringMat(0xffffff, 0.9)); cursor.rotation.x = -Math.PI / 2; cursor.renderOrder = 5;
scene.add(cursor); cursor.visible = false;
function ring(kind, x, z, s){
  const m = new THREE.Mesh(ringGeo, MAT[kind]); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.07, z); m.scale.setScalar(s); m.renderOrder = 4;
  marks.add(m);
}
const unitPos = (u) => u.ref && u.ref.group ? u.ref.group.position : u;
const bigOf = (u) => u.id === 'boss' ? 2 : u.id === 'warbringer' ? 2.2 : u.id === 'brute' ? 1.4 : 1;
// rebuilt whenever the setup changes; the rings grow with the lens's height so they read from high up
export function refreshMarks(){
  while (marks.children.length) marks.remove(marks.children[0]);
  const s = Math.max(1, cam.h / 32);
  for (const u of BS.plan){ const p = unitPos(u); ring(u.kind, p.x, p.z, s * bigOf(u)); }
  const pp = playerPos(); ring('hero', pp.x, pp.z, s * 1.2);
}
// the cursor ring at a ground point, tinted by what's in hand (null hides it)
export function showCursor(at){
  cursor.visible = !!at && BS.open;
  if (!cursor.visible) return;
  const p = palette()[BS.pick] || {}, s = Math.max(1, cam.h / 32) * (SB.count > 1 && p.kind !== 'hero' && p.id !== 'boss' ? 1.8 : 1);
  cursor.material.color.setHex(BATTLE_SIM.colors[p.kind] || 0xffffff);
  cursor.position.set(at.x, 0.09, at.z); cursor.scale.setScalar(s);
}

/* ---------- putting units down ---------- */
const lim = (x, h) => Math.max(-h + 2, Math.min(h - 2, x));
function faceToward(g, x, z){ const p = g.position; if (Math.hypot(x - p.x, z - p.z) > 0.1) g.rotation.y = Math.atan2(x - p.x, z - p.z); }
// where each side stands, on average (each faces the other)
function centre(kind){
  let x = 0, z = 0, n = 0;
  for (const u of BS.plan) if (u.kind === kind){ const p = unitPos(u); x += p.x; z += p.z; n++; }
  if (kind === 'ally'){ const pp = playerPos(); x += pp.x; z += pp.z; n++; }
  return n ? { x: x / n, z: z / n } : null;
}
// stand the unit for one entry of the setup up on the floor
function spawnUnit(u){
  u.ref = null;
  if (u.kind === 'ally'){
    const a = addSquadmate({ x: u.x, z: u.z }, { role: u.id, cap: BATTLE_SIM.maxAllies });
    if (!a) return false;
    a.group.position.set(u.x, 0, u.z);
    a.ord = { kind: 'hold', at: V3(u.x, 0, u.z) }; a.prevOrd = null;   // they hold where you put them until you give an order (H)
    a.tag.position.set(u.x, 2.75 * a.t.scale, u.z);
    u.ref = a; return true;
  }
  if (!foeOffered(u.id)) return false;
  if (u.id === 'boss'){
    if (shared.boss) return false;
    spawnBoss();
    if (!shared.boss) return false;
    shared.boss.group.position.set(u.x, 0, u.z);
    u.ref = shared.boss; return true;
  }
  G.forceElite = !!u.elite;
  if (u.id === 'warbringer') spawnChampion();
  else spawnEnemy(u.id, V3(u.x, 0, u.z));
  G.forceElite = false;
  const e = enemies[enemies.length - 1];
  if (!e) return false;
  e.group.position.set(u.x, 0, u.z);
  e.st = 0;   // up out of the ground at once: no rise when the fight starts
  e.home = { x: u.x, z: u.z }; e.dummy = SB.dummy;
  u.ref = e; return true;
}
function faceSides(){
  const f = centre('foe'), a = centre('ally');
  for (const u of BS.plan){
    const o = u.kind === 'foe' ? a : f;
    if (o && u.ref && u.ref.group) faceToward(u.ref.group, o.x, o.z);
  }
  if (f){ const pp = playerPos(); G.yaw = player.faceYaw = Math.atan2(f.x - pp.x, f.z - pp.z); }
}
function putHero(){
  if (!BS.hero){ placeHero(); return; }
  const s = findClearSpawn(BS.hero.x, BS.hero.z, CFG.player.radius + 1.0);
  playerPos().set(s.x, 0, s.z);
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
}
// the floor exactly as set up: everyone back where they were put, at full health, you included
export function rebuild(){
  sandboxClear();
  for (const b of bolts) scene.remove(b.mesh); bolts.length = 0;
  clearGrenades();
  clearDowned(); clearSquad();
  putHero();
  BS.plan = BS.plan.filter(spawnUnit);
  player.hp = maxHp(); player.force = CFG.player.maxForce; player.stam = maxStam();
  if (isGunner()) player.jet = player.jetMax;
  faceSides();
  BS.live = false; BS.won = false;
  refreshMarks();
}
// the units already on the floor become the setup (the first time the setup opens: what the panel called in stays)
function adoptFloor(){
  for (const e of enemies) if (!e.dead && !e.converted)
    BS.plan.push({ kind: 'foe', id: e.warbringer ? 'warbringer' : e.type, x: e.group.position.x, z: e.group.position.z, elite: !!e.elite });
  if (shared.boss && shared.boss.hp > 0) BS.plan.push({ kind: 'foe', id: 'boss', x: shared.boss.group.position.x, z: shared.boss.group.position.z });
  for (const a of allies) if (!a.net) BS.plan.push({ kind: 'ally', id: a.def.role, x: a.group.position.x, z: a.group.position.z });
  if (BS.plan.length){ const pp = playerPos(); BS.hero = { x: pp.x, z: pp.z }; }
}
export const counts = () => ({ foes: BS.plan.filter(u => u.kind === 'foe').length, allies: BS.plan.filter(u => u.kind === 'ally').length });

// place what's in hand at a ground point: you move there; a boss moves if one is placed already; ×3 / ×5 put a small group
export function placeAt(x, z){
  const p = palette()[BS.pick];
  if (!p || !pickable(p)) return false;
  x = lim(x, halfX()); z = lim(z, halfZ());
  if (p.kind === 'hero'){ BS.hero = { x, z }; putHero(); faceSides(); refreshMarks(); return true; }
  if (p.id === 'boss'){
    const had = BS.plan.find(u => u.id === 'boss');
    if (had){ had.x = x; had.z = z; if (had.ref) had.ref.group.position.set(x, 0, z); faceSides(); refreshMarks(); return true; }
  }
  const n = p.id === 'boss' ? 1 : SB.count;
  let placed = 0;
  for (let i = 0; i < n; i++){
    if (BS.plan.length >= BATTLE_SIM.maxUnits){ showBanner('', 'THAT IS AS BIG AS A BATTLE GETS', 1.2); break; }
    if (p.kind === 'ally' && allies.length >= BATTLE_SIM.maxAllies){ showBanner('', 'UP TO ' + BATTLE_SIM.maxAllies + ' SQUADMATES', 1.2); break; }
    const a = i ? (i - 1) / (n - 1) * Math.PI * 2 + cam.yaw : 0, r = i ? BATTLE_SIM.spread : 0;
    const s = findClearSpawn(lim(x + Math.sin(a) * r, halfX()), lim(z + Math.cos(a) * r, halfZ()), 0.9);
    const u = { kind: p.kind, id: p.id, x: s.x, z: s.z, elite: p.kind === 'foe' && SB.elite };
    if (spawnUnit(u)){ BS.plan.push(u); placed++; }
  }
  faceSides(); refreshMarks();
  return placed > 0;
}
// the placed unit nearest a ground point, within reach of it (or -1)
export function unitAt(x, z){
  let best = -1, bd = BATTLE_SIM.removeR * Math.max(1, cam.h / 40);
  BS.plan.forEach((u, i) => { const p = unitPos(u), d = Math.hypot(p.x - x, p.z - z) / bigOf(u); if (d < bd){ bd = d; best = i; } });
  return best;
}
function dropUnit(i){
  const u = BS.plan[i]; if (!u) return;
  BS.plan.splice(i, 1);
  const r = u.ref;
  if (!r) return;
  if (u.kind === 'ally') removeSquadmate(r);
  else if (r === shared.boss){
    scene.remove(r.group); shared.boss = null;
    if (shared.bossLight) shared.bossLight.visible = false;
    document.getElementById('bosswrap').style.display = 'none';
  } else { removeEnemy(r); const k = enemies.indexOf(r); if (k >= 0) enemies.splice(k, 1); }
}
export function removeAt(x, z){ const i = unitAt(x, z); if (i < 0) return false; dropUnit(i); faceSides(); refreshMarks(); return true; }
export function undoLast(){ if (!BS.plan.length) return false; dropUnit(BS.plan.length - 1); faceSides(); refreshMarks(); return true; }
export function clearSetup(){ BS.plan = []; BS.hero = null; BS.armed = false; rebuild(); }

/* ---------- open, start, replay ---------- */
let fogWas = null;
export function battleSetupOpen(){ return BS.open; }
// hold the sim still and lift the view over the map, with the floor as set up (a battle that's been fought is reset)
export function enterSetup(){
  if (!G.sandbox || G.mode !== 'play' || G.coopGuest) return false;
  if (!BS.plan.length && !BS.hero) adoptFloor();
  rebuild();
  const pp = playerPos();
  cam.x = pp.x; cam.z = pp.z; cam.yaw = G.yaw;
  cam.h = Math.max(BATTLE_SIM.cam.near * 1.6, camFar() * BATTLE_SIM.cam.startMul);
  if (scene.fog && !fogWas){ fogWas = { near: scene.fog.near, far: scene.fog.far }; scene.fog.near *= BATTLE_SIM.cam.fogMul; scene.fog.far *= BATTLE_SIM.cam.fogMul; }
  BS.open = true; G.sbPlan = true; G.skillSelect = true;   // (skillSelect freezes the sim and keeps the pause screen away while the cursor is free)
  marks.visible = true; refreshMarks();
  fadeOverhead();   // rafters and roofs out of the way of the view from above
  document.body.classList.add('bsplan');
  return true;
}
// put the overhead view away (the setup stays as it is): `freeze` keeps the sim held (the sandbox panel opens over it)
export function leaveSetup(freeze){
  if (!BS.open) return;
  BS.open = false; G.sbPlan = false; G.skillSelect = !!freeze;
  marks.visible = false; cursor.visible = false;
  if (scene.fog && fogWas){ scene.fog.near = fogWas.near; scene.fog.far = fogWas.far; }
  fogWas = null;
  document.body.classList.remove('bsplan');
  if (BS.plan.length) armBattle();
}
function armBattle(){
  BS.armed = true; BS.live = true; BS.won = false;
  BS.hadFoes = BS.plan.some(u => u.kind === 'foe');
  restartReadout();   // the combat readout counts this battle
}
// START from the setup: the view drops back to the hero and the battle is on
export function startBattle(){
  if (!BS.open) return false;
  leaveSetup(false);
  const c = counts();
  showBanner('THE BATTLE IS ON', c.foes + (c.foes === 1 ? ' FOE' : ' FOES') + (c.allies ? ' · ' + c.allies + ' AT YOUR SIDE' : '') + ' · B to replay or change it', 2.4);
  return true;
}
// REPLAY: everyone back where they were put, and straight into it
export function replayBattle(){
  if (!BS.armed || !G.sandbox) return false;
  rebuild(); armBattle();
  showBanner('REPLAY', 'Everyone back where they started', 1.6);
  return true;
}
// a fresh map: the setup was for the old one
export function battleMapChanged(){ BS.plan = []; BS.hero = null; BS.armed = false; BS.live = false; }
// the sandbox starting over (the fallen screen's REPLAY THE BATTLE): back into the battle as it was set up
export function battleAfterRestart(replay){
  if (replay && BS.armed && BS.plan.length) replayBattle();
  else { BS.armed = false; BS.live = false; }
}
export const battleArmed = () => BS.armed && BS.plan.length > 0;

// every frame in play: a battle whose foes are all down is won
export function updateBattle(){
  if (!BS.live || BS.won || !G.sandbox || !BS.hadFoes) return;
  if (enemies.some(e => !e.dead && !e.converted) || shared.boss) return;
  BS.won = true; BS.live = false;
  showBanner('VICTORY', 'Every foe is down · B to replay the battle or set up another', 3.5);
}

/* ---------- saved setups: three slots, any hero (each remembers its map) ---------- */
const SAVE_KEY = 'sw_battle_setups';
export function savedSetups(){
  let v = null; try { v = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch(e){}
  return Array.from({ length: BATTLE_SIM.slots }, (_, i) => (Array.isArray(v) && v[i] && Array.isArray(v[i].units)) ? v[i] : null);
}
export function saveSetup(i){
  if (!BS.plan.length) return false;
  const all = savedSetups();
  const r = (n) => Math.round(n * 10) / 10;
  all[i] = { map: SB.map, hero: BS.hero && { x: r(BS.hero.x), z: r(BS.hero.z) },
             units: BS.plan.map(u => { const p = unitPos(u); return { k: u.kind, id: u.id, x: r(p.x), z: r(p.z), e: u.elite ? 1 : 0 }; }) };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(all)); } catch(e){ return false; }
  return true;
}
export function loadSetup(i){
  const s = savedSetups()[i];
  if (!s || !G.sandbox) return false;
  const map = s.map === 'room' || BATTLE_MAPS[s.map] ? s.map : 'room';
  if (!mapOffered(map)) return false;
  if (map !== SB.map) setSandboxMap(map);
  BS.plan = s.units.filter(u => (u.k === 'foe' || u.k === 'ally') && typeof u.x === 'number' && typeof u.z === 'number')
    .map(u => ({ kind: u.k, id: u.id, x: u.x, z: u.z, elite: !!u.e }));
  BS.hero = s.hero && typeof s.hero.x === 'number' ? { x: s.hero.x, z: s.hero.z } : null;
  rebuild();
  BS.armed = BS.plan.length > 0;
  return true;
}
