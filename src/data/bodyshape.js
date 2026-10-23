// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HITBOX: each enemy model's body, measured off the models themselves (enemies/bodyshape.js tests every attack against it).

/* Parts, bottom to top, in the model's own units (the unit's scale and any elite growth are applied on top):
     y0..y1   the height band, from the feet
     hx       half-width side to side (shoulders and hanging arms included: clip an arm and it's a hit)
     hz       half-depth front to back
     head     a hit here is a HEADSHOT
   Weapons and shields in front of the body are not body (a phalanx's riot shield is, it's strapped to the arm).
   downR is how far a floored body reaches from its feet. Open the game with ?hitbox to see them as wireframes. */
const HUMAN = [
  { y0: 0,    y1: 0.8,  hx: 0.27, hz: 0.2 },
  { y0: 0.8,  y1: 1.98, hx: 0.52, hz: 0.27 },
  { y0: 1.98, y1: 2.42, hx: 0.19, hz: 0.21, head: true },
];
HUMAN.downR = 0.95;
const parts = (torso, head, legs, downR = 0.95) => {
  const p = [{ ...HUMAN[0], ...legs }, { ...HUMAN[1], ...torso }, { ...HUMAN[2], ...head }];
  p.downR = downR; return p;
};

export const HITBOX = {
  default: HUMAN,
  purge:   HUMAN,                                                                  // grunt
  storm:   parts({ hx: 0.5 }, { y1: 2.36 }),                                         // blaster trooper
  scout:   parts({ hx: 0.47, hz: 0.3 }, { y1: 2.34 }),                               // sniper (poncho)
  jet:     parts({ hx: 0.5, hz: 0.4 }, { y1: 2.37 }),                                // flyer (jetpack on the back)
  heavy:   parts({ hx: 0.72, hz: 0.3, y1: 2.12 }, { y0: 2.12, y1: 2.35, hx: 0.17 }, {}, 1.2),   // brute: huge shoulders, low head
  magna:   parts({ hx: 0.45, y1: 1.98 }, { y1: 2.33, hx: 0.16 }, { hx: 0.3 }),       // magnaguard
  acolyte: parts({ hx: 0.5, hz: 0.3 }, { y1: 2.44 }, { hx: 0.36, hz: 0.3 }),         // acolyte (cloak flares at the knee)
  riot:    parts({ hx: 0.62, hz: 0.48 }, { y1: 2.36 }, { y0: 0, y1: 0.8, hx: 0.3, hz: 0.3 }),   // phalanx + riot shield
  officer: parts({ hx: 0.46 }, { y1: 2.38 }),                                        // officer
  grenadier: parts({ hx: 0.52, hz: 0.32 }, { y1: 2.36 }),                            // grenadier (bandolier, pack)
  lancer:  parts({ hx: 0.5, hz: 0.3 }, { y1: 2.44 }),                                // lancer (crest, cape)
  clone:   parts({ hx: 0.5 }, { y1: 2.38 }),                                         // squadmate: clone trooper
  mandalorian: parts({ hx: 0.5, hz: 0.36 }, { y1: 2.42 }),                           // squadmate: Mandalorian warrior (jetpack)
  b1:      parts({ y0: 0.8, y1: 1.72, hx: 0.4, hz: 0.3 }, { y0: 1.72, y1: 2.19, hx: 0.12, hz: 0.3 }, { y1: 0.8, hx: 0.2, hz: 0.15 }),  // bomber droid
};
