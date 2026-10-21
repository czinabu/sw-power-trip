// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mando combat mobility (data/mobility.js MANDO_MOBILITY): SHIFT is a combat dive on the ground in a fight (a second
// tap is the rocket boost), an air dodge in the air, and the jet charges the air dodge spends.

import { MANDO_MOBILITY as MM, MOBILITY } from '../../data/mobility.js';
import { V3 } from '../../utils.js';
import { sfx, S } from '../../audio/sfx.js';
import { G, keys, player } from '../../state.js';
import { fwd, rightV, playerPos } from '../helpers.js';
import { sparks, puff } from '../../fx/ink.js';
import { burst } from '../../fx/particles.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { inCombat } from '../mobility.js';
import { mandoBoostDash } from './gadgets.js';

// the direction the movement keys point (camera space), or the fallback
function stickOr(dflt){
  const d = V3(0, 0, 0);
  if (keys['w']) d.add(fwd());
  if (keys['s']) d.sub(fwd());
  if (keys['d']) d.add(rightV());
  if (keys['a']) d.sub(rightV());
  return d.lengthSq() > 0.01 ? d.normalize() : dflt;
}

/* SHIFT pressed. Air: the air dodge (held on, it becomes the flight boost in mando/flight.js). Ground in a fight: the
   combat dive, or the rocket boost on a second tap early in the dive. Ground out of a fight: the rocket boost. */
export function mandoShift(){
  if (G.mode !== 'play' || player.mantle || player.hang) return;
  // (a dive over uneven ground can leave the floor for a frame: that still counts as the ground)
  const onGround = player.grounded || (G.gt - (player.lastGroundT ?? -9) < 0.12 && player.vy <= 0.5 && !player.jetActive);
  if (!onGround){ airDodge(); return; }
  if (inCombat() && !(player.dodgeKind === 'dive' && G.gt - (player.rollAt ?? -9) < MM.dive.redash)){ mandoDive(); return; }
  if (player.flip){   // the boost takes the dive (or the slide) over: back to the thruster skid
    player.flip = null; player.vis.rotation.set(0, 0, 0); player.vis.position.set(0, 0, 0);
  }
  mandoBoostDash(true);
}

/* COMBAT DIVE — Helldivers: free, i-frames through the throw, any way you press (no keys: back, out of reach). He
   turns to the dive, throws himself flat, lands on his chest plate, barrel-rolls once on the deck and gets back up
   (the body move is anim/agility.js mandoBody). */
export function mandoDive(){
  const D = MM.dive;
  if (player.cds.roll > 0 || player.meleeT > 0 || player.stabT > 0 || player.slamming) return false;
  player.slideT = 0;
  const dir = stickOr(fwd().clone().negate());
  // momentum goes the dive's way, and the dive adds its own push
  for (const v of [player.moveVel, player.vel]){
    const a = Math.max(0, v.x * dir.x + v.z * dir.z);
    v.x = dir.x * a; v.z = dir.z * a;
  }
  player.vel.addScaledVector(dir, D.speed);
  player.dashT = Math.max(player.dashT, D.iframes);
  player.dashStartT = G.gt;   // a perfect dodge counts from the dive's start (player/damage.js)
  player.dodgeKind = 'dive'; player.dashSpent = false; player.rollAt = G.gt;
  player.cds.roll = D.time + D.cd;
  tutEvent('dash');
  player.flip = { kind: 'dive', t: 0, dur: D.time, face: Math.atan2(dir.x, dir.z), side: dir.dot(rightV()) >= 0 ? 1 : -1 };
  burst(playerPos().clone().setY(0.25), 0xb9c2cc, 6, 3, 1.5, 0.8);
  S.jump();
  return true;
}

/* JET CHARGES — the air dodge spends one; they refill one at a time, faster out of a fight. */
export function updateJetCharges(dt){
  if (G.hero !== 'mando') return;
  const A = MM.airDodge;
  if (player.jetCharges == null || player.jetCharges > A.charges) player.jetCharges = A.charges;
  if (player.jetCharges >= A.charges){ player.jetRecharge = 0; return; }
  const per = A.recharge * (inCombat() ? 1 : MOBILITY.explore.rechargeMul);
  player.jetRecharge = (player.jetRecharge || 0) + dt / per;
  if (player.jetRecharge >= 1){ player.jetRecharge = 0; player.jetCharges++; }
}

/* AIR DODGE — a hard thruster kick any way you press (no keys: back), i-frames, and the fall stops for a beat. The
   kick rides the impulse velocity, so it's a quick hop sideways rather than a long drift; momentum that went against
   it is cancelled, the rest of the flight keeps going. No flips: the pack does the work. */
export function airDodge(){
  const A = MM.airDodge;
  if (player.cds.airDodge > 0 || player.jet < A.fuel || player.slamming || player.darkT > 0) return false;
  if (inCombat()){
    if ((player.jetCharges ?? A.charges) < 1) return false;
    player.jetCharges = (player.jetCharges ?? A.charges) - 1;
  }
  player.jet -= A.fuel;
  player.cds.airDodge = A.gap;
  const dir = stickOr(fwd().clone().negate());
  for (const v of [player.moveVel, player.vel]){
    const a = v.x * dir.x + v.z * dir.z;
    if (a < 0){ v.x -= dir.x * a; v.z -= dir.z * a; }   // nothing still carrying you the other way
  }
  player.vel.addScaledVector(dir, A.speed);
  player.vy = Math.max(player.vy, A.lift);
  player.dashT = Math.max(player.dashT, A.iframes);
  player.dashStartT = G.gt; player.dodgeKind = 'airdodge'; player.dashSpent = false;
  tutEvent('dash');
  const bp = playerPos();
  sparks(V3(bp.x - dir.x * 0.3, bp.y + 1.1, bp.z - dir.z * 0.3), 0x66c6ff, 10, 14, { dir: V3(-dir.x, -0.2, -dir.z), cone: 0.3, life: 0.2, grav: 0 });
  puff(V3(bp.x - dir.x * 0.6, bp.y + 0.9, bp.z - dir.z * 0.6), 0xb8c2c8, 0.9, 0.35, V3(-dir.x * 3, 0, -dir.z * 3));
  G.shake = Math.max(G.shake, 0.1);
  S.dash(); sfx(260, 0.1, 'sawtooth', 0.04, 140);
  return true;
}
