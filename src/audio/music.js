// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MUSIC: the adaptive synthesized score.

import { shared, G, enemies } from '../state.js';

/* ---------- procedural MUSIC engine ----------
   A fully synthesized adaptive score (no audio files — same Web Audio ctx as the SFX). Layers fade in with an
   INTENSITY that the game state drives: a brooding menu pad → a driving combat loop → a heavy boss surge, plus
   one-shot STINGS on a boss rising, victory, and death. Tuned to sit UNDER the SFX; toggle with M (persisted). */
export const MUSIC = (function(){
  let bus=null, comp=null, revSend=null, noiseBuf=null, timer=null, started=false;
  let nextTime=0, stepIdx=0, intensity=0, target=0.16, state='menu', prevState='';
  let enabled = (localStorage.getItem('sw_music') !== '0');
  const BPM=116, stepDur=60/BPM/4, barDur=stepDur*16;   // a 16th-note grid
  const A1=55, nf = s => A1 * Math.pow(2, s/12);         // semitones from A1
  // A-minor "axis" loop — Am · F · C · G (epic without quoting anyone)
  const PROG = [
    { bass:0,  chord:[24,27,31] },   // Am
    { bass:-4, chord:[24,27,32] },   // F
    { bass:3,  chord:[27,31,34] },   // C
    { bass:-2, chord:[26,29,34] },   // G
  ];
  // a wistful 4-bar lead phrase — [loopStep, semitone, durSteps]
  const LEAD = [ [0,36,6],[8,34,4],[12,31,4], [16,32,8],[26,36,5], [32,39,6],[40,38,4],[44,34,4], [48,38,8],[57,36,6] ];
  function noise(){ if (noiseBuf) return noiseBuf;
    const n=(shared.AC.sampleRate*0.4)|0; noiseBuf=shared.AC.createBuffer(1,n,shared.AC.sampleRate);
    const d=noiseBuf.getChannelData(0); for (let i=0;i<n;i++) d[i]=Math.random()*2-1; return noiseBuf; }
  function voice(t, freq, dur, o){ o=o||{};
    const osc=shared.AC.createOscillator(); osc.type=o.type||'triangle'; osc.frequency.value=freq; if (o.detune) osc.detune.value=o.detune;
    const g=shared.AC.createGain(); g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,o.gain||0.08), t+(o.attack||0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    let node=osc;
    if (o.filter){ const f=shared.AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=o.filter; osc.connect(f); node=f; }
    node.connect(g); g.connect(bus);
    if (o.send){ const s=shared.AC.createGain(); s.gain.value=o.send; g.connect(s); s.connect(revSend); }
    osc.start(t); osc.stop(t+dur+0.05);
  }
  function kick(t, amp){ const o=shared.AC.createOscillator(), g=shared.AC.createGain();
    o.frequency.setValueAtTime(132,t); o.frequency.exponentialRampToValueAtTime(45,t+0.12);
    g.gain.setValueAtTime(amp||0.5,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t+0.2); }
  function perc(t, amp, hi){ const s=shared.AC.createBufferSource(); s.buffer=noise();
    const f=shared.AC.createBiquadFilter(); if (hi){ f.type='highpass'; f.frequency.value=7000; } else { f.type='bandpass'; f.frequency.value=1800; f.Q.value=0.7; }
    const g=shared.AC.createGain(); g.gain.setValueAtTime(amp||0.18,t); g.gain.exponentialRampToValueAtTime(0.0001, t+(hi?0.05:0.16));
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t+(hi?0.06:0.18)); }
  function scheduleStep(step, t){
    const I=intensity; if (I < 0.04) return;   // faded out (death / muted) — let the reverb ring, schedule nothing
    const ls=(((step%64)+64)%64), bar=(ls/16)|0, inBar=ls%16, P=PROG[bar];
    if (inBar===0){
      for (const c of P.chord) voice(t, nf(c), barDur*1.04, {type:'triangle', gain:0.03+I*0.06, attack:0.45, filter:900+I*1400, send:0.5});
      voice(t, nf(P.bass-12), barDur*1.04, {type:'sine', gain:0.04+I*0.05, attack:0.3, filter:380});   // sub drone
    }
    if (I>0.3 && inBar%2===0) voice(t, nf(P.bass), stepDur*1.7, {type:'sawtooth', gain:0.05+I*0.05, attack:0.005, filter:260+I*520});
    if (I>0.34 && inBar%2===0){ const tone=P.chord[(inBar/2)%P.chord.length];
      voice(t, nf(tone+12), stepDur*1.4, {type:'triangle', gain:0.02+I*0.035, attack:0.005, send:0.45}); }
    if (I>0.36){ const pat = I>0.8 ? [0,4,8,12] : [0,8]; if (pat.indexOf(inBar)>=0) kick(t, 0.4+I*0.4); }
    if (I>0.78 && inBar%2===1) perc(t, 0.1+(I-0.78)*0.4, true);             // hats
    if (I>0.8 && (inBar===4||inBar===12)) perc(t, 0.16, false);            // snare backbeat
    for (const L of LEAD){ if (ls===L[0]){
      if (I<0.32) voice(t, nf(L[1]), stepDur*L[2], {type:'triangle', gain:0.06, attack:0.04, filter:2600, send:0.6});
      else if (I>0.82) voice(t, nf(L[1]+12), stepDur*L[2]*0.7, {type:'sawtooth', gain:0.035, attack:0.02, filter:3200, send:0.4}); } }
  }
  function loop(){ if (!shared.AC || !started) return;
    if (nextTime < shared.AC.currentTime) nextTime = shared.AC.currentTime + 0.05;   // fell behind (tab throttled) — resync, no catch-up burst
    while (nextTime < shared.AC.currentTime + 0.12){
      scheduleStep(stepIdx, nextTime);
      nextTime += stepDur; stepIdx++;
      intensity += (target - intensity) * 0.03;   // smooth swell between states
    }
  }
  return {
    init(){ if (started || !shared.AC) return;
      bus=shared.AC.createGain(); bus.gain.value=0.0001;
      comp=shared.AC.createDynamicsCompressor(); comp.threshold.value=-15; comp.ratio.value=4;
      bus.connect(comp); comp.connect(shared.masterGain);
      const dl=shared.AC.createDelay(); dl.delayTime.value=0.27; const fb=shared.AC.createGain(); fb.gain.value=0.33; const wet=shared.AC.createGain(); wet.gain.value=0.3;
      dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(comp);
      revSend=shared.AC.createGain(); revSend.gain.value=1; revSend.connect(dl);
      noise(); started=true; nextTime=shared.AC.currentTime+0.08; stepIdx=0;
      bus.gain.setTargetAtTime(enabled?0.18:0.0001, shared.AC.currentTime, 1.2);   // fade in
      timer=setInterval(loop, 25);
    },
    setState(s){ if (s===state) return; prevState=state; state=s;
      const map={menu:0.16, lull:0.32, combat:0.62, boss:1.0, victory:0.2, dead:0.0};
      target = (map[s]!==undefined) ? map[s] : 0.3;
      if (s==='boss' && prevState!=='boss') this.bossSting();
      else if (s==='victory') this.victorySting();
      else if (s==='dead') this.deathSting();
    },
    setEnabled(on){ enabled=on; try{ localStorage.setItem('sw_music', on?'1':'0'); }catch(e){}
      if (bus) bus.gain.setTargetAtTime(on?0.18:0.0001, shared.AC.currentTime, 0.3); },
    toggle(){ this.setEnabled(!enabled); return enabled; },
    isOn(){ return enabled; },
    bossSting(){ if (!shared.AC||!bus) return; const t=shared.AC.currentTime;
      voice(t, nf(-2), 1.5, {type:'sawtooth', gain:0.15, attack:0.02, filter:520, send:0.4});
      voice(t, nf(10), 1.5, {type:'sawtooth', gain:0.09, attack:0.02, filter:720, send:0.4});
      voice(t+0.05, nf(25), 1.0, {type:'square', gain:0.05, attack:0.02, filter:2000, send:0.6}); },
    victorySting(){ if (!shared.AC||!bus) return; const t=shared.AC.currentTime;
      [12,16,19,24].forEach((n,i)=> voice(t+i*0.12, nf(n), 0.9, {type:'triangle', gain:0.12, attack:0.01, filter:2600, send:0.6}));   // A-major resolve
      voice(t, nf(0), 1.9, {type:'sine', gain:0.1, attack:0.05, filter:600}); },
    deathSting(){ if (!shared.AC||!bus) return; const t=shared.AC.currentTime;
      voice(t, nf(0), 2.3, {type:'sine', gain:0.13, attack:0.04, filter:300});
      voice(t, nf(13), 2.3, {type:'triangle', gain:0.06, attack:0.05, filter:900, send:0.6});
      voice(t+0.5, nf(11), 1.6, {type:'triangle', gain:0.05, attack:0.05, filter:800, send:0.6}); },
    debug(){ return { state, target, intensity:+intensity.toFixed(3), started, enabled, stepIdx,
      ctxState: shared.AC?shared.AC.state:'none', ctxTime: shared.AC?+shared.AC.currentTime.toFixed(2):0 }; },
    updateState(){ if (!started) return;
      let s;
      if (G.mode==='victory') s='victory';
      else if (G.mode==='dead') s='dead';
      else if (G.mode!=='play') s='menu';
      else if (shared.boss && shared.boss.hp>0) s='boss';
      else { let warb=false, host=0; for (const e of enemies){ if (e.dead||e.converted) continue; host++; if (e.warbringer) warb=true; } s = warb?'boss': host>0?'combat':'lull'; }
      this.setState(s);
    },
  };
})();
