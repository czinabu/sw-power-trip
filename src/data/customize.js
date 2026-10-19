// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CHARACTER CUSTOMIZER options: one list of rows per hero, shown top to bottom in the customizer panel.
// Each row offers named options; an option's `set` is a partial look for that hero (appearance.js): parts, palette
// and/or build. The player's choice is saved as { row id: option id }, so renaming a colour value here restyles every
// saved hero, and an option that is removed simply falls back to the row's first one.
//   kind 'color' draws round swatches (`sw` is the swatch colour, or the first palette colour when left out)
//   kind 'part'  draws named chips
// Add an option: append it to a row. Add an outfit piece: write the variant in jedi.js / mando.js, then name it here.

import { mergeLook } from '../player/model/appearance.js';

const pal = (palette) => ({ palette });
const parts = (p) => ({ parts: p });

export const CUSTOMIZE = {
  jedi: [
    { id: 'skin', label: 'SKIN TONE', kind: 'color', options: [
      { id: 'umber',    name: 'Umber',     set: pal({ skin: 0x5c3826 }) },
      { id: 'ebony',    name: 'Ebony',     set: pal({ skin: 0x3f261a }) },
      { id: 'bronze',   name: 'Bronze',    set: pal({ skin: 0x8a5536 }) },
      { id: 'tan',      name: 'Tan',       set: pal({ skin: 0xa86b45 }) },
      { id: 'olive',    name: 'Olive',     set: pal({ skin: 0xc58c64 }) },
      { id: 'sand',     name: 'Sand',      set: pal({ skin: 0xe0ac86 }) },
      { id: 'pale',     name: 'Pale',      set: pal({ skin: 0xf1c9a5 }) },
      { id: 'mirialan', name: 'Mirialan',  set: pal({ skin: 0x8aa66a }) },
      { id: 'pantoran', name: 'Pantoran',  set: pal({ skin: 0x6f9fc8 }) },
      { id: 'zabrak',   name: 'Zabrak',    set: pal({ skin: 0xa8442e }) },
    ] },
    { id: 'hair', label: 'HAIRSTYLE', kind: 'part', options: [
      { id: 'bald',    name: 'Bald',     set: parts({ hair: 'bald' }) },
      { id: 'buzz',    name: 'Buzzed',   set: parts({ hair: 'buzz' }) },
      { id: 'short',   name: 'Short',    set: parts({ hair: 'short' }) },
      { id: 'topknot', name: 'Topknot',  set: parts({ hair: 'topknot' }) },
      { id: 'long',    name: 'Long',     set: parts({ hair: 'long' }) },
      { id: 'braid',   name: 'Padawan',  set: parts({ hair: 'braid' }) },
    ] },
    { id: 'hairColor', label: 'HAIR COLOUR', kind: 'color', options: [
      { id: 'black',  name: 'Black',  set: pal({ hair: 0x140e0a }) },
      { id: 'brown',  name: 'Brown',  set: pal({ hair: 0x3a2414 }) },
      { id: 'auburn', name: 'Auburn', set: pal({ hair: 0x6a2c16 }) },
      { id: 'blond',  name: 'Blond',  set: pal({ hair: 0xb89656 }) },
      { id: 'grey',   name: 'Grey',   set: pal({ hair: 0x85817c }) },
      { id: 'white',  name: 'White',  set: pal({ hair: 0xd8d4cc }) },
    ] },
    { id: 'hood', label: 'HOOD', kind: 'part', options: [
      { id: 'down', name: 'Down', set: parts({ head: 'bald' }) },
      { id: 'up',   name: 'Up',   set: parts({ head: 'hood' }) },
    ] },
    // robe + the tabard panels over it, as one pair so they always go together
    { id: 'robe', label: 'ROBES', kind: 'color', options: [
      { id: 'earth',   name: 'Earth brown', set: pal({ robe: 0x3b2a1e, tabard: 0x5b4331 }) },
      { id: 'umbra',   name: 'Umbra black', set: pal({ robe: 0x17161b, tabard: 0x2c2a31 }) },
      { id: 'ash',     name: 'Ash grey',    set: pal({ robe: 0x4a4b50, tabard: 0x6b6c72 }) },
      { id: 'sand',    name: 'Desert sand', set: pal({ robe: 0x8c7656, tabard: 0xb39d78 }) },
      { id: 'temple',  name: 'Temple blue', set: pal({ robe: 0x1e2a4a, tabard: 0x34466e }) },
      { id: 'forest',  name: 'Forest',      set: pal({ robe: 0x24331f, tabard: 0x3e5236 }) },
      { id: 'crimson', name: 'Crimson',     set: pal({ robe: 0x4a1414, tabard: 0x6e2424 }) },
    ] },
    { id: 'tunic', label: 'TUNIC', kind: 'color', options: [
      { id: 'tan',   name: 'Tan',      set: pal({ tunic: 0x9c7d58 }) },
      { id: 'cream', name: 'Cream',    set: pal({ tunic: 0xd2c4a2 }) },
      { id: 'white', name: 'White',    set: pal({ tunic: 0xe6e2d8 }) },
      { id: 'brown', name: 'Brown',    set: pal({ tunic: 0x7a5c3e }) },
      { id: 'grey',  name: 'Grey',     set: pal({ tunic: 0x6e6a66 }) },
      { id: 'black', name: 'Black',    set: pal({ tunic: 0x2e2a28 }) },
    ] },
    { id: 'build', label: 'BUILD', kind: 'part', options: [
      { id: 'standard', name: 'Standard', set: { build: { bulk: 1, shoulders: 1 } } },
      { id: 'lean',     name: 'Lean',     set: { build: { bulk: 0.9, shoulders: 0.94 } } },
      { id: 'broad',    name: 'Broad',    set: { build: { bulk: 1.1, shoulders: 1.07 } } },
    ] },
  ],

  mando: [
    { id: 'helmet', label: 'HELMET', kind: 'part', options: [
      { id: 'tvisor', name: 'Hunter',  set: parts({ helmet: 'tvisor' }) },
      { id: 'clean',  name: 'Classic', set: parts({ helmet: 'clean' }) },
      { id: 'crest',  name: 'Crested', set: parts({ helmet: 'crest' }) },
    ] },
    { id: 'shoulders', label: 'SHOULDERS', kind: 'part', options: [
      { id: 'pauldrons', name: 'Pauldrons', set: parts({ arms: 'pauldrons' }) },
      { id: 'heavy',     name: 'Heavy',     set: parts({ arms: 'heavy' }) },
      { id: 'bare',      name: 'Scout',     set: parts({ arms: 'bare' }) },
    ] },
    { id: 'cape', label: 'CAPE', kind: 'part', options: [
      { id: 'half', name: 'Half',  set: parts({ cape: 'half' }) },
      { id: 'full', name: 'Full',  set: parts({ cape: 'full' }) },
      { id: 'none', name: 'None',  set: parts({ cape: 'none' }) },
    ] },
    // main plates + the darker secondary plates, as one scheme
    { id: 'armor', label: 'ARMOUR', kind: 'color', options: [
      { id: 'beskar',  name: 'Beskar',      set: pal({ beskar: 0x9aa7b5, beskar2: 0x667381 }) },
      { id: 'gunmetal',name: 'Gunmetal',    set: pal({ beskar: 0x5c636c, beskar2: 0x3b4048 }) },
      { id: 'fett',    name: 'Hunter green',set: pal({ beskar: 0x5f6e45, beskar2: 0x7e4428 }) },
      { id: 'watch',   name: 'Death Watch', set: pal({ beskar: 0x3e5f8a, beskar2: 0xaab4c0 }) },
      { id: 'clan',    name: 'Clan red',    set: pal({ beskar: 0x8a2a26, beskar2: 0x4a4f58 }) },
      { id: 'gold',    name: 'Gold',        set: pal({ beskar: 0xc9a24a, beskar2: 0x76664a }) },
      { id: 'white',   name: 'Ivory',       set: pal({ beskar: 0xd6dbe0, beskar2: 0x8a929b }) },
      { id: 'shadow',  name: 'Shadow',      set: pal({ beskar: 0x2c2f35, beskar2: 0x1b1d21 }) },
    ] },
    { id: 'accent', label: 'ACCENT', kind: 'color', options: [
      { id: 'rust',   name: 'Rust',   set: pal({ accent: 0xb84327 }) },
      { id: 'blue',   name: 'Blue',   set: pal({ accent: 0x2f6b8a }) },
      { id: 'gold',   name: 'Gold',   set: pal({ accent: 0xc9a24a }) },
      { id: 'green',  name: 'Green',  set: pal({ accent: 0x4f7a3a }) },
      { id: 'violet', name: 'Violet', set: pal({ accent: 0x6a3a8a }) },
      { id: 'white',  name: 'White',  set: pal({ accent: 0xd8dde2 }) },
      { id: 'black',  name: 'Black',  set: pal({ accent: 0x1f2126 }) },
    ] },
    { id: 'suit', label: 'FLIGHT SUIT', kind: 'color', options: [
      { id: 'charcoal', name: 'Charcoal', set: pal({ suit: 0x2e343d }) },
      { id: 'brown',    name: 'Brown',    set: pal({ suit: 0x4a3a2a }) },
      { id: 'olive',    name: 'Olive',    set: pal({ suit: 0x3c4230 }) },
      { id: 'navy',     name: 'Navy',     set: pal({ suit: 0x222b40 }) },
      { id: 'black',    name: 'Black',    set: pal({ suit: 0x16171a }) },
    ] },
    { id: 'cloth', label: 'CAPE COLOUR', kind: 'color', options: [
      { id: 'sand',  name: 'Sand',     set: pal({ cloth: 0x7b6b52 }) },
      { id: 'black', name: 'Black',    set: pal({ cloth: 0x1e1d20 }) },
      { id: 'red',   name: 'Red',      set: pal({ cloth: 0x6a1d1a }) },
      { id: 'grey',  name: 'Grey',     set: pal({ cloth: 0x5a5a5e }) },
      { id: 'blue',  name: 'Blue',     set: pal({ cloth: 0x27385a }) },
    ] },
    { id: 'build', label: 'BUILD', kind: 'part', options: [
      { id: 'standard', name: 'Standard', set: { build: { bulk: 1, shoulders: 1 } } },
      { id: 'lean',     name: 'Lean',     set: { build: { bulk: 0.92, shoulders: 0.95 } } },
      { id: 'heavy',    name: 'Heavy',    set: { build: { bulk: 1.12, shoulders: 1.08 } } },
    ] },
  ],
};

// the option a row has picked (its first one when nothing, or an unknown id, was saved)
export function pickedOption(row, picks = {}){
  return row.options.find(o => o.id === picks[row.id]) || row.options[0];
}

// picks { jedi: { rowId: optionId }, mando: {...} } → a look (appearance.js) holding just what the options set
export function lookFromPicks(picks = {}){
  const look = {};
  for (const hero in CUSTOMIZE){
    let h = {};
    for (const row of CUSTOMIZE[hero]) h = mergeLook(h, pickedOption(row, picks[hero]).set);
    look[hero] = h;
  }
  return look;
}

// the swatch colour for a colour option
export const swatchOf = o => o.sw ?? Object.values(o.set.palette || {})[0];
