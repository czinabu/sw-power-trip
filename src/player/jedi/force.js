// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Force powers: push, slam, saber throw, pull, repulse, barrier, mend, judgement.

import * as THREE from 'three';
import { CFG } from '../../data/config.js';
import { scene } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../../utils.js';
import { acquireParticle, burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, barrels, vfx, player } from '../../state.js';
import { flashLight } from '../../fx/lights.js';
import { fwd, playerPos, stance, maxHp } from '../helpers.js';
import { ensureJudgeLines } from './judgement-fx.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss, bossStun, bossStagger } from '../../boss/boss.js';
import { cancelSwing } from './combat.js';
import { spawnPushWave, spawnGroundShock } from '../../fx/vfx.js';

/* trigger the off-hand reaching gesture used by every Force power */
export function castGesture(kind, dur){ dur *= (stance().castMul || 1); player.castT = dur; player.castMax = dur; player.castKind = kind; }   // SHII-CHO casts snap off faster
// turn the Jedi to FACE the direction an ability is aimed — soft-snaps the yaw onto the nearest foe in
// the frontal cone so powers commit toward the threat (the Force equivalent of the Mando squaring up)
function faceAbilityAim(range){
  // NO aim assist — powers fire exactly where you're aiming. (Kept as a no-op so call sites stay simple.)
}

export function forcePush(){
  const A = CFG.abilities.push;
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
  // a faint puff of energy off the palm
  for (let i = 0; i < 5; i++){
    const m = acquireParticle();
    m.material.color.setHex(col); m.material.opacity = 0.6;
    m.position.set(pp.x + f.x*1.2 + rand(-0.25,0.25), 1.45 + rand(-0.3,0.3), pp.z + f.z*1.2 + rand(-0.25,0.25));
    m.scale.setScalar(rand(0.5,0.9));
    const spd = rand(7, 13);
    m.userData.vel.set(f.x*spd + rand(-2,2), rand(0,2.5), f.z*spd + rand(-2,2));
    m.userData.life = rand(0.22, 0.42);
  }
  const cosLim = Math.cos(A.angle);
  let pushed = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > A.range*0.4) continue;   // the shove goes level — not down onto foes far below
    TMP.y = 0;
    const d = TMP.length();
    if (d > A.range) continue;
    TMP.normalize();
    if (d > 1.5 && TMP.dot(f) < cosLim) continue;
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
  const A = CFG.abilities.slam;
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
  burst(playerPos().clone(), 0x88ddff, 8, 5, 3);
}
export function slamImpact(){
  const A = CFG.abilities.slam, st = stance();
  const pp = playerPos();
  const col = st.blade;
  S.slam(); S.boom();
  G.shake = Math.max(G.shake, 1.35); G.hitstop = Math.max(G.hitstop, 0.1);   // a heavy CRACK of camera shake on landing
  G.slowmo = Math.min(G.slowmo, 0.6); G.slowmoT = Math.max(G.slowmoT, 0.1);   // a brief beat on landing
  // a clean pair of ground shockwaves — weight without the fireworks
  spawnGroundShock(pp, col, A.radius + 3,  0.42, 0.5);    // core ring
  spawnGroundShock(pp, col, A.radius + 9,  0.72, 0.28);   // wide trailing wave
  // a low ground flash disc + a soft, short-lived impact light
  const dmat = new THREE.MeshBasicMaterial({ color: 0xcfe6f0, transparent:true, opacity:0.28, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(A.radius*0.6, 36), dmat);
  disc.rotation.x = -Math.PI/2; disc.position.set(pp.x, 0.06, pp.z);
  scene.add(disc);
  vfx.push({ mesh:disc, t:0, dur:0.24, update(kk){ dmat.opacity = 0.28*(1-kk); disc.scale.setScalar(1 + kk*0.6); }});
  flashLight(col, 5, A.radius*1.8, V3(pp.x, 1.0, pp.z), 0.3);
  // a low dust kick + a little tumbling debris — grounded, not a geyser
  burst(V3(pp.x, 0.25, pp.z), 0xbcd2dc, 24, 12, 3, 0.9);   // outward dust sheet
  burst(V3(pp.x, 0.35, pp.z), 0x9a9a9a, 14, 9,  7, 1.1);   // tumbling debris
  // a low ring of kicked-up dust spreading out along the ground
  for (let n = 0; n < 14; n++){ const a = (n/14)*Math.PI*2; burst(V3(pp.x + Math.cos(a)*1.2, 0.15, pp.z + Math.sin(a)*1.2), 0xbcd2dc, 1, 8, 1, 1.0); }
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    if (TMP.length() > A.radius) continue;
    damageEnemy(e, A.dmg * (st.powerDmg || 1), TMP.normalize().clone(), A.knock);
  }
  for (const b of barrels){
    if (b.mesh.position.distanceTo(pp) < A.radius && b.fuse < 0) b.fuse = 0.2;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < A.radius) damageBoss(A.dmg * (st.powerDmg || 1));
}
function spawnPlayerRing(pos, maxR){
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = Math.PI/2; m.position.copy(pos); m.position.y = 0.3;
  scene.add(m);
  let r = 1;
  const grow = () => {
    r += 0.8;
    m.scale.set(r, r, 1);
    m.material.opacity = Math.max(0, 0.8 * (1 - r/(maxR+2)));
    if (r < maxR + 2) requestAnimationFrame(grow);
    else scene.remove(m);
  };
  grow();
}

export function saberThrow(){
  const A = CFG.abilities.throw;
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
  const l = new THREE.PointLight(stance().blade, 8, 8);
  m.add(blade, glow, l);
  m.rotation.z = Math.PI/2;
  m.position.set(pp.x + f.x, 1.7, pp.z + f.z);
  scene.add(m);
  player.saberHand.visible = false;
  shared.saberProj = { mesh: m, dir: f.clone(), traveled: 0, returning: false, hitSet: new Set() };
  S.swing();
}
export function updateSaberThrow(dt){
  if (!shared.saberProj) return;
  const A = CFG.abilities.throw, sp = shared.saberProj;
  const pp = playerPos();
  if (!sp.returning){
    sp.mesh.position.addScaledVector(sp.dir, A.speed * dt);
    sp.traveled += A.speed * dt;
    if (sp.traveled >= A.range){ sp.returning = true; sp.hitSet.clear(); }
  } else {
    TMP.set(pp.x, 1.7, pp.z).sub(sp.mesh.position);
    const d = TMP.length();
    if (d < 1.2){
      scene.remove(sp.mesh); shared.saberProj = null;
      player.saberHand.visible = true;
      return;
    }
    TMP.normalize();
    sp.mesh.position.addScaledVector(TMP, A.speed * 1.3 * dt);
  }
  sp.mesh.rotation.y += dt * 22;
  for (const e of enemies){
    if (e.dead || e.converted || sp.hitSet.has(e)) continue;
    if (sp.mesh.position.distanceTo(e.group.position.clone().setY(1.7)) < 2.0){
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
  const A = CFG.abilities.pull;
  const st = stance();
  const cost = A.cost * ((st.costMult && st.costMult.pull) || 1);
  if (!G.unlocked.pull || player.cds.pull > 0 || player.force < cost || G.mode !== 'play') return;
  if (player.atkT > 0) cancelSwing();   // flow straight out of a saber swing into the pull
  player.force -= cost; player.cds.pull = A.cd * (st.cdMult || 1);
  faceAbilityAim(A.range);     // face the crowd you're about to yank
  castGesture('pull', 0.36);   // reach out, then claw the hand back
  const f = fwd(), pp = playerPos();
  sfx(60, 0.45, 'sine', 0.2, 220);
  G.shake = Math.max(G.shake, 0.3);
  const cosLim = Math.cos(A.angle);
  let n = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || e.state === 'stasis') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (d > A.range || d < 2.5) continue;
    TMP.normalize();
    if (TMP.dot(f) < cosLim) continue;
    burst(V3(e.group.position.x, 1.5, e.group.position.z), 0x88ddff, 4, 4, 3);
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
  if (n) floater(pp, 'PULL', '#7fd4ff');
}

/* FORCE REPULSE — a 360° concussive blast that hurls everything around you away (high-tier) */
export function forceRepulse(){
  const A = CFG.abilities.repulse, st = stance();
  const cost = A.cost * (st.powerCostMul || 1);            // DJEM SO casts cost more...
  if (!G.unlocked.repulse || player.cds.repulse > 0 || player.force < cost || G.mode !== 'play') return;
  const up = !!player.up.repulseUp;                        // the FINAL upgrade supercharges it
  const psc = st.powerScale || 1;                          // ...but erupt with BRUTE scale
  const radius = A.radius * (up ? 1.4 : 1) * psc, dmg = A.dmg * (up ? 1.9 : 1) * (player.up.dmg || 1), knock = A.knock * (up ? 1.35 : 1) * psc;
  player.force -= cost; player.cds.repulse = A.cd * (st.cdMult || 1);
  castGesture('push', 0.34);
  const pp = playerPos(), col = stance().blade;
  spawnPlayerRing(pp.clone(), radius);
  spawnGroundShock(pp.clone().setY(0.1), col, radius + 1, 0.4, 0.7);
  spawnGroundShock(pp.clone().setY(0.1), 0xffffff, radius + (up ? 6 : 3), up ? 0.7 : 0.5, 0.4);
  // BIGGER cast burst + a denser wave of particles
  burst(V3(pp.x, 1.5, pp.z), col, up ? 54 : 38, 15, 7, 1.2); burst(V3(pp.x, 1.5, pp.z), 0xffffff, 20, 17, 5);
  for (let n = 0; n < (up ? 22 : 14); n++) burst(V3(pp.x + rand(-0.6,0.6), rand(0.4,2.4), pp.z + rand(-0.6,0.6)), col, 1, 9, 4, 1.0);
  screenFlash('radial-gradient(ellipse at center, rgba(150,210,255,'+(up?0.55:0.4)+'), transparent 60%)', up ? 0.9 : 0.6, 0.32);
  G.shake = Math.max(G.shake, up ? 1.5 : 1.1); G.hitstop = Math.max(G.hitstop, 0.1);
  S.slam(); S.boom(); sfx(70, 0.4, 'sine', 0.2, 24);
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > radius*0.7) continue;   // the blast bursts from YOU — it can't reach foes far below mid-air
    TMP.y = 0;
    if (TMP.length() > radius) continue;
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
  const geo = new THREE.SphereGeometry(1.7, 20, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  shared._barrierMesh = new THREE.Mesh(geo, mat);
  shared._barrierMesh.visible = false;
  scene.add(shared._barrierMesh);
}
// a ring of CONTROL knockback from the barrier (low/no damage) — shoves the swarm off you
export function barrierShove(power, knock){
  const A = CFG.abilities.barrier, pp = playerPos();
  spawnGroundShock(pp.clone().setY(0.1), 0x6fd0ff, A.knockR, 0.4, power);
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    if (TMP.length() > A.knockR) continue;
    const kd = TMP.normalize().clone();
    damageEnemy(e, 1, kd, knock); flinchEnemy(e, kd, 0.3);   // pure shove — ~no damage
  }
}
export function forceBarrier(){
  const A = CFG.abilities.barrier;
  if (!G.unlocked.barrier || player.cds.barrier > 0 || player.force < A.cost || G.mode !== 'play') return;
  player.force -= A.cost; player.cds.barrier = A.cd * (stance().cdMult || 1);
  player.barrierT = A.dur;
  ensureBarrierMesh();
  castGesture('push', 0.3);
  const pp = playerPos(), col = 0x6fd0ff;
  spawnGroundShock(pp.clone().setY(0.1), col, A.radius, 0.4, 0.6);
  burst(V3(pp.x, 1.4, pp.z), col, 26, 7, 4, 1.0); burst(V3(pp.x, 1.4, pp.z), 0xffffff, 12, 9, 4);
  screenFlash('radial-gradient(ellipse at center, rgba(120,210,255,.35), transparent 60%)', 0.5, 0.3);
  G.shake = Math.max(G.shake, 0.4);
  barrierShove(0.7, A.castKnock);   // CAST — a firm shove clears space around you as the bubble snaps up
  S.push(); sfx(420, 0.3, 'sine', 0.12, 1200); sfx(120, 0.25, 'sine', 0.1, 60);
  floater(pp, 'FORCE BARRIER', '#bfe8ff');
}

/* FORCE MEND — CHANNEL the Force inward to knit your wounds. A ~0.7s wind-up (a clear, committed "patch up in
   a safe window" beat) with a BLUE force glow + green healing motes, then a big restorative pulse on completion.
   Steep cost + long cooldown: deliberate, never a spammable regen. */
const MEND_CHANNEL = 0.7;
export function forceMend(){
  const A = CFG.abilities.mend;
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
  const A = CFG.abilities.mend, pp = playerPos();
  const healed = Math.min(maxHp() - player.hp, Math.round(maxHp() * A.heal));
  player.hp += healed;
  player.lastHurt = G.gt;   // mending resets the passive-regen delay window
  spawnGroundShock(pp.clone().setY(0.1), 0x53ff8c, 3.0, 0.5, 0.55);
  burst(V3(pp.x, 1.4, pp.z), 0x53ff8c, 34, 7, 5, 1.1); burst(V3(pp.x, 1.2, pp.z), 0xc8ffd8, 16, 5, 4);
  for (let i = 0; i < 16; i++) burst(V3(pp.x + rand(-0.5,0.5), rand(0.2,2.3), pp.z + rand(-0.5,0.5)), 0x7bffae, 1, 3, 5, 0.9);
  screenFlash('radial-gradient(ellipse at center, rgba(80,255,140,.32), transparent 60%)', 0.5, 0.36);
  floater(V3(pp.x, 1.0, pp.z), '+' + healed, '#7bffae');
  sfx(440, 0.35, 'sine', 0.13, 980); sfx(880, 0.3, 'sine', 0.08, 1500);   // a bright restorative chime
}

/* FORCE JUDGEMENT — channel chain lightning through the front cone */
export function forceJudgement(){
  const A = CFG.abilities.judge;
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
  const A = CFG.abilities.judge;
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
    if (d > A.range || d < 0.01) continue;
    if (TMP.normalize().dot(f) < cosLim) continue;
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
  if (tpos.length) sfx(rand(1400, 2100), 0.06, 'sawtooth', 0.035, 300);
}
