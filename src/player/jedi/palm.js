// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The holstered Jedi fights with Force-imbued hands and feet, tuned in CFG.holster:
//   LMB: a jab, a cross, then a finisher the movement keys pick (still: a two-palm burst · W: a driving lunge palm ·
//        A / D: a wide backhand sweep · S: a rising palm that throws light foes up). HOLD LMB to gather a charged palm.
//   E:   mid-string, a spinning Force kick round the ring; in the air, a Force stomp straight down (else the front kick).
//   A landed blow feeds the Force back, and Push or Pull thrown right after one flows out of it (force.js asks flowReady).

import * as THREE from 'three';
import { CFG } from '../../data/config.js';
import { stamDelay } from '../stamina.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, TMP, clamp } from '../../utils.js';
import { floater } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, barrels, keys, player } from '../../state.js';
import { forcePower, fwd, rightV, playerPos, stance } from '../helpers.js';
import { damageEnemy, flinchEnemy, staggerEnemy } from '../../enemies/damage.js';
import { damageBoss, bossStagger } from '../../boss/boss.js';
import { inReach } from '../../enemies/bodyshape.js';
import { guardImpact, isGuarding } from '../../enemies/duel.js';
import { pushGrenades } from '../../enemies/grenades.js';
import { focusDmgMul, addFocus } from './focus.js';
import { spawnPushWave, spawnGroundShock } from '../../fx/vfx.js';
import { sparks, dustRing } from '../../fx/ink.js';
import { palmPoints, handList } from '../../fx/palms.js';
import { hooks } from '../../net/run.js';
import { tutEvent } from '../../game/tutor-bus.js';

const POSTURE = { palm: 20, burst: 40, spin: 30, stomp: 25 };   // how hard each blow cracks a duellist's guard (the front kick is DUEL.posture.kick)
const H = () => CFG.holster;
const GLOW_GEO = new THREE.SphereGeometry(0.09, 10, 8);
const busy = () => G.mode !== 'play' || player.blockHeld || player.judgeT > 0 || player.mendT > 0 || player.kickT > 0 || player.mantle || player.hang || player.flinchT > 0;
const winded = () => { if (G.gt - player.lastWinded > 0.6){ player.lastWinded = G.gt; floater(playerPos(), 'WINDED', '#ffaa66'); } };

/* ---------------- LMB: tap for the string, hold for the charged palm ---------------- */
export function strikePress(){
  if (busy() || player.palmHold) return;
  if (player.palmT > 0){ if (player.palmT < player.palmMax * 0.5) player.palmQueued = true; return; }   // a press late in a strike queues the next
  player.palmHold = { t0: G.gt };
}
export function strikeRelease(){
  const h = player.palmHold;
  if (!h) return;
  player.palmHold = null;
  const t = G.gt - h.t0;
  if (t < H().charge.min) forceStrike(); else chargedPalm(clamp((t - H().charge.min) / (H().charge.full - H().charge.min), 0, 1));
}
// how far the gather has come (0 → 1), or -1 when the hands aren't gathering: the animation and the fist glow read it
export function chargeFrac(){
  const h = player.palmHold;
  if (!h) return -1;
  const C = H().charge, t = G.gt - h.t0;
  return t < C.min ? -1 : clamp((t - C.min) / (C.full - C.min), 0, 1);
}

// the next strike in the string. A press late in a strike queues the next one; early mashing is ignored.
export function forceStrike(){
  if (busy()) return;
  if (player.palmT > 0){ if (player.palmT < player.palmMax * 0.5) player.palmQueued = true; return; }
  const n = H().strike.length;
  const step = G.gt - player.lastPalmEnd < H().comboGap ? (player.palmStep + 1) % (n + 1) : 0;
  let B = H().strike[step], side = 0;
  if (!B){   // the finisher: the movement keys pick it, as they pick a saber cut
    const k = keys['w'] ? 'forward' : keys['s'] ? 'back' : keys['a'] || keys['d'] ? 'side' : 'neutral';
    B = H().finish[k];
    side = keys['d'] ? 1 : keys['a'] ? -1 : 0;
  }
  startStrike(B, step, side);
}

function startStrike(B, step, side = 0){
  if (player.stam < B.stamina){ winded(); return; }
  player.stam -= B.stamina; player.stamDelay = stamDelay();
  if (player.slideT > 0) player.slideT = 0;
  player.palmStep = step;
  player.palmT = player.palmMax = B.dur;
  const hand = B.burst || B.charge ? 'both' : B.kind === 'backhand' ? (side < 0 ? 'L' : 'R') : (step % 2 ? 'R' : 'L');
  player.palm = { B, hand, side: side || 1, landed: false };
  player.vel.addScaledVector(fwd(), B.lunge || (B.burst ? 5 : 3));   // step into it
  sfx(B.burst || B.charge ? 160 : 260, 0.08, 'sine', 0.04, B.burst || B.charge ? 70 : 120);   // the air gathering in the hand
}

/* the charged palm: both hands thrown together, everything about the burst grown with how long it gathered */
function chargedPalm(frac){
  if (busy()) return;
  const C = H().charge, L = (a) => a[0] + (a[1] - a[0]) * frac;
  startStrike({ kind: 'charge', charge: true, burst: true, full: frac >= 1, dmg: L(C.dmg), range: L(C.range), angle: C.angle,
                knock: L(C.knock), posture: L(C.posture), stamina: C.stamina, dur: 0.42, contact: 0.3 }, H().strike.length);
  tutEvent('chargedPalm');
}

/* ---------------- E: the spinning kick (mid-string) and the stomp (in the air) ---------------- */
// true when E was taken here; false leaves it to the front kick (combat.js forceKick)
export function holsteredKick(){
  if (G.mode !== 'play' || player.kickT > 0 || player.judgeT > 0 || player.mendT > 0 || player.hang || player.mantle || player.flinchT > 0) return false;
  if (!player.grounded && !player.slamming && !player.stomp && !player.flip){
    const K = H().stomp;
    if (player.stam < K.stamina){ winded(); return true; }
    player.stam -= K.stamina; player.stamDelay = stamDelay();
    player.stomp = true; player.gliding = false;
    player.vy = -K.fall; player.vel.multiplyScalar(0.5); player.moveVel.multiplyScalar(0.4);
    const sp = playerPos();
    sparks(V3(sp.x, sp.y + 1, sp.z), stance().blade, 8, 8, { dir: V3(0, -1, 0), cone: 0.4, life: 0.25, grav: 0 });
    S.dash();
    return true;
  }
  // in the string (a strike in flight, or just after one): the spin kick carries it
  if (!(player.palmT > 0) && G.gt - player.lastPalmEnd > H().comboGap) return false;
  const K = H().spin;
  if (player.stam < K.stamina){ winded(); return true; }
  player.stam -= K.stamina; player.stamDelay = stamDelay();
  player.palmT = 0; player.palm = null; player.palmQueued = false; player.lastPalmEnd = -9;   // the kick finishes the string
  player.kickT = player.kickMax = K.recover; player.kickKind = 'spin'; player.spinLanded = false;
  player.vel.addScaledVector(fwd(), 2);
  sfx(200, 0.1, 'sine', 0.04, 90);
  return true;
}

function landSpin(){
  const K = H().spin, pp = playerPos(), col = stance().blade;
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > 2.2) continue;
    TMP.y = 0;
    if (!inReach(e, pp, K.reach)) continue;
    const dir = TMP.lengthSq() > 0.001 ? TMP.clone().normalize() : fwd();
    if (isGuarding(e)) guardImpact(e, POSTURE.spin);
    damageEnemy(e, K.dmg * blowMul(), dir, K.knock * forcePower() * (player.up.knock || 1));
    flinchEnemy(e, dir, 0.8);
    hit++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < K.reach + 1.2){ damageBoss(K.dmg * 0.5); hit++; }
  spawnGroundShock(pp, col, K.reach + 2, 0.3, 0.4);
  sparks(V3(pp.x, pp.y + 1.1, pp.z), col, 10, 7, { dir: V3(0, 0.2, 0), cone: 3, life: 0.2, grav: 0 });
  landed(hit, true, 0.05, 0.3);
  if (hit) S.punch(V3(pp.x, pp.y + 1.1, pp.z), 1.1); else S.jump();
  if (hooks.power) hooks.power('spin', col, K.reach);   // co-op: the partner sees the ring go out
}

// the stomp lands (locomotion.js calls this on touchdown)
export function stompImpact(){
  const K = H().stomp, pp = playerPos(), col = stance().blade;
  S.slam(); G.shake = Math.max(G.shake, 0.7); G.hitstop = Math.max(G.hitstop, 0.06);
  spawnGroundShock(pp, col, K.radius + 3, 0.4, 0.5);
  dustRing(pp, K.radius);
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    if (!inReach(e, pp, K.radius)) continue;
    const d = TMP.length(), dir = d > 0.01 ? TMP.clone().normalize() : fwd();
    if (isGuarding(e)) guardImpact(e, POSTURE.stomp);
    damageEnemy(e, K.dmg * blowMul() * (1 - d / K.radius * 0.4), dir, K.knock * forcePower() * (player.up.knock || 1));
    hit++;
  }
  for (const b of barrels) if (b.mesh.position.distanceTo(pp) < K.radius && b.fuse < 0) b.fuse = 0.2;
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < K.radius){ damageBoss(K.dmg * 0.5); hit++; }
  landed(hit, true, 0, 0);
  if (hooks.power) hooks.power('slam', col, K.radius);
}

/* ---------------- per frame ---------------- */
export function updateForceStrike(dt){
  if (player.palmHold){
    if (busy()) player.palmHold = null;
    else if (G.gt - player.palmHold.t0 >= H().charge.max) strikeRelease();   // held too long: it goes on its own
  }
  if (player.pullStrikeT > 0){   // a Pull out of a strike: the next strike meets them as they arrive
    player.pullStrikeT -= dt;
    if (player.pullStrikeT <= 0){ player.pullStrikeT = 0; player.lastPalmEnd = G.gt; forceStrike(); }
  }
  if (player.kickKind === 'spin' && player.kickT > 0 && !player.spinLanded && player.kickT < player.kickMax * 0.6){ player.spinLanded = true; landSpin(); }
  updateFistGlow(dt);
  if (!(player.palmT > 0)) return;
  player.palmT -= dt;
  const P = player.palm;
  if (P && !P.landed && player.palmMax - player.palmT >= P.B.dur * P.B.contact){ P.landed = true; landStrike(P); }
  if (player.palmT <= 0){
    player.palmT = 0; player.palm = null; player.lastPalmEnd = G.gt;
    if (player.palmQueued){ player.palmQueued = false; forceStrike(); }
  }
}

const blowMul = () => (player.up.dmg || 1) * focusDmgMul() * forcePower();

function landStrike(P){
  const B = P.B, f = fwd(), pp = playerPos(), cosLim = Math.cos(B.angle);
  const col = stance().blade, big = B.burst || B.charge;
  spawnPushWave(pp.clone(), f.clone(), col, B.charge ? 0.35 + 0.5 * (B.range / 9) : big ? 0.45 : B.sweep ? 0.3 : 0.2, handList(P.hand));   // out of the striking hand(s)
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > 2.5) continue;
    TMP.y = 0;
    const d = TMP.length();
    if (!inReach(e, pp, B.range, d > 1.2 ? f : null, cosLim)) continue;
    let dir = d > 0.01 ? TMP.clone().normalize() : f.clone();
    if (B.sweep) dir.addScaledVector(rightV(), P.side * 0.9).normalize();   // the backhand throws them across, the way it swept
    if (isGuarding(e)) guardImpact(e, B.posture || (big ? POSTURE.burst : POSTURE.palm));   // the Force goes round a blade: it batters the guard instead
    const launch = B.launch && !e.t.heavy && !e.t.fly;
    // a guest's foe belongs to the host (co-op): the launch travels as a hard knock that floors it there
    const knock = launch && e.net ? 18 : B.knock * forcePower() * (1 - d / B.range * 0.4) * (player.up.knock || 1);
    damageEnemy(e, B.dmg * blowMul(), dir, knock);
    if (launch && !e.dead && !e.net){ e.state = 'knockdown'; e.st = 1.0; e.vel.set(dir.x * 2, B.launch, dir.z * 2); }
    else flinchEnemy(e, dir, big ? 1 : 0.5);
    if (B.full && !e.dead && !e.net && (e.elite || e.t.heavy)) staggerEnemy(e, dir.x, dir.z, 'BROKEN!');
    hit++;
  }
  if (shared.boss && shared.boss.hp > 0){
    TMP.subVectors(shared.boss.group.position, pp); TMP.y = 0;
    if (TMP.length() < B.range + 1 && TMP.normalize().dot(f) > cosLim){
      damageBoss(B.dmg * (B.charge ? 0.7 : 0.5)); hit++;
      if (B.full) bossStagger();
    }
  }
  // the burst and the charged palm also turn blaster fire in the cone back on the shooters, like a small Push
  if (big){
    for (const b of bolts){
      if (b.friendly) continue;
      TMP.subVectors(b.mesh.position, pp); TMP.y = 0;
      if (TMP.length() < B.range && TMP.normalize().dot(f) > cosLim){ b.friendly = true; b.dir.negate(); b.dmg = 20; b.mesh.material.color.setHex(0x66ccff); }
    }
    if (B.full && pushGrenades(pp, f, B.range, cosLim)) floater(pp, 'RETURNED', '#7fd4ff');
  }
  const up = B.launch ? 1.9 : 1.4, ip = V3(pp.x + f.x * 1.4, pp.y + up, pp.z + f.z * 1.4);
  sparks(ip, col, big ? 6 : 3, big ? 8 : 6, { dir: B.launch ? V3(f.x * 0.4, 1, f.z * 0.4).normalize() : f, cone: B.sweep ? 1.1 : 0.5, life: 0.18, grav: 0, size: 0.38 });
  if (B.charge){ G.shake = Math.max(G.shake, 0.3 + 0.5 * (B.range / 9)); S.push(); }
  const fin = big || B.lunge || B.sweep || B.launch;
  landed(hit, fin, fin ? 0.06 : 0.03, fin ? 0.35 : 0.18);
  if (hit) tutEvent('palmHit');
  if (hit){ if (big) S.push(); else S.punch(ip, B.lunge ? 1.1 : 0.8); }
  if (hooks.power && big) hooks.power('push', col, B.range * 0.5);
}

// a blow that found someone: Focus, the hit's weight, a little Force back, and the window Push / Pull flow out of
function landed(hit, finisher, stop, shake){
  if (!hit) return;
  const R = H().refund;
  addFocus(finisher ? 8 : 4);
  G.hitstop = Math.max(G.hitstop, stop); G.shake = Math.max(G.shake, shake);
  player.force = Math.min(CFG.player.maxForce, player.force + Math.min(R.max, hit * (finisher ? R.finisher : R.hit)));
  player.lastPalmHit = G.gt;
}

/* ---------------- STRIKE INTO POWER (force.js) ---------------- */
// is a Push / Pull thrown now flowing out of an unarmed blow?
export function flowReady(){
  return G.hero !== 'mando' && player.holstered && G.gt - player.lastPalmHit < H().flow.window;
}
// the Pull that flowed out of a strike: the next strike goes in as they land in front of you
export function queuePullStrike(){
  player.palmT = 0; player.palm = null; player.palmQueued = false;
  player.pullStrikeT = H().flow.strikeAt;
}

/* ---------------- the Force in the hands: a glow on each fist, in the form's colour ---------------- */
// built on demand for any hero model (this browser's, or a co-op partner's puppet: net/pose.js)
export function ensureFistGlow(hero){
  if (!hero.rig || !hero.rig.sockets) return null;
  if (hero.fistGlow && hero.fistGlow.rig === hero.rig) return hero.fistGlow;   // (a rebuilt model gets a fresh pair)
  hero.fistGlow = ['handL', 'handR'].map(k => {
    const m = new THREE.Mesh(GLOW_GEO, new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(0, -0.06, 0);
    hero.rig.sockets[k].add(m);
    return m;
  });
  hero.fistGlow.rig = hero.rig;
  return hero.fistGlow;
}
// lay a glow level (0 → 1) and colour on a hero's fists
export function setFistGlow(hero, level, color){
  const gl = ensureFistGlow(hero);
  if (!gl) return;
  for (const m of gl){
    m.material.opacity = level * 0.85;
    m.scale.setScalar(0.6 + level * 1.1);
    if (color != null) m.material.color.setHex(color);
  }
}
let glowLevel = 0;
function updateFistGlow(dt){
  const on = G.hero !== 'mando' && player.holstered;
  const ch = chargeFrac();
  const want = !on ? 0 : ch >= 0 ? 0.55 + 0.45 * ch : player.palmT > 0 || (player.kickT > 0 && player.kickKind === 'spin') || player.stomp ? 0.75 : 0.22;
  glowLevel += (want - glowLevel) * Math.min(1, dt * (want > glowLevel ? 18 : 6));
  if (ch >= 0 && Math.random() < dt * 20){   // the Force gathering: motes drawn in round the cupped palms
    for (const h of palmPoints(['L', 'R'])) sparks(h, stance().blade, 1, 2.5, { dir: V3(0, 1, 0), cone: 3, life: 0.18, grav: 0, size: 0.35 });
  }
  if (player.rig) setFistGlow(player, glowLevel, stance().blade);
}
export const fistGlowLevel = () => glowLevel;
