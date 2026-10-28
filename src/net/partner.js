// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The partner in online co-op: a second hero model, dressed in their own customizer picks, standing where their browser
// says they are and posed exactly as their screen draws them (net/pose.js). It joins the players list
// (player/players.js) as a hero the enemies can pick, while both of you are in the same arena. Each browser still runs
// its own enemies for now: fighting the same ones together is co-op phase 2.

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { G, player, enemies } from '../state.js';
import { NET } from '../data/coop.js';
import { buildHeroModel } from '../player/model/index.js';
import { stepCloth } from '../player/model/cloth.js';
import { blink } from '../player/model/life.js';
import { lookOf, loadPicks, disposeTree } from '../player/mesh.js';
import { playerPos } from '../player/helpers.js';
import { addPlayer, removePlayer, worldKey } from '../player/players.js';
import { readPose, makePoseTrack, pushPose, stepPose } from './pose.js';
import { on, send, sendEvery, connected } from './session.js';

const puppet = { group: new THREE.Group() };
const track = makePoseTrack();
let built = false, picksKey = '', hero = 'jedi', playing = false, world = '', sent = 0;
const want = { pos: new THREE.Vector3(), yaw: 0 };
let tag = null;

/* this partner in the players list: `pos` is where the puppet stands on this screen, so what enemies chase is what
   you see them chase */
const mate = { id: 'partner', local: false, name: 'PARTNER', pos: puppet.group.position, vel: new THREE.Vector3(), down: false, here: false };

const keyOf = (picks) => JSON.stringify(picks || {});

function build(picks, heroName){
  if (puppet.vis){ puppet.group.remove(puppet.vis); disposeTree(puppet.vis); }
  puppet.group.add(buildHeroModel(puppet, lookOf(picks)));
  picksKey = keyOf(picks);
  track.to = track.from = null;   // a fresh rig: the next pose snaps on
  dress(heroName);
  if (!built){ scene.add(puppet.group); built = true; }
}

/* show only the parts of the chosen hero (the same switch player/hero.js makes for the local player); which weapon is
   out, and where, comes with every pose */
function dress(heroName){
  hero = heroName === 'mando' ? 'mando' : 'jedi';
  const mando = hero === 'mando';
  for (const m of puppet.mandoParts) m.visible = mando;
  for (const m of puppet.headBare) m.visible = !mando;
  puppet.rig.skirt.visible = !mando;
  puppet.saberHand.visible = !mando;
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
  if (m.picks && keyOf(m.picks) !== picksKey) build(m.picks, m.hero);
  if (m.hero !== hero) dress(m.hero);
  if (!playing) puppet.group.position.set(m.x, m.y, m.z);   // first sight, or back from the menu: snap
  want.pos.set(m.x, m.y, m.z); want.yaw = m.yaw;
  mate.vel.set(m.vx || 0, 0, m.vz || 0);
  mate.down = !!m.down;
  playing = !!m.play; world = m.w || '';
  if (m.pose) pushPose(track, puppet, m.pose, performance.now());
});
on('open', () => { sent = 0; send({ t: 'hello', hero: G.hero, picks: loadPicks() }); addPlayer(mate); });
on('closed', () => { playing = false; removePlayer(mate); });

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function updateCoop(dt){
  if (connected()){
    sendEvery(NET.sendMs, () => {
      const p = playerPos();
      const m = { t: 's', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +player.group.rotation.y.toFixed(3),
        vx: +(player.moveVel.x + player.vel.x).toFixed(2), vz: +(player.moveVel.z + player.vel.z).toFixed(2),
        hero: G.hero, play: G.mode === 'play', down: !!player.downed || G.mode === 'dead', w: worldKey(),
        pose: player.rig ? readPose(player) : null };
      if (sent++ % NET.picksEvery === 0) m.picks = loadPicks();
      return m;
    });
  }
  const show = built && connected() && playing && G.mode !== 'menu';
  puppet.group.visible = show;
  mate.here = show && G.mode === 'play' && world === worldKey();
  if (tag) tag.style.display = show ? 'block' : 'none';
  if (!show) return;
  const g = puppet.group;
  g.position.x = damp(g.position.x, want.pos.x, 14, dt);
  g.position.y = damp(g.position.y, want.pos.y, 14, dt);
  g.position.z = damp(g.position.z, want.pos.z, 14, dt);
  g.rotation.y += angDiff(g.rotation.y, want.yaw) * (1 - Math.exp(-14 * dt));
  stepPose(track, puppet, performance.now());
  stepCloth(puppet, dt, g.position.y + 0.02);   // their robe and cape swing here too, after the pose
  blink(puppet, dt);   // and they blink (model/life.js); their hands keep the grip they were built with
  // the name tag follows the head on screen
  const t = nameTag();
  const v = new THREE.Vector3(g.position.x, g.position.y + 2.6, g.position.z).project(camera);
  if (v.z > 1){ t.style.display = 'none'; return; }
  t.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
  t.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
}

// for the co-op smoke test: is the partner on screen, posed from the network, and something enemies can go after?
export const partnerShown = () => puppet.group.visible;
export const partnerInfo = () => ({ shown: puppet.group.visible, here: mate.here, posed: !!track.to, hero,
  armR: puppet.rig ? puppet.rig.armR.sh.quaternion.toArray().map(n => +n.toFixed(3)) : null,
  hunters: enemies.filter(e => !e.dead && e.hero === mate).length });
export function dropPartner(){ puppet.group.visible = false; playing = false; mate.here = false; if (tag) tag.style.display = 'none'; }
on('status', (n) => { if (n.status !== 'connected'){ dropPartner(); removePlayer(mate); } });
