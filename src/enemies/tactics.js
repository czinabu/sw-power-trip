// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Squad tactics: the run-depth ramp, trooper feints and held swings, planned blaster fire, pincer approaches, officer
// orders (volley, flank) and the morale break when an officer falls, and the lancer's lunge.

import * as THREE from 'three';
import { RAMP, TROOP_MELEE, TROOP_FIRE, PINCER, ORDERS, LUNGE } from '../data/tactics.js';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, dampToward } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { G, enemies, player } from '../state.js';
import { heroPosOf } from './targets.js';
import { segBlockedBySolids } from '../world/collision.js';
import { hurtPlayer } from '../player/damage.js';
import { enemyDmgScale } from '../game/survival.js';
import { staggerEnemy } from './damage.js';
import { TELLS, tellFx } from '../fx/tells.js';
import { behindCamera } from './director.js';
import { showBanner } from '../ui/banners.js';

/* ---------------- the ramp ---------------- */
// 0..1-ish: how much of each trick's full chance applies right now (run depth × difficulty)
export function tacticsRamp(){
  const n = G.endless ? (G.endlessWave || 0) : (G.waveTotal || 0);
  const k = RAMP.from + (1 - RAMP.from) * clamp((n - 1) / (RAMP.full - 1), 0, 1);
  return k * (RAMP.diff[G.diff] || 1);
}
const roll = p => Math.random() < p * tacticsRamp();

/* ---------------- trooper melee: held swings and feints (foes without a duel profile) ---------------- */
// called as a plain melee foe commits to a wind-up (ai.js has set e.wu / e.st). Sets e.troop, or clears it.
export function planTroopMelee(e){
  const p = e.swing || TROOP_MELEE[e.type];   // (the Warbringer carries its own, longer hold: data/duel.js)
  e.troop = null;
  if (!p || e.converted) return;
  const tr = { hold: 0, feint: false };
  tr.feint = roll(p.feint);
  if (!tr.feint && roll(p.hold)) tr.hold = rand(p.holdT[0], p.holdT[1]);
  if (!tr.feint && !tr.hold) return;
  e.troop = tr;
  e.wuBase = e.wu;
  e.wu += tr.hold; e.st = e.wu;
}
// every wind-up frame: a feint breaks off part-way, settles, and comes again fast (returns true if it broke off)
export function troopFeint(e, wk){
  const tr = e.troop;
  if (!tr || !tr.feint || wk < TROOP_MELEE.feintAt) return false;
  e.troop = null;
  e.state = 'recover'; e.st = TROOP_MELEE.feintRest;
  e.feintAgain = true;   // the real one comes straight after (ai.js chase)
  e.group.userData.bodyMat.emissiveIntensity = 0;
  S.whoosh(e.group.position, false);
  return true;
}
// the held apex: the weapon trembles overhead, the eyes burn (ai.js windup, once the coil has topped out)
export function holdTremble(e, wk){
  const u = e.group.userData;
  if (!e.troop || !e.troop.hold || wk < 1) return;
  if (u.weaponArm) u.weaponArm.rotation.x += Math.sin(G.gt * 42) * 0.035;
  if (Math.random() < 0.25) burst(V3(e.group.position.x, e.group.position.y + (e.t.heavy ? 3.1 : 2.4), e.group.position.z), 0xff3a1a, 1, 2, 3, 0.6);
}

/* ---------------- line troopers: planned fire ---------------- */
export const lineTrooper = t => t.ranged && !t.sniper && !t.grenade && !t.officer;
// as a line trooper starts aiming: a double-tap, or a held aim
export function planShot(e){
  e.burstLeft = 0;
  if (e.converted || e.volley || !lineTrooper(e.t)) return;
  if (roll(TROOP_FIRE.burst)) e.burstPlan = 1;
  else { e.burstPlan = 0; if (roll(TROOP_FIRE.hold)){ e.wu += rand(TROOP_FIRE.holdT[0], TROOP_FIRE.holdT[1]); e.st = e.wu; } }
}

/* ---------------- pincers ---------------- */
const bearingOf = (p, pp) => Math.atan2(p.x - pp.x, p.z - pp.z);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const flanking = () => (G.flankUntil || 0) > G.gt && (G.flankUntil - G.gt) <= ORDERS.flank.time;
// the director just handed `e` a token: if another holder is already closing from the same side (or a FLANK order is
// on), it swings wide around you instead of queuing behind
export function assignApproach(e){
  e.appr = null;
  if (e.converted || e.t.ranged) return;
  const pp = heroPosOf(e), b = bearingOf(e.group.position, pp), flank = flanking();
  let near = null;
  for (const o of enemies){
    if (o === e || o.dead || !o.token) continue;
    if (o.hero !== e.hero) continue;   // in co-op, only the ones closing on the same hero
    if (Math.abs(wrap(bearingOf(o.group.position, pp) - b)) < PINCER.near){ near = o; break; }
  }
  if (!near && !flank) return;
  if (!near && !roll(1)) return;   // early on, a flank order only sends some of them wide
  let side = near ? Math.sign(wrap(b - bearingOf(near.group.position, pp))) : 0;
  if (!side) side = Math.random() < 0.5 ? 1 : -1;
  e.appr = { bear: wrap(b + side * (flank ? PINCER.flankArc : PINCER.arc)), t: 0 };
}
// a holder on a wide approach: steer around you toward its wanted bearing. Writes the heading to out, or returns false
// once it's there (or gave up) and should walk straight in
export function approachSteer(e, dt, pp, dist, out){
  const a = e.appr;
  if (!a || !e.token) { e.appr = null; return false; }
  a.t += dt;
  const cur = bearingOf(e.group.position, pp), diff = wrap(a.bear - cur);
  if (Math.abs(diff) < PINCER.done || a.t > PINCER.maxT || dist < e.t.range + 0.4){ e.appr = null; return false; }
  const R = Math.max(e.t.range + 1.6, Math.min(dist, 6.5)), ang = cur + clamp(diff, -0.75, 0.75);
  const x = pp.x + Math.sin(ang) * R - e.group.position.x, z = pp.z + Math.cos(ang) * R - e.group.position.z;
  const l = Math.hypot(x, z) || 1;
  out.x = x / l; out.z = z / l;
  return true;
}

/* ---------------- officers ---------------- */
// officers' and lancers' cooldowns run whatever they're doing (an officer spends most of its time aiming or recovering)
export function tickTactics(e, dt){
  if (e.t.officer){ if (e.orderCd === undefined) e.orderCd = rand(ORDERS.firstCd[0], ORDERS.firstCd[1]); else e.orderCd -= dt; }
  if (e.t.lancer){ if (e.lungeCd === undefined) e.lungeCd = rand(LUNGE.firstCd[0], LUNGE.firstCd[1]); else e.lungeCd -= dt; }
}
// in chase: maybe call an order (returns true when it starts one: the state is 'order')
export function tryOrder(e, dt, dist, pp){
  if (e.converted || !(e.orderCd <= 0)) return false;
  if (dist > ORDERS.sight || (G.orderBusy || 0) > G.gt || segBlockedBySolids(e.group.position.x, e.group.position.z, pp.x, pp.z)) return false;
  // pick an order that has the troops to carry it out
  const shooters = volleyTroops(e, pp).length, melee = enemies.filter(o => !o.dead && !o.converted && !o.t.ranged && !o.t.bomber && o !== e).length;
  const canVolley = shooters >= ORDERS.volley.min, canFlank = melee >= ORDERS.flank.min && !flanking();
  if (!canVolley && !canFlank){ e.orderCd = 1; return false; }
  e.order = canVolley && (!canFlank || Math.random() < 0.55) ? 'volley' : 'flank';
  e.state = 'order'; e.st = ORDERS.tell;
  e.orderCd = rand(ORDERS.cd[0], ORDERS.cd[1]);
  G.orderBusy = G.gt + ORDERS.tell + 1.2;
  const g = e.group;
  floater(V3(g.position.x, g.position.y + 1.6, g.position.z), e.order === 'volley' ? 'VOLLEY!' : 'FLANK!', '#ffc040');
  spawnGroundShock(g.position, 0xffc040, 3, 0.45, 0.55);
  sfx(1250, 0.1, 'square', 0.045, 1550); setTimeout(() => sfx(1550, 0.14, 'square', 0.04, 1250), 120);   // a two-note whistle
  if (!G.seenOrder){ G.seenOrder = true; if (G.mode === 'play' && !G.training) showBanner('ORDERS', 'An officer is calling the shots. Hit it while its arm is up to cut the order off, or drop it and its squad falters.', 3.2); }
  return true;
}
function volleyTroops(e, pp){
  const out = [];
  for (const o of enemies){
    if (o.dead || o.converted || !lineTrooper(o.t) || !(o.state === 'chase' || o.state === 'recover')) continue;
    if (o.group.position.distanceTo(e.group.position) > ORDERS.volley.radius) continue;
    const d = Math.hypot(o.group.position.x - pp.x, o.group.position.z - pp.z);
    if (d > o.t.range) continue;
    if (!o.t.fly && segBlockedBySolids(o.group.position.x, o.group.position.z, pp.x, pp.z)) continue;
    out.push(o);
    if (out.length >= ORDERS.volley.max) break;
  }
  return out;
}
// the 'order' state: arm up, pointing at you, then the order goes out
export function updateOrder(e, dt, tx, tz){
  const g = e.group, u = g.userData, k = 1 - Math.max(e.st, 0) / ORDERS.tell;
  g.rotation.y = Math.atan2(tx, tz);
  if (u.weaponArm){ u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, -2.55, dt, 14); u.weaponArm.rotation.z = dampToward(u.weaponArm.rotation.z, 0.35, dt, 14); }
  u.bodyMat.emissive.setHex(0xffc040); u.bodyMat.emissiveIntensity = 0.4 + k * 0.8;
  if (e.st > 0) return;
  u.bodyMat.emissiveIntensity = 0;
  e.state = 'recover'; e.st = 0.5;
  const pp = heroPosOf(e);
  if (e.order === 'volley'){
    // every trooper in reach aims on the same beat, and they fire together
    for (const o of volleyTroops(e, pp)){
      o.state = 'windup'; o.wu = o.st = ORDERS.volley.aim; o.volley = true; o.burstPlan = 0; o.plan = null; o.troop = null;
      spawnGroundShock(o.group.position, 0xffc040, 1.8, 0.35, 0.5);
    }
    S.windup(g.position, true);
  } else {
    G.flankUntil = G.gt + ORDERS.flank.time;
    // the holders already closing re-plan their approach around you
    for (const o of enemies) if (o.token && !o.dead) assignApproach(o);
  }
}
// an officer falls: the troops near it lose their nerve for a moment
export function officerDown(e){
  if (e.converted) return;
  const F = ORDERS.falter, p = e.group.position;
  let n = 0;
  for (const o of enemies){
    if (o === e || o.dead || o.converted || o.warbringer || o.champion || o.t.bomber) continue;
    if (o.group.position.distanceTo(p) > F.radius) continue;
    if (o.state === 'windup' || o.state === 'chase' || o.state === 'recover' || o.state === 'order'){
      o.state = 'chase'; o.stunT = Math.max(o.stunT || 0, F.time); o.volley = false;
      if (o.aimLine) o.aimLine.visible = false;
      o.group.userData.bodyMat.emissiveIntensity = 0;
      n++;
    }
  }
  if (G.flankUntil > G.gt) G.flankUntil = G.gt;   // the order dies with it
  if (n) floater(V3(p.x, p.y + 1.8, p.z), 'SQUAD FALTERS', '#ffe27a');
}

/* ---------------- lancer lunge ---------------- */
const lineGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);   // 1×1, from its origin forward
function lungeLine(e){
  if (e.lungeLine) return e.lungeLine;
  const m = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: TELLS.parry.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.renderOrder = 4;
  scene.add(m); e.lungeLine = m;
  return m;
}
export function cleanupTactics(e){
  if (e.lungeLine){ scene.remove(e.lungeLine); e.lungeLine.material.dispose(); e.lungeLine = null; }
}
// in chase: plant and lunge, if you're in the band, in sight, in front of the camera and no one else is lunging
export function tryLunge(e, dt, dist, pp){
  if (e.converted || !(e.lungeCd <= 0) || dist < LUNGE.min || dist > LUNGE.max || pp.y - e.group.position.y > 1.6) return false;
  const g = e.group;
  if (behindCamera(g.position) || segBlockedBySolids(g.position.x, g.position.z, pp.x, pp.z)) return false;
  let n = 0; for (const o of enemies) if (!o.dead && (o.state === 'lungewind' || o.state === 'lunge')) n++;
  if (n >= LUNGE.slots){ e.lungeCd = 0.5; return false; }
  e.state = 'lungewind'; e.st = LUNGE.tell;
  e.lungeDir = { x: 0, z: 1 }; e.lungeHit = false;
  tellFx('parry', g.position, 2.6);   // the shared parry-or-dodge tell
  if (!G.seenLunge){ G.seenLunge = true; if (G.mode === 'play' && !G.training) showBanner('LUNGE', 'The line on the ground is where the lancer strikes. Step off it as it locks, or parry the point.', 2.6); }
  return true;
}
export function updateLungeWind(e, dt, pp){
  const g = e.group, u = g.userData, k = 1 - Math.max(e.st, 0) / LUNGE.tell;
  if (k < LUNGE.lockAt){   // tracking you
    const dx = pp.x - g.position.x, dz = pp.z - g.position.z, l = Math.hypot(dx, dz) || 1;
    e.lungeDir.x = dx / l; e.lungeDir.z = dz / l; e.lungeLen = l + LUNGE.over;
  } else if (!e.lungeLocked){ e.lungeLocked = true; sfx(1700, 0.12, 'sawtooth', 0.035, 2400); }
  g.rotation.y = Math.atan2(e.lungeDir.x, e.lungeDir.z);
  g.rotation.x = -0.28 * Math.min(1, k * 1.6);   // sinks onto the back foot
  if (u.weaponArm){ u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, -0.2, dt, 12); u.weaponArm.rotation.z = dampToward(u.weaponArm.rotation.z, -0.15, dt, 12); }   // the pike drawn back level
  u.bodyMat.emissive.setHex(TELLS.parry.accent); u.bodyMat.emissiveIntensity = 0.3 + k * 1.6;
  const m = lungeLine(e);
  m.visible = true;
  m.position.set(g.position.x, 0.06, g.position.z);
  m.rotation.y = g.rotation.y;
  m.scale.set(e.lungeLocked ? 0.7 : 0.45, 1, e.lungeLen);
  m.material.opacity = 0.15 + k * 0.55;
  m.material.color.setHex(e.lungeLocked ? TELLS.parry.color : TELLS.parry.accent);
  if (e.st > 0) return;
  e.state = 'lunge'; e.st = Math.min(0.6, e.lungeLen / LUNGE.speed); e.lungeLocked = false;
  S.whoosh(g.position, true);
}
// pp is the hero this lancer is after; a partner's puppet (remote) only gets the show, no blow (co-op phase 2)
export function updateLunge(e, dt, pp, remote = false){
  const g = e.group, u = g.userData, d = e.lungeDir;
  const ox = g.position.x, oz = g.position.z;
  g.position.x += d.x * LUNGE.speed * dt; g.position.z += d.z * LUNGE.speed * dt;
  g.rotation.x = dampToward(g.rotation.x, 0.3, dt, 16);
  if (u.weaponArm) u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, -0.55, dt, 20);   // ...and driven out
  if (e.lungeLine) e.lungeLine.material.opacity = Math.max(0, e.lungeLine.material.opacity - dt * 3);
  if (Math.random() < 0.6) burst(V3(g.position.x, g.position.y + 1.3, g.position.z), e.t.eye, 1, 2, 1, 0.6);
  // caught along the path it swept this frame?
  if (!e.lungeHit && !remote && Math.abs(pp.y - g.position.y) < 1.8){
    const sx = g.position.x - ox, sz = g.position.z - oz, sl = sx*sx + sz*sz || 1;
    const k = clamp(((pp.x - ox) * sx + (pp.z - oz) * sz) / sl, 0, 1);
    if (Math.hypot(pp.x - (ox + sx*k), pp.z - (oz + sz*k)) < LUNGE.hitR){
      e.lungeHit = true;
      const res = hurtPlayer(e.t.dmg * LUNGE.dmgMul * enemyDmgScale(), g.position, false, true, false, { unblockable: true });
      if (res === 'parried' || res === 'clashed'){ endLunge(e); staggerEnemy(e, -d.x, -d.z); return; }
      if (res === 'hit'){ player.vel.x += d.x * 9; player.vel.z += d.z * 9; burst(V3(pp.x, 1.5, pp.z), 0xff5533, 8, 6, 3); }
    }
  }
  if (e.st > 0) return;
  endLunge(e);
  e.state = 'recover'; e.st = e.lungeHit ? e.t.recover : LUNGE.miss;
  if (!e.lungeHit) floater(V3(g.position.x, g.position.y + 1.2, g.position.z), 'OVERSHOT', '#9fe6ff');
}
function endLunge(e){
  e.lungeCd = rand(LUNGE.cd[0], LUNGE.cd[1]);
  e.lungeLocked = false;
  if (e.lungeLine) e.lungeLine.visible = false;
  e.group.userData.bodyMat.emissiveIntensity = 0;
}
// a lancer knocked out of its tell (interrupted, floored, frozen) drops the line
export function dropLungeLine(e){ if (e.lungeLine) e.lungeLine.visible = false; e.lungeLocked = false; }

