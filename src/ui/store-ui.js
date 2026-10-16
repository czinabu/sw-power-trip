// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Between-wave skill tree / store / boon overlay.

import { renderer } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { syncMandoChips, syncJediChips } from '../game/flow.js';
import {
  skillSet, tierName, skillRank, skillEligible, storeSet, storeAvail, storeRemaining, powerLv, powerCost,
  buyPower, masteryOffers, buyMastery, RANK_NUM
} from '../game/progression.js';
import { TIER_REQ } from '../data/skills.js';
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
  const sustainId = G.hero === 'mando' ? 'creed' : 'vamp';
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
export function openSkillTree(){
  if (G.mode !== 'play') return;
  G.skillSelect = true;
  G.skillPoints = (G.skillPoints || 0) + 1;   // +1 skill point per wave (weapon-upgrade currency; buy more with XP)
  // BOONS are SURVIVAL-ONLY — they snowball power too fast for the authored campaign (which uses the XP store + skill tree).
  if (G.endless){ G.boonOffer = rollBoons(); G.boonPicked = false; } else { G.boonOffer = null; }
  rollFreeCards();
  renderProgress();
  document.getElementById('skilltree').style.display = 'flex';
  document.getElementById('banner').style.opacity = '0';
  document.exitPointerLock();      // free the cursor so the cards are clickable
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
const opensIn = (n) => 'OPENS IN ' + n + ' MORE WAVE' + (n === 1 ? '' : 'S');
function bump(id){ const el = document.getElementById(id).parentElement; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
let _lastXp = 0, _lastSp = 0;
export function renderProgress(){
  const tree = document.getElementById('skilltree');
  const xp = G.xp || 0, sp = G.skillPoints || 0;
  // ---- header: where you are + what you have to spend ----
  if (G.endless){
    document.getElementById('stkicker').textContent = 'SURVIVAL';
    tree.querySelector('h1').textContent = 'WAVE ' + Math.max(1, G.endlessWave || 0) + ' SURVIVED';
  } else {
    const L = LEVELS[G.levelIdx], place = (L.name.split('—')[1] || L.name).trim();
    document.getElementById('stkicker').textContent = 'LEVEL ' + (G.levelIdx + 1) + ' · ' + place;
    tree.querySelector('h1').textContent = G.wave >= L.waves.length ? place + ' CLEARED'
      : 'WAVE ' + Math.max(1, G.wave) + ' OF ' + L.waves.length + ' CLEARED';
  }
  tree.querySelector('.sub').textContent = G.hero === 'mando' ? 'HONE THE HUNTER' : 'CHANNEL THE FORCE';
  document.getElementById('xpbalval').textContent = xp;
  document.getElementById('spbalval').textContent = sp;
  if (xp !== _lastXp) bump('xpbalval');
  if (sp !== _lastSp) bump('spbalval');
  _lastXp = xp; _lastSp = sp;
  // ---- BOON CHOICE (survival: free, one pick per wave clear) — the run's build layer ----
  const booncards = document.getElementById('booncards'), boonsec = document.getElementById('boonsec');
  booncards.innerHTML = '';
  if (!G.boonPicked && G.boonOffer && G.boonOffer.length){
    boonsec.style.display = '';
    for (const id of G.boonOffer){ const b = BOON_BY_ID[id]; if (!b) continue;
      booncards.appendChild(card({ cls:' boon '+b.r, tag: b.r==='legendary'?'LEGENDARY':b.r==='rare'?'RARE':'COMMON',
        ico:b.ico, nm:b.nm, ds:b.ds, cost:'CLAIM FREE', afford:true, onClick:()=>pickBoon(id) })); }
  } else boonsec.style.display = 'none';
  // ---- ABILITIES (spend XP) — fork pairs sit side by side joined by an OR; the final glows red ----
  const store = document.getElementById('storecards');
  store.innerHTML = '';
  let group = null, groupFork = null;
  for (const n of storeSet()){
    if (!storeAvail(n)) continue;
    const free = n.cost <= 0, afford = free || xp >= n.cost;
    const el = card({
      cls: (n.fork ? ' fork' : '') + (n.final ? ' final' : ''),
      tag: n.final ? 'FINAL UPGRADE' : n.fork ? (free ? 'CLAIM ONE' : 'CHOOSE ONE') : 'ABILITY',
      ico: n.ico, nm: n.nm, ds: n.ds,
      cost: free ? 'CLAIM FREE' : n.cost + ' XP',
      afford, why: needXp(n.cost),
      onClick: () => buyStore(n),
    });
    if (n.fork && n.fork === groupFork){ const or = document.createElement('div'); or.className = 'or'; or.textContent = 'OR'; group.append(or, el); continue; }
    if (n.fork){ group = document.createElement('div'); group.className = 'forkgroup'; group.appendChild(el); store.appendChild(group); groupFork = n.fork; }
    else { store.appendChild(el); group = null; groupFork = null; }
  }
  // unwrap a "group" of one (its sibling isn't on offer this visit) so it doesn't carry an empty OR frame
  for (const g of [...store.querySelectorAll('.forkgroup')]) if (g.children.length === 1) g.replaceWith(g.firstChild);
  // ---- POWER MASTERY (spend XP) — the next rank of each ability you own ----
  const mast = document.getElementById('masterycards'), offers = masteryOffers();
  if (!store.children.length) store.innerHTML = '<div class="empty">' +
    (storeRemaining() ? 'More powers open as the fight goes on.' : 'Every power is yours.') +
    (offers.length || G.endless ? ' Master the ones you have below.' : ' Nothing left to master either.') + '</div>';
  mast.innerHTML = '';
  for (const o of offers){
    const n = o.m.ranks.length, last = o.rank + 1 >= n;
    const pips = '<div class="pips">' + '<i class="on"></i>'.repeat(o.rank) + '<i></i>'.repeat(n - o.rank) + '</div>';
    mast.appendChild(card({ cls: ' mastery' + (last ? ' last' : ''), tag: 'MASTERY · RANK ' + RANK_NUM[o.rank + 1],
      ico: o.m.ico, nm: o.m.nm, ds: o.m.ranks[o.rank].ds, extra: pips,
      cost: o.cost + ' XP', afford: o.open && xp >= o.cost, why: o.open ? needXp(o.cost) : opensIn(o.opensIn),
      onClick: () => buyMastery(o) }));
  }
  // SURVIVAL POWER-UPS — repeatable stat upgrades (endless only): an XP sink that never runs out. They sit after the
  // mastery ranks so the one-off upgrades to your kit stay up top.
  if (G.endless){
    for (const p of ENDLESS_POWERS){
      const lv = powerLv(p.id), pc = powerCost(p);
      mast.appendChild(card({ cls:' power', tag: lv > 0 ? 'POWER · LEVEL ' + lv : 'POWER', ico:p.ico, nm:p.nm, ds:p.ds,
        cost: pc + ' XP', afford: xp >= pc, why: needXp(pc), onClick: () => buyPower(p) }));
    }
  }
  document.getElementById('mastsec').style.display = mast.children.length ? '' : 'none';
  document.getElementById('masthdr').textContent = G.endless ? 'MASTERY & POWERS' : 'MASTERY';
  document.getElementById('storehdr').textContent = G.endless ? 'ABILITIES' : (G.hero === 'mando' ? 'GADGETS & WEAPONS' : 'FORCE POWERS');
  // ---- TRAINING (spend SKILL POINTS) — a separate track, never gated by ability choice ----
  const wrap = document.getElementById('skillcards');
  wrap.innerHTML = '';
  document.getElementById('freehdr').textContent = G.hero === 'mando' ? 'WEAPON UPGRADES' : 'TRAINING';
  // what training opens next — "KNIGHT opens after 1 more" — so the tier gate reads as a goal, not a mystery
  const spent = G.skillSpent || 0, nextT = [2, 3].find(t => spent < TIER_REQ[t]);
  const gate = nextT ? ' · ' + tierName(nextT) + ' opens after ' + (TIER_REQ[nextT] - spent) + ' more' : '';
  document.getElementById('freehelp').textContent = (sp > 0
    ? 'Spend skill points · ' + sp + ' to spend'
    : 'Spend skill points · you earn one each wave') + gate;
  for (const s of progFreeCards){
    const r = skillRank(s.id);
    const spent = r >= s.max;
    const lockedOut = !spent && s.avail && !s.avail();   // a rival pick (e.g. the heal path) closed this off
    const pips = s.max > 1 ? '<div class="pips">' + '<i class="on"></i>'.repeat(r) + '<i></i>'.repeat(s.max - r) + '</div>' : '';
    const rankTag = r > 0 ? '<span class="rk">' + ['','II','III'][r] + '</span>' : '';
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
  document.getElementById('sthint').textContent = sp > 0
    ? 'Unspent XP and skill points carry over to the next wave'
    : 'Unspent XP carries over to the next wave';
}
function buyStore(n){
  if (!G.skillSelect || !storeAvail(n) || (G.xp||0) < n.cost) return;
  G.xp -= n.cost;
  n.buy();
  if (G.hero === 'mando') syncMandoChips(); else syncJediChips();
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
  renderProgress();
}
export function closeProgress(){
  if (!G.skillSelect) return;
  G.skillSelect = false;
  document.getElementById('skilltree').style.display = 'none';
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
  // a clear "you're patched up" beat as you drop back in — green motes + a RECOVERED floater
  const pp0 = playerPos();
  burst(V3(pp0.x, 1.3, pp0.z), 0x7bffae, 18, 6, 5, 1.0); burst(V3(pp0.x, 1.1, pp0.z), 0xc8ffd8, 10, 4, 4);
  floater(V3(pp0.x, 1.2, pp0.z), 'RECOVERED', '#7bffae');
  sfx(440, 0.25, 'sine', 0.1, 980);
}
