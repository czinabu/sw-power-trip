// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shortcuts: forward/right vectors, player position, current stance, max HP.

import { CFG } from '../data/config.js';
import { STANCES } from '../data/stances.js';
import { formGrip } from '../data/forms.js';
import { V3 } from '../utils.js';
import { G, player, isGunner } from '../state.js';

export const fwd = () => V3(Math.sin(G.yaw), 0, Math.cos(G.yaw));
export const rightV = () => V3(-Math.cos(G.yaw), 0, Math.sin(G.yaw));
export const playerPos = () => player.group.position;
// the Mando's darksaber drives its OWN stance; otherwise it's the Jedi's selected form
export const stance = () => (isGunner() && player.weapon === 'darksaber') ? STANCES.darksaber : STANCES[G.stance];
// the grip the saber is held in: the Jedi's form decides when it has its own (Shien: reverse), else the preference
export const heldGrip = () => isGunner() ? G.saberGrip : formGrip(G.stance, G.saberGrip);
// the colour of the Jedi's blade itself: the crystal picked in the customizer, else the form's colour
export const bladeColor = (st = STANCES[G.stance]) => player.look?.jedi?.saber ?? st.blade;
// the Jedi's Force hits harder with the saber holstered: all his focus is on it (CFG.holster.power)
export const forcePower = () => !isGunner() && player.holstered ? CFG.holster.power : 1;
export const maxStam = () => CFG.player.maxStam + (player.up.maxStam || 0);   // includes the ENDURANCE / GRIT upgrades
export const maxHp = () => CFG.player.maxHp + (player.up.hpMax || 0);   // includes skill-tree Vitality
