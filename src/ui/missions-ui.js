// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MISSIONS PAGE: picking MISSIONS on the main menu swaps the menu column for this page (like the customizer),
// so the menu itself keeps only the hero, the mode, the difficulty and BEGIN. The page shelves every story mission by
// story and act for the hero picked (data/mission-groups.js): a card each with its place, threat and a tick once this
// hero has won it, and the picked one spelled out under the list. BEGIN MISSION plays it; BACK (Esc, or B on a pad)
// goes back to the menu with the mission still picked, so BEGIN there plays it too.
// Keys: the arrows move between the open missions, Enter begins. A pad's focus ring walks the cards like any button.

import { G, TROOPER_TEST } from '../state.js';
import { missionDone, missionTitle } from '../game/mission.js';
import { missionUnlocked, missionChapterNo } from '../game/sandbox-unlocks.js';
import { MISSIONS } from '../data/missions.js';
import { missionShelves, missionRank, missionShelf, missionForHero, STORIES } from '../data/mission-groups.js';
import { audioInit } from '../audio/sfx.js';
import { overlay, setOverlayState, isMenuState, beginFromMenu, panelOpen } from './menus.js';

const listEl = document.getElementById('mplist'), infoEl = document.getElementById('mpinfo');
const HEROES = () => ['jedi', 'mando', ...(TROOPER_TEST ? ['trooper'] : [])];
const HERO_NAME = { jedi: 'Jedi', mando: 'Mando', trooper: 'ARC' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export const placeOf = (m) => m.level.name.replace(/^(MISSION|TRIAL)\s*—\s*/, '');
// a campaign trial joins the list once any hero has reached it in the campaign (won it there)
const trialSeen = (id) => !MISSIONS[id].trial || HEROES().some(h => missionDone(id, h));
// a mission stays locked and unspoiled until the campaign has cleared it (game/sandbox-unlocks.js)
export const missionOpen = (id) => !!MISSIONS[id] && trialSeen(id) && missionUnlocked(id);
const shown = (id) => MISSIONS[id] && missionForHero(MISSIONS[id], G.hero) && trialSeen(id);
export const missionPageOpen = () => overlay.classList.contains('mpage');

export function setMission(id){
  if (!shown(id)) id = Object.keys(MISSIONS).find(shown) || 'refuge';
  G.missionId = id; try { localStorage.setItem('sw_mission', id); } catch(e){}
  for (const el of listEl.querySelectorAll('.msn')) el.classList.toggle('sel', el.dataset.mission === id);
  refreshInfo();
  refreshTile();
  if (isMenuState()) setOverlayState('menu');   // the headline names the mission
}

/* ---------- the page ---------- */
const pips = (n) => '<span class="mthreat" title="Threat ' + n + ' of 5">' + [1, 2, 3, 4, 5].map(i => '<i' + (i <= n ? ' class="on"' : '') + '></i>').join('') + '</span>';
function card(m){
  const open = missionOpen(m.id), won = missionDone(m.id, G.hero), ch = missionChapterNo(m.id);
  const tags = open ? (m.squad ? '<span class="msn-tag">SQUAD</span>' : '') + (m.trial ? '<span class="msn-tag">TRIAL</span>' : '') : '';
  return `<div class="msn brk${open ? '' : ' locked'}${won && open ? ' won' : ''}${m.id === G.missionId ? ' sel' : ''}" id="msn-${m.id}" data-mission="${m.id}">
    <span class="mt"><span class="mtn">${open ? missionTitle(m.id) : '???'}</span>${tags}<span class="won">${open ? (won ? '✓' : '') : '🔒'}</span></span>
    <span class="mw">${open ? placeOf(m) : (ch ? 'COMPLETE ' + ch + ' TO UNLOCK' : 'LOCKED')}</span>${open ? pips(missionRank(m, G.hero)) : ''}
  </div>`;
}
function render(){
  for (const t of document.querySelectorAll('#mpheroes span')){
    t.style.display = HEROES().includes(t.dataset.h) ? '' : 'none';
    t.classList.toggle('on', t.dataset.h === G.hero);
  }
  const shelves = missionShelves(G.hero), many = shelves.length > 1;
  listEl.innerHTML = shelves.map(s => {
    const groups = s.groups.map(g => {
      const ms = g.missions.filter(m => trialSeen(m.id));
      if (!ms.length) return '';
      const won = ms.filter(m => missionOpen(m.id) && missionDone(m.id, G.hero)).length;
      return `<div class="mp-act">${g.title || many ? `<div class="mp-acth"><span>${g.title || s.title}</span><span class="mp-n">${won}/${ms.length}</span></div>` : ''}
        <div class="mp-grid">${ms.map(card).join('')}</div></div>`;
    }).join('');
    return groups ? `<div class="mp-story">${many ? `<div class="sec-label">${s.title}</div>` : ''}${groups}</div>` : '';
  }).join('');
  if (!shown(G.missionId)) setMission(G.missionId); else refreshInfo();
}
function refreshInfo(){
  const m = MISSIONS[G.missionId]; if (!m || !infoEl) return;
  if (!missionOpen(m.id)){
    const ch = missionChapterNo(m.id);
    infoEl.innerHTML = `<div class="mpi-t">LOCKED MISSION</div><div class="mpi-b">Clear ${ch ? ch.toLowerCase().replace(/^c/, 'C') : 'its chapter'} in the campaign to unlock this mission.</div>`;
    return;
  }
  const s = missionShelf(m, G.hero), story = STORIES.find(x => x.id === s.story);
  const where = placeOf(m) + (story ? ' · ACT ' + ROMAN[s.act] : '') + (missionChapterNo(m.id) && s.story === 'campaign' ? ' · ' + missionChapterNo(m.id) : '');
  const marks = HEROES().map(h => HERO_NAME[h] + ' ' + (missionDone(m.id, h) ? '<span class="ok">✓</span>' : '<span class="no">–</span>')).join(' &nbsp;');
  const n = m.objectives.length;
  infoEl.innerHTML = `<div class="mpi-t">${missionTitle(m.id)}${m.squad ? '<span class="msn-tag">SQUAD</span>' : ''}${m.trial ? '<span class="msn-tag">TRIAL</span>' : ''}</div>
    <div class="mpi-w">${where}</div>
    <div class="mpi-b">${m.blurb.charAt(0).toUpperCase() + m.blurb.slice(1)}.</div>
    <div class="mpi-meta"><span>THREAT ${pips(missionRank(m, G.hero))}</span><span>${n} OBJECTIVE${n === 1 ? '' : 'S'}</span><span>ON ${String(G.diff || 'knight').toUpperCase()}</span><span class="mpi-won">${marks}</span></div>`;
}
// the menu's MISSIONS tile: how many this hero has won, or the one picked
export function refreshTile(){
  const md = document.querySelector('#mode-mission .md'); if (!md) return;
  const ids = Object.keys(MISSIONS).filter(shown), won = ids.filter(id => missionDone(id, G.hero)).length;
  md.innerHTML = G.modeSel === 'mission' && missionOpen(G.missionId)
    ? 'Picked: ' + missionTitle(G.missionId).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) + ' · <span class="ok">change</span>'
    : 'Replay any story mission' + (won ? ' · ' + won + '/' + ids.length + ' <span class="ok">✓</span>' : '');
}
// every tick and lock after progress changes, or the hero does
export function refreshMissionMark(){ render(); refreshTile(); }

export function openMissionPage(){
  overlay.classList.add('mpage');
  render();
  overlay.scrollTop = 0;
  const sel = listEl.querySelector('.msn.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
export function closeMissionPage(){
  if (!missionPageOpen()) return;
  overlay.classList.remove('mpage');
  refreshTile();
}

listEl.addEventListener('click', (e) => {
  const c = e.target.closest('.msn'); if (!c) return;
  e.stopPropagation(); audioInit(); setMission(c.dataset.mission);
});
listEl.addEventListener('dblclick', (e) => {
  const c = e.target.closest('.msn'); if (!c) return;
  e.stopPropagation(); setMission(c.dataset.mission); if (missionOpen(c.dataset.mission)) beginFromMenu();
});
document.getElementById('mpBack').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); closeMissionPage(); });
// the page's hero tabs pick the hero exactly as the menu's cards do (the stand and every mark follow)
for (const t of document.querySelectorAll('#mpheroes span')) t.addEventListener('click', (e) => {
  e.stopPropagation(); const card = document.getElementById('hero-' + t.dataset.h); if (card) card.click();
});
// keys: Esc goes back; the arrows move between the open missions (nearest card that way); Enter begins
document.addEventListener('keydown', (e) => {
  if (!missionPageOpen() || !isMenuState() || overlay.style.display === 'none') return;
  if (panelOpen() || /\b(customizing|asktrain)\b/.test(overlay.className) || document.getElementById('armory')?.classList.contains('open')) return;
  if (e.key === 'Escape'){ closeMissionPage(); return; }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (dir){
    e.preventDefault();
    const cards = [...listEl.querySelectorAll('.msn:not(.locked)')], cur = listEl.querySelector('.msn.sel');
    if (!cur){ if (cards[0]) setMission(cards[0].dataset.mission); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const c of cards){
      if (c === cur) continue;
      const b = c.getBoundingClientRect(), dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      const main = dx * dir[0] + dy * dir[1], side = Math.abs(dir[0] ? dy : dx);
      if (main <= 4) continue;
      const s = main + side * 2.4; if (s < bs){ bs = s; best = c; }
    }
    if (best){ setMission(best.dataset.mission); best.scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'Enter' && !e.repeat && missionOpen(G.missionId)){
    e.preventDefault(); e.stopImmediatePropagation(); document.getElementById('goText').click();
  }
});
