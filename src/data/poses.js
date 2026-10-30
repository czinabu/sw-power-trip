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
  brawler:   { crouch: -0.15, splay: 0.24, lead: 0.36, lean: 0.12, width: 1.1 },    // the holstered Mando: knees bent, left foot leading
};

/* a grip can stand on another form's feet: reverse-grip Niman takes Djem So's wide stance */
export const FOOTWORK_GRIP = { reverse: { niman: 'djemso' } };

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
    // FORM VI NIMAN — the Force leads and the blade waits on it: turned side-on, the off arm reaches out long at the foe
    // with the palm open, and the saber is raised high over the weapon shoulder, elbow up, the blade laid forward over
    // the head and the Force hand at the foe, ready to come down past it. Saber and Force in one shape: the whole form.
    niman: {
      ready: { hand: [0.34, 0.56, -0.1], blade: [-0.24, 0.2, 0.95], twist: -0.32, torso: -0.12, pole: [0.85, 0.2, -0.5], palm: 1,
               off: { hand: [-0.46, 0.06, 0.42], pole: [-0.65, -0.75, 0.1] },   // out wide of the body, so it reads from the front and from the camera behind
               offMove: { hand: [-0.3, -0.1, 0.34], pole: OFF_POLE } },   // walking, the reaching hand drops to a loose carry
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
    // Ahsoka's guard: saber fist up in front of the weapon-side chest, blade laid level out past the weapon side, off
    // hand close in front of the chest; coiled and leaning in
    ataru: {
      ready: { hand: [0.2, 0.08, 0.4], blade: [0.98, 0.04, 0.18], twist: 0.12, lean: 0.08, pole: [0.5, -0.7, -0.4],
               off: { hand: [-0.06, 0.02, 0.38], pole: OFF_POLE } },
      block: { hand: [0.16, 0.5, 0.36], blade: [-0.55, -0.75, 0.25], twist: -0.1, pole: [0.9, -0.1, -0.3],
               off: { hand: [-0.4, -0.1, 0.25], pole: OFF_POLE } },
    },
    // Starkiller's guard: the saber fist low by the weapon hip, the blade laid back along the forearm and rising behind
    // the body over the off shoulder, the free hand held out from the side, open; on Djem So's wide, rooted feet
    // (FOOTWORK_GRIP)
    niman: {
      ready: { hand: [0.32, -0.18, 0.14], blade: [-0.5, 0.7, -0.5], twist: 0.08, torso: 0.04, lean: 0.06, pole: [0.6, -0.5, -0.6],
               off: { hand: [-0.52, -0.26, 0.14], pole: [-0.6, -0.75, -0.25] } },
      // forearm raised across the centre line, blade hanging straight down to cover the body
      block: { hand: [0.06, 0.2, 0.42], blade: [0.25, -0.96, 0.12], twist: 0, lean: 0.05, pole: [0.9, -0.2, -0.3],
               off: { hand: [-0.16, 0.0, 0.38], pole: OFF_POLE } },
    },
    // Kylo Ren's trailing guard: saber arm hanging long and low out at the weapon side, blade raked down and back so
    // the tip drags near the floor behind him; hunched forward, off hand raised out ahead, clawed
    djemso: {
      ready: { hand: [0.4, -0.24, 0.12], blade: [0.62, -0.45, -0.64], twist: -0.18, lean: 0.14, pole: [0.5, -0.3, -0.8],
               off: { hand: [-0.55, 0.15, 0.4], pole: [-0.7, -0.5, -0.3] } },
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
    // AIMED CUTS (data/stances.js CUT_AIM). High: the flat sweep lifted to the head, the blade canted up. Low: the hands
    // drop to the hip and the blade angles down to sweep the knees (the hips sink into it). Rising: up from the floor on
    // one side to the far shoulder. The thrust draws the hilt back to the hip and drives the point straight out.
    leftHigh:  [
      { hand: [0.4, 0.52, -0.02],  blade: [0.6, 0.5, -0.62],   twist: 0.5 },
      { hand: [0.08, 0.32, 0.52],  blade: [-0.12, 0.12, 0.98], twist: -0.05 },
      { hand: [-0.3, 0.26, 0.28],  blade: [-0.86, 0.06, -0.3], twist: -0.55 },
    ],
    rightHigh: [
      { hand: [-0.26, 0.48, 0.18], blade: [-0.8, 0.46, -0.3],  twist: -0.5 },
      { hand: [0.06, 0.32, 0.52],  blade: [0.12, 0.12, 0.98],  twist: 0.05 },
      { hand: [0.46, 0.26, 0.06],  blade: [0.86, 0.06, -0.42], twist: 0.55 },
    ],
    leftLow:   [
      { hand: [0.42, -0.04, 0.02], blade: [0.6, -0.22, -0.72], twist: 0.45 },
      { hand: [0.1, -0.2, 0.52],   blade: [-0.1, -0.24, 0.96],  twist: -0.05 },
      { hand: [-0.3, -0.22, 0.3],  blade: [-0.86, -0.26, -0.2], twist: -0.5 },
    ],
    rightLow:  [
      { hand: [-0.24, -0.06, 0.24], blade: [-0.8, -0.22, -0.42], twist: -0.45 },
      { hand: [0.08, -0.2, 0.52],  blade: [0.1, -0.24, 0.96],   twist: 0.05 },
      { hand: [0.44, -0.22, 0.1],  blade: [0.86, -0.26, -0.25], twist: 0.5 },
    ],
    riseL:     [
      { hand: [0.38, -0.32, 0.14], blade: [0.5, -0.72, 0.36],  twist: 0.4 },
      { hand: [0.08, 0.0, 0.55],   blade: [-0.25, 0.32, 0.92], twist: 0 },
      { hand: [-0.28, 0.4, 0.24],  blade: [-0.55, 0.72, -0.2], twist: -0.42 },
    ],
    riseR:     [
      { hand: [-0.2, -0.3, 0.26],  blade: [-0.5, -0.72, 0.36], twist: -0.4 },
      { hand: [0.06, 0.0, 0.55],   blade: [0.25, 0.32, 0.92],  twist: 0 },
      { hand: [0.44, 0.36, 0.1],   blade: [0.6, 0.72, -0.2],   twist: 0.42 },
    ],
    thrust:    [
      { hand: [0.32, -0.06, -0.12], blade: [0.08, 0.06, 1],   twist: 0.45 },
      { hand: [0.1, 0.08, 0.66],   blade: [-0.02, 0.02, 1],    twist: -0.15 },
      { hand: [0.08, 0.08, 0.72],  blade: [-0.04, 0.0, 1],     twist: -0.2 },
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
    // AIMED CUTS: the strafe cuts lifted to the head or dropped to the knees, the tip still trailing the fist; the rising
    // cuts lead with the knuckles up from the hip; the thrust is the Shien stab driven forward past the fist
    leftHigh:  [
      { hand: [0.38, 0.54, 0.08],  blade: [0.35, 0.05, -0.94],  twist: 0.55 },
      { hand: [0.1, 0.4, 0.46],    blade: [-0.1, 0.05, 1],      twist: 0 },
      { hand: [-0.3, 0.34, 0.3],   blade: [-0.92, 0.1, 0.25],   twist: -0.65 },
    ],
    rightHigh: [
      { hand: [-0.24, 0.5, 0.28],  blade: [-0.4, 0.05, -0.9],   twist: -0.6 },
      { hand: [0.08, 0.4, 0.46],   blade: [0.1, 0.05, 1],       twist: 0.05 },
      { hand: [0.46, 0.34, 0.14],  blade: [0.92, 0.1, 0.25],    twist: 0.6 },
    ],
    leftLow:   [
      { hand: [0.4, -0.04, 0.1],   blade: [0.35, -0.3, -0.88],  twist: 0.5 },
      { hand: [0.1, -0.18, 0.46],  blade: [-0.1, -0.3, 0.95],   twist: 0 },
      { hand: [-0.3, -0.18, 0.3],  blade: [-0.92, -0.3, 0.2],   twist: -0.6 },
    ],
    rightLow:  [
      { hand: [-0.24, -0.04, 0.3], blade: [-0.4, -0.3, -0.86],  twist: -0.55 },
      { hand: [0.08, -0.18, 0.46], blade: [0.1, -0.3, 0.95],    twist: 0.05 },
      { hand: [0.46, -0.18, 0.14], blade: [0.92, -0.3, 0.2],    twist: 0.55 },
    ],
    riseL:     [
      { hand: [0.36, -0.3, 0.2],   blade: [0.3, -0.85, 0.42],   twist: 0.45 },
      { hand: [0.1, 0.02, 0.48],   blade: [-0.2, -0.2, 0.95],   twist: 0 },
      { hand: [-0.26, 0.36, 0.28], blade: [-0.7, 0.2, 0.5],     twist: -0.5 },
    ],
    riseR:     [
      { hand: [-0.2, -0.28, 0.3],  blade: [-0.3, -0.85, 0.42],  twist: -0.45 },
      { hand: [0.1, 0.02, 0.48],   blade: [0.2, -0.2, 0.95],    twist: 0 },
      { hand: [0.44, 0.34, 0.16],  blade: [0.7, 0.2, 0.5],      twist: 0.5 },
    ],
    thrust:    [
      { hand: [0.32, 0.0, -0.08],  blade: [0.05, -0.3, -0.95],  twist: 0.4 },
      { hand: [0.1, 0.06, 0.62],   blade: [0, -0.35, 0.94],     twist: -0.1 },
      { hand: [0.08, 0.04, 0.7],   blade: [0, -0.4, 0.92],      twist: -0.15 },
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
   finisher — the 3rd-hit move: { pattern, spin (turns), hop }
   HOW THE CUT FLOWS (anim/saber.js swingPose; none of it moves the hit timing):
   load     — how much further than the chamber key the wind-up keeps drawing while it hangs (a slow settle, not a stop)
   accel    — how hard the stroke accelerates into contact (the follow-through is matched to it, so the blade carries on)
   lag      — the wrist: the tip trails the hilt into the stroke and whips past it at contact (0 = the blade locked to
              the arm, a bat; higher = a whippier, more fencer's cut)
   recover  — how far back toward the guard the blade flows before the swing hands over to it
   weight   — how far the hips shift onto the back foot in the wind-up and through onto the front one in the strike (m)
   offFlare — how far the free hand works against the blade (SWING_OFF) */
export const SWING_STYLE = {
  ataru:     { tc: 0.16, ts: 0.4, tf: 0.7, reach: 0.95, two: false, spinHop: 0.16, drop: 0.0, offFlare: 0.75, overshoot: 0,
               twist: 1.25, finisher: { pattern: 'right', spin: 1, hop: 0.75 },
               load: 0.06, accel: 2.2, lag: 0.55, recover: 0.6, weight: 0.05 },   // whippy wrist cuts that spring back to the guard
    // Ataru's finisher is a leaping spin cut (Force-boosted, tucked)
  niman:     { tc: 0.24, ts: 0.4, tf: 0.72, reach: 1.0, two: false, spinHop: 0, drop: 0.04, offFlare: 1.0, overshoot: 0,
               twist: 1.0, finisher: { pattern: 'right', spin: 1, hop: 0 },
               load: 0.08, accel: 2.4, lag: 0.4, recover: 0.55, weight: 0.06 },   // measured: a full draw, a clean stroke, a long even follow-through
    // Niman finishes with a clean spinning cut
  djemso:    { tc: 0.3, ts: 0.42, tf: 0.74, reach: 1.15, two: true, spinHop: 0, drop: 0.14, offFlare: 0, overshoot: 0,
               twist: 0.85, finisher: { pattern: 'forward', spin: 0, hop: 0.12 },
               load: 0.12, accel: 2.8, lag: 0.15, recover: 0.45, weight: 0.09 },   // a deep load, the arms and hips driving a stiff wrist
    // Djem So finishes with a rising-then-crushing two-handed overhead
  darksaber: { tc: 0.34, ts: 0.46, tf: 0.72, reach: 1.2, two: true, spinHop: 0, drop: 0.16, offFlare: 0, overshoot: 0.35,
               twist: 0.8, finisher: { pattern: 'forward', spin: 0, hop: 0.1 },
               load: 0.1, accel: 2.6, lag: 0.08, recover: 0.4, weight: 0.08 },
};

/* ---------------- the FREE HAND through a one-handed cut ----------------
   [wind-up, strike, follow-through] targets for the off hand (chest space), blended from the guard's own off-hand place
   by the form's offFlare. A FOREHAND (the blade travelling across the body toward the off side) reaches the off hand out
   at the foe on the wind-up, then pulls it back to the hip as the blade comes through: the counter-pull that turns the
   shoulders into the cut. A BACKHAND tucks it in to the chest and flings it out the other way as the blade goes out. */
export const SWING_OFF = {
  fore: [[-0.16, 0.08, 0.56], [-0.34, -0.26, -0.04], [-0.44, -0.12, -0.1]],
  back: [[-0.12, -0.12, 0.26], [-0.52, 0.02, 0.14], [-0.5, 0.1, 0.22]],
};

/* ---------------- SWING SPINS: pirouettes and blade twirls worked into the cuts ----------------
   A spin is a layer over the normal cut, never a replacement: the same keyframes, the same damage, the strike lands on
   the same key. The body turns turns × 360° over the chamber and settles square just as the blade reaches the strike
   (so the cut hits what is in front of you), the blade can wheel (twirl: turns about the hand) while it coils, and the
   step drives further (travel × the cut's root motion, at least `reach` metres). Only grounded, non-finisher, non-riposte,
   non-back cuts spin, and any cancel (guard, Force, dash) ends it at once.
   A spin is EARNED and PAID FOR: it only comes on a link struck in rhythm (the flow link that chains out of the last cut's
   follow-through, never a mashed or opening cut), at most once per `cd` seconds, and it costs `stam` × the form's swing
   stamina on top (no stamina to spare, no spin). The longer cut (`dur`) is the recovery it trades.
   `mid` is the second link of a string (combo step 1); `move` is a strafe cut (A / D) on any other link. A spin cut is
   `dur`× longer than a plain one: the turn has to fit before the strike, and a full turn in a plain cut's time reads as a snap. Regular grip wheels the blade; a reverse grip keeps it laid along
   the forearm, so it spins with the body only. */
export const SWING_SPINS = {
  ataru:  { mid: { turns: 1, twirl: 0, travel: 1.5, reach: 1.3, dur: 1.45, stam: 0.5, cd: 2.5 },                  // acrobatic: a full pirouette between cuts
            move: null },
  niman:  { mid: { turns: 0, twirl: 1, travel: 1.15, reach: 0.8, dur: 1.25, stam: 0.4, cd: 3 },                // balanced: a wrist-twirl flourish, feet stay put
            move: { turns: 1, twirl: 0, travel: 1.3, reach: 1.2, dur: 1.3, stam: 0.6, cd: 3 } },               // strafing cuts turn through
  djemso: { mid: null,                                                                       // heavy: no flourish, but a strafing cut
            move: { turns: 1, twirl: 0, travel: 1.5, reach: 1.5, dur: 1.2, stam: 0.5, cd: 4 } },              // wheels its weight round
};

/* ---------------- DEFLECT SPINS: turning a catch into a spin ----------------
   A bolt caught while the hero is on the move, or the second bolt of a volley inside `volley` seconds, can be turned
   into a spin: the same catch and flick, with the body (turns × 360°) or the blade (twirl: one wheel about the hand)
   carried round it, and a short step in the direction of travel. It is a flourish, not a shield: the catch lands on the
   same beat, the bolt is returned exactly as before, nothing is locked (a cut, a dash or a Force power takes over at once),
   and `cd` seconds must pass before the next. `anticipate` (Niman): the share of catches that are sure (a parry window still open when the bolt lands, or a held guard) where the twirl is started early enough that the bolt meets the blade at the bottom of the wheel. The turn is toward the side the bolt arrived on (weapon side = clockwise).
   Ataru (Form IV) is the acrobat: it whirls through a pirouette to cover every angle, as the form's duellists do on the
   move. Niman (Form VI) keeps what is useful of both: an economical wrist-twirl of the blade, feet staying put. Djem So
   (Form V) is power and the straight line: it plants and answers, no spin. */
export const DEFLECT_SPINS = {
  ataru:  { turns: 1, twirl: 0, dur: 0.5, cd: 1.8, volley: 0.9, step: 1.0 },
  niman:  { turns: 0, twirl: 1, dur: 0.42, cd: 1.5, volley: 0.9, step: 0,
            anticipate: 0.5 },   // on a share of catches the twirl starts BEFORE the bolt lands, so it strikes the blade at the bottom of the wheel
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
