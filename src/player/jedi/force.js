// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Force powers: push, slam, saber throw, pull, repulse, barrier, mend, judgement.

import * as THREE from 'three';
import { abil, healFrac } from '../../data/mastery.js';
import { scene } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, barrels, vfx, player } from '../../state.js';
import { flashLight } from '../../fx/lights.js';
import { fwd, playerPos, stance, maxHp } from '../helpers.js';
import { inReach, distToBody } from '../../enemies/hitbox.js';
import { ensureJudgeLines } from './judgement-fx.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss, bossStun, bossStagger } from '../../boss/boss.js';
import { cancelSwing } from './combat.js';
import { spawnPushWave, spawnGroundShock } from '../../fx/vfx.js';
import { inkSprite, sparks, motes, dustRing, barrierMaterial, bindBarrier } from '../../fx/ink.js';

/* trigger the off-hand reaching gesture used by every Force power */
export function castGesture(kind, dur){ dur *= (stance().castMul || 1); player.castT = dur; player.castMax = dur; player.castKind = kind; }   // ATARU casts snap off faster
// turn the Jedi to FACE the direction an ability is aimed — soft-snaps the yaw onto the nearest foe in
// the frontal cone so powers commit toward the threat (the Force equivalent of the Mando squaring up)
function faceAbilityAim(range){
  // NO aim assist — powers fire exactly where you're aiming. (Kept as a no-op so call sites stay simple.)
}

export function forcePush(){
  const A = abil('push');
  const st = stance();
  const cost = A.cost * ((st.costMult && st.costMult.push) || 1) * (st.powerCostMul || 1);
  if (!G.unlocked.push || player.cds.push > 0 || player.force < cost || G.mode !== 'play') return;
  if (player.atkT > 0) cancelSwing();   // flow straight out of a saber swing into the shove
  player.force -= cost; player.cds.push = A.cd * (st.cdMult || 1);
  faceAbilityAim(A.range);                          // square up to the threat before the shove
  const f = fwd(), pp = playerPos();
  const col = stance().blade;
  S.push();
  G.shake = Math.max(G.shake, 0.3);
  castGesture('push', 0.28);                       // off-hand palm-thrust
  spawnPushWave(pp.clone(), f.clone(), col, 0.6);  // a modest shove — basic ability, not a grand blast
  const cosLim = Math.cos(A.angle);
  let pushed = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > A.range*0.4) continue;   // the shove goes level — not down onto foes far below
    TMP.y = 0;
    const d = TMP.length();
    if (!inReach(e, pp, A.range, d > 1.5 ? f : null, cosLim)) continue;   // any of the body in the cone, not just its centre
    TMP.normalize();
    const falloff = 1 - (d / A.range) * 0.5;
    damageEnemy(e, A.dmg, TMP.clone(), A.knock * falloff);
    pushed++;
  }
  // launch barrels
  for (const b of barrels){
    TMP.subVectors(b.mesh.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (d > A.range) continue;
    TMP.normalize();
    if (TMP.dot(f) < cosLim) continue;
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
  // PUSH the Sith's force lightning back into him
  if (shared.boss && shared.boss.hp > 0 && shared.boss.lightT > 0){
    TMP.subVectors(shared.boss.group.position, pp); TMP.y = 0;
    if (TMP.length() < A.range + 5 && TMP.normalize().dot(f) > cosLim - 0.25){
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

let slamHintT = 0;
export function forceSlam(){
  const A = abil('jslam');
  const st = stance();
  const slamCost = A.cost * (st.powerCostMul || 1);
  if (!G.unlocked.slam || player.cds.slam > 0 || player.force < slamCost || G.mode !== 'play' || player.slamming) return;
  if (player.grounded){
    // AIRBORNE ONLY — no ground-stomp variant anymore; jump (or double-jump) first to set up the dive.
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'AIRBORNE ONLY', '#bfe8ff'); sfx(120, 0.1, 'square', 0.05, 70); }
    return;
  }
  player.force -= slamCost; player.cds.slam = A.cd * (st.cdMult || 1);
  // AERIAL DIVE-SLAM — drive straight down; the shockwave erupts on landing (a double-jump sets up the big drop)
  player.slamming = true;
  player.flip = null;
  player.vel.set(0, 0, 0);
  player.vy = -32;                       // drive straight down
  S.dash();
  const sp = playerPos();
  sparks(V3(sp.x, sp.y + 1.2, sp.z), stance().blade, 8, 10, { dir: V3(0, 1, 0), cone: 0.5, life: 0.25, grav: 0 });   // the air tears as you drop
}
export function slamImpact(){
  const A = abil('jslam'), st = stance();
  const pp = playerPos();
  const col = st.blade;
  S.slam(); S.boom();
  G.shake = Math.max(G.shake, 1.35); G.hitstop = Math.max(G.hitstop, 0.1);   // a heavy CRACK of camera shake on landing
  G.slowmo = Math.min(G.slowmo, 0.6); G.slowmoT = Math.max(G.slowmoT, 0.1);   // a brief beat on landing
  // a clean pair of ground shockwaves — weight without the fireworks
  spawnGroundShock(pp, col, A.radius + 3,  0.42, 0.5);    // core ring
  spawnGroundShock(pp, col, A.radius + 9,  0.72, 0.28);   // wide trailing wave
  // the impact: a cel starburst at the feet, a soft short-lived light, a ring of dust puffs and a little debris
  inkSprite({ pos: V3(pp.x, pp.y + 0.5, pp.z), shape: 'star', points: 8, sharp: 0.15, color: col, size: [1.6, 4.4], life: 0.16, steps: 2, coreW: 0.4 });
  flashLight(col, 5, A.radius*1.8, V3(pp.x, 1.0, pp.z), 0.3);
  dustRing(pp, A.radius);
  burst(V3(pp.x, 0.35, pp.z), 0x9a9a9a, 10, 9, 7, 1.1);   // tumbling debris
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    if (!inReach(e, pp, A.radius)) continue;
    damageEnemy(e, A.dmg * (st.powerDmg || 1), TMP.normalize().clone(), A.knock);
  }
  for (const b of barrels){
    if (b.mesh.position.distanceTo(pp) < A.radius && b.fuse < 0) b.fuse = 0.2;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < A.radius) damageBoss(A.dmg * (st.powerDmg || 1));
}
// the repulse front: a waist-high ink ring racing out from the body (driven by the VFX loop, so it respects slow-mo)
function spawnPlayerRing(pos, maxR, color){
  inkSprite({ pos: V3(pos.x, pos.y + 1.0, pos.z), normal: V3(0, 1, 0), shape: 'ring', inner: 0.9, color, size: [1.5, (maxR + 2) * 2],
              ease: 3, life: 0.42, fadeAt: 0.3, coreW: 0.25, inkW: 0.3 });
  inkSprite({ pos: V3(pos.x, pos.y + 1.0, pos.z), normal: V3(0, 1, 0), shape: 'ring', inner: 0.93, color, size: [1.2, (maxR + 2) * 1.6],
              ease: 3, life: 0.5, delay: 0.06, op: 0.6, fadeAt: 0.3, coreW: 0.25, inkW: 0.3 });
}

let _throwLight = null;
function throwLight(){
  if (!_throwLight){ _throwLight = new THREE.PointLight(0xffffff, 0, 8); scene.add(_throwLight); }
  return _throwLight;
}
export function saberThrow(){
  const A = abil('throw');
  if (!G.unlocked.throw || player.cds.throw > 0 || player.force < A.cost || shared.saberProj || G.mode !== 'play') return;
  player.force -= A.cost; player.cds.throw = A.cd * (stance().cdMult || 1);
  faceAbilityAim(A.range);   // line the throw up on the nearest target
  castGesture('push', 0.3);  // face the throw direction
  const f = fwd(), pp = playerPos();
  const m = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1.7, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.75, 8),
    new THREE.MeshBasicMaterial({ color: stance().blade, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  // one light that lives in the scene for good and only fades (adding a light per throw recompiles every material)
  const l = throwLight();
  l.color.setHex(stance().blade); l.intensity = 8;
  m.add(blade, glow);
  m.rotation.z = Math.PI/2;
  m.position.set(pp.x + f.x, 1.7, pp.z + f.z);
  scene.add(m);
  player.saberHand.visible = false;
  shared.saberProj = { mesh: m, dir: f.clone(), traveled: 0, returning: false, hitSet: new Set() };
  S.swing();
}
export function updateSaberThrow(dt){
  if (!shared.saberProj) return;
  const A = abil('throw'), sp = shared.saberProj;
  const pp = playerPos();
  if (!sp.returning){
    sp.mesh.position.addScaledVector(sp.dir, A.speed * dt);
    sp.traveled += A.speed * dt;
    if (sp.traveled >= A.range){ sp.returning = true; sp.hitSet.clear(); }
  } else {
    TMP.set(pp.x, 1.7, pp.z).sub(sp.mesh.position);
    const d = TMP.length();
    if (d < 1.2){
      scene.remove(sp.mesh); shared.saberProj = null; throwLight().intensity = 0;
      player.saberHand.visible = true;
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
  if (shared.boss && shared.boss.hp > 0 && !sp.hitSet.has(shared.boss) &&
      sp.mesh.position.distanceTo(shared.boss.group.position.clone().setY(1.7)) < 2.4){
    sp.hitSet.add(shared.boss); damageBoss(A.dmg);
  }
}

/* FORCE PULL — yank the crowd toward your blade */
export function forcePull(){
  const A = abil('pull');
  const st = stance();
  const cost = A.cost * ((st.costMult && st.costMult.pull) || 1);
  if (!G.unlocked.pull || player.cds.pull > 0 || player.force < cost || G.mode !== 'play') return;
  if (player.atkT > 0) cancelSwing();   // flow straight out of a saber swing into the pull
  player.force -= cost; player.cds.pull = A.cd * (st.cdMult || 1);
  faceAbilityAim(A.range);     // face the crowd you're about to yank
  castGesture('pull', 0.36);   // reach out, then claw the hand back
  const f = fwd(), pp = playerPos();
  S.pull();
  G.shake = Math.max(G.shake, 0.3);
  const cosLim = Math.cos(A.angle);
  let n = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || e.state === 'stasis') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (d < 2.5 || !inReach(e, pp, A.range, f, cosLim)) continue;
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
    const at = A.range * (0.75 - i*0.15);
    inkSprite({ pos: V3(pp.x + f.x*at, 1.45, pp.z + f.z*at), normal: f, shape: 'ring', inner: 0.86, color: stance().blade,
                size: [4.2 - i*0.5, 0.7], ease: 2, life: 0.3, delay: i*0.05, op: 0.9 - i*0.2, fadeAt: 0.5, coreW: 0.2, inkW: 0.22,
                vel: f.clone().multiplyScalar(-at / 0.3) });
  }
  if (n) floater(pp, 'PULL', '#7fd4ff');
}

/* FORCE REPULSE — a 360° concussive blast that hurls everything around you away (high-tier) */
export function forceRepulse(){
  const A = abil('repulse'), st = stance();
  const cost = A.cost * (st.powerCostMul || 1);            // DJEM SO casts cost more...
  if (!G.unlocked.repulse || player.cds.repulse > 0 || player.force < cost || G.mode !== 'play') return;
  const up = !!player.up.repulseUp;                        // the FINAL upgrade supercharges it
  const psc = st.powerScale || 1;                          // ...but erupt with BRUTE scale
  const radius = A.radius * (up ? 1.4 : 1) * psc, dmg = A.dmg * (up ? 1.9 : 1) * (player.up.dmg || 1), knock = A.knock * (up ? 1.35 : 1) * psc;
  player.force -= cost; player.cds.repulse = A.cd * (st.cdMult || 1);
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

function ensureBarrierMesh(){
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
  if (!G.unlocked.barrier || player.cds.barrier > 0 || player.force < A.cost || G.mode !== 'play') return;
  player.force -= A.cost; player.cds.barrier = A.cd * (stance().cdMult || 1);
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
  if (!G.unlocked.mend || player.cds.mend > 0 || player.mendT > 0 || player.force < A.cost || G.mode !== 'play') return;
  if (player.hp >= maxHp()){ floater(playerPos(), 'UNHURT', '#7bffae'); return; }   // don't waste it at full health
  player.force -= A.cost; player.cds.mend = A.cd * (stance().cdMult || 1);
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
  if (!G.unlocked.judge || player.cds.judge > 0 || player.force < A.cost || G.mode !== 'play' || player.judgeT > 0) return;
  player.force -= A.cost;
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
  const f = fwd(), pp = playerPos();
  const cosLim = Math.cos(A.angle);
  const found = [];
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > A.range*0.5) continue;   // the storm arcs out level — not down to the ground from the air
    TMP.y = 0;
    const d = TMP.length();
    if (d < 0.01 || !inReach(e, pp, A.range, f, cosLim)) continue;
    found.push({ e, d });
  }
  found.sort((a,b) => a.d - b.d);
  const up = !!player.up.judgeUp;                                  // the FINAL upgrade — STORM OF JUDGEMENT
  const dmg = A.dmg * (stance().powerDmg || 1) * (up ? 1.9 : 1);
  const maxT = A.targets + (up ? 3 : 0);
  const tpos = [];
  for (const { e } of found.slice(0, maxT)){
    damageEnemy(e, dmg, null, 0);
    if (!e.dead && !e.t.heavy && e.state !== 'ragdoll'){ e.state = 'recover'; e.st = 0.3; }   // lightning locks them up
    tpos.push(V3(e.group.position.x, 1.5, e.group.position.z));
  }
  if (tpos.length < maxT && shared.boss && shared.boss.hp > 0){
    TMP.subVectors(shared.boss.group.position, pp); TMP.y = 0;
    if (TMP.length() < A.range && TMP.normalize().dot(f) > cosLim){
      damageBoss(dmg);
      tpos.push(V3(shared.boss.group.position.x, 2.2, shared.boss.group.position.z));
    }
  }
  player.judgeTargets = tpos;
  if (tpos.length) S.arc(tpos[0]);
}
