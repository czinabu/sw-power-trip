// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The upgrade page: one tab-free page at a chapter's close (every few waves in survival), never mid-chapter.

import { renderer } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, player, isGunner } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { syncMandoChips, syncJediChips, chapterClosed } from '../game/flow.js';
import {
  skillSet, tierName, skillRank, skillEligible, storeSet, storeAvail, storeRemaining, powerLv, powerCost,
  buyPower, RANK_NUM, storeCost, grantStoryPowers, tierStoryOpen
} from '../game/progression.js';
import { masteryNext, masteryUses, SURVIVAL_EVERY, storyRun, xpTowardPoint, XP_PER_POINT, upToast } from '../game/upgrades.js';
import { masterySet, masteryRank } from '../data/mastery.js';
import { chapterLabel } from '../game/campaign.js';
import { FORMS, FORM_PATH } from '../data/forms.js';
import { stanceUnlocked } from '../data/stances.js';
import { storeAbilityCard } from './ability-card.js';
import { TIER_REQ, TIER_CHAPTER } from '../data/skills.js';
import { ENDLESS_POWERS } from '../data/store.js';
import { LEVELS } from '../data/levels.js';
import { icon } from './icons.js';
import { BOON_BY_ID } from '../data/boons.js';
import { rollBoons, pickBoon } from '../game/boons.js';

let progFreeCards = [];   // the 3 free-upgrade cards chosen for this visit (stable across re-renders)
function rollFreeCards(){
  const SET = skillSet();
  const pool = SET.filter(skillEligible);
  const pick = [];
  // SUSTAIN CHOICE must be VISIBLE the same wave as its store counterpart (Bacta Stim / Force Mend), not just
  // eligible. Pass 58 synced the two `avail()` gates to the same wave stage, but the skill-tree offer is a random
  // draw of 3 from the whole eligible pool — a player could keep buying other cards for several waves while Creed/
  // Vampiric Blade sits eligible but simply never gets rolled, then buy the always-visible store item with no idea
  // the tradeoff card ever existed. PIN it into the offer instead of leaving it to chance, every wave it's eligible,
  // until the player resolves the choice (buying either one makes the loser ineligible and it drops out normally).
  const sustainId = isGunner() ? 'creed' : 'vamp';
  const sustainIdx = pool.findIndex(s => s.id === sustainId);
  if (sustainIdx >= 0){ pick.push(pool[sustainIdx]); pool.splice(sustainIdx, 1); }
  // NEWEST TIER GUARANTEED — one card always comes from the highest tier you've opened, so a fresh KNIGHT or
  // MASTER tier shows up the visit it unlocks instead of hiding behind random Padawan draws.
  pool.sort(() => Math.random() - 0.5);
  const top = Math.max(0, ...pool.map(s => s.tier));
  if (pick.length < 3 && !pick.some(s => s.tier === top)){
    const i = pool.findIndex(s => s.tier === top);
    if (i >= 0){ pick.push(pool[i]); pool.splice(i, 1); }
  }
  while (pick.length < 3 && pool.length) pick.push(pool.shift());
  pick.sort((a, b) => a.tier - b.tier);
  progFreeCards = pick;
}
// open the upgrade page, if there is anything on it to take (skill points earned since the last one come from
// game/upgrades.js earnWavePoint). Returns whether it opened; with nothing to take the run simply goes on.
export function openSkillTree(){
  if (G.mode !== 'play') return false;
  // BOONS are SURVIVAL-ONLY — they snowball power too fast for the authored campaign (which uses the XP store + skill tree).
  // Each wave cleared owes one pick; the page deals them one offer at a time (pickNextBoon).
  if (G.endless && (G.boonsOwed || 0) > 0){ G.boonsOwed--; G.boonOffer = rollBoons(); G.boonPicked = false; } else { G.boonOffer = null; }
  // the story hands over the single powers its chapter brings (a fork pair stays a free pick on the page)
  grantedNow = grantStoryPowers();
  for (const n of grantedNow) storeAbilityCard(n);
  if (grantedNow.length){ if (isGunner()) syncMandoChips(); else syncJediChips(); }
  rollFreeCards();
  if (!somethingToTake()){
    if (grantedNow.length) upToast('NEW POWER', grantedNow.map(n => n.nm).join(' · '), 'mast');
    return false;
  }
  G.skillSelect = true;
  renderProgress();
  document.getElementById('skilltree').style.display = 'flex';
  document.getElementById('skilltree').querySelector('.st-scroll').scrollTop = 0;
  document.getElementById('banner').style.opacity = '0';
  document.exitPointerLock();      // free the cursor so the cards are clickable
  return true;
}
let grantedNow = [];   // the powers this chapter's close just handed over, shown at the head of NEW POWERS
function somethingToTake(){
  const xp = G.xp || 0;
  if (G.boonOffer && G.boonOffer.length) return true;
  if ((G.skillPoints || 0) > 0 && progFreeCards.length) return true;
  if (grantedNow.length) return true;   // (shown once, so the story's gift doesn't pass unseen)
  if (storeSet().some(n => storeAvail(n) && xp >= storeCost(n))) return true;
  return !!G.endless && ENDLESS_POWERS.some(p => (!p.avail || p.avail()) && xp >= powerCost(p));
}
// a boon was claimed: the next one this visit owes, if any
function pickNextBoon(id){
  pickBoon(id);
  if (G.boonPicked && (G.boonsOwed || 0) > 0){ G.boonsOwed--; G.boonOffer = rollBoons(); G.boonPicked = false; renderProgress(); }
}
// build one upgrade card. opts: cls, tag, ico, nm, ds, cost, afford, why (shown when it can't be taken), onClick, extra
function card(opts){
  const c = document.createElement('div');
  c.className = 'card' + (opts.cls || '') + (opts.afford ? '' : ' cant');
  c.innerHTML = '<div class="c-tag">' + opts.tag + '</div><div class="c-ico">' + icon(opts.ico) + '</div>' +
    '<div class="c-nm">' + opts.nm + '</div><div class="c-ds">' + opts.ds + '</div>' + (opts.extra || '') +
    (opts.cost ? '<div class="' + (opts.costCls || 'c-cost') + '">' + opts.cost + '</div>' : '') +
    (!opts.afford && opts.why ? '<div class="c-why">' + opts.why + '</div>' : '');
  if (opts.afford && opts.onClick) c.addEventListener('click', opts.onClick);
  return c;
}
const needXp = (cost) => 'NEED ' + (cost - (G.xp || 0)) + ' MORE XP';
function bump(id){ const el = document.getElementById(id).parentElement; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
let _lastXp = 0, _lastSp = 0;
const hide = (id, empty) => document.getElementById(id).classList.toggle('empty', empty);
export function renderProgress(){
  const tree = document.getElementById('skilltree');
  const xp = G.xp || 0, sp = G.skillPoints || 0;
  // ---- header: where you are + what you have to spend ----
  const mando = isGunner();
  if (G.endless){
    document.getElementById('stkicker').textContent = 'SURVIVAL';
    tree.querySelector('h1').textContent = 'WAVE ' + Math.max(1, G.endlessWave || 0) + ' SURVIVED';
  } else if (G.chapter >= 0){   // the campaign: the chapter that just closed, in the campaign's own words
    document.getElementById('stkicker').textContent = chapterLabel();
    tree.querySelector('h1').textContent = 'CHAPTER COMPLETE';
  } else {
    const L = LEVELS[G.levelIdx], place = (L.name.split('—')[1] || L.name).trim();
    document.getElementById('stkicker').textContent = place;
    tree.querySelector('h1').textContent = place + ' CLEARED';
  }
  // the Jedi sits in meditation (and sees the forms carried); the Mando works at the forge
  // the forms known, and the ones this chapter has just taught (learned as the next chapter opens: game/meditation.js)
  const sub = tree.querySelector('.sub');
  if (mando) sub.textContent = 'AT THE FORGE';
  else {
    const known = Object.keys(FORMS).filter(id => FORMS[id].ready && stanceUnlocked(id));
    const fresh = G.chapter >= 0 ? FORM_PATH.filter(p => !FORMS[p.form].fork && !known.includes(p.form) && chapterClosed(p.chapter)).map(p => p.form) : [];
    sub.innerHTML = 'MEDITATION' + (known.length ? ' · FORMS: ' + known.map(id => FORMS[id].name).join(' · ') : '') +
      fresh.map(id => ' · <b class="newform">NEW: ' + FORMS[id].name + '</b>').join('');
  }
  // the story spends only skill points: its XP coin shows how far the next one is (game/upgrades.js)
  const story = storyRun();
  document.querySelector('#xpbalance .cl').textContent = story ? 'NEXT SKILL POINT' : 'XP';
  document.getElementById('xpbalval').textContent = story ? xpTowardPoint() + ' / ' + XP_PER_POINT : xp;
  document.getElementById('spbalval').textContent = sp;
  document.getElementById('spbalval').parentElement.classList.toggle('has', sp > 0);
  if (xp !== _lastXp) bump('xpbalval');
  if (sp !== _lastSp) bump('spbalval');
  _lastXp = xp; _lastSp = sp;
  // ---- BOON CHOICE (survival: free, one pick per wave clear) — the run's build layer ----
  const booncards = document.getElementById('booncards');
  booncards.innerHTML = '';
  if (!G.boonPicked && G.boonOffer && G.boonOffer.length){
    hide('boonsec', false);
    for (const id of G.boonOffer){ const b = BOON_BY_ID[id]; if (!b) continue;
      booncards.appendChild(card({ cls:' boon '+b.r, tag: b.r==='legendary'?'LEGENDARY':b.r==='rare'?'RARE':'COMMON',
        ico:b.ico, nm:b.nm, ds:b.ds, cost:'CLAIM FREE', afford:true, onClick:()=>pickNextBoon(id) })); }
    const more = G.boonsOwed || 0;
    document.getElementById('boonhelp').textContent = 'Pick one, free' + (more ? ' · ' + more + ' more after this' : '');
  } else hide('boonsec', true);
  // ---- ABILITIES (spend XP) — fork pairs sit side by side joined by an OR; the final glows red ----
  const store = document.getElementById('storecards');
  store.innerHTML = '';
  let group = null, groupFork = null;
  // what the chapter just handed over: already yours, shown first
  for (const n of grantedNow) store.appendChild(card({ cls: ' got' + (n.final ? ' final' : ''), tag: 'LEARNED', ico: n.ico, nm: n.nm, ds: n.ds, cost: 'YOURS', afford: true }));
  for (const n of storeSet()){
    if (!storeAvail(n)) continue;
    const price = storeCost(n), free = price <= 0, afford = free || xp >= price;
    const el = card({
      cls: (n.fork ? ' fork' : '') + (n.final ? ' final' : ''),
      tag: n.final ? 'FINAL UPGRADE' : n.fork ? (free ? 'CHOOSE ONE' : 'CHOOSE ONE') : 'ABILITY',
      ico: n.ico, nm: n.nm, ds: n.ds,
      cost: free ? (n.fork ? 'TAKE THIS ONE' : 'CLAIM FREE') : price + ' XP',
      afford, why: needXp(price),
      onClick: () => buyStore(n),
    });
    if (n.fork && n.fork === groupFork){ const or = document.createElement('div'); or.className = 'or'; or.textContent = 'OR'; group.append(or, el); continue; }
    if (n.fork){ group = document.createElement('div'); group.className = 'forkgroup'; group.appendChild(el); store.appendChild(group); groupFork = n.fork; }
    else { store.appendChild(el); group = null; groupFork = null; }
  }
  // unwrap a "group" of one (its sibling isn't on offer this visit) so it doesn't carry an empty OR frame
  for (const g of [...store.querySelectorAll('.forkgroup')]) if (g.children.length === 1) g.replaceWith(g.firstChild);
  if (!store.children.length) store.innerHTML = '<div class="empty">' +
    (storeRemaining() ? (storyRun() ? 'More powers come as the story goes on.' : 'More powers open as the fight goes on.') : 'Every power is yours.') + '</div>';
  hide('abilsec', storyRun() && !store.querySelector('.card'));   // the story: only when a chapter brings something
  document.querySelector('#abilsec .sh-h').textContent = storyRun() ? 'Given by the story · a pair is a free choice, the other closes for this run'
    : 'Spend XP · paired cards are a choice, the other locks for this run';
  document.getElementById('storehdr').textContent = mando ? 'NEW GEAR' : 'NEW POWERS';
  // ---- SURVIVAL POWER-UPS — repeatable stat upgrades (endless only): an XP sink that never runs out ----
  const pow = document.getElementById('powcards');
  pow.innerHTML = '';
  if (G.endless){
    for (const p of ENDLESS_POWERS){
      if (p.avail && !p.avail()) continue;
      const lv = powerLv(p.id), pc = powerCost(p);
      pow.appendChild(card({ cls:' power', tag: lv > 0 ? 'POWER · LEVEL ' + lv : 'POWER', ico:p.ico, nm:p.nm, ds:p.ds,
        cost: pc + ' XP', afford: xp >= pc, why: needXp(pc), onClick: () => buyPower(p) }));
    }
  }
  hide('powsec', !pow.children.length);
  // ---- MASTERY — read-only: each power you own and how far its next rank is (earned by use, game/upgrades.js) ----
  const mast = document.getElementById('masterycards');
  mast.innerHTML = '';
  for (const m of masterySet()){
    if (!m.owned()) continue;
    const r = masteryRank(m.id), nx = masteryNext(m), prev = r > 0 ? m.uses[r - 1] : 0;
    const frac = nx ? Math.min(1, (masteryUses(m.id) - prev) / Math.max(1, nx.need - prev)) : 1;
    const line = !nx ? 'Fully mastered' : !nx.open ? 'Rank ' + RANK_NUM[r + 1] + ' opens later in the run'
      : 'Rank ' + RANK_NUM[r + 1] + ': ' + m.ranks[r].ds + ' · ' + Math.max(0, nx.need - masteryUses(m.id)) + ' more uses';
    // a slim chip: name, rank, a thin bar; what the next rank does is on hover
    const row = document.createElement('div');
    row.className = 'mchip' + (nx ? '' : ' max');
    row.title = line;
    row.innerHTML = '<span class="mi">' + icon(m.ico) + '</span><b>' + m.nm + '</b><span class="rk">' + (r ? RANK_NUM[r] : '') + '</span>' +
      '<div class="mbar"><i style="width:' + Math.round(frac * 100) + '%"></i></div>';
    mast.appendChild(row);
  }
  hide('mastsec', !mast.children.length);
  // ---- TRAINING (spend SKILL POINTS) — a separate track, never gated by ability choice ----
  const wrap = document.getElementById('skillcards');
  wrap.innerHTML = '';
  document.getElementById('freehdr').textContent = mando ? 'WEAPON UPGRADES' : 'TRAINING';
  // what training opens next — "KNIGHT opens after 1 more" — so the tier gate reads as a goal, not a mystery
  const spent = G.skillSpent || 0, nextT = [2, 3].find(t => spent < TIER_REQ[t] || !tierStoryOpen(t));
  const gate = !nextT ? '' : !tierStoryOpen(nextT) ? ' · ' + tierName(nextT) + ' opens in Act ' + (TIER_CHAPTER[nextT] === 'mustafar' ? 'III' : 'II')
    : ' · ' + tierName(nextT) + ' opens after ' + (TIER_REQ[nextT] - spent) + ' more';
  document.getElementById('freehelp').textContent = (sp > 0
    ? 'Spend skill points · ' + sp + ' to spend'
    : 'Spend skill points · ' + (storyRun() ? 'every ' + XP_PER_POINT + ' XP earns one' : 'you earn one each wave cleared')) + gate;
  for (const s of progFreeCards){
    const r = skillRank(s.id);
    const spent = r >= s.max;
    const lockedOut = !spent && s.avail && !s.avail();   // a rival pick (e.g. the heal path) closed this off
    const pips = s.max > 1 ? '<div class="pips">' + '<i class="on"></i>'.repeat(r) + '<i></i>'.repeat(s.max - r) + '</div>' : '';
    const rankTag = r > 0 ? '<span class="rk">' + ['','II','III','IV'][r] + '</span>' : '';
    const why = lockedOut ? 'LOCKED · you chose the other heal path' : spent ? 'FULLY TRAINED' : 'NO SKILL POINTS';
    wrap.appendChild(card({
      cls: ' skill t' + s.tier, tag: tierName(s.tier) + (s.tier === 3 ? ' · CAPSTONE' : ''),
      ico: s.ico, nm: s.nm + rankTag, ds: s.ds,
      extra: (lockedOut ? '' : '<div class="c-fl">“' + s.fl + '”</div>') + pips,
      cost: '1 SKILL POINT', costCls: 'c-pick',
      afford: sp > 0 && !spent && !lockedOut, why,
      onClick: () => chooseUpgrade(s),
    }));
  }
  if (!progFreeCards.length) wrap.innerHTML = '<div class="empty">Nothing left to train. You have mastered every discipline on offer.</div>';
  document.getElementById('sthint').textContent = (storyRun() ? 'Unspent skill points carry over' : sp > 0 ? 'Unspent XP and skill points carry over' : 'Unspent XP carries over') +
    (G.endless ? ' · this page opens every ' + SURVIVAL_EVERY + ' waves' : ' · this page opens when a chapter ends');
}
function buyStore(n){
  const cost = storeCost(n);
  if (!G.skillSelect || !storeAvail(n) || (G.xp||0) < cost) return;
  G.xp -= cost;
  n.buy();
  storeAbilityCard(n);
  if (isGunner()) syncMandoChips(); else syncJediChips();
  document.getElementById('xpval').textContent = G.xp;
  floater(playerPos(), n.nm + '!', n.final ? '#ff9a6a' : '#7fe0a8');
  burst(playerPos().clone().setY(1.6), n.final ? 0xff7a4a : 0x7fe0a8, 14, 6, 5);
  S.reward(n.final ? 2 : 1);
  renderProgress();
}
function chooseUpgrade(s){
  // respect skillEligible (incl. s.avail) so a card that got LOCKED OUT after a rival pick can't still be clicked
  if (!G.skillSelect || (G.skillPoints||0) <= 0 || !skillEligible(s)) return;
  player.skills[s.id] = skillRank(s.id) + 1;
  G.skillSpent++; G.skillPoints--;
  s.apply();
  floater(playerPos(), s.nm + '!', s.tier === 3 ? '#ffd24a' : '#ffe27a');
  burst(playerPos().clone().setY(1.6), s.tier === 3 ? 0xffd24a : 0x7fd4ff, s.tier*6, 5, 4);
  S.reward(s.tier === 3 ? 2 : 1);
  if (G.skillPoints > 0) rollFreeCards();   // more points to spend: a fresh hand of three
  renderProgress();
}
export function closeProgress(){
  if (!G.skillSelect) return;
  G.skillSelect = false; grantedNow = [];
  document.getElementById('skilltree').style.display = 'none';
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
  // a clear "you're patched up" beat as you drop back in — green motes + a RECOVERED floater
  const pp0 = playerPos();
  burst(V3(pp0.x, 1.3, pp0.z), 0x7bffae, 18, 6, 5, 1.0); burst(V3(pp0.x, 1.1, pp0.z), 0xc8ffd8, 10, 4, 4);
  floater(V3(pp0.x, 1.2, pp0.z), 'RECOVERED', '#7bffae');
  sfx(440, 0.25, 'sine', 0.1, 980);
}
