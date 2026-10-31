// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Floating combat text and the full-screen flash.

import { camera } from '../engine/renderer.js';
import { rand, TMP } from '../utils.js';

/* ---------- floating damage text ---------- */
// Damage numbers come from a fixed POOL of recycled divs (built once, lazily) rather
// than create+remove per hit — no DOM churn during heavy combat. 48 is far more than
// can be read at once, and the ring buffer just restarts the oldest when it wraps.
const FLOATER_MAX = 48;
const _floaters = [];
let _flHead = 0;
function initFloaters(){
  const hud = document.getElementById('hud');
  for (let i = 0; i < FLOATER_MAX; i++){
    const d = document.createElement('div');
    d.className = 'fl'; d.style.opacity = '0';
    hud.appendChild(d);
    _floaters.push(d);
  }
}
export function floater(worldPos, text, color){
  TMP.copy(worldPos); TMP.y += 2.2;
  TMP.project(camera);
  if (TMP.z > 1) return;
  if (!_floaters.length) initFloaters();
  const d = _floaters[_flHead]; _flHead = (_flHead + 1) % FLOATER_MAX;
  // snap back to the start pose WITHOUT animating, then let the CSS transition carry it up
  d.style.transition = 'none';
  d.textContent = text;
  d.style.color = color || '#fff';
  d.style.left = ((TMP.x*0.5+0.5)*innerWidth + rand(-14,14)) + 'px';
  d.style.top  = ((-TMP.y*0.5+0.5)*innerHeight) + 'px';
  d.style.transform = 'translate(-50%,-50%)';
  d.style.opacity = '1';
  void d.offsetWidth;   // force reflow so the reset lands before the rise animates
  requestAnimationFrame(()=>{
    d.style.transition = 'all .7s ease-out';
    d.style.transform = 'translate(-50%,-180%)';
    d.style.opacity = '0';
  });
}

/* ---------- full-screen clash flash (parries, ripostes, big beats) ---------- */
let _flashEl = null;
/* Flash safety: full-screen flashes are the one effect that can wear on a player in a long fight, so they are limited
   centrally (every caller goes through here). More than three in a second are dimmed to a faint tint, a player who has
   asked their system for reduced motion gets them at half strength, and none ever peaks above 0.9. */
const _flashLog = [];
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } })();
export function screenFlash(bg, peak, dur){
  const now = performance.now();
  while (_flashLog.length && now - _flashLog[0] > 1000) _flashLog.shift();
  if (_flashLog.length >= 3) peak *= 0.35;
  _flashLog.push(now);
  peak = Math.min(peak, 0.9) * (REDUCED ? 0.5 : 1);
  _flashEl = _flashEl || document.getElementById('flash');
  _flashEl.style.transition = 'none';
  _flashEl.style.background = bg;
  _flashEl.style.opacity = String(peak);
  requestAnimationFrame(() => {
    _flashEl.style.transition = 'opacity ' + (dur || 0.3) + 's ease-out';
    _flashEl.style.opacity = '0';
  });
}
