// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORM BALANCE — prints each lightsaber form's raw numbers from data/stances.js: damage a second (dmg × speed), the same
// on armour (× heavyDmg), stamina a second, damage per stamina and the swing's arc. Run: node tools/form-balance.mjs
// (Each form's own edge, such as Makashi's +40% on blades or Juyo's fury, comes on top: see the BALANCE note there.)
import { readFileSync } from 'fs';

const src = readFileSync(new URL('../src/data/stances.js', import.meta.url), 'utf8');
const re = /^\s{2}(\w+):\s*\{ name: '[^']+'[\s\S]*?dmg: ([\d.]+), heavyDmg: ([\d.]+), speed: ([\d.]+), knock: [\d.]+, stamina: (\d+)[\s\S]*?radiusMult: ([\d.]+)/gm;
console.log('form       dps  armour  stam/s  dmg/stam  arc');
for (const [, id, d, h, s, st, r] of src.matchAll(re))
  console.log(id.padEnd(9), (d * s).toFixed(2).padStart(5), (h * d * s).toFixed(2).padStart(7), (st * s).toFixed(1).padStart(7),
              (d / st).toFixed(3).padStart(9), r.padStart(5));
