// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The shared Survival fight, co-op phase 2. The HOST's browser owns the foes: it spawns them, runs their AI and the waves,
// and sends where every foe is about 20 times a second (a snapshot). The GUEST's browser draws them as puppets (`e.net`)
// that follow the snapshot and run no AI. What the guest does to a foe is sent back as a hit, which the host applies with
// its own damageEnemy. Foes hurting the guest, their shots and tells are net/foefire.js. Not here yet: shared XP.

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { shared, G, enemies } from '../state.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { NET } from '../data/coop.js';
import { V3, clamp } from '../utils.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { dressElite } from '../enemies/elites.js';
import { damageEnemy } from '../enemies/damage.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { makeBossBar } from '../enemies/spawn.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { burst } from '../fx/particles.js';
import { ENDLESS_ARENAS, rotateEndlessArena, endlessWaveCleared } from '../game/survival.js';
import { checkUnlocks } from '../game/flow.js';
import { beginWave } from '../game/readout.js';
import { showBanner } from '../ui/banners.js';
import { MUSIC } from '../audio/music.js';
import { net, on, send, connected } from './session.js';
import { coopRun, hitQueue } from './run.js';

const DEAD = 1, WALKING = 2, WARBRINGER = 4;
let sentAt = 0, hostSent = false, runListeners = [];
const byNid = new Map();   // the guest's puppets, by the host's number for each foe

export const puppetOf = (nid) => byNid.get(nid) || null;
export function onRunChange(fn){ runListeners.push(fn); }
const runChanged = () => { for (const fn of runListeners) fn(coopRun); };

const r2 = (n) => Math.round(n * 100) / 100;

/* ---------------- host: send the foes ---------------- */
function snapshot(){
  const list = [];
  for (const e of enemies){
    const g = e.group, u = g.userData;
    list.push([e.nid, e.type, r2(g.position.x), r2(g.position.y), r2(g.position.z), r2(g.rotation.x), r2(g.rotation.y), r2(g.rotation.z),
      r2(g.scale.x), Math.round(e.hp), Math.round(e.maxHp), e.state,
      (e.dead ? DEAD : 0) | (e.walking ? WALKING : 0) | (e.warbringer ? WARBRINGER : 0), e.elite || '',
      u.weaponArm ? r2(u.weaponArm.rotation.x) : 0, u.staff ? r2(u.staff.rotation.z) : 0,
      u.bodyMat ? u.bodyMat.emissive.getHex() : 0, u.bodyMat ? r2(u.bodyMat.emissiveIntensity) : 0,
      u.weaponArm ? r2(u.weaponArm.rotation.z) : 0, u.staff ? r2(u.staff.rotation.x) : 0]);   // (the weapon's other axis: which line a guard or block covers)
  }
  return { t: 'e', run: 1, ar: G.arenaRot, w: G.endlessWave, wt: G.waveTotal, ph: shared.levelPhase, mut: G.mut, list };
}

function hostTick(){
  const running = net.role === 'host' && connected() && G.endless && G.mode === 'play' && !G.coopGuest;
  if (!running){
    if (hostSent && connected()){ send({ t: 'e', run: 0 }); }
    hostSent = false;
    return;
  }
  const now = performance.now();
  if (now - sentAt < NET.sendMs) return;
  sentAt = now; hostSent = true;
  send(snapshot());
}

// the guest's blows, applied here exactly as if this browser's hero had struck them
on('hits', (m) => {
  if (net.role !== 'host') return;
  for (const [id, dmg, kx, kz, kpow, fin, tick] of m.h || []){
    const e = enemies.find(o => o.nid === id);
    if (!e || e.dead) continue;
    damageEnemy(e, dmg, kx || kz ? V3(kx, 0, kz) : null, kpow, !!fin, !!tick);
  }
});

/* ---------------- guest: puppets ---------------- */
function makePuppet(rec){
  const [nid, type, , , , , , , sc, hp, maxHp, state, flags, elite] = rec;
  const t = ENEMY_TYPES[type];
  if (!t) return null;
  const g = buildEnemyMesh(t);
  g.scale.setScalar(sc);
  if (elite) dressElite(g, elite);
  const e = { net: true, nid, type, t, group: g, hp, maxHp, state, st: 0, vel: V3(0, 0, 0), flash: 0, hitCd: 0, dead: false,
    converted: false, convT: 0, struck: false, stumble: 0, burn: 0, flinch: 0, spd: t.speed, elite: elite || null, shieldHp: 0, shieldBroken: false,
    aimLine: null, want: { pos: V3(rec[2], rec[3], rec[4]), rx: rec[5], ry: rec[6], rz: rec[7] } };
  g.position.set(rec[2], rec[3], rec[4]);
  if (flags & WARBRINGER){
    e.warbringer = e.champion = true;
    g.userData.bodyMat.color.lerp(new THREE.Color(0xff2a2a), 0.4);   // the crimson cast
    makeBossBar(e);
  }
  scene.add(g);
  enemies.push(e);
  return e;
}

function applyRec(e, rec){
  const [, , x, y, z, rx, ry, rz, sc, hp, maxHp, state, flags, , wA, sZ, em, ei, wZ, sX] = rec;
  e.want.pos.set(x, y, z); e.want.rx = rx; e.want.ry = ry; e.want.rz = rz;
  e.group.scale.setScalar(sc);
  e.hp = hp; e.maxHp = maxHp; e.state = state; e.walking = !!(flags & WALKING);
  const dying = !!(flags & DEAD);
  if (dying && !e.dead) burst(e.group.position, 0x888888, 6, 4, 3);
  e.dead = dying;
  const u = e.group.userData;
  if (u.weaponArm){ u.weaponArm.rotation.x = wA; if (wZ != null) u.weaponArm.rotation.z = wZ; }
  if (u.staff){ u.staff.rotation.z = sZ; if (sX != null) u.staff.rotation.x = sX; }
  if (u.bodyMat){ u.bodyMat.emissive.setHex(em); u.bodyMat.emissiveIntensity = ei; }
}

function dropPuppets(){
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].net){ removeEnemy(enemies[i]); enemies.splice(i, 1); }
  byNid.clear();
}

function endGuest(){
  if (!G.coopGuest) return;
  G.coopGuest = false;   // the run carries on here by itself: this browser's own waves take over
  dropPuppets();
  showBanner('', 'THE HOST LEFT THE FIGHT', 2.4);
}

on('e', (m) => {
  if (net.role !== 'guest') return;
  if (!m.run){
    const was = coopRun.on; coopRun.on = false;
    if (was) runChanged();
    endGuest();
    return;
  }
  const changed = !coopRun.on || coopRun.w !== m.w || coopRun.ar !== m.ar;
  Object.assign(coopRun, { on: true, ar: m.ar, w: m.w, wt: m.wt, ph: m.ph, mut: m.mut });
  if (changed) runChanged();
  if (!G.coopGuest || G.mode === 'menu') return;

  // the host's arena and wave: follow them
  if (G.arenaRot !== m.ar){
    dropPuppets();
    G.arenaRot = m.ar; rotateEndlessArena(ENDLESS_ARENAS[m.ar]);
  }
  G.mut = m.mut;
  if (G.endlessWave !== m.w){
    G.endlessWave = m.w; G.waveTotal = m.wt;
    shared.levelPhase = 'fighting'; G.waveHits = 0; G.waveDmg = 0;
    beginWave('WAVE ' + m.w);
    checkUnlocks(1600);
    showBanner('', 'WAVE ' + m.w, 1.6);
    MUSIC.waveSting();
  } else if (m.ph === 'between' && shared.levelPhase === 'fighting'){
    endlessWaveCleared();   // pays this browser's own clear bonus and opens its own upgrade screen
  }

  // the foes
  const seen = new Set();
  for (const rec of m.list){
    seen.add(rec[0]);
    let e = byNid.get(rec[0]);
    if (!e){ e = makePuppet(rec); if (!e) continue; byNid.set(rec[0], e); }
    applyRec(e, rec);
  }
  for (const [nid, e] of byNid){
    if (seen.has(nid)) continue;
    const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
    removeEnemy(e); byNid.delete(nid);
  }
});

const NO_FEET = { ragdoll: 1, knockdown: 1, getup: 1, fade: 1, spawn: 1, grasped: 1 };   // the states the legs don't stand in (enemies/ai.js)
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/* the guest's stand-in for updateEnemies: follow the snapshot, and walk the legs on the motion that results */
export function updatePuppets(dt){
  for (const e of enemies){
    if (!e.net) continue;
    const g = e.group, w = e.want;
    g.position.x = damp(g.position.x, w.pos.x, 20, dt);
    g.position.y = damp(g.position.y, w.pos.y, 20, dt);
    g.position.z = damp(g.position.z, w.pos.z, 20, dt);
    g.rotation.x = damp(g.rotation.x, w.rx, 20, dt);
    g.rotation.z = damp(g.rotation.z, w.rz, 20, dt);
    g.rotation.y += angDiff(g.rotation.y, w.ry) * (1 - Math.exp(-20 * dt));
    if (g.userData.eliteRing) g.userData.eliteRing.rotation.z += dt * 2.5;
    if (e.hpBar){
      e.hpBar.visible = !e.dead && e.state !== 'fade';
      if (e.hpBar.visible){
        e.hpBar.position.set(g.position.x, g.position.y + 2.7 * g.scale.x, g.position.z);
        e.hpBar.quaternion.copy(camera.quaternion);
        const frac = clamp(e.hp / (e.maxHp || e.hp), 0, 1);
        e.hpBarFill.scale.x = Math.max(0.001, frac);
        e.hpBarFill.position.x = -(1 - frac) * 1.13;
        e.hpBarFill.material.color.setHex(frac > 0.5 ? 0xff3b3b : frac > 0.22 ? 0xff8a2a : 0xffd24a);
      }
    }
    updateLegs(e, g, dt, e.dead || NO_FEET[e.state] ? 'off' : (e.t.fly || e.state === 'leap') ? 'air' : e.walking ? 'walk' : 'ground');
    updateUpper(e, g, dt, null, e.dead || NO_FEET[e.state] ? 'off' : 'on');   // breath, glances, the wind-up twist (enemies/upper.js)
  }
}

/* ---------------- both: once a frame ---------------- */
export function updateFoes(){
  hostTick();
  if (net.role === 'guest' && connected() && hitQueue.length){
    const now = performance.now();
    if (now - sentAt >= NET.sendMs){ sentAt = now; send({ t: 'hits', h: hitQueue.splice(0) }); }
  } else if (!connected()) hitQueue.length = 0;
}

on('status', (n) => {
  if (n.status === 'connected') return;
  coopRun.on = false; runChanged();
  if (G.coopGuest) endGuest();
  hostSent = false;
});
