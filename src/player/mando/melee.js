// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Mandalorian's close-quarters kit on E: a four-beat string (a brawler's swings when holstered) that steps him in to
// arm's length, shield and blade, the jet charge, the dive kick, the vambrace catch, the clinch (hold E: headbutt, throw)
// and the vibroblade takedowns.

import { MANDO_MELEE as M, DUEL } from '../../data/duel.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, keys, player } from '../../state.js';
import { CFG } from '../../data/config.js';
import { stamDelay } from '../stamina.js';
import { fwd, playerPos } from '../helpers.js';
import { noteDefense } from '../../game/readout.js';
import { damageEnemy, flinchEnemy, staggerEnemy } from '../../enemies/damage.js';
import { duelDefend, guardImpact, isGuarding, lockKick } from '../../enemies/duel.js';
import { bodyRadius } from '../jedi/bladehit.js';
import { damageBoss } from '../../boss/boss.js';
import { spawnHitSpark, spawnGroundShock } from '../../fx/vfx.js';
import { inkSprite, sparks, puff, clashFlash, clashSparks, thrust } from '../../fx/ink.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { masteryXp } from '../../game/progression.js';
import { diffWindow } from '../../data/difficulty.js';
import { mandoShielding } from './weapons.js';

const DOWNED = { stagger: 1, knockdown: 1, getup: 1 };
const NO_LAUNCH = { launch: false };
const NO_GRAB = { ragdoll: 1, grasped: 1, spawn: 1, leap: 1, lunge: 1, lock: 1, stasis: 1, knockdown: 1, getup: 1, fade: 1 };
const live = e => !e.dead && !e.converted && e.state !== 'spawn';

// E: what the Mando does depends on the moment — finish a reeling foe, dive from the air, charge in with W, or strike
export function mandoMelee(){
  if (G.mode !== 'play' || G.hero !== 'mando' || player.darkT > 0 || player.mendT > 0) return;
  if (player.saberLock){ lockKick(); return; }
  if (player.clinch){ headbutt(); return; }   // a foe by the collar: E is the helmet
  if (player.charge || player.dive) return;
  const shielded = player.grounded && mandoShielding();   // behind the gauntlet shield: E cuts with the vibroblade
  if (player.meleeT > 0){
    // mid-string, a blow about to land on you takes priority: the press raises the vambrace instead (the shield
    // already covers you, so behind it the press just queues the next cut)
    if (!shielded && !(player.catchLockT > 0) && incoming()){ player.catchT = M.catchWindow + diffWindow(); player.meleeQueued = false; return; }
    // a press late in the recovery queues the next beat of the string (early mashing is ignored)
    if (player.meleeT < player.meleeMax * 0.55) player.meleeQueued = true;
    return;
  }
  if (!shielded && !(player.catchLockT > 0)) player.catchT = M.catchWindow + diffWindow();   // anything that lands in the next instant gets CAUGHT
  const down = takedownTarget(shielded ? M.guard.takedownReach : 0);
  if (down){ takedown(down); return; }
  if (shielded){ guardStrike(); return; }
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
  const S_ = player.weapon === 'fists' ? M.fists : M.string, n = S_.length;   // holstered: the brawler's swings
  const linked = G.gt - (player.meleeEndAt ?? -9) < M.combo && (STRING_OF[player.meleeKind] || S_) === S_ && (player.punchStep ?? -1) < n - 1;
  const step = linked ? player.punchStep + 1 : 0;
  const B = S_[step];
  player.punchStep = step;
  player.meleeT = player.meleeMax = B.recover; player.meleeKind = B.name; player.meleeSkip = 0;
  player.aiming = 0.3;
  stepIn(B.lunge);
  player.grabArm = G.gt;   // still held a moment from now, the free hand takes the collar (updateMandoMelee)
  // the blow lands when the fist does: B.contact seconds in, at full extension (animation.js draws the same beats)
  player.meleePending = B;
  S.jump(); sfx(B.heavy ? 140 : 230, 0.08, 'square', 0.04, 60);   // the whoosh of the throw
}
/* CLOSING THE GAP — the foe a blow is thrown at: the nearest live one within reach of a step and roughly ahead */
function magnetTarget(){
  const pp = playerPos(), f = fwd(), MG = M.magnet, cl = Math.cos(MG.cone);
  let best = null, bs = 1e9;
  for (const e of enemies){
    if (!live(e) || e.state === 'ragdoll' || e.state === 'fade') continue;
    TMP.subVectors(e.group.position, pp); if (Math.abs(TMP.y) > 2) continue; TMP.y = 0;
    const d = TMP.length(), dot = d > 0.3 ? TMP.normalize().dot(f) : 1;
    if (d - bodyRadius(e) > MG.range || dot < cl) continue;
    const sc = d * (1.8 - dot);   // near and straight ahead first
    if (sc < bs){ bs = sc; best = e; }
  }
  return best;
}
// the step a blow carries: in to arm's length of its target (never into the body), or the plain lunge with none ahead
function stepIn(lunge, tgt = magnetTarget()){
  player.meleeTgt = tgt;
  if (!tgt){ player.vel.addScaledVector(fwd(), lunge); return; }
  const pp = playerPos();
  TMP.subVectors(tgt.group.position, pp); TMP.y = 0;
  const d = TMP.length(); if (d < 0.01) return;
  TMP.divideScalar(d);
  const step = clamp(d - bodyRadius(tgt) - M.magnet.stand, 0, M.magnet.maxStep);
  // the ground impulse bleeds off at ~9/s (locomotion.js), so v = 9 × the distance carries him that far
  player.vel.x = TMP.x * step * 9; player.vel.z = TMP.z * step * 9;
  const into = player.moveVel.x * TMP.x + player.moveVel.z * TMP.z;   // and walking forward doesn't carry him on into it
  if (into > 0){ player.moveVel.x -= TMP.x * into * 0.7; player.moveVel.z -= TMP.z * into * 0.7; }
}
// the bodies don't overlap: a foe he's fighting (or holding) keeps him out at its body's edge
function keepOut(e, gap){
  const pp = player.group.position;
  TMP.subVectors(pp, e.group.position); TMP.y = 0;
  const d = TMP.length(), min = bodyRadius(e) + gap;
  if (d >= min || d < 0.001) return;
  TMP.divideScalar(d);
  pp.x += TMP.x * (min - d); pp.z += TMP.z * (min - d);
  const vin = -(player.vel.x * TMP.x + player.vel.z * TMP.z); if (vin > 0){ player.vel.x += TMP.x * vin; player.vel.z += TMP.z * vin; }
  const min2 = -(player.moveVel.x * TMP.x + player.moveVel.z * TMP.z); if (min2 > 0){ player.moveVel.x += TMP.x * min2; player.moveVel.z += TMP.z * min2; }
}
/* ---------------- shield and blade: hack, backhand, bash (E with the shield up) ---------------- */
function guardStrike(){
  const S_ = M.guard.string, n = S_.length;
  const linked = G.gt - (player.meleeEndAt ?? -9) < M.combo && GUARD_BEAT[player.meleeKind] && (player.punchStep ?? -1) < n - 1;
  const step = linked ? player.punchStep + 1 : 0;
  const B = S_[step];
  if (player.stam < B.stam){   // the same stamina the shield soaks with: swing it dry and the guard goes with it
    if (G.gt - (player.lastWinded ?? -9) > 0.6){ player.lastWinded = G.gt; floater(playerPos(), 'WINDED', '#ffaa66'); }
    return;
  }
  player.stam -= B.stam; player.stamDelay = stamDelay();
  player.punchStep = step;
  player.meleeT = player.meleeMax = B.recover; player.meleeKind = B.name; player.meleeSkip = 0;
  player.vel.addScaledVector(fwd(), B.lunge);
  player.meleePending = B;
  if (B.name === 'bash'){ S.jump(); sfx(120, 0.1, 'square', 0.05, 50); }
  else sfx(900, 0.07, 'sawtooth', 0.03, 300);   // the vibroblade's hum whipping through the air
}
const GUARD_BEAT = Object.fromEntries(M.guard.string.map(b => [b.name, true]));
const STRING_OF = Object.fromEntries([...M.string.map(b => [b.name, M.string]), ...M.fists.map(b => [b.name, M.fists])]);
function landStrike(B){
  const f = fwd(), pp = playerPos(), dmg = B.dmg * (player.up.dmg || 1);
  const reach = B.reach ?? M.reach, cosLim = Math.cos(B.arc ?? M.arc);
  const guardBeat = GUARD_BEAT[B.name], cut = guardBeat && B.name !== 'bash';
  let hit = 0, turned = 0;
  const tgt = player.meleeTgt;
  for (const e of enemies){
    if (!live(e)) continue;
    TMP.subVectors(e.group.position, pp); const dy = TMP.y; TMP.y = 0;
    // the fist has to reach the body: arm's length plus the step the strike carries in (the foe it was thrown at
    // gets a little slack and no arc test: the step turned him onto it)
    if (TMP.length() - bodyRadius(e) > reach + B.lunge / 9 + (e === tgt ? 0.45 : 0) || Math.abs(dy) > 2.2) continue;
    if (e !== tgt && TMP.lengthSq() > 0.001 && TMP.normalize().dot(f) < cosLim) continue;
    if (TMP.lengthSq() > 0.001) TMP.normalize();
    const away = TMP.lengthSq() > 0.001 ? TMP.clone() : f.clone();   // shoved straight back off the arc, not all one way
    if (B.name === 'bash' && isGuarding(e)) guardImpact(e, M.guard.posture);
    const dres = duelDefend(e, B.line, cut ? 'cut' : B.heavy ? 'punchHeavy' : 'punch', B.heavy);
    if (dres === 'block' || dres === 'dodge'){ turned++; continue; }
    damageEnemy(e, dmg, away, B.knock, B.heavy, false, blowOpts(B, e, f));   // fists rock a foe, they don't launch it
    if (!e.dead){
      // the bash staggers light foes for a takedown; a brute only gets rocked
      if (B.stagger && !(B.name === 'bash' && e.t.heavy)) staggerEnemy(e, away.x, away.z, B.name === 'bash' ? 'BASHED' : B.name === 'haymaker' ? 'HAYMAKER' : 'VIBROBLADE');
      else flinchEnemy(e, away, 0);
      reel(e, away, B.shove * (B.stagger ? 0.7 : 1));   // (a stagger stumbles it back on its own: duel posture / staggerEnemy)   // driven back over a few frames, not popped
    }
    hit++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < reach + B.lunge / 9 + 0.9){ damageBoss(dmg * 0.6); hit++; }
  const ip = V3(pp.x + f.x * 1.4, B.name === 'knee' ? 1.1 : B.name === 'upper' ? 1.75 : 1.5, pp.z + f.z * 1.4);
  if (cut){   // the vibroblade's arc reads whether it connects or not: a wide violet sweep across the front
    // a flat crescent round the Mando at waist height, centred on where he faces (the ring's arc sits on its local +y)
    inkSprite({ pos: V3(pp.x, pp.y + 1.1, pp.z), normal: V3(0, 1, 0), shape: 'ring', inner: 0.82, arc: B.arc, color: 0xc9a6ff,
                size: [(reach + 0.7) * 2, (reach + 0.7) * 2], life: 0.16, steps: 2, coreW: 0.3, inkW: 0.25,
                rot: Math.atan2(-f.x, -f.z) });
  }
  if (hit && B.name === 'bash') tutEvent('bash');
  if (hit){
    G.hitstop = Math.max(G.hitstop, B.stop ?? (B.heavy ? 0.08 : 0.04));
    G.shake = Math.max(G.shake, B.heavy ? 0.55 : 0.3);
    const violet = B.name === 'blade' || cut, blue = B.name === 'bash';
    spawnHitSpark(ip, violet ? 0xc9a6ff : blue ? 0x9fe6ff : 0xffd28a, B.heavy ? 1.5 : 0.9);
    sparks(ip, violet ? 0xc9a6ff : blue ? 0x9fe6ff : 0xffe7b0, B.heavy ? 4 : 3, 8, { dir: f, cone: cut ? 1.1 : 0.6, life: 0.18, size: 0.36 });
    if (cut){ sfx(1800, 0.08, 'square', 0.04, 720); }
    if (blue){ player.shieldFlash = Math.max(player.shieldFlash || 0, 0.3); sfx(1100, 0.08, 'square', 0.05, 500); }   // the disc flares on the bash
    if (B.name === 'blade'){   // the wrist VIBROBLADE: a sharp violet slash arc and a ringing edge
      inkSprite({ pos: ip, shape: 'ring', inner: 0.86, arc: 1.1, color: 0xc9a6ff, size: [0.6, 1.2], life: 0.12, steps: 2, coreW: 0.3, inkW: 0.25,
                  rot: Math.PI * (0.35 + Math.random() * 0.3) });
      sfx(1800, 0.09, 'square', 0.05, 720); sfx(2400, 0.07, 'triangle', 0.04, 900);
    }
    S.punch(ip, B.heavy ? 1.5 : 1); if (B.heavy) S.heavy(ip);
  } else if (turned){
    player.meleeT += 0.12;   // knocked off a guard: the arm jars back and the next beat comes late
    player.punchStep = -1;
  } else puff(ip, 0xcfe0ec, 0.55, 0.22, f.clone().multiplyScalar(4), { grow0: 0.4 });
}

/* ---------------- how a blow lands on the body ---------------- */
// the blow's own reaction (data/duel.js MANDO_MELEE react/zone): the way the fist travels through the foe, in world
// space, and where on it (head or torso), so enemies/damage.js zoneReact snaps the head back off a jab, whips it round
// off a hook, tips it up off an uppercut; the spark sits where the fist met it
function travel(react, f){
  const [a, side, up] = react;   // ahead · toward his right · up
  return V3(f.x * a - f.z * side, up, f.z * a + f.x * side);
}
function contactAt(e, zone){
  const g = e.group, pp = playerPos(), s = (e.t.scale || 1);
  TMP.subVectors(pp, g.position); TMP.y = 0; if (TMP.lengthSq() > 0.001) TMP.normalize();
  const r = bodyRadius(e) * 0.7;
  return V3(g.position.x + TMP.x * r, g.position.y + (zone === 2 ? 1.62 : 1.15) * s, g.position.z + TMP.z * r);
}
function blowOpts(B, e, f){
  if (B.fold) return { launch: false, fold: B.fold };   // a knee doubles the foe over
  if (!B.react) return NO_LAUNCH;
  return { launch: false, zone: B.zone, cut: travel(B.react, f), at: contactAt(e, B.zone) };
}
// a blow drives the foe back over a few frames (the old flinch popped it there in one): `dist` m, a brute a fifth of it
const reels = [];
function reel(e, dir, dist){
  if (e.net || !(dist > 0)) return;   // a host's foe goes where the host puts it
  const d = dist * (e.t.heavy ? 0.22 : 1);
  reels.push({ e, x: dir.x, z: dir.z, left: d, v: d / 0.13 });
}
function updateReels(dt){
  for (let i = reels.length - 1; i >= 0; i--){
    const r = reels[i], e = r.e;
    const step = Math.min(r.left, r.v * dt);
    r.v *= Math.max(0, 1 - dt * 6); r.left -= step;
    if (e.dead || NO_GRAB[e.state] || r.left <= 0.002 || r.v < 0.3){ reels.splice(i, 1); if (e.dead || NO_GRAB[e.state]) continue; }
    e.group.position.x += r.x * step; e.group.position.z += r.z * step;
  }
}

/* ---------------- the clinch: hold E through a blow and the free hand takes the collar ---------------- */
// (a real duellist with its guard up turns the hand aside: the rank and file only barely guard, so they can be taken)
const guardUp = e => isGuarding(e) && ((e.dp && e.dp.block >= 0.3) || e.type === 'duelist' || e.type === 'acolyte');
const grabbable = e => !e.t.heavy && !e.t.fly && !e.warbringer && !e.champion && !e.t.boss && !NO_GRAB[e.state] && !guardUp(e)
  && !(e.t.shield && !e.shieldBroken);
function tryGrab(){
  if (!player.grounded || player.charge || player.dive || player.clinch || G.mode !== 'play') return;
  const e = player.meleeTgt && live(player.meleeTgt) ? player.meleeTgt : magnetTarget();
  if (!e) return;
  const pp = playerPos();
  TMP.subVectors(e.group.position, pp); const dy = Math.abs(TMP.y); TMP.y = 0;
  if (TMP.length() - bodyRadius(e) > M.grab.reach + 0.45 || dy > 1.2) return;
  if (!grabbable(e)){
    if (DOWNED[e.state] || e.dead) return;
    // too big, or its guard is up: the hand finds nothing to hold and the shoulder shoves instead
    if (G.gt - (player.lastWinded ?? -9) > 0.6){ player.lastWinded = G.gt; floater(e.group.position, e.t.heavy || e.warbringer || e.champion ? 'TOO HEAVY' : 'GUARDED', '#aa8877'); }
    return;
  }
  player.meleePending = null; player.punchStep = -1; player.meleeQueued = false; player.firing = false;
  player.clinch = { e, t: 0, hb: 0, move: M.grab.moveMul };
  e.state = 'grasped'; e.st = 0; e.vel.set(0, 0, 0); e.stunT = 0.3; e.clinched = true;
  if (e.aimLine) e.aimLine.visible = false;
  for (let i = reels.length - 1; i >= 0; i--) if (reels[i].e === e) reels.splice(i, 1);
  player.meleeT = player.meleeMax = 0.24; player.meleeKind = 'grab'; player.meleeSkip = 0;
  const cp = contactAt(e, 1);
  G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.25);
  S.punch(cp, 0.7); sfx(160, 0.09, 'square', 0.05, 90); sfx(900, 0.05, 'triangle', 0.03, 500);   // the gauntlet closes on armour
  puff(cp, 0xcfd6dc, 0.4, 0.18, fwd().multiplyScalar(1.5), { grow0: 0.3 });
  floater(e.group.position, 'GRABBED', '#e8d2a8');
  tutEvent('grab');
}
// E in the clinch: the beskar helmet into its face (queued if pressed late in the last one)
function headbutt(){
  const c = player.clinch;
  if (player.meleeT > 0 && (player.meleeKind === 'headbutt' || player.meleeKind === 'throw')){
    if (player.meleeKind === 'headbutt' && player.meleeT < player.meleeMax * 0.5) player.meleeQueued = true;
    return;
  }
  const H = M.headbutt;
  player.meleeT = player.meleeMax = H.recover; player.meleeKind = 'headbutt'; player.meleeSkip = 0;
  player.meleePending = { name: 'headbutt', contact: H.contact, clinch: c };
  sfx(120, 0.1, 'sawtooth', 0.04, 60);
}
function landHeadbutt(){
  const c = player.clinch; if (!c) return;
  const e = c.e, H = M.headbutt, f = fwd();
  c.hb++; c.t = Math.min(c.t, M.grab.hold - 1.0);   // each one keeps the grip a moment longer
  const ip = contactAt(e, 2);
  damageEnemy(e, H.dmg * (player.up.dmg || 1), f, H.knock, true, false, { launch: false, zone: 2, cut: travel(H.react, f), at: ip });
  // beskar on a helmet: a hard clang, a white spark off the brow and a long freeze
  sparks(ip, 0xffffff, 6, 9, { dir: f, cone: 1.2, life: 0.2, size: 0.4 });
  sparks(ip, 0xffd28a, 4, 7, { dir: f, cone: 1.4, life: 0.24, size: 0.36 });
  spawnHitSpark(ip, 0xffe7b0, 1.4);
  G.hitstop = Math.max(G.hitstop, 0.11); G.shake = Math.max(G.shake, 0.65);
  S.heavy(ip); S.punch(ip, 1.4); sfx(1900, 0.14, 'triangle', 0.05, 1300); sfx(420, 0.1, 'square', 0.04, 260);
  tutEvent('headbutt');
  if (e.dead){ endClinch(); return; }
  if (c.hb >= H.max){
    // the last one drops it at his feet, floored, for the knife
    endClinch();
    e.state = 'knockdown'; e.st = 1.0; e.vel.set(f.x * 2.5, 2.5, f.z * 2.5);
    floater(e.group.position, 'FLOORED', '#ffd28a');
  }
}
// LMB in the clinch: heave it the way he faces, into whatever is there
export function clinchThrow(){
  const c = player.clinch;
  if (!c || (player.meleeKind === 'throw' && player.meleeT > 0)) return false;
  const T = M.throw;
  player.meleeT = player.meleeMax = T.recover; player.meleeKind = 'throw'; player.meleeSkip = 0; player.meleeQueued = false;
  player.meleePending = { name: 'throw', contact: T.contact, clinch: c };
  player.firing = false;
  sfx(200, 0.18, 'sawtooth', 0.05, 70);
  return true;
}
const thrown = [];
function landThrow(){
  const c = player.clinch; if (!c) return;
  const e = c.e, T = M.throw, f = fwd();
  endClinch();
  damageEnemy(e, T.dmg * (player.up.dmg || 1), f, 0, false, false, { launch: false });
  e.vel.set(f.x * T.speed, T.lift, f.z * T.speed);
  e.group.rotation.y = Math.atan2(-f.x, -f.z);   // it goes over backwards, facing him
  if (!e.dead){ e.state = 'knockdown'; e.st = T.floor; }
  else e.crumple = false;
  thrown.push({ e, t: 0.9, hit: new Set() });
  G.shake = Math.max(G.shake, 0.4); G.hitstop = Math.max(G.hitstop, 0.05);
  S.dash(); sfx(240, 0.2, 'sawtooth', 0.05, 80);
  floater(e.group.position, 'THROWN', '#ffd28a');
  tutEvent('throw');
}
// a thrown body bowls over whoever it flies into; a brute braces and it bounces off
function updateThrown(dt){
  const B = M.throw.bowl;
  for (let i = thrown.length - 1; i >= 0; i--){
    const th = thrown[i], e = th.e;
    th.t -= dt;
    const flying = (e.state === 'knockdown' || e.state === 'ragdoll') && Math.hypot(e.vel.x, e.vel.z) > 3;
    if (th.t <= 0 || !flying || !enemies.includes(e)){ thrown.splice(i, 1); continue; }
    const p = e.group.position, dir = V3(e.vel.x, 0, e.vel.z).normalize();
    for (const o of enemies){
      if (o === e || !live(o) || th.hit.has(o) || DOWNED[o.state] || o.state === 'grasped' || o.state === 'ragdoll') continue;
      TMP.subVectors(o.group.position, p); if (Math.abs(TMP.y) > 2) continue; TMP.y = 0;
      if (TMP.length() > B.radius * (o.t.scale || 1)) continue;
      th.hit.add(o);
      const ip = V3((p.x + o.group.position.x) / 2, 1.1, (p.z + o.group.position.z) / 2);
      S.punch(ip, 1.3); spawnHitSpark(ip, 0xffd28a, 1.1);
      G.shake = Math.max(G.shake, 0.45); G.hitstop = Math.max(G.hitstop, 0.05);
      if (o.t.heavy || o.warbringer){
        damageEnemy(o, B.dmg * 0.5 * (player.up.dmg || 1), dir, 0, false, false, NO_LAUNCH);
        floater(o.group.position, 'BRACED', '#aa8877');
        e.vel.x *= -0.3; e.vel.z *= -0.3;
      } else {
        damageEnemy(o, B.dmg * (player.up.dmg || 1), dir, B.knock);   // knock over 16: a live knockdown (damage.js)
        floater(o.group.position, 'BOWLED', '#ffd28a');
        e.vel.x *= 0.65; e.vel.z *= 0.65;
      }
    }
    if (shared.boss && shared.boss.hp > 0 && !th.hit.has(shared.boss) && p.distanceTo(shared.boss.group.position) < 2.2){
      th.hit.add(shared.boss); damageBoss(B.dmg * 0.6); e.vel.x *= -0.3; e.vel.z *= -0.3;
    }
  }
}
// hold the body at arm's length by the collar, facing him and up on its toes
function updateClinch(dt){
  const c = player.clinch, e = c.e;
  if (!enemies.includes(e) || e.dead || e.state !== 'grasped' || G.mode !== 'play' || !player.grounded || player.flip || player.dashT > 0 || player.slideT > 0 || player.downed){
    endClinch(); return;
  }
  c.t += dt;
  const busy = player.meleeT > 0 && (player.meleeKind === 'headbutt' || player.meleeKind === 'throw');
  if (c.t > M.grab.hold && !busy){
    // held too long: he shoves it off, reeling
    const f = fwd();
    endClinch();
    staggerEnemy(e, f.x, f.z, 'SHOVED'); reel(e, f, 1.1);
    player.meleeT = player.meleeMax = 0.3; player.meleeKind = 'cross'; player.meleeSkip = 0.1;
    return;
  }
  if (!busy && player.meleeT < 0.05){ player.meleeT = player.meleeMax = 0.3; player.meleeKind = 'clinch'; }
  const pp = playerPos(), f = fwd(), g = e.group;
  // the headbutt hauls it in onto the helmet, then lets it rock back out
  let pull = 0;
  if (player.meleeKind === 'headbutt'){
    const age = player.meleeMax - player.meleeT, k = age / M.headbutt.contact;
    pull = k < 1 ? k * k * 0.25 : Math.max(0, 0.25 - (age - M.headbutt.contact) * 2.2);
  }
  const d = bodyRadius(e) + M.grab.stand - pull;
  const tx = pp.x + f.x * d, tz = pp.z + f.z * d, k = Math.min(1, dt * 16);
  g.position.x += (tx - g.position.x) * k; g.position.z += (tz - g.position.z) * k;
  g.position.y += (pp.y + 0.06 - g.position.y) * k;
  g.rotation.y = Math.atan2(pp.x - g.position.x, pp.z - g.position.z);
  g.rotation.x += (0.16 - g.rotation.x) * k;   // hauled in by the collar
  g.rotation.z += (Math.sin(c.t * 7) * 0.05 - g.rotation.z) * k;   // it struggles in the grip
  e.vel.set(0, 0, 0); e.stunT = Math.max(e.stunT || 0, 0.2);
}
function endClinch(){
  const c = player.clinch; player.clinch = null;
  if (!c) return;
  const e = c.e; e.clinched = false;
  if (e && !e.dead && e.state === 'grasped'){ e.state = 'recover'; e.st = 0.45; e.group.rotation.x = 0; e.group.rotation.z = 0; e.group.position.y = Math.max(0, e.group.position.y - 0.06); }
  if (player.meleeKind === 'clinch' || player.meleeKind === 'grab'){ player.meleeT = 0; }
}

/* ---------------- the vambrace catch (called by hurtPlayer when a blow lands inside the window) ---------------- */
export function mandoCatch(fromPos){
  player.catchT = 0;
  tutEvent('catch');
  masteryXp('catch');
  player.meleeT = player.meleeMax = 0.3; player.meleeKind = 'catch'; player.meleeQueued = false;
  const pp = playerPos();
  TMP.subVectors(fromPos, pp); TMP.y = 0; if (TMP.lengthSq() > 0.001) TMP.normalize(); else TMP.copy(fwd());
  const cp = V3(pp.x + TMP.x * 0.8, pp.y + 1.55, pp.z + TMP.z * 0.8);
  clashFlash(cp, 0xffd28a, true);
  clashSparks(cp, 0xffe7b0, 6);
  G.hitstop = Math.max(G.hitstop, 0.16); G.shake = Math.max(G.shake, 0.7);
  G.slowmo = Math.min(G.slowmo, 0.3); G.slowmoT = Math.max(G.slowmoT, 0.3);
  screenFlash('radial-gradient(ellipse at center, rgba(255,230,170,.22), transparent 45%)', 0.5, 0.22);
  floater(pp, 'CAUGHT! ⟲ TAKEDOWN', '#ffd28a');
  S.clash(cp, true); sfx(2600, 0.12, 'triangle', 0.04, 1800);
  if (G.stats) G.stats.parries++;
  noteDefense('parries', fromPos);
}

/* ---------------- takedown: finish anything reeling or floored ---------------- */
function takedownTarget(extra){
  const pp = playerPos(), f = fwd();
  let best = null, bd = 1e9;
  for (const e of enemies){
    if (!live(e) || !DOWNED[e.state]) continue;
    TMP.subVectors(e.group.position, pp); const dy = Math.abs(TMP.y); TMP.y = 0;
    const d = TMP.length();
    if (d - bodyRadius(e) > M.takedown.range + extra || dy > 1.8) continue;
    if (d > 1.4 && TMP.normalize().dot(f) < 0.3) continue;
    if (d < bd){ bd = d; best = e; }
  }
  return best;
}
function takedown(e){
  const pp = playerPos(), g = e.group, T = M.takedown;
  TMP.subVectors(g.position, pp); TMP.y = 0; const d = TMP.length() || 1; TMP.divideScalar(d);
  const dir = TMP.clone();
  // reeling on its feet: the collar and a knife up under the plate · floored: down on one knee and the blade driven in
  const low = e.state !== 'stagger';
  player.meleeT = player.meleeMax = low ? T.floorRecover : T.recover; player.meleeKind = low ? 'takedownLow' : 'takedown';
  player.punchStep = -1; player.meleeQueued = false; player.meleeSkip = 0; player.meleeTgt = e;
  player.vel.copy(dir).multiplyScalar(Math.max(0, d - bodyRadius(e) - (low ? 0.1 : 0.5)) * 9); player.vel.y = 0;   // close the last step
  player.meleePending = { name: player.meleeKind, contact: low ? T.floorContact : T.contact, td: e, dir };
  // it stays where it is until the knife arrives
  e.stunT = Math.max(e.stunT || 0, 0.6);
  if (e.state === 'stagger') e.st = Math.max(e.st, 0.5); else e.st = Math.max(e.st || 0, 0.6);
  sfx(900, 0.08, 'sawtooth', 0.03, 1400);   // the blade springs from the vambrace
}
function landTakedown(e, dir){
  if (!live(e)) return;
  tutEvent('takedown');
  const pp = playerPos(), g = e.group, low = player.meleeKind === 'takedownLow';
  const big = e.t.heavy || e.warbringer || e.champion;
  const dmg = (M.takedown.dmg + (big ? 0 : (e.maxHp || e.hp) * M.takedown.maxFrac)) * (player.up.dmg || 1);
  damageEnemy(e, dmg, dir, 24, true, false, low ? NO_LAUNCH : { launch: false, fold: 1 });   // a finisher that puts it down, not a launch (the knife in the gut doubles it over)
  if (!e.dead && !e.t.heavy && !e.t.fly){ e.state = 'knockdown'; e.st = 0.9; e.vel.copy(dir).multiplyScalar(3); e.vel.y = 2.5; }   // slammed to the floor at your feet
  const ip = low ? V3(g.position.x + dir.x * 0.6, g.position.y + 0.3, g.position.z + dir.z * 0.6) : contactAt(e, 1);   // (floored, the chest lies past the feet)
  inkSprite({ pos: ip, shape: 'ring', inner: 0.84, arc: 1.4, color: 0xc9a6ff, size: [0.7, 1.4], life: 0.14, steps: 2, coreW: 0.32, inkW: 0.25, rot: rand(0, Math.PI) });
  sparks(ip, 0xc9a6ff, 6, 10, { dir, cone: 0.7, life: 0.2, size: 0.38 });
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
  tutEvent('charge');
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
  spawnHitSpark(ip, 0xffd28a, 1.6); sparks(ip, 0xffe7b0, 5, 9, { dir, cone: 0.6, life: 0.2, size: 0.38 });
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
  // E (or, holstered, LMB) still held a beat after the blow was thrown: the free hand takes the collar
  if (player.grabArm != null){
    const held = keys['e'] || (player.weapon === 'fists' && player.trigHeld);
    if (!held || player.clinch) player.grabArm = null;
    else if (G.gt - player.grabArm >= M.grab.press){ player.grabArm = null; tryGrab(); }
  }
  if (player.clinch) updateClinch(dt);
  updateReels(dt); updateThrown(dt);
  const tgt = player.clinch ? player.clinch.e : player.meleeT > 0 ? player.meleeTgt : null;
  if (tgt && live(tgt) && !tgt.t.fly) keepOut(tgt, player.clinch ? M.grab.stand - 0.1 : player.meleeKind === 'takedownLow' ? 0.05 : 0.3);
  if (player.meleeT > 0){
    player.meleeT -= dt;
    const B = player.meleePending;
    if (B && (player.meleeKind !== B.name || player.meleeMax - player.meleeT >= B.contact)){
      player.meleePending = null;
      // (a catch or a takedown cut in first: the throw never lands)
      if (player.meleeKind === B.name){
        if (B.td) landTakedown(B.td, B.dir);
        else if (B.name === 'headbutt'){ if (B.clinch === player.clinch) landHeadbutt(); }
        else if (B.name === 'throw'){ if (B.clinch === player.clinch) landThrow(); }
        else landStrike(B);
      }
    }
    if (player.meleeT <= 0){
      player.meleeEndAt = G.gt;
      if (player.meleeQueued){ player.meleeQueued = false; mandoMelee(); }
    }
  }
}
export function resetMandoMelee(){
  endClinch();
  player.catchT = 0; player.catchLockT = 0; player.charge = null; player.dive = null;
  player.meleeQueued = false; player.punchStep = -1; player.meleeT = 0; player.meleePending = null; player.grabArm = null; player.meleeTgt = null;
  reels.length = 0; thrown.length = 0;
}
