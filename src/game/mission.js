// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY MISSIONS: runs a mission (data/missions.js) objective by objective: hold a spot, slice consoles, chase a quarry,
// win a duel.
// Built from the objective kit (game/objectives.js) so later modes can reuse the same pieces.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, player, solids } from '../state.js';
import { CFG } from '../data/config.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { hurtPlayer } from '../player/damage.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { updateLegs } from '../enemies/gait.js';
import { spawnEnemy, makeBossBar } from '../enemies/spawn.js';
import { cleanupDuel } from '../enemies/duel.js';
import { cleanupTactics } from '../enemies/tactics.js';
import { findClearSpawn } from '../world/collision.js';
import { buildNav } from '../enemies/nav.js';
import { makeEvacuee } from '../world/arenas/refuge.js';
import { startLevel, queueSpawn, checkUnlocks } from './flow.js';
import { endRun } from './summary.js';
import { showBanner } from '../ui/banners.js';
import { overlay, setOverlayState } from '../ui/menus.js';
import { showPanel, hidePanel, makeBeacon, makeConsole, setMarkerColor, pulseMarker, removeMarker,
         heroIn, hostilesIn, hostilesAlive, setObjectiveHud, mmss } from './objectives.js';
import { MISSIONS, MISSION_VOICE, MISSION_COLOR } from '../data/missions.js';

const RED = 0xff4a3a, GREEN = 0x7bffae;
const M = { on: false, def: null, i: 0, o: null, s: null, markers: [], props: [], fx: [], panelT: 0, waitT: 0, endT: 0, won: false,
            failT: 0, quarry: null, qHp: 0 };

// an objective as this hero plays it: its `hero` overrides laid over it, and per-hero words picked
function forHero(o){
  const h = o.hero && o.hero[G.hero], r = h ? { ...o, ...h } : { ...o };
  if (r.title && typeof r.title === 'object') r.title = r.title[G.hero];
  return r;
}

export function missionDone(id, hero){ try { return localStorage.getItem('sw_mission_' + id + '_' + hero) === '1'; } catch(e){ return false; } }

// start a mission from the top, or (retry) from the objective you fell on
export function startMission(id = 'refuge', fromObjective = 0){
  const def = MISSIONS[id] || MISSIONS.refuge;
  clearMission();
  startLevel(0, { level: def.level, mission: true });   // fresh hero, kit and stats, on the mission's arena
  for (const k of (def.grant && def.grant[G.hero]) || []) G.unlocked[k] = true;
  G.waveTotal = def.kit; checkUnlocks();                 // a mid-run kit: forms, Force jump / jetpack boosters, dual blasters
  G.waveTotal = 0;   // ...but foes as tough as the first wave (HP and elite odds climb with waveTotal)
  Object.assign(M, { on: true, def, i: fromObjective, o: null, s: null, fx: [], panelT: 0, endT: 0, won: false, failT: 0, quarry: null, qHp: 0 });
  const st = (fromObjective && def.objectives[fromObjective].start) || def.start;   // a retry may begin further along
  if (st){ playerPos().set(st[0], 0, st[1]); G.yaw = player.faceYaw = st[2] || 0; }
  if (def.quarry) placeQuarry(def.objectives[fromObjective]);
  // retrying past the evacuation: the transport has already gone
  if (def.objectives.slice(0, fromObjective).some(o => o.kind === 'hold' && o.evacuees)) shipGone();
  // the opening banner (startLevel's) gets its moment before the first objective begins
  M.waitT = 2.8;
  setObjectiveHud({ kicker: 'MISSION · ' + def.title, title: forHero(def.objectives[fromObjective]).title, status: 'STAND READY', frac: null });
}
export function retryMission(){ startMission(M.def ? M.def.id : (G.missionId || 'refuge'), M.def ? M.i : 0); }
export function missionTitle(id){ return (MISSIONS[id] || MISSIONS.refuge).title; }
function clearMission(){
  for (const m of M.markers) removeMarker(m);
  M.markers = [];
  for (const p of M.props) scene.remove(p);
  M.props = []; M.fx = []; M.quarry = null;
  if (M.on) hidePanel();
  M.on = false;
  MUSIC.setCue(null);
  setObjectiveHud(null);
}
export function endMission(){ if (M.on || M.markers.length) clearMission(); }

function say(o, opts){ showPanel(MISSION_VOICE[G.hero], o.say[G.hero], '', o.task[G.hero], { drill: true, ...opts }); M.panelT = 7; }
function fieldSpawn(type, x, z){
  const s = findClearSpawn(x, z, 1.0);
  spawnEnemy(type, V3(s.x, 0, s.z));
  return enemies[enemies.length - 1];
}
function queueGroup(g, opts){ for (const t in g) for (let n = 0; n < g[t]; n++) queueSpawn(t, opts); }
// a clear spot on the edge ring, within an arc of it
function arcSpawn(a0, a1){
  const a = a0 + Math.random() * (a1 - a0), r = shared.arenaHalf * (0.74 + Math.random() * 0.14);
  const s = findClearSpawn(Math.cos(a) * r, Math.sin(a) * r, 0.9);
  return V3(s.x, 0, s.z);
}
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
/* Each kind also names the music CUE it plays (audio/music.js CUES; an objective's `music` field overrides it) and
   music(o, s) reports how it's going: { urgency 0..1, danger, focus }. */
const KINDS = {
  hold: {
    cue: 'defend',
    music: (o, s) => ({ urgency: s.prog / o.time, danger: s.rate === 0, focus: s.inZone }),
    begin(o, s){
      s.prog = 0; s.pulse = 0; s.pulseT = 2.5;
      M.markers.push(s.zone = makeBeacon(o.at[0], o.at[1], 0, MISSION_COLOR[G.hero], o.r / 0.9));
      if (o.evacuees) beginEvacuees(o.evacuees, s);
    },
    update(o, s, dt){
      const officers = enemies.some(e => !e.dead && !e.converted && e.type === 'officer');
      const alive = hostilesAlive() + G.spawnQueue.length;
      if ((s.pulseT -= dt) <= 0){
        s.pulseT = o.every[officers ? 0 : 1];
        if (alive < o.cap){
          const goal = { pos: V3(o.at[0], 0, o.at[1]), aggro: o.aggro };   // they come for the ramp, not for you
          queueGroup(o.pulses[s.pulse++ % o.pulses.length], { at: o.from && (() => arcSpawn(o.from[0], o.from[1])), then: e => { if (e) e.goal = goal; } });
          if (s.pulse > 1) showBanner('', officers ? 'AN OFFICER CALLS IN REINFORCEMENTS' : 'REINFORCEMENTS', 1.4);
        }
      }
      const inZone = heroIn(o.at[0], o.at[1], o.r), foes = hostilesIn(o.at[0], o.at[1], o.r);
      const rate = inZone ? 1 : foes ? 0 : o.awayRate;
      s.prog += dt * rate; s.rate = rate; s.inZone = inZone;
      if (s.kids) updateEvacuees(o.evacuees, s, dt, Math.min(1, s.prog / o.time), rate);
      setMarkerColor(s.zone, rate === 0 ? RED : MISSION_COLOR[G.hero]);
      s.zone.userData.beam.visible = !inZone;   // the column guides you back; standing in it, it would only fill the screen
      pulseMarker(s.zone, dt, G.gt);
      const total = alive ? ' · ' + alive + ' HOSTILE' + (alive === 1 ? '' : 'S') : '';
      const who = o.evacuees ? o.evacuees.name[G.hero] + ' ABOARD ' + s.aboard + ' / ' + o.evacuees.count : 'EVACUATING';
      setObjectiveHud({ kicker: 'MISSION · ' + M.def.title, title: o.title, frac: s.prog / o.time,
        status: (rate === 0 ? 'OVERRUN: RETAKE THE RAMP' : inZone ? who + ' · ' + mmss(o.time - s.prog) : 'RAMP UNGUARDED ' + mmss(o.time - s.prog)) + total,
        warn: rate === 0 });
      if (s.prog >= o.time){
        showBanner('TRANSPORT AWAY', 'Its guns clear the field as it climbs.', 2.4);
        G.shake = Math.max(G.shake, 0.6);
        if (shared.refugeShip) liftOff();
        for (const e of enemies) e.goal = null;
        return true;
      }
    },
  },

  sabotage: {
    cue: 'infiltrate',
    music: (o, s) => ({ urgency: s.cons.reduce((a, c) => a + (c.done ? 1 : c.prog / o.time), 0) / s.cons.length, focus: !!s.at }),
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
      const n = s.cons.length; s.at = at;
      setObjectiveHud({ kicker: 'MISSION · ' + M.def.title, title: o.title,
        frac: at ? at.prog / o.time : (n - left) / n,
        status: at ? 'SLICING… STAY ON THE CONSOLE' : (n - left) + ' / ' + n + ' UPLINKS DOWN' });
      if (!left){ showBanner('UPLINKS SILENCED', 'The bombardment never comes.', 2.2); return true; }
    },
  },

  pursuit: {
    cue: 'chase',
    // urgency: how far along the leg it is (or how hurt it is, while it fights) · danger: it's out of sight and the clock runs
    music: (o, s) => ({ urgency: s.clash ? 1 - s.clash.hp / s.clash.maxHp : s.P ? s.d / s.P.len : 0,
                        danger: !s.seen && !s.hold, focus: !!(s.clash || s.hold || s.seen) }),
    begin(o, s){
      s.P = legPath(o.leg);
      s.d = 0; s.y = M.quarry.g.position.y; s.vy = 0; s.yaw = M.quarry.g.rotation.y;
      s.lostT = 0; s.seen = true; s.shoveCd = 1.5; s.burstT = 0; s.sweepT = 0;
      s.amb = (o.ambush || []).map(a => ({ ...a, d: projectPath(s.P, a.at[0], a.at[1]), fired: false }));
      s.stand = (o.standoff || []).map(a => ({ ...a, d: projectPath(s.P, a.at[0], a.at[1]), done: false }));
      s.hold = null; s.holdT = 0; s.clash = null; s.clashT = 0; s.clashCd = o.clash ? 2 : 0;
      s.cuts = (o.shortcuts || []).map(c => ({ ...c, beacon: makeBeacon(c.at[0], c.at[1], 0, GREEN, 1.6), told: false }));
      for (const c of s.cuts) M.markers.push(c.beacon);
      s.onCut = false;
      M.markers.push(s.last = makeBeacon(0, 0, 0, RED, 1.2)); s.last.visible = false;   // where it was last seen
      placeOnPath(s, M.quarry);
    },
    update(o, s, dt){
      if (s.clash) return clashUpdate(o, s, dt);
      const q = M.quarry, pp = playerPos(), qp = q.g.position;
      const pd = projectPath(s.P, pp.x, pp.z), gap = s.d - pd;
      G.chaseSurgeT = G.gt + 0.25;   // parkour on the run surges you forward (player/parkour.js flowLink)
      // on a shortcut lane: off its line, cutting the corner — the clock holds while you're in it
      const cut = s.cuts.find(c => pp.x > c.zone[0] && pp.x < c.zone[1] && pp.z > c.zone[2] && pp.z < c.zone[3]);
      if (cut && !cut.told){ cut.told = true; showBanner('', 'SHORTCUT · CUT IT OFF', 1.2); }
      s.onCut = !!cut;
      // a standoff: it stops to cut through a sealed way, and leaves a squad to hold you off until it's through
      if (!s.hold){ const st = s.stand.find(t => !t.done && s.d >= t.d); if (st) beginStandoff(o, s, st); }
      if (s.hold){
        s.holdT += dt;
        if (Math.random() < dt * 8) burst(V3(qp.x + Math.sin(s.yaw) * 0.9, qp.y + 1.3, qp.z + Math.cos(s.yaw) * 0.9), 0xffaa33, 3, 5, 3, 0.4);
        if (s.holdT > 1.5 && hostilesAlive() + G.spawnQueue.length === 0 || s.holdT > 40) endStandoff(s, q.def.name + ' BREAKS THROUGH');
        else if (gap < -10) endStandoff(s, q.def.name + ' BOLTS');   // you went round its guard: it runs for it
      } else {
        // it runs at the pace the gap calls for: easing off when you fall behind, flat out when you close in
        let spd = paceAt(o.pace, gap);
        if (s.burstT > 0){ s.burstT -= dt; spd = Math.max(spd, 12.5); }
        s.d = Math.min(s.P.len, s.d + spd * dt);
        placeOnPath(s, q, dt, spd);
      }
      // can you see it: close enough, and nothing taller than the line of sight in between
      const dist = Math.hypot(qp.x - pp.x, qp.y - pp.y, qp.z - pp.z);
      const seen = dist < o.sight && !sightBlocked(pp.x, pp.y + 1.5, pp.z, qp.x, qp.y + 1.4, qp.z);
      if (!seen && s.seen){ s.last.position.set(qp.x, 0, qp.z); s.last.visible = true; }
      if (seen) s.last.visible = false;
      s.seen = seen;
      // (standing still, it can't slip away; nor can it while you're on a shortcut or out ahead of it, running it down)
      s.lostT = seen ? Math.max(0, s.lostT - dt * 2) : s.hold || s.onCut || gap <= 0 ? s.lostT : s.lostT + dt;
      q.tag.visible = seen;
      if (s.last.visible) pulseMarker(s.last, dt, G.gt);
      if (s.lostT >= o.lost){ quarryEscaped(); return; }
      // caught it: on open ground it turns and fights until you've hurt it enough, then breaks away; otherwise it throws
      // you back and runs
      s.clashCd -= dt;
      if ((s.shoveCd -= dt) <= 0 && seen && dist < o.shove){
        if (o.clash && s.clashCd <= 0 && s.y < 0.2 && s.d < s.P.len - 8){ beginClash(o, s); return; }
        shove(q, s);
      }
      // troops step out to cover its run as it passes their doorway
      for (const a of s.amb){
        if (a.fired || s.d < a.d) continue;
        a.fired = true;
        if (hostilesAlive() + G.spawnQueue.length > 9) continue;
        let k = 0;
        queueGroup(a.group, { at: () => { const [x, z] = a.spots[k++ % a.spots.length], c = findClearSpawn(x, z, 0.9); return V3(c.x, 0, c.z); } });
        showBanner('', o.ambushLine || (q.def.name + ' CALLS FOR COVER'), 1.4);
      }
      // foes left far behind stop counting (they'd never catch up, and the route is long)
      if ((s.sweepT -= dt) <= 0){
        s.sweepT = 0.5;
        for (let i = enemies.length - 1; i >= 0; i--){
          const e = enemies[i];
          if (e.dead || projectPath(s.P, e.group.position.x, e.group.position.z) > pd - 40) continue;
          dropFoe(e); enemies.splice(i, 1);
        }
      }
      for (const c of s.cuts) if (c.beacon.visible) pulseMarker(c.beacon, dt, G.gt);
      setObjectiveHud({ kicker: 'MISSION · ' + M.def.title, title: o.title, frac: s.d / s.P.len,
        status: s.hold ? 'CLEAR ITS GUARD · ' + (hostilesAlive() + G.spawnQueue.length) + ' LEFT'
              : s.onCut ? 'SHORTCUT · CUT IT OFF'
              : !seen && gap <= 0 ? 'AHEAD OF IT · CUT IT OFF'
              : seen ? q.def.name + ' IN SIGHT · ' + Math.round(dist) + ' M' : 'OUT OF SIGHT · FIND IT ' + Math.max(0, o.lost - s.lostT).toFixed(1) + 'S',
        warn: !seen && !s.hold && !s.onCut && gap > 0 });
      if (s.d >= s.P.len){
        q.tag.visible = false;
        if (o.leg < M.def.route.length - 1) showBanner('CHECKPOINT', 'Still on its heels. Keep going.', 2.0);
        return true;
      }
    },
  },

  duel: {
    cue: 'duel',
    // the rage is tense until the foe is nearly beaten; then the hero's theme takes over
    music: (o, s) => { const e = s.foe, u = e ? 1 - Math.max(0, e.hp) / e.maxHp : 0; return { urgency: u, danger: s.raged && u < 0.75, focus: !!e }; },
    begin(o, s){
      sweepField();
      if (o.quarry) o.name = M.def.quarry[G.hero].name;   // (o is this run's copy: forHero)
      s.foe = null; s.dropT = o.quarry ? 1.6 : 2.4; s.raged = false;
      if (o.quarry){ const q = M.def.quarry[G.hero]; showBanner(q.name, 'Nowhere left to run.', 2.0, { kicker: 'CORNERED' }); }
      else showBanner('', 'The troops fall back. Something walks through them.', 2.4);
    },
    update(o, s, dt){
      if (!s.foe){
        if ((s.dropT -= dt) > 0) return;
        if (o.quarry && M.qHp) M.qHp = Math.max(0.55, M.qHp);   // the run wore it down, but it still has a fight in it
        s.foe = o.quarry ? spawnQuarryFoe(o) : spawnInquisitor(o);
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

/* ============================================================
   THE EVACUATION — the evacuees file from the shelter to the ramp as the hold's progress climbs, and the transport
   lifts off when it's done
   ============================================================ */
function pathPoint(P, d){
  for (let i = 0; i < P.length - 1; i++){
    const [ax, az] = P[i], [bx, bz] = P[i+1], len = Math.hypot(bx - ax, bz - az);
    if (d <= len || i === P.length - 2){ const t = Math.min(1, Math.max(0, d / len)); return [ax + (bx - ax)*t, az + (bz - az)*t, Math.atan2(bx - ax, bz - az)]; }
    d -= len;
  }
}
function beginEvacuees(ev, s){
  s.path = ev.path; s.len = 0;
  for (let i = 0; i < ev.path.length - 1; i++) s.len += Math.hypot(ev.path[i+1][0] - ev.path[i][0], ev.path[i+1][1] - ev.path[i][1]);
  s.aboard = 0;
  s.kids = [];
  for (let i = 0; i < ev.count; i++){
    const m = makeEvacuee(G.hero === 'mando' ? 'foundling' : 'youngling', i);
    scene.add(m); M.props.push(m);
    // the head of the line is already at the ramp; the rest queue back toward the shelter door
    s.kids.push({ m, d: s.len - i * ev.spacing - ev.spacing, ph: Math.random() * 6 });
  }
}
function updateEvacuees(ev, s, dt, frac, rate){
  const boarded = frac * ev.count;
  s.aboard = Math.min(ev.count, Math.floor(boarded + 1e-6));
  s.kids.forEach((k, i) => {
    const want = s.len - (i - boarded) * ev.spacing - ev.spacing;   // where this one's place in the line has moved to
    const step = Math.min(Math.max(0, want - k.d), dt * ev.speed);
    k.d += step;
    const out = k.d > 0 && k.d < s.len;
    k.m.visible = out;
    if (!out) return;
    const [x, z, yaw] = pathPoint(s.path, k.d);
    const walking = step > dt * 0.1;
    k.ph += dt * (walking ? 11 : rate === 0 ? 20 : 2);
    k.m.position.set(x, (walking ? Math.abs(Math.sin(k.ph)) * 0.06 : 0) + (k.d > s.len - 3 ? (k.d - (s.len - 3)) * 0.33 : 0), z);
    k.m.rotation.set(rate === 0 && !walking ? 0.25 : 0, yaw, rate === 0 && !walking ? Math.sin(k.ph) * 0.05 : 0);   // huddled and trembling while the ramp is overrun
  });
}
// the transport raises its ramp, climbs and is gone (the field is open where it stood)
function liftOff(){
  const sh = shared.refugeShip;
  dropShipSolid();
  for (const p of M.props) scene.remove(p);   // everyone is aboard
  M.props = [];
  let t = 0;
  const y0 = sh.group.position.y, z0 = sh.group.position.z;
  M.fx.push(dt => {
    t += dt;
    sh.ramp.rotation.x = -0.36 + Math.min(1, t / 1.0) * 1.7;
    if (t > 1){
      const u = t - 1;
      sh.group.position.y = y0 + u * u * 2.2;
      sh.group.position.z = z0 + Math.max(0, u - 1.5) * u * 3;
      sh.group.rotation.x = -Math.min(0.25, Math.max(0, u - 1) * 0.12);
      sh.glow.color.setHex(u % 0.2 < 0.1 ? 0xbfe8ff : 0x8ad0ff);
      if (u < 1.2 && Math.random() < 0.5) burst(V3(sh.group.position.x + (Math.random() - 0.5) * 6, 0.3, z0 - 5), 0xcfc0a8, 2, 5, 2, 0.8);
    }
    if (t > 8){ sh.group.visible = false; return false; }
    return true;
  });
}
function dropShipSolid(){
  const sh = shared.refugeShip, i = sh ? solids.indexOf(sh.solid) : -1;
  if (i >= 0){ solids.splice(i, 1); buildNav(); }
}
function shipGone(){ if (shared.refugeShip){ dropShipSolid(); shared.refugeShip.group.visible = false; } }

/* ============================================================
   THE QUARRY — who you chase in a pursuit: an enemy model run along the route's legs (data/missions.js `route`), not
   a fighting foe until it turns to duel at the end. Its feet follow the ground under it, it vaults low cover, and
   the stretches marked 'leap' are jumped. A red marker over it shows while you can see it.
   ============================================================ */
function legPath(i){
  const pts = M.def.route[i], cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k-1] + Math.hypot(pts[k][0] - pts[k-1][0], pts[k][1] - pts[k-1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
// how far along the leg is the point nearest (x, z)
function projectPath(P, x, z){
  let best = Infinity, at = 0;
  for (let k = 0; k < P.pts.length - 1; k++){
    const [ax, az] = P.pts[k], [bx, bz] = P.pts[k+1], dx = bx - ax, dz = bz - az, l2 = dx*dx + dz*dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax)*dx + (z - az)*dz) / l2)), d = Math.hypot(ax + dx*t - x, az + dz*t - z);
    if (d < best){ best = d; at = P.cum[k] + t * (P.cum[k+1] - P.cum[k]); }
  }
  return at;
}
function paceAt(pace, gap){
  if (gap <= pace[0][0]) return pace[0][1];
  for (let k = 1; k < pace.length; k++) if (gap < pace[k][0]){ const [g0, s0] = pace[k-1], [g1, s1] = pace[k]; return s0 + (s1 - s0) * (gap - g0) / (g1 - g0); }
  return pace[pace.length - 1][1];
}
// the top of whatever low cover is under (x, z): what the quarry's feet stand on (taller solids it never runs into)
function supportAt(x, z){
  let top = 0;
  for (const c of solids){
    if (c.h > 3.2 || c.h <= top) continue;
    if (c.box ? (Math.abs(x - c.x) < c.hx + 0.25 && Math.abs(z - c.z) < c.hz + 0.25) : Math.hypot(x - c.x, z - c.z) < c.r + 0.25) top = c.h;
  }
  return top;
}
// is the line between two eyes blocked by a solid taller than the line where it crosses?
function sightBlocked(ax, ay, az, bx, by, bz){
  const dx = bx - ax, dz = bz - az, l2 = dx*dx + dz*dz || 1;
  for (const c of solids){
    if (c.h < Math.min(ay, by)) continue;
    let t = null;
    if (c.box){   // slab test against the footprint, shrunk a touch so a glancing corner doesn't count
      let t0 = 0, t1 = 1;
      for (const [o, d, lo, hi] of [[ax, dx, c.x - c.hx + 0.15, c.x + c.hx - 0.15], [az, dz, c.z - c.hz + 0.15, c.z + c.hz - 0.15]]){
        if (Math.abs(d) < 1e-6){ if (o < lo || o > hi){ t0 = 2; break; } continue; }
        let u0 = (lo - o) / d, u1 = (hi - o) / d; if (u0 > u1){ const w = u0; u0 = u1; u1 = w; }
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      }
      if (t0 <= t1) t = t0;
    } else {
      const u = Math.max(0, Math.min(1, ((c.x - ax)*dx + (c.z - az)*dz) / l2));
      if (Math.hypot(ax + dx*u - c.x, az + dz*u - c.z) < c.r * 0.85) t = u;
    }
    if (t !== null && c.h > ay + (by - ay) * t) return true;
  }
  return false;
}
function makeQuarry(){
  const q = M.def.quarry[G.hero];
  const g = buildEnemyMesh(ENEMY_TYPES[q.foe]);
  g.scale.multiplyScalar(q.scale || 1);
  g.userData.bodyMat.color.lerp(new THREE.Color(q.tint), 0.5);
  const tag = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4),
    new THREE.MeshBasicMaterial({ color: RED, depthTest: false, transparent: true, opacity: 0.9, toneMapped: false }));
  tag.rotation.x = Math.PI; tag.renderOrder = 998; tag.visible = false;
  scene.add(g, tag); M.props.push(g, tag);
  return { g, tag, def: q };
}
// on (re)start: the quarry waits at the start of the leg you begin on, or where the run ended if you begin at the duel
function placeQuarry(o0){
  M.quarry = makeQuarry();
  const leg = o0.kind === 'pursuit' ? o0.leg : M.def.route.length - 1;
  const s = { P: legPath(leg), d: 0, y: 0, vy: 0 };
  if (o0.kind !== 'pursuit') s.d = s.P.len;
  placeOnPath(s, M.quarry);
}
// stand the quarry at s.d along its leg (dt > 0: moving at spd, so its feet ease over cover and it leans into the run)
function placeOnPath(s, q, dt = 0, spd = 0){
  const P = s.P, d = Math.min(s.d, P.len - 1e-4);
  let k = 0; while (k < P.pts.length - 2 && d > P.cum[k+1]) k++;
  const a = P.pts[k], b = P.pts[k+1], L = P.cum[k+1] - P.cum[k] || 1, t = (d - P.cum[k]) / L;
  const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
  let y;
  if (b[2] === 'leap'){   // a jump: an arc from the ground at one end to the ground at the other
    const y0 = supportAt(a[0], a[1]), y1 = supportAt(b[0], b[1]);
    y = y0 + (y1 - y0) * t + 4 * (0.6 + 0.12 * L) * t * (1 - t); s.vy = 0;
  } else {
    const ax = x + Math.sin(dir) * 0.6, az = z + Math.cos(dir) * 0.6, sup = Math.max(supportAt(x, z), supportAt(ax, az));
    if (!dt || sup >= s.y){ y = dt ? Math.min(sup, s.y + dt * 12) : sup; s.vy = 0; }   // up onto it in a hop
    else { s.vy -= 30 * dt; y = Math.max(sup, s.y + s.vy * dt); if (y <= sup) s.vy = 0; }   // off it under gravity
  }
  s.y = y;
  const g = q.g;
  s.yaw = dt ? s.yaw + Math.atan2(Math.sin(dir - s.yaw), Math.cos(dir - s.yaw)) * Math.min(1, dt * 10) : dir;
  g.position.set(x, y, z);
  g.rotation.set(0, s.yaw, 0);
  updateLegs(q, g, dt, b[2] === 'leap' ? 'air' : 'ground');   // its stride, lean and footing are the troopers' (enemies/gait.js)
  q.tag.position.set(x, y + 2.7 * (q.def.scale || 1) + Math.sin(G.gt * 5) * 0.12, z);
}
// standing still: turn to face the hero
function faceHero(q, dt){
  const p = playerPos(), g = q.g, want = Math.atan2(p.x - g.position.x, p.z - g.position.z);
  g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 5);
  g.rotation.x = 0;
  updateLegs(q, g, dt);
}
function shove(q, s){
  const qp = q.g.position, pp = playerPos(), dx = pp.x - qp.x, dz = pp.z - qp.z, l = Math.hypot(dx, dz) || 1;
  hurtPlayer(6, V3(qp.x, 1, qp.z), false, false);
  player.vel.x += dx / l * 13; player.vel.z += dz / l * 13; player.vel.y = Math.max(player.vel.y, 5);
  burst(V3(qp.x, 1.2, qp.z), q.def.tint, 18, 9, 3, 0.9);
  G.shake = Math.max(G.shake, 0.5);
  floater(V3(pp.x, 1.8, pp.z), G.hero === 'mando' ? 'SHOCK BLAST' : 'FORCE SHOVE', '#ff9a8a');
  s.burstT = 1.4; s.shoveCd = 4;
}
// a standoff: the quarry stops at a sealed way and its guard steps out between you
function beginStandoff(o, s, st){
  s.hold = st; s.holdT = 0;
  let k = 0;
  queueGroup(st.group, { at: () => { const [x, z] = st.spots[k++ % st.spots.length], c = findClearSpawn(x, z, 0.9); return V3(c.x, 0, c.z); } });
  showBanner('', st.line || (M.quarry.def.name + ' CUTS THROUGH · ITS GUARD HOLDS YOU OFF'), 1.8);
}
function endStandoff(s, line){
  s.hold.done = true; s.hold = null; s.burstT = 1.0;
  if (line) showBanner('', line, 1.4);
}
// a running fight: the quarry turns on you, and breaks away once you've hurt it enough (or held it too long)
function beginClash(o, s){
  const duel = forHero(M.def.objectives.find(x => x.kind === 'duel' && x.quarry));
  const e = spawnQuarryFoe(duel, G.hero === 'mando' ? 'It turns on you.' : 'It turns to fight.', 'CAUGHT');
  e.hpFloor = Math.max(1, e.hp - e.maxHp * o.clash.dmg);
  s.clash = e; s.clashT = 0;
}
function clashUpdate(o, s, dt){
  const e = s.clash;
  s.clashT += dt;
  if (!enemies.includes(e) || e.dead || e.hp <= e.hpFloor + 0.01 || s.clashT > o.clash.time){ breakAway(o, s); return; }
  setObjectiveHud({ kicker: 'MISSION · ' + M.def.title, title: o.title, frac: e.hp / e.maxHp,
    status: M.def.quarry[G.hero].name + ' FIGHTS BACK · HURT IT', warn: true });
}
function breakAway(o, s){
  const e = s.clash, p = e.group.position.clone(), i = enemies.indexOf(e);
  M.qHp = Math.max(0.05, e.hp / e.maxHp);   // the wounds carry into the last fight
  if (i >= 0) enemies.splice(i, 1);
  dropFoe(e);
  M.quarry = makeQuarry();
  s.clash = null; s.clashCd = o.clash.every;
  s.d = Math.max(s.d - 4, Math.min(s.d + 6, projectPath(s.P, p.x, p.z)));   // back onto its line, near where it broke off
  s.y = 0; s.vy = 0; s.yaw = e.group.rotation.y;
  placeOnPath(s, M.quarry);
  burst(V3(p.x, 1.2, p.z), M.quarry.def.tint, 22, 9, 4, 1);
  s.seen = true; s.lostT = 0;
  if (s.hold) endStandoff(s);   // fighting free of it ends a standoff too: it bolts through
  shove(M.quarry, s);
  showBanner('', M.quarry.def.name + ' BREAKS AWAY', 1.4);
}
function quarryEscaped(){
  const q = M.quarry.def;
  showBanner(q.name + ' GOT AWAY', 'Back to where the chase began.', 2.6, { kicker: 'MISSION FAILED' });
  S.uiDeny();
  M.failT = 2.8;
}
// take one foe off the field without counting it as a kill
function dropFoe(e){
  scene.remove(e.group); cleanupDuel(e); cleanupTactics(e);
  if (e.hpBar) scene.remove(e.hpBar);
  if (e.aimLine) scene.remove(e.aimLine);
}
// the quarry stops running and fights: a champion of its type, standing where it stopped
function spawnQuarryFoe(o, line, kicker){
  const q = M.def.quarry[G.hero], p = M.quarry.g.position;
  const e = spawnInquisitor({ ...o, foe: q.foe, name: q.name, scale: q.scale, tint: q.tint }, [p.x, p.z],
    { kicker: kicker || q.kicker, line: line || (G.hero === 'mando' ? 'The hunt ends here.' : 'One blade. No one else.') });
  if (M.qHp) e.hp = Math.round(e.maxHp * M.qHp);   // still carrying what you did to it on the run
  e.state = 'chase'; e.st = 0; e.group.position.y = 0; e.group.rotation.y = M.quarry.g.rotation.y;   // no rise from the ground: it was already here
  scene.remove(M.quarry.g, M.quarry.tag);
  M.quarry = null;
  return e;
}

// the duel's opponent: an existing duellist, scaled up into a champion with its own bar and a sharper profile
function spawnInquisitor(o, at = o.at, opts = {}){
  const e = fieldSpawn(o.foe, at[0], at[1]);
  e.champion = true;
  e.hp = e.maxHp = Math.round(e.hp * o.hp);
  e.t = { ...e.t, dmg: e.t.dmg * o.dmg, score: 20 };   // a copy: never mutate the shared type
  if (e.dp) e.dp = { ...e.dp, ...o.duel };
  e.group.scale.multiplyScalar(o.scale);
  e.group.userData.bodyMat.color.lerp(new THREE.Color(o.tint), 0.5);
  makeBossBar(e);
  burst(V3(e.group.position.x, 1.2, e.group.position.z), o.tint, 24, 8, 5, 1);
  G.shake = Math.max(G.shake, 0.7);
  showBanner(o.name, opts.line || 'One blade. No one else.', 2.4, { kicker: opts.kicker || 'DUEL' });
  S.roar(e.group.position); MUSIC.waveSting();
  return e;
}

function beginObjective(){
  const o = forHero(M.def.objectives[M.i]);
  M.o = o; M.s = {};
  showBanner(o.title, '', 2.0, { kicker: 'OBJECTIVE ' + (M.i + 1) + ' / ' + M.def.objectives.length });
  say(o);
  KINDS[o.kind].begin(o, M.s);
}
function completeObjective(){
  for (const m of M.markers) removeMarker(m);
  M.markers = [];
  MUSIC.objectiveSting();
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
  M.fx = M.fx.filter(f => f(dt));
  if (M.panelT > 0 && (M.panelT -= dt) <= 0) hidePanel();
  if (M.failT > 0){ if ((M.failT -= dt) <= 0) startMission(M.def.id, M.i); return; }   // it got away: this leg again
  if (M.quarry && !(M.o && M.o.kind === 'pursuit')) faceHero(M.quarry, dt);   // between legs it stops and looks back
  if (M.won){ if ((M.endT -= dt) <= 0){ M.won = false; missionComplete(); } return; }
  if (M.waitT > 0){ MUSIC.setCue('regroup'); if ((M.waitT -= dt) <= 0) beginObjective(); return; }
  if (!M.o) return;
  const K = KINDS[M.o.kind];
  if (K.update(M.o, M.s, dt)) completeObjective();
  else MUSIC.setCue(M.o.music || K.cue || 'battle', K.music && K.music(M.o, M.s));   // the score follows the objective
}
// dev console / smoke test: count the current objective as done
export function skipObjective(){
  if (!M.on || !M.o) return false;
  if (M.o.kind === 'hold') M.s.prog = M.o.time;   // let the hold finish its own way (the transport lifts off)
  else if (M.o.kind === 'pursuit'){   // it reaches the end of the leg, with you on its heels
    const S = M.s;
    if (S.clash) breakAway(M.o, S);
    S.d = S.P.len; placeOnPath(S, M.quarry);
    const k = S.P.pts.length - 1, [ax, az] = S.P.pts[k - 1], [bx, bz] = S.P.pts[k], l = Math.hypot(bx - ax, bz - az) || 1, t = Math.max(0, 1 - 8 / l);
    playerPos().set(ax + (bx - ax) * t, 0, az + (bz - az) * t);
    completeObjective();
  }
  else completeObjective();
  return true;
}
// dev console / tests: the running mission's state (the quarry, the current objective's state)
export const missionState = () => M;
// how far through the mission (the atmosphere's mood follows it)
export function missionProgress(){ return M.on ? M.i / Math.max(1, M.def.objectives.length - 1) : 0; }
