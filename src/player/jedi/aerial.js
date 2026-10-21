// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Jedi's AERIAL CUT (LMB in the air): a wind-up hang, a dash at the nearest foe ahead, a cut on contact and a
// planted landing. The Jedi's answer to the Mando's dive kick (mando/melee.js). It is a ONE-foe strike (no wave: that's
// the Jump Attack's job); only the foe it sends flying can bowl over whoever it is knocked into.

import { CFG } from '../../data/config.js';
import { SWING_PATTERNS } from '../../data/stances.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { shared, G, enemies, player } from '../../state.js';
import { fwd, playerPos, stance } from '../helpers.js';
import { damageEnemy, staggerEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss } from '../../boss/boss.js';
import { focusDmgMul, addFocus, FOCUS } from './focus.js';
import { spawnHitSpark } from '../../fx/vfx.js';
import { inkSprite, sparks } from '../../fx/ink.js';
import { DUEL } from '../../data/duel.js';
import { isGuarding, guardImpact } from '../../enemies/duel.js';
import { inReach } from '../../enemies/bodyshape.js';
import { SLAM_LAND_T } from '../anim/agility.js';

/* wind: the hang with the blade cocked overhead · dash: the flight in (homes on the foe), reaching full speed over
   `ramp` · range/cone: who it picks · reach: contact distance · stamCost: × the form's swing cost
   fling: the struck foe is thrown for this long, and anyone it crashes into (within flingR) takes flingDmg × the cut */
export const AIR_CUT = { wind: 0.18, dash: 0.42, speed: 32, ramp: 0.12, range: 14, cone: 0.5, reach: 1.9,
                         dmgMul: 1.35, knock: 26, stamCost: 1.5, minHeight: 0.6, fling: 0.45, flingR: 1.5, flingDmg: 0.35 };
const ease = (x, k) => 1 - Math.pow(k, x);   // frame-rate independent blend factor

const live = (e) => e && !e.dead && !e.converted && e.state !== 'spawn';

// the foe the cut flies at: in front of the view, the nearest and most centred
function pickTarget(pp){
  const f = fwd(); let best = null, bs = -1e9;
  const score = (pos, obj) => {
    TMP.subVectors(pos, pp); TMP.y = 0;
    const d = TMP.length();
    if (d > AIR_CUT.range) return;
    const c = d > 0.01 ? TMP.normalize().dot(f) : 1;
    if (c < AIR_CUT.cone) return;
    const sc = c * 2 - d / AIR_CUT.range;
    if (sc > bs){ bs = sc; best = obj; }
  };
  for (const e of enemies) if (live(e)) score(e.group.position, e);
  if (shared.boss && shared.boss.hp > 0) score(shared.boss.group.position, shared.boss);
  return best;
}

/* LMB in the air. Returns true when the press was taken (started, or a cut already in flight); false hands it on to
   a plain swing. One per airtime: a second press in the same jump is an ordinary air swing. */
export function airCut(){
  if (player.airCut) return true;
  if (G.mode !== 'play' || G.hero === 'mando' || player.holstered || player.grounded || player.airCutUsed) return false;
  if (player.slamming || player.mantle || player.hang || player.saberLock || shared.saberProj || player.flinchT > 0
      || player.judgeT > 0 || player.mendT > 0 || player.blockHeld) return false;
  const pp = playerPos();
  if (player.vy <= 0 && pp.y - (player.groundY || 0) < AIR_CUT.minHeight) return false;   // about to land: just swing
  const st = stance(), cost = st.stamina * AIR_CUT.stamCost;
  if (player.stam < cost) return false;
  player.stam -= cost; player.stamDelay = CFG.player.stamDelay;
  player.atkT = 0; player.swing = null; player.queuedAtk = false;
  player.flip = null; player.gliding = false;
  player.airCutUsed = true;
  const tgt = pickTarget(pp);
  const f = fwd();
  player.airCut = { phase: 'wind', t: 0, tgt, face: tgt ? Math.atan2(tgt.group.position.x - pp.x, tgt.group.position.z - pp.z) : Math.atan2(f.x, f.z) };
  // the wind-up: the climb eases to a stall (updateAirCut) while the blade comes up overhead and the air hums
  sparks(V3(pp.x, pp.y + 2.4, pp.z), st.blade, 6, 5, { dir: V3(0, 1, 0), cone: 0.6, life: 0.22, grav: 0 });
  sfx(180, 0.18, 'sawtooth', 0.04, 520); S.swing(G.stance);
  return true;
}

// the cut that lands on contact: ONE foe, the one it flew at (or, with none picked, the nearest right in front of the
// blade). The blade comes through overhead as a finisher (the swing is the look, the hit is here).
function strike(pp, tgt){
  const st = stance();
  const dir = fwd();
  if (!tgt){
    let bd = AIR_CUT.reach + 0.8;
    for (const e of enemies){
      if (!live(e) || Math.abs(e.group.position.y - pp.y) > 2.6 || !inReach(e, pp, bd, dir, 0.3)) continue;
      const d = Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z);
      if (d < bd){ bd = d; tgt = e; }
    }
  }
  if (tgt){ TMP.subVectors(tgt.group.position, pp); TMP.y = 0; if (TMP.lengthSq() > 0.01) dir.copy(TMP.normalize()); }
  const dmg = CFG.player.comboDamage[2] * st.dmg * player.up.dmg * focusDmgMul() * AIR_CUT.dmgMul;
  const knock = AIR_CUT.knock * st.knock * player.up.knock;
  let hit = false;
  if (tgt && tgt === shared.boss){ damageBoss(dmg * st.heavyDmg); hit = true; }
  else if (tgt){
    if (isGuarding(tgt)) guardImpact(tgt, DUEL.posture.charge);   // the weight of the fall cracks a guard
    damageEnemy(tgt, dmg * (tgt.t.heavy ? st.heavyDmg : 1), dir.clone(), knock, true);
    if (!tgt.dead) staggerEnemy(tgt, dir.x, dir.z);
    // the foe goes flying the way the cut was travelling: anyone it crashes into goes down with it
    player.airCutFling = { e: tgt, t: AIR_CUT.fling, dir: dir.clone(), dmg: dmg * AIR_CUT.flingDmg, knock: knock * 0.5, hit: new Set([tgt]) };
    hit = true;
  }
  // the blade comes through: an overhead finisher, picked up just past its chamber (the wind-up already raised it)
  const dur = 0.5 / (st.speed * (player.up.atkSpeed || 1));
  player.comboStep = 2;
  player.swing = { t: dur * 0.12, applied: false, step: 2, dur, pat: SWING_PATTERNS.forward, dir: 'forward', back: false,
                   riposte: false, cancelRip: false, flow: false, mom: null, noHit: true };
  player.atkT = dur * 0.88;
  player.deflectAnim = null;
  if (hit){
    const tp = tgt.group.position, ip = V3(tp.x - dir.x * 0.3, Math.max(pp.y, tp.y) + 1.2, tp.z - dir.z * 0.3);
    G.hitstop = Math.max(G.hitstop, 0.07); G.shake = Math.max(G.shake, 0.5);
    spawnHitSpark(ip, 0xffffff, 1.5);
    sparks(ip, st.blade, 12, 13, { dir, cone: 0.6, life: 0.3 });
    inkSprite({ pos: ip, shape: 'star', points: 6, sharp: 0.15, color: st.blade, size: [1.0, 2.6], life: 0.14, steps: 2, coreW: 0.4 });
    S.heavy(ip);
    addFocus(FOCUS.gainFin);
  }
  S.swing(G.stance);
}

// the flung foe: whoever it is knocked into takes a share of the cut and is shoved along with it
function updateFling(dt){
  const F = player.airCutFling;
  if (!F) return;
  F.t -= dt;
  if (F.t <= 0 || !F.e || !F.e.group){ player.airCutFling = null; return; }
  const fp = F.e.group.position;
  for (const o of enemies){
    if (F.hit.has(o) || !live(o)) continue;
    TMP.subVectors(o.group.position, fp);
    if (Math.abs(TMP.y) > 2) continue; TMP.y = 0;
    if (TMP.length() > AIR_CUT.flingR) continue;
    F.hit.add(o);
    const kd = TMP.lengthSq() > 0.01 ? TMP.normalize().add(F.dir).normalize().clone() : F.dir.clone();
    damageEnemy(o, F.dmg, kd, F.knock);
    if (!o.dead) flinchEnemy(o, kd, 0.6);
    burst(V3(o.group.position.x, 1.1, o.group.position.z), 0xcfd6dc, 5, 5, 2, 0.6);
    S.punch(o.group.position, 1.0);
  }
}

/* per frame (player/update.js): the wind-up, the flight in, then the landing out of it */
export function updateAirCut(dt){
  updateFling(dt);
  const c = player.airCut;
  if (!c) return;
  const pp = playerPos();
  if (c.phase === 'fall'){
    if (!player.grounded) return;
    // FOLLOW-THROUGH — down on one knee with the blade planted, a puff of dust (no wave: that's the Jump Attack)
    player.airCut = null;
    player.slamLandT = SLAM_LAND_T;
    player.moveVel.multiplyScalar(0.4); player.vel.multiplyScalar(0.4);
    burst(V3(pp.x, pp.y + 0.2, pp.z), 0xb9c2cc, 8, 4, 2, 0.8);
    G.shake = Math.max(G.shake, 0.25); player.landDip = Math.max(player.landDip || 0, 0.16);
    S.land(0.7);
    return;
  }
  if (player.mantle || player.hang || player.flinchT > 0 || G.mode !== 'play'){ player.airCut = null; return; }
  c.t += dt;
  const tgt = live(c.tgt) || (c.tgt && c.tgt === shared.boss && shared.boss.hp > 0) ? c.tgt : null;
  if (c.phase === 'wind'){
    // the climb EASES into a hang at the top of the wind-up (no snap): vertical speed settles toward a gentle drift up,
    // and the carry bleeds off
    player.vy += (1.4 - player.vy) * ease(dt, 1e-4);
    player.vel.multiplyScalar(Math.pow(0.05, dt)); player.moveVel.multiplyScalar(Math.pow(0.05, dt));
    if (tgt) c.face = Math.atan2(tgt.group.position.x - pp.x, tgt.group.position.z - pp.z);
    if (c.t < AIR_CUT.wind) return;
    c.phase = 'dash'; c.t = 0;
    S.dash(); sfx(320, 0.22, 'sawtooth', 0.05, 90);
    burst(V3(pp.x, pp.y + 1.2, pp.z), stance().blade, 8, 6, 2, 0.6);
  }
  // DASH — fly at the foe (or straight ahead and down a little, with nothing in reach)
  if (tgt){
    TMP.set(tgt.group.position.x - pp.x, (tgt.group.position.y + 0.9) - (pp.y + 0.9), tgt.group.position.z - pp.z);
    c.face = Math.atan2(TMP.x, TMP.z);
  } else TMP.set(Math.sin(c.face), -0.35, Math.cos(c.face));
  TMP.normalize();
  // the dash builds to full speed over `ramp` and steers into its line, rather than teleporting to it
  const sp = AIR_CUT.speed * (0.35 + 0.65 * Math.min(1, c.t / AIR_CUT.ramp)), k = ease(dt, 1e-6);
  player.vel.x += (TMP.x * sp - player.vel.x) * k; player.vel.z += (TMP.z * sp - player.vel.z) * k;
  player.vy += (TMP.y * sp * 0.8 - player.vy) * k;
  player.moveVel.multiplyScalar(Math.pow(0.01, dt));
  if (Math.random() < 0.8) burst(V3(pp.x, pp.y + 1.2, pp.z), stance().blade, 1, 2, 0, 0.35);   // the blade streaks the air
  const d = tgt ? Math.hypot(tgt.group.position.x - pp.x, tgt.group.position.z - pp.z) : 9;
  const near = tgt && d < AIR_CUT.reach + (tgt === shared.boss ? 1.5 : 0) && Math.abs(pp.y - tgt.group.position.y) < 2.6;
  if (!(near || (player.grounded && !tgt) || c.t >= AIR_CUT.dash)) return;   // (with a foe picked, a low dash skims the ground to reach it)
  // CONTACT — the cut, then the fall into the landing
  strike(pp, tgt);
  player.vel.multiplyScalar(0.3);   // carry a little through the cut, then gravity takes the fall
  player.vy = player.grounded ? 0 : Math.min(player.vy * 0.4, -1.5);
  c.phase = 'fall';
}

export function resetAirCut(){ player.airCut = null; player.airCutUsed = false; player.airCutFling = null; }
