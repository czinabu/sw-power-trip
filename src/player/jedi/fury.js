// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FURY — Form VII's edge (Juyo, Vaapad). Juyo feeds it with every cut that lands; Vaapad with every blow it turns on
// its guard. Fury makes each cut land harder (STANCES furyDmg at full) and drains away when the pressure stops.
// Switching to a form without fury empties it.

import { G, player } from '../../state.js';
import { stance } from '../helpers.js';
import { floater } from '../../fx/floaters.js';
import { playerPos } from '../helpers.js';

const HOLD = 2.0, DRAIN = 0.2;   // seconds fury holds after the last feed, then the share lost per second

const furyForm = () => G.hero !== 'mando' && stance() && stance().furyDmg;
export function addFury(amt){
  if (!furyForm() || !(amt > 0)) return;
  const was = player.fury || 0;
  player.fury = Math.min(1, was + amt); player.furyAt = G.gt;
  if (was < 1 && player.fury >= 1) floater(playerPos(), 'FURY', '#ff5a3a');
}
// × on saber damage
export const furyMul = () => furyForm() ? 1 + (player.fury || 0) * (stance().furyDmg - 1) : 1;
export function updateFury(dt){
  if (!player.fury) return;
  if (!furyForm()){ player.fury = 0; return; }
  if (G.gt - (player.furyAt || 0) > HOLD) player.fury = Math.max(0, player.fury - DRAIN * dt);
}
