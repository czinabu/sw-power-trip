// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mando aiming, blasters, rifle, heat/reload, flamethrower.

import * as THREE from 'three';
import { hooks } from '../../net/run.js';
import { scene, camera } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../../utils.js';
import { acquireParticle, burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, vfx, keys, player, isGunner, isMando, isTrooper } from '../../state.js';
import { MANDO, MANDO_WEAPONS, weaponUnlocked, BESKAR_PARRY } from '../../data/mando.js';
import { setLongGun, longMuzzle, OWN_MODEL } from '../model/weapons.js';
import { diffWindow } from '../../data/difficulty.js';
import { abil } from '../../data/mastery.js';
import { fwd, rightV, playerPos, maxStam } from '../helpers.js';
import { crosshairPoint, crosshairRay, lastAim, aimFrom, inAim, bossInAim } from '../aim.js';
import { inReach, bodyRadius, sweepHit } from '../../enemies/bodyshape.js';
import { damageEnemy } from '../../enemies/damage.js';
import { updateMandoMelee } from './melee.js';
import { fireBolt } from '../../enemies/bolts.js';
import { damageBoss } from '../../boss/boss.js';
import { tryAttack } from '../jedi/combat.js';
import { updateDark } from './darksaber.js';
import { spawnHitSpark } from '../../fx/vfx.js';
import { muzzleFlash, inkSprite, sparks, puff, screenAngle } from '../../fx/ink.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { gauntletPoint } from '../../fx/palms.js';
import { momentumShot } from '../parkour.js';
import { mandoMelee } from './melee.js';
import { syncHolster } from '../holster.js';
import { trainHeld } from '../../game/upgrades.js';
import { squadStanding } from '../../allies/squad.js';
import { launchAtRocket } from './gadgets.js';
import { gunLook, TROOPER } from '../../data/trooper.js';

/* ============================================================
   MANDALORIAN — jetpack, dual blasters, flamethrower, wrist rockets
   ============================================================ */
// You shoot EXACTLY down the crosshair ray — NO aim assist. The bolt aims at the point on that ray where it
// passes into an enemy's body (so it converges on whatever the crosshair is over — head, torso, arm or legs),
// the floor or prop it meets, or a far point if the crosshair is on open sky. You must put the crosshair on the foe
// yourself. (The ray itself is cast in player/aim.js, which every aimed ability shares.)
export const _look = new THREE.Vector3(), _lh = new THREE.Vector3();   // camera look dir + its horizontal (jetpack dive thrust)
// the reticle's ray as mandoAimPoint last cast it (origin, direction)
export const mandoAimRay = () => crosshairRay();   // (a call, not an alias: the dev server loads aim.js after this module)
export function mandoAimPoint(){
  const p = crosshairPoint(player.aimOff.x, player.aimOff.y);   // through the floating reticle
  player.lockOn = !!lastAim.target;
  return p;
}
/* ===== BLASTER WEAPONS — single / dual / disruptor, with ammo & reload ===== */
export function aCost(base){ return base * (player.up.abilityCostMul || 1); }   // abilities start steep; upgrades drop the multiplier
export function mandoWeapon(){ return MANDO_WEAPONS[player.weapon] || MANDO_WEAPONS.dual; }
export function syncWeaponMesh(){   // show only the equipped weapon's mesh (or none, off-hero); holstered, the one put away
  const m = isGunner(), raw = player.weapon === 'fists' ? player.drawnWeapon : player.weapon, w = gunLook(raw);   // (the trooper's guns are held like the Mando's: data/trooper.js GUN_LOOK)
  if (player.pistols){ player.pistols.R.visible = m && (w === 'single' || w === 'dual'); player.pistols.L.visible = m && w === 'dual'; }
  const LW = MANDO_WEAPONS[w];
  if (player.rifleMesh){ player.rifleMesh.visible = m && !!(LW && LW.twoHand); if (LW && LW.twoHand) setLongGun(player, OWN_MODEL[raw] || w); }   // one long-gun mount, the drawn gun's model on it (the DC-15 its own)
  if (player.darksaberMesh) player.darksaberMesh.visible = (m && w === 'darksaber') || !!shared.darkProj;   // a thrown blade stays seen until it's caught
  syncHolster();   // in the hand, or on the belt / thighs / pack (player/holster.js)
}
export function switchWeapon(name){
  if (!MANDO_WEAPONS[name] || player.weapon === name) return;
  if (!weaponUnlocked(name)){ floater(playerPos(), 'LOCKED', '#ff9a66'); sfx(120, 0.1, 'square', 0.05, 70); return; }
  const W = MANDO_WEAPONS[name];
  player.weapon = name; player.zoom = false;
  player.heat = 0; player.overheat = false; player.ventT = 0; player.fireCd = 0.12; player.fireCdL = 0;
  player.spin = 0; player.burstLeft = 0; player.burstQ = false; player.gunSlow = 1;
  syncWeaponMesh();
  floater(playerPos(), W.name, '#bfe8ff');
  sfx(420, 0.07, 'square', 0.05, 240); sfx(220, 0.08, 'triangle', 0.04, 110);
}
// MANUAL VENT (R) — dump heat fast for a clean weapon, at the cost of a short fire lockout (a BF2 active-cooldown beat)
export function startReload(){
  if (isTrooper() && player.overheat && !mandoWeapon().melee){ activeVent(); return; }   // the trooper's active vent
  const W = mandoWeapon();
  if (W.melee || player.heat <= 0.02 || player.overheat) return;
  // each gun vents in its own time (W.vent): the pistol flicks its heat off, the repeater dumps a cloud of coolant
  const t = W.vent || 0.45;
  player.heat = 0; player.ventT = t; player.fireCd = Math.max(player.fireCd, t); player.burstLeft = 0; player.spin = 0;
  tutEvent('vent');
  sfx(300, 0.12, 'square', 0.05, 90); sfx(140, 0.1, 'triangle', 0.05, 60); floater(playerPos(), 'VENT', '#9cc8e8');
  if (t >= 0.9){   // the heavy dump: a hiss and a cloud off the gun
    sfx(1800, t * 0.6, 'sawtooth', 0.02, 300);
    const g = gunMuzzle(muzzleOrigin(0.06));
    for (let i = 0; i < 6; i++) puff(V3(g.x, g.y, g.z), 0xdfe8f0, rand(0.5, 0.9), rand(0.5, 0.8), V3(rand(-1.2, 1.2), rand(1, 2.4), rand(-1.2, 1.2)), { drag: 2.5, grav: -1.5, grow0: 0.3 });
  }
}
// THE TROOPER'S ACTIVE VENT — overheated, R inside the window (data/trooper.js TROOPER.vent) clears the gun at once;
// a press outside it jams the coils for a moment longer. One try per overheat.
function activeVent(){
  if (player.ventTried) return;
  player.ventTried = true;
  const V = TROOPER.vent, t = G.gt - (player.overheatAt || 0);
  if (t >= V.window[0] && t <= V.window[1]){
    player.heat = 0; player.overheat = false; player.ventT = 0.12; player.fireCd = Math.min(player.fireCd, 0.12);
    tutEvent('vent');
    sfx(880, 0.06, 'square', 0.05, 1320); sfx(1320, 0.08, 'triangle', 0.04, 1760); floater(playerPos(), 'PERFECT VENT', '#9fe6ff');
  } else {
    player.jamT = V.jam;
    sfx(110, 0.16, 'sawtooth', 0.06, 60); floater(playerPos(), 'JAMMED', '#ff9a66');
  }
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
    const rate = (player.overheat ? (W.overCool || 0.42) : (W.cool || 0.6)) * (player.up.heatCool || 1);
    if (player.jamT > 0) player.jamT -= dt;   // (a missed active vent holds the coils hot a moment longer)
    else player.heat = Math.max(0, player.heat - rate * dt);
  }
  if (player.overheat && player.heat <= 0.02){ player.overheat = false; sfx(620, 0.06, 'square', 0.05, 320); sfx(820, 0.05, 'triangle', 0.04, 400); floater(playerPos(), 'READY', '#bfe8ff'); }
}
// add heat for one shot; returns true if that shot just tripped the overheat lock
function addHeat(W){
  player.heat = Math.min(1, player.heat + (W.heat || 0.1) * (player.up.heatMul || 1) / (player.up.heatCap || 1));   // POWER CELLS hold more (game/progression.js)
  player.heatDelay = HEAT_COOL_DELAY;   // restart the cool-delay every shot
  if (player.heat >= 0.999){ player.overheat = true; player.heat = 1; player.overheatAt = G.gt; player.ventTried = false; player.burstLeft = 0;
    if (isTrooper()) floater(playerPos().clone().setY(playerPos().y + 2.6), 'R IN THE BEAT: VENT', '#bfe8ff'); sfx(90, 0.22, 'sawtooth', 0.08, 40); sfx(160, 0.16, 'square', 0.06, 70); floater(playerPos(), 'OVERHEAT!', '#ff7a3a'); G.shake = Math.max(G.shake, 0.2); return true; }
  return false;
}
function muzzleOrigin(side){
  // bolts leave the gun at SHOULDER height (was waist) and a touch further out front
  const pp = playerPos(), r = rightV(), f = fwd();
  return V3(pp.x + r.x*0.26*side + f.x*0.65, pp.y + 1.78, pp.z + r.z*0.26*side + f.z*0.65);
}
export function spawnBlasterBolt(origin, dir, dmg, color, scale, W, opts){
  W = W || {}; opts = opts || {};
  // the bolt leaves the barrel of the gun that fired it, still flying at the point the shot was aimed through
  if (opts.to){ const mz = gunMuzzle(origin); if (mz.distanceToSquared(origin) > 1e-4){ origin = mz.clone(); dir = V3(opts.to.x - origin.x, opts.to.y - origin.y, opts.to.z - origin.z).normalize(); } }
  const spr = opts.spread != null ? opts.spread : (W.hipSpread != null ? W.hipSpread : MANDO.spread);
  dir = dir.clone();
  dir.x += rand(-1,1)*spr; dir.y += rand(-1,1)*spr*0.6; dir.z += rand(-1,1)*spr; dir.normalize();
  fireBolt(origin, dir, MANDO.boltSpeed, dmg, true, true);
  const b = bolts[bolts.length-1];
  if (b){ b.mesh.material.color.setHex(color); b.mesh.scale.set(scale, scale*1.3, scale);
    b.origin = origin.clone(); b.foStart = W.foStart; b.foEnd = W.foEnd;
    b.foMin = opts.foMin != null ? opts.foMin : W.foMin;   // for range damage falloff (bracing lifts the floor)
    b.playerShot = true;   // tag for accuracy tracking
    if (W.flinch != null) b.flinch = W.flinch;   // how hard it rocks the foe it hits (enemies/bolts.js)
    if (hooks.pbolt) hooks.pbolt(b, color, scale); }   // co-op: the partner sees it fly
  if (G.stats) G.stats.shotsFired++;
  // muzzle flash fires every shot, drawn at the barrel of whichever gun is nearest the bolt's origin — pooled Ink
  // sprites, no per-shot PointLight (a light here would churn the light count; big blasts use flashLight()).
  muzzleFlash(gunMuzzle(origin), dir, color, 0.55 + scale * 0.25);
}
// the world-space barrel tip of the visible gun closest to `near` (falls back to `near` itself)
const MUZZLES = [['pistols', 'R', [0, 0.115, 0.38]], ['pistols', 'L', [0, 0.115, 0.38]], ['rifleMesh', null, null]];   // (the long gun's muzzle is the drawn model's)
const _mz = new THREE.Vector3(), _mzBest = new THREE.Vector3();
function gunMuzzle(near){
  let best = 1.2;   // only snap to a gun that's actually by the shot
  _mzBest.copy(near);
  for (const [key, side, at] of MUZZLES){
    const g = side ? (player[key] && player[key][side]) : player[key];
    if (!g || !g.visible) continue;
    g.updateWorldMatrix(true, false);
    const a = at || longMuzzle(player);
    _mz.set(a[0], a[1], a[2]); g.localToWorld(_mz);
    const d = _mz.distanceTo(near);
    if (d < best){ best = d; _mzBest.copy(_mz); }
  }
  return _mzBest;
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
  if (!isGunner()) return;
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
// the gap to the next shot: a spinning gun's shrinks as it winds up (W.spin), and fire-rate upgrades shorten every gun's
function shotGap(W){
  const g = W.spin ? W.spin.from + (W.spin.to - W.spin.from) * player.spin : W.fireCd;
  return g / (player.up.fireRate || 1);
}
// a trigger pull — dispatches by the equipped weapon's mode
export function fireTrigger(){
  if (G.mode !== 'play' || player.darkT > 0 || player.flaming) return;   // the flamethrower is used by itself: no shooting while it burns
  const W = mandoWeapon();
  if (W.fire === 'saber'){                                              // DARKSABER — full saber combo (Jedi medium-stance rig)
    if (shared.darkProj){   // thrown: nothing to swing until the grappling line brings it home
      if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO BLADE', '#c9a6ff'); sfx(220, 0.06, 'sine', 0.04, 160); }
      return;
    }
    tryAttack(); return;
  }
  if (W.fire === 'fists'){ mandoMelee(); return; }                     // HOLSTERED — the close-quarters string, same as E
  if (W.fire === 'rifle'){
    if (player.zoom){ if (!player.overheat && player.fireCd <= 0) fireRifle(W); }   // scoped → it's a rifle
    else spearStab(W);                                                              // hip → electric spear stab
    return;
  }
  if (player.overheat){ if ((player.dryT || 0) <= 0){ player.dryT = 0.25; sfx(120, 0.04, 'square', 0.04, 80); } return; }   // dry-fire CLICK while overheated
  if (W.fire === 'twin'){ fireTwin(W); return; }   // the trooper's twin DC-17s: each click, the other pistol
  if (W.fire === 'launcher'){   // the trooper's AT launcher (the Commando's): one heavy rocket a pull
    if (player.fireCd > 0) return;
    player.aiming = 0.8;
    const aim = mandoAimPoint(), o = muzzleOrigin(0.06);
    launchAtRocket(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), W);
    player.fireCd = shotGap(W); addHeat(W);
    return;
  }
  if (player.fireCd > 0 || player.burstLeft > 0){   // not ready yet (or a burst still firing)
    if (W.fire === 'burst' && player.ventT <= 0 && player.fireCd + player.burstLeft * (W.burstGap || 0) < 0.16) player.burstQ = true;   // a click just early queues the next burst
    return;
  }
  player.burstQ = false;
  if (W.fire === 'burst'){ player.burstLeft = W.burst; player.burstT = 0; burstRound(W); return; }   // the rest of the burst: updateMandoCombat
  fireBlaster(W);
}
// THE TWIN DC-17s (the trooper) — semi-automatic: each click of LMB fires the other pistol (right, left, right…), each
// on its own cooldown, both into the one heat bar, so a quick finger fires twice as fast as one gun. RMB aims (the
// tighter cone). They fire straight out of a roll or a slide.
function fireTwin(W){
  if ((player.twinGapT || 0) > G.gt) return;   // the fastest two clicks can land: data/trooper.js `twinGap`
  const side = player.twinNext || 1;
  const ready = s => (s > 0 ? player.fireCd : (player.fireCdL || 0)) <= 0;
  const s = ready(side) ? side : ready(-side) ? -side : 0;
  if (!s) return;
  firePistol(W, s);
  player.twinNext = -s; player.twinGapT = G.gt + (W.twinGap || 0);
}
export function firePistol(W, side){
  if (G.mode !== 'play' || player.overheat) return;
  if (side > 0 ? player.fireCd > 0 : (player.fireCdL || 0) > 0) return;
  fireBlaster(W, side);
  if (side > 0) player.fireCd = shotGap(W);
  else player.fireCdL = shotGap(W);
}
// one round of a burst (the CARBINE, the trooper's DC-15); the burst stops early if the gun overheats or the hero stops being able to shoot
function burstRound(W){
  player.burstLeft--;
  fireBlaster(W);
  if (player.overheat) player.burstLeft = 0;
  if (player.burstLeft > 0){ player.burstT = W.burstGap; player.fireCd = Math.max(player.fireCd, W.burstGap); }
  else player.fireCd = shotGap(W);
}
// is the Mando BRACING (hold RMB) — the stance that tightens the cone & boosts blaster damage
function mandoBraced(){ return isGunner() && player.blockHeld; }
// The SINGLE-blaster GAUNTLET SHIELD — the one source of truth for "is the beskar energy shield up". Single + RMB
// only (Dual bracing is offensive, Darksaber uses the saber guard). Computed fresh so it's valid in the air too.
// SHIELD OR FIRE — aiming in raises the shield, but pulling the trigger drops it for blaster ADS: it stays down while
// LMB is held and for SHIELD_RETURN after the last shot, so you can't soak and shoot at once. An overheated gun
// can't fire, so holding the trigger then doesn't lower it (shield up while the coils vent).
export const SHIELD_RETURN = 0.5;   // seconds after the last shot before the shield comes back up
export function mandoShielding(){
  if (!isMando() || !player.blockHeld) return false;
  if (player.weapon === 'fists') return true;   // holstered: the gauntlet's shield stays up while he fights with his hands
  if (player.weapon !== 'single' || mandoWeapon().melee) return false;
  return !(player.shieldDropT > 0) && !(player.trigHeld && !player.overheat);
}
function fireBlaster(W, hand){
  player.aiming = 0.7;
  const aim = mandoAimPoint();
  // You are only truly STEADY when bracing/scoping while NOT boosting — boosting (jetpack) is never steady, so
  // flying fast + shooting is the least accurate. Movement & air add INACCURACY (bloom + recoil); bracing while
  // standing or HOVERING removes almost all of it.
  const steadyAim = mandoBraced() && !player.boosting;
  const hsp = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  const spd01 = clamp(hsp / (MANDO.airSpeedMax || 22), 0, 1);
  // a SLIDE is a steady firing line (parkour.js): no speed bloom, and shots out of any parkour move hit harder
  const inacc = player.slideT > 0 ? 0 : spd01 * 0.7 + (player.boosting ? 1.0 : (!player.grounded && !player.hovering ? 0.35 : 0));
  const dmg = W.dmg * (steadyAim ? (W.braceDmg || 1) : 1) * player.up.dmg * momentumShot() * (player.up.brothers ? 1 + 0.04 * squadStanding() : 1);   // (the trooper's BAND OF BROTHERS)
  const foMin = steadyAim ? Math.min(1, (W.foMin || 1) + 0.25) : W.foMin;   // bracing stretches effective range
  const baseSpread = steadyAim ? W.braceSpread : W.hipSpread;
  const spread = baseSpread + (steadyAim ? inacc * 0.003 : inacc * 0.028);   // boosting blooms the cone hard
  const opts = { spread, foMin, to: aim };
  const col = W.col || (steadyAim ? 0xffd24a : 0xffb84a);   // braced bolts glint hotter (a long gun, or the trooper's guns, fire their own colour)
  if (hand){   // one named pistol (the trooper's twin DC-17s)
    const o = muzzleOrigin(hand);
    spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), dmg, col, 1.15, W, opts);
  } else if (W.dual && player.backRun){
    // running away: one hand fires back over his shoulder (he faces the camera, so his gun hand is on screen-left;
    // anim/guns.js switches to the left hand, screen-right, when the target is round on that side)
    const o = muzzleOrigin(player.backHand === 'L' ? 1 : -1);
    spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), dmg, col, 1.1, W, opts);
  } else if (W.dual){
    const side = player.firePistol; player.firePistol = -side;
    const o = muzzleOrigin(side);
    spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), dmg, col, 1.1, W, opts);
  } else {
    const o = muzzleOrigin(0.06);
    spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), dmg, col, W.size || 1.5, W, opts);
  }
  const kick = (W.kick || 0.3) * (steadyAim ? 0.55 : 1) * (1 + inacc * 1.3);   // recoil grows with speed & boost
  player.recoil = kick; player.recoilKick = kick;
  // CLIMB: each shot walks the reticle (and so the next bolt) up; it settles back on its own (updateMandoCombat),
  // so a burst lands high unless you pull it down. Bracing halves it.
  if (W.climb) player.aimOff.y -= W.climb * (steadyAim ? 0.5 : 1) * (1 + inacc);
  G.shake = Math.max(G.shake, W.dual ? 0.06 : W.slow ? 0.08 : 0.15);
  if (W.dual) S.blasterDual();
  else if (W.slow){ S.blasterDual(); sfx(70, 0.07, 'square', 0.05, 40); }   // the repeater: a heavier chug under each shot
  else S.blaster();
  if (!hand) player.fireCd = shotGap(W);   // (a named pistol keeps its own cooldown: firePistol)
  if (player.weapon === 'single') player.shieldDropT = SHIELD_RETURN;   // a shot drops the shield (see mandoShielding)
  addHeat(W);   // energy cap — overheats if you don't pace your fire
}
function fireRifle(W){
  player.aiming = 0.8;
  const aim = mandoAimPoint();
  const o = muzzleOrigin(0.06);
  spawnBlasterBolt(o, V3(aim.x-o.x, aim.y-o.y, aim.z-o.z).normalize(), W.dmg * player.up.dmg, 0x7fe0ff, 2.0, W, { to: aim });
  // the wake hangs along the bolt's real line: from the rifle's barrel tip (where the bolt now leaves) to the aimed point,
  // not from the shoulder origin (that skewed the rings off the crosshair, worst on near targets)
  const mz = gunMuzzle(o).clone();
  disruptorWake(mz, V3(aim.x-mz.x, aim.y-mz.y, aim.z-mz.z).normalize(), mz.distanceTo(aim));
  player.recoil = 0.5; player.recoilKick = 0.5;
  G.shake = Math.max(G.shake, 0.4); G.hitstop = Math.max(G.hitstop, 0.05);
  screenFlash('radial-gradient(ellipse at center, rgba(120,210,255,.2), transparent 60%)', 0.35, 0.2);
  S.disruptor();
  player.fireCd = W.fireCd / (player.up.fireRate || 1);
  addHeat(W);   // a heavy charge — overheats after a couple of shots
}
// the disruptor's ionised wake — a corkscrew of ink rings left hanging along the first stretch of the shot
function disruptorWake(from, dir, reach = 99){
  for (let i = 0; i < 9; i++){
    const t = 0.8 + i * 1.5;
    if (t > reach) break;   // the trail stops at the point under the crosshair, never runs on past it
    inkSprite({ pos: V3(from.x + dir.x*t, from.y + dir.y*t, from.z + dir.z*t), normal: dir, shape: 'ring', inner: 0.7, color: 0x7fe0ff,
                size: [0.35, 0.75 + i*0.05], life: 0.32, delay: i * 0.012, fadeAt: 0.25, coreW: 0.25, inkW: 0.24, op: 0.9 });
  }
  sparks(from, 0xaff0ff, 6, 14, { dir, cone: 0.25, life: 0.2, grav: 0, size: 0.45 });
}
// disruptor used un-scoped = an electric SPEAR: a fast, snappy thrust that lunges you in. The rifle comes up level on
// the reticle, chambers back a hand and drives out (the pose: anim/guns.js riflePose); the prongs land at the drive's
// peak (stabStrike, from updateMandoCombat), a beat after the click. Its own clock: a shot just before doesn't block it.
function spearStab(W){
  if (player.stabT > 0 || (player.stabCdT || 0) > 0){
    if (Math.max(player.stabT, player.stabCdT || 0) < W.stabQueue) player.stabQ = true;   // mashing: the next jab is queued
    return;
  }
  player.stabQ = false;
  player.stabT = W.stabTime; player.stabCdT = W.stabCd; player.stabHit = false; player.aiming = 0.7;
  player.fireCd = Math.max(player.fireCd, 0.12);
  if (player.rifleProngGlow) player.rifleProngGlow.material.opacity = 1;
  S.swing('fast'); sfx(1300, 0.08, 'sawtooth', 0.03, 200);
}
function stabStrike(W){
  player.stabHit = true;
  const f = fwd(), pp = playerPos();
  player.vel.addScaledVector(f, W.stabLunge);   // a committed spear LUNGE — drives you onto the target
  S.zap();
  // the arc crackles off the prongs at full reach
  if (player.rifleProngGlow){
    const tip = player.rifleProngGlow.getWorldPosition(V3());
    sparks(tip, 0xaff0ff, 8, 9, { dir: f, cone: 0.6, life: 0.16, grav: 0, size: 0.35 });
    inkSprite({ pos: tip, shape: 'star', points: 6, sharp: 0.1, color: 0x7fe0ff, size: [0.3, 0.6], life: 0.1, steps: 2, coreW: 0.35 });
  }
  let best = null, bd = W.stabRange;
  for (const e of enemies){ if (e.dead || e.converted || e.state === 'spawn') continue; TMP.subVectors(e.group.position, pp); TMP.y = 0; const d = TMP.length() - bodyRadius(e); if (d < bd && inReach(e, pp, W.stabRange, f, 0.4)){ bd = d; best = e; } }   // the prongs reach the body
  if (best){
    best.state = 'stagger'; best.st = W.stabStun; best.stumble = 0.3;
    damageEnemy(best, W.stabDmg * player.up.dmg, f, 10);
    hitMarker(best.dead ? 'kill' : 'hit');
    const hp = best.group.position;
    spawnHitSpark(V3(hp.x, 1.5, hp.z), 0xaff0ff, 1.4);
    // the shock crawls over the target: jagged blue stars flickering up the body
    for (let n = 0; n < 5; n++) inkSprite({ pos: V3(hp.x + rand(-0.4,0.4), rand(0.9,2.3), hp.z + rand(-0.4,0.4)), shape: 'star', points: 5, sharp: 0.12,
      color: 0x7fe0ff, size: [0.5, 0.8], life: 0.12, delay: n * 0.04, steps: 2, coreW: 0.35 });
    sparks(V3(hp.x, 1.5, hp.z), 0x9fdcff, 10, 10, { life: 0.3, size: 0.45 });
    G.shake = Math.max(G.shake, 0.3); G.hitstop = Math.max(G.hitstop, 0.06);
    floater(hp, 'STUN', '#aff0ff');
  } else if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < W.stabRange + 1){ damageBoss(W.stabDmg * player.up.dmg); }
}
export function mandoFlame(){   // keydown cue only — the stream itself is HELD (handled in updateFlame)
  if (!G.unlocked.flame) return;
  if (player.force < 5){ if (G.gt - player.lastWinded > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO FUEL', '#ff6a3a'); } return; }
  S.jetIgnite();   // the pilot catches — the roar itself is a loop in audio/director.js
}
export const FLAME = [[0, 0xfff1b8], [0.14, 0xffd34a], [0.36, 0xff8a2a], [0.6, 0xc8461e], [0.78, 0x4a3c36]];
// the flame's glow light lives in the scene from load at intensity 0, so the first burst doesn't change the light count
const flameLight = new THREE.PointLight(0xff7a2a, 0, 11);
scene.add(flameLight);
export function updateFlame(dt){
  const A = abil('flame');
  const active = isMando() && G.unlocked.flame && !!keys['f'] && player.force > 4 && G.mode === 'play' && player.darkT <= 0;
  player.flaming = active;
  const fl = player.flameLight || (player.flameLight = flameLight);
  fl.intensity += ((active ? 5.5 + Math.random()*1.5 : 0) - fl.intensity) * Math.min(1, dt*14);   // faded, never toggled: a light count change recompiles every shader (the first-flame hitch)
  if (!active) return;
  // the flame owns both hands: it cancels any shot, scope or guard already up, and those stay locked out until it ends
  player.firing = false; player.trigHeld = false; player.zoom = false; player.blockHeld = false; player.parryT = 0; player.stabQ = false;
  player.force = Math.max(0, player.force - A.fuel * (player.up.abilityCostMul || 1) * dt);
  trainHeld('flame', dt);   // each second of fire teaches the flamethrower (game/upgrades.js)
  const pp = playerPos();
  player.aiming = Math.max(player.aiming, 0.2);   // square the body up so the stream points where you look (no auto-target)
  const range = A.range * (player.up.flameRange || 1);
  const cosLim = Math.cos(A.angle);
  // the stream pours from the wrist at the player's OWN height and runs down the reticle: tip it up at a jetpacker,
  // down onto the troops below you from the air
  const aim = aimFrom(V3(pp.x, pp.y + 1.4, pp.z)), f = aim.dir;
  const fy = pp.y + 1.4;
  // the nozzle: the vambrace on his left forearm (fx/palms.js), so the stream leaves the gauntlet, not the chest
  const nz = gauntletPoint().addScaledVector(f, 0.12);
  fl.position.set(nz.x + f.x*1.6, nz.y + f.y*1.6, nz.z + f.z*1.6);
  // a roaring stream of fire fanning from the wrist: toon flame puffs that leave the nozzle white-hot and small and swell
  // as they cool in hard steps (yellow, orange, ember) into ink-rimmed smoke at the end of the stream. Emitted by time.
  player.flameEmit = (player.flameEmit || 0) + dt * 64;
  for (; player.flameEmit >= 1; player.flameEmit--){
    const spread = rand(-A.angle, A.angle) * 0.8;
    const dx = f.x*Math.cos(spread) - f.z*Math.sin(spread), dz = f.x*Math.sin(spread) + f.z*Math.cos(spread);
    const spd = range * rand(2.2, 2.9), life = rand(0.32, 0.44);
    puff(V3(nz.x, nz.y + rand(-0.05, 0.05), nz.z), FLAME[0][1], rand(0.9, 1.3) + range*0.12, life,
         V3(dx*spd, f.y*spd + rand(0.6,2.2), dz*spd), { ramp: FLAME, drag: 2.2, grav: -3, grow0: 0.08, shade: 0.3, inkW: 0.12 });
  }
  if (Math.random() < 0.5) sparks(nz, 0xffd06a, 1, range * 2.2, { dir: f, cone: A.angle, life: 0.3, grav: -2, size: 0.4 });
  // the roar is a continuous loop driven by player.flaming (audio/director.js)
  G.shake = Math.max(G.shake, 0.06);   // a steady rumble, no jitter
  // light tick damage + a steady gentle push (NO per-hit hitstop/sfx — that was the "spazz")
  const dmg = A.dmg * (player.up.flameDmg || 1) * dt;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp); TMP.y = 0;
    const d = TMP.length();
    if (d < 0.1 || !inAim(e, aim, range, cosLim, 0.12)) continue;   // the stream licks any of the body inside its fan, up or down the aim
    TMP.normalize();
    damageEnemy(e, dmg, null, 0, false, true);                 // tick = true → no spazz
    if (!e.dead && !e.t.heavy) e.group.position.addScaledVector(TMP, A.knock*dt);   // gentle, steady shove
  }
  if (bossInAim(aim, range, cosLim, 0.12)) damageBoss(dmg, true);
}

// Mando per-frame weapon upkeep: timers, free-aim drift + sway, reload, held auto-fire, flamethrower, darksaber.
export function updateMandoCombat(dt, f, r){
  if (player.fireCd > 0) player.fireCd -= dt;
  if (player.fireCdL > 0) player.fireCdL -= dt;   // the trooper's left-hand DC-17
  const CW = mandoWeapon();
  // a burst (the CARBINE, the trooper's DC-15): the next round when its gap is up
  if (player.burstLeft > 0){
    player.burstT -= dt;
    if (CW.fire !== 'burst' || G.mode !== 'play' || player.flaming || player.overheat) player.burstLeft = 0;
    else if (player.burstT <= 0) burstRound(CW);
  }
  if (player.burstQ && player.burstLeft <= 0 && player.fireCd <= 0){ player.burstQ = false; if (CW.fire === 'burst') fireTrigger(); }
  // the REPEATER's spin: winds up while the trigger is held (and the gun can fire), winds down once it's let go; the
  // barrels turn with it, and he walks slower while it's firing
  if (CW.spin){
    const on = player.firing && !player.overheat && player.ventT <= 0 && G.mode === 'play' && !player.flaming;
    player.spin = clamp(player.spin + (on ? dt / CW.spin.up : -dt / CW.spin.down), 0, 1);
    if (on && player.spin < 1 && Math.random() < dt * 12) sfx(180 + player.spin * 500, 0.05, 'sawtooth', 0.015, 120 + player.spin * 400);   // the motor whine climbing
  } else player.spin = Math.max(0, player.spin - dt * 2);
  if (player.repeaterSpin) player.repeaterSpin.rotation.z += dt * player.spin * 40;
  player.gunSlow = CW.slow && player.firing && !player.overheat ? CW.slow : 1;
  updateBeskar(dt);
  if (player.stabCdT > 0) player.stabCdT -= dt;
  if (player.missileT > 0) player.missileT -= dt;
  if (player.stabT > 0){
    player.stabT -= dt;
    const W = MANDO_WEAPONS.disruptor;
    if (player.weapon !== 'disruptor' || player.zoom) player.stabT = 0;   // (the spear is the disruptor's alone)
    else if (!player.stabHit && 1 - player.stabT / W.stabTime >= W.stabHit) stabStrike(W);
  }
  if (player.stabQ && player.stabT <= 0 && !(player.stabCdT > 0)){
    if (player.weapon === 'disruptor' && !player.zoom && G.mode === 'play') spearStab(MANDO_WEAPONS.disruptor); else player.stabQ = false;
  }
  updateMandoMelee(dt);   // the E kit: string recovery, catch window, charge and dive (melee.js)
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
  if (player.shieldDropT > 0) player.shieldDropT -= dt;
  if (player.firing && player.darkT <= 0) firePistols();   // auto weapons spray while held
  updateFlame(dt);
  updateDark(dt);
}

/* ===== BESKAR PARRY (data/mando.js BESKAR_PARRY) =====
   TAP RMB as a bolt arrives: the vambrace comes up across the body and the bolt RICOCHETS straight back at whoever
   fired it (enemies/bolts.js beskarCatch). A press opens a short window; one that catches nothing leaves a lockout, so
   it is timing, not mashing. Any gun but the Darksaber (that parries like a lightsaber), and in the air too. */
export function beskarPress(){
  if (G.hero !== 'mando' || G.mode !== 'play' || player.weapon === 'darksaber' || player.flaming) return;
  if (player.beskarLockT > 0){ sfx(260, 0.05, 'triangle', 0.025, 200); return; }   // the last one whiffed: this press only braces
  player.beskarT = BESKAR_PARRY.window + diffWindow();
  player.beskarHit = false;
  player.beskarPose = Math.max(player.beskarPose, player.beskarT);   // the arm comes up for the window (player/animation.js)
}
function updateBeskar(dt){
  if (player.beskarLockT > 0) player.beskarLockT -= dt;
  if (player.beskarPose > 0) player.beskarPose -= dt;
  if (player.beskarT > 0){
    player.beskarT -= dt;
    if (player.beskarT <= 0 && !player.beskarHit) player.beskarLockT = BESKAR_PARRY.lock;   // a whiff: no second try for a beat
  }
}
// a bolt met the raised vambrace: called by enemies/bolts.js. Sends it home and pays the hero back.
export function beskarCatch(b){
  const P = BESKAR_PARRY;
  player.beskarHit = true; player.beskarT = 0; player.beskarLockT = 0;
  player.beskarPose = P.pose;
  // a clean ricochet bleeds heat off the gun and gives the shield arm its breath back
  if (!mandoWeapon().melee){ player.heat = Math.max(0, player.heat * (1 - P.vent)); if (player.overheat && player.heat <= 0.02) player.overheat = false; }
  player.stam = Math.min(maxStam(), player.stam + P.stam);
  const at = gauntletPoint();
  sparks(at, 0xffd08a, 12, 12, { life: 0.3, size: 0.5 });
  inkSprite({ pos: at, shape: 'star', points: 8, sharp: 0.18, color: 0xfff1c8, size: [0.4, 1.1], life: 0.16, steps: 3, coreW: 0.4 });
  inkSprite({ pos: at, shape: 'ring', inner: 0.75, color: 0xffc56a, size: [0.3, 1.4], life: 0.22, fadeAt: 0.3, coreW: 0.3, inkW: 0.2 });
  G.hitstop = Math.max(G.hitstop, 0.06); G.shake = Math.max(G.shake, 0.18);
  screenFlash('radial-gradient(ellipse at center, rgba(255,214,150,.12), transparent 42%)', 0.3, 0.12);
  sfx(2300, 0.09, 'square', 0.05, 1200); sfx(900, 0.14, 'triangle', 0.06, 520);
  tutEvent('beskarParry');
}
