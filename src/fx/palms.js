// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Where powers leave the body. The Jedi's Force comes out of his palms: the free (left) hand with the saber drawn, both
// hands with it holstered. The Mando's gadgets come off his left gauntlet. Works on any hero model (this browser's, or a
// co-op partner's puppet: net/partner.js), and castFrom() waits the beat it takes the arm to get out before it reads
// the palm, so a push leaves the outstretched hand rather than the spot the hand was in when the key went down.

import * as THREE from 'three';
import { G, player, isGunner } from '../state.js';

const PALM = new THREE.Vector3(0, -0.085, 0);   // the middle of the palm in the wrist socket's frame (model/rig.js)
const GAUNTLET = new THREE.Vector3(0, 0.08, 0);   // the Mando's vambrace launcher, on the forearm just above the wrist

// a palm marker in each wrist socket (rebuilt with the model)
export function palmAnchors(hero){
  if (!hero || !hero.rig || !hero.rig.sockets) return null;
  if (hero.palms && hero.palms.rig === hero.rig) return hero.palms;
  const make = (k, at) => { const o = new THREE.Object3D(); o.position.copy(at); hero.rig.sockets[k].add(o); return o; };
  hero.palms = { L: make('handL', PALM), R: make('handR', PALM), gauntlet: make('handL', GAUNTLET), rig: hero.rig };
  return hero.palms;
}

// which hands throw this hero's Force right now: both with the saber holstered, else the free hand
export const castHands = (hero = player, holstered = hero.holstered) => !isGunner() && holstered ? ['L', 'R'] : ['L'];
// a strike's hand ('L' / 'R' / 'both', jedi/palm.js) as a list
export const handList = (h) => h === 'both' ? ['L', 'R'] : [h];

// the world position of each named hand ('L', 'R' or 'gauntlet'); without a model, a guess in front of the chest
export function palmPoints(hands, hero = player, out = []){
  out.length = 0;
  const A = palmAnchors(hero);
  for (let i = 0; i < hands.length; i++){
    const v = new THREE.Vector3();
    if (A){ A[hands[i]].updateWorldMatrix(true, false); v.setFromMatrixPosition(A[hands[i]].matrixWorld); }
    else {
      const g = hero.group.position, y = hero.group.rotation.y, side = hands.length > 1 ? (i ? 0.3 : -0.3) : 0;
      v.set(g.x + Math.sin(y) * 0.7 + Math.cos(y) * side, g.y + 1.4, g.z + Math.cos(y) * 0.7 - Math.sin(y) * side);
    }
    out.push(v);
  }
  return out;
}
export const gauntletPoint = (hero = player) => palmPoints(['gauntlet'], hero)[0];

/* fire an effect from the hands once the arm is out: fn(points) runs `delay` seconds of game time from now (so slow-mo
   holds it too), with the palms read at that moment. Driven from the VFX loop (fx/vfx.js). */
const queue = [];
export function castFrom(hands, delay, fn, hero = player){
  if (delay <= 0){ fn(palmPoints(hands, hero, [])); return; }
  queue.push({ t: delay, hands, fn, hero });
}
export function updatePalmCasts(dt){
  for (let i = queue.length - 1; i >= 0; i--){
    const q = queue[i];
    if ((q.t -= dt) > 0) continue;
    queue.splice(i, 1);
    q.fn(palmPoints(q.hands, q.hero, []));
  }
}
export const clearPalmCasts = () => { queue.length = 0; };
