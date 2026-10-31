// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE FORMS PAGE: every lightsaber form the hero has learned, what it is in the lore and what it is good and bad at
// (data/forms.js FORM_CODEX). Forms not learned yet show as locked. It opens two ways:
//   · BEFORE THE FIGHT — BEGIN on the main menu (Jedi) opens it first. A mission or the sandbox lets the player choose the
//     three forms to carry; a campaign or survival run shows the three it has (they change only when the run learns a
//     form: game/meditation.js), and the training grounds the three they teach with. FIGHT starts the mode.
//   · FORMS on the pause screen — the same page, read only, for the run in progress.

import { G } from '../state.js';
import { FORMS, FORM_CODEX, LOADOUT_SLOTS, DEFAULT_LOADOUT, RUN_LOADOUT, STARTING_FORMS, cleanLoadout, forkClosed } from '../data/forms.js';
import { STANCES, stanceUnlocked } from '../data/stances.js';
import { formOffered, refreshSandboxScope } from '../game/sandbox-unlocks.js';
import { canResume } from '../game/saves.js';
import { audioInit } from '../audio/sfx.js';

const panel = document.getElementById('forms');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
const ORDER = Object.keys(FORMS).filter(id => FORMS[id].ready);

const LOCK = '<svg class="fm-lock-ic" viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="Locked: unlocks with your next form"><title>Unlocks with your next form</title><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
// the lore behind a small "i" (hover, focus or click), like the notes on Controls
const loreInfo = (C) => (C.lore || C.who) ? '<span class="fm-i" tabindex="0" role="button" aria-label="Lore">i</span><div class="fm-lorepop">' + esc(C.lore || '') + (C.who ? ' <i>' + esc(C.who) + '</i>' : '') + '</div>' : '';
// locked forms: Form V and VII have two variants each, so a chip reads V-a / V-b without naming either
const lockedNo = (id) => { const same = ORDER.filter(x => FORMS[x].no === FORMS[id].no); return FORMS[id].no + (same.length > 1 ? '-' + 'ab'[same.indexOf(id)] : ''); };
const lockedChip = (id) => {
  const closed = FORMS[id].fork && ctx.closed && ctx.closed !== id;
  return '<div class="fm-chip" title="' + (closed ? 'Closed for this run: you chose ' + esc(FORMS[ctx.closed].name) : 'Not learned yet') + '"><span>FORM ' + lockedNo(id) + '</span>' + (closed ? esc(FORMS[id].name) : LOCK) + '</div>';
};
const lockedRow = () => { const l = ORDER.filter(id => !ctx.known.includes(id)); return l.length ? '<div class="fm-sec">NOT LEARNED YET</div><div class="fm-chips">' + l.map(lockedChip).join('') + '</div>' : ''; };

let ctx = null;   // { prefight, edit, known: Set, loadout, slot, focus, note, closed: Set, onGo }

/* ---------- what the page shows ---------- */
// the forms the story has taught the hero, across every run (the same set the sandbox offers)
const storyForms = () => { refreshSandboxScope(); return ORDER.filter(formOffered); };
// a lone mission's default: the three most advanced forms the story has taught
const bestOf = (ids) => cleanLoadout(ids.slice().reverse());
function savedPick(key, fallback, known){
  let list = fallback;
  try { const v = JSON.parse(localStorage.getItem(key)); if (Array.isArray(v)) list = v; } catch(e){}
  list = cleanLoadout(list).map(id => id && known.includes(id) ? id : null);
  if (!list.some(Boolean)) list[0] = STARTING_FORMS[0];
  return list;
}

function prefightContext(){
  const story = storyForms(), m = G.modeSel;
  if (m === 'mission') return { edit: true, known: story, loadout: savedPick('sw_mission_forms', bestOf(story), story), key: 'sw_mission_forms',
    note: 'Choose the three forms you carry into this mission. 1 / 2 / 3 switch between them in the fight.' };
  if (m === 'sandbox') return { edit: true, known: story, loadout: savedPick('sw_sandbox_forms', DEFAULT_LOADOUT, story), key: 'sw_sandbox_forms',
    note: 'Choose the three forms you start with. You can change them any time in the sandbox panel (B).' };
  if (m === 'training') return { edit: false, known: [...new Set([...story, ...DEFAULT_LOADOUT])], loadout: DEFAULT_LOADOUT.slice(),
    note: 'The training grounds teach with these three forms.' };
  if (m === 'campaign' && canResume()){
    const run = G.resumeRun, su = run.stanceUnlocked || {};
    const known = ORDER.filter(id => (STARTING_FORMS.includes(id) || su[id] || (id === 'niman' && (run.loadout || []).includes('niman'))) && !forkClosed(id, run.formFork));
    return { edit: false, known, loadout: cleanLoadout(run.loadout || RUN_LOADOUT), closed: run.formFork,
      note: 'Your saved run carries these three. They change each time you learn a new form.' };
  }
  return { edit: false, known: story, loadout: RUN_LOADOUT.slice(),
    note: 'A run starts with Shii-Cho, the first form every Jedi learns, and learns the others in order as it goes. Each time you learn one, you meditate and choose the three you carry.' };
}
function pauseContext(){
  const known = ORDER.filter(id => stanceUnlocked(id) && !forkClosed(id, G.formFork));
  return { edit: false, known, loadout: G.loadout.slice(), closed: G.formFork,
    note: G.sandbox ? 'Change the three in the sandbox panel (B).' : G.training || G.mission ? '' : 'Your three change each time you learn a new form.' };
}

/* ---------- render ---------- */
function slotRow(){
  return '<div class="fm-slots">' + Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
    const id = ctx.loadout[i];
    return '<div class="fm-slot' + (ctx.edit ? ' edit' : '') + (ctx.edit && i === ctx.slot ? ' sel' : '') + (id ? '' : ' empty') + '" data-slot="' + i + '"' +
      (id ? ' style="--c:' + hex(STANCES[id].blade) + '"' : '') + '><span class="n">' + (i + 1) + '</span>' + (id ? esc(FORMS[id].name) : (!ctx.edit || ctx.known.length <= i ? LOCK : 'EMPTY')) + '</div>';
  }).join('') + '</div>';
}
function card(id){
  const F = FORMS[id], C = FORM_CODEX[id] || {};
  const slotted = ctx.loadout.indexOf(id);
  return '<div class="fm-card' + (ctx.edit ? ' pick' : '') + (slotted >= 0 ? ' in' : '') + '" data-form="' + id + '" style="--c:' + hex(STANCES[id].blade) + '">' +
    '<div class="fm-no">FORM ' + F.no + ' · ' + esc(F.tag) + (slotted >= 0 ? '<span class="fm-in">SLOT ' + (slotted + 1) + '</span>' : '') + loreInfo(C) + '</div>' +
    '<b>' + esc(F.name) + '</b>' +
    (C.best ? '<div class="fm-best">BEST AGAINST · ' + esc(C.best) + '</div>' : '') +
    '<ul class="fm-pros">' + (C.pros || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<ul class="fm-cons">' + (C.cons || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
}
// BEFORE THE FIGHT shows small tiles and one form's detail beside them; the full cards stay on the pause page
function tile(id){
  const F = FORMS[id], C = FORM_CODEX[id] || {}, slotted = ctx.loadout.indexOf(id);
  return '<div class="fm-tile' + (ctx.edit ? ' pick' : '') + (slotted >= 0 ? ' in' : '') + (id === ctx.focus ? ' sel' : '') + '" data-form="' + id + '" style="--c:' + hex(STANCES[id].blade) + '">' +
    '<div class="fm-no">FORM ' + F.no + (slotted >= 0 ? '<span class="fm-in">SLOT ' + (slotted + 1) + '</span>' : '') + '</div>' +
    '<b>' + esc(F.name) + '</b>' + (C.best ? '<div class="fm-best">' + esc(C.best) + '</div>' : '') + '</div>';
}
function detail(){
  const id = ctx.focus;
  if (!id || !ctx.known.includes(id)) return '<div class="fm-detail empty">Select a form to see what it is good and bad at.</div>';
  const F = FORMS[id], C = FORM_CODEX[id] || {};
  return '<div class="fm-detail" style="--c:' + hex(STANCES[id].blade) + '"><div class="fm-no">FORM ' + F.no + ' · ' + esc(F.tag) + loreInfo(C) + '</div><b>' + esc(F.name) + '</b>' +
    (C.best ? '<div class="fm-best">BEST AGAINST · ' + esc(C.best) + '</div>' : '') +
    '<ul class="fm-pros">' + (C.pros || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<ul class="fm-cons">' + (C.cons || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
}
function render(){
  const n = ctx.known.length;
  if (ctx.prefight){
    panel.innerHTML = '<div class="howto-panel fm-compact">' +
      '<div class="howto-head"><div class="howto-title">BEFORE THE FIGHT</div>' +
      '<div class="rm-sub">' + n + ' of ' + ORDER.length + ' forms learned</div><div class="howto-x" data-x="1">✕</div></div>' +
      '<div class="fm-sec">YOUR THREE</div>' + slotRow() +
      (ctx.note ? '<div class="fm-note">' + esc(ctx.note) + (ctx.edit ? ' Pick a slot, then a form for it.' : '') + '</div>' : '') +
      '<div class="fm-sec">THE FORMS</div><div class="fm-body"><div class="fm-tiles">' + ORDER.filter(id => ctx.known.includes(id)).map(tile).join('') + '</div>' + detail() + '</div>' + lockedRow() +
      '<div class="fm-actions"><div class="btn" data-x="1">BACK</div><div class="btn primary go" data-go="1">FIGHT</div></div></div>';
    return;
  }
  panel.innerHTML = '<div class="howto-panel">' +
    '<div class="howto-head"><div class="howto-title">' + (ctx.prefight ? 'BEFORE THE FIGHT' : 'LIGHTSABER FORMS') + '</div>' +
    '<div class="rm-sub">' + n + ' of ' + ORDER.length + ' forms learned</div><div class="howto-x" data-x="1">✕</div></div>' +
    '<div class="fm-sec">YOUR THREE</div>' + slotRow() +
    (ctx.note ? '<div class="fm-note">' + esc(ctx.note) + (ctx.edit ? ' Pick a slot, then a form for it.' : '') + '</div>' : '') +
    '<div class="fm-sec">THE FORMS</div><div class="fm-grid">' + ORDER.filter(id => ctx.known.includes(id)).map(card).join('') + '</div>' + lockedRow() +
    (ctx.prefight ? '<div class="fm-actions"><div class="btn" data-x="1">BACK</div><div class="btn primary go" data-go="1">FIGHT</div></div>' : '') +
    '</div>';
}

/* ---------- picking (the same rules as the meditation: one Form V, one Form VII) ---------- */
function pick(id){
  const d = ctx.loadout, at = d.indexOf(id);
  ctx.focus = id;
  if (at >= 0) d[at] = d[ctx.slot];   // a form already slotted swaps places with what was there
  d[ctx.slot] = id;
  ctx.loadout = cleanLoadout(d.map((x, i) => i === ctx.slot ? x : (x && FORMS[x].variant && FORMS[x].variant === FORMS[id].variant && x !== id ? null : x)));
  ctx.slot = ctx.loadout.indexOf(null) >= 0 ? ctx.loadout.indexOf(null) : (ctx.slot + 1) % LOADOUT_SLOTS;
  render();
}

/* ---------- open / close ---------- */
export const formsOpen = () => panel.classList.contains('open');
// BEGIN: the page before the fight; `go` starts the mode
export function openPrefight(go){
  ctx = { prefight: true, slot: 0, onGo: go, ...prefightContext() };
  if (ctx.edit){ const e = ctx.loadout.indexOf(null); ctx.slot = e >= 0 ? e : 0; }
  ctx.focus = ctx.loadout.find(Boolean) || null;
  render(); panel.classList.add('open');
}
export function openCodex(){
  ctx = { prefight: false, slot: 0, ...pauseContext() };
  render(); panel.classList.add('open');
}
function close(){ panel.classList.remove('open'); ctx = null; }
function fight(){
  if (ctx.edit){
    if (!ctx.loadout.some(Boolean)) ctx.loadout[0] = STARTING_FORMS[0];
    try { localStorage.setItem(ctx.key, JSON.stringify(ctx.loadout)); } catch(e){}
  }
  G.missionForms = G.modeSel === 'mission' ? ctx.loadout.slice() : null;   // game/flow.js slots them as the mission starts
  const go = ctx.onGo; close(); go();
}

panel.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();   // the page must never launch or resume the game behind it
  if (!ctx) return;
  const t = e.target;
  if (t === panel || t.closest('[data-x]')){ close(); return; }
  if (t.closest('[data-go]')){ fight(); return; }
  const i = t.closest('.fm-i');
  if (i){ i.classList.toggle('on'); return; }   // the lore note: never picks the form behind it
  const s = t.closest('[data-slot]'), f = t.closest('[data-form]');
  if (!ctx.edit){   // show-only: a tile just shows its detail
    if (ctx.prefight && f){ ctx.focus = f.dataset.form; render(); }
    return;
  }
  if (s){ ctx.slot = +s.dataset.slot; ctx.focus = ctx.loadout[ctx.slot] || ctx.focus; render(); return; }
  if (f) pick(f.dataset.form);
});
document.addEventListener('keydown', (e) => {
  if (!formsOpen()) return;
  if (e.key === 'Escape'){ close(); }
  else if (e.key === 'Enter' && ctx && ctx.prefight){ e.preventDefault(); e.stopPropagation(); fight(); }
}, true);
document.getElementById('formsBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openCodex(); });
