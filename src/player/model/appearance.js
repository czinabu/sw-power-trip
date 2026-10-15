// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The LOOK: everything a character creator would change, as plain data.
//   style    — render style (styles.js): 'ink' is the game's look; 'shard' and 'forged' stay for comparison
//   parts    — one variant name per outfit slot (jedi.js / mando.js list what each slot offers)
//   palette  — colour per material name (hex); anything left out uses the default below
//   build    — proportions: bulk (limb thickness), shoulders (chest width), head (head size). Joint positions never
//              change, so animations and hitboxes stay identical whatever the build.
//   seams    — the Mando's glowing armour lines (VFX can pulse these later)
// Looks are merged over DEFAULT_LOOK, so a saved look only needs what differs.

export const DEFAULT_LOOK = {
  style: 'ink',
  jedi: {
    parts: { legs: 'boots', waist: 'panels', torso: 'tunic', head: 'bald', arms: 'sleeves' },
    palette: {
      robe: 0x3b2a1e, tunic: 0x9c7d58, tabard: 0x5b4331, leather: 0x23170f,
      skin: 0x5c3826, hair: 0x140e0a, boot: 0x1a120c, trim: 0xb08a4a,
    },
    build: { bulk: 1, shoulders: 1, head: 1 },
  },
  mando: {
    parts: { legs: 'armored', torso: 'cuirass', arms: 'pauldrons', helmet: 'tvisor', cape: 'half', jetpack: 'standard' },
    palette: {
      beskar: 0x9aa7b5, beskar2: 0x667381, suit: 0x2e343d, accent: 0xb84327,
      visor: 0x07090c, cloth: 0x7b6b52, strap: 0x3a2e22,
    },
    build: { bulk: 1, shoulders: 1, head: 1 },
    seams: true,
  },
};

// sample looks: proof that the slots, palette and build all swap cleanly (the model lab can show them)
export const SAMPLE_LOOKS = {
  hooded: {
    jedi: { parts: { head: 'hood', waist: 'long' }, palette: { robe: 0x2a2724, tunic: 0xc9b48f, skin: 0xc58c64 }, build: { bulk: 0.92, shoulders: 0.95 } },
    mando: { parts: { arms: 'bare', cape: 'full' }, palette: { beskar: 0x8b5a3c, beskar2: 0x4f3a2c, accent: 0x2f6b8a, cloth: 0x4a4038 }, build: { bulk: 1.12, shoulders: 1.08 } },
  },
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over){
  const out = { ...base };
  for (const k in over) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}
export const resolveLook = (look = {}) => merge(DEFAULT_LOOK, look);
