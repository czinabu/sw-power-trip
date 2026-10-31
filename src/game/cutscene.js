// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CUTSCENES: short in-engine scenes in the campaign and the missions (their words: data/cutscenes.js). A scene is a run of
// shots: the lens eases from one spot to another around the hero, a spot on the field or an actor (a stand-in figure that
// walks on, or a foe already there), with a line of dialogue or a title under a letterbox. The fight holds still while one
// plays (in co-op, the host's foes hold for both heroes), the hero idles, and Enter, Space, Esc or a pad's A or MENU skips.
//
// Who calls what: game/campaign.js plays a chapter's opening when its card closes, game/mission.js a duel's entrance
// before its foe steps in, game/flow.js the boss's arrival on Exegol. Anything else plays a SCENES entry by id.

import * as THREE from 'three';
import { camera, scene } from '../engine/renderer.js';
import { G, shared, player, isGunner } from '../state.js';
import { VOICE, storyHero } from '../data/campaign.js';
import { MANDO_BOSS, MANDO_CAST } from '../data/campaign-mando.js';
import { playerPos, stance, fwd, rightV } from '../player/helpers.js';
import { animatePlayer } from '../player/animation.js';
import { cameraClearance, sightClear, updatePropFade } from '../world/camblock.js';
import { findClearSpawn, groundAt, segBlockedBySolids } from '../world/collision.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { resetCameraRig } from '../engine/camera.js';
import { net, on, send, connected } from '../net/session.js';
import { coopRun } from '../net/run.js';
import { CUT, OPENINGS, DUELS, BOSS, SCENES } from '../data/cutscenes.js';
import { BOSS_CFG, BOSS_MANDO } from '../data/bosses.js';
import { missionState } from './mission.js';

const hero = () => isGunner() ? 'mando' : 'jedi';
const pick = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v[hero()] : v;
const ease = (t) => t * t * (3 - 2 * t);
const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);

/* ---------- the frame: letterbox, title, subtitle, skip hint ---------- */
const el = document.createElement('div');
el.id = 'cutscene';
el.innerHTML = '<div class="cs-bar top"></div><div class="cs-bar bot"></div>' +
  '<div class="cs-title"><div class="cs-k"></div><div class="cs-h"></div><div class="cs-p"></div></div>' +
  '<div class="cs-line"><div class="cs-who"></div><div class="cs-say"></div></div>' +
  '<div class="cs-skip"><b>ENTER</b> skip</div>';
document.body.appendChild(el);
el.style.setProperty('--bars', (CUT.bars * 100) + 'vh');
const $ = (c) => el.querySelector(c);

/* ---------- the scene playing now ---------- */
const C = { on: false, key: '', shots: [], i: 0, t: 0, actors: [], heroYaw: 0, mark: null, onDone: null, fade: 0, ending: false, shown: null };
export const sceneOn = () => C.on;
// scenes already seen on this visit: a retry after a death doesn't replay them (cleared when a chapter or mission starts afresh)
const seen = new Set();
export function resetScenes(){ seen.clear(); }

// how long a line holds: long enough to read
const lineTime = (line) => line ? Math.max(CUT.minLine, String(line[1]).length / CUT.readRate + 1.0) : 0;

/* ---------- actors: a stand-in figure (built from a foe type), or something already on the field ---------- */
// things already on the field a scene can frame by name: each returns its group (looked up when a scene starts, never at load)
const binders = {
  boss: () => shared.boss && shared.boss.group,
  quarry: () => { const M = missionState(); return M.quarry && M.quarry.g; },   // the chase's quarry, where it stands
};
export function bindActor(name, fn){ binders[name] = fn; }
function makeActor(def, x, z, yaw){
  const t = ENEMY_TYPES[def.foe] || ENEMY_TYPES.duelist;
  const g = buildEnemyMesh(t);
  g.scale.multiplyScalar(def.scale || 1);
  if (def.tint != null && g.userData.bodyMat) g.userData.bodyMat.color.lerp(new THREE.Color(def.tint), 0.5);
  if (def.blade != null && g.userData.bladeGlow) g.userData.bladeGlow.material.color.setHex(def.blade);   // a form master's blade (game/mission.js)
  g.position.set(x, groundAt(x, z, 3.2), z); g.rotation.y = yaw;
  scene.add(g);
  return { g, own: true, scale: def.scale || 1, name: def.name || '', walk: null };
}
function boundActor(name){
  const g = binders[name] && binders[name]();
  return g ? { g, own: false, scale: g.scale.x || 1, name: '', walk: null, bind: name } : null;
}
// the actor walks from where it stands to (x, z) over `t` seconds, then turns to the hero
function walkTo(a, x, z, t){ a.walk = { x0: a.g.position.x, z0: a.g.position.z, x1: x, z1: z, t, k: 0 }; }
function updateActor(a, dt){
  if (!a.own){ const g = a.bind && binders[a.bind] && binders[a.bind](); if (g) a.g = g; }   // (a foe on the field keeps its pose, and only turns to you)
  const g = a.g, pp = playerPos();
  if (!a.own){ const want = yawTo(g.position.x, g.position.z, pp.x, pp.z); g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 4); return; }
  if (a.walk){
    const w = a.walk;
    w.k = Math.min(1, w.k + dt / w.t);
    const k = w.k < 1 ? w.k : 1;
    g.position.x = w.x0 + (w.x1 - w.x0) * k; g.position.z = w.z0 + (w.z1 - w.z0) * k;
    if (w.k < 1) g.rotation.y = yawTo(w.x0, w.z0, w.x1, w.z1);
    else a.walk = null;
  } else {
    const want = yawTo(g.position.x, g.position.z, pp.x, pp.z);
    g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 4);
  }
  g.position.y += (groundAt(g.position.x, g.position.z, g.position.y + 0.6) - g.position.y) * Math.min(1, dt * 12);   // up and down steps
  updateLegs(a, g, dt, 'ground');
  updateUpper(a, g, dt, pp);
}
function dropActors(){
  player.talking = false;
  for (const a of C.actors) if (a.g) a.g.userData.talk = false;
  for (const a of C.actors) if (a.own) scene.remove(a.g);
  C.actors = [];
}

/* ---------- anchors: what a shot's lens circles. Each gives a spot and the way it faces ---------- */
const P = new THREE.Vector3(), L = new THREE.Vector3();
function anchor(on){
  if (on === 'hero'){ const p = playerPos(); return { x: p.x, y: p.y, z: p.z, yaw: C.heroYaw }; }
  if (on === 'mark') return { x: C.mark.x, y: 0, z: C.mark.z, yaw: C.mark.yaw };
  const a = C.actors[on === 'actor' ? 0 : on] || C.actors[0];
  if (!a) return anchor('hero');
  const g = a.g.position, p = playerPos();
  return { x: g.x, y: g.y, z: g.z, yaw: yawTo(g.x, g.z, p.x, p.z), scale: a.scale };
}
// where a shot looks: { on, h } a height over an anchor, or { on, ahead, h } a point that far along the anchor's facing
function lookPoint(look, out){
  const a = anchor(look.on), s = look.on === 'hero' || look.on === 'mark' ? 1 : (a.scale || 1);
  const f = look.ahead || 0;
  return out.set(a.x + Math.sin(a.yaw) * f, a.y + look.h * s, a.z + Math.cos(a.yaw) * f);
}

/* ---------- building shots ---------- */
// shot(on, from, to, t, look, extra): from/to are [angle off the anchor's facing (0: in front, PI: behind), distance, height]
const shot = (on, from, to, t, look, extra = {}) => ({ on, from, to, t, look, ...extra });
// the hero speaks or listens: a close three-quarter, alternating sides line by line
function heroLines(lines, side = 1){
  return lines.map((ln, k) => {
    const s = (k % 2 ? -1 : 1) * side;
    return shot('hero', [0.6 * s, 3.4, 1.55], [0.42 * s, 2.9, 1.6], lineTime(ln), { on: 'hero', h: 1.45 }, { line: ln, mirror: true });
  });
}
function actorLines(lines, who){
  return lines.map((ln, k) => {
    const s = k % 2 ? -1 : 1;
    return shot('actor', [0.5 * s, 3.6, 1.15], [0.36 * s, 3.0, 1.4], lineTime(ln), { on: 'actor', h: 1.6 }, { line: [ln[0] || who, ln[1]], mirror: true });
  });
}
// a look over the hero's shoulder at the actor (the hero turned to face it)
const overShoulder = (t) => shot('hero', [Math.PI + 0.42, 4.4, 2.1], [Math.PI + 0.3, 3.9, 2.0], t, { on: 'actor', h: 1.4 }, { mirror: true });
// the last shot settles behind the hero, close to where the play camera sits, so the hand back is a short cut
const settle = (look) => shot('hero', [Math.PI, 5.6, 2.7], [Math.PI, 4.8, 2.4], 1.1, look || { on: 'hero', ahead: 8, h: 1.2 });
// the opening's wide look: high behind the hero, over what they face
// (in a narrow place, like the chase's alleys, it comes in closer and swings round until no wall stands in the way)
function wide(t, title){
  const pp = playerPos(), Y = G.yaw, W0 = Math.max(14, Math.min(30, shared.arenaHalf * 0.55));
  const clear = (a, d, h) => sightClear(pp.x, pp.y + 1.4, pp.z, pp.x + Math.sin(Y + a) * d, pp.y + h, pp.z + Math.cos(Y + a) * d);
  let best = null, bestK = -1;
  search: for (const W of [W0, W0 * 0.7, W0 * 0.5, W0 * 0.35]) for (const a of [0.7, -0.7, 0.35, -0.35, 0, 1.1, -1.1]){
    const H = W * 0.5, k = Math.min(clear(Math.PI + a, W, H), clear(Math.PI + a * 0.5, W * 0.85, H * 0.8));
    if (k > bestK){ bestK = k; best = [a, W, H]; }
    if (k > 0.98) break search;
  }
  const [a, W, H] = best;
  return shot('hero', [Math.PI + a, W, H], [Math.PI + a * 0.5, W * 0.85, H * 0.8], t, { on: 'hero', ahead: Math.min(10, W * 0.5), h: 0 }, { title });
}

/* ---------- starting and ending ---------- */
// opts: key (seen once a visit) · shots · actors · mark {x, z} · face [x, z] (the hero turns to it) · onDone · share (sent to a co-op partner)
// the sim stands still but the gait reads player.moveVel/vel: a hero caught mid-run would keep striding in place, so stop them dead
function stillHero(){
  player.moveVel.set(0, 0, 0); player.vel.set(0, 0, 0);
  player.backRun = false;
}
function start(opts){
  if (C.on || G.mode !== 'play') return false;
  if (opts.key && seen.has(opts.key)) return false;
  if (opts.key) seen.add(opts.key);
  const pp = playerPos();
  if (opts.face){ G.yaw = yawTo(pp.x, pp.z, opts.face[0], opts.face[1]); G.pitch = 0.1; }
  Object.assign(C, { on: true, key: opts.key || '', shots: opts.shots, i: 0, t: 0, actors: opts.actors || [], heroYaw: G.yaw,
                     mark: opts.mark || null, onDone: opts.onDone || null, fade: 0, ending: false, shown: null });
  if (C.mark && C.mark.yaw == null) C.mark.yaw = yawTo(C.mark.x, C.mark.z, pp.x, pp.z);
  G.cutscene = true;
  player.firing = false; player.trigHeld = false; player.blockHeld = false;
  stillHero();
  document.body.classList.add('cutscene');
  el.classList.add('on'); el.classList.toggle('mando', isGunner());
  $('.cs-skip').innerHTML = '<b>' + (padUsed() ? 'A' : 'ENTER') + '</b> skip';
  if (opts.share && net.role === 'host' && connected()) send({ t: 'csp', s: opts.share });
  if (net.role === 'guest' && connected()) send({ t: 'cso', o: 1 });
  showShot();
  return true;
}
function finish(skipped){
  if (!C.on) return;
  const done = C.onDone;
  dropActors();
  C.on = false; C.onDone = null;
  G.cutscene = false;
  document.body.classList.remove('cutscene');
  el.classList.remove('on', 'fade');
  setLine(null); setTitle(null);
  resetCameraRig();
  if (net.role === 'guest' && connected()) send({ t: 'cso', o: 0 });
  if (skipped && connected()) send({ t: 'csk', k: C.key });
  if (done) done();
}
export function skipScene(){ if (C.on) finish(true); }
const padUsed = () => document.body.classList.contains('pad');

/* ---------- the subtitle and the title ---------- */
function setLine(ln){
  const box = $('.cs-line');
  if (!ln){ box.classList.remove('on'); return; }
  $('.cs-who').textContent = ln[0] || '';
  $('.cs-say').textContent = ln[1] || '';
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}
function setTitle(t){
  const box = $('.cs-title');
  if (!t){ box.classList.remove('on'); return; }
  $('.cs-k').textContent = t.k || ''; $('.cs-h').textContent = t.h || ''; $('.cs-p').textContent = t.p || '';
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}
function showShot(){
  const s = C.shots[C.i];
  if (s.line !== C.shown){ setLine(s.line || null); C.shown = s.line; }
  if (s.title) setTitle(s.title); else if (C.i > 0 && C.shots[C.i - 1].title) setTitle(null);
  if (s.walk){ const a = C.actors[0]; if (a && a.own) walkTo(a, s.walk[0], s.walk[1], s.walk[2]); }
  // the speaker works its jaw (or nods under its helmet) while its line is up (enemies/upper.js talking)
  C.actors.forEach((a, i) => { if (a.g) a.g.userData.talk = !!(s.line && s.on === 'actor' && i === 0); });
  // the hero speaks a line of its own (not the voice in its ear): the Jedi's jaw works (player/model/life.js express)
  player.talking = !!(s.line && s.on === 'hero' && s.line[0] && !Object.values(VOICE).includes(s.line[0]) && !MANDO_CAST.has(s.line[0]));
  pickSide(s);
}

// where shot s puts the lens at ease k, on side `side` (+1, or -1 mirrored across the anchor's facing)
function lensAt(s, k, side, out){
  const A = anchor(s.on), sc = s.on === 'actor' ? Math.max(1, A.scale || 1) : 1;
  const ang = (s.from[0] + (s.to[0] - s.from[0]) * k) * side, d = s.from[1] + (s.to[1] - s.from[1]) * k, h = s.from[2] + (s.to[2] - s.from[2]) * k;
  return out.set(A.x + Math.sin(A.yaw + ang) * d * sc, A.y + h * sc, A.z + Math.cos(A.yaw + ang) * d * sc);
}
// a close shot takes whichever side of its subject has the clearer view (a crate between lens and face mirrors it)
const Q = new THREE.Vector3();
function pickSide(s){
  s.side = 1;
  if (!s.mirror) return;
  lookPoint(s.look, L);
  const A = anchor(s.look.on);   // (the face, and the body under it)
  const view = (side) => { let v = 0; for (const k of [0, 1]){ lensAt(s, k, side, Q); v += sightClear(L.x, L.y, L.z, Q.x, Q.y, Q.z) + sightClear(A.x, A.y + 0.6, A.z, Q.x, Q.y, Q.z); } return v; };
  if (view(-1) > view(1) + 0.05) s.side = -1;
}

/* ---------- every frame (real time: the sim is frozen) ---------- */
let lastAt = 0;
export function updateCutscene(){
  // on the wall clock (a slow machine's capped frame time would stretch the scene out)
  const now = performance.now(), dt = Math.min(0.25, Math.max(0, (now - lastAt) / 1000));
  lastAt = now;
  if (!C.on) return;
  if (G.mode !== 'play'){ finish(false); return; }
  if (G.paused) return;   // the pause screen's own cuts take the lens until it closes
  const s = C.shots[C.i];
  C.t += dt;
  if (C.t >= s.t){
    if (C.i + 1 >= C.shots.length){ finish(false); return; }
    C.i++; C.t = 0; showShot();
    return void updateCutscene();
  }
  for (const a of C.actors) updateActor(a, dt);
  // the hero idles (and turns to whatever the scene faced them toward) while the sim stands still
  const pp = playerPos();
  stillHero();   // (nothing else may push the hero's velocity back up while the scene plays)
  if (dt > 0) animatePlayer(dt, pp, stance(), fwd(), rightV(), false);
  // the lens: eased from `from` to `to` around the shot's anchor, kept out of props like the play camera
  const k = ease(Math.min(1, C.t / s.t)), A = anchor(s.on), sc = s.on === 'actor' ? Math.max(1, A.scale || 1) : 1;
  lensAt(s, k, s.side || 1, P);
  lookPoint(s.look, L);
  const oy = A.y + 1.3 * sc, cl = cameraClearance(A.x, oy, A.z, P.x, P.y, P.z);
  if (cl < 1) P.set(A.x + (P.x - A.x) * cl, oy + (P.y - oy) * cl, A.z + (P.z - A.z) * cl);
  if (P.y < 0.35) P.y = 0.35;
  camera.position.copy(P);
  camera.lookAt(L);
  updatePropFade(P, L.x, L.y - 1, L.z, dt);   // a prop still between the lens and the subject turns see-through (world/camblock.js)
  const fov = s.fov || 50;
  if (Math.abs(camera.fov - fov) > 0.02){ camera.fov = fov; camera.updateProjectionMatrix(); }
  // fade in from black at the start, out at the very end
  const total = C.shots.length - 1, last = C.i === total && s.t - C.t < CUT.fadeOut;
  el.classList.toggle('fade', last);
}

/* ============================================================
   THE SCENES
   ============================================================ */
// where a watcher stands: ahead of the hero, in plain sight of them (nearer, or off to a side, until nothing is between)
function watchSpot(pp){
  const far = Math.min(16, shared.arenaHalf * 0.6);
  for (const d of [far, far * 0.75, far * 0.55]) for (const a of [0, 0.35, -0.35, 0.7, -0.7]){
    const yaw = G.yaw + a, c = findClearSpawn(pp.x + Math.sin(yaw) * d, pp.z + Math.cos(yaw) * d, 1.2);
    if (!segBlockedBySolids(pp.x, pp.z, c.x, c.z) && groundAt(c.x, c.z, 3.2) < 0.3 && sightClear(pp.x, pp.y + 1.5, pp.z, c.x, 1.0, c.z) > 0.97) return { ...c, yaw };
  }
  const c = findClearSpawn(pp.x + Math.sin(G.yaw) * far, pp.z + Math.cos(G.yaw) * far, 1.2);
  return { ...c, yaw: G.yaw };
}

// a chapter's opening (game/campaign.js, when its card closes): the place, its title, then the hero and the voice.
// own: a story's own opening for the chapter (data/campaign-mando.js `opening`: plain lines, whoever is playing)
const everyHero = (v) => ({ jedi: v, mando: v });
export function playOpening(id, title, own){
  const o = own ? { ...everyHero(own.lines), rival: own.rival && { ...everyHero(own.rival), line: own.rival.line }, quarry: own.quarry } : OPENINGS[id];
  if (!o) return false;
  let lines = (pick(o) || []).slice();
  const shots = [wide(3.4, title)], actors = [];
  const pp = playerPos();
  let face = null;
  if (o.quarry){   // the chase: its quarry already stands up ahead
    const q = boundActor('quarry');
    if (q){
      actors.push(q);
      const g = q.g.position; face = [g.x, g.z];
      shots.push(overShoulder(2.2), ...actorLines(lines.slice(0, 1)));
      lines = lines.slice(1);
    }
  } else if (o.rival){   // someone watching from across the field: it walks into view, says its piece, and stays to watch
    const r = pick(o.rival), spot = watchSpot(pp), side = { x: Math.cos(spot.yaw), z: -Math.sin(spot.yaw) };
    face = [spot.x, spot.z];
    const a = makeActor(r, spot.x - side.x * 3.2, spot.z - side.z * 3.2, 0);
    actors.push(a);
    const ov = overShoulder(2.6); ov.walk = [spot.x, spot.z, 2.4];
    shots.push(ov, ...actorLines([pick(o.rival.line)], r.name));
  }
  shots.push(...heroLines(lines), settle());
  return start({ key: 'open:' + id, shots, actors, face });
}

// a mission duel's entrance (game/mission.js, before its foe steps in). spec: { mid, foe, name, kicker, tint, scale,
// at: [x, z], line, quarry } as the host's hero sees the foe. Returns false when no scene plays (seen, or one is up).
export function playDuelIntro(spec, share = true){
  const lines = ((DUELS[spec.mid] && pick(DUELS[spec.mid])) || (spec.line ? [[null, spec.line]] : [])).slice();
  const actors = [];
  let at = spec.at;
  if (spec.quarry){
    const q = boundActor('quarry');
    if (!q) return false;
    q.scale = spec.scale || 1; actors.push(q); at = [q.g.position.x, q.g.position.z];
  } else {
    const pp = playerPos(), away = Math.atan2(at[0] - pp.x, at[1] - pp.z);
    const from = findClearSpawn(at[0] + Math.sin(away) * 5, at[1] + Math.cos(away) * 5, 1.0);
    actors.push(makeActor(spec, from.x, from.z, away + Math.PI));
  }
  const ov = overShoulder(spec.quarry ? 1.8 : 2.5);
  if (!spec.quarry) ov.walk = [at[0], at[1], 2.3];
  const foeLines = [], rest = [];
  for (const ln of lines) (ln[0] ? rest : foeLines).push(ln);
  const close = actorLines(foeLines.length ? foeLines : [[spec.name, '']], spec.name);
  close[0].title = { k: spec.kicker || 'DUEL', h: spec.name };
  if (!foeLines.length){ close[0].line = null; close[0].t = 2.2; }
  const shots = [ov, ...close, ...heroLines(rest), settle({ on: 'actor', h: 1.2 })];
  return start({ key: 'duel:' + spec.mid, shots, actors, face: at, share: share ? { k: 'duel', spec } : null });
}

// the campaign's last boss arrives (game/flow.js): framed low and wide, his line, the voice's answer
export function playBossIntro(share = true){
  const b = boundActor('boss');
  if (!b) return false;
  b.scale = 1.4;
  const lines = (G.chapter >= 0 && storyHero() === 'mando' ? MANDO_BOSS : pick(BOSS)).slice(),   // (the Mando's own story: data/campaign-mando.js)
        [name, epithet] = (isGunner() ? BOSS_MANDO.name : BOSS_CFG.name).split(' — ');
  const first = shot('actor', [0.6, 5, 0.9], [0.4, 4.4, 1.3], lineTime(lines[0]), { on: 'actor', h: 2.2 },
                     { line: lines[0], title: { k: 'EXEGOL', h: name, p: epithet || '' }, mirror: true });
  const g = b.g.position;
  const shots = [overShoulder(1.8), first, ...heroLines(lines.slice(1)), settle({ on: 'actor', h: 1.8 })];
  return start({ key: 'boss:' + G.chapter, shots, actors: [b], face: [g.x, g.z], share: share ? { k: 'boss' } : null });
}

// any other scene by id (data/cutscenes.js SCENES): opts.mark [x, z] for a 'mark' scene, opts.onDone, opts.key (once a visit)
export function playScene(id, opts = {}){
  const d = SCENES[id];
  if (!d) return false;
  const lines = (pick(d) || []).slice(), actors = [];
  let shots;
  if (d.shots === 'mark' && opts.mark){
    const [mx, mz] = opts.mark;
    if (d.actor){ const r = pick(d.actor), pp = playerPos(); actors.push(makeActor(r, mx, mz, yawTo(mx, mz, pp.x, pp.z))); }
    shots = actors.length ? [overShoulder(1.6), ...actorLines(lines.slice(0, 1)), ...heroLines(lines.slice(1)), settle()]
                          : [shot('mark', [0.6, 6, 2.2], [0.4, 5, 2.0], 2.4, { on: 'mark', h: 1.0 }), ...heroLines(lines), settle()];
  } else shots = [...heroLines(lines), settle()];
  return start({ key: opts.key, shots, actors, face: opts.mark, mark: opts.mark ? { x: opts.mark[0], z: opts.mark[1] } : null,
                 onDone: opts.onDone, share: opts.share === false ? null : { k: 'scene', id, mark: opts.mark || null } });
}

/* ---------- skipping ---------- */
window.addEventListener('keydown', (e) => {
  if (!C.on || e.repeat || (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape')) return;
  if (e.key !== 'Escape'){ e.preventDefault(); e.stopPropagation(); }   // (Esc goes on to the browser: it frees the cursor, and the pause screen follows)
  skipScene();
}, true);

/* ---------- co-op: the host's scenes play for the guest too; either side's skip ends both; foes hold while either watches ---------- */
on('csp', (m) => {
  if (net.role !== 'guest' || !m.s || C.on || G.cardUp || G.mode !== 'play') return;
  const s = m.s;
  if (s.k === 'duel') playDuelIntro(s.spec, false);
  else if (s.k === 'boss') setTimeout(() => playBossIntro(false), 120);   // (the boss's puppet lands with the host's next snapshot)
  else if (s.k === 'scene') playScene(s.id, { mark: s.mark, share: false });
});
on('csk', (m) => { if (C.on && (!m.k || m.k === C.key)) finish(false); });
const watching = new Set();   // the guests whose cutscene is playing
on('cso', (m) => { if (net.role !== 'host') return; if (m.o) watching.add(m.from); else watching.delete(m.from); coopRun.guestScene = watching.size > 0; });
on('closed', (slot) => { if (slot < 0) watching.clear(); else watching.delete(slot); coopRun.guestScene = watching.size > 0; });
on('status', (n) => { if (n.status !== 'connected'){ watching.clear(); coopRun.guestScene = false; } });
