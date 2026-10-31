// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Main menu: hero, mode (and mission) and difficulty pickers, pause, restart, return to menu and fullscreen.

import { renderer } from '../engine/renderer.js';
import { cycleQuality } from '../engine/quality.js';
import { audioInit, setMasterVol, setMusicVol, setSfxVol, S } from '../audio/sfx.js';
import { AE } from '../audio/engine.js';
import { shared, G, player } from '../state.js';
import { applySaberGrip } from '../player/model/weapons.js';
import { setHero } from '../player/hero.js';
import { startLevel, retryLevel, retryIsBoss, startCoopCampaign } from '../game/flow.js';
import { coopRun } from '../net/run.js';
import { startEndless } from '../game/survival.js';
import { startTutorial, retryTutorial, skipStep, setTrainingExit, trainingDone, openLessonBoard, trainOnForm } from '../game/tutorial.js';
import { setTrainHook } from '../game/meditation.js';
import { startMission, startCoopMission, retryMission, missionDone, missionTitle } from '../game/mission.js';
import { startSandbox, sandboxUnlocked } from '../game/sandbox.js';
import { sandboxFull, sandboxProgress, missionUnlocked, missionChapterNo } from '../game/sandbox-unlocks.js';
import { closeSandboxPanel } from './sandbox-ui.js';
import { MISSIONS } from '../data/missions.js';
import { closeProgress } from './store-ui.js';
import { DIFFS } from '../data/difficulty.js';
import { renderControls, toggleControlsDetail, setControlsDevice } from './controls.js';
import { svgIcon } from './icons.js';
import { enterFullscreenIfWanted, escapeIsOurs } from './fullscreen.js';
import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { buildArena } from '../world/arena.js';
import { findClearSpawn } from '../world/collision.js';
import { playerPos, heldGrip } from '../player/helpers.js';
import { canResume, resumeRun, resumeLabel, resumeProgress, captureRun } from '../game/saves.js';
import { startCampaign, joinCampaign, closeCard, chapterLabel } from '../game/campaign.js';
import { pad } from '../engine/gamepad.js';
import { openPrefight } from './forms-ui.js';

/* ============================================================
   INPUT
   ============================================================ */
export const overlay = document.getElementById('overlay');

/* OVERLAY STATE — one screen, four faces: 'menu' (first run), 'pause', 'dead', 'victory'. Each sets the headline,
   the primary button's label and which blocks show (hero/mode setup only where picking makes sense). */
let _ovState = 'menu';
export function setOverlayState(state){
  _ovState = state;
  overlay.classList.remove('st-menu', 'st-pause', 'st-dead', 'st-victory', 'confirming', 'newconfirming');
  overlay.classList.add('st-' + state);
  document.body.classList.toggle('in-menu', state === 'menu');
  document.getElementById('banner').style.opacity = '0';   // the overlay carries the message; don't let a banner ghost through it
  overlay.classList.remove('asktrain');
  if (state !== 'pause') document.getElementById('ovctx').textContent = '';
  document.getElementById('restartBtn').style.display = state === 'menu' ? 'none' : 'inline-flex';
  document.getElementById('restartBtn').textContent = G.training ? '↻ RESTART TRAINING' : G.mission && G.chapter < 0 ? '↻ RESTART MISSION' : '↻ RESTART RUN';
  document.getElementById('skipBtn').style.display = state === 'pause' && G.training ? 'inline-flex' : 'none';
  document.getElementById('lessonsBtn').style.display = state === 'pause' && G.training ? 'inline-flex' : 'none';
  document.getElementById('formsBtn').style.display = G.hero === 'mando' ? 'none' : '';   // the Jedi's forms page (ui/forms-ui.js)
  const go = document.getElementById('goText'), sub = document.getElementById('ovsub');
  if (state === 'menu' && G.modeSel === 'campaign' && canResume()){   // a loaded save picks the campaign up where it was
    go.textContent = 'CONTINUE CAMPAIGN'; sub.textContent = resumeLabel();
  } else if (state === 'menu'){
    go.textContent = G.modeSel === 'endless' ? 'BEGIN SURVIVAL' : G.modeSel === 'training' ? 'BEGIN TRAINING' : G.modeSel === 'mission' ? 'BEGIN MISSION' : G.modeSel === 'sandbox' ? 'ENTER THE SANDBOX' : 'BEGIN CAMPAIGN';
    sub.textContent = G.modeSel === 'endless' ? 'HOW LONG CAN YOU HOLD?' : G.modeSel === 'training' ? 'LEARN THE CONTROLS AND POWERS' : G.modeSel === 'mission' ? (missionOpen(G.missionId) ? missionTitle(G.missionId) : 'LOCKED MISSION') : G.modeSel === 'sandbox' ? (sandboxFull() ? 'ANY FOE, ANY POWER' : 'THE STORY SO FAR') : 'CHOOSE YOUR LEGEND';
  } else if (state === 'pause'){
    go.textContent = 'RESUME'; sub.textContent = 'PAUSED';
    const where = G.chapter >= 0 ? 'CAMPAIGN · ' + chapterLabel() : G.training ? 'TRAINING' : G.sandbox ? 'SANDBOX' : G.mission ? missionTitle(G.missionId) : G.endless ? 'SURVIVAL' : 'CAMPAIGN';
    document.getElementById('ovctx').textContent = where + ' · ' + (G.hero === 'mando' ? 'MANDALORIAN' : 'JEDI');
  } else if (state === 'dead'){
    go.textContent = G.endless ? 'NEW SURVIVAL RUN' : G.mission ? 'RETRY THIS OBJECTIVE' : G.sandbox ? 'BACK TO THE SANDBOX' : retryIsBoss() ? 'RETRY THE BOSS' : G.chapter >= 0 ? 'RETRY THIS CHAPTER' : 'RETRY THIS LEVEL';
    sub.textContent = '';   // the run summary's own title carries the moment
  } else if (state === 'victory'){
    go.textContent = 'PLAY AGAIN';
  }
  queueFit();
}

/* FIT THE MENU — the title screen's column always fits the window without scrolling: when the window is too short for
   it (a laptop screen, the mission list open, the customizer's rows), the whole column is scaled down to fit. Other
   screens scroll as before. */
let _fitQueued = false;
function queueFit(){ if (!_fitQueued){ _fitQueued = true; requestAnimationFrame(fitMenu); } }
function fitMenu(){
  _fitQueued = false;
  const inner = overlay.querySelector('.ov-inner');
  inner.style.zoom = '';
  if (_ovState !== 'menu') return;
  const z = Math.min(1, (window.innerHeight - 10) / inner.offsetHeight);
  if (z < 0.995) inner.style.zoom = Math.max(0.55, z).toFixed(3);
}
window.addEventListener('resize', queueFit);
new MutationObserver(queueFit).observe(overlay, { attributes: true, attributeFilter: ['class'] });   // customizing on and off

function beginPlay(){
  overlay.style.display = 'none';
  document.getElementById('banner').style.opacity = '0';
  // leaving the end screen → re-arm the summary for the next run
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  document.body.classList.remove('in-menu');
  setHowTo(false); setSettings(false);
  if (G.modeSel === 'mission' && !G.coopJoin && !missionOpen(G.missionId)) G.modeSel = 'campaign';   // a locked mission never launches
  if ((G.modeSel === 'endless' && !survivalUnlocked() && !G.coopJoin) || (G.modeSel === 'sandbox' && !sandboxUnlocked())) G.modeSel = 'campaign';   // safety — never launch a locked mode
  if (G.mode === 'menu' || G.mode === 'victory'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.coopJoin && G.modeSel === 'mission') startCoopMission(G.missionId);
    else if (G.coopJoin && G.modeSel === 'campaign'){ if (coopRun.ch >= 0) joinCampaign(coopRun.ch, coopRun.a2, coopRun.w, coopRun.wt); else startCoopCampaign(coopRun.lv, coopRun.w, coopRun.wt); }
    else if (G.modeSel === 'endless') startEndless(); else if (G.modeSel === 'training') startTutorial(); else if (G.modeSel === 'mission') startMission(G.missionId); else if (G.modeSel === 'sandbox') startSandbox(); else if (canResume()) resumeRun(); else startCampaign();
  } else if (G.mode === 'dead'){
    G.mode = 'play'; G.slowmo = 1;
    if (G.endless) startEndless(); else if (G.training) retryTutorial(); else if (G.mission) retryMission(); else if (G.sandbox) startSandbox(); else retryLevel();   // survival retry = a fresh survival run
  } else if (G.mode === 'play'){
    overlay.style.display = 'none';  // resume from pause
  }
  G.paused = false;   // unfreeze the sim on (re)entering play
}
// hero picker — select only (don't ignite); the player clicks elsewhere / GO to launch
document.getElementById('hero-jedi').addEventListener('click', (e) => { e.stopPropagation(); setHero('jedi'); refreshMissionMark(); });
document.getElementById('hero-mando').addEventListener('click', (e) => { e.stopPropagation(); setHero('mando'); refreshMissionMark(); });
// mode picker — campaign vs survival
// SURVIVAL is LOCKED until the campaign has been cleared as BOTH heroes (any difficulty).
export function survivalUnlocked(){ try { return localStorage.getItem('sw_camp_jedi') === '1' && localStorage.getItem('sw_camp_mando') === '1'; } catch(e){ return false; } }
export function refreshSurvivalLock(){
  const el = document.getElementById('mode-endless'); if (!el) return;
  const un = survivalUnlocked(), md = el.querySelector('.md');
  el.classList.toggle('locked', !un);
  if (md){
    if (un){ md.textContent = 'Endless waves, one high score'; el.title = ''; }
    else { const j = localStorage.getItem('sw_camp_jedi') === '1', m = localStorage.getItem('sw_camp_mando') === '1';
      const mark = (ok) => ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>';
      md.innerHTML = svgIcon('lock', 'lk') + 'Jedi ' + mark(j) + ' · Mando ' + mark(m);
      el.title = 'Survival unlocks once you have beaten the campaign with both heroes'; }
  }
}
// SANDBOX is LOCKED until Act I of the campaign has been cleared with either hero, then offers the story so far, and
// everything once the campaign is beaten (game/sandbox-unlocks.js)
export function refreshSandboxLock(){
  const el = document.getElementById('mode-sandbox'); if (!el) return;
  const un = sandboxUnlocked(), full = un && sandboxFull(), md = el.querySelector('.md');
  el.classList.toggle('locked', !un);
  if (md) md.innerHTML = full ? 'Any foe, any power' : un ? 'The story so far · ' + sandboxProgress().n + '/' + sandboxProgress().of : svgIcon('lock', 'lk') + 'Clear Act I';
  el.title = full ? '' : un ? 'The foes, powers and forms you have met in the campaign. Beat it to open everything'
                            : 'The sandbox unlocks once you have cleared Act I of the campaign with either hero';
}
export function setModeSel(m){
  if ((m === 'endless' && !survivalUnlocked()) || (m === 'sandbox' && !sandboxUnlocked())){   // can't pick a locked mode
    S.uiDeny();
    const el = document.getElementById('mode-' + m); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    return;
  }
  G.modeSel = m;
  for (const k of ['campaign', 'mission', 'endless', 'training', 'sandbox']) document.getElementById('mode-' + k).classList.toggle('sel', m === k);
  document.getElementById('setup').classList.toggle('camp', m === 'campaign');
  document.getElementById('setup').classList.toggle('missions', m === 'mission');   // the mission list opens under the modes
  if (_ovState === 'menu') setOverlayState('menu');   // headline + button follow the mode
}
document.getElementById('mode-campaign').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('campaign'); });
document.getElementById('mode-mission').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('mission'); });
document.getElementById('mode-endless').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('endless'); });
document.getElementById('mode-training').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('training'); });
document.getElementById('mode-sandbox').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('sandbox'); });
// CO-OP is a tile but not a mode: it opens the room panel (ui/coop-ui.js)
// MISSIONS: one card per story mission (data/missions.js) under the mode row; pick one, then BEGIN (or double-click it)
const placeOf = (m) => m.level.name.replace(/^(MISSION|TRIAL)\s*—\s*/, '');
document.getElementById('msnlist').innerHTML = Object.values(MISSIONS).filter(m => !m.campaignOnly).map(m =>   // (a campaign-only copy stays off the list)
  `<div class="msn brk" id="msn-${m.id}" data-mission="${m.id}">
    <span class="mt"><span class="mtn">${missionTitle(m.id)}</span>${m.squad ? '<span class="msn-tag">SQUAD</span>' : ''}${m.trial ? '<span class="msn-tag">TRIAL</span>' : ''}<span class="won"></span></span><span class="mw">${placeOf(m)}</span>
  </div>`).join('');
// a campaign trial joins the list once either hero has reached it in the campaign (won it there)
const trialSeen = (id) => !MISSIONS[id].trial || missionDone(id, 'jedi') || missionDone(id, 'mando');
// a mission stays locked and unspoiled until the campaign has cleared it (game/sandbox-unlocks.js)
const missionOpen = (id) => trialSeen(id) && missionUnlocked(id);
export function setMission(id){
  if (!MISSIONS[id] || !trialSeen(id)) id = Object.keys(MISSIONS)[0];
  G.missionId = id; try { localStorage.setItem('sw_mission', id); } catch(e){}
  for (const el of document.querySelectorAll('#msnlist .msn')) el.classList.toggle('sel', el.dataset.mission === id);
  refreshMissionMark();
  if (_ovState === 'menu') setOverlayState('menu');   // the headline names the mission
}
for (const b of document.querySelectorAll('#msnlist [data-mission]')){
  b.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setMission(b.dataset.mission); });
  b.addEventListener('dblclick', (e) => { e.stopPropagation(); setMission(b.dataset.mission); launchFromMenu(); });
}
{ let id; try { id = localStorage.getItem('sw_mission'); } catch(e){} setMission(id || G.missionId); }
refreshSurvivalLock(); refreshSandboxLock(); refreshCampaignMark();
// CAMPAIGN shows how far this hero's saved run is, else the shape of the story
function refreshCampaignMark(){
  const md = document.querySelector('#mode-campaign .md'); if (!md) return;
  const done = localStorage.getItem('sw_camp_' + G.hero) === '1';
  md.innerHTML = canResume() ? resumeProgress() + ' · ' + resumeLabel().replace(/^CHAPTER \d+ · /, '')
               : '13 chapters, three acts' + (done ? ' · <span class="ok">✓</span> beaten' : '');
}
// TRAINING marks which heroes have finished it
function refreshTrainingMark(){
  const md = document.querySelector('#mode-training .md'); if (!md) return;
  const j = trainingDone('jedi'), m = trainingDone('mando');
  md.innerHTML = (j || m) ? 'Jedi ' + (j ? '<span class="ok">✓</span>' : '–') + ' · Mando ' + (m ? '<span class="ok">✓</span>' : '–')
                          : 'Learn the controls and powers';
}
refreshTrainingMark();
// STORY MISSIONS mark which heroes have won them: a tick on the card for each, and the picked one's line under the list
function refreshMissionMark(){
  const mark = (id) => { const j = missionDone(id, 'jedi'), m = missionDone(id, 'mando');
    return (j || m) ? 'Jedi ' + (j ? '<span class="ok">✓</span>' : '–') + ' Mando ' + (m ? '<span class="ok">✓</span>' : '–') : ''; };
  for (const id in MISSIONS){
    const card = document.getElementById('msn-' + id); if (!card) continue;
    card.style.display = trialSeen(id) ? '' : 'none';
    const open = missionOpen(id), ch = missionChapterNo(id);
    card.classList.toggle('locked', !open);
    card.querySelector('.mtn').textContent = open ? missionTitle(id) : '???';   // a trial is named for the hero picked
    card.querySelector('.mw').textContent = open ? placeOf(MISSIONS[id]) : (ch ? 'COMPLETE ' + ch + ' TO UNLOCK' : 'LOCKED');
    for (const t of card.querySelectorAll('.msn-tag')) t.style.display = open ? '' : 'none';
    const w = card.querySelector('.won');
    w.textContent = open ? (missionDone(id, 'jedi') ? 'J✓' : '') + (missionDone(id, 'mando') ? ' M✓' : '') : '🔒';
  }
  const m = MISSIONS[G.missionId], info = document.getElementById('msninfo');
  if (m && info && !missionOpen(m.id)){ const ch = missionChapterNo(m.id); info.textContent = 'Locked. Clear ' + (ch ? ch.toLowerCase().replace(/^c/, 'C') : 'its chapter') + ' in the campaign to unlock this mission.'; }
  else if (m && info) info.innerHTML = m.blurb.charAt(0).toUpperCase() + m.blurb.slice(1) + '.' + (mark(m.id) ? ' &nbsp;' + mark(m.id) : '');
}
// FIRST CAMPAIGN — once, a hero who hasn't trained (or beaten the campaign) is offered the training grounds first
function shouldOfferTraining(){
  if (_ovState !== 'menu' || G.modeSel !== 'campaign' || trainingDone(G.hero) || canResume()) return false;
  try { return localStorage.getItem('sw_asktrain') !== '1' && localStorage.getItem('sw_camp_' + G.hero) !== '1'; } catch(e){ return false; }
}
export function setDiff(d){
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
// CUT AIM — the keys pick the cut's angle (the default), or a mouse flick just before the press does (player/jedi/cutaim.js).
// (sw_cutaim, not the old sw_cutmouse: that one was saved as MOUSE on every load while mouse was the default.)
function setCutMouse(on){
  G.cutMouse = on; try { localStorage.setItem('sw_cutaim', on ? 'mouse' : 'keys'); } catch(e){}
  const v = document.getElementById('cutaimval'); if (v) v.textContent = on ? 'MOUSE' : 'KEYS';
}
setCutMouse(localStorage.getItem('sw_cutaim') === 'mouse');
document.getElementById('cutaimctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setCutMouse(!G.cutMouse); });
// SABER GRIP — regular or reverse grip for Niman (and the Mando); a look preference, swings hit the same either way.
// The other forms hold their own grip (data/forms.js): Shien reverse, the rest forward
export function setSaberGrip(grip){
  G.saberGrip = grip === 'reverse' ? 'reverse' : 'regular';
  try { localStorage.setItem('sw_sabergrip', G.saberGrip); } catch(e){}
  applySaberGrip(player, heldGrip(), G.mode !== 'play');
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
// SCOPE SENSITIVITY — mouse look while the disruptor is scoped in (engine/input.js), a share of the normal one
function setAdsSens(v){
  G.adsSens = Math.max(0.1, Math.min(1, isNaN(v) ? 0.4 : v));
  try { localStorage.setItem('sw_adssens', G.adsSens); } catch(e){}
  const sv = document.getElementById('adsval'); if (sv) sv.textContent = Math.round(G.adsSens * 100) + '%';
  const sl = document.getElementById('adssl'); if (sl && +sl.value !== G.adsSens) sl.value = G.adsSens;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_adssens')); } catch(e){} setAdsSens(v); }
// CONTROLLER — right-stick look speed and up/down invert (engine/gamepad.js)
function setPadSens(v){
  G.padSens = Math.max(0.4, Math.min(2.2, isNaN(v) ? 1 : v));
  try { localStorage.setItem('sw_padsens', G.padSens); } catch(e){}
  const sv = document.getElementById('padval'); if (sv) sv.textContent = G.padSens.toFixed(2) + '×';
  const sl = document.getElementById('padsl'); if (sl && +sl.value !== G.padSens) sl.value = G.padSens;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_padsens')); } catch(e){} setPadSens(v); }
function setPadInvert(on){
  G.padInvert = on;
  try { localStorage.setItem('sw_padinv', on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById('padinvval'); if (sv) sv.textContent = on ? 'ON' : 'OFF';
}
{ let v; try { v = localStorage.getItem('sw_padinv'); } catch(e){} setPadInvert(v === '1'); }
document.getElementById('padinvctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setPadInvert(!G.padInvert); });
{ const sl = document.getElementById('padsl');
  sl.addEventListener('pointerdown', (e) => e.stopPropagation());
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => setPadSens(parseFloat(e.target.value))); }
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
// (sw_fov_v: the default moved to 72, then to 64 with the scale pass; a setting saved before then was most likely the
// old default, so it resets once)
{ let v; try { v = parseFloat(localStorage.getItem('sw_fov')); if (localStorage.getItem('sw_fov_v') !== '3'){ v = NaN; localStorage.setItem('sw_fov_v', '3'); } } catch(e){}
  setFov(isNaN(v) ? CFG.camera.fov : v); }
setMasterVol(shared.masterVol);   // sync the sliders/labels to the values already loaded from localStorage
setMusicVol(AE.vol.music); setSfxVol(AE.vol.sfx);
const senssl = document.getElementById('senssl'), volsl = document.getElementById('volsl');
senssl.addEventListener('pointerdown', (e) => e.stopPropagation());
senssl.addEventListener('click', (e) => e.stopPropagation());
senssl.addEventListener('input', (e) => setMouseSens(parseFloat(e.target.value)));
{ const adssl = document.getElementById('adssl');
  adssl.addEventListener('pointerdown', (e) => e.stopPropagation()); adssl.addEventListener('click', (e) => e.stopPropagation());
  adssl.addEventListener('input', (e) => setAdsSens(parseFloat(e.target.value))); }
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
// CONTROLS — a panel over the menu; opens on the current hero, with tabs to read the other one's controls
const howto = document.getElementById('howto');
function setHowTo(open){
  howto.classList.toggle('open', open);
  if (open){ setControlsDevice(pad.active || pad.connected ? 'pad' : 'kb'); renderControls(G.hero); }
}
document.getElementById('ctltoggle').addEventListener('click', (e) => { e.stopPropagation(); setHowTo(true); });
document.getElementById('howtoclose').addEventListener('click', (e) => { e.stopPropagation(); setHowTo(false); });
howto.addEventListener('click', (e) => {
  e.stopPropagation();   // reading the help must never launch or resume the game
  const tab = e.target.closest('[data-h]'), dev = e.target.closest('[data-dev]');
  if (tab) renderControls(tab.dataset.h);
  else if (dev){ setControlsDevice(dev.dataset.dev); renderControls(document.querySelector('#howtohero .on').dataset.h); }
  else if (e.target.id === 'howtomore') toggleControlsDetail(document.querySelector('#howtohero .on').dataset.h);
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
  // only the primary button launches/resumes — a click on empty backdrop, a label, a card or a setting must not
  if (!e.target.closest('#goText')) return;
  if (overlay.classList.contains('customizing')) return;   // the stage turns the hero while customizing (ui/customizer.js)
  if (overlay.classList.contains('newconfirming')) return;
  beginFromMenu();
});
// BEGIN from the title screen: a hero who hasn't trained is offered the training grounds first
export function beginFromMenu(){
  if (shouldOfferTraining()){
    try { localStorage.setItem('sw_asktrain', '1'); } catch(err){}
    overlay.classList.add('asktrain');
    return;
  }
  launchFromMenu();
}
// a Jedi starting a mode from the title screen sees the forms page first (ui/forms-ui.js): what each form does, and the
// three to carry; its FIGHT launches. RESUME, a retry and PLAY AGAIN go straight back in
function launchFromMenu(){
  if (G.mode === 'menu' && G.hero !== 'mando' && !G.coopJoin) openPrefight(launch);
  else launch();
}
document.getElementById('trainYes').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('asktrain'); setModeSel('training'); launchFromMenu(); });
document.getElementById('trainNo').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('asktrain'); launchFromMenu(); });
// co-op guest: start a run that follows the host's (net/foes.js): Survival (startEndless sees G.coopJoin) or the campaign's level
export function launchCoopRun(){
  G.coopJoin = true; G.missionForms = null; G.modeSel = coopRun.k === 'm' ? 'mission' : coopRun.k === 'c' ? 'campaign' : 'endless';
  if (coopRun.k === 'm') G.missionId = coopRun.mid;
  setOverlayState('menu');
  launch();
}
// take the pointer lock and start (or resume) play; where the lock never works, play unlocked
function launch(){
  audioInit();
  if (pad.active){ shared.lockFallback = true; beginPlay(); return; }   // a pad press can't take the pointer lock: play unlocked (engine/gamepad.js)
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
// PAUSE KEYS — Tab pauses and resumes in every browser (Esc exits fullscreen where it isn't locked). Enter resumes from the pause screen in every browser. Where Esc is locked to the game (fullscreen in
// Chrome / Edge, see fullscreen.js) a quick Esc pauses and resumes too, so closing the pause screen with Esc no longer
// drops you out of fullscreen. Runs in the capture phase so it sees the screen before Esc closes a panel on top of it.
const panelOpen = () => howto.classList.contains('open') || settings.classList.contains('open') || document.getElementById('saves').classList.contains('open') || overlay.classList.contains('newconfirming') ||
  document.getElementById('roadmap').classList.contains('open') || document.getElementById('forms').classList.contains('open') || document.getElementById('coop').classList.contains('open') || overlay.classList.contains('confirming') || overlay.classList.contains('asktrain');
window.addEventListener('keydown', (e) => {
  if (e.repeat || (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== 'Tab')) return;
  const tab = e.key === 'Tab', esc = e.key === 'Escape' || tab;   // Tab pauses exactly as a quick Esc does
  if (e.key === 'Escape' && !escapeIsOurs()) return;   // the browser owns Esc here (pointer lock / fullscreen exit)
  if (tab && (panelOpen() || document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) return;
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
  if (locked && G.cardUp){ document.exitPointerLock(); return; }   // a card or the lesson board is up: a lock that lands late (the click's request) is let go so the cursor stays free
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
function restartRun(toTraining){
  overlay.style.display = 'none';
  document.getElementById('restartBtn').style.display = 'none';
  document.getElementById('banner').style.opacity = '0';
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false; G.sbMenu = false;
  G.mode = 'play'; G.slowmo = 1; G.paused = false;
  document.body.classList.remove('in-menu'); setHowTo(false); setSettings(false);
  closeCard(true);
  if (toTraining) startTutorial(); else if (G.chapter >= 0) startCampaign(); else if (G.endless) startEndless(); else if (G.training) startTutorial(); else if (G.mission) startMission(G.missionId); else if (G.sandbox) startSandbox(); else startCampaign();   // a survival run restarts as survival, not the campaign
  if (!shared.lockFallback) requestLock();
}
document.getElementById('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); restartRun(); });
// the stance unlock screen's TRAIN button (game/meditation.js): the campaign run is kept for CONTINUE CAMPAIGN, and the
// training opens on the lesson for the form just learned; leaving training lands back on the menu with the run waiting
setTrainHook((formId) => {
  G.resumeRun = captureRun();
  trainOnForm(formId);
  setModeSel('training');
  restartRun(true);
});
// MAIN MENU — abandon the run and go back to the title screen. From pause it asks first (a run is easy to lose
// by accident); from the fallen/victory screens the run is already over, so it goes straight there.
export function goHome(){
  overlay.classList.remove('confirming');
  closeSandboxPanel(false);
  closeCard(true);
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false; G.sbMenu = false;
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  startLevel(0);   // sweep the battlefield and reset the hero + kit, exactly as a fresh campaign would
  G.mode = 'menu'; G.coopWasGuest = false; G.paused = false; G.slowmo = 1; G.slowmoT = 0; G.hitstop = 0;
  overlay.style.display = 'flex';
  refreshMenu();
  overlay.scrollTop = 0;
}
// the title screen's locks, ticks and headline, after anything that changes progress (a run ending, a loaded save, NEW GAME)
export function refreshMenu(){
  refreshSurvivalLock(); refreshSandboxLock(); refreshCampaignMark(); refreshTrainingMark(); refreshMissionMark();
  setOverlayState('menu');
}
// finishing the training grounds hands you back to the menu, with the campaign picked
setTrainingExit(() => {
  if (document.pointerLockElement) document.exitPointerLock();
  setModeSel('campaign');
  goHome();
});
document.getElementById('skipBtn').addEventListener('click', () => skipStep());
// LESSON BOARD: back into the fight's frame, then the board over it (game/tutorial.js)
document.getElementById('lessonsBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); document.getElementById('goText').click(); openLessonBoard(); });
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
