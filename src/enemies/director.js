// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Attack tokens: decides which melee foes may close in and swing, and how many ranged foes may fire at once.

import { ENGAGE } from '../data/enemies.js';
import { rand } from '../utils.js';
import { G, enemies } from '../state.js';
import { fwd, playerPos } from '../player/helpers.js';
import { navDist, navClass } from './nav.js';
import { GRENADE } from '../data/tactics.js';
import { assignApproach } from './tactics.js';

// hostile melee foes that take turns (bombers rush regardless; the Warbringer runs its own leap pattern)
export const usesToken = e => !e.converted && !e.dead && !e.t.ranged && !e.t.bomber && !e.warbringer;
const ACTIVE = { windup: 1, strike: 1 };
const LOST = { stagger: 1, knockdown: 1, getup: 1, ragdoll: 1, stasis: 1, fade: 1 };

// ATTACK TURNS: one or two melee foes at a time, by difficulty, never more
export function meleeSlots(){
  return Math.max(1, Math.min(ENGAGE.maxSlots, ENGAGE.meleeSlots[G.diff] ?? ENGAGE.meleeSlots.knight));
}
const handoff = () => ENGAGE.handoff[G.diff] ?? ENGAGE.handoff.knight;
let held = 0, gapUntil = 0;   // tokens held this frame · no new turn is handed out before this game time

// once per frame, before the AI runs: drop tokens from foes that can't use them, then hand free ones to the
// closest waiting foes
export function updateDirector(dt){
  const pp = playerPos();
  held = 0;
  if (gapUntil > G.gt + 5) gapUntil = 0;   // the clock restarted with a new run
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
  if (free <= 0 || !waiting.length || G.gt < gapUntil) return;
  waiting.sort((a, b) => a.d - b.d);
  // one foe steps in per beat, so two free slots still fill one after the other
  grant(waiting[0].e);
  if (free > 1) gapUntil = G.gt + handoff() * 0.5;
}
function grant(e){ e.token = true; e.tokenT = 0; held++; assignApproach(e); }

export function dropToken(e, rest){
  e.token = false; e.tokenT = 0;
  if (rest) e.tokenRest = rand(ENGAGE.tokenRest[0], ENGAGE.tokenRest[1]);
  gapUntil = G.gt + handoff();   // a breath before the next one steps in
}

// a swing that comes outside the queue (a riposte, a feint's real follow-up) still needs a turn: keep the one this
// foe holds, or take a free one at once. False means the slots are full and it backs off instead
export function claimToken(e){
  if (e.token) return true;
  if (!usesToken(e) || held >= meleeSlots()) return false;
  grant(e);
  return true;
}

// a ranged foe may start a wind-up only while fewer than its class's slots (more late in the run) are already
// aiming: blasters, jet troopers and officers share one pool, marksmen and grenadiers each have their own
const fireClass = t => t.sniper ? 'sniper' : t.grenade ? 'grenade' : 'line';
export function rangedSlotFree(t){
  const c = fireClass(t);
  let n = 0;
  for (const e of enemies) if (!e.dead && !e.converted && e.t.ranged && e.state === 'windup' && fireClass(e.t) === c) n++;
  const late = (G.waveTotal || 0) >= ENGAGE.lateAt;
  const cap = c === 'sniper' ? (late ? ENGAGE.sniperSlotsLate : ENGAGE.sniperSlots)
    : c === 'grenade' ? (late ? GRENADE.slotsLate : GRENADE.slots)
    : (late ? ENGAGE.rangedSlotsLate : ENGAGE.rangedSlots);
  return n < cap;
}

// is this spot behind the camera? swings wound up there get a longer, fairer tell
export function behindCamera(pos){
  const pp = playerPos(), f = fwd();
  const dx = pos.x - pp.x, dz = pos.z - pp.z, l = Math.hypot(dx, dz) || 1;
  return (dx*f.x + dz*f.z) / l < -0.25;
}
