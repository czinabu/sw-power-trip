// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// updateEnemies(): per-frame enemy AI.

import { CFG } from '../data/config.js';
import { scene, camera } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP, dampToward } from '../utils.js';
import { burst } from '../fx/particles.js';
import { G, enemies, solids } from '../state.js';
import { MELEE_WINDUP_GAP } from '../data/mando.js';
import { playerPos } from '../player/helpers.js';
import { bomberExplode, updateAimLine, warbringerSlam, breakJetpack } from './specials.js';
import { damageEnemy, hostileTargetFor, easeWeaponHome, telegraphWindup, staggerEnemy } from './damage.js';
import { fireBolt } from './bolts.js';
import { damageBoss } from '../boss/boss.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { segBlockedBySolids, clampToArena, collideSolids } from '../world/collision.js';
import { hurtPlayer } from '../player/damage.js';
import { enemyDmgScale } from '../game/survival.js';
import { ENGAGE } from '../data/enemies.js';
import { updateDirector, usesToken, dropToken, rangedSlotFree, behindCamera } from './director.js';
import { updateNav, navSteer, navClass, navClearance } from './nav.js';
import { DUEL } from '../data/duel.js';
import { updateDuel, cleanupDuel, planAttack, quickStrike, windupPose, strikePose, maybeFeint, chainNext, updateSaberLock } from './duel.js';

const NAV_EVERY = 0.1;      // seconds between a foe's route checks (the field itself refreshes in nav.js)
const STUCK_AFTER = 0.5;    // window (s) over which a chasing foe must make headway, or it sidesteps to work itself free
const steer = { x: 0, z: 0 };

/* is there real cover between a melee foe and its target, tall enough that a swing can't reach over it? A solid the
   target is standing ON doesn't count (the high-ground rule in hurtPlayer handles that) */
function wallBetween(ax, az, b){
  const c = segBlockedBySolids(ax, az, b.x, b.z);
  if (!c || c.h < 1.3) return false;   // low walls you can still be struck over
  return b.y < c.h - 0.5;
}

const NO_REACT = { ragdoll: 1, knockdown: 1, getup: 1, fade: 1, spawn: 1, lock: 1 };   // states that own the whole body
export function updateEnemies(dt){
  const pp = playerPos();
  updateNav(dt, pp);    // refresh the flow field toward the player (nav.js)
  updateDirector(dt);   // hand out attack tokens before anyone decides to swing
  updateSaberLock(dt);  // a bind in progress (duel.js) runs before the foe it holds
  for (let i = enemies.length-1; i >= 0; i--){
    const e = enemies[i], g = e.group, t = e.t;
    e.st -= dt;
    if (e.hrA){ g.rotation.x -= e.hrA.x; g.rotation.z -= e.hrA.z; g.rotation.y -= e.hrA.y; e.hrA = null; }   // lift last frame's hit reaction off
    if (g.userData.eliteRing) g.userData.eliteRing.rotation.z += dt * 2.5;   // elite halo spins
    if (e.converted && !e.dead){
      e.convT -= dt;
      if (e.convT <= 0) damageEnemy(e, 9999, V3(0,0,1), 4);   // their service ends
    }
    if (e.flash > 0){
      e.flash -= dt;
      g.userData.bodyMat.emissive.setHex(0x66aaff);
      g.userData.bodyMat.emissiveIntensity = 2;
    } else if (e.state === 'stasis'){
      g.userData.bodyMat.emissive.setHex(0x2288ff);
      g.userData.bodyMat.emissiveIntensity = 0.9 + Math.sin(G.gt*10)*0.3;
    } else if (e.state !== 'windup') g.userData.bodyMat.emissiveIntensity = 0;
    if (e.hitCd > 0) e.hitCd -= dt;
    if (e.stunT > 0) e.stunT -= dt;
    if (e.aimLine && e.state !== 'windup') e.aimLine.visible = false;   // the marksman's beam only shows while charging

    // pick a target: the player, or — for mind-tricked units — their old allies
    let tgtPos = pp, tgtEnemy = null, tgtBoss = false;
    if (e.converted){
      const tt = hostileTargetFor(e);
      if (tt){ tgtPos = tt.pos; tgtEnemy = tt.enemy; tgtBoss = tt.boss; }
      else tgtPos = null;
    }
    let tx = 0, tz = 0, dist = 999;
    if (tgtPos){
      TMP.subVectors(tgtPos, g.position); TMP.y = 0;
      dist = TMP.length();
      if (dist > 0.001){ TMP.normalize(); tx = TMP.x; tz = TMP.z; }
    }

    switch (e.state){
      case 'spawn':
        g.position.y = Math.min(0, -e.st * 6);
        if (e.st <= 0){ g.position.y = 0; e.state = 'chase'; }
        break;
      case 'chase': {
        if (tgtPos) g.rotation.y = Math.atan2(tx, tz);
        if (e.stunT > 0) break;   // reeling from a saber hit — no step, no swing this beat
        if (e.dummy){             // TRAINING target: it stands and takes it, and walks back to its post when knocked off it
          const hx = e.home.x - g.position.x, hz = e.home.z - g.position.z, hd = Math.hypot(hx, hz);
          if (hd > 0.5){ g.position.x += hx / hd * e.spd * 0.7 * dt; g.position.z += hz / hd * e.spd * 0.7 * dt; g.rotation.y = Math.atan2(hx, hz); }
          break;
        }
        // DUELLING — a foe that just turned your blade answers at once, outside the turn queue (duel.js)
        if (e.counterQueued && tgtPos && !e.converted){
          e.counterQueued = false;
          if (dist < t.range + 1.2){ e.counterAt = G.gt; quickStrike(e, DUEL.counterWindup); break; }
        }
        // WARBRINGER mid-boss — periodically LEAPS and quakes the ground where you stand (dash/jump it)
        if (e.warbringer && !e.converted && dist > 4.5 && dist < 17 && (e.leapCd = (e.leapCd || 3) - dt) <= 0){
          e.state = 'leapwind'; e.st = 0.55;
          e.leapTarget = { x: pp.x, z: pp.z }; e.leapFrom = { x: g.position.x, z: g.position.z };
          spawnGroundShock(V3(pp.x, 0.1, pp.z), 0xff5a3a, 5, 0.55, 0.5);   // a warning ring marks the landing zone
          S.windup(g.position, true);
          break;
        }
        // PATHING — a grounded foe hunting the player checks its route a few times a second: straight in when the way
        // is open, otherwise along the flow field around cover and live hazards (nav.js). While it's routing, the
        // stalking ring, cover-hugging and local avoidance below stand aside so nothing pulls it back into the wall.
        const er = 0.7 * (t.scale || 1);
        let pathing = false, wx = tx, wz = tz;
        if (tgtPos && !t.fly && !e.converted){
          if ((e.navT = (e.navT || 0) - dt) <= 0){
            e.navT = NAV_EVERY * rand(0.8, 1.2);
            e.navDirect = navSteer(g.position.x, g.position.z, tgtPos.x, tgtPos.z, navClass(er), steer);
            e.navX = steer.x; e.navZ = steer.z;
          }
          if (!e.navDirect){ pathing = true; wx = e.navX; wz = e.navZ; }
        }
        let mx = wx, mz = wz;
        // separation from other enemies
        for (const o of enemies){
          if (o === e || o.dead) continue;
          const dx = g.position.x - o.group.position.x, dz = g.position.z - o.group.position.z;
          const d2 = dx*dx + dz*dz;
          if (d2 < 2.6 && d2 > 0.001){ const inv = 0.9/Math.sqrt(d2); mx += dx*inv; mz += dz*inv; }
        }
        // STALKING — a melee foe without an attack token holds a ring just outside its reach and circles,
        // so a crowd takes turns instead of piling into one wall of swings (see ENGAGE / director.js)
        const stalking = !!tgtPos && usesToken(e) && !e.token;
        let paceMul = 1;
        if (stalking && !pathing){
          const ring = t.range + ENGAGE.ringPad;
          if (e.circle === undefined) e.circle = Math.random() < 0.5 ? 1 : -1;
          if ((e.circleT = (e.circleT || 0) - dt) <= 0){ e.circle *= -1; e.circleT = rand(1.4, 3.2); }
          const radial = clamp((dist - ring) / 1.5, -1, 1);   // >0 too far: close in · <0 too close: give ground
          const sepX = mx - tx, sepZ = mz - tz;
          const side = 0.85 * (1 - Math.abs(radial) * 0.5);
          mx = tx*radial - tz*e.circle*side + sepX;
          mz = tz*radial + tx*e.circle*side + sepZ;
          if (dist < ring + 3) paceMul = ENGAGE.stalkSpeed;   // a wary prowl near the fight, a run to rejoin it
        }
        const keepR = t.sniper ? 12 : t.range * 0.7;                   // snipers hold a fixed standoff, not full 32u
        // COVER — ranged ground troops (not flyers, who stay airborne by design; not converted allies) check LOS to
        // their target each frame. No clear shot → steer toward the near side of whatever's in the way and hold
        // there (peek) instead of standing exposed in the open. ANTI-TURTLE: after 3s with no shot, give up hiding
        // and path around the cover for a clear shot, so they can't camp forever behind it.
        let exposed = true;
        if (t.ranged && !t.fly && !e.converted){
          exposed = !segBlockedBySolids(g.position.x, g.position.z, tgtPos.x, tgtPos.z);
          e.hideT = exposed ? 0 : (e.hideT || 0) + dt;
        }
        // out of firing range there's nothing to hide from yet: advance. Once a trooper gives up hiding it commits to
        // flanking for a few seconds instead of ducking back behind the first wall it passes
        if ((e.hideT || 0) > 3.0){ e.flankT = 4; e.hideT = 0; }
        if (e.flankT > 0) e.flankT -= dt;
        const forceExposed = e.flankT > 0 || (tgtPos && dist > t.range);
        if (t.ranged && !t.fly && !e.converted && !exposed && forceExposed){
          // ANTI-TURTLE: done hiding, and firing into the wall is pointless — work around to a clear shot instead
          mx = wx; mz = wz;
        } else if (t.ranged && !t.fly && !e.converted && !exposed){
          const cv = segBlockedBySolids(g.position.x, g.position.z, tgtPos.x, tgtPos.z);
          const cr = cv.box ? Math.hypot(cv.hx, cv.hz) : cv.r;
          const awayX = cv.x - tgtPos.x, awayZ = cv.z - tgtPos.z, awayL = Math.hypot(awayX, awayZ) || 1;
          const coverX = cv.x + (awayX/awayL)*(cr + 1.0), coverZ = cv.z + (awayZ/awayL)*(cr + 1.0);
          const toX = coverX - g.position.x, toZ = coverZ - g.position.z, toL = Math.hypot(toX, toZ) || 1;
          mx = toL > 0.6 ? toX/toL : 0; mz = toL > 0.6 ? toZ/toL : 0;
        } else if (t.ranged && dist < keepR){ mx = -tx; mz = -tz; }   // exposed (or flyer) & too close — keep distance
        else if (t.ranged && !t.fly && !e.converted && dist < t.range){
          // in firing range, waiting on a shot — SIDESTEP instead of standing still as a turret
          if (e.circle === undefined) e.circle = Math.random() < 0.5 ? 1 : -1;
          if ((e.circleT = (e.circleT || 0) - dt) <= 0){ e.circle *= -1; e.circleT = rand(1.0, 2.4); }
          mx = (mx - wx) + tx*0.2 - tz*e.circle*ENGAGE.strafe; mz = (mz - wz) + tz*0.2 + tx*e.circle*ENGAGE.strafe;
          paceMul = 0.6;
        }
        // OBSTACLE AVOIDANCE — arc around pillars & crates instead of grinding into them.
        // Steer around only the SINGLE most-threatening solid and LOCK the turn direction while we're
        // engaged with it (hysteresis). The old per-solid steering flip-flopped frame to frame, which
        // is what pinned foes against cover; committing to one side lets them flow around it.
        if (!pathing){
          let hx = mx, hz = mz; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
          let threat = null, threatStr = 0, threatPerp = 0, threatOd = 0, threatRad = 0;
          for (const c of solids){
            if (c.climbable) continue;   // shallow steps (the temple dais) are walked OVER, not steered around
            const ox = c.x - g.position.x, oz = c.z - g.position.z;
            const od = Math.hypot(ox, oz) || 1;
            const orad = (c.box ? Math.hypot(c.hx, c.hz) : c.r) + er + 0.5;
            const look = orad + 5;
            if (od > look) continue;
            const ahead = (ox/od)*hx + (oz/od)*hz;       // is the solid in front of us?
            if (ahead <= 0.15) continue;                 // beside/behind — not in the way
            const perp = -ox*hz + oz*hx;                 // signed lateral offset from our heading
            if (Math.abs(perp) > orad) continue;         // our path already clears it
            const str = (1 - od/look) * ahead;
            if (str > threatStr){ threatStr = str; threat = c; threatPerp = perp; threatOd = od; threatRad = orad; }
          }
          if (threat){
            // commit to a side: keep steering the same way until this obstacle is behind us
            if (e.avoid !== threat){ e.avoid = threat; e.avoidSide = threatPerp >= 0 ? 1 : -1; }
            const s = e.avoidSide, strength = threatStr * 4.5;
            mx += s * hz * strength; mz += s * -hx * strength;
            // head-on & close → BRAKE (don't ram) so the turn has room to bite
            if (Math.abs(threatPerp) < threatRad * 0.5 && threatOd < threatRad + 1.6){ mx -= hx * 0.7; mz -= hz * 0.7; }
          } else e.avoid = null;
        }
        // JET TROOPER ORBIT — strafe perpendicular to the player so it's a moving aerial threat, not a turret
        if (t.fly){
          if (e.orbit === undefined) e.orbit = Math.random() < 0.5 ? 1 : -1;
          if ((e.orbitT = (e.orbitT || 0) - dt) <= 0){ e.orbit *= -1; e.orbitT = rand(2.2, 4.0); }   // occasionally reverse
          const pl = Math.hypot(tx, tz) || 1;
          mx += (-tz/pl) * e.orbit * 0.85; mz += (tx/pl) * e.orbit * 0.85;
        }
        // UNSTICK — pinned for a beat (a corner, a crowd at a gap): sidestep toward the open side, then re-route
        if (e.unstickT > 0){
          e.unstickT -= dt;
          const hl = Math.hypot(mx, mz) || 1, ux = mx/hl, uz = mz/hl;
          mx = ux - uz * e.unstickSide * 1.4; mz = uz + ux * e.unstickSide * 1.4;
        }
        const ml = Math.hypot(mx, mz) || 1;
        const esp = e.rooted ? 0 : e.spd * paceMul * (G.mut === 'berserk' ? 1.3 : 1);   // BERSERK mutator: enemies surge in faster · a ROOTED training foe holds its spot
        g.position.x += (mx/ml) * esp * dt;
        g.position.z += (mz/ml) * esp * dt;
        // remember where this step started, to check after collision whether it went anywhere (out of the scrum only:
        // stalkers circling at the ring are meant to hold their ground)
        e.stepX = g.position.x - (mx/ml) * esp * dt; e.stepZ = g.position.z - (mz/ml) * esp * dt;
        e.stepWant = (!t.fly && dist > t.range + ENGAGE.ringPad + 1.5) ? esp * dt : 0;
        // (grounded y comes from the surface height set after collision — so foes can WALK UP the dais; flyers hover)
        if (dist < t.range && !stalking){
          if (t.bomber){ e.state = 'fuse'; e.st = t.fuse; sfx(880, 0.08, 'square', 0.05, 880); }   // light the fuse
          // COVER GATE: a hidden ranged ground trooper won't commit to a windup it can't land — it just keeps
          // peeking (cover-seeking movement above) until exposed or the anti-turtle valve kicks in.
          else if (t.ranged && !t.fly && !e.converted && !exposed){ /* no clear shot — keep peeking, or flank for one */ }
          // a melee foe on the far side of tall cover doesn't swing at the wall — it keeps routing around
          else if (!t.ranged && !e.converted && wallBetween(g.position.x, g.position.z, tgtPos)){ /* go around */ }
          // RANGED SLOTS: only a few troopers aim at once, so a firing line staggers its shots
          else if (t.ranged && !e.converted && !rangedSlotFree(t.sniper)){ /* hold — sidestep and wait */ }
          // MELEE WINDUP STAGGER: hostile (non-converted) melee foes share a cooldown so a crowd doesn't all coil &
          // swing at once — ranged/converted foes are unaffected (already standoff/ally-targeted, not a swarm problem).
          else if (t.ranged || e.converted || G.gt - (G.lastMeleeWindupT ?? -9) >= MELEE_WINDUP_GAP){
            // a swing coiled BEHIND the camera gets a longer tell, so off-screen hits stay fair
            e.wu = t.windup * (!t.ranged && !e.converted && behindCamera(g.position) ? ENGAGE.rearWindup : 1);
            e.state = 'windup'; e.st = e.wu; telegraphWindup(e);
            // a duellist picks its line, and whether this one is a feint, a held strike or the start of a string
            if (e.dp && !t.ranged && !e.converted) planAttack(e); else e.plan = null;
            if (!t.ranged && !e.converted) G.lastMeleeWindupT = G.gt;
          }
          // else: another melee foe just committed to a swing — hold in chase this frame and retry next frame
        }
        break;
      }
      case 'fuse': {
        // SABOTEUR — still rushing, but now armed: blink/whine faster as the fuse burns, then DETONATE.
        if (tgtPos) g.rotation.y = Math.atan2(tx, tz);
        const burn = 1 - Math.max(e.st, 0) / t.fuse;     // 0→1
        const fx = e.navDirect === false ? e.navX : tx, fz = e.navDirect === false ? e.navZ : tz;   // around cover, not into it
        g.position.x += fx * e.spd * 1.05 * dt; g.position.z += fz * e.spd * 1.05 * dt;   // lunges the last step in
        const blink = (Math.sin(G.gt * (10 + burn*40)) * 0.5 + 0.5);
        if (g.userData.bombCore){ g.userData.bombCore.scale.setScalar(1 + burn*0.8 + blink*0.4); g.userData.bombCore.material.color.setHex(blink > 0.5 ? 0xffffff : t.eye); }
        g.userData.bodyMat.emissive.setHex(0xff7a1a); g.userData.bodyMat.emissiveIntensity = burn * 1.8 * blink;
        if ((e.fuseBeep = (e.fuseBeep || 0) - dt) <= 0){ sfx(700 + burn*900, 0.05, 'square', 0.04, 700); e.fuseBeep = 0.22 - burn*0.14; }
        if (e.st <= 0 && !e.dead){ bomberExplode(e); e.hp = 0; damageEnemy(e, 9999, V3(tx,0,tz), 2); }   // consumed by its own blast
        break;
      }
      case 'windup': {
        g.rotation.y = Math.atan2(tx, tz);
        const heavy = !!t.heavy;
        g.userData.bodyMat.emissive.setHex(e.converted ? 0x33cc55 : (e.plan && e.plan.side === 'T') ? 0xfff0e0 : 0xff2a18);
        // (a held strike's extra beat sits at the apex: the coil completes over the base wind-up, then waits)
        const wk = e.plan ? clamp((e.wu - Math.max(e.st,0)) / (e.wuBase || e.wu), 0, 1) : 1 - Math.max(e.st,0)/(e.wu || t.windup);
        if (e.plan && maybeFeint(e, wk)) break;   // a FEINT: it snaps to the other side and comes in fast
        // anticipation: COIL hard and fast, then hold at the apex (a readable pause before the blow)
        const coil = Math.pow(wk, 0.5);
        g.userData.bodyMat.emissiveIntensity = (0.4 + coil * coil * 2.4) + Math.sin(G.gt*30)*0.25*coil;   // pulsing charge
        // the whole body COILS away from the strike — leans back & loads down onto the rear foot
        g.rotation.x = -coil * (heavy ? 0.55 : 0.4);
        // (vertical position is owned by the surface-height step after collision — keep the coil/lean tell only)
        // eyes flare wide as the strike charges
        if (g.userData.eye){ const s = 1 + coil*(heavy?1.4:0.9); g.userData.eye.scale.set(g.userData.eyeBase.x*s, g.userData.eyeBase.y*(1+coil*1.6), g.userData.eyeBase.z); }
        // the weapon REARS BACK & HIGH — a huge, unmistakable tell (a duellist's shows the line it will come in on)
        if (e.plan) windupPose(e, coil);
        else if (g.userData.staff){
          g.userData.staff.rotation.z = 0.5 - coil * 2.9;
          g.userData.staff.rotation.x = 0.3 + coil * 0.9;
        } else if (g.userData.weaponArm){
          g.userData.weaponArm.rotation.x = -0.35 - coil * (heavy ? 2.7 : 2.1);   // brute hauls the maul way overhead
          g.userData.weaponArm.rotation.z = coil * (heavy ? 0.9 : 0.6);
        }
        // charging embers stream off the weapon near the apex
        if (coil > 0.6 && Math.random() < (heavy ? 0.5 : 0.32))
          burst(V3(g.position.x + tx*0.3, g.position.y + (heavy?3.0:2.3), g.position.z + tz*0.3), heavy ? 0xff5522 : t.eye, 1, 3, 4, 0.7);
        // MARKSMAN — paint a laser sight on the player that brightens to white as the shot charges (the dodge tell)
        if (t.sniper && tgtPos)
          updateAimLine(e, V3(g.position.x, g.position.y+1.4, g.position.z), V3(tgtPos.x, tgtPos.y+1.4, tgtPos.z), wk);
        if (e.st <= 0){
          if (t.ranged){
            if (tgtPos){
              // aim at the target's TORSO including height — so a foe on a ledge gets shot AT, and bolts
              // arc up to reach you (rather than skimming the ground and hitting you on top by accident)
              const muzzle = V3(g.position.x, g.position.y+1.5, g.position.z);
              const aimDir = V3(tgtPos.x, tgtPos.y + 1.4, tgtPos.z).sub(muzzle).normalize();
              fireBolt(muzzle, aimDir, t.boltSpeed * (G.mut === 'marksmen' ? 1.4 : 1), (e.converted ? t.dmg * CFG.convertDmgMult : t.dmg) * enemyDmgScale(), e.converted);
            }
            if (!e.dead){ e.state = 'recover'; e.st = t.recover; }
            g.userData.bodyMat.emissiveIntensity = 0;
          } else {
            // melee: commit to a visible swing the player can time a parry against
            e.state = 'strike'; e.st = t.swing || 0.16; e.struck = false;
            S.whoosh(g.position, heavy);   // the whoosh of the swing starting
          }
        }
        break;
      }
      case 'strike': {
        g.rotation.y = Math.atan2(tx, tz);
        const heavy = !!t.heavy;
        const sw = t.swing || 0.16;
        const k = clamp(1 - Math.max(e.st,0)/sw, 0, 1);   // 0→1 through the chop
        const chop = k*k;   // the down-swing ACCELERATES — explosive release
        g.userData.bodyMat.emissive.setHex(e.converted ? 0x33cc55 : 0xff6633);
        g.userData.bodyMat.emissiveIntensity = (1 - k) * 1.6;
        // body whips from the coiled lean-back through to a committed forward pitch
        g.rotation.x = -0.4*(1-chop) + (heavy ? 0.32 : 0.22)*chop;
        if (g.userData.eye) g.userData.eye.scale.copy(g.userData.eyeBase);
        if (e.plan) strikePose(e, chop);
        else if (g.userData.staff){
          g.userData.staff.rotation.z = -2.4 + chop * 3.4;   // whip the staff down across the body
          g.userData.staff.rotation.x = 0.9;
        } else if (g.userData.weaponArm){
          g.userData.weaponArm.rotation.x = (-0.35 - (heavy?2.7:2.1)) + chop * (heavy ? 4.0 : 3.4);   // chop forward & down, fast
          g.userData.weaponArm.rotation.z = (1 - chop) * (heavy ? 0.9 : 0.6);
        }
        // the blow lands at the apex of the swing — parry by clicking RMB right here
        if (!e.struck && k >= 0.5){
          e.struck = true;
          const thrust = !!(e.plan && e.plan.side === 'T');
          // REACH — the blow lands only if the weapon really gets there: the lunge closes in (never into the body), then
          // the target has to be inside the weapon's reach. Step back out of a slow wind-up and it whiffs.
          const lunge = Math.min(thrust ? 1.4 : heavy ? 0.9 : 0.5, Math.max(0, dist - 1.2));
          g.position.x += tx*lunge; g.position.z += tz*lunge;   // lunge into the strike
          if (dist - lunge <= t.range * ENGAGE.reach + (thrust ? ENGAGE.thrustReach : 0)){
            if (heavy){ G.shake = Math.max(G.shake, 0.3); burst(V3(g.position.x+tx, 0.3, g.position.z+tz), 0xbbbbbb, 6, 6, 3); }
            if (e.converted){
              if (tgtEnemy) damageEnemy(tgtEnemy, t.dmg * CFG.convertDmgMult, V3(tx,0,tz), 10);
              else if (tgtBoss) damageBoss(t.dmg * CFG.convertDmgMult);
            } else {
              // a THRUST drives through a held guard: parry it or get out of the way
              const res = hurtPlayer(t.dmg * enemyDmgScale() * (thrust ? DUEL.thrustDmg : 1), g.position, false, true, false, thrust ? { unblockable: true } : null);   // melee — blocked by high ground
              if (res === 'parried'){
                // perfectly parried — the weapon is knocked wide and the foe STUMBLES, wide open
                staggerEnemy(e, -tx, -tz);
                break;
              } else if (res === 'hit'){
                burst(V3(pp.x, 1.5, pp.z), 0xff5533, 6, 5, 3);
              }
            }
          }
        }
        if (e.st <= 0 && e.state === 'strike'){
          if (chainNext(e)) break;   // a duellist's STRING: the next cut winds up straight out of this one
          if (!e.dead){ e.state = 'recover'; e.st = t.recover; }
          if (e.token) dropToken(e, true);   // swung — step back into the ring and let the next foe in
          g.userData.bodyMat.emissiveIntensity = 0;
        }
        break;
      }
      case 'recover':
        if (!e.dp || dist >= DUEL.guardRange) easeWeaponHome(g, dt);   // (a duellist settles into its guard instead: duel.js)
        g.rotation.x = dampToward(g.rotation.x, 0, dt, 10);
        if (g.userData.eye) g.userData.eye.scale.copy(g.userData.eyeBase);
        if (e.st <= 0){ e.state = 'chase'; g.rotation.x = 0; }
        break;
      case 'leapwind': {   // WARBRINGER — coil down hard, weapon hauled overhead, before the pounce
        g.rotation.y = Math.atan2(tx, tz);
        const k = 1 - Math.max(e.st, 0)/0.55;
        g.userData.bodyMat.emissive.setHex(0xff3a1a); g.userData.bodyMat.emissiveIntensity = k*2.2;
        g.rotation.x = -0.4*k;
        if (g.userData.weaponArm){ g.userData.weaponArm.rotation.x = -0.35 - k*2.6; g.userData.weaponArm.rotation.z = k*0.6; }
        if (k > 0.5 && Math.random() < 0.4) burst(V3(g.position.x, g.position.y+3.2, g.position.z), 0xff5a3a, 1, 4, 4, 0.7);
        if (e.st <= 0){ e.state = 'leap'; e.st = 0.5; sfx(120, 0.2, 'square', 0.08, 200); }
        break;
      }
      case 'leap': {   // WARBRINGER — a tall arc onto the marked landing spot, then a quaking SLAM
        const k = clamp(1 - Math.max(e.st, 0)/0.5, 0, 1);
        g.position.x = e.leapFrom.x + (e.leapTarget.x - e.leapFrom.x) * k;
        g.position.z = e.leapFrom.z + (e.leapTarget.z - e.leapFrom.z) * k;
        g.position.y = Math.sin(k * Math.PI) * 4.8;
        g.rotation.x = 0.25 * Math.sin(k * Math.PI);
        if (g.userData.weaponArm) g.userData.weaponArm.rotation.x = -2.9 + k*3.4;   // chop the maul down through the arc
        if (k >= 1 && e.state === 'leap'){
          g.position.y = 0; g.rotation.x = 0;
          warbringerSlam(e, g.position.clone());
          e.state = 'recover'; e.st = 0.6; e.leapCd = rand(4.5, 7);
          easeWeaponHome(g, 0.5);
        }
        break;
      }
      case 'stagger': {
        // a parried foe reels — leans back, weapon flung up, fully exposed
        g.userData.bodyMat.emissive.setHex(0xffcc44);
        g.userData.bodyMat.emissiveIntensity = Math.max(0, e.st) * 0.9;
        if (g.userData.weaponArm) g.userData.weaponArm.rotation.x = dampToward(g.userData.weaponArm.rotation.x, 0.9, dt, 9);
        if (g.userData.staff){ g.userData.staff.rotation.z = dampToward(g.userData.staff.rotation.z, 1.7, dt, 9); }
        g.rotation.x = -0.34 * Math.min(1, Math.max(e.st,0) * 2.2);   // recoil back, then recover upright
        if (e.stumble > 0){ e.stumble -= dt; g.position.x += tx * -3.4 * dt; g.position.z += tz * -3.4 * dt; }
        if (e.st <= 0){ e.state = 'recover'; e.st = 0.4; g.rotation.x = 0; g.userData.bodyMat.emissiveIntensity = 0; }
        break;
      }
      case 'lock':   // blade to blade with the hero: duel.js drives the bind
        break;
      case 'stasis':
        if (e.st <= 0){
          e.state = 'chase';
          g.rotation.x = 0; g.rotation.z = 0;
          if (!e.dead) g.position.y = 0;
          g.userData.bodyMat.emissiveIntensity = 0;
        }
        break;
      case 'ragdoll': {
        e.vel.y -= 22 * dt;
        g.position.addScaledVector(e.vel, dt);
        if (e.crumple){
          // CRUMPLE — a foe dropped by a fist or a knee buckles and falls onto its back where it stood
          g.rotation.x = dampToward(g.rotation.x, -1.5, dt, 5); g.rotation.z = dampToward(g.rotation.z, 0, dt, 8);
          if (g.position.y <= 0){
            g.position.y = 0; e.vel.y = 0; e.vel.x *= Math.max(0, 1 - dt * 8); e.vel.z *= Math.max(0, 1 - dt * 8);
            if (g.rotation.x < -1.4){ e.vel.set(0,0,0); e.state = 'fade'; e.st = 0.8; }
          }
          break;
        }
        g.rotation.x += dt * 7; g.rotation.z += dt * 5;
        if (g.position.y < 0){
          g.position.y = 0;
          if (Math.abs(e.vel.y) > 3){ e.vel.y *= -0.35; e.vel.x *= 0.6; e.vel.z *= 0.6; burst(g.position, 0x888888, 3, 3, 2); }
          else {
            e.vel.set(0,0,0);
            if (e.dead){ e.state = 'fade'; e.st = 0.8; }
            else { e.state = 'chase'; g.rotation.x = 0; g.rotation.z = 0; }
          }
        }
        // flying bodies hit other enemies
        if (e.vel.length() > 10){
          for (const o of enemies){
            if (o === e || o.dead || o.state === 'ragdoll') continue;
            if (g.position.distanceTo(o.group.position) < 1.6){
              damageEnemy(o, 25, e.vel.clone().setY(0).normalize(), 18);
            }
          }
        }
        break;
      }
      // LIVE KNOCKDOWN — a CONTROLLED floor: the body tips onto its back (capped, never upside-down or on its
      // side), arcs to the ground, lies stunned (no moving/attacking), then GETS UP. Y is clamped so it can't
      // sink through the floor.
      case 'knockdown': {
        e.vel.y -= 22 * dt;
        g.position.addScaledVector(e.vel, dt);
        g.rotation.x = dampToward(g.rotation.x, -1.15, dt, 7);   // tip onto the back, capped
        g.rotation.z = dampToward(g.rotation.z, 0, dt, 9);       // never roll onto the side
        if (g.position.y <= 0){
          g.position.y = 0;
          if (e.t.fly) breakJetpack(e);   // a jet trooper slammed into the floor: on foot from here
          if (e.vel.y < -4){ e.vel.y *= -0.3; e.vel.x *= 0.55; e.vel.z *= 0.55; burst(g.position, 0x888888, 3, 3, 2); }   // one small bounce
          else { e.vel.set(0,0,0); if (e.st <= 0){ e.state = 'getup'; e.st = 0.5; } }
        }
        if (g.position.y < 0) g.position.y = 0;
        break;
      }
      case 'getup': {   // rise back to a clean upright stance, then resume the fight
        e.vel.set(0,0,0); g.position.y = 0;
        g.rotation.x = dampToward(g.rotation.x, 0, dt, 9);
        g.rotation.z = dampToward(g.rotation.z, 0, dt, 9);
        if (g.userData.bodyMat) g.userData.bodyMat.emissiveIntensity = 0;
        if (e.st <= 0){ e.state = 'chase'; g.rotation.set(0, g.rotation.y, 0); }
        break;
      }
      case 'fade':
        g.scale.multiplyScalar(Math.max(0.01, 1 - dt*2.2));
        g.position.y -= dt * 0.6;
        if (e.st <= 0){ cleanupDuel(e); if (e.aimLine){ scene.remove(e.aimLine); e.aimLine = null; } if (e.hpBar){ scene.remove(e.hpBar); e.hpBar = null; } scene.remove(g); enemies.splice(i,1); }
        break;
    }
    if (e.dp && !e.dead) updateDuel(e, dt, dist);   // guard, posture, the guard arc (duel.js)
    // ranged-hit recoil — a quick backward flinch that reads as "I felt that"
    if (e.flinch > 0){
      e.flinch -= dt;
      if (!e.dead && (e.state === 'chase' || e.state === 'recover')){
        const k = Math.max(0, e.flinch) / 0.15;
        // driven the way the hit pushes: back from the front, forward from behind, sideways from the flank
        g.userData.bodyMat.emissiveIntensity = Math.max(g.userData.bodyMat.emissiveIntensity, k);
      }
    }
    // HIT REACTION spring (damage.js hitReact): rock with the blow, overshoot a touch, settle; laid over the pose
    if (e.hr){
      const r = e.hr, free = !e.dead && !NO_REACT[e.state];
      if (!free){ r.x = r.z = r.y = r.vx = r.vz = r.vy = 0; }
      else if (r.x || r.z || r.y || r.vx || r.vz || r.vy){
        const K = 320, C = 16, h = Math.min(dt, 1 / 30);
        r.vx += (-K * r.x - C * r.vx) * h; r.x = clamp(r.x + r.vx * h, -0.6, 0.6);
        r.vz += (-K * r.z - C * r.vz) * h; r.z = clamp(r.z + r.vz * h, -0.5, 0.5);
        r.vy += (-K * r.y - C * r.vy) * h; r.y = clamp(r.y + r.vy * h, -0.5, 0.5);
        if (Math.abs(r.x) + Math.abs(r.z) + Math.abs(r.y) + Math.abs(r.vx) + Math.abs(r.vz) + Math.abs(r.vy) < 1e-3){ r.x = r.z = r.y = r.vx = r.vz = r.vy = 0; }
        g.rotation.x += r.x; g.rotation.z += r.z; g.rotation.y += r.y; e.hrA = { x: r.x, z: r.z, y: r.y };
      }
    }
    // JET TROOPER hover — drive altitude to ~1.5 above the player (so flying up never escapes it) with a gentle bob.
    // Death (ragdoll) and a knockdown are exempt, so a slain or floored flyer falls under gravity instead of the hover
    // holding it up against the knock (that fight left it skidding on its back across the arena, never shooting).
    if (e.t.fly && !e.dead && e.state !== 'ragdoll' && e.state !== 'knockdown' && e.state !== 'fade' && e.state !== 'spawn'){
      const flyH = clamp(playerPos().y + 1.5, 2.4, 9) + Math.sin(G.gt*2 + i) * 0.22;
      g.position.y = dampToward(g.position.y, flyH, dt, 4);
      if (g.userData.thrusters){ const fl = 0.7 + Math.abs(Math.sin(G.gt*18 + i)) * 0.5; for (const th of g.userData.thrusters) th.material.opacity = fl; }
    }
    // grounded, living foes can't walk through solid pillars/crates — they path around (skip while airborne-knocked /
    // flying). climb=true lets them MOUNT shallow steps (the temple dais) so they pursue you up it; the support
    // height is then applied so they STAND on the surface underfoot (flat floor = 0). Tall sheer crates still block.
    if (!e.dead && !e.t.fly && e.state !== 'ragdoll' && e.state !== 'knockdown' && e.state !== 'fade' && e.state !== 'spawn' && e.state !== 'leap'){
      const sup = collideSolids(g.position, 0.7 * (e.t.scale || 1), true);
      g.position.y = sup + Math.abs(Math.sin(G.gt*8 + i)) * 0.05;
    }
    // STUCK CHECK — over a short window, a chasing foe that covered under a third of the ground it tried to (pinned in
    // a corner, or jittering back and forth against one) picks the more open side, sidesteps there and re-routes
    if (e.stepWant > 0 && e.state === 'chase'){
      if (!(e.progT > 0)){ e.progX = e.stepX; e.progZ = e.stepZ; e.progWant = 0; e.progT = 0; }
      e.progT += dt; e.progWant += e.stepWant;
      if (e.progT >= STUCK_AFTER){
        const moved = Math.hypot(g.position.x - e.progX, g.position.z - e.progZ);
        if (moved < e.progWant * 0.3 && !(e.unstickT > 0)){
          const l = navClearance(g.position.x - tz*1.6, g.position.z + tx*1.6), r = navClearance(g.position.x + tz*1.6, g.position.z - tx*1.6);
          e.unstickSide = l >= r ? 1 : -1;   // the side of the line to the target with more room
          e.unstickT = 0.6; e.navT = 0;
        }
        e.progT = 0;
      }
    } else e.progT = 0;
    e.stepWant = 0;
    // MID-BOSS health bar — float it overhead, billboard to the camera, scale the fill left-anchored
    if (e.hpBar){
      e.hpBar.visible = !e.dead && e.state !== 'fade';
      if (e.hpBar.visible){
        e.hpBar.position.set(g.position.x, g.position.y + 2.7 * e.group.scale.x, g.position.z);
        e.hpBar.quaternion.copy(camera.quaternion);
        const frac = clamp(e.hp / (e.maxHp || e.hp), 0, 1);
        e.hpBarFill.scale.x = Math.max(0.001, frac);
        e.hpBarFill.position.x = -(1 - frac) * 1.13;
        e.hpBarFill.material.color.setHex(frac > 0.5 ? 0xff3b3b : frac > 0.22 ? 0xff8a2a : 0xffd24a);
      }
    }
    clampToArena(g.position, (e.state === 'ragdoll' || e.state === 'knockdown') ? e.vel : null, e);
    // SAFETY — a LIVING foe must never be stuck under the floor or pitched into a broken (side/upside-down) angle.
    if (!e.dead){
      if (g.position.y < 0) g.position.y = 0;
      if (e.state !== 'knockdown' && e.state !== 'getup' && e.state !== 'ragdoll'){
        if (g.rotation.x > 1.7 || g.rotation.x < -1.7) g.rotation.x = 0;   // not a pose any normal state uses
        if (g.rotation.z > 1.0 || g.rotation.z < -1.0) g.rotation.z = 0;
      }
    }
  }
}
