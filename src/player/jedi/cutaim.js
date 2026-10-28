// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Cut aim, Jedi Academy style: the movement key picks a cut's direction, where you aim picks its height (data/stances.js CUT_AIM).

import { CUT_AIM, SWING_PATTERNS } from '../../data/stances.js';
import { G, keys, player } from '../../state.js';

/* 'high' | 'mid' | 'low' — how far the view is tipped up or down from where it sits in a fight. (The view orbits the hero
   from behind, so the crosshair's line crosses a foe close in front LOWER as you look up: the tip of the view is the
   honest read of where you mean to cut, the way the crosshair rises over a foe's head as you look up.) */
export function cutHeight(){
  return G.pitch < CUT_AIM.pitchHigh ? 'high' : G.pitch > CUT_AIM.pitchLow ? 'low' : 'mid';
}

/* the cut for this press: { pat, dir } — dir is the key family (neutral / left / right / forward / back) the rest of the
   swing code reads; pat the keyframed cut. A neutral cut alternates sides each press. */
export function pickCut(step){
  const A = CUT_AIM, w = keys['w'], s = keys['s'], a = keys['a'], d = keys['d'];
  const side = d ? 'right' : a ? 'left' : null;
  const h = cutHeight();
  let dir, id;
  if (side){ dir = side; id = w ? A.diag.forward[side] : s ? A.diag.back[side] : A.side[side][h]; }
  else if (w){ dir = 'forward'; id = A.forward[h]; }
  else if (s){ dir = 'back'; id = 'back'; }
  else {
    dir = 'neutral';
    if (step === 2) id = 'forward';
    else { id = A.neutral[h][player.swingFlip ? 1 : 0]; player.swingFlip = !player.swingFlip; }
  }
  if (G.swingMirror && A.mirror[id]) id = A.mirror[id];   // SWING preference: flip which way the side cuts sweep
  return { pat: SWING_PATTERNS[id], dir, h };
}
