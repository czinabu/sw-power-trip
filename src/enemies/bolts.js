// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Blaster bolts (enemy and player) in flight.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, clamp, TMP } from '../utils.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { shared, G, enemies, bolts, solids, player } from '../state.js';
import { HEADSHOT_MULT } from '../data/mando.js';
import { fwd, playerPos, stance } from '../player/helpers.js';
import { damageEnemy, flinchEnemy, nearestEnemyInCone } from './damage.js';
import { damageBoss } from '../boss/boss.js';
import { FOCUS, addFocus } from '../player/jedi/focus.js';
import { spawnHitSpark, spawnParryFlash } from '../fx/vfx.js';
import { boltImpact, clashFlash } from '../fx/ink.js';
import { mandoWeapon, boltDamage, hitMarker } from '../player/mando/weapons.js';
import { hurtPlayer } from '../player/damage.js';
import { deflectAnim } from '../player/jedi/combat.js';

/* ============================================================
   PROJECTILES — blaster bolts & boss orbs
   ============================================================ */
/* A bolt is drawn like the films' blaster fire, inked: a white-hot core inside a saturated colour sheath, wrapped in a
   thin dark outline so it reads against bright skies too. b.mesh is the colour sheath, so everything that recolours a
   bolt (reflects, deflects) keeps working through b.mesh.material.color. */
const boltGeo = new THREE.CapsuleGeometry(0.075, 0.72, 3, 6);
const boltCoreGeo = new THREE.CapsuleGeometry(0.034, 0.66, 3, 6);
const boltInkGeo = new THREE.CapsuleGeometry(0.1, 0.76, 3, 6);
const boltCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4), toneMapped: false });   // over 1.0 → blooms
const boltInkMat = new THREE.MeshBasicMaterial({ color: 0x07060a, side: THREE.BackSide, transparent: true, opacity: 0.85, depthWrite: false });
export function fireBolt(pos, dir, speed, dmg, friendly){
  const m = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: friendly ? 0x66ccff : 0xff3322, toneMapped: false }));
  m.add(new THREE.Mesh(boltCoreGeo, boltCoreMat), new THREE.Mesh(boltInkGeo, boltInkMat));
  m.position.copy(pos);
  m.quaternion.setFromUnitVectors(V3(0,1,0), dir.clone().normalize());
  scene.add(m);
  bolts.push({ mesh: m, dir: dir.clone().normalize(), speed, dmg, friendly, life: 4 });
  S.bolt();
}
export function updateBolts(dt){
  const pp = playerPos();
  for (let i = bolts.length-1; i >= 0; i--){
    const b = bolts[i];
    b.life -= dt;
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
        if (hit && by < c.h){
          kill = true;
          spawnHitSpark(V3(bx, by, bz), b.friendly ? 0x6fd0ff : 0xff5a3a, 0.8);
          sfx(180, 0.05, 'square', 0.04, 260);
          break;
        }
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
      const deflecting = near && facing && (player.atkT > 0 || player.parryT > 0);
      const parried = near && facing && player.parryT > 0;
      // SINGLE-BLASTER GAUNTLET SHIELD — a held energy shield that REFLECTS frontal bolts back (not just absorbs).
      // Each deflect spends stamina; run dry and the shield can't hold a bolt (it bleeds through, soaked by the beskar).
      const shielding = near && facing && G.hero === 'mando' && player.weapon === 'single' && !mandoWeapon().melee
                        && player.blockHeld && player.stam > 0;
      // bolt-ABSORB (no reflect) is the other defensive guard — Jedi (any stance) or the Mando DARKSABER. DUAL/DISRUPTOR
      // bracing is offensive-only and lets bolts straight through.
      const blocking = near && facing && player.blockHeld && player.stam > 0 && (G.hero !== 'mando' || player.weapon === 'darksaber');
      if (d < CFG.abilities.barrier.radius && near && player.barrierT > 0){
        // FORCE BARRIER auto-deflects bolts from any angle back into the crowd — no aim, no timing
        b.friendly = true; b.speed *= 1.3; b.dmg = 20;
        const tgt = nearestEnemyInCone(40, -1);
        if (tgt && tgt !== shared.boss) b.dir.subVectors(tgt.group.position, b.mesh.position).setY(0).normalize();
        else b.dir.negate();
        b.mesh.material.color.setHex(0x6fd0ff);
        spawnHitSpark(b.mesh.position.clone(), 0x6fd0ff, 0.7);
        sfx(1400, 0.08, 'square', 0.05, 1800);
      } else if (d < 2.6 && deflecting){
        deflectAnim(b.mesh.position);   // the blade moves to meet it (skipped mid-swing: the cut is already there)
        if (parried) player.parryT = 0;
        b.friendly = true; b.speed *= 1.4; b.dmg = parried ? 42 : 22;
        const tgt = nearestEnemyInCone(40, -1);
        if (tgt && tgt !== shared.boss) b.dir.subVectors(tgt.group.position, b.mesh.position).setY(0).normalize();
        else b.dir.negate();
        b.mesh.material.color.setHex(stance().blade);
        if (parried){
          player.force = clamp(player.force + 8 + player.up.parryForce + (stance().parryRefund || 0), 0, CFG.player.maxForce);
          G.hitstop = Math.max(G.hitstop, 0.1);
          G.shake = Math.max(G.shake, 0.4);
          G.slowmo = Math.min(G.slowmo, 0.4); G.slowmoT = Math.max(G.slowmoT, 0.12);
          spawnParryFlash(V3(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z), 0xffd24a);
          screenFlash('radial-gradient(ellipse at center, rgba(255,230,150,.4), transparent 65%)', 0.7, 0.28);
          S.parry(); floater(pp, 'PARRY!', '#ffe27a'); if (G.stats) G.stats.parries++;
        } else { clashFlash(b.mesh.position.clone(), stance().blade, false); S.deflect(); floater(pp, 'DEFLECT', '#7fd4ff'); if (G.stats) G.stats.deflects++; }
        addFocus(parried ? FOCUS.gainParry : FOCUS.gainDeflect);   // deflecting fire feeds the flow
      } else if (d < 2.5 && shielding){
        // GAUNTLET SHIELD — catch the bolt on the disc and HURL it back at the nearest threat. Costs stamina per catch.
        player.stam = Math.max(0, player.stam - 5 * player.up.blockStam);
        player.stamDelay = CFG.player.stamDelay;
        b.friendly = true; b.speed *= 1.35; b.dmg = Math.max(8, Math.round(b.dmg * 0.85));
        const tgt = nearestEnemyInCone(40, -1);
        if (tgt && tgt !== shared.boss) b.dir.subVectors(tgt.group.position, b.mesh.position).setY(0).normalize();
        else b.dir.negate();
        b.mesh.material.color.setHex(0x6fd0ff);
        player.shieldFlash = 0.22;   // the disc flares on the catch (drawn in updatePlayer)
        clashFlash(b.mesh.position.clone(), 0x6fd0ff, false);
        G.shake = Math.max(G.shake, 0.12); G.hitstop = Math.max(G.hitstop, 0.02);
        S.deflect(); floater(pp, 'DEFLECT', '#7fd4ff'); if (G.stats) G.stats.deflects++;
      } else if (d < 2.2 && blocking){
        // absorbed on the guard — costs stamina, no reflection
        deflectAnim(b.mesh.position);
        player.stam = Math.max(0, player.stam - 7 * player.up.blockStam * (stance().blockStamMul || 1));
        player.stamDelay = CFG.player.stamDelay;
        spawnHitSpark(b.mesh.position.clone(), stance().blade, 0.8);
        G.shake = Math.max(G.shake, 0.12);
        sfx(820, 0.07, 'square', 0.05, 460); floater(pp, 'BLOCK', '#9cc8e8');
        kill = true;
      } else if (d < 1.2 && dy < 1.2){
        hurtPlayer(b.dmg, b.mesh.position); kill = true;
        boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
      }
    } else if (!kill && b.friendly){
      for (const e of enemies){
        if (e.dead || e.converted) continue;
        // TIGHT hitbox — the bolt must actually strike the SILHOUETTE: a slim torso column (horizontal) AND be
        // at body height (vertical band from shins to crown). No more "near the foe at any height" free hits.
        const s = e.t.scale || 1;
        const ex = e.group.position;
        const hd = Math.hypot(b.mesh.position.x - ex.x, b.mesh.position.z - ex.z);   // horizontal dist to the body axis
        const by = b.mesh.position.y - ex.y;                                          // height above the foe's feet
        const headCenter = 2.1 * s;
        if (hd < 0.6 * s && by > 0.3 * s && by < 2.5 * s){
          let dmg = boltDamage(b);   // range falloff
          const isHead = (hd < 0.42 * s && Math.abs(by - headCenter) < 0.34 * s);   // HEADSHOT — a tight band right on the head
          if (isHead){
            dmg *= HEADSHOT_MULT;
            const headY = ex.y + headCenter;
            spawnHitSpark(V3(ex.x, headY + 0.1, ex.z), 0xffd24a, 1.5);
            floater(V3(ex.x, headY + 0.45, ex.z), 'HEADSHOT', '#ffd24a');
            sfx(1900, 0.08, 'square', 0.06, 420); G.hitstop = Math.max(G.hitstop, 0.04); G.shake = Math.max(G.shake, 0.18);
          }
          damageEnemy(e, dmg, b.dir, 6); flinchEnemy(e, b.dir, 0.4); kill = true;
          if (!isHead) boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
          if (b.playerShot){ if (G.stats) G.stats.shotsHit++; hitMarker(e.dead ? 'kill' : (isHead ? 'head' : 'hit')); }
          break;   // bolts make foes recoil
        }
      }
      if (!kill && shared.boss && shared.boss.hp > 0 && b.mesh.position.distanceTo(shared.boss.group.position.clone().setY(b.mesh.position.y)) < 1.6){
        let dmg = boltDamage(b);   // range falloff
        const isHead = b.mesh.position.y >= shared.boss.group.position.y + 2.4;
        if (isHead){ dmg *= 1.8; floater(V3(shared.boss.group.position.x, 3.0, shared.boss.group.position.z), 'HEADSHOT', '#ffd24a'); sfx(1900,0.08,'square',0.06,420); }
        damageBoss(dmg); kill = true;
        boltImpact(b.mesh.position, b.mesh.material.color.getHex(), b.dir);
        if (b.playerShot){ if (G.stats) G.stats.shotsHit++; hitMarker(shared.boss.hp <= 0 ? 'kill' : (isHead ? 'head' : 'hit')); }
      }
    }
    if (kill){ scene.remove(b.mesh); bolts.splice(i,1); }
  }
}
export function updateOrbs(dt){ /* orbs retired in favor of force lightning */ }
