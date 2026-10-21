// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BOSS_CFG (Darth Vexis) and BOSS_MANDO tuning.


/* BOSS GAIT — the bosses move on the troopers' legs (enemies/gait.js) and the hero's ground handling (data/movement.js),
   but they are heavy: they gather speed and brake slower, turn slower while walking up, take the stride with less bob and
   lean, and every footfall at a stride thuds the ground. They PACE (the captured walk) until phase III, then run. */
export const BOSS_GAIT = {
  accel: 12, brake: 26,   // m/s² (the hero's: 22 / 46)
  turn: 5,                // rad/s while walking up (the hero's roaming turn: 10); his attacks still aim as before
  pivotAngle: 2.4, pivotTime: 0.3, pivotMinSpeed: 4,   // a hard reversal at speed plants the feet for a long beat
  bob: 0.6, lean: 0.55,   // the stride's hip bob and the lean into acceleration, as a share of a trooper's
  thudRange: 16, thud: 0.16, dust: 0xb09a7a,   // footfalls within this range (m) of the hero shake the camera
};

/* BOSS — DARTH VEXIS. Edit phases, damage, timing windows here. */
export const BOSS_CFG = {
  name: 'DARTH VEXIS — HERALD OF THE VOID',
  hp: 1800,                    // sized for a late-run build: posture breaks and reflects open him up, so the bar has to last
  speed: [4.6, 5.6, 7.0],      // per phase
  phaseAt: [1.0, 0.66, 0.33],  // hp fraction thresholds for phases 1/2/3
  armor: 0.42,                 // damage multiplier when NOT stunned/vulnerable (chip damage now matters)
  phaseResist: [1.0, 0.85, 0.7],   // EXTRA damage taken per phase — late phases shrug off high-tier tools (no trivializing)
  // ANTI-CHEESE: no single blow can exceed this fraction of max HP (rewards a set-up burst over one-shot ults);
  // and after an ability-stagger he RESISTS the next for `staggerImmune`s so you can't stun-lock him with abilities.
  hitCapBase: 0.10, hitCapVuln: 0.18, staggerImmune: 3.4,
  // longer, clearer wind-ups → his combo is reliably PARRYABLE; a parry throws the duel wide open
  // POSTURE: parrying an early swing only deflects it (the chain continues after `deflectGap` × windup); parrying
  // the LAST swing breaks him open for `breakTime`. Letting a chain finish leaves a shorter `whiffTime` opening.
  // vulnTime is the base length of an ability stagger (bossStagger).
  combo: { swings: 3, windup: 0.62, dmg: 14, range: 4.4, vulnTime: 2.0, deflectGap: 0.85, breakTime: 2.2, whiffTime: 1.2 },
  retreat: { dist: 8, time: 0.4 },   // up close with lightning ready, he slides back out of reach before casting
  lightning: { dur: 2.4, durP3: 3.6, tick: 0.28, tickDmg: 6, catchTime: 0.95,
               reflectStun: 2.5, reflectDmg: 130, cd: 6.5 },   // reflecting his storm is a huge payoff (damage × phaseResist)
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
  hp: 2100, armor: 0.52,
  phaseResist: [1.0, 0.84, 0.68],   // later phases resist explosives / the Darksaber / heavy ordnance
  hitCapBase: 0.10, hitCapVuln: 0.18, staggerImmune: 3.4,   // same anti-burst / anti-stunlock guard as Vexis
  combo: { swings: 3, windup: 0.62, dmg: 14, range: 4.4, vulnTime: 2.0 },   // his melee opening (shared by the stagger DR)
  barrage: { fireGap: 0.15, dmg: 12, boltSpeed: 34, spread: 1.1 },   // sustained stream during the "lightning" slot
  volley: { cd: 7, rounds: 4, gap: 0.17, dmg: 17, boltSpeed: 30, lead: 0.28 },   // a quick AIMED burst that leads your strafe
  pulse: { rings: [1, 2, 3] },     // his jetpack ground-pound gains extra shock rings late
  blink: { cd: 8, range: 11 },     // ANTI-KITE: a jet CHARGE straight at a kiting hunter
};
