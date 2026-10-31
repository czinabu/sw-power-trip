// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ABILITY CARDS — the small screen that opens when the run hands over a new ability (data/store.js JEDI_AUTO / MANDO_AUTO,
// announced by game/flow.js, shown by ui/ability-card.js): what it does, and a short looping clip of it in the game.
// Keyed by the auto-unlock's key. An unlock with no entry here (the Wrist Rocket, a form) keeps its banner.
// clip   a small animated WebP of the ability in the game (src/assets/abilities/), inlined into the build
import pull from '../assets/abilities/pull.webp?inline';
import jump from '../assets/abilities/jump.webp?inline';
import flame from '../assets/abilities/flame.webp?inline';
import dual from '../assets/abilities/dual.webp?inline';
import jet from '../assets/abilities/jet.webp?inline';

export const ABILITY_CARDS = {
  pull: { clip: pull, lines: ['Hold C to lock a foe in your Force Grasp. It hangs in the air and follows your aim: sweep it into other foes to bowl them over.',
                              'While you hold it, F hurls it, a tap of C yanks it onto your blade and Z drops it. A quick tap of C is a plain Force Pull.'] },
  fj1:  { clip: jump, lines: ['Hold SPACE in the air to leap on the Force: a high arc, then a slow glide down.',
                              'The take-off costs most of your Force up front, then a little for as long as you hold it.'] },
  fj2:  { clip: jump, lines: ['Force Jump grows: a higher take-off, a cheaper hold and a cheaper glide.',
                              'Hold SPACE in the air, as before.'] },
  flame:{ clip: flame, lines: ['Hold F to sweep a cone of flame in front of you. It burns every foe it touches over time, so it clears crowds.',
                               'It runs on your Gadget Power bar.'] },
  dual: { clip: dual, lines: ['Press 2 to draw a second blaster. Hold LMB to fire both, for far more fire than the single blaster.',
                              'Both guns heat up as you fire: ease off to let them cool.'] },
  jet1: { clip: jet, lines: ['Hold SPACE to burn the jetpack: more lift and a bigger fuel tank than the stock pack.',
                             'Hovering burns less fuel, so the pack lasts longer in the air.'] },
  jet2: { clip: jet, lines: ['The jetpack grows again: stronger lift, a bigger tank and a thriftier hover.',
                             'Hold SPACE, as before.'] },
  cells1: { clip: dual, lines: ['Your blasters hold more energy before they overheat, and recover it faster.',
                                'Hold LMB for longer bursts.'] },
  cells2: { clip: dual, lines: ['A second power cell: the blasters hold more energy again, and cool faster.'] },
  cells3: { clip: dual, lines: ['The final power cell: the longest bursts and the fastest cooling yet.'] },
};
