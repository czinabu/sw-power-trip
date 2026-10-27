// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LEVELS: campaign level and wave definitions.


/* LEVELS — waves are {type:count}; hazards are counts; edit freely.
   Grounded pass: fewer bodies, more of them worth fighting. Troopers were cut hardest (a wave is a handful of duels,
   not a crowd to mow through); the duellists, lancers and brutes mostly stayed, and grow sharper with depth
   (data/duel.js eliteRamp). */
export const LEVELS = [
  { name: 'LEVEL 1 — HOLY CITY OF JEDHA', sub: 'The Empire has come for the temple. Show them why legends are feared.',
    arena: 42, floor: 0x4a4234, fog: 0x1a2433, sky: 0x101822, skyTop: 0x04060c, sun: 0xffeedd, ember: 0x7f95b5,
    layout: 'temple',
    waves: [ {grunt:4}, {grunt:5, blaster:2}, {grunt:5, blaster:2, duelist:1, phalanx:1}, {grunt:5, blaster:2, duelist:2, flyer:1, phalanx:1, acolyte:1, officer:1} ],
    hazards: { vents: 0, barrels: 3 } },   // authored layouts place their own (world/arenas); counts kept for reference
  { name: 'LEVEL 2 — MUSTAFAR FORGE', sub: 'Their war machines are forged in fire. The forge itself is a weapon. Use it.',
    arena: 52, floor: 0x47433f, fog: 0x3a2c20, sky: 0x1d130c, skyTop: 0x090503, sun: 0xffd2a8, ember: 0xff7733,
    fill: 0.92, sunI: 1.85, fogStart: 0.62, layout: 'foundry',
    waves: [ {grunt:5, blaster:2, duelist:2, flyer:1, phalanx:1, bomber:1, grenadier:1}, {grunt:5, blaster:3, brute:1, duelist:2, flyer:1, phalanx:1, sniper:1, lancer:1, officer:1}, {grunt:5, blaster:3, brute:1, duelist:2, flyer:1, phalanx:1, sniper:1, bomber:1, acolyte:1, grenadier:1, lancer:1, officer:1}, {grunt:5, blaster:3, brute:2, duelist:2, flyer:1, phalanx:1, sniper:1, bomber:1, acolyte:2, grenadier:1, lancer:1, officer:1} ],
    lullWaves: [3],   // wave 4 is split in two with a short lull (game/flow.js splitWaveWithLull)
    hazards: { vents: 4, barrels: 6 } },
  { name: 'LEVEL 3 — THRONE OF EXEGOL', sub: 'An army stands before you. Something darker stands behind it.',
    arena: 72, floor: 0x3b2f31, fog: 0x401a22, sky: 0x1a080c, skyTop: 0x090103, sun: 0xffb0a0, ember: 0xff4a55,
    fill: 0.98, sunI: 1.9, fogStart: 0.6, layout: 'plains',
    waves: [ {grunt:4, blaster:3, brute:1, duelist:2, flyer:1, phalanx:1, bomber:1, acolyte:1, officer:1, grenadier:1, lancer:1}, {grunt:4, blaster:3, brute:2, duelist:2, flyer:1, phalanx:1, sniper:1, acolyte:2, officer:1, grenadier:1, lancer:1}, {grunt:5, blaster:3, brute:2, duelist:2, flyer:2, phalanx:1, sniper:1, bomber:1, warbringer:1, acolyte:2, officer:1, grenadier:1, lancer:1}, {grunt:5, blaster:3, brute:2, duelist:3, flyer:2, phalanx:1, sniper:1, bomber:1, acolyte:3, officer:1, grenadier:1, lancer:1} ],
    lullWaves: [0, 1, 2, 3],
    hazards: { vents: 4, barrels: 7 }, boss: true },
];
