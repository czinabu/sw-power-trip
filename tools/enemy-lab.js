// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Enemy lab (dev only: `npm run dev`, then open /tools/enemy-lab.html).
// Lines up every enemy type (or both bosses) under the game's own lights, so enemy model changes can be judged
// without playing. URL params: ?set=troops|bosses|squad  &pose=idle|windup|guardL|guardR|guardH|guardLo|blockL|blockR|blockH|blockLo|windL|windR|windH|windT (a duellist's guards, blocks and wind-ups)  &elite=swift|vital|volatile  &view=front|back  &z=<camera distance>
// &orbit=1 (slow turntable). &cut=diagR|all plays a duellist's cut on a loop (data/duel.js FOE_CUTS; all: every cut in
// turn, named in the corner); &at=0..2 freezes it there instead (0→1 the wind-up, 1→2 the strike). The stats corner shows draw calls per frame.

import * as THREE from 'three';
import { scene, camera, composer, renderer } from '../src/engine/renderer.js';
import { ENEMY_TYPES } from '../src/data/enemies.js';
import { buildEnemyMesh } from '../src/enemies/mesh.js';
import { buildBoss } from '../src/boss/mesh.js';
import { ELITES } from '../src/data/enemies.js';
import { SQUAD } from '../src/data/allies.js';
import { GUARD_POSE, BLOCK_POSE, WIND, FOE_CUTS } from '../src/data/duel.js';

const q = new URLSearchParams(location.search);
const SET = q.get('set') || 'troops';
const POSE = q.get('pose') || 'idle';
const ELITE = q.get('elite') || '';
const VIEW = q.get('view') || 'front';

scene.background = new THREE.Color(0x0d1016);
scene.fog = new THREE.Fog(0x0d1016, 18, 40);
const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// the windup pose is the one players read most: weapons hauled back (values from ai.js at coil = 1)
function pose(g, heavy){
  const u = g.userData;
  // a duellist's guard (the line it covers) and its wind-ups (the line it will strike from), as enemies/duel.js holds them
  const duel = /^(guard|block|wind)(Lo|[LRHT])$/.exec(POSE);
  if (duel){
    const P = duel[1] === 'guard' ? GUARD_POSE : duel[1] === 'block' ? BLOCK_POSE : WIND, s = duel[2];
    if (u.staff && P.staff[s]){ u.staff.rotation.z = P.staff[s][0]; u.staff.rotation.x = P.staff[s][1]; }
    else if (u.weaponArm && P.sword[s]){ u.weaponArm.rotation.x = P.sword[s][0]; u.weaponArm.rotation.z = P.sword[s][1]; }
    return;
  }
  if (POSE !== 'windup') return;
  if (u.weaponArm){ u.weaponArm.rotation.x = -0.35 - (heavy ? 2.7 : 2.1); u.weaponArm.rotation.z = heavy ? 0.9 : 0.6; }
  if (u.staff){ u.staff.rotation.z = 0.5 - 2.9; u.staff.rotation.x = 1.2; }
  if (u.bodyMat){ u.bodyMat.emissive.setHex(0xff2a18); u.bodyMat.emissiveIntensity = 0.25; }
  if (u.hand) u.hand.rotation.z = -3.3;
}

const figs = [];
if (SET === 'bosses'){
  for (const kind of ['sith', 'mando']){
    const g = buildBoss(kind);
    if (POSE !== 'windup' && g.userData.hand) g.userData.hand.rotation.z = -0.6;
    pose(g, true);
    figs.push({ g, label: kind === 'sith' ? 'Darth Vexis' : 'Iron Magistrate', w: 4.2 });
  }
} else if (SET === 'squad'){
  // the squadmates (allies/squad.js): two of each side's troopers, on the same trooper kit
  for (const side of ['jedi', 'mando']) for (const m of SQUAD.roster[side].slice(0, 2)){
    const t = { scale: 1, ...m };
    const g = buildEnemyMesh(t);
    figs.push({ g, label: m.name, w: 2.1 });
  }
} else {
  const ONLY = q.get('only');   // &only=grunt,brute — a subset, for close-ups
  for (const [name, t] of Object.entries(ENEMY_TYPES)){
    if (ONLY && !ONLY.split(',').includes(name)) continue;
    const g = buildEnemyMesh(t);
    if (ELITE && ELITES[ELITE]){
      const m = ELITES[ELITE];
      g.scale.multiplyScalar(m.scale);
      g.userData.bodyMat.color.lerp(new THREE.Color(m.tint), 0.5);
    }
    if (t.fly) g.position.y = 0.6;
    pose(g, !!t.heavy);
    figs.push({ g, label: name, w: 1.15 + t.scale * 0.95 });
  }
}
const total = figs.reduce((s, f) => s + f.w, 0);
let x = -total / 2;
for (const f of figs){
  f.g.position.x = x + f.w / 2; x += f.w;
  f.g.rotation.y = VIEW === 'back' ? Math.PI + 0.4 : -0.4;
  scene.add(f.g);
}

camera.fov = 30;
if (SET === 'bosses'){ camera.position.set(0, 3.0, 12.5); camera.lookAt(0, 2.4, 0); }
else { const z = +q.get('z') || Math.max(5, total * 0.95); camera.position.set(0, 1.4 + z * 0.08, z); camera.lookAt(0, 1.45, 0); }
camera.updateProjectionMatrix();
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55); fill.position.set(-4, 5, 12); scene.add(fill);

const cap = document.getElementById('cap');
cap.innerHTML = figs.map(f => `<span>${f.label}</span>`).join('');
const labels = [...cap.children];
function placeLabels(){
  const v = new THREE.Vector3();
  figs.forEach((f, i) => {
    v.set(f.g.position.x, 0, 0).project(camera);
    labels[i].style.cssText = `position:fixed;left:${(v.x * 0.5 + 0.5) * innerWidth}px;transform:translateX(-50%);bottom:18px`;
  });
}
const btn = (on, label, params) => `<button class="${on ? 'on' : ''}" onclick="location.search='${new URLSearchParams({ set: SET, pose: POSE, elite: ELITE, view: VIEW, ...params })}'">${label}</button>`;
document.getElementById('bar').innerHTML =
  btn(SET === 'troops', 'Troops', { set: 'troops' }) + btn(SET === 'bosses', 'Bosses', { set: 'bosses' }) + btn(SET === 'squad', 'Squad', { set: 'squad' })
  + btn(POSE === 'idle', 'Idle', { pose: 'idle' }) + btn(POSE === 'windup', 'Windup', { pose: 'windup' })
  + ['', ...Object.keys(ELITES)].map(n => btn(n === ELITE, n || 'no elite', { elite: n })).join('')
  + btn(false, VIEW === 'back' ? 'Front view' : 'Back view', { view: VIEW === 'back' ? 'front' : 'back' });

/* CUTS — the wind-up from the carry to the cut's `from`, then the strike through to `to`, with the chest's turn, the
   lean, the hips' drop and the spin's yaw, the way enemies/duel.js windupPose / strikePose play it */
const CUT = q.get('cut'), AT = q.get('at');
const CUT_IDS = CUT === 'all' ? Object.keys(FOE_CUTS) : CUT && FOE_CUTS[CUT] ? [CUT] : [];
const STAFF_END = { L: [-1.6, 0.9], R: [1.7, 0.9], H: [0.9, 0.9], T: [-1.5, -0.3], Lo: [-1.2, -1.0] };
const lerp = (a, b, k) => a + (b - a) * k;
function poseCut(f, id, ph){
  const c = FOE_CUTS[id], u = f.g.userData;
  const wk = Math.min(1, ph), k = Math.max(0, ph - 1), chop = k * k, coil = Math.sqrt(wk);
  const strike = ph > 1, ka = c.yaw ? Math.min(1, chop * 4) : chop;
  if (u.staff){
    const fr = c.staff ? c.staff.from : WIND.staff[c.line] || WIND.staff.H, to = c.staff ? c.staff.to : STAFF_END[c.line];
    const p = strike ? fr.map((v, i) => lerp(v, to[i], ka)) : [lerp(0.5, fr[0], coil), lerp(0.3, fr[1], coil)];
    u.staff.rotation.z = p[0]; u.staff.rotation.x = p[1];
  } else if (u.weaponArm){
    const w0 = [-0.35, 0, 0], fr = c.from, to = c.to;
    const p = [0, 1, 2].map(i => strike ? lerp(fr[i] || 0, to[i] || 0, ka) : lerp(w0[i], fr[i] || 0, coil));
    u.weaponArm.rotation.set(p[0], p[2], p[1]);
  }
  f.g.rotation.x = strike ? lerp(c.lean[0], c.lean[1], chop) : c.lean[0] * coil;
  if (u.chest) u.chest.rotation.y = strike ? lerp(c.twist[0], c.twist[1], chop) : c.twist[0] * coil;
  const yaw = c.yaw ? (strike ? lerp(c.yaw[0], c.yaw[1], chop) : c.yaw[0] * coil) : 0;
  f.g.rotation.y = f.yaw0 + yaw;
  const drop = (c.drop || 0) * (strike ? (c.line === 'Lo' ? 1 - 0.3 * chop : c.slam ? chop : 1 - chop) : c.slam ? 0 : coil);
  if (u.vis) u.vis.position.y = -drop;
  const glow = c.fin ? 0xffa020 : c.line === 'T' ? 0xfff0e0 : 0xff2a18;
  if (u.bodyMat){ u.bodyMat.emissive.setHex(glow); u.bodyMat.emissiveIntensity = strike ? (1 - k) * 0.5 : coil * 0.45; }
}
// one loop of a cut (s): wind-up, held at the top, the strike, then back to the carry
const LOOP = { wind: 0.5, hold: 0.12, strike: 0.3, rest: 0.55 };
const loopLen = c => LOOP.wind * (c.wind || 1) + LOOP.hold + LOOP.strike * (c.swing || 1) + LOOP.rest;
const cutTag = document.createElement('div');
cutTag.style.cssText = 'position:fixed;left:12px;bottom:46px;font:600 15px/1.2 system-ui;letter-spacing:.12em;color:#ffe6b0;text-transform:uppercase';
document.body.appendChild(cutTag);
for (const f of figs) f.yaw0 = f.g.rotation.y;
function playCuts(ms){
  if (!CUT_IDS.length) return;
  let id, ph;
  if (AT != null){ id = CUT_IDS[0]; ph = +AT; }
  else {
    let t = (ms / 1000) % CUT_IDS.reduce((s2, i) => s2 + loopLen(FOE_CUTS[i]), 0);
    for (const i of CUT_IDS){ const L = loopLen(FOE_CUTS[i]); if (t < L){ id = i; break; } t -= L; }
    const c = FOE_CUTS[id], W = LOOP.wind * (c.wind || 1), Sk = LOOP.strike * (c.swing || 1);
    ph = t < W ? t / W : t < W + LOOP.hold ? 1 : t < W + LOOP.hold + Sk ? 1 + (t - W - LOOP.hold) / Sk : 2;
    window.LAB.cutNow = { id, ph };
  }
  for (const f of figs) poseCut(f, id, ph);
  cutTag.textContent = id + (FOE_CUTS[id].fin ? ' · finisher' : '') + ' · line ' + FOE_CUTS[id].line;
}

const stats = document.getElementById('stats');
const orbit = q.get('orbit') === '1';
renderer.info.autoReset = false;
renderer.setAnimationLoop(t => {
  if (orbit) for (const f of figs) f.g.rotation.y = f.yaw0 = t * 0.0004;
  playCuts(window.LAB && window.LAB.clock != null ? window.LAB.clock : t);
  placeLabels();
  renderer.info.reset();
  composer.render();
  stats.textContent = `${renderer.info.render.calls} draw calls`;
});
window.LAB = { figs, scene, camera, renderer };
