// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Graphics quality presets (cycle with P).

import { renderer, composer, bloomPass, sun } from './renderer.js';

/* ============================================================
   GRAPHICS QUALITY — an escape valve for weaker machines. Cycle with 'P'
   (saved to localStorage). We only touch render-state levers that DON'T force
   shader recompiles: pixel ratio (the biggest lever), shadow-map resolution,
   the bloom pass, and the CSS film grain. Shadows stay ON at every tier.
   ============================================================ */
const QUALITY_LEVELS = ['low', 'medium', 'high'];
const QUALITY = {
  low:    { pixelRatio: 1,    shadowMap: 512,  bloom: false, grain: false },
  medium: { pixelRatio: 1.5,  shadowMap: 1024, bloom: true,  grain: false },
  high:   { pixelRatio: 2,    shadowMap: 2048, bloom: true,  grain: true  },
};
let qualityIdx = QUALITY_LEVELS.indexOf(localStorage.getItem('jpt_quality'));
if (qualityIdx < 0) qualityIdx = 2;   // default HIGH
function applyQuality(){
  const q = QUALITY[QUALITY_LEVELS[qualityIdx]];
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
  if (sun.shadow.mapSize.width !== q.shadowMap){
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }   // rebuild at the new size
  }
  bloomPass.enabled = q.bloom;
  const grain = document.getElementById('grain');
  if (grain) grain.style.display = q.grain ? '' : 'none';
  renderer.setSize(innerWidth, innerHeight);   // pixel-ratio change needs a resize to take hold
  composer.setSize(innerWidth, innerHeight);
  const gv = document.getElementById('gfxval');   // keep the pause-menu selector label in sync
  if (gv) gv.textContent = QUALITY_LEVELS[qualityIdx].toUpperCase();
}
export function cycleQuality(){
  qualityIdx = (qualityIdx + 1) % QUALITY_LEVELS.length;
  try { localStorage.setItem('jpt_quality', QUALITY_LEVELS[qualityIdx]); } catch(e){}
  applyQuality();
  showQualityToast();
}
function showQualityToast(){
  let t = document.getElementById('qtoast');
  if (!t){
    t = document.createElement('div'); t.id = 'qtoast';
    t.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:40;' +
      'padding:8px 20px;border-radius:10px;background:rgba(7,17,31,.85);border:1px solid rgba(108,168,214,.4);' +
      'color:#bfe8ff;font:600 12px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:3px;' +
      'backdrop-filter:saturate(1.1) blur(6px);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = 'GRAPHICS: ' + QUALITY_LEVELS[qualityIdx].toUpperCase() + '  ·  P';
  t.style.opacity = '1';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 1400);
}
applyQuality();   // honor the saved preset on load
