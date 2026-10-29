// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Force powers: push, jump attack, saber throw, pull (and the grasp, grasp.js), repulse, barrier, mend, judgement.

import * as THREE from 'three';
import { CFG } from '../../data/config.js';
import { abil, healFrac } from '../../data/mastery.js';
import { scene } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, clamp, rand, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, barrels, vfx, player } from '../../state.js';
import { flashLight } from '../../fx/lights.js';
import { cdMul } from '../../data/stances.js';
import { forcePower, fwd, playerPos, stance, maxHp } from '../helpers.js';
import { inReach, distToBody, chestPos } from '../../enemies/bodyshape.js';
import { heroAim, aimFrom, inAim, bossInAim, columnInAim, alongAim } from '../aim.js';
import { groundAt } from '../../world/collision.js';
import { ensureJudgeLines } from './judgement-fx.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss, bossStun, bossStagger } from '../../boss/boss.js';
import { cancelSwing } from './combat.js';
import { rushFlip } from '../anim/agility.js';
import { spawnPushWave, spawnGroundShock } from '../../fx/vfx.js';
import { inkSprite, sparks, motes, dustRing, barrierMaterial, bindBarrier } from '../../fx/ink.js';
import { hooks } from '../../net/run.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { pushGrenades } from '../../enemies/grenades.js';

/* trigger the off-hand reaching gesture used by every Force power */
// a Jedi power's Force cost after the survival cost cuts (ATTUNEMENT, DEEP RESERVES, FORCE NEXUS) — the same
// player.up.abilityCostMul the Mando's gadgets already read; before this the Jedi paid full price regardless
const fcost = (base) => base * (player.up.abilityCostMul || 1);

export function castGesture(kind, dur){ dur *= (stance().castMul || 1); player.castT = dur; player.castMax = dur; player.castKind = kind; }   // ATARU casts snap off faster
// turn the Jedi to FACE the direction an ability is aimed — soft-snaps the yaw onto the nearest foe in
// the frontal cone so powers commit toward the threat (the Force equivalent of the Mando squaring up)
function faceAbilityAim(range){
  // NO aim assist — powers fire exactly where you're aiming. (Kept as a no-op so call sites stay simple.)
}

export function forcePush(){
  const A = abil('push');
  const st = stance();
  const cost = fcost(A.cost * ((st.costMult && st.costMult.push) || 1) * (st.powerCostMul || 1));
  if (!G.unlocked.push || player.cds.push > 0 || player.force < cost || G.mode !== 'play') return;
  if (player.atkT > 0) cancelSwing();   // flow straight out of a saber swing into the shove
  player.force -= cost; player.cds.push = A.cd * (st.cdMult || 1);
  if (hooks.power) hooks.power('push', st.blade, A.range * 0.5);   // co-op: the partner sees the shove
  faceAbilityAim(A.range);                          // square up to the threat before the shove
  const f = fwd(), pp = playerPos();
  const aim = heroAim();                           // the shove goes where the crosshair points, up or down
  const col = stance().blade;
  S.push();
  G.shake = Math.max(G.shake, 0.3);
  castGesture('push', 0.28);                       // off-hand palm-thrust
  spawnPushWave(pp.clone(), aim.dir.clone(), col, 0.6);  // a modest shove — basic ability, not a grand blast
  const cosLim = Math.cos(A.angle);
  let pushed = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (!inAim(e, aim, A.range, cosLim, 0.14)) continue;   // any of the body in the cone; a foe in the air only when aimed up at
    if (d < 0.05) TMP.copy(f);
    TMP.normalize();
    const falloff = 1 - (d / A.range) * 0.5;
    damageEnemy(e, A.dmg * forcePower(), TMP.clone(), A.knock * falloff * forcePower());
    pushed++;
    tutEvent('pushHit', e);
  }
  // launch barrels
  for (const b of barrels){
    const bp = b.mesh.position;
    if (!columnInAim(aim, bp, bp.y - 0.6, bp.y + 0.6, 0.5, A.range, cosLim, 0.14)) continue;
    TMP.subVectors(bp, pp); TMP.y = 0; TMP.normalize();
    b.flying = true;
    b.vel.set(TMP.x*26, 5, TMP.z*26);
  }
  // reflect enemy bolts in cone
  for (const b of bolts){
    if (b.friendly) continue;
    TMP.subVectors(b.mesh.position, pp); TMP.y = 0;
    if (TMP.length() < A.range && TMP.normalize().dot(f) > cosLim - 0.2){
      b.friendly = true; b.dir.negate(); b.dmg = 20; b.mesh.material.color.setHex(0x66ccff);
    }
  }
  // live THERMAL DETONATORS in the cone fly back at the squad that threw them
  if (pushGrenades(pp, f, A.range, cosLim)) floater(pp, 'RETURNED', '#7fd4ff');
  // PUSH the Sith's force lightning back into him
  if (shared.boss && shared.boss.hp > 0 && shared.boss.lightT > 0){
    if (bossInAim(aim, A.range + 5, cosLim - 0.25, 0.3)){
      shared.boss.lightT = 0;
      if (shared.bossLight) shared.bossLight.visible = false;
      floater(pp, 'REFLECTED!', '#ffd24a');
      bossStun();
    }
  }
  // boss resists the push itself
  else if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < A.range && pushed === 0)
    floater(shared.boss.group.position, 'RESISTED', '#aa7788');
  if (pushed >= 4) floater(pp, 'CROWD CLEARED', '#7fd4ff');
}

/* JUMP ATTACK (X) — the Jedi's plunging saber strike (it took over the old Force Slam's unlock and mastery). In the
   air it fires at once; on the ground it LEAPS first. Either way there is a beat of WIND-UP at the top (the climb
   stalls, the body arches back, the blade goes up overhead in both hands), then the blade comes down and the landing
   is a strike on whoever is under you plus a ground shockwave. Once mastered to rank II (bigWave), a dive out of a
   DOUBLE JUMP lands a far bigger shockwave. */
const SLAM_WIND = { air: 0.18, leap: 0.32 };   // wind-up before the plunge: from the air, and after a leap off the ground
export function forceSlam(){
  const A = abil('jslam');
  const st = stance();
  const slamCost = fcost(A.cost * (st.powerCostMul || 1));
  if (!G.unlocked.slam || G.mode !== 'play' || player.slamming || player.mantle || player.hang || player.saberLock || shared.saberProj || player.holstered) return false;
  if (player.cds.slam > 0 || player.force < slamCost){ sfx(220, 0.06, 'sine', 0.04, 160); return false; }   // a soft "not yet"
  if (player.landStagT > 0) player.landStagT = 0;   // the Force picks you up out of a buckled landing
  player.force -= slamCost; player.cds.slam = A.cd * (st.cdMult || 1);
  if (hooks.power) hooks.power('slam', st.blade, 6);
  if (player.atkT > 0) cancelSwing();   // a swing turns into the jump attack
  player.airCut = null; player.gliding = false;
  const leap = player.grounded;
  if (leap){
    // off the ground: a Force leap straight up into the wind-up, carrying a little toward the foe you face
    player.grounded = false; player.lastJumpT = G.gt;
    player.vy = CFG.player.jumpVel * 1.35;
    player.vel.addScaledVector(fwd(), 3);
  } else player.vy = Math.max(player.vy * 0.3, 3);   // in the air: the climb stalls and hangs a beat
  // a dive out of a double jump arms the big wave (rank II); read now, since landing clears doubleJumped
  player.slamBig = !!player.doubleJumped && A.bigWave > 0;
  player.slamming = true;
  player.slamWind = leap ? SLAM_WIND.leap : SLAM_WIND.air;
  if (leap) player.flip = null;
  else player.slamWind = Math.max(player.slamWind, rushFlip(player.slamWind * 0.9) / 0.9);   // mid-flip: the somersault finishes into the plunge
  player.vel.multiplyScalar(0.6); player.moveVel.multiplyScalar(0.4);
  const sp = playerPos();
  sparks(V3(sp.x, sp.y + 2.4, sp.z), st.blade, 6, 5, { dir: V3(0, 1, 0), cone: 0.6, life: 0.24, grav: 0 });   // the blade goes up
  sfx(160, 0.22, 'sawtooth', 0.045, 480);
  tutEvent('jumpAttack');
  return true;
}
// the wind-up, then the plunge
export function updateJumpAttack(dt){
  if (!(player.slamWind > 0)) return;
  if (!player.slamming){ player.slamWind = 0; return; }
  player.slamWind -= dt;
  player.vel.multiplyScalar(Math.pow(0.15, dt));
  if (player.vy < 1.2) player.vy = 1.2;   // hang at the top while the blade is up
  if (player.slamWind > 0) return;
  player.slamWind = 0;
  if (player.flip){ player.flip = null; player.vis.rotation.set(0, 0, 0); player.vis.position.set(0, 0, 0); }   // (any rushed flip has landed its turn by now)
  player.vel.multiplyScalar(0.5);        // keep some of the carry so the strike lands on the foe you jumped at
  player.vy = -32;                       // drive straight down
  S.dash();
  const sp = playerPos();
  sparks(V3(sp.x, sp.y + 1.2, sp.z), stance().blade, player.slamBig ? 14 : 8, 10, { dir: V3(0, 1, 0), cone: 0.5, life: 0.25, grav: 0 });   // the air tears as you drop
}
export function slamImpact(){
  const A = abil('jslam'), st = stance();
  const big = !!player.slamBig; player.slamBig = false;
  const sc = big ? A.bigScale : 1;                        // the double-jump dive: everything about the wave is bigger
  const radius = A.radius * sc, knock = A.knock * (big ? 1.35 : 1) * forcePower(), dmg = A.dmg * (st.powerDmg || 1) * (big ? 1.6 : 1) * forcePower();
  const strike = A.strike * (st.powerDmg || 1) * (player.up.dmg || 1);
  const pp = playerPos();
  const col = st.blade;
  S.slam(); S.boom(null, big ? 1.4 : 1);
  G.shake = Math.max(G.shake, big ? 1.7 : 1.35); G.hitstop = Math.max(G.hitstop, big ? 0.14 : 0.1);   // a heavy CRACK of camera shake on landing
  G.slowmo = Math.min(G.slowmo, 0.6); G.slowmoT = Math.max(G.slowmoT, big ? 0.16 : 0.1);   // a brief beat on landing
  // a clean pair of ground shockwaves — weight without the fireworks (a third, wider one on the big wave)
  spawnGroundShock(pp, col, radius + 3,  0.42, 0.5);    // core ring
  spawnGroundShock(pp, col, radius + 9,  0.72, 0.28);   // wide trailing wave
  if (big){
    spawnGroundShock(pp, 0xffffff, radius + 14, 0.9, 0.35);
    screenFlash('radial-gradient(ellipse at center, rgba(150,210,255,.4), transparent 60%)', 0.6, 0.3);
    floater(pp, 'SHOCKWAVE', '#bfe8ff');
  }
  // the impact: a cel starburst at the feet, a soft short-lived light, a ring of dust puffs and a little debris
  inkSprite({ pos: V3(pp.x, pp.y + 0.5, pp.z), shape: 'star', points: 8, sharp: 0.15, color: col, size: [1.6, big ? 6 : 4.4], life: 0.16, steps: 2, coreW: 0.4 });
  flashLight(col, big ? 7 : 5, radius*1.8, V3(pp.x, 1.0, pp.z), 0.3);
  dustRing(pp, radius);
  burst(V3(pp.x, 0.35, pp.z), 0x9a9a9a, big ? 18 : 10, 9, 7, 1.1);   // tumbling debris
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    if (!inReach(e, pp, radius)) continue;
    // the blade itself: whoever you came down on (or right beside) takes the saber strike on top of the wave
    const hitDmg = inReach(e, pp, A.core) ? dmg + strike : dmg;
    damageEnemy(e, hitDmg, TMP.normalize().clone(), knock);
  }
  for (const b of barrels){
    if (b.mesh.position.distanceTo(pp) < radius && b.fuse < 0) b.fuse = 0.2;
  }
  if (shared.boss && shared.boss.hp > 0){
    const bd = shared.boss.group.position.distanceTo(pp);
    if (bd < radius) damageBoss(bd < A.core + 1.5 ? dmg + strike : dmg);
  }
}
// the repulse front: a waist-high ink ring racing out from the body (driven by the VFX loop, so it respects slow-mo)
function spawnPlayerRing(pos, maxR, color){
  inkSprite({ pos: V3(pos.x, pos.y + 1.0, pos.z), normal: V3(0, 1, 0), shape: 'ring', inner: 0.9, color, size: [1.5, (maxR + 2) * 2],
              ease: 3, life: 0.42, fadeAt: 0.3, coreW: 0.25, inkW: 0.3 });
  inkSprite({ pos: V3(pos.x, pos.y + 1.0, pos.z), normal: V3(0, 1, 0), shape: 'ring', inner: 0.93, color, size: [1.2, (maxR + 2) * 1.6],
              ease: 3, life: 0.5, delay: 0.06, op: 0.6, fadeAt: 0.3, coreW: 0.25, inkW: 0.3 });
}

const _throwLight = new THREE.PointLight(0xffffff, 0, 8);   // in the scene from load (a light added mid-fight recompiles every shader)
scene.add(_throwLight);
function throwLight(){ return _throwLight; }
// the thrown blade is built once and hidden between throws: building meshes and materials on the throw is the first-use hitch
const thrownSaber = new THREE.Group();
const thrownBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1.7, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
const thrownGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.75, 8),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
thrownSaber.add(thrownBlade, thrownGlow);
thrownSaber.visible = false;
scene.add(thrownSaber);
export function hideThrownSaber(){ thrownSaber.visible = false; _throwLight.intensity = 0; }
// the hilt in the hand goes while the blade is in flight. Shrunk and dimmed, NOT hidden: its blade light is part of the
// scene's light count, and hiding it (like adding one) makes three.js recompile every material, the throw hitch
let _handLight = 0;
export function stowHandSaber(away){
  const h = player.saberHand, B = player.blade;
  if (!h) return;
  h.scale.setScalar(away ? 1e-4 : 1);
  if (!B) return;
  if (away){ if (B.light.intensity > 0) _handLight = B.light.intensity; B.light.intensity = 0; }
  else if (_handLight && !(player.holstered && G.hero !== 'mando')){ B.light.intensity = _handLight; }
}
export function saberThrow(){
  const A = abil('throw');
  const cost = fcost(A.cost);
  if (!G.unlocked.throw || player.cds.throw > 0 || player.force < cost || shared.saberProj || G.mode !== 'play') return;
  player.force -= cost; player.cds.throw = A.cd * (stance().cdMult || 1);
  faceAbilityAim(A.range);   // line the throw up on the nearest target
  castGesture('push', 0.3);  // face the throw direction
  const f = fwd(), pp = playerPos();
  // it leaves the hand at chest height and flies down the crosshair: up at a foe in the air, down onto one below
  const start = V3(pp.x + f.x, pp.y + 1.5, pp.z + f.z), aim = aimFrom(start);
  const m = thrownSaber;
  thrownGlow.material.color.setHex(stance().blade);
  // one light that lives in the scene for good and only fades (adding a light per throw recompiles every material)
  const l = throwLight();
  l.color.setHex(stance().blade); l.intensity = 8;
  m.rotation.set(0, 0, Math.PI/2);
  m.position.copy(start);
  m.visible = true;
  stowHandSaber(true);
  shared.saberProj = { mesh: m, dir: aim.dir.clone(), traveled: 0, returning: false, hitSet: new Set() };
  S.swing();
}
export function updateSaberThrow(dt){
  if (!shared.saberProj) return;
  const A = abil('throw'), sp = shared.saberProj;
  const pp = playerPos();
  if (!sp.returning){
    sp.mesh.position.addScaledVector(sp.dir, A.speed * dt);
    sp.traveled += A.speed * dt;
    // it turns back at the end of its reach, or where it meets the floor or a prop (thrown down at the deck, it skips back)
    const mp = sp.mesh.position, floor = groundAt(mp.x, mp.z, Infinity);
    if (mp.y < floor + 0.3){ mp.y = floor + 0.3; sp.returning = true; sp.hitSet.clear(); }
    if (sp.traveled >= A.range){ sp.returning = true; sp.hitSet.clear(); }
  } else {
    TMP.set(pp.x, pp.y + 1.5, pp.z).sub(sp.mesh.position);
    const d = TMP.length();
    if (d < 1.2){
      sp.mesh.visible = false; shared.saberProj = null; throwLight().intensity = 0;
      stowHandSaber(false);
      return;
    }
    TMP.normalize();
    sp.mesh.position.addScaledVector(TMP, A.speed * 1.3 * dt);
  }
  sp.mesh.rotation.y += dt * 22;
  throwLight().position.copy(sp.mesh.position);
  // the spinning blade smears into a disc of light: short-lived flat echoes laid down along its flight
  sp.echoT = (sp.echoT || 0) - dt;
  if (sp.echoT <= 0){
    sp.echoT = 0.03;
    inkSprite({ pos: sp.mesh.position, normal: V3(0, 1, 0), shape: 'ring', inner: 0.12, color: stance().blade, size: [1.8, 1.8],
                life: 0.09, steps: 2, op: 0.55, coreW: 0.2, inkW: 0.1 });
  }
  for (const e of enemies){
    if (e.dead || e.converted || sp.hitSet.has(e)) continue;
    if (distToBody(e, sp.mesh.position) < 1.0){   // the spinning blade's disc touches the body
      sp.hitSet.add(e);
      damageEnemy(e, A.dmg, sp.dir.clone(), 12);
    }
  }
  const bp = shared.boss && shared.boss.group.position, my = sp.mesh.position.y;
  if (shared.boss && shared.boss.hp > 0 && !sp.hitSet.has(shared.boss) && my > bp.y - 0.6 && my < bp.y + 4.2 &&
      Math.hypot(sp.mesh.position.x - bp.x, sp.mesh.position.z - bp.z) < 2.4){
    sp.hitSet.add(shared.boss); damageBoss(A.dmg);
  }
}

/* FORCE PULL — yank the crowd toward your blade */
export function forcePull(){
  const A = abil('pull');
  const st = stance();
  const cost = fcost(A.cost * ((st.costMult && st.costMult.pull) || 1));
  if (!G.unlocked.pull || player.cds.pull > 0 || player.force < cost || G.mode !== 'play') return;
  if (player.atkT > 0) cancelSwing();   // flow straight out of a saber swing into the pull
  player.force -= cost; player.cds.pull = A.cd * (st.cdMult || 1);
  if (hooks.power) hooks.power('pull', st.blade, A.range * 0.5);
  faceAbilityAim(A.range);     // face the crowd you're about to yank
  castGesture('pull', 0.36);   // reach out, then claw the hand back
  const f = fwd(), pp = playerPos(), aim = heroAim();
  S.pull();
  G.shake = Math.max(G.shake, 0.3);
  const cosLim = Math.cos(A.angle);
  let n = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || e.state === 'stasis') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (d < 2.5 || !inAim(e, aim, A.range, cosLim, 0.14)) continue;   // a foe up on a ledge or in the air: aim up at it
    TMP.normalize();
    const ep = e.group.position;
    sparks(V3(ep.x, ep.y + 1.5, ep.z), stance().blade, 4, d * 2.4, { dir: TMP.clone().negate(), cone: 0.15, life: 0.3, grav: 0, stretch: 4 });   // yanked: streaks toward you
    if (e.t.heavy){
      e.group.position.addScaledVector(TMP, -2.5);   // brutes only stumble closer
      e.state = 'recover'; e.st = 0.5;
    } else {
      e.state = 'knockdown'; e.st = 0.7;
      e.vel.copy(TMP.multiplyScalar(-clamp(d*1.9, 9, 26)));
      e.vel.y = 4.5;
      e.flash = 0.1;
    }
    n++;
  }
  // the Force reaching out and closing: ripple rings collapsing back toward the hand
  for (let i = 0; i < 3; i++){
    const at = A.range * (0.75 - i*0.15), ad = aim.dir;
    inkSprite({ pos: alongAim(aim, at), normal: ad, shape: 'ring', inner: 0.86, color: stance().blade,
                size: [4.2 - i*0.5, 0.7], ease: 2, life: 0.3, delay: i*0.05, op: 0.9 - i*0.2, fadeAt: 0.5, coreW: 0.2, inkW: 0.22,
                vel: ad.clone().multiplyScalar(-at / 0.3) });
  }
  if (n) floater(pp, 'PULL', '#7fd4ff');
}

/* FORCE REPULSE — a 360° concussive blast that hurls everything around you away (high-tier) */
export function forceRepulse(){
  const A = abil('repulse'), st = stance();
  const cost = fcost(A.cost * (st.powerCostMul || 1));    // DJEM SO casts cost more...
  if (!G.unlocked.repulse || player.cds.repulse > 0 || player.force < cost || G.mode !== 'play') return;
  const up = !!player.up.repulseUp;                        // the FINAL upgrade supercharges it
  const psc = st.powerScale || 1;                          // ...but erupt with BRUTE scale
  const radius = A.radius * (up ? 1.4 : 1) * psc, dmg = A.dmg * (up ? 1.9 : 1) * (player.up.dmg || 1) * forcePower(), knock = A.knock * (up ? 1.35 : 1) * psc * forcePower();
  player.force -= cost; player.cds.repulse = A.cd * cdMul(st, 'repulse');
  if (hooks.power) hooks.power('repulse', st.blade, radius);
  castGesture('push', 0.34);
  const pp = playerPos(), col = stance().blade;
  spawnPlayerRing(pp.clone(), radius, col);
  spawnGroundShock(pp.clone().setY(0.1), col, radius + 1, 0.4, 0.7);
  spawnGroundShock(pp.clone().setY(0.1), 0xffffff, radius + (up ? 6 : 3), up ? 0.7 : 0.5, 0.4);
  // the cast: a big cel starburst off the body, a hard radial spray of streaks and dust thrown out along the floor
  inkSprite({ pos: V3(pp.x, pp.y + 1.3, pp.z), shape: 'star', points: 10, sharp: 0.15, color: col, size: [2, up ? 7 : 5.5], life: 0.2, steps: 2, coreW: 0.38, spin: 1.5 });
  inkSprite({ pos: V3(pp.x, pp.y + 1.3, pp.z), shape: 'disc', color: col, size: [1.2, 2.6], life: 0.1, steps: 2, coreW: 0.7 });
  sparks(V3(pp.x, pp.y + 1.3, pp.z), col, up ? 28 : 20, 24, { up: 0.1, life: 0.32, grav: 2, stretch: 4 });
  dustRing(pp, radius * 0.8);
  screenFlash('radial-gradient(ellipse at center, rgba(150,210,255,'+(up?0.55:0.4)+'), transparent 60%)', up ? 0.9 : 0.6, 0.32);
  G.shake = Math.max(G.shake, up ? 1.5 : 1.1); G.hitstop = Math.max(G.hitstop, 0.1);
  S.slam(); S.boom(null, up ? 1.4 : 1); S.push();
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > radius*0.7) continue;   // the blast bursts from YOU — it can't reach foes far below mid-air
    TMP.y = 0;
    if (!inReach(e, pp, radius)) continue;
    const kd = TMP.clone().normalize();
    damageEnemy(e, dmg, kd, knock); flinchEnemy(e, kd, 0.8);
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < radius){
    damageBoss(dmg);
    if (shared.boss.hp > 0 && (shared.boss.state === 'windup' || shared.boss.state === 'lightning' || shared.boss.state === 'chase')) bossStagger();
  }
}

/* FORCE BARRIER — the kit's defensive power. A brief shimmering bubble that soaks most
   incoming damage and auto-deflects blaster bolts back at the crowd. A clutch panic button. */

export function ensureBarrierMesh(){
  if (shared._barrierMesh) return;
  const geo = new THREE.SphereGeometry(1.7, 32, 24);
  const mat = barrierMaterial(0x6fd0ff);
  mat.opacity = 0.22;
  shared._barrierMesh = new THREE.Mesh(geo, mat);
  bindBarrier(shared._barrierMesh);
  shared._barrierMesh.visible = false;
  scene.add(shared._barrierMesh);
}
// a ring of CONTROL knockback from the barrier (low/no damage) — shoves the swarm off you
export function barrierShove(power, knock){
  const A = abil('barrier'), pp = playerPos();
  spawnGroundShock(pp.clone().setY(0.1), 0x6fd0ff, A.knockR, 0.4, power);
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    if (!inReach(e, pp, A.knockR)) continue;
    const kd = TMP.normalize().clone();
    damageEnemy(e, 1, kd, knock); flinchEnemy(e, kd, 0.3);   // pure shove — ~no damage
  }
}
export function forceBarrier(){
  const A = abil('barrier');
  const cost = fcost(A.cost);
  if (!G.unlocked.barrier || player.cds.barrier > 0 || player.force < cost || G.mode !== 'play') return;
  // the cooldown only starts once the bubble drops, so uptime can never reach 100% (Ataru's −35% cooldown plus
  // mastery used to let a 4.5s, 80% bubble come back every 4.6s — permanent near-immunity)
  player.force -= cost; player.cds.barrier = A.cd * cdMul(stance(), 'barrier') + A.dur;
  player.barrierT = A.dur;
  ensureBarrierMesh();
  castGesture('push', 0.3);
  const pp = playerPos(), col = 0x6fd0ff;
  spawnGroundShock(pp.clone().setY(0.1), col, A.radius, 0.4, 0.6);
  inkSprite({ pos: V3(pp.x, pp.y + 1.4, pp.z), shape: 'star', points: 6, sharp: 0.22, color: col, size: [1.4, 4.2], life: 0.18, steps: 2, coreW: 0.4 });
  sparks(V3(pp.x, pp.y + 1.4, pp.z), col, 14, 12, { life: 0.3, size: 0.5 });
  screenFlash('radial-gradient(ellipse at center, rgba(120,210,255,.35), transparent 60%)', 0.5, 0.3);
  G.shake = Math.max(G.shake, 0.4);
  barrierShove(0.7, A.castKnock);   // CAST — a firm shove clears space around you as the bubble snaps up
  S.push(); S.barrier();
  floater(pp, 'FORCE BARRIER', '#bfe8ff');
}

/* FORCE MEND — CHANNEL the Force inward to knit your wounds. A ~0.7s wind-up (a clear, committed "patch up in
   a safe window" beat) with a BLUE force glow + green healing motes, then a big restorative pulse on completion.
   Steep cost + long cooldown: deliberate, never a spammable regen. */
const MEND_CHANNEL = 0.7;
export function forceMend(){
  const A = abil('mend');
  const cost = fcost(A.cost);
  if (!G.unlocked.mend || player.cds.mend > 0 || player.mendT > 0 || player.force < cost || G.mode !== 'play') return;
  if (player.hp >= maxHp()){ floater(playerPos(), 'UNHURT', '#7bffae'); return; }   // don't waste it at full health
  player.force -= cost; player.cds.mend = A.cd * cdMul(stance(), 'mend');
  player.mendT = player.mendMax = MEND_CHANNEL;   // begin the channel — the heal lands when it completes
  const pp = playerPos();
  spawnGroundShock(pp.clone().setY(0.1), 0x6fd0ff, 2.4, 0.55, 0.5);   // a BLUE force ring blooms as you start
  S.push(); sfx(240, 0.5, 'sine', 0.09, 760); sfx(360, 0.5, 'sine', 0.06, 1020);   // a rising channel hum (wind-up cue)
  floater(V3(pp.x, 1.0, pp.z), 'MENDING…', '#bfe8ff');
}
// the channel succeeded — knit the wound and erupt in green light
export function mendComplete(){
  const pp = playerPos();
  const healed = Math.min(maxHp() - player.hp, Math.round(maxHp() * healFrac()));
  player.hp += healed;
  player.lastHurt = G.gt;   // mending resets the passive-regen delay window
  spawnGroundShock(pp.clone().setY(0.1), 0x53ff8c, 3.0, 0.5, 0.55);
  inkSprite({ pos: V3(pp.x, pp.y + 1.3, pp.z), shape: 'star', points: 4, sharp: 0.12, color: 0x53ff8c, size: [1.4, 3.6], life: 0.24, steps: 3, coreW: 0.4, rot: 0 });
  motes(V3(pp.x, pp.y, pp.z), 0x7bffae, 14, 0.6, { h: 2.2, delay: 0.25 });
  sparks(V3(pp.x, pp.y + 1.2, pp.z), 0x7bffae, 10, 7, { dir: V3(0, 1, 0), cone: 0.8, life: 0.4, grav: -2 });
  screenFlash('radial-gradient(ellipse at center, rgba(80,255,140,.32), transparent 60%)', 0.5, 0.36);
  floater(V3(pp.x, 1.0, pp.z), '+' + healed, '#7bffae');
  sfx(440, 0.35, 'sine', 0.13, 980); sfx(880, 0.3, 'sine', 0.08, 1500);   // a bright restorative chime
}

/* FORCE JUDGEMENT — channel chain lightning through the front cone */
export function forceJudgement(){
  const A = abil('judge');
  const cost = fcost(A.cost);
  if (!G.unlocked.judge || player.cds.judge > 0 || player.force < cost || G.mode !== 'play' || player.judgeT > 0) return;
  player.force -= cost;
  faceAbilityAim(A.range);   // aim the storm at the nearest foe
  player.cds.judge = A.cd * (stance().cdMult || 1);
  player.judgeT = A.time;
  player.judgeTick = 0;
  player.judgeTargets = [];
  ensureJudgeLines();
  S.zap();
  G.shake = Math.max(G.shake, 0.25);
}
export function updateJudgement(dt){
  if (player.judgeT <= 0) return;
  const A = abil('judge');
  player.judgeT -= dt;
  player.judgeTick -= dt;
  if (player.judgeTick > 0) return;
  player.judgeTick = A.tick;
  const pp = playerPos(), aim = heroAim();   // re-read every tick: sweep the storm up and down as well as across
  const cosLim = Math.cos(A.angle);
  const found = [];
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const d = e.group.position.distanceTo(pp);
    if (d < 0.01 || !inAim(e, aim, A.range, cosLim, 0.16)) continue;   // the arcs follow the crosshair: up into the air, down from it
    found.push({ e, d });
  }
  found.sort((a,b) => a.d - b.d);
  const up = !!player.up.judgeUp;                                  // the FINAL upgrade — STORM OF JUDGEMENT
  const dmg = A.dmg * (stance().powerDmg || 1) * (up ? 1.9 : 1) * forcePower();
  const maxT = A.targets + (up ? 3 : 0);
  const tpos = [];
  for (const { e } of found.slice(0, maxT)){
    damageEnemy(e, dmg, null, 0);
    if (!e.dead && !e.t.heavy && e.state !== 'ragdoll' && e.state !== 'grasped'){ e.state = 'recover'; e.st = 0.3; }   // lightning locks them up
    tpos.push(chestPos(e));
  }
  if (tpos.length < maxT && bossInAim(aim, A.range, cosLim, 0.16)){
    damageBoss(dmg);
    const bp = shared.boss.group.position;
    tpos.push(V3(bp.x, bp.y + 2.2, bp.z));
  }
  if (!tpos.length){   // nothing to chain to: the bolt lashes out along the aim (into the floor, or the open air), flickering about it
    const f = aim.dir, side = new THREE.Vector3(-f.z, 0, f.x).normalize();
    const end = alongAim(aim, A.range * 0.6);
    tpos.push(V3(end.x + side.x*rand(-1.2, 1.2), end.y + rand(-0.4, 0.5), end.z + side.z*rand(-1.2, 1.2)));
  }
  player.judgeTargets = tpos;
  S.arc(tpos[0]);
}
