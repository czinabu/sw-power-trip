// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DIFFS: difficulty presets: how tough foes are, how hard they hit, how readable they are, how forgiving a retry is.

import { G } from '../state.js';

/* DIFFICULTY — Knight is the tuned default. A preset scales more than numbers: an easier one also gives longer
   enemy tells and wider timing windows, so a casual player can actually land the parries and dodges the game is
   built around (on the same feel, just more forgiving), while Master keeps the windows and shortens the tells.
     hp     enemy durability          dmg     damage you take
     tell   enemy wind-up length      window  seconds added to the parry, vambrace catch and perfect-dodge windows
     bossCheckpoint  dying to a boss retries the boss, not the whole level */
export const DIFFS = {
  padawan:{ hp:0.72, dmg:0.6, tell:1.25, window:0.06, bossCheckpoint:true },
  knight: { hp:1,    dmg:1,   tell:1,    window:0,    bossCheckpoint:true },
  master: { hp:1.45, dmg:1.4, tell:0.88, window:0,    bossCheckpoint:false },
};
const diff = () => DIFFS[G.diff] || DIFFS.knight;
export function diffHpMul(){ return diff().hp; }
export function diffDmgMul(){ return diff().dmg; }
export function diffTellMul(){ return diff().tell; }
export function diffWindow(){ return diff().window; }
export function diffBossCheckpoint(){ return diff().bossCheckpoint; }

/* MASTERY XP — clean play pays. A casual run still earns every wave-clear payout; these sit on top of it.
   Each skilled answer earns a small bounty (×1–3 with the kill streak, like a kill), and a wave cleared
   without taking a hit pays a large bonus on the wave-clear XP. Store and mastery stages still gate WHEN
   things can be bought, so faster XP means owning the build sooner, not breaking the unlock order. */
export const MASTERY_XP = {
  parry: 6, perfectDodge: 5, clash: 3, catch: 5, riposte: 4,   // per skilled answer to a melee blow...
  boltParry: 2,      // ...and a timed parry sending a bolt back (far more common, so it pays less)
  flawless: 0.5,     // wave cleared without taking damage: +50% of the wave-clear XP...
  clean: 0.2,        // ...or taking under `cleanHp` of max vitality: +20%
  cleanHp: 0.25,
};
