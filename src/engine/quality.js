// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Graphics quality presets (cycle with P).

import { renderer, composer, bloomPass, aoPass, setMSAA, sun } from './renderer.js';

/* ============================================================
   GRAPHICS QUALITY — an escape valve for weaker machines. Cycle with 'P'
   (saved to localStorage). We only touch render-state levers that DON'T force
   shader recompiles: pixel ratio (the biggest lever), shadow-map resolution,
   antialiasing (multisampling the composer's buffers), the ambient-occlusion and
   bloom passes, and the CSS film grain. Shadows stay ON at every tier.
   ============================================================ */
const QUALITY_LEVELS = ['low', 'medium', 'high'];
const QUALITY = {
  low:    { pixelRatio: 1,    shadowMap: 512,  msaa: 0, ao: false, bloom: false, grain: false },
  medium: { pixelRatio: 1.5,  shadowMap: 1024, msaa: 4, ao: false, bloom: true,  grain: false },
  high:   { pixelRatio: 2,    shadowMap: 2048, msaa: 4, ao: true,  bloom: true,  grain: false },
};
const readKey = (k) => { try { return localStorage.getItem(k); } catch(e){ return null; } };
// a tier picked with P (jpt_quality) always wins; otherwise start on HIGH, or wherever the auto governor last settled
let manualQuality = QUALITY_LEVELS.includes(readKey('jpt_quality'));
let qualityIdx = QUALITY_LEVELS.indexOf(readKey(manualQuality ? 'jpt_quality' : 'jpt_quality_auto'));
if (qualityIdx < 0) qualityIdx = 2;   // default HIGH
function applyQuality(){
  const q = QUALITY[QUALITY_LEVELS[qualityIdx]];
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
  if (sun.shadow.mapSize.width !== q.shadowMap){
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }   // rebuild at the new size
  }
  bloomPass.enabled = q.bloom;
  aoPass.enabled = q.ao;
  setMSAA(q.msaa);
  const grain = document.getElementById('grain');
  if (grain) grain.style.display = q.grain ? '' : 'none';
  renderer.setSize(innerWidth, innerHeight);   // pixel-ratio change needs a resize to take hold
  composer.setSize(innerWidth, innerHeight);
  const gv = document.getElementById('gfxval');   // keep the pause-menu selector label in sync
  if (gv) gv.textContent = QUALITY_LEVELS[qualityIdx].toUpperCase();
}
export function cycleQuality(){
  qualityIdx = (qualityIdx + 1) % QUALITY_LEVELS.length;
  manualQuality = true;   // the player has taken the wheel: the auto governor stands down
  try { localStorage.setItem('jpt_quality', QUALITY_LEVELS[qualityIdx]); } catch(e){}
  applyQuality();
  showQualityToast();
}
function showQualityToast(msg){
  let t = document.getElementById('qtoast');
  if (!t){
    t = document.createElement('div'); t.id = 'qtoast';
    t.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:40;' +
      'padding:8px 20px;border-radius:10px;background:rgba(7,17,31,.85);border:1px solid rgba(108,168,214,.4);' +
      'color:#bfe8ff;font:600 12px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:3px;' +
      'backdrop-filter:saturate(1.1) blur(6px);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg || 'GRAPHICS: ' + QUALITY_LEVELS[qualityIdx].toUpperCase() + '  ·  P';
  t.style.opacity = '1';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, msg ? 3500 : 1400);
}
/* AUTO GOVERNOR — a machine that can't hold ~40 fps on HIGH steps itself down a tier (never back up, and never once a
   tier was picked by hand). Counts only real play frames: the first seconds after a load or a mode switch are shader
   compiles, a hidden tab or a pause isn't the GPU's fault. Two slow windows in a row drop one tier; the choice is
   remembered (jpt_quality_auto) so the next visit starts there. Works the same in every mode. */
const WINDOW_MS = 2500, SLOW_FPS = 40, GRACE_MS = 4000;
let winStart = 0, winFrames = 0, slowWindows = 0, graceUntil = performance.now() + GRACE_MS, lastFrame = 0;
export function qualityGovernor(playing){
  const now = performance.now(), gap = now - lastFrame; lastFrame = now;
  if (manualQuality || qualityIdx === 0 || document.hidden || !playing || gap > 250){   // paused, menus, tab switch, a hitch
    winStart = 0; winFrames = 0; if (!playing) graceUntil = Math.max(graceUntil, now + 1500); return;
  }
  if (now < graceUntil) return;
  if (!winStart){ winStart = now; winFrames = 0; return; }
  winFrames++;
  if (now - winStart < WINDOW_MS) return;
  const fps = winFrames * 1000 / (now - winStart);
  winStart = 0; winFrames = 0;
  slowWindows = fps < SLOW_FPS ? slowWindows + 1 : 0;
  if (slowWindows < 2) return;
  slowWindows = 0; qualityIdx--; graceUntil = now + GRACE_MS;
  try { localStorage.setItem('jpt_quality_auto', QUALITY_LEVELS[qualityIdx]); } catch(e){}
  applyQuality();
  showQualityToast('GRAPHICS LOWERED TO ' + QUALITY_LEVELS[qualityIdx].toUpperCase() + ' FOR SMOOTHER PLAY  ·  P TO CHANGE');
}
applyQuality();   // honor the saved preset on load
