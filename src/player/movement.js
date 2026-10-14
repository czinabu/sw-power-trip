// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shared movement abilities: dash, jump, wall detection.

import { CFG } from '../data/config.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, solids, keys, player } from '../state.js';
import { DJUMP_FORCE, WALLKICK_FORCE } from '../data/mando.js';
import { fwd, rightV, playerPos, stance } from './helpers.js';
import { cancelSwing } from './jedi/combat.js';
import { STEP_UP } from '../world/collision.js';

export function forceDash(){
  const A = CFG.abilities.dash;
  if (!G.unlocked.dash || player.cds.dash > 0 || player.force < A.cost || G.mode !== 'play') return;
  if (player.atkT > 0) cancelSwing();   // DASH-CANCEL — bail a swing into an evasive dash in any direction
  player.force -= A.cost;   // the dash spends Force
  player.cds.dash = A.cd * (stance().dashCd || 1) * player.up.dashCdMult;
  player.dashT = A.time;
  const dir = V3(0,0,0);
  if (keys['w']) dir.add(fwd());
  if (keys['s']) dir.sub(fwd());
  if (keys['d']) dir.add(rightV());
  if (keys['a']) dir.sub(rightV());
  if (dir.lengthSq() < 0.01) dir.copy(fwd());
  dir.normalize();
  player.vel.addScaledVector(dir, A.speed);
  // dash is now an acrobatic spinning evade — a twirl around the vertical axis
  const df = dir.dot(fwd()), drr = dir.dot(rightV());
  const sideDash = Math.abs(drr) >= Math.abs(df);
  const sign = sideDash ? (drr >= 0 ? 1 : -1) : (df >= 0 ? -1 : 1);
  player.flip = {
    axis: 'y', sign, t: 0, dur: 0.44,
    turns: sideDash ? 1 : 1.25,        // forward/back twirls carry a little more rotation
    lean: sideDash ? 0.5 : 0.25,       // banked flourish into the spin
    pitch: sideDash ? 0.1 : 0.35,      // forward/back tuck slightly
  };
  burst(playerPos().clone().setY(1), 0x88ddff, 8, 5, 2);
  S.dash();
}

export function doJump(){
  if (G.mode !== 'play' || player.slamming) return;
  if (G.hero === 'mando'){
    // a ground hop to kick off the ground; sustained flight is HOLD SPACE (jetpack in updatePlayer)
    if (player.grounded){ player.vy = CFG.player.jumpVel * 0.9; player.grounded = false; S.dash(); }
    return;
  }
  if (player.blockHeld && player.grounded){
    // FORCE-ASSISTED EVADE out of the guard — a long, clean acrobatic leap that carries you clear.
    //   W = FRONT handspring · A/D = SIDE flip · S/neutral = BACK flip. i-frames last the whole move.
    player.vy = CFG.player.jumpVel * 0.82;            // low, gliding arc — these COVER GROUND, not height
    player.grounded = false;
    const dur = 0.72;                                 // slower, more cinematic — the spin hangs with the arc
    player.dashT = Math.max(player.dashT, dur);        // i-frames for the full flip — a real dodge
    let axis = 'backflip', sign = 1;
    if (keys['w']){ axis = 'x'; sign = 1; player.vel.addScaledVector(fwd(), 22); }            // FRONT handspring, far forward
    else if (keys['a']){ axis = 'z'; sign = -1; player.vel.addScaledVector(rightV(), -21); }  // SIDE flip, left
    else if (keys['d']){ axis = 'z'; sign = 1; player.vel.addScaledVector(rightV(), 21); }     // SIDE flip, right
    else player.vel.addScaledVector(fwd(), -20);                                               // BACK flip, away
    player.flip = { axis, sign, t: 0, dur, turns: 1 };
    burst(playerPos().clone().setY(0.8), stance().blade, 10, 6, 2);
    sfx(360, 0.12, 'sine', 0.05, 600); S.dash();
    return;
  }
  if (player.grounded){
    player.vy = CFG.player.jumpVel;
    player.grounded = false;
    return;
  }
  // airborne: a nearby wall/pillar lets you KICK OFF — light parkour to reposition mid-fight. Costs a SMALL Force
  // fee (used to be free): cheap enough that one mid-fight reposition barely registers, but enough that spam-
  // chaining kicks in a tight corridor (e.g. the Overwatch Gantry's climbing flue) for endless free altitude
  // self-limits once Force runs dry, instead of being a truly unlimited climb the jetpack never gets to be.
  // (Insufficient Force just silently falls through to the double-jump check below, same as that check's own
  // silent low-Force fail — no new denial UI needed.)
  const wn = nearbyWallNormal();
  if (wn && player.force >= WALLKICK_FORCE){
    player.force -= WALLKICK_FORCE;
    player.vy = CFG.player.jumpVel * 1.08;
    player.vel.addScaledVector(wn, 13);          // launch away from the surface
    player.airLeft = CFG.player.airJumps;        // refresh air options so you can chain kicks
    player.doubleJumped = false;
    // FLIP off the wall — kick into a backward somersault facing the way you're looking (push-off direction)
    const spin = (wn.x * fwd().z - wn.z * fwd().x) >= 0 ? 1 : -1;
    const facingWall = (-wn.x) * fwd().x + (-wn.z) * fwd().z;   // >0 = looking INTO the wall → backflip away
    player.flip = facingWall > 0
      ? { axis: 'backflip', sign: 1, t: 0, dur: 0.66, turns: 1 }            // looking at the wall → flip backward off it
      : { axis: 'x', sign: 1, t: 0, dur: 0.66, turns: 1 };                   // looking away → forward handspring off it
    const pp = playerPos();
    burst(V3(pp.x - wn.x*0.6, pp.y + 0.6, pp.z - wn.z*0.6), stance().blade, 9, 6, 3);
    floater(pp, 'WALL KICK', '#bfe8ff');
    sfx(420, 0.12, 'square', 0.06, 900); S.dash();
    return;
  }
  // DOUBLE JUMP is only available on the way UP — once you're descending, holding space FLOATS you down instead
  if (player.airLeft > 0 && player.vy > 0 && player.force >= DJUMP_FORCE){
    player.airLeft--;
    player.force = Math.max(0, player.force - DJUMP_FORCE);   // the double jump spends Force
    player.doubleJumped = true;        // arms the aerial Force Slam
    player.vy = CFG.player.jumpVel * 1.35;   // a big, epic Force-leap on the second jump
    // a clean FORWARD front-flip (jedi flips face the way you're looking; block flips are the directional exception)
    player.flip = { axis: 'x', sign: 1, t: 0, dur: 0.82, turns: 1 };   // slowed to hang with the big Force-leap arc
    player.vel.addScaledVector(fwd(), 5);    // slight forward carry
    burst(playerPos().clone().setY(playerPos().y + 0.4), 0x88ddff, 6, 4, 2);
    S.dash();
  }
}
// returns a horizontal unit normal pointing AWAY from a nearby pillar or arena wall, or null
function nearbyWallNormal(){
  const pp = playerPos();
  for (const c of solids){
    // must be alongside the surface, and BELOW the mantle threshold (STEP_UP) — collideSolids already treats
    // anything within STEP_UP of the top as a standable surface, so the wall-kick band stops just under that
    // instead of overlapping it (the old +0.6 upper bound overlapped STEP_UP's 0.5, leaving an ambiguous sliver
    // where a jump could resolve as either a mantle or a kick with no defined precedence).
    if (pp.y > c.h - STEP_UP || pp.y < c.h - 2.6) continue;
    if (c.box){
      const nx = clamp(pp.x, c.x - c.hx, c.x + c.hx), nz = clamp(pp.z, c.z - c.hz, c.z + c.hz);
      const dx = pp.x - nx, dz = pp.z - nz, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 1.3) return V3(dx/d, 0, dz/d);
    } else {
      const dx = pp.x - c.x, dz = pp.z - c.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < c.r + 1.35) return V3(dx/d, 0, dz/d);
    }
  }
  const h = shared.arenaHalf - 1;
  if (pp.x >  h - 1.4) return V3(-1, 0, 0);
  if (pp.x < -(h - 1.4)) return V3( 1, 0, 0);
  if (pp.z >  h - 1.4) return V3( 0, 0, -1);
  if (pp.z < -(h - 1.4)) return V3( 0, 0,  1);
  return null;
}
