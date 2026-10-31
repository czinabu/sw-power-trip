// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Blaster bolts (enemy and player) in flight.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { stamDelay } from '../player/stamina.js';
import { abil } from '../data/mastery.js';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, clamp, TMP } from '../utils.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { shared, G, enemies, bolts, solids, player, isGunner } from '../state.js';
import { SQUAD } from '../data/allies.js';
import { HEADSHOT_MULT } from '../data/mando.js';
import { fwd, playerPos, stance } from '../player/helpers.js';
import { damageEnemy, flinchEnemy, nearestEnemyInCone } from './damage.js';
import { markHit } from './marks.js';
import { damageBoss } from '../boss/boss.js';
import { FOCUS, addFocus } from '../player/jedi/focus.js';
import { spawnHitSpark, spawnParryFlash } from '../fx/vfx.js';
import { boltImpact, clashFlash } from '../fx/ink.js';
import { scorchSolid } from '../fx/scorch.js';
import { mandoWeapon, mandoShielding, boltDamage, hitMarker, beskarCatch } from '../player/mando/weapons.js';
import { BESKAR_PARRY } from '../data/mando.js';
import { hurtPlayer } from '../player/damage.js';
import { deflectAnim, anticipateDeflect } from '../player/jedi/combat.js';
import { deflectPlayerBolt } from './duel.js';
import { bladePointNear } from '../player/jedi/clash.js';
import { sweepHit, headPos } from './bodyshape.js';
import { tutEvent } from '../game/tutor-bus.js';
import { airGuardLost, airParryOk } from '../player/mobility.js';
import { masteryXp } from '../game/progression.js';
import { noteDefense } from '../game/readout.js';
import { allySweep, hurtAlly, isFodder } from '../allies/squad.js';
import { hooks } from '../net/run.js';

/* ============================================================
   PROJECTILES — blaster bolts & boss orbs
   ============================================================ */
/* A bolt is drawn like the films' blaster fire, inked: a white-hot core inside a saturated colour sheath, wrapped in a
   thin dark outline so it reads against bright skies too. b.mesh is the colour sheath, so everything that recolours a
   bolt (reflects, deflects) keeps working through b.mesh.material.color. */
const boltGeo = new THREE.CapsuleGeometry(0.075, 0.72, 3, 6);
const BOLT_R = 0.08;                               // a bolt's own thickness when it meets a body
const PREV = new THREE.Vector3(), HIT = new THREE.Vector3();
const boltCoreGeo = new THREE.CapsuleGeometry(0.034, 0.66, 3, 6);
const boltInkGeo = new THREE.CapsuleGeometry(0.1, 0.76, 3, 6);
const boltCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4), toneMapped: false });   // over 1.0 → blooms
const boltInkMat = new THREE.MeshBasicMaterial({ color: 0x07060a, side: THREE.BackSide, transparent: true, opacity: 0.85, depthWrite: false });
// src: who fired it (a foe, or the boss), so a deflect can send it back down the line (see redirect below)
export function fireBolt(pos, dir, speed, dmg, friendly, quiet, src){
  const m = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: friendly ? 0x66ccff : 0xff3322, toneMapped: false }));
  m.add(new THREE.Mesh(boltCoreGeo, boltCoreMat), new THREE.Mesh(boltInkGeo, boltInkMat));
  m.position.copy(pos);
  m.quaternion.setFromUnitVectors(V3(0,1,0), dir.clone().normalize());
  scene.add(m);
  const b = { mesh: m, dir: dir.clone().normalize(), speed, dmg, friendly, life: 4, src };
  bolts.push(b);
  if (!friendly && src && src.nid != null && hooks.bolt) hooks.bolt(b);   // co-op: the other browser sees it too
  if (!quiet) S.enemyShot(pos, dmg > 20);   // the player's own shots play their gun's sound instead
}
/* REDIRECT — where a bolt off the blade goes. A timed parry sends it straight back at whoever fired it; a deflect off
   a moving blade goes back down the same line, scattered by how much the form trains for blaster fire (STANCES
   deflectScatter: Shien, the Form V variant built for it, sends it home dead on, Ataru is built for the duel and sprays
   it). A shooter that is gone, or behind you, gives way to the nearest foe ahead; with nobody there it flies back the
   way it came. The boss is never auto-aimed at: his own fire simply goes back the way it came. */
function redirect(b, parried){
  const s = b.src, pp = playerPos(), f = fwd();
  let tgt = s && s !== shared.boss && !s.dead && !s.converted && enemies.includes(s) ? s : null;
  if (tgt){ TMP.subVectors(tgt.group.position, pp).setY(0); if (TMP.lengthSq() > 0.01 && TMP.normalize().dot(f) < -0.2) tgt = null; }
  if (!tgt && s !== shared.boss){ const n = nearestEnemyInCone(40, 0.3); if (n && n !== shared.boss) tgt = n; }
  if (tgt){
    const g = tgt.group.position;
    b.dir.set(g.x, g.y + 1.3 * (tgt.t.scale || 1), g.z).sub(b.mesh.position).normalize();
  } else b.dir.negate();
  const sc = parried ? 0 : (stance().deflectScatter ?? 0.05);
  if (sc){
    const a = (Math.random() * 2 - 1) * sc, c = Math.cos(a), sn = Math.sin(a), x = b.dir.x;
    b.dir.x = x * c - b.dir.z * sn; b.dir.z = x * sn + b.dir.z * c;
    b.dir.y += (Math.random() * 2 - 1) * sc * 0.3; b.dir.normalize();
  }
  b.mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), b.dir);
}
export function updateBolts(dt){
  const pp = playerPos();
  for (let i = bolts.length-1; i >= 0; i--){
    const b = bolts[i];
    b.life -= dt;
    PREV.copy(b.mesh.position);   // where it was last frame: friendly bolts sweep the whole step for bodies
    b.mesh.position.addScaledVector(b.dir, b.speed * dt);
    let kill = b.life <= 0;
    // COVER — a bolt (either side) that's crossed inside a real wall/pillar/crate is blocked there, same convention
    // as segBlockedBySolids (shallow climbable steps don't block). Makes cover matter for fire, not just movement.
    if (!kill){
      const bx = b.mesh.position.x, bz = b.mesh.position.z, by = b.mesh.position.y;
      for (const c of solids){
        if (c.climbable) continue;
        const hit = c.box
          ? (bx > c.x - c.hx && bx < c.x + c.hx && bz > c.z - c.hz && bz < c.z + c.hz)
          : (Math.hypot(bx - c.x, bz - c.z) < c.r);
        if (hit && by < c.h && by >= (c.y0 || 0)){   // (an overhead slab: a bolt flies on under it)
          kill = true;
          spawnHitSpark(V3(bx, by, bz), b.friendly ? 0x6fd0ff : 0xff5a3a, 0.8);
          S.boltImpact(V3(bx, by, bz));
          scorchSolid(c, V3(bx, by, bz));   // a burn on the cover it struck
          break;
        }
      }
      // a walled room (the sandbox rooms): a bolt stops on the wall it reaches, never flies on through it
      if (!kill && shared.arenaWalled){
        const wx = shared.arenaHalf + 0.6, wz = (shared.arenaHalfZ || shared.arenaHalf) + 0.6;
        if (Math.abs(bx) > wx || Math.abs(bz) > wz){
          kill = true;
          const ix = clamp(bx, -wx, wx), iz = clamp(bz, -wz, wz);
          spawnHitSpark(V3(ix, by, iz), b.friendly ? 0x6fd0ff : 0xff5a3a, 0.8);
          S.boltImpact(V3(ix, by, iz));
        }
      }
    }
    // a hostile bolt that meets one of the hero's squadmates on the way stops in it (allies/squad.js)
    if (!kill && !b.friendly){
      const ah = allySweep(PREV, b.mesh.position, BOLT_R);
      if (ah){
        b.mesh.position.lerpVectors(PREV, b.mesh.position, ah.t);
        hurtAlly(ah.ally, b.dmg, b.mesh.position); kill = true;
        boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
      }
    }
    if (!kill && !b.friendly){
      const d = b.mesh.position.distanceTo(V3(pp.x, b.mesh.position.y, pp.z));
      // VERTICAL proximity to your torso — a bolt sailing past the BASE of a ledge you're standing on
      // must NOT touch you up top (and you can't block/deflect one that isn't at your height).
      const dy = Math.abs(b.mesh.position.y - (pp.y + 1.4));
      const near = dy < 1.7;
      const facing = TMP.subVectors(b.mesh.position, pp).setY(0).lengthSq() > 0.001 && TMP.normalize().dot(fwd()) > 0.1;
      // DEFLECT requires either an active swing (the blade is moving) or a freshly-timed parry click.
      // Holding block only ABSORBS the bolt — it does not send it back.
      // MID-AIR in a fight the guard can't hold a bolt (Ataru keeps its timed parry): player/mobility.js
      const airOk = airParryOk();
      // SORESU's held guard sends bolts home too, over a wider front, walking or standing (STANCES.soresu guardDeflect)
      const gd = !isGunner() ? stance().guardDeflect : 0;
      const guardSend = !!gd && near && player.blockHeld && !airGuardLost() && player.stam > 0
        && TMP.subVectors(b.mesh.position, pp).setY(0).lengthSq() > 0.001 && TMP.normalize().dot(fwd()) > -gd;
      const deflecting = near && ((facing && (player.atkT > 0 || player.parryT > 0) && airOk) || guardSend);
      const parried = near && facing && player.parryT > 0 && airOk;
      // SINGLE-BLASTER GAUNTLET SHIELD — a held energy shield that REFLECTS frontal bolts back (not just absorbs).
      // Each deflect spends stamina; run dry and the shield can't hold a bolt (it bleeds through, soaked by the beskar).
      const shielding = near && facing && mandoShielding() && player.stam > 0;   // dropped while the blaster fires
      // BESKAR PARRY — a freshly-timed RMB tap (mando/weapons.js beskarPress): the bare vambrace RICOCHETS the bolt
      // straight back at its shooter, harder than the shield's deflect, free of stamina. Any gun, in the air too.
      const beskar = near && facing && G.hero === 'mando' && player.beskarT > 0;
      // bolt-ABSORB (no reflect) is the other defensive guard — Jedi (any stance) or the Mando DARKSABER. DUAL/DISRUPTOR
      // bracing is offensive-only and lets bolts straight through.
      const blocking = near && facing && player.blockHeld && !airGuardLost() && player.stam > 0 && (!isGunner() || player.weapon === 'darksaber');
      // a certain catch is about to land: let the blade start its flourish early (jedi/combat.js anticipateDeflect)
      if (!b.anticip && near && facing && d > 2.6 && d < 2.6 + b.speed * 0.14){ b.anticip = true; anticipateDeflect(b.mesh.position, (d - 2.5) / b.speed); }
      if (d < abil('barrier').radius && near && player.barrierT > 0){
        // FORCE BARRIER auto-deflects bolts from any angle back into the crowd — no aim, no timing
        b.friendly = true; b.speed *= 1.3; b.dmg = 20;
        const tgt = nearestEnemyInCone(40, -1);
        if (tgt && tgt !== shared.boss) b.dir.subVectors(tgt.group.position, b.mesh.position).setY(0).normalize();
        else b.dir.negate();
        b.mesh.material.color.setHex(0x6fd0ff);
        spawnHitSpark(b.mesh.position.clone(), 0x6fd0ff, 0.7);
        S.deflect(b.mesh.position);
      } else if (d < 2.6 && deflecting){
        deflectAnim(b.mesh.position);   // the blade moves to meet it (skipped mid-swing: the cut is already there)
        if (parried) player.parryT = 0;
        // the guard pays for the catch: Soresu's held guard a little, Makashi (no answer to blasters) dearly
        const dsm = stance().deflectStamMul || 0;
        if (!parried && (guardSend || dsm)){ player.stam = Math.max(0, player.stam - (guardSend ? 7 * (stance().blockStamMul || 1) : 0) - 3 * dsm); player.stamDelay = stamDelay(); }
        b.friendly = true; b.speed *= 1.4; b.dmg = parried ? 42 : 22 * (stance().deflectDmg || 1);   // (Shien sends its deflects home harder)
        // it leaves from the blade itself (it was caught a touch early, so the catch reads at the saber, not in the air)
        if (bladePointNear(b.mesh.position, HIT)) b.mesh.position.copy(HIT);
        redirect(b, parried);
        b.mesh.material.color.setHex(stance().blade);
        if (parried){
          player.force = clamp(player.force + 8 + player.up.parryForce + (stance().parryRefund || 0), 0, CFG.player.maxForce);
          G.hitstop = Math.max(G.hitstop, 0.05);
          G.shake = Math.max(G.shake, 0.15);
          spawnParryFlash(V3(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z), 0xffd24a);
          screenFlash('radial-gradient(ellipse at center, rgba(255,230,150,.1), transparent 40%)', 0.3, 0.12);
          S.parry(b.mesh.position); floater(pp, 'PARRY!', '#ffe27a'); if (G.stats) G.stats.parries++; noteDefense('parries', null, { src: b.src }); masteryXp('boltParry');
        } else { clashFlash(b.mesh.position.clone(), stance().blade, false); S.deflect(b.mesh.position); floater(pp, 'DEFLECT', '#7fd4ff'); if (G.stats) G.stats.deflects++; noteDefense('deflects', null, { src: b.src }); }
        tutEvent('deflect');
        addFocus(parried ? FOCUS.gainParry : FOCUS.gainDeflect);   // deflecting fire feeds the flow
      } else if (d < 2.5 && beskar){
        b.friendly = true; b.speed *= BESKAR_PARRY.speed; b.dmg = Math.max(BESKAR_PARRY.min, Math.round(b.dmg * BESKAR_PARRY.dmg));
        b.beskar = true; b.flinch = 1.2;   // a ricochet staggers whoever it hits
        redirect(b, true);   // home to the shooter (or the nearest foe ahead)
        b.mesh.material.color.setHex(0xffd08a);
        beskarCatch(b);
        S.parry(b.mesh.position); floater(pp, 'RICOCHET!', '#ffd08a');
        if (G.stats) G.stats.parries++; noteDefense('parries', null, { src: b.src }); masteryXp('boltParry');
        addFocus(FOCUS.gainParry);
      } else if (d < 2.5 && shielding){
        // GAUNTLET SHIELD — catch the bolt on the disc and HURL it back at the nearest threat. Costs stamina per catch.
        player.stam = Math.max(0, player.stam - 5 * player.up.blockStam);
        player.stamDelay = stamDelay();
        b.friendly = true; b.speed *= 1.35; b.dmg = Math.max(8, Math.round(b.dmg * 0.85));
        const tgt = nearestEnemyInCone(40, -1);
        if (tgt && tgt !== shared.boss) b.dir.subVectors(tgt.group.position, b.mesh.position).setY(0).normalize();
        else b.dir.negate();
        b.mesh.material.color.setHex(0x6fd0ff);
        player.shieldFlash = 0.22;   // the disc flares on the catch (drawn in updatePlayer)
        clashFlash(b.mesh.position.clone(), 0x6fd0ff, false);
        G.shake = Math.max(G.shake, 0.12); G.hitstop = Math.max(G.hitstop, 0.02);
        S.shieldHit(b.mesh.position); S.deflect(b.mesh.position); floater(pp, 'DEFLECT', '#7fd4ff'); if (G.stats) G.stats.deflects++; noteDefense('deflects', null, { src: b.src });
        tutEvent('shieldReflect');
      } else if (d < 2.2 && blocking){
        // absorbed on the guard — costs stamina, no reflection
        deflectAnim(b.mesh.position);
        player.stam = Math.max(0, player.stam - 7 * player.up.blockStam * (stance().blockStamMul || 1) * (stance().deflectStamMul || 1));
        player.stamDelay = stamDelay();
        spawnHitSpark(b.mesh.position.clone(), stance().blade, 0.8);
        G.shake = Math.max(G.shake, 0.12);
        S.block(b.mesh.position); floater(pp, 'BLOCK', '#9cc8e8'); noteDefense('blocks', null, { src: b.src });
        kill = true;
      } else if (d < 1.2 && dy < 1.2 && !(player.slideT > 0 && b.mesh.position.y > pp.y + 0.8)){   // a slide ducks under fire
        hurtPlayer(b.dmg, b.mesh.position, false, false, false, { src: b.src }); kill = true;
        boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
      }
      // a near miss tears past your ear
      if (!kill && !b.friendly && !b.whiz && d < 3.2 && near){ b.whiz = true; S.whiz(b.mesh.position); }
    } else if (!kill && b.friendly && !b.ghost){   // (a ghost is the partner's shot, only drawn here: their browser does the damage)
      // the bolt hits the FIRST body along its flight this frame, exactly where that body is (bodyshape.js): legs, arms
      // and shoulders count, the gap beside a foe doesn't, and only the head itself is a headshot
      let foe = null, hit = null;
      for (const e of enemies){
        if (e.dead || e.converted) continue;
        if (b.ally && !isFodder(e) && b.mark !== e) continue;   // a squadmate's fire leaves the duellists to you, unless you ordered it on one (data/allies.js)
        const h = sweepHit(e, PREV, b.mesh.position, BOLT_R);
        if (h && (!hit || h.t < hit.t)){ hit = h; foe = e; }
      }
      const bp = shared.boss && shared.boss.hp > 0 && !b.ally ? shared.boss.group.position : null;
      const bossT = bp ? segCylinder(PREV, b.mesh.position, bp, 1.6, bp.y, bp.y + 3.4) : -1;
      if (foe && !(bossT >= 0 && bossT < hit.t)){
        const e = foe;
        b.mesh.position.lerpVectors(PREV, b.mesh.position, hit.t);   // the impact shows where it struck
        if (b.ally){
          // a squadmate's bolt: plain damage, a small rock, nothing for the hero's streak or Focus (enemies/damage.js)
          damageEnemy(e, b.dmg, b.dir, 3, false, false, { ally: true }); kill = true;
          markHit(e.group, b.mesh.position, b.dir, 'scorch');   // the bolt leaves its scorch (enemies/scars.js)
          if (b.src && b.src.group && !e.dead){ e.avenge = b.src; e.avengeT = G.gt + SQUAD.avengeFor; e.allyCheck = 0; }   // the trooper it hit may turn on whoever shot it (allies/squad.js foeAllyTarget)
          boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
        } else if (!deflectPlayerBolt(e, b)){   // a saber duellist bats it straight back at you (duel.js)
          let dmg = boltDamage(b);   // range falloff
          const isHead = hit.head;
          if (isHead){
            dmg *= HEADSHOT_MULT;
            const hp = headPos(e, HIT);
            spawnHitSpark(V3(hp.x, hp.y + 0.1, hp.z), 0xffd24a, 1.5);
            floater(V3(hp.x, hp.y + 0.45, hp.z), 'HEADSHOT', '#ffd24a');
            if (b.playerShot) tutEvent('headshot');
            sfx(1900, 0.08, 'square', 0.05, 420); S.blastHit(b.mesh.position, 1.4); G.hitstop = Math.max(G.hitstop, 0.04); G.shake = Math.max(G.shake, 0.18);
          }
          damageEnemy(e, dmg, b.dir, 6); flinchEnemy(e, b.dir, b.flinch || 0.4); kill = true;   // bolts make foes recoil (a heavy gun's, or a ricochet, harder)
          markHit(e.group, b.mesh.position, b.dir, 'scorch', { heavy: dmg >= 30 });   // a scorch where it struck; a helmet cracks (enemies/scars.js)
          if (!isHead) boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
          if (b.playerShot){ if (G.stats) G.stats.shotsHit++; hitMarker(e.dead ? 'kill' : (isHead ? 'head' : 'hit')); }
        }
      } else if (bossT >= 0){
        b.mesh.position.lerpVectors(PREV, b.mesh.position, bossT);
        let dmg = boltDamage(b);   // range falloff
        const isHead = b.mesh.position.y >= bp.y + 2.4;
        if (isHead){ dmg *= 1.8; floater(V3(bp.x, 3.0, bp.z), 'HEADSHOT', '#ffd24a'); sfx(1900,0.08,'square',0.06,420); }
        damageBoss(dmg); kill = true;
        markHit(shared.boss.group, b.mesh.position, b.dir, 'scorch');
        boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
        if (b.playerShot){ if (G.stats) G.stats.shotsHit++; hitMarker(shared.boss.hp <= 0 ? 'kill' : (isHead ? 'head' : 'hit')); }
      }
    }
    if (b.bid && !b.bxd && (kill || b.friendly) && hooks.bx) hooks.bx(b);   // co-op: spent or turned here, so the other copy goes
    if (kill){ scene.remove(b.mesh); bolts.splice(i,1); }
  }
}
// where segment a→b first enters an upright cylinder (centre c, radius r, y0..y1): 0..1, or -1 if it doesn't
function segCylinder(a, b, c, r, y0, y1){
  const ax = a.x - c.x, az = a.z - c.z, dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
  const qa = dx * dx + dz * dz, qb = 2 * (ax * dx + az * dz), qc = ax * ax + az * az - r * r;
  let t0 = 0, t1 = 1;
  if (qa < 1e-9){ if (qc > 0) return -1; }
  else { const disc = qb * qb - 4 * qa * qc; if (disc < 0) return -1; const q = Math.sqrt(disc); t0 = Math.max(0, (-qb - q) / (2 * qa)); t1 = Math.min(1, (-qb + q) / (2 * qa)); }
  if (Math.abs(dy) < 1e-9){ if (a.y < y0 || a.y > y1) return -1; }
  else { let s0 = (y0 - a.y) / dy, s1 = (y1 - a.y) / dy; if (s0 > s1){ const k = s0; s0 = s1; s1 = k; } t0 = Math.max(t0, s0); t1 = Math.min(t1, s1); }
  return t0 <= t1 ? t0 : -1;
}
export function updateOrbs(dt){ /* orbs retired in favor of force lightning */ }
