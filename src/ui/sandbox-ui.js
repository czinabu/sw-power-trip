// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The sandbox panel (B in the sandbox): call in any foe, switch powers on and off, clear the floor, god mode.
// Before the campaign is beaten, what the story hasn't reached yet shows dimmed and locked (game/sandbox-unlocks.js).
// It holds the game still while it's open and frees the cursor, the same way the upgrade screen does.

import { renderer } from '../engine/renderer.js';
import { G, shared } from '../state.js';
import { SANDBOX_FOES, SANDBOX_COUNTS, SANDBOX_KIT, SANDBOX_MAPS } from '../data/sandbox.js';
import { addSquadmate, dismissSquadmate, squadSize } from '../allies/squad.js';
import { SQUAD } from '../data/allies.js';
import { readoutOn, setReadoutOn, restartReadout } from '../game/readout.js';
import { SB, sandboxSpawn, sandboxClear, sandboxHeal, setSandboxDummy, setSandboxKit, sandboxKitAll, kitAvailable, setSandboxMap, cycleSandboxSlot } from '../game/sandbox.js';
import { FORMS, LOADOUT_SLOTS } from '../data/forms.js';
import { foeOffered, mapOffered, kitOffered, sandboxIsFull, sandboxProgress } from '../game/sandbox-unlocks.js';

const panel = document.getElementById('sandbox');
const $ = (id) => document.getElementById(id);
const isOpen = () => panel.classList.contains('open');

export function openSandboxPanel(){
  if (!G.sandbox || G.mode !== 'play' || G.paused || G.skillSelect) return;
  G.sbMenu = true;        // the camera cuts away like the pause screen
  G.skillSelect = true;   // freezes the sim and keeps the pause screen away while the cursor is free (see ui/menus.js)
  render();
  panel.classList.add('open');
  document.exitPointerLock();
}
export function closeSandboxPanel(relock = true){
  if (!isOpen()) return;
  panel.classList.remove('open');
  G.sbMenu = false;
  G.skillSelect = false;
  if (relock && !shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}

function pill(id, on){ const el = $(id); el.classList.toggle('on', on); el.querySelector('.setval').textContent = on ? 'ON' : 'OFF'; }
const LATER = 'Later in the campaign';
function render(){
  const full = sandboxIsFull(), prog = sandboxProgress();
  $('sbstory').style.display = full ? 'none' : '';
  $('sbstory').textContent = 'THE STORY SO FAR · ' + prog.n + ' OF ' + prog.of + ' CHAPTERS · beat the campaign to open everything';
  $('sbmap').innerHTML = SANDBOX_MAPS.map(m => { const ok = mapOffered(m.id);
    return `<span data-map="${m.id}" class="${m.id === SB.map ? 'on' : ''}${ok ? '' : ' locked'}"${ok ? '' : ` title="${LATER}"`}>${typeof m.nm === 'object' ? m.nm[G.hero] : m.nm}</span>`; }).join('');
  $('sbcount').innerHTML = SANDBOX_COUNTS.map(n => `<span data-n="${n}" class="${n === SB.count ? 'on' : ''}">×${n}</span>`).join('');
  pill('sbelite', SB.elite); pill('sbdummy', SB.dummy); pill('sbgod', !!G.sandboxGod); pill('sbreadout', readoutOn());
  $('sbsquadn').textContent = squadSize() + ' / ' + SQUAD.max;
  $('sbfoes').innerHTML = SANDBOX_FOES.map(f => {
    const ok = foeOffered(f.id), nm = !ok && f.special ? '? ? ?' : typeof f.nm === 'object' ? f.nm[G.hero] : f.nm;   // a boss not met yet keeps its name
    return `<div class="sb-chip${f.special ? ' special' : ''}${ok ? '' : ' locked'}" data-foe="${f.id}"${ok ? '' : ` title="${LATER}"`}>${nm}<span class="k">${!ok ? 'LATER' : f.id === 'boss' ? 'BOSS' : f.special ? 'MID-BOSS' : ''}</span></div>`;
  }).join('');
  const jedi = G.hero !== 'mando';
  $('sbformslbl').style.display = $('sbforms').style.display = jedi ? '' : 'none';
  if (jedi) $('sbforms').innerHTML = Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
    const id = G.loadout[i], f = id && FORMS[id];
    return `<div class="sb-chip${f ? ' on' : ''}" data-slot="${i}">${f ? 'FORM ' + f.no + ' · ' + f.name : 'EMPTY'}<span class="k">${i + 1}</span></div>`;
  }).join('');
  $('sbkit').innerHTML = (SANDBOX_KIT[G.hero] || []).map(r => {
    const nm = typeof r.nm === 'function' ? r.nm() : r.nm;
    if (!kitOffered(r)) return `<div class="sb-chip locked" title="${LATER}">${nm}<span class="k">LATER</span></div>`;
    const can = kitAvailable(r);
    return `<div class="sb-chip${r.has() ? ' on' : ''}${can ? '' : ' off-needs'}" data-kit="${r.id}" title="${can ? '' : 'Needs ' + r.needs}">${nm}<span class="k">${r.key}</span></div>`;
  }).join('');
}

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // nothing in here may reach the overlay's launch/resume handler
  const t = e.target;
  const slot = t.closest('[data-slot]');
  if (slot){ cycleSandboxSlot(+slot.dataset.slot); render(); return; }
  const n = t.closest('[data-n]'), foe = t.closest('[data-foe]'), kit = t.closest('[data-kit]'), map = t.closest('[data-map]');
  if (t.closest('.locked')) return;   // not reached in the story yet
  if (map){ if (map.dataset.map !== SB.map){ setSandboxMap(map.dataset.map); render(); } return; }
  if (n){ SB.count = +n.dataset.n; render(); return; }
  if (foe){ sandboxSpawn(foe.dataset.foe); foe.classList.remove('pop'); void foe.offsetWidth; foe.classList.add('pop'); return; }
  if (kit){ const on = kit.classList.contains('on'); setSandboxKit(kit.dataset.kit, !on); render(); return; }
  if (t.closest('#sbelite')){ SB.elite = !SB.elite; render(); return; }
  if (t.closest('#sbdummy')){ setSandboxDummy(!SB.dummy); render(); return; }
  if (t.closest('#sbgod')){ G.sandboxGod = !G.sandboxGod; render(); return; }
  if (t.closest('#sbreadout')){ setReadoutOn(!readoutOn()); render(); return; }
  if (t.closest('#sbroreset')){ restartReadout(); return; }
  if (t.closest('#sbsquadadd')){ addSquadmate(); render(); return; }
  if (t.closest('#sbsquaddrop')){ dismissSquadmate(); render(); return; }
  if (t.closest('#sbclear')){ sandboxClear(); return; }
  if (t.closest('#sbheal')){ sandboxHeal(); return; }
  if (t.closest('#sball')){ sandboxKitAll(true); render(); return; }
  if (t.closest('#sbnone')){ sandboxKitAll(false); render(); return; }
  if (t.closest('#sbdone, #sbclose') || t === panel) closeSandboxPanel();
});
// B opens and closes it; Esc closes it too
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'b'){ if (isOpen()) closeSandboxPanel(); else openSandboxPanel(); }
  else if (k === 'escape' && isOpen()){ e.preventDefault(); closeSandboxPanel(); }
});
