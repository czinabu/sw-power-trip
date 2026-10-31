// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LEARN BY DOING: what a run earns in the fight itself, without stopping it.
//  · MASTERY — every power you own ranks up from using it in a fight (data/mastery.js `uses`). No XP, no screen: a
//    small note in the corner names what changed.
//  · SKILL POINTS — one for each wave cleared, plus one now and then for skilled defence (parries, perfect dodges,
//    clashes, catches, ripostes). A point is only noted mid-fight; it is spent on the upgrade page (ui/store-ui.js),
//    which opens once at a chapter's close (every SURVIVAL_EVERY waves in survival).

import { S } from '../audio/sfx.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { G, shared, enemies } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { masterySet, masteryRank } from '../data/mastery.js';

export const SURVIVAL_EVERY = 3;     // survival: the upgrade page opens every 3rd wave cleared
const FEATS_PER_POINT = 25;          // skilled answers to a blow that add up to a bonus skill point
const FEAT_KINDS = { parry: 1, perfectDodge: 1, clash: 1, catch: 1, riposte: 1 };   // (bolt parries are too common to count)
const RANK_NUM = ['', 'I', 'II', 'III'];

// the training grounds and the sandbox hand powers out; every real fight (campaign, survival, missions, co-op) teaches
const learning = () => G.mode === 'play' && !G.training && !G.sandbox;
// a cast only teaches when there is something to use it on
function inFight(){
  if (shared.boss && shared.boss.hp > 0) return true;
  for (const e of enemies) if (!e.dead && !e.converted) return true;
  return false;
}

/* ---------------- corner notes ---------------- */
let toastWrap = null;
export function upToast(head, line, kind){
  if (!toastWrap) toastWrap = document.getElementById('uptoasts');
  if (!toastWrap) return;
  const t = document.createElement('div');
  t.className = 'uptoast ' + (kind || '');
  t.innerHTML = '<b></b><span></span>';
  t.firstChild.textContent = head; t.lastChild.textContent = line || '';
  toastWrap.appendChild(t);
  while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
}

// first-sighting foe tips: one corner note at a time, queued so a mixed wave never stacks them, and kept to a sentence
const foeQ = [];
let foeBusy = false;
function nextFoeTip(){
  const n = foeQ.shift();
  if (!n){ foeBusy = false; return; }
  foeBusy = true;
  upToast(n[0], n[1], 'foe');
  setTimeout(nextFoeTip, 5000);
}
export function foeTipToast(head, line){
  const short = (line || '').split(/(?<=[.!?]) /)[0];
  foeQ.push([head, short]);
  if (!foeBusy) nextFoeTip();
}

/* ---------------- mastery by use ---------------- */
const masteryOf = (id) => masterySet().find(m => m.id === id);
// rank II also waits for its `r2` wave, so an early power still can't be maxed in the first level
const rankOpen = (m, rank) => rank < 1 || m.r2 == null || (G.waveTotal || 0) >= m.r2;
export function masteryUses(id){ return (G.masteryUse && G.masteryUse[id]) || 0; }
// how far the next rank is: { need, have, open } (need is the total uses that rank asks for), or null when maxed
export function masteryNext(m){
  const r = masteryRank(m.id);
  if (r >= m.ranks.length) return null;
  return { rank: r, need: m.uses[r], have: Math.min(masteryUses(m.id), m.uses[r]), open: rankOpen(m, r) };
}
function rankUp(m){
  const r = masteryRank(m.id);
  if (!G.mastery) G.mastery = {};
  G.mastery[m.id] = r + 1;
  const pp = playerPos();
  floater(pp, m.nm + ' ' + RANK_NUM[r + 1], '#ffd24a');
  burst(pp.clone().setY(1.6), 0xffd24a, 12, 5, 4);
  S.reward(r + 1 >= m.ranks.length ? 2 : 1);
  upToast(m.nm + ' MASTERED ' + RANK_NUM[r + 1], m.ranks[r].ds, 'mast');
}
function settle(m){
  const n = masteryNext(m);
  if (n && n.open && masteryUses(m.id) >= n.need){ rankUp(m); settle(m); }
}
// a power was used (player/jedi/force.js, player/mando/gadgets.js …). id is its mastery id (data/mastery.js)
export function trainAbility(id){
  if (!learning() || !inFight()) return;
  const m = masteryOf(id);
  if (!m || !m.owned() || !masteryNext(m)) return;
  if (!G.masteryUse) G.masteryUse = {};
  G.masteryUse[id] = masteryUses(id) + 1;
  settle(m);
}
// a held power (the flamethrower) teaches by the second it spends on foes
let heldT = {};
export function trainHeld(id, dt){
  heldT[id] = (heldT[id] || 0) + dt;
  if (heldT[id] >= 1){ heldT[id] -= 1; trainAbility(id); }
}
// a rank II that was earned before its wave opened lands as soon as it does (called at each wave clear)
export function settleMastery(){ for (const m of masterySet()) if (m.owned()) settle(m); }

/* ---------------- skill points ---------------- */
// one wave cleared (campaign, survival, a mission chapter): +1 point, a note in the corner instead of a screen
export function earnWavePoint(){
  G.skillPoints = (G.skillPoints || 0) + 1;
  if (G.endless) G.boonsOwed = (G.boonsOwed || 0) + 1;   // a survival wave also owes a boon pick
  settleMastery();
  return G.skillPoints;
}
// say what the clear earned, unless the upgrade page is about to open anyway
export function noteWavePoint(){
  const sp = G.skillPoints || 0;
  const when = G.endless ? 'Spend it after wave ' + (Math.ceil(((G.endlessWave || 0) + 1) / SURVIVAL_EVERY) * SURVIVAL_EVERY)
    : 'Spend ' + (sp > 1 ? 'them' : 'it') + ' when the chapter ends';
  upToast(sp > 1 ? sp + ' SKILL POINTS READY' : 'SKILL POINT READY', when, 'sp');
}
// skilled defence (progression.js masteryXp): every FEATS_PER_POINT of them is a bonus point, at most one per wave
export function noteFeat(kind){
  if (!FEAT_KINDS[kind] || !learning() || (G.mission && G.chapter < 0)) return;   // (a lone mission has no page to spend on)
  G.feats = (G.feats || 0) + 1;
  if (G.feats < FEATS_PER_POINT || G.featWave === G.waveTotal) return;
  G.feats = 0; G.featWave = G.waveTotal;
  G.skillPoints = (G.skillPoints || 0) + 1;
  upToast('YOUR DISCIPLINE GROWS', '+1 skill point for your defence', 'sp');
}
// a fresh run
export function resetUpgrades(){ G.masteryUse = {}; G.feats = 0; G.featWave = null; G.boonsOwed = 0; heldT = {}; }
