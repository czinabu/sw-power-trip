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
   with Form I alone, and grows as the run teaches more (game/meditation.js). */
export const LOADOUT_SLOTS = 3;
export const DEFAULT_LOADOUT = ['ataru', 'niman', 'djemso'];
export const STARTING_FORMS = ['shiicho'];   // Form I, which every Jedi learns first
export const RUN_LOADOUT = ['shiicho', null, null];

/* THE PATH — where a run learns each form (the auto-unlocks in data/store.js are built from this).
   chapter  the campaign chapter whose clear teaches it (data/campaign.js): the trials are the masters who teach
   level / wave   the same point for a run that plays the levels straight through (no chapters)
   stage    survival and the missions: the run's depth (waveTotal)
   The forms come in the tiers the Order teaches them in (lineage above is how they were made, not how they are taught):
     FOUNDATION   Shii-Cho, from the start: every youngling begins there
     CORE         Soresu and Ataru, the styles a Padawan grows into: the Wall and the Acrobat
     INTERMEDIATE Djem So and Shien (the Knight), Makashi (Jakku), Niman, which blends them all (Mustafar)
     PEAK         Form VII, never taught early: after the chase, and only one of its two roads
   Form V's two variants come together from the Knight (G swaps them). Form VII is a fork: the run offers both and the
   hero keeps one. */
export const FORM_PATH = [
  { form: 'soresu',  chapter: 'trial-first',   level: 1, wave: 0, stage: 3 },   // the Wall
  { form: 'ataru',   chapter: 'trial-acrobat', level: 1, wave: 1, stage: 5 },   // the Acrobat
  { form: 'djemso',  chapter: 'trial-knight',  level: 1, wave: 2, stage: 6 },   // the Knight: Form V…
  { form: 'shien',   chapter: 'trial-knight',  level: 1, wave: 2, stage: 6 },   // …both its variants
  { form: 'makashi', chapter: 'jakku',         level: 1, wave: 2, stage: 7 },   // a duellist's holocron in the salvage
  { form: 'niman',   chapter: 'mustafar',      level: 1, wave: 3, stage: 8 },   // Form VI: the five forms brought together
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

/* THE FORMS CODEX — what each form is, in the lore and in the fight: the Forms page (ui/forms-ui.js) shows a form
   once the hero has learned it. `who` names a famous user, `best` the fights it is made for. Keep the numbers here in
   step with data/stances.js. */
export const FORM_CODEX = {
  shiicho: { who: 'Kit Fisto', lore: 'The first form every initiate learns: wide, simple sweeps made to hold off many foes at once.',
    best: 'Crowds of troopers',
    pros: ['Wide sweeps that catch several foes', 'The Sarlacc Sweep finisher hits all round you', 'The finisher knocks the blaster out of a trooper\'s hands'],
    cons: ['Duellists read its broad cuts and turn 25% more of them', 'Deflected bolts go back loosely'] },
  makashi: { who: 'Count Dooku', lore: 'The duellist\'s form: one hand, side-on, precise and economical, made to beat another blade.',
    best: 'Duellists, acolytes and anything with a blade',
    pros: ['+40% damage against blade users', 'Reads feints: duellists feint and hold strikes half as often', 'Hard to guard-break'],
    cons: ['A narrow arc that crowds slip past', 'Weak against blasters: deflects fly wild and cost 50% more stamina'] },
  soresu: { who: 'Obi-Wan Kenobi', lore: 'The wall: tight, economical blocks that send blaster fire home and outlast the attacker.',
    best: 'Heavy blaster fire and long fights',
    pros: ['A held guard sends bolts back home', 'The cheapest guard, and no damage gets through a block', 'Every blow it blocks tires the attacker', 'The widest parry window'],
    cons: ['The lowest damage of any form', 'Slower on its feet'] },
  ataru: { who: 'Yoda, Qui-Gon Jinn', lore: 'The acrobat\'s form: leaps, flips and speed, the whole body behind every strike.',
    best: 'Officers, snipers, grenadiers and jet troopers',
    pros: ['+60% damage against the back line', 'Cuts in the air land 35% harder', 'Dash into a cut for the Hawk-Bat Swoop', 'Keeps moving while it swings, and casts Force powers fast'],
    cons: ['Weak against armour', 'Deflected bolts spray'] },
  djemso: { who: 'Anakin Skywalker', lore: 'Form V, the strong form: power blows that answer every attack with a harder one.',
    best: 'Brutes, armour and bosses',
    pros: ['Breaks guards fast and shreds armour', 'Take a blow on the guard, then strike back with a Fluid Riposte', 'The finisher floors anything it hits, brutes too, a short shove away', 'Force powers hit 35% bigger'],
    cons: ['Slow, stamina-hungry swings', 'Force powers cost 30% more', 'A narrow arc that crowds punish'] },
  shien: { who: 'Ahsoka Tano', lore: 'Form V\'s other road: a reverse grip built to send blaster fire straight back at the shooter.',
    best: 'Blaster troopers and turrets',
    pros: ['Every deflect flies home and hits 50% harder', 'Strong cuts with a wider arc than Djem So'],
    cons: ['Less raw power against armour than Djem So', 'Only one Form V fits in a loadout (G swaps them)'] },
  niman: { who: 'Jedi diplomats, the Jedi of Geonosis', lore: 'Form VI, the balanced form: a little of every other form, with saber and Force as one.',
    best: 'Anything: the all-rounder',
    pros: ['Swings and Force powers cost less', 'A power cast mid-string keeps the string going', 'Defence powers come back twice as fast', 'Clean parries give Force back', 'The only form that can switch to a reverse grip (G)'],
    cons: ['Master of none: no standout edge against any foe'] },
  juyo: { who: 'Darth Vader', lore: 'Form VII, the ferocious form: bursts of savage cuts driven by the Force and by fury.',
    best: 'Taking a fight to its end, fast',
    pros: ['Every hit builds fury, up to +35% damage', 'Fast, savage strings'],
    cons: ['Every swing burns Force as well as stamina', 'Blows land 25% harder on you', 'Choosing it closes Vaapad for the run'] },
  vaapad: { who: 'Mace Windu', lore: 'Form VII as Mace Windu made it: the attacker\'s own fury, turned back on them.',
    best: 'Duellists and heavy hitters who come to you',
    pros: ['Blocks and parries build fury, up to +40% damage', 'A parry finds the Shatterpoint: your next cut on that foe lands double and floors it'],
    cons: ['Blows land 10% harder on you', 'Weak when nobody attacks you', 'Choosing it closes Juyo for the run'] },
};
