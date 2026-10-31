// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mandalorian kit tuning (MANDO, MANDO_WEAPONS) plus Jedi Force-jump tuning.

import { G, player } from '../state.js';

/* ---------- MANDALORIAN loadout ---------- */
export const HEADSHOT_MULT = 2.4;   // a blaster bolt to the head zone hits this much harder
export const MANDO = {
  boltSpeed: 48, spread: 0.003,   // bolts go through the crosshair; a touch slower than before so LEADING moving targets matters
  braceDR: 0.6,                                             // beskar brace: incoming damage ×(1-this)
  // JETPACK runs on its OWN fuel (player.jet, separate from ability Force). Limited: drains fast, regen on the ground.
  jetThrust: 46, jetMaxUp: 8.0, jetDrain: 20, jetRegen: 7, jetRegenGround: 30, fallCap: 15, jetHover: 8,   // fuel is a real commitment: barely trickles back in the air, recovers only on the ground (touch down to refuel)
  // MOMENTUM FLIGHT. SPACE = vertical thrust (hover/climb). SHIFT (tap, airborne) = AIR DODGE (data/mobility.js); held = directional BOOST that drives
  // you where you're moving/facing and DIVES when you look down — strong forward momentum that CARRIES on release.
  airAccel: 26, airSpeed: 12, airSpeedMax: 24, airDrag: 0.55,   // gentle WASD steer · ref · momentum cap · low drift drag
  climbBase: 8.5, climbRange: 7, diveCap: 32,                   // SPACE vertical: base hover/climb + more looking up
  boostThrust: 50, boostDrain: 20, boostDiveAccel: 40,          // SHIFT boost: horizontal thrust · fuel/s · look-down dive accel
  // the boosted flight's Max Payne lay-out (player/animation.js): the most it lies over (rad) flying forward / backward /
  // sideways (and how far a side lay-out rolls onto the back), at full speed and height, and how fast it follows
  // POWER CELLS (auto, data/store.js MANDO_AUTO) — the guns' energy: each tier holds more heat before an overheat (cap)
  // and sheds it faster (cool), so the fire-rate upgrades that drain it quicker have something to draw on
  cells: { cap: [1, 1.25, 1.5, 1.8], cool: [1, 1.1, 1.2, 1.3] },
  // firing the jetpack missile he leans in over it, the pack aimed down the reticle: how far (rad), for how long (s),
  // and how fast it goes in
  missileLean: { lean: 0.4, time: 0.75, in: 0.08 },
  flightLean: { fwd: 1.2, back: 1.05, side: 1.1, sideUp: 0.22, rate: 8 },
  boostDash: { speed: 30, time: 0.30, cd: 0.6, fuel: 16 },      // ROCKET BOOST on the ground (SHIFT twice); spends jet fuel · the dive and air dodge: data/mobility.js
  // ABILITY base costs are deliberately STEEP — upgrades (player.up.abilityCostMul) bring them down
  flame: { range: 8.5, angle: 0.5, dmg: 42, knock: 4, fuel: 52 },  // F (HELD) — flamethrower, Force/sec in a cone (drains faster now)
  // Q — wrist rocket: a PRECISE stagger. Knocks down the foe it hits and anyone right beside it, minimal damage. It used
  // to be a 6.6m, 60-knock blast every 2.4s from wave 1 (area denial on demand, and the same job as the detonator); the
  // wide blast now belongs to the THERMAL DETONATOR, and mastery grows the rocket back toward it late in the run.
  rocket: { cost: 34, cd: 4.0, speed: 34, dmg: 6, radius: 3.2, knock: 24 },
  // late/heavy ordnance is TAXING — long cooldowns + steep Force so the big blasts are a deliberate beat, not spam
  jetMissile: { cost: 74, cd: 14.0, speed: 30, dmg: 180, radius: 11, knock: 28 },  // Z — Boba-Fett back launcher: HUGE blast
  dark: { cost: 36, cd: 0.6, dmg: 78, range: 5.6, arc: 1.4, knock: 20 },      // DARKSABER weapon — LMB slash
  // DARKSABER THROW (RMB + LMB, Darksaber in hand) — hurl the spinning blade, then the gauntlet's grappling line latches
  // on and reels it home, cutting again on the way back. Every foe it touches is cut once going out and once coming back.
  darkThrow: { cost: 30, cd: 6.0, dmg: 58, speed: 30, range: 18, latch: 0.16, reelSpeed: 40, knock: 10 },
  birds: { cost: 48, cd: 7.5, count: 6, dmg: 20, radius: 2.6, speed: 26, knock: 6 },   // V — whistling birds (homing)
  deto:  { cost: 42, cd: 5.2, fuse: 1.15, dmg: 72, radius: 6.5, knock: 22, range: 26, minRange: 3, flight: [0.35, 0.9] },   // thrown onto the reticle (range m; flight s, near → far)           // V — thermal detonator (sticky) — THE Mando area blast (radius 5.5→6.5 as the rocket shrank)
  grapple: { cost: 18, cd: 1.2, range: 26, pullSpeed: 42 },                            // C — grappling hook
  // X (air) — jetpack slam (jet fuel). A beat of wind-up (the pack fires up, he rises a little with the fist cocked),
  // then the jets flip and drive him down; the landing is a superhero three-point with the fist in the deck. The
  // farther he falls the harder it lands (up to boost× damage/radius from fallFull m), and foes inside core are stunned.
  slam:  { cost: 34, dmg: 46, radius: 9, knock: 14, diveVel: 44, wind: 0.3, rise: 5, core: 3.5, stun: 1.4,
           fallFull: 12, boost: 1.35 },                     // X (air) — jetpack slam (jet fuel)
  // (the E melee kit — string, catch, charge, dive kick, takedown — is tuned in data/duel.js MANDO_MELEE)
  // BACTA STIM (G) — the Mando's self-heal: jam a bacta injector into the gauntlet line. Mirrors the Jedi's Force
  // Mend (a quick channel → a big restore). Mutually exclusive with HUNTER'S CREED (heal-per-kill) so you commit to
  // ONE sustain path. Heal amount reuses CFG.abilities.mend.heal via mendComplete(). Cooldown tightened 14→10s (Pass
  // 55b) — at 14s its total healing-per-fight didn't clearly beat just taking BESKAR PLATING's free heal-on-pickup,
  // making the 200-XP purchase (now 150, see MANDO_STORE) feel pointless next to Hunter's Creed's free per-kill trickle.
  bacta: { cost: 42, cd: 10.0, channel: 0.5 },
};
// LOADOUTS — switch with 1/2/3/4 or wheel. fire: 'semi'(1/click) · 'auto'(hold) · 'rifle'(disruptor) · 'saber'(melee)
// ENERGY model (Battlefront-2 style): no ammo/reload. Each shot adds HEAT; cap it and you OVERHEAT and
// must wait for a full vent. `heat` = per-shot, `cool`/`overCool` = recovery per second (normal / while overheated).
// hipSpread/braceSpread = bolt cone (rad) hipfire vs while BRACING (hold RMB) · braceDmg = damage ×while braced.
// foStart/foEnd = distance where damage starts/finishes falling off · foMin = min damage mult (bracing also lifts this).
// BRACING is the core skill: it tightens the cone hard, boosts damage, and stretches your effective range.
// Single: precise, long reach, HARSH hipfire falloff → big reward for bracing. Dual: wild spray, very harsh falloff
// → bracing turns it into usable DPS. Disruptor: pinpoint either way (minimal change).
export const MANDO_WEAPONS = {
  single:    { name: 'BLASTER',   fire: 'semi', fireCd: 0.15, dmg: 32, dual: false, heat: 0.115, cool: 0.6, overCool: 0.46,
               hipSpread: 0.008, braceSpread: 0.002, braceDmg: 1.08, foStart: 18, foEnd: 44, foMin: 0.5 },   // bolts track the reticle; the SWAY is the difficulty
  dual:      { name: 'DUAL',      fire: 'auto', fireCd: 0.11, dmg: 13, dual: true,  heat: 0.066, cool: 0.66, overCool: 0.5,
               hipSpread: 0.02, braceSpread: 0.006, braceDmg: 1.12, foStart: 8, foEnd: 24, foMin: 0.35 },    // a touch looser, but still honest to the reticle
  disruptor: { name: 'DISRUPTOR', fire: 'rifle', fireCd: 0.7, dmg: 150, dual: false, heat: 0.42, cool: 0.5, overCool: 0.4,
               hipSpread: 0, braceSpread: 0, braceDmg: 1, foStart: 999, foEnd: 999, foMin: 1,
               twoHand: true, stabDmg: 38, stabRange: 5.2, stabStun: 2.0,   // pinpoint sniper; else a fast electric spear
               // the stab: the whole move (s), the share of it where the prongs land (chamber → drive), the gap to the next
               // jab (a click inside the last stretch queues it), and the lunge
               stabTime: 0.34, stabHit: 0.3, stabCd: 0.38, stabQueue: 0.14, stabLunge: 9 },
  darksaber: { name: 'DARKSABER', fire: 'saber', melee: true },                              // LMB slash; unlocked at the wave-5 fork
  fists:     { name: 'HOLSTERED', fire: 'fists', melee: true },                              // 4: weapon holstered, LMB throws the close-quarters string (not in the wheel)
};
export const MANDO_WEAPON_ORDER = ['single', 'dual', 'disruptor', 'darksaber'];
// JEDI aerial Force-control — only kicks in when you HOLD space (a tap is just a normal jump). The TAKEOFF
// costs the bulk of the Force up front, then a slow drain while held; it arcs to an apex under gentled gravity
// then a graceful (not floaty) glide-down. Power LEVELS UP automatically (player.up.fjTier), like the jetpack.
export const JEDI_FORCE = { soarAccel: 20, soarMax: 11.5, riseGravity: 0.72, glideFall: 4.2 };
export const JUMP_HOLD_THRESH = 0.14;   // hold space longer than this (airborne) to trigger the Force jump vs. a tap
export const DJUMP_FORCE = 14;   // the Jedi double-jump spends this much Force (no Force → no second jump)
export const WALLKICK_FORCE = 8;   // a wall-kick now spends this much Force — was free, let it be chained for unlimited altitude
export const MELEE_WINDUP_GAP = 0.25;   // min seconds between two hostile melee foes starting a windup on the player
export function forceJumpPow(){   // scales with the auto-leveled Force-jump tier (weak early, strong late)
  const t = player.up.fjTier || 0;
  return { takeoff:  [6.5, 10, 13.5][t] || 6.5,    // initial leap added on top of the jump
           initCost: [34, 30, 26][t]   || 34,      // the big up-front Force cost (the majority of a jump)
           holdCost: [9, 7.5, 6][t]    || 9,       // slow drain/sec while still rising
           glideCost:[4, 3.5, 3][t]    || 4 };     // even slower drain/sec while gliding down
}
export function weaponUnlocked(name){ return name === 'disruptor' ? !!G.unlocked.disruptor : name === 'darksaber' ? !!player.up.darksaber : name === 'dual' ? !!G.unlocked.dual : true; }
