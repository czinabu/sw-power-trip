// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HERO POSES — guards, swing keyframes and weapon holds, authored as "hand here, blade pointing there".
//
// Coordinates are CHEST space (see src/player/anim/ik.js): +x is the weapon-hand side, +y up, +z the way the hero
// faces; the chest joint sits about a forearm above the belt (y −0.3 ≈ belt, 0.32 = shoulders, 0.55 ≈ eyes).
//   hand  — where the weapon hand's wrist goes                blade — which way the blade points (any length)
//   pole  — which way the elbow points (default down & out)    two   — the off hand closes on the hilt
//   off   — { hand, pole } for a free off hand (a Force palm, balance) when not two-handed
//   twist — upper-body turn (+ = weapon side back→front)      torso — hip-to-ribs turn   lean — whole-body pitch
// Pose sets key off hold + grip + form (docs/animation-guidelines.md), so a new weapon or form is new data here.

/* each stance in data/stances.js names its form; the darksaber is its own (Mando) form */
export const FORM_OF = { fast: 'ataru', medium: 'niman', strong: 'djemso', darksaber: 'darksaber' };

/* FOOTWORK per form — crouch (hip drop), splay (feet apart), lead (staggered feet), lean (forward pitch),
   width (robe flare). Read when the hero is settled and planted. */
export const FOOTWORK = {
  ataru:     { crouch: -0.24, splay: 0.12, lead: 0.42, lean: 0.16, width: 0.86 },   // coiled, on the balls of the feet
  niman:     { crouch: -0.05, splay: 0.14, lead: 0.16, lean: 0.03, width: 1.08 },   // upright and easy, weight even
  djemso:    { crouch: -0.17, splay: 0.52, lead: 0.08, lean: 0.12, width: 1.3 },   // wide, rooted, square to the foe
  darksaber: { crouch: -0.2,  splay: 0.46, lead: 0.2,  lean: 0.18, width: 1.25 },    // braced against a blade that pulls
};

const OFF_POLE = [-0.55, -0.8, -0.25], POLE = [0.55, -0.8, -0.25];

/* ---------------- GUARDS: ready (idle) and block, per grip and form ---------------- */
export const SABER_GUARDS = {
  regular: {
    // FORM IV ATARU — Qui-Gon's sprung coil: low, bladed, both hands on the hilt by the hip, tip up at the foe's eyes
    ataru: {
      ready: { hand: [0.12, -0.24, 0.24], blade: [-0.22, 0.82, 0.52], two: true, twist: -0.38, torso: -0.1, pole: [0.6, -0.7, -0.3] },
      // a quick one-handed high cover (Yoda): blade flat over the brow, off hand flung out for balance
      block: { hand: [0.18, 0.55, 0.3], blade: [-0.92, 0.28, 0.25], twist: -0.12, lean: 0.02, pole: [0.8, -0.2, -0.4],
               off: { hand: [-0.52, -0.05, 0.12], pole: [-0.3, -0.9, -0.3] } },
    },
    // FORM VI NIMAN — the Clone Wars Jedi: saber angled forward in one hand, the other open and ready to push
    niman: {
      ready: { hand: [0.24, -0.16, 0.3], blade: [-0.22, 0.72, 0.66], twist: 0.05, pole: POLE,
               off: { hand: [-0.2, 0.0, 0.36], pole: OFF_POLE } },
      // blade upright before the face, the off palm braced behind it — a Force-backed wall
      block: { hand: [0.1, 0.02, 0.42], blade: [-0.12, 1, 0.12], twist: 0, lean: 0.06, pole: POLE,
               off: { hand: [-0.12, 0.14, 0.38], pole: OFF_POLE } },
    },
    // FORM V DJEM SO — Anakin's high guard: both hands by the weapon shoulder, blade up and back, ready to hammer down
    djemso: {
      ready: { hand: [0.2, 0.16, 0.22], blade: [0.22, 0.7, -0.68], two: true, twist: 0.18, torso: 0.05, pole: [0.7, -0.6, -0.2] },
      // Vader's wall: blade near level across the face, two hands, leaning into the hit
      block: { hand: [0.24, 0.36, 0.4], blade: [-0.95, 0.3, 0.05], two: true, twist: 0.05, lean: 0.24, pole: [0.6, -0.8, 0] },
    },
    darksaber: {
      // a heavy blade held with effort: two hands, cocked up by the weapon shoulder, tip wavering
      ready: { hand: [0.22, 0.08, 0.24], blade: [0.1, 0.85, -0.3], two: true, twist: 0.2, lean: 0.08, pole: [0.7, -0.6, -0.2] },
      block: { hand: [0.18, 0.2, 0.42], blade: [-0.9, 0.42, 0.12], two: true, twist: 0.0, lean: 0.26, pole: [0.6, -0.8, 0] },
    },
  },
  // REVERSE (Shien) GRIP — blade out of the pinky side, lying back along the forearm (Ahsoka, Starkiller)
  reverse: {
    // Ahsoka's crouch: saber fist low and forward, blade swept back along the forearm, off hand reaching ahead
    ataru: {
      ready: { hand: [0.26, -0.32, 0.3], blade: [0.28, 0.12, -0.95], twist: -0.25, lean: 0.06, pole: [0.8, -0.3, -0.5],
               off: { hand: [-0.2, -0.12, 0.46], pole: OFF_POLE } },
      block: { hand: [0.16, 0.5, 0.36], blade: [-0.55, -0.75, 0.25], twist: -0.1, pole: [0.9, -0.1, -0.3],
               off: { hand: [-0.4, -0.1, 0.25], pole: OFF_POLE } },
    },
    // relaxed reverse ready: fist at the belt, blade angled down and back past the leg; off palm forward
    niman: {
      ready: { hand: [0.26, -0.12, 0.32], blade: [0.12, -0.5, -0.86], twist: 0.05, pole: POLE,
               off: { hand: [-0.18, 0.0, 0.36], pole: OFF_POLE } },
      // forearm raised across the centre line, blade hanging straight down to cover the body
      block: { hand: [0.06, 0.2, 0.42], blade: [0.25, -0.96, 0.12], twist: 0, lean: 0.05, pole: [0.9, -0.2, -0.3],
               off: { hand: [-0.16, 0.0, 0.38], pole: OFF_POLE } },
    },
    // Starkiller's Shien: saber arm cocked high by the head, blade hanging down the back, off hand clawed forward
    djemso: {
      ready: { hand: [0.3, 0.42, 0.06], blade: [0.12, -0.76, -0.64], twist: -0.3, lean: 0.1, pole: [0.9, 0.1, -0.4],
               off: { hand: [-0.14, 0.04, 0.44], pole: OFF_POLE } },
      block: { hand: [0.16, 0.26, 0.42], blade: [0.08, -1, 0.18], two: true, twist: 0, lean: 0.22, pole: [0.9, -0.1, -0.3] },
    },
    darksaber: {   // the darksaber always uses the regular hold (it's a sword, not a duelist's saber)
      ready: { hand: [0.22, 0.08, 0.24], blade: [0.1, 0.85, -0.3], two: true, twist: 0.2, lean: 0.08, pole: [0.7, -0.6, -0.2] },
      block: { hand: [0.18, 0.2, 0.42], blade: [-0.9, 0.42, 0.12], two: true, twist: 0.0, lean: 0.26, pole: [0.6, -0.8, 0] },
    },
  },
};

/* ---------------- SWINGS: chamber → strike → follow-through keyframes per pattern ----------------
   Pattern ids match SWING_PATTERNS in data/stances.js. The hero is right-handed (+x is his right, see rig.js), so
   "left" is the forehand across the body toward −x and "right" the backhand out to the weapon side; "forward" the
   overhead, "back" the cut behind, diagL/diagR the shoulder-to-hip cuts.
   twist is the upper-body turn at that key. */
export const SABER_SWINGS = {
  regular: {
    left:  [
      { hand: [0.42, 0.22, -0.04], blade: [0.62, 0.32, -0.72], twist: 0.5 },
      { hand: [0.08, 0.06, 0.56],  blade: [-0.12, 0.06, 1],    twist: -0.05 },
      { hand: [-0.32, -0.06, 0.3], blade: [-0.86, -0.12, -0.3], twist: -0.55 },
    ],
    right: [
      { hand: [-0.28, 0.16, 0.22], blade: [-0.82, 0.3, -0.3],  twist: -0.5 },
      { hand: [0.06, 0.06, 0.56],  blade: [0.12, 0.06, 1],     twist: 0.05 },
      { hand: [0.46, 0.0, 0.06],   blade: [0.86, -0.06, -0.42], twist: 0.55 },
    ],
    forward: [
      { hand: [0.12, 0.62, -0.02], blade: [0.04, 0.4, -0.95],  twist: 0.12 },
      { hand: [0.06, 0.18, 0.54],  blade: [-0.02, 0.62, 0.78], twist: 0 },
      { hand: [0.04, -0.3, 0.44],  blade: [0, -0.52, 0.85],    twist: -0.05 },
    ],
    back: [
      { hand: [0.3, -0.34, 0.26],  blade: [0.12, -0.78, 0.6],  twist: -0.1 },
      { hand: [0.38, 0.1, -0.02],  blade: [0.34, 0.3, -0.9],   twist: 0.55 },
      { hand: [0.26, 0.42, -0.08], blade: [0.12, 0.42, -0.9],  twist: 0.75 },
    ],
    diagL: [
      { hand: [0.4, 0.46, -0.04],  blade: [0.48, 0.62, -0.62], twist: 0.42 },
      { hand: [0.1, 0.16, 0.55],   blade: [-0.3, 0.45, 0.85],  twist: 0 },
      { hand: [-0.26, -0.3, 0.34], blade: [-0.6, -0.55, 0.55], twist: -0.42 },
    ],
    diagR: [
      { hand: [-0.24, 0.42, 0.16], blade: [-0.6, 0.6, -0.5],   twist: -0.42 },
      { hand: [0.06, 0.16, 0.55],  blade: [0.3, 0.45, 0.85],   twist: 0 },
      { hand: [0.42, -0.3, 0.24],  blade: [0.6, -0.55, 0.5],   twist: 0.42 },
    ],
  },
  // REVERSE GRIP: the cut starts with the blade laid back along the forearm, then the elbow and a hard body turn
  // whip it round so the TIP sweeps the way the cut travels (a strafe-right cut carries the tip to the right);
  // the back cut is a stab driven straight back past the hip.
  reverse: {
    left:  [
      { hand: [0.4, 0.24, 0.08],   blade: [0.35, -0.2, -0.9],   twist: 0.55 },
      { hand: [0.1, 0.08, 0.46],   blade: [-0.1, -0.15, 1],     twist: 0 },
      { hand: [-0.3, 0.02, 0.32],  blade: [-0.92, -0.12, 0.25], twist: -0.65 },
    ],
    right: [
      { hand: [-0.24, 0.2, 0.3],   blade: [-0.4, -0.2, -0.88],  twist: -0.6 },
      { hand: [0.08, 0.08, 0.48],  blade: [0.1, -0.15, 1],      twist: 0.05 },
      { hand: [0.46, 0.04, 0.14],  blade: [0.92, -0.12, 0.25],  twist: 0.6 },
    ],
    forward: [   // hammer-fist stab: fist high, blade hanging back, then driven down and forward
      { hand: [0.18, 0.6, 0.12],   blade: [0, -0.5, -0.86],    twist: 0.1 },
      { hand: [0.08, 0.04, 0.54],  blade: [0, -0.62, 0.78],    twist: 0 },
      { hand: [0.06, -0.24, 0.48], blade: [0, -0.86, 0.5],     twist: -0.05 },
    ],
    back: [      // the Shien back-stab past the hip
      { hand: [0.3, -0.18, 0.34],  blade: [0.05, -0.32, -0.95], twist: -0.1 },
      { hand: [0.34, -0.26, -0.1], blade: [0.12, -0.16, -0.98], twist: 0.35 },
      { hand: [0.32, -0.28, -0.2], blade: [0.14, -0.2, -0.97],  twist: 0.45 },
    ],
    diagL: [
      { hand: [0.38, 0.46, 0.08],  blade: [0.4, -0.3, -0.85],   twist: 0.45 },
      { hand: [0.1, 0.12, 0.48],   blade: [-0.2, -0.35, 0.9],   twist: 0 },
      { hand: [-0.28, -0.24, 0.3], blade: [-0.7, -0.55, 0.4],   twist: -0.5 },
    ],
    diagR: [
      { hand: [-0.22, 0.4, 0.26],  blade: [-0.45, -0.3, -0.85], twist: -0.5 },
      { hand: [0.1, 0.12, 0.48],   blade: [0.2, -0.35, 0.9],    twist: 0 },
      { hand: [0.44, -0.24, 0.18], blade: [0.7, -0.55, 0.4],    twist: 0.5 },
    ],
  },
};

/* ---------------- how each FORM performs a swing ----------------
   tc/ts/tf — when (0..1 of the swing) the blade reaches chamber, strike and follow-through. Damage lands at 0.35 for
              every form (combat.js), so ts sits just after it: the blade is crossing the front as the hit registers.
   reach    — scales the chamber and follow (bigger, more committed arcs)     two — both hands on the hilt
   spinHop  — vertical hop on every cut (Ataru's bounce)    drop — knee drop into the strike (power)
   offFlare — the free hand flings out against the cut (Niman's Force hand)   overshoot — the blade pulls past the
              follow-through and has to be hauled back (the darksaber fighting an unsure wielder)
   finisher — the 3rd-hit move: { pattern, spin (turns), hop } */
export const SWING_STYLE = {
  ataru:     { tc: 0.16, ts: 0.4, tf: 0.7, reach: 0.95, two: false, spinHop: 0.16, drop: 0.0, offFlare: 0.6, overshoot: 0,
               twist: 1.25, finisher: { pattern: 'right', spin: 1, hop: 0.75 } },
    // Ataru's finisher is a leaping spin cut (Force-boosted, tucked)
  niman:     { tc: 0.24, ts: 0.4, tf: 0.72, reach: 1.0, two: false, spinHop: 0, drop: 0.04, offFlare: 1.0, overshoot: 0,
               twist: 1.0, finisher: { pattern: 'right', spin: 1, hop: 0 } },
    // Niman finishes with a clean spinning cut
  djemso:    { tc: 0.3, ts: 0.42, tf: 0.74, reach: 1.15, two: true, spinHop: 0, drop: 0.14, offFlare: 0, overshoot: 0,
               twist: 0.85, finisher: { pattern: 'forward', spin: 0, hop: 0.12 } },
    // Djem So finishes with a rising-then-crushing two-handed overhead
  darksaber: { tc: 0.34, ts: 0.46, tf: 0.72, reach: 1.2, two: true, spinHop: 0, drop: 0.16, offFlare: 0, overshoot: 0.35,
               twist: 0.8, finisher: { pattern: 'forward', spin: 0, hop: 0.1 } },
};

/* ---------------- DEFLECTS: where the blade goes to catch a blaster bolt ----------------
   Zones are where the bolt arrives, seen from the hero: high / mid / low, on the weapon side (R, +x) or across the body
   (L, −x). Each zone has two or three catches, picked in turn (never the same one twice running), so a volley reads
   like the films: Obi-Wan's overhead cover, the hanging guard with the tip down, the vertical wall turned out, the
   cross-body pick-off. The blade meets the bolt, then FLICKS on (flick: how far the hand and tip carry the bolt away).
   Regular grip blocks with the blade standing up from the fist; reverse grip catches on the blade laid along the
   forearm, so its blocks hang the tip down and lead with the elbow. Two-handed forms (Djem So) close the off hand on
   the hilt; one-handed forms keep their free hand out (data from the form's block guard). */
export const SABER_DEFLECTS = {
  regular: {
    highR: [
      { hand: [0.3, 0.5, 0.32],   blade: [-0.86, 0.42, 0.28], twist: 0.1,   flick: [0.08, 0.06, 0.04] },   // overhead cover, tip across
      { hand: [0.36, 0.42, 0.3],  blade: [0.1, 0.92, 0.38],   twist: 0.2,   flick: [0.1, 0.02, -0.04] },   // tall wall turned out
    ],
    highL: [
      { hand: [-0.06, 0.5, 0.36], blade: [0.7, 0.62, 0.3],    twist: -0.3,  flick: [-0.08, 0.06, 0.02], pole: [0.7, 0.1, -0.6] },
      { hand: [0.02, 0.56, 0.32], blade: [-0.62, 0.7, 0.32],  twist: -0.2,  flick: [-0.1, 0.04, 0.04], pole: [0.8, -0.1, -0.5] },
    ],
    midR: [
      { hand: [0.36, 0.06, 0.36], blade: [0.18, 0.95, 0.24],  twist: 0.22,  flick: [0.1, 0, 0.04] },        // vertical, weapon side
      { hand: [0.32, 0.12, 0.42], blade: [0.62, 0.6, 0.5],    twist: 0.28,  flick: [0.08, 0.04, 0.06] },   // angled out, tip forward
      { hand: [0.3, -0.04, 0.4],  blade: [0.4, 0.88, -0.1],   twist: 0.3,   flick: [0.1, -0.02, 0] },      // turned-over wrist, tip back
    ],
    midL: [
      { hand: [-0.12, 0.04, 0.4], blade: [-0.2, 0.95, 0.22],  twist: -0.35, flick: [-0.1, 0, 0.04], pole: [0.7, -0.4, -0.5] },
      { hand: [-0.06, 0.12, 0.44], blade: [-0.66, 0.58, 0.45], twist: -0.3, flick: [-0.1, 0.04, 0.06], pole: [0.7, -0.3, -0.5] },
    ],
    lowR: [
      { hand: [0.32, 0.2, 0.36],  blade: [0.22, -0.95, 0.24], twist: 0.2,   flick: [0.1, 0, 0.04], pole: [0.9, -0.1, -0.3] },   // hanging guard
      { hand: [0.3, -0.18, 0.42], blade: [0.55, -0.5, 0.66],  twist: 0.25,  flick: [0.1, -0.04, 0.04] },   // low sweep, tip out front
    ],
    lowL: [
      { hand: [-0.06, 0.18, 0.4], blade: [-0.3, -0.92, 0.24], twist: -0.35, flick: [-0.1, 0, 0.04], pole: [0.9, 0.1, -0.4] },
      { hand: [-0.08, -0.16, 0.44], blade: [-0.58, -0.48, 0.66], twist: -0.3, flick: [-0.1, -0.04, 0.04], pole: [0.7, -0.4, -0.5] },
    ],
  },
  reverse: {
    highR: [
      { hand: [0.3, 0.5, 0.34],   blade: [-0.78, -0.5, 0.3],  twist: 0.1,   flick: [0.08, 0.06, 0.02], pole: [0.9, -0.1, -0.3] },   // forearm shield over the brow
      { hand: [0.38, 0.4, 0.3],   blade: [0.3, -0.9, 0.3],    twist: 0.2,   flick: [0.1, 0.04, 0], pole: [0.9, 0.1, -0.3] },
    ],
    highL: [
      { hand: [-0.06, 0.5, 0.38], blade: [0.72, -0.58, 0.3],  twist: -0.3,  flick: [-0.1, 0.06, 0.02], pole: [0.8, 0.2, -0.5] },
      { hand: [0.04, 0.54, 0.34], blade: [-0.3, -0.9, 0.3],   twist: -0.25, flick: [-0.08, 0.04, 0.04], pole: [0.9, 0.1, -0.4] },
    ],
    midR: [
      { hand: [0.38, 0.14, 0.36], blade: [0.2, -0.95, 0.22],  twist: 0.22,  flick: [0.1, 0, 0.04], pole: [0.9, -0.2, -0.3] },   // blade hung down the weapon side
      { hand: [0.34, 0.06, 0.42], blade: [0.82, -0.3, 0.48],  twist: 0.3,   flick: [0.1, 0, 0.06], pole: [0.8, -0.4, -0.3] },   // elbow out, blade swept forward
    ],
    midL: [
      { hand: [-0.1, 0.16, 0.42], blade: [-0.2, -0.95, 0.24], twist: -0.35, flick: [-0.1, 0, 0.04], pole: [0.9, -0.1, -0.4] },
      { hand: [-0.04, 0.1, 0.46], blade: [-0.85, -0.25, 0.45], twist: -0.3, flick: [-0.1, 0, 0.06], pole: [0.8, -0.3, -0.4] },
    ],
    lowR: [
      { hand: [0.34, -0.06, 0.38], blade: [0.4, -0.8, 0.45], twist: 0.2,   flick: [0.1, -0.04, 0.04], pole: [0.8, -0.4, -0.3] },
      { hand: [0.3, 0.04, 0.44],  blade: [0.1, -0.7, 0.7],    twist: 0.15,  flick: [0.08, -0.04, 0.06], pole: [0.9, -0.3, -0.3] },
    ],
    lowL: [
      { hand: [-0.06, -0.02, 0.42], blade: [-0.45, -0.78, 0.45], twist: -0.3, flick: [-0.1, -0.04, 0.04], pole: [0.8, -0.2, -0.4] },
      { hand: [0.0, 0.06, 0.46],  blade: [-0.12, -0.72, 0.68], twist: -0.25, flick: [-0.08, -0.04, 0.06], pole: [0.9, -0.2, -0.4] },
    ],
  },
};
