// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CLONE ARC TROOPER's own kit (testing only): the input map, the frag grenade, the rifle bash and the combat roll.
// Its guns (the DC-15 burst rifle and the twin DC-17s) fire through the Mando's gun code (mando/weapons.js), since both
// are gunners; the tuning is data/trooper.js.

import { G, shared, enemies, player } from '../../state.js';
import { TROOPER, TROOPER_WEAPON_ORDER } from '../../data/trooper.js';
import { MANDO_WEAPONS } from '../../data/mando.js';
import { V3, clamp, TMP } from '../../utils.js';
import { sfx, S } from '../../audio/sfx.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { spawnHitSpark } from '../../fx/vfx.js';
import { palmPoints } from '../../fx/palms.js';
import { fwd, playerPos } from '../helpers.js';
import { mandoWeapon, mandoAimPoint, mandoAimRay, switchWeapon, fireTrigger, startReload } from '../mando/weapons.js';
import { mandoDive } from '../mando/mobility.js';
import { trySlide } from '../parkour.js';
import { throwGrenade } from '../../enemies/grenades.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { bodyRadius } from '../../enemies/bodyshape.js';
import { isGuarding, guardImpact } from '../../enemies/duel.js';
import { DUEL } from '../../data/duel.js';
import { damageBoss } from '../../boss/boss.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { trooperPowerKey, updateTrooperPowers, resetTrooperPowers } from './abilities.js';
import { battlefieldCall, updateCalls, resetCalls } from '../../allies/calls.js';
import { resetCommand } from './command.js';

/* ---------- INPUT (engine/input.js hands the trooper's presses here) ---------- */
// LMB: the rifle's burst, or the next pistol. RMB: aim (the steady stance): a tighter cone, a steadier reticle.
export function trooperMouseDown(button){
  if (button === 0){ player.trigHeld = true; fireTrigger(); }
  if (button === 2 && !(player.gbT > 0)) player.blockHeld = true;
}
export function trooperKey(k, repeat){
  if (k === 'shift' && !repeat) trooperRoll();
  if (G.mode !== 'play') return;
  if (k === 'c' && !repeat) trySlide();   // SLIDE out of a run (parkour.js), firing as you go
  if (k === 'g' && !repeat) fragGrenade();
  if (k === 'e' && !repeat) rifleBash();
  if (k === 'r' && !repeat) startReload();   // overheated: the active vent (mando/weapons.js activeVent)
  if (k === '1') switchWeapon('rifle');
  if (k === '2') switchWeapon('pistols');
  if (k === '3' && G.unlocked.launcher) switchWeapon('launcher');
  if (k === 't' && !repeat) battlefieldCall();   // BATTLEFIELD CALLS: reinforce or a supply drop, for COMMAND POINTS (allies/calls.js)
  trooperPowerKey(k, repeat);   // the powers: player/trooper/abilities.js
}
// the mouse wheel: the other gun
export function trooperCycle(dir){
  const order = TROOPER_WEAPON_ORDER.filter(w => w !== 'launcher' || G.unlocked.launcher);
  const i = order.indexOf(player.weapon), n = order.length;
  switchWeapon(order[((i < 0 ? 0 : i) + dir + n) % n]);
}

/* ---------- COMBAT ROLL (SHIFT) — the Mando's combat dive, on the ground only: no pack to light ---------- */
export function trooperRoll(){
  if (G.mode !== 'play' || player.mantle || player.hang || player.flip) return;
  const onGround = player.grounded || (G.gt - (player.lastGroundT ?? -9) < 0.12 && player.vy <= 0.5);
  if (onGround) mandoDive();
}

/* ---------- FRAG GRENADE (G) — charges that refill one at a time, lobbed onto the crosshair ---------- */
export function fragCharges(){
  const F = TROOPER.frag;
  if (player.fragCharges == null){ player.fragCharges = fragMax(); player.fragT = 0; }
  return player.fragCharges;
}
export function updateTrooperKit(dt){
  const F = TROOPER.frag;
  if (fragCharges() < fragMax()){
    player.fragT += dt;
    if (player.fragT >= F.recharge){ player.fragT = 0; player.fragCharges++; }
  } else player.fragT = 0;
  if (player.bashCd > 0) player.bashCd -= dt;
  updateTrooperPowers(dt);
  updateCalls(dt);
}
export const fragMax = () => TROOPER.frag.charges + (player.up.fragExtra || 0);   // FRAG POUCH (data/trooper-progression.js) adds one
export function resetTrooperKit(){ player.fragCharges = fragMax(); player.fragT = 0; player.bashCd = 0; resetTrooperPowers(); resetCalls(); resetCommand(); }
function fragTarget(F, from){
  const aim = mandoAimPoint(), ray = mandoAimRay();
  const o = ray.origin, d = ray.direction;
  let to;
  if (player.lockOn) to = V3(aim.x, 0, aim.z);
  else if (d.y < -1e-3) to = V3(o.x + d.x * -o.y / d.y, 0, o.z + d.z * -o.y / d.y);
  else to = V3(from.x + d.x * 1e3, 0, from.z + d.z * 1e3);
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz) || 1;
  const k = clamp(dist, F.minRange, F.reach) / dist;
  to.x = from.x + dx * k; to.z = from.z + dz * k;
  return to;
}
export function fragGrenade(){
  const F = TROOPER.frag;
  if (fragCharges() <= 0){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO GRENADES · ' + Math.ceil(F.recharge - player.fragT) + 'S', '#ff9a66'); }
    return;
  }
  player.fragCharges--; player.aiming = 0.6;
  const from = palmPoints(['L'])[0], to = fragTarget(F, from);
  throwGrenade({ t: { blastR: F.radius, fuse: F.fuse, dmg: 0 } }, from, to, true);   // friendly: it hurts foes, never you or the squad
  S.jump(); floater(playerPos(), 'FRAG OUT', '#9fd4ff');
  tutEvent('grenade');
}

/* ---------- RIFLE BASH (E) — a short shove with the stock: a stagger, not a combo ---------- */
export function rifleBash(){
  const A = TROOPER.bash;
  if (player.bashCd > 0 || player.flip || player.hang || player.flinchT > 0) return;
  player.bashCd = A.cd; player.aiming = 0.4; player.recoil = 0.6; player.recoilKick = 0.6;
  const f = fwd(), pp = playerPos(), cosLim = Math.cos(A.arc);
  player.vel.addScaledVector(f, 5);
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > 2.2) continue;
    TMP.y = 0;
    if (TMP.length() - bodyRadius(e) > A.range) continue;
    const kd = TMP.lengthSq() < 0.001 ? f.clone() : TMP.clone().normalize();
    if (TMP.lengthSq() > 0.001 && kd.dot(f) < cosLim) continue;
    if (isGuarding(e)) guardImpact(e, DUEL.posture.kick);   // like a kick: the answer to a guard
    damageEnemy(e, A.dmg * player.up.dmg, kd, A.knock); flinchEnemy(e, kd, 0.6);
    if (!e.dead && !e.t.heavy){ e.state = 'stagger'; e.st = A.stun; }
    hit++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < A.range + 1.2) damageBoss(A.dmg * 0.5);
  const ip = V3(pp.x + f.x * 1.2, pp.y + 1.3, pp.z + f.z * 1.2);
  if (hit){
    tutEvent('kick');
    G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.3);
    spawnHitSpark(ip, 0xcfe0ec, 1.0); burst(ip, 0xbfe8ff, 6, 7, 4, 0.8); S.punch(ip, 1.1);
  } else { burst(ip, 0xcfe0ec, 3, 5, 3); sfx(240, 0.06, 'triangle', 0.04, 160); }
}

// the trooper's starting guns: the rifle in hand
export function trooperStartKit(){
  resetTrooperKit();
  if (!MANDO_WEAPONS[player.weapon] || !MANDO_WEAPONS[player.weapon].trooper){ player.weapon = null; switchWeapon('rifle'); }
}
