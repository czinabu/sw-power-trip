// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shared movement abilities: dash, jump, wall detection.

import { CFG } from '../data/config.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, G, solids, keys, player } from '../state.js';
import { DJUMP_FORCE, WALLKICK_FORCE } from '../data/mando.js';
import { fwd, rightV, playerPos, stance } from './helpers.js';
import { cancelSwing } from './jedi/combat.js';
import { STEP_UP } from '../world/collision.js';
import { flipStyle, launchFlip } from './anim/agility.js';
import { MOVE } from '../data/movement.js';
import { tryVault, findLedge, startMantle, requestRoll, hangClimb } from './parkour.js';
import { tutEvent } from '../game/tutor-bus.js';

/* MOMENTUM in a chain of moves: each move sends you where it says, instead of piling its push on top of whatever the
   last move left. The run's momentum (moveVel) and the impulses (vel) are steered together. */
// keep only the part of the momentum that goes along (dx, dz): a dash backward out of a run goes backward
function commitTo(dx, dz){
  for (const v of [player.moveVel, player.vel]){
    const a = v.x * dx + v.z * dz;
    v.x = dx * Math.max(0, a); v.z = dz * Math.max(0, a);
  }
}
// turn the momentum to (dx, dz) and keep its speed: a second jump steers the leap toward the stick
function turnTo(dx, dz){
  for (const v of [player.moveVel, player.vel]){
    const sp = Math.hypot(v.x, v.z);
    v.x = dx * sp; v.z = dz * sp;
  }
}
// drop the part of the momentum that drives into a surface with outward normal (nx, nz): a wall kick leaves the wall
function offWall(nx, nz){
  for (const v of [player.moveVel, player.vel]){
    const a = v.x * nx + v.z * nz;
    if (a < 0){ v.x -= nx * a; v.z -= nz * a; }
  }
}
// the direction the movement keys point (camera space), or null
function stickDir(){
  const d = V3(0, 0, 0);
  if (keys['w']) d.add(fwd());
  if (keys['s']) d.sub(fwd());
  if (keys['d']) d.add(rightV());
  if (keys['a']) d.sub(rightV());
  return d.lengthSq() > 0.01 ? d.normalize() : null;
}

export function forceDash(){
  const A = CFG.abilities.dash;
  if (G.mode !== 'play' || player.mantle || player.hang) return;
  if (requestRoll(playerPos())) return;   // SHIFT just before a hard landing rolls out of it instead (free)
  if (!G.unlocked.dash || player.cds.dash > 0 || player.force < A.cost || player.landStagT > 0) return;
  if (player.atkT > 0) cancelSwing();   // DASH-CANCEL — bail a swing into an evasive dash in any direction
  player.force -= A.cost;   // the dash spends Force
  player.cds.dash = A.cd * (stance().dashCd || 1) * player.up.dashCdMult;
  player.dashT = A.time; player.dashStartT = G.gt;   // PERFECT DODGE reads the dash's start (player/damage.js)
  tutEvent('dash');
  const dir = V3(0,0,0);
  if (keys['w']) dir.add(fwd());
  if (keys['s']) dir.sub(fwd());
  if (keys['d']) dir.add(rightV());
  if (keys['a']) dir.sub(rightV());
  if (dir.lengthSq() < 0.01) dir.copy(fwd());
  dir.normalize();
  commitTo(dir.x, dir.z);
  player.vel.addScaledVector(dir, A.speed);
  // the dash's body move is the form's (data/agility.js): Ataru's butterfly twist and tuck flips, Niman's spin
  // dodge, Djem So's driven slide. The flip only poses the body; the impulse and i-frames above do the work.
  const df = dir.dot(fwd()), drr = dir.dot(rightV());
  const sideDash = Math.abs(drr) >= Math.abs(df);
  const dd = sideDash ? 'side' : (df >= 0 ? 'fwd' : 'back');
  launchFlip({ ...flipStyle('dash', dd), t: 0, dur: 0.44, side: sideDash ? (drr >= 0 ? 1 : -1) : 1 }, dd);
  burst(playerPos().clone().setY(1), 0x88ddff, 8, 5, 2);
  S.dash();
}

export function doJump(){
  if (G.mode !== 'play' || player.slamming || player.mantle) return;
  if (player.hang){ hangClimb(); return; }   // SPACE off a ledge hang pulls you up
  // COYOTE TIME — a jump just after running off a ledge still counts as a ground jump
  const coyote = !player.grounded && player.vy <= 0.5 && G.gt - (player.lastGroundT ?? -9) < MOVE.coyote
                 && G.gt - (player.lastJumpT ?? -9) > MOVE.coyote;
  const onGround = player.grounded || coyote;
  if (onGround && !player.blockHeld && tryVault(playerPos())) return;   // running at low cover: up and over it
  if (G.hero === 'mando'){
    // a ground hop to kick off the ground; sustained flight is HOLD SPACE (jetpack in updatePlayer)
    if (onGround){ player.vy = CFG.player.jumpVel * 0.9; player.grounded = false; player.lastJumpT = G.gt; S.jump(); }
    return;
  }
  if (player.landStagT > 0) return;   // knees still buckled from a hard landing
  if (player.blockHeld && player.grounded){
    // FORCE-ASSISTED EVADE out of the guard — a long, clean acrobatic leap that carries you clear.
    //   W = FRONT handspring · A/D = SIDE flip · S/neutral = BACK flip. i-frames last the whole move.
    player.vy = CFG.player.jumpVel * 0.82;            // low, gliding arc — these COVER GROUND, not height
    player.grounded = false;
    const dur = 0.72;                                 // slower, more cinematic — the spin hangs with the arc
    player.dashT = Math.max(player.dashT, dur);        // i-frames for the full flip — a real dodge
    player.dashStartT = G.gt;
    let dir = 'back', side = 1, push = fwd().multiplyScalar(-20);                               // BACK flip, away
    if (keys['w']){ dir = 'fwd'; push = fwd().multiplyScalar(22); }                             // FRONT handspring, far forward
    else if (keys['a']){ dir = 'side'; side = -1; push = rightV().multiplyScalar(-21); }        // SIDE flip, left
    else if (keys['d']){ dir = 'side'; side = 1; push = rightV().multiplyScalar(21); }          // SIDE flip, right
    const pl = push.length(); commitTo(push.x / pl, push.z / pl);
    player.vel.add(push);
    launchFlip({ ...flipStyle('evade', dir), t: 0, dur, side }, dir);                           // the form's flip (data/agility.js)
    burst(playerPos().clone().setY(0.8), stance().blade, 10, 6, 2);
    sfx(360, 0.12, 'sine', 0.05, 600); S.dash();
    return;
  }
  if (onGround){
    player.vy = CFG.player.jumpVel;
    player.grounded = false;
    player.lastJumpT = G.gt;
    return;
  }
  // airborne at a ledge within reach: grab it now rather than spending the double jump
  const pp0 = playerPos();
  const ledge = findLedge(pp0, fwd(), STEP_UP, MOVE.reach);
  if (ledge){ startMantle(pp0, ledge, false); return; }
  // airborne: a nearby wall/pillar lets you KICK OFF — light parkour to reposition mid-fight. Costs a SMALL Force
  // fee (used to be free): cheap enough that one mid-fight reposition barely registers, but enough that spam-
  // chaining kicks in a tight corridor (e.g. the Overwatch Gantry's climbing flue) for endless free altitude
  // self-limits once Force runs dry, instead of being a truly unlimited climb the jetpack never gets to be.
  // (Insufficient Force just silently falls through to the double-jump check below, same as that check's own
  // silent low-Force fail — no new denial UI needed.)
  const wn = player.wallRun ? V3(player.wallRun.nx, 0, player.wallRun.nz) : nearbyWallNormal();
  if (wn && player.force >= WALLKICK_FORCE){
    player.force -= WALLKICK_FORCE;
    player.vy = CFG.player.jumpVel * 1.08;
    offWall(wn.x, wn.z);                         // nothing still driving into the wall
    player.vel.addScaledVector(wn, 13);          // launch away from the surface
    player.airLeft = CFG.player.airJumps;        // refresh air options so you can chain kicks
    player.doubleJumped = false;
    player.wallRun = null; player.wallRunUsed = false;   // a kick can carry onto the opposite wall for another run
    // FLIP off the wall — kick into a backward somersault facing the way you're looking (push-off direction)
    const spin = (wn.x * fwd().z - wn.z * fwd().x) >= 0 ? 1 : -1;
    const facingWall = (-wn.x) * fwd().x + (-wn.z) * fwd().z;   // >0 = looking INTO the wall → backflip away
    // looking at the wall → flip backward off it; looking away → forward handspring off it
    const wd = facingWall > 0 ? 'back' : 'fwd';
    launchFlip({ ...flipStyle('wall', wd), t: 0, dur: 0.66, side: spin }, wd);
    const pp = playerPos();
    burst(V3(pp.x - wn.x*0.6, pp.y + 0.6, pp.z - wn.z*0.6), stance().blade, 9, 6, 3);
    sfx(420, 0.12, 'square', 0.06, 900); S.dash();
    return;
  }
  // JUMP BUFFER — about to touch down: hold the press and jump on landing instead of burning the double jump
  if (player.vy < 0 && pp0.y - (player.groundY || 0) < Math.max(0.6, -player.vy * MOVE.jumpBuffer)){ player.jumpBufT = G.gt; return; }
  // DOUBLE JUMP is only available on the way UP — once you're descending, holding space FLOATS you down instead
  if (player.airLeft > 0 && player.vy > 0 && player.force >= DJUMP_FORCE){
    player.airLeft--;
    player.force = Math.max(0, player.force - DJUMP_FORCE);   // the double jump spends Force
    player.doubleJumped = true;        // arms the aerial Force Slam
    tutEvent('doubleJump');
    player.vy = CFG.player.jumpVel * 1.35;   // a big, epic Force-leap on the second jump
    // the form's second-jump move, facing the way you're looking: Ataru's twisting front flip, Niman's layout,
    // Djem So's flipless Force leap (data/agility.js); slowed to hang with the big Force-leap arc
    // the second jump steers the leap: held keys turn the momentum their way, with a slight carry that way (the way
    // you're looking with no keys held)
    const sd = stickDir();
    if (sd) turnTo(sd.x, sd.z);
    player.vel.addScaledVector(sd || fwd(), 5);
    launchFlip({ ...flipStyle('double'), t: 0, dur: 0.82 }, 'fwd');
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
  const h = shared.arenaHalf - 1, hz = shared.arenaHalfZ - 1;
  if (pp.x >  h - 1.4) return V3(-1, 0, 0);
  if (pp.x < -(h - 1.4)) return V3( 1, 0, 0);
  if (pp.z >  hz - 1.4) return V3( 0, 0, -1);
  if (pp.z < -(hz - 1.4)) return V3( 0, 0,  1);
  return null;
}
