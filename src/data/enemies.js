// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ENEMY_TYPES: stats for every regular enemy.


/* ENEMY TYPES — edit stats/behavior here; add new types and reference them in LEVELS.
   Looks: model picks the trooper design in enemies/mesh.js (purge, storm, heavy, magna, jet, riot, b1, scout);
   color is the armour, eye the glows, cloth any cape / poncho / kama. Looks never change gameplay. */
export const ENEMY_TYPES = {
  grunt:   { hp: 54,  speed: 6.7, dmg: 12, range: 2.7,  windup: 0.44, recover: 0.55, swing: 0.16,
             scale: 1.0, color: 0x8a93a6, eye: 0xff3030, model: 'purge', ranged: false, weapon: 'sword', score: 1 },
  blaster: { hp: 40,  speed: 5.2, dmg: 11, range: 14,   windup: 0.66, recover: 1.1,
             scale: 0.95, color: 0x6a7790, eye: 0xff7030, model: 'storm', ranged: true, boltSpeed: 21, score: 1 },
  brute:   { hp: 205, speed: 4.0, dmg: 27, range: 3.3,  windup: 0.8,  recover: 0.85, swing: 0.24,
             scale: 1.55, color: 0x55404a, eye: 0xff2060, model: 'heavy', ranged: false, weapon: 'maul', heavy: true, score: 3 },
  // staff duelist — telegraphed melee meant to be PARRIED (click RMB as the staff falls)
  duelist: { hp: 98,  speed: 5.7, dmg: 18, range: 3.2,  windup: 0.54, recover: 0.7,  swing: 0.18,
             scale: 1.08, color: 0x6f5a3a, eye: 0xffd24a, model: 'magna', cloth: 0x2b2420, ranged: false, weapon: 'staff', staff: true, score: 2 },
  // SITH ACOLYTE — a saber duellist (see data/duel.js): holds a guard, feints, strings cuts, binds blades in a lock,
  // and bats blaster fire back. A real duel, not a speed bump: read the guard, break it, punish the opening.
  acolyte: { hp: 135, speed: 6.3, dmg: 19, range: 3.0,  windup: 0.5,  recover: 0.6,  swing: 0.15,
             scale: 1.03, color: 0x2c2a30, eye: 0xff2a36, model: 'acolyte', cloth: 0x1c1416, ranged: false, weapon: 'saber', score: 4 },
  // JET TROOPER — a HOVERING ranged skirmisher. It floats above the fray, matches your altitude (so you can't just
  // fly/hover above it) and rains bolts. Squishy & a priority target: counter it with ranged tools / Force powers /
  // by deflecting its own fire back — the saber can't reach it. Dies by tumbling out of the sky.
  // Knocked down (a Pull, a Push, a slam) it drops, and the crash WRECKS ITS JETPACK: it gets up and fights on foot as a
  // blaster trooper. A blow with blastKnock or more behind it (Repulse 36, a Mando rocket 38, the jet missile 28) blows
  // it out of the sky outright, whatever its health.
  flyer:   { hp: 46,  speed: 7.6, dmg: 10, range: 17,  windup: 0.66, recover: 1.05,
             scale: 0.96, color: 0x55708e, eye: 0x66ccff, model: 'jet', ranged: true, boltSpeed: 25, fly: true, blastKnock: 28, score: 2 },
  // SENTINEL — a riot-shield trooper. Its deflector eats FRONTAL chip damage; you must FLANK it, or break its
  // guard with a finisher / Djem-So heavy / a RIPOSTE. Slow, durable, anchors a line. Shield shatters, then it's open.
  phalanx: { hp: 95,  speed: 4.8, dmg: 16, range: 2.9, windup: 0.6,  recover: 0.72, swing: 0.18,
             scale: 1.14, color: 0x44546e, eye: 0x8fe0ff, model: 'riot', cloth: 0x5a5040, ranged: false, weapon: 'sword', shield: true, shieldHp: 70, score: 3 },
  // SABOTEUR — a fast kamikaze droid. It rushes, then lights a FUSE (a loud, blinking tell) and DETONATES; it also
  // blows on death. Punishes greed & crowding — kill it at range, PUSH it away, or dash clear of the blast.
  bomber:  { hp: 28,  speed: 9.0, dmg: 36, range: 2.3, scale: 0.84, color: 0x8a6a28, eye: 0xffb020, model: 'b1',
             ranged: false, bomber: true, blastR: 5.2, fuse: 0.85, score: 2 },
  // MARKSMAN — a long-range sniper. It holds the back line and CHARGES a beam (a bright laser-sight tracks you),
  // then fires one hard, fast shot. Break line-of-sight behind cover, dash as it fires, or close the gap to spoil it.
  sniper:  { hp: 40,  speed: 4.0, dmg: 32, range: 32,  windup: 1.5,  recover: 1.7,
             scale: 1.0,  color: 0x3f5640, eye: 0xff2a2a, model: 'scout', cloth: 0x4a5236, ranged: true, boltSpeed: 64, sniper: true, score: 3 },
  // IMPERIAL OFFICER — the squad leader. Hangs back behind the line with a sidearm and calls ORDERS (see data/tactics.js):
  // VOLLEY (every blaster near it aims at once and fires together) and FLANK (the next attackers come in from your
  // sides). Kill it and the troops around it FALTER. Squishy: the priority target in any wave it leads.
  officer: { hp: 60,  speed: 5.0, dmg: 9,  range: 18,  windup: 0.62, recover: 1.3, standoff: 15,
             scale: 1.0,  color: 0x4f5652, eye: 0xffc040, model: 'officer', cloth: 0x2a2e2c, ranged: true, boltSpeed: 22, weapon: 'pistol', officer: true, score: 4 },
  // GRENADIER — lobs THERMAL DETONATORS over cover onto where you stand. A ring marks the landing spot the moment it
  // throws, and fills as the fuse burns: step out of it. Cover doesn't save you; moving does. A Jedi can PUSH a live
  // detonator back into the squad.
  grenadier: { hp: 58, speed: 4.8, dmg: 26, range: 21,  windup: 0.85, recover: 2.3,
             scale: 1.0,  color: 0x6d6a5a, eye: 0xff8a2a, model: 'grenadier', weapon: 'deto', ranged: true, grenade: true, blastR: 3.6, fuse: 1.15, score: 3 },
  // PURGE LANCER — an electro-pike gap-closer. From mid range it plants its feet, marks a LINE on the ground at you and
  // LUNGES down it. The line locks late: sidestep or dash out of it, or parry the point (a held block can't stop it).
  // A lancer that misses overshoots and stands wide open. Close in, it fights like a plain pikeman.
  lancer:  { hp: 88,  speed: 6.0, dmg: 21, range: 3.3,  windup: 0.5,  recover: 0.7,  swing: 0.16,
             scale: 1.04, color: 0x3a3440, eye: 0x7ad8ff, model: 'lancer', cloth: 0x231f28, ranged: false, weapon: 'pike', lancer: true, score: 3 },
};

/* ---------- ELITE MODIFIERS — variety on top of the base types ----------
   A rolled-in trait that re-skins an ordinary foe into a threat worth noticing:
   SWIFT close fast, VITAL soak punishment, VOLATILE detonate on death. Frequency
   ramps with run depth so early waves stay clean and late ones get spicy. */
export const ELITES = {
  swift:    { tint: 0x35e0ff, label: 'SWIFT',    spd: 1.5,  scale: 0.92, hp: 1.0 },
  vital:    { tint: 0x53ff8c, label: 'VITAL',    spd: 0.95, scale: 1.16, hp: 1.9 },
  volatile: { tint: 0xff7a2a, label: 'VOLATILE', spd: 1.1,  scale: 1.0,  hp: 1.0 },
};

/* ---------- ENGAGEMENT — how many foes press the attack at once ----------
   Melee foes take turns: only `meleeSlots` of them hold an ATTACK TOKEN and close in to swing. The rest stalk a
   ring just outside reach, circling and feinting, until a token frees up (a holder swings, is staggered, floored,
   or dies). This keeps a crowd dangerous but readable, so parries and combos have room to land.
   Ranged foes share `rangedSlots` so a firing line staggers its shots instead of one wall of bolts. */
export const ENGAGE = {
  meleeSlots: 2,            // melee attackers at once (early run)
  meleeSlotsLate: 3,        // ...from `lateAt` cumulative waves on (campaign: Exegol)
  lateAt: 8,
  survivalSlotEvery: 10,    // survival adds one more melee slot every N waves (up to `maxSlots`)
  maxSlots: 5,
  diffSlots: { padawan: -1, knight: 0, master: 1 },
  rangedSlots: 2,           // blaster / jet trooper wind-ups at once
  rangedSlotsLate: 3,       // ...from `lateAt` on
  sniperSlots: 1,           // marksmen charging a shot at once (one laser sight to read and dodge)
  sniperSlotsLate: 2,
  tokenHold: 3.2,           // a holder that hasn't swung by now gives the token back (stuck behind cover, kited)
  tokenRest: [0.6, 1.2],    // after swinging, a foe waits this long (s) before it can take a token again
  ringPad: 2.4,             // stalkers hold this far beyond their weapon reach
  stalkSpeed: 0.55,         // fraction of run speed while circling
  rearWindup: 1.35,         // a swing wound up BEHIND the camera takes this much longer (off-screen fairness)
  strafe: 0.7,              // ranged ground troopers sidestep this hard between shots
  hitStun: 0.2,             // a saber hit on a light foe that isn't swinging checks its advance this long (s)
  poise: 1.4,               // a saber hit knocks a light foe out of its wind-up at most once per this many seconds
  reach: 1.05,              // a melee blow lands only within this much of the foe's range (after its lunge): back off and it whiffs
  thrustReach: 0.9,         // a duellist's thrust reaches this much further
};
