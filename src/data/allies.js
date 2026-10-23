// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SQUAD: the friendly strike team (allies/squad.js) and the revive rules (game/revive.js), as data. Edit freely.

/* THE BALANCE IDEA — the squad holds ground, it doesn't win the fight for you.
   1. WHO FIGHTS WHOM. Squadmates only trade fire with the rank and file (FODDER below). Duellists, lancers, sentinels,
      brutes, champions and bosses are yours: the squad never shoots them, and they never turn on the squad.
   2. SOFTEN, DON'T STEAL. A squadmate's bolt is weak and slow to come (a trooper takes ~4 of them), so the squad wears
      troopers down and you finish them. Their kills pay half XP and feed no streak, Focus, lifesteal or boon.
   3. SHARED HEAT. Troopers near a squadmate may turn on it instead of you, but never more than `aggroShare` of the
      living fodder at once, so you always have a fight of your own.
   4. MORTAL, NOT DISPOSABLE. A squadmate that drops is DOWN, not dead: it gets up on its own after `downTime`, or you
      stand by it and get it up in `reviveTime`. A wave cleared gets everyone up.
   5. ONE SECOND CHANCE. With a squadmate standing, a killing blow drops you instead of ending the run, and the nearest
      squadmate runs to you to get you up. That's `revives` per wave (or per mission objective); spend it and the next
      killing blow is final. Bleed out before anyone reaches you and it's over too. */

export const FODDER = { grunt: 1, blaster: 1, flyer: 1, sniper: 1, officer: 1, grenadier: 1, bomber: 1 };

export const SQUAD = {
  max: 4,                       // squadmates at once
  // stats per role: hp, run speed, bolt damage, reach (m), seconds between shots [min, max], aim scatter (rad),
  // a burst of `burst` bolts `burstGap` apart (the heavy gunner), bolt speed
  roles: {
    rifle: { hp: 110, speed: 6.0, dmg: 9, range: 20, every: [1.5, 2.3], spread: 0.045, burst: 1, burstGap: 0, boltSpeed: 30 },
    heavy: { hp: 150, speed: 5.3, dmg: 5, range: 17, every: [2.8, 3.6], spread: 0.07, burst: 3, burstGap: 0.13, boltSpeed: 28 },
  },
  // who comes when the hero calls: in this order (looks: enemies/mesh.js MODELS · cloth = the unit markings)
  roster: {
    jedi: [
      { name: 'SGT. VANT', role: 'rifle', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f63c4 },
      { name: 'BRISK',     role: 'rifle', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f63c4 },
      { name: 'HAMMER',    role: 'heavy', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f63c4, scale: 1.06 },
      { name: 'TALLY',     role: 'rifle', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f63c4 },
    ],
    mando: [
      { name: 'KORA',  role: 'rifle', model: 'mandalorian', color: 0x5f7a8c, eye: 0xffa040, cloth: 0x7a2a22 },
      { name: 'TEV',   role: 'rifle', model: 'mandalorian', color: 0x7c6a4e, eye: 0xffa040, cloth: 0x2f4a3a },
      { name: 'BRUN',  role: 'heavy', model: 'mandalorian', color: 0x8c8f94, eye: 0xffa040, cloth: 0x3a2a4a, scale: 1.06 },
      { name: 'ARLA',  role: 'rifle', model: 'mandalorian', color: 0x4e6e5a, eye: 0xffa040, cloth: 0x6a5a2a },
    ],
  },
  dmg: { padawan: 1.25, knight: 1, master: 0.8 },   // squad bolt damage by difficulty
  takeDmg: 0.8,              // how hard foes hit a squadmate, against how they hit you
  regen: 5, regenDelay: 5,   // hp a second, once it's gone this long without a hit
  killXp: 0.5,               // share of a kill's XP when a squadmate lands the last blow
  aggroShare: 0.5,           // most of the living fodder that may be on the squad at once
  aggroBy: 3,                // a trooper turns on a squadmate only when it's this much closer than you (m)
  focusFor: 4,               // the squad prefers the trooper you last hit, for this long (s)
  // FOLLOW: each squadmate's spot around you (right, forward), in metres, by its place in the squad. Out to the
  // flanks, not behind you: behind you is where the camera is
  slots: [[-3.4, 0.6], [3.4, 0.6], [-5.8, -1.2], [5.8, -1.2]],
  holdSlots: [[-1.8, 0.4], [1.8, 0.4], [-0.9, -1.6], [0.9, -1.6]],
  leash: 3.0,                // further than this from its spot and it moves
  holdReach: 32,             // how far ahead H can point the hold spot (m)
  downTime: { padawan: 9, knight: 13, master: 18 },   // a downed squadmate gets up on its own after this
  getUpHp: 0.5,              // ...with this share of its health
};

// the revive rules (game/revive.js): who can be downed instead of dying, and how getting up works
export const REVIVE = {
  radius: 2.4,               // how close a reviver must stand
  ally: { time: 1.4 },       // the hero getting a squadmate up
  hero: { time: 3.0, bleed: 12, hp: 0.35, guard: 1.5,   // a squadmate getting the hero up: channel, bleed-out, hp, i-frames after
          revives: { padawan: 2, knight: 1, master: 1 } },   // per wave / mission objective
  hitSlow: 0.6,              // a reviver that's hit loses this much progress (s)
};
