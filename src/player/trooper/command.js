// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARC TROOPER'S COMMAND POINTS (testing only): earned in the fight (kills, the squad's kills), spent on the orders
// that matter (ATTACK, GRENADE, SUPPRESS on the command wheel) and on the battlefield calls (T: allies/calls.js).
// The tuning is data/trooper.js TROOPER.command. Only state and data here, so the squad and the damage code can both
// reach it without a loop.

import { G, player, isTrooper } from '../../state.js';
import { TROOPER } from '../../data/trooper.js';
import { showBanner } from '../../ui/banners.js';
import { sfx } from '../../audio/sfx.js';

const C = TROOPER.command;
export const cpMax = () => C.max;
export function commandPoints(){
  if (player.cp == null) player.cp = C.start;
  return player.cp;
}
export function resetCommand(){ player.cp = C.start; player.cpFlash = 0; }
// a kill: `kind` is 'kill', 'elite' or 'squadKill' (enemies/damage.js)
export function gainCP(kind){
  if (!isTrooper() || G.mode !== 'play') return;
  player.cp = Math.min(C.max, commandPoints() + (C.gain[kind] || 0));
}
// what an order costs the trooper (0: free, and always 0 for the other heroes)
export const orderCost = (id) => isTrooper() ? (C.cost[id] || 0) : 0;
// can it be paid? Says so on screen when it can't
export function canPay(cost, what){
  if (!cost || commandPoints() >= cost) return true;
  showBanner('', (what ? what + ' · ' : '') + 'NEEDS ' + cost + ' CP (' + Math.floor(commandPoints()) + ')', 0.9);
  sfx(160, 0.08, 'square', 0.03, 120);
  player.cpFlash = G.gt;
  return false;
}
export function spendCP(cost){ if (cost) player.cp = Math.max(0, commandPoints() - cost); }
