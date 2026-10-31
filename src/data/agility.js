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
//
// `roll` is the ground ROLL, the duel dodge on SHIFT in a fight (player/mobility.js, tuning in data/mobility.js): it
// stays on the ground, so a negative lift keeps a somersault low (a shoulder roll) and the rest are sidesteps.

/* ---------------- JEDI — per form ---------------- */
export const AGILITY = {
  // FORM I SHII-CHO — the first form every initiate learns: plain, grounded and broad. No showy acrobatics: a wide
  // side-shuffle, simple rolls, a straight jump, and a solid two-footed landing ready to sweep.
  shiicho: {
    dash: {
      side: { bank: 0.3, drop: 0.18, legs: 'stride', arms: null },                     // a broad side-shuffle
      fwd:  { pitch: 0.24, drop: 0.14, legs: 'stride', arms: null },                   // a driving lunge in
      back: { pitch: -0.18, drop: 0.14, legs: 'stride', arms: null },                  // a step back to sweep room
    },
    roll: {
      side: { bank: 0.22, drop: 0.2, legs: 'slide', arms: null },
      fwd:  { somer: 1, lift: -0.45, legs: 'tuck', arms: 'tuck' },                     // a plain shoulder roll
      back: { somer: -1, lift: -0.45, legs: 'tuck', arms: 'tuck' },
    },
    jump:   { tuck: 0.55, arms: null },
    double: { somer: 1, lift: 0.25, legs: 'tuck', arms: 'tuck' },                      // a simple front tuck
    evade: {
      back: { somer: -1, lift: 0.35, legs: 'tuck', arms: 'tuck' },
      fwd:  { somer: 1, lift: 0.3, legs: 'tuck', arms: 'tuck' },
      side: { roll: 1, lift: 0.3, legs: 'split', arms: 'layout' },
    },
    wall:   { back: { somer: -1, legs: 'tuck', arms: 'tuck' }, fwd: { somer: 1, legs: 'tuck', arms: 'tuck' } },
    glide:  { legs: 'float', pitch: 0.04, arms: null },
    rise:   { pitch: 0.08, arms: null },
    slam:   { pitch: 0.12, legs: 'tuck', arms: 'hammer', land: 'smash', kneel: 0.8 },
    land:   { depth: 1.1, spring: 0.95, splay: 0.2 },                // lands wide, ready to sweep
    run:    { arms: 'run', twist: 1.0, pump: 1.0 },
  },
  // FORM II MAKASHI — Dooku: the fencer. Footwork, not flips: every dash is a light advance or retreat on the line,
  // jumps are small and upright, and the landing is a poised, shallow dip with the blade still out.
  makashi: {
    dash: {
      side: { bank: 0.12, drop: 0.06, legs: 'stride', arms: null },                    // a sidestep off the line
      fwd:  { pitch: 0.12, drop: 0.08, legs: 'stride', arms: null },                   // the advance-lunge
      back: { pitch: -0.08, drop: 0.06, legs: 'stride', arms: null },                  // the fencer's retreat
    },
    roll: {
      side: { bank: 0.1, drop: 0.06, legs: 'stride', arms: null },                     // never rolls: steps out
      fwd:  { pitch: 0.14, drop: 0.08, legs: 'stride', arms: null },
      back: { pitch: -0.1, drop: 0.06, legs: 'stride', arms: null },
    },
    jump:   { tuck: 0.35, arms: null },
    double: { somer: -1, lift: 0.2, legs: 'layout', arms: 'layout' },                  // one elegant back layout
    evade: {
      back: { somer: -1, lift: 0.3, legs: 'layout', arms: 'layout' },
      fwd:  { pitch: 0.14, drop: 0.06, legs: 'stride', arms: null },
      side: { spin: 1, tilt: 0.2, lift: 0.15, legs: 'stride', arms: null, ease: 'twirl' },
    },
    wall:   { back: { somer: -1, legs: 'layout', arms: 'layout' }, fwd: { somer: 1, legs: 'layout', arms: 'layout' } },
    glide:  { legs: 'float', pitch: 0.02, arms: null },             // upright, blade kept on the line
    rise:   { pitch: 0.04, arms: null },
    slam:   { pitch: 0.1, legs: 'tuck', arms: 'plunge', land: 'plunge', kneel: 0.6 },
    land:   { depth: 0.7, spring: 1.25 },                             // a shallow, poised dip
    run:    { arms: 'run', twist: 0.8, pump: 0.85 },
  },
  // FORM III SORESU — Obi-Wan: economy of motion. Short controlled slides that keep the guard up, a tight roll,
  // almost no flips, and a soft landing that never drops the blade.
  soresu: {
    dash: {
      side: { bank: 0.2, drop: 0.16, legs: 'slide', arms: null },                      // a guarded side-slide
      fwd:  { pitch: 0.18, drop: 0.14, legs: 'slide', arms: null },
      back: { pitch: -0.2, drop: 0.16, legs: 'slide', arms: null },                    // a step back behind the blade
    },
    roll: {
      side: { bank: 0.18, drop: 0.18, legs: 'slide', arms: null },
      fwd:  { somer: 1, lift: -0.5, legs: 'tuck', arms: 'tuck' },
      back: { pitch: -0.18, drop: 0.18, legs: 'slide', arms: null },
    },
    jump:   { tuck: 0.5, arms: null },
    double: { somer: -1, lift: 0.25, legs: 'tuck', arms: 'tuck' },                     // a tight back tuck
    evade: {
      back: { somer: -1, lift: 0.3, legs: 'tuck', arms: 'tuck' },
      fwd:  { somer: 1, lift: 0.25, legs: 'tuck', arms: 'tuck' },
      side: { spin: 1, tilt: 0.25, lift: 0.2, legs: 'stride', arms: null, ease: 'twirl' },
    },
    wall:   { back: { somer: -1, legs: 'tuck', arms: 'tuck' }, fwd: { somer: 1, legs: 'tuck', arms: 'tuck' } },
    glide:  { legs: 'float', pitch: 0.05, arms: null },             // drops with the guard held
    rise:   { pitch: 0.08, arms: null },
    slam:   { pitch: 0.14, legs: 'tuck', arms: 'palm', land: 'palm', kneel: 0.9 },
    land:   { depth: 0.9, spring: 1.05 },
    run:    { arms: 'run', twist: 0.85, pump: 0.9 },
  },
  // FORM IV ATARU — Yoda and Qui-Gon: everything leaves the ground, everything turns. Butterfly twists, twisting
  // flips, a corkscrew off the second jump, and light cat landings.
  ataru: {
    dash: {
      side: { spin: 1, tilt: 1.15, lift: 0.75, legs: 'split', arms: 'tuck', ease: 'twirl' },          // butterfly twist
      fwd:  { somer: 1, lift: 0.85, legs: 'tuck', arms: 'tuck' },                                        // dive-over front tuck
      back: { somer: -1, lift: 0.8, legs: 'tuck', arms: 'tuck' },                                        // back tuck
    },
    roll: {
      side: { roll: 1, lift: 0.15, legs: 'split', arms: 'layout' },                                      // a low cartwheel
      fwd:  { somer: 1, lift: -0.35, legs: 'tuck', arms: 'tuck' },                                       // dive roll
      back: { somer: -1, lift: -0.35, legs: 'tuck', arms: 'tuck' },                                      // back roll
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
    roll: {
      side: { spin: 1, tilt: 0.15, lift: 0.05, legs: 'stride', arms: null, ease: 'twirl' },              // a spinning sidestep
      fwd:  { somer: 1, lift: -0.45, legs: 'tuck', arms: 'tuck' },                                       // shoulder roll
      back: { somer: -1, lift: -0.45, legs: 'tuck', arms: 'tuck' },
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
    roll: {
      side: { bank: 0.3, drop: 0.28, legs: 'slide', arms: null },                      // a planted sidestep, guard up
      fwd:  { somer: 1, lift: -0.45, legs: 'tuck', arms: 'tuck' },                     // a heavy shoulder roll
      back: { pitch: -0.22, drop: 0.28, legs: 'slide', arms: null },                   // a braced back-step
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
  // FORM VII JUYO — ferocious and acrobatic: twisting flips and spinning dashes that carry straight into the attack,
  // a leap with the blade cocked to hammer down, and a landing that springs straight back in
  juyo: {
    dash: {
      side: { spin: 1, tilt: 0.7, lift: 0.45, legs: 'split', arms: 'tuck', ease: 'twirl' },
      fwd:  { pitch: 0.4, drop: 0.24, legs: 'slide', arms: null },                     // a predator's lunge
      back: { somer: -1, lift: 0.5, legs: 'tuck', arms: 'tuck' },
    },
    roll: {
      side: { roll: 1, lift: 0.1, legs: 'split', arms: 'layout' },
      fwd:  { somer: 1, lift: -0.35, legs: 'tuck', arms: 'tuck' },
      back: { somer: -1, lift: -0.35, legs: 'tuck', arms: 'tuck' },
    },
    jump:   { tuck: 0.9, spin: 1, arms: 'tuck' },
    double: { somer: 1, twist: 1, lift: 0.35, legs: 'tuck', arms: 'hammer' },          // a twisting front flip, blade raised to hammer
    evade: {
      back: { somer: -1, twist: 1, lift: 0.45, legs: 'tuck', arms: 'tuck' },
      fwd:  { somer: 1, twist: 0.5, lift: 0.35, legs: 'tuck', arms: 'tuck' },
      side: { roll: 1, twist: 0.5, lift: 0.4, legs: 'split', arms: 'layout' },
    },
    wall:   { back: { somer: -1, twist: 1, legs: 'tuck', arms: 'tuck' }, fwd: { somer: 1, twist: 0.5, legs: 'tuck', arms: 'tuck' } },
    glide:  { legs: 'tuck', pitch: 0.2, arms: 'hammer' },
    rise:   { pitch: 0.2, arms: 'hammer' },
    slam:   { pitch: 0.1, legs: 'tuck', arms: 'hammer', land: 'smash', kneel: 0.75 },
    land:   { depth: 1.1, spring: 1.4 },                              // springs straight back in
    run:    { arms: 'run', twist: 1.2, pump: 1.2 },
  },
  // FORM VII VAAPAD — controlled: little wasted motion, a clean sidestep, one decisive flip, a balanced landing
  vaapad: {
    dash: {
      side: { bank: 0.2, drop: 0.14, legs: 'stride', arms: null },
      fwd:  { pitch: 0.24, drop: 0.16, legs: 'slide', arms: null },
      back: { pitch: -0.18, drop: 0.14, legs: 'slide', arms: null },
    },
    roll: {
      side: { bank: 0.2, drop: 0.2, legs: 'slide', arms: null },
      fwd:  { somer: 1, lift: -0.45, legs: 'tuck', arms: 'tuck' },
      back: { somer: -1, lift: -0.45, legs: 'tuck', arms: 'tuck' },
    },
    jump:   { tuck: 0.6, arms: null },
    double: { somer: 1, lift: 0.3, legs: 'tuck', arms: 'tuck' },
    evade: {
      back: { somer: -1, lift: 0.4, legs: 'tuck', arms: 'tuck' },
      fwd:  { somer: 1, lift: 0.3, legs: 'tuck', arms: 'tuck' },
      side: { roll: 1, lift: 0.3, legs: 'split', arms: 'layout' },
    },
    wall:   { back: { somer: -1, legs: 'tuck', arms: 'tuck' }, fwd: { somer: 1, legs: 'tuck', arms: 'tuck' } },
    glide:  { legs: 'float', pitch: 0.04, arms: null },
    rise:   { pitch: 0.06, arms: null },
    slam:   { pitch: 0.06, legs: 'tuck', arms: 'hammer', land: 'smash', kneel: 0.8 },
    land:   { depth: 1.0, spring: 1.05 },
    run:    { arms: 'run', twist: 0.9, pump: 0.95 },
  },
  // FORM V SHIEN — Ahsoka and Starkiller: Djem So's sister, lighter on its feet. A low prowling slide, a spinning
  // sidestep on the blade laid along the arm, tight twisting flips, and a crouched landing with the blade back.
  shien: {
    dash: {
      side: { spin: 1, tilt: 0.35, lift: 0.2, legs: 'stride', arms: null, ease: 'twirl' },          // a spinning sidestep
      fwd:  { pitch: 0.32, drop: 0.24, legs: 'slide', arms: null },                                  // a low lunge in
      back: { pitch: -0.22, drop: 0.24, legs: 'slide', arms: null },
    },
    roll: {
      side: { bank: 0.28, drop: 0.24, legs: 'slide', arms: null },
      fwd:  { somer: 1, lift: -0.4, legs: 'tuck', arms: 'tuck' },
      back: { somer: -1, lift: -0.4, legs: 'tuck', arms: 'tuck' },
    },
    jump:   { tuck: 0.6, spin: 0.5, arms: null },
    double: { somer: 1, twist: 0.5, lift: 0.3, legs: 'tuck', arms: 'tuck' },          // a front tuck with a half twist
    evade: {
      back: { somer: -1, twist: 0.5, lift: 0.35, legs: 'tuck', arms: 'tuck' },
      fwd:  { somer: 1, lift: 0.3, legs: 'tuck', arms: 'tuck' },
      side: { roll: 1, lift: 0.3, legs: 'split', arms: 'layout' },
    },
    wall:   { back: { somer: -1, twist: 0.5, legs: 'tuck', arms: 'tuck' }, fwd: { somer: 1, legs: 'tuck', arms: 'tuck' } },
    glide:  { legs: 'tuck', pitch: 0.12, arms: 'trail' },            // a crouched drop, blade trailing along the arm
    rise:   { pitch: 0.12, arms: 'trail' },
    slam:   { pitch: 0.1, legs: 'tuck', arms: 'plunge', land: 'plunge', kneel: 0.9 },   // a reverse-grip plunge into the ground
    land:   { depth: 1.2, spring: 1.0, splay: 0.25 },
    run:    { arms: 'run', twist: 0.9, pump: 0.95 },
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
      cock:   { hand: [0.42, 0.12, -0.12], blade: [0.35, 0.12, -0.93], twist: 0.1, off: { hand: [-0.3, 0.2, 0.42], pole: OFF } },   // blade drawn back level at the hip: the aerial cut's dash
      tuck:   { hand: [0.14, -0.02, 0.26], blade: [0.25, 0.55, -0.8], two: true, twist: -0.1, pole: [0.6, -0.7, -0.3] },          // hilt hugged in, blade clear behind
      layout: { hand: [0.44, 0.06, 0.1], blade: [0.7, 0.6, -0.4], twist: 0.05, off: { hand: [-0.46, 0.06, 0.1], pole: OFF } },
      trail:  { hand: [0.3, -0.24, -0.06], blade: [0.2, -0.32, -0.93], twist: -0.12, off: { hand: [-0.3, 0.02, 0.3], pole: OFF } },
      plunge: { hand: [0.06, -0.06, 0.4], blade: [0.02, -0.92, 0.38], two: true, twist: -0.05, pole: [0.6, -0.4, -0.6] },
      run:    { hand: [0.3, -0.3, -0.04], blade: [0.2, -0.58, -0.79], twist: -0.08, off: { hand: [-0.28, -0.12, 0.22], pole: OFF } },
    },
    // Makashi runs like a fencer on the advance: the saber low and forward with the blade angled down at the foe, the free hand clasped behind the back
    makashi: {
      run:    { hand: [0.3, -0.18, 0.5], blade: [-0.12, -0.5, 0.85], twist: 0.1, pole: [0.8, -0.6, -0.2], off: { hand: [-0.1, -0.3, -0.32], pole: [-1, -0.05, -0.1] } },
    },
    niman: {
      hang:   { hand: [0.16, 0.78, 0.3], blade: [0.35, 0.25, -0.9], twist: 0, off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },   // hands up on the ledge lip
      windup: { hand: [0.06, 0.92, 0.08], blade: [0.12, 0.96, -0.22], two: true, twist: 0.04, pole: [0.7, -0.3, -0.4] },   // blade raised high overhead: the aerial wind-up
      cock:   { hand: [0.42, 0.12, -0.12], blade: [0.35, 0.12, -0.93], twist: 0.1, off: { hand: [-0.3, 0.2, 0.42], pole: OFF } },   // blade drawn back level at the hip: the aerial cut's dash
      tuck:   { hand: [0.2, -0.04, 0.24], blade: [0.35, 0.65, -0.65], twist: 0, off: { hand: [-0.2, -0.04, 0.24], pole: OFF } },
      layout: { hand: [0.46, 0.08, 0.06], blade: [0.75, 0.62, -0.25], twist: 0, off: { hand: [-0.48, 0.1, 0.08], pole: OFF } },
      palm:   { hand: [0.38, -0.06, -0.06], blade: [0.5, 0.62, -0.6], twist: 0.08, off: { hand: [-0.16, -0.4, 0.44], pole: OFF } },
      run:    { hand: [0.32, -0.12, 0.22], blade: [0.2, 0.9, -0.38], twist: 0.04, off: { hand: [-0.28, -0.1, 0.2], pole: OFF } },   // carried upright out front, clear of the shoulder
    },
    djemso: {
      hang:   { hand: [0.16, 0.78, 0.3], blade: [0.35, 0.25, -0.9], twist: 0, off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },   // hands up on the ledge lip
      windup: { hand: [0.06, 0.92, 0.08], blade: [0.12, 0.96, -0.22], two: true, twist: 0.04, pole: [0.7, -0.3, -0.4] },   // blade raised high overhead: the aerial wind-up
      cock:   { hand: [0.42, 0.12, -0.12], blade: [0.35, 0.12, -0.93], twist: 0.1, off: { hand: [-0.3, 0.2, 0.42], pole: OFF } },   // blade drawn back level at the hip: the aerial cut's dash
      tuck:   { hand: [0.14, 0.12, 0.24], blade: [0.25, 0.65, -0.7], two: true, twist: 0.1, pole: [0.7, -0.6, -0.2] },
      hammer: { hand: [0.08, 0.5, 0.12], blade: [0.05, 0.62, -0.78], two: true, twist: 0.06, pole: [0.7, -0.3, -0.4] },
      smash:  { hand: [0.06, -0.24, 0.5], blade: [0.0, -0.6, 0.8], two: true, twist: 0.0, lean: 0.12, pole: [0.6, -0.8, 0] },
      run:    { hand: [0.26, 0.08, 0.32], blade: [0.5, 0.78, -0.36], two: true, twist: 0.12, pole: [0.7, -0.6, -0.2] },   // hilt out front, blade up and out clear of the shoulder
    },
  },
  reverse: {
    // the reverse grip already lays the blade along the forearm: flips just hug it in, and the run sweeps it back
    ataru:  { cock: { hand: [0.4, 0.1, 0.08], blade: [0.3, 0.05, -0.95], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.3, 0.2, 0.42], pole: OFF } },
              windup: { hand: [0.08, 0.9, 0.1], blade: [0.15, -0.35, -0.92], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.2, 0.7, 0.2], pole: OFF } },   // fist high, the blade laid down the back
              hang:   { hand: [0.16, 0.78, 0.3], blade: [0.2, -0.4, -0.9], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },
              plunge: { hand: [0.1, -0.02, 0.36], blade: [0.04, -0.95, 0.3], twist: -0.05, pole: [0.8, -0.3, -0.5], off: { hand: [-0.3, -0.2, 0.3], pole: OFF } },
              run:    { hand: [0.3, -0.24, -0.16], blade: [0.12, 0.3, -0.95], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.28, -0.1, 0.22], pole: OFF } } },
    niman:  { cock: { hand: [0.4, 0.1, 0.08], blade: [0.3, 0.05, -0.95], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.3, 0.2, 0.42], pole: OFF } },
              windup: { hand: [0.08, 0.9, 0.1], blade: [0.15, -0.35, -0.92], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.2, 0.7, 0.2], pole: OFF } },   // fist high, the blade laid down the back
              hang:   { hand: [0.16, 0.78, 0.3], blade: [0.2, -0.4, -0.9], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },
              run:    { hand: [0.3, -0.22, -0.1], blade: [0.12, 0.3, -0.95], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.28, -0.1, 0.22], pole: OFF } },
              palm:   { hand: [0.36, -0.12, -0.08], blade: [0.2, 0.3, -0.93], twist: 0.08, pole: [0.8, -0.3, -0.5], off: { hand: [-0.16, -0.4, 0.44], pole: OFF } } },
    djemso: { cock: { hand: [0.4, 0.1, 0.08], blade: [0.3, 0.05, -0.95], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.3, 0.2, 0.42], pole: OFF } },
              windup: { hand: [0.08, 0.9, 0.1], blade: [0.15, -0.35, -0.92], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.2, 0.7, 0.2], pole: OFF } },   // fist high, the blade laid down the back
              smash:  { hand: [0.12, -0.28, 0.46], blade: [0.05, -0.95, 0.3], twist: 0.0, lean: 0.12, pole: [0.8, -0.3, -0.5] },
              hang:   { hand: [0.16, 0.78, 0.3], blade: [0.2, -0.4, -0.9], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.18, 0.78, 0.3], pole: [-0.6, -0.3, -0.5] } },
              // the high Shien guard hangs the blade down his back: running, the fist drops to the hip and the blade sweeps back outside the leg
              run:    { hand: [0.36, -0.12, 0.06], blade: [0.36, -0.2, -0.91], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.28, -0.1, 0.22], pole: OFF } } },
  },
};

/* The SLIDE and the WALL-RUN guards (chest space as above). The slide: the weapon hand carried out in front, blade up
   and clear of the floor, the free hand trailing low behind on the tucked leg's side. The wall-run, one guard for each
   side the wall can be on: the arm away from the wall thrown wide for balance, the arm on the wall side held in and
   forward, fingers toward the face. The blade always points away from the wall. */
const SLIDE_GUARD = {
  regular: { hand: [0.42, 0.12, 0.38], blade: [0.28, 0.78, -0.56], twist: -0.1, off: { hand: [-0.45, -0.85, -0.62], pole: OFF } },
  reverse: { hand: [0.4, 0.08, 0.34], blade: [0.2, 0.3, -0.93], twist: -0.1, pole: [0.8, -0.3, -0.5], off: { hand: [-0.45, -0.85, -0.62], pole: OFF } },
};
const WALL_GUARD = {   // wallW: the wall is on the weapon side; wallO: on the free-hand side
  regular: {
    wallW: { hand: [0.3, 0.02, 0.32], blade: [-0.2, 0.8, -0.56], twist: 0.05, off: { hand: [-0.66, 0.14, 0.04], pole: OFF } },
    wallO: { hand: [0.66, 0.14, 0.04], blade: [0.62, 0.5, -0.6], twist: -0.05, off: { hand: [-0.3, 0.02, 0.32], pole: OFF } },
  },
  reverse: {
    wallW: { hand: [0.3, 0.02, 0.32], blade: [0.1, 0.3, -0.95], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.66, 0.14, 0.04], pole: OFF } },
    wallO: { hand: [0.66, 0.14, 0.04], blade: [0.5, 0.2, -0.85], twist: 0, pole: [0.8, -0.3, -0.5], off: { hand: [-0.3, 0.02, 0.32], pole: OFF } },
  },
};
for (const grip in AIR_GUARDS) for (const form in AIR_GUARDS[grip]){
  AIR_GUARDS[grip][form].slide = SLIDE_GUARD[grip];
  Object.assign(AIR_GUARDS[grip][form], WALL_GUARD[grip]);
}
