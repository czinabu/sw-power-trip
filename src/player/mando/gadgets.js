// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mando gadgets: rockets, whistling birds, detonators, grapple, jet slam, boost dash, bacta stim (the E melee kit is in melee.js).

import * as THREE from 'three';
import { scene } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, TMP, clamp } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, rockets, birds, detos, enemies, barrels, solids, keys, player } from '../../state.js';
import { MANDO } from '../../data/mando.js';
import { flashLight } from '../../fx/lights.js';
import { fwd, rightV, playerPos, maxHp } from '../helpers.js';
import { damageEnemy, flinchEnemy, staggerEnemy } from '../../enemies/damage.js';
import { damageBoss, bossStagger } from '../../boss/boss.js';
import { spawnHitSpark, spawnGroundShock } from '../../fx/vfx.js';
import { collideSolids } from '../../world/collision.js';
import { explosion, inkSprite, sparks, puff, motes, muzzleFlash, screenAngle, dustRing } from '../../fx/ink.js';
import { mandoAimPoint, mandoAimRay, aCost } from './weapons.js';
import { abil } from '../../data/mastery.js';
import { sweepHit, distToBody, chestPos } from '../../enemies/bodyshape.js';
import { tutEvent } from '../../game/tutor-bus.js';

// BACTA STIM (G) — the Mando's mirror of Force Mend: a quick injector channel that restores the same big chunk of
// vitality (reuses the mendT channel + mendComplete). Steep Force + long cooldown; locked against HUNTER'S CREED.
export function bactaStim(){
  const A = abil('bacta');
  if (!G.unlocked.bacta || player.cds.bacta > 0 || player.mendT > 0 || player.force < aCost(A.cost) || G.mode !== 'play') return;
  if (player.hp >= maxHp()){ floater(playerPos(), 'UNHURT', '#7bffae'); return; }
  player.force -= aCost(A.cost); player.cds.bacta = A.cd;
  player.mendT = player.mendMax = A.channel;   // a FAST stim — quicker than the Jedi channel
  const pp = playerPos();
  spawnGroundShock(pp.clone().setY(0.1), 0x6fffc0, 2.0, 0.5, 0.5);
  motes(V3(pp.x, pp.y + 0.3, pp.z), 0x9fffd0, 8, 0.45, { delay: 0.3 });
  S.dash(); sfx(300, 0.4, 'sine', 0.08, 880); sfx(520, 0.4, 'sine', 0.05, 1180);
  floater(V3(pp.x, 1.0, pp.z), 'BACTA STIM…', '#9fffd0');
}
export function mandoRocket(){
  const A = abil('rocket');
  if (!G.unlocked.rocket || player.cds.rocket > 0 || player.force < aCost(A.cost)) return;
  player.force -= aCost(A.cost); player.cds.rocket = A.cd; player.aiming = 0.6;
  const pp = playerPos();
  const f = fwd();
  const origin = V3(pp.x + f.x*0.6, pp.y + 1.4, pp.z + f.z*0.6);
  const aim = mandoAimPoint();   // fly the rocket toward the crosshair (with the same slight magnetism)
  const dir = V3(aim.x - origin.x, aim.y - origin.y, aim.z - origin.z).normalize();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.26, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.6, roughness: 0.4 }));
  m.position.copy(origin); m.quaternion.setFromUnitVectors(V3(0,1,0), dir);
  scene.add(m);
  rockets.push({ mesh: m, dir: dir.clone(), speed: A.speed, life: 3 });
  // launch FEEL: muzzle smoke + flash, a back-kick of recoil, a screen punch
  muzzleFlash(origin, dir, 0xffb04a, 1.1);
  for (let n = 0; n < 3; n++) puff(origin.clone().addScaledVector(dir, 0.5 + n*0.35), 0x8a8580, 0.45, 0.35, V3(rand(-1,1), rand(0.5,1.5), rand(-1,1)), { delay: n*0.03, op: 0.8 });
  player.vel.addScaledVector(f, -3.5);   // the launch shoves you back a touch
  player.recoil = 0.3;
  G.shake = Math.max(G.shake, 0.3);
  S.rocket(); sfx(70, 0.3, 'sawtooth', 0.08, 48);
  floater(pp, 'ROCKET', '#ffd24a');
}
function rocketExplode(pos, big){
  const A = big ? abil('jetmissile') : abil('rocket');
  const dmgMul = player.up.dmg * (player.up.rocketDmg || 1), radius = A.radius * (player.up.rocketR || 1);
  const scale = big ? 1.9 : 1;
  S.boom(pos, big ? 1.8 : 1.1);
  G.shake = Math.max(G.shake, big ? 1.7 : 1.0); G.hitstop = Math.max(G.hitstop, big ? 0.1 : 0.05);
  explosion(pos, radius, big);
  if (big) spawnGroundShock(pos.clone().setY(0.1), 0xff7a3a, radius + 9, 0.8, 0.3);
  burst(pos, 0x5a5a5a, 8*scale, 8, 9, 1.2);   // tumbling debris chunks
  flashLight(0xffa040, big ? 18 : 10, radius*2.8, pos, 0.34);
  if (big) screenFlash('radial-gradient(ellipse at center, rgba(255,150,70,.5), rgba(255,90,40,.15) 50%, transparent 70%)', 0.9, 0.4);
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const d = distToBody(e, pos);   // the blast reaches the body, not just the feet
    if (d < radius){ const kd = TMP.subVectors(e.group.position, pos).setY(0).normalize().clone(); damageEnemy(e, A.dmg * (1 - d/radius*0.4) * dmgMul, kd, A.knock); flinchEnemy(e, kd, big ? 0.9 : 0.6); if (!big) tutEvent('rocketHit', e); }
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pos) < radius + 1){
    damageBoss(A.dmg * dmgMul);
    // a well-placed rocket during his wind-up BLOWS THE SWING APART — the Mando's opening (like a parry)
    if (shared.boss.hp > 0 && (shared.boss.state === 'windup' || shared.boss.state === 'lightning' || shared.boss.state === 'chase')) bossStagger();
  }
  for (const b of barrels){ if (b.mesh.position.distanceTo(pos) < radius && b.fuse < 0) b.fuse = 0.15; }
}
/* ===== JETPACK MISSILE (Z) — Boba Fett back-launcher: a slow heavy missile with a HUGE blast ===== */
export function mandoJetMissile(){
  const A = abil('jetmissile');
  if (!G.unlocked.jetmissile || player.cds.missile > 0 || player.force < aCost(A.cost)) return;
  player.force -= aCost(A.cost); player.cds.missile = A.cd; player.aiming = 0.8;
  player.missileT = MANDO.missileLean.time;   // he leans in over the launch (player/animation.js)
  const pp = playerPos(), f = fwd();
  const origin = V3();
  if (player.jetMissileMesh && player.jetMissileMesh.visible) player.jetMissileMesh.getWorldPosition(origin);   // launch from the pack-mounted missile
  else origin.set(pp.x - f.x*0.3, pp.y + 1.9, pp.z - f.z*0.3);
  const aim = mandoAimPoint();
  const dir = V3(aim.x - origin.x, aim.y - origin.y, aim.z - origin.z).normalize();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0xcdd6e0, metalness: 0.6, roughness: 0.4 }));
  m.position.copy(origin); m.quaternion.setFromUnitVectors(V3(0,1,0), dir);
  scene.add(m);
  rockets.push({ mesh: m, dir: dir.clone(), speed: A.speed, life: 3.4, big: true });
  muzzleFlash(origin, dir, 0xffb04a, 1.6);
  for (let n = 0; n < 4; n++) puff(origin.clone().addScaledVector(dir, 0.6 + n*0.4), 0x8a8580, 0.6, 0.4, V3(rand(-1.5,1.5), rand(0.5,2), rand(-1.5,1.5)), { delay: n*0.03, op: 0.8 });
  player.vel.addScaledVector(f, -5);   // a serious kick
  player.recoil = 0.45; G.shake = Math.max(G.shake, 0.5);
  S.rocket(); S.jetIgnite(); sfx(56, 0.4, 'sawtooth', 0.1, 40);
  floater(pp, 'JETPACK MISSILE', '#ff9a4a');
}
export function updateRockets(dt){
  for (let i = rockets.length-1; i >= 0; i--){
    const rk = rockets[i]; rk.life -= dt;
    rk.prev = (rk.prev || new THREE.Vector3()).copy(rk.mesh.position);
    rk.mesh.position.addScaledVector(rk.dir, rk.speed * dt);
    // a hot exhaust trail — a flickering cel flame at the nozzle and a rope of ink-rimmed smoke left hanging
    rk.trailT = (rk.trailT || 0) - dt;
    if (rk.trailT <= 0){
      rk.trailT = 0.022;
      const tail = rk.mesh.position.clone().addScaledVector(rk.dir, rk.big ? -0.45 : -0.28);
      inkSprite({ pos: tail, shape: 'star', points: 2, sharp: 0.2, color: 0xffa13a, size: [rk.big ? 0.95 : 0.7, 0.3], life: 0.07, steps: 2,
                  rot: screenAngle(rk.dir), coreW: 0.45 });
      puff(tail, 0x9a948c, rk.big ? 0.6 : 0.42, rand(0.4, 0.6), V3(rand(-0.4,0.4), rand(0.3,0.9), rand(-0.4,0.4)), { grow0: 0.6, shade: 0.32, op: 0.85 });
    }
    const p = rk.mesh.position;
    let hit = rk.life <= 0 || p.y <= 0.2;
    // contact fuse: it goes off the moment its path touches a body (swept, so a fast rocket can't pass through one)
    if (!hit) for (const e of enemies){ if (e.dead || e.converted) continue; const h = sweepHit(e, rk.prev || p, p, rk.big ? 0.45 : 0.3); if (h){ p.lerpVectors(rk.prev || p, p, h.t); hit = true; break; } }
    if (!hit && shared.boss && shared.boss.hp > 0 && p.distanceTo(shared.boss.group.position.clone().setY(p.y)) < (rk.big ? 2.4 : 1.8) && p.y < shared.boss.group.position.y + 4.2) hit = true;   // (a rocket aimed over his head flies on)
    if (hit){ rocketExplode(p.clone(), rk.big); scene.remove(rk.mesh); rockets.splice(i,1); }
  }
}

/* ===== WHISTLING BIRDS — a swarm of homing micro-missiles (V) ===== */
export function whistlingBirds(){
  const A = abil('birds');
  if (!G.unlocked.birds || player.cds.birds > 0 || player.force < aCost(A.cost)) return;
  player.force -= aCost(A.cost); player.cds.birds = A.cd; player.aiming = 0.6;
  const pp = playerPos();
  // DISTRIBUTE the swarm — assign each bird a DIFFERENT nearby foe (round-robin), so they only pile onto one
  // target if there's only one in range
  const foes = enemies.filter(e => !e.dead && !e.converted && e.state !== 'spawn')
    .sort((a, b) => a.group.position.distanceTo(pp) - b.group.position.distanceTo(pp)).slice(0, A.count);
  if (shared.boss && shared.boss.hp > 0 && foes.length < A.count) foes.push(shared.boss);
  for (let i = 0; i < A.count; i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
    m.position.set(pp.x + rand(-0.3,0.3), 1.6 + rand(0,0.4), pp.z + rand(-0.3,0.3));
    scene.add(m);
    const a = Math.random()*Math.PI*2;
    birds.push({ mesh: m, vel: V3(Math.cos(a)*7, rand(7,11), Math.sin(a)*7), life: 2.6, armed: 0.28, tgt: foes.length ? foes[i % foes.length] : null });
  }
  S.zap(); sfx(2200, 0.18, 'sine', 0.05, 1400); sfx(1700, 0.22, 'sine', 0.04, 900);
  floater(pp, 'WHISTLING BIRDS', '#bfe8ff');
}
export function updateBirds(dt){
  for (let i = birds.length-1; i >= 0; i--){
    const bd = birds[i]; bd.life -= dt; bd.armed -= dt;
    if (bd.armed <= 0){
      // pick / keep a living target, steer toward it
      if (!bd.tgt || bd.tgt.dead || bd.tgt.converted){
        let best = null, bdd = 1e9;
        for (const e of enemies){ if (e.dead || e.converted || e.state === 'spawn') continue; const d = e.group.position.distanceTo(bd.mesh.position); if (d < bdd){ bdd = d; best = e; } }
        if (!best && shared.boss && shared.boss.hp > 0) best = shared.boss;
        bd.tgt = best;
      }
      if (bd.tgt){
        const tp = bd.tgt === shared.boss ? bd.tgt.group.position.clone().setY(bd.tgt.group.position.y + 1.2) : chestPos(bd.tgt);
        TMP.set(tp.x - bd.mesh.position.x, tp.y - bd.mesh.position.y, tp.z - bd.mesh.position.z).normalize();
        bd.vel.lerp(TMP.multiplyScalar(abil('birds').speed), Math.min(1, dt*6));
      }
    }
    bd.prev = (bd.prev || new THREE.Vector3()).copy(bd.mesh.position);
    bd.mesh.position.addScaledVector(bd.vel, dt);
    // each bird whistles along on a thin cel contrail
    bd.trailT = (bd.trailT || 0) - dt;
    if (bd.trailT <= 0){ bd.trailT = 0.03;
      inkSprite({ pos: bd.mesh.position, shape: 'disc', color: 0x9fd6ff, size: [0.32, 0.08], life: 0.22, steps: 3, coreW: 0.5, inkW: 0.2 }); }
    // detonate on contact (or expiry)
    let hit = bd.life <= 0 || bd.mesh.position.y < 0.15;
    let victim = null;
    if (!hit) for (const e of enemies){ if (e.dead || e.converted) continue; const h = sweepHit(e, bd.prev, bd.mesh.position, 0.2); if (h){ bd.mesh.position.lerpVectors(bd.prev, bd.mesh.position, h.t); hit = true; victim = e; break; } }
    if (!hit && shared.boss && shared.boss.hp > 0 && bd.mesh.position.distanceTo(shared.boss.group.position.clone().setY(bd.mesh.position.y)) < 1.7){ hit = true; victim = shared.boss; }
    if (hit){
      const A = abil('birds'), p = bd.mesh.position.clone();
      explosion(p, abil('birds').radius * 0.55, false); spawnHitSpark(p, 0xdff1ff, 0.8);
      sfx(rand(1600,2200), 0.06, 'sine', 0.04, 700); S.boom(p, 0.25);
      const bdmg = A.dmg * player.up.dmg * (player.up.rocketDmg || 1);
      for (const e of enemies){ if (e.dead || e.converted || e.state === 'spawn') continue; const d = distToBody(e, p); if (d < A.radius){ const kd = TMP.subVectors(e.group.position, p).setY(0).normalize().clone(); damageEnemy(e, bdmg, kd, A.knock); flinchEnemy(e, kd, 0.3); } }
      if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(p) < A.radius) damageBoss(bdmg);
      scene.remove(bd.mesh); birds.splice(i,1);
    }
  }
}

/* ===== THERMAL DETONATOR — a sticky grenade that arms, then blows (V) ===== */
/* THERMAL DETONATOR — thrown where the reticle is: onto the foe it's over, else the spot on the floor it points at,
   held between minRange and range (aimed at the sky, it goes as far as it can). */
const DETO_G = 26;
function detoTarget(A, from){
  const aim = mandoAimPoint(), ray = mandoAimRay();
  const o = ray.origin, d = ray.direction, floor = 0;   // (the floor it rests on: updateDetos)
  let to;
  if (player.lockOn) to = V3(aim.x, Math.max(floor + 0.16, aim.y - 0.6), aim.z);
  else if (d.y < -1e-3) to = V3(o.x + d.x * (floor - o.y) / d.y, floor + 0.16, o.z + d.z * (floor - o.y) / d.y);
  else to = V3(from.x + d.x * 1e3, floor + 0.16, from.z + d.z * 1e3);
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz) || 1;
  const k = clamp(dist, A.minRange, A.range) / dist;
  if (k !== 1){ to.x = from.x + dx * k; to.z = from.z + dz * k; if (!player.lockOn) to.y = floor + 0.16; }
  return to;
}
export function thermalDetonator(){
  const A = abil('deto');
  if (!G.unlocked.deto || player.cds.deto > 0 || player.force < aCost(A.cost)) return;
  player.force -= aCost(A.cost); player.cds.deto = A.cd; player.aiming = 0.6;
  const pp = playerPos();
  const from = V3(pp.x, pp.y + 1.5, pp.z), to = detoTarget(A, from);
  // lobbed to land on it: a short flight up close, a longer arc far out (all inside the fuse)
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz);
  const T = A.flight[0] + (A.flight[1] - A.flight[0]) * clamp((dist - A.minRange) / (A.range - A.minRange), 0, 1);
  const vel = V3(dx / T, (to.y - from.y + 0.5 * DETO_G * T * T) / T, dz / T);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.6, roughness: 0.4 }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12), new THREE.MeshBasicMaterial({ color: 0xff5a2a }));
  band.rotation.x = Math.PI/2; m.add(band);
  m.position.copy(from); scene.add(m);
  detos.push({ mesh: m, band, vel, fuse: A.fuse, stuck: null, stuckOff: null });
  S.jump(); sfx(300, 0.1, 'square', 0.04, 160);
  floater(pp, 'DETONATOR', '#ff8a3a');
}
export function updateDetos(dt){
  for (let i = detos.length-1; i >= 0; i--){
    const g = detos[i]; g.fuse -= dt;
    if (g.stuck){
      // ride the enemy it stuck to
      if (g.stuck.dead) g.stuck = null;
      else g.mesh.position.copy(g.stuck.group.position).add(g.stuckOff);
    } else {
      g.vel.y -= DETO_G*dt;
      g.prev = (g.prev || new THREE.Vector3()).copy(g.mesh.position);
      g.mesh.position.addScaledVector(g.vel, dt);
      if (g.mesh.position.y <= 0.16){ g.mesh.position.y = 0.16; g.vel.set(0,0,0); }
      // stick to the first enemy it touches, where it touches
      for (const e of enemies){ if (e.dead || e.converted) continue; const h = sweepHit(e, g.prev, g.mesh.position, 0.15); if (h){ g.mesh.position.lerpVectors(g.prev, g.mesh.position, h.t); g.stuck = e; g.stuckOff = g.mesh.position.clone().sub(e.group.position); floater(e.group.position, 'STUCK!', '#ff8a3a'); break; } }
      collideSolids(g.mesh.position, 0.2, false);
    }
    // blink faster as the fuse runs out
    const blink = Math.sin(G.gt * (10 + (1.15 - g.fuse)*30)) > 0;
    g.band.material.color.setHex(blink ? 0xffd24a : 0xff3a1a);
    if (g.fuse <= 0){
      const A = abil('deto'), p = g.mesh.position.clone();
      S.boom(p, 1.3); G.shake = Math.max(G.shake, 0.9); G.hitstop = Math.max(G.hitstop, 0.05);
      explosion(p, A.radius, false);
      burst(p, 0x6a6a6a, 8, 8, 8, 1.1);
      flashLight(0xffa040, 9, A.radius*2.6, p, 0.3);
      const ddmg = A.dmg * player.up.dmg * (player.up.rocketDmg || 1);
      for (const e of enemies){ if (e.dead || e.converted || e.state === 'spawn') continue; const d = distToBody(e, p); if (d < A.radius){ const kd = TMP.subVectors(e.group.position, p).setY(0).normalize().clone(); damageEnemy(e, ddmg * (1 - d/A.radius*0.4), kd, A.knock); flinchEnemy(e, kd, 0.6); } }
      if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(p) < A.radius + 1){ damageBoss(ddmg); if (shared.boss.hp > 0 && (shared.boss.state === 'windup' || shared.boss.state === 'lightning' || shared.boss.state === 'chase')) bossStagger(); }
      for (const b of barrels){ if (b.mesh.position.distanceTo(p) < A.radius && b.fuse < 0) b.fuse = 0.15; }
      scene.remove(g.mesh); detos.splice(i,1);
    }
  }
}

/* ===== GRAPPLING HOOK — reel toward cover/big foes, or yank a light foe to you (C) ===== */
export function grappleHook(){
  const A = abil('grapple');
  if (!G.unlocked.grapple || player.cds.grapple > 0 || player.force < aCost(A.cost) || player.grappleActive) return;
  const pp = playerPos(), aim = mandoAimPoint();
  const dir = V3(aim.x - pp.x, aim.y - (pp.y+1.4), aim.z - pp.z).normalize();
  // find the nearest enemy OR solid roughly along the aim within range
  let tgt = null, tgtPt = null, bestT = A.range, yank = false;
  const o = V3(pp.x, pp.y+1.4, pp.z);
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, o); const along = TMP.dot(dir);
    if (along < 1 || along > bestT) continue;
    const perp = Math.hypot(TMP.x - dir.x*along, TMP.y - dir.y*along, TMP.z - dir.z*along);
    if (perp < 1.6 + along*0.04){ bestT = along; tgt = e; tgtPt = e.group.position.clone().setY(1.4); }
  }
  if (!tgt){   // try a solid (pillar / crate) to reel toward
    for (const c of solids){
      if (c.mound) continue;
      const cx = c.x - o.x, cz = c.z - o.z; const along = cx*dir.x + cz*dir.z;
      if (along < 1.5 || along > bestT) continue;
      const perp = Math.abs(cx*-dir.z + cz*dir.x);
      const cr = (c.box ? Math.hypot(c.hx, c.hz) : c.r) + 1.2;
      if (perp < cr){ bestT = along; tgtPt = V3(c.x - dir.x*((c.box?Math.hypot(c.hx,c.hz):c.r)+0.6), 1.6, c.z - dir.z*((c.box?Math.hypot(c.hx,c.hz):c.r)+0.6)); tgt = null; }
    }
  }
  if (!tgtPt){ if (G.gt - player.lastWinded > 0.4){ player.lastWinded = G.gt; floater(pp, 'NO ANCHOR', '#ff9a66'); } return; }
  player.force -= aCost(A.cost); player.cds.grapple = A.cd; player.aiming = 0.6;
  yank = tgt && !tgt.t.heavy && tgt !== shared.boss;   // light foes get yanked TO you; heavy/boss/cover reel YOU in
  player.grappleActive = { tgt, tgtPt: tgtPt.clone(), yank, t: 0 };
  S.dash(); sfx(900, 0.06, 'square', 0.05, 320); sfx(160, 0.12, 'sawtooth', 0.06, 70);
  floater(pp, yank ? 'YANK!' : 'GRAPPLE', '#9fd6ff');
}

export function updateGrapple(dt){
  const G2 = player.grappleActive;
  if (!shared._grappleLine){ const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); shared._grappleLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xbfe8ff })); shared._grappleLine.frustumCulled = false; shared._grappleLine.visible = false; scene.add(shared._grappleLine); }
  if (!G2){ shared._grappleLine.visible = false; return; }
  G2.t += dt;
  const pp = playerPos();
  const anchor = G2.tgt && !G2.tgt.dead ? (G2.tgt.group ? G2.tgt.group.position.clone().setY(1.4) : G2.tgtPt) : G2.tgtPt;
  // draw the cable
  shared._grappleLine.visible = true;
  const a = shared._grappleLine.geometry.attributes.position;
  a.setXYZ(0, pp.x, pp.y+1.45, pp.z); a.setXYZ(1, anchor.x, anchor.y, anchor.z); a.needsUpdate = true;
  if (G2.yank && G2.tgt && !G2.tgt.dead){
    // pull the foe toward the player
    TMP.set(pp.x - G2.tgt.group.position.x, 0, pp.z - G2.tgt.group.position.z); const d = TMP.length();
    if (d < 2.2 || G2.t > 0.6){ G2.tgt.state = 'stagger'; G2.tgt.st = 0.7; G2.tgt.stumble = 0.2; player.grappleActive = null; return; }
    TMP.normalize(); G2.tgt.group.position.addScaledVector(TMP, abil('grapple').pullSpeed * 0.6 * dt);
    if (Math.random() < 0.5) burst(G2.tgt.group.position.clone().setY(1.4), 0x9fd6ff, 1, 3, 2, 0.5);
  } else {
    // reel the player toward the anchor
    TMP.set(anchor.x - pp.x, 0, anchor.z - pp.z); const d = TMP.length();
    if (d < 2.2 || G2.t > 0.7){ player.grappleActive = null; player.vel.multiplyScalar(0.4); return; }
    TMP.normalize(); player.vel.addScaledVector(TMP, abil('grapple').pullSpeed * dt * 4);
    player.vy = Math.max(player.vy, 3.5);   // a little lift so you clear ledges
    if (Math.random() < 0.5) burst(V3(pp.x, pp.y+1.2, pp.z), 0x9fd6ff, 1, 3, 2, 0.5);
  }
}

/* ===== JETPACK SLAM — dive from the air for a ground shockwave (X) ===== */
export function jetSlam(){
  if (G.mode !== 'play' || !G.unlocked.slam || player.grounded || player.slamming || player.jet < abil('mslam').cost) return;
  const A = abil('mslam');
  player.jet -= A.cost;
  player.aiming = 0.5;
  player.slamming = true; player.flip = null; player.slamWind = A.wind; player.slamTop = playerPos().y;
  player.vel.multiplyScalar(0.3); player.moveVel.multiplyScalar(0.3);
  player.vy = Math.max(player.vy * 0.2, A.rise);   // the pack fires up: a short rise into the wind-up
  const pp = playerPos();
  sparks(V3(pp.x, pp.y + 0.9, pp.z), 0x88ddff, 10, 9, { dir: V3(0, -1, 0), cone: 0.4, life: 0.25, grav: 0 });
  S.jetIgnite(); sfx(140, 0.3, 'sawtooth', 0.05, 420);   // spooling up
}
/* the slam's wind-up hang, then the plunge: jets reversed, exhaust streaming up past the helmet */
export function updateJetSlam(dt){
  if (!player.slamming){ player.slamWind = 0; return; }
  const A = abil('mslam'), pp = playerPos();
  if (player.slamWind > 0){
    player.slamWind -= dt;
    player.vel.multiplyScalar(Math.pow(0.1, dt)); player.moveVel.multiplyScalar(Math.pow(0.1, dt));
    player.vy = Math.max(player.vy * Math.pow(0.02, dt), 0.6);   // the rise stalls and hangs at the top
    player.slamTop = Math.max(player.slamTop, pp.y);
    if (Math.random() < dt * 30) sparks(V3(pp.x, pp.y + 1.0, pp.z), 0x66c6ff, 2, 6, { dir: V3(0, -1, 0), cone: 0.3, life: 0.12, grav: 0 });
    if (player.slamWind > 0) return;
    player.slamWind = 0;
    player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0);
    player.vy = -A.diveVel;                          // the jets flip: straight down
    S.dash(); sfx(70, 0.35, 'sawtooth', 0.08, 30); G.shake = Math.max(G.shake, 0.3);
    puff(V3(pp.x, pp.y + 2.2, pp.z), 0xb8c2c8, 1.2, 0.45, V3(0, 4, 0));
    return;
  }
  player.vy = Math.min(player.vy, -A.diveVel);       // nothing slows the drop
  if (Math.random() < dt * 40) sparks(V3(pp.x + rand(-0.2, 0.2), pp.y + 1.6, pp.z + rand(-0.2, 0.2)), 0x9fe0ff, 2, 14, { dir: V3(0, 1, 0), cone: 0.15, life: 0.16, grav: 0, size: 0.4 });
}
export function mandoSlamImpact(){
  const A = abil('mslam'), pp = playerPos();
  // the drop pays: from fallFull up, the full boost to damage and reach
  const fall = clamp(((player.slamTop ?? pp.y) - pp.y) / A.fallFull, 0, 1), k = 1 + (A.boost - 1) * fall;
  const radius = A.radius * k, dmg = A.dmg * player.up.dmg * k;
  player.slamTop = null;
  S.slam(pp); S.boom(pp, 1.0 + 0.4 * fall); S.heavy();
  G.shake = Math.max(G.shake, 1.5 + 0.3 * fall); G.hitstop = Math.max(G.hitstop, 0.13);
  G.slowmo = Math.min(G.slowmo, 0.55); G.slowmoT = Math.max(G.slowmoT, 0.14);   // a beat on the impact
  player.landDip = 0.45 + 0.2 * fall;                                          // the view drops with him
  screenFlash('radial-gradient(ellipse at center, rgba(140,210,255,.35), transparent 60%)', 0.45, 0.22);
  spawnGroundShock(pp, 0xffffff, 3.2, 0.22, 0.8);           // the white crack at the fist
  spawnGroundShock(pp, 0x9ad8ff, radius + 2, 0.4, 0.6);
  spawnGroundShock(pp, 0x66c6ff, radius + 7, 0.7, 0.35);
  inkSprite({ pos: V3(pp.x, pp.y + 0.6, pp.z), shape: 'star', points: 8, sharp: 0.16, color: 0x9ad8ff, size: [1.8, 4.6 + fall], life: 0.18, steps: 2, coreW: 0.4 });
  // the exhaust blast rolls out along the deck
  for (let n = 0; n < 8; n++){ const a = n / 8 * Math.PI * 2;
    puff(V3(pp.x + Math.sin(a) * 0.8, pp.y + 0.3, pp.z + Math.cos(a) * 0.8), 0xb8c2c8, 0.7, 0.45, V3(Math.sin(a) * 10, 0.5, Math.cos(a) * 10), { delay: 0.02, op: 0.7 }); }
  dustRing(pp, radius);
  burst(V3(pp.x, 0.4, pp.z), 0x9a9a9a, 16, 10, 9, 1.2);     // deck plating and grit thrown up
  burst(V3(pp.x, 0.4, pp.z), 0x9ad8ff, 8, 8, 6, 0.8);
  flashLight(0x88ccff, 10, radius*2.4, V3(pp.x, 1, pp.z), 0.35);
  for (const e of enemies){ if (e.dead || e.converted || e.state === 'spawn') continue; const d = distToBody(e, pp); if (d < radius){
    const kd = TMP.subVectors(e.group.position, pp).setY(0).normalize().clone();
    damageEnemy(e, dmg * (1 - d / radius * 0.35), kd, A.knock * k); flinchEnemy(e, kd, 0.9);
    if (!e.dead && d < A.core){ e.state = 'stagger'; e.st = A.stun; e.stumble = 0.3; }   // right under him: knocked flat
  } }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < radius) damageBoss(dmg);
  for (const b of barrels){ if (b.mesh.position.distanceTo(pp) < radius && b.fuse < 0) b.fuse = 0.15; }
}

/* ===== ROCKET BOOST (ground) — spends jetpack fuel ===== */
export function mandoBoostDash(onGround = player.grounded){
  // the ROCKET BOOST on the ground: a long thruster shove with i-frames. A second SHIFT
  // early in a dive (mando/mobility.js mandoShift). In the AIR, SHIFT is the air dodge, and held, the flight boost.
  const A = MANDO.boostDash;
  if (G.mode !== 'play' || !onGround || player.cds.dash > 0 || player.jet < A.fuel) return;
  player.cds.dash = A.cd; player.dashT = A.time; player.dashStartT = G.gt;   // i-frames (+ the perfect-dodge clock)
  player.dodgeKind = 'boost'; player.slideT = 0;
  tutEvent('dash');
  player.jet = Math.max(0, player.jet - A.fuel);
  const dir = V3(0,0,0);
  if (keys['w']) dir.add(fwd());
  if (keys['s']) dir.sub(fwd());
  if (keys['d']) dir.add(rightV());
  if (keys['a']) dir.sub(rightV());
  if (dir.lengthSq() < 0.01) dir.copy(fwd());
  dir.normalize();
  player.vel.addScaledVector(dir, A.speed);
  const bp = playerPos();
  sparks(V3(bp.x - dir.x*0.4, bp.y + 1.2, bp.z - dir.z*0.4), 0x66c6ff, 8, 12, { dir: V3(-dir.x, -0.3, -dir.z), cone: 0.35, life: 0.22, grav: 0 });
  for (let n = 0; n < 3; n++) puff(V3(bp.x - dir.x*(0.5 + n*0.5), bp.y + 0.35, bp.z - dir.z*(0.5 + n*0.5)), 0xb8c2c8, 0.8, 0.4, V3(-dir.x*2, 0.6, -dir.z*2), { delay: n*0.03 });
  S.dash(); sfx(rand(220,300), 0.12, 'triangle', 0.05, 120);
}

