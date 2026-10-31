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
    // the clone trooper's own fire team (testing): the same brothers who fight beside the Jedi, in the legion's blue,
    // now the trooper's band of deserters
    trooper: [
      { name: 'SGT. VANT', role: 'rifle', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f7fd6 },
      { name: 'BRISK',   role: 'rifle', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f7fd6 },
      { name: 'HAMMER', role: 'heavy', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f7fd6, scale: 1.06 },
      { name: 'TALLY',   role: 'rifle', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f7fd6 },
    ],
  },
  dmg: { padawan: 1.25, knight: 1, master: 0.8 },   // squad bolt damage by difficulty
  takeDmg: 0.8,              // how hard foes hit a squadmate, against how they hit you
  regen: 5, regenDelay: 5,   // hp a second, once it's gone this long without a hit
  killXp: 0.5,               // share of a kill's XP when a squadmate lands the last blow
  aggroShare: 0.65,          // most of the living fodder that may be on the squad at once
  aggroBy: 1.5,              // a trooper turns on a squadmate only when it's this much closer than you (m)
  aggroReach: 10,            // ...and only if the squadmate is within its weapon's range plus this (m)
  avengeFor: 4,              // a trooper hit by a squadmate's bolt wants that squadmate for this long (s), nearer or not
  focusFor: 4,               // the squad prefers the trooper you last hit, for this long (s)
  // FOLLOW: each squadmate's spot around you (right, forward), in metres, by its place in the squad. Out to the
  // flanks, not behind you: behind you is where the camera is
  slots: [[-3.4, 0.6], [3.4, 0.6], [-5.8, -1.2], [5.8, -1.2]],
  holdSlots: [[-1.8, 0.4], [1.8, 0.4], [-0.9, -1.6], [0.9, -1.6]],
  leash: 3.0,                // further than this from its spot and it moves
  tightSlots: [[-1.7, 0.2], [1.7, 0.2], [-2.6, -1.4], [2.6, -1.4]],   // STACK UP: the same spots, pulled in close
  holdReach: 32,             // how far ahead H can point the hold spot (m)
  moveSpread: { wide: 1, tight: 0.45 },     // MOVE THERE: how far apart they stand round the point (× holdSlots), by formation
  downTime: { padawan: 9, knight: 13, master: 18 },   // a downed squadmate gets up on its own after this
  getUpHp: 0.5,              // ...with this share of its health
};

/* ORDERS — tap H for the smart order (on a trooper: attack it · on open ground: move there · away from you: on me);
   hold H for the command wheel (allies/wheel.js): the world slows, point at an order and let go. While the wheel is open,
   1-4 (the D-pad on a pad) picks one squadmate instead of the whole squad. `at` is the wheel's clock position. */
export const ORDERS = [
  { id: 'follow',    name: 'ON ME',          note: 'Form up on you',                              icon: '◎' },
  { id: 'move',      name: 'MOVE THERE',     note: 'Go to the crosshair and hold it',             icon: '➤' },
  { id: 'attack',    name: 'ATTACK TARGET',  note: 'Everyone fires on the foe under the crosshair', icon: '✛' },
  { id: 'grenade',   name: 'GRENADE',        note: 'A detonator onto the crosshair',              icon: '✸' },
  { id: 'revive',    name: 'GET THEM UP',    note: 'The nearest squadmate revives a downed one',  icon: '✚' },
  { id: 'formation', name: 'SPREAD / STACK', note: 'Wide formation, or tight on you',             icon: '⇔' },
  { id: 'cover',     name: 'TAKE COVER',     note: 'Behind the nearest wall: hit less, fire slower', icon: '▙' },
  { id: 'hold',      name: 'HOLD HERE',      note: 'Stop where they stand',                       icon: '■' },
];
// the ARC trooper's wheel (testing): SUPPRESS takes SPREAD / STACK's place (the trooper's squad stays spread)
export const SUPPRESS_ORDER = { id: 'suppress', name: 'SUPPRESS', note: 'Pin the foes round the crosshair: they slow and hold their fire', icon: '≋' };
export const TROOPER_ORDERS = ORDERS.map(o => o.id === 'formation' ? SUPPRESS_ORDER : o);
export const ordersFor = (trooper) => trooper ? TROOPER_ORDERS : ORDERS;
export const COMMAND = {
  tapTime: 0.22,             // H held longer than this (real seconds) opens the wheel
  slowmo: 0.3,               // the world's speed while the wheel is open (your own; a co-op partner plays on)
  markElites: true,          // ATTACK TARGET on a duellist or brute: the squad chips at it (bosses stay yours)
  markEliteDmg: 0.35,        // ...at this share of their bolt damage
  markFor: 12,               // an attack order lasts this long, or until the target falls (s)
  markChase: 0.8,            // out of reach or sight of the mark: close to this share of their range
  grenadeCd: 20,             // GRENADE cooldown (s), shared by the squad
  grenadeReach: 24,          // the furthest a squadmate throws (m)
  grenade: { blastR: 4.2, fuse: 1.0, dmg: 0 },   // the throw (enemies/grenades.js; friendly: foes only)
  coverTake: 0.5,            // TAKE COVER: share of damage a squadmate in cover takes
  coverFire: 1.35,           // ...and its time between shots, stretched
  coverSearch: 9,            // how far from where it stands it looks for cover (m)
  coverEvery: 2.5,           // it re-checks its cover this often, as the fight moves (s)
};

// the revive rules (game/revive.js): who can be downed instead of dying, and how getting up works
export const REVIVE = {
  radius: 2.4,               // how close a reviver must stand
  ally: { time: 1.4 },       // the hero getting a squadmate up
  hero: { time: 3.0, bleed: 12, hp: 0.35, guard: 1.5,   // a squadmate getting the hero up: channel, bleed-out, hp, i-frames after
          revives: { padawan: 2, knight: 1, master: 1 } },   // per wave / mission objective
  hitSlow: 0.6,              // a reviver that's hit loses this much progress (s)
};
