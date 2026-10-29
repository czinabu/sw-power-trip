// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The shared Survival run, as the two browsers see it (net/foes.js fills it in): what the host's run looks like right now,
// and the hits this browser has landed on the host's foes, waiting to go over the connection. No imports, so the game's
// own modules can read it without a cycle.

/* the host's run, last heard of: on while the host is fighting a Survival run, with its arena and wave */
export const coopRun = { on: false, k: 'e', mid: '', lv: 0, ar: 0, w: 0, wt: 0, ph: '', mut: null,
  live: false,          // this browser is in a shared fight right now: the world keeps going whatever one hero's pause or hitstop does
  guestPicking: false };   // host side: the guest has its upgrade screen open, so the next wave waits

/* hits the guest has landed on puppet foes. A continuous source (the flamethrower, a held Force power) calls damageEnemy
   every frame, so ticks on one foe are summed into one entry; foes.js sends the lot about 20 times a second */
export const hitQueue = [];
export function queueHit(e, dmg, knockDir, knockPow, finisher, tick){
  if (tick){
    const same = hitQueue.find(h => h[0] === e.nid && h[6]);
    if (same){ same[1] += dmg; return; }
  }
  hitQueue.push([e.nid, dmg, knockDir ? +knockDir.x.toFixed(2) : 0, knockDir ? +knockDir.z.toFixed(2) : 0, knockPow || 0, finisher ? 1 : 0, tick ? 1 : 0]);
}

// what the foe code calls to tell the other browser (set by net/foefire.js; null in solo, so nothing changes there)
export const hooks = { hurt: null, bolt: null, bx: null, blast: null, tell: null, gren: null, pbolt: null, xp: null, aim: null, lunge: null, ring: null, bctl: null, bossDead: null, missionDone: null, mbanner: null, power: null };
