// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MOBILITY: how the Jedi gets around a fight. The ground roll, Force dash charges, the risk of being in the air, and
// what each form changes about them. Edit here to retune duel movement.

/* A fight is fought on the ground, Jedi Academy style. In COMBAT (a foe close by, the boss up, or a blow traded in
   the last few seconds) SHIFT on the ground is a quick ROLL: short, a little stamina (roll.stam), with a moment of invulnerability. It is
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
    stam: 15,        // SOULS-STYLE: each roll spends this much stamina (forms scale it), so a dodge is a decision, not a
                     // reflex to spam; with less than that in the bar there's no roll (step out of reach instead)
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
    shiicho: {   // plain and grounded: a standard roll, a little slower to dash, footwork that keeps sweeping
      charges: 2, recharge: 1.1, dashCost: 1.1,
      airControl: 0.95, airDmg: 1.1, airParry: false, evadeIframes: 0.9,
      roll: { speed: 1.0, iframes: 1.1, cd: 0.9, stam: 1.0 },
      swingMove: 1.3,     // the broad sweeps carry the feet into the crowd
    },
    makashi: {   // the fencer: quick light steps instead of rolls, a fast cheap dash, nothing in the air
      charges: 2, recharge: 0.85, dashCost: 0.7,
      airControl: 0.9, airDmg: 1.2, airParry: false, evadeIframes: 0.8,
      roll: { speed: 1.1, iframes: 0.9, cd: 0.75, stam: 0.75 },
      swingMove: 1.25,    // the lunge: thrusts step in on the line
    },
    soresu: {    // economy of motion: a short guarded slide, safest roll, barely moves while cutting
      charges: 2, recharge: 1.2, dashCost: 1.2,
      airControl: 0.9, airDmg: 1.2, airParry: false, evadeIframes: 0.9,
      roll: { speed: 0.9, iframes: 1.4, cd: 0.8, stam: 0.85 },
      swingMove: 0.8,
    },
    ataru: {
      charges: 3, recharge: 0.8, dashCost: 0.5,
      airControl: 1.6,    // undoes the combat air penalty (0.6 × 1.6 ≈ 1)
      airDmg: 0.5,        // half the airborne damage penalty
      airParry: true,     // a timed parry still works in the air (a held block doesn't)
      airTurn: true,      // the second jump can still turn the leap toward the keys
      evadeIframes: 1.6,
      roll: { speed: 1.05, iframes: 1.0, cd: 1.0, stam: 0.7 },   // the acrobat rolls cheapest
      swingMove: 1.0,
      dashSpeed: 1.2,     // the acrobat's dash carries ~20% farther, enough to cross the stalker ring
    },
    niman: {
      charges: 2, recharge: 1.0, dashCost: 1.0,
      airControl: 1.0, airDmg: 1.0, airParry: false, evadeIframes: 1.0,
      roll: { speed: 1.0, iframes: 1.15, cd: 0.85, stam: 1.0 },
      swingMove: 1.15,
    },
    juyo: {     // ferocious and quick: more dashes, but it takes a beating in the air too
      charges: 3, recharge: 1.0, dashCost: 0.8,
      airControl: 1.2, airDmg: 1.2, airParry: false, evadeIframes: 1.1,
      roll: { speed: 1.08, iframes: 0.9, cd: 0.85, stam: 0.85 },
      swingMove: 1.35,    // every cut drives forward
    },
    vaapad: {   // controlled: a safe roll, a steady dash
      charges: 2, recharge: 1.0, dashCost: 1.0,
      airControl: 1.0, airDmg: 1.1, airParry: false, evadeIframes: 1.0,
      roll: { speed: 1.0, iframes: 1.2, cd: 0.8, stam: 0.95 },
      swingMove: 1.15,
    },
    shien: {    // Djem So's lighter sister: a quicker dash and a safe roll, still planted mid-swing
      charges: 2, recharge: 1.1, dashCost: 1.1,
      airControl: 0.95, airDmg: 1.1, airParry: false, evadeIframes: 1.0,
      roll: { speed: 1.0, iframes: 1.2, cd: 0.8, stam: 1.0 },
      swingMove: 1.25,
    },
    djemso: {
      charges: 2, recharge: 1.3, dashCost: 1.4,
      airControl: 0.85, airDmg: 1.25, airParry: false, evadeIframes: 0.8,
      roll: { speed: 0.95, iframes: 1.35, cd: 0.7, stam: 1.2 },   // a heavy, planted sidestep that stays safe longest (and costs most)
      swingMove: 1.4,     // footwork mid-swing: the heavy cuts walk the foe down instead of planting
    },
  },
};

/* THE MANDALORIAN. Beskar on the ground, a jetpack in the air: on his feet he fights like a soldier, and off them
   he's the most agile thing in the fight.
   ON THE GROUND SHIFT is a COMBAT DIVE, in every mode, fight or not (Max Payne / Helldivers), the way you press, squared to the reticle
   so the gun stays on target: he lays out flat in the air (face-down forward, on his back backward, on his side left
   or right), lands on the plate and skids, then gets back up. Free, a moment of invulnerability through the throw,
   but the get-up is his weight showing: that's the window to punish. Tap SHIFT again early in the dive for the full
   ROCKET BOOST (data/mando.js MANDO.boostDash, it spends jet fuel).
   IN THE AIR a SHIFT tap is an AIR DODGE: a straight, hard thruster kick the way you press (no flips: the pack does
   the work) with i-frames that also stops the fall for a beat. It spends one of a few JET CHARGES (refilling over time) plus a little fuel. Keep SHIFT held and it
   becomes the directional boost (data/mando.js boostThrust). In the air he steers hard, brakes hard against his
   momentum, and the hover (RMB in the air) strafes quickly.
   ALT / C is the TACTICAL SLIDE out of any run (bracing too): feet first like a runner sliding into base, leaning back
   with the lead leg out and the other folded under. It's jet-kicked, carries far, steers a little, ducks blaster fire,
   keeps his aim dead steady, and launches into a long hop if you jump out of it. */
export const MANDO_MOBILITY = {
  combat: {
    range: 30,       // a gunfighter's fight starts farther out than a swordsman's (the linger is MOBILITY.combat's)
  },
  dive: {
    speed: 8.5,      // m/s impulse along the dive (legs only: no jets unless you tap SHIFT again, see jet below)
    pop: 5.0,        // m/s up off the ground: a real leap (≈0.37 s in the air, the boots ≈0.45 m up at the top)
    skidDrag: 7,     // how fast the slide along the deck dies once the plate is down (the air glides at 2.6)
    turn: 12,        // how fast the lay-out follows the reticle mid-dive (turn onto your back by looking away)
    jet: { speed: 15, lift: 3.2, fuel: 14, flame: 0.35 },   // SHIFT again in the air: the pack kicks the dive on (spends jet fuel; hold it to fly on)
    layout: 0.24,    // seconds from the push-off to laid out flat
    airDrop: 0.4,    // share of the way down to the floor the body lies in the air (the rest comes at touchdown)
    impact: 0.09,    // seconds for the plate to come down onto the deck at touchdown
    skid: 0.16,      // seconds flat on the deck after touchdown
    getup: 0.4,      // seconds to get back up off one knee
    time: 1.0,       // the whole move, roughly (sets the gap before the next dive)
    maxTime: 1.8,    // ...and the longest it can last (a dive off a ledge still ends)
    hips: 0.3,       // hip height lying flat (m)
    tilt: { fwd: 1.45, back: 1.3, side: 1.35, sideUp: 0.3 },   // lay-out angles (rad): face-down, on the back, on the side
    iframes: 0.32,   // invulnerable from the start for this long (a perfect dodge counts from the start)
    cd: 0.25,        // gap after a dive before the next one
    redash: 0.3,     // a second SHIFT this soon into a dive fires the rocket boost instead
  },
  airDodge: {
    speed: 21,       // m/s added to the flight momentum the way you press (no keys: backward)
    iframes: 0.24,   // invulnerable from the kick for this long
    lift: 2.5,       // the fall is stopped: vertical speed is at least this after the kick
    fuel: 6,         // jet fuel per dodge, on top of a charge
    charges: 3,      // jet charges held
    recharge: 1.6,   // seconds to refill one charge in a fight (×0.25 out of one)
    gap: 0.22,       // seconds between two air dodges
  },
  air: {
    accel: 1.5,      // × the WASD flight thrust (data/mando.js airAccel)
    counter: 2.4,    // pressing against your momentum brakes this much harder still
    hoverSpeed: 9,   // top strafe speed while hovering (RMB in the air; was 6)
    hoverAccel: 2.6, // × the flight thrust while hovering
    hoverStop: 5,    // hover drag with no keys held: lets go of the keys and it holds position
    hoverDrift: 1.2, // hover drag while strafing
  },
  slide: {
    minSpeed: 2.5,   // any run starts one, braced or not (the old slide needed 5.5 m/s, more than a braced walk)
    speed: 12,       // the slide is kicked up to at least this...
    boost: 3,        // ...or the run's speed plus this, whichever is more
    time: 0.85,      // seconds on the ground
    drag: 0.85,      // speed bled per second (fraction)
    steer: 1.6,      // rad/s the keys can bend the slide
    cd: 0.5,         // gap after a slide ends
    hop: 1.15,       // a jump out of the slide keeps its speed × this into the air
    lean: 0.55,      // how far back he lies into it (rad): feet first along the skid
    roll: 0.12,      // a touch of roll onto the hip (rad)
    twist: 1.15,     // how far the torso turns to face sideways (rad): a baseball slide, chest square to the skid's side
    hips: 0.3,       // hip height off the floor while sliding (m)
  },
};
