// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORCE GRASP — hold the Pull key (C) for a second to lock the foe you're aiming at into your grasp. It hangs limp in
// the air ahead of you and follows your aim; sweep it into other foes to bowl them over (brutes and the tougher
// champions brace and only stumble). While held: F hurls it the way you're aiming, a tap of C yanks it in onto your
// blade for a saber strike, and the slide key (Left Alt) drops it. A short tap of C is still the plain Force Pull.

import { abil } from '../../data/mastery.js';
import { CFG } from '../../data/config.js';
import { S } from '../../audio/sfx.js';
import { V3, clamp, TMP } from '../../utils.js';
import { floater } from '../../fx/floaters.js';
import { shared, G, enemies, player } from '../../state.js';
import { fwd, playerPos, stance } from '../helpers.js';
import { inReach } from '../../enemies/bodyshape.js';
import { damageEnemy, staggerEnemy } from '../../enemies/damage.js';
import { bossStagger } from '../../boss/boss.js';
import { sparks, motes } from '../../fx/ink.js';
import { castGesture, forcePull } from './force.js';
import { tryAttack } from './combat.js';
import { forceStrike } from './palm.js';

const A = () => CFG.abilities.grasp;
const fcost = (base) => base * (player.up.abilityCostMul || 1);
// too big or too steady to be lifted: brutes, the mid-boss and champions (they only brace when you hit them with one)
const tough = (e) => !!(e.t.heavy || e.warbringer || e.champion);
const graspable = (e) => !e.dead && !e.converted && !e.sparring && e.state !== 'spawn' && e.state !== 'lock' && e.state !== 'fade';

// where the aim points, pitch included (looking up raises the throw)
function aimDir(){
  const f = fwd();
  f.y = clamp(-(G.pitch - 0.1) * 0.8, -0.35, 0.6);
  return f.normalize();
}
// the foe the grasp would take: nearest in a tight cone along the aim
function graspTarget(){
  const g = A(), pp = playerPos(), f = fwd(), cosLim = Math.cos(g.angle);
  let best = null, bd = g.range * (abil('pull').range / CFG.abilities.pull.range);   // Pull's reach mastery stretches it too
  for (const e of enemies){
    if (!graspable(e)) continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (d >= bd || !inReach(e, pp, bd, f, cosLim)) continue;
    bd = d; best = e;
  }
  return best;
}

/* C pressed. Held: start charging the grasp. Already holding someone: a tap YANKS them in. */
export function pullPress(){
  if (G.mode !== 'play') return;
  if (player.grasp){ yank(); return; }
  if (!G.unlocked.pull){ forcePull(); return; }   // the base Pull handles its own refusal
  player.graspCharge = { t: 0, target: null };
}
/* C released before the grasp locked: that was a tap, so it's the plain Pull */
export function pullRelease(){
  const c = player.graspCharge;
  player.graspCharge = null;
  if (c && !c.locked) forcePull();
}
/* the slide key while grasping drops the foe. Returns true if it did (so the key doesn't also slide). */
export function graspDrop(){
  const gr = player.grasp;
  if (!gr) return false;
  const e = gr.e;
  endGrasp();
  if (!e.dead && e.state === 'grasped'){ e.state = 'knockdown'; e.st = 0.6; e.vel.set(0, -2, 0); }
  floater(e.group.position, 'DROPPED', '#8fbfe0');
  return true;
}
/* F while grasping: hurl the foe along the aim. Returns true if it threw (so F doesn't also Push). */
export function graspThrow(){
  const gr = player.grasp;
  if (!gr) return false;
  const g = A(), e = gr.e, d = aimDir();
  endGrasp();
  castGesture('push', 0.28);
  S.push(); G.shake = Math.max(G.shake, 0.45);
  sparks(e.group.position.clone().setY(e.group.position.y + 1.2), stance().blade, 10, 14, { dir: d, cone: 0.4, life: 0.3, grav: 0, stretch: 4 });
  // a live 'ragdoll' tumbles, bowls over anything it flies into (ai.js), and gets up where it lands
  e.state = 'ragdoll'; e.st = 0;
  e.vel.copy(d).multiplyScalar(g.throwSpeed); e.vel.y = Math.max(e.vel.y, 3);
  damageEnemy(e, g.throwDmg * (stance().powerDmg || 1), null, 0);   // the wrench of the throw itself (no launch: we set it)
  if (!e.dead){ e.state = 'ragdoll'; }
  floater(e.group.position, 'HURLED', '#7fd4ff');
  return true;
}
// a tap of C while grasping: drag them in onto the blade, then cut
function yank(){
  const gr = player.grasp;
  if (gr.yank) return;
  gr.yank = true; gr.yankT = 0;
  castGesture('pull', 0.32);
  S.pull();
}
function endGrasp(){
  const gr = player.grasp;
  player.grasp = null;
  if (gr) player.cds.pull = abil('pull').cd * (stance().cdMult || 1);
}
// lock the target into the grasp
function lockOn(e){
  const g = A();
  const cost = fcost(g.cost);
  if (tough(e) || (shared.boss && e === shared.boss)){ floater(e.group.position, 'TOO HEAVY', '#aa7788'); return false; }
  if (player.force < cost || player.cds.pull > 0) return false;
  player.force -= cost;
  e.state = 'grasped'; e.st = 0;
  e.vel.set(0, 0, 0);
  e.graspSpin = 0;
  player.grasp = { e, t: 0, yank: false, hit: new Map() };
  castGesture('pull', 0.5);
  S.pull(); G.shake = Math.max(G.shake, 0.3);
  floater(e.group.position, 'GRASPED', '#7fd4ff');
  return true;
}

/* per frame: charge the hold, then drive the grasped body */
export function updateGrasp(dt){
  const c = player.graspCharge;
  if (c && !c.locked){
    if (G.mode !== 'play' || G.hero === 'mando'){ player.graspCharge = null; }
    else {
      c.t += dt;
      const tgt = graspTarget();
      c.target = tgt;
      player.castT = Math.max(player.castT, 0.12); player.castMax = 0.5; player.castKind = 'pull';   // the hand reaches out while you hold
      if (tgt && Math.random() < dt * 14){
        const p = tgt.group.position;
        motes(V3(p.x, p.y + 0.2, p.z), stance().blade, 1, 0.5, { h: 2.0 });
      }
      if (c.t >= A().hold && tgt){
        c.locked = true;   // the release won't fire a Pull now, whether or not the lock took
        lockOn(tgt);
      }
    }
  }
  const gr = player.grasp;
  if (!gr) return;
  const e = gr.e, g = A(), grp = e.group;
  // anything else that took the body off us (killed, knocked loose, a level change) ends the grasp
  if (e.dead || e.state !== 'grasped' || G.mode !== 'play' || !enemies.includes(e)){ endGrasp(); return; }
  gr.t += dt;
  // the hold costs Force to sustain, and can't last forever
  player.force -= g.drain * (player.up.abilityCostMul || 1) * dt;
  if (player.force <= 0 || gr.t > g.maxT){ player.force = Math.max(0, player.force); graspDrop(); return; }
  player.castT = Math.max(player.castT, 0.2); player.castMax = 0.5; player.castKind = 'pull';
  const pp = playerPos(), f = fwd();
  // where the hand holds it: out along the aim (raised when you look up), or, when yanked, right onto the blade
  const dist = gr.yank ? 1.5 : g.dist;
  const lift = gr.yank ? 0.25 : clamp(1.4 - (G.pitch - 0.1) * 3, 0.6, 3.6);
  const tx = pp.x + f.x * dist, ty = pp.y + lift, tz = pp.z + f.z * dist;
  // a stiff spring with a lag, so whipping your aim around swings the body like a dead weight
  const k = gr.yank ? 180 : 70, damp = 1.6 * Math.sqrt(k), h = Math.min(dt, 1 / 30);   // a touch under-damped: it swings past and settles
  const px = grp.position.x, pz = grp.position.z;
  e.vel.x += ((tx - px) * k - e.vel.x * damp) * h;
  e.vel.y += ((ty - grp.position.y) * k - e.vel.y * damp) * h;
  e.vel.z += ((tz - pz) * k - e.vel.z * damp) * h;
  grp.position.addScaledVector(e.vel, dt);
  if (grp.position.y < 0) grp.position.y = 0;
  // limp: the body tips over and dangles, swaying against the way it's being dragged
  const hs = Math.hypot(e.vel.x, e.vel.z);
  e.graspSpin += dt * (1.2 + hs * 0.3);
  grp.rotation.x = clamp(-0.5 - e.vel.z * 0.05 + Math.sin(e.graspSpin) * 0.15, -1.4, 1.4);
  grp.rotation.z = clamp(e.vel.x * 0.06 + Math.cos(e.graspSpin * 0.8) * 0.2, -0.9, 0.9);
  // DRAGGED INTO OTHERS — a body swung into a foe bowls it over; the tough ones brace and only stumble
  if (hs > g.bumpSpeed){
    const dir = V3(e.vel.x, 0, e.vel.z).normalize();
    for (const o of enemies){
      if (o === e || o.dead || o.converted || o.state === 'ragdoll' || o.state === 'knockdown' || o.state === 'spawn' || o.state === 'grasped') continue;
      if ((gr.hit.get(o) || -9) > G.gt - 0.8) continue;   // one knock per foe per swing
      if (grp.position.distanceTo(o.group.position) > 1.6 * (o.t.scale || 1)) continue;
      gr.hit.set(o, G.gt);
      S.punch(o.group.position, 1);
      if (tough(o)){
        // a brute takes it on the chest: it rocks back a step, and the body you swung bounces off it
        o.group.position.addScaledVector(dir, 0.6);
        if (o.state !== 'windup' && o.state !== 'strike'){ o.state = 'recover'; o.st = 0.4; }
        floater(o.group.position, 'BRACED', '#aa7788');
        e.vel.multiplyScalar(-0.4);
        G.shake = Math.max(G.shake, 0.3);
      } else {
        damageEnemy(o, g.bumpDmg, dir, g.bumpKnock);   // knockPow over 16: a live knockdown (damage.js)
        floater(o.group.position, 'BOWLED', '#7fd4ff');
      }
    }
    if (shared.boss && shared.boss.hp > 0 && (gr.hit.get(shared.boss) || -9) < G.gt - 0.8 && grp.position.distanceTo(shared.boss.group.position) < 2.2){
      gr.hit.set(shared.boss, G.gt); if (shared.boss.state === 'chase') bossStagger(); e.vel.multiplyScalar(-0.4);
    }
  }
  // the yank arrives: the foe lands reeling right in front of the blade and the cut goes in
  if (gr.yank){
    gr.yankT += dt;
    if (Math.hypot(grp.position.x - tx, grp.position.z - tz) < 0.8 || gr.yankT > 0.45){
      endGrasp();
      grp.rotation.x = 0; grp.rotation.z = 0;
      grp.position.y = Math.max(0, pp.y);
      e.vel.set(0, 0, 0);
      damageEnemy(e, g.yankDmg, null, 0);
      if (!e.dead){ staggerEnemy(e, f.x, f.z, 'YANKED!'); }
      player.swingLock = 0;
      if (player.holstered) forceStrike(); else tryAttack();   // holstered: the Force palm strike instead of the blade
    }
  }
}
// level reset / death: let go without ceremony
export function resetGrasp(){
  if (player.grasp){ const e = player.grasp.e; endGrasp(); if (!e.dead && e.state === 'grasped'){ e.state = 'knockdown'; e.st = 0.4; } }
  player.graspCharge = null;
}
