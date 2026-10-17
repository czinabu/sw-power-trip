// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// XP, skill and store helpers, survival power-up purchases.

import { S } from '../audio/sfx.js';
import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { G, player } from '../state.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { TIER_REQ, TIER_NAME, SKILLS, TIER_NAME_MANDO, MANDO_SKILLS } from '../data/skills.js';
import { MANDO_STORE, JEDI_STORE } from '../data/store.js';
import { masterySet, masteryRank } from '../data/mastery.js';
import { renderProgress } from '../ui/store-ui.js';
import { MASTERY_XP } from '../data/difficulty.js';

export function skillSet(){ return G.hero === 'mando' ? MANDO_SKILLS : SKILLS; }
export function tierName(t){ return (G.hero === 'mando' ? TIER_NAME_MANDO : TIER_NAME)[t]; }
export function skillRank(id){ return (player.skills && player.skills[id]) || 0; }
function skillReq(s){ return s.req != null ? s.req : TIER_REQ[s.tier]; }
function tierUnlocked(tier){ return G.skillSpent >= TIER_REQ[tier]; }
export function skillEligible(s){ return G.skillSpent >= skillReq(s) && skillRank(s.id) < s.max && (!s.avail || s.avail()); }

/* ============================================================
   XP & PROGRESSION STORE — earn XP in combat, spend it between waves
   ============================================================ */
export function gainXp(n){
  if (G.endless){ if (G.mut === 'windfall') n *= 2; else if (G.mut === 'frenzy') n *= 1.5; }   // mutator XP bonuses
  n = Math.round(n);
  if (n <= 0) return;
  G.xp = (G.xp || 0) + n;
  G.xpEarned = (G.xpEarned || 0) + n;
  const el = document.getElementById('xpval'); if (el) el.textContent = G.xp;
}
// kill-streak XP multiplier — 1× cold, ramping to 3× on a hot streak (rewards aggressive play)
export function killBonus(){ return 1 + clamp((G.streak || 0) * 0.12, 0, 2); }
// MASTERY XP — a parry, perfect dodge, clash, catch or riposte pays a small bounty on the spot (×1–3 on a streak)
export function masteryXp(kind){
  if (G.training || !MASTERY_XP[kind]) return;
  gainXp(MASTERY_XP[kind] * killBonus());
}
// WAVE CLEAR — the wave's XP, plus a bonus share of it when the wave was fought cleanly (no hit taken, or little)
export function payWaveClear(clearXp){
  gainXp(clearXp);
  const flawless = !(G.waveHits > 0), clean = !flawless && (G.waveDmg || 0) < maxHp() * MASTERY_XP.cleanHp;
  if (G.training || !(flawless || clean)) return;
  const bonus = Math.round(clearXp * (flawless ? MASTERY_XP.flawless : MASTERY_XP.clean));
  gainXp(bonus);
  if (G.stats) G.stats[flawless ? 'flawless' : 'cleanWaves']++;
  const pp = playerPos();
  floater(V3(pp.x, 2.4, pp.z), (flawless ? 'FLAWLESS' : 'CLEAN') + ' WAVE  +' + bonus + ' XP', flawless ? '#ffd24a' : '#8fe0ff');
}
// abilities open by TIER, gated by how deep into the run you are (waveTotal) — so power arrives in waves
const STORE_TIER_STAGE = { 1: 0, 2: 1, 3: 3, 4: 6, 5: 8 };   // waveTotal each tier opens — earlier = snappier pacing
function storeTierOpen(tier){ return (G.waveTotal || 0) >= (STORE_TIER_STAGE[tier] || 0); }

// JETPACK PROGRESSION — starts WEAK & short (very limiting early); boosters add real lift & a bigger tank
export function applyJetTier(){
  const t = player.up.jetTier || 0;
  player.up.jetPow = [0.5, 0.82, 1.12, 1.35][t] || 0.5;     // climb power & lift (tier 0 barely gets you off the ground)
  player.jetMax   = [40, 72, 100, 130][t] || 40;            // fuel tank (tier 0 is a short burst)
  player.up.jetHoverMul = [1.7, 1.15, 0.85, 0.6][t] || 1.7; // HOVER fuel burn — punishing early, efficient once upgraded
  player.jet = Math.min(player.jetMax, Math.max(player.jet, player.jetMax * 0.6));
}

// helper: does a fork sibling already own the slot? (buying one weapon locks the other)
function forkTaken(node, set){ return !!node.fork && set.some(n => n !== node && n.fork === node.fork && n.owned()); }
export function storeSet(){ return G.hero === 'mando' ? MANDO_STORE : JEDI_STORE; }
// a node opens at its own `stage` (cumulative waves) if set, else by its tier's stage. lets each fork land at a precise wave.
function storeStageOpen(n){ const s = (n.stage != null) ? n.stage : (STORE_TIER_STAGE[n.tier] || 0); return (G.waveTotal || 0) >= s; }
export function storeAvail(n){ return !n.owned() && storeStageOpen(n) && (!n.avail || n.avail()) && !forkTaken(n, storeSet()); }
// is any ability still to come this run (not owned, not locked out by a fork pick)? — even if its wave hasn't arrived yet
export function storeRemaining(){ const set = storeSet(); return set.some(n => !n.owned() && (!n.avail || n.avail()) && !forkTaken(n, set)); }
// POWER MASTERY — the next rank of every ability you own, as { m, rank, cost, open, opensAt } (rank is 0 for rank I).
// rank II waits for its `r2` wave; until then the offer is listed but closed (opensIn = waves still to clear).
function masteryOpen(m, rank){ return rank < 1 || m.r2 == null || (G.waveTotal || 0) >= m.r2; }
export function masteryOffers(){
  const out = [];
  for (const m of masterySet()){
    const r = masteryRank(m.id);
    if (m.owned() && r < m.ranks.length) out.push({ m, rank: r, cost: m.cost[r], open: masteryOpen(m, r), opensIn: Math.max(1, (m.r2 || 0) - (G.waveTotal || 0)) });
  }
  return out;
}
export function buyMastery(o){
  if (!G.skillSelect || (G.xp||0) < o.cost || masteryRank(o.m.id) !== o.rank || !o.m.owned() || !masteryOpen(o.m, o.rank)) return;
  if (!G.mastery) G.mastery = {};
  G.xp -= o.cost; G.mastery[o.m.id] = o.rank + 1;
  floater(playerPos(), o.m.nm + ' ' + RANK_NUM[o.rank + 1] + '!', '#ffd24a');
  burst(playerPos().clone().setY(1.6), 0xffd24a, 14, 6, 5);
  S.reward(o.rank + 1 >= o.m.ranks.length ? 2 : 1);
  document.getElementById('xpval').textContent = G.xp; renderProgress();
}
export const RANK_NUM = ['', 'I', 'II', 'III'];
// the cheapest thing XP can still buy (an ability or a mastery rank) — drives the bottom XP meter. { nm, cost }
export function nextStoreGoal(){
  let best = null;
  for (const n of storeSet()){
    if (n.cost <= 0 || !storeAvail(n)) continue;
    if (!best || n.cost < best.cost) best = { nm: n.nm, cost: n.cost };
  }
  for (const o of masteryOffers())
    if (o.open && (!best || o.cost < best.cost)) best = { nm: o.m.nm + ' ' + RANK_NUM[o.rank + 1], cost: o.cost };
  return best;
}
export function powerLv(id){ return (G.powerLv && G.powerLv[id]) || 0; }
export function powerCost(p){ return 180 + powerLv(p.id) * 90; }   // each power keeps its OWN rising price & level
export function buyPower(p){
  const cost = powerCost(p);
  if (!G.skillSelect || (G.xp||0) < cost) return;
  if (!G.powerLv) G.powerLv = {};
  G.xp -= cost; G.powerLv[p.id] = powerLv(p.id) + 1; p.apply();
  floater(playerPos(), p.nm + ' ×' + G.powerLv[p.id] + '!', '#ffd24a'); burst(playerPos().clone().setY(1.6), 0xffd24a, 12, 6, 5);
  S.reward(1); document.getElementById('xpval').textContent = G.xp; renderProgress();
}
