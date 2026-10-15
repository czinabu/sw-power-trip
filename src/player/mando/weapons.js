// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mando aiming, blasters, rifle, heat/reload, flamethrower.

import * as THREE from 'three';
import { scene, camera } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../../utils.js';
import { acquireParticle, burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, vfx, keys, player } from '../../state.js';
import { MANDO, MANDO_WEAPONS, weaponUnlocked } from '../../data/mando.js';
import { fwd, rightV, playerPos } from '../helpers.js';
import { damageEnemy } from '../../enemies/damage.js';
import { fireBolt } from '../../enemies/bolts.js';
import { damageBoss } from '../../boss/boss.js';
import { tryAttack } from '../jedi/combat.js';
import { updateDark } from './darksaber.js';
import { spawnHitSpark } from '../../fx/vfx.js';

/* ============================================================
   MANDALORIAN — jetpack, dual blasters, flamethrower, wrist rockets
   ============================================================ */
// You shoot EXACTLY down the crosshair ray — NO aim assist. The bolt aims at the point on that ray where it
// passes through an enemy's body column (so it converges on whatever the crosshair is over — head or torso),
// or a far point if the crosshair is on empty space. You must put the crosshair on the foe yourself.
const _camDir = new THREE.Vector3(), _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
export const _look = new THREE.Vector3(), _lh = new THREE.Vector3();   // camera look dir + its horizontal (jetpack dive thrust)
export function mandoAimPoint(){
  _ndc.set((player.aimOff.x) * 2 / innerWidth, -(player.aimOff.y) * 2 / innerHeight);   // through the floating reticle
  _ray.setFromCamera(_ndc, camera);
  _camDir.copy(_ray.ray.direction);
  const o = _ray.ray.origin, d = _camDir;
  const dh2 = d.x*d.x + d.z*d.z;
  let bestT = 1e9, hit = false;
  // treat each foe as an upright cylinder (radius `rad`, from cy0 to cyTop); the crosshair must actually be over it
  const consider = (cx, cz, cy0, cyTop, rad) => {
    if (dh2 < 1e-6) return;
    const t = ((cx - o.x)*d.x + (cz - o.z)*d.z) / dh2;   // ray param closest to the body's vertical axis (in XZ)
    if (t < 1 || t > 80 || t > bestT) return;
    const rx = o.x + d.x*t - cx, rz = o.z + d.z*t - cz;
    if (rx*rx + rz*rz > rad*rad) return;                 // crosshair misses the body column
    const ry = o.y + d.y*t;
    if (ry < cy0 || ry > cyTop) return;                  // crosshair is above the head or below the feet
    bestT = t; hit = true;
  };
  for (const e of enemies){ if (e.dead || e.converted || e.state === 'spawn') continue;
    const s = e.t.scale || 1; const p = e.group.position;
    consider(p.x, p.z, p.y + 0.3, p.y + 2.45*s, 0.72*s); }   // column reaches up over the head (head sits at ~2.16*scale)
  if (shared.boss && shared.boss.hp > 0){ const p = shared.boss.group.position; consider(p.x, p.z, p.y + 0.3, p.y + 3.6, 1.7); }
  player.lockOn = hit;
  const t = hit ? bestT : 40;
  return V3(o.x + d.x*t, o.y + d.y*t, o.z + d.z*t);   // the ray point — EXACTLY where the crosshair is
}
/* ===== BLASTER WEAPONS — single / dual / disruptor, with ammo & reload ===== */
export function aCost(base){ return base * (player.up.abilityCostMul || 1); }   // abilities start steep; upgrades drop the multiplier
export function mandoWeapon(){ return MANDO_WEAPONS[player.weapon] || MANDO_WEAPONS.dual; }
export function syncWeaponMesh(){   // show only the equipped weapon's mesh (or none, off-hero)
  const m = G.hero === 'mando', w = player.weapon;
  if (player.pistols){ player.pistols.R.visible = m && (w === 'single' || w === 'dual'); player.pistols.L.visible = m && w === 'dual'; }
  if (player.rifleMesh) player.rifleMesh.visible = m && w === 'disruptor';
  if (player.darksaberMesh) player.darksaberMesh.visible = m && w === 'darksaber';
}
export function switchWeapon(name){
  if (!MANDO_WEAPONS[name] || player.weapon === name) return;
  if (!weaponUnlocked(name)){ floater(playerPos(), 'LOCKED', '#ff9a66'); sfx(120, 0.1, 'square', 0.05, 70); return; }
  const W = MANDO_WEAPONS[name];
  player.weapon = name; player.zoom = false;
  player.heat = 0; player.overheat = false; player.ventT = 0; player.fireCd = 0.12;
  syncWeaponMesh();
  floater(playerPos(), W.name, '#bfe8ff');
  sfx(420, 0.07, 'square', 0.05, 240); sfx(220, 0.08, 'triangle', 0.04, 110);
}
// MANUAL VENT (R) — dump heat fast for a clean weapon, at the cost of a short fire lockout (a BF2 active-cooldown beat)
export function startReload(){
  if (mandoWeapon().melee || player.heat <= 0.02 || player.overheat) return;
  player.heat = 0; player.ventT = 0.45; player.fireCd = Math.max(player.fireCd, 0.45);
  sfx(300, 0.12, 'square', 0.05, 90); sfx(140, 0.1, 'triangle', 0.05, 60); floater(playerPos(), 'VENT', '#9cc8e8');
}
// HEAT — fired shots add heat; it only starts bleeding off after a short COOL-DELAY (so spraying climbs
// fast and you must pace your fire). Cap it → OVERHEAT lock until fully vented.
const HEAT_COOL_DELAY = 0.32;   // seconds after the last shot before the coils start to vent
export function updateReload(dt){
  const W = mandoWeapon();
  if (player.ventT > 0) player.ventT -= dt;
  if (player.heatDelay > 0) player.heatDelay -= dt;
  if (!W || W.melee){ player.heat = Math.max(0, player.heat - (W && W.cool || 0.6) * dt); player.overheat = false; return; }
  if (player.heatDelay <= 0 || player.overheat){           // overheated coils always bleed; otherwise wait out the delay
    const rate = player.overheat ? (W.overCool || 0.42) : (W.cool || 0.6);
    player.heat = Math.max(0, player.heat - rate * dt);
  }
  if (player.overheat && player.heat <= 0.02){ player.overheat = false; sfx(620, 0.06, 'square', 0.05, 320); sfx(820, 0.05, 'triangle', 0.04, 400); floater(playerPos(), 'READY', '#bfe8ff'); }
}
// add heat for one shot; returns true if that shot just tripped the overheat lock
function addHeat(W){
  player.heat = Math.min(1, player.heat + (W.heat || 0.1));
  player.heatDelay = HEAT_COOL_DELAY;   // restart the cool-delay every shot
  if (player.heat >= 0.999){ player.overheat = true; player.heat = 1; sfx(90, 0.22, 'sawtooth', 0.08, 40); sfx(160, 0.16, 'square', 0.06, 70); floater(playerPos(), 'OVERHEAT!', '#ff7a3a'); G.shake = Math.max(G.shake, 0.2); return true; }
  return false;
}
function muzzleOrigin(side){
  // bolts leave the gun at SHOULDER height (was waist) and a touch further out front
  const pp = playerPos(), r = rightV(), f = fwd();
  return V3(pp.x + r.x*0.26*side + f.x*0.65, pp.y + 1.78, pp.z + r.z*0.26*side + f.z*0.65);
}
export function spawnBlasterBolt(origin, dir, dmg, color, scale, W, opts){
  W = W || {}; opts = opts || {};
  const spr = opts.spread != null ? opts.spread : (W.hipSpread != null ? W.hipSpread : MANDO.spread);
  dir = dir.clone();
  dir.x += rand(-1,1)*spr; dir.y += rand(-1,1)*spr*0.6; dir.z += rand(-1,1)*spr; dir.normalize();
  fireBolt(origin, dir, MANDO.boltSpeed, dmg, true);
  const b = bolts[bolts.length-1];
  if (b){ b.mesh.material.color.setHex(color); b.mesh.scale.set(scale, scale*1.3, scale);
    b.origin = origin.clone(); b.foStart = W.foStart; b.foEnd = W.foEnd;
    b.foMin = opts.foMin != null ? opts.foMin : W.foMin;   // for range damage falloff (bracing lifts the floor)
    b.playerShot = true; }   // tag for accuracy tracking
  if (G.stats) G.stats.shotsFired++;
  const fm = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.14*scale, 8, 6), fm); flash.position.copy(origin); scene.add(flash);
  // muzzle flash fires every shot — no per-shot PointLight (the additive sphere + bloom already glows; a light here
  // would churn the light count). Big one-off blasts (explosions/parries) use the pooled flashLight() instead.
  vfx.push({ mesh:flash, t:0, dur:0.08, update(k){ flash.scale.setScalar(1 + k*2.2); fm.opacity = 0.9*(1-k); }});
  burst(origin, 0xffd28a, 2, 6, 1, 0.5);
}
// a friendly bolt's damage drops with distance travelled (per-weapon foStart/foEnd/foMin)
export function boltDamage(b){
  if (!b.origin || !b.foStart || b.foStart > 900) return b.dmg;
  const dist = b.origin.distanceTo(b.mesh.position);
  if (dist <= b.foStart) return b.dmg;
  const t = clamp((dist - b.foStart) / (b.foEnd - b.foStart), 0, 1);
  return b.dmg * (1 - t * (1 - (b.foMin || 1)));
}
// HIT MARKER — flash an X at the crosshair the instant a blaster bolt (or spear) connects. kind: 'hit'|'head'|'kill'.
// Confirms the shot AT YOUR EYES (the center), the core of good shooter feel; a stronger kind wins while one's active.
export function hitMarker(kind){
  if (G.hero !== 'mando') return;
  const rank = { hit:1, head:2, kill:3 }[kind] || 1;
  if ((player.hitMarkT || 0) <= 0 || rank >= (player._hmRank || 0)){ player.hitMarkKind = kind; player._hmRank = rank; }
  player.hitMarkT = 1;
  if (kind === 'kill'){ sfx(1500, 0.05, 'square', 0.05, 900); sfx(950, 0.06, 'square', 0.04, 520); }
  else if (kind === 'hit') sfx(1750, 0.03, 'square', 0.03, 1300);   // head already plays its own bright sfx at the hit site
}
// AUTO weapons (dual) auto-fire while LMB is held; called each frame from the per-frame block
export function firePistols(){
  if (mandoWeapon().fire === 'auto') fireTrigger();
}
// a trigger pull — dispatches by the equipped weapon's mode
export function fireTrigger(){
  if (G.mode !== 'play' || player.darkT > 0) return;
  const W = mandoWeapon();
  if (W.fire === 'saber'){ tryAttack(); return; }                      // DARKSABER — full saber combo (Jedi medium-stance rig)
  if (W.fire === 'rifle'){
    if (player.zoom){ if (!player.overheat && player.fireCd <= 0) fireRifle(W); }   // scoped → it's a rifle
    else spearStab(W);                                                              // hip → electric spear stab
    return;
  }
  if (player.overheat){ if ((player.dryT || 0) <= 0){ player.dryT = 0.25; sfx(120, 0.04, 'square', 0.04, 80); } return; }   // dry-fire CLICK while overheated
  if (player.fireCd > 0) return;   // energy cap reached → wait for the vent
  fireBlaster(W);
}
// is the Mando BRACING (hold RMB) — the stance that tightens the cone & boosts blaster damage
function mandoBraced(){ return G.hero === 'mando' && player.blockHeld; }
// The SINGLE-blaster GAUNTLET SHIELD — the one source of truth for "is the beskar energy shield up". Single + RMB
// only (Dual bracing is offensive, Darksaber uses the saber guard). Computed fresh so it's valid in the air too.
export function mandoShielding(){ return G.hero === 'mando' && player.weapon === 'single' && !mandoWeapon().melee && player.blockHeld; }
function fireBlaster(W){
  player.aiming = 0.7;
  const aim = mandoAimPoint();
  // You are only truly STEADY when bracing/scoping while NOT boosting — boosting (jetpack) is never steady, so
  // flying fast + shooting is the least accurate. Movement & air add INACCURACY (bloom + recoil); bracing while
  // standing or HOVERING removes almost all of it.
  const steadyAim = mandoBraced() && !player.boosting;
  const hsp = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  const spd01 = clamp(hsp / (MANDO.airSpeedMax || 22), 0, 1);
  const inacc = spd01 * 0.7 + (player.boosting ? 1.0 : (!player.grounded && !player.hovering ? 0.35 : 0));
  const dmg = W.dmg * (steadyAim ? (W.braceDmg || 1) : 1) * player.up.dmg;
  const foMin = steadyAim ? Math.min(1, (W.foMin || 1) + 0.25) : W.foMin;   // bracing stretches effective range
  const baseSpread = steadyAim ? W.braceSpread : W.hipSpread;
  const spread = baseSpread + (steadyAim ? inacc * 0.003 : inacc * 0.028);   // boosting blooms the cone hard
  const opts = { spread, foMin };
  const col = steadyAim ? 0xffd24a : 0xffb84a;   // braced bolts glint hotter
  if (W.dual && player.backRun){
    // running away: only the gun hand fires back over his shoulder (he faces the camera, so it's on screen-left)
    const o = muzzleOrigin(-1);
    spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), dmg, col, 1.1, W, opts);
  } else if (W.dual){
    const side = player.firePistol; player.firePistol = -side;
    const o = muzzleOrigin(side);
    spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), dmg, col, 1.1, W, opts);
  } else {
    const o = muzzleOrigin(0.06);
    spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), dmg, col, 1.5, W, opts);
  }
  const kick = (W.dual ? 0.18 : 0.3) * (steadyAim ? 0.55 : 1) * (1 + inacc * 1.3);   // recoil grows with speed & boost
  player.recoil = kick; player.recoilKick = kick;
  G.shake = Math.max(G.shake, W.dual ? 0.06 : 0.15);
  if (W.dual) sfx(900, 0.07, 'square', 0.05, 500); else { sfx(560, 0.1, 'square', 0.07, 420); sfx(140, 0.09, 'sawtooth', 0.05, 60); }
  player.fireCd = W.fireCd / (player.up.fireRate || 1);
  addHeat(W);   // energy cap — overheats if you don't pace your fire
}
function fireRifle(W){
  player.aiming = 0.8;
  const aim = mandoAimPoint();
  const o = muzzleOrigin(0.06);
  spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), W.dmg * player.up.dmg, 0x7fe0ff, 2.0, W);
  player.recoil = 0.5; player.recoilKick = 0.5;
  G.shake = Math.max(G.shake, 0.4); G.hitstop = Math.max(G.hitstop, 0.05);
  screenFlash('radial-gradient(ellipse at center, rgba(120,210,255,.2), transparent 60%)', 0.35, 0.2);
  sfx(110, 0.1, 'sawtooth', 0.06, 46); sfx(60, 0.16, 'sine', 0.08, 28);
  player.fireCd = W.fireCd / (player.up.fireRate || 1);
  addHeat(W);   // a heavy charge — overheats after a couple of shots
}
// disruptor used un-scoped = an electric SPEAR: a fast, snappy thrust that lunges you in
function spearStab(W){
  if (player.stabT > 0 || player.fireCd > 0) return;
  player.stabT = 0.24; player.fireCd = W.stabCd; player.aiming = 0.7;
  if (player.rifleProngGlow) player.rifleProngGlow.material.opacity = 1;
  const f = fwd(), pp = playerPos();
  player.vel.addScaledVector(f, 9);   // a committed spear LUNGE — drives you onto the target
  S.swing(); sfx(220, 0.12, 'sawtooth', 0.06, 90); sfx(1300, 0.1, 'sawtooth', 0.05, 200);
  let best = null, bd = W.stabRange;
  for (const e of enemies){ if (e.dead || e.converted || e.state === 'spawn') continue; TMP.subVectors(e.group.position, pp); TMP.y = 0; const d = TMP.length(); if (d < bd && TMP.normalize().dot(f) > 0.4){ bd = d; best = e; } }
  if (best){
    best.state = 'stagger'; best.st = W.stabStun; best.stumble = 0.3;
    damageEnemy(best, W.stabDmg * player.up.dmg, f, 10);
    hitMarker(best.dead ? 'kill' : 'hit');
    const hp = best.group.position;
    burst(V3(hp.x, 1.4, hp.z), 0x7fe0ff, 14, 9, 5); spawnHitSpark(V3(hp.x, 1.5, hp.z), 0xaff0ff, 1.4);
    for (let n = 0; n < 4; n++) burst(V3(hp.x + rand(-0.4,0.4), rand(1,2.4), hp.z + rand(-0.4,0.4)), 0x9fdcff, 1, 4, 3);
    G.shake = Math.max(G.shake, 0.3); G.hitstop = Math.max(G.hitstop, 0.06);
    floater(hp, 'STUN', '#aff0ff');
  } else if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < W.stabRange + 1){ damageBoss(W.stabDmg * player.up.dmg); }
}
export function mandoFlame(){   // keydown cue only — the stream itself is HELD (handled in updateFlame)
  if (player.force < 5){ if (G.gt - player.lastWinded > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO FUEL', '#ff6a3a'); } return; }
  sfx(150, 0.22, 'sawtooth', 0.06, 60);
}
export function updateFlame(dt){
  const A = MANDO.flame;
  const active = G.hero === 'mando' && G.unlocked.flame && !!keys['f'] && player.force > 4 && G.mode === 'play' && player.darkT <= 0;
  player.flaming = active;
  if (!player.flameLight){ player.flameLight = new THREE.PointLight(0xff7a2a, 0, 11); player.flameLight.visible = false; scene.add(player.flameLight); }
  const fl = player.flameLight;
  fl.intensity += ((active ? 5.5 + Math.random()*1.5 : 0) - fl.intensity) * Math.min(1, dt*14);
  fl.visible = fl.intensity > 0.05;
  if (!active) return;
  player.force = Math.max(0, player.force - A.fuel * (player.up.abilityCostMul || 1) * dt);
  const pp = playerPos();
  player.aiming = Math.max(player.aiming, 0.2);   // square the body up so the stream points where you look (no auto-target)
  const f = fwd();
  const range = A.range * (player.up.flameRange || 1);
  const cosLim = Math.cos(A.angle);
  const fy = pp.y + 1.4;   // the stream pours from the player's OWN height (so it tracks you into the air)
  fl.position.set(pp.x + f.x*2.2, fy, pp.z + f.z*2.2);
  // a roaring stream of fire fanning from the wrist
  for (let n = 0; n < 5; n++){
    const t = rand(0.8, range), spread = rand(-A.angle, A.angle);
    const dx = f.x*Math.cos(spread) - f.z*Math.sin(spread), dz = f.x*Math.sin(spread) + f.z*Math.cos(spread);
    const m = acquireParticle();
    m.material.color.setHex(n%3?0xff7a1a:0xffe06a);
    m.material.opacity = 0.85; m.material.blending = THREE.AdditiveBlending; m.material.depthWrite = false;
    m.position.set(pp.x + dx*t*0.55 + rand(-0.25,0.25), fy + rand(-0.2,0.5), pp.z + dz*t*0.55 + rand(-0.25,0.25));
    m.scale.setScalar(rand(0.9, 1.0 + t*0.28));   // fire widens as it travels
    m.userData.vel.set(dx*10, rand(0.4,2.4), dz*10);
    m.userData.life = rand(0.22,0.46);
  }
  // a low continuous roar, throttled so it doesn't machine-gun
  player.flameSfx = (player.flameSfx || 0) - dt;
  if (player.flameSfx <= 0){ player.flameSfx = 0.11; sfx(rand(64,104), 0.16, 'sawtooth', 0.05, 46); }
  G.shake = Math.max(G.shake, 0.06);   // a steady rumble, no jitter
  // light tick damage + a steady gentle push (NO per-hit hitstop/sfx — that was the "spazz")
  const dmg = A.dmg * (player.up.flameDmg || 1) * dt;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > range*0.45) continue;   // the stream fires level — it won't roast foes on the ground far below
    TMP.y = 0;
    const d = TMP.length();
    if (d > range || d < 0.1) continue;
    if (TMP.normalize().dot(f) < cosLim) continue;
    damageEnemy(e, dmg, null, 0, false, true);                 // tick = true → no spazz
    if (!e.dead && !e.t.heavy) e.group.position.addScaledVector(TMP, A.knock*dt);   // gentle, steady shove
  }
  if (shared.boss && shared.boss.hp > 0){
    TMP.subVectors(shared.boss.group.position, pp); TMP.y = 0;
    if (TMP.length() < range && TMP.normalize().dot(f) > cosLim) damageBoss(dmg, true);
  }
}

// Mando per-frame weapon upkeep: timers, free-aim drift + sway, reload, held auto-fire, flamethrower, darksaber.
export function updateMandoCombat(dt, f, r){
  if (player.fireCd > 0) player.fireCd -= dt;
  if (player.stabT > 0) player.stabT -= dt;
  if (player.meleeT > 0) player.meleeT -= dt;   // gauntlet-punch recovery
  if (player.aiming > 0) player.aiming -= dt;
  if (player.zoom) player.aiming = 0.3;                 // holding the scope keeps you squared up
  player.recoilKick = Math.max(0, player.recoilKick - dt*3.5);
  if (player.rifleProngGlow && player.rifleProngGlow.material.opacity > 0) player.rifleProngGlow.material.opacity = Math.max(0, player.rifleProngGlow.material.opacity - dt*3);
  // FREE-AIM DRIFT — a SMALL float toward your movement (kept subtle). The bolt always fires straight THROUGH
  // the reticle (see mandoAimPoint), so wherever it drifts, that's where you hit.
  { const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z;
    const vR = vx*r.x + vz*r.z, vF = vx*f.x + vz*f.z, k = player.zoom ? 0.12 : 1;
    // AIM SWAY — the reticle WANDERS (and bolts fire exactly through it), so the crosshair stays HONEST but is
    // harder to hold on target the faster you move. BRACING/scoping while standing or HOVERING steadies it hard;
    // BOOSTING (jetpack) is never steady — flying fast and shooting is deliberately the least accurate.
    const hsp = Math.hypot(vx, vz);
    const spd01 = clamp(hsp / (MANDO.airSpeedMax || 22), 0, 1);
    const steady = (player.blockHeld || player.zoom) && !player.boosting;
    const swayAmp = steady ? 1.0 : (4 + spd01 * 9 + (player.boosting ? 6 : 0));   // ramps with speed; biggest while BOOSTING (SHIFT)
    player.aimSway = swayAmp;   // shared with the reticle bloom in updateHud
    const sx = (Math.sin(G.gt*2.3) + Math.sin(G.gt*1.07)*0.6) * swayAmp;
    const sy = (Math.cos(G.gt*1.9) + Math.sin(G.gt*0.73)*0.5) * swayAmp * 0.7;
    const tox = clamp(vR * 1.1 * k + sx, -30, 30), toy = clamp(-vF * 0.7 * k + sy, -24, 24);
    player.aimOff.x += (tox - player.aimOff.x) * Math.min(1, dt*5);
    player.aimOff.y += (toy - player.aimOff.y) * Math.min(1, dt*5); }
  updateReload(dt);
  if (player.firing && player.darkT <= 0) firePistols();   // auto weapons spray while held
  updateFlame(dt);
  updateDark(dt);
}
