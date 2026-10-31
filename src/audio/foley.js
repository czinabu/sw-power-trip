// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOLEY: footsteps and the small cloth / armour sounds of movement, which the combat sounds never covered.
//   - the hero's footfalls, timed by distance walked (so they match any gait), voiced by the arena's floor
//     (stone and sand in the temple, ringing grating in the forge, loose ash and grit on the plains), lighter for the
//     Jedi's robes and boots, with a plate clink for the Mandalorian and trooper
//   - the nearest few foes' footfalls, placed in the world, so you hear a squad closing in before you see it
// Everything is quiet, throttled and skipped past a short range: it should add presence, never clutter the fight.

import { play, tooSoon } from './engine.js';
import { G, player, enemies, isGunner, shared } from '../state.js';
import { clamp, rand } from '../utils.js';

const N = o => play(Object.assign({ src: 'noise', pri: 0 }, o));
const T = o => play(Object.assign({ pri: 0 }, o));

/* one footfall on a floor. w = how heavy (0.4 light boots … 1.6 a brute); pos places it in the world (a foe) */
const FLOORS = {
  temple(w, pos){   // dry stone with a dusting of sand
    N({ pos, color: 'brown', g: 0.07 * w, a: 0.002, d: 0.07, filt: { type: 'lowpass', f: 700 + 200 * w } });
    N({ pos, g: 0.022 * w, a: 0.002, d: 0.05, filt: { type: 'bandpass', f: rand(2400, 3600), q: 1.1 } });
    T({ pos, type: 'sine', f: 120 / Math.sqrt(w), f2: 60, g: 0.05 * w, d: 0.07 });
  },
  foundry(w, pos){  // metal grating: a dull tread and a short ring
    N({ pos, color: 'brown', g: 0.06 * w, a: 0.002, d: 0.06, filt: { type: 'lowpass', f: 900 } });
    T({ pos, type: 'sine', f: rand(780, 940), fm: { r: 1.41, i: 2, i2: 0.05 }, g: 0.018 * w, a: 0.002, d: 0.16, verb: 0.2 });
    T({ pos, type: 'sine', f: 100 / Math.sqrt(w), f2: 55, g: 0.05 * w, d: 0.07 });
  },
  plains(w, pos){   // loose ash and grit that crunches under the heel
    N({ pos, color: 'pink', g: 0.06 * w, a: 0.004, d: 0.1, filt: { type: 'bandpass', f: rand(1200, 1900), q: 0.7 } });
    N({ pos, g: 0.03 * w, at: 0.025, a: 0.002, d: 0.05, filt: { type: 'highpass', f: 3000 } });
    T({ pos, type: 'sine', f: 90 / Math.sqrt(w), f2: 48, g: 0.035 * w, d: 0.08 });
  },
};
const floor = () => FLOORS[shared.arenaLayout] || FLOORS.temple;

/* the hero's plate or cloth, over the footfall */
function gear(w, run){
  if (isGunner()){   // beskar / armour plates knocking together at a run
    if (run) T({ type: 'sine', f: rand(1900, 2500), fm: { r: 2.76, i: 1.2, i2: 0.05 }, g: 0.012, a: 0.001, d: 0.09 });
    N({ color: 'pink', g: 0.012 * w, a: 0.004, d: 0.1, filt: { type: 'bandpass', f: 4200, q: 1.5 } });
  } else {           // robe and cloak: a soft fabric swish
    N({ color: 'pink', g: 0.016 * (run ? 1.3 : 0.8), a: 0.02, d: 0.14, filt: { type: 'bandpass', f: 1400, q: 0.6 } });
  }
}

let acc = 0, prevX = 0, prevZ = 0, prevInit = false;
const seen = new WeakMap();   // foe → { x, z, acc }

export function updateFoley(dt){
  const playing = G.mode === 'play' && !G.paused && !G.skillSelect && !G.cutscene;
  const p = player.group.position;
  if (!prevInit){ prevX = p.x; prevZ = p.z; prevInit = true; }
  const dx = p.x - prevX, dz = p.z - prevZ; prevX = p.x; prevZ = p.z;
  if (!playing || dt <= 0) return;

  // ── the hero ──
  const step = Math.hypot(dx, dz), speed = step / dt;
  const rooted = player.grounded && !player.hang && !player.mantle && !player.wallRun && !(player.slideT > 0) && !(player.dashT > 0) && !player.jetActive;
  if (rooted && speed > 1.2 && step < 3){
    acc += step;
    const run = speed > 6.5, len = run ? 1.55 : 1.05;   // metres per footfall
    if (acc >= len){
      acc -= len;
      const w = (isGunner() ? 0.95 : 0.7) * (run ? 1.15 : 0.8);
      if (!tooSoon('hstep', 0.12)){ floor()(w); gear(w, run); }
    }
  } else if (!rooted || speed < 1.2) acc = Math.min(acc, 0.6);

  // ── nearby foes ──
  let budget = 3;
  for (const e of enemies){
    if (e.dead || !e.group || budget <= 0) continue;
    const q = e.group.position;
    let s = seen.get(e);
    if (!s){ seen.set(e, { x: q.x, z: q.z, acc: rand(0, 1) }); continue; }
    const ex = q.x - s.x, ez = q.z - s.z; s.x = q.x; s.z = q.z;
    const es = Math.hypot(ex, ez);
    if (es > 2 || es / dt < 1.2) continue;
    if (Math.hypot(q.x - p.x, q.z - p.z) > 26) continue;
    s.acc += es;
    const heavy = e.type === 'brute' || e.type === 'phalanx' || (e.t && e.t.scale > 1.2);
    const len = heavy ? 1.7 : 1.35;
    if (s.acc >= len){
      s.acc -= len; budget--;
      if (tooSoon('fstep', 0.05)) continue;
      const w = heavy ? 1.5 : 0.8;
      floor()(w, q);
      if (!/jedi|sith|acolyte|duelist/.test(e.type)) N({ pos: q, color: 'pink', g: 0.012 * w, a: 0.004, d: 0.09, filt: { type: 'bandpass', f: 3800, q: 1.4 } });   // armour plates
    }
  }
}
