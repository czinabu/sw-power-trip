// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Between-wave skill tree / store / boon overlay.

import { renderer } from '../engine/renderer.js';
import { sfx } from '../audio/sfx.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { syncMandoChips, syncJediChips } from '../game/flow.js';
import {
  skillSet, tierName, skillRank, skillEligible, skillPointCost, storeSet, storeAvail, powerLv, powerCost,
  buyPower
} from '../game/progression.js';
import { ENDLESS_POWERS } from '../data/store.js';
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
  while (pick.length < 3 && pool.length){
    pool.sort(() => Math.random() - 0.5);
    let best = pool[0];
    for (const s of pool) if (s.tier > best.tier && Math.random() < 0.6) best = s;
    pick.push(best); pool.splice(pool.indexOf(best), 1);
  }
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
  document.exitPointerLock();      // free the cursor so the cards are clickable
  if (shared.humGain) shared.humGain.gain.value = 0;
}
// build one store card element
function storeCard(opts){
  const c = document.createElement('div');
  c.className = 'storecard' + (opts.cls || '') + (opts.afford ? '' : ' cant');
  c.innerHTML = '<div class="storehdr" style="margin:0;font-size:8px">'+opts.tag+'</div>'+
    '<div class="ico">'+opts.ico+'</div><div class="nm">'+opts.nm+'</div><div class="ds">'+opts.ds+'</div>'+
    '<div class="cost">'+opts.cost+'</div>';
  if (opts.afford && opts.onClick) c.addEventListener('click', opts.onClick);
  return c;
}
export function renderProgress(){
  const tree = document.getElementById('skilltree');
  tree.querySelector('h1').textContent = 'WAVE CLEARED';
  tree.querySelector('.sub').textContent = G.hero === 'mando' ? 'HONE THE HUNTER' : 'CHANNEL THE FORCE';
  document.getElementById('xpbalval').textContent = (G.xp || 0);
  // ---- BOON CHOICE (free, one pick per wave clear) — the run's build layer, shown above the XP store ----
  const booncards = document.getElementById('booncards'), boonhdr = document.getElementById('boonhdr');
  booncards.innerHTML = '';
  if (!G.boonPicked && G.boonOffer && G.boonOffer.length){
    boonhdr.style.display = ''; booncards.style.display = '';
    for (const id of G.boonOffer){ const b = BOON_BY_ID[id]; if (!b) continue;
      booncards.appendChild(storeCard({ cls:' boon '+b.r, tag: b.r==='legendary'?'LEGENDARY':b.r==='rare'?'RARE':'BOON',
        ico:b.ico, nm:b.nm, ds:b.ds, cost:'CLAIM', afford:true, onClick:()=>pickBoon(id) })); }
  } else { boonhdr.style.display = 'none'; booncards.style.display = 'none'; }
  // ---- ABILITIES (spend XP) — fork choices + the expensive final ----
  const store = document.getElementById('storecards');
  store.innerHTML = '';
  for (const n of storeSet()){
    if (!storeAvail(n)) continue;
    const free = n.cost <= 0;
    store.appendChild(storeCard({
      cls: (n.fork ? ' fork' : '') + (n.final ? ' final' : ''),
      tag: n.final ? 'FINAL' : n.fork ? (n.cost > 0 ? 'CHOOSE ONE' : 'CLAIM ONE') : 'ABILITY',
      ico: n.ico, nm: n.nm, ds: n.ds,
      cost: free ? 'FREE' : n.cost + ' XP',
      afford: free || (G.xp || 0) >= n.cost,
      onClick: () => buyStore(n),
    }));
  }
  // EXTRA SKILL POINT — the third XP sink (powers up the weapon-upgrade track)
  { const cost = skillPointCost();
    store.appendChild(storeCard({
      tag: 'UPGRADE PTS', ico: '✚', nm: 'EXTRA SKILL POINT', ds: 'Banks +1 skill point for a weapon upgrade',
      cost: cost + ' XP', afford: (G.xp || 0) >= cost,
      onClick: () => { G.xp -= cost; G.skillBought = (G.skillBought||0)+1; G.skillPoints = (G.skillPoints||0)+1;
        sfx(560,0.12,'sine',0.1,900); document.getElementById('xpval').textContent = G.xp; renderProgress(); },
    }));
  }
  // SURVIVAL POWER-UPS — repeatable stat upgrades (endless only): an XP sink that never runs out
  if (G.endless){
    for (const p of ENDLESS_POWERS){
      const lv = powerLv(p.id), pc = powerCost(p);
      store.appendChild(storeCard({ cls:' fork', tag: lv > 0 ? 'POWER · LV ' + lv : 'POWER', ico:p.ico, nm:p.nm, ds:p.ds,
        cost: pc + ' XP', afford: (G.xp||0) >= pc, onClick: () => buyPower(p) }));
    }
  }
  document.getElementById('storehdr').textContent = G.endless ? 'SPEND XP — ABILITIES & SURVIVAL POWERS'
    : (G.hero === 'mando' ? 'SPEND XP — ABILITIES & SKILL POINTS' : 'SPEND XP — FORCE POWERS & SKILL POINTS');
  // ---- WEAPON UPGRADES (spend SKILL POINTS) — a separate track, never gated by ability choice ----
  const wrap = document.getElementById('skillcards');
  wrap.innerHTML = '';
  const sp = G.skillPoints || 0;
  document.getElementById('freehdr').textContent =
    (G.hero === 'mando' ? 'WEAPON UPGRADES' : 'TRAINING') + ' — ' + sp + ' SKILL POINT' + (sp === 1 ? '' : 'S') + (sp > 0 ? ' (choose)' : ' (earn or buy more)');
  for (const s of progFreeCards){
    const c = document.createElement('div');
    const spent = skillRank(s.id) >= s.max;
    const lockedOut = !spent && s.avail && !s.avail();   // a rival pick (e.g. the heal path) closed this off
    c.className = 'skillcard t' + s.tier + ((sp <= 0 || spent || lockedOut) ? ' cant' : '');
    const r = skillRank(s.id);
    const pips = s.max > 1 ? '<div class="pips">' + '●'.repeat(r) + '○'.repeat(s.max - r) + '</div>' : '';
    const rankTag = r > 0 ? ' <span class="rk">'+['','II','III'][r]+'</span>' : '';
    const tag = s.tier === 3 ? ' · CAPSTONE' : '';
    c.innerHTML = '<div class="tier">'+tierName(s.tier)+tag+'</div><div class="ico">'+s.ico+'</div>'+
      '<div class="nm">'+s.nm+rankTag+'</div><div class="ds">'+s.ds+'</div>'+
      (lockedOut ? '<div class="lockmsg">LOCKED — you chose the heal path</div>' : '<div class="fl">“'+s.fl+'”</div>')+pips;
    if (sp > 0 && !spent && !lockedOut) c.addEventListener('click', () => chooseUpgrade(s));
    wrap.appendChild(c);
  }
  document.getElementById('skillgoals').style.display = 'none';
}
function buyStore(n){
  if (!G.skillSelect || !storeAvail(n) || (G.xp||0) < n.cost) return;
  G.xp -= n.cost;
  n.buy();
  if (G.hero === 'mando') syncMandoChips(); else syncJediChips();
  document.getElementById('xpval').textContent = G.xp;
  floater(playerPos(), n.nm + '!', n.final ? '#ff9a6a' : '#7fe0a8');
  burst(playerPos().clone().setY(1.6), n.final ? 0xff7a4a : 0x7fe0a8, 14, 6, 5);
  sfx(n.final ? 660 : 520, 0.2, 'sine', 0.12, 1100); sfx(90, 0.16, 'sawtooth', 0.05, 60);
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
  sfx(s.tier === 3 ? 660 : 520, 0.22, 'sine', 0.12, 1200); sfx(90, 0.16, 'sawtooth', 0.05, 60);
  renderProgress();
}
export function closeProgress(){
  if (!G.skillSelect) return;
  G.skillSelect = false;
  document.getElementById('skilltree').style.display = 'none';
  if (!shared.lockFallback){ try { renderer.domElement.requestPointerLock(); } catch(e){} }
  // a clear "you're patched up" beat as you drop back in — green motes + a RECOVERED floater
  const pp0 = playerPos();
  burst(V3(pp0.x, 1.3, pp0.z), 0x7bffae, 18, 6, 5, 1.0); burst(V3(pp0.x, 1.1, pp0.z), 0xc8ffd8, 10, 4, 4);
  floater(V3(pp0.x, 1.2, pp0.z), 'RECOVERED', '#7bffae');
  sfx(440, 0.25, 'sine', 0.1, 980);
}
