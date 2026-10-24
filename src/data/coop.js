// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Online co-op tuning: how often the partner's state is sent, and how enemies split themselves between the heroes.

export const NET = {
  sendMs: 50,        // the hero's pose goes out ~20 times a second
  picksEvery: 40,    // ...and the customizer picks ride along every this many messages (they rarely change)
};

/* TARGETING (enemies/targets.js) — each foe picks one hero to go after. It scores every hero by distance, plus a
   penalty for each other foe already on that hero (so a crowd splits instead of all mobbing one), minus a bonus for
   the one it's already chasing (so it doesn't flip back and forth). Only a foe that isn't mid-attack re-picks. */
export const TARGET = {
  recheck: [1.2, 2.0],   // seconds between a foe's re-picks
  crowd: 2.5,            // metres of extra distance per other foe already on that hero
  stick: 4,              // metres of loyalty to the current target
  swap: 7,               // a hero this much nearer than the current one wins at once, even mid-recheck
};
