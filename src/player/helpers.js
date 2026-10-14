// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shortcuts: forward/right vectors, player position, current stance, max HP.

import { CFG } from '../data/config.js';
import { STANCES } from '../data/stances.js';
import { V3 } from '../utils.js';
import { G, player } from '../state.js';

export const fwd = () => V3(Math.sin(G.yaw), 0, Math.cos(G.yaw));
export const rightV = () => V3(-Math.cos(G.yaw), 0, Math.sin(G.yaw));
export const playerPos = () => player.group.position;
// the Mando's darksaber drives its OWN stance; otherwise it's the Jedi's selected form
export const stance = () => (G.hero === 'mando' && player.weapon === 'darksaber') ? STANCES.darksaber : STANCES[G.stance];
export const maxHp = () => CFG.player.maxHp + (player.up.hpMax || 0);   // includes skill-tree Vitality
