// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Mandalorian's close-quarters kit on E: a four-beat string, the jet charge, the dive kick, the vambrace catch and takedowns.

import { MANDO_MELEE as M, DUEL } from '../../data/duel.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, keys, player } from '../../state.js';
import { fwd, playerPos } from '../helpers.js';
import { damageEnemy, flinchEnemy, staggerEnemy } from '../../enemies/damage.js';
import { duelDefend, guardImpact, isGuarding, lockKick } from '../../enemies/duel.js';
import { bodyRadius } from '../jedi/bladehit.js';
import { damageBoss } from '../../boss/boss.js';
import { spawnHitSpark, spawnGroundShock } from '../../fx/vfx.js';
import { inkSprite, sparks, puff, clashFlash, thrust } from '../../fx/ink.js';

const DOWNED = { stagger: 1, knockdown: 1, getup: 1 };
const NO_LAUNCH = { launch: false }, KNEE = { launch: false, fold: 1 };   // a knee doubles the foe over
const live = e => !e.dead && !e.converted && e.state !== 'spawn';

// E: what the Mando does depends on the moment — finish a reeling foe, dive from the air, charge in with W, or strike
export function mandoMelee(){
  if (G.mode !== 'play' || G.hero !== 'mando' || player.darkT > 0 || player.mendT > 0) return;
  if (player.saberLock){ lockKick(); return; }
  if (player.charge || player.dive) return;
  if (player.meleeT > 0){
    // mid-string, a blow about to land on you takes priority: the press raises the vambrace instead
    if (!(player.catchLockT > 0) && incoming()){ player.catchT = M.catchWindow; player.meleeQueued = false; return; }
    // a press late in the recovery queues the next beat of the string (early mashing is ignored)
    if (player.meleeT < player.meleeMax * 0.55) player.meleeQueued = true;
    return;
  }
  if (!(player.catchLockT > 0)) player.catchT = M.catchWindow;   // anything that lands in the next instant gets CAUGHT
  const down = takedownTarget();
  if (down){ takedown(down); return; }
  if (!player.grounded){ if (diveKick()) return; }
  else if (keys['w'] && G.gt - (player.lastCharge ?? -9) > M.charge.cd && player.jet >= M.charge.fuel){
    const t = chargeTarget();
    if (t){ jetCharge(t); return; }
  }
  strike();
}

// a foe close by whose strike is about to land (the last instant of its wind-up, or mid-swing)
function incoming(){
  const pp = playerPos();
  for (const e of enemies){
    if (!live(e) || e.group.position.distanceTo(pp) > (e.t.range || 2) + 1.5) continue;
    if (e.state === 'strike' || (e.state === 'windup' && e.st < 0.2)) return true;
  }
  return false;
}

/* ---------------- the string: jab, cross, knee, vibroblade ---------------- */
function strike(){
  const n = M.string.length;
  const linked = G.gt - (player.meleeEndAt ?? -9) < M.combo && (player.punchStep ?? -1) < n - 1;
  const step = linked ? player.punchStep + 1 : 0;
  const B = M.string[step];
  player.punchStep = step;
  player.meleeT = player.meleeMax = B.recover; player.meleeKind = B.name; player.meleeSkip = 0;
  player.aiming = 0.3;
  player.vel.addScaledVector(fwd(), B.lunge);
  // the blow lands when the fist does: B.contact seconds in, at full extension (animation.js draws the same beats)
  player.meleePending = B;
  S.jump(); sfx(B.heavy ? 140 : 230, 0.08, 'square', 0.04, 60);   // the whoosh of the throw
}
function landStrike(B){
  const f = fwd(), pp = playerPos(), dmg = B.dmg * (player.up.dmg || 1);
  const cosLim = Math.cos(M.arc);
  let hit = 0, turned = 0;
  for (const e of enemies){
    if (!live(e)) continue;
    TMP.subVectors(e.group.position, pp); const dy = TMP.y; TMP.y = 0;
    // the fist has to reach the body: arm's length plus the step the strike carries in
    if (TMP.length() - bodyRadius(e) > M.reach + B.lunge / 9 || Math.abs(dy) > 2.2) continue;
    if (TMP.lengthSq() > 0.001 && TMP.normalize().dot(f) < cosLim) continue;
    const dres = duelDefend(e, B.line, B.heavy ? 'punchHeavy' : 'punch', B.heavy);
    if (dres === 'block' || dres === 'dodge'){ turned++; continue; }
    damageEnemy(e, dmg, f.clone(), B.knock, B.heavy, false, B.name === 'knee' ? KNEE : NO_LAUNCH);   // fists rock a foe, they don't launch it
    if (!e.dead){
      if (B.stagger) staggerEnemy(e, f.x, f.z, 'VIBROBLADE');
      else flinchEnemy(e, f, B.shove);
    }
    hit++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < M.reach + B.lunge / 9 + 0.9){ damageBoss(dmg * 0.6); hit++; }
  const ip = V3(pp.x + f.x * 1.4, B.name === 'knee' ? 1.1 : 1.5, pp.z + f.z * 1.4);
  if (hit){
    G.hitstop = Math.max(G.hitstop, B.heavy ? 0.08 : 0.04);
    G.shake = Math.max(G.shake, B.heavy ? 0.5 : 0.28);
    spawnHitSpark(ip, B.name === 'blade' ? 0xc9a6ff : 0xffd28a, B.heavy ? 1.5 : 0.9);
    sparks(ip, B.name === 'blade' ? 0xc9a6ff : 0xffe7b0, B.heavy ? 8 : 5, 11, { dir: f, cone: 0.6, life: 0.24 });
    if (B.name === 'blade'){   // the wrist VIBROBLADE: a sharp violet slash arc and a ringing edge
      inkSprite({ pos: ip, shape: 'ring', inner: 0.86, arc: 1.1, color: 0xc9a6ff, size: [1.6, 2.6], life: 0.14, steps: 2, coreW: 0.3, inkW: 0.25,
                  rot: Math.PI * (0.35 + Math.random() * 0.3) });
      sfx(1800, 0.09, 'square', 0.05, 720); sfx(2400, 0.07, 'triangle', 0.04, 900);
    }
    S.punch(ip, B.heavy ? 1.5 : 1); if (B.heavy) S.heavy(ip);
  } else if (turned){
    player.meleeT += 0.12;   // knocked off a guard: the arm jars back and the next beat comes late
    player.punchStep = -1;
  } else puff(ip, 0xcfe0ec, 0.55, 0.22, f.clone().multiplyScalar(4), { grow0: 0.4 });
}

/* ---------------- the vambrace catch (called by hurtPlayer when a blow lands inside the window) ---------------- */
export function mandoCatch(fromPos){
  player.catchT = 0;
  player.meleeT = player.meleeMax = 0.3; player.meleeKind = 'catch'; player.meleeQueued = false;
  const pp = playerPos();
  TMP.subVectors(fromPos, pp); TMP.y = 0; if (TMP.lengthSq() > 0.001) TMP.normalize(); else TMP.copy(fwd());
  const cp = V3(pp.x + TMP.x * 0.8, pp.y + 1.55, pp.z + TMP.z * 0.8);
  clashFlash(cp, 0xffd28a, true);
  sparks(cp, 0xffe7b0, 16, 13, { life: 0.34 });
  spawnHitSpark(cp, 0xffffff, 1.8);
  G.hitstop = Math.max(G.hitstop, 0.16); G.shake = Math.max(G.shake, 0.7);
  G.slowmo = Math.min(G.slowmo, 0.3); G.slowmoT = Math.max(G.slowmoT, 0.3);
  screenFlash('radial-gradient(ellipse at center, rgba(255,230,170,.5), transparent 66%)', 0.8, 0.3);
  floater(pp, 'CAUGHT! ⟲ TAKEDOWN', '#ffd28a');
  S.clash(cp, true); sfx(2600, 0.12, 'triangle', 0.04, 1800);
  if (G.stats) G.stats.parries++;
}

/* ---------------- takedown: finish anything reeling or floored ---------------- */
function takedownTarget(){
  const pp = playerPos(), f = fwd();
  let best = null, bd = 1e9;
  for (const e of enemies){
    if (!live(e) || !DOWNED[e.state]) continue;
    TMP.subVectors(e.group.position, pp); const dy = Math.abs(TMP.y); TMP.y = 0;
    const d = TMP.length();
    if (d - bodyRadius(e) > M.takedown.range || dy > 1.8) continue;
    if (d > 1.4 && TMP.normalize().dot(f) < 0.3) continue;
    if (d < bd){ bd = d; best = e; }
  }
  return best;
}
function takedown(e){
  const pp = playerPos(), g = e.group;
  TMP.subVectors(g.position, pp); TMP.y = 0; const d = TMP.length() || 1; TMP.divideScalar(d);
  const dir = TMP.clone();
  player.meleeT = player.meleeMax = 0.55; player.meleeKind = 'takedown'; player.punchStep = -1; player.meleeQueued = false;
  player.vel.addScaledVector(dir, Math.max(0, d - 1.2) * 9);   // close the last step
  const big = e.t.heavy || e.warbringer || e.champion;
  const dmg = (M.takedown.dmg + (big ? 0 : (e.maxHp || e.hp) * M.takedown.maxFrac)) * (player.up.dmg || 1);
  damageEnemy(e, dmg, dir, 24, true, false, NO_LAUNCH);   // a finisher that puts it down, not a launch
  if (!e.dead && !e.t.heavy && !e.t.fly){ e.state = 'knockdown'; e.st = 0.9; e.vel.copy(dir).multiplyScalar(3); e.vel.y = 2.5; }   // slammed to the floor at your feet
  const ip = V3(g.position.x, 1.4, g.position.z);
  inkSprite({ pos: ip, shape: 'ring', inner: 0.84, arc: 1.4, color: 0xc9a6ff, size: [2, 3.2], life: 0.18, steps: 2, coreW: 0.32, inkW: 0.25, rot: rand(0, Math.PI) });
  sparks(ip, 0xc9a6ff, 14, 14, { dir, cone: 0.7, life: 0.3 });
  spawnHitSpark(ip, 0xffffff, 2);
  G.hitstop = Math.max(G.hitstop, 0.2); G.shake = Math.max(G.shake, 0.9);
  G.slowmo = Math.min(G.slowmo, 0.35); G.slowmoT = Math.max(G.slowmoT, 0.25);
  floater(V3(g.position.x, g.position.y + 1.6, g.position.z), 'TAKEDOWN', '#c9a6ff');
  S.heavy(ip); S.punch(ip, 1.6); sfx(2200, 0.1, 'square', 0.04, 800);
  if (G.stats) G.stats.takedowns = (G.stats.takedowns || 0) + 1;
}

/* ---------------- jet charge (W + E): burn in and shoulder-check through a guard ---------------- */
function chargeTarget(){
  const pp = playerPos(), f = fwd(), C = M.charge;
  let best = null, bd = C.maxD;
  for (const e of enemies){
    if (!live(e) || e.t.fly) continue;
    TMP.subVectors(e.group.position, pp); if (Math.abs(TMP.y) > 1.5) continue; TMP.y = 0;
    const d = TMP.length();
    if (d < C.minD || d > bd || TMP.normalize().dot(f) < 0.85) continue;
    bd = d; best = e;
  }
  return best;
}
function jetCharge(e){
  const C = M.charge;
  player.jet -= C.fuel; player.lastCharge = G.gt;
  player.charge = { e, t: 0.45 };
  player.meleeT = player.meleeMax = 0.5; player.meleeKind = 'charge'; player.punchStep = -1;
  S.jetIgnite(); S.dash(); sfx(180, 0.25, 'sawtooth', 0.05, 90);
}
function updateCharge(dt){
  const c = player.charge, C = M.charge, pp = playerPos();
  c.t -= dt;
  const e = c.e;
  if (!live(e) || c.t <= 0){ player.charge = null; return; }
  TMP.subVectors(e.group.position, pp); TMP.y = 0;
  const d = TMP.length(); TMP.divideScalar(d || 1);
  player.vel.x = TMP.x * C.speed; player.vel.z = TMP.z * C.speed;
  player.meleeT = Math.max(player.meleeT, 0.2);
  thrust(dt, 1, { x: TMP.x, z: TMP.z });   // the pack's plume streams back off the burn
  if (d > 1.7) return;
  // IMPACT — the shoulder drives through: a guard takes a huge posture hit, light foes go down
  const dir = TMP.clone();
  player.charge = null;
  player.vel.multiplyScalar(0.15);
  if (isGuarding(e)) guardImpact(e, DUEL.posture.charge);
  damageEnemy(e, C.dmg * (player.up.dmg || 1), dir, C.knock, true);
  const ip = V3(pp.x + dir.x * 1.1, 1.3, pp.z + dir.z * 1.1);
  spawnHitSpark(ip, 0xffd28a, 1.6); sparks(ip, 0xffe7b0, 10, 12, { dir, cone: 0.6, life: 0.28 });
  G.hitstop = Math.max(G.hitstop, 0.1); G.shake = Math.max(G.shake, 0.7);
  S.punch(ip, 1.6); S.heavy(ip);
  player.meleeT = player.meleeMax = 0.3; player.meleeKind = 'cross'; player.meleeSkip = 0.1;   // the pose picks up AT the impact
}

/* ---------------- dive kick (E in the air): drop onto a foe below ---------------- */
function diveKick(){
  const D = M.dive;
  if (G.gt - (player.lastDive ?? -9) < D.cd || player.jet < D.fuel || player.slamming) return false;
  const pp = playerPos(), f = fwd();
  let best = null, bs = -1e9;
  for (const e of enemies){
    if (!live(e) || e.t.fly) continue;
    TMP.subVectors(e.group.position, pp); const drop = -TMP.y; TMP.y = 0;
    const d = TMP.length();
    if (d > 13 || drop < 0.6) continue;
    const c = d > 0.01 ? TMP.normalize().dot(f) : 1;
    if (c < 0.5) continue;
    const sc = c * 2 - d / 13;
    if (sc > bs){ bs = sc; best = e; }
  }
  if (!best) return false;
  player.jet -= D.fuel; player.lastDive = G.gt;
  player.dive = { e: best, t: 0.9 };
  player.meleeT = player.meleeMax = 0.9; player.meleeKind = 'dive'; player.punchStep = -1;
  S.jetIgnite(); sfx(260, 0.3, 'sawtooth', 0.05, 80);
  return true;
}
function updateDive(dt){
  const v = player.dive, D = M.dive, pp = playerPos();
  v.t -= dt;
  const e = v.e;
  const tgt = live(e) ? e.group.position : null;
  if (tgt){
    TMP.set(tgt.x - pp.x, (tgt.y + 0.8) - pp.y, tgt.z - pp.z);
    const d = TMP.length(); TMP.divideScalar(d || 1);
    player.vel.x = TMP.x * D.speed; player.vel.z = TMP.z * D.speed;
    player.vy = Math.min(player.vy, TMP.y * D.speed);
  }
  player.meleeT = Math.max(player.meleeT, 0.15);
  thrust(dt, 0.8, null);
  const near = tgt && Math.hypot(tgt.x - pp.x, tgt.z - pp.z) < 1.6 && pp.y - tgt.y < 1.8;
  if (!(near || player.grounded || v.t <= 0)) return;
  // IMPACT — a boot from the sky: whoever it lands on goes down, and the rest of the knot is shoved off
  player.dive = null;
  player.vel.multiplyScalar(0.2);
  const ip = V3(pp.x, Math.max(0.2, pp.y), pp.z);
  for (const o of enemies){
    if (!live(o)) continue;
    TMP.subVectors(o.group.position, ip); if (Math.abs(TMP.y) > 2) continue; TMP.y = 0;
    const d = TMP.length();
    if (d > D.radius) continue;
    const kd = d > 0.01 ? TMP.normalize().clone() : fwd();
    if (o === e && isGuarding(o)) guardImpact(o, DUEL.posture.charge);
    damageEnemy(o, (o === e ? D.dmg : D.dmg * 0.4) * (player.up.dmg || 1), kd, o === e ? D.knock : D.knock * 0.6, o === e);
  }
  spawnGroundShock(V3(ip.x, 0.1, ip.z), 0xffd28a, D.radius + 1, 0.35, 0.6);
  burst(V3(ip.x, 0.5, ip.z), 0xb8c2c8, 10, 7, 4, 1);
  G.hitstop = Math.max(G.hitstop, 0.1); G.shake = Math.max(G.shake, 0.8);
  S.slam(ip); S.punch(ip, 1.4);
  player.meleeT = player.meleeMax = 0.35; player.meleeKind = 'knee'; player.meleeSkip = 0.12;
}

/* ---------------- per frame (from updateMandoCombat) ---------------- */
export function updateMandoMelee(dt){
  if (player.catchT > 0){ player.catchT -= dt; if (player.catchT <= 0) player.catchLockT = M.catchWhiff; }
  else if (player.catchLockT > 0) player.catchLockT -= dt;
  if (player.charge) updateCharge(dt);
  if (player.dive) updateDive(dt);
  if (player.meleeT > 0){
    player.meleeT -= dt;
    const B = player.meleePending;
    if (B && (player.meleeKind !== B.name || player.meleeMax - player.meleeT >= B.contact)){
      player.meleePending = null;
      if (player.meleeKind === B.name) landStrike(B);   // (a catch or a takedown cut in first: the throw never lands)
    }
    if (player.meleeT <= 0){
      player.meleeEndAt = G.gt;
      if (player.meleeQueued){ player.meleeQueued = false; mandoMelee(); }
    }
  }
}
export function resetMandoMelee(){
  player.catchT = 0; player.catchLockT = 0; player.charge = null; player.dive = null;
  player.meleeQueued = false; player.punchStep = -1; player.meleeT = 0; player.meleePending = null;
}
