// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Which hero a foe goes after (data/coop.js TARGET). Solo there is only one, and nothing here changes how a fight plays.
// In online co-op a foe weighs each hero in the arena by distance and by how many other foes are already on them, so a
// crowd splits between the two, and it sticks with its pick unless the other hero is much nearer.

import { G, enemies } from '../state.js';
import { rand } from '../utils.js';
import { TARGET } from '../data/coop.js';
import { players, localPlayer, targetable } from '../player/players.js';

// a foe in the middle of an attack keeps its target until the blow is done
const COMMITTED = { windup: 1, strike: 1, lungewind: 1, lunge: 1, leapwind: 1, leap: 1, fuse: 1, lock: 1, order: 1 };

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function score(e, p){
  let on = 0;
  for (const o of enemies) if (o !== e && !o.dead && o.hero === p) on++;
  return flat(e.group.position, p.pos) + on * TARGET.crowd - (e.hero === p ? TARGET.stick : 0);
}

export function heroFor(e){
  if (players.length === 1 || e.converted){ e.hero = localPlayer; return localPlayer; }
  const cur = e.hero && players.includes(e.hero) ? e.hero : null;
  if (cur && COMMITTED[e.state] && targetable(cur)) return cur;
  let due = !cur || !targetable(cur) || G.gt >= (e.heroCheck || 0);
  if (!due){
    const d = flat(e.group.position, cur.pos);
    for (const p of players) if (p !== cur && targetable(p) && flat(e.group.position, p.pos) < d - TARGET.swap){ due = true; break; }
  }
  if (!due) return cur;
  e.heroCheck = G.gt + rand(TARGET.recheck[0], TARGET.recheck[1]);
  let best = null, bs = Infinity;
  for (const p of players){
    if (!targetable(p)) continue;
    const s = score(e, p);
    if (s < bs){ bs = s; best = p; }
  }
  // everyone down: stay on (or come back to) this browser's hero, where the downed rules already hold the blades off
  e.hero = best || localPlayer;
  return e.hero;
}

// where a foe's hero stands (for code that only has the foe)
export const heroPosOf = (e) => (e.hero && players.includes(e.hero) ? e.hero : localPlayer).pos;
