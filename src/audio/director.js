// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AUDIO DIRECTOR: everything that sounds continuously, steered once a frame from the main loop.
//   - the lightsaber hum (pitch by form, swells and brightens through a swing, follows a thrown saber)
//   - the Darksaber's darker, grittier hum
//   - the jetpack roar and the flamethrower, by how hard they're running
//   - each world's ambience bed plus its occasional distant events (Jedha bells, Mustafar lava, Exegol thunder)
//   - the mix state: muffled under the pause menu, on death, for a beat after a hit and when badly hurt
//   - which reverb room and which music palette the current arena uses

import { AE, loop, play, place, setRoom, setMuffle } from './engine.js';
import { MUSIC } from './music.js';
import { S } from './sfx.js';
import { shared, G, player } from '../state.js';
import { maxHp } from '../player/helpers.js';
import { clamp, rand } from '../utils.js';

const L = { hum: null, dark: null, jet: null, flame: null, amb: [], ambKey: '' };
let nextEvt = 0, heartT = 0, lastMuffle = 0, prevMode = 'menu';

/* hum pitch by saber form: lighter forms ride higher */
const FORM_PITCH = { fast: 1.1, medium: 1, strong: 0.86 };

function ensureLoops(){
  if (L.hum) return;
  // the hum: two slightly detuned saws an octave under a sine, through a lowpass that opens as the blade moves
  L.hum = loop({ base: 90, layers: [{ f: 90 }, { f: 90.7, det: 6, g: 0.8 }, { type: 'sine', f: 180, g: 0.6 }],
                 filt: { f: 420, q: 1.2 }, lfo: { r: 3.7, d: 40 }, verb: 0.08 });
  L.dark = loop({ base: 62, layers: [{ type: 'square', f: 62, g: 0.6 }, { f: 62.6, g: 0.8 }, { type: 'sine', f: 124, g: 0.5 }],
                  filt: { f: 380, q: 2 }, lfo: { r: 5.3, d: 60 }, drive: 0.35, verb: 0.08 });
  L.jet = loop({ base: 50, layers: [{ noise: 'brown', g: 1.6 }, { noise: 'pink', g: 0.5 }, { f: 50, g: 0.12 }],
                 filt: { f: 500, q: 0.6 }, lfo: { r: 11, d: 90 } });
  L.flame = loop({ base: 60, layers: [{ noise: 'pink', g: 1 }, { noise: 'brown', g: 1.2 }],
                   filt: { type: 'bandpass', f: 650, q: 0.6 }, lfo: { r: 7, d: 160 } });
}

/* ---------- ambience ----------
   One bed per arena layout (the 'worlds' direction names: Jedha / Mustafar / Exegol). Beds are loops on the amb
   bus; `events` are sparse one-shots scattered around the listener. */
const AMB = {
  temple: {   // JEDHA — dry desert wind across the holy city, a temple bell far off
    beds: [{ base: 1, layers: [{ noise: 'pink' }], filt: { type: 'bandpass', f: 520, q: 0.6 }, lfo: { r: 0.07, d: 260 }, lvl: 0.06 },
           { base: 1, layers: [{ noise: 'brown' }], filt: { f: 160 }, lvl: 0.05 }],
    every: [8, 15],
    event(){ const f = rand(180, 240);
      play({ bus: 'amb', type: 'sine', f, fm: { r: 2.76, i: 1.4, i2: 0.02 }, g: 0.022, a: 0.004, d: 3.2, pan: rand(-0.8, 0.8), verb: 0.7 });
      play({ bus: 'amb', type: 'sine', f: f * 2.01, g: 0.01, a: 0.004, d: 2.4, pan: rand(-0.8, 0.8), verb: 0.7 }); },
    tick(){},
  },
  foundry: {  // MUSTAFAR — a lava river's rumble, the hiss of heat, machinery somewhere in the forge
    beds: [{ base: 1, layers: [{ noise: 'brown' }], filt: { f: 150 }, lfo: { r: 0.13, d: 50 }, lvl: 0.16 },
           { base: 1, layers: [{ noise: 'pink' }], filt: { type: 'highpass', f: 3500 }, lfo: { r: 0.2, d: 900 }, lvl: 0.012 }],
    every: [4, 9],
    event(){ play({ bus: 'amb', type: 'sine', f: rand(300, 520), fm: { r: 1.53, i: 3, i2: 0.05 }, g: 0.02, d: 0.9, pan: rand(-0.9, 0.9), verb: 0.6 }); },
    // lava bubbles pop constantly, low and soft
    tick(dt){ if (Math.random() < dt * 2.2){ const f = rand(70, 190);
      play({ bus: 'amb', type: 'sine', f, f2: f * 0.45, g: 0.035, a: 0.01, d: 0.09, pan: rand(-0.9, 0.9), pri: 0 }); } },
  },
  plains: {   // EXEGOL — storm wind over a dead plain, a sub-bass drone underneath, far-off rumbles
    beds: [{ base: 1, layers: [{ noise: 'pink' }], filt: { type: 'bandpass', f: 380, q: 0.8 }, lfo: { r: 0.05, d: 240 }, lvl: 0.085 },
           { base: 41, layers: [{ type: 'sine', f: 41 }, { type: 'sine', f: 61.7, g: 0.5 }], filt: { f: 220 }, lfo: { r: 0.09, d: 40 }, lvl: 0.06 }],
    every: [10, 18],
    event(){ play({ bus: 'amb', src: 'noise', color: 'brown', g: 0.09, a: 0.6, d: 2.6, filt: { type: 'lowpass', f: 240, f2: 90 }, pan: rand(-0.6, 0.6), verb: 0.5 }); },
    tick(){},
  },
  menu: {
    beds: [{ base: 1, layers: [{ noise: 'pink' }], filt: { type: 'bandpass', f: 420, q: 0.7 }, lfo: { r: 0.06, d: 200 }, lvl: 0.03 }],
    every: [999, 999], event(){}, tick(){},
  },
};

function setAmbience(key){
  if (key === L.ambKey) return;
  L.ambKey = key;
  for (const b of L.amb) b.h.stop();
  L.amb = [];
  const A = AMB[key]; if (!A) return;
  for (const spec of A.beds){ const h = loop(Object.assign({ bus: 'amb' }, spec)); if (h){ h.set(spec.lvl, 0, 0, 1.5); L.amb.push({ h, lvl: spec.lvl }); } }
  nextEvt = rand(A.every[0], A.every[1]) * 0.5;
}

/* thunder from the storm overhead (atmosphere.js fires this with each lightning flash) — the crack arrives first,
   then the rumble rolls in after a delay that depends on how far off the strike was */
export function thunder(){
  if (!AE.ready) return;
  const far = Math.random(), lag = 0.15 + far * 0.9, pan = rand(-0.7, 0.7);
  play({ bus: 'amb', src: 'noise', g: 0.12 * (1 - far * 0.6), d: 0.3, filt: { type: 'highpass', f: 1400 }, drive: 0.6, pan, verb: 0.4 });
  play({ bus: 'amb', src: 'noise', color: 'brown', at: lag, g: 0.3 - far * 0.12, a: 0.05, hold: 0.3, d: 2.6, filt: { type: 'lowpass', f: 600, f2: 70 }, drive: 0.3, pan, verb: 0.6, pri: 2 });
}

/* ---------- the per-frame update ---------- */
export function updateAudio(dt){
  if (!AE.ready || !shared.AC || shared.AC.state !== 'running') return;
  ensureLoops();
  const t = shared.AC.currentTime;
  const playing = G.mode === 'play' && !G.paused && !G.skillSelect;
  const inWorld = G.mode === 'play' || G.mode === 'dead' || G.mode === 'victory';
  const layout = shared.arenaLayout || 'temple';
  if (G.mode !== prevMode){ if (G.mode === 'play') S.uiStart(); prevMode = G.mode; }   // launching a run

  // room, ambience, music palette follow the arena
  setRoom(inWorld ? layout : 'menu');
  setAmbience(inWorld ? layout : 'menu');
  MUSIC.setPalette(inWorld ? layout : 'menu');

  // ── saber hums ──
  const jedi = G.hero === 'jedi' && (!player.holstered || shared.saberProj), darkOn = G.hero === 'mando' && player.weapon === 'darksaber';
  const swinging = player.atkT > 0 || player.darkT > 0;
  const motion = clamp(Math.hypot(player.moveVel.x, player.moveVel.z) / 12, 0, 1);
  const thrown = jedi && shared.saberProj;
  if (L.hum){
    const p = FORM_PITCH[G.stance] || 1;
    const lvl = (playing && jedi) ? (thrown ? 0.09 : 0.035 + (swinging ? 0.05 : 0) + (player.blockHeld ? 0.015 : 0) + motion * 0.01) : 0;
    const hz = 420 + (swinging ? 1500 : 0) + (thrown ? 1200 : 0) + motion * 200;
    L.hum.set(lvl, hz, 90 * p * (swinging ? 1.06 : 1), swinging ? 0.03 : 0.12);
    const P = thrown ? place(shared.saberProj.mesh.position) : null;
    L.hum.pan.pan.setTargetAtTime(P ? P.pan : 0, t, 0.05);
  }
  if (L.dark) L.dark.set((playing && darkOn) ? 0.04 + (swinging ? 0.05 : 0) : 0, 380 + (swinging ? 1300 : 0), 62 * (swinging ? 1.08 : 1), swinging ? 0.03 : 0.12);

  // ── jetpack + flamethrower ──
  if (L.jet){
    const k = !playing || G.hero !== 'mando' ? 0 : player.boosting ? 1.25 : player.jetActive ? 1 : player.hovering ? 0.45 : 0;
    L.jet.set(k * 0.16, 400 + k * 1300, 0, k > 0 ? 0.05 : 0.12);
  }
  if (L.flame){
    const on = playing && G.hero === 'mando' && !!player.flaming;
    L.flame.set(on ? 0.2 : 0, on ? 900 : 500, 0, on ? 0.04 : 0.1);
  }

  // ── ambience events ──
  const A = AMB[L.ambKey];
  if (A && !G.paused){
    A.tick(dt);
    nextEvt -= dt;
    if (nextEvt <= 0){ A.event(); nextEvt = rand(A.every[0], A.every[1]); }
  }

  // ── low-health heartbeat (separate from the Jedi's stamina heartbeat, which is quicker and lighter) ──
  const hpFrac = player.hp / Math.max(1, maxHp());
  if (playing && hpFrac < 0.28 && player.hp > 0){
    heartT -= dt;
    if (heartT <= 0){
      heartT = 0.62 + hpFrac * 1.4;
      play({ type: 'sine', f: 58, f2: 38, g: 0.16, d: 0.14, pri: 2, jit: 0 });
      play({ type: 'sine', f: 52, f2: 36, at: 0.16, g: 0.11, d: 0.14, pri: 2, jit: 0 });
    }
  } else heartT = 0;

  // ── muffle: the pause menu, death, a beat after a hit, and when badly hurt ──
  let hz = 20000;
  if (G.paused || G.skillSelect) hz = 650;
  else if (G.mode === 'dead') hz = 900;
  else if (G.mode === 'play'){
    if (hpFrac < 0.28) hz = 2800 + hpFrac * 20000;
    if (G.slowmo < 0.6) hz = Math.min(hz, 3200);
    if (AE.hurtAt && t - AE.hurtAt < 0.22) hz = Math.min(hz, 1300);
  }
  hz = Math.round(hz / 100) * 100;
  if (hz !== lastMuffle){ setMuffle(hz, hz < 2000 ? 0.04 : 0.18); lastMuffle = hz; }
}
