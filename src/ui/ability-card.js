// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ABILITY CARD: a small screen for each ability the run hands over (data/store.js JEDI_AUTO / MANDO_AUTO): its name and
// key, what it does, and a short looping clip of it in the game (data/ability-cards.js). It waits for whatever is in front
// of it (a chapter card, a cutscene, the upgrade screen, a meditation, the pause menu), freezes the fight while it is up the
// way those do, and closes on CONTINUE, Enter or Space.

import { G, shared, isGunner } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { ABILITY_CARDS } from '../data/ability-cards.js';

const el = document.getElementById('abilitycard');
const pending = [];   // unlocks learned and not yet shown
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
export const hasAbilityCard = (u) => !!ABILITY_CARDS[u.key];
export const abilityCardUp = () => el.classList.contains('open');

export function queueAbilityCards(list){ for (const u of list) if (ABILITY_CARDS[u.key] && !pending.includes(u)) pending.push(u); }
// game/flow.js, every frame of play: open once nothing else holds the screen
export function tickAbilityCards(){
  if (!pending.length || abilityCardUp() || G.mode !== 'play' || G.paused || G.skillSelect || G.cardUp || G.cutscene) return;
  open(pending.shift());
}
// a new run, a load or the main menu: forget anything still waiting
export function clearAbilityCards(){ pending.length = 0; if (abilityCardUp()) close(true); }

function open(u){
  const C = ABILITY_CARDS[u.key], name = u.name || C.name, hud = u.hud != null ? u.hud : C.hud;
  el.innerHTML = '<div class="ac-inner hero-' + (isGunner() ? 'mando' : 'jedi') + '">' +
    '<div class="ac-clip"><img src="' + C.clip + '" alt=""></div>' +
    '<div class="ac-body"><div class="cc-act">ABILITY UNLOCKED</div><h2 class="ac-title">' + esc(name) + '</h2>' +
    (hud ? '<div class="ac-key">' + esc(hud) + '</div>' : '') +
    C.lines.map(t => '<p>' + esc(t) + '</p>').join('') +
    '<div class="cc-btns"><div class="btn primary go" data-next="1">CONTINUE</div></div></div></div>';
  el.classList.add('open');
  G.skillSelect = true; G.cardUp = true;   // freeze the fight and keep the pause screen away while the cursor is free
  document.exitPointerLock();
  MUSIC.unlockSting(); S.reward(1);
}
function close(quiet){
  el.classList.remove('open');
  G.cardUp = false;
  if (!document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (pending.length) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}

el.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (abilityCardUp() && e.target.closest('[data-next]')) close();
});
document.addEventListener('keydown', (e) => {
  if (!abilityCardUp() || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault(); e.stopPropagation(); close();
}, true);

// the store hands over an ability (a pick, or a chapter's gift): its card waits for the store page to close
export const storeAbilityCard = (n) => queueAbilityCards([{ key: n.id }]);
