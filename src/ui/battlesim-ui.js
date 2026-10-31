// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The BATTLE SETUP screen (game/battlesim.js): the palette and buttons over the overhead view, and its controls.
//   Mouse and keyboard: click to place · right click to take back · W A S D (or the arrows) move the view · Q / E turn it ·
//   the wheel (or Z / X) zooms · Tab / Shift+Tab pick the next unit · C steps ×1 / ×3 / ×5 · Backspace undoes · Enter
//   starts · Esc (or B) opens the sandbox panel.
//   Pad: the left stick moves the view, the right stick turns and zooms, the ring in the middle is where A places and X
//   takes back · LB / RB pick the unit · D-pad ↑↓ ×1 / ×3 / ×5 · Y undoes · MENU starts · B (or VIEW) opens the panel.

import { renderer, camera } from '../engine/renderer.js';
import { G, shared, heroKey } from '../state.js';
import { padHooks, pad } from '../engine/gamepad.js';
import { PAD_GLYPHS, PAD_TUNE } from '../data/gamepad.js';
import { BATTLE_SIM } from '../data/battlesim.js';
import { SANDBOX_COUNTS, SANDBOX_MAPS } from '../data/sandbox.js';
import { SB } from '../game/sandbox.js';
import { BS, palette, pickable, unitName, enterSetup, leaveSetup, startBattle, placeAt, removeAt, unitAt, undoLast, clearSetup,
  panCam, zoomCam, turnCam, groundAt, showCursor, refreshMarks, counts } from '../game/battlesim.js';
import { openSandboxPanel, closeSandboxPanel } from './sandbox-ui.js';
import { sfx } from '../audio/sfx.js';

const root = document.getElementById('bsplan'), field = document.getElementById('bsfield');
const $ = (id) => document.getElementById(id);
const C = BATTLE_SIM.cam;
const held = new Set();      // the view keys down
let mouse = null;            // the pointer over the view, in NDC (null: off it, or the pad is in use)
let lastT = 0;

/* ---------- open / close ---------- */
export function openBattleSetup(){
  if (BS.open) return;
  closeSandboxPanel(false);
  if (!enterSetup()) return;
  try { document.exitPointerLock(); } catch(e){}
  held.clear(); mouse = null;
  render();
  lastT = performance.now(); requestAnimationFrame(tick);
}
// Esc / B: over to the sandbox panel, the sim still held (closing the panel starts the battle as it stands)
function toPanel(){ leaveSetup(true); G.skillSelect = false; openSandboxPanel(); }
function relock(){ if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} } }
function start(){ if (startBattle()){ held.clear(); relock(); sfx(620, 0.08, 'triangle', 0.05, 900); } }

/* ---------- drawing ---------- */
const mapName = () => { const m = SANDBOX_MAPS.find(o => o.id === SB.map); return m ? (typeof m.nm === 'object' ? heroKey(m.nm) : m.nm) : ''; };
function render(){
  const pal = palette(); let grp = '';
  $('bspal').innerHTML = pal.map((p, i) => {
    const g = p.kind === 'hero' ? '' : p.kind === 'ally' ? 'YOUR SIDE' : 'FOES';
    const head = g !== grp ? ((grp = g) ? `<span class="grp">${g}</span>` : '') : '';
    const ok = pickable(p);
    return head + `<span class="bs-chip ${p.kind}${p.special ? ' special' : ''}${i === BS.pick ? ' on' : ''}${ok ? '' : ' locked'}" data-pick="${i}"${ok ? '' : ' title="Later in the campaign"'}>${ok || !p.special ? unitName(p) : '? ? ?'}</span>`;
  }).join('');
  $('bscount').innerHTML = SANDBOX_COUNTS.map(n => `<span data-n="${n}" class="${n === SB.count ? 'on' : ''}">×${n}</span>`).join('');
  const el = $('bselite'); el.classList.toggle('on', SB.elite); el.querySelector('.setval').textContent = SB.elite ? 'ON' : 'OFF';
  $('bsmap').textContent = mapName();
  renderCounts(); renderKeys();
}
function renderCounts(){
  const c = counts();
  $('bscounts').innerHTML = `<span class="f">${c.foes} ${c.foes === 1 ? 'FOE' : 'FOES'}</span> · <span class="a">${c.allies} ${c.allies === 1 ? 'SQUADMATE' : 'SQUADMATES'}</span>`;
}
let keysFor = null;
function renderKeys(){
  const padOn = pad.active; if (keysFor === padOn) return; keysFor = padOn;
  const g = PAD_GLYPHS[pad.family], k = (t) => `<kbd>${t}</kbd>`;
  $('bskeys').innerHTML = padOn
    ? `${k(g.A)} place at the ring · ${k(g.X)} take back · ${k(g.LS)} move the view · ${k(g.RS)} turn and zoom · ${k(g.LB)} ${k(g.RB)} pick a unit · ${k(g.UP)} ${k(g.DOWN)} ×1 ×3 ×5 · ${k(g.Y)} undo · ${k(g.MENU)} start · ${k(g.B)} sandbox panel`
    : `${k('LMB')} place · ${k('RMB')} take back · ${k('W A S D')} move the view · ${k('Q')} ${k('E')} turn · ${k('WHEEL')} zoom · ${k('TAB')} next unit · ${k('C')} ×1 ×3 ×5 · ${k('BACKSPACE')} undo · ${k('ENTER')} start · ${k('ESC')} sandbox panel`;
}
// the cursor's ground point: under the mouse, or the ring in the middle when the pad is in use
function aimPoint(){
  const nx = pad.active || !mouse ? 0 : mouse.x, ny = pad.active || !mouse ? 0 : mouse.y;
  if (!pad.active && !mouse) return null;
  return groundAt(camera, nx, ny);
}
function hover(at){
  const i = at ? unitAt(at.x, at.z) : -1, p = palette()[BS.pick];
  const take = pad.active ? PAD_GLYPHS[pad.family].X : 'RIGHT CLICK';
  const u = BS.plan[i];
  const txt = u ? unitName(palette().find(o => o.kind === u.kind && o.id === u.id) || { nm: u.id.toUpperCase() }) + (u.elite ? ' · ELITE' : '') + ' · ' + take + ' TO TAKE BACK'
    : p ? 'PLACING: ' + unitName(p) + (p.kind !== 'hero' && p.id !== 'boss' && SB.count > 1 ? ' ×' + SB.count : '') : '';
  const el = $('bshover'); if (el.textContent !== txt) el.textContent = txt;
}

/* ---------- every frame while it's up: the view keys, the cursor ring ---------- */
function tick(t){
  if (!BS.open) return;
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  const step = C.pan * shared.planCam.h * dt;
  const r = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
  const f = (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') || held.has('arrowdown') ? 1 : 0);
  if (r || f) panCam(r * step, f * step);
  const turn = (held.has('e') ? 1 : 0) - (held.has('q') ? 1 : 0);
  if (turn) turnCam(-turn * C.turn * dt);
  const z = (held.has('x') || held.has('-') ? 1 : 0) - (held.has('z') || held.has('=') || held.has('+') ? 1 : 0);
  if (z) zoomCam(Math.pow(C.zoomStep, z * dt * 6));
  if (r || f || turn || z) refreshMarks();
  const at = aimPoint();
  showCursor(at); hover(at); renderKeys();
}

/* ---------- picking ---------- */
function pickStep(dir){
  const pal = palette(); let i = BS.pick;
  for (let n = 0; n < pal.length; n++){ i = (i + dir + pal.length) % pal.length; if (pickable(pal[i])) break; }
  BS.pick = i; render();
}
function countStep(dir){ const i = SANDBOX_COUNTS.indexOf(SB.count); SB.count = SANDBOX_COUNTS[Math.max(0, Math.min(SANDBOX_COUNTS.length - 1, i + dir))]; render(); }
function countCycle(){ const i = SANDBOX_COUNTS.indexOf(SB.count); SB.count = SANDBOX_COUNTS[(i + 1) % SANDBOX_COUNTS.length]; render(); }
function place(at){
  if (!at) return;
  if (placeAt(at.x, at.z)) sfx(520, 0.05, 'triangle', 0.04, 700); else sfx(200, 0.06, 'triangle', 0.03, 160);
  renderCounts();
}
function take(at){ if (at && removeAt(at.x, at.z)){ sfx(300, 0.05, 'triangle', 0.035, 220); renderCounts(); } }
function undo(){ if (undoLast()){ sfx(300, 0.05, 'triangle', 0.035, 220); renderCounts(); } }

/* ---------- mouse ---------- */
const ndc = (e) => ({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 });
field.addEventListener('mousemove', (e) => { mouse = ndc(e); });
field.addEventListener('mouseleave', () => { mouse = null; });
field.addEventListener('mousedown', (e) => {
  e.stopPropagation(); e.preventDefault();
  mouse = ndc(e);
  const at = groundAt(camera, mouse.x, mouse.y);
  if (e.button === 0) place(at); else if (e.button === 2) take(at);
});
field.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); zoomCam(e.deltaY > 0 ? C.zoomStep : 1 / C.zoomStep); refreshMarks(); }, { passive: false });
root.addEventListener('mousedown', (e) => e.stopPropagation());
root.addEventListener('click', (e) => {
  e.stopPropagation();   // nothing in here may reach the overlay's launch/resume handler
  const t = e.target;
  const pk = t.closest('[data-pick]'), n = t.closest('[data-n]');
  if (pk){ if (!pk.classList.contains('locked')){ BS.pick = +pk.dataset.pick; render(); } return; }
  if (n){ SB.count = +n.dataset.n; render(); return; }
  if (t.closest('#bselite')){ SB.elite = !SB.elite; render(); return; }
  if (t.closest('#bsundo')){ undo(); return; }
  if (t.closest('#bsclear')){ clearSetup(); renderCounts(); return; }
  if (t.closest('#bsmenu')){ toPanel(); return; }
  if (t.closest('#bsstart')){ start(); return; }
});

/* ---------- keyboard: while the setup is up it has the keys to itself (the fight's keys stay quiet) ---------- */
window.addEventListener('keydown', (e) => {
  if (!BS.open) return;
  const k = e.key.toLowerCase();
  if (k === 'p' || k === 'm') return;   // quality and music still answer anywhere
  e.stopImmediatePropagation(); e.stopPropagation();
  if (k === 'tab'){ e.preventDefault(); if (!e.repeat) pickStep(e.shiftKey ? -1 : 1); return; }
  if (e.repeat){ held.add(k); return; }
  held.add(k);
  if (k === 'enter') start();
  else if (k === 'escape' || k === 'b'){ e.preventDefault(); held.clear(); toPanel(); }
  else if (k === 'backspace' || (k === 'z' && (e.ctrlKey || e.metaKey))){ e.preventDefault(); held.delete('z'); undo(); }
  else if (k === 'c') countCycle();
  else if (k === 'delete') take(aimPoint());
}, true);
window.addEventListener('keyup', (e) => { held.delete(e.key.toLowerCase()); });
window.addEventListener('blur', () => held.clear());

/* ---------- pad: it drives the setup while it's up (engine/gamepad.js) ---------- */
const dz = (v, d) => Math.abs(v) < d ? 0 : Math.sign(v) * (Math.abs(v) - d) / (1 - d);
padHooks.own = (btn, down, lx, ly, rx, ry, dt) => {
  if (!BS.open) return false;
  const step = C.pan * shared.planCam.h * dt * 1.2;
  const mx = dz(lx, PAD_TUNE.moveDead), my = dz(ly, PAD_TUNE.moveDead), tx = dz(rx, PAD_TUNE.lookDead), ty = dz(ry, 0.3);
  let moved = false;
  if (mx || my){ panCam(mx * step, -my * step); moved = true; }
  if (tx){ turnCam(-tx * C.turn * dt); moved = true; }
  const zoom = ty + (btn[7] ? 1 : 0) - (btn[6] ? 1 : 0);
  if (zoom){ zoomCam(Math.pow(C.zoomStep, zoom * dt * 7)); moved = true; }
  if (moved) refreshMarks();
  if (down(0)) place(aimPoint());
  if (down(2)) take(aimPoint());
  if (down(3)) undo();
  if (down(4) || down(14)) pickStep(-1);
  if (down(5) || down(15)) pickStep(1);
  if (down(12)) countStep(1);
  if (down(13)) countStep(-1);
  if (down(9)) start();
  else if (down(1) || down(8)) toPanel();
  return true;
};
