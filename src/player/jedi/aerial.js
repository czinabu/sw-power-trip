// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Jedi's AERIAL CUT (LMB in the air): a wind-up hang, a dash at the nearest foe ahead, a cut on contact and a
// planted landing. The Jedi's answer to the Mando's dive kick (mando/melee.js).

import { CFG } from '../../data/config.js';
import { SWING_PATTERNS } from '../../data/stances.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { shared, G, enemies, player } from '../../state.js';
import { fwd, playerPos, stance } from '../helpers.js';
import { damageEnemy, staggerEnemy } from '../../enemies/damage.js';
import { damageBoss } from '../../boss/boss.js';
import { focusDmgMul, addFocus, FOCUS } from './focus.js';
import { spawnHitSpark, spawnGroundShock } from '../../fx/vfx.js';
import { inkSprite, sparks, dustRing } from '../../fx/ink.js';
import { DUEL } from '../../data/duel.js';
import { isGuarding, guardImpact } from '../../enemies/duel.js';
import { inReach } from '../../enemies/bodyshape.js';
import { SLAM_LAND_T } from '../anim/agility.js';

/* wind: the hang with the blade cocked overhead · dash: the flight in (homes on the foe) · range/cone: who it picks
   · reach: contact distance · radius: the cut catches others this close to the foe · stamCost: × the form's swing cost */
export const AIR_CUT = { wind: 0.16, dash: 0.4, speed: 34, range: 14, cone: 0.5, reach: 1.9, radius: 3.2,
                         dmgMul: 1.35, knock: 26, stamCost: 1.5, minHeight: 0.6 };

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
  // the wind-up: the climb stalls, the blade comes up overhead and the air hums
  player.vel.multiplyScalar(0.3); player.moveVel.multiplyScalar(0.3);
  player.vy = Math.max(player.vy * 0.25, 2.5);
  sparks(V3(pp.x, pp.y + 2.4, pp.z), st.blade, 6, 5, { dir: V3(0, 1, 0), cone: 0.6, life: 0.22, grav: 0 });
  sfx(180, 0.18, 'sawtooth', 0.04, 520); S.swing(G.stance);
  return true;
}

// the cut that lands on contact: the blade comes through overhead as a finisher (the swing is the look, the hit is here)
function strike(pp, tgt){
  const st = stance();
  const dir = fwd();
  if (tgt){ TMP.subVectors(tgt.group.position, pp); TMP.y = 0; if (TMP.lengthSq() > 0.01) dir.copy(TMP.normalize()); }
  const dmg = CFG.player.comboDamage[2] * st.dmg * player.up.dmg * focusDmgMul() * AIR_CUT.dmgMul;
  const knock = AIR_CUT.knock * st.knock * player.up.knock;
  const hitAt = tgt ? tgt.group.position : V3(pp.x + dir.x * 1.6, pp.y, pp.z + dir.z * 1.6);
  let hits = 0;
  for (const e of enemies){
    if (!live(e)) continue;
    if (Math.abs(e.group.position.y - pp.y) > 3) continue;
    const main = e === tgt;
    if (!main && !inReach(e, hitAt, AIR_CUT.radius)) continue;
    if (!main && !tgt && !inReach(e, pp, AIR_CUT.radius, dir, 0.2)) continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    const kd = TMP.lengthSq() > 0.01 ? TMP.normalize().clone() : dir.clone();
    if (main && isGuarding(e)) guardImpact(e, DUEL.posture.charge);   // the weight of the fall cracks a guard
    damageEnemy(e, (main ? dmg : dmg * 0.5) * (e.t.heavy ? st.heavyDmg : 1), kd, main ? knock : knock * 0.6, true);
    if (main && !e.dead) staggerEnemy(e, kd.x, kd.z);
    hits++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(hitAt) < AIR_CUT.radius + 1.5){ damageBoss(dmg * st.heavyDmg); hits++; }
  // the blade comes through: an overhead finisher, past its chamber so the stroke is the first thing you see
  const dur = 0.5 / (st.speed * (player.up.atkSpeed || 1));
  player.comboStep = 2;
  player.swing = { t: dur * 0.2, applied: false, step: 2, dur, pat: SWING_PATTERNS.forward, dir: 'forward', back: false,
                   riposte: false, cancelRip: false, flow: false, mom: null, noHit: true };
  player.atkT = dur * 0.8;
  player.deflectAnim = null;
  const ip = V3(hitAt.x, Math.max(pp.y + 1.1, 0.8), hitAt.z);
  if (hits){
    G.hitstop = Math.max(G.hitstop, 0.12); G.shake = Math.max(G.shake, 0.85);
    G.slowmo = Math.min(G.slowmo, 0.45); G.slowmoT = Math.max(G.slowmoT, 0.12);
    spawnHitSpark(ip, 0xffffff, 2.0);
    sparks(ip, st.blade, 16, 15, { dir, cone: 0.7, life: 0.34 });
    inkSprite({ pos: ip, shape: 'star', points: 8, sharp: 0.15, color: st.blade, size: [1.4, 3.8], life: 0.16, steps: 2, coreW: 0.4 });
    S.heavy(ip); S.clash(ip, true);
    addFocus(FOCUS.gainFin);
  }
  S.swing(G.stance);
}

/* per frame (player/update.js): the wind-up, the flight in, then the landing out of it */
export function updateAirCut(dt){
  const c = player.airCut;
  if (!c) return;
  const pp = playerPos();
  if (c.phase === 'fall'){
    if (!player.grounded) return;
    // FOLLOW-THROUGH — down on one knee with the blade planted, the ground cracking out from under it
    player.airCut = null;
    player.slamLandT = SLAM_LAND_T;
    player.moveVel.multiplyScalar(0.2); player.vel.multiplyScalar(0.2);
    const col = stance().blade;
    spawnGroundShock(V3(pp.x, pp.y + 0.1, pp.z), col, 4.2, 0.32, 0.5);
    dustRing(pp, 3);
    burst(V3(pp.x, pp.y + 0.3, pp.z), 0x9a9a9a, 8, 7, 5, 1);
    G.shake = Math.max(G.shake, 0.55); player.landDip = Math.max(player.landDip || 0, 0.3);
    S.land(1); S.heavy();
    return;
  }
  if (player.mantle || player.hang || player.flinchT > 0 || G.mode !== 'play'){ player.airCut = null; return; }
  c.t += dt;
  const tgt = live(c.tgt) || (c.tgt && c.tgt === shared.boss && shared.boss.hp > 0) ? c.tgt : null;
  if (c.phase === 'wind'){
    // hang at the top of the wind-up, drifting a touch upward
    player.vy = Math.max(player.vy, 1.2) * Math.pow(0.02, dt);
    player.vel.multiplyScalar(Math.pow(0.02, dt));
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
  player.vel.x = TMP.x * AIR_CUT.speed; player.vel.z = TMP.z * AIR_CUT.speed;
  player.vy = TMP.y * AIR_CUT.speed * 0.8;
  player.moveVel.set(0, 0, 0);
  if (Math.random() < 0.8) burst(V3(pp.x, pp.y + 1.2, pp.z), stance().blade, 1, 2, 0, 0.35);   // the blade streaks the air
  const d = tgt ? Math.hypot(tgt.group.position.x - pp.x, tgt.group.position.z - pp.z) : 9;
  const near = tgt && d < AIR_CUT.reach + (tgt === shared.boss ? 1.5 : 0) && Math.abs(pp.y - tgt.group.position.y) < 2.6;
  if (!(near || player.grounded || c.t >= AIR_CUT.dash)) return;
  // CONTACT — the cut, then the fall into the landing
  strike(pp, tgt);
  player.vel.multiplyScalar(0.12);
  player.vy = player.grounded ? 0 : Math.min(player.vy, -4);
  c.phase = 'fall';
}

export function resetAirCut(){ player.airCut = null; player.airCutUsed = false; }
