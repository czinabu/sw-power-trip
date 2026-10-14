// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LEVELS: campaign level and wave definitions.


/* LEVELS — waves are {type:count}; hazards are counts; edit freely */
export const LEVELS = [
  { name: 'LEVEL 1 — TEMPLE STEPS', sub: 'They dare to come. Show them why legends are feared.',
    arena: 42, floor: 0x4a4234, fog: 0x1a2433, sky: 0x101822, skyTop: 0x04060c, sun: 0xffeedd, ember: 0x7f95b5,
    layout: 'temple',
    waves: [ {grunt:5}, {grunt:7, blaster:2}, {grunt:8, blaster:3, duelist:2, phalanx:1}, {grunt:9, blaster:3, duelist:3, flyer:1, phalanx:2} ],
    hazards: { vents: 0, barrels: 0 } },
  { name: 'LEVEL 2 — FOUNDRY ASSAULT', sub: 'The machinery itself is a weapon. Use it.',
    arena: 52, floor: 0x47433f, fog: 0x3a2c20, sky: 0x1d130c, skyTop: 0x090503, sun: 0xffd2a8, ember: 0xff7733,
    fill: 0.92, sunI: 1.85, fogStart: 0.62, layout: 'foundry',
    waves: [ {grunt:9, blaster:3, duelist:3, flyer:1, phalanx:1, bomber:1}, {grunt:10, blaster:4, brute:1, duelist:3, flyer:1, phalanx:1, sniper:1, bomber:1}, {grunt:11, blaster:4, brute:2, duelist:4, flyer:2, phalanx:2, sniper:1, bomber:2}, {grunt:12, blaster:5, brute:3, duelist:4, flyer:2, phalanx:2, sniper:2, bomber:2} ],
    hazards: { vents: 5, barrels: 7 } },
  { name: 'LEVEL 3 — THE SCARRED PLAIN', sub: 'An army stands before you. Something darker stands behind it.',
    arena: 72, floor: 0x3b2f31, fog: 0x401a22, sky: 0x1a080c, skyTop: 0x090103, sun: 0xffb0a0, ember: 0xff4a55,
    fill: 0.98, sunI: 1.9, fogStart: 0.6, layout: 'plains',
    waves: [ {grunt:11, blaster:4, brute:2, duelist:4, flyer:2, phalanx:2, bomber:1}, {grunt:12, blaster:5, brute:3, duelist:4, flyer:2, phalanx:2, sniper:2, bomber:1}, {grunt:13, blaster:5, brute:3, duelist:4, flyer:3, phalanx:2, sniper:2, bomber:2, warbringer:1}, {grunt:15, blaster:6, brute:4, duelist:5, flyer:3, phalanx:3, sniper:3, bomber:3} ],
    hazards: { vents: 6, barrels: 9 }, boss: true },
];
