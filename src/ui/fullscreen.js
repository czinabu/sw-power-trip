// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FULLSCREEN: on by default, entered on the first click or key (browsers only allow it after one), toggled from the
// main menu, the pause screen and Settings. In Chrome and Edge the Esc key is also locked while fullscreen, so a quick
// Esc reaches the game (pause / resume) instead of dropping you out; holding Esc still leaves fullscreen.

const PREF = 'sw_fullscreen';   // '0' once the player turns fullscreen off; anything else means they want it
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
export const isFullscreen = () => !!fsEl();
export const fullscreenSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function wantFullscreen(){ try { return localStorage.getItem(PREF) !== '0'; } catch(e){ return true; } }
function setWant(on){ try { localStorage.setItem(PREF, on ? '1' : '0'); } catch(e){} }

function enter(){
  const root = document.documentElement;
  try {
    const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch(err){}
}
// call only from a click or key handler: the browser refuses fullscreen without one
export function enterFullscreenIfWanted(){ if (fullscreenSupported && wantFullscreen() && !fsEl()) enter(); }
export function toggleFullscreen(){
  if (fsEl()){
    setWant(false);
    try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch(err){}
  } else { setWant(true); enter(); }
}

// KEYBOARD LOCK (Chrome / Edge): while fullscreen, Esc is delivered to the page instead of exiting
let _escLocked = false;
export const escapeIsOurs = () => _escLocked && !!fsEl();
function syncFullscreen(){
  const on = !!fsEl();
  document.querySelectorAll('.fsval').forEach((el) => { el.textContent = on ? 'ON' : 'OFF'; });
  const kb = navigator.keyboard;
  if (!on){ _escLocked = false; if (kb && kb.unlock) kb.unlock(); return; }
  if (kb && kb.lock) kb.lock(['Escape']).then(() => { _escLocked = !!fsEl(); }, () => { _escLocked = false; });
}
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);

// the first click or key anywhere takes the game fullscreen (capture, so buttons that stop propagation still count;
// Esc doesn't count as a user gesture, so it's skipped)
function firstGesture(e){
  if (e.type === 'keydown' && e.key === 'Escape') return;
  window.removeEventListener('click', firstGesture, true);
  window.removeEventListener('keydown', firstGesture, true);
  if (e.target && e.target.closest && e.target.closest('.fsctl')) return;   // the toggle itself decides
  enterFullscreenIfWanted();
}
window.addEventListener('click', firstGesture, true);
window.addEventListener('keydown', firstGesture, true);

document.querySelectorAll('.fsctl').forEach((el) => {
  if (!fullscreenSupported) el.style.display = 'none';
  el.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
});
syncFullscreen();
