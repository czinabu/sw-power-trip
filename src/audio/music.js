// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MUSIC: the adaptive synthesized score.

import { shared, G, enemies } from '../state.js';
import { AE } from './engine.js';

/* ---------- procedural MUSIC engine ----------
   A fully synthesized adaptive score (no audio files). Each world has its own PALETTE: key, tempo, chord loop,
   melody, instruments and drum kit. Layers fade in with an INTENSITY the game state drives:

     menu / lull   pad + sub drone, the quiet melody
     combat        + bass line, ostinato, drums
     heavy combat  + snare, hats, fills
     boss          + brass stabs, the melody played big, percussion at full tilt

   One-shot STINGS mark a boss rising, a wave starting, an area cleared, an unlock, victory and death.
   Tuned to sit UNDER the SFX; the whole score rides the MUSIC volume slider and toggles with M (persisted). */

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const GRIT = (() => { const c = new Float32Array(256); for (let i = 0; i < 256; i++) c[i] = Math.tanh(3 * (i / 127.5 - 1)); return c; })();
const R = -1;   // a rest in a pattern

/* PALETTES. Pitches are semitones above `root` (a MIDI note). Each loop is 4 bars of 16 steps.
     prog   per bar: bass note + chord voicing          lead   [step, semitone, length in steps]
     bass   per step: 0 rest, 1 root, 2 octave, 5 fifth  arp    per step: chord-tone index (3 = top octave), R rest
     kit    which drums; kick/snare/hat list the steps they hit on */
export const PALETTES = {
  // the menu: A minor, Am · F · C · G — brooding and open
  menu: { root: 33, bpm: 88, pad: 'saw', calm: 'flute', big: 'brass', kit: 'rock',
    prog: [ { bass: 0, chord: [24,27,31] }, { bass: -4, chord: [24,27,32] }, { bass: 3, chord: [27,31,34] }, { bass: -2, chord: [26,29,34] } ],
    lead: [ [0,36,6],[8,34,4],[12,31,4], [16,32,8],[26,36,5], [32,39,6],[40,38,4],[44,34,4], [48,38,8],[57,36,6] ],
    bass: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    arp:  [0,R,1,R, 2,R,1,R, 0,R,1,R, 2,R,1,R],
    kick: [0,8], snare: [4,12], hat: [1,3,5,7,9,11,13,15] },

  // JEDHA: D dorian, Dm · C · G · Am — a plucked, dusty pilgrim's theme over frame drums
  temple: { root: 38, bpm: 100, pad: 'saw', calm: 'pluck', big: 'brass', kit: 'frame',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -2, chord: [10,14,17] }, { bass: 5, chord: [12,17,21] }, { bass: 7, chord: [10,14,19] } ],
    lead: [ [0,31,3],[3,33,1],[4,34,2],[6,36,6],[12,34,2],[14,31,2],
            [16,29,4],[20,26,2],[22,29,2],[24,34,6],[30,33,2],
            [32,33,3],[35,31,1],[36,29,4],[40,36,4],[44,33,4],
            [48,34,4],[52,33,2],[54,31,6],[60,26,4] ],
    bass: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,5,0],
    arp:  [0,1,2,1, 3,2,1,2, 0,1,2,1, 3,2,1,R],
    kick: [0,6,10], snare: [4,12], hat: [2,3,7,11,14,15] },

  // MUSTAFAR: C phrygian, Cm · D♭ · Cm · B♭m — a driving forge rhythm, taiko and anvils
  foundry: { root: 36, bpm: 126, pad: 'saw', calm: 'pluck', big: 'brass', kit: 'taiko',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: 1, chord: [13,17,20] }, { bass: 0, chord: [12,15,19] }, { bass: -2, chord: [10,13,17] } ],
    lead: [ [0,31,2],[2,32,2],[4,31,4],[8,27,2],[10,29,2],[12,31,4],
            [16,32,4],[20,29,4],[24,25,6],[30,27,2],
            [32,36,4],[36,34,2],[38,32,2],[40,31,6],[46,32,2],
            [48,29,4],[52,25,4],[56,27,4],[60,24,4] ],
    bass: [1,0,1,0, 2,0,1,0, 1,0,1,0, 2,0,5,0],
    arp:  [0,R,0,1, 0,R,0,2, 0,R,0,1, 0,2,1,0],
    kick: [0,3,8,10], snare: [4,12], hat: [2,6,10,14] },

  // EXEGOL: B♭ minor (harmonic), B♭m · G♭ · E♭m · F — a slow Sith choir, a tolling bell, half-time drums
  plains: { root: 34, bpm: 104, pad: 'choir', calm: 'choir', big: 'brass', kit: 'toll',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -4, chord: [8,12,15] }, { bass: 5, chord: [12,17,20] }, { bass: -5, chord: [11,14,19] } ],
    lead: [ [0,31,8],[8,32,4],[12,31,4], [16,27,8],[24,29,4],[28,31,4], [32,32,6],[38,31,2],[40,29,8], [48,35,8],[56,26,4],[60,31,4] ],
    bass: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
    arp:  [0,R,R,1, R,R,2,R, 0,R,R,1, R,R,3,R],
    kick: [0,10], snare: [8], hat: [2,6,10,14] },
};

export const MUSIC = (function(){
  let bus=null, comp=null, delay=null, timer=null, started=false;
  let nextTime=0, stepIdx=0, intensity=0, target=0.16, state='menu', prevState='';
  let pal = PALETTES.menu, want = 'menu', palName = 'menu';
  let enabled = (() => { try { return localStorage.getItem('sw_music') !== '0'; } catch(e){ return true; } })();
  const stepDur = () => 60 / pal.bpm / 4, barDur = () => stepDur() * 16;
  const nf = s => mtof(pal.root + s);
  const AC = () => shared.AC;

  /* ---------- instruments ---------- */
  function env(g, t, peak, a, dur){
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function out(node, send){ node.connect(bus); if (send){ const s = AC().createGain(); s.gain.value = send; node.connect(s); s.connect(delay); s.connect(AE.roomIn); } }
  function osc(type, f, t, dur, det){ const o = AC().createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.start(t); o.stop(t + dur + 0.05); return o; }
  function lp(f, q){ const F = AC().createBiquadFilter(); F.type = 'lowpass'; F.frequency.value = f; if (q) F.Q.value = q; return F; }

  // a plain voice (kept for the menu flute and stings)
  function voice(t, freq, dur, o){ o = o || {};
    const s = osc(o.type || 'triangle', freq, t, dur, o.detune), g = AC().createGain();
    env(g, t, o.gain || 0.08, o.attack || 0.01, dur);
    let n = s; if (o.filter){ const F = lp(o.filter); s.connect(F); n = F; }
    if (o.vib){ const v = osc('sine', 5.2, t, dur), vg = AC().createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(o.vib, t + Math.min(0.4, dur * 0.5)); v.connect(vg); vg.connect(s.detune); }
    n.connect(g); out(g, o.send);
  }
  // detuned saw pair — the warm string-synth pad
  function padSaw(t, f, dur, gain, bright){
    const F = lp(bright, 0.6), g = AC().createGain(); env(g, t, gain, Math.min(0.5, dur * 0.3), dur);
    osc('sawtooth', f, t, dur, -7).connect(F); osc('sawtooth', f, t, dur, 7).connect(F);
    F.connect(g); out(g, 0.5);
  }
  // a choir: saws with vibrato through two "ah" formants
  function choir(t, f, dur, gain){
    const g = AC().createGain(); env(g, t, gain, Math.min(0.6, dur * 0.35), dur);
    const v = osc('sine', 5, t, dur), vg = AC().createGain(); vg.gain.value = 14; v.connect(vg);
    for (const det of [-9, 0, 9]){ const o = osc('sawtooth', f, t, dur, det); vg.connect(o.detune);
      for (const [ff, q, k] of [[730, 6, 1], [1090, 7, 0.55], [2440, 8, 0.2]]){
        const B = AC().createBiquadFilter(); B.type = 'bandpass'; B.frequency.value = ff; B.Q.value = q;
        const kg = AC().createGain(); kg.gain.value = k; o.connect(B); B.connect(kg); kg.connect(g); } }
    out(g, 0.6);
  }
  // a plucked string: bright attack that closes down fast
  function pluck(t, f, dur, gain){
    const F = lp(4200, 2), g = AC().createGain(); env(g, t, gain, 0.004, Math.max(0.25, dur));
    F.frequency.setValueAtTime(4200, t); F.frequency.exponentialRampToValueAtTime(500, t + 0.25);
    osc('sawtooth', f, t, dur).connect(F); osc('triangle', f * 2, t, dur, 4).connect(F);
    F.connect(g); out(g, 0.45);
  }
  // brass: a saw whose filter "blares" open on the attack
  function brass(t, f, dur, gain){
    const F = lp(300, 1.5), g = AC().createGain(); env(g, t, gain, 0.04, dur);
    F.frequency.setValueAtTime(300, t); F.frequency.exponentialRampToValueAtTime(2600, t + 0.06); F.frequency.exponentialRampToValueAtTime(1100, t + 0.3);
    osc('sawtooth', f, t, dur, -5).connect(F); osc('sawtooth', f, t, dur, 5).connect(F); osc('square', f / 2, t, dur).connect(F);
    F.connect(g); out(g, 0.35);
  }
  function bassNote(t, f, dur, gain, grit){
    const F = lp(260 + intensity * 600, 3), g = AC().createGain(); env(g, t, gain, 0.005, dur);
    osc('sawtooth', f, t, dur).connect(F); osc('sine', f, t, dur).connect(g);
    let n = F;
    if (grit){ const w = AC().createWaveShaper(); w.curve = GRIT; F.connect(w); n = w; }
    n.connect(g); out(g, 0);
  }
  const INSTR = { flute: (t, f, d, g) => voice(t, f, d, { type: 'triangle', gain: g, attack: 0.05, filter: 2600, send: 0.6, vib: 14 }),
                  pluck, brass, choir: (t, f, d, g) => choir(t, f, d, g * 0.9) };

  /* ---------- drums ---------- */
  function noiseHit(t, amp, type, f, q, dur){
    const s = AC().createBufferSource(); s.buffer = AE.noise.white;
    const F = AC().createBiquadFilter(); F.type = type; F.frequency.value = f; if (q) F.Q.value = q;
    const g = AC().createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(F); F.connect(g); out(g, 0.12); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function kick(t, amp, f0, f1, dur){ const o = AC().createOscillator(), g = AC().createGain();
    o.frequency.setValueAtTime(f0 || 132, t); o.frequency.exponentialRampToValueAtTime(f1 || 45, t + 0.12);
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
    o.connect(g); out(g, 0); o.start(t); o.stop(t + (dur || 0.2) + 0.02); }
  function taiko(t, amp){ kick(t, amp, 110, 48, 0.45); noiseHit(t, amp * 0.35, 'lowpass', 420, 0, 0.22); }
  function frame(t, amp){ kick(t, amp * 0.6, 200, 95, 0.16); noiseHit(t, amp * 0.25, 'bandpass', 900, 1.2, 0.08); }
  function metal(t, amp, f){ const o = AC().createOscillator(), m = AC().createOscillator(), mg = AC().createGain(), g = AC().createGain();
    o.frequency.value = f; m.frequency.value = f * 1.53; mg.gain.setValueAtTime(f * 3, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.8);
    m.connect(mg); mg.connect(o.frequency); env(g, t, amp, 0.002, 0.9); o.connect(g); out(g, 0.5); o.start(t); m.start(t); o.stop(t + 1); m.stop(t + 1); }
  function swell(t, amp, dur){ // a cymbal/gong swell into a hit
    const s = AC().createBufferSource(); s.buffer = AE.noise.white;
    const F = AC().createBiquadFilter(); F.type = 'highpass'; F.frequency.value = 5000;
    const g = AC().createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    s.connect(F); F.connect(g); out(g, 0.4); s.start(t); s.stop(t + dur + 0.7); }
  function roll(t, amp, n){ for (let i = 0; i < n; i++) kick(t + i * 0.045, amp * (0.4 + 0.6 * i / n), 90, 60, 0.18); }

  function drum(kind, t, I, inBar){
    const K = pal.kit;
    if (kind === 'kick'){
      if (K === 'taiko' || K === 'toll') taiko(t, 0.42 + I * 0.4);
      else if (K === 'frame') frame(t, 0.5 + I * 0.4);
      else kick(t, 0.4 + I * 0.4);
    } else if (kind === 'snare'){
      if (K === 'taiko' && I > 0.85) metal(t, 0.035, 820);                 // the forge's anvil on the backbeat
      if (K === 'toll') noiseHit(t, 0.2, 'bandpass', 1400, 0.6, 0.35);      // a big, roomy half-time crack
      else noiseHit(t, 0.16, 'bandpass', K === 'frame' ? 1100 : 1800, 0.7, 0.16);
    } else if (kind === 'hat'){
      noiseHit(t, (K === 'frame' ? 0.05 : 0.08) + (I - 0.75) * 0.3, 'highpass', K === 'frame' ? 5000 : 7000, 0, K === 'frame' ? 0.07 : 0.05);
    }
    void inBar;
  }

  /* ---------- the sequencer ---------- */
  function scheduleStep(step, t){
    const I = intensity; if (I < 0.04) return;   // faded out (death / muted) — let the reverb ring, schedule nothing
    const ls = ((step % 64) + 64) % 64, bar = (ls / 16) | 0, inBar = ls % 16, P = pal.prog[bar], sd = stepDur();
    if (inBar === 0){
      const bd = barDur() * 1.04;
      for (const c of P.chord){
        if (pal.pad === 'choir') choir(t, nf(c), bd, 0.012 + I * 0.018);
        else padSaw(t, nf(c), bd, 0.016 + I * 0.03, 700 + I * 1600);
      }
      voice(t, nf(P.bass - 12), bd, { type: 'sine', gain: 0.05 + I * 0.05, attack: 0.3, filter: 380 });   // sub drone
      if (pal.kit === 'toll' && I > 0.2) metal(t, 0.03 + I * 0.03, nf(P.bass + 12));                 // Exegol's bell tolls each bar
      if (pal.kit === 'taiko' && I > 0.5 && bar === 0) metal(t, 0.02, nf(24));
    }
    // bass line
    const b = pal.bass[inBar];
    if (I > 0.3 && b){ const s = b === 2 ? 12 : b === 5 ? 7 : 0;
      bassNote(t, nf(P.bass + s), sd * (pal.kit === 'toll' ? 6 : 1.7), 0.06 + I * 0.06, pal.kit === 'taiko'); }
    // ostinato
    const ai = pal.arp[inBar];
    if (I > 0.34 && ai !== R){ const tone = ai === 3 ? P.chord[0] + 12 : P.chord[ai];
      if (pal.calm === 'pluck') pluck(t, nf(tone + 12), sd * 1.5, 0.018 + I * 0.03);
      else voice(t, nf(tone + 12), sd * 1.4, { type: 'triangle', gain: 0.018 + I * 0.03, attack: 0.005, send: 0.45 }); }
    // drums
    if (I > 0.36 && pal.kick.includes(inBar) && (I > 0.8 || inBar === 0 || inBar === 8 || pal.kit !== 'rock')) drum('kick', t, I, inBar);
    if (I > 0.6 && pal.snare.includes(inBar)) drum('snare', t, I, inBar);
    if (I > 0.75 && pal.hat.includes(inBar)) drum('hat', t, I, inBar);
    // a fill into the top of the loop
    if (I > 0.6 && bar === 3 && inBar >= 12){ const k = pal.kit === 'frame' ? frame : taiko; k(t, 0.25 + (inBar - 12) * 0.08); }
    // boss: brass stabs on the chord
    if (I > 0.9 && (bar === 0 || bar === 2) && (inBar === 0 || inBar === 6 || inBar === 12))
      for (const c of P.chord) brass(t, nf(c), sd * (inBar === 12 ? 3 : 2), 0.022);
    // melody — quiet in the lull, played big when the fight is at its peak
    for (const L of pal.lead){ if (ls === L[0]){
      if (I < 0.32) INSTR[pal.calm](t, nf(L[1]), sd * L[2], 0.05);
      else if (I > 0.82) INSTR[pal.big](t, nf(L[1]), sd * L[2] * 0.85, 0.032); } }
  }
  function loop(){ if (!AC() || !started) return;
    if (nextTime < AC().currentTime) nextTime = AC().currentTime + 0.05;   // fell behind (tab throttled) — resync, no catch-up burst
    while (nextTime < AC().currentTime + 0.12){
      // switch worlds only at the top of a bar so the change lands on the downbeat
      if (want !== palName && stepIdx % 16 === 0){ palName = want; pal = PALETTES[want] || PALETTES.menu; stepIdx = 0; }
      scheduleStep(stepIdx, nextTime);
      nextTime += stepDur(); stepIdx++;
      intensity += (target - intensity) * 0.03;   // smooth swell between states
    }
  }

  return {
    init(){ if (started || !AC() || !AE.ready) return;
      bus = AC().createGain(); bus.gain.value = 0.0001;
      comp = AC().createDynamicsCompressor(); comp.threshold.value = -15; comp.ratio.value = 4;
      bus.connect(comp); comp.connect(AE.bus.music);
      delay = AC().createDelay(); delay.delayTime.value = 0.27; const fb = AC().createGain(); fb.gain.value = 0.33; const wet = AC().createGain(); wet.gain.value = 0.25;
      delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
      started = true; nextTime = AC().currentTime + 0.08; stepIdx = 0;
      bus.gain.setTargetAtTime(enabled ? 0.2 : 0.0001, AC().currentTime, 1.2);   // fade in
      timer = setInterval(loop, 25);
    },
    setPalette(name){ if (PALETTES[name]) want = name; },
    setState(s){ if (s === state) return; prevState = state; state = s;
      const map = { menu: 0.16, lull: 0.3, combat: 0.62, heavy: 0.84, boss: 1.0, victory: 0.2, dead: 0.0 };
      target = (map[s] !== undefined) ? map[s] : 0.3;
      if (s === 'boss' && prevState !== 'boss') this.bossSting();
      else if (s === 'victory') this.victorySting();
      else if (s === 'dead') this.deathSting();
    },
    setEnabled(on){ enabled = on; try { localStorage.setItem('sw_music', on ? '1' : '0'); } catch(e){}
      if (bus) bus.gain.setTargetAtTime(on ? 0.2 : 0.0001, AC().currentTime, 0.3); },
    toggle(){ this.setEnabled(!enabled); return enabled; },
    isOn(){ return enabled; },
    ok(){ return !!(AC() && bus && enabled); },

    /* ---------- stings ---------- */
    bossSting(){ if (!this.ok()) return; const t = AC().currentTime;
      roll(t, 0.5, 10); swell(t, 0.12, 0.5);
      for (const c of [0, 7, 12]) brass(t + 0.5, nf(c + 12), 1.6, 0.05);
      voice(t + 0.5, nf(-12), 2.0, { type: 'sine', gain: 0.14, attack: 0.02, filter: 300 });
      metal(t + 0.5, 0.05, nf(12)); },
    // a horn call at the start of a wave: root up to the fifth over a drum hit
    waveSting(){ if (!this.ok()) return; const t = AC().currentTime;
      brass(t, nf(12), 0.35, 0.04); brass(t + 0.3, nf(19), 0.8, 0.045);
      taiko(t + 0.3, 0.45); },
    // an area cleared: the chord resolves to major and rings out
    clearSting(){ if (!this.ok()) return; const t = AC().currentTime;
      [12, 16, 19, 24].forEach((n, i) => pluck(t + i * 0.08, nf(n + 12), 1.2, 0.05));
      padSaw(t, nf(12), 2.2, 0.04, 1800); padSaw(t, nf(16), 2.2, 0.03, 1800); padSaw(t, nf(19), 2.2, 0.03, 1800); },
    // a new power unlocked: a short bright fanfare
    unlockSting(){ if (!this.ok()) return; const t = AC().currentTime;
      [[24, 0], [28, 0.12], [31, 0.24]].forEach(([n, d]) => brass(t + d, nf(n), d === 0.24 ? 0.9 : 0.2, 0.035));
      swell(t, 0.05, 0.24); },
    victorySting(){ if (!this.ok()) return; const t = AC().currentTime;
      [12, 16, 19, 24].forEach((n, i) => voice(t + i * 0.12, nf(n + 12), 0.9, { type: 'triangle', gain: 0.12, attack: 0.01, filter: 2600, send: 0.6 }));   // major resolve
      for (const n of [12, 16, 19]) brass(t + 0.5, nf(n), 1.6, 0.03);
      voice(t, nf(0), 1.9, { type: 'sine', gain: 0.1, attack: 0.05, filter: 600 }); },
    deathSting(){ if (!AC() || !bus || !enabled) return; const t = AC().currentTime;
      voice(t, nf(0), 2.3, { type: 'sine', gain: 0.13, attack: 0.04, filter: 300 });
      voice(t, nf(13), 2.3, { type: 'triangle', gain: 0.06, attack: 0.05, filter: 900, send: 0.6 });
      voice(t + 0.5, nf(11), 1.6, { type: 'triangle', gain: 0.05, attack: 0.05, filter: 800, send: 0.6 }); },

    debug(){ return { state, target, intensity: +intensity.toFixed(3), palette: palName, started, enabled, stepIdx,
      ctxState: AC() ? AC().state : 'none', ctxTime: AC() ? +AC().currentTime.toFixed(2) : 0 }; },
    updateState(){ if (!started) return;
      let s;
      if (G.mode === 'victory') s = 'victory';
      else if (G.mode === 'dead') s = 'dead';
      else if (G.mode !== 'play') s = 'menu';
      else if (shared.boss && shared.boss.hp > 0) s = 'boss';
      else { let warb = false, host = 0; for (const e of enemies){ if (e.dead || e.converted) continue; host++; if (e.warbringer) warb = true; }
        s = warb ? 'boss' : host >= 7 ? 'heavy' : host > 0 ? 'combat' : 'lull'; }
      this.setState(s);
    },
  };
})();
