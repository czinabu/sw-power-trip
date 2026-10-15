// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MOVE: grounded-movement and parkour tuning (air control, fall weight, landings, mantle/vault, wall-run, roll).

/* The Jedi's feet. A jump is a commitment: you steer it a little, it comes down faster than it went up, and a
   long drop costs a beat on landing unless you roll out of it. The Force leap/glide (HOLD SPACE) keeps its own
   tuning in data/mando.js (JEDI_FORCE); the Mando's jetpack flight is untouched by everything here. */
export const MOVE = {
  // ground: speed builds instead of snapping to the top; planting to turn or stop brakes harder than you accelerate
  accel: 22,            // m/s² toward the input direction (was CFG.player.accel 34, near-instant)
  brake: 46,            // m/s² when stopping or reversing against your momentum
  swingMove: 0.55,      // footwork while a saber swing is in flight (Ataru's moveAtk multiplies on top)
  // air: a jump keeps its takeoff momentum; WASD only nudges it
  airControl: 0.22,     // fraction of ground accel available while airborne (not gliding)
  fallGravity: 1.6,     // gravity multiplier once falling — a sharper arc, no hang at the top
  maxFall: 30,          // terminal fall speed
  coyote: 0.1,          // seconds after running off a ledge that a jump still counts as a ground jump
  jumpBuffer: 0.13,     // a jump pressed this close before landing fires on touchdown
  // landings: past `staggerImpact` (m/s) the knees buckle; a roll (SHIFT just before touchdown) converts it to speed
  staggerImpact: 22.5,  // a plain jump lands ~12, a full double jump ~21; a drop past ~6 m buckles
  staggerMin: 0.16, staggerMax: 0.5, staggerSpan: 12,   // stagger seconds, ramped over `staggerSpan` m/s past the threshold
  staggerMove: 0.3,     // movement multiplier while staggered
  rollWindow: 0.3,      // SHIFT this close before touchdown (or just after) rolls
  rollTime: 0.48, rollSpeed: 9.5, rollIframes: 0.22,
  // mantle / vault: catch a ledge you jump at, or vault low cover you run into with a jump
  reach: 2.35,          // highest ledge (above the feet) the hands can catch
  vaultHeight: 1.35,    // a ledge this low (above the feet) is vaulted straight from the ground on a jump press
  vaultSpeed: 4.5,      // forward speed needed to vault from a run
  grabDist: 0.5,        // how close to the face the body must be (beyond its radius) to grab
  mantleTime: 0.34,     // seconds for a full-reach pull-up; low ledges scale down from here
  vaultTime: 0.24,
  // wall-run: airborne, running along a wall with W held
  wallRunTime: 0.75,    // longest run before you drop off
  wallRunMinSpeed: 5,   // horizontal speed needed to start one
  wallRunGravity: 0.22, // gravity multiplier while running the wall
  wallRunLift: 3.2,     // a small upward kick as the feet catch the wall
  wallRunSpeed: 9.5,    // speed carried along the wall
  // ledge hang (Jedi): a lip caught high (more than `hangFrom` above the feet) is hung from instead of vaulted
  hangFrom: 1.6,        // lower ledges are pulled straight up onto
  hangDrop: 2.05,       // feet hang this far below the lip
  shimmySpeed: 1.8,     // A/D along the face
  hangClimbHold: 0.22,  // hold W this long (or tap SPACE) to pull up; S lets go
  hangClimbTime: 0.5,
  // sprint and slide (Jedi): hold SHIFT with W to sprint; Q mid-sprint drops into a slide
  sprintMul: 1.42,      // top speed while sprinting
  sprintStam: 15,       // stamina per second
  sprintAccel: 0.55,    // steering while sprinting is heavier (accel multiplier)
  sprintTurn: 4.2,      // max body turn rate while sprinting (rad/s)
  slideTime: 0.62, slideBoost: 2.5, slideDrag: 1.6, slideMinSpeed: 7.5,
  // turning weight: the Jedi's body turns at a capped rate instead of snapping
  turnRate: 10,         // rad/s roaming
  combatTurnRate: 16,   // rad/s squared up in combat
  pivotAngle: 2.1,      // reversing input by more than this (rad) at speed plants the feet and pivots
  pivotTime: 0.16, pivotMinSpeed: 5,
};
