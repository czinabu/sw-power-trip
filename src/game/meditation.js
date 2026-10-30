// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MEDITATION: the pause after the hero learns a form (data/forms.js FORM_PATH, granted by game/flow.js checkUnlocks).
// The screen names what was learned and lets the hero choose which three forms sit on 1 / 2 / 3. It is the only time a
// run's loadout changes, so the choice means something. When the run reaches Form VII, the screen first asks which of
// Juyo or Vaapad the hero keeps; the other is closed for the rest of the run (G.formFork).
// It waits for whatever is in front of it (a chapter card, the upgrade screen, the pause menu) and freezes the fight
// while it is up, the same way those do.

import { G, shared } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { FORMS, LOADOUT_SLOTS, STARTING_FORMS, cleanLoadout, forkClosed } from '../data/forms.js';
import { STANCES, stanceUnlocked } from '../data/stances.js';
import { setLoadout, setStanceHud } from '../player/jedi/stance.js';

const el = document.getElementById('meditate');
const pending = [];   // form ids learned and not yet shown
let draft = null, slot = 0, phase = null, learnedNow = [];   // the loadout being chosen, the slot the next pick fills, 'fork' | 'slots', what this sitting learned

// a run that stops to meditate: the campaign and survival (not the training grounds, a lone mission or the sandbox)
export const formsTaught = () => G.hero !== 'mando' && !G.training && !G.sandbox && !(G.mission && G.chapter < 0);
export const meditationUp = () => el.classList.contains('open');

// the forms the hero knows, in lore order
const known = () => Object.keys(FORMS).filter(id => FORMS[id].ready && stanceUnlocked(id) && !forkClosed(id, G.formFork));
// a lone mission: the three most advanced forms its kit teaches
export const autoLoadout = () => cleanLoadout(known().reverse());

export function queueMeditation(ids){
  if (!formsTaught()) return;
  for (const id of ids) if (!pending.includes(id)) pending.push(id);
}
// game/flow.js, every frame of play: open once nothing else holds the screen
export function tickMeditation(){
  if (!pending.length || meditationUp() || G.mode !== 'play' || G.paused || G.skillSelect || G.cardUp) return;
  open();
}
// a new run, a load or the main menu: forget anything still waiting
export function clearMeditation(){ pending.length = 0; if (meditationUp()) close(true); }

const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
const formLine = (id) => esc(STANCES[id].syn);

function open(){
  const learned = pending.splice(0);
  const fork = learned.filter(id => FORMS[id].fork);
  if (fork.length && !G.formFork){ phase = 'fork'; learnedNow = learned.filter(id => !FORMS[id].fork); renderFork(fork); }
  else { phase = 'slots'; renderSlots(learned.filter(id => !FORMS[id].fork)); }
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
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}

/* ---------- Form VII: keep one ---------- */
function renderFork(ids){
  el.innerHTML = '<div class="cc-inner hero-jedi"><div class="cc-act">FORM VII</div>' +
    '<h1 class="cc-title">THE SEVENTH FORM</h1>' +
    '<div class="cc-voice"><div class="cc-who">THE BATTLEMASTER</div><p>Few Jedi ever reach the seventh form, and none walk both of its roads. Juyo lets the fury in. Vaapad takes it from the one who attacks you. Choose, and the other road closes for good.</p></div>' +
    '<div class="cc-pick">' + ids.map(id => '<div class="cc-opt" data-fork="' + id + '" style="--c:' + hex(STANCES[id].blade) + '"><b>' + FORMS[id].name + '</b><span>' + formLine(id) + '</span></div>').join('') + '</div>' +
    '<div class="cc-hint">The choice holds for the rest of this run</div></div>';
}

/* ---------- the loadout ---------- */
function renderSlots(learned = learnedNow){
  learnedNow = learned;
  if (!draft){
    draft = G.loadout.slice();
    for (const id of learned) if (draft.includes(null) && !draft.includes(id)) draft = cleanLoadout(draft.map((d, i) => i === draft.indexOf(null) ? id : d));   // a new form takes an empty slot to start with
    slot = Math.max(0, draft.indexOf(null));
  }
  const k = known();
  const head = learned.length
    ? '<div class="cc-act">FORM LEARNED</div><h1 class="cc-title">' + learned.map(id => esc(FORMS[id].name)).join(' · ') + '</h1>' +
      '<div class="cc-world">' + learned.map(id => 'FORM ' + FORMS[id].no + ' · ' + formLine(id)).join('<br>') + '</div>'
    : '<div class="cc-act">MEDITATION</div><h1 class="cc-title">YOUR FORMS</h1>';
  el.innerHTML = '<div class="cc-inner hero-jedi">' + head +
    '<div class="cc-voice"><div class="cc-who">MEDITATION</div><p>Choose the three forms you carry into the fight. You can change them again when you next learn a form.</p></div>' +
    '<div class="md-slots">' + Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
      const id = draft[i];
      return '<div class="md-slot' + (i === slot ? ' sel' : '') + (id ? '' : ' empty') + '" data-slot="' + i + '"' + (id ? ' style="--c:' + hex(STANCES[id].blade) + '"' : '') + '>' +
        '<span class="n">' + (i + 1) + '</span>' + (id ? esc(FORMS[id].name) : 'EMPTY') + '</div>';
    }).join('') + '</div>' +
    '<div class="md-forms">' + k.map(id => '<div class="md-form' + (draft.includes(id) ? ' in' : '') + (learned.includes(id) ? ' new' : '') + '" data-form="' + id + '" style="--c:' + hex(STANCES[id].blade) + '">' +
      '<b>' + esc(FORMS[id].name) + '</b><i>FORM ' + FORMS[id].no + ' · ' + esc(FORMS[id].tag) + '</i></div>').join('') + '</div>' +
    '<div class="cc-btns"><div class="btn primary go" data-go="1">RISE</div></div>' +
    '<div class="cc-hint">Pick a slot, then a form for it · Enter to rise</div></div>';
}
// put a form in the selected slot (one already slotted swaps places with it, and Form V / VII keep to one variant)
function pick(id){
  const at = draft.indexOf(id);
  if (at >= 0) draft[at] = draft[slot];   // a form already slotted swaps places with what was there
  draft[slot] = id;
  draft = cleanLoadout(draft.map((d, i) => i === slot ? d : (d && FORMS[d].variant && FORMS[d].variant === FORMS[id].variant && d !== id ? null : d)));
  slot = draft.indexOf(null) >= 0 ? draft.indexOf(null) : (slot + 1) % LOADOUT_SLOTS;
  renderSlots();
}
function rise(){
  if (!draft.some(Boolean)) draft[0] = STARTING_FORMS[0];
  setLoadout(draft); draft = null; phase = null; learnedNow = [];
  setStanceHud();
  close();
  if (pending.length) tickMeditation();
}

el.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  const t = e.target, f = t.closest('[data-fork]'), s = t.closest('[data-slot]'), m = t.closest('[data-form]');
  if (f){
    G.formFork = f.dataset.fork;
    (G.stanceUnlocked = G.stanceUnlocked || {})[G.formFork] = true;
    phase = 'slots'; renderSlots([...learnedNow, G.formFork]); S.reward(1); return;
  }
  if (s){ slot = +s.dataset.slot; renderSlots(); return; }
  if (m){ pick(m.dataset.form); return; }
  if (t.closest('[data-go]')) rise();
});
document.addEventListener('keydown', (e) => {
  if (!meditationUp() || phase !== 'slots') return;
  if (e.key === 'Enter'){ e.preventDefault(); rise(); }
});
