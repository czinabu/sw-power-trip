// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Main menu: hero, mode and difficulty pickers, pause, restart, return to menu and fullscreen.

import { renderer } from '../engine/renderer.js';
import { cycleQuality } from '../engine/quality.js';
import { audioInit, setMasterVol, setMusicVol, setSfxVol, S } from '../audio/sfx.js';
import { AE } from '../audio/engine.js';
import { shared, G, player } from '../state.js';
import { applySaberGrip } from '../player/model/weapons.js';
import { setHero } from '../player/hero.js';
import { startLevel } from '../game/flow.js';
import { startEndless } from '../game/survival.js';
import { startTutorial, skipStep, setTrainingExit, trainingDone } from '../game/tutorial.js';
import { closeProgress } from './store-ui.js';
import { DIFFS } from '../data/difficulty.js';
import { renderControls } from './controls.js';
import { svgIcon } from './icons.js';
import './roadmap.js';

/* ============================================================
   INPUT
   ============================================================ */
export const overlay = document.getElementById('overlay');

/* OVERLAY STATE — one screen, four faces: 'menu' (first run), 'pause', 'dead', 'victory'. Each sets the headline,
   the primary button's label and which blocks show (hero/mode setup only where picking makes sense). */
let _ovState = 'menu';
export function setOverlayState(state){
  _ovState = state;
  overlay.classList.remove('st-menu', 'st-pause', 'st-dead', 'st-victory', 'confirming');
  overlay.classList.add('st-' + state);
  document.body.classList.toggle('in-menu', state === 'menu');
  document.getElementById('banner').style.opacity = '0';   // the overlay carries the message; don't let a banner ghost through it
  overlay.classList.remove('asktrain');
  document.getElementById('restartBtn').style.display = state === 'menu' ? 'none' : 'inline-flex';
  document.getElementById('restartBtn').textContent = G.training ? '↻ RESTART TRAINING' : '↻ RESTART RUN';
  document.getElementById('skipBtn').style.display = state === 'pause' && G.training ? 'inline-flex' : 'none';
  const go = document.getElementById('goText'), sub = document.getElementById('ovsub');
  if (state === 'menu'){
    go.textContent = G.modeSel === 'endless' ? 'BEGIN SURVIVAL' : G.modeSel === 'training' ? 'BEGIN TRAINING' : 'BEGIN CAMPAIGN';
    sub.textContent = G.modeSel === 'endless' ? 'HOW LONG CAN YOU LAST?' : G.modeSel === 'training' ? 'LEARN THE WAYS OF YOUR ORDER' : 'CHOOSE YOUR LEGEND';
  } else if (state === 'pause'){
    go.textContent = 'RESUME'; sub.textContent = 'PAUSED';
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
  setHowTo(false); setSettings(false);
  if (G.modeSel === 'endless' && !survivalUnlocked()) G.modeSel = 'campaign';   // safety — never launch a locked mode
  if (G.mode === 'menu' || G.mode === 'victory'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.modeSel === 'endless') startEndless(); else if (G.modeSel === 'training') startTutorial(); else startLevel(0);
  } else if (G.mode === 'dead'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.endless) startEndless(); else if (G.training) startTutorial(); else startLevel(G.levelIdx);   // survival retry = a fresh survival run
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
    if (un){ md.textContent = 'endless waves, chase a high score'; el.title = ''; }
    else { const j = localStorage.getItem('sw_camp_jedi') === '1', m = localStorage.getItem('sw_camp_mando') === '1';
      const mark = (ok) => ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>';
      md.innerHTML = svgIcon('lock', 'lk') + 'win as Jedi ' + mark(j) + ' &amp; Mando ' + mark(m);
      el.title = 'Survival unlocks once you have beaten the campaign with both heroes'; }
  }
}
function setModeSel(m){
  if (m === 'endless' && !survivalUnlocked()){   // can't pick a locked mode
    S.uiDeny();
    const el = document.getElementById('mode-endless'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    return;
  }
  G.modeSel = m;
  for (const k of ['campaign', 'endless', 'training']) document.getElementById('mode-' + k).classList.toggle('sel', m === k);
  if (_ovState === 'menu') setOverlayState('menu');   // headline + button follow the mode
}
document.getElementById('mode-campaign').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('campaign'); });
document.getElementById('mode-endless').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('endless'); });
document.getElementById('mode-training').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('training'); });
refreshSurvivalLock();
// TRAINING marks which heroes have finished it
function refreshTrainingMark(){
  const md = document.querySelector('#mode-training .md'); if (!md) return;
  const j = trainingDone('jedi'), m = trainingDone('mando');
  md.innerHTML = (j || m) ? 'learn the moves · Jedi ' + (j ? '<span class="ok">✓</span>' : '–') + ' Mando ' + (m ? '<span class="ok">✓</span>' : '–')
                          : 'learn your hero\'s moves';
}
refreshTrainingMark();
// FIRST CAMPAIGN — once, a hero who hasn't trained (or beaten the campaign) is offered the training grounds first
function shouldOfferTraining(){
  if (_ovState !== 'menu' || G.modeSel !== 'campaign' || trainingDone(G.hero)) return false;
  try { return localStorage.getItem('sw_asktrain') !== '1' && localStorage.getItem('sw_camp_' + G.hero) !== '1'; } catch(e){ return false; }
}
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
// SABER GRIP — regular or reverse (Shien) lightsaber grip; a look preference, swings hit the same either way
export function setSaberGrip(grip){
  G.saberGrip = grip === 'reverse' ? 'reverse' : 'regular';
  try { localStorage.setItem('sw_sabergrip', G.saberGrip); } catch(e){}
  applySaberGrip(player, G.saberGrip);
  const gv = document.getElementById('gripval'); if (gv) gv.textContent = G.saberGrip.toUpperCase();
}
setSaberGrip(localStorage.getItem('sw_sabergrip') || 'regular');
document.getElementById('gripctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setSaberGrip(G.saberGrip === 'reverse' ? 'regular' : 'reverse'); });
// SETTINGS sliders — mouse sensitivity + master volume. stopPropagation on both click & pointerdown so dragging
// the thumb never bubbles into the overlay's click-to-resume/launch handler.
function setMouseSens(v){
  G.mouseSens = Math.max(0.4, Math.min(2.2, v));
  try { localStorage.setItem('sw_sens', G.mouseSens); } catch(e){}
  const sv = document.getElementById('sensval'); if (sv) sv.textContent = G.mouseSens.toFixed(2) + '×';
  const sl = document.getElementById('senssl'); if (sl && +sl.value !== G.mouseSens) sl.value = G.mouseSens;
}
setMouseSens(parseFloat(localStorage.getItem('sw_sens')) || 1);
// SCREEN SHAKE — scales every camera shake, roll and hit kick (0 turns them off)
function setShakeScale(v){
  G.shakeScale = Math.max(0, Math.min(1.5, isNaN(v) ? 1 : v));
  try { localStorage.setItem('sw_shake', G.shakeScale); } catch(e){}
  const sv = document.getElementById('shakeval'); if (sv) sv.textContent = G.shakeScale ? Math.round(G.shakeScale * 100) + '%' : 'OFF';
  const sl = document.getElementById('shakesl'); if (sl && +sl.value !== G.shakeScale) sl.value = G.shakeScale;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_shake')); } catch(e){} setShakeScale(isNaN(v) ? 1 : v); }
setMasterVol(shared.masterVol);   // sync the sliders/labels to the values already loaded from localStorage
setMusicVol(AE.vol.music); setSfxVol(AE.vol.sfx);
const senssl = document.getElementById('senssl'), volsl = document.getElementById('volsl');
senssl.addEventListener('pointerdown', (e) => e.stopPropagation());
senssl.addEventListener('click', (e) => e.stopPropagation());
senssl.addEventListener('input', (e) => setMouseSens(parseFloat(e.target.value)));
volsl.addEventListener('pointerdown', (e) => e.stopPropagation());
volsl.addEventListener('click', (e) => e.stopPropagation());
volsl.addEventListener('input', (e) => { audioInit(); setMasterVol(parseFloat(e.target.value)); });
{ const sl = document.getElementById('shakesl');
  sl.addEventListener('pointerdown', (e) => e.stopPropagation());
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => setShakeScale(parseFloat(e.target.value))); }
for (const [id, set] of [['mussl', setMusicVol], ['fxsl', setSfxVol]]){
  const sl = document.getElementById(id); if (!sl) continue;
  sl.addEventListener('pointerdown', (e) => e.stopPropagation());
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => { audioInit(); set(parseFloat(e.target.value)); });
  sl.addEventListener('change', () => S.uiClick());   // a blip at the new level when you let go
}
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
// SETTINGS — every option lives in this panel so the main menu and pause screen stay clean; it opens from either
const settings = document.getElementById('settings');
function setSettings(open){ settings.classList.toggle('open', open); }
document.getElementById('settoggle').addEventListener('click', (e) => { e.stopPropagation(); setSettings(true); });
document.getElementById('setclose').addEventListener('click', (e) => { e.stopPropagation(); setSettings(false); });
settings.addEventListener('click', (e) => {
  e.stopPropagation();   // changing a setting must never launch or resume the game
  if (e.target === settings) setSettings(false);   // click the backdrop to close
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && settings.classList.contains('open')) setSettings(false); });
setOverlayState('menu');

// UI SOUND — a soft tick when the pointer lands on something you can pick, a firmer blip when you pick it
const UI_PICK = '.herocard, .modeopt, .btn, .setpill, .card, .howto-hero span, .howto-x';
let _hoverEl = null;
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest(UI_PICK);
  if (el === _hoverEl) return;
  _hoverEl = el;
  if (el && !el.classList.contains('cant') && !el.classList.contains('locked')) S.uiHover();
});
document.addEventListener('click', (e) => {
  const el = e.target.closest(UI_PICK); if (!el) return;
  if (el.classList.contains('cant') || el.classList.contains('locked')) S.uiDeny();   // can't take it
  else S.uiClick();
}, true);
overlay.addEventListener('click', (e) => {
  // only the primary button or empty backdrop launches/resumes: a stray click on a label or setting shouldn't
  if (e.target.closest('#runsummary, #setup, #homeconfirm, #trainconfirm, .ov-foot')) return;
  if (shouldOfferTraining()){
    try { localStorage.setItem('sw_asktrain', '1'); } catch(err){}
    overlay.classList.add('asktrain');
    return;
  }
  launch();
});
document.getElementById('trainYes').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('asktrain'); setModeSel('training'); launch(); });
document.getElementById('trainNo').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('asktrain'); launch(); });
// take the pointer lock and start (or resume) play; where the lock never works, play unlocked
function launch(){
  audioInit();
  requestLock();
  setTimeout(() => {
    if (document.pointerLockElement === renderer.domElement) return;
    if (shared.lockWorked){
      // the lock works here but this request was refused — usually the browser's ~1s cooldown after Esc. Stay on the
      // overlay and ask for another click rather than dropping into the unlocked fallback with a loose cursor.
      document.getElementById('ovsub').textContent = 'CLICK AGAIN TO LOCK THE CURSOR';
      return;
    }
    shared.lockFallback = true;   // pointer lock never worked on this page (e.g. an embedded preview) — play unlocked
    beginPlay();
  }, 350);
}
// POINTER LOCK — newer browsers return a promise that rejects on refusal; swallow it (the overlay handles the outcome)
function requestLock(){
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){}
}
// a refused lock while a fight is running (restart / R / closing the upgrade screen too soon after Esc) would leave the
// game live with a free cursor and dead mouse-look — pause instead, so one click on RESUME takes the lock again
document.addEventListener('pointerlockerror', () => {
  if (document.pointerLockElement || shared.lockFallback || G.skillSelect || G.mode !== 'play' || overlay.style.display === 'flex') return;
  overlay.style.display = 'flex';
  G.paused = true;
  setOverlayState('pause');
  if (shared.lockWorked) document.getElementById('ovsub').textContent = 'CLICK RESUME TO LOCK THE CURSOR';
});
// in the unlocked fallback, keep offering the real lock: a click on the game takes it if the browser now allows it
renderer.domElement.addEventListener('mousedown', () => { if (shared.lockFallback && G.mode === 'play') requestLock(); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (G.skillSelect && !locked) return;   // skill tree owns the cursor — don't show the pause overlay
  if (locked){
    shared.lockFallback = false;
    shared.lockWorked = true;
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
  document.body.classList.remove('in-menu'); setHowTo(false); setSettings(false);
  if (G.endless) startEndless(); else if (G.training) startTutorial(); else startLevel(0);   // a survival run restarts as survival, not the campaign
  if (!shared.lockFallback) requestLock();
}
document.getElementById('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); restartRun(); });
// MAIN MENU — abandon the run and go back to the title screen. From pause it asks first (a run is easy to lose
// by accident); from the fallen/victory screens the run is already over, so it goes straight there.
function goHome(){
  overlay.classList.remove('confirming');
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false;
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  startLevel(0);   // sweep the battlefield and reset the hero + kit, exactly as a fresh campaign would
  G.mode = 'menu'; G.paused = false; G.slowmo = 1; G.slowmoT = 0; G.hitstop = 0;
  overlay.style.display = 'flex';
  refreshSurvivalLock(); refreshTrainingMark();
  setOverlayState('menu');
  overlay.scrollTop = 0;
}
// finishing the training grounds hands you back to the menu, with the campaign picked
setTrainingExit(() => {
  if (document.pointerLockElement) document.exitPointerLock();
  setModeSel('campaign');
  goHome();
});
document.getElementById('skipBtn').addEventListener('click', () => skipStep());   // and the overlay click resumes play
document.getElementById('homeBtn').addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (_ovState === 'pause') overlay.classList.add('confirming'); else goHome();
});
document.getElementById('homeYes').addEventListener('click', (e) => { e.stopPropagation(); goHome(); });
document.getElementById('homeNo').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('confirming'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('confirming')) overlay.classList.remove('confirming'); });
// FULLSCREEN — the whole page goes fullscreen (HUD and menus are DOM over the canvas). Esc while playing still just
// pauses: the browser spends the first Esc on the pointer lock and only a second one leaves fullscreen.
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function syncFullscreen(){ document.getElementById('fsval').textContent = fsEl() ? 'ON' : 'OFF'; }
function toggleFullscreen(){
  const root = document.documentElement;
  try {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    }
  } catch(err){}
}
if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) document.getElementById('fsctl').style.display = 'none';
document.getElementById('fsctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); toggleFullscreen(); });
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);
syncFullscreen();
document.getElementById('continueBtn').addEventListener('click', (e) => { e.stopPropagation(); closeProgress(); });
// GRAPHICS selector on the overlay — cycle quality without resuming/launching (stop the click bubbling to the overlay)
document.getElementById('gfxctl').addEventListener('click', (e) => { e.stopPropagation(); cycleQuality(); });
