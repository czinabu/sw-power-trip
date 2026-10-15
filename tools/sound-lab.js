// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Sound lab (dev only: `npm run dev`, then open /tools/sound-lab.html).
// Auditions every sound in the bank S, the continuous loops (saber hums, jetpack, flamethrower), each world's
// ambience and score at every intensity, and the music stings, through the same engine the game uses. Edit a recipe
// in src/audio/sfx.js and Vite reloads the page.

import { audioInit, S, setMusicVol, setSfxVol, setMasterVol } from '../src/audio/sfx.js';
import { MUSIC } from '../src/audio/music.js';
import { AE } from '../src/audio/engine.js';
import { updateAudio, thunder } from '../src/audio/director.js';
import { shared, G, player } from '../src/state.js';
import { camera } from '../src/engine/renderer.js';
import { V3 } from '../src/utils.js';

// a listener at the origin looking down -Z, so positioned sounds pan left/right as labelled
camera.position.set(0, 2, 6); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
G.mode = 'menu'; G.hero = 'none';
let side = 0;   // -1 left, 0 centre, 1 right
const here = () => side ? V3(side * 6, 1.4, -2) : undefined;

const ui = document.getElementById('ui');
function section(title){ const h = document.createElement('h2'); h.textContent = title; ui.appendChild(h); const r = document.createElement('div'); r.className = 'row'; ui.appendChild(r); return r; }
function btn(row, label, fn, group){
  const b = document.createElement('button'); b.textContent = label;
  b.onclick = () => { audioInit(); fn(b); if (group){ for (const o of row.querySelectorAll('button')) o.classList.toggle('on', o === b); } };
  row.appendChild(b); return b;
}
function toggle(row, label, fn){ const b = btn(row, label, () => { b.classList.toggle('on'); fn(b.classList.contains('on')); }); return b; }

// ── world + music ──
const world = section('World (ambience, reverb room, score palette)');
for (const [k, n] of [['menu', 'Menu'], ['temple', 'Jedha'], ['foundry', 'Mustafar'], ['plains', 'Exegol']])
  btn(world, n, () => { if (k === 'menu') G.mode = 'menu'; else { G.mode = 'play'; shared.arenaLayout = k; } }, true);
const mus = section('Score intensity');
for (const s of ['menu', 'lull', 'combat', 'heavy', 'boss']) btn(mus, s, () => MUSIC.setState(s), true);
const st = section('Stings');
for (const [n, f] of [['wave start', 'waveSting'], ['area cleared', 'clearSting'], ['unlock', 'unlockSting'], ['boss rises', 'bossSting'], ['victory', 'victorySting'], ['death', 'deathSting']])
  btn(st, n, () => MUSIC[f]());
btn(st, 'thunder', () => thunder());

// ── loops ──
const lp = section('Loops (need a world other than Menu)');
let swingT = 0;
for (const f of ['fast', 'medium', 'strong']) btn(lp, 'saber hum: ' + f, () => { G.hero = 'jedi'; G.stance = f; }, true);
btn(lp, 'darksaber hum', () => { G.hero = 'mando'; player.weapon = 'darksaber'; }, true);
btn(lp, 'no hum', () => { G.hero = 'none'; player.weapon = 'single'; }, true);
const lp2 = section('');
btn(lp2, 'swing the blade', () => { swingT = 0.35; S.swing(G.hero === 'mando' ? 'dark' : G.stance); });
toggle(lp2, 'jetpack', on => { G.hero = 'mando'; player.jetActive = on; });
toggle(lp2, 'boost', on => { G.hero = 'mando'; player.boosting = on; });
toggle(lp2, 'flamethrower', on => { G.hero = 'mando'; player.flaming = on; });
toggle(lp2, 'low health', on => { player.hp = on ? 12 : 100; });
toggle(lp2, 'paused (muffle)', on => { G.paused = on; });

// ── one-shots ──
const pos = section('Play one-shots from');
for (const [n, v] of [['left', -1], ['centre', 0], ['right', 1]]) btn(pos, n, () => { side = v; }, true);
const groups = {
  'Lightsaber': [['swing fast', () => S.swing('fast')], ['swing medium', () => S.swing('medium')], ['swing strong', () => S.swing('strong')], ['swing darksaber', () => S.swing('dark')],
                 ['saber hit', () => S.saberHit(here(), 1)], ['saber hit heavy', () => S.saberHit(here(), 1.7)], ['clash', () => S.clash(here())], ['big clash', () => S.clash(here(), true)],
                 ['deflect', () => S.deflect(here())], ['block', () => S.block(here())], ['parry', () => S.parry(here())], ['riposte', () => S.riposte()], ['heavy', () => S.heavy(here())]],
  'Blasters': [['blaster', () => S.blaster()], ['dual blasters', () => S.blasterDual()], ['disruptor', () => S.disruptor()], ['enemy shot', () => S.enemyShot(here())], ['enemy heavy shot', () => S.enemyShot(here(), true)],
               ['near miss', () => S.whiz(here())], ['bolt hits wall', () => S.boltImpact(here())], ['bolt hits foe', () => S.blastHit(here(), 1)], ['shield catch', () => S.shieldHit(here())]],
  'The Force': [['push', () => S.push()], ['pull', () => S.pull()], ['slam', () => S.slam(here())], ['barrier', () => S.barrier()], ['lightning', () => S.zap(here())], ['judgement arc', () => S.arc(here())], ['stun', () => S.stun(here())]],
  'Bodies': [['punch', () => S.punch(here(), 1)], ['kill', () => S.kill(here())], ['kill (heavy)', () => S.kill(here(), true)], ['hurt', () => S.hurt()],
             ['jump', () => S.jump()], ['dash', () => S.dash()], ['land soft', () => S.land(0.1)], ['land hard', () => S.land(1)]],
  'Enemies': [['windup', () => S.windup(here())], ['windup (brute)', () => S.windup(here(), true)], ['weapon whoosh', () => S.whoosh(here())], ['roar', () => S.roar(here())]],
  'Explosives': [['small boom', () => S.boom(here(), 0.4)], ['boom', () => S.boom(here(), 1)], ['big boom', () => S.boom(here(), 1.8)], ['rocket', () => S.rocket(here())], ['jet ignite', () => S.jetIgnite()]],
  'Interface': [['hover', () => S.uiHover()], ['click', () => S.uiClick()], ['deny', () => S.uiDeny()], ['run start', () => S.uiStart()], ['reward', () => S.reward(0)], ['upgrade', () => S.reward(1)], ['legendary', () => S.reward(2)]],
};
for (const g in groups){ const r = section(g); for (const [n, f] of groups[g]) btn(r, n, f); }

// ── volume ──
const vol = section('Volume');
for (const [n, set, v] of [['master', setMasterVol, shared.masterVol], ['music', setMusicVol, AE.vol.music], ['effects', setSfxVol, AE.vol.sfx]]){
  const l = document.createElement('label'); l.textContent = n;
  const i = document.createElement('input'); i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = v;
  i.oninput = () => { audioInit(); set(+i.value); }; l.appendChild(i); vol.appendChild(l);
}

// drive the director like the main loop does
let last = performance.now();
const stateEl = document.getElementById('state');
(function tick(now){
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (swingT > 0){ swingT -= dt; player.atkT = swingT; } else player.atkT = 0;
  G.gt += dt;
  updateAudio(dt);
  if (AE.ready){ const m = MUSIC.debug(); stateEl.textContent = `score ${m.palette} · ${m.state} · intensity ${m.intensity}\nvoices ${AE.live}`; }
})(last);
