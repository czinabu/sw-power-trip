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
  // JET TROOPER — a HOVERING ranged skirmisher. It floats above the fray, matches your altitude (so you can't just
  // fly/hover above it) and rains bolts. Squishy & a priority target: counter it with ranged tools / Force powers /
  // by deflecting its own fire back — the saber can't reach it. Dies by tumbling out of the sky.
  flyer:   { hp: 46,  speed: 7.6, dmg: 10, range: 17,  windup: 0.66, recover: 1.05,
             scale: 0.96, color: 0x55708e, eye: 0x66ccff, model: 'jet', ranged: true, boltSpeed: 25, fly: true, score: 2 },
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
