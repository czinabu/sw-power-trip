// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TRAINING SMOKE TEST — boots the BUILT game (dist/index.html) and walks the training grounds for each hero:
//   · a fresh profile: training skips Before the Fight and opens straight on the first basic
//     lesson, and skipping through it lands on the lesson board, where every form and gear lesson is still sealed;
//   · a beaten campaign: the board opens every lesson, and a few of them run through to the end (each step set up:
//     its foes, its loadout, its gear) and back to the board.
// Fails on any page error or console error, or a board or a Before the Fight page that shows what it shouldn't.
//   npm run build && npm run smoke:training

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };

// [hero, beaten campaign?, lessons to run through]
const RUNS = [['jedi', false, []], ['jedi', true, ['formv', 'niman', 'formvii']], ['mando', false, []], ['mando', true, ['dual', 'signature']]];
for (const [hero, full, lessons] of RUNS){
  const label = hero + (full ? ' (story done)' : ' (fresh)');
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(([full, hero]) => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0');
      if (full){ localStorage.setItem('sw_camp_' + hero, '1'); localStorage.setItem('sw_trained_' + hero, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, [full, hero]);
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const boardUp = () => page.evaluate(() => document.getElementById('lessonboard').classList.contains('open'));
  // skip steps until the lesson ends and the board comes back (the game's own timers run between steps)
  const runOut = async (limit = 120000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < limit){
      if (await boardUp()) return true;
      await page.evaluate(() => { GAME.player.hp = Math.max(GAME.player.hp, 1e3); GAME.skipStep(); });
      await page.waitForTimeout(250);
    }
    return false;
  };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.click('#hero-' + hero);
    await page.click('#mode-training');
    await page.click('#goText');
    // training never opens Before the Fight: its lessons pick the form between lessons
    check(!(await page.evaluate(() => document.getElementById('forms').classList.contains('open'))), `${label}: training skips Before the Fight`);
    await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.training, null, { timeout: 20000 });
    if (!full){
      // the lesson board opens before the first lesson; pick the first basic from it
      await page.waitForFunction(() => document.getElementById('lessonboard').classList.contains('open'), null, { timeout: 60000 });
      await page.click('#lessonboard [data-go]');
      await page.waitForFunction(() => GAME.trainingProgress().total > 0, null, { timeout: 60000 });
      const first = await page.evaluate(() => GAME.trainingProgress().name);
      check(first === (hero === 'jedi' ? 'FIRST STEPS' : 'THE YARD'), `${label}: a first visit opens the board, and its first card is the first basic lesson (${first})`);
      if (hero === 'jedi'){
        const forms = await page.evaluate(() => ({ loadout: GAME.G.loadout.filter(Boolean), known: Object.keys(GAME.G.stanceUnlocked).filter(k => GAME.G.stanceUnlocked[k]) }));
        check(forms.loadout.join() === 'shiicho' && !forms.known.some(k => k !== 'shiicho'), `${label}: trains in Shii-Cho alone (${forms.loadout.join()})`);
      }
      check(await runOut(), `${label}: the lesson runs through to the board`);
    } else {
      await page.waitForFunction(() => document.getElementById('lessonboard').classList.contains('open'), null, { timeout: 60000 });
    }
    const board = await page.evaluate(() => ({ sealed: document.querySelectorAll('#lessonboard .lb-card.sealed').length, open: [...document.querySelectorAll('#lessonboard [data-lesson]')].map(e => e.dataset.lesson),
      text: document.getElementById('lessonboard').textContent }));
    if (!full){
      const leak = ['SORESU', 'ATARU', 'DJEM SO', 'SHIEN', 'MAKASHI', 'NIMAN', 'JUYO', 'VAAPAD', 'DARKSABER', 'DISRUPTOR', 'FLAMETHROWER'].filter(w => board.text.includes(w));
      check(board.sealed > 0 && !leak.length, `${label}: the board seals what the story hasn't taught (${board.sealed} sealed${leak.length ? ', names ' + leak.join(', ') : ''})`);
    } else check(board.sealed === 0, `${label}: a beaten campaign opens every lesson (${board.open.length})`);
    for (const id of lessons){
      await page.click(`#lessonboard [data-lesson="${id}"]`);
      await page.waitForFunction(() => GAME.trainingProgress().total > 0, null, { timeout: 30000 });
      const name = await page.evaluate(() => GAME.trainingProgress().name);
      check(await runOut(), `${label}: ${name} runs through to the board`);
    }
    check(!errors.length, `${label}: no errors` + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
  } catch(e){
    check(false, `${label}: ${e.message.split('\n')[0]}` + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
