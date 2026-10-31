// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY MISSIONS: runs a mission (data/missions.js) objective by objective: hold a spot, slice consoles, take posts,
// walk someone across the field, chase a quarry, win a duel.
// Built from the objective kit (game/objectives.js) so later modes can reuse the same pieces.

import { autosave } from './autosave.js';
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3 } from '../utils.js';
import { FORM_DUEL } from '../data/duel.js';
import { initDuel } from '../enemies/duel.js';
import { STANCES } from '../data/stances.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, player, solids, isGunner, isMando, heroKey } from '../state.js';
import { CFG } from '../data/config.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { SCALE, heroScale } from '../data/coop.js';
import { heroesHere } from '../player/players.js';
import { hurtPlayer } from '../player/damage.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { spawnEnemy, makeBossBar } from '../enemies/spawn.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { findClearSpawn } from '../world/collision.js';
import { buildNav } from '../enemies/nav.js';
import { makeEvacuee } from '../world/arenas/refuge.js';
import { startLevel, queueSpawn, checkUnlocks } from './flow.js';
import { endRun } from './summary.js';
import { showBanner, bannerTap } from '../ui/banners.js';
import { storyBeat } from './story.js';
import { hooks } from '../net/run.js';
import { overlay, setOverlayState } from '../ui/menus.js';
import { showPanel, hidePanel, makeBeacon, makeConsole, setMarkerColor, pulseMarker, removeMarker,
         heroIn, nearHero, hostilesIn, hostilesAlive, setObjectiveHud, objectiveHud, mmss } from './objectives.js';
import { MISSIONS, MISSION_VOICE, MISSION_COLOR } from '../data/missions.js';
import { storyVoice } from '../data/campaign.js';
import { chapterAt } from './campaign.js';
import { ALLY_COLOR, addFriendRing, updateFriendRing, makeFriendTag } from '../fx/friend.js';
import { spawnSquad, squadIn, squadStanding, allies } from '../allies/squad.js';
import { collideSolids } from '../world/collision.js';
import { players, targetable } from '../player/players.js';
import { diffDmgMul } from '../data/difficulty.js';
import { startBattleFx, stopBattleFx, updateBattleFx } from '../fx/battle.js';
import { playDuelIntro, resetScenes, playScene } from './cutscene.js';

const RED = 0xff4a3a, GREEN = 0x7bffae;
const M = { on: false, def: null, i: 0, o: null, s: null, markers: [], props: [], fx: [], panelT: 0, waitT: 0, endT: 0, won: false,
            failT: 0, quarry: null, qHp: 0, vip: null,
            run: 0, guest: false, begun: -1, net: null };   // run counts restarts (a co-op guest follows it); guest: following the host's mission

// an objective as this hero plays it: its `hero` overrides laid over it, and per-hero words picked
const heroText = (v) => v && typeof v === 'object' ? heroKey(v) : v;
function forHero(o){
  const h = o.hero && heroKey(o.hero), r = h ? { ...o, ...h } : { ...o };
  if (r.title && typeof r.title === 'object') r.title = heroKey(r.title);
  return r;
}

export function missionDone(id, hero){ try { return localStorage.getItem('sw_mission_' + id + '_' + hero) === '1'; } catch(e){ return false; } }

// start a mission from the top, or (retry) from the objective you fell on. opts.chapter: a campaign chapter (game/campaign.js)
// plays it with the run's own build (no fixed kit, no grants, foes as tough as the run has got) and its chapter's name
export function startMission(id = 'refuge', fromObjective = 0, guest = false, opts = {}){
  const def = MISSIONS[id] || MISSIONS.refuge, ch = opts.chapter || null;
  clearMission();
  if (!opts.retry) resetScenes();   // a fresh start plays the mission's scenes again (a retry after a death or an escape doesn't)
  const sub = def.level.sub && typeof def.level.sub === 'object' ? heroKey(def.level.sub) : def.level.sub;
  if (ch){
    startLevel(G.levelIdx, { level: { ...def.level, ...ch.arena, name: ch.name, sub: ch.sub || sub }, mission: true, resume: !ch.fresh, chapter: true, foeLook: def.foeLook, squadCap: def.squadCap });   // the run's hero and build, on the mission's arena (or the chapter's own; fresh: a new run that opens on a mission, a story's prologue, starts a new build)
  } else {
    startLevel(0, { level: { ...def.level, sub }, mission: true, foeLook: def.foeLook, squadCap: def.squadCap });   // fresh hero, kit and stats, on the mission's arena
    for (const k of (def.grant && heroKey(def.grant)) || []) G.unlocked[k] = true;
    G.waveTotal = def.kit; checkUnlocks();                 // a mid-run kit: forms, Force jump / jetpack boosters, dual blasters
    G.waveTotal = 0;   // ...but foes as tough as the first wave (HP and elite odds climb with waveTotal)
  }
  const title = typeof def.title === 'object' ? heroKey(def.title) : def.title;
  Object.assign(M, { on: true, def, i: fromObjective, o: null, s: null, fx: [], panelT: 0, endT: 0, won: false, failT: 0, quarry: null, qHp: 0, vip: null, run: M.run + 1, guest, begun: -1, net: null,
                     chapter: ch, title, kick: ch ? ch.kicker : 'MISSION · ' + title });
  const st = (fromObjective && def.objectives[fromObjective].start) || def.start;   // a retry may begin further along
  if (st){ playerPos().set(st[0], 0, st[1]); G.yaw = player.faceYaw = st[2] || 0; }
  if (guest){   // co-op guest: the host runs the objectives; this browser shows them (coopMissionSync)
    G.coopGuest = true; G.coopWasGuest = true; G.coopJoin = false;
    M.i = -1; M.run = -1;
    if (def.battle) startBattleFx(isMando() ? 0xffa040 : 0x4aa8ff);
    showBanner('CO-OP MISSION', 'Fighting alongside the host.', 3.0);
    return;
  }
  if (def.quarry) placeQuarry(def.objectives[fromObjective]);
  if (def.escort) placeVip(fromObjective);
  // a STRIKE TEAM mission: the squad forms up beside the hero (allies/squad.js), and the wider battle rages past the walls
  if (def.squad) spawnSquad(def.squadCap ? Math.max(0, def.squadCap - allies.length) : def.squad, st);   // (a capped squad counts the trooper's own, already called in)
  if (def.battle) startBattleFx(isMando() ? 0xffa040 : 0x4aa8ff);
  // retrying past the evacuation: the transport has already gone
  if (def.objectives.slice(0, fromObjective).some(o => o.kind === 'hold' && o.evacuees)) shipGone();
  // the opening banner (startLevel's) gets its moment before the first objective begins
  M.waitT = 2.8;
  setObjectiveHud({ kicker: M.kick, title: forHero(def.objectives[fromObjective]).title, status: 'STAND READY', frac: null });
}
export function startCoopMission(id){ startMission(id, 0, true); }
export function retryMission(){ startMission(M.def ? M.def.id : (G.missionId || 'refuge'), M.def ? M.i : 0, false, { chapter: M.chapter, retry: true }); }
export function missionTitle(id, hero = G.hero){ const t = (MISSIONS[id] || MISSIONS.refuge).title; return typeof t === 'object' ? t[hero] : t; }
function clearMission(){
  for (const m of M.markers) removeMarker(m);
  M.markers = [];
  for (const p of M.props) scene.remove(p);
  M.props = []; M.fx = []; M.quarry = null; M.vip = null; M.guest = false; M.net = null; M.begun = -1;
  stopBattleFx();
  if (M.on) hidePanel();
  M.on = false;
  MUSIC.setCue(null);
  setObjectiveHud(null);
}
export function endMission(){ if (M.on || M.markers.length) clearMission(); }

// who speaks a mission's lines: in the campaign, the story's voice for the chapter (Master Vael, then General Kast, in
// the Jedi's); in the Missions list, the hero's own
const missionVoice = () => { const c = G.chapter >= 0 && chapterAt(G.chapter); return c ? storyVoice(undefined, c) : heroKey(MISSION_VOICE); };
// an objective's line: a campaign chapter's story can say it its own way (its `says`, by objective: data/campaign-jedi.js)
function sayLine(o){
  const c = G.chapter >= 0 && chapterAt(G.chapter), i = M.def ? M.def.objectives.indexOf(o) : -1;
  return (c && c.says && i >= 0 && c.says[i]) || heroKey(o.say);
}
function say(o, opts){ showPanel(missionVoice(), sayLine(o), '', heroKey(o.task), { drill: true, ...opts }); M.panelT = 7; }
function fieldSpawn(type, x, z){
  const s = findClearSpawn(x, z, 1.0);
  spawnEnemy(type, V3(s.x, 0, s.z));
  return enemies[enemies.length - 1];
}
function queueGroup(g, opts){ for (const t in g) for (let n = 0; n < g[t]; n++) queueSpawn(t, opts); }
// a clear spot on the edge ring, within an arc of it
function arcSpawn(a0, a1){
  const a = a0 + Math.random() * (a1 - a0);
  let x, z;
  if (shared.arenaBig){   // a battle map's edge is a minute's run away: come in from that side of the hero instead
    const p = playerPos(), r = 28 + Math.random() * 12, hx = shared.arenaHalf - 4, hz = shared.arenaHalfZ - 4;
    x = Math.max(-hx, Math.min(hx, p.x + Math.cos(a) * r)); z = Math.max(-hz, Math.min(hz, p.z + Math.sin(a) * r));
  } else { const r = shared.arenaHalf * (0.74 + Math.random() * 0.14); x = Math.cos(a) * r; z = Math.sin(a) * r; }
  const s = findClearSpawn(x, z, 0.9);
  return V3(s.x, 0, s.z);
}
// sweep what's left of the field (between objectives) without counting it as kills
function sweepField(){
  for (const e of enemies){
    if (!e.dead) burst(V3(e.group.position.x, 1.2, e.group.position.z), 0xffd28a, 10, 4, 3, 0.8);
    removeEnemy(e);
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
  if (isGunner()) player.jet = player.jetMax;
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
      M.markers.push(s.zone = makeBeacon(o.at[0], o.at[1], 0, heroKey(MISSION_COLOR), o.r / 0.9));
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
      // squadRate: squadmates ordered onto the zone (H) keep it ticking while you're away; a foe in it halves that
      const mates = o.squadRate ? squadIn(o.at[0], o.at[1], o.r) : 0;
      const rate = inZone ? 1 : mates ? o.squadRate * (foes ? 0.5 : 1) : foes ? 0 : o.awayRate;
      s.prog += dt * rate; s.rate = rate; s.inZone = inZone;
      if (s.kids) updateEvacuees(o.evacuees, s, dt, Math.min(1, s.prog / o.time), rate);
      setMarkerColor(s.zone, rate === 0 ? RED : heroKey(MISSION_COLOR));
      s.zone.userData.beam.visible = !inZone;   // the column guides you back; standing in it, it would only fill the screen
      pulseMarker(s.zone, dt, G.gt);
      const total = alive ? ' · ' + alive + ' HOSTILE' + (alive === 1 ? '' : 'S') : '';
      const who = o.evacuees ? heroKey(o.evacuees.name) + ' ' + (o.evacuees.verb || 'ABOARD') + ' ' + s.aboard + ' / ' + o.evacuees.count : (o.holding || 'HOLDING');
      setObjectiveHud({ kicker: M.kick, title: o.title, frac: s.prog / o.time,
        status: (rate === 0 ? 'OVERRUN: ' + (o.overrun || 'RETAKE THE RAMP') : inZone ? who + ' · ' + mmss(o.time - s.prog)
               : mates ? 'SQUAD HOLDING ' + mmss(o.time - s.prog) : (o.unguarded || 'RAMP UNGUARDED') + ' ' + mmss(o.time - s.prog)) + total,
        warn: rate === 0 });
      if (s.prog >= o.time){
        showBanner(o.doneLine || 'TRANSPORT AWAY', o.doneLine ? (o.doneSub || '') : 'Its guns clear the field as it climbs.', 2.4);
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
        return { x: spot.x, z: spot.z, m, prog: 0, done: false, def: c };
      });
      s.trickT = o.trickle.every; s.hurtAt = player.lastHurt;
    },
    update(o, s, dt){
      if ((s.trickT -= dt) <= 0){
        s.trickT = o.trickle.every;
        if (hostilesAlive() + G.spawnQueue.length < o.trickle.cap) queueGroup(o.trickle.group, { at: o.from && (() => arcSpawn(o.from[0], o.from[1])) });
      }
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
          setMarkerColor(c.m, GREEN); c.m.userData.beam.visible = false; c.m.userData.done = true;
          burst(V3(c.x, 1.2, c.z), GREEN, 16, 6, 4, 0.8); S.reward(1);
          floater(V3(c.x, 1.8, c.z), o.consoleName ? o.consoleName + ' ' + (o.consoleDone || (o.consoleName === 'CHARGE' ? 'SET' : 'SECURED')) : 'UPLINK DOWN', '#7bffae');
          // a console can hold something more than its objective (the Jakku cruiser's holocron): its own banner
          const found = c.def.found && (heroKey(c.def.found) !== undefined ? heroKey(c.def.found) : c.def.found);
          if (found) showBanner(found[0], found[1] || '', 2.6, { kicker: 'FOUND' });
        }
      }
      const n = s.cons.length; s.at = at;
      setObjectiveHud({ kicker: M.kick, title: o.title,
        frac: at ? at.prog / o.time : (n - left) / n,
        status: at ? (o.consoleName ? 'WORKING… STAY ON IT' : 'SLICING… STAY ON THE CONSOLE')
                   : (n - left) + ' / ' + n + (o.consoleName ? ' ' + o.consoleName + 'S DONE' : ' UPLINKS DOWN') });
      if (!left){ showBanner(o.doneLine || 'UPLINKS SILENCED', o.doneLine ? (o.doneSub || '') : 'The bombardment never comes.', 2.2); return true; }
    },
  },

  /* CAPTURE: take a line of posts one after another. A post's guard holds it; stand in it (or put the squad on it,
     H) with no foe inside and it turns. Each squadmate in it speeds it up. Fresh troops march on the post you're
     taking while it's contested. */
  capture: {
    cue: 'battle',
    music: (o, s) => ({ urgency: (s.k + (s.cur ? s.cur.prog / o.time : 0)) / o.posts.length, danger: s.contested, focus: s.inZone }),
    begin(o, s){ s.k = 0; s.trickT = o.trickle ? o.trickle.every * 0.5 : 0; startPost(o, s); },
    update(o, s, dt){
      const P = s.cur;
      if (o.trickle && (s.trickT -= dt) <= 0){
        s.trickT = o.trickle.every;
        if (hostilesAlive() + G.spawnQueue.length < o.trickle.cap){
          const goal = { pos: V3(P.x, 0, P.z), aggro: o.aggro || 9 };
          queueGroup(o.trickle.group, { at: o.from && (() => arcSpawn(o.from[0], o.from[1])), then: e => { if (e) e.goal = goal; } });
        }
      }
      const inZone = heroIn(P.x, P.z, o.r), mates = squadIn(P.x, P.z, o.r), foes = hostilesIn(P.x, P.z, o.r);
      const rate = foes ? 0 : (inZone ? 1 : mates ? o.squadRate : 0) * (1 + (o.perMate || 0) * mates);
      P.prog = Math.min(o.time, P.prog + dt * rate);
      s.inZone = inZone; s.contested = foes > 0 && (inZone || mates > 0);
      setMarkerColor(P.m, foes ? RED : heroKey(MISSION_COLOR));
      P.m.userData.beam.visible = !inZone;
      pulseMarker(P.m, dt, G.gt);
      const alive = hostilesAlive() + G.spawnQueue.length, n = o.posts.length;
      setObjectiveHud({ kicker: M.kick, title: o.title, frac: P.prog / o.time,
        status: (foes ? 'POST ' + (s.k + 1) + ' / ' + n + ' · CLEAR IT: ' + foes + ' IN THE ZONE'
               : rate > 0 ? 'TAKING POST ' + (s.k + 1) + ' / ' + n + (mates ? ' · SQUAD ×' + mates : '')
               : 'POST ' + (s.k + 1) + ' / ' + n + ' · GET ON IT, OR SEND THE SQUAD (H)') + (alive ? ' · ' + alive + ' HOSTILE' + (alive === 1 ? '' : 'S') : ''),
        warn: foes > 0 });
      if (P.prog >= o.time){
        setMarkerColor(P.m, GREEN); P.m.userData.beam.visible = false; P.m.userData.done = true;
        burst(V3(P.x, 1.2, P.z), GREEN, 16, 6, 4, 0.8); S.reward(1);
        floater(V3(P.x, 1.8, P.z), (o.postName || 'POST') + ' TAKEN', '#7bffae');
        for (const e of enemies) if (e.goal) e.goal = null;
        if (++s.k >= n){ showBanner(o.doneLine || 'THE LINE IS BROKEN', o.doneSub || '', 2.2); return true; }
        showBanner('', (o.postName || 'POST') + ' ' + s.k + ' / ' + n + ' TAKEN · PUSH ON', 1.6);
        startPost(o, s);
      }
    },
  },

  /* ESCORT: walk the mission's escort along a path. It walks while you're near and nothing is on it; foes close to
     it pin it down and wear it away. Troops are sent at it as it passes their ground. */
  escort: {
    cue: 'battle',
    music: (o, s) => ({ urgency: s.d / s.P.len, danger: s.pinned > 0, focus: s.near }),
    begin(o, s){
      s.P = pathOf(o.path); s.d = 0; s.pinned = 0; s.near = true; s.hitT = 0; s.trickT = o.trickle ? o.trickle.every * 0.6 : 0;
      s.amb = (o.ambush || []).map(a => ({ ...a, d: projectPath(s.P, a.at[0], a.at[1]), fired: false }));
      s.goal = { pos: M.vip.g.position, aggro: o.aggro || 7 };   // the foes sent at it march on it (the live position)
      const [ex, ez] = o.path[o.path.length - 1];
      M.markers.push(s.dest = makeBeacon(ex, ez, 0, heroKey(MISSION_COLOR), 1.6));   // where it's going
      walkVip(s, 0);
    },
    update(o, s, dt){
      const v = M.vip, vp = v.g.position, pp = nearHero(vp.x, vp.z).pos;
      const send = (g, from) => queueGroup(g, { at: from && (() => arcSpawn(from[0], from[1])), then: e => { if (e) e.goal = s.goal; } });
      for (const a of s.amb){
        if (a.fired || s.d < a.d) continue;
        a.fired = true;
        if (hostilesAlive() + G.spawnQueue.length > 10) continue;
        send(a.group, a.from || o.from);
        showBanner('', o.ambushLine || 'TROOPS MOVING ON THE ' + (v.def.kicker || v.def.name), 1.4);
      }
      if (o.trickle && (s.trickT -= dt) <= 0){
        s.trickT = o.trickle.every;
        if (hostilesAlive() + G.spawnQueue.length < o.trickle.cap) send(o.trickle.group, o.from);
      }
      // pinned: foes at it stop it and wear it down; otherwise it walks on, as long as you're with it
      let pinned = 0;
      for (const e of enemies) if (!e.dead && !e.converted && Math.hypot(e.group.position.x - vp.x, e.group.position.z - vp.z) < o.threat) pinned++;
      s.pinned = pinned;
      s.near = Math.hypot(pp.x - vp.x, pp.z - vp.z) < o.leash;
      if (pinned){
        v.hp -= pinned * o.dps * diffDmgMul() * dt;
        if ((s.hitT -= dt) <= 0){
          s.hitT = 0.35 + Math.random() * 0.3;
          burst(V3(vp.x + (Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 0.6, vp.z + (Math.random() - 0.5) * 0.6), 0xffb050, 6, 5, 2, 0.4);
          sfx(180 + Math.random() * 80, 0.05, 'square', 0.02, 120);
        }
      } else v.hp = Math.min(v.maxHp, v.hp + (o.regen || 0) * dt);
      v.tag.material.color.setHex(pinned ? RED : ALLY_COLOR);
      updateFriendRing(v.g, !!pinned);
      const walking = !pinned && s.near && s.d < s.P.len;
      walkVip(s, walking ? dt : 0, walking ? o.speed : 0, dt);
      pulseMarker(s.dest, dt, G.gt);
      if (v.hp <= 0){ vipDown(); return; }
      const hp = Math.round(100 * v.hp / v.maxHp) + '%', left = Math.max(0, Math.round(s.P.len - s.d));
      setObjectiveHud({ kicker: M.kick, title: o.title, frac: s.d / s.P.len,
        status: (pinned ? 'UNDER FIRE · DRIVE THEM OFF IT' : !s.near ? v.def.name + ' WAITS FOR YOU' : 'MOVING · ' + left + ' M TO GO')
              + ' · ' + v.def.name + ' ' + hp, warn: pinned > 0 || v.hp < v.maxHp * 0.3 });
      if (s.d >= s.P.len){
        for (const e of enemies) if (e.goal === s.goal) e.goal = null;
        showBanner('', v.def.name + ' IS THROUGH', 1.4);
        return true;
      }
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
      const q = M.quarry, qp = q.g.position, pp = leadHero(s.P).pos, np = nearHero(qp.x, qp.z).pos;   // (co-op: the one furthest along sets the pace, the nearest one sees it)
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
      const dist = Math.hypot(qp.x - np.x, qp.y - np.y, qp.z - np.z);
      const seen = dist < o.sight && !sightBlocked(np.x, np.y + 1.5, np.z, qp.x, qp.y + 1.4, qp.z);
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
      setObjectiveHud({ kicker: M.kick, title: o.title, frac: s.d / s.P.len,
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
      if (o.quarry) o.name = heroKey(M.def.quarry).name;   // (o is this run's copy: forHero)
      s.foe = null; s.dropT = o.quarry ? 1.6 : 2.4; s.raged = false;
      if (o.quarry){ const q = heroKey(M.def.quarry); showBanner(q.name, 'Nowhere left to run.', 2.0, { kicker: 'CORNERED' }); }
      else showBanner('', heroText(o.enter) || 'The troops fall back. Something walks through them.', 2.4);
    },
    update(o, s, dt){
      if (!s.foe){
        if ((s.dropT -= dt) > 0) return;
        if (!s.intro){   // its entrance first (game/cutscene.js): the sim holds while it plays, so the foe steps in right after
          s.intro = true;
          const q = o.quarry && heroKey(M.def.quarry);
          if (playDuelIntro(q ? { mid: M.def.id, quarry: true, name: q.name, kicker: q.kicker, scale: q.scale, line: heroText(o.line) }
                              : { mid: M.def.id, foe: o.foe, name: o.name, kicker: o.kicker, tint: o.tint, blade: o.form ? STANCES[o.form].blade : null, scale: o.scale, at: o.at, line: heroText(o.line) })) return;
        }
        if (o.quarry && M.qHp) M.qHp = Math.max(0.55, M.qHp);   // the run wore it down, but it still has a fight in it
        s.foe = o.quarry ? spawnQuarryFoe(o) : spawnInquisitor(o, o.at, { line: heroText(o.line), kicker: o.kicker });
        if (o.escape) s.foe.hpFloor = Math.max(1, s.foe.maxHp * o.escape);   // it won't fall here: at this much left it breaks off (escapeDuel)
        storyBeat('duel', { name: o.name, quarry: !!o.quarry });
      }
      const e = s.foe, gone = e.dead || !enemies.includes(e);
      if (o.escape && !gone && e.hp <= e.hpFloor + 0.01){ escapeDuel(o, e); return true; }
      if (!s.raged && !gone && e.hp <= e.maxHp * o.rage){
        s.raged = true;
        if (e.dp) e.dp = { ...e.dp, ...o.rageDuel };   // (a gunfighter has no duelling profile to sharpen)
        e.spd *= 1.15;
        showBanner('', o.name + ' PRESSES THE ATTACK', 1.8); S.roar(e.group.position);
      }
      // trickle: troops keep coming for the squad to hold off while you take the duel (a strike team's last stand)
      if (o.trickle && !gone && (s.trickT = (s.trickT ?? o.trickle.every) - dt) <= 0){
        s.trickT = o.trickle.every;
        if (hostilesAlive() + G.spawnQueue.length < o.trickle.cap + 1) queueGroup(o.trickle.group, { at: o.from && (() => arcSpawn(o.from[0], o.from[1])) });
      }
      setObjectiveHud({ kicker: M.kick, title: o.title, frac: gone ? 0 : e.hp / e.maxHp, status: o.name, warn: true });
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
    const m = makeEvacuee(ev.kind || (isMando() ? 'foundling' : 'youngling'), i);
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
    k.m.position.set(x, (walking ? Math.abs(Math.sin(k.ph)) * 0.06 : 0) + (ev.ramp !== false && k.d > s.len - 3 ? (k.d - (s.len - 3)) * 0.33 : 0), z);   // (up the ramp at the end)
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
  const sh = shared.refugeShip;
  if (!sh) return;
  let gone = false;
  for (const s of sh.solids){ const i = solids.indexOf(s); if (i >= 0){ solids.splice(i, 1); gone = true; } }
  if (gone) buildNav();
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
    if (c.mound || c.y0 || c.h > 3.2 || c.h <= top) continue;
    if (c.box ? (Math.abs(x - c.x) < c.hx + 0.25 && Math.abs(z - c.z) < c.hz + 0.25) : Math.hypot(x - c.x, z - c.z) < c.r + 0.25) top = c.h;
  }
  return top;
}
// is the line between two eyes blocked by a solid taller than the line where it crosses?
function sightBlocked(ax, ay, az, bx, by, bz){
  const dx = bx - ax, dz = bz - az, l2 = dx*dx + dz*dz || 1;
  for (const c of solids){
    if (c.mound || c.y0 || c.h < Math.min(ay, by)) continue;   // (the pursuit's awnings and beams: seen under, past)
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
function makeQuarry(q = heroKey(M.def.quarry)){
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
  updateUpper(q, g, dt, nearHero(g.position.x, g.position.z).pos);   // and it keeps looking back at you (enemies/upper.js)
  q.tag.position.set(x, y + 2.7 * (q.def.scale || 1) + Math.sin(G.gt * 5) * 0.12, z);
}
// standing still: turn to face the hero
function faceHero(q, dt){
  const g = q.g, p = nearHero(g.position.x, g.position.z).pos, want = Math.atan2(p.x - g.position.x, p.z - g.position.z);
  g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 5);
  g.rotation.x = 0;
  updateLegs(q, g, dt); updateUpper(q, g, dt, p);
}
function shove(q, s){
  const qp = q.g.position, hh = nearHero(qp.x, qp.z), pp = hh.pos, dx = pp.x - qp.x, dz = pp.z - qp.z, l = Math.hypot(dx, dz) || 1;
  if (hh.local){   // (a partner's shove is theirs to feel: only the flash and the sound reach them from here)
    hurtPlayer(6, V3(qp.x, 1, qp.z), false, false);
    player.vel.x += dx / l * 13; player.vel.z += dz / l * 13; player.vel.y = Math.max(player.vel.y, 5);
  }
  burst(V3(qp.x, 1.2, qp.z), q.def.tint, 18, 9, 3, 0.9);
  G.shake = Math.max(G.shake, 0.5);
  floater(V3(pp.x, 1.8, pp.z), isGunner() ? 'SHOCK BLAST' : 'FORCE SHOVE', '#ff9a8a');
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
  const e = spawnQuarryFoe(duel, isGunner() ? 'It turns on you.' : 'It turns to fight.', 'CAUGHT');
  e.hpFloor = Math.max(1, e.hp - e.maxHp * o.clash.dmg);
  s.clash = e; s.clashT = 0;
}
function clashUpdate(o, s, dt){
  const e = s.clash;
  s.clashT += dt;
  if (!enemies.includes(e) || e.dead || e.hp <= e.hpFloor + 0.01 || s.clashT > o.clash.time){ breakAway(o, s); return; }
  setObjectiveHud({ kicker: M.kick, title: o.title, frac: e.hp / e.maxHp,
    status: heroKey(M.def.quarry).name + ' FIGHTS BACK · HURT IT', warn: true });
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
// the refuge's Inquisitor: beaten, but not finished. It throws you back and is gone in the smoke (the story needs it
// alive for the Long Chase)
function escapeDuel(o, e){
  const p = e.group.position.clone(), i = enemies.indexOf(e);
  if (i >= 0) enemies.splice(i, 1);
  dropFoe(e);
  burst(V3(p.x, 1.0, p.z), 0x40444c, 34, 7, 3, 1.4);
  burst(V3(p.x, 1.4, p.z), o.tint, 18, 9, 5, 0.8);
  G.shake = Math.max(G.shake, 0.8);
  S.roar(p);
  showBanner(o.name + ' ESCAPES', heroText(o.escapeLine) || '', 3.0);
  const c = G.chapter >= 0 && chapterAt(G.chapter);
  playScene(o.escapeScene || 'inq-escape', { mark: [p.x, p.z], lines: (c && c.escapeLines) || undefined });   // its parting words (a story's own, if it has them), where it stood (game/cutscene.js)
  storyBeat('escape', { name: o.name });
}
function quarryEscaped(){
  const q = M.quarry.def;
  showBanner(q.name + ' GOT AWAY', 'Back to where the chase began.', 2.6, { kicker: 'MISSION FAILED' });
  S.uiDeny();
  M.failT = 2.8;
}
// take one foe off the field without counting it as a kill
function dropFoe(e){ removeEnemy(e); }
// the quarry stops running and fights: a champion of its type, standing where it stopped
function spawnQuarryFoe(o, line, kicker){
  const q = heroKey(M.def.quarry), p = M.quarry.g.position;
  const e = spawnInquisitor({ ...o, foe: q.foe, name: q.name, scale: q.scale, tint: q.tint }, [p.x, p.z],
    { kicker: kicker || q.kicker, line: line || (isGunner() ? 'The hunt ends here.' : 'One blade. No one else.') });
  if (M.qHp) e.hp = Math.round(e.maxHp * M.qHp);   // still carrying what you did to it on the run
  e.state = 'chase'; e.st = 0; e.group.position.y = 0; e.group.rotation.y = M.quarry.g.rotation.y;   // no rise from the ground: it was already here
  scene.remove(M.quarry.g, M.quarry.tag);
  M.quarry = null;
  return e;
}

/* ============================================================
   THE ESCORT — who you walk across the field in an escort (data/missions.js `escort`): a squadmate-style model with a
   marker over it that turns red while it's under fire. It stays where the last escort leg left it (the hold after it
   happens around it).
   ============================================================ */
function pathOf(pts){
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k-1] + Math.hypot(pts[k][0] - pts[k-1][0], pts[k][1] - pts[k-1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
// the hero furthest along a leg: the one the chase's pace follows
function leadHero(P){
  let best = null, bd = -Infinity;
  for (const h of players){
    if (!targetable(h) && !h.local) continue;
    const d = projectPath(P, h.pos.x, h.pos.z);
    if (d > bd){ bd = d; best = h; }
  }
  return best || players[0];
}
function buildVip(d){
  const g = buildEnemyMesh({ model: d.model, color: d.color, eye: d.eye, cloth: d.cloth, scale: d.scale || 1 });
  const tag = makeFriendTag(1.2); addFriendRing(g);
  scene.add(g, tag); M.props.push(g, tag);
  return M.vip = { g, tag, def: d, hp: d.hp, maxHp: d.hp };
}
function placeVip(fromObjective){
  const d = heroKey(M.def.escort), { g, tag } = buildVip(d);
  // it stands where its walk picks up: the start of the first escort leg from here on, or the end of the last one before
  const objs = M.def.objectives, next = objs.slice(fromObjective).find(o => o.kind === 'escort');
  const prev = objs.slice(0, fromObjective).reverse().find(o => o.kind === 'escort');
  const at = next ? next.path[0] : prev ? prev.path[prev.path.length - 1] : (M.def.start || [0, 0]);
  g.position.set(at[0], 0, at[1]);
  const [ax, az] = next ? next.path[0] : at, [bx, bz] = next ? next.path[1] : [at[0], at[1] - 1];
  g.rotation.y = Math.atan2(bx - ax, bz - az);
  tag.position.set(at[0], 2.3 * (d.scale || 1), at[1]);
}
// move the escort s.d along its leg (spd m/s for dt seconds; dt 0 just places it), sliding off any cover in the way
function walkVip(s, dt, spd = 0, rdt = dt){
  const v = M.vip, g = v.g, P = s.P;
  s.d = Math.min(P.len, s.d + spd * dt);
  const d = Math.min(s.d, P.len - 1e-4);
  let k = 0; while (k < P.pts.length - 2 && d > P.cum[k+1]) k++;
  const a = P.pts[k], b = P.pts[k+1], t = (d - P.cum[k]) / (P.cum[k+1] - P.cum[k] || 1);
  const want = V3(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
  if (dt) collideSolids(want, 0.6, false);
  const dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
  g.position.set(want.x, 0, want.z);
  g.rotation.y += Math.atan2(Math.sin(dir - g.rotation.y), Math.cos(dir - g.rotation.y)) * Math.min(1, (rdt || 1) * 8);
  updateLegs(v, g, rdt, 'ground'); updateUpper(v, g, rdt, null);
  v.tag.position.set(g.position.x, 2.3 * (v.def.scale || 1) + Math.sin(G.gt * 5) * 0.1, g.position.z);
}
function vipDown(){
  const v = M.vip;
  burst(V3(v.g.position.x, 1.0, v.g.position.z), 0xffa040, 26, 8, 4, 1);
  showBanner(v.def.name + ' IS DOWN', 'Back to the start of this leg.', 2.6, { kicker: 'MISSION FAILED' });
  S.uiDeny();
  M.failT = 2.8;
}

// the duel's opponent: an existing duellist, scaled up into a champion with its own bar and a sharper profile
function spawnInquisitor(o, at = o.at, opts = {}){
  const e = fieldSpawn(o.foe, at[0], at[1]);
  e.champion = true;
  e.hp = e.maxHp = Math.round(e.hp * o.hp * heroScale(SCALE.bossHp, heroesHere()));
  e.t = { ...e.t, dmg: e.t.dmg * o.dmg, score: 20 };   // a copy: never mutate the shared type
  // a FORM MASTER (the trials): it fights in the form it teaches (data/duel.js FORM_DUEL), its blade in that form's colour
  const F = o.form && e.dp && FORM_DUEL[o.form];
  if (F){
    e.form = o.form;
    initDuel(e, { ...F, ...o.duel });
    const glow = e.group.userData.bladeGlow;
    if (glow) glow.material.color.setHex(STANCES[o.form].blade);
  } else if (e.dp) e.dp = { ...e.dp, ...o.duel };
  e.group.scale.multiplyScalar(o.scale);
  e.group.userData.bodyMat.color.lerp(new THREE.Color(o.tint), 0.5);
  makeBossBar(e);
  burst(V3(e.group.position.x, 1.2, e.group.position.z), o.tint, 24, 8, 5, 1);
  G.shake = Math.max(G.shake, 0.7);
  showBanner(o.name, opts.line || 'One blade. No one else.', 2.4, { kicker: opts.kicker || 'DUEL' });
  S.roar(e.group.position); MUSIC.waveSting();
  return e;
}

// the next post of a capture: its beacon, and the guard that holds it
function startPost(o, s){
  const c = o.posts[s.k], spot = findClearSpawn(c.at[0], c.at[1], 1.4);
  const m = makeBeacon(spot.x, spot.z, 0, RED, o.r / 0.9);
  M.markers.push(m);
  for (const t in c.guards) for (let n = 0; n < c.guards[t]; n++)
    fieldSpawn(t, spot.x + (Math.random() - 0.5) * o.r * 1.4, spot.z + (Math.random() - 0.5) * o.r * 1.4);
  s.cur = { x: spot.x, z: spot.z, m, prog: 0 };
}

function beginObjective(){
  const o = forHero(M.def.objectives[M.i]);
  M.o = o; M.s = {};
  showBanner(o.title, (o.task && heroKey(o.task)) || '', 4.5, { kicker: 'OBJECTIVE ' + (M.i + 1) + ' / ' + M.def.objectives.length });   // long enough to read mid-fight; the checklist flashes with it (ui/hud.js)
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
  if (!M.chapter) autosave('mission');   // (a chapter's win is saved as the next chapter starts)
  // a campaign chapter's card carries the chapter's clear lines (what the mission taught, who joins), not a second voice line on the comms strip
  const clearLines = M.chapter && M.chapter.clear;
  showPanel(missionVoice(), clearLines && clearLines.length ? clearLines.join(' ') : heroKey(def.done), '', M.chapter ? 'Chapter complete' : 'Mission complete', { drill: true, done: true });
  if (!M.guest && hooks.missionDone) hooks.missionDone();   // co-op: the guest's mission ends with it
  if (M.chapter){   // a campaign chapter: no victory screen, the run carries on into the next chapter (game/campaign.js)
    M.panelT = 6; M.o = null;
    showBanner('CHAPTER COMPLETE', M.title, 2.4);
    M.chapter.done();
    return;
  }
  endRun(true);
  G.mode = 'victory'; G.slowmo = 1; G.slowmoT = 0;
  showBanner('MISSION COMPLETE', M.title, 999);
  setTimeout(() => {
    if (G.mode !== 'victory') return;
    document.exitPointerLock();
    overlay.style.display = 'flex';
    setOverlayState('victory');
    document.getElementById('ovsub').textContent = 'MISSION COMPLETE · ' + M.title;
  }, 1600);
}

/* called every frame from the main loop while playing (dt is 0 while paused) */
export function updateMission(dt){
  if (!M.on) return;
  if (!G.mission){ clearMission(); return; }   // left the mission (main menu, another mode)
  if (M.guest){ updateMissionGuest(dt); return; }
  bannerTap.fn = hooks.mbanner;   // co-op: what this banner says, the guest's screen says too
  try { updateMissionHost(dt); } finally { bannerTap.fn = null; }
}
function updateMissionHost(dt){
  M.fx = M.fx.filter(f => f(dt));
  updateBattleFx(dt);
  if (M.panelT > 0 && (M.panelT -= dt) <= 0) hidePanel();
  if (M.failT > 0){ if ((M.failT -= dt) <= 0) startMission(M.def.id, M.i, false, { chapter: M.chapter, retry: true }); return; }   // it got away: this leg again
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
  else if (M.o.kind === 'escort'){ M.s.d = M.s.P.len; walkVip(M.s, 0); completeObjective(); }   // it reaches the end of its leg
  else completeObjective();
  return true;
}
// the on-screen checklist: the mission's objectives, ticked off as they fall
// where the live objective is, for the HUD's waypoint arrow (ui/hud.js); null when there's no spot to point at.
// Multi-part objectives (charges, consoles, posts) point at the nearest part still to do: a finished part's marker turns green and is skipped.
// A pursuit points at its quarry, or the spot it was last seen, not at a shortcut lane.
// a finished part: flagged by the host, or (a co-op guest only sees the synced colour) tinted green, within a channel or two since colours round-trip through linear space
const isDoneMarker = k => {
  if (k.userData.done) return true;
  const h = k.userData.ring.material.color.getHex();
  return Math.abs((h >> 16) - (GREEN >> 16)) < 4 && Math.abs(((h >> 8) & 255) - ((GREEN >> 8) & 255)) < 4 && Math.abs((h & 255) - (GREEN & 255)) < 4;
};
export function objectiveTarget(){
  if (!M.on || !M.o || M.won) return null;
  if (M.o.kind === 'pursuit'){
    const s = M.s, q = M.quarry;
    if (s && s.last && s.last.visible) return s.last.position;
    return q ? q.g.position : (M.net && M.net.q ? V3(M.net.q[0], 0, M.net.q[2]) : null);
  }
  const pp = playerPos();
  let best = null, bd = Infinity;
  for (const k of M.markers){
    if (!k || k.visible === false || !k.userData || !k.userData.ring || isDoneMarker(k)) continue;
    const d = Math.hypot(k.position.x - pp.x, k.position.z - pp.z);
    if (d < bd){ bd = d; best = k; }
  }
  return best ? best.position : null;
}
export function missionChecklist(){
  if (!M.on) return null;
  const objs = M.def.objectives.map(forHero), live = objectiveHud();
  const items = objs.map((o, k) => {
    // legs of one chase share a title: number them so the list reads as steps
    const same = objs.filter(x => x.title === o.title);
    const now = k === M.i && !M.won;
    return { text: o.title + (same.length > 1 ? ' (' + (same.indexOf(o) + 1) + '/' + same.length + ')' : ''), done: k < M.i || M.won, now,
             sub: now ? [o.task && heroKey(o.task), live && live.status].filter(Boolean) : null, frac: now && live ? live.frac : null };
  });
  return { title: 'MISSION OBJECTIVES', items };
}
// dev console / tests: the running mission's state (the quarry, the current objective's state)
export const missionState = () => M;
// how far through the mission (the atmosphere's mood follows it)
export function missionProgress(){ return M.on ? M.i / Math.max(1, M.def.objectives.length - 1) : 0; }

/* ============================================================
   CO-OP — the host runs the mission; a guest is shown it (net/foes.js carries missionSnap in the host's snapshots)
   ============================================================ */
const r2 = (n) => Math.round(n * 100) / 100;
// what the guest needs to see of this mission right now: which objective, the objective line, the markers, who is running and who is being walked
export function missionSnap(){
  if (!M.on || M.guest) return null;
  const hud = objectiveHud(), q = M.quarry, v = M.vip;
  return { id: M.def.id, run: M.run, hh: G.hero, i: M.i, b: M.o ? 1 : 0, f: M.failT > 0 ? 1 : 0,
    hud: hud ? [hud.status || '', hud.frac == null ? -1 : r2(hud.frac), hud.warn ? 1 : 0] : null,
    mk: M.markers.map(m => [m.userData.con ? 1 : 0, r2(m.position.x), r2(m.position.z), r2(m.userData.r || 1), m.userData.ring.material.color.getHex(),
                            m.userData.beam.visible ? 1 : 0, m.visible ? 1 : 0, r2(m.userData.yaw || 0)]),
    q: q ? [r2(q.g.position.x), r2(q.g.position.y), r2(q.g.position.z), r2(q.g.rotation.y), q.tag.visible ? 1 : 0] : null,
    v: v ? [r2(v.g.position.x), r2(v.g.position.z), r2(v.g.rotation.y)] : null };
}
// guest: follow the host's mission
export function coopMissionSync(ms){
  if (!M.on || !M.guest || !ms || M.def.id !== ms.id) return;
  if (ms.run !== M.run){   // the host started the mission (or this leg of it) over
    for (const m of M.markers) removeMarker(m);
    M.markers = [];
    for (const p of M.props) scene.remove(p);
    M.props = []; M.quarry = null; M.vip = null; M.begun = -1; M.i = -1; M.run = ms.run;
  }
  if (ms.i !== M.i){
    if (M.i >= 0){ MUSIC.objectiveSting(); patchUp(); }   // the last objective is done: this hero's own breather too
    M.i = ms.i;
  }
  if (ms.b && M.begun !== ms.i){
    M.begun = ms.i;
    M.o = forHero(M.def.objectives[ms.i]);
    say(M.o);
  }
  M.net = ms;
  while (M.markers.length > ms.mk.length) removeMarker(M.markers.pop());
  ms.mk.forEach((r, k) => {
    let m = M.markers[k];
    if (m && !!m.userData.con !== !!r[0]){ removeMarker(m); m = null; }
    if (!m) m = M.markers[k] = r[0] ? makeConsole(r[1], r[2], r[7], r[4]) : makeBeacon(r[1], r[2], 0, r[4], r[3] / 0.9);
    m.position.set(r[1], 0, r[2]);
    setMarkerColor(m, r[4]);
    m.userData.beam.visible = !!r[5]; m.visible = !!r[6];
  });
  if (ms.q && !M.quarry && M.def.quarry) M.quarry = makeQuarry(M.def.quarry[ms.hh]);
  else if (!ms.q && M.quarry){ const q = M.quarry; scene.remove(q.g, q.tag); M.props = M.props.filter(p => p !== q.g && p !== q.tag); M.quarry = null; }
  if (ms.v && !M.vip && M.def.escort) buildVip(M.def.escort[ms.hh]);
  const hud = ms.hud;
  if (M.o && hud) setObjectiveHud({ kicker: M.kick, title: M.o.title, frac: hud[1] < 0 ? null : hud[1], status: hud[0], warn: !!hud[2] });
}
function updateMissionGuest(dt){
  M.fx = M.fx.filter(f => f(dt));
  updateBattleFx(dt);
  if (M.panelT > 0 && (M.panelT -= dt) <= 0) hidePanel();
  const ms = M.net;
  if (!ms) return;
  for (const m of M.markers) if (m.visible) pulseMarker(m, dt, G.gt);
  const k = 1 - Math.exp(-14 * dt), ang = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  if (M.quarry && ms.q){
    const q = M.quarry, g = q.g, w = ms.q;
    g.position.x += (w[0] - g.position.x) * k; g.position.y += (w[1] - g.position.y) * k; g.position.z += (w[2] - g.position.z) * k;
    g.rotation.y += ang(g.rotation.y, w[3]) * k; g.rotation.x = 0;
    q.tag.visible = !!w[4]; q.tag.position.set(g.position.x, g.position.y + 2.7 * (q.def.scale || 1) + Math.sin(G.gt * 5) * 0.12, g.position.z);
    updateLegs(q, g, dt, 'ground'); updateUpper(q, g, dt, nearHero(g.position.x, g.position.z).pos);
  }
  if (M.vip && ms.v){
    const v = M.vip, g = v.g, w = ms.v;
    g.position.x += (w[0] - g.position.x) * k; g.position.z += (w[1] - g.position.z) * k; g.rotation.y += ang(g.rotation.y, w[2]) * k;
    v.tag.position.set(g.position.x, 2.3 * (v.def.scale || 1) + Math.sin(G.gt * 5) * 0.1, g.position.z);
    updateLegs(v, g, dt, 'ground'); updateUpper(v, g, dt, null);
  }
}
// the host finished the mission: this browser's ends too
export function coopMissionDone(){ if (M.on && M.guest && G.mode === 'play') missionComplete(); }
