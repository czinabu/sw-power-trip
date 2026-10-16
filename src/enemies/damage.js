// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// damageEnemy(), flinch/stagger, targeting helpers, wind-up telegraphs.

import { S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP, dampToward } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, player } from '../state.js';
import { fwd, playerPos, stance, maxHp } from '../player/helpers.js';
import { volatileBlast } from './elites.js';
import { bomberExplode } from './specials.js';
import { FOCUS, addFocus } from '../player/jedi/focus.js';
import { spawnHitSpark, spawnGroundShock } from '../fx/vfx.js';
import { sparks } from '../fx/ink.js';
import { addStreak } from '../player/damage.js';
import { gainXp, killBonus } from '../game/progression.js';
import { ENGAGE } from '../data/enemies.js';
import { dropToken } from './director.js';

/* opts.launch === false: a blow with no rocket behind it (the Mandalorian's fists, knee and blade). It never floors or
   throws a live foe (the caller staggers or shoves it), and a foe it kills crumples where it stands instead of flying. */
export function damageEnemy(e, dmg, knockDir, knockPow, isFinisher, tick, opts){
  if (e.dead) return;
  if (e.state === 'stasis') dmg *= 1.5;   // frozen targets shatter harder
  if (e.state === 'stagger') dmg *= 1.5;  // a parried, stumbling foe is wide open
  // SENTINEL frontal deflector — chip damage from the front mostly bounces; FLANK it, or break the guard with a
  // finisher / Djem-So heavy / a RIPOSTE. The shield shatters once depleted, leaving it open & staggered.
  if (e.t.shield && !e.shieldBroken && knockDir && !tick && dmg > 0){
    const ang = e.group.rotation.y, efx = Math.sin(ang), efz = Math.cos(ang);
    const dpx = playerPos().x - e.group.position.x, dpz = playerPos().z - e.group.position.z;
    const dl = Math.hypot(dpx, dpz) || 1;
    if ((efx*dpx + efz*dpz)/dl > 0.3){   // attacker is in the shield's frontal arc
      const guardBreak = !!isFinisher || (G.hero !== 'mando' && G.stance === 'strong') || !!(player.swing && player.swing.riposte);
      e.shieldHp -= dmg * (guardBreak ? 2.4 : 1.0);
      const sp = V3(e.group.position.x + efx*0.55, 1.45, e.group.position.z + efz*0.55);
      spawnHitSpark(sp, e.t.eye, 0.8); S.shieldHit(sp);
      if (e.shieldHp <= 0){
        e.shieldBroken = true;
        if (e.group.userData.shield) e.group.userData.shield.visible = false;
        floater(e.group.position, 'GUARD BROKEN', '#ffd24a');
        burst(sp, e.t.eye, 16, 9, 6); G.shake = Math.max(G.shake, 0.35);
        staggerEnemy(e, -efx, -efz);     // shattering the guard staggers it wide open
        dmg *= guardBreak ? 0.7 : 0.35;  // the breaking blow still bleeds some through
      } else {
        dmg *= guardBreak ? 0.5 : 0.12;  // chip mostly deflects off the front
        if (!guardBreak) floater(e.group.position, 'BLOCKED', '#8fbfe0');
      }
    }
  }
  // EXECUTIONER boon — a hit that would leave a normal foe under 22% finishes it outright (not bosses/champions)
  if (player.boon && player.boon.exec && !tick && knockDir && !e.warbringer && !e.champion && e.maxHp && (e.hp - dmg) > 0 && (e.hp - dmg) < e.maxHp*0.22){
    dmg = e.hp; floater(V3(e.group.position.x, e.group.position.y+1.7, e.group.position.z), 'EXECUTE', '#ff7a7a');
  }
  e.hp -= dmg;
  e.flash = Math.max(e.flash, tick ? 0.06 : 0.16);
  const p = e.group.position;
  const cp = V3(p.x, p.y + 1.45, p.z);                       // contact point at the torso
  const col = (G.hero === 'mando') ? 0xffb84a : stance().blade;
  const power = clamp(dmg / 38, 0.45, 1.7);
  const meaty = !!knockDir && !tick;                         // saber/blaster/rocket land with weight; DoT ticks stay light
  if (tick){
    // FLAMETHROWER / damage-over-time: NO hitstop / sfx / floater spam — just embers + pooled numbers
    e.burn = (e.burn || 0) + dmg;
    if (e.burn >= 9){ floater(V3(p.x, p.y+1.6, p.z), Math.round(e.burn), '#ff9a3a'); e.burn = 0; }
    if (Math.random() < 0.5) burst(V3(p.x + rand(-0.3,0.3), p.y + rand(0.9,1.9), p.z + rand(-0.3,0.3)), Math.random()<0.5?0xff7a1a:0xffd24a, 1, 2, 3, 0.6);
  } else {
    burst(V3(p.x, p.y+1.4, p.z), 0x66ccff, 4, 5, 4);
    if (meaty){
      // a spray of sparks off the hit + a bright impact flash & ring — every connect reads as a real hit
      const kd = knockDir.clone().setY(0).normalize();
      if (e.hp > 0) hitReact(e, kd, 0.18 + power * 0.22, opts && opts.fold);   // the body rocks with the blow
      sparks(cp, 0xffffff, Math.round(3 + power*3), 9 + power*5, { dir: kd, cone: 0.8, life: 0.24 });
      sparks(V3(cp.x + kd.x*0.4, cp.y, cp.z + kd.z*0.4), col, Math.round(3 + power*3), 7 + power*5, { dir: kd, cone: 1, life: 0.3 });
      spawnHitSpark(cp, col, power);
      if (e.hp > 0){
        G.hitstop = Math.max(G.hitstop, 0.02 + power*0.028);   // a micro-freeze on impact — the core of "punch"
        G.shake   = Math.max(G.shake,   0.12 + power*0.13);
      }
    }
    floater(p, Math.round(dmg), e.hp <= 0 ? '#ffd24a' : '#bfe8ff');
    S.impact(cp, power);   // voiced by what landed it: saber burn, blaster pop, or a thump
  }
  if (e.hp <= 0){
    e.dead = true; e.state = 'ragdoll'; e.st = 0;
    if (e.t.bomber && !e._blew) bomberExplode(e);   // a SABOTEUR killed before its fuse still goes off — don't kill it point-blank
    const d = knockDir ? knockDir.clone().setY(0) : fwd();
    if (opts && opts.launch === false){   // folds up and drops: a step back with the blow, then onto its back
      e.crumple = true;
      e.vel.copy(d.multiplyScalar(Math.min(knockPow || 0, 8) * 0.35));
      e.vel.y = 1.5;
    } else {
      e.vel.copy(d.multiplyScalar((knockPow||14) * (e.t.heavy ? 0.5 : 1)));
      e.vel.y = rand(5, 9) * (e.t.heavy ? 0.6 : 1);
    }
    G.hitstop = Math.max(G.hitstop, isFinisher ? 0.1 : 0.05);
    G.shake = Math.max(G.shake, 0.38);
    addStreak(e.t.score);
    if (!e.converted){ gainXp(e.t.score * 4 * killBonus() * (e.elite ? 1.6 : 1)); if (G.stats) G.stats.kills++; }   // small per-kill bounty, ×1–3 on a kill streak, elites pay more
    if (e.elite === 'volatile' && !e.converted){ if (e.group.userData.eliteRing) e.group.userData.eliteRing.visible = false; volatileBlast(p.clone(), e); }
    else if (G.mut === 'volatile' && !e.converted) volatileBlast(p.clone(), e);   // VOLATILE mutator: every corpse erupts
    S.kill(cp, !!e.t.heavy);
    if (player.up.lifesteal) player.hp = clamp(player.hp + player.up.lifesteal, 0, maxHp());   // skill: lifesteal
    if (player.boon){
      if (player.boon.blood) player.hp = clamp(player.hp + maxHp()*0.04, 0, maxHp());                          // BLOODTHIRST boon
      if (player.boon.momentum){ player.momentumStacks = Math.min(5, (player.momentumStacks||0)+1); player.momentumT = 5; }  // MOMENTUM boon
    }
    addFocus(FOCUS.gainKill);   // FORCE FOCUS — a felled foe feeds the flow
    burst(V3(p.x, p.y+1.2, p.z), 0xffaa44, 12, 8, 5);
    spawnHitSpark(cp, 0xffcc55, power*1.3);
    if (!e.converted && !shared.boss){
      let hostiles = 0;
      for (const o of enemies) if (!o.dead && !o.converted) hostiles++;
      if (hostiles === 0 && G.spawnQueue.length === 0){ G.slowmo = 0.3; G.slowmoT = 0.5; }  // wave-clear kill cam
    }
  } else if (opts && opts.launch === false){
    // no launch: the caller decides how it reels (a flinch, a shove, a stagger)
  } else if (knockDir && knockPow > 16 && !e.t.heavy && !e.t.fly){
    // a LIVE knockdown — controlled tip-back, stops acting, then gets up (NOT the free-spin death ragdoll).
    // FLYERS are exempt (they stay aloft, just flinch) — a non-lethal hit shouldn't drop them to the floor.
    e.state = 'knockdown'; e.st = 0.7;
    e.vel.copy(knockDir.clone().multiplyScalar(knockPow));
    e.vel.y = rand(4, 7);
  } else if (knockDir && e.t.heavy){
    if (knockPow > 26){   // only truly heavy blows (Strong stance, Slam, Repulse) floor a brute
      e.state = 'knockdown'; e.st = 0.95;   // brutes stay down a touch longer
      e.vel.copy(knockDir.clone().multiplyScalar(knockPow * 0.5));
      e.vel.y = 4.5;
    } else {
      e.group.position.addScaledVector(knockDir, 0.8);  // otherwise brutes only stagger
      // ...and a light blow does NOT break a brute's wind-up or swing: parry it, floor it, or get clear
      if (e.state !== 'windup' && e.state !== 'strike'){ e.state = 'recover'; e.st = 0.5; }
    }
  }
  // ECHO STRIKE boon — the blow rings out a second time for 40% (only if the first didn't kill; guarded vs recursion)
  if (player.boon && player.boon.echo && !tick && knockDir && !e.dead && !e._echoing && dmg > 0){
    e._echoing = true; damageEnemy(e, dmg*0.4, knockDir, 0, false, false); e._echoing = false;
  }
}

/* HIT REACTION — the body takes the blow: it rocks away from where the hit came from (back from the front, sideways from
   the flank, twisting off a side hit) and springs back with a little overshoot. Laid ON TOP of whatever the foe is
   doing (ai.js runs the spring), so a swinging foe visibly eats the hit too. fold > 0 doubles it over instead (a knee
   to the gut). amt ~0.3 a jab, ~0.6 a heavy blow. */
export function hitReact(e, dir, amt, fold = 0){
  if (!e || e.dead || !dir) return;
  const g = e.group, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
  const l = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / l, dz = dir.z / l;
  const hf = dx*fx + dz*fz, hr = dx*(-fz) + dz*fx;
  const k = amt * (e.t.heavy ? 0.4 : 1) * 24;
  const r = e.hr || (e.hr = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0 });
  r.vx += (fold ? fold : hf) * k; r.vz += hr * k * 0.9; r.vy += -hr * k * 0.5;
}
// a ranged hit makes a foe physically REACT — recoil back, flinch, maybe drop a wind-up
export function flinchEnemy(e, dir, push){
  if (!e || e.dead || e.converted) return;
  const heavy = !!e.t.heavy;
  e.flinch = Math.max(e.flinch || 0, heavy ? 0.08 : 0.15);
  const d = dir.clone().setY(0); if (d.lengthSq() > 0.0001){ d.normalize(); e.flinchDir = d; e.group.position.addScaledVector(d, push * (heavy ? 0.22 : 1)); }
  // hammering a lightly-armored foe mid-wind-up can stagger the swing right out of them
  if (!heavy && (e.state === 'windup' || e.state === 'strike') && Math.random() < 0.5){ e.state = 'recover'; e.st = 0.3; easeWeaponHome(e.group, 0.016); }
}
// a clean saber hit knocks a light foe out of its wind-up, so striking first wins the exchange instead of trading.
// POISE: each foe yields at most once per ENGAGE.poise seconds, so poking buys time but can't stun-lock a crowd.
// Brutes never flinch; staff duelists and an intact sentinel guard only yield to a heavy blow (finisher, Djem So,
// darksaber) since they are built to be parried or flanked. A foe that isn't swinging just loses a beat (hit-stun).
export function interruptEnemy(e, dir, heavyBlow){
  if (e.dead || e.converted || e.t.heavy || e.t.bomber || e.warbringer) return false;
  // not swinging yet: a short HIT-STUN instead, so a connecting blade checks a light foe's advance for a beat
  if (e.state === 'chase' && !e.t.fly){
    e.stunT = ENGAGE.hitStun; e.flinch = Math.max(e.flinch || 0, 0.15);
    if (dir){ const d = dir.clone().setY(0); if (d.lengthSq() > 0.0001) e.flinchDir = d.normalize(); }
    return false;
  }
  if (!(e.state === 'windup' || (e.state === 'strike' && !e.struck))) return false;
  if ((e.t.staff || (e.dp && e.dp.lock) || (e.t.shield && !e.shieldBroken)) && !heavyBlow) return false;
  if (G.gt < (e.poiseT || 0)) return false;
  e.poiseT = G.gt + ENGAGE.poise;
  e.state = 'recover'; e.st = 0.5; e.flinch = 0.15;
  e.group.userData.bodyMat.emissiveIntensity = 0;
  if (e.aimLine) e.aimLine.visible = false;
  easeWeaponHome(e.group, 0.016);
  if (dir){ const d = dir.clone().setY(0); if (d.lengthSq() > 0.0001){ e.flinchDir = d.normalize(); e.group.position.addScaledVector(d, 0.35); } }
  if (e.token) dropToken(e, true);
  floater(V3(e.group.position.x, e.group.position.y + 1.2, e.group.position.z), 'INTERRUPT', '#9fe6ff');
  S.clash(V3(e.group.position.x, 1.5, e.group.position.z), false);
  return true;
}

export function nearestEnemyInCone(range, cosLimit, rear){
  let best = null, bestD = range;
  const f = fwd(), pp = playerPos();
  if (rear) f.negate();   // scan the hemisphere BEHIND the player instead
  const consider = (pos, obj) => {
    TMP.subVectors(pos, pp); TMP.y = 0;
    const d = TMP.length();
    if (d > bestD || d < 0.01) return;
    TMP.normalize();
    if (TMP.dot(f) < cosLimit) return;
    bestD = d; best = obj;
  };
  for (const e of enemies) if (!e.dead && !e.converted && e.state !== 'spawn') consider(e.group.position, e);
  if (shared.boss && shared.boss.hp > 0) consider(shared.boss.group.position, shared.boss);
  return best;
}

export function hostileTargetFor(e){
  // converted units pick the nearest non-converted living enemy, else the boss
  let best = null, bd = 1e9;
  for (const o of enemies){
    if (o === e || o.dead || o.converted) continue;
    const d = o.group.position.distanceTo(e.group.position);
    if (d < bd){ bd = d; best = o; }
  }
  if (best) return { pos: best.group.position, enemy: best, boss: false };
  if (shared.boss && shared.boss.hp > 0) return { pos: shared.boss.group.position, enemy: null, boss: true };
  return null;
}

// ease a melee foe's weapon back to its ready carry between strikes
export function easeWeaponHome(g, dt){
  if (g.userData.staff){
    g.userData.staff.rotation.z = dampToward(g.userData.staff.rotation.z, 0.5, dt, 8);
    g.userData.staff.rotation.x = dampToward(g.userData.staff.rotation.x, 0.3, dt, 8);
  } else if (g.userData.weaponArm){
    g.userData.weaponArm.rotation.x = dampToward(g.userData.weaponArm.rotation.x, -0.35, dt, 8);
    g.userData.weaponArm.rotation.z = dampToward(g.userData.weaponArm.rotation.z, 0, dt, 8);
  }
}
// the instant a melee foe commits to a swing — a loud, visible tell so the player can ready a parry
export function telegraphWindup(e){
  if (e.t.ranged || e.converted) return;
  const g = e.group, heavy = !!e.t.heavy;
  const top = V3(g.position.x, heavy ? 3.0 : 2.2, g.position.z);
  burst(top, heavy ? 0xff5522 : e.t.eye, heavy ? 7 : 5, 4, 3, 0.8);
  // a warning ring flares at the foe's feet — reads even in a crowd
  spawnGroundShock(g.position, heavy ? 0xff5522 : e.t.eye, heavy ? 3.2 : 2.2, 0.4, heavy ? 0.6 : 0.45);
  S.windup(top, heavy);
}

// the Sith Lord telegraphs his combo — a roaring charge so the player can ready a parry
export function bossTelegraph(g, tx, tz){
  burst(V3(g.position.x + tx*0.5, 3.0, g.position.z + tz*0.5), 0xff2a40, 10, 5, 4, 0.9);
  spawnGroundShock(g.position, 0xff2a40, 4.2, 0.5, 0.65);
  S.roar(g.position);
}

// a parried foe stumbles: knocked off balance, weapon flung wide, open to a free hit
export function staggerEnemy(e, awayX, awayZ, label){
  const g = e.group;
  e.state = 'stagger';
  e.st = e.t.staff ? 1.5 : (e.t.heavy ? 1.25 : 1.3);   // brutes recover slower; staff foes longest
  e.stumble = 0.28;
  e.flash = 0.12;
  const cp = V3(g.position.x, 1.6, g.position.z);
  burst(cp, 0xffd24a, 14, 7, 4);
  spawnHitSpark(cp, 0xffd24a, 1.3);
  G.hitstop = Math.max(G.hitstop, 0.08);
  G.shake = Math.max(G.shake, 0.4);
  floater(g.position, label || (e.t.heavy ? 'STAGGERED!' : 'PARRIED!'), '#ffe27a');
  S.parry(cp);
}
