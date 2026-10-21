// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MOBILITY: how the Jedi gets around a fight. The ground roll, Force dash charges, the risk of being in the air, and
// what each form changes about them. Edit here to retune duel movement.

/* A fight is fought on the ground, Jedi Academy style. In COMBAT (a foe close by, the boss up, or a blow traded in
   the last few seconds) SHIFT on the ground is a quick ROLL: free, short, with a moment of invulnerability. It is
   the duel dodge. Tap SHIFT again during the roll (or press it in the air) for the FORCE DASH, which spends one of a
   few CHARGES that refill over time, plus a little Force. Being in the air in a fight is a commitment: you steer
   less, you can't hold a guard, blows land harder and knock you out of the leap.
   OUT OF COMBAT nothing of that applies: SHIFT dashes, for free, and charges refill fast, so getting around the map
   stays loose. The dash's speed and time live in data/config.js (CFG.abilities.dash); its cost and gap here. */
export const MOBILITY = {
  combat: {
    range: 18,       // a live foe this close (metres) means you're in a fight...
    linger: 3,       // ...and you stay in one this many seconds after the last blow you took or landed
  },
  roll: {
    speed: 14,       // m/s impulse along the roll
    time: 0.42,      // the whole roll (the body move); the feet are yours again after it
    iframes: 0.24,   // invulnerable from the start for this long: a perfect dodge counts from the roll's start too
    cd: 0.3,         // gap after a roll before the next one
    redash: 0.3,     // a second SHIFT this soon into a roll turns it into a Force dash
    swingLock: 0.08, // the blade is slow to swing out of the roll's last beat
  },
  dash: {
    charges: 2,      // Force dash charges (forms change it below)
    recharge: 2.8,   // seconds to refill one charge in combat (skills/boons that cut the dash cooldown cut this)
    cost: 10,        // Force per dash in combat, on top of the charge
    gap: 0.3,        // seconds between two dashes
  },
  explore: {
    rechargeMul: 0.25,   // out of combat a charge refills 4× as fast...
    free: true,          // ...and a dash costs neither a charge nor Force
  },
  air: {
    control: 0.6,        // × the air steering (data/movement.js airControl) while in a fight
    dmgTaken: 1.2,       // blows that land while you're airborne in a fight hit this much harder
    noGuard: true,       // a held block (and its bolt absorb) doesn't work in the air in a fight
    knockDown: true,     // a blow that lands mid-air kills the rise and the second jump: you drop
    evadeIframes: 0.32,  // the guard flip (RMB + SPACE) is only invulnerable for this long in a fight (was the whole flip)
    evadeCharge: true,   // and it spends a dash charge in a fight; with none left it's a plain jump
  },
  /* FORMS. Ataru is the acrobat: more and cheaper dashes, keeps its air control and its timed parry in the air, takes
     less extra damage up there, and its guard flips stay safe longer. Djem So and Niman fight on the ground: a better
     roll and steadier footwork. Each entry multiplies the base values above (1 = unchanged). */
  forms: {
    ataru: {
      charges: 3, recharge: 0.8, dashCost: 0.5,
      airControl: 1.6,    // undoes the combat air penalty (0.6 × 1.6 ≈ 1)
      airDmg: 0.5,        // half the airborne damage penalty
      airParry: true,     // a timed parry still works in the air (a held block doesn't)
      airTurn: true,      // the second jump can still turn the leap toward the keys
      evadeIframes: 1.6,
      roll: { speed: 1.05, iframes: 1.0, cd: 1.0 },
      swingMove: 1.0,
    },
    niman: {
      charges: 2, recharge: 1.0, dashCost: 1.0,
      airControl: 1.0, airDmg: 1.0, airParry: false, evadeIframes: 1.0,
      roll: { speed: 1.0, iframes: 1.15, cd: 0.85 },
      swingMove: 1.15,
    },
    djemso: {
      charges: 2, recharge: 1.3, dashCost: 1.4,
      airControl: 0.85, airDmg: 1.25, airParry: false, evadeIframes: 0.8,
      roll: { speed: 0.95, iframes: 1.35, cd: 0.7 },   // a heavy, planted sidestep that stays safe longest
      swingMove: 1.4,     // footwork mid-swing: the heavy cuts walk the foe down instead of planting
    },
  },
};
