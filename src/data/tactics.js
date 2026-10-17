// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TACTICS: how the rank and file fight smarter as a run deepens (feints, held swings, bursts, pincers), squad orders
// from officers, and the grenadier's and lancer's moves.


/* RAMP — every trick below is scaled by how deep you are in the run, so the first waves stay clean and readable and the
   late ones get mean. 0 → `from` of the full chance on the first wave, rising to the full chance by wave `full`
   (campaign: cumulative waves; survival: the survival wave). Difficulty scales it on top. */
export const RAMP = { from: 0.3, full: 9, diff: { padawan: 0.6, knight: 1, master: 1.25 } };

/* TROOPER MELEE — foes without a duel profile (brutes, lancers up close) still mix up their timing:
     hold     chance a wind-up HANGS at the apex for `holdT` extra seconds (the brute's held overhead: parry on reflex
              and you whiff, then eat the maul)
     feint    chance it rears back, checks, and drops the swing to come again fast (a hesitation, not a strike) */
export const TROOP_MELEE = {
  brute:  { hold: 0.45, holdT: [0.35, 0.6], feint: 0.15 },
  lancer: { hold: 0.25, holdT: [0.2, 0.4],  feint: 0.2 },
  feintAt: 0.75,          // a feint breaks off this far into the wind-up...
  feintRest: 0.28,        // ...settles back this long...
  feintWindup: 0.3,       // ...then the real swing winds up this fast
};

/* BLASTER FIRE — a line trooper (blaster, jet trooper) plans each shot as it starts aiming:
     burst    chance the shot is a DOUBLE-TAP: a second bolt `burstGap` seconds behind the first (one reflex block or
              shield tap covers only the first)
     hold     chance it HOLDS its aim a beat longer before firing (punishes deflecting on the wind-up glow) */
export const TROOP_FIRE = { burst: 0.35, burstGap: 0.16, burstSpread: 0.03, hold: 0.3, holdT: [0.3, 0.55] };

/* PINCER — when a second melee foe takes an attack token while another holder is closing from the same side, it swings
   wide to come in from an angle off the first instead of queuing behind it. Under an officer's FLANK order every
   holder does it, wider, so the blows come from your sides. */
export const PINCER = {
  near: 0.9,              // radians: a holder within this bearing of another one is "on the same side"
  arc: 1.25,              // ...and swings out this far around you
  flankArc: 1.9,          // under a FLANK order (sides, almost behind you; rear wind-ups still get the longer tell)
  maxT: 2.6,              // gives up the wide approach after this long and walks straight in
  done: 0.45,             // radians: close enough to the wanted bearing, walk straight in
};

/* OFFICER ORDERS — an officer with you in sight calls an order every `cd` seconds (only one order on the field at a
   time). Its arm goes up and the call shows over its head for `tell` seconds before the order takes effect. */
export const ORDERS = {
  cd: [6, 9],             // between one officer's orders
  firstCd: [2.5, 4],      // before its first
  tell: 0.7,              // arm raised, the call over its head
  sight: 28,              // an officer only calls orders with you this close and in its line of sight
  // VOLLEY — every line trooper within `radius` of the officer and in range of you aims together and fires on one beat
  volley: { radius: 24, max: 6, aim: 1.05, min: 2 },
  // FLANK — for `time` seconds the attack-token holders swing wide around you (PINCER.flankArc)
  flank: { time: 7, min: 2 },
  // an officer's death breaks the nerve of the troops near it: they FALTER (no step, no swing) for a moment
  falter: { radius: 13, time: 1.3 },
};

/* GRENADIER — a thermal detonator lobbed onto your feet. The ring marks the landing as it leaves the hand and fills as
   the fuse burns. Pushed by the Force, a live one flies back the way it came and goes off among the squad. */
export const GRENADE = {
  flight: [0.55, 1.15],   // seconds in the air (longer for a longer throw)
  arc: 6,                 // apex height above the higher end of the throw
  scatter: 0.9,           // landing spread around where you stood
  lead: 0.35,             // seconds of your movement it leads by (a strafing target still has to move out)
  foeDmg: 14, foeKnock: 9,      // what a stray one does to the squad (a flinch, not a knockdown)
  pushedDmg: 55, pushedKnock: 20,   // ...and one a Jedi pushed back into them
  pushSpeed: 22,          // a Force-pushed detonator flies back this fast
  slots: 1, slotsLate: 2, // grenadiers winding up a throw at once
};

/* LANCER LUNGE — from `min`..`max` away, with you in sight and in front of the camera, a lancer can plant and lunge.
   The ground line tracks you through the first `lockAt` of the tell, then LOCKS: move off it. Only `slots` lancers
   lunge at once. A lunge that is parried staggers it; one that misses overshoots into a long recovery. */
export const LUNGE = {
  min: 5, max: 12,
  tell: 0.75, lockAt: 0.7,
  speed: 30, over: 2.5,   // dash speed, and how far past where you stood it carries
  hitR: 1.15,             // you're caught if you're this close to its path
  dmgMul: 1.3,
  cd: [4.5, 7.5], firstCd: [1.5, 3],
  miss: 1.2,              // recovery after a whiffed lunge (the punish window)
  slots: 1,
};
