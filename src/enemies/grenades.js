// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The grenadier's thermal detonators: the lob, the landing ring that fills as the fuse burns, the blast, and a Jedi's
// Force push sending a live one back.

import * as THREE from 'three';
import { GRENADE } from '../data/tactics.js';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../utils.js';
import { burst } from '../fx/particles.js';
import { screenFlash } from '../fx/floaters.js';
import { flashLight } from '../fx/lights.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { TELLS, tellSound } from '../fx/tells.js';
import { scorchGround } from '../fx/scorch.js';
import { shared, G, enemies, barrels, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { hurtPlayer } from '../player/damage.js';
import { hooks } from '../net/run.js';
import { enemyDmgScale } from '../game/survival.js';
import { damageEnemy } from './damage.js';
import { damageBoss } from '../boss/boss.js';
import { blastAllies } from '../allies/squad.js';

export const grenades = [];
const ballGeo = new THREE.SphereGeometry(0.16, 10, 8);
const ringGeo = new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2);
const fillGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const markMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

// lob one from `from` onto `at`. friendly: thrown by a mind-tricked grenadier (hurts foes, never you)
export function throwGrenade(e, from, at, friendly){
  const R = e.t.blastR;
  const ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0x2a2a2e }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.9, 0.3), toneMapped: false }));
  ball.add(core);
  ball.position.copy(from);
  scene.add(ball);
  // the landing mark goes down the moment it leaves the hand: a rim at the blast radius and a fill that grows with the fuse
  const ring = new THREE.Mesh(ringGeo, markMat(friendly ? 0x66ccff : TELLS.area.color, 0.75));
  const fill = new THREE.Mesh(fillGeo, markMat(friendly ? 0x66ccff : TELLS.area.color, 0.22));
  ring.scale.setScalar(R); fill.scale.setScalar(0.01);
  ring.position.set(at.x, 0.07, at.z); fill.position.set(at.x, 0.065, at.z);
  ring.renderOrder = fill.renderOrder = 4;
  scene.add(ring, fill);
  const d = Math.hypot(at.x - from.x, at.z - from.z);
  const T = clamp(d / 16, GRENADE.flight[0], GRENADE.flight[1]);
  grenades.push({ ball, core, ring, fill, from: from.clone(), to: V3(at.x, 0.16, at.z), T, t: 0, fuse: e.t.fuse, fuseMax: e.t.fuse + T,
    R, dmg: e.t.dmg, friendly: !!friendly, landed: false, vel: null, beep: 0, foeDmg: e.t.foeDmg, foeKnock: e.t.foeKnock, onBlast: e.t.onBlast });
  if (!friendly && hooks.gren) hooks.gren(e, from, at);   // co-op: thrown on the other screen too
  if (friendly) sfx(320, 0.12, 'triangle', 0.05, 180); else tellSound('area');
}
export function clearGrenades(){
  for (const g of grenades) scene.remove(g.ball, g.ring, g.fill);
  grenades.length = 0;
}

export function updateGrenades(dt){
  for (let i = grenades.length - 1; i >= 0; i--){
    const n = grenades[i];
    n.fuse -= dt;
    if (n.vel){
      // pushed back by the Force: a fast flat throw that bursts on the first foe it meets (or where it lands)
      n.vel.y -= 18 * dt;
      n.ball.position.addScaledVector(n.vel, dt);
      if (n.ball.position.y < 0.16){ n.ball.position.y = 0.16; n.vel.y = 0; n.vel.x *= 0.9; n.vel.z *= 0.9; }
      for (const o of enemies) if (!o.dead && !o.converted && o.group.position.distanceTo(n.ball.position) < 1.4){ n.fuse = 0; break; }
      n.ring.position.set(n.ball.position.x, 0.07, n.ball.position.z); n.fill.position.copy(n.ring.position).setY(0.065);
    } else if (!n.landed){
      n.t += dt;
      const k = clamp(n.t / n.T, 0, 1), top = Math.max(n.from.y, 0.5) + GRENADE.arc;
      n.ball.position.set(n.from.x + (n.to.x - n.from.x) * k, 0, n.from.z + (n.to.z - n.from.z) * k);
      // a parabola from the hand through the apex onto the mark
      n.ball.position.y = (1 - k) * (1 - k) * n.from.y + 2 * (1 - k) * k * top * 1.1 + k * k * n.to.y;
      n.ball.rotation.x += dt * 9;
      if (k >= 1){ n.landed = true; burst(n.to, 0x888888, 3, 2, 2); sfx(160, 0.06, 'square', 0.04, 120); }
    }
    // the fuse: the fill closes on the rim, the core blinks faster
    const burn = 1 - clamp(n.fuse / n.fuseMax, 0, 1);
    n.fill.scale.setScalar(Math.max(0.01, n.R * burn));
    n.fill.material.opacity = 0.18 + burn * 0.3;
    const blink = Math.sin(G.gt * (8 + burn * 36)) > 0;
    n.core.material.color.setRGB(blink ? 2.6 : 1.2, blink ? 1.2 : 0.4, 0.3);
    if (n.landed && (n.beep -= dt) <= 0){ n.beep = 0.3 - burn * 0.22; sfx(900 + burn * 700, 0.04, 'square', 0.03, 900); }
    if (n.fuse <= 0){ explode(n); scene.remove(n.ball, n.ring, n.fill); grenades.splice(i, 1); }
  }
}

function explode(n){
  const pos = n.ball.position.clone(); pos.y = 0;
  burst(V3(pos.x, 1, pos.z), 0xffae2a, 22, 12, 7); burst(V3(pos.x, 1, pos.z), 0xff5a1a, 12, 9, 5);
  spawnGroundShock(V3(pos.x, 0.1, pos.z), 0xffae2a, n.R + 1, 0.45, 0.7);
  scorchGround(n.ball.position, n.R * 1.1);
  flashLight(0xffae2a, 5, n.R * 2.4, V3(pos.x, 1.2, pos.z), 0.25);
  G.shake = Math.max(G.shake, 0.55); S.boom(pos, 1);
  if (n.vis) return;   // co-op guest: only the picture; the host's blast event does the damage
  const turned = n.vel || n.friendly;
  const foeDmg = n.foeDmg ?? (turned ? GRENADE.pushedDmg : GRENADE.foeDmg), knock = n.foeKnock ?? (turned ? GRENADE.pushedKnock : GRENADE.foeKnock);   // (a thrower can set its own: the trooper's ion grenade)
  if (n.onBlast) n.onBlast(pos, n.R);
  for (const o of enemies){
    if (o.dead || o.converted) continue;
    const d = o.group.position.distanceTo(pos);
    if (d < n.R) damageEnemy(o, foeDmg * (1 - d / n.R * 0.4), o.group.position.clone().sub(pos).setY(0).normalize(), knock);
  }
  if (turned && shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pos) < n.R) damageBoss(foeDmg * 0.6);
  for (const b of barrels){ if (b.mesh.position.distanceTo(pos) < n.R && b.fuse < 0) b.fuse = 0.15; }
  if (turned) return;   // turned back, or thrown by an ally: it's on your side now
  blastAllies(pos, n.R, n.dmg * enemyDmgScale());   // the hero's squad is caught in it too
  if (hooks.blast) hooks.blast(pos, n.R, n.dmg * enemyDmgScale(), 'g');
  const pp = playerPos();
  if (Math.hypot(pp.x - pos.x, pp.z - pos.z) < n.R && pp.y < 3.2){   // a dash through it is a perfect dodge (hurtPlayer)
    screenFlash('radial-gradient(ellipse at center, rgba(255,170,60,.32), transparent 60%)', 0.5, 0.25);
    const res = hurtPlayer(n.dmg * enemyDmgScale(), pos, false, false, false, { unblockable: true, blast: true });
    if (res === 'hit'){
      const kd = TMP.subVectors(pp, pos).setY(0); if (kd.lengthSq() < 0.01) kd.set(rand(-1, 1), 0, rand(-1, 1));
      kd.normalize(); player.vel.addScaledVector(kd, 11); player.vy = Math.max(player.vy, 5);
    }
  }
}

// FORCE PUSH: live detonators in the cone fly back the way they came, toward the nearest foe in that direction
export function pushGrenades(pp, f, range, cosLim){
  let n = 0;
  for (const g of grenades){
    if (g.vel || g.friendly) continue;
    TMP.subVectors(g.ball.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (d > range + 1 || (d > 0.8 && TMP.normalize().dot(f) < cosLim - 0.15)) continue;
    let aim = f.clone(), best = 30;
    for (const o of enemies){
      if (o.dead || o.converted) continue;
      const v = o.group.position.clone().sub(g.ball.position); v.y = 0;
      const l = v.length();
      if (l < best && l > 0.5 && v.normalize().dot(f) > 0.5){ best = l; aim = v; }
    }
    g.vel = V3(aim.x * GRENADE.pushSpeed, 4, aim.z * GRENADE.pushSpeed);
    g.landed = true; g.fuse = Math.max(g.fuse, 0.9);
    g.ring.material.color.setHex(0x66ccff); g.fill.material.color.setHex(0x66ccff);
    n++;
  }
  return n;
}
