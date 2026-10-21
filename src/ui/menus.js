// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Main menu: hero, mode and difficulty pickers, pause, restart, return to menu and fullscreen.

import { renderer } from '../engine/renderer.js';
import { cycleQuality } from '../engine/quality.js';
import { audioInit, setMasterVol, setMusicVol, setSfxVol, S } from '../audio/sfx.js';
import { AE } from '../audio/engine.js';
import { shared, G, player } from '../state.js';
import { applySaberGrip } from '../player/model/weapons.js';
import { setHero } from '../player/hero.js';
import { startLevel, retryLevel, retryIsBoss } from '../game/flow.js';
import { startEndless } from '../game/survival.js';
import { startTutorial, skipStep, setTrainingExit, trainingDone } from '../game/tutorial.js';
import { startMission, retryMission, missionDone, missionTitle } from '../game/mission.js';
import { startSandbox, sandboxUnlocked } from '../game/sandbox.js';
import { closeSandboxPanel } from './sandbox-ui.js';
import { MISSIONS } from '../data/missions.js';
import { closeProgress } from './store-ui.js';
import { DIFFS } from '../data/difficulty.js';
import { renderControls } from './controls.js';
import { svgIcon } from './icons.js';
import { setRoadmap } from './roadmap.js';
import { enterFullscreenIfWanted, escapeIsOurs } from './fullscreen.js';
import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { buildArena } from '../world/arena.js';
import { findClearSpawn } from '../world/collision.js';
import { playerPos } from '../player/helpers.js';

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
  document.getElementById('restartBtn').textContent = G.training ? '↻ RESTART TRAINING' : G.mission ? '↻ RESTART MISSION' : '↻ RESTART RUN';
  document.getElementById('skipBtn').style.display = state === 'pause' && G.training ? 'inline-flex' : 'none';
  const go = document.getElementById('goText'), sub = document.getElementById('ovsub');
  if (state === 'menu'){
    go.textContent = G.modeSel === 'endless' ? 'BEGIN SURVIVAL' : G.modeSel === 'training' ? 'BEGIN TRAINING' : G.modeSel === 'mission' ? 'BEGIN MISSION' : G.modeSel === 'sandbox' ? 'ENTER THE SANDBOX' : 'BEGIN CAMPAIGN';
    sub.textContent = G.modeSel === 'endless' ? 'HOW LONG CAN YOU LAST?' : G.modeSel === 'training' ? 'LEARN THE WAYS OF YOUR ORDER' : G.modeSel === 'mission' ? missionTitle(G.missionId) : G.modeSel === 'sandbox' ? 'ANY FOE, ANY POWER' : 'CHOOSE YOUR LEGEND';
  } else if (state === 'pause'){
    go.textContent = 'RESUME'; sub.textContent = 'PAUSED';
  } else if (state === 'dead'){
    go.textContent = G.endless ? 'NEW SURVIVAL RUN' : G.mission ? 'RETRY THIS OBJECTIVE' : G.sandbox ? 'BACK TO THE SANDBOX' : retryIsBoss() ? 'RETRY THE BOSS' : 'RETRY THIS LEVEL';
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
  if ((G.modeSel === 'endless' && !survivalUnlocked()) || (G.modeSel === 'sandbox' && !sandboxUnlocked())) G.modeSel = 'campaign';   // safety — never launch a locked mode
  if (G.mode === 'menu' || G.mode === 'victory'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.modeSel === 'endless') startEndless(); else if (G.modeSel === 'training') startTutorial(); else if (G.modeSel === 'mission') startMission(G.missionId); else if (G.modeSel === 'sandbox') startSandbox(); else startLevel(0);
  } else if (G.mode === 'dead'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.endless) startEndless(); else if (G.training) startTutorial(); else if (G.mission) retryMission(); else if (G.sandbox) startSandbox(); else retryLevel();   // survival retry = a fresh survival run
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
// SANDBOX is LOCKED until the campaign has been cleared with either hero (game/sandbox.js)
export function refreshSandboxLock(){
  const el = document.getElementById('mode-sandbox'); if (!el) return;
  const un = sandboxUnlocked(), md = el.querySelector('.md');
  el.classList.toggle('locked', !un);
  if (md) md.innerHTML = un ? 'any foe, any power' : svgIcon('lock', 'lk') + 'beat the campaign';
  el.title = un ? '' : 'The sandbox unlocks once you have beaten the campaign with either hero';
}
function setModeSel(m){
  if ((m === 'endless' && !survivalUnlocked()) || (m === 'sandbox' && !sandboxUnlocked())){   // can't pick a locked mode
    S.uiDeny();
    const el = document.getElementById('mode-' + m); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    return;
  }
  G.modeSel = m;
  for (const k of ['campaign', 'endless', 'training', 'sandbox']) document.getElementById('mode-' + k).classList.toggle('sel', m === k);
  if (_ovState === 'menu') setOverlayState('menu');   // headline + button follow the mode
}
document.getElementById('mode-campaign').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('campaign'); });
document.getElementById('mode-endless').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('endless'); });
document.getElementById('mode-training').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('training'); });
document.getElementById('mode-sandbox').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('sandbox'); });
// EXPERIMENTAL (in the EXTRAS panel): one card per story mission (data/missions.js), each launching straight in
document.getElementById('xplist').innerHTML = Object.values(MISSIONS).map(m =>
  `<div class="xp-card" id="xp-${m.id}">
    <div class="xp-text"><span class="mt">STORY · ${m.title}</span><span class="md"></span><span class="xp-note">Work in progress: balance and the map are still changing.</span></div>
    <div class="btn primary" data-mission="${m.id}">PLAY</div>
  </div>`).join('');
for (const b of document.querySelectorAll('#xplist [data-mission]')) b.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit(); setRoadmap(false);
  G.modeSel = 'mission'; G.missionId = b.dataset.mission; if (_ovState === 'menu') setOverlayState('menu');
  launch();
});
refreshSurvivalLock(); refreshSandboxLock();
// TRAINING marks which heroes have finished it
function refreshTrainingMark(){
  const md = document.querySelector('#mode-training .md'); if (!md) return;
  const j = trainingDone('jedi'), m = trainingDone('mando');
  md.innerHTML = (j || m) ? 'learn the moves · Jedi ' + (j ? '<span class="ok">✓</span>' : '–') + ' Mando ' + (m ? '<span class="ok">✓</span>' : '–')
                          : 'learn your hero\'s moves';
}
refreshTrainingMark();
// STORY MISSIONS mark which heroes have won them
function refreshMissionMark(){
  for (const id in MISSIONS){
    const md = document.querySelector('#xp-' + id + ' .md'); if (!md) continue;
    const j = missionDone(id, 'jedi'), m = missionDone(id, 'mando');
    md.innerHTML = MISSIONS[id].blurb + ((j || m) ? ' · Jedi ' + (j ? '<span class="ok">✓</span>' : '–') + ' Mando ' + (m ? '<span class="ok">✓</span>' : '–') : '');
  }
}
refreshMissionMark();
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
  applySaberGrip(player, G.saberGrip, G.mode !== 'play');
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
// FIELD OF VIEW — the resting vertical FOV the camera eases toward (dash kicks and disruptor zoom still ride on top)
function setFov(v){
  G.fov = Math.round(Math.max(50, Math.min(90, isNaN(v) ? CFG.camera.fov : v)));
  try { localStorage.setItem('sw_fov', G.fov); } catch(e){}
  const sv = document.getElementById('fovval'); if (sv) sv.textContent = G.fov + '°';
  const sl = document.getElementById('fovsl'); if (sl && +sl.value !== G.fov) sl.value = G.fov;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_fov')); } catch(e){} setFov(isNaN(v) ? CFG.camera.fov : v); }
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
// FOV PREVIEW — while the slider is held (or nudged with the arrow keys) the settings fade away and the live
// in-game view shows through, so you can see the new width as you pick it
{ const sl = document.getElementById('fovsl');
  let held = false, idle = 0;
  const preview = (on) => {
    // from the title screen before any run there's no arena yet: raise the first one so there's a view to judge
    if (on && G.mode === 'menu' && !shared.arenaGroup.children.length){
      buildArena(LEVELS[0]);
      const spot = findClearSpawn(0, shared.arenaHalf * 0.5, CFG.player.radius + 1.0); playerPos().set(spot.x, 0, spot.z);
    }
    G.fovPreview = on; document.body.classList.toggle('fovpreview', on);
  };
  const release = () => { if (!held) return; held = false; preview(false); };
  sl.addEventListener('pointerdown', (e) => { e.stopPropagation(); held = true; clearTimeout(idle); preview(true); });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => {
    setFov(parseFloat(e.target.value));
    if (!held){ preview(true); clearTimeout(idle); idle = setTimeout(() => preview(false), 900); }   // keyboard nudges
  }); }
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
const UI_PICK = '.herocard, .modeopt, .btn, .setpill, .card, .howto-hero span, .howto-x, .cz-open, .cz-sw, .cz-chip, .cz-tabs span';
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
  if (e.target.closest('#runsummary, #setup, #customizer, #homeconfirm, #trainconfirm, .ov-foot')) return;
  if (overlay.classList.contains('customizing')) return;   // the stage turns the hero while customizing (ui/customizer.js)
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
  enterFullscreenIfWanted();   // after the lock request: entering fullscreen uses up the click's user gesture
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
// PAUSE KEYS — Enter resumes from the pause screen in every browser. Where Esc is locked to the game (fullscreen in
// Chrome / Edge, see fullscreen.js) a quick Esc pauses and resumes too, so closing the pause screen with Esc no longer
// drops you out of fullscreen. Runs in the capture phase so it sees the screen before Esc closes a panel on top of it.
const panelOpen = () => howto.classList.contains('open') || settings.classList.contains('open') ||
  document.getElementById('roadmap').classList.contains('open') || document.getElementById('coop').classList.contains('open') || overlay.classList.contains('confirming') || overlay.classList.contains('asktrain');
window.addEventListener('keydown', (e) => {
  if (e.repeat || (e.key !== 'Escape' && e.key !== 'Enter')) return;
  const esc = e.key === 'Escape';
  if (esc && !escapeIsOurs()) return;   // the browser owns Esc here (pointer lock / fullscreen exit)
  if (esc) e.preventDefault();
  const shown = overlay.style.display === 'flex';
  if (shown && _ovState === 'pause' && G.mode === 'play' && !panelOpen()){ e.preventDefault(); launch(); return; }
  if (esc && !shown && G.mode === 'play' && !G.skillSelect){
    if (document.pointerLockElement) document.exitPointerLock();   // pointerlockchange shows the pause screen
    else if (shared.lockFallback){ overlay.style.display = 'flex'; G.paused = true; setOverlayState('pause'); }
  }
}, true);
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
  G.skillSelect = false; G.sbMenu = false;
  G.mode = 'play'; G.slowmo = 1; G.paused = false;
  document.body.classList.remove('in-menu'); setHowTo(false); setSettings(false);
  if (G.endless) startEndless(); else if (G.training) startTutorial(); else if (G.mission) startMission(G.missionId); else if (G.sandbox) startSandbox(); else startLevel(0);   // a survival run restarts as survival, not the campaign
  if (!shared.lockFallback) requestLock();
}
document.getElementById('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); restartRun(); });
// MAIN MENU — abandon the run and go back to the title screen. From pause it asks first (a run is easy to lose
// by accident); from the fallen/victory screens the run is already over, so it goes straight there.
function goHome(){
  overlay.classList.remove('confirming');
  closeSandboxPanel(false);
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false; G.sbMenu = false;
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  startLevel(0);   // sweep the battlefield and reset the hero + kit, exactly as a fresh campaign would
  G.mode = 'menu'; G.paused = false; G.slowmo = 1; G.slowmoT = 0; G.hitstop = 0;
  overlay.style.display = 'flex';
  if (G.modeSel === 'mission') setModeSel('campaign');   // the experimental mission isn't a menu pick: back to the campaign
  refreshSurvivalLock(); refreshSandboxLock(); refreshTrainingMark(); refreshMissionMark();
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
document.querySelectorAll('.fsctl').forEach((el) => el.addEventListener('click', audioInit));   // fullscreen.js does the toggling
document.getElementById('continueBtn').addEventListener('click', (e) => { e.stopPropagation(); closeProgress(); });
// GRAPHICS selector on the overlay — cycle quality without resuming/launching (stop the click bubbling to the overlay)
document.getElementById('gfxctl').addEventListener('click', (e) => { e.stopPropagation(); cycleQuality(); });
