// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AUDIO ENGINE: the mixer (buses, reverb room, muffle, ducking, limiter), shared noise buffers, 3D placement of a
// sound in the world, and play(): the one-call voice builder every synthesized sound goes through.
//
//   sources ─┬─ sfx bus ───┐
//            ├─ amb bus ───┼─ muffle (lowpass) ─ masterGain (VOLUME slider) ─ limiter ─ speakers
//            ├─ music bus ─┘        ▲
//            ├─ reverb send ─ room ─┘
//            └─ ui bus ──────────────────────── masterGain   (menus never get muffled by the pause filter)

import { shared, player } from '../state.js';
import { camera } from '../engine/renderer.js';
import { clamp } from '../utils.js';

const loadVol = (k, d) => { try { const v = parseFloat(localStorage.getItem(k)); return isNaN(v) ? d : clamp(v, 0, 1); } catch(e){ return d; } };

export const AE = {
  ready: false,
  bus: {},            // sfx | amb | music | ui
  vol: { sfx: loadVol('sw_sfxvol', 1), music: loadVol('sw_musvol', 0.8) },
  muffle: null, room: null, roomIn: null, duck: null, limiter: null,
  noise: {},          // white | pink | brown AudioBuffers (2 s, looped or sliced)
  live: 0,            // voices currently sounding (capped so a huge fight can't overload the mix)
};
const VOICE_CAP = 64;
const _last = new Map();

const ac = () => shared.AC;
const now = () => shared.AC.currentTime;

/* ---------- setup ---------- */

function makeNoise(kind){
  const sr = ac().sampleRate, n = sr * 2, buf = ac().createBuffer(1, n, sr), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++){
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink'){   // Paul Kellet's filter
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759; b2 = 0.96900*b2 + w*0.1538520;
      b3 = 0.86650*b3 + w*0.3104856; b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w*0.5362) * 0.11; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }   // brown
  }
  return buf;
}

/* a synthetic room: stereo exponentially-decaying noise, darkened over its tail */
function makeIR(secs, damp, pre){
  const sr = ac().sampleRate, n = Math.floor(sr * secs), ir = ac().createBuffer(2, n, sr);
  const preN = Math.floor(sr * (pre || 0.01));
  for (let c = 0; c < 2; c++){
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++){
      if (i < preN){ d[i] = 0; continue; }
      const t = (i - preN) / (n - preN), k = 1 - t * damp * 0.95;   // the tail loses its highs as it dies
      lp = lp * (1 - k) + (Math.random() * 2 - 1) * k;
      d[i] = lp * Math.pow(1 - t, 3.2);
    }
  }
  return ir;
}

/* ROOMS — the reverb each arena sits in. Stone halls ring long, the forge is tight and metallic, the open
   battlefield is a wide dark wash. */
export const ROOMS = {
  menu:    { secs: 2.4, damp: 0.7, wet: 0.32 },
  temple:  { secs: 2.8, damp: 0.55, wet: 0.36 },
  foundry: { secs: 1.6, damp: 0.35, wet: 0.3 },
  plains:  { secs: 3.4, damp: 0.8, wet: 0.3 },
};
let _room = '';
// each room's impulse response is ~300k random samples: make it once (the rest in idle time after audio starts), not on every arena switch
const IRS = {};
const irFor = kind => IRS[kind] || (IRS[kind] = makeIR(ROOMS[kind].secs, ROOMS[kind].damp, 0.012));
export function setRoom(kind){
  if (!AE.ready || kind === _room || !ROOMS[kind]) return;
  _room = kind;
  const R = ROOMS[kind];
  AE.room.buffer = irFor(kind);
  AE.roomOut.gain.setTargetAtTime(R.wet, now(), 0.3);
}

export function initEngine(){
  if (AE.ready || !ac()) return;
  const A = ac();
  AE.limiter = A.createDynamicsCompressor();
  AE.limiter.threshold.value = -5; AE.limiter.knee.value = 4; AE.limiter.ratio.value = 14;
  AE.limiter.attack.value = 0.002; AE.limiter.release.value = 0.18;
  shared.masterGain.disconnect();
  shared.masterGain.connect(AE.limiter); AE.limiter.connect(A.destination);

  AE.muffle = A.createBiquadFilter(); AE.muffle.type = 'lowpass'; AE.muffle.frequency.value = 20000; AE.muffle.Q.value = 0.5;
  AE.muffle.connect(shared.masterGain);

  const mk = (to, v) => { const g = A.createGain(); g.gain.value = v; g.connect(to); return g; };
  AE.duck = mk(AE.muffle, 1);                       // music + ambience dip under big hits
  AE.bus.sfx = mk(AE.muffle, AE.vol.sfx);
  AE.bus.music = mk(AE.duck, AE.vol.music);
  AE.bus.amb = mk(AE.duck, AE.vol.sfx * 0.9);
  AE.bus.ui = mk(shared.masterGain, AE.vol.sfx * 0.9);

  AE.room = A.createConvolver();
  AE.roomOut = mk(AE.muffle, 0.3);
  AE.room.connect(AE.roomOut);
  AE.roomIn = A.createGain(); AE.roomIn.connect(AE.room);

  for (const k of ['white', 'pink', 'brown']) AE.noise[k] = makeNoise(k);
  AE.ready = true;
  setRoom('menu');
  const rest = Object.keys(ROOMS).filter(k => k !== 'menu'), idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 3000 }) : f => setTimeout(f, 200);
  const warm = () => { const k = rest.shift(); if (k){ irFor(k); idle(warm); } };
  idle(warm);

  // a hidden tab shouldn't keep a fight's worth of loops droning in the background
  document.addEventListener('visibilitychange', () => {
    if (!shared.AC) return;
    if (document.hidden) shared.AC.suspend(); else shared.AC.resume();
  });
}

export function setBusVol(kind, v){
  v = clamp(v, 0, 1);
  AE.vol[kind] = v;
  try { localStorage.setItem(kind === 'music' ? 'sw_musvol' : 'sw_sfxvol', v); } catch(e){}
  if (!AE.ready) return;
  const t = now();
  if (kind === 'music') AE.bus.music.gain.setTargetAtTime(v, t, 0.05);
  else { AE.bus.sfx.gain.setTargetAtTime(v, t, 0.05); AE.bus.amb.gain.setTargetAtTime(v * 0.9, t, 0.05); AE.bus.ui.gain.setTargetAtTime(v * 0.9, t, 0.05); }
}

/* the music + ambience bed dips out of the way of a big moment (explosion, parry, boss slam) */
export function duck(depth, hold){
  if (!AE.ready) return;
  const g = AE.duck.gain, t = now();
  g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(1 - depth, t + 0.03);
  g.setTargetAtTime(1, t + 0.03 + (hold || 0.15), 0.35);
}

/* everything in the world muffles (pause menu, low health, a big hit to the player) */
export function setMuffle(hz, tc){ if (AE.ready) AE.muffle.frequency.setTargetAtTime(hz, now(), tc || 0.08); }

/* throttle: true if `key` played less than `gap` seconds ago — stops a 20-trooper volley stacking into a wall */
export function tooSoon(key, gap){
  if (!AE.ready) return true;
  const t = now(), l = _last.get(key);
  if (l !== undefined && t - l < gap) return true;
  _last.set(key, t); return false;
}

/* ---------- 3D placement ----------
   Distance is measured from the PLAYER (it's a third-person game: you hear what your hero hears), left/right from
   the CAMERA (so a trooper on the left of the screen is in the left ear). */
export function place(pos){
  if (!pos) return null;
  const pp = player.group.position;
  const dx = pos.x - pp.x, dz = pos.z - pp.z, dy = (pos.y || 0) - pp.y;
  const d = Math.sqrt(dx*dx + dz*dz + dy*dy*0.3);
  const e = camera.matrixWorld.elements;   // column 0 = camera right
  const cx = pos.x - camera.position.x, cz = pos.z - camera.position.z, cl = Math.hypot(cx, cz) || 1;
  const pan = clamp((cx * e[0] + cz * e[2]) / cl, -1, 1) * clamp(d / 3, 0, 1) * 0.8;
  return { pan, gain: 1 / (1 + Math.max(0, d - 5) / 11), lp: 20000 - clamp(d / 55, 0, 1) * 15500, d };
}

/* ---------- the voice builder ----------
   play({ ...spec }) builds one short-lived voice and schedules it. Fields (all optional):
     src   'osc' (default) | 'noise'          type   oscillator wave            color  'white' | 'pink' | 'brown'
     f, f2 start / end pitch (Hz)             fc     pitch curve: 'exp' | 'lin'  det    detune (cents)
     g     peak gain    a attack (s)    d decay (s, from the attack end)    hold  time held at peak before decay
     filt  { type, f, f2, q }   a filter with an optional sweep over the voice
     fm    { r, i, i2 }         an FM modulator at f*r, index i → i2 (metallic/bell tones)
     vib   { r, d }             vibrato rate (Hz) and depth (cents)
     drive  waveshaper amount (0..1) — grit for explosions, buzz for the darksaber
     verb   reverb send (0..1)  pos  world position (pan + distance)  pan  fixed pan  at  start delay (s)
     bus    'sfx' (default) | 'ui' | 'amb' | 'music'   jit  random pitch spread (fraction, default 0.03)
     pri    priority: a voice with pri 0 is dropped first when the voice cap is hit                       */
const _curves = {};
function driveCurve(k){
  const key = Math.round(k * 20);
  if (_curves[key]) return _curves[key];
  const n = 1024, c = new Float32Array(n), a = 1 + key * 1.6;
  for (let i = 0; i < n; i++){ const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(a * x) / Math.tanh(a); }
  return (_curves[key] = c);
}
const pos0 = v => Math.max(0.0001, v);

export function play(s){
  if (!AE.ready || ac().state !== 'running') return;
  const pri = s.pri ?? 1;
  if (AE.live >= VOICE_CAP && pri < 2) return;
  if (AE.live >= VOICE_CAP * 0.75 && pri < 1) return;
  const P = s.pos ? place(s.pos) : null;
  if (P && P.d > 70) return;
  const A = ac(), t = now() + (s.at || 0) + 0.004;
  const jit = 1 + (Math.random() * 2 - 1) * (s.jit ?? 0.03);
  const a = s.a ?? 0.004, hold = s.hold || 0, d = s.d ?? 0.15, dur = a + hold + d;
  const peak = (s.g ?? 0.1) * (P ? P.gain : 1);
  if (peak < 0.002) return;

  let src;
  if (s.src === 'noise'){
    src = A.createBufferSource(); src.buffer = AE.noise[s.color || 'white']; src.loop = true;
    src.playbackRate.value = (s.rate || 1) * jit;
  } else {
    src = A.createOscillator(); src.type = s.type || 'sine';
    const f = s.f * jit; src.frequency.setValueAtTime(f, t);
    if (s.f2){
      if (s.fc === 'lin') src.frequency.linearRampToValueAtTime(s.f2 * jit, t + (s.ft || dur));
      else src.frequency.exponentialRampToValueAtTime(pos0(s.f2 * jit), t + (s.ft || dur));
    }
    if (s.det) src.detune.value = s.det;
    if (s.fm){
      const m = A.createOscillator(), mg = A.createGain();
      m.frequency.value = f * s.fm.r; m.type = s.fm.type || 'sine';
      mg.gain.setValueAtTime(f * s.fm.i, t);
      mg.gain.exponentialRampToValueAtTime(pos0(f * (s.fm.i2 ?? 0.01)), t + dur);
      m.connect(mg); mg.connect(src.frequency); m.start(t); m.stop(t + dur + 0.05);
    }
    if (s.vib){
      const v = A.createOscillator(), vg = A.createGain();
      v.frequency.value = s.vib.r; vg.gain.value = s.vib.d;
      v.connect(vg); vg.connect(src.detune); v.start(t); v.stop(t + dur + 0.05);
    }
  }
  let node = src;
  if (s.drive){ const w = A.createWaveShaper(); w.curve = driveCurve(s.drive); w.oversample = '2x'; node.connect(w); node = w; }
  if (s.filt){
    const F = A.createBiquadFilter(); F.type = s.filt.type || 'lowpass';
    F.frequency.setValueAtTime(s.filt.f, t);
    if (s.filt.f2) F.frequency.exponentialRampToValueAtTime(pos0(s.filt.f2), t + (s.filt.t || dur));
    if (s.filt.q) F.Q.value = s.filt.q;
    node.connect(F); node = F;
  }
  if (P && P.lp < 19000){ const F = A.createBiquadFilter(); F.type = 'lowpass'; F.frequency.value = P.lp; node.connect(F); node = F; }
  const g = A.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pos0(peak), t + a);
  if (hold) g.gain.setValueAtTime(pos0(peak), t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g);
  let out = g;
  const pan = P ? P.pan : s.pan;
  if (pan){ const p = A.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); out = p; }
  out.connect(AE.bus[s.bus || 'sfx']);
  if (s.verb){ const r = A.createGain(); r.gain.value = s.verb; out.connect(r); r.connect(AE.roomIn); }
  if (s.src === 'noise') src.start(t, Math.random() * 1.5); else src.start(t);
  src.stop(t + dur + 0.03);
  AE.live++; src.onended = () => { AE.live--; try { out.disconnect(); } catch(e){} };
}

/* ---------- continuous loops (saber hum, jetpack, flamethrower, ambience beds) ----------
   loop() builds a held voice and returns a handle whose level/pitch/filter are steered every frame. */
export function loop(spec){
  if (!AE.ready) return null;
  const A = ac(), t = now();
  const parts = [];
  const filt = A.createBiquadFilter(); filt.type = spec.filt?.type || 'lowpass'; filt.frequency.value = spec.filt?.f || 1000; filt.Q.value = spec.filt?.q || 0.7;
  const g = A.createGain(); g.gain.value = 0.0001;
  const pan = A.createStereoPanner();
  let head = filt;
  if (spec.drive){ const w = A.createWaveShaper(); w.curve = driveCurve(spec.drive); filt.connect(w); head = w; }
  head.connect(g); g.connect(pan); pan.connect(AE.bus[spec.bus || 'sfx']);
  if (spec.verb){ const r = A.createGain(); r.gain.value = spec.verb; pan.connect(r); r.connect(AE.roomIn); }
  const oscs = [];
  for (const L of spec.layers){
    let s;
    if (L.noise){ s = A.createBufferSource(); s.buffer = AE.noise[L.noise]; s.loop = true; s.playbackRate.value = L.rate || 1; }
    else { s = A.createOscillator(); s.type = L.type || 'sawtooth'; s.frequency.value = L.f; if (L.det) s.detune.value = L.det; oscs.push({ o: s, mul: L.f / spec.base }); }
    const lg = A.createGain(); lg.gain.value = L.g ?? 1;
    s.connect(lg); lg.connect(filt); s.start(t); parts.push(s);
  }
  // slow wobble on the filter — keeps a held tone alive instead of a static buzz
  if (spec.lfo){ const o = A.createOscillator(), og = A.createGain(); o.frequency.value = spec.lfo.r; og.gain.value = spec.lfo.d; o.connect(og); og.connect(filt.frequency); o.start(t); parts.push(o); }
  return {
    g, filt, pan, base: spec.base,
    _l: -1, _h: -1, _p: -1,
    set(level, hz, pitch, tc){
      // only touch the automation when something actually moved (this runs every frame)
      const near = (a, b) => Math.abs(a - b) <= Math.max(0.0005, Math.abs(b) * 0.01);
      if (near(level, this._l) && (!hz || near(hz, this._h)) && (!pitch || near(pitch, this._p))) return;
      this._l = level; if (hz) this._h = hz; if (pitch) this._p = pitch;
      const tt = now(), k = tc || 0.06;
      g.gain.setTargetAtTime(Math.max(0.0001, level), tt, k);
      if (hz) filt.frequency.setTargetAtTime(hz, tt, k);
      if (pitch) for (const O of oscs) O.o.frequency.setTargetAtTime(pitch * O.mul, tt, k);
    },
    stop(){ const tt = now(); g.gain.setTargetAtTime(0.0001, tt, 0.15); for (const p of parts) p.stop(tt + 1); },
  };
}
