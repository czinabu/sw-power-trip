// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CLONE ARC TROOPER's powers (testing only): what the run hands over or lets him choose (data/trooper-progression.js).
//   Q  RECON SCAN       marks every foe nearby: they take more damage from everyone, and show a tag
//   V  BUBBLE SHIELD    (fork I)  a dome where he stands that stops enemy bolts
//   F  ION GRENADE      (fork II) stuns and drops shields      ·  F  BREACH CHARGE (fork II) a forward blast that launches
//   Z  ARTILLERY        (Commander) shells walk down round the crosshair
//   3  AT LAUNCHER      (Commando) the rifle's anti-armour module (fired by mando/weapons.js: fireLauncher)
//   X  GUNSHIP STRAFE   (the final power) a gunship lays a line of blasts from him toward the crosshair
// Tuning: data/trooper.js TROOPER (read through abil(), so mastery ranks apply). Every cast spends ability energy.

import * as THREE from 'three';
import { G, shared, enemies, player } from '../../state.js';
import { scene } from '../../engine/renderer.js';
import { V3, clamp, rand, TMP } from '../../utils.js';
import { sfx, S } from '../../audio/sfx.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { spawnGroundShock, spawnHitSpark } from '../../fx/vfx.js';
import { explosion, groundRing, sparks } from '../../fx/ink.js';
import { flashLight } from '../../fx/lights.js';
import { palmPoints } from '../../fx/palms.js';
import { fwd, playerPos, maxHp } from '../helpers.js';
import { TROOPER } from '../../data/trooper.js';
import { mandoAimPoint, mandoAimRay } from '../mando/weapons.js';
import { throwGrenade } from '../../enemies/grenades.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { distToBody } from '../../enemies/bodyshape.js';
import { damageBoss } from '../../boss/boss.js';
import { abil } from '../../data/mastery.js';
import { trainAbility } from '../../game/upgrades.js';

const aCost = (c) => c * (player.up.abilityCostMul || 1);
// ready to cast: owned, off cooldown, enough energy (says why not, once in a while)
function ready(key, cdKey, A){
  if (G.mode !== 'play' || !G.unlocked[key]) return false;
  if ((player.cds[cdKey] || 0) > 0) return false;
  if (player.force < aCost(A.cost)){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO ENERGY', '#ff9a66'); sfx(140, 0.06, 'square', 0.04, 90); }
    return false;
  }
  player.force -= aCost(A.cost); player.cds[cdKey] = A.cd;
  return true;
}
// the ground point under the crosshair, clamped to reach
function groundAim(reach, minRange = 0){
  const aim = mandoAimPoint(), ray = mandoAimRay(), o = ray.origin, d = ray.direction, pp = playerPos();
  let to;
  if (player.lockOn) to = V3(aim.x, 0, aim.z);
  else if (d.y < -1e-3) to = V3(o.x + d.x * -o.y / d.y, 0, o.z + d.z * -o.y / d.y);
  else to = V3(pp.x + d.x * 1e3, 0, pp.z + d.z * 1e3);
  const dx = to.x - pp.x, dz = to.z - pp.z, dist = Math.hypot(dx, dz) || 1;
  const k = clamp(dist, minRange, reach) / dist;
  return V3(pp.x + dx * k, 0, pp.z + dz * k);
}
// one blast: damage falling off to the rim, a knock away from the centre, the boss and barrels too
function blast(pos, R, dmg, knock, o = {}){
  const mul = player.up.dmg * (player.up.ordnance || 1);
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const d = distToBody(e, pos);
    if (d >= R) continue;
    const kd = TMP.subVectors(e.group.position, pos).setY(0); if (kd.lengthSq() < 0.01) kd.set(rand(-1, 1), 0, rand(-1, 1));
    kd.normalize();
    const k = kd.clone();
    damageEnemy(e, dmg * (1 - d / R * 0.45) * mul, k, knock); flinchEnemy(e, k, 0.7);
    if (o.lift && !e.dead && !e.t.heavy && e.vel) e.vel.y = Math.max(e.vel.y, o.lift);
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pos) < R + 1) damageBoss(dmg * mul * 0.6);
}
function boom(pos, R, big){
  explosion(pos, R, big);
  burst(V3(pos.x, 1, pos.z), 0xffae2a, big ? 18 : 12, 10, 6);
  flashLight(0xffa040, big ? 12 : 7, R * 2.6, V3(pos.x, 1.2, pos.z), 0.28);
  G.shake = Math.max(G.shake, big ? 0.8 : 0.5); S.boom(pos, big ? 1.4 : 1);
}

/* ---------- the keys (player/trooper/kit.js hands them over) ---------- */
export function trooperPowerKey(k, repeat){
  if (repeat || G.mode !== 'play') return;
  if (k === 'q') reconScan();
  if (k === 'v') bubbleShield();
  if (k === 'f'){ if (G.unlocked.ion) ionGrenade(); else if (G.unlocked.breach) breachCharge(); }
  if (k === 'z') artillery();
  if (k === 'x') strafingRun();
}

/* ---------- RECON SCAN (Q) ---------- */
const scanTags = [];
export function reconScan(){
  const A = abil('scan');
  if (!ready('scan', 'scan', A)) return;
  trainAbility('scan');
  const pp = playerPos(), until = G.gt + A.time;
  groundRing(V3(pp.x, 0.1, pp.z), 0x7fd0ff, A.range, 0.7, 0.8);
  spawnGroundShock(V3(pp.x, 0.1, pp.z), 0x7fd0ff, A.range, 0.6, 0.35);
  sfx(1400, 0.25, 'sine', 0.05, 500); sfx(700, 0.4, 'sine', 0.04, 1600);
  let n = 0;
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    if (Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z) > A.range) continue;
    e.scanT = until; e.scanMul = A.mark; n++;
    if (!e.scanTag){
      const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xff5a4a, toneMapped: false, depthTest: false, transparent: true }));
      tag.renderOrder = 998; scene.add(tag); e.scanTag = tag; scanTags.push(e);
    }
  }
  floater(pp, n ? 'SCAN · ' + n + ' MARKED' : 'SCAN · ALL CLEAR', '#9fd4ff');
}
function updateScan(){
  for (let i = scanTags.length - 1; i >= 0; i--){
    const e = scanTags[i];
    if (e.dead || !(e.scanT > G.gt) || !e.group.parent){ scene.remove(e.scanTag); e.scanTag = null; scanTags.splice(i, 1); continue; }
    const p = e.group.position;
    e.scanTag.position.set(p.x, p.y + 2.5 * (e.t.scale || 1) + Math.sin(G.gt * 5) * 0.05, p.z);
    e.scanTag.rotation.y += 0.05;
  }
}

/* ---------- BUBBLE SHIELD (V) — enemies/bolts.js asks domeStops() for every enemy bolt ---------- */
const domes = [];
export function bubbleShield(){
  const A = abil('bshield');
  if (!ready('bshield', 'bshield', A)) return;
  trainAbility('bshield');
  const pp = playerPos();
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.position.set(pp.x, 0, pp.z); m.scale.setScalar(0.01); scene.add(m);
  domes.push({ mesh: m, x: pp.x, z: pp.z, R: A.radius, t: 0, life: A.time });
  groundRing(V3(pp.x, 0.1, pp.z), 0x7fd0ff, A.radius, 0.4, 0.9);
  S.dash(); sfx(500, 0.3, 'sine', 0.06, 900);
  floater(pp, 'BUBBLE SHIELD', '#9fd4ff');
}
export function domeStops(p){
  for (const d of domes) if (Math.hypot(p.x - d.x, p.z - d.z) < d.R && p.y < d.R + 0.3){ d.flash = 0.12; sparks(p, 0x9fd4ff, 4, 5, { life: 0.2 }); return true; }
  return false;
}
function updateDomes(dt){
  for (let i = domes.length - 1; i >= 0; i--){
    const d = domes[i]; d.t += dt;
    const grow = clamp(d.t / 0.25, 0, 1), fade = clamp((d.life - d.t) / 0.5, 0, 1);
    d.mesh.scale.setScalar(d.R * grow);
    d.flash = Math.max(0, (d.flash || 0) - dt);
    d.mesh.material.opacity = (0.14 + (d.flash > 0 ? 0.2 : 0) + Math.sin(G.gt * 6) * 0.02) * fade;
    if (d.t >= d.life){ scene.remove(d.mesh); domes.splice(i, 1); }
  }
}

/* ---------- ION GRENADE (F) ---------- */
export function ionGrenade(){
  const A = abil('ion');
  if (!ready('ion', 'ion', A)) return;
  trainAbility('ion');
  player.aiming = 0.6;
  const from = palmPoints(['L'])[0], to = groundAim(A.reach, A.minRange);
  throwGrenade({ t: { blastR: A.radius, fuse: A.fuse, dmg: 0, foeDmg: A.dmg, foeKnock: 2, color: 0x7fd0ff, onBlast: (pos) => ionBurst(pos, A) } }, from, to, true);
  S.jump(); floater(playerPos(), 'ION OUT', '#9fd4ff');
}
function ionBurst(pos, A){
  spawnGroundShock(V3(pos.x, 0.1, pos.z), 0x7fd0ff, A.radius + 1, 0.5, 0.8);
  sparks(V3(pos.x, 1, pos.z), 0x9fe8ff, 18, 10, { life: 0.4 });
  sfx(1800, 0.3, 'sawtooth', 0.04, 300);
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    if (distToBody(e, pos) > A.radius) continue;
    const mech = !!(e.t.droid || e.t.jet || e.t.flier || e.t.kind === 'droid');
    e.state = 'stagger'; e.st = A.stun * (mech ? 2 : 1); e.stumble = 0.2; e.flash = 0.2;
    if (e.t.shield && !e.shieldBroken){ e.shieldHp = 0; e.shieldBroken = true; }
    spawnHitSpark(V3(e.group.position.x, 1.5, e.group.position.z), 0x9fe8ff, 1);
  }
}

/* ---------- BREACH CHARGE (F) ---------- */
const charges = [];
export function breachCharge(){
  const A = abil('breach');
  if (!ready('breach', 'breach', A)) return;
  trainAbility('breach');
  const pp = playerPos(), f = fwd();
  const at = V3(pp.x + f.x * 1.2, 0.08, pp.z + f.z * 1.2);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.22), new THREE.MeshBasicMaterial({ color: 0x2a2c30 }));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 0.2), toneMapped: false }));
  led.position.y = 0.05; m.add(led);
  m.position.copy(at); m.rotation.y = Math.atan2(f.x, f.z); scene.add(m);
  charges.push({ mesh: m, led, f: f.clone(), t: A.fuse, A });
  sfx(900, 0.05, 'square', 0.04, 900);
  floater(pp, 'BREACH CHARGE', '#ffb46a');
}
function updateCharges(dt){
  for (let i = charges.length - 1; i >= 0; i--){
    const c = charges[i]; c.t -= dt;
    c.led.visible = Math.sin(G.gt * (10 + (1 - c.t) * 30)) > 0;
    if (c.t > 0) continue;
    const A = c.A, p = c.mesh.position, cosLim = Math.cos(A.arc);
    scene.remove(c.mesh); charges.splice(i, 1);
    boom(p, 2.5, true);
    for (let s = 1; s <= 4; s++) burst(V3(p.x + c.f.x * s * 2, 1, p.z + c.f.z * s * 2), 0xffae2a, 6, 8, 5);
    const mul = player.up.dmg * (player.up.ordnance || 1);
    for (const e of enemies){
      if (e.dead || e.converted || e.state === 'spawn') continue;
      TMP.subVectors(e.group.position, p); TMP.y = 0;
      const d = TMP.length();
      if (d > A.range || (d > 1 && TMP.normalize().dot(c.f) < cosLim)) continue;
      const k = c.f.clone();
      damageEnemy(e, A.dmg * (1 - d / A.range * 0.4) * mul, k, A.knock); flinchEnemy(e, k, 0.9);
      if (!e.dead && !e.t.heavy && e.vel) e.vel.y = Math.max(e.vel.y, A.lift);
    }
    if (shared.boss && shared.boss.hp > 0){
      TMP.subVectors(shared.boss.group.position, p); TMP.y = 0;
      if (TMP.length() < A.range && TMP.normalize().dot(c.f) > cosLim) damageBoss(A.dmg * mul * 0.6);
    }
  }
}

/* ---------- ARTILLERY BARRAGE (Z, Commander) ---------- */
const strikes = [];   // { x, z, t, R, dmg, knock, mark }
function markAt(x, z, R, color){
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.07, z); ring.scale.setScalar(R); ring.renderOrder = 4; scene.add(ring);
  return ring;
}
export function artillery(){
  const A = abil('artillery');
  if (!ready('artillery', 'artillery', A)) return;
  trainAbility('artillery');
  const c = groundAim(A.reach, 4);
  const mark = markAt(c.x, c.z, A.spread + A.radius * 0.5, 0xff9a4a);
  for (let i = 0; i < A.shells; i++){
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * A.spread;
    strikes.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, t: A.delay + i * A.gap, R: A.radius, dmg: A.dmg, knock: A.knock, whistle: true,
                   mark: i === A.shells - 1 ? mark : null });
  }
  sfx(300, 0.2, 'square', 0.05, 200); sfx(600, 0.15, 'square', 0.04, 600);
  floater(playerPos(), 'ARTILLERY INBOUND', '#ffb46a');
}

/* ---------- GUNSHIP STRAFING RUN (X) ---------- */
let gunship = null;
export function strafingRun(){
  const A = abil('strafe');
  if (!ready('strafe', 'strafe', A)) return;
  trainAbility('strafe');
  const pp = playerPos(), to = groundAim(A.length, 8);
  const dx = to.x - pp.x, dz = to.z - pp.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  for (let i = 0; i < A.blasts; i++){
    const s = 4 + (A.length - 4) * i / Math.max(1, A.blasts - 1);
    strikes.push({ x: pp.x + ux * s + rand(-1, 1), z: pp.z + uz * s + rand(-1, 1), t: A.delay + i * A.gap, R: A.radius, dmg: A.dmg, knock: A.knock,
                   mark: null, bolt: true });
  }
  // the gunship: a dark wedge that sweeps over the line, high and fast
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 5.5), new THREE.MeshBasicMaterial({ color: 0x3a4a3c }));
  const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 1.6), new THREE.MeshBasicMaterial({ color: 0x334134 }));
  wing.position.z = -0.6; g.add(hull, wing);
  g.rotation.y = Math.atan2(ux, uz);
  scene.add(g);
  gunship = { g, x0: pp.x - ux * 14, z0: pp.z - uz * 14, ux, uz, t: 0, T: A.delay + A.blasts * A.gap + 1.2, len: A.length + 28 };
  sfx(90, 1.4, 'sawtooth', 0.06, 140);
  floater(pp, 'GUNSHIP ON THE LINE', '#ffb46a');
}

function updateStrikes(dt){
  for (let i = strikes.length - 1; i >= 0; i--){
    const s = strikes[i]; s.t -= dt;
    if (s.whistle && s.t < 0.5 && !s.whistled){ s.whistled = true; sfx(1600, 0.45, 'sine', 0.025, 500); }
    if (s.t > 0) continue;
    strikes.splice(i, 1);
    const p = V3(s.x, 0, s.z);
    boom(p, s.R, false);
    if (s.bolt) burst(V3(p.x, 6, p.z), 0x7fff9a, 4, 20, 2);
    blast(p, s.R, s.dmg, s.knock);
    if (s.mark) scene.remove(s.mark);
  }
  if (gunship){
    const gs = gunship; gs.t += dt;
    const k = gs.t / gs.T;
    gs.g.position.set(gs.x0 + gs.ux * gs.len * k, 12 - Math.sin(k * Math.PI) * 3, gs.z0 + gs.uz * gs.len * k);
    if (gs.t >= gs.T){ scene.remove(gs.g); gunship = null; }
  }
}

/* ---------- FIELD MEDIC: the squad and the hero knit slowly once clear of a hit ---------- */
function updateMedic(dt){
  if (!G.unlocked.medic) return;
  if (G.gt - (player.lastHurt || -9) > 3 && player.hp > 0) player.hp = Math.min(player.hp + TROOPER.medic.regen * dt, maxHp());
}

export function updateTrooperPowers(dt){
  updateScan(); updateDomes(dt); updateCharges(dt); updateStrikes(dt); updateMedic(dt);
}
export function resetTrooperPowers(){
  for (const d of domes) scene.remove(d.mesh); domes.length = 0;
  for (const c of charges) scene.remove(c.mesh); charges.length = 0;
  for (const s of strikes) if (s.mark) scene.remove(s.mark); strikes.length = 0;
  for (const e of scanTags) if (e.scanTag){ scene.remove(e.scanTag); e.scanTag = null; } scanTags.length = 0;
  if (gunship){ scene.remove(gunship.g); gunship = null; }
}
