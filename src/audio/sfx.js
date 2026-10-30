// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Sound effects: audio start-up, the volume controls, the legacy one-line sfx() tone, and the sound bank S.
//
// Every sound is synthesized (no audio files). S holds the designed, layered sounds: each is a few voices built by
// play() in engine.js (tone + noise + filter sweeps), with small random variation so repeats never sound identical.
// Most take an optional world position `pos`, which pans the sound and quiets it with distance.

import { MUSIC } from './music.js';
import { AE, initEngine, play, tooSoon, duck, setBusVol } from './engine.js';
import { clamp, rand } from '../utils.js';
import { shared, G, player } from '../state.js';

/* ---------- start-up + volume ---------- */

export function audioInit(){
  if (shared.AC){ if (shared.AC.state !== 'running') shared.AC.resume(); MUSIC.init(); return; }
  try {
    shared.AC = new (window.AudioContext || window.webkitAudioContext)();
    shared.masterGain = shared.AC.createGain(); shared.masterGain.gain.value = shared.masterVol; shared.masterGain.connect(shared.AC.destination);
    initEngine();
  } catch(e){ shared.AC = null; }
  MUSIC.init();   // start the adaptive score on the first audio-enabled gesture
}
export function setMasterVol(v){
  shared.masterVol = clamp(v, 0, 1);
  try { localStorage.setItem('sw_vol', shared.masterVol); } catch(e){}
  if (shared.masterGain) shared.masterGain.gain.value = shared.masterVol;
  syncSlider('vol', shared.masterVol);
}
export function setMusicVol(v){ setBusVol('music', v); syncSlider('mus', AE.vol.music); }
export function setSfxVol(v){ setBusVol('sfx', v); syncSlider('fx', AE.vol.sfx); }
function syncSlider(id, v){
  const val = document.getElementById(id + 'val'); if (val) val.textContent = Math.round(v * 100) + '%';
  const sl = document.getElementById(id + 'sl'); if (sl && +sl.value !== v) sl.value = v;
}

/* ---------- the legacy tone ----------
   sfx(freq, dur, type, vol, slide): one oscillator gliding from freq to slide. Still used for small cues (UI
   chirps, fuse beeps, heat warnings). It now routes through the mixer with a soft attack, a touch of room, light
   pitch variation, and a throttle so identical calls in the same frame don't stack into a click. */
export function sfx(freq, dur, type, vol, slide){
  type = type || 'square';
  if (tooSoon('L' + type + (freq | 0), 0.014)) return;
  play({ type, f: freq, f2: slide || 0, g: (vol || 0.08) * 0.9, a: 0.003, d: dur, verb: 0.07, pri: 0,
         filt: (type === 'square' || type === 'sawtooth') ? { type: 'lowpass', f: 6500 } : undefined });
}

/* ---------- building blocks ---------- */
const N = o => play(Object.assign({ src: 'noise' }, o));
const T = o => play(o);
const ui = o => play(Object.assign({ bus: 'ui', jit: 0.01 }, o));

/* the PLAYER's blaster bolt: a bright tone diving fast with an FM "spring" wobble — the films' pew — plus a crisp
   snap at the muzzle and a little low body so it has weight */
function blaster(dual){
  const f = dual ? 2300 : 1750;
  T({ type: 'sawtooth', f, f2: dual ? 430 : 250, ft: dual ? 0.1 : 0.15, g: dual ? 0.065 : 0.085, d: dual ? 0.11 : 0.17,
      fm: { r: 0.5, i: 1.1, i2: 0.05 }, filt: { type: 'lowpass', f: 6500, f2: 1400 }, verb: 0.08, pri: 2 });
  T({ type: 'sine', f: f * 0.5, f2: 140, g: 0.07, d: 0.12 });
  N({ g: 0.045, a: 0.001, d: 0.03, filt: { type: 'highpass', f: 3800 } });
  if (!dual) T({ type: 'triangle', f: 150, f2: 55, g: 0.09, d: 0.09 });
}

/* a lightsaber whoosh: the hum's pitch bending up through the arc ("vwoom") plus moving air.
   p scales the pitch: Shii-Cho/fast blades are lighter and higher, Djem So heavier, the Darksaber deep and gritty */
function swing(p, len, dark){
  const d = 0.2 * len;
  T({ type: 'sawtooth', f: 96 * p, f2: 168 * p, ft: d * 0.55, g: 0.075, a: 0.03, d, det: 8,
      filt: { type: 'lowpass', f: 600, f2: 2600, t: d * 0.5 }, drive: dark ? 0.45 : 0, verb: 0.1 });
  T({ type: 'sawtooth', f: 97.5 * p, f2: 160 * p, ft: d * 0.55, g: 0.05, a: 0.03, d, filt: { type: 'lowpass', f: 900, f2: 2000 } });
  N({ color: 'pink', g: 0.09, a: 0.05 * len, d: 0.16 * len, filt: { type: 'bandpass', f: 450, f2: 1900, q: 1.3 } });
}

/* the saber meeting flesh/armour: a scorching sizzle over a dull thump */
function saberBurn(pos, pw){
  N({ pos, g: 0.08 * pw, a: 0.002, d: 0.14 + pw * 0.05, filt: { type: 'highpass', f: 2600 }, drive: 0.55, pri: 2 });
  N({ pos, g: 0.05, d: 0.26, rate: 0.55, filt: { type: 'bandpass', f: 5200, q: 3 } });
  T({ pos, type: 'sine', f: 150, f2: 45, g: 0.16 * pw, d: 0.12 });
  T({ pos, type: 'sawtooth', f: 220, f2: 80, g: 0.06, d: 0.1, filt: { type: 'lowpass', f: 1600 } });
}

/* blade on blade / blade on beskar: inharmonic FM ring (that's what makes metal), a hard crack, a fizzing crackle */
function clash(pos, big){
  const k = big ? 1.4 : 1;
  T({ pos, type: 'sine', f: 1250, fm: { r: 1.414, i: 4, i2: 0.1 }, g: 0.09 * k, d: 0.3 * k, verb: 0.25, pri: 2 });
  T({ pos, type: 'sine', f: 2620, fm: { r: 2.76, i: 2, i2: 0.05 }, g: 0.045 * k, d: 0.22 * k, verb: 0.2 });
  N({ pos, g: 0.13 * k, a: 0.001, d: 0.06, filt: { type: 'bandpass', f: 3400, q: 0.8 }, drive: 0.6 });
  N({ pos, g: 0.045 * k, d: 0.25 * k, rate: 0.5, filt: { type: 'highpass', f: 4200 }, drive: 0.8 });
  if (big){ T({ pos, type: 'sine', f: 95, f2: 40, g: 0.2, d: 0.22 }); }
}

/* an explosion: a dark roar of brown noise closing down, a sub drop, a crack at the front and debris crackle */
function boom(pos, size){
  size = size || 1;
  const s = Math.sqrt(size);
  N({ pos, color: 'brown', g: 0.42 * s, a: 0.003, d: 0.85 * s, filt: { type: 'lowpass', f: 2800, f2: 90 }, drive: 0.5, verb: 0.35, pri: 2 });
  N({ pos, g: 0.16 * s, d: 0.22, filt: { type: 'bandpass', f: 1300, f2: 300, q: 0.9 } });
  T({ pos, type: 'sine', f: 74, f2: 26, g: 0.38 * s, d: 0.6 * s, pri: 2 });
  for (let i = 0; i < 5; i++) N({ pos, at: rand(0.08, 0.6) * s, g: 0.035, d: 0.03, filt: { type: 'highpass', f: 2800 } });
  duck(0.4 * Math.min(1, size), 0.18);
}

// each lightsaber form's swing voice: quick and light, even, or heavy
const SWING_VOICE = { shiicho: 'strong', makashi: 'fast', soresu: 'medium', ataru: 'fast', niman: 'medium', djemso: 'strong', shien: 'strong' };

const pw01 = v => clamp(v ?? 1, 0.4, 1.8);

/* ---------- the sound bank ---------- */
export const S = {
  // ── lightsaber ──
  // kind: 'fast' | 'medium' | 'strong' | 'dark', or a lightsaber form id (voiced by its weight: SWING_VOICE)
  swing: (kind) => {
    if (tooSoon('swing', 0.05)) return;
    kind = SWING_VOICE[kind] || kind;
    if (kind === 'fast') swing(1.15, 0.85);
    else if (kind === 'strong') swing(0.82, 1.35);
    else if (kind === 'dark') swing(0.68, 1.2, true);
    else swing(1, 1);
  },
  saberHit: (pos, power) => { if (!tooSoon('shit', 0.015)) saberBurn(pos, pw01(power)); },
  // ── blasters ──
  blaster: () => blaster(false),
  blasterDual: () => blaster(true),
  bolt: () => blaster(true),   // light gadget shots
  disruptor: () => {
    T({ type: 'sawtooth', f: 1400, f2: 70, ft: 0.45, g: 0.11, d: 0.5, drive: 0.6, fm: { r: 0.25, i: 2, i2: 0.1 }, filt: { type: 'lowpass', f: 7000, f2: 400 }, verb: 0.3, pri: 2 });
    N({ g: 0.11, d: 0.6, filt: { type: 'bandpass', f: 4000, f2: 600, q: 1.5 }, verb: 0.2 });
    T({ type: 'sine', f: 90, f2: 30, g: 0.22, d: 0.4 });
    duck(0.25, 0.08);
  },
  // an enemy's shot: lower and harsher than yours, placed in the world, thinned out when a whole squad fires at once
  enemyShot: (pos, heavy) => {
    if (tooSoon('eshot', 0.035)) return;
    T({ pos, type: 'square', f: heavy ? 1000 : 1350, f2: heavy ? 140 : 200, ft: 0.16, g: heavy ? 0.075 : 0.055, d: 0.18,
        fm: { r: 0.47, i: 0.9, i2: 0.05 }, filt: { type: 'lowpass', f: 4200, f2: 900 }, verb: 0.12, pri: 1 });
    T({ pos, type: 'sine', f: 600, f2: 120, g: 0.05, d: 0.1 });
  },
  // a bolt tearing past your head without hitting
  whiz: (pos) => {
    if (tooSoon('whiz', 0.07)) return;
    T({ pos, type: 'sawtooth', f: 1100, f2: 480, g: 0.045, a: 0.02, d: 0.14, filt: { type: 'bandpass', f: 1800, q: 2 } });
    N({ pos, g: 0.04, a: 0.03, d: 0.12, filt: { type: 'bandpass', f: 2600, f2: 900, q: 1.5 } });
  },
  boltImpact: (pos) => {
    if (tooSoon('bimp', 0.025)) return;
    N({ pos, g: 0.06, d: 0.07, filt: { type: 'highpass', f: 1800 }, drive: 0.4 });
    T({ pos, type: 'sine', f: 720, f2: 150, g: 0.04, d: 0.07 });
  },
  blastHit: (pos, power) => {
    if (tooSoon('bhit', 0.02)) return;
    const p = pw01(power);
    N({ pos, g: 0.07 * p, d: 0.07, filt: { type: 'bandpass', f: 2100, q: 0.9 }, drive: 0.4, pri: 2 });
    T({ pos, type: 'sine', f: 900, f2: 200, g: 0.045, d: 0.08 });
    T({ pos, type: 'triangle', f: 180, f2: 60, g: 0.08 * p, d: 0.08 });
  },
  punch: (pos, power) => {
    if (tooSoon('punch', 0.02)) return;
    const p = pw01(power);
    N({ pos, color: 'brown', g: 0.16 * p, d: 0.09, filt: { type: 'lowpass', f: 900 } });
    T({ pos, type: 'sine', f: 130, f2: 50, g: 0.15 * p, d: 0.1 });
  },
  // a connect voiced by what landed it: a saber burns, a Mando bolt pops, a fist / kick / spear thumps
  impact: (pos, power) => {
    if (player.atkT > 0 || player.darkT > 0 || shared.saberProj) S.saberHit(pos, power);
    else if (G.hero === 'mando' && !(player.meleeT > 0)) S.blastHit(pos, power);
    else S.punch(pos, power);
  },
  hit: (pos) => S.impact(pos, 0.8),
  // a foe's weapon cutting the air
  whoosh: (pos, heavy) => {
    if (tooSoon('ewhoosh', 0.04)) return;
    N({ pos, color: 'pink', g: heavy ? 0.1 : 0.07, a: 0.03, d: heavy ? 0.22 : 0.14, filt: { type: 'bandpass', f: heavy ? 300 : 600, f2: heavy ? 1100 : 2000, q: 1.3 } });
  },
  // a foe goes down: their armour clatters and the body hits the floor a beat later
  kill: (pos, heavy) => {
    if (tooSoon('kill', 0.03)) return;
    for (let i = 0; i < 3; i++) N({ pos, at: rand(0.05, 0.28), g: 0.045, d: 0.05, filt: { type: 'bandpass', f: rand(2200, 4200), q: 9 } });
    if (heavy) T({ pos, at: 0.06, type: 'sine', f: 420, fm: { r: 1.53, i: 3, i2: 0.1 }, g: 0.07, d: 0.4, verb: 0.2 });
    T({ pos, at: 0.32, type: 'sine', f: heavy ? 90 : 120, f2: 40, g: heavy ? 0.16 : 0.1, d: 0.14 });
    N({ pos, at: 0.32, color: 'brown', g: heavy ? 0.16 : 0.09, d: 0.12, filt: { type: 'lowpass', f: 500 } });
  },
  // ── defence ──
  deflect: (pos) => {
    if (tooSoon('defl', 0.03)) return;
    T({ pos, type: 'sawtooth', f: 2600, f2: 900, ft: 0.1, g: 0.055, d: 0.12, filt: { type: 'bandpass', f: 2500, q: 2 }, pri: 2 });
    T({ pos, type: 'sine', f: 1900, fm: { r: 1.5, i: 1.5, i2: 0.05 }, g: 0.06, d: 0.24, verb: 0.22 });
    N({ pos, g: 0.06, d: 0.05, filt: { type: 'highpass', f: 4000 }, drive: 0.5 });
  },
  block: (pos) => clash(pos, false),
  clash: (pos, big) => clash(pos, big),
  // a PERFECT parry: a big clash that rings up into a bright chime, and the world ducks out of its way
  parry: (pos) => {
    clash(pos, true);
    T({ type: 'sine', f: 1568, g: 0.05, a: 0.005, d: 0.8, verb: 0.55, jit: 0.005 });
    T({ type: 'sine', f: 2349, at: 0.04, g: 0.035, a: 0.005, d: 0.7, verb: 0.55, jit: 0.005 });
    duck(0.35, 0.1);
  },
  // the riposte answer — a heavy decisive slash
  riposte: () => {
    swing(0.85, 1.3);
    T({ type: 'sawtooth', f: 300, f2: 70, g: 0.1, d: 0.2, filt: { type: 'lowpass', f: 1500 }, drive: 0.4 });
    T({ type: 'sine', f: 110, f2: 38, g: 0.22, d: 0.25 });
    duck(0.25, 0.08);
  },
  // weighty connect for Strong-stance / heavy blows
  heavy: (pos) => {
    T({ pos, type: 'sine', f: 95, f2: 30, g: 0.22, d: 0.3 });
    N({ pos, color: 'brown', g: 0.15, d: 0.16, filt: { type: 'lowpass', f: 700 }, drive: 0.3 });
  },
  shieldHit: (pos) => {
    T({ pos, type: 'square', f: 300, f2: 170, g: 0.055, d: 0.12, filt: { type: 'lowpass', f: 1300 } });
    T({ pos, type: 'sine', f: 1250, fm: { r: 0.5, i: 1, i2: 0.05 }, g: 0.05, d: 0.14, verb: 0.15 });
  },
  // ── the Force ──
  push: () => {
    N({ color: 'pink', g: 0.24, a: 0.03, d: 0.45, filt: { type: 'bandpass', f: 240, f2: 1500, q: 0.9, t: 0.14 }, verb: 0.3, pri: 2 });
    T({ type: 'sine', f: 110, f2: 36, g: 0.22, a: 0.01, d: 0.4 });
    T({ type: 'sine', f: 330, f2: 90, g: 0.05, a: 0.02, d: 0.35, vib: { r: 9, d: 40 } });
  },
  // a pull: the push run backwards — air drawn in, a low suck
  pull: () => {
    N({ color: 'pink', g: 0.2, a: 0.25, d: 0.12, filt: { type: 'bandpass', f: 1600, f2: 260, q: 0.9 }, verb: 0.3, pri: 2 });
    T({ type: 'sine', f: 45, f2: 120, g: 0.18, a: 0.2, d: 0.15 });
  },
  // the barrier snapping up: a bright shimmering chord over a hum
  barrier: () => {
    for (const [f, at] of [[523, 0], [784, 0.03], [1046, 0.06]]) T({ type: 'sine', f, at, fm: { r: 3.01, i: 0.4, i2: 0.02 }, g: 0.04, a: 0.02, d: 0.6, verb: 0.45 });
    T({ type: 'sawtooth', f: 110, g: 0.05, a: 0.05, d: 0.5, filt: { type: 'lowpass', f: 600 }, vib: { r: 7, d: 25 } });
  },
  // one crack of chained lightning landing (Force Judgement's ticks)
  arc: (pos) => {
    if (tooSoon('arc', 0.07)) return;
    for (let i = 0; i < 3; i++) N({ pos, at: i * 0.02, g: 0.06, d: 0.035, filt: { type: 'highpass', f: rand(2000, 3800) }, drive: 0.8 });
    T({ pos, type: 'sawtooth', f: 70, g: 0.035, d: 0.1, vib: { r: 31, d: 600 }, drive: 0.5 });
  },
  slam: (pos) => {
    T({ pos, type: 'sine', f: 72, f2: 22, g: 0.36, d: 0.7, pri: 2 });
    N({ pos, color: 'brown', g: 0.38, d: 0.7, filt: { type: 'lowpass', f: 1300, f2: 80 }, drive: 0.4, verb: 0.4 });
    N({ pos, g: 0.1, at: 0.02, d: 0.35, filt: { type: 'bandpass', f: 700, q: 1 } });   // stone grit
    duck(0.4, 0.15);
  },
  // Force lightning / electric zaps: a run of crackling snaps over a buzzing drone
  zap: (pos) => {
    for (let i = 0; i < 7; i++) N({ pos, at: i * 0.028 + rand(0, 0.015), g: 0.07, d: 0.04, filt: { type: 'highpass', f: rand(1800, 3500) }, drive: 0.8 });
    T({ pos, type: 'sawtooth', f: 62, g: 0.06, d: 0.26, vib: { r: 31, d: 700 }, drive: 0.6, filt: { type: 'lowpass', f: 2400 } });
  },
  // ── movement ──
  dash: () => { if (tooSoon('dash', 0.06)) return; N({ color: 'pink', g: 0.1, a: 0.02, d: 0.17, filt: { type: 'bandpass', f: 700, f2: 2300, q: 1.4 } }); },
  jump: () => { if (tooSoon('dash', 0.06)) return; N({ color: 'pink', g: 0.06, a: 0.015, d: 0.12, filt: { type: 'bandpass', f: 500, f2: 1400, q: 1.2 } }); },
  land: (power) => {
    const p = clamp(power, 0, 1);
    N({ color: 'brown', g: 0.08 + p * 0.16, d: 0.1 + p * 0.08, filt: { type: 'lowpass', f: 380 + p * 300 } });
    T({ type: 'sine', f: 95, f2: 40, g: 0.07 + p * 0.15, d: 0.1 + p * 0.1 });
  },
  // ── taking damage ──
  hurt: () => {
    N({ color: 'brown', g: 0.24, d: 0.12, filt: { type: 'lowpass', f: 1600 }, pri: 2 });
    T({ type: 'sine', f: 160, f2: 55, g: 0.2, d: 0.18 });
    T({ type: 'sawtooth', f: 92, g: 0.05, d: 0.15, filt: { type: 'lowpass', f: 600 } });
    AE.hurtAt = shared.AC ? shared.AC.currentTime : 0;   // the director muffles the world for a beat
  },
  // dazed / stunned: a woozy ringing
  stun: (pos) => {
    T({ pos, type: 'sine', f: 620, g: 0.06, a: 0.02, d: 0.7, vib: { r: 16, d: 110 }, verb: 0.3 });
    T({ pos, type: 'triangle', f: 930, fm: { r: 1.5, i: 0.6, i2: 0.05 }, g: 0.04, a: 0.02, d: 0.6, vib: { r: 11, d: 80 }, verb: 0.3 });
    T({ pos, type: 'sine', f: 120, f2: 50, g: 0.14, d: 0.25 });
  },
  boom: (pos, size) => boom(pos, size),
  // ── enemies ──
  // a melee foe commits to a swing — a rising metallic shing (a growl for brutes) so you can ready a parry
  windup: (pos, heavy) => {
    if (tooSoon('wind', 0.05)) return;
    if (heavy){
      T({ pos, type: 'sawtooth', f: 70, f2: 110, g: 0.1, a: 0.04, d: 0.3, drive: 0.5, filt: { type: 'lowpass', f: 900 } });
      N({ pos, color: 'brown', g: 0.08, a: 0.06, d: 0.25, filt: { type: 'lowpass', f: 600 } });
    } else T({ pos, type: 'sawtooth', f: 300, f2: 1150, g: 0.045, a: 0.02, d: 0.16, filt: { type: 'bandpass', f: 1600, q: 2 } });
  },
  // a Sith's roar: detuned saws through two vowel formants, with breath over the top
  roar: (pos) => {
    if (tooSoon('roar', 0.4)) return;
    for (const [f, fq] of [[66, 720], [99, 1180]])
      T({ pos, type: 'sawtooth', f, f2: f * 0.85, g: 0.11, a: 0.08, d: 0.8, vib: { r: 6, d: 30 }, drive: 0.4, filt: { type: 'bandpass', f: fq, q: 3 }, verb: 0.35, pri: 2 });
    N({ pos, color: 'pink', g: 0.07, a: 0.1, d: 0.7, filt: { type: 'bandpass', f: 900, q: 2 } });
    duck(0.25, 0.3);
  },
  // ── Mando gadgets ──
  rocket: (pos) => {
    N({ pos, g: 0.14, a: 0.01, d: 0.5, filt: { type: 'bandpass', f: 3200, f2: 700, q: 0.8 } });
    T({ pos, type: 'sawtooth', f: 220, f2: 90, g: 0.06, d: 0.4, drive: 0.3, filt: { type: 'lowpass', f: 1800 } });
    T({ pos, type: 'sine', f: 75, f2: 40, g: 0.12, d: 0.2 });
  },
  jetIgnite: () => {
    N({ color: 'pink', g: 0.18, a: 0.01, d: 0.28, filt: { type: 'bandpass', f: 380, f2: 2500, q: 0.9 } });
    T({ type: 'sine', f: 130, f2: 60, g: 0.12, d: 0.18 });
  },
  // ── UI (never muffled by the pause filter) ──
  uiHover: () => { if (tooSoon('uih', 0.03)) return; ui({ type: 'sine', f: 2400, g: 0.018, a: 0.001, d: 0.035 }); ui({ src: 'noise', g: 0.008, d: 0.015, filt: { type: 'highpass', f: 6000 } }); },
  uiClick: () => { ui({ type: 'triangle', f: 880, f2: 1320, ft: 0.04, g: 0.05, d: 0.08 }); ui({ type: 'sine', f: 1760, at: 0.045, g: 0.025, d: 0.12 }); },
  uiDeny: () => { ui({ type: 'square', f: 180, f2: 120, g: 0.035, d: 0.1, filt: { type: 'lowpass', f: 900 } }); ui({ type: 'square', f: 150, f2: 100, at: 0.08, g: 0.035, d: 0.12, filt: { type: 'lowpass', f: 900 } }); },
  // launching a run: an air swell into an open fifth
  uiStart: () => {
    ui({ src: 'noise', color: 'pink', g: 0.08, a: 0.18, d: 0.25, filt: { type: 'bandpass', f: 300, f2: 3000, q: 1, t: 0.2 } });
    for (const [f, at] of [[220, 0.12], [330, 0.15], [440, 0.18]]) ui({ type: 'triangle', f, at, g: 0.05, a: 0.01, d: 0.7, verb: 0.4 });
  },
  // a reward: an up-arpeggio. tier 0 small (xp), 1 upgrade, 2 legendary / final tier
  reward: (tier) => {
    tier = tier || 0;
    const notes = tier >= 2 ? [0, 4, 7, 12, 16, 19] : tier ? [0, 4, 7, 12] : [0, 7, 12];
    const base = 523.25;
    notes.forEach((n, i) => ui({ type: i % 2 ? 'sine' : 'triangle', f: base * Math.pow(2, n / 12), at: i * 0.055, g: 0.05, d: 0.35 + tier * 0.1, verb: 0.45 }));
    if (tier) ui({ type: 'sine', f: 130.8, g: 0.07, a: 0.04, d: 0.5 });
    if (tier >= 2) ui({ src: 'noise', g: 0.025, a: 0.2, d: 0.6, filt: { type: 'highpass', f: 7000 } });
  },
};
