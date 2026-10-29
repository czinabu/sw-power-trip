// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORCE GRASP — hold the Pull key (C) for a moment to lock the foe you're aiming at into your grasp (with DARK LORD'S
// GRIP, a late store upgrade, up to grasp.multi foes at once, fanned out ahead of you). It hangs limp in
// the air ahead of you and follows your aim; sweep it into other foes to bowl them over (brutes and the tougher
// champions brace and only stumble). While held: F hurls it (them) the way you're aiming, a tap of C yanks it in onto
// your blade for a saber strike, and the slide key (Left Alt) drops it. A short tap of C is still the plain Force Pull.

import { abil } from '../../data/mastery.js';
import { CFG } from '../../data/config.js';
import { S } from '../../audio/sfx.js';
import { V3, clamp, TMP } from '../../utils.js';
import { floater } from '../../fx/floaters.js';
import { shared, G, enemies, player } from '../../state.js';
import { forcePower, fwd, playerPos, stance } from '../helpers.js';
import { heroAim, inAim, bossInAim } from '../aim.js';
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

// where the aim points, pitch included: down the crosshair (looking up raises the throw, onto a foe in the air too)
const aimDir = () => heroAim().dir;
// how many foes one grasp can hold: one, or grasp.multi with DARK LORD'S GRIP
const maxHeld = () => player.up.graspMulti ? A().multi : 1;
// the foes the grasp would take: the nearest liftable ones in a cone along the aim (a wider cone for a multi-grasp)
function graspTargets(){
  const g = A(), pp = playerPos(), aim = heroAim(), n = maxHeld();
  const cosLim = Math.cos(n > 1 ? g.multiAngle : g.angle);
  const reach = g.range * (abil('pull').range / CFG.abilities.pull.range);   // Pull's reach mastery stretches it too
  const found = [];
  for (const e of enemies){
    if (!graspable(e) || tough(e)) continue;
    const d = e.group.position.distanceTo(pp);
    if (!inAim(e, aim, reach, cosLim, 0.16)) continue;   // a jetpacker overhead: aim up at it to pluck it out of the air
    found.push({ e, d });
  }
  found.sort((a, b) => a.d - b.d);
  return found.slice(0, n).map(o => o.e);
}
// the nearest tough foe in the aim: aiming the grasp at a brute says why nothing lifts
function toughInAim(){
  const g = A(), aim = heroAim(), cosLim = Math.cos(g.angle);
  for (const e of enemies) if (graspable(e) && tough(e) && inAim(e, aim, g.range, cosLim, 0.16)) return e;
  return bossInAim(aim, g.range, cosLim, 0.16) ? shared.boss : null;
}

/* C pressed. Held: start charging the grasp. Already holding someone: a tap YANKS them in. */
export function pullPress(){
  if (G.mode !== 'play') return;
  if (player.grasp){ yank(); return; }
  if (!G.unlocked.pull){ forcePull(); return; }   // the base Pull handles its own refusal
  player.graspCharge = { t: 0, targets: [] };
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
  endGrasp();
  for (const b of gr.bodies){
    const e = b.e;
    if (!e.dead && e.state === 'grasped'){ e.state = 'knockdown'; e.st = 0.6; e.vel.set(0, -2, 0); }
  }
  if (gr.bodies.length) floater(gr.bodies[0].e.group.position, 'DROPPED', '#8fbfe0');
  return true;
}
/* F while grasping: hurl the foe along the aim. Returns true if it threw (so F doesn't also Push). */
export function graspThrow(){
  const gr = player.grasp;
  if (!gr) return false;
  const g = A(), d = aimDir();
  endGrasp();
  castGesture('push', 0.28);
  S.push(); G.shake = Math.max(G.shake, 0.45 + 0.1 * (gr.bodies.length - 1));
  for (const b of gr.bodies){
    const e = b.e;
    if (e.dead || e.state !== 'grasped') continue;
    sparks(e.group.position.clone().setY(e.group.position.y + 1.2), stance().blade, 10, 14, { dir: d, cone: 0.4, life: 0.3, grav: 0, stretch: 4 });
    // a live 'ragdoll' tumbles, bowls over anything it flies into (ai.js), and gets up where it lands. Held in a fan,
    // each body flies out along its own slot's line, so a volley spreads a little instead of stacking
    const rv = V3(-d.z, 0, d.x).multiplyScalar(b.slot * 0.12);
    e.state = 'ragdoll'; e.st = 0;
    e.vel.copy(d).add(rv).normalize().multiplyScalar(g.throwSpeed); if (d.y > -0.2) e.vel.y = Math.max(e.vel.y, 3);   // (hurled down from above, it's driven into the deck)
    damageEnemy(e, g.throwDmg * (stance().powerDmg || 1) * forcePower(), null, 0);   // the wrench of the throw itself (no launch: we set it)
    if (!e.dead){ e.state = 'ragdoll'; }
    floater(e.group.position, 'HURLED', '#7fd4ff');
  }
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
// lock the targets into the grasp. Each body gets a SLOT in a fan ahead of you (0 centre, ±1 to the sides).
const SLOTS = [0, -1, 1, -2, 2];
function lockOn(targets){
  const g = A();
  const cost = fcost(g.cost * (1 + g.multiCost * (targets.length - 1)));
  if (player.force < cost || player.cds.pull > 0) return false;
  player.force -= cost;
  const bodies = targets.map((e, i) => {
    e.state = 'grasped'; e.st = 0;
    e.vel.set(0, 2.5, 0);   // a little lift as the Force takes hold, so the rise into the hand reads as one motion
    e.graspSpin = Math.random() * 6;
    floater(e.group.position, 'GRASPED', '#7fd4ff');
    return { e, slot: SLOTS[i], hit: new Map() };
  });
  player.grasp = { bodies, t: 0, yank: false };
  castGesture('pull', 0.5);
  S.pull(); G.shake = Math.max(G.shake, 0.3);
  return true;
}

/* per frame: charge the hold, then drive the grasped bodies */
export function updateGrasp(dt){
  const c = player.graspCharge;
  if (c && !c.locked){
    if (G.mode !== 'play' || G.hero === 'mando'){ player.graspCharge = null; }
    else {
      c.t += dt;
      const g = A(), tgts = graspTargets();
      c.targets = tgts;
      player.castT = Math.max(player.castT, 0.12); player.castMax = 0.5; player.castKind = 'pull';   // the hand reaches out while you hold
      // the Force closing on them: motes rise off them and they falter, so the lock eases in instead of snapping
      for (const e of tgts){
        const p = e.group.position;
        if (Math.random() < dt * 18) motes(V3(p.x, p.y + 0.2, p.z), stance().blade, 1, 0.5, { h: 2.0 });
        e.stunT = Math.max(e.stunT || 0, 0.1);
      }
      if (c.t >= g.hold){
        if (tgts.length){ c.locked = true; lockOn(tgts); }   // the release won't fire a Pull now, whether or not the lock took
        else if (!c.warned){ c.warned = true; const t = toughInAim(); if (t) floater(t.group.position, 'TOO HEAVY', '#aa7788'); }
      }
    }
  }
  const gr = player.grasp;
  if (!gr) return;
  const g = A();
  // anything else that took a body off us (killed, knocked loose, a level change) lets that one go; none left ends it
  gr.bodies = gr.bodies.filter(b => !b.e.dead && b.e.state === 'grasped' && enemies.includes(b.e));
  if (!gr.bodies.length || G.mode !== 'play'){ endGrasp(); return; }
  gr.t += dt;
  // the hold costs Force to sustain (more for each extra body), and can't last forever
  player.force -= g.drain * (1 + g.multiCost * (gr.bodies.length - 1)) * (player.up.abilityCostMul || 1) * dt;
  if (player.force <= 0 || gr.t > g.maxT){ player.force = Math.max(0, player.force); graspDrop(); return; }
  player.castT = Math.max(player.castT, 0.2); player.castMax = 0.5; player.castKind = 'pull';
  const pp = playerPos(), f = fwd(), rx = -f.z, rz = f.x;
  // ease the spring in over the first moment of the hold, so the rise into the hand is smooth rather than a yank
  const ease = clamp(0.35 + gr.t * 4, 0, 1);
  let yankDone = gr.yank && (gr.yankT += dt) > 0.45;
  for (const b of gr.bodies){
    const e = b.e, grp = e.group;
    // where the hand holds it: out along the aim (raised when you look up), fanned to the side by its slot, or, when
    // yanked, right onto the blade
    const dist = gr.yank ? 1.5 + Math.abs(b.slot) * 0.5 : g.dist - Math.abs(b.slot) * 0.4;
    const lift = gr.yank ? 0.25 : clamp(1.4 - (G.pitch - 0.1) * 3, 0.6, 3.6) + Math.abs(b.slot) * 0.35;
    const side = b.slot * (gr.yank ? 1.1 : 1.7);
    const tx = pp.x + f.x * dist + rx * side, ty = pp.y + lift, tz = pp.z + f.z * dist + rz * side;
    // a stiff spring with a lag, so whipping your aim around swings the body like a dead weight
    const k = (gr.yank ? 180 : 70) * ease, damp = 1.6 * Math.sqrt(k), h = Math.min(dt, 1 / 30);   // a touch under-damped: it swings past and settles
    e.vel.x += ((tx - grp.position.x) * k - e.vel.x * damp) * h;
    e.vel.y += ((ty - grp.position.y) * k - e.vel.y * damp) * h;
    e.vel.z += ((tz - grp.position.z) * k - e.vel.z * damp) * h;
    grp.position.addScaledVector(e.vel, dt);
    if (grp.position.y < 0) grp.position.y = 0;
    // limp: the body tips over and dangles, swaying against the way it's being dragged
    const hs = Math.hypot(e.vel.x, e.vel.z);
    e.graspSpin += dt * (1.2 + hs * 0.3);
    grp.rotation.x = clamp(-0.5 - e.vel.z * 0.05 + Math.sin(e.graspSpin) * 0.15, -1.4, 1.4);
    grp.rotation.z = clamp(e.vel.x * 0.06 + Math.cos(e.graspSpin * 0.8) * 0.2, -0.9, 0.9);
    if (hs > g.bumpSpeed) bowl(b, hs);
    if (gr.yank && Math.hypot(grp.position.x - tx, grp.position.z - tz) < 0.8 && b.slot === 0) yankDone = true;
  }
  // the yank arrives: the foes land reeling right in front of the blade and the cut goes in
  if (yankDone){
    endGrasp();
    for (const b of gr.bodies){
      const e = b.e, grp = e.group;
      grp.rotation.x = 0; grp.rotation.z = 0;
      grp.position.y = Math.max(0, pp.y);
      e.vel.set(0, 0, 0);
      damageEnemy(e, g.yankDmg * forcePower(), null, 0);
      if (!e.dead){ staggerEnemy(e, f.x, f.z, 'YANKED!'); }
    }
    player.swingLock = 0;
    if (player.holstered) forceStrike(); else tryAttack();   // holstered: the Force palm strike instead of the blade
  }
}
// DRAGGED INTO OTHERS — a body swung into a foe bowls it over; the tough ones brace and only stumble
function bowl(b, hs){
  const g = A(), e = b.e, grp = e.group;
  const dir = V3(e.vel.x, 0, e.vel.z).normalize();
  for (const o of enemies){
    if (o === e || o.dead || o.converted || o.state === 'ragdoll' || o.state === 'knockdown' || o.state === 'spawn' || o.state === 'grasped') continue;
    if ((b.hit.get(o) || -9) > G.gt - 0.8) continue;   // one knock per foe per swing
    if (grp.position.distanceTo(o.group.position) > 1.6 * (o.t.scale || 1)) continue;
    b.hit.set(o, G.gt);
    S.punch(o.group.position, 1);
    if (tough(o)){
      // a brute takes it on the chest: it rocks back a step, and the body you swung bounces off it
      o.group.position.addScaledVector(dir, 0.6);
      if (o.state !== 'windup' && o.state !== 'strike'){ o.state = 'recover'; o.st = 0.4; }
      floater(o.group.position, 'BRACED', '#aa7788');
      e.vel.multiplyScalar(-0.4);
      G.shake = Math.max(G.shake, 0.3);
    } else {
      damageEnemy(o, g.bumpDmg * forcePower(), dir, g.bumpKnock);   // knockPow over 16: a live knockdown (damage.js)
      floater(o.group.position, 'BOWLED', '#7fd4ff');
    }
  }
  if (shared.boss && shared.boss.hp > 0 && (b.hit.get(shared.boss) || -9) < G.gt - 0.8 && grp.position.distanceTo(shared.boss.group.position) < 2.2){
    b.hit.set(shared.boss, G.gt); if (shared.boss.state === 'chase') bossStagger(); e.vel.multiplyScalar(-0.4);
  }
}
// level reset / death: let go without ceremony
export function resetGrasp(){
  const gr = player.grasp;
  if (gr){ endGrasp(); for (const { e } of gr.bodies) if (!e.dead && e.state === 'grasped'){ e.state = 'knockdown'; e.st = 0.4; } }
  player.graspCharge = null;
}
