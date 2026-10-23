// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BATTLE MAP SMOKE TEST — boots the BUILT game (dist/index.html) headlessly and plays a short fight on every battle map
// (data/battlemaps.js): each one in the sandbox (picked from its panel's ARENA row, foes called in), and one in survival
// (the rotation moved on to it). Fails on any page or console error, a fight that never starts, or a hero who can leave
// the map. It also prints what each map costs (draw calls, triangles, solids, a flow-field refresh) so a change that
// makes them heavier shows up here.
//   npm run build && npm run smoke:maps          (SMOKE_SECONDS=… sets the game time per run, default 10)

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const GAME_SECONDS = +(process.env.SMOKE_SECONDS || 10);
const REAL_LIMIT_MS = 120000;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;

// [hero, mode, map]; the survival run starts its rotation on the map's slot
const RUNS = [['jedi', 'sandbox', 'grassland'], ['mando', 'sandbox', 'icefront'], ['jedi', 'sandbox', 'graveyard'], ['mando', 'endless', 'graveyard']];
for (const [hero, mode, map] of RUNS){
  const label = `${hero} ${mode === 'endless' ? 'survival' : mode} ${map}`;
  const errors = [], log = [];
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await page.addInitScript(() => {
    try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');   // sandbox + survival unlocked
          localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { log.push(m.type() + ': ' + m.text()); if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const t0 = Date.now();
  let result;
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.click('#hero-' + hero);
    await page.click('#mode-' + mode);
    const tap = async sel => { if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {}); };
    let started = false;
    for (let i = 0; i < 6 && !started; i++){
      await tap('#goText'); await tap('#trainNo');
      started = await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 4000 }).then(() => true, () => false);
    }
    if (!started) throw new Error('never left the menu\n' + log.slice(-10).join('\n'));
    if (mode === 'sandbox'){
      // pick the map from the panel's ARENA row, then call in a mixed squad of foes
      await page.keyboard.press('b');
      await page.click(`[data-map="${map}"]`);
      await page.click('[data-n="5"]'); await page.click('[data-foe="grunt"]'); await page.click('[data-foe="blaster"]');
      await page.click('[data-n="3"]'); await page.click('[data-foe="duelist"]'); await page.click('[data-foe="flyer"]');
      await page.click('#sbdone');
    } else {
      // survival: jump the rotation to this map (the next wave builds it) and start that wave now
      await page.evaluate(id => {
        const { G, enemies } = GAME, idx = GAME.ENDLESS_ARENAS.findIndex(L => L.layout === id);
        for (const e of enemies) e.hp = 0;
        G.spawnQueue.length = 0; G.endlessWave = 5; G.arenaRot = idx - 1;
        GAME.startEndlessWave();
      }, map);
    }
    const layout = await page.evaluate(() => GAME.G.mode === 'play' && GAME.arena().layout);
    if (layout !== map) throw new Error(`the arena is ${layout}, not ${map}`);
    await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const startGt = await page.evaluate(() => GAME.G.gt);
    await page.keyboard.down('w');
    let everHit = false, outside = null;
    for (let step = 0; ; step++){
      const s = await page.evaluate(() => {
        const { G, player, enemies } = GAME;
        player.hp = Math.max(player.hp, 1e3);
        if (G.skillSelect){ const b = document.getElementById('continueBtn'); if (b) b.click(); }
        const p = player.group.position, A = GAME.arena();
        let best = null, bd = 1e9;
        for (const e of enemies){ if (e.dead) continue; const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z); if (d < bd){ bd = d; best = e; } }
        if (best) G.yaw = Math.atan2(best.group.position.x - p.x, best.group.position.z - p.z);
        const off = Math.abs(p.x) > A.half + 0.5 || Math.abs(p.z) > A.halfZ + 0.5;
        return { gt: G.gt, mode: G.mode, near: bd, off: off && [p.x, p.z].map(v => +v.toFixed(1)),
                 hit: (G.stats && G.stats.kills) > 0 || enemies.some(e => e.maxHp && e.hp < e.maxHp) };
      });
      everHit = everHit || s.hit; if (s.off) outside = s.off;
      if (s.gt - startGt >= GAME_SECONDS || s.mode !== 'play' || Date.now() - t0 > REAL_LIMIT_MS) break;
      await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
      if (step % 4 === 0) await page.keyboard.press(step % 8 ? 'Space' : 'Shift');
      if (s.near < 2.5){ await page.keyboard.up('w'); await page.keyboard.down('s'); await page.waitForTimeout(150); await page.keyboard.up('s'); await page.keyboard.down('w'); }
      await page.waitForTimeout(120);
    }
    await page.keyboard.up('w');
    result = await page.evaluate(start => {
      const { G, enemies } = GAME, A = GAME.arena();
      // what this map costs: one flow-field refresh for each body size, timed over a few runs
      const t = performance.now();
      for (let i = 0; i < 8; i++){ GAME.nav.NAV.t = 0; GAME.nav.updateNav(0.016, GAME.player.group.position); }
      const navMs = +((performance.now() - t) / 8).toFixed(2);
      return { gameSeconds: +(G.gt - start).toFixed(1), frames: window.__frames, mode: G.mode, enemies: enemies.length,
               kills: (G.stats && G.stats.kills) || 0, calls: A.calls, tris: A.tris, solids: A.solids, navMs };
    }, startGt);
    result.everHit = everHit;
    if (outside) result.outside = outside;
  } catch (e){ errors.push('script: ' + e.message); }
  await page.screenshot({ path: path.join(root, `smoke-maps-${hero}-${map}.png`) }).catch(() => {});
  await page.close();

  const seen = new Map();
  for (const e of errors) seen.set(e, (seen.get(e) || 0) + 1);
  const problems = [...seen].map(([e, n]) => n > 1 ? `${e}\n(×${n})` : e);
  if (result){
    if (result.frames < 20) problems.push(`only ${result.frames} frames rendered`);
    if (result.gameSeconds < GAME_SECONDS * 0.5) problems.push(`game only advanced ${result.gameSeconds}s`);
    if (result.mode !== 'play') problems.push(`left play mode (mode: ${result.mode})`);
    if (!result.enemies && !result.kills) problems.push('no enemies ever spawned');
    if (!result.everHit) problems.push('the hero never hit anything');
    if (result.outside) problems.push('the hero got outside the arena at ' + result.outside);
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${label.padEnd(26)} ${JSON.stringify(result || {})} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  for (const p of problems) console.log('     ' + p.split('\n').slice(0, 20).join('\n     '));
  if (problems.length) failed = true;
}
await browser.close();
process.exit(failed ? 1 : 0);
