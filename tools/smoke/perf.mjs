// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PERFORMANCE PROFILE — boots the BUILT game headlessly and, for every world the game builds (the campaign levels, the
// story missions, the battle maps, the training room), times the arena build and a few seconds of play, split into the
// game's own update and the draw (and the draw by pass, shadow map included), with draw calls and triangles. Software rendering, so the
// draw numbers are only good for comparing one build against another on the same machine.
//   npm run build && npm run perf
//   PERF_FRAMES (frames timed per world, default 90), PERF_ONLY (comma list: only runs whose name has one), PERF_QUALITY
//   (low/medium/high, default high), PERF_W / PERF_H (viewport, default 640×360), PERF_SETTLE (ms on the title screen, 8000),
//   PW_CHROMIUM (a Chromium binary, when Playwright's own isn't installed)

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const FRAMES = +(process.env.PERF_FRAMES || 90);
const ONLY = process.env.PERF_ONLY ? process.env.PERF_ONLY.split(',') : null;
const W = +(process.env.PERF_W || 640), H = +(process.env.PERF_H || 360);
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(q => {
  try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');
        localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('perf', 'NotSupportedError')); };
}, process.env.PERF_QUALITY || 'high');
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const tBoot = Date.now();
await page.goto(page_url);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
const boot = await page.evaluate(() => ({ dcl: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd | 0 }));
console.log(`boot: ${Date.now() - tBoot} ms to GAME (DOMContentLoaded ${boot.dcl} ms)`);
// sit on the title screen a while, as a player does: its warm-up and the idle-time model builds finish there
await page.waitForTimeout(+(process.env.PERF_SETTLE ?? 8000));
await page.click('#hero-jedi');

// timing hooks: the composer's render (the draw) and the shadow pass inside it
await page.evaluate(() => {
  const { renderer, composer } = GAME.gfx;
  const P = window.__perf = { draw: [], update: [], frame: [], on: false, calls: 0, tris: 0, shadow: 0, n: 0 };
  const gl = renderer.getContext();
  renderer.info.autoReset = false;
  // the game's tick is one requestAnimationFrame callback: everything it does before the draw is the update
  let tStart = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = f => raf(t => { tStart = performance.now(); f(t); });
  // per pass (and the sun's shadow map inside the scene pass), GPU work included
  P.pass = {};
  const timed = (name, obj, key) => { const f = obj[key].bind(obj); obj[key] = (...a) => {
    if (!P.on) return f(...a);
    gl.finish(); const t = performance.now(); const v = f(...a); gl.finish(); P.pass[name] = (P.pass[name] || 0) + performance.now() - t; return v; }; };
  composer.passes.forEach((ps, i) => timed(ps.constructor.name + i, ps, 'render'));
  timed('shadowmap', renderer.shadowMap, 'render');
  const r = composer.render.bind(composer);
  composer.render = (...a) => {
    const t = performance.now();
    renderer.info.reset();
        r(...a); gl.finish();   // finish: count the GPU's work as part of the draw (software rendering: it's CPU time)
    if (P.on){ P.update.push(t - tStart); P.draw.push(performance.now() - t); P.calls += renderer.info.render.calls; P.tris += renderer.info.render.triangles; P.n++; }
  };
});

const RUNS = [
  ['campaign 1 jedha', 'G.hero="jedi"; GAME.startLevel(0)'],
  ['campaign 2 mustafar', 'GAME.startLevel(1)'],
  ['campaign 3 exegol', 'GAME.startLevel(2)'],
  ...['refuge', 'strike', 'pursuit', 'icefront', 'graveyard', 'grassland'].map(id => ['mission ' + id, `GAME.startMission('${id}')`]),
  ...['grassland', 'icefront', 'graveyard'].map(id => ['sandbox ' + id, `GAME.setSandboxMap('${id}'); GAME.startSandbox()`]),
  ['training room', `GAME.setSandboxMap('room'); GAME.startSandbox()`],
];
const rows = [];
for (const [label, code] of RUNS){
  if (ONLY && !ONLY.some(o => label.includes(o))) continue;
  const r = await page.evaluate(async ({ code, FRAMES }) => {
    const { G } = GAME, { renderer } = GAME.gfx, P = window.__perf;
    const t0 = performance.now();
    new Function('G', code)(G);
    const build = performance.now() - t0;
    G.mode = 'play'; G.paused = false; G.skillSelect = false;
    // the first frames compile shaders: time them apart
    const firstT = performance.now();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const first = performance.now() - firstT;
    for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r));
    P.draw.length = 0; P.update.length = 0; P.pass = {}; P.calls = P.tris = P.n = 0; P.on = true;
    while (P.draw.length < FRAMES){
      GAME.player.hp = Math.max(GAME.player.hp, 1e3);
      await new Promise(r => requestAnimationFrame(r));
    }
    P.on = false;
    const calls = P.calls, tris = P.tris, n = P.n;
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const A = GAME.arena();
    const pass = Object.fromEntries(Object.entries(P.pass).map(([k, v]) => [k.replace(/Pass/, ''), +(v / n).toFixed(1)]));
    return { pass, build: Math.round(build), first: Math.round(first), update: +avg(P.update).toFixed(2), updateMed: +med(P.update).toFixed(2),
             draw: +avg(P.draw).toFixed(1), drawMed: +med(P.draw).toFixed(1),
             calls: Math.round(calls / n), tris: Math.round(tris / n), programs: renderer.info.programs.length,
             geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, arenaCalls: A.calls, arenaTris: A.tris, layout: A.layout };
  }, { code, FRAMES });
  rows.push([label, r]);
  console.log(label.padEnd(22), JSON.stringify(r));
}
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close();
