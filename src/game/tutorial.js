// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TRAINING: runs the training grounds' lessons (data/tutorial.js) step by step, the LESSON BOARD between them, and the
// short unlock drills in a real run.

import { autosave } from './autosave.js';
import { sfx, S, audioInit } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, G, enemies, player, keys, isGunner, heroKey } from '../state.js';
import { playerPos, maxHp, maxStam, heldGrip } from '../player/helpers.js';
import { CFG } from '../data/config.js';
import { floater } from '../fx/floaters.js';
import { setStanceHud, setLoadout, switchStance } from '../player/jedi/stance.js';
import { switchWeapon } from '../player/mando/weapons.js';
import { toggleHolster } from '../player/holster.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { startLevel, queueSpawn, syncMandoChips, syncJediChips } from './flow.js';
import { applyJetTier } from './progression.js';
import { upToast } from './upgrades.js';
import { storyReached, refreshSandboxScope } from './sandbox-unlocks.js';
import { renderer } from '../engine/renderer.js';
import { showBanner } from '../ui/banners.js';
import { setTutListener } from './tutor-bus.js';
import { showPanel, setPanelCount as setCount, hidePanel, makeBeacon, removeMarker, pulseMarker } from './objectives.js';
import { LESSONS, LESSON_GROUPS, TRAINING_LEVELS, TEACHER, BEACON, DRILLS } from '../data/tutorial.js';
import { FORMS, cleanLoadout } from '../data/forms.js';
import { MASTERY_JEDI, MASTERY_MANDO } from '../data/mastery.js';

function clearBeacons(){
  for (const b of T.beacons) removeMarker(b);
  T.beacons = [];
}

/* ============================================================
   THE LESSONS — which are open, which are done
   ============================================================ */
const T = { on: false, hero: 'jedi', lesson: null, steps: [], i: 0, count: 0, wait: 0, done: false, finished: false, exitT: 0,
            next: null, spawned: [], beacons: [], seen: null, cp: 0, cpAfter: false, hintT: 0, lowSeen: false, was: false };
let exitTraining = () => {};
let retryId = null;   // the lesson to put the hero back into after a fall (RETRY on the death screen)
export function setTrainingExit(fn){ exitTraining = fn; }
// the basics passed (the first-run prompt and the menu's tick read this)
export function trainingDone(hero){ try { return localStorage.getItem('sw_trained_' + hero) === '1'; } catch(e){ return false; } }
const lessonKey = (hero, id) => 'sw_lesson_' + hero + '_' + id;
// (a hero who passed the old, single-course training has passed the basics)
export function lessonDone(hero, id){
  if (trainingDone(hero) && LESSONS[hero].some(L => L.id === id && L.group === 'basics')) return true;
  try { return localStorage.getItem(lessonKey(hero, id)) === '1'; } catch(e){ return false; }
}
// a lesson is open once the story has reached what it teaches (the basics always are)
export function lessonOpen(L){
  if (L.form) return storyReached(L.form);
  if (L.kit) return storyReached(L.kit);
  if (L.any) return L.any.some(storyReached);
  return true;
}
// every lesson for this hero, as the board shows it
export function lessonList(hero = G.hero){
  refreshSandboxScope();
  return LESSONS[hero].map(L => ({ L, open: lessonOpen(L), done: lessonDone(hero, L.id) }));
}
// what the board suggests: the first basic not passed, else the first open lesson not passed
function suggested(list){
  const b = list.find(x => x.L.group === 'basics' && !x.done);
  return (b || list.find(x => x.open && !x.done) || null);
}

/* the forms the story has taught, and the three the training carries when a lesson doesn't name its own: Shii-Cho and
   the two most advanced forms after it */
const storyForms = () => Object.keys(FORMS).filter(id => FORMS[id].ready && storyReached(id));
export function trainingLoadout(){ const k = storyForms().filter(id => id !== 'shiicho'); return cleanLoadout(['shiicho', ...k.reverse()]); }
// the kit the training starts every lesson on: the starting kit, plus what the story hands out on its own along the way
function baseKit(){
  if (T.hero === 'mando'){
    G.unlocked = { rocket: true, dual: storyReached('dual'), flame: storyReached('flame') };
    player.up.darksaber = false;
    if (player.weapon !== 'single' && player.weapon !== 'fists') switchWeapon('single');
  } else {
    G.unlocked = { push: true, dash: true, pull: storyReached('pull') };
    G.stanceUnlocked = Object.fromEntries(storyForms().map(id => [id, true]));
  }
}

/* ============================================================
   THE RUN OF LESSONS
   ============================================================ */
export function startTutorial(){
  endTutorial();
  startLevel(0, { level: heroKey(TRAINING_LEVELS), training: true });
  Object.assign(T, { on: true, hero: G.hero, lesson: null, steps: [], i: 0, count: 0, done: false, finished: false, exitT: 0 });
  baseKit();
  if (!isGunner()){ setLoadout(trainingLoadout()); switchStance('shiicho', true); setStanceHud(); }
  setTutListener(onEvent);
  hidePanel();
  // a lesson to go back to after a fall, else the lesson board (it opens before every visit, new saves included)
  const back = retryId && lessonList().find(x => x.L.id === retryId && x.open);
  retryId = null;
  T.next = back ? back.L : 'board';
  T.wait = 2.8;   // the arrival banner first
}
// RETRY after a fall: the same lesson again, from its start
// the lesson for a form, to open the training on (the unlock screen's TRAIN button): Shien shares Form V's, Vaapad Form VII's
const LESSON_OF = { shien: 'formv', vaapad: 'formvii' };
export function trainOnForm(formId){
  const L = LESSONS.jedi.find(x => x.id === LESSON_OF[formId] || x.form === formId);
  retryId = L ? L.id : null;
}
export function retryTutorial(){ retryId = T.lesson ? T.lesson.id : null; startTutorial(); }
export function endTutorial(){
  if (!T.on) return;
  T.on = false;
  if (T.hero !== 'mando' && player.holstered) toggleHolster();   // leave with the blade drawn, whatever the lesson left
  setTutListener(null);
  clearSpawned();
  clearBeacons();
  hidePanel();
  closeBoard(true);
}
// SKIP LESSON (pause menu): move on without the credit
export function skipStep(){
  if (!T.on || T.finished || T.done || T.wait > 0 || !T.lesson) return;
  completeStep(true);
}

function beginLesson(L){
  T.lesson = L; T.finished = false; T.i = 0;
  T.steps = L.steps.filter(s => !s.needs || storyReached(s.needs));   // a step about something the story hasn't reached yet waits
  baseKit();
  if (T.hero !== 'mando'){
    setLoadout(L.loadout || trainingLoadout());
    if (!!player.holstered !== !!L.holstered) toggleHolster();   // movement lessons keep the saber on the belt; the blade lesson ignites it
    switchStance(G.loadout.find(Boolean) || 'shiicho', true); setStanceHud();
  }
  player.hp = maxHp(); player.force = CFG.player.maxForce; player.stam = maxStam();
  // every lesson starts at its station, facing the circle (the forge): the first steps from the entry, the rest from its edge
  const [sx, sz] = L.start || (L.group === 'basics' && heroKey(LESSONS, T.hero)[0] === L ? [0, 12] : [0, 7]);
  playerPos().set(sx, 0, sz); if (player.vel) player.vel.set(0, 0, 0); player.vy = 0;
  G.yaw = Math.PI; player.faceYaw = Math.PI;
  burst(V3(sx, 1.2, sz), heroKey(BEACON, T.hero), 12, 4, 3, 0.8);
  showBanner(L.name, L.sub, 2.4, { kicker: 'LESSON' });
  beginStep(0);
}

function step(){ return T.steps[T.i]; }
// the HUD's run line: where you are and which lesson
export function trainingProgress(){
  const L = heroKey(TRAINING_LEVELS, T.hero);
  return { place: (L.name.split('—')[1] || L.name).trim(), name: T.lesson ? T.lesson.name : 'BETWEEN LESSONS',
           lesson: Math.min(T.i + 1, T.steps.length), total: T.steps.length };
}
// the on-screen checklist: each step's task in short, ticked off as it passes
export function trainingChecklist(){
  if (!T.on || !T.lesson) return null;
  const items = T.steps.map((s, k) => ({
    text: (s.do || (s.course && s.course[0].do) || s.sec || '').split(':')[0],
    done: k < T.i || (k === T.i && (T.done || T.finished)), now: k === T.i && !T.done && !T.finished }));
  return { title: T.lesson.name, items };
}
function beginStep(i){
  T.i = i; T.count = 0; T.done = false; T.waveOut = false;
  T.seen = new Set(); T.cp = 0; T.cpAfter = false; T.lowSeen = false;
  const s = step();
  // a trial stage starts on an empty field: whatever a skipped stage left standing (or still marching in) goes too
  if (s.clear){
    for (const e of enemies) if (!T.spawned.some(sp => sp.e === e)) T.spawned.push({ e });
    G.spawnQueue.length = 0;
  }
  clearSpawned(); clearBeacons();
  if (s.sec && i > 0) showBanner(s.sec, '', 2.2, { kicker: T.lesson.name });
  if (s.loadout && T.hero !== 'mando'){ setLoadout(s.loadout); switchStance(G.loadout.find(Boolean), true); setStanceHud(); }
  if (s.give){
    if (s.give.unlocked) G.unlocked = { ...(G.unlocked || {}), ...s.give.unlocked };
    if (s.give.up) Object.assign(player.up, s.give.up);
    if (s.give.unlocked){ if (isGunner()) syncMandoChips(); else syncJediChips(); }   // show the HUD tile for what was just handed over
  }
  // a heal lesson needs something to heal: chip vitality (and top up Force) so the self-heal isn't refused as UNHURT
  if (s.hurt){
    player.hp = Math.min(player.hp, Math.round(maxHp() * s.hurt));
    player.force = CFG.player.maxForce;
    floater(playerPos(), 'WOUNDED', '#ff8a7a');
  }
  if (s.grant === 'jet1' && !(player.up.jetTier >= 1)){ player.up.jetTier = 1; applyJetTier(); player.jet = player.jetMax; }
  if (s.grant === 'dual') G.unlocked = { ...(G.unlocked || {}), dual: true };
  // a fresh start for the trial: full health, Force and fuel
  if (s.heal){ player.hp = maxHp(); player.force = CFG.player.maxForce; player.stam = maxStam(); if (isGunner()) player.jet = player.jetMax; }
  if (s.use){ for (const k in player.cds) if (s.use[0] === 'cd' && k === s.use[1]) player.cds[k] = 0; T.was = used(s.use); }
  const col = heroKey(BEACON, T.hero);
  if (s.reach) T.beacons.push(makeBeacon(s.reach[0], s.reach[1], s.reach[2] || 0, col));
  if (s.mark) T.beacons.push(makeBeacon(s.mark[0], s.mark[1], s.mark[2] || 0, col));
  if (s.course){ const c = s.course[0].at; T.beacons.push(makeBeacon(c[0], c[1], c[2] || 0, col)); }
  if (s.spawn === 'wave'){
    for (const type in s.wave) for (let n = 0; n < s.wave[type]; n++) queueSpawn(type);
    T.waveOut = true;
  } else if (s.spawn) for (const spec of s.spawn) placeFoe(spec);
  showPanel(heroKey(TEACHER, T.hero), s.say, s.course ? s.course[0].keys : s.keys, s.course ? s.course[0].do : s.do,
    { count: countText(s), step: stepText() });
  sfx(660, 0.08, 'sine', 0.04, 880);
}
const stepText = () => T.lesson ? T.lesson.name + ' · ' + (T.i + 1) + ' / ' + T.steps.length : '';
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
    if (!e.dead) burst(V3(e.group.position.x, 1.2, e.group.position.z), heroKey(BEACON, T.hero), 10, 4, 3, 0.8);
    removeEnemy(e);
    enemies.splice(i, 1);
  }
  T.spawned = [];
}
function countText(s){
  if (s.reach || s.clear) return '';
  if (s.course) return Math.min(T.cp, s.course.length) + ' / ' + s.course.length;
  if (s.poll === 'refuel') return T.lowSeen ? 'NOW LAND' : Math.round(player.jet / player.jetMax * 100) + '% FUEL';
  if (s.poll && s.need <= 0.5) return '';
  if (s.poll) return Math.min(100, Math.round(T.count / s.need * 100)) + '%';
  return Math.min(T.count, s.need) + ' / ' + s.need;
}
// does the step's form, grip, footing and weapon hold right now
function inForm(s){
  if (s.stance && G.stance !== s.stance) return false;   // only counts in the form the lesson is about
  if (s.weapon && player.weapon !== s.weapon) return false;   // ... or with the loadout it's about
  if (s.grip && heldGrip() !== s.grip) return false;
  if (s.air && player.grounded) return false;
  return true;
}
function onEvent(name, data){
  if (!T.on || T.done || T.wait > 0 || !T.lesson) return;
  const s = step();
  if (!s) return;
  // a course checkpoint that asks for a move (vault the blocks, roll the drop) is armed by doing it on the way there
  if (s.course){ const cp = s.course[T.cp]; if (cp && cp.after === name) T.cpAfter = true; return; }
  if (s.ev !== name && s.alt !== name) return;   // `alt`: a second way to pass the lesson
  if (s.of && (!data || data.type !== s.of)) return;
  if (!inForm(s)) return;
  if (s.uniq){ const v = data && data[s.uniq]; if (v == null || T.seen.has(v)) return; T.seen.add(v); }
  tick(s);
}
function tick(s){
  T.count++;
  sfx(880 + T.count * 90, 0.06, 'triangle', 0.035, 1100);
  if (T.count >= s.need) completeStep(false);
  else setCount(countText(s));
}
function completeStep(skipped){
  const s = step();
  T.done = true;
  setCount(skipped ? 'SKIPPED' : '✓', true);
  if (!skipped){ S.reward(1); burst(V3(playerPos().x, 1.4, playerPos().z), heroKey(BEACON, T.hero), 14, 6, 4, 0.8); }
  if (!skipped && s.toast){
    const m = [...MASTERY_JEDI, ...MASTERY_MANDO].find(x => x.id === s.toast);
    if (m) upToast(m.nm + ' MASTERED I', m.ranks[0].ds.replace(/&amp;/g, '&') + ' · in a real fight, this comes from use', 'mast');
  }
  T.wait = s.clear ? 2.2 : 1.6;
  if (T.i + 1 >= T.steps.length) finishLesson(skipped);
}
// the last step passed: the lesson is marked (unless it was skipped to the end), the teacher closes it, then the board
function finishLesson(skipped){
  const L = T.lesson;
  T.finished = true; T.exitT = 4.2;
  if (!skipped || T.steps.some((s, k) => k < T.i)){
    try { localStorage.setItem(lessonKey(T.hero, L.id), '1'); } catch(e){}
    if (heroKey(LESSONS, T.hero).filter(x => x.group === 'basics').every(x => lessonDone(T.hero, x.id))){ try { localStorage.setItem('sw_trained_' + T.hero, '1'); } catch(e){} }
  }
  autosave('lesson');
  setTimeout(() => {
    if (!T.on || T.lesson !== L) return;
    clearBeacons();
    showPanel(heroKey(TEACHER, T.hero), L.done || '', '', 'Lesson complete', { done: true, step: L.name });
    showBanner('LESSON COMPLETE', L.name, 2.6, { kicker: T.hero === 'mando' ? 'THE ARMORER\'S FORGE' : 'THE TRAINING HALL' });
    MUSIC.clearSting();
  }, 900);
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
  T.beacons.push(makeBeacon(nx.at[0], nx.at[1], nx.at[2] || 0, heroKey(BEACON, T.hero)));
  showPanel(heroKey(TEACHER, T.hero), s.say, nx.keys, nx.do, { count: countText(s), step: stepText() });
}

const POLL = {
  glide: () => player.gliding && !player.grounded,
  sprint: () => player.sprinting,
  strafe: () => !!keys['alt'] && player.grounded && !!(keys['a'] || keys['d'] || keys['s']),   // ALT held (LB on a pad) while stepping sideways or back
  boost: () => player.boosting && !player.grounded,
  single: () => player.weapon === 'single',
  holstered: () => isGunner() ? player.weapon === 'fists' : !!player.holstered,
  drawn: () => !player.holstered,
  stance: (s) => G.stance === s.stance,
  grip: (s) => inForm(s),
};
function updateLesson(dt){
  if (T.wait > 0){
    T.wait -= dt;
    if (T.wait <= 0){
      if (T.next){ const n = T.next; T.next = null; if (n === 'board') openBoard(); else beginLesson(n); }
      else if (T.done && !T.finished){ T.i++; beginStep(T.i); }
    }
    return;
  }
  if (T.finished){
    if (dt > 0 && (T.exitT -= dt) <= 0){ T.finished = false; T.lesson = null; T.steps = []; clearSpawned(); hidePanel(); openBoard(); }
    return;
  }
  const s = step();
  if (!s || T.done || boardUp()) return;
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
  } else if (s.poll){
    if (POLL[s.poll](s)){
      T.count += dt;
      if (T.count >= s.need) completeStep(false); else setCount(countText(s));
    }
  } else if (s.use){
    // a power used: counted each time it starts (a cooldown kicks in, a flag goes up)
    const u = used(s.use);
    if (u && !T.was && inForm(s)) tick(s);
    T.was = u;
  } else if (s.clear){
    if (T.waveOut && G.spawnQueue.length === 0 && !enemies.some(e => !e.dead && !e.converted)) completeStep(false);
  }
  // put fallen targets back up while the lesson still needs them
  if (s.respawn && !T.done){
    for (const sp of T.spawned){
      if (!sp.e.dead) continue;
      if ((sp.downT += dt) > 1.2){
        const i = enemies.indexOf(sp.e);
        if (i >= 0){ removeEnemy(sp.e); enemies.splice(i, 1); }
        sp.e = spawnFoe(sp.spec); sp.downT = 0;
      }
    }
  }
}

/* ============================================================
   THE LESSON BOARD — between lessons: the basics, then the lessons the story has opened. A lesson about a form or a
   piece of gear the hero hasn't learned yet shows as a sealed card that names nothing.
   ============================================================ */
const board = document.getElementById('lessonboard');
const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
export const boardUp = () => !!board && board.classList.contains('open');
function openBoard(){
  if (!board || !T.on) return;
  const list = lessonList(T.hero), pick = suggested(list), N = heroKey(LESSON_GROUPS, T.hero);
  const card = (x) => {
    const L = x.L;
    if (!x.open) return '<div class="lb-card sealed"><b>' + (L.form ? N.sealed : N.sealedPower) + '</b><span>Opens when the story teaches it</span></div>';
    const fresh = !x.done && L.group !== 'basics';
    return '<div class="lb-card' + (x.done ? ' done' : '') + (pick === x ? ' sel' : '') + '" data-lesson="' + L.id + '">' +
      (fresh ? '<i class="lb-new">NEW</i>' : '') + '<b>' + esc(L.name) + '</b><span>' + esc(L.sub) + '</span>' +
      '<em>' + L.steps.filter(s => !s.needs || storyReached(s.needs)).length + ' steps' + (x.done ? ' · passed' : '') + '</em></div>';
  };
  const basics = list.filter(x => x.L.group === 'basics'), more = list.filter(x => x.L.group !== 'basics');
  const nb = basics.filter(x => x.done).length;
  const line = nb < basics.length
    ? (T.hero === 'mando' ? 'The basics first, foundling. Then the forge has more for you.' : 'The basics first, my young Padawan. Every form begins with them.')
    : more.some(x => x.open && !x.done)
      ? (T.hero === 'mando' ? 'The forge has made you something new. Learn it here before you take it into a fight.' : 'You have learned something new out there. Come, practise it here, where the cost of a mistake is small.')
      : (T.hero === 'mando' ? 'Train what you like. When the forge makes you more, I will teach it here.' : 'Train what you wish. Each form the masters teach you opens its own lesson here.');
  board.innerHTML = '<div class="cc-inner hero-' + T.hero + '"><div class="cc-act">TRAINING</div><h1 class="cc-title">THE LESSONS</h1>' +
    '<div class="cc-voice"><div class="cc-who">' + heroKey(TEACHER, T.hero) + '</div><p>' + line + '</p></div>' +
    '<div class="lb-sec">' + N.basics + '<span>' + nb + ' / ' + basics.length + '</span></div><div class="lb-grid">' + basics.map(card).join('') + '</div>' +
    '<div class="lb-sec">' + N.more + '<span>' + more.filter(x => x.open).length + ' open</span></div><div class="lb-grid">' + more.map(card).join('') + '</div>' +
    '<div class="cc-btns"><div class="btn" data-leave="1">LEAVE TRAINING</div>' +
    (pick ? '<div class="btn primary go" data-go="1">' + esc(pick.L.name) + '</div>' : '') + '</div>' +
    '<div class="cc-hint">Pick any open lesson · Enter starts the highlighted one · TAB pauses</div></div>';
  board.dataset.pick = pick ? pick.L.id : '';
  board.classList.add('open');
  G.skillSelect = true; G.cardUp = true;   // freeze the field and keep the pause screen away while the cursor is free
  document.exitPointerLock();
  hidePanel();
}
function closeBoard(quiet){
  if (!boardUp()) return;
  board.classList.remove('open');
  G.cardUp = false;
  if (!document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}
function choose(id){
  const L = heroKey(LESSONS, T.hero).find(x => x.id === id);
  if (!L || !lessonOpen(L)) return;
  closeBoard();
  clearSpawned(); clearBeacons();
  S.reward(1);
  beginLesson(L);
}
// LESSON BOARD on the pause screen: leave the lesson in progress and pick another
export function openLessonBoard(){
  if (!T.on) return;
  T.lesson = null; T.steps = []; T.done = false; T.finished = false; T.wait = 0; T.next = null;
  clearSpawned(); clearBeacons(); G.spawnQueue.length = 0;
  openBoard();
}
if (board){
  board.addEventListener('click', (e) => {
    e.stopPropagation(); audioInit();
    if (!boardUp()) return;
    const t = e.target, c = t.closest('[data-lesson]');
    if (c){ choose(c.dataset.lesson); return; }
    if (t.closest('[data-go]')){ choose(board.dataset.pick); return; }
    if (t.closest('[data-leave]')){ closeBoard(true); endTutorial(); exitTraining(); }
  });
  document.addEventListener('keydown', (e) => {
    if (!boardUp() || e.key !== 'Enter' || !board.dataset.pick) return;
    e.preventDefault(); e.stopPropagation(); choose(board.dataset.pick);
  }, true);
}

/* ============================================================
   UNLOCK DRILLS — in a real run, each newly earned ability gets the teacher's line and a moment to try it
   ============================================================ */
const D = { run: null, owned: null, queue: [], cur: null };
function ownedNow(){
  const o = new Set(Object.keys(G.unlocked || {}).filter(k => G.unlocked[k]));
  const su = G.stanceUnlocked || {};
  if (su.ataru) o.add('ataru'); if (su.djemso) o.add('djemso');
  const up = player.up || {};
  if (isGunner()){ if (up.jetTier >= 1) o.add('jet1'); if (up.jetTier >= 2) o.add('jet2'); if (up.darksaber) o.add('darksaber'); }
  else { if (up.fjTier >= 1) o.add('fj1'); if (up.fjTier >= 2) o.add('fj2'); }
  return o;
}
function used(u){
  if (!u) return false;
  if (u[0] === 'cd') return (player.cds[u[1]] || 0) > 0;
  if (u[0] === 'stance') return G.stance === u[1];
  if (u[0] === 'weapon') return player.weapon === u[1];
  if (u[0] === 'flag') return !!player[u[1]];
  if (u[0] === 'shared') return !!shared[u[1]];
  return false;
}
function updateDrills(dt){
  const run = G.hero + ':' + (G.stats ? G.stats.startGt : 0);
  if (D.run !== run){ D.run = run; D.owned = ownedNow(); D.queue = []; if (D.cur){ D.cur = null; hidePanel(); } return; }
  const now = ownedNow();
  for (const k of now) if (!D.owned.has(k) && heroKey(DRILLS)[k]) D.queue.push(k);
  D.owned = now;
  if (G.skillSelect || dt <= 0) return;
  if (!D.cur && D.queue.length){
    const k = D.queue.shift(), d = heroKey(DRILLS)[k];
    // already in use (e.g. dual blasters equip themselves): count it as tried from the next use, not this one
    D.cur = { d, t: d.use ? 14 : 6, was: used(d.use), ok: false, okT: 0 };
    showPanel(heroKey(TEACHER), d.say, d.key, d.use ? 'Try it now' : '', { drill: true });
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
  if (G.mode === 'play' && !G.training && !G.sandbox) updateDrills(dt);   // (the sandbox hands out powers at will: no drills)
  else if (D.cur && G.mode !== 'play'){ D.cur = null; hidePanel(); }
}
