// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A JEDI STORY CHAPTER, shot by shot (its card, then each objective in turn, skipped along), on the BUILT game:
// node tools/shots/jedi-chapter.mjs <out dir> [chapter id: archive] [objectives to skip through: 2]  (CHROME=<path> to use another Chromium)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out = process.argv[2], ch = process.argv[3] || 'archive';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => { try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('x', 'NotSupportedError')); }; });
await page.goto(pathToFileURL(root + '/dist/index.html').href);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
await page.click('#hero-jedi'); await page.click('#mode-campaign');
for (let i = 0; i < 8 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
  if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(800);
}
await page.waitForSelector('#chapcard.open', { timeout: 30000 });
// on to the archive chapter
await page.evaluate((ch) => { document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; GAME.startChapter(GAME.chapters().findIndex(c => c.id === ch)); }, ch);
await page.waitForTimeout(3000);
await page.screenshot({ path: out + '/' + ch + '-v1-card.png' });
await page.click('#chapcard [data-go="1"]');
for (let i = 0; i < 16; i++){ await page.keyboard.press(i % 2 ? 'Enter' : 'Escape'); await page.waitForTimeout(500); }
await page.waitForTimeout(9000);
await page.screenshot({ path: out + '/' + ch + '-v2-play.png' });
const st = await page.evaluate(() => { const m = GAME.missionState && GAME.missionState(); return m ? { id: m.def && m.def.id, i: m.i } : null; });
console.log('mission', JSON.stringify(st));
const t0 = await page.evaluate(() => GAME.G.gt); await page.waitForTimeout(3000); console.log('game seconds per 3 s', (await page.evaluate(() => GAME.G.gt)) - t0);
for (let n = 1; n <= (+process.argv[4] || 2); n++){
  await page.evaluate(() => GAME.skipObjective());
  for (let i = 0; i < 6; i++){ await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  for (let i = 0; i < 120 && (await page.evaluate(() => GAME.missionState().i)) < n; i++) await page.waitForTimeout(500);
  // (no pointer lock in a headless browser: Escape toggles the pause screen, so lift it directly and let the sim run)
  for (let i = 0; i < 8; i++){ await page.evaluate(() => { if (GAME.G.paused){ document.getElementById('overlay').style.display = 'none'; GAME.G.paused = false; } }); await page.waitForTimeout(500); }
  console.log('objective', await page.evaluate(() => JSON.stringify({ i: GAME.missionState().i, mode: GAME.G.mode, paused: GAME.G.paused, cut: !!GAME.G.cutscene, card: GAME.G.cardUp, sk: GAME.G.skillSelect })));
  await page.screenshot({ path: out + '/' + ch + '-v' + (2 + n) + '-objective.png' });
}
console.log('errors', errors.slice(0, 10));
await browser.close();
