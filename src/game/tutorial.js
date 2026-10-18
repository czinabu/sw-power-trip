// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TRAINING: runs the tutorial (data/tutorial.js) step by step, and the short unlock drills in a real run.

import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, G, enemies, player } from '../state.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { CFG } from '../data/config.js';
import { floater } from '../fx/floaters.js';
import { setStanceHud } from '../player/jedi/stance.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { cleanupDuel } from '../enemies/duel.js';
import { startLevel, queueSpawn } from './flow.js';
import { applyJetTier } from './progression.js';
import { showBanner } from '../ui/banners.js';
import { setTutListener } from './tutor-bus.js';
import { showPanel, setPanelCount as setCount, hidePanel, makeBeacon, removeMarker, pulseMarker } from './objectives.js';
import { TRAINING, TRAINING_LEVELS, TEACHER, BEACON, TRAINING_DONE, DRILLS } from '../data/tutorial.js';

function clearBeacons(){
  for (const b of T.beacons) removeMarker(b);
  T.beacons = [];
}

/* ============================================================
   THE RUN OF LESSONS
   ============================================================ */
const T = { on: false, hero: 'jedi', steps: [], i: 0, count: 0, wait: 0, done: false, finished: false, exitT: 0,
            spawned: [], beacons: [], forms: null, seen: null, cp: 0, cpAfter: false, hintT: 0, lowSeen: false };
let exitTraining = () => {};
export function setTrainingExit(fn){ exitTraining = fn; }
export function trainingDone(hero){ try { return localStorage.getItem('sw_trained_' + hero) === '1'; } catch(e){ return false; } }

export function startTutorial(){
  endTutorial();
  startLevel(0, { level: TRAINING_LEVELS[G.hero], training: true });
  Object.assign(T, { on: true, hero: G.hero, steps: TRAINING[G.hero], i: 0, count: 0, wait: 2.8, done: false, finished: false, exitT: 0, forms: null });
  setTutListener(onEvent);
  hidePanel();
}
export function endTutorial(){
  if (!T.on) return;
  T.on = false;
  setTutListener(null);
  clearSpawned();
  clearBeacons();
  hidePanel();
}
// SKIP LESSON (pause menu): move on without the credit
export function skipStep(){
  if (!T.on || T.finished || T.done || T.wait > 0) return;
  completeStep(true);
}

function step(){ return T.steps[T.i]; }
// the HUD's run line: where you are and which lesson
export function trainingProgress(){
  const L = TRAINING_LEVELS[T.hero];
  return { place: (L.name.split('—')[1] || L.name).trim(), lesson: Math.min(T.i + 1, T.steps.length), total: T.steps.length };
}
function beginStep(i){
  T.i = i; T.count = 0; T.done = false; T.forms = null; T.waveOut = false;
  T.seen = new Set(); T.cp = 0; T.cpAfter = false; T.lowSeen = false;
  const s = step();
  // a trial stage starts on an empty field: whatever a skipped stage left standing (or still marching in) goes too
  if (s.clear){
    for (const e of enemies) if (!T.spawned.some(sp => sp.e === e)) T.spawned.push({ e });
    G.spawnQueue.length = 0;
  }
  clearSpawned(); clearBeacons();
  if (s.sec) showBanner(s.sec, '', 2.2, { kicker: 'TRAINING' });
  if (s.grant === 'forms'){
    G.stanceUnlocked = { ...(G.stanceUnlocked || {}), fast: true, strong: true };
    setStanceHud();
  }
  if (s.grant === 'jet1' && !(player.up.jetTier >= 1)){ player.up.jetTier = 1; applyJetTier(); player.jet = player.jetMax; }
  if (s.grant === 'dual') G.unlocked = { ...(G.unlocked || {}), dual: true };
  // a fresh start for the trial: full health, Force and fuel
  if (s.heal){ player.hp = maxHp(); player.force = CFG.player.maxForce; player.stam = CFG.player.maxStam; if (G.hero === 'mando') player.jet = player.jetMax; }
  if (s.poll === 'forms') T.forms = new Set();
  const col = BEACON[T.hero];
  if (s.reach) T.beacons.push(makeBeacon(s.reach[0], s.reach[1], s.reach[2] || 0, col));
  if (s.mark) T.beacons.push(makeBeacon(s.mark[0], s.mark[1], s.mark[2] || 0, col));
  if (s.course){ const c = s.course[0].at; T.beacons.push(makeBeacon(c[0], c[1], c[2] || 0, col)); }
  if (s.spawn === 'wave'){
    for (const type in s.wave) for (let n = 0; n < s.wave[type]; n++) queueSpawn(type);
    T.waveOut = true;
  } else if (s.spawn) for (const spec of s.spawn) placeFoe(spec);
  showPanel(TEACHER[T.hero], s.say, s.course ? s.course[0].keys : s.keys, s.course ? s.course[0].do : s.do, { count: countText(s) });
  sfx(660, 0.08, 'sine', 0.04, 880);
}
function spawnFoe(spec){
  spawnEnemy(spec.type, V3(spec.at[0], 0, spec.at[1]));
  const e = enemies[enemies.length - 1];
  e.dummy = !!spec.dummy; e.sparring = !!spec.sparring; e.rooted = !!spec.rooted; e.home = { x: spec.at[0], z: spec.at[1] };
  return e;
}
function placeFoe(spec){ T.spawned.push({ e: spawnFoe(spec), spec, downT: 0 }); }
function clearSpawned(){
  for (const sp of T.spawned){
    const e = sp.e, i = enemies.indexOf(e);
    if (i < 0) continue;
    if (!e.dead) burst(V3(e.group.position.x, 1.2, e.group.position.z), BEACON[T.hero], 10, 4, 3, 0.8);
    scene.remove(e.group); cleanupDuel(e);
    if (e.hpBar) scene.remove(e.hpBar);
    enemies.splice(i, 1);
  }
  T.spawned = [];
}
function countText(s){
  if (s.reach || s.clear) return '';
  if (s.course) return Math.min(T.cp, s.course.length) + ' / ' + s.course.length;
  if (s.poll === 'refuel') return T.lowSeen ? 'NOW LAND' : Math.round(player.jet / player.jetMax * 100) + '% FUEL';
  if (s.poll && s.poll !== 'forms') return Math.min(100, Math.round(T.count / s.need * 100)) + '%';
  return Math.min(T.count, s.need) + ' / ' + s.need;
}
function onEvent(name, data){
  if (!T.on || T.done || T.wait > 0) return;
  const s = step();
  if (!s) return;
  // a course checkpoint that asks for a move (vault the blocks, roll the drop) is armed by doing it on the way there
  if (s.course){ const cp = s.course[T.cp]; if (cp && cp.after === name) T.cpAfter = true; return; }
  if (s.ev !== name) return;
  if (s.of && (!data || data.type !== s.of)) return;
  if (s.stance && G.stance !== s.stance) return;      // only counts in the form the lesson is about
  if (s.weapon && player.weapon !== s.weapon) return;  // ... or with the loadout it's about
  if (s.uniq){ const v = data && data[s.uniq]; if (v == null || T.seen.has(v)) return; T.seen.add(v); }
  T.count++;
  sfx(880 + T.count * 90, 0.06, 'triangle', 0.035, 1100);
  if (T.count >= s.need) completeStep(false);
  else setCount(countText(s));
}
function completeStep(skipped){
  const s = step();
  T.done = true;
  setCount(skipped ? 'SKIPPED' : '✓', true);
  if (!skipped){ S.reward(1); burst(V3(playerPos().x, 1.4, playerPos().z), BEACON[T.hero], 14, 6, 4, 0.8); }
  T.wait = s.clear ? 2.2 : 1.6;
  if (T.i + 1 >= T.steps.length) finish();
}
function finish(){
  T.finished = true; T.exitT = 6.5;
  try { localStorage.setItem('sw_trained_' + T.hero, '1'); } catch(e){}
  setTimeout(() => {
    if (!T.on) return;
    clearBeacons();
    showPanel(TEACHER[T.hero], TRAINING_DONE[T.hero], '', 'Training complete', { done: true });
    showBanner('TRAINING COMPLETE', '', 3.2, { kicker: T.hero === 'mando' ? 'THE ARMORER\'S FORGE' : 'THE TRAINING HALL' });
    MUSIC.clearSting();
  }, 1200);
}

/* THE COURSE — a run of checkpoints, one beacon at a time. A checkpoint can ask to be passed sliding (the slide gate),
   or for a move done on the way to it (`after`: vault the blocks, roll out of the drop); `hint` says so if you skip it. */
function updateCourse(s, pp){
  const cp = s.course[T.cp];
  const [x, z, y] = cp.at, r = cp.r || (y ? 2.2 : 1.8);
  if (Math.hypot(pp.x - x, pp.z - z) >= r || (y && pp.y < y - 0.6) || (cp.land && !player.grounded)) return;
  const missing = (cp.slide && !(player.slideT > 0)) || (cp.after && !T.cpAfter);
  if (missing){
    if (G.gt > T.hintT){ T.hintT = G.gt + 1.6; floater(pp, cp.hint || 'AGAIN', '#ffe27a'); sfx(260, 0.06, 'triangle', 0.03, 200); }
    return;
  }
  T.cp++; T.cpAfter = false;
  clearBeacons();
  if (T.cp >= s.course.length){ completeStep(false); return; }
  sfx(880 + T.cp * 90, 0.06, 'triangle', 0.035, 1100);
  const nx = s.course[T.cp];
  T.beacons.push(makeBeacon(nx.at[0], nx.at[1], nx.at[2] || 0, BEACON[T.hero]));
  showPanel(TEACHER[T.hero], s.say, nx.keys, nx.do, { count: countText(s) });
}

const POLL = {
  glide: () => player.gliding && !player.grounded,
  sprint: () => player.sprinting,
  boost: () => player.boosting && !player.grounded,
  single: () => player.weapon === 'single',
};
function updateLesson(dt){
  if (T.finished){
    if (dt > 0 && (T.exitT -= dt) <= 0){ endTutorial(); exitTraining(); }
    return;
  }
  if (T.wait > 0){
    T.wait -= dt;
    if (T.wait <= 0){ if (T.done) T.i++; beginStep(T.i); }
    return;
  }
  const s = step();
  if (!s || T.done) return;
  const pp = playerPos();
  for (const b of T.beacons) pulseMarker(b, dt, G.gt);
  if (s.reach){
    const [x, z, y] = s.reach;
    if (Math.hypot(pp.x - x, pp.z - z) < (y ? 2.2 : 1.6) && (!y || pp.y > y - 0.6)) completeStep(false);
  } else if (s.course){
    updateCourse(s, pp);
  } else if (s.poll === 'refuel'){
    // burn the jetpack's tank low, then land and watch it fill back up
    const k = player.jet / player.jetMax;
    if (!T.lowSeen && k < 0.25){ T.lowSeen = true; sfx(880, 0.06, 'triangle', 0.035, 1100); }
    if (T.lowSeen && player.grounded && k > 0.95) completeStep(false);
    else setCount(countText(s));
  } else if (s.poll === 'forms'){
    if (player.atkT > 0 && !T.forms.has(G.stance)){
      T.forms.add(G.stance); T.count = T.forms.size;
      sfx(880 + T.count * 90, 0.06, 'triangle', 0.035, 1100);
      if (T.count >= s.need) completeStep(false); else setCount(countText(s));
    }
  } else if (s.poll){
    if (POLL[s.poll]()){
      T.count += dt;
      if (T.count >= s.need) completeStep(false); else setCount(countText(s));
    }
  } else if (s.clear){
    if (T.waveOut && G.spawnQueue.length === 0 && !enemies.some(e => !e.dead && !e.converted)) completeStep(false);
  }
  // put fallen targets back up while the lesson still needs them
  if (s.respawn && !T.done){
    for (const sp of T.spawned){
      if (!sp.e.dead) continue;
      if ((sp.downT += dt) > 1.2){
        const i = enemies.indexOf(sp.e);
        if (i >= 0){ scene.remove(sp.e.group); cleanupDuel(sp.e); enemies.splice(i, 1); }
        sp.e = spawnFoe(sp.spec); sp.downT = 0;
      }
    }
  }
}

/* ============================================================
   UNLOCK DRILLS — in a real run, each newly earned ability gets the teacher's line and a moment to try it
   ============================================================ */
const D = { run: null, owned: null, queue: [], cur: null };
function ownedNow(){
  const o = new Set(Object.keys(G.unlocked || {}).filter(k => G.unlocked[k]));
  const su = G.stanceUnlocked || {};
  if (su.fast) o.add('fast'); if (su.strong) o.add('strong');
  const up = player.up || {};
  if (G.hero === 'mando'){ if (up.jetTier >= 1) o.add('jet1'); if (up.jetTier >= 2) o.add('jet2'); if (up.darksaber) o.add('darksaber'); }
  else { if (up.fjTier >= 1) o.add('fj1'); if (up.fjTier >= 2) o.add('fj2'); }
  return o;
}
function used(u){
  if (!u) return false;
  if (u[0] === 'cd') return (player.cds[u[1]] || 0) > 0;
  if (u[0] === 'stance') return G.stance === u[1];
  if (u[0] === 'weapon') return player.weapon === u[1];
  if (u[0] === 'flag') return !!player[u[1]];
  return false;
}
function updateDrills(dt){
  const run = G.hero + ':' + (G.stats ? G.stats.startGt : 0);
  if (D.run !== run){ D.run = run; D.owned = ownedNow(); D.queue = []; if (D.cur){ D.cur = null; hidePanel(); } return; }
  const now = ownedNow();
  for (const k of now) if (!D.owned.has(k) && DRILLS[G.hero][k]) D.queue.push(k);
  D.owned = now;
  if (G.skillSelect || dt <= 0) return;
  if (!D.cur && D.queue.length){
    const k = D.queue.shift(), d = DRILLS[G.hero][k];
    // already in use (e.g. dual blasters equip themselves): count it as tried from the next use, not this one
    D.cur = { d, t: d.use ? 14 : 6, was: used(d.use), ok: false, okT: 0 };
    showPanel(TEACHER[G.hero], d.say, d.key, d.use ? 'Try it now' : '', { drill: true });
  }
  if (!D.cur) return;
  const c = D.cur;
  if (c.ok){ if ((c.okT -= dt) <= 0){ D.cur = null; hidePanel(); } return; }
  const u = used(c.d.use);
  if (u && !c.was){ c.ok = true; c.okT = 1.4; setCount('✓', true); S.reward(1); return; }
  c.was = u;
  if ((c.t -= dt) <= 0){ D.cur = null; hidePanel(); }
}

/* called every frame from the main loop (dt is 0 while paused) */
export function updateTutorial(dt){
  if (T.on){
    if (!G.training){ endTutorial(); return; }   // left training (main menu, a new run)
    if (G.mode === 'play') updateLesson(dt);
    return;
  }
  if (G.mode === 'play' && !G.training) updateDrills(dt);
  else if (D.cur && G.mode !== 'play'){ D.cur = null; hidePanel(); }
}
