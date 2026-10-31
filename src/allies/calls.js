// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARC TROOPER'S BATTLEFIELD CALLS (T, testing only), paid in COMMAND POINTS (player/trooper/command.js):
//   REINFORCE    with a squadmate down: everyone down is back up, now
//   SUPPLY DROP  otherwise: a crate drops beside you; it tops up the frag grenades, cools the guns and patches you up
// One key that picks the call the moment needs, as tapping H picks the order. The tuning is data/trooper.js
// TROOPER.command (supply, reinforce).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, isTrooper } from '../state.js';
import { V3, clamp } from '../utils.js';
import { sfx, S } from '../audio/sfx.js';
import { floater } from '../fx/floaters.js';
import { burst } from '../fx/particles.js';
import { groundRing } from '../fx/ink.js';
import { flashLight } from '../fx/lights.js';
import { showBanner } from '../ui/banners.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { findClearSpawn } from '../world/collision.js';
import { TROOPER } from '../data/trooper.js';
import { canPay, spendCP } from '../player/trooper/command.js';
import { allies, reinforceSquad, squadDown } from './squad.js';

const K = TROOPER.command;
let crate = null;      // the supply drop on its way down { g, t, at }
let readyAt = 0;       // the next call can go out at this game time

export function battlefieldCall(){
  if (!isTrooper() || G.mode !== 'play' || player.downed) return false;
  if (G.gt < readyAt){ showBanner('', 'CALL READY IN ' + Math.ceil(readyAt - G.gt) + 'S', 0.8); return false; }
  if (squadDown() > 0) return reinforce();
  return supplyDrop();
}
// what T would call right now, for the HUD and the tests
export const callNext = () => squadDown() > 0 ? 'reinforce' : 'supply';

function reinforce(){
  const R = K.reinforce;
  if (!canPay(R.cost, 'REINFORCE')) return false;
  const n = reinforceSquad();
  if (!n) return false;
  spendCP(R.cost); readyAt = G.gt + R.cd;
  showBanner('', 'REINFORCEMENTS · ' + n + ' BACK ON THE LINE', 1.2);
  sfx(520, 0.12, 'triangle', 0.05, 880); sfx(780, 0.18, 'triangle', 0.04, 1180);
  for (const a of allies) if (n) burst(V3(a.group.position.x, 1.2, a.group.position.z), 0x7bffae, 6, 4, 3);
  return true;
}

function supplyDrop(){
  const D = K.supply;
  if (crate){ showBanner('', 'SUPPLIES ALREADY INBOUND', 0.8); return false; }
  if (!canPay(D.cost, 'SUPPLY DROP')) return false;
  spendCP(D.cost); readyAt = G.gt + D.cd;
  const pp = playerPos(), fx = Math.sin(G.yaw), fz = Math.cos(G.yaw);
  const at = findClearSpawn(pp.x + fx * 2.2 + fz * 1.2, pp.z + fz * 2.2 - fx * 1.2, 0.8);
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: 0x6f7a6a }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.62), new THREE.MeshBasicMaterial({ color: 0x2f7fd6 }));
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, toneMapped: false }));
  box.position.y = 0.3; band.position.y = 0.3; lamp.position.y = 0.66;
  g.add(box, band, lamp);
  g.position.set(at.x, 14, at.z);
  scene.add(g);
  crate = { g, t: 0, at: V3(at.x, 0, at.z), landed: false };
  groundRing(V3(at.x, 0.1, at.z), 0x9fe0ff, 1.6, D.delay, 0.7);
  showBanner('', 'SUPPLY DROP INBOUND', 1.0);
  sfx(900, 0.2, 'sine', 0.04, 500);
  return true;
}

export function updateCalls(dt){
  if (!crate) return;
  const D = K.supply;
  crate.t += dt;
  if (!crate.landed){
    const k = clamp(crate.t / D.delay, 0, 1);
    crate.g.position.y = 14 * (1 - k * k);
    if (k >= 1){
      crate.landed = true; crate.t = 0;
      burst(V3(crate.at.x, 0.4, crate.at.z), 0xcfc4a8, 12, 6, 4);
      flashLight(0x9fe0ff, 5, 6, V3(crate.at.x, 1, crate.at.z), 0.25);
      S.boom(crate.at, 0.4);
      // the supplies: frags topped up, the guns cooled, a patch-up
      player.fragCharges = TROOPER.frag.charges + (player.up.fragExtra || 0);   // (as player/trooper/kit.js fragMax)
      player.fragT = 0;
      player.heat = 0; player.overheat = false; player.ventT = 0;
      if (player.hp > 0) player.hp = Math.min(maxHp(), player.hp + maxHp() * D.heal);
      floater(V3(crate.at.x, 1.4, crate.at.z), 'SUPPLIES · GRENADES · COOLANT · BACTA', '#9fe0ff');
    }
  } else if (crate.t > 6){ scene.remove(crate.g); crate = null; }   // the empty crate stays a moment
}
export function resetCalls(){
  if (crate){ scene.remove(crate.g); crate = null; }
  readyAt = 0;
}
