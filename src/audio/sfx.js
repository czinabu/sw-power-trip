// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Web Audio context, synthesized sound effects (sfx) and the sound bank S.

import { MUSIC } from './music.js';
import { clamp } from '../utils.js';
import { shared } from '../state.js';

/* ---------- tiny synth audio ---------- */

export function audioInit(){
  if (shared.AC) { shared.AC.resume(); MUSIC.init(); return; }
  try {
    shared.AC = new (window.AudioContext || window.webkitAudioContext)();
    shared.masterGain = shared.AC.createGain(); shared.masterGain.gain.value = shared.masterVol; shared.masterGain.connect(shared.AC.destination);
    const humOsc = shared.AC.createOscillator(); humOsc.type = 'sawtooth'; humOsc.frequency.value = 72;
    shared.humGain = shared.AC.createGain(); shared.humGain.gain.value = 0.0;
    const f = shared.AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    humOsc.connect(f); f.connect(shared.humGain); shared.humGain.connect(shared.masterGain);
    humOsc.start();
  } catch(e){ shared.AC = null; }
  MUSIC.init();   // start the adaptive score on the first audio-enabled gesture
}
export function setMasterVol(v){
  shared.masterVol = clamp(v, 0, 1);
  try { localStorage.setItem('sw_vol', shared.masterVol); } catch(e){}
  if (shared.masterGain) shared.masterGain.gain.value = shared.masterVol;
  const vv = document.getElementById('volval'); if (vv) vv.textContent = Math.round(shared.masterVol * 100) + '%';
  const vl = document.getElementById('volsl'); if (vl && +vl.value !== shared.masterVol) vl.value = shared.masterVol;
}
export function sfx(freq, dur, type, vol, slide){
  if (!shared.AC) return;
  try {
    const o = shared.AC.createOscillator(), g = shared.AC.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(slide,1), shared.AC.currentTime + dur);
    g.gain.value = vol || 0.08;
    g.gain.exponentialRampToValueAtTime(0.0001, shared.AC.currentTime + dur);
    o.connect(g); g.connect(shared.masterGain);
    o.start(); o.stop(shared.AC.currentTime + dur);
  } catch(e){}
}
export const S = {
  swing: () => sfx(900, 0.12, 'sawtooth', 0.05, 300),
  hit:   () => sfx(220, 0.1, 'square', 0.09, 60),
  kill:  () => sfx(160, 0.22, 'square', 0.1, 40),
  push:  () => sfx(80, 0.4, 'sine', 0.22, 30),
  slam:  () => sfx(60, 0.55, 'sine', 0.26, 20),
  dash:  () => sfx(500, 0.15, 'sine', 0.06, 1400),
  bolt:  () => sfx(1200, 0.08, 'square', 0.04, 500),
  deflect:()=> sfx(1500, 0.1, 'square', 0.07, 2400),
  hurt:  () => sfx(140, 0.25, 'sawtooth', 0.12, 50),
  boom:  () => sfx(50, 0.7, 'sine', 0.3, 18),
  zap:   () => sfx(2000, 0.2, 'sawtooth', 0.07, 200),
  stun:  () => sfx(300, 0.6, 'square', 0.12, 900),
  // a perfect parry — bright metallic clash that rings upward into a chime
  parry: () => { sfx(2600, 0.09, 'square', 0.1, 3400); sfx(1400, 0.22, 'triangle', 0.08, 2600); setTimeout(()=>sfx(2000, 0.18, 'sine', 0.06, 3000), 40); },
  // the riposte answer — a heavy decisive slash
  riposte:()=> { sfx(300, 0.18, 'sawtooth', 0.12, 80); sfx(1200, 0.12, 'square', 0.07, 400); },
  // weighty connect for Strong-stance / heavy blows
  heavy: () => { sfx(90, 0.3, 'sine', 0.22, 30); sfx(180, 0.12, 'square', 0.08, 60); },
};
