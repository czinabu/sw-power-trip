// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MOVE: grounded-movement and parkour tuning (air control, fall weight, landings, mantle/vault, wall-run, roll); GAIT: the planted-foot stride; FOOTING: standing steps.

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

/* GAIT: how the feet carry the body (player/anim/gait.js). The legs are solved to planted foot targets, so a foot on
   the ground stays where it landed instead of skating. Distances are metres in the world, speeds m/s.
   A stance's `gait` (data/stances.js) scales these: amp → step length, lift → foot lift, bob → hip bob. */
export const GAIT = {
  step: [0.5, 0.145, 2.0],  // step length = base + per (m/s) of speed, capped: a walk takes short steps, a sprint long ones
  duty: [0.6, 0.32],        // share of each foot's cycle spent on the ground, walk → run (below 0.5 both feet leave it)
  runFrom: 2.5, runAt: 7,   // speeds (m/s) the walk becomes a run over
  lift: [0.07, 0.3],        // swing foot clearance, walk → run (the run's heel kicks up behind)
  bob: [0.022, 0.07],       // hip dip at each footfall (rig units), walk → run
  runDrop: 0.06,            // hips sit this much lower at a run so the knees stay flexed
  blendFrom: 0.15, blendTo: 1.1,   // below `blendFrom` m/s the stance footwork owns the legs; above `blendTo` the gait does
  // weight: the body leans with ACCELERATION (a push to start, a sit-back to stop, a bank into a turn), on top of the
  // small speed lean animation.js already gives
  accelLean: 0.014, accelBank: 0.011, accelMax: 0.2, accelSmooth: 9,
};

/* FOOTING: standing and slow footwork (player/anim/footing.js). Feet stay locked on the floor; one steps when it is
   out of place. Distances in metres, angles in radians. */
export const FOOTING = {
  reach: 0.16,      // a foot this far from where the stance wants it takes a step
  turn: 0.6,        // ... or when the body has turned this far from the way the foot points
  stepTime: 0.2,    // seconds for a step (a little longer for a big one)
  lift: 0.09,       // how high the stepping foot comes up
  lead: 0.12,       // a step aims this many seconds of drift ahead
};
