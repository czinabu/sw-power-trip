// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AUTOSAVE: at each chapter / level checkpoint, a won mission, a lesson or trial passed and a form learned, the game writes
// the AUTO save slot (game/saves.js) and blinks a small SAVING note. Same in every mode and in co-op (a guest keeps its progress, not the host's run).

import { writeSlot, AUTO } from './saves.js';

const note = document.getElementById('autosave');
let lastAt = -1e9, hideT = 0;

// reason names the trigger for whoever reads the call site; opts.finished drops the saved run (the campaign was won)
// (a beat late, so the level or chapter that is starting has finished setting itself up)
export function autosave(reason, opts = {}){ setTimeout(() => write(opts), 300); }
function write(opts){
  const now = performance.now();
  if (now - lastAt < 1500 && !opts.finished) return;   // a checkpoint and an unlock landing together save once
  lastAt = now;
  const ok = writeSlot(AUTO, { auto: true, finished: !!opts.finished });
  if (!note) return;
  note.textContent = ok ? 'AUTOSAVED' : 'SAVE FAILED';
  note.classList.toggle('bad', !ok);
  note.classList.add('on');
  clearTimeout(hideT);
  hideT = setTimeout(() => note.classList.remove('on'), 1800);
}
