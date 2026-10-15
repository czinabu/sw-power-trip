// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Special enemy moves: bomber blasts, sniper aim lines, warbringer slam.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { S } from '../audio/sfx.js';
import { V3, TMP } from '../utils.js';
import { burst } from '../fx/particles.js';
import { screenFlash } from '../fx/floaters.js';
import { shared, G, enemies, barrels, player } from '../state.js';
import { flashLight } from '../fx/lights.js';
import { playerPos } from '../player/helpers.js';
import { damageEnemy, flinchEnemy } from './damage.js';
import { damageBoss } from '../boss/boss.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { hurtPlayer } from '../player/damage.js';
import { enemyDmgScale } from '../game/survival.js';

// SABOTEUR detonation — a concussive blast: unblockable on the player (dash i-frames / distance save you), chains
// to nearby foes, pops barrels. Fires when its fuse burns out OR when it's killed at close range.
export function bomberExplode(e){
  if (e._blew) return; e._blew = true;
  const pos = e.group.position.clone(), A = e.t;
  burst(V3(pos.x, pos.y+1.2, pos.z), 0xffae2a, 26, 13, 8); burst(V3(pos.x, pos.y+1.2, pos.z), 0xff5a1a, 16, 10, 6);
  spawnGroundShock(V3(pos.x, 0.1, pos.z), 0xffae2a, A.blastR + 1, 0.5, 0.7);
  flashLight(0xffae2a, 6, A.blastR*2, V3(pos.x, 1.2, pos.z), 0.3);
  screenFlash('radial-gradient(ellipse at center, rgba(255,170,60,.38), transparent 60%)', 0.55, 0.28);
  G.shake = Math.max(G.shake, 0.8); G.hitstop = Math.max(G.hitstop, 0.05); S.boom(pos, 1.3);
  for (const o of enemies){
    if (o === e || o.dead) continue;
    if (o.group.position.distanceTo(pos) < A.blastR) damageEnemy(o, 40, o.group.position.clone().sub(pos).setY(0).normalize(), 16);
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pos) < A.blastR) damageBoss(28);
  for (const b of barrels){ if (b.mesh.position.distanceTo(pos) < A.blastR && b.fuse < 0) b.fuse = 0.15; }
  const pp = playerPos();
  if (pp.distanceTo(pos) < A.blastR && player.dashT <= 0){
    const kd = TMP.subVectors(pp, pos).setY(0).normalize().clone();
    hurtPlayer(A.dmg * enemyDmgScale(), pos);
    player.vel.addScaledVector(kd, 16); player.vy = Math.max(player.vy, 6);   // blown off your feet
  }
}
// MARKSMAN laser sight — a thin beam muzzle→aim that brightens as the shot charges (the dodge tell)
const _aimGeo = new THREE.BoxGeometry(1, 1, 1);
export function updateAimLine(e, from, to, charge){
  if (!e.aimLine){
    e.aimLine = new THREE.Mesh(_aimGeo, new THREE.MeshBasicMaterial({ color: e.t.eye, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(e.aimLine);
  }
  const m = e.aimLine; m.visible = true;
  const d = Math.max(0.1, from.distanceTo(to));
  m.position.copy(from).lerp(to, 0.5);
  m.quaternion.setFromUnitVectors(V3(0,1,0), TMP.subVectors(to, from).normalize());
  const w = 0.015 + charge * 0.05;
  m.scale.set(w, d, w);
  m.material.opacity = 0.18 + charge * 0.72;
  m.material.color.setHex(charge > 0.9 ? 0xffffff : e.t.eye);
}
// WARBRINGER leap-slam impact — a big unblockable quake where it lands (dash/jump it; the warning ring tells you where)
export function warbringerSlam(e, pos){
  const R = 6.8;
  burst(V3(pos.x, 0.5, pos.z), 0xff6a3a, 26, 14, 7); burst(V3(pos.x, 0.5, pos.z), 0xffd24a, 14, 9, 5);
  spawnGroundShock(V3(pos.x, 0.1, pos.z), 0xff6a3a, R + 2, 0.5, 0.7);
  spawnGroundShock(V3(pos.x, 0.1, pos.z), 0xffd24a, R + 7, 0.75, 0.4);
  flashLight(0xff6a3a, 7, R*2, V3(pos.x, 1, pos.z), 0.32);
  G.shake = Math.max(G.shake, 1.1); G.hitstop = Math.max(G.hitstop, 0.06); S.boom(pos, 1.6);
  for (const o of enemies){ if (o === e || o.dead) continue; if (o.group.position.distanceTo(pos) < R) flinchEnemy(o, o.group.position.clone().sub(pos), 0.6); }
  const pp = playerPos();
  if (pp.distanceTo(pos) < R && player.dashT <= 0){
    const kd = TMP.subVectors(pp, pos).setY(0).normalize().clone();
    hurtPlayer(e.t.dmg * 1.3 * enemyDmgScale(), pos);   // big & unblockable — DASH or JUMP the slam
    player.vel.addScaledVector(kd, 15); player.vy = Math.max(player.vy, 7);
  }
}
