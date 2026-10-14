// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Main menu: hero, mode and difficulty pickers, pause and restart.

import { renderer } from '../engine/renderer.js';
import { cycleQuality } from '../engine/quality.js';
import { audioInit, setMasterVol, sfx } from '../audio/sfx.js';
import { shared, G } from '../state.js';
import { setHero } from '../player/hero.js';
import { startLevel } from '../game/flow.js';
import { startEndless } from '../game/survival.js';
import { closeProgress } from './store-ui.js';
import { DIFFS } from '../data/difficulty.js';
import { renderControls } from './controls.js';

/* ============================================================
   INPUT
   ============================================================ */
export const overlay = document.getElementById('overlay');

/* OVERLAY STATE — one screen, four faces: 'menu' (first run), 'pause', 'dead', 'victory'. Each sets the headline,
   the primary button's label and which blocks show (hero/mode setup only where picking makes sense). */
let _ovState = 'menu';
export function setOverlayState(state){
  _ovState = state;
  overlay.classList.remove('st-menu', 'st-pause', 'st-dead', 'st-victory');
  overlay.classList.add('st-' + state);
  document.body.classList.toggle('in-menu', state === 'menu');
  document.getElementById('banner').style.opacity = '0';   // the overlay carries the message; don't let a banner ghost through it
  document.getElementById('restartBtn').style.display = state === 'menu' ? 'none' : 'inline-flex';
  const go = document.getElementById('goText'), sub = document.getElementById('ovsub');
  if (state === 'menu'){
    go.textContent = G.modeSel === 'endless' ? 'BEGIN SURVIVAL' : 'BEGIN CAMPAIGN';
    sub.textContent = G.modeSel === 'endless' ? 'HOW LONG CAN YOU LAST?' : 'CHOOSE YOUR LEGEND';
  } else if (state === 'pause'){
    go.textContent = '▶ RESUME'; sub.textContent = 'PAUSED';
  } else if (state === 'dead'){
    go.textContent = G.endless ? 'NEW SURVIVAL RUN' : 'RETRY THIS LEVEL';
    sub.textContent = '';   // the run summary's own title carries the moment
  } else if (state === 'victory'){
    go.textContent = 'PLAY AGAIN';
  }
}

function beginPlay(){
  overlay.style.display = 'none';
  document.getElementById('banner').style.opacity = '0';
  // leaving the end screen → re-arm the summary for the next run
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  document.body.classList.remove('in-menu');
  setHowTo(false);
  if (G.modeSel === 'endless' && !survivalUnlocked()) G.modeSel = 'campaign';   // safety — never launch a locked mode
  if (G.mode === 'menu' || G.mode === 'victory'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.modeSel === 'endless') startEndless(); else startLevel(0);
  } else if (G.mode === 'dead'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.endless) startEndless(); else startLevel(G.levelIdx);   // survival retry = a fresh survival run
  } else if (G.mode === 'play'){
    overlay.style.display = 'none';  // resume from pause
  }
  G.paused = false;   // unfreeze the sim on (re)entering play
}
// hero picker — select only (don't ignite); the player clicks elsewhere / GO to launch
document.getElementById('hero-jedi').addEventListener('click', (e) => { e.stopPropagation(); setHero('jedi'); });
document.getElementById('hero-mando').addEventListener('click', (e) => { e.stopPropagation(); setHero('mando'); });
// mode picker — campaign vs survival
// SURVIVAL is LOCKED until the campaign has been cleared as BOTH heroes (any difficulty).
export function survivalUnlocked(){ try { return localStorage.getItem('sw_camp_jedi') === '1' && localStorage.getItem('sw_camp_mando') === '1'; } catch(e){ return false; } }
export function refreshSurvivalLock(){
  const el = document.getElementById('mode-endless'); if (!el) return;
  const un = survivalUnlocked(), md = el.querySelector('.md');
  el.classList.toggle('locked', !un);
  if (md){
    if (un) md.textContent = 'endless waves, chase a high score';
    else { const j = localStorage.getItem('sw_camp_jedi') === '1', m = localStorage.getItem('sw_camp_mando') === '1';
      const mark = (ok) => ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>';
      md.innerHTML = '🔒 win as Jedi ' + mark(j) + ' &amp; Mando ' + mark(m);
      el.title = 'Survival unlocks once you have beaten the campaign with both heroes'; }
  }
}
function setModeSel(m){
  if (m === 'endless' && !survivalUnlocked()){   // can't pick a locked mode
    sfx(120, 0.1, 'square', 0.05, 70);
    const el = document.getElementById('mode-endless'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    return;
  }
  G.modeSel = m;
  document.getElementById('mode-campaign').classList.toggle('sel', m === 'campaign');
  document.getElementById('mode-endless').classList.toggle('sel', m === 'endless');
  if (_ovState === 'menu') setOverlayState('menu');   // headline + button follow the mode
}
document.getElementById('mode-campaign').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('campaign'); });
document.getElementById('mode-endless').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('endless'); });
refreshSurvivalLock();
function setDiff(d){
  G.diff = d; try { localStorage.setItem('sw_diff', d); } catch(e){}
  for (const k in DIFFS) document.getElementById('diff-' + k).classList.toggle('sel', k === d);
}
for (const k in DIFFS) document.getElementById('diff-' + k).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setDiff(k); });
setDiff(localStorage.getItem('sw_diff') || 'knight');
// SWING HANDEDNESS — some players find the directional cut more natural mirrored (strafe-L sweeps right, strafe-R
// sweeps left); a pure preference toggle, not a balance change. Persists like difficulty/graphics.
function setSwingMirror(on){
  G.swingMirror = on; try { localStorage.setItem('sw_swingmirror', on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById('swingval'); if (sv) sv.textContent = on ? 'MIRRORED' : 'NORMAL';
}
setSwingMirror(localStorage.getItem('sw_swingmirror') === '1');
document.getElementById('swingctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setSwingMirror(!G.swingMirror); });
// SETTINGS — mouse sensitivity + master volume sliders. stopPropagation on both click & pointerdown so dragging
// the thumb never bubbles into the overlay's click-to-resume/launch handler.
function setMouseSens(v){
  G.mouseSens = Math.max(0.4, Math.min(2.2, v));
  try { localStorage.setItem('sw_sens', G.mouseSens); } catch(e){}
  const sv = document.getElementById('sensval'); if (sv) sv.textContent = G.mouseSens.toFixed(2) + '×';
  const sl = document.getElementById('senssl'); if (sl && +sl.value !== G.mouseSens) sl.value = G.mouseSens;
}
setMouseSens(parseFloat(localStorage.getItem('sw_sens')) || 1);
setMasterVol(shared.masterVol);   // sync the slider/label to the value already loaded from localStorage
const senssl = document.getElementById('senssl'), volsl = document.getElementById('volsl');
senssl.addEventListener('pointerdown', (e) => e.stopPropagation());
senssl.addEventListener('click', (e) => e.stopPropagation());
senssl.addEventListener('input', (e) => setMouseSens(parseFloat(e.target.value)));
volsl.addEventListener('pointerdown', (e) => e.stopPropagation());
volsl.addEventListener('click', (e) => e.stopPropagation());
volsl.addEventListener('input', (e) => { audioInit(); setMasterVol(parseFloat(e.target.value)); });
document.addEventListener('pointerdown', audioInit);   // first gesture anywhere lights up the audio ctx + menu score (autoplay policy)
// HOW TO PLAY — a panel over the menu; opens on the current hero, with tabs to read the other one's controls
const howto = document.getElementById('howto');
function setHowTo(open){
  howto.classList.toggle('open', open);
  if (open) renderControls(G.hero);
}
document.getElementById('ctltoggle').addEventListener('click', (e) => { e.stopPropagation(); setHowTo(true); });
document.getElementById('howtoclose').addEventListener('click', (e) => { e.stopPropagation(); setHowTo(false); });
howto.addEventListener('click', (e) => {
  e.stopPropagation();   // reading the help must never launch or resume the game
  const tab = e.target.closest('[data-h]');
  if (tab) renderControls(tab.dataset.h);
  else if (e.target === howto) setHowTo(false);   // click the backdrop to close
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && howto.classList.contains('open')) setHowTo(false); });
setOverlayState('menu');
overlay.addEventListener('click', (e) => {
  // only the primary button or empty backdrop launches/resumes: a stray click on a label or setting shouldn't
  if (e.target.closest('#settingsrow, #runsummary, #setup, .ov-foot')) return;
  audioInit();
  try { renderer.domElement.requestPointerLock(); } catch(e){}
  setTimeout(() => {
    if (document.pointerLockElement !== renderer.domElement){
      shared.lockFallback = true;
      beginPlay();
    }
  }, 350);
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (G.skillSelect && !locked) return;   // skill tree owns the cursor — don't show the pause overlay
  if (locked){
    shared.lockFallback = false;
    beginPlay();
  } else if (!shared.lockFallback){
    overlay.style.display = 'flex';
    if (G.mode === 'play'){
      G.paused = true;   // ESC released the cursor — freeze the game behind the overlay
      setOverlayState('pause');
    }
    else if (G.mode === 'dead' || G.mode === 'victory') setOverlayState(G.mode);
    else setOverlayState('menu');
  }
});
// RESTART RUN — wipe progress and drop back into level 1 from scratch
function restartRun(){
  overlay.style.display = 'none';
  document.getElementById('restartBtn').style.display = 'none';
  document.getElementById('banner').style.opacity = '0';
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false;
  G.mode = 'play'; G.slowmo = 1; G.paused = false;
  document.body.classList.remove('in-menu'); setHowTo(false);
  if (G.endless) startEndless(); else startLevel(0);   // a survival run restarts as survival, not the campaign
  if (!shared.lockFallback){ try { renderer.domElement.requestPointerLock(); } catch(e){} }
}
document.getElementById('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); restartRun(); });
document.getElementById('continueBtn').addEventListener('click', (e) => { e.stopPropagation(); closeProgress(); });
// GRAPHICS selector on the overlay — cycle quality without resuming/launching (stop the click bubbling to the overlay)
document.getElementById('gfxctl').addEventListener('click', (e) => { e.stopPropagation(); cycleQuality(); });
