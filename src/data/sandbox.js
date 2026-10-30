// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SANDBOX: each hero's room, the foes its panel can call in, and every ability it can hand out or take away.
// game/sandbox.js runs the mode and ui/sandbox-ui.js draws the panel from these lists; edit freely.

import { ENEMY_TYPES } from './enemies.js';
import { G, player } from '../state.js';
import { switchWeapon } from '../player/mando/weapons.js';
import { applyJetTier, applyCellTier } from '../game/progression.js';
import { BATTLE_MAPS } from './battlemaps.js';
import { kitTier } from '../game/sandbox-unlocks.js';

// each hero's room: the Jedi train in the temple's training room, the Mandalorian in the throne room at Sundari
/* ARENAS — the panel's map row: the hero's own room, or any battle map (data/battlemaps.js) to try big fights on */
export const SANDBOX_MAPS = [{ id: 'room', nm: { jedi: 'TRAINING ROOM', mando: 'THRONE ROOM' } },
  ...Object.values(BATTLE_MAPS).map(m => ({ id: m.id, nm: m.short }))];

export const SANDBOX_LEVELS = {
  jedi:  { name: 'SANDBOX — THE TRAINING ROOM', sub: 'No waves, no clock. Press B to call in foes and choose your powers.',
           arena: 48, floor: 0x6a3020, fog: 0x2a1a14, sky: 0x1a0e0a, layout: 'dojo', waves: [], hazards: {} },
  mando: { name: 'SANDBOX — THE THRONE ROOM', sub: 'No waves, no clock. Press B to call in foes and choose your gear.',
           arena: 48, floor: 0x3a4c46, fog: 0x1e2826, sky: 0x10161a, layout: 'throne', waves: [], hazards: {} },
};

/* FOES — every regular enemy type (data/enemies.js) in the order the panel lists them, with the names the game
   already uses for them; a new type shows up on its own under its key. Two specials close the list: the Warbringer
   mid-boss and the hero's end-boss (only one boss at a time). */
const FOE_NAMES = {
  grunt: 'TROOPER', blaster: 'BLASTER TROOPER', officer: 'OFFICER', lancer: 'PURGE LANCER', phalanx: 'SENTINEL',
  duelist: 'MAGNAGUARD', acolyte: 'SITH ACOLYTE', brute: 'BRUTE', flyer: 'JET TROOPER', sniper: 'MARKSMAN',
  grenadier: 'GRENADIER', bomber: 'SABOTEUR',
};
export const SANDBOX_FOES = [
  ...Object.keys(FOE_NAMES).filter(k => ENEMY_TYPES[k]),
  ...Object.keys(ENEMY_TYPES).filter(k => !FOE_NAMES[k]),
].map(k => ({ id: k, nm: FOE_NAMES[k] || k.toUpperCase() }))
 .concat([{ id: 'warbringer', nm: 'WARBRINGER', special: true }, { id: 'boss', nm: { jedi: 'DARTH VEXIS', mando: 'THE IRON MAGISTRATE' }, special: true }]);
export const SANDBOX_COUNTS = [1, 3, 5];

/* KIT — what each hero can switch on or off. The starting kit (saber, block, Push and dash; single blaster, brace)
   is always on. Rows that share a key (`slot`) can't both be on: picking one switches its partner off, the same
   pairs the XP store makes you choose between. `needs` hides a row until another one is on.
   Before the campaign is beaten a row shows only once the story has reached it (game/sandbox-unlocks.js): `from` names
   the auto-unlock key or XP-store id that hands it out in the campaign (the row's own id when left out), and `tiers`
   the auto-unlock keys of a tiered power, lowest first, so the row gives the highest tier reached. */
const ROMAN = ['', 'I', 'II', 'III'];
// a tiered row's name carries the tier it gives, e.g. JETPACK BOOSTER II
const tiered = (base) => function(){ return base + ' ' + ROMAN[kitTier(this)]; };
const flag = (k) => ({ has: () => !!G.unlocked[k], set: (on) => { G.unlocked[k] = on; } });
const weapon = (id, k) => ({ has: () => id === 'darksaber' ? !!player.up.darksaber : !!G.unlocked[k],
  set: (on) => {
    if (id === 'darksaber'){ player.up.darksaber = on; G.unlocked.dark = on; } else G.unlocked[k] = on;
    if (on) switchWeapon(id); else if (player.weapon === id) switchWeapon('single');
  } });

export const SANDBOX_KIT = {
  jedi: [
    { id: 'fj',        nm: tiered('FORCE JUMP'), key: 'HOLD SPACE', tiers: ['fj1', 'fj2'],
      has: () => (player.up.fjTier || 0) >= 1, set(on){ player.up.fjTier = on ? kitTier(this) : 0; } },
    { id: 'pull',      nm: 'FORCE PULL',       key: 'C',        ...flag('pull') },
    { id: 'graspMulti', nm: "DARK LORD'S GRIP", key: 'HOLD C', needs: 'pull',
      has: () => !!player.up.graspMulti, set: (on) => { player.up.graspMulti = on; } },
    { id: 'throw',     nm: 'SABER THROW',      key: 'RMB+LMB',  ...flag('throw') },
    { id: 'barrier',   nm: 'FORCE BARRIER',    key: 'V',        ...flag('barrier') },
    { id: 'slam',      nm: 'JUMP ATTACK',      key: 'X', from: 'jslam', ...flag('slam') },
    { id: 'mend',      nm: 'FORCE MEND',       key: 'X',        ...flag('mend') },
    { id: 'judge',     nm: 'FORCE JUDGEMENT',  key: 'R', slot: 'ult', ...flag('judge') },
    { id: 'repulse',   nm: 'FORCE REPULSE',    key: 'R', slot: 'ult', ...flag('repulse') },
    { id: 'judgeUp',   nm: 'STORM OF JUDGEMENT', key: 'R', needs: 'judge',
      has: () => !!player.up.judgeUp, set: (on) => { player.up.judgeUp = on; } },
    { id: 'repulseUp', nm: 'FORCE NOVA',       key: 'R', needs: 'repulse',
      has: () => !!player.up.repulseUp, set: (on) => { player.up.repulseUp = on; } },
  ],
  mando: [
    { id: 'dual',       nm: 'DUAL BLASTERS',   key: '2',        ...weapon('dual', 'dual') },
    { id: 'disruptor',  nm: 'DISRUPTOR RIFLE', key: '3', slot: 'wpn', ...weapon('disruptor', 'disruptor') },
    { id: 'darksaber',  nm: 'THE DARKSABER',   key: '3', slot: 'wpn', ...weapon('darksaber') },
    { id: 'jet',        nm: tiered('JETPACK BOOSTER'), key: 'SPACE', tiers: ['jet1', 'jet2'], has: () => (player.up.jetTier || 0) >= 1,
      set(on){ player.up.jetTier = on ? kitTier(this) : 0; applyJetTier(); player.jet = player.jetMax; } },
    { id: 'cells',      nm: tiered('POWER CELLS'), key: 'LMB', tiers: ['cells1', 'cells2', 'cells3'], has: () => (player.up.cellTier || 0) >= 1,
      set(on){ player.up.cellTier = on ? kitTier(this) : 0; applyCellTier(); } },
    { id: 'rocket',     nm: 'WRIST ROCKET',    key: 'Q',        ...flag('rocket') },
    { id: 'flame',      nm: 'FLAMETHROWER',    key: 'F',        ...flag('flame') },
    { id: 'grapple',    nm: 'GRAPPLING HOOK',  key: 'X', slot: 'x', ...flag('grapple') },
    { id: 'mslam',      nm: 'JETPACK SLAM',    key: 'X', slot: 'x', ...flag('slam') },
    { id: 'birds',      nm: 'WHISTLING BIRDS', key: 'V', slot: 'v', ...flag('birds') },
    { id: 'deto',       nm: 'THERMAL DETONATOR', key: 'V', slot: 'v', ...flag('deto') },
    { id: 'bacta',      nm: 'BACTA STIM',      key: 'G',        ...flag('bacta') },
    { id: 'jetmissile', nm: 'JETPACK MISSILE', key: 'Z',        ...flag('jetmissile') },
  ],
};
