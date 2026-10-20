// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CHARACTER CUSTOMIZER: from the main menu, CUSTOMIZE swaps the menu column for the hero's options (data/customize.js).
// Each pick restyles the figure on the showcase turntable at once; DONE saves the picks and rebuilds the player, so
// the next run plays in the new look. Picks are saved per hero in localStorage (player/mesh.js).

import { G, player } from '../state.js';
import { CUSTOMIZE, pickedOption, swatchOf } from '../data/customize.js';
import { STANCES } from '../data/stances.js';
import { loadPicks, savePicks, rebuildPlayerModel } from '../player/mesh.js';
import { setHero } from '../player/hero.js';
import { bladeColor } from '../player/helpers.js';
import { applySaberGrip } from '../player/model/weapons.js';
import { restyleShowcase, focusShowcase, spinShowcase } from './showcase.js';
import { overlay, setOverlayState } from './menus.js';
import { audioInit } from '../audio/sfx.js';

const rowsEl = document.getElementById('czrows');
let picks = loadPicks();
let saved = JSON.stringify(picks);   // what the player model is built from

const hex = c => '#' + c.toString(16).padStart(6, '0');

function render(){
  const hero = G.hero, mine = picks[hero] || {};
  for (const t of document.querySelectorAll('#czhero span')) t.classList.toggle('on', t.dataset.h === hero);
  rowsEl.innerHTML = CUSTOMIZE[hero].map(row => {
    const cur = pickedOption(row, mine);
    const opts = row.options.map(o => row.kind === 'color'
      ? `<span class="cz-sw${o === cur ? ' sel' : ''}" data-row="${row.id}" data-opt="${o.id}" title="${o.name}" style="--c:${hex(swatchOf(o))}"></span>`
      : `<span class="cz-chip${o === cur ? ' sel' : ''}" data-row="${row.id}" data-opt="${o.id}">${o.name}</span>`).join('');
    return `<div class="cz-row"><div class="sec-label">${row.label}<span class="cz-val">${cur.name}</span></div>`
      + `<div class="cz-opts ${row.kind}">${opts}</div></div>`;
  }).join('');
}

function pick(rowId, optId){
  const hero = G.hero;
  picks = { ...picks, [hero]: { ...(picks[hero] || {}), [rowId]: optId } };
  restyleShowcase(picks);
  render();
}

function randomize(){
  const hero = G.hero, mine = {};
  for (const row of CUSTOMIZE[hero]) mine[row.id] = row.options[Math.floor(Math.random() * row.options.length)].id;
  picks = { ...picks, [hero]: mine };
  restyleShowcase(picks);
  render();
}

function reset(){
  const { [G.hero]: _, ...rest } = picks;
  picks = rest;
  restyleShowcase(picks);
  render();
}

export function openCustomizer(){
  overlay.classList.add('customizing');
  document.getElementById('ovsub').textContent = 'CUSTOMIZE YOUR LEGEND';
  focusShowcase(true);
  render();
}

export function closeCustomizer(){
  if (!overlay.classList.contains('customizing')) return;
  overlay.classList.remove('customizing');
  focusShowcase(false);
  setOverlayState('menu');   // restores the headline
  const now = JSON.stringify(picks);
  if (now === saved) return;
  saved = now;
  savePicks(picks);
  // the player wears the new look from the next run: rebuild it, then put back what the old model carried
  rebuildPlayerModel(picks);
  applySaberGrip(player, G.saberGrip);
  const st = STANCES[G.stance];
  if (st){ player.blade.glow.material.color.setHex(bladeColor(st)); player.blade.light.color.setHex(bladeColor(st)); }
  setHero(G.hero);
}

/* ---------- input ---------- */
document.getElementById('cztoggle').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openCustomizer(); });
document.getElementById('customizer').addEventListener('click', (e) => {
  e.stopPropagation();   // picking an option must never launch the game
  const opt = e.target.closest('[data-opt]');
  if (opt) return pick(opt.dataset.row, opt.dataset.opt);
  const tab = e.target.closest('[data-h]');
  if (tab && tab.dataset.h !== G.hero){ setHero(tab.dataset.h); render(); return; }
  if (e.target.closest('#czrandom')) randomize();
  else if (e.target.closest('#czreset')) reset();
  else if (e.target.closest('#czdone')) closeCustomizer();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCustomizer(); });

// drag on the stage to turn the hero on the stand
let dragX = null;
overlay.addEventListener('pointerdown', (e) => {
  if (!overlay.classList.contains('customizing') || e.target !== overlay) return;
  dragX = e.clientX;
  overlay.setPointerCapture(e.pointerId);
});
overlay.addEventListener('pointermove', (e) => {
  if (dragX === null) return;
  spinShowcase((e.clientX - dragX) * 0.01);
  dragX = e.clientX;
});
for (const ev of ['pointerup', 'pointercancel']) overlay.addEventListener(ev, () => { dragX = null; });
