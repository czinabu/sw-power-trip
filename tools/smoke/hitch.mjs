// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HITCH PROFILE — boots the BUILT game headlessly, starts a fight and plays it (swings, Force moves, the foe swinging
// back), timing every frame. Reports the median, the slow tail and every spike (a frame over SPIKE× the median), with
// what changed on that frame: new shader programs, new geometries or textures, a heap drop (a GC). Software rendering,
// so the numbers are only good for comparing one build against another on the same machine.
//   npm run build && npm run perf:hitch
//   HITCH_CPU (slow the CPU down this many times, e.g. 4: a laptop rather than this machine),
//   HITCH_DRAW=0 (skip the draw: the update's own spikes at a real frame rate), HITCH_QUALITY (low/medium/high, default high),
//   HITCH_FRAMES (frames per run, default 360), HITCH_ONLY (comma list of run names), HITCH_HERO (jedi/mando, default
//   both), SPIKE (default 2.5), PW_CHROMIUM (a Chromium binary, when Playwright's own isn't installed)

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const FRAMES = +(process.env.HITCH_FRAMES || 360);
const SPIKE = +(process.env.SPIKE || 2.5);
const DRAW = process.env.HITCH_DRAW !== '0';
const QUALITY = process.env.HITCH_QUALITY || 'high';
const ONLY = process.env.HITCH_ONLY ? process.env.HITCH_ONLY.split(',') : null;
const HEROES = process.env.HITCH_HERO ? [process.env.HITCH_HERO] : ['jedi', 'mando'];
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }

// each run: [name, code that starts it]. Every run fights a big foe: the mission duels' champions and the bosses
const RUNS = [
  ['forge duel',      `GAME.startMission('forge', 2)`],
  ['forge hold',      `GAME.startMission('forge', 1)`],
  ['sandbox boss',    `GAME.setSandboxMap('graveyard'); GAME.startSandbox(); GAME.spawnBoss()`],
  ['sandbox brutes',  `GAME.setSandboxMap('grassland'); GAME.startSandbox(); for (let i = 0; i < 3; i++) GAME.sandboxSpawn('brute')`],
];
if (process.env.HITCH_CODE) RUNS.push(['custom', process.env.HITCH_CODE]);   // HITCH_CODE: a run of your own (HITCH_ONLY=custom)

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const errors = [];
for (const hero of HEROES) for (const [name, code] of RUNS){
  if (ONLY && !ONLY.some(o => name.includes(o))) continue;
  // a fresh page per run: nothing compiled or built by an earlier run hides this one's first-use cost
  const page = await browser.newPage({ viewport: { width: +(process.env.HITCH_W || 640), height: +(process.env.HITCH_H || 360) } });
  await page.addInitScript(q => {
    try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');
          localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('perf', 'NotSupportedError')); };
  }, QUALITY);
  page.on('pageerror', e => errors.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
  await page.waitForTimeout(8000);   // the title screen's warm-up and the idle-time model builds, as a player gets
  await page.click('#hero-' + hero);
  if (process.env.HITCH_TRACE) await browser.startTracing(page, { path: process.env.HITCH_TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute', 'gpu', 'blink.user_timing', 'disabled-by-default-v8.gc', 'gpu.service', 'viz', 'cc', 'skia', 'benchmark', 'blink', 'disabled-by-default-skia', 'disabled-by-default-v8.cpu_profiler'] });
  let cdp = null;
  // HITCH_CPU=4: a CPU this many times slower (a laptop rather than this machine), from the fight on
  if (+process.env.HITCH_CPU > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: +process.env.HITCH_CPU });
  if (process.env.HITCH_ALLOC){ cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); }
  const r = await page.evaluate(async ({ code, FRAMES, SPIKE, hero, DRAW, HITCH_WHO }) => {
    const { G } = GAME, { renderer } = GAME.gfx, P = GAME.player;
    G.hero = hero;
    new Function('G', code)(G);
    G.mode = 'play'; G.paused = false; G.skillSelect = false;
    // the tick is one requestAnimationFrame callback: its work before the draw is the update. DRAW=0 skips the draw
    // (the update's own spikes at a real frame rate); otherwise the draw is timed, GPU work included
    const gl = renderer.getContext(), comp = GAME.gfx.composer, render = comp.render.bind(comp), raf = window.requestAnimationFrame.bind(window);
    let tStart = 0, upd = 0, draw = 0;
    window.requestAnimationFrame = f => raf(t => { tStart = performance.now(); f(t); });
    comp.render = (...a) => { const t = performance.now(); upd = t - tStart; if (DRAW){ render(...a); gl.finish(); } draw = performance.now() - t; };
    // the GL calls that stall a frame: shader compiles and links, texture and big buffer uploads, each with who asked
    const glog = [];
    const who = () => (new Error().stack.split('\n').slice(3, 9).map(l => l.trim().replace(/^at /, '').replace(/\(.*\//, '(')).join(' < '));
    for (const k of ['linkProgram', 'compileShader', 'texImage2D', 'texImage3D', 'texStorage2D', 'bufferData']){
      const f = gl[k].bind(gl);
      gl[k] = (...a) => { if (k !== 'bufferData' || (a[1] && a[1].byteLength > 65536)) glog.push({ k, n: k === 'texStorage2D' ? a[3] + 'x' + a[4] : a[1] && a[1].byteLength, who: process_who && who() }); return f(...a); };
    }
    var process_who = !!HITCH_WHO;
    // what's drawn for the first time: a new material, a new geometry (its buffers upload on that draw)
    const seenM = new Set(), seenG = new Set(), firsts = [];
    const tag = o => { const n = []; for (let x = o; x && n.length < 4; x = x.parent) if (x.name) n.push(x.name); return (n.join('<') || o.type); };
    const rbd = renderer.renderBufferDirect.bind(renderer);
    const seed = () => GAME.gfx.scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) seenM.add(m.uuid); if (o.geometry) seenG.add(o.geometry.uuid); });
    seed();
    renderer.renderBufferDirect = (cam, sc, geo, mat, obj, grp) => {
      if (!seenM.has(mat.uuid)){ seenM.add(mat.uuid); firsts.push('mat ' + mat.type + (mat.transparent ? '/t' : '') + (mat.blending === 2 ? '/add' : '') + ' ' + tag(obj)); }
      if (!seenG.has(geo.uuid)){ seenG.add(geo.uuid); const v = geo.attributes.position ? geo.attributes.position.count : 0; if (v > 300) firsts.push('geo ' + v + 'v ' + tag(obj)); }
      return rbd(cam, sc, geo, mat, obj, grp);
    };
    const frames = [];
    let last = performance.now(), prev = { prog: renderer.info.programs.length, geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures, heap: performance.memory.usedJSHeapSize };
    for (let i = 0; i < FRAMES + 60; i++){
      if (GAME.cutscene.sceneOn()) GAME.cutscene.skipScene();
      G.mode = 'play'; G.paused = false; G.skillSelect = false;
      P.hp = Math.max(P.hp, 1e3);
      // fight: face the nearest big foe and work it over
      const foes = [GAME.boss, ...GAME.enemies].filter(e => e && !e.dead && e.group);
      const f = foes.sort((a, b) => (b.champion ? 1 : 0) - (a.champion ? 1 : 0))[0];
      const pp = P.group.position, K = GAME.keys, click = (type, button) => document.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
      if (f){
        const dx = f.group.position.x - pp.x, dz = f.group.position.z - pp.z;
        G.yaw = Math.atan2(dx, dz); G.pitch = 0.05;
        K['w'] = Math.hypot(dx, dz) > (hero === 'jedi' ? 2.4 : 9);
        try {
          if (hero === 'jedi'){ if (i % 9 === 0){ click('mousedown', 0); click('mouseup', 0); }
                                if (i % 140 === 70) GAME.forcePush(); if (i % 200 === 130) GAME.forceSlam(); }
          else if (i % 120 < 90) click('mousedown', 0); else click('mouseup', 0);
          // now and then a big foe goes down hard (a finisher), so deaths, severed arms and the champion's fall are in it
          if (i % 150 === 149 || i === FRAMES + 50) GAME.damageEnemy(f.champion || f === GAME.boss ? f : f, 1e5, { x: dx, y: 0, z: dz }, 6, true);
        } catch(e){}
      } else K['w'] = false;
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now();
      const cur = { prog: renderer.info.programs.length, geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures, heap: performance.memory.usedJSHeapSize };
      performance.mark('f' + i);
      if (i >= 30) frames.push({ i, first: firsts.splice(0), gl: glog.splice(0).map(g => g.k + (g.n ? ':' + g.n : '') + (g.who ? ' ' + g.who : '')), ms: now - last, upd: +upd.toFixed(1), draw: +draw.toFixed(1), prog: cur.prog - prev.prog, geo: cur.geo - prev.geo, tex: cur.tex - prev.tex, gc: cur.heap < prev.heap - 2e6,
                                foe: f ? (f.champion ? 'champ' : f === GAME.boss ? 'boss' : f.type || '') : '', foeState: f ? (f.state || f.atk || '') + '' : '' });
      prev = cur; last = now;
    }
    const ms = frames.map(f => DRAW ? f.ms : f.upd).sort((a, b) => a - b), q = p => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
    const med = q(0.5);
    const spikes = frames.filter(f => (DRAW ? f.ms : f.upd) > Math.max(med * SPIKE, DRAW ? 0 : 8)).map(f => ({ ...f, ms: Math.round(f.ms) }));
    // the frame as the player gets it: the gap between two frames, everything that ran in it (timers, idle work, GC) included
    const gap = frames.map(f => f.ms).sort((a, b) => a - b), g = p => +gap[Math.min(gap.length - 1, Math.floor(gap.length * p))].toFixed(1);
    return { med: +med.toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: Math.round(ms[ms.length - 1]),
             gap: { med: g(0.5), p99: g(0.99), max: Math.round(gap[gap.length - 1]), over33: gap.filter(x => x > 33.4).length, over50: gap.filter(x => x > 50).length },
             spikes: spikes.length, newPrograms: frames.reduce((a, f) => a + f.prog, 0), gcs: frames.filter(f => f.gc).length,
             programs: renderer.info.programs.length, glFrames: frames.filter(f => f.gl.length || f.first.length).map(f => ({ i: f.i, ms: Math.round(f.ms), gl: f.gl, first: f.first })), worst: spikes.sort((a, b) => (b.upd + b.draw) - (a.upd + a.draw)).slice(0, 8) };
  }, { code, FRAMES, SPIKE, hero, DRAW, HITCH_WHO: !!process.env.HITCH_WHO });
  if (process.env.HITCH_TRACE) await browser.stopTracing();
  if (cdp){   // HITCH_ALLOC=1: who allocates the garbage (sampled, by function, collected objects included)
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    const by = new Map(), walk = (n, path) => { const f = n.callFrame, k = (f.functionName || '(anon)') + ':' + f.lineNumber + ' < ' + path;
      by.set(k, (by.get(k) || 0) + n.selfSize); for (const c of n.children) walk(c, (f.functionName || '(anon)')); };
    walk(profile.head, '');
    const tot = [...by.values()].reduce((a, b) => a + b, 0);
    console.log('allocated (sampled) MB', (tot / 1e6).toFixed(1));
    for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log('   ', (v / 1e6).toFixed(2), 'MB', k);
  }
  console.log(`${hero} · ${name}`.padEnd(26), JSON.stringify({ ...r, worst: undefined, glFrames: r.glFrames.length }));
  for (const s of r.worst) console.log('    spike', JSON.stringify({ ...s, gl: undefined }));
  for (const g of r.glFrames) console.log('    gl', g.i, g.ms + 'ms', [...g.gl, ...g.first].join('\n         '));
  await page.close();
}
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close();
