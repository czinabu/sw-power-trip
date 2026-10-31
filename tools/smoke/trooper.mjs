// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TROOPER SMOKE — the clone ARC trooper is in testing (its hero card shows only with ?trooper in the URL). This boots
// the BUILT game with ?trooper, picks the trooper, and plays it for a short fight in each mode it can reach: the
// campaign, survival, a story mission with the strike team, the sandbox and the training grounds. Fails on any page or
// console error, or a fight where the trooper never hits anything. SHOTS=1 saves a screenshot of each run.
//   npm run build && npm run smoke:trooper            (SMOKE_SECONDS=… sets the game time per run, default 16)

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?trooper';
const GAME_SECONDS = +(process.env.SMOKE_SECONDS || 16);
const SHOTS = !!process.env.SHOTS;
const MOVES = ['g', 'q', 'shift', ' ', '2', 'Right', 'v', 'e', 'f', 'r', '1', 'z', 'c', 'h', '3', 'Right', 'x', 'g', '1'];   // Right = a right click (aim / the left pistol)
// every run hands the trooper all of its powers (data/trooper-progression.js) so each is cast: the campaign run takes
// the breach charge on F, the rest the ion grenade
const RUNS = (process.env.RUNS || 'campaign,endless,mission:strike,sandbox,training').split(',');

if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;

for (const run of RUNS){
  const [mode, mission] = run.split(':');
  const errors = [], log = [];
  const page = await browser.newPage({ viewport: SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 } });
  await page.addInitScript(([mission]) => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0');
      for (const h of ['jedi', 'mando', 'trooper']) localStorage.setItem('sw_camp_' + h, '1');   // survival and the sandbox open after the campaign
      if (mission) localStorage.setItem('sw_mission_' + mission + '_trooper', '1');
      localStorage.setItem('sw_asktrain', '1');
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, [mission || '']);
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { log.push(m.type() + ': ' + m.text()); if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const t0 = Date.now();
  let result;
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.click('#hero-trooper');
    if (await page.evaluate(() => GAME.G.hero) !== 'trooper') throw new Error('the trooper card did not pick the trooper');
    if (mode === 'mission'){ await page.click('#mode-mission'); await page.click('#msn-' + mission); }
    else await page.click('#mode-' + mode);
    const tap = async sel => { if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {}); };
    let started = false;
    for (let i = 0; i < 6 && !started; i++){
      await tap('#goText'); await tap('#trainNo');
      started = await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 3000 }).then(() => true, () => false);
    }
    if (!started) throw new Error('never left the menu\n' + log.slice(-10).join('\n'));
    if (mode === 'sandbox'){
      await page.keyboard.press('b');
      await page.click('[data-n="3"]').catch(() => {}); await page.click('[data-foe="grunt"]').catch(() => {});
      await page.click('#sbsquadadd').catch(() => {});
      await page.click('#sbdone').catch(() => {});
    }
    await page.evaluate(breach => { const { G } = GAME;
      for (const k of ['scan', 'bshield', 'medic', 'artillery', 'launcher', 'strafe', breach ? 'breach' : 'ion']) G.unlocked[k] = true;
    }, mode === 'campaign');
    await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const startGt = await page.evaluate(() => GAME.G.gt);
    await page.keyboard.down('w');
    let step = 0, everHit = false, shot = false;
    for (;;){
      const s = await page.evaluate(() => {
        const { G, player, enemies } = GAME;
        player.hp = Math.max(player.hp, 1e3); player.force = 100;
        const card = document.querySelector('#chapcard.open [data-go]'); if (card) card.click();
        if (G.cutscene) GAME.cutscene.skipScene();
        if (G.skillSelect){ const b = document.getElementById('continueBtn'); if (b) b.click(); }
        if (G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
        const p = player.group.position;
        let best = null, bd = 1e9;
        for (const e of enemies){ if (e.dead || e.converted) continue; const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z); if (d < bd){ bd = d; best = e; } }
        if (best) G.yaw = Math.atan2(best.group.position.x - p.x, best.group.position.z - p.z);
        G.pitch = 0.12;
        return { gt: G.gt, mode: G.mode, near: bd, hero: G.hero, weapon: player.weapon,
                 hit: (G.stats && G.stats.kills) > 0 || enemies.some(e => e.maxHp && e.hp < e.maxHp) };
      });
      everHit = everHit || s.hit;
      if (s.hero !== 'trooper') throw new Error('the hero changed to ' + s.hero);
      if (SHOTS && !shot && s.gt - startGt > GAME_SECONDS * 0.5){ shot = true; await page.screenshot({ path: path.join(root, `trooper-${run.replace(':', '-')}.png`) }); }
      if (s.gt - startGt >= GAME_SECONDS || s.mode !== 'play' || Date.now() - t0 > 150000) break;
      await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
      if (step % 3 === 0){
        const k = MOVES[(step / 3) % MOVES.length];
        if (k === 'Right'){ await page.mouse.down({ button: 'right' }); await page.waitForTimeout(80); await page.mouse.up({ button: 'right' }); }
        else await page.keyboard.press(k === ' ' ? 'Space' : k === 'shift' ? 'Shift' : k);
      }
      if (s.near < 2.5){ await page.keyboard.up('w'); await page.keyboard.down('s'); await page.waitForTimeout(150); await page.keyboard.up('s'); await page.keyboard.down('w'); }
      step++;
      await page.waitForTimeout(120);
    }
    await page.keyboard.up('w');
    result = await page.evaluate(start => ({ gameSeconds: +(GAME.G.gt - start).toFixed(1), frames: window.__frames, mode: GAME.G.mode,
      enemies: GAME.enemies.length, kills: (GAME.G.stats && GAME.G.stats.kills) || 0, squad: GAME.squad.allies.length, weapon: GAME.player.weapon,
      jet: !!GAME.player.jetActive }), startGt);
    result.everHit = everHit;
  } catch (e){ errors.push('script: ' + e.message); }
  await page.close();
  const seen = new Map();
  for (const e of errors) seen.set(e, (seen.get(e) || 0) + 1);
  const problems = [...seen].map(([e, n]) => n > 1 ? `${e}\n(×${n})` : e);
  if (result){
    if (result.frames < 30) problems.push(`only ${result.frames} frames rendered`);
    if (result.mode !== 'play' && result.mode !== 'victory') problems.push(`left play mode (mode: ${result.mode})`);
    if (mode !== 'training' && !result.everHit) problems.push('the trooper never hit anything');
    if (result.jet) problems.push('the trooper flew on a jetpack');
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${run.padEnd(16)} ${JSON.stringify(result || {})} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  for (const p of problems) console.log('     ' + p.split('\n').slice(0, 20).join('\n     '));
  if (problems.length) failed = true;
}
await browser.close();
process.exit(failed ? 1 : 0);
