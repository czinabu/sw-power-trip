// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BATTLE SIMULATOR: the sandbox's battle setup, as data. game/battlesim.js runs it and ui/battlesim-ui.js draws it.
// In a paused setup the view rises over the map; you put foes, squadmates and yourself where you want them, press START,
// and the battle plays out with you in it. Edit freely.

import { SANDBOX_FOES } from './sandbox.js';

export const BATTLE_SIM = {
  maxAllies: 8,        // squadmates a set-up battle can field (the regular sandbox panel keeps SQUAD.max)
  maxUnits: 80,        // everything placed, all told (the frame rate's sake)
  slots: 3,            // saved setups, shared by every hero (a setup remembers its map)
  removeR: 2.6,        // right click / X takes back whatever was placed within this of the cursor (m)
  spread: 2.4,         // ×3 and ×5 place a small group this far apart (m)
  // the overhead view: pitch down from level (rad), height range (m: the far end follows the map's size), how fast the
  // view pans (× its height a second) and turns (rad a second), and how far the fog draws back while it's up
  cam: { pitch: 1.0, near: 12, farMul: 1.15, startMul: 0.42, pan: 0.9, turn: 1.6, zoomStep: 1.15, fogMul: 4 },
  colors: { foe: 0xff4a3a, ally: 0x3fb8ff, hero: 0xffd24a },
  // ALLIES: who can stand on your side. `role` is a squad role (data/allies.js SQUAD.roles); the hero's own roster
  // supplies the look (clone troopers for the Jedi and the ARC trooper, Mandalorians for the Mando)
  allies: [
    { id: 'rifle', nm: 'RIFLEMAN' },
    { id: 'heavy', nm: 'HEAVY GUNNER' },
    { id: 'medic', nm: 'MEDIC', only: 'trooper' },
    { id: 'scout', nm: 'SCOUT', only: 'trooper' },
  ],
};

// the palette, in order: you, your side, then every foe the sandbox panel can call in
export const battlePalette = (hero) => [
  { kind: 'hero', id: 'hero', nm: 'YOU' },
  ...BATTLE_SIM.allies.filter(a => !a.only || a.only === hero).map(a => ({ kind: 'ally', id: a.id, nm: a.nm })),
  ...SANDBOX_FOES.map(f => ({ kind: 'foe', id: f.id, nm: f.nm, special: !!f.special })),
];
