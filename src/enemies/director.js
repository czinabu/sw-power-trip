// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Attack tokens: decides which melee foes may close in and swing, and how many ranged foes may fire at once.

import { ENGAGE } from '../data/enemies.js';
import { rand } from '../utils.js';
import { G, enemies } from '../state.js';
import { fwd, playerPos } from '../player/helpers.js';
import { navDist, navClass } from './nav.js';
import { GRENADE } from '../data/tactics.js';
import { assignApproach } from './tactics.js';
import { players, localPlayer } from '../player/players.js';

// hostile melee foes that take turns (bombers rush regardless; the Warbringer runs its own leap pattern)
// (a trooper busy with one of the hero's squadmates, allies/squad.js, is out of the queue until it turns back)
export const usesToken = e => !e.converted && !e.onAlly && !e.dead && !e.t.ranged && !e.t.bomber && !e.warbringer;
const ACTIVE = { windup: 1, strike: 1 };
const LOST = { stagger: 1, knockdown: 1, getup: 1, ragdoll: 1, stasis: 1, fade: 1 };

// ATTACK TURNS: one or two melee foes at a time, by difficulty, never more
export function meleeSlots(){
  return Math.max(1, Math.min(ENGAGE.maxSlots, ENGAGE.meleeSlots[G.diff] ?? ENGAGE.meleeSlots.knight));
}
const handoff = () => ENGAGE.handoff[G.diff] ?? ENGAGE.handoff.knight;
/* one queue per hero: solo there is just this browser's; in online co-op each hero gets their own attack turns, so a
   partner doesn't use up yours. held = tokens held this frame · gap = no new turn is handed out before this game time */
const lanes = new Map();
const laneOf = (e) => { const h = e.hero || localPlayer; let l = lanes.get(h); if (!l) lanes.set(h, l = { held: 0, gap: 0 }); return l; };

// once per frame, before the AI runs: drop tokens from foes that can't use them, then hand free ones to the
// closest waiting foes
export function updateDirector(dt){
  for (const [h, l] of lanes){
    if (!players.includes(h)){ lanes.delete(h); continue; }   // a partner who left
    l.held = 0; l.waiting = null;
    if (l.gap > G.gt + 5) l.gap = 0;   // the clock restarted with a new run
  }
  for (const e of enemies){
    if (e.tokenRest > 0) e.tokenRest -= dt;
    if (!usesToken(e) || LOST[e.state]){ if (e.token) dropToken(e); continue; }
    const l = laneOf(e);
    if (e.token && e.tokenLane !== l){ dropToken(e); continue; }   // it turned to the other hero: that turn was for this one
    if (e.token){
      e.tokenT += dt;
      // a holder that never got its swing off (blocked, kited, boxed in) gives way so the queue keeps moving
      if (e.tokenT > ENGAGE.tokenHold && !ACTIVE[e.state]){ dropToken(e); continue; }
      l.held++;
    } else if (e.state === 'chase' && !(e.tokenRest > 0)){
      // closest by WALKING distance, so a foe right behind a wall doesn't take a turn it can't use
      // (the walking field leads to this browser's hero: a partner's queue goes by straight-line distance)
      const h = e.hero || localPlayer, pp = h.pos, p = e.group.position, dx = p.x - pp.x, dz = p.z - pp.z;
      let d = Math.sqrt(dx*dx + dz*dz);
      if (h.local){ const walk = navDist(p.x, p.z, navClass(0.7 * (e.t.scale || 1))); d = Number.isFinite(walk) ? Math.max(walk, d) : d + 20; }
      (l.waiting ||= []).push({ e, d });
    }
  }
  for (const l of lanes.values()){
    const free = meleeSlots() - l.held;
    if (free <= 0 || !l.waiting || G.gt < l.gap) continue;
    l.waiting.sort((a, b) => a.d - b.d);
    // one foe steps in per beat, so two free slots still fill one after the other
    grant(l.waiting[0].e);
    if (free > 1) l.gap = G.gt + handoff() * 0.5;
  }
}
function grant(e){ const l = laneOf(e); e.token = true; e.tokenT = 0; e.tokenLane = l; l.held++; assignApproach(e); }

export function dropToken(e, rest){
  e.token = false; e.tokenT = 0;
  if (rest) e.tokenRest = rand(ENGAGE.tokenRest[0], ENGAGE.tokenRest[1]);
  (e.tokenLane || laneOf(e)).gap = G.gt + handoff();   // a breath before the next one steps in
  e.tokenLane = null;
}

// a swing that comes outside the queue (a riposte, a feint's real follow-up) still needs a turn: keep the one this
// foe holds, or take a free one at once. False means the slots are full and it backs off instead
export function claimToken(e){
  if (e.token) return true;
  if (!usesToken(e) || laneOf(e).held >= meleeSlots()) return false;
  grant(e);
  return true;
}

// a ranged foe may start a wind-up only while fewer than its class's slots (more late in the run) are already
// aiming: blasters, jet troopers and officers share one pool, marksmen and grenadiers each have their own
const fireClass = t => t.sniper ? 'sniper' : t.grenade ? 'grenade' : 'line';
// (each hero has their own pool in online co-op: `hero` is who this one would fire at)
export function rangedSlotFree(t, hero = localPlayer){
  const c = fireClass(t);
  let n = 0;
  for (const e of enemies) if (!e.dead && !e.converted && !e.onAlly && e.t.ranged && e.state === 'windup' && fireClass(e.t) === c && (e.hero || localPlayer) === hero) n++;   // fire at the squad doesn't use your slots
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
