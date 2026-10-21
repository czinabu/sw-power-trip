// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AGILITY — how each form (and the Mando) moves through dashes, jumps, flips, dives and landings.
//
// Pure presentation: the moves keep their speeds, durations, i-frames and hitboxes (data/config.js, data/mando.js,
// player/movement.js). This only says what the body does while they play out (docs/animation-guidelines.md).
//
// A flip is described by turns about the body's own axes, rotated about the centre of mass rather than the feet:
//   somer — forward somersaults (− = backward)    twist — turns about the long axis (a "full" is 1)
//   roll  — cartwheel turns (sign = side)          spin  — turns about the vertical (a dash twirl)
//   tilt  — how far the body lies over during a spin (1.2 ≈ horizontal butterfly twist)
//   lift  — extra height of the arc, metres        bank / pitch — lean into the move at mid-flight
//   legs  — tuck · pike · layout · split · slide   arms — an AIR_GUARDS key for the saber hand(s)
//   ease  — 'flip' (fast through the middle, hanging at the ends) or 'twirl' (even spin)

/* ---------------- JEDI — per form ---------------- */
export const AGILITY = {
  // FORM IV ATARU — Yoda and Qui-Gon: everything leaves the ground, everything turns. Butterfly twists, twisting
  // flips, a corkscrew off the second jump, and light cat landings.
  ataru: {
    dash: {
      side: { spin: 1, tilt: 1.15, lift: 0.75, legs: 'split', arms: 'tuck', ease: 'twirl' },          // butterfly twist
      fwd:  { somer: 1, lift: 0.85, legs: 'tuck', arms: 'tuck' },                                        // dive-over front tuck
      back: { somer: -1, lift: 0.8, legs: 'tuck', arms: 'tuck' },                                        // back tuck
    },
    jump:   { tuck: 1.0, spin: 1, arms: 'tuck' },                    // a tap jump turns a full twist in the tuck
    double: { somer: 1, twist: 1, lift: 0.4, legs: 'tuck', arms: 'tuck' },              // front flip with a full twist
    evade: {
      back: { somer: -1, twist: 1, lift: 0.5, legs: 'layout', arms: 'layout' },          // back layout full
      fwd:  { somer: 1, twist: 0.5, lift: 0.4, legs: 'pike', arms: 'tuck' },             // front handspring, half-out
      side: { roll: 1, twist: 0.5, lift: 0.45, legs: 'split', arms: 'layout' },          // no-hands aerial
    },
    wall:   { back: { somer: -1, twist: 0.5, legs: 'tuck', arms: 'tuck' }, fwd: { somer: 1, twist: 1, legs: 'tuck', arms: 'tuck' } },
    glide:  { legs: 'tuck', pitch: 0.28, arms: 'trail' },            // a crouched cat drop, blade trailing
    rise:   { pitch: 0.18, arms: 'trail' },                           // hurdler's leap, lead knee high
    slam:   { pitch: 0.12, legs: 'tuck', arms: 'plunge', land: 'plunge', kneel: 0.85 },   // blade-first plunge
    land:   { depth: 1.15, spring: 1.35 },                            // deep but quick — springs straight back up
    run:    { arms: 'run', twist: 1.15, pump: 1.2 },
  },
  // FORM VI NIMAN — balanced: clean single flips with open arms, a smooth spin dodge, and a Force landing with the
  // off palm to the ground.
  niman: {
    dash: {
      side: { spin: 1, tilt: 0.45, lift: 0.3, legs: 'stride', arms: 'layout', ease: 'twirl' },        // spin dodge
      fwd:  { spin: 1, tilt: 0.25, pitch: 0.3, lift: 0.3, legs: 'stride', arms: 'layout', ease: 'twirl' },
      back: { spin: -1, tilt: 0.25, pitch: -0.2, lift: 0.3, legs: 'stride', arms: 'layout', ease: 'twirl' },
    },
    jump:   { tuck: 0.7, arms: null },
    double: { somer: 1, lift: 0.35, legs: 'layout', arms: 'layout' },                   // a clean layout front flip
    evade: {
      back: { somer: -1, lift: 0.5, legs: 'layout', arms: 'layout' },
      fwd:  { somer: 1, lift: 0.4, legs: 'tuck', arms: 'tuck' },
      side: { roll: 1, lift: 0.4, legs: 'split', arms: 'layout' },
    },
    wall:   { back: { somer: -1, legs: 'tuck', arms: 'layout' }, fwd: { somer: 1, legs: 'tuck', arms: 'layout' } },
    glide:  { legs: 'float', pitch: 0.06, arms: 'palm' },            // upright float, off palm steadying the fall
    rise:   { pitch: 0.1, arms: 'palm' },
    slam:   { pitch: 0.18, legs: 'tuck', arms: 'palm', land: 'palm', kneel: 1 },        // palm-first Force landing
    land:   { depth: 1.0, spring: 1.0 },
    run:    { arms: 'run', twist: 1.0, pump: 1.0 },
  },
  // FORM V DJEM SO — Anakin and Vader: grounded and powerful. No spinning about: the dash is a low, driven slide,
  // the second jump is a raw Force leap with the blade raised to hammer, flips are tight and heavy, and every
  // landing sinks into the ground.
  djemso: {
    dash: {
      side: { bank: 0.42, drop: 0.32, legs: 'slide', arms: null },                     // a driven sidestep slide
      fwd:  { pitch: 0.38, drop: 0.3, legs: 'slide', arms: null },                     // shoulder-first charge
      back: { pitch: -0.26, drop: 0.3, legs: 'slide', arms: null },                    // a braced back-slide
    },
    jump:   { tuck: 0.45, arms: null },
    double: { pitch: -0.12, legs: 'tuck', arms: 'hammer', tuckHold: 1 },               // Force leap, blade cocked overhead
    evade: {
      back: { somer: -1, lift: 0.15, legs: 'tuck', arms: 'hammer' },                  // a tight, heavy back tuck
      fwd:  { somer: 1, lift: 0.1, legs: 'tuck', arms: 'hammer' },
      side: { roll: 1, lift: 0.1, legs: 'tuck', arms: 'hammer' },
    },
    wall:   { back: { somer: -1, legs: 'tuck', arms: 'hammer' }, fwd: { somer: 1, legs: 'tuck', arms: 'hammer' } },
    glide:  { legs: 'tuck', pitch: -0.08, arms: 'hammer' },          // hangs with the blade up, ready to bring it down
    rise:   { pitch: 0.05, arms: 'hammer' },
    slam:   { pitch: -0.05, legs: 'tuck', arms: 'hammer', land: 'smash', kneel: 0.7 },   // overhead hammer into the ground
    land:   { depth: 1.35, spring: 0.75, splay: 0.35 },              // sinks deep and wide, rises slowly
    run:    { arms: 'run', twist: 0.7, pump: 0.8 },
  },
};

/* MANDO — beskar and a jetpack, not acrobatics (Din Djarin). The ground dodge is a thruster-shoved slide, the hop
   tucks the knees, ignition snaps the legs straight under the pack, and a jet slam lands three-point. */
export const MANDO_AGILITY = {
  dodge: { drop: 0.26, bank: 0.55, pitch: 0.45 },
  hop:   { tuck: 0.55 },
  slam:  { pitch: 0.18, kneel: 1 },
  land:  { depth: 1.1, spring: 0.9 },
};

/* Air and landing guards for the saber hand(s), same notation as data/poses.js (chest space: +x weapon side, +y
   up, +z forward; hand = wrist position, blade = direction). Missing grip/form entries fall back to the form's
   ready guard. */
const OFF = [-0.55, -0.8, -0.25];
export const AIR_GUARDS = {
  regular: {
    ataru: {
      hang:   { hand: [0.16, 0.78, 0.3], blade: [0.35, 0.25, -0.9], twist: 0, off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },   // hands up on the ledge lip
      windup: { hand: [0.06, 0.92, 0.08], blade: [0.12, 0.96, -0.22], two: true, twist: 0.04, pole: [0.7, -0.3, -0.4] },   // blade raised high overhead: the aerial wind-up
      tuck:   { hand: [0.14, -0.02, 0.26], blade: [0.25, 0.55, -0.8], two: true, twist: -0.1, pole: [0.6, -0.7, -0.3] },          // hilt hugged in, blade clear behind
      layout: { hand: [0.44, 0.06, 0.1], blade: [0.7, 0.6, -0.4], twist: 0.05, off: { hand: [-0.46, 0.06, 0.1], pole: OFF } },
      trail:  { hand: [0.3, -0.24, -0.06], blade: [0.2, -0.32, -0.93], twist: -0.12, off: { hand: [-0.3, 0.02, 0.3], pole: OFF } },
      plunge: { hand: [0.06, -0.06, 0.4], blade: [0.02, -0.92, 0.38], two: true, twist: -0.05, pole: [0.6, -0.4, -0.6] },
      run:    { hand: [0.3, -0.3, -0.04], blade: [0.2, -0.58, -0.79], twist: -0.08, off: { hand: [-0.28, -0.12, 0.22], pole: OFF } },
    },
    niman: {
      hang:   { hand: [0.16, 0.78, 0.3], blade: [0.35, 0.25, -0.9], twist: 0, off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },   // hands up on the ledge lip
      windup: { hand: [0.06, 0.92, 0.08], blade: [0.12, 0.96, -0.22], two: true, twist: 0.04, pole: [0.7, -0.3, -0.4] },   // blade raised high overhead: the aerial wind-up
      tuck:   { hand: [0.2, -0.04, 0.24], blade: [0.35, 0.65, -0.65], twist: 0, off: { hand: [-0.2, -0.04, 0.24], pole: OFF } },
      layout: { hand: [0.46, 0.08, 0.06], blade: [0.75, 0.62, -0.25], twist: 0, off: { hand: [-0.48, 0.1, 0.08], pole: OFF } },
      palm:   { hand: [0.38, -0.06, -0.06], blade: [0.5, 0.62, -0.6], twist: 0.08, off: { hand: [-0.16, -0.4, 0.44], pole: OFF } },
      run:    { hand: [0.32, -0.12, 0.22], blade: [0.2, 0.9, -0.38], twist: 0.04, off: { hand: [-0.28, -0.1, 0.2], pole: OFF } },   // carried upright out front, clear of the shoulder
    },
    djemso: {
      hang:   { hand: [0.16, 0.78, 0.3], blade: [0.35, 0.25, -0.9], twist: 0, off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },   // hands up on the ledge lip
      windup: { hand: [0.06, 0.92, 0.08], blade: [0.12, 0.96, -0.22], two: true, twist: 0.04, pole: [0.7, -0.3, -0.4] },   // blade raised high overhead: the aerial wind-up
      tuck:   { hand: [0.14, 0.12, 0.24], blade: [0.25, 0.65, -0.7], two: true, twist: 0.1, pole: [0.7, -0.6, -0.2] },
      hammer: { hand: [0.08, 0.5, 0.12], blade: [0.05, 0.62, -0.78], two: true, twist: 0.06, pole: [0.7, -0.3, -0.4] },
      smash:  { hand: [0.06, -0.24, 0.5], blade: [0.0, -0.6, 0.8], two: true, twist: 0.0, lean: 0.12, pole: [0.6, -0.8, 0] },
      run:    { hand: [0.26, 0.08, 0.32], blade: [0.5, 0.78, -0.36], two: true, twist: 0.12, pole: [0.7, -0.6, -0.2] },   // hilt out front, blade up and out clear of the shoulder
    },
  },
  reverse: {
    // the reverse grip already lays the blade along the forearm: flips just hug it in, and the run sweeps it back
    ataru:  { windup: { hand: [0.08, 0.9, 0.1], blade: [0.15, -0.35, -0.92], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.2, 0.7, 0.2], pole: OFF } },   // fist high, the blade laid down the back
              hang:   { hand: [0.16, 0.78, 0.3], blade: [0.2, -0.4, -0.9], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },
              plunge: { hand: [0.1, -0.02, 0.36], blade: [0.04, -0.95, 0.3], twist: -0.05, pole: [0.8, -0.3, -0.5], off: { hand: [-0.3, -0.2, 0.3], pole: OFF } },
              run:    { hand: [0.3, -0.24, -0.16], blade: [0.12, 0.3, -0.95], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.28, -0.1, 0.22], pole: OFF } } },
    niman:  { windup: { hand: [0.08, 0.9, 0.1], blade: [0.15, -0.35, -0.92], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.2, 0.7, 0.2], pole: OFF } },   // fist high, the blade laid down the back
              hang:   { hand: [0.16, 0.78, 0.3], blade: [0.2, -0.4, -0.9], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },
              run:    { hand: [0.3, -0.22, -0.1], blade: [0.12, 0.3, -0.95], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.28, -0.1, 0.22], pole: OFF } },
              palm:   { hand: [0.36, -0.12, -0.08], blade: [0.2, 0.3, -0.93], twist: 0.08, pole: [0.8, -0.3, -0.5], off: { hand: [-0.16, -0.4, 0.44], pole: OFF } } },
    djemso: { windup: { hand: [0.08, 0.9, 0.1], blade: [0.15, -0.35, -0.92], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.2, 0.7, 0.2], pole: OFF } },   // fist high, the blade laid down the back
              smash:  { hand: [0.12, -0.28, 0.46], blade: [0.05, -0.95, 0.3], twist: 0.0, lean: 0.12, pole: [0.8, -0.3, -0.5] },
              hang:   { hand: [0.16, 0.78, 0.3], blade: [0.2, -0.4, -0.9], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },
              // the high Shien guard hangs the blade down his back: running, the fist drops to the hip and the blade sweeps back outside the leg
              run:    { hand: [0.36, -0.12, 0.06], blade: [0.36, -0.2, -0.91], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.28, -0.1, 0.22], pole: OFF } } },
  },
};
