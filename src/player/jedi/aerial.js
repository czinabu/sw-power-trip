// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Jedi's AERIAL CUT (LMB in the air): a beat of wind-up, then a LOW, LEVEL dash at the nearest foe ahead (the run's
// momentum carries into it), a horizontal cut on contact and a planted landing. The Jedi's answer to the Mando's dive kick (mando/melee.js). It is a ONE-foe strike (no wave: that's
// the Jump Attack's job); only the foe it sends flying can bowl over whoever it is knocked into.

import { CFG } from '../../data/config.js';
import { stamDelay } from '../stamina.js';
import { SWING_PATTERNS, backLineMul, swordMul } from '../../data/stances.js';
import { furyMul } from './fury.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { shared, G, enemies, keys, player } from '../../state.js';
import { fwd, playerPos, stance } from '../helpers.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss } from '../../boss/boss.js';
import { focusDmgMul, addFocus, FOCUS } from './focus.js';
import { spawnHitSpark } from '../../fx/vfx.js';
import { inkSprite, sparks } from '../../fx/ink.js';
import { DUEL } from '../../data/duel.js';
import { isGuarding, guardImpact } from '../../enemies/duel.js';
import { inReach } from '../../enemies/bodyshape.js';
import { SLAM_LAND_T, rushFlip } from '../anim/agility.js';
import { scarBody, severLimbs } from '../../enemies/scars.js';

/* wind: the beat with the blade drawn back (longer if a flip has to finish first) · dash: the flight in (homes on the
   foe), reaching full speed over `ramp`, skimming in at `level` above the foe's feet · range/cone: who it picks ·
   reach: contact distance · stamCost: × the form's swing cost
   COST — forceCost and a cooldown, plus `recover`: after the landing the blade is slow to swing again, so a whiffed or
   spammed cut leaves you open. dmgMul × the finisher's damage: a strong opener, not a one-shot (a grunt survives it).
   minFwd: it only fires carrying forward momentum (W held and moving that way); a standing hop is a plain air swing.
   fling: the struck foe is thrown for this long, and anyone it crashes into (within flingR) takes flingDmg × the cut */
export const AIR_CUT = { wind: 0.1, dash: 0.26, speed: 19, ramp: 0.12, level: 0.5, range: 7, cone: 0.6, reach: 1.9,
                         dmgMul: 0.75, knock: 18, stamCost: 1.5, forceCost: 14, cd: 3, recover: 0.4, minFwd: 3,
                         minHeight: 0.25, fling: 0.35, flingR: 1.4, flingDmg: 0.3 };
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
  // only out of a forward run or leap: W held, and actually carrying speed the way you face
  const f0 = fwd();
  if (!keys['w'] || (player.vel.x + player.moveVel.x) * f0.x + (player.vel.z + player.moveVel.z) * f0.z < AIR_CUT.minFwd) return false;
  const st = stance(), cost = st.stamina * AIR_CUT.stamCost, fcost = AIR_CUT.forceCost * (player.up.abilityCostMul || 1);
  if (player.cds.airCut > 0 || player.stam < cost || player.force < fcost) return false;   // (not ready: the press is a plain air swing)
  player.stam -= cost; player.stamDelay = stamDelay();
  player.force -= fcost; player.cds.airCut = AIR_CUT.cd;
  player.atkT = 0; player.swing = null; player.queuedAtk = false;
  player.gliding = false;
  player.airCutUsed = true;
  const tgt = pickTarget(pp);
  const f = fwd();
  // mid-flip, the flip finishes its somersault through the wind-up instead of being dropped
  const wind = Math.max(AIR_CUT.wind, rushFlip(AIR_CUT.wind));
  player.airCut = { phase: 'wind', t: 0, wind, tgt, face: tgt ? Math.atan2(tgt.group.position.x - pp.x, tgt.group.position.z - pp.z) : Math.atan2(f.x, f.z) };
  // the run's momentum carries into the dash: it becomes the impulse the dash steers
  player.vel.x += player.moveVel.x; player.vel.z += player.moveVel.z; player.moveVel.set(0, 0, 0);
  sparks(V3(pp.x, pp.y + 1.4, pp.z), st.blade, 6, 5, { dir: f.clone().negate(), cone: 0.6, life: 0.22, grav: 0 });   // the blade draws back
  sfx(180, 0.18, 'sawtooth', 0.04, 520); S.swing(G.stance);
  return true;
}

// the cut that lands on contact: ONE foe, the one it flew at (or, with none picked, the nearest right in front of the
// blade). The blade comes through in a flat sweep (the swing is the look, the hit is here).
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
  const dmg = CFG.player.comboDamage[2] * st.dmg * player.up.dmg * focusDmgMul() * AIR_CUT.dmgMul * (st.airCutDmg || 1) * furyMul();   // (Ataru's air cuts land harder)
  const knock = AIR_CUT.knock * st.knock * player.up.knock;
  let hit = false;
  if (tgt && tgt === shared.boss){ damageBoss(dmg * st.heavyDmg); scarBody(tgt.group, dir, 'neutral', true); hit = true; }
  else if (tgt){
    if (isGuarding(tgt)) guardImpact(tgt, DUEL.posture.charge);   // the weight of the fall cracks a guard
    damageEnemy(tgt, dmg * (tgt.t.heavy ? st.heavyDmg : 1) * backLineMul(st, tgt) * swordMul(st, tgt), dir.clone(), knock, true, false, { shove: CFG.player.saberShove.max, blade: true });   // (a blade's short shove: config saberShove)
    scarBody(tgt.group, dir, 'neutral', true);   // the falling cut burns its line in (enemies/scars.js)
    if (tgt.dead) severLimbs(tgt, dir, 0.7);
    if (!tgt.dead) flinchEnemy(tgt, dir, 0.7);   // rocked back, not floored: you still have to finish it
    // the foe goes flying the way the cut was travelling: anyone it crashes into goes down with it
    player.airCutFling = { e: tgt, t: AIR_CUT.fling, dir: dir.clone(), dmg: dmg * AIR_CUT.flingDmg, knock: knock * 0.5, hit: new Set([tgt]) };
    hit = true;
  }
  // the blade comes through: a flat sweep, picked up just past its chamber (the wind-up already drew it back)
  const dur = 0.5 / (st.speed * (player.up.atkSpeed || 1));
  player.comboStep = 2;
  player.swing = { t: dur * 0.12, applied: false, step: 2, dur, pat: SWING_PATTERNS.right, dir: 'right', back: false,
                   riposte: false, cancelRip: false, flow: false, mom: null, noHit: true };
  player.atkT = dur * 0.88;
  player.deflectAnim = null;
  if (hit){
    const tp = tgt.group.position, ip = V3(tp.x - dir.x * 0.3, Math.max(pp.y, tp.y) + 1.2, tp.z - dir.z * 0.3);
    G.hitstop = Math.max(G.hitstop, 0.07); G.shake = Math.max(G.shake, 0.5);
    spawnHitSpark(ip, 0xffffff, 1.5);
    sparks(ip, st.blade, 5, 9, { dir, cone: 0.6, life: 0.2, size: 0.38 });
    inkSprite({ pos: ip, shape: 'star', points: 6, sharp: 0.15, color: st.blade, size: [0.3, 0.8], life: 0.1, steps: 2, coreW: 0.4 });
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
    player.swingLock = Math.max(player.swingLock || 0, AIR_CUT.recover);   // RECOVERY — up off the knee before the next cut
    player.moveVel.multiplyScalar(0.15); player.vel.multiplyScalar(0.15);   // plant: no skating on out of it
    burst(V3(pp.x, pp.y + 0.2, pp.z), 0xb9c2cc, 8, 4, 2, 0.8);
    G.shake = Math.max(G.shake, 0.25); player.landDip = Math.max(player.landDip || 0, 0.16);
    S.land(0.7);
    return;
  }
  if (player.mantle || player.hang || player.flinchT > 0 || G.mode !== 'play'){ player.airCut = null; return; }
  c.t += dt;
  const tgt = live(c.tgt) || (c.tgt && c.tgt === shared.boss && shared.boss.hp > 0) ? c.tgt : null;
  if (c.phase === 'wind'){
    // the climb EASES level (no snap, no hang-and-rise) and the run keeps most of its carry
    player.vy += (0 - player.vy) * ease(dt, 1e-4);
    player.vel.multiplyScalar(Math.pow(0.25, dt));
    if (tgt) c.face = Math.atan2(tgt.group.position.x - pp.x, tgt.group.position.z - pp.z);
    if (c.t < c.wind) return;
    if (player.flip){ player.flip = null; player.vis.rotation.set(0, 0, 0); player.vis.position.set(0, 0, 0); }   // (a rushed flip has landed its turn)
    c.phase = 'dash'; c.t = 0; c.v0 = Math.hypot(player.vel.x, player.vel.z);
    S.dash(); sfx(320, 0.22, 'sawtooth', 0.05, 90);
    burst(V3(pp.x, pp.y + 1.2, pp.z), stance().blade, 8, 6, 2, 0.6);
  }
  // DASH — a LEVEL run at the foe (or straight ahead, with nothing in reach): horizontal, skimming down to just above
  // its feet rather than diving onto it
  if (tgt){ TMP.set(tgt.group.position.x - pp.x, 0, tgt.group.position.z - pp.z); c.face = Math.atan2(TMP.x, TMP.z); }
  else TMP.set(Math.sin(c.face), 0, Math.cos(c.face));
  TMP.normalize();
  // the dash builds from the speed it came in with to full over `ramp`, steering into its line rather than teleporting
  const v0 = Math.min(c.v0 || 0, AIR_CUT.speed), sp = v0 + (AIR_CUT.speed - v0) * Math.min(1, c.t / AIR_CUT.ramp), k = ease(dt, 1e-6);
  player.vel.x += (TMP.x * sp - player.vel.x) * k; player.vel.z += (TMP.z * sp - player.vel.z) * k;
  const lvl = (tgt ? tgt.group.position.y : (player.groundY || 0)) + AIR_CUT.level;
  player.vy = clamp((lvl - pp.y) * 7, -14, 3);
  player.moveVel.multiplyScalar(Math.pow(0.01, dt));
  if (Math.random() < 0.8) burst(V3(pp.x, pp.y + 1.2, pp.z), stance().blade, 1, 2, 0, 0.35);   // the blade streaks the air
  const d = tgt ? Math.hypot(tgt.group.position.x - pp.x, tgt.group.position.z - pp.z) : 9;
  const near = tgt && d < AIR_CUT.reach + (tgt === shared.boss ? 1.5 : 0) && Math.abs(pp.y - tgt.group.position.y) < 2.6;
  if (!(near || (player.grounded && !tgt) || c.t >= AIR_CUT.dash)) return;   // (with a foe picked, a low dash skims the ground to reach it)
  // CONTACT — the cut, then the fall into the landing
  strike(pp, tgt);
  player.vel.multiplyScalar(0.15);   // the cut stops the lunge; a little carry, then gravity takes the fall
  player.vy = player.grounded ? 0 : Math.min(player.vy * 0.4, -3);
  c.phase = 'fall';
}

export function resetAirCut(){ player.airCut = null; player.airCutUsed = false; player.airCutFling = null; }
