// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE COMMAND WHEEL: hold H (VIEW on a pad) and the world slows while eight orders fan out round the crosshair. Point
// at one (the mouse, or the right stick) and let go of H to give it. 1-4 (the D-pad) picks one squadmate instead of the
// whole squad; right click (B) or Esc puts the wheel away. A quick tap of H skips the wheel: the smart order
// (allies/squad.js squadOrder). The orders and timings are data/allies.js ORDERS and COMMAND.

import { G, player, isTrooper } from '../state.js';
import { ordersFor, COMMAND } from '../data/allies.js';
import { orderCost, commandPoints } from '../player/trooper/command.js';
import { allies, giveOrder, squadOrder, orderLabel, grenadeLeft, squadFormation } from './squad.js';
import { sfx } from '../audio/sfx.js';

const W = { down: false, downAt: 0, open: false, x: 0, y: 0, sel: -1, who: null };
let el = null;
export const wheelOpen = () => W.open;

/* ---------- INPUT (engine/input.js and engine/gamepad.js hand these in) ---------- */
export function wheelKeyDown(){
  if (G.mode !== 'play' || player.downed || W.down) return;
  W.down = true; W.downAt = performance.now(); W.who = null; W.x = W.y = 0; W.sel = -1;
}
export function wheelKeyUp(){
  if (!W.down) return;
  W.down = false;
  if (W.open){
    const sel = W.sel, who = W.who;
    close();
    if (sel >= 0) giveOrder(list()[sel].id, who);
  } else if (G.mode === 'play') squadOrder();   // a tap: the smart order
}
// the mouse while the wheel is open points at an order instead of turning the camera
export function wheelLook(dx, dy){
  if (!W.open) return false;
  W.x += dx; W.y += dy;
  const l = Math.hypot(W.x, W.y);
  if (l > 120){ W.x *= 120 / l; W.y *= 120 / l; }
  pick();
  return true;
}
// the right stick: straight to a direction
export function wheelStick(x, y){
  if (!W.open) return false;
  if (Math.hypot(x, y) > 0.45){ W.x = x * 120; W.y = y * 120; pick(); }
  return true;
}
// 1-4 while it's open: that squadmate (again: back to the whole squad)
export function wheelPickMate(i){
  if (!W.open) return false;
  if (allies[i]){ W.who = W.who === i ? null : i; sfx(520, 0.04, 'triangle', 0.03, 640); render(); }
  return true;
}
export function wheelCancel(){
  if (!W.open) return false;
  W.down = false; close(); return true;
}

function pick(){
  const l = Math.hypot(W.x, W.y);
  let sel = -1;
  if (l > 28){
    // clockwise from twelve o'clock
    const a = (Math.atan2(W.x, -W.y) + Math.PI * 2) % (Math.PI * 2);
    const n = list().length;
    sel = Math.round(a / (Math.PI * 2 / n)) % n;
  }
  if (sel !== W.sel){ W.sel = sel; if (sel >= 0) sfx(760, 0.03, 'triangle', 0.02, 900); render(); }
}

/* ---------- EVERY FRAME (main.js): open it once H has been held a moment, and slow the world while it's up ---------- */
export function updateWheel(){
  if (W.down && (G.mode !== 'play' || player.downed || G.paused || G.cutscene || !allies.length)){ W.down = false; if (W.open) close(); return; }
  if (W.down && !W.open && performance.now() - W.downAt > COMMAND.tapTime * 1000) open();
  if (W.open){ G.slowmo = Math.min(G.slowmo, COMMAND.slowmo); G.slowmoT = Math.max(G.slowmoT, 0.08); }
}
// the wheel's orders: the ARC trooper's has SUPPRESS where SPREAD / STACK sits (data/allies.js TROOPER_ORDERS)
const list = () => ordersFor(isTrooper());
let builtFor = null;
function open(){
  W.open = true;
  if (el && builtFor !== list()){ el.remove(); el = null; }   // the hero changed: draw it again
  if (!el) build();
  el.classList.add('open');
  sfx(440, 0.05, 'triangle', 0.03, 560);
  render();
}
function close(){
  W.open = false;
  if (el) el.classList.remove('open');
}

/* ---------- THE PICTURE ---------- */
function build(){
  el = document.createElement('div'); el.id = 'sqwheel';
  const ORDERS = builtFor = list(), R = 150, n = ORDERS.length;
  el.innerHTML = '<div class="sw-ring"></div>' + ORDERS.map((o, i) => {
    const a = i / n * Math.PI * 2, x = Math.sin(a) * R, y = -Math.cos(a) * R;
    return '<div class="sw-o" data-i="' + i + '" style="transform:translate(calc(-50% + ' + x.toFixed(1) + 'px), calc(-50% + ' + y.toFixed(1) + 'px))">' +
      '<b>' + o.icon + '</b><span>' + o.name + '</span><em></em></div>';
  }).join('') + '<div class="sw-c"><div class="sw-t"></div><div class="sw-n"></div></div><div class="sw-who"></div>';
  (document.getElementById('hud') || document.body).appendChild(el);
}
function render(){
  if (!el || !W.open) return;
  const gl = grenadeLeft(), pad = !!document.body.classList.contains('pad'), ORDERS = list();
  el.querySelectorAll('.sw-o').forEach((d, i) => {
    const o = ORDERS[i], cost = orderCost(o.id), broke = cost > commandPoints();
    d.classList.toggle('on', i === W.sel);
    const em = d.querySelector('em');
    em.textContent = o.id === 'grenade' && gl > 0 ? Math.ceil(gl) + 'S' : cost ? cost + ' CP' : o.id === 'formation' ? (squadFormation() === 'wide' ? '→ STACK' : '→ SPREAD') : '';
    d.classList.toggle('cool', (o.id === 'grenade' && gl > 0) || broke);   // (the trooper: short of COMMAND POINTS)
  });
  const o = W.sel >= 0 ? ORDERS[W.sel] : null;
  el.querySelector('.sw-t').textContent = o ? o.name : 'SQUAD ORDERS';
  el.querySelector('.sw-n').textContent = o ? o.note : (pad ? 'Right stick to pick · let go of VIEW to give it' : 'Point the mouse · let go of H to give it');
  el.querySelector('.sw-who').innerHTML = '<span class="' + (W.who == null ? 'on' : '') + '">ALL</span>' +
    allies.map((a, i) => '<span class="' + (W.who === i ? 'on' : '') + (orderLabel(a) === 'DOWN' ? ' down' : '') + '"><kbd>' + (pad ? ['D←', 'D↑', 'D→', 'D↓'][i] : i + 1) + '</kbd>' + a.name + '</span>').join('');
}
