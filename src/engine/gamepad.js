// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// GAMEPAD: polls the Gamepad API every frame. In a fight, pad buttons press the keys and mouse buttons the binds in
// data/gamepad.js name (so a pad drives exactly the code the keyboard does), the left stick steers and the right stick
// looks. Anywhere else (menus, pause, the upgrade screen, the sandbox panel) the pad moves a focus ring between the
// things you can click.

import { PAD_BUTTONS, PAD_TUNE, PAD_BINDS, PAD_GLYPHS, padFamily } from '../data/gamepad.js';
import { shared, G, player } from '../state.js';
import { clamp } from '../utils.js';
import { noteFlick } from '../player/jedi/cutaim.js';
import { audioInit } from '../audio/sfx.js';
import { skipScene } from '../game/cutscene.js';
import { wheelStick } from '../allies/wheel.js';

/* the left stick as a camera-relative move: x = right, y = forward (player/locomotion.js reads it for a smooth
   direction; the W A S D keys are pressed too, for everything that reads those) */
export const padMove = { on: false, x: 0, y: 0 };
export const pad = { connected: false, family: 'xbox', active: false };   // active: the pad is what's being played with

const overlay = document.getElementById('overlay');
const prev = new Array(PAD_BUTTONS.length).fill(false);
const blocked = new Set();   // buttons held across a switch between menu and fight: ignored until let go
const held = new Map();      // button → the virtual input it pressed (released with it, whatever LB does meanwhile)
const stickKeys = { w: false, a: false, s: false, d: false };
let wasPlaying = false, lastT = 0;

/* ---------- PAD MODE: the last thing touched picks the device (prompts, focus ring, play without pointer lock) ---------- */
function setActive(on){
  if (pad.active === on) return;
  pad.active = on;
  document.body.classList.toggle('pad', on);
  document.body.classList.toggle('pad-ps', on && pad.family === 'ps');
  // a pad plays without the pointer lock (a pad press can't take it); the mouse takes it back with a click on the game
  if (on && !document.pointerLockElement) shared.lockFallback = true;
  if (on) for (const el of document.querySelectorAll('.pg[data-b]')) el.textContent = PAD_GLYPHS[pad.family][el.dataset.b];   // button prompts
  if (!on){ clearFocus(); releaseAll(); setStickKeys(0, 0); padMove.on = false; }   // the keyboard took over: nothing stays held
}
window.addEventListener('mousemove', (e) => { if (e.isTrusted && Math.abs(e.movementX) + Math.abs(e.movementY) > 4) setActive(false); });
window.addEventListener('mousedown', (e) => { if (e.isTrusted) setActive(false); });
window.addEventListener('keydown', (e) => { if (e.isTrusted) setActive(false); });
window.addEventListener('gamepadconnected', (e) => { pad.connected = true; pad.family = padFamily(e.gamepad.id); });
window.addEventListener('gamepaddisconnected', () => {
  pad.connected = [...navigator.getGamepads()].some(Boolean);
  if (!pad.connected){ releaseAll(); setStickKeys(0, 0); padMove.on = false; }
});

/* ---------- PROMPTS: keyboard key labels said the pad's way ('LMB' → RT, 'F' → Y, 'W A S D' → LS) ---------- */
const KB_ALIAS = { space: ' ', lmb: 0, rmb: 2 };
function padKey(tok, hero){
  const gl = PAD_GLYPHS[pad.family], B = PAD_BINDS[hero];
  const t = tok.toLowerCase();
  if (t === 'mouse' || t === 'aim') return gl.RS;
  if (t === 'mmb') return gl.R3;
  if (t === 'w') return gl.LS + '↑'; if (t === 's') return gl.LS + '↓';
  if (t === 'a') return gl.LS + '←'; if (t === 'd') return gl.LS + '→';
  if (t.includes('+') && t.length > 1) return t.split('+').map(x => padKey(x, hero)).join('+');   // RMB+LMB
  const want = t in KB_ALIAS ? KB_ALIAS[t] : t;
  const hit = (layer) => Object.keys(layer).find(n => typeof want === 'number' ? layer[n].mouse === want : layer[n].key === want);
  let n = hit(B.base); if (n) return gl[n];
  n = hit(B.lb); if (n) return gl.LB + '+' + gl[n];
  return tok;
}
// a whole label: groups split on ' · ', keys on spaces, '/' '+' and words like HOLD / TAP kept as they are
export function padKeys(text, hero = G.hero === 'mando' ? 'mando' : 'jedi'){
  return text.split(' · ').map(g => g.replace(/W A S D/g, 'LS').split(' ').map(k => k === 'LS' ? PAD_GLYPHS[pad.family].LS :
    /^(\/|\+|HOLD|TAP|x2|\(air\))$/i.test(k) ? k : padKey(k, hero)).join(' ')).join(' · ');
}
// the HUD's key chips (and the saber lock's hint) follow the device being played with
function relabelHud(){
  for (const el of document.querySelectorAll('#actionbar .key, #stances .num, #wslots .kc, #lockbar .lb-hint b')){
    if (el.dataset.kb == null) el.dataset.kb = el.textContent;
    const hero = el.closest('.j-ab') ? 'jedi' : el.closest('.m-ab') ? 'mando' : G.hero === 'mando' ? 'mando' : 'jedi';
    const v = pad.active ? padKeys(el.dataset.kb, hero) : el.dataset.kb;
    if (el.textContent !== v) el.textContent = v;
  }
}
setInterval(relabelHud, 400);

/* ---------- VIRTUAL INPUT: the same events a keyboard and mouse send, so every listener (input.js, the sandbox
   panel's B, the pause keys) answers a pad press as it would the key ---------- */
const KEY_NAME = { ' ': ' ', shift: 'Shift', alt: 'Alt', escape: 'Escape', tab: 'Tab', enter: 'Enter' };
export function sendKey(k, down){
  const key = KEY_NAME[k] || k;
  document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true, cancelable: true }));
}
function sendMouse(b, down){
  document.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button: b, bubbles: true, cancelable: true }));
}
function press(name, bind){
  if (!bind) return;
  const v = bind.sandbox && G.sandbox && !held.has('LB') ? { key: bind.sandbox } : bind;
  held.set(name, v);
  if (v.mouse != null) sendMouse(v.mouse, true); else sendKey(v.key, true);
}
function release(name){
  const v = held.get(name); if (!v) return;
  held.delete(name);
  if (v.mouse != null) sendMouse(v.mouse, false); else sendKey(v.key, false);
}
function releaseAll(){ for (const name of [...held.keys()]) release(name); }
function setStickKeys(x, y){
  const T = PAD_TUNE.moveKey;
  const want = { w: y > T, s: y < -T, d: x > T, a: x < -T };
  for (const k in want) if (want[k] !== stickKeys[k]){ stickKeys[k] = want[k]; sendKey(k, want[k]); }
}

/* ---------- WHERE THE PAD IS: in the fight, or in a menu ---------- */
const ovUp = () => getComputedStyle(overlay).display !== 'none';
const sandboxOpen = () => document.getElementById('sandbox').classList.contains('open');
const playing = () => G.mode === 'play' && !G.paused && !G.skillSelect && !G.cutscene && !ovUp() && !sandboxOpen();

const dead = (v, d) => Math.abs(v) < d ? 0 : Math.sign(v) * (Math.abs(v) - d) / (1 - d);

function poll(t){
  requestAnimationFrame(poll);
  const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0); lastT = t;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null;
  if (!gp){ return; }
  if (!pad.connected){ pad.connected = true; pad.family = padFamily(gp.id); }
  const btn = PAD_BUTTONS.map((_, i) => { const b = gp.buttons[i]; if (!b) return false;
    return i === 6 || i === 7 ? b.value > PAD_TUNE.trigger || (b.pressed && b.value === 0) : b.pressed; });
  const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
  const anyBtn = btn.some((b, i) => b && !prev[i]);
  if (anyBtn || Math.hypot(lx, ly) > 0.5 || Math.hypot(rx, ry) > 0.5){
    if (!pad.active) audioInit();
    setActive(true);
  }
  if (!pad.active){ prev.splice(0, prev.length, ...btn); return; }

  const now = playing();
  if (now !== wasPlaying){
    // switching between fight and menu: let go of everything, and ignore buttons still held from the other side
    releaseAll(); setStickKeys(0, 0); padMove.on = false;
    blocked.clear(); btn.forEach((b, i) => { if (b) blocked.add(i); });
    wasPlaying = now;
    if (!now){ navReset(); checkT = 0; }
    else { clearFocus(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }   // a focused text box would swallow the pause key
  }
  for (const i of [...blocked]) if (!btn[i]) blocked.delete(i);
  const down = (i) => btn[i] && !prev[i] && !blocked.has(i);
  const up = (i) => !btn[i] && prev[i];

  if (now) fight(btn, down, up, lx, ly, rx, ry, dt);
  else menu(btn, down, lx, ly, ry, dt);
  prev.splice(0, prev.length, ...btn);
}
requestAnimationFrame(poll);

/* ---------- THE FIGHT ---------- */
function fight(btn, down, up, lx, ly, rx, ry, dt){
  const binds = PAD_BINDS[G.hero === 'mando' ? 'mando' : 'jedi'];
  const lbHeld = btn[4];
  // releases first (a bind lets go of what it pressed), then LB, then the rest, so LB + Y opens the layer at once
  PAD_BUTTONS.forEach((name, i) => { if (up(i)) release(name); });
  if (down(4)) press('LB', binds.base.LB);
  PAD_BUTTONS.forEach((name, i) => {
    if (i === 4 || i === 9 || !down(i)) return;
    press(name, (lbHeld && binds.lb[name]) || binds.base[name]);
  });
  if (down(9)){ releaseAll(); sendKey('tab', true); sendKey('tab', false); }   // MENU pauses (menus.js: Tab pauses and resumes)

  // LEFT STICK — move. The keys for anything that reads W A S D, the smooth direction for locomotion.
  const m = Math.hypot(lx, ly);
  if (m > PAD_TUNE.moveDead){ padMove.on = true; padMove.x = lx / Math.max(1, m); padMove.y = -ly / Math.max(1, m); }
  else padMove.on = false;
  setStickKeys(padMove.on ? lx : 0, padMove.on ? -ly : 0);

  // RIGHT STICK — look, on a curve: fine near the centre, fast at full tilt (or, with the squad's command wheel up, pick an order)
  const r = Math.hypot(rx, ry);
  if (wheelStick(rx, ry)) return;
  if (r > PAD_TUNE.lookDead){
    const mag = Math.pow(Math.min(1, (r - PAD_TUNE.lookDead) / (1 - PAD_TUNE.lookDead)), PAD_TUNE.lookCurve);
    const sens = G.padSens * (G.hero === 'mando' && player.zoom ? G.adsSens : 1);
    const dyaw = -(rx / r) * mag * PAD_TUNE.yawRate * sens * dt;
    const dpitch = (ry / r) * mag * PAD_TUNE.pitchRate * sens * dt * (G.padInvert ? -1 : 1);
    G.yaw += dyaw;
    G.pitch = clamp(G.pitch + dpitch, -0.62, 1.2);
    noteFlick(-dyaw / 0.0023, dpitch / 0.0021);   // a fast flick of the stick aims a cut, as the mouse does (CUT AIM: MOUSE)
  }
}

/* ---------- MENUS: a focus ring that moves between whatever can be clicked ---------- */
let focus = null;
const stack = [];   // where the ring was before a panel opened over it, to come back to when it closes
const navHold = { dir: null, t: 0 };
let checkT = 0;

function clearFocus(){ if (focus) focus.classList.remove('padfocus'); focus = null; }
function setFocus(el){
  if (focus === el) return;
  if (focus) focus.classList.remove('padfocus');
  focus = el;
  if (el){ el.classList.add('padfocus'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
function navReset(){ navHold.dir = null; }

// the fixed layer an element sits in (the menu, a panel over it, the upgrade screen)
function layerOf(el){
  for (let n = el; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n;
  return document.body;
}
// what can be clicked: every style rule that gives a pointer cursor (read once from the stylesheets, so a new kind of
// button is picked up without a list to keep), plus text boxes
let _clickSel = null;
function clickSel(){
  if (_clickSel) return _clickSel;
  const out = ['input:not([type=range]):not([type=hidden])'];
  const walk = (rules) => { for (const r of rules){
    if (r.cssRules && !r.selectorText) walk(r.cssRules);
    else if (r.selectorText && r.style && r.style.cursor === 'pointer') out.push(r.selectorText);
  } };
  for (const sh of document.styleSheets){ try { walk(sh.cssRules); } catch(e){} }
  return (_clickSel = out.join(','));
}
const big = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * 0.4; };   // a whole screen or panel
// everything that can be picked right now: shown, clickable, and not covered by a panel over it
function candidates(){
  const sel = clickSel(), out = [], layers = new Set(), off = [];
  for (const el of document.querySelectorAll(sel)){
    const outer = el.parentElement && el.parentElement.closest(sel);
    if (outer && !big(outer)) continue;   // inside something clickable: that's the pick (a click-anywhere screen doesn't count)
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || big(el)) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight){
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || !(hit === el || el.contains(hit))) continue;
      out.push(el); layers.add(layerOf(el));
    } else off.push(el);   // scrolled out of view: counts if its panel is the one on top
  }
  for (const el of off) if (layers.has(layerOf(el))) out.push(el);
  return out;
}
function valid(el, list){ return el && el.isConnected && list.includes(el); }
function defaultFocus(list){
  const go = document.getElementById('goText');
  if (list.includes(go)) return go;
  let best = null, bs = Infinity;
  for (const el of list){ const r = el.getBoundingClientRect(), s = r.top * 3 + r.left; if (s < bs){ bs = s; best = el; } }
  return best;
}
function ensureFocus(list){
  if (valid(focus, list)) return;
  while (stack.length){ const el = stack.pop(); if (valid(el, list)){ setFocus(el); return; } }
  if (focus && focus.isConnected) stack.push(focus);   // a panel opened over it: come back here when it closes
  setFocus(defaultFocus(list));
}
function move(dir){
  const list = candidates();
  ensureFocus(list);
  if (!focus) return;
  const a = focus.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const el of list){
    if (el === focus) continue;
    const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    const main = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (main <= 4) continue;
    const s = main + side * 2.4;
    if (s < bs){ bs = s; best = el; }
  }
  if (best) setFocus(best);
}
// LEFT / RIGHT on a slider setting slides it
function slide(dir){
  const sl = focus && (focus.matches('input[type=range]') ? focus : focus.querySelector('input[type=range]'));
  if (!sl) return false;
  const step = parseFloat(sl.step) || 1, v = clamp(parseFloat(sl.value) + dir * step, parseFloat(sl.min), parseFloat(sl.max));
  sl.value = v;
  sl.dispatchEvent(new Event('input', { bubbles: true }));
  sl.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
const panelUp = () => ['howto', 'settings', 'saves', 'coop', 'roadmap', 'forms'].some(id => document.getElementById(id).classList.contains('open')) ||
  sandboxOpen() || /\b(confirming|newconfirming|asktrain|customizing)\b/.test(overlay.className);

function menu(btn, down, lx, ly, ry, dt){
  // keep the ring on something real as screens and panels come and go (back to where it was when a panel closes)
  if ((checkT -= dt) <= 0){ checkT = 0.3; ensureFocus(candidates()); }
  // direction: D-pad, or the left stick, with a held repeat
  const dir = btn[12] || ly < -0.6 ? 'up' : btn[13] || ly > 0.6 ? 'down' : btn[14] || lx < -0.6 ? 'left' : btn[15] || lx > 0.6 ? 'right' : null;
  if (dir !== navHold.dir){ navHold.dir = dir; navHold.t = PAD_TUNE.navRepeat[0]; if (dir) step(dir); }
  else if (dir && (navHold.t -= dt) <= 0){ navHold.t = PAD_TUNE.navRepeat[1]; step(dir); }

  if (down(0) && G.cutscene) skipScene();   // A — skip a cutscene (game/cutscene.js)
  else if (down(0)){   // A — pick
    const list = candidates(); ensureFocus(list);
    if (focus){ if (focus.tagName === 'INPUT') focus.focus(); else focus.click(); }
  }
  if (down(1)){   // B — back: close what's on top, or resume from the pause screen
    if (panelUp()){ sendKey('escape', true); sendKey('escape', false); }
    else if (ovUp() && overlay.classList.contains('st-pause')){ sendKey('tab', true); sendKey('tab', false); }
  }
  if (down(9)){   // MENU — resume from pause; anywhere else on the overlay, the main button
    if (ovUp() && overlay.classList.contains('st-pause') && !panelUp()){ sendKey('tab', true); sendKey('tab', false); }
    else if (ovUp() && !panelUp()) document.getElementById('goText').click();
    else if (G.cutscene) skipScene();   // a cutscene (game/cutscene.js)
    else if (G.cardUp){ const go = document.querySelector('#chapcard.open .go'); if (go) go.click(); }   // the chapter card's BEGIN (game/campaign.js)
    else if (G.skillSelect) document.getElementById('continueBtn').click();
  }
  // RIGHT STICK — scroll a long panel (Controls, the roadmap, the upgrade screen)
  if (Math.abs(ry) > 0.25){
    let n = focus || document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    while (n && n !== document.body && !(n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY))) n = n.parentElement;
    if (n && n !== document.body) n.scrollTop += ry * 900 * dt;
  }
}
function step(dir){
  if ((dir === 'left' || dir === 'right') && slide(dir === 'right' ? 1 : -1)) return;
  move(dir);
}
