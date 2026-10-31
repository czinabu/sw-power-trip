// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARMORY: the Mando's guns, his counterpart of the Jedi's Forms page (ui/forms-ui.js), built from the same
// look. Two slots (1 SIDEARM, 2 PRIMARY; data/mando.js) and a card per gun with what it's good and bad at
// (ARMORY_CODEX). Guns the hero hasn't been handed yet stand as locked chips. It opens three ways:
//   · BEFORE THE FIGHT — BEGIN on a mission (Mando) opens it in the menu's #forms panel: pick the two guns to carry
//   · ARMORY on the pause screen — read only, for the run in progress (the sandbox changes its guns in its panel, B)
//   · A NEW GUN in a run, for a slot that's already full (game/armory.js grantGun) — the fight freezes and the hero
//     picks which of the two to carry, like the Jedi's meditation. Its own #armory panel, over the fight.

import { G, shared } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { MANDO_WEAPONS, ARMORY_CODEX, KIT_SLOTS, KIT_LABEL, cleanKit, kitOf, bestKit, signatureWeapon, weaponOwned } from '../data/mando.js';
import { setKit, setArmoryPickHook } from '../game/armory.js';
import { autosave } from '../game/autosave.js';
import { refreshSandboxScope, storyReached } from '../game/sandbox-unlocks.js';

const menuPanel = document.getElementById('forms');
const runPanel = document.getElementById('armory');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
export const ARMORY_ORDER = ['single', 'dual', 'carbine', 'repeater'];
const HUE = { single: 0xffb84a, dual: 0xffd24a, carbine: 0x8fe8ff, repeater: 0xff8a4a };
const LOCK = '<svg class="fm-lock-ic" viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="Locked"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

let ctx = null;   // { mode: 'prefight' | 'codex' | 'pick', panel, edit, known, kit, focus, note, fresh, onGo }

/* ---------- what the page shows ---------- */
// the guns the story has handed out so far, across every run (the same set the sandbox and the missions offer)
const storyGuns = () => { refreshSandboxScope(); return ARMORY_ORDER.filter(id => id === 'single' || storyReached(id)); };
function savedKit(known){
  let kit = null;
  try { kit = JSON.parse(localStorage.getItem('sw_mission_kit')); } catch(e){}
  return cleanKit(kit || bestKit(id => known.includes(id)), id => known.includes(id));
}

/* ---------- render ---------- */
const gunName = (id) => MANDO_WEAPONS[id].name;
function slotRow(){
  const sig = signatureWeapon();
  return '<div class="fm-slots">' + KIT_SLOTS.map((s, i) => {
    const id = ctx.kit[s];
    return '<div class="fm-slot' + (id ? '' : ' empty') + '"' + (id ? ' style="--c:' + hex(HUE[id]) + '"' : '') + '><span class="n">' + (i + 1) + ' · ' + KIT_LABEL[s] + '</span>' +
      (id ? esc(gunName(id)) : LOCK) + '</div>';
  }).join('') +
  (ctx.mode === 'prefight' ? '' : '<div class="fm-slot empty"><span class="n">3 · SIGNATURE</span>' + (weaponOwned(sig) ? esc(MANDO_WEAPONS[sig].name) : 'AT THE FORGE') + '</div>') + '</div>';
}
function tile(id){
  const W = MANDO_WEAPONS[id], C = ARMORY_CODEX[id] || {}, carried = ctx.kit[W.slot] === id;
  return '<div class="fm-tile' + (ctx.edit ? ' pick' : '') + (carried ? ' in' : '') + (id === ctx.focus ? ' sel' : '') + '" data-gun="' + id + '" style="--c:' + hex(HUE[id]) + '">' +
    '<div class="fm-no">' + esc(KIT_LABEL[W.slot]) + (carried ? '<span class="fm-in">CARRIED</span>' : id === ctx.fresh ? '<span class="fm-in">NEW</span>' : '') + '</div>' +
    '<b>' + esc(W.name) + '</b><div class="fm-best">' + esc(C.tag || '') + '</div></div>';
}
function detail(){
  const id = ctx.focus;
  if (!id || !ctx.known.includes(id)) return '<div class="fm-detail empty">Select a gun to see what it is good and bad at.</div>';
  const W = MANDO_WEAPONS[id], C = ARMORY_CODEX[id] || {};
  return '<div class="fm-detail" style="--c:' + hex(HUE[id]) + '"><div class="fm-no">' + esc(KIT_LABEL[W.slot]) + ' · ' + esc(C.tag || '') + '</div><b>' + esc(W.name) + '</b>' +
    (C.lore ? '<p class="fm-lore">' + esc(C.lore) + '</p>' : '') +
    (C.best ? '<div class="fm-best">BEST AGAINST · ' + esc(C.best) + '</div>' : '') +
    '<ul class="fm-pros">' + (C.pros || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<ul class="fm-cons">' + (C.cons || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
}
function section(slot){
  const ids = ARMORY_ORDER.filter(id => MANDO_WEAPONS[id].slot === slot && ctx.known.includes(id));
  return ids.length ? '<div class="fm-sec">' + (slot === 'primary' ? 'PRIMARIES' : 'SIDEARMS') + '</div><div class="fm-tiles">' + ids.map(tile).join('') + '</div>' : '';
}
function lockedRow(){
  const l = ARMORY_ORDER.filter(id => !ctx.known.includes(id));
  return l.length ? '<div class="fm-sec">NOT FOUND YET</div><div class="fm-chips">' + l.map(id => '<div class="fm-chip" title="Not found yet"><span>' + KIT_LABEL[MANDO_WEAPONS[id].slot] + '</span>' + LOCK + '</div>').join('') + '</div>' : '';
}
function render(){
  const title = ctx.mode === 'prefight' ? 'BEFORE THE FIGHT' : ctx.mode === 'pick' ? 'A NEW GUN' : 'THE ARMORY';
  const head = ctx.known.length + (ctx.known.length === 1 ? ' gun' : ' guns') + ' in the armory';
  const actions = ctx.mode === 'prefight' ? '<div class="fm-actions"><div class="btn" data-x="1">BACK</div><div class="btn primary go" data-go="1">FIGHT</div></div>'
    : ctx.mode === 'pick' ? '<div class="fm-actions"><div class="btn primary go" data-go="1">CARRY THESE</div></div>' : '';
  ctx.panel.innerHTML = '<div class="howto-panel fm-compact hero-mando">' +
    '<div class="howto-head"><div class="howto-title">' + title + '</div><div class="rm-sub">' + head + '</div>' + (ctx.mode === 'pick' ? '' : '<div class="howto-x" data-x="1">✕</div>') + '</div>' +
    '<div class="fm-sec">YOUR LOADOUT</div>' + slotRow() +
    (ctx.note ? '<div class="fm-note">' + esc(ctx.note) + '</div>' : '') +
    '<div class="fm-body"><div>' + section('sidearm') + section('primary') + '</div>' + detail() + '</div>' + lockedRow() + actions + '</div>';
}

/* ---------- picking: a gun goes into its own slot ---------- */
function pick(id){
  ctx.focus = id;
  if (ctx.edit && MANDO_WEAPONS[id]) ctx.kit = { ...ctx.kit, [MANDO_WEAPONS[id].slot]: id };
  render();
}

/* ---------- open / close ---------- */
export const armoryOpen = () => menuPanel.classList.contains('open') && !!ctx && ctx.panel === menuPanel;
export const armoryPickUp = () => runPanel.classList.contains('open');
// BEGIN on a mission: pick the two guns before the fight; `go` starts it. Nothing to choose (one gun each) goes straight in.
export function openArmoryPrefight(go){
  const known = storyGuns();
  ctx = { mode: 'prefight', panel: menuPanel, edit: true, known, kit: savedKit(known), onGo: go,
    note: 'Choose your sidearm (1) and primary (2) for this mission. Click a gun to carry it in its slot.' };
  ctx.focus = ctx.kit.primary || ctx.kit.sidearm;
  if (known.length <= 1){ fightNow(); return; }
  render(); menuPanel.classList.add('open');
}
export function openArmoryCodex(){
  const known = ARMORY_ORDER.filter(id => weaponOwned(id));
  ctx = { mode: 'codex', panel: menuPanel, edit: false, known, kit: { ...kitOf() },
    note: G.sandbox ? 'Change your guns in the sandbox panel (B).' : G.training || G.mission ? '' : 'Each time the run hands you a gun for a full slot, you choose which to carry.' };
  ctx.focus = ctx.kit.primary || ctx.kit.sidearm;
  render(); menuPanel.classList.add('open');
}
function closeMenu(){ menuPanel.classList.remove('open'); ctx = null; }
function fightNow(){
  const kit = cleanKit(ctx.kit, id => ctx.known.includes(id));
  try { localStorage.setItem('sw_mission_kit', JSON.stringify(kit)); } catch(e){}
  G.missionKit = kit;   // game/mission.js hands it over as the mission starts (game/armory.js missionKit)
  const go = ctx.onGo; closeMenu(); go();
}

/* ---------- a new gun in a run ---------- */
const pending = [];
setArmoryPickHook((id) => { if (!pending.includes(id)) pending.push(id); });
// game/flow.js, every frame of play: open once nothing else holds the screen
export function tickArmory(){
  if (!pending.length || armoryPickUp() || G.mode !== 'play' || G.paused || G.skillSelect || G.cardUp || G.cutscene) return;
  const id = pending.shift();
  const known = ARMORY_ORDER.filter(w => weaponOwned(w));
  ctx = { mode: 'pick', panel: runPanel, edit: true, known, kit: { ...kitOf() }, fresh: id, focus: id,
    note: 'You found the ' + MANDO_WEAPONS[id].name + '. You carry one ' + KIT_LABEL[MANDO_WEAPONS[id].slot].toLowerCase() + ': keep yours, or take the new one. The other stays in the armory, and you can choose again whenever you find another gun.' };
  render(); runPanel.classList.add('open');
  G.skillSelect = true; G.cardUp = true;   // freeze the fight while the cursor is free (as the Jedi's meditation does)
  document.exitPointerLock();
  MUSIC.unlockSting(); S.reward(1);
}
export function clearArmory(){ pending.length = 0; if (armoryPickUp()) closeRun(true); }
function closeRun(quiet){
  runPanel.classList.remove('open');
  if (ctx && ctx.panel === runPanel) ctx = null;
  G.cardUp = false;
  if (!document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}
function carry(){
  setKit(ctx.kit);
  autosave('armory');
  closeRun();
  if (pending.length) tickArmory();
}

/* ---------- input ---------- */
function onClick(e){
  e.stopImmediatePropagation(); audioInit();   // the page must never launch or resume the game behind it
  if (!ctx || ctx.panel !== e.currentTarget) return;
  const t = e.target;
  if (ctx.mode !== 'pick' && (t === ctx.panel || t.closest('[data-x]'))){ closeMenu(); return; }
  if (t.closest('[data-go]')){ if (ctx.mode === 'pick') carry(); else fightNow(); return; }
  const g = t.closest('[data-gun]');
  if (g) pick(g.dataset.gun);
}
// the menu panel is shared with the Forms page: only handle clicks while the armory is what it shows
menuPanel.addEventListener('click', (e) => { if (ctx && ctx.panel === menuPanel) onClick(e); }, true);
runPanel.addEventListener('click', onClick);
document.addEventListener('keydown', (e) => {
  if (armoryPickUp() && e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); carry(); return; }
  if (!armoryOpen()) return;
  if (e.key === 'Escape'){ e.stopPropagation(); closeMenu(); }
  else if (e.key === 'Enter' && ctx.mode === 'prefight'){ e.preventDefault(); e.stopPropagation(); fightNow(); }
}, true);
