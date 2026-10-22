// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL: how sword-armed foes fight back (guards, feints, strings, saber locks) and the Mandalorian's close-quarters kit.


/* DUELLING — Jedi Academy style. A foe with a profile below doesn't just walk in and chop: it holds a GUARD on one
   side (the glowing arc beside it shows which), turns blows that come in on that line, and answers with feints,
   delayed strikes and strings of cuts. Spamming the same cut into a guard gets it blocked and countered; reading the
   guard and cutting in on the open line (A / D / W pick where your cut starts) gets through.

   Per-type profile (missing type = fights the old way):
     block    chance to turn a cut that arrives on the guarded line (a side it isn't guarding: block × offLine)
     posture  how much blocking it can take before its guard BREAKS (staggered, wide open)
     feint    chance a wind-up is a fake: it rears back, then switches side and strikes fast (early parries whiff)
     delay    chance it HOLDS the apex of a wind-up for an extra beat (punishes parrying on reflex)
     chain    the most extra cuts it strings after the first (each one a quick, shorter wind-up)
     counter  chance it answers a block with an immediate riposte
     thrust   chance a strike is a lunging THRUST that a held block can't stop (parry it or dodge; white-red tell)
     dodge    chance it steps back out of a cut it sees coming instead of blocking
     deflect  chance it bats a blaster bolt back at the shooter (saber users only)
     lock     a cut that meets its strike mid-arc becomes a SABER LOCK instead of a plain clash
     push     how hard it drives a saber lock (balance per second)
     ramp     feint and delay grow with run depth (data/tactics.js RAMP): the rank and file learn tricks as the run goes on */
export const DUEL_PROFILES = {
  grunt:   { block: 0.18, posture: 40,  feint: 0.2,  delay: 0.3,  chain: 0, counter: 0.15, thrust: 0,    dodge: 0, ramp: true },
  phalanx: { block: 0,    posture: 60,  feint: 0.15, delay: 0.35, chain: 1, counter: 0.3,  thrust: 0,    dodge: 0, ramp: true },
  duelist: { block: 0.55, posture: 70,  feint: 0.25, delay: 0.25, chain: 1, counter: 0.45, thrust: 0.1,  dodge: 0.1, lock: true, push: 0.38 },
  acolyte: { block: 0.72, posture: 95,  feint: 0.3,  delay: 0.3,  chain: 2, counter: 0.6,  thrust: 0.15, dodge: 0.2, deflect: 0.75, lock: true, push: 0.5 },
};

export const DUEL = {
  offLine: 0.22,          // a guard still turns this fraction of its block chance on the lines it ISN'T covering
  guardShift: [0.9, 1.8], // seconds a guard holds a line before shifting (it also shifts to cover a line it was just hit on)
  adaptAfter: 2,          // blocks on the SAME line in a row before it locks that line down (block → 0.95)
  guardRange: 7,          // the guard arc only shows on foes this close
  // POSTURE — what each kind of blow costs a guard (blocked cuts build it; posture drains back when left alone)
  posture: { cut: 14, finisher: 26, heavyMul: 1.6, kick: 45, parry: 55, punch: 12, punchHeavy: 30, charge: 50, regen: 9, regenDelay: 1.6 },
  jarGap: 0.45,           // seconds: blade contacts (clash, bounce) closer together than this cost stamina once, not each
  bounce: { stam: 8, lock: 0.22 },   // a cut turned by a guard bounces off: this much stamina and a short re-swing lockout
  /* BLADE ON BLADE (player/jedi/clash.js) — your cut meets a weapon that is READY for it (a guard, or a strike in
     flight) where the two actually cross. reach: how close the blades must pass (m, glow included: generous on
     purpose); recoil: seconds the swing takes to kick back off the other blade; back: how much of the swing it rewinds;
     hitstop: the freeze on contact. The boss's blows clash too (data/bosses.js combo.clashGap). */
  clash: { reach: 0.22, recoil: 0.17, back: 0.3, hitstop: 0.07 },
  // ENEMY OFFENCE
  feintAt: 0.7,           // a feint breaks off this far into its wind-up...
  feintRewind: 0.26,      // ...and the real strike winds up this fast from the other side
  delayHold: [0.22, 0.42],// extra seconds a delayed strike hangs at the apex
  chainWindup: 0.3,       // wind-up of each follow-on cut in a string
  counterWindup: 0.24,    // wind-up of a riposte after a block
  counterCd: 1.6,         // a foe counters at most this often
  thrustDmg: 1.35,        // a thrust hits this much harder than a cut
  dodgeStep: 7,           // backstep speed when it slips a cut
  // SABER LOCK — blades bind; mash LMB to drive through, or break it with a kick (E) or a Force push (F)
  lock: { chance: 0.7, time: 3.2, press: 0.15, stam: 3, kickStam: 22, pushCost: 18, loseDmg: 16, heavyPress: 1.35, fastPress: 0.85 },
};

/* POSES — what a duellist's weapon shows you (enemies/duel.js eases into these; tools/enemy-lab.html ?pose=guardL…windT
   previews them). Sword arms: [weaponArm.rotation.x (raise), .z (out to its side + / across the body -)].
   Staffs: [staff.rotation.z, .x]. */
// guard: where the weapon is held tells you the covered line. weaponArm x raises it, z swings it out (+) or across (-)
export const GUARD_POSE = {
  sword: { R: [-1.15, 0.55], L: [-1.25, -0.85], H: [-2.35, 0.25] },
  staff: { R: [0.0, 0.25],   L: [1.25, 0.6],    H: [-1.0, 1.2] },   // staff: [rotation.z, rotation.x]
};
// wind-up: where the weapon rears back to is where the strike comes FROM (T = a thrust, drawn back low)
export const WIND = {
  sword: { R: [-1.75, 1.35], L: [-1.9, -1.15], H: [-2.6, 0.2], T: [0.15, 0.1] },
  staff: { R: [-2.0, 0.4],   L: [1.9, 0.5],     H: [-2.9, 1.2], T: [-1.4, -0.4] },
};

/* THE MANDALORIAN'S CLOSE-QUARTERS KIT (E). No Jedi forms, but a bounty hunter who has fought every kind of thing:
   (the string's blows rock a foe back `shove` units and never launch it; a foe they kill crumples where it stands.
   Only the jet-powered moves, the charge and the dive kick, throw bodies. Each blow LANDS `contact` seconds after the
   press, when the fist reaches full extension: a short chamber, then a snap into the target)
   a four-beat string (jab, cross, knee, vibroblade), a jet-assisted charge (W + E with a foe ahead), a dive kick
   (E in the air), a vambrace CATCH (E as a blow lands turns it on the beskar and staggers the attacker) and a
   TAKEDOWN on anything staggered or floored. */
export const MANDO_MELEE = {
  string: [
    { name: 'jab',   dmg: 13, knock: 8,  line: 'L', recover: 0.3,  lunge: 4.5, shove: 0.3, contact: 0.07 },
    { name: 'cross', dmg: 16, knock: 12, line: 'R', recover: 0.34, lunge: 5,   shove: 0.45, contact: 0.1 },
    { name: 'knee',  dmg: 18, knock: 14, line: 'H', recover: 0.4,  lunge: 5.5, shove: 0.9, contact: 0.12, heavy: true },
    { name: 'blade', dmg: 30, knock: 22, line: 'R', recover: 0.52, lunge: 6.5, shove: 0.5, contact: 0.13, heavy: true, stagger: true },
  ],
  /* HOLSTERED (4): with his weapon put away the string becomes a brawler's — real swings, not quick shots: a lead
     hook, a rear hook, a rising uppercut, then a wound-up overhand haymaker that staggers. Each one sweeps a wider arc
     and reaches a little further than the armed string (`reach`, `arc`), and hits harder. */
  fists: [
    { name: 'hookL',    dmg: 17, knock: 10, line: 'L', recover: 0.36, lunge: 4.5, shove: 0.45, contact: 0.11, reach: 1.7, arc: 1.0 },
    { name: 'hookR',    dmg: 19, knock: 12, line: 'R', recover: 0.38, lunge: 5,   shove: 0.55, contact: 0.12, reach: 1.7, arc: 1.0 },
    { name: 'upper',    dmg: 22, knock: 14, line: 'H', recover: 0.42, lunge: 5,   shove: 0.9,  contact: 0.13, reach: 1.6, arc: 0.8, heavy: true },
    { name: 'haymaker', dmg: 36, knock: 24, line: 'R', recover: 0.58, lunge: 7,   shove: 0.6,  contact: 0.17, reach: 1.85, arc: 1.05, heavy: true, stagger: true },
  ],
  combo: 0.55,            // seconds after a strike's recovery the next press still continues the string
  reach: 1.45, arc: 0.75,   // a fist lands within arm's length (+ the step it carries) of the body, in front
  catchWindow: 0.2,       // a blow landing this soon after E is caught on the vambrace
  catchWhiff: 0.55,       // a catch window that caught nothing can't reopen for this long
  charge: { minD: 3.2, maxD: 9, fuel: 18, cd: 1.4, dmg: 22, knock: 26, speed: 26 },
  dive: { fuel: 14, cd: 1.0, dmg: 26, radius: 3.2, knock: 20, speed: 30 },
  takedown: { range: 2.0, dmg: 70, maxFrac: 0.6 },   // + this fraction of a light foe's max health (not heavies/bosses)
  /* SHIELD AND BLADE — E while the single blaster's shield is up (RMB). The wrist vibroblade cuts from behind the
     disc and the shield STAYS UP (firing drops it, cutting doesn't), so this is the crowd tool: a wide hack, a
     backhand, then a shield BASH that staggers the light foes in front of you for takedowns. Every beat spends the
     stamina the shield soaks with, you still move at brace speed and your back is open, so it holds a line rather
     than out-damaging the blaster. `arc` is the half-angle in radians, `stam` the cost of the beat. */
  guard: {
    string: [
      { name: 'hackA', dmg: 20, knock: 10, line: 'R', recover: 0.36, lunge: 2.5, shove: 0.6, contact: 0.11, reach: 2.2, arc: 1.15, stam: 8 },
      { name: 'hackB', dmg: 20, knock: 10, line: 'L', recover: 0.36, lunge: 2.5, shove: 0.6, contact: 0.11, reach: 2.2, arc: 1.15, stam: 8 },
      { name: 'bash',  dmg: 10, knock: 6,  line: 'H', recover: 0.55, lunge: 5,   shove: 0.8, contact: 0.12, reach: 2.3, arc: 1.0,  stam: 14, heavy: true, stagger: true },
    ],
    posture: 22,          // what the bash costs a duellist's guard (on top of the cut it lands as)
    takedownReach: 1.6,   // behind the shield a takedown reaches this much further: the bash stumbles foes back out of arm's length
  },
};
