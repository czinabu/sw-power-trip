// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BOSS_CFG (Darth Vexis) and BOSS_MANDO tuning.


/* BOSS — DARTH VEXIS. Edit phases, damage, timing windows here. */
export const BOSS_CFG = {
  name: 'DARTH VEXIS — HERALD OF THE VOID',
  hp: 1200,
  speed: [4.6, 5.6, 7.0],      // per phase
  phaseAt: [1.0, 0.66, 0.33],  // hp fraction thresholds for phases 1/2/3
  armor: 0.42,                 // damage multiplier when NOT stunned/vulnerable (chip damage now matters)
  phaseResist: [1.0, 0.76, 0.5],  // EXTRA damage taken per phase — late phases shrug off high-tier tools (no trivializing)
  // ANTI-CHEESE: no single blow can exceed this fraction of max HP (rewards a set-up burst over one-shot ults);
  // and after an ability-stagger he RESISTS the next for `staggerImmune`s so you can't stun-lock him with abilities.
  hitCapBase: 0.10, hitCapVuln: 0.18, staggerImmune: 3.4,
  // longer, clearer wind-ups → his combo is reliably PARRYABLE; a parry throws the duel wide open
  combo: { swings: 3, windup: 0.62, dmg: 14, range: 4.4, vulnTime: 2.0 },
  lightning: { dur: 2.4, durP3: 3.6, tick: 0.28, tickDmg: 6, catchTime: 0.95,
               reflectStun: 4.0, reflectDmg: 130, cd: 6.5 },   // reflecting his storm is a huge payoff
  pulse: { dmg: 18, growSpeed: 16, maxR: 17, cd: 6.0, rings: [1, 2, 3] },  // phase 2+ NOVA: more concentric waves late — dash/jump each
  blink: { cd: 7, range: 13, dist: 3.0 },                 // ANTI-KITE: dark-blink onto a kiting player, then strike
  summon: { grunt: 3, blaster: 2 },                      // phase 3 entry
};

/* THE IRON MAGISTRATE — the MANDO's boss (chosen when you fight as the Mandalorian). A beskar warlord built to
   counter the hunter: heavy ARMOR shrugs off chip fire (reward precision/braced shots & rockets), and instead of
   Force lightning he unloads a sustained BLASTER BARRAGE you must BRACE, break line-of-sight on, or darksaber-deflect.
   Tougher than Vexis so the Mando's range/armor kit actually gets tested. Reuses the boss state machine via boss.kind. */
export const BOSS_MANDO = {
  name: 'THE IRON MAGISTRATE — WARLORD OF THE OUTER RIM',
  hp: 1500, armor: 0.52,
  phaseResist: [1.0, 0.74, 0.48],   // later phases resist explosives / the Darksaber / heavy ordnance
  hitCapBase: 0.10, hitCapVuln: 0.18, staggerImmune: 3.4,   // same anti-burst / anti-stunlock guard as Vexis
  combo: { swings: 3, windup: 0.62, dmg: 14, range: 4.4, vulnTime: 2.0 },   // his melee opening (shared by the stagger DR)
  barrage: { fireGap: 0.15, dmg: 12, boltSpeed: 34, spread: 1.1 },   // sustained stream during the "lightning" slot
  volley: { cd: 7, rounds: 4, gap: 0.17, dmg: 17, boltSpeed: 30, lead: 0.28 },   // a quick AIMED burst that leads your strafe
  pulse: { rings: [1, 2, 3] },     // his jetpack ground-pound gains extra shock rings late
  blink: { cd: 8, range: 11 },     // ANTI-KITE: a jet CHARGE straight at a kiting hunter
};
