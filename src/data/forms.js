// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORMS: the seven lightsaber forms as the progression sees them (lore order, prerequisites, variants), and the
// three-slot form LOADOUT that keys 1 / 2 / 3 and the mouse wheel switch between.

/* THE SEVEN FORMS — lore order and lineage (Wookieepedia, canon and Legends). Each form was made to cover an earlier
   one's gap, which gives the unlock tree:
     I Shii-Cho is where every initiate starts · II Makashi (blade duels) and III Soresu (blaster defence) grew from it ·
     IV Ataru builds on Makashi's offence · V grew out of Soresu and splits into Shien (reverse grip, bolts sent home)
     and Djem So (block then riposte) · VI Niman synthesises I–V (needs `anyOf` forms first) · VII is for masters of
     several forms and forks for good into Juyo or Vaapad.
   no       the form's numeral                     name / tag   HUD chip text (name over a one-word role)
   needs    forms that must be known first          anyOf        how many earlier forms must be known (Niman, VII)
   variant  Form V / VII: the variants share a numeral; `fork` = picking one locks the other for the run
   grip     the form's own saber grip. Shien is the reverse-grip form; the other forms are forward-grip forms in canon and
            hold a regular grip. Only Niman, the form that borrows from every other, has none: it takes the hero's grip
            preference (Settings / G), so its reverse guard is the Starkiller-style one
   ready    has a stance in data/stances.js and can be slotted. The rest are planned (roadmap: Seven forms) and stay out
            of every loadout until their stance lands. */
export const FORMS = {
  shiicho: { no: 'I',   name: 'SHII-CHO', tag: 'CROWDS',   needs: [], ready: true, grip: 'regular' },
  makashi: { no: 'II',  name: 'MAKASHI',  tag: 'DUELS',    needs: ['shiicho'], ready: true, grip: 'regular' },
  soresu:  { no: 'III', name: 'SORESU',   tag: 'DEFENCE',  needs: ['shiicho'], ready: true, grip: 'regular' },
  ataru:   { no: 'IV',  name: 'ATARU',    tag: 'FAST',     needs: ['makashi'], ready: true, grip: 'regular' },
  djemso:  { no: 'V',   name: 'DJEM SO',  tag: 'STRONG',   needs: ['soresu'], variant: 'v', ready: true, grip: 'regular' },
  shien:   { no: 'V',   name: 'SHIEN',    tag: 'REDIRECT', needs: ['soresu'], variant: 'v', ready: true, grip: 'reverse' },
  niman:   { no: 'VI',  name: 'NIMAN',    tag: 'BALANCED', needs: [], anyOf: 4, ready: true },
  juyo:    { no: 'VII', name: 'JUYO',     tag: 'FURY',     needs: [], anyOf: 5, variant: 'vii', fork: true, ready: true, grip: 'regular' },
  vaapad:  { no: 'VII', name: 'VAAPAD',   tag: 'CONTROL',  needs: [], anyOf: 5, variant: 'vii', fork: true, ready: true, grip: 'regular' },
};

/* THE LOADOUT — three slots on 1 / 2 / 3 (and the wheel). A slot holds a form id or null (an empty slot is skipped).
   DEFAULT_LOADOUT is the training grounds' and the missions' fallback; a campaign or survival run starts on RUN_LOADOUT,
   with the forms every Knight already knows, and grows as the run teaches more (game/meditation.js). */
export const LOADOUT_SLOTS = 3;
export const DEFAULT_LOADOUT = ['ataru', 'niman', 'djemso'];
export const STARTING_FORMS = ['niman', 'shiicho'];   // the hero's own form, and Form I, which every Jedi learns first
export const RUN_LOADOUT = ['niman', 'shiicho', null];

/* THE PATH — where a run learns each form (the auto-unlocks in data/store.js are built from this).
   chapter  the campaign chapter whose clear teaches it (data/campaign.js): the trials are the masters who teach
   level / wave   the same point for a run that plays the levels straight through (no chapters)
   stage    survival and the missions: the run's depth (waveTotal)
   Form V's two variants come together from the Knight (G swaps them). Form VII is a fork: the run offers both and the
   hero keeps one. */
export const FORM_PATH = [
  { form: 'makashi', chapter: 'archive',       level: 0, wave: 4, stage: 2 },   // the archive's duelling holocrons
  { form: 'soresu',  chapter: 'trial-first',   level: 1, wave: 0, stage: 3 },   // the Wall
  { form: 'ataru',   chapter: 'trial-acrobat', level: 1, wave: 1, stage: 5 },   // the Acrobat
  { form: 'djemso',  chapter: 'trial-knight',  level: 1, wave: 2, stage: 6 },   // the Knight: Form V…
  { form: 'shien',   chapter: 'trial-knight',  level: 1, wave: 2, stage: 6 },   // …both its variants
  { form: 'juyo',    chapter: 'chase',         level: 2, wave: 0, stage: 9 },   // Form VII, offered after the chase
  { form: 'vaapad',  chapter: 'chase',         level: 2, wave: 0, stage: 9 },
];
// the run's Form VII choice locks the other for good: G.formFork holds the one kept
export const forkClosed = (id, kept) => !!(FORMS[id] && FORMS[id].fork && kept && kept !== id);

// saves and settings from before the forms had their own ids called them by weight
const LEGACY_FORM = { fast: 'ataru', medium: 'niman', strong: 'djemso' };
export const migrateForm = (id) => LEGACY_FORM[id] || id;

// a loadout as stored or handed in → exactly LOADOUT_SLOTS entries, each a ready form or null, no form twice, and one
// variant of a numeral at most (Djem So or Shien in the Form V slot: G swaps between them)
export function cleanLoadout(list){
  const out = [], seen = new Set();
  for (let i = 0; i < LOADOUT_SLOTS; i++){
    const id = migrateForm(list && list[i]);
    const ok = !!(id && FORMS[id] && FORMS[id].ready && !seen.has(id) && !(FORMS[id].variant && seen.has('#' + FORMS[id].variant)));
    if (ok){ seen.add(id); if (FORMS[id].variant) seen.add('#' + FORMS[id].variant); }
    out.push(ok ? id : null);
  }
  return out;
}

// the grip the saber is held in right now: the form's own, else the hero's preference (Niman only: Settings / G)
export const formGrip = (id, pref) => (FORMS[id] && FORMS[id].grip) || (pref === 'reverse' ? 'reverse' : 'regular');
// the other variant of the same numeral that the hero knows (Djem So ⇄ Shien), or null
export const otherVariant = (id, known) => {
  const v = FORMS[id] && !FORMS[id].fork && FORMS[id].variant;
  return v ? Object.keys(FORMS).find(o => o !== id && FORMS[o].variant === v && FORMS[o].ready && known(o)) || null : null;
};
