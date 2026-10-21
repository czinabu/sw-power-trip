// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The partner in online co-op, phase 0: a second hero model standing where the other player's browser says they are,
// dressed in their own customizer picks. It only mirrors position, facing and a simple stride for now; combat comes later.

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { G, player } from '../state.js';
import { buildHeroModel } from '../player/model/index.js';
import { lookOf, loadPicks, disposeTree } from '../player/mesh.js';
import { playerPos } from '../player/helpers.js';
import { on, send, sendEvery, connected } from './session.js';

const SEND_MS = 66;   // ~15 state messages a second
const ghost = { group: new THREE.Group() };
let built = false, picksKey = '', hero = 'jedi', playing = false, phase = 0, hipsY = 1;
const want = { pos: new THREE.Vector3(), yaw: 0, speed: 0 };
let tag = null;

const keyOf = (picks) => JSON.stringify(picks || {});

function build(picks, heroName){
  if (ghost.vis){ ghost.group.remove(ghost.vis); disposeTree(ghost.vis); }
  ghost.group.add(buildHeroModel(ghost, lookOf(picks)));
  ghost.blade.light.intensity = 3;   // a gentle glow: the real saber light is meant for the one hero in the scene
  picksKey = keyOf(picks);
  hipsY = ghost.rig.hips.position.y;
  dress(heroName);
  if (!built){ scene.add(ghost.group); built = true; }
}

/* show only the parts of the chosen hero (the same switch player/hero.js makes for the local player) */
function dress(heroName){
  hero = heroName === 'mando' ? 'mando' : 'jedi';
  const mando = hero === 'mando';
  for (const m of ghost.mandoParts) m.visible = mando;
  for (const m of ghost.headBare) m.visible = !mando;
  ghost.rig.skirt.visible = !mando;
  ghost.saberHand.visible = !mando;
  ghost.pistols.L.visible = false;
  ghost.pistols.R.visible = mando;
  ghost.rifleMesh.visible = false;
  ghost.darksaberMesh.visible = false;
}

function nameTag(){
  if (tag) return tag;
  tag = document.createElement('div');
  tag.id = 'partnertag'; tag.textContent = 'PARTNER';
  document.getElementById('hud').appendChild(tag);
  return tag;
}

on('hello', (m) => { build(m.picks, m.hero); });
on('s', (m) => {
  if (!built) build(m.picks, m.hero);
  if (m.hero !== hero) dress(m.hero);
  if (m.picks && keyOf(m.picks) !== picksKey) build(m.picks, m.hero);
  if (!playing) ghost.group.position.set(m.x, m.y, m.z);   // first sight, or a teleport: snap
  want.pos.set(m.x, m.y, m.z); want.yaw = m.yaw; want.speed = m.v;
  playing = m.play;
});
on('open', () => send({ t: 'hello', hero: G.hero, picks: loadPicks() }));
on('closed', () => { playing = false; });

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function updateCoop(dt){
  if (connected()){
    sendEvery(SEND_MS, () => {
      const p = playerPos();
      return { t: 's', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +player.faceYaw.toFixed(3),
        v: +Math.hypot(player.moveVel.x, player.moveVel.z).toFixed(2), hero: G.hero, play: G.mode === 'play', picks: loadPicks() };
    });
  }
  const show = built && connected() && playing && G.mode !== 'menu';
  ghost.group.visible = show;
  if (tag) tag.style.display = show ? 'block' : 'none';
  if (!show) return;
  const g = ghost.group;
  g.position.x = damp(g.position.x, want.pos.x, 14, dt);
  g.position.y = damp(g.position.y, want.pos.y, 14, dt);
  g.position.z = damp(g.position.z, want.pos.z, 14, dt);
  g.rotation.y += angDiff(g.rotation.y, want.yaw) * (1 - Math.exp(-12 * dt));
  // a simple stride: legs and arms swing with speed, standing still settles to rest
  const R = ghost.rig, amp = Math.min(want.speed / 7, 1) * 0.7;
  phase += dt * (3 + want.speed * 1.1);
  const s = Math.sin(phase) * amp;
  R.legL.hip.rotation.x = s; R.legR.hip.rotation.x = -s;
  R.legL.knee.rotation.x = Math.max(0, -s) * 0.9; R.legR.knee.rotation.x = Math.max(0, s) * 0.9;
  R.armL.sh.rotation.x = -s * 0.8;
  R.hips.position.y = hipsY + Math.abs(Math.cos(phase)) * amp * 0.04;
  // the name tag follows the head on screen
  const t = nameTag();
  const v = new THREE.Vector3(g.position.x, g.position.y + 2.6, g.position.z).project(camera);
  if (v.z > 1){ t.style.display = 'none'; return; }
  t.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
  t.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
}

export const partnerShown = () => ghost.group.visible;   // for the co-op smoke test
export function dropPartner(){ ghost.group.visible = false; playing = false; if (tag) tag.style.display = 'none'; }
on('status', (n) => { if (n.status !== 'connected') dropPartner(); });
