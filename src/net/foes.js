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
import { checkUnlocks, startLevel, coopCampaignWave, coopCampaignCleared } from '../game/flow.js';
import { beginWave } from '../game/readout.js';
import { showBanner } from '../ui/banners.js';
import { MUSIC } from '../audio/music.js';
import { playerPos } from '../player/helpers.js';
import { missionSnap, coopMissionSync, endMission } from '../game/mission.js';
import { followChapter } from '../game/campaign.js';
import { damageBoss, bossStagger, bossStun, makeBossPuppet, dropBossPuppet } from '../boss/boss.js';
import { net, on, send, connected } from './session.js';
import { coopRun, hitQueue } from './run.js';
import { STANCES } from '../data/stances.js';

const DEAD = 1, WALKING = 2, WARBRINGER = 4;
let sentAt = 0, hostSent = false, runListeners = [];
const byNid = new Map();   // the guest's puppets, by the host's number for each foe

// what shared run this browser is hosting: 'e' Survival, 'c' the campaign (its chapters, waves or missions), 'm' a story mission, '' none (training, the sandbox)
export const runKind = () => G.endless ? 'e' : G.chapter >= 0 ? 'c' : G.mission ? 'm' : (!G.training && !G.sandbox) ? 'c' : '';
export const coopLive = () => !!G.coopGuest || (hostSent && connected());
export const puppetOf = (nid) => nid === 'B' ? shared.boss : byNid.get(nid) || null;
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
      u.weaponArm ? r2(u.weaponArm.rotation.z) : 0, u.staff ? r2(u.staff.rotation.x) : 0,   // (the weapon's other axis: which line a guard or block covers)
      e.form || '',   // a form master's form: its blade colour (game/mission.js)
      u.weaponArm ? r2(u.weaponArm.rotation.y) : 0, r2(e.cutDrop || 0), e.cutTwist != null ? r2(e.cutTwist) : null]);   // a duellist's cut: a low sweep's yaw, the hips' drop, the chest's turn (enemies/duel.js)
  }
  const bs = shared.boss, bu = bs && bs.group.userData;
  const boss = bs && !bs.net ? [r2(bs.group.position.x), r2(bs.group.position.y), r2(bs.group.position.z), r2(bs.group.rotation.y), r2(bs.group.rotation.x),
    Math.round(bs.hp), Math.round(bs.maxHp), bs.state, bs.phase, bs.kind, bs.enraged ? 1 : 0, bu.hand ? r2(bu.hand.rotation.z) : 0, bu.eyes ? r2(bu.eyes.scale.y) : 1,
    bu.bodyMat ? bu.bodyMat.emissive.getHex() : 0, bu.bodyMat ? r2(bu.bodyMat.emissiveIntensity) : 0,
    bs.hero && !bs.hero.local ? [r2(bs.hero.pos.x), r2(bs.hero.pos.z)] : [r2(playerPos().x), r2(playerPos().z)],
    bu.pivot ? r2(bu.pivot.rotation.x) : 0, bu.pivot ? r2(bu.pivot.rotation.z) : 0] : null;   // (his shoulder: the cut he's swinging, boss/boss.js bossCut)
  return { t: 'e', run: 1, boss, k: runKind(), ms: G.mission ? missionSnap() : undefined, lv: G.levelIdx, ch: G.chapter, a2: G.actTwo, wf: G.waveFrom, ar: G.arenaRot, w: G.endless ? G.endlessWave : G.wave, wt: G.waveTotal, ph: shared.levelPhase, mut: G.mut, list };
}

function hostTick(){
  const running = net.role === 'host' && connected() && !!runKind() && G.mode === 'play' && !G.coopGuest;
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
  for (const [id, dmg, kx, kz, kpow, fin, tick, shove] of m.h || []){
    if (id === 'B'){ if (shared.boss && !shared.boss.net) damageBoss(dmg, !!tick); continue; }   // the boss
    const e = enemies.find(o => o.nid === id);
    if (!e || e.dead) continue;
    damageEnemy(e, dmg, kx || kz ? V3(kx, 0, kz) : null, kpow, !!fin, !!tick, shove ? { shove } : undefined);
  }
});

// a control effect from the guest's powers (floored, thrown, staggered, frozen), put on the real foe
on('ctl', (m) => {
  if (net.role !== 'host') return;
  const e = enemies.find(o => o.nid === m.n);
  if (!e || e.dead || e.converted || e.state === 'spawn' || e.state === 'fade') return;
  if (!CTL[m.s] || (e.t.heavy && m.s !== 'recover' && m.s !== 'stagger')) return;
  e.state = m.s; e.st = m.st; e.heldAt = performance.now();
  if (m.v) e.vel.set(m.v[0], m.v[1], m.v[2]);
});

// a Force power or a parry on the guest's side opens the real boss up
on('bctl', (m) => {
  if (net.role !== 'host' || !shared.boss || shared.boss.net) return;
  if (m.k === 'stagger') bossStagger(); else if (m.k === 'stun') bossStun();
});
// where the guest is holding a foe in its Force grasp
on('gp', (m) => {
  if (net.role !== 'host') return;
  const e = enemies.find(o => o.nid === m.n);
  if (!e || e.dead || e.state !== 'grasped') return;
  e.group.position.set(m.p[0], m.p[1], m.p[2]); e.group.rotation.set(m.r[0], m.r[1], m.r[2]);
  e.vel.set(0, 0, 0); e.heldAt = performance.now();
});

/* ---------------- guest: puppets ---------------- */
function makePuppet(rec){
  const [nid, type, , , , , , , sc, hp, maxHp, state, flags, elite] = rec;
  const t = ENEMY_TYPES[type];
  if (!t) return null;
  const g = buildEnemyMesh(t);
  g.scale.setScalar(sc);
  if (elite) dressElite(g, elite);
  if (rec[20] && STANCES[rec[20]] && g.userData.bladeGlow) g.userData.bladeGlow.material.color.setHex(STANCES[rec[20]].blade);   // a form master's blade
  const e = { net: true, nid, type, t, group: g, hp, maxHp, state, st: 0, vel: V3(0, 0, 0), flash: 0, hitCd: 0, dead: false,
    netState: state, converted: false, convT: 0, struck: false, stumble: 0, burn: 0, flinch: 0, spd: t.speed, elite: elite || null, shieldHp: 0, shieldBroken: false,
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
  const [, , x, y, z, rx, ry, rz, sc, hp, maxHp, state, flags, , wA, sZ, em, ei, wZ, sX, , wY, drop, twist] = rec;
  e.group.scale.setScalar(sc);
  sendCtl(e);   // a control state put on it here since the last frame goes out before the snapshot overwrites it
  e.hp = hp; e.maxHp = maxHp; e.walking = !!(flags & WALKING);
  if (!e.held){   // a foe this player has in the Force grasp is theirs to place and pose until they let go
    e.want.pos.set(x, y, z); e.want.rx = rx; e.want.ry = ry; e.want.rz = rz;
    e.state = e.netState = state;
  }
  const dying = !!(flags & DEAD);
  if (dying && !e.dead) burst(e.group.position, 0x888888, 6, 4, 3);
  e.dead = dying;
  const u = e.group.userData;
  if (u.weaponArm){ u.weaponArm.rotation.x = wA; if (wZ != null) u.weaponArm.rotation.z = wZ; u.weaponArm.rotation.y = wY || 0; }
  e.cutDrop = drop || 0; e.cutTwist = twist ?? null;
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
  dropPuppets(); dropBossPuppet();
  if (G.mode === 'play'){ if (G.mission) endMission(); showBanner('', 'THE HOST LEFT THE FIGHT', 2.4); }
}

on('e', (m) => {
  if (net.role !== 'guest') return;
  if (!m.run){
    const was = coopRun.on; coopRun.on = false;
    if (was) runChanged();
    G.coopWasGuest = false;   // the host's run is over: nothing to go back to
    endGuest();
    return;
  }
  const ch = m.ch ?? -1;
  const changed = !coopRun.on || coopRun.w !== m.w || coopRun.ar !== m.ar || coopRun.k !== m.k || coopRun.lv !== m.lv || coopRun.ch !== ch || coopRun.mid !== (m.ms ? m.ms.id : '');
  Object.assign(coopRun, { on: true, k: m.k || 'e', mid: m.ms ? m.ms.id : '', lv: m.lv || 0, ch, a2: m.a2 || null, wf: m.wf || 0, ar: m.ar, w: m.w, wt: m.wt, ph: m.ph, mut: m.mut });
  if (changed) runChanged();
  // this guest fell out of the shared fight without the host's run ending (died and retried, restarted): it was playing its
  // own foes and waves. Back in: its own foes go, and the host's take their place
  if (!G.coopGuest && G.coopWasGuest && G.mode === 'play' && (m.k === 'e' ? G.endless : m.k === 'c' ? !G.endless && !G.mission && !G.training && !G.sandbox : false)){
    for (const e of enemies) removeEnemy(e);
    enemies.length = 0; byNid.clear(); G.spawnQueue.length = 0;
    G.coopGuest = true;
    showBanner('', 'BACK IN THE HOST\'S FIGHT', 2.0);
  }
  if (!G.coopGuest || G.mode === 'menu') return;

  if (m.k === 'm'){   // a story mission: the host runs its objectives, this browser is shown them
    if (!G.mission || !m.ms || G.missionId !== m.ms.id){ endGuest(); return; }
    coopMissionSync(m.ms);
  } else if (m.k === 'c'){   // the campaign: the host's chapter (a stretch of a level's waves, or a mission), or its level and wave
    if (G.endless || (G.mission && G.chapter < 0)){ endGuest(); return; }
    if (ch >= 0){
      if (G.chapter !== ch){ dropPuppets(); followChapter(ch, m.a2); }
    } else if (G.levelIdx !== m.lv || G.chapter >= 0){ dropPuppets(); startLevel(m.lv, { resume: true }); G.coopGuest = true; showBanner('', 'THE HOST MOVES ON', 1.6); }
    if (G.mission){ if (m.ms) coopMissionSync(m.ms); }   // a mission chapter: shown the host's objectives
    else if (m.ph === 'fighting' && (shared.levelPhase !== 'fighting' || G.wave !== m.w)) coopCampaignWave(m.w, m.wt);
    else if (m.ph === 'between' && shared.levelPhase === 'fighting') coopCampaignCleared();
    else if (m.ph === 'bossfight' && shared.levelPhase !== 'bossfight'){ shared.levelPhase = 'bossfight'; showBanner('', 'THE HOST FACES THE BOSS', 2.4); }
  } else {
  if (G.mission){ endGuest(); return; }
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
  }

  // the boss
  if (m.boss){
    const r = m.boss;
    let b = shared.boss;
    if (!b || !b.net) b = makeBossPuppet(r[9], r[5], r[6]);
    b.want.pos.set(r[0], r[1], r[2]); b.want.ry = r[3]; b.want.rx = r[4];
    b.hp = r[5]; b.maxHp = r[6]; b.state = r[7]; b.phase = r[8]; b.enraged = !!r[10]; b.hand = r[11]; b.eyes = r[12]; b.em = r[13]; b.ei = r[14]; b.tp = r[15]; b.piv = r[16] != null ? [r[16], r[17]] : null;
  } else if (shared.boss && shared.boss.net) dropBossPuppet();

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

const CTL = { knockdown: 1, ragdoll: 1, stagger: 1, recover: 1, stasis: 1, grasped: 1 };   // the states a guest's powers put a foe in
const NO_FEET = { ragdoll: 1, knockdown: 1, getup: 1, fade: 1, spawn: 1, grasped: 1 };   // the states the legs don't stand in (enemies/ai.js)
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// a Force power or a blow here put the puppet into a control state (floored, thrown, stunned, frozen): tell the host,
// which applies it to the real foe. The next snapshot then carries the result back.
function sendCtl(e){
  // held in this player's grasp: they move the body (player/jedi/grasp.js), and the host is told where it is
  if (e.state === 'grasped' && e.netState !== 'grasped') e.held = true;
  if (e.held){
    if (e.state !== 'grasped') e.held = false;
    else if (connected() && performance.now() - (e.heldSent || 0) >= NET.sendMs){
      e.heldSent = performance.now();
      const gp = e.group.position, gr = e.group.rotation;
      send({ t: 'gp', n: e.nid, p: [r2(gp.x), r2(gp.y), r2(gp.z)], r: [r2(gr.x), r2(gr.y), r2(gr.z)] });
    }
  }
  if (e.state === e.netState) return;
  if (CTL[e.state] && !e.dead && connected()) send({ t: 'ctl', n: e.nid, s: e.state, st: r2(e.st || 0), v: [r2(e.vel.x), r2(e.vel.y), r2(e.vel.z)] });
  e.netState = e.state;
}
/* the guest's stand-in for updateEnemies: follow the snapshot, and walk the legs on the motion that results */
export function updatePuppets(dt){
  for (const e of enemies){
    if (!e.net) continue;
    sendCtl(e);   // a power or a blow here put it in a control state: the host applies it to the real foe
    const g = e.group, w = e.want;
    // the marksman's beam and the lancer's line fade when the host stops sending them
    if (e.aimLine && performance.now() - (e.aimAt || 0) > 200) e.aimLine.visible = false;
    if (e.lungeLine && e.lungeLine.visible && performance.now() - (e.lungeAt || 0) > 200){
      e.lungeLine.material.opacity = Math.max(0, e.lungeLine.material.opacity - dt * 3);
      if (e.lungeLine.material.opacity <= 0) e.lungeLine.visible = false;
    }
    if (e.held){ updateLegs(e, g, dt, 'off'); continue; }   // the grasp moves it
    g.position.x = damp(g.position.x, w.pos.x, 20, dt);
    g.position.y = damp(g.position.y, w.pos.y, 20, dt);
    g.position.z = damp(g.position.z, w.pos.z, 20, dt);
    g.rotation.x += angDiff(g.rotation.x, w.rx) * (1 - Math.exp(-20 * dt));   // the short way round (an Ataru master's backflip wraps)
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
let pickSent = false, waitShown = false;
export function updateFoes(){
  hostTick();
  coopRun.live = coopLive();
  if (net.role === 'guest' && connected()){   // tell the host while the upgrade screen is open (the next wave waits for it)
    const open = !!(G.coopGuest && G.skillSelect);
    if (open !== pickSent){ pickSent = open; send({ t: 'pick', o: open ? 1 : 0 }); }
  } else pickSent = false;
  if (net.role === 'host'){
    // a grasp whose holder went quiet (left, froze) lets go
    for (const e of enemies){
      if (e.state !== 'grasped'){ e.heldAt = null; continue; }   // (this host's own grasps carry no stamp: they are never let go here)
      if (e.heldAt != null && !e.dead && performance.now() - e.heldAt > 1500){ e.state = 'knockdown'; e.st = 0.5; e.heldAt = null; }
    }
    const waiting = coopRun.live && coopRun.guestPicking && shared.levelPhase === 'between' && !G.skillSelect;
    if (waiting && !waitShown) showBanner('', 'WAITING FOR YOUR PARTNER\'S UPGRADES', 2.4);
    waitShown = waiting;
  }
  if (net.role === 'guest' && connected() && hitQueue.length){
    const now = performance.now();
    if (now - sentAt >= NET.sendMs){ sentAt = now; send({ t: 'hits', h: hitQueue.splice(0) }); }
  } else if (!connected()) hitQueue.length = 0;
}

on('pick', (m) => { if (net.role === 'host') coopRun.guestPicking = !!m.o; });

on('status', (n) => {
  if (n.status === 'connected') return;
  coopRun.on = false; coopRun.guestPicking = false; coopRun.live = false; G.coopWasGuest = false; runChanged();
  if (G.coopGuest) endGuest();
  hostSent = false;
});
