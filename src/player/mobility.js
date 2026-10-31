// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Jedi combat mobility (data/mobility.js): whether you're in a fight, the ground roll, Force dash charges, and what
// being in the air costs you mid-fight.

import { MOBILITY, MANDO_MOBILITY } from '../data/mobility.js';
import { MOVE } from '../data/movement.js';
import { CFG } from '../data/config.js';
import { stamDelay } from './stamina.js';
import { floater } from '../fx/floaters.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { S } from '../audio/sfx.js';
import { shared, G, keys, enemies, player, isGunner } from '../state.js';
import { fwd, rightV, playerPos, stance } from './helpers.js';
import { cancelSwing } from './jedi/combat.js';
import { flipStyle, launchFlip, formNow } from './anim/agility.js';
import { tutEvent } from '../game/tutor-bus.js';


// the current form's mobility tuning (Niman's when the stance has no entry)
export const formMob = () => MOBILITY.forms[formNow()] || MOBILITY.forms.niman;

/* IN COMBAT — a live foe within range, the boss up, or a blow taken or landed in the last few seconds. Sparring
   partners in the training grounds count too (the dodge lessons are fought). The Mando's fight starts farther out
   (MANDO_MOBILITY.combat.range). Cached per frame. */
let _cT = -1, _c = false;
export function inCombat(){
  if (G.gt === _cT) return _c;
  _cT = G.gt;
  const C = MOBILITY.combat;
  _c = false;
  if (shared.boss && shared.boss.hp > 0) return (_c = true);
  if (G.gt - (player.lastHurt ?? -9) < C.linger || G.gt - (player.lastStrikeT ?? -9) < C.linger) return (_c = true);
  const range = isGunner() ? MANDO_MOBILITY.combat.range : C.range;
  const pp = playerPos(), r2 = range * range;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z;
    if (dx * dx + dz * dz < r2) return (_c = true);
  }
  return _c;
}
// airborne in a fight: the moment the mid-air rules (data/mobility.js MOBILITY.air) apply
export const airborneInCombat = () => !isGunner() && !player.grounded && !player.wallRun && !player.hang && !player.mantle && inCombat();

/* DASH CHARGES — the most you hold, and a tick that refills them one at a time (faster out of a fight). A form
   switch that lowers the cap keeps what you had up to the new cap. */
export const maxCharges = () => formMob().charges ?? MOBILITY.dash.charges;
export function updateDashCharges(dt){
  if (isGunner()) return;
  const max = maxCharges();
  if (player.dashCharges == null) player.dashCharges = max;
  if (player.dashCharges > max) player.dashCharges = max;
  if (player.dashCharges >= max){ player.dashRecharge = 0; return; }
  const per = MOBILITY.dash.recharge * (formMob().recharge || 1) * player.up.dashCdMult * (inCombat() ? 1 : MOBILITY.explore.rechargeMul);
  player.dashRecharge = (player.dashRecharge || 0) + dt / per;
  if (player.dashRecharge >= 1){ player.dashRecharge = 0; player.dashCharges++; }
}
// spend a charge (false if none). Out of combat the dash is free.
export function spendCharge(){
  if (!inCombat() && MOBILITY.explore.free) return true;
  if ((player.dashCharges ?? maxCharges()) < 1) return false;
  player.dashCharges = (player.dashCharges ?? maxCharges()) - 1;
  return true;
}
export function refundCharge(){ player.dashCharges = Math.min(maxCharges(), (player.dashCharges ?? 0) + 1); }

// the direction the movement keys point (camera space), or the way you face
function stickOr(dflt){
  const d = V3(0, 0, 0);
  if (keys['w']) d.add(fwd());
  if (keys['s']) d.sub(fwd());
  if (keys['d']) d.add(rightV());
  if (keys['a']) d.sub(rightV());
  return d.lengthSq() > 0.01 ? d.normalize() : dflt;
}

/* GROUND ROLL — SHIFT on the ground in a fight. Costs stamina (MOBILITY.roll.stam), short, a brief window of invulnerability, any way you press
   (no keys: a roll back, out of reach). The body move is the form's (data/agility.js roll). */
export function groundRoll(){
  const R = MOBILITY.roll, F = formMob().roll || {};
  if (player.cds.roll > 0) return false;
  const cost = (R.stam || 0) * (F.stam ?? 1);
  if (player.stam < cost){   // no breath for it: the feet won't carry a roll
    if (G.gt - (player.lastWinded ?? -9) > 0.6){ player.lastWinded = G.gt; floater(playerPos(), 'WINDED', '#ffaa66'); }
    return false;
  }
  if (player.atkT > 0) cancelSwing();   // ROLL-CANCEL: bail a swing into the roll
  player.stam -= cost; player.stamDelay = Math.max(player.stamDelay || 0, stamDelay());
  const dir = stickOr(fwd().clone().negate());
  const df = dir.dot(fwd()), drr = dir.dot(rightV());
  const side = Math.abs(drr) >= Math.abs(df) * 0.8;
  const dd = side ? 'side' : (df >= 0 ? 'fwd' : 'back');
  // momentum goes the roll's way, and the roll adds its own push
  for (const v of [player.moveVel, player.vel]){
    const a = Math.max(0, v.x * dir.x + v.z * dir.z);
    v.x = dir.x * a; v.z = dir.z * a;
  }
  player.vel.addScaledVector(dir, R.speed * (F.speed || 1));
  player.dashT = Math.max(player.dashT, R.iframes * (F.iframes || 1));
  player.dashStartT = G.gt;   // a perfect dodge counts from the roll's start (player/damage.js)
  player.dodgeKind = 'roll'; player.dashSpent = false;
  player.rollT = R.time; player.rollAt = G.gt;
  player.cds.roll = R.time + R.cd * (F.cd || 1);
  player.swingLock = Math.max(player.swingLock || 0, R.time * 0.6 + R.swingLock);
  if (!isGunner() && stance().swoop) player.momentum = { kind: 'swoop', until: G.gt + R.time + 0.5 };   // ATARU: SHIFT in a fight rolls, and a cut out of the roll is the Hawk-Bat Swoop too (jedi/combat.js)
  tutEvent('dash');   // the dodge lessons count a roll as a dash
  launchFlip({ ...flipStyle('roll', dd), t: 0, dur: R.time, side: side ? (drr >= 0 ? 1 : -1) : 1 }, dd);
  burst(playerPos().clone().setY(0.25), 0xb9c2cc, 6, 3, 1.5, 0.8);
  S.land(0.25);
  return true;
}
// a second SHIFT this soon into a roll upgrades it to a Force dash
export const rollRedash = () => player.dodgeKind === 'roll' && G.gt - (player.rollAt ?? -9) < MOBILITY.roll.redash;

/* MID-AIR in a fight. The guard can't hold (Ataru keeps a timed parry), and blows that land hit harder and drop you. */
export function airGuardLost(){ return MOBILITY.air.noGuard && airborneInCombat(); }
export function airParryOk(){ return !airGuardLost() || !!formMob().airParry; }
export function airDamageMul(){
  if (!airborneInCombat()) return 1;
  return 1 + (MOBILITY.air.dmgTaken - 1) * (formMob().airDmg ?? 1);
}
export function airControlMul(){
  return airborneInCombat() ? MOBILITY.air.control * (formMob().airControl || 1) : 1;
}
// a blow landed mid-air: the rise is cut off and the second jump is gone
export function knockOutOfAir(){
  if (!MOBILITY.air.knockDown || !airborneInCombat()) return;
  if (player.vy > 0) player.vy = 0;
  player.airLeft = 0; player.fjUsed = true; player.gliding = false;
}
// the footwork kept while a cut is in flight (data/movement.js swingMove × the form's)
export const swingMoveMul = () => MOVE.swingMove * (formMob().swingMove || 1);
