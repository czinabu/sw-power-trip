// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A JEDI STORY CHAPTER, shot by shot (its card, then each objective in turn, skipped along), on the BUILT game:
// node tools/shots/jedi-chapter.mjs <out dir> [chapter id: archive]  (CHROME=<path> to use another Chromium)
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
for (const n of [1, 2]){
  await page.evaluate(() => GAME.skipObjective());
  for (let i = 0; i < 6; i++){ await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  for (let i = 0; i < 40 && (await page.evaluate(() => GAME.missionState().i)) < n; i++) await page.waitForTimeout(500);
  for (let i = 0; i < 6; i++){ await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await page.waitForTimeout(4000);
  console.log('objective', await page.evaluate(() => GAME.missionState().i));
  await page.screenshot({ path: out + '/' + ch + '-v' + (2 + n) + '-objective.png' });
}
console.log('errors', errors.slice(0, 10));
await browser.close();
