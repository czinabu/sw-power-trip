// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DIFFS: difficulty presets and their HP/damage multipliers.

import { G } from '../state.js';

// DIFFICULTY — a single pair of global multipliers (enemy durability + the damage you take). Knight = the tuned default.
export const DIFFS = { padawan:{ hp:0.72, dmg:0.65 }, knight:{ hp:1, dmg:1 }, master:{ hp:1.45, dmg:1.4 } };
export function diffHpMul(){ return (DIFFS[G.diff] || DIFFS.knight).hp; }
export function diffDmgMul(){ return (DIFFS[G.diff] || DIFFS.knight).dmg; }
