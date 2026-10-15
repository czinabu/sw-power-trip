// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Attack tokens: decides which melee foes may close in and swing, and how many ranged foes may fire at once.

import { ENGAGE } from '../data/enemies.js';
import { rand } from '../utils.js';
import { G, enemies } from '../state.js';
import { fwd, playerPos } from '../player/helpers.js';
import { navDist, navClass } from './nav.js';

// hostile melee foes that take turns (bombers rush regardless; the Warbringer runs its own leap pattern)
export const usesToken = e => !e.converted && !e.dead && !e.t.ranged && !e.t.bomber && !e.warbringer;
const ACTIVE = { windup: 1, strike: 1 };
const LOST = { stagger: 1, knockdown: 1, getup: 1, ragdoll: 1, stasis: 1, fade: 1 };

export function meleeSlots(){
  const late = (G.waveTotal || 0) >= ENGAGE.lateAt;
  let n = late ? ENGAGE.meleeSlotsLate : ENGAGE.meleeSlots;
  if (G.endless) n += Math.floor((G.endlessWave || 0) / ENGAGE.survivalSlotEvery);
  n += ENGAGE.diffSlots[G.diff] || 0;
  return Math.max(1, Math.min(ENGAGE.maxSlots, n));
}

// once per frame, before the AI runs: drop tokens from foes that can't use them, then hand free ones to the
// closest waiting foes
export function updateDirector(dt){
  const pp = playerPos();
  let held = 0;
  const waiting = [];
  for (const e of enemies){
    if (e.tokenRest > 0) e.tokenRest -= dt;
    if (!usesToken(e) || LOST[e.state]){ if (e.token) dropToken(e); continue; }
    if (e.token){
      e.tokenT += dt;
      // a holder that never got its swing off (blocked, kited, boxed in) gives way so the queue keeps moving
      if (e.tokenT > ENGAGE.tokenHold && !ACTIVE[e.state]){ dropToken(e); continue; }
      held++;
    } else if (e.state === 'chase' && !(e.tokenRest > 0)){
      // closest by WALKING distance, so a foe right behind a wall doesn't take a turn it can't use
      const p = e.group.position, dx = p.x - pp.x, dz = p.z - pp.z;
      const walk = navDist(p.x, p.z, navClass(0.7 * (e.t.scale || 1)));
      waiting.push({ e, d: Number.isFinite(walk) ? Math.max(walk, Math.sqrt(dx*dx + dz*dz)) : Math.sqrt(dx*dx + dz*dz) + 20 });
    }
  }
  const free = meleeSlots() - held;
  if (free <= 0 || !waiting.length) return;
  waiting.sort((a, b) => a.d - b.d);
  for (let i = 0; i < free && i < waiting.length; i++){ waiting[i].e.token = true; waiting[i].e.tokenT = 0; }
}

export function dropToken(e, rest){
  e.token = false; e.tokenT = 0;
  if (rest) e.tokenRest = rand(ENGAGE.tokenRest[0], ENGAGE.tokenRest[1]);
}

// a ranged foe may start a wind-up only while fewer than its class's slots (more late in the run) are already
// aiming: blasters and jet troopers share one pool, marksmen have their own
export function rangedSlotFree(sniper){
  let n = 0;
  for (const e of enemies) if (!e.dead && !e.converted && e.t.ranged && !!e.t.sniper === !!sniper && e.state === 'windup') n++;
  const late = (G.waveTotal || 0) >= ENGAGE.lateAt;
  return n < (sniper ? (late ? ENGAGE.sniperSlotsLate : ENGAGE.sniperSlots) : (late ? ENGAGE.rangedSlotsLate : ENGAGE.rangedSlots));
}

// is this spot behind the camera? swings wound up there get a longer, fairer tell
export function behindCamera(pos){
  const pp = playerPos(), f = fwd();
  const dx = pos.x - pp.x, dz = pos.z - pp.z, l = Math.hypot(dx, dz) || 1;
  return (dx*f.x + dz*f.z) / l < -0.25;
}
