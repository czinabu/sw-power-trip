// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY MISSIONS: runs a mission (data/missions.js) objective by objective: hold a spot, slice consoles, win a duel.
// Built from the objective kit (game/objectives.js) so later modes can reuse the same pieces.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, player } from '../state.js';
import { CFG } from '../data/config.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { spawnEnemy, makeBossBar } from '../enemies/spawn.js';
import { cleanupDuel } from '../enemies/duel.js';
import { cleanupTactics } from '../enemies/tactics.js';
import { findClearSpawn } from '../world/collision.js';
import { startLevel, queueSpawn, checkUnlocks } from './flow.js';
import { endRun } from './summary.js';
import { showBanner } from '../ui/banners.js';
import { overlay, setOverlayState } from '../ui/menus.js';
import { showPanel, hidePanel, makeBeacon, makeConsole, setMarkerColor, pulseMarker, removeMarker,
         heroIn, hostilesIn, hostilesAlive, setObjectiveHud, mmss } from './objectives.js';
import { MISSIONS, MISSION_VOICE, MISSION_COLOR } from '../data/missions.js';

const RED = 0xff4a3a, GREEN = 0x7bffae;
const M = { on: false, def: null, i: 0, o: null, s: null, markers: [], panelT: 0, waitT: 0, endT: 0, won: false };

export function missionDone(id, hero){ try { return localStorage.getItem('sw_mission_' + id + '_' + hero) === '1'; } catch(e){ return false; } }

// start a mission from the top, or (retry) from the objective you fell on
export function startMission(id = 'temple', fromObjective = 0){
  const def = MISSIONS[id];
  clearMission();
  startLevel(0, { level: def.level, mission: true });   // fresh hero, kit and stats, on the mission's arena
  G.waveTotal = def.kit; checkUnlocks();                 // a mid-run kit: forms, Force jump / jetpack boosters, dual blasters
  Object.assign(M, { on: true, def, i: fromObjective, o: null, s: null, panelT: 0, endT: 0, won: false });
  // the opening banner (startLevel's) gets its moment before the first objective begins
  M.waitT = 2.8;
  setObjectiveHud({ kicker: 'MISSION · ' + def.title, title: def.objectives[fromObjective].title, status: 'STAND READY', frac: null });
}
export function retryMission(){ startMission(M.def ? M.def.id : 'temple', M.def ? M.i : 0); }
function clearMission(){
  for (const m of M.markers) removeMarker(m);
  M.markers = [];
  if (M.on) hidePanel();
  M.on = false;
  setObjectiveHud(null);
}
export function endMission(){ if (M.on || M.markers.length) clearMission(); }

function say(o, opts){ showPanel(MISSION_VOICE[G.hero], o.say[G.hero], '', o.task[G.hero], { drill: true, ...opts }); M.panelT = 7; }
function fieldSpawn(type, x, z){
  const s = findClearSpawn(x, z, 1.0);
  spawnEnemy(type, V3(s.x, 0, s.z));
  return enemies[enemies.length - 1];
}
function queueGroup(g){ for (const t in g) for (let n = 0; n < g[t]; n++) queueSpawn(t); }
// sweep what's left of the field (between objectives) without counting it as kills
function sweepField(){
  for (const e of enemies){
    if (!e.dead) burst(V3(e.group.position.x, 1.2, e.group.position.z), 0xffd28a, 10, 4, 3, 0.8);
    scene.remove(e.group); cleanupDuel(e); cleanupTactics(e);
    if (e.hpBar) scene.remove(e.hpBar);
    if (e.aimLine) scene.remove(e.aimLine);
  }
  enemies.length = 0;
  G.spawnQueue.length = 0;
}
function patchUp(){
  if (player.hp > 0 && player.hp < maxHp()){
    const healed = Math.round((maxHp() - player.hp) * 0.6);
    player.hp += healed;
    floater(V3(playerPos().x, 1.0, playerPos().z), '+' + healed, '#7bffae');
  }
  player.force = CFG.player.maxForce;
  if (G.hero === 'mando') player.jet = player.jetMax;
}

/* ============================================================
   OBJECTIVES — each kind has a begin and an update
   ============================================================ */
const KINDS = {
  hold: {
    begin(o, s){
      s.prog = 0; s.pulse = 0; s.pulseT = 2.5;
      M.markers.push(s.zone = makeBeacon(o.at[0], o.at[1], 0, MISSION_COLOR[G.hero], o.r / 0.9));
    },
    update(o, s, dt){
      const officers = enemies.some(e => !e.dead && !e.converted && e.type === 'officer');
      const alive = hostilesAlive() + G.spawnQueue.length;
      if ((s.pulseT -= dt) <= 0){
        s.pulseT = o.every[officers ? 0 : 1];
        if (alive < o.cap){
          queueGroup(o.pulses[s.pulse++ % o.pulses.length]);
          if (s.pulse > 1) showBanner('', officers ? 'AN OFFICER CALLS IN REINFORCEMENTS' : 'REINFORCEMENTS', 1.4);
        }
      }
      const inZone = heroIn(o.at[0], o.at[1], o.r), foes = hostilesIn(o.at[0], o.at[1], o.r);
      const rate = inZone ? 1 : foes ? 0 : o.awayRate;
      s.prog += dt * rate;
      setMarkerColor(s.zone, rate === 0 ? RED : MISSION_COLOR[G.hero]);
      s.zone.userData.beam.visible = !inZone;   // the column guides you back; standing in it, it would only fill the screen
      pulseMarker(s.zone, dt, G.gt);
      const total = alive ? ' · ' + alive + ' HOSTILE' + (alive === 1 ? '' : 'S') : '';
      setObjectiveHud({ kicker: 'MISSION · ' + M.def.title, title: o.title, frac: s.prog / o.time,
        status: (rate === 0 ? 'OVERRUN: RETAKE THE PAD' : inZone ? 'EVACUATING ' + mmss(o.time - s.prog) : 'PAD UNGUARDED ' + mmss(o.time - s.prog)) + total,
        warn: rate === 0 });
      if (s.prog >= o.time){
        showBanner('TRANSPORT AWAY', 'The gunship sweeps the courtyard as it climbs.', 2.4);
        G.shake = Math.max(G.shake, 0.6);
        return true;
      }
    },
  },

  sabotage: {
    begin(o, s){
      s.cons = o.consoles.map(c => {
        const spot = findClearSpawn(c.at[0], c.at[1], 1.4);
        const m = makeConsole(spot.x, spot.z, Math.atan2(-spot.x, -spot.z), RED);
        M.markers.push(m);
        for (const t in c.guards) for (let n = 0; n < c.guards[t]; n++)
          fieldSpawn(t, spot.x + (Math.random() - 0.5) * 5, spot.z + (Math.random() - 0.5) * 5);
        return { x: spot.x, z: spot.z, m, prog: 0, done: false };
      });
      s.trickT = o.trickle.every; s.hurtAt = player.lastHurt;
    },
    update(o, s, dt){
      if ((s.trickT -= dt) <= 0){ s.trickT = o.trickle.every; if (hostilesAlive() + G.spawnQueue.length < o.trickle.cap) queueGroup(o.trickle.group); }
      const hit = player.lastHurt !== s.hurtAt; s.hurtAt = player.lastHurt;
      let left = 0, at = null;
      for (const c of s.cons){
        if (c.done) continue;
        left++;
        pulseMarker(c.m, dt, G.gt);
        if (!heroIn(c.x, c.z, o.r)) continue;
        at = c;
        if (hit && c.prog > 0){ c.prog = Math.max(0, c.prog - o.hitLoss); floater(V3(c.x, 1.6, c.z), 'INTERRUPTED', '#ff9a8a'); }
        c.prog += dt;
        if (Math.floor(c.prog * 4) !== Math.floor((c.prog - dt) * 4)) sfx(700 + c.prog * 160, 0.04, 'square', 0.02, 900 + c.prog * 160);
        if (c.prog >= o.time){
          c.done = true; left--; at = null;
          setMarkerColor(c.m, GREEN); c.m.userData.beam.visible = false;
          burst(V3(c.x, 1.2, c.z), GREEN, 16, 6, 4, 0.8); S.reward(1);
          floater(V3(c.x, 1.8, c.z), 'UPLINK DOWN', '#7bffae');
        }
      }
      const n = s.cons.length;
      setObjectiveHud({ kicker: 'MISSION · ' + M.def.title, title: o.title,
        frac: at ? at.prog / o.time : (n - left) / n,
        status: at ? 'SLICING… STAY ON THE CONSOLE' : (n - left) + ' / ' + n + ' UPLINKS DOWN' });
      if (!left){ showBanner('UPLINKS SILENCED', 'The bombardment never comes.', 2.2); return true; }
    },
  },

  duel: {
    begin(o, s){
      sweepField();
      s.foe = null; s.dropT = 2.4; s.raged = false;
      showBanner('', 'The troops fall back. Something walks through them.', 2.4);
    },
    update(o, s, dt){
      if (!s.foe){
        if ((s.dropT -= dt) > 0) return;
        s.foe = spawnInquisitor(o);
      }
      const e = s.foe, gone = e.dead || !enemies.includes(e);
      if (!s.raged && !gone && e.hp <= e.maxHp * o.rage){
        s.raged = true;
        e.dp = { ...e.dp, ...o.rageDuel }; e.spd *= 1.15;
        showBanner('', o.name + ' PRESSES THE ATTACK', 1.8); S.roar(e.group.position);
      }
      setObjectiveHud({ kicker: 'MISSION · ' + M.def.title, title: o.title, frac: gone ? 0 : e.hp / e.maxHp, status: o.name, warn: true });
      if (gone){ showBanner(o.name + ' FALLS', '', 2.2); return true; }
    },
  },
};

// the duel's opponent: an existing duellist, scaled up into a champion with its own bar and a sharper profile
function spawnInquisitor(o){
  const e = fieldSpawn(o.foe, o.at[0], o.at[1]);
  e.champion = true;
  e.hp = e.maxHp = Math.round(e.hp * o.hp);
  e.t = { ...e.t, dmg: e.t.dmg * o.dmg, score: 20 };   // a copy: never mutate the shared type
  if (e.dp) e.dp = { ...e.dp, ...o.duel };
  e.group.scale.multiplyScalar(o.scale);
  e.group.userData.bodyMat.color.lerp(new THREE.Color(o.tint), 0.5);
  makeBossBar(e);
  burst(V3(e.group.position.x, 1.2, e.group.position.z), o.tint, 24, 8, 5, 1);
  G.shake = Math.max(G.shake, 0.7);
  showBanner(o.name, 'One blade. No one else.', 2.4, { kicker: 'DUEL' });
  S.roar(e.group.position); MUSIC.waveSting();
  return e;
}

function beginObjective(){
  const o = M.def.objectives[M.i];
  M.o = o; M.s = {};
  showBanner(o.title, '', 2.0, { kicker: 'OBJECTIVE ' + (M.i + 1) + ' / ' + M.def.objectives.length });
  say(o);
  KINDS[o.kind].begin(o, M.s);
}
function completeObjective(){
  for (const m of M.markers) removeMarker(m);
  M.markers = [];
  MUSIC.clearSting();
  M.o = null;
  if (M.i + 1 >= M.def.objectives.length){ M.endT = 2.4; M.won = true; return; }
  if (M.def.objectives[M.i + 1].kind !== 'duel') sweepField();
  patchUp();
  M.i++;
  M.waitT = 2.6;
}
function missionComplete(){
  const def = M.def;
  try { localStorage.setItem('sw_mission_' + def.id + '_' + G.hero, '1'); } catch(e){}
  showPanel(MISSION_VOICE[G.hero], def.done[G.hero], '', 'Mission complete', { drill: true, done: true });
  endRun(true);
  G.mode = 'victory'; G.slowmo = 1; G.slowmoT = 0;
  showBanner('MISSION COMPLETE', def.title, 999);
  setTimeout(() => {
    if (G.mode !== 'victory') return;
    document.exitPointerLock();
    overlay.style.display = 'flex';
    setOverlayState('victory');
    document.getElementById('ovsub').textContent = 'MISSION COMPLETE · ' + def.title;
  }, 1600);
}

/* called every frame from the main loop while playing (dt is 0 while paused) */
export function updateMission(dt){
  if (!M.on) return;
  if (!G.mission){ clearMission(); return; }   // left the mission (main menu, another mode)
  if (M.panelT > 0 && (M.panelT -= dt) <= 0) hidePanel();
  if (M.won){ if ((M.endT -= dt) <= 0){ M.won = false; missionComplete(); } return; }
  if (M.waitT > 0){ if ((M.waitT -= dt) <= 0) beginObjective(); return; }
  if (M.o && KINDS[M.o.kind].update(M.o, M.s, dt)) completeObjective();
}
// dev console / smoke test: count the current objective as done
export function skipObjective(){ if (M.on && M.o){ completeObjective(); return true; } return false; }
// how far through the mission (the atmosphere's mood follows it)
export function missionProgress(){ return M.on ? M.i / Math.max(1, M.def.objectives.length - 1) : 0; }
