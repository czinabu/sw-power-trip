// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE JEDI'S STORY, SHOT BY SHOT: the chapter card with its scene, each of the story's choices and the epilogue, on the
// BUILT game (npm run build first). node tools/shots/jedi-story.mjs <out dir>  (CHROME=<path> to use another Chromium)
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out = process.argv[2];
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
await page.waitForTimeout(3500);
await page.screenshot({ path: out + '/1-siege-card.png' });
const pos = (id) => page.evaluate((id) => GAME.chapters().findIndex(c => c.id === id), id);
// the archive is cleared: the Ledger choice
await page.evaluate((p) => { document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; GAME.G.chapter = p; GAME.nextChapter(); }, await pos('archive'));
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '/2-ledger-choice.png' });
await page.click('#chapcard [data-go="burned"]');
await page.waitForTimeout(3500);
console.log('story', JSON.stringify(await page.evaluate(() => GAME.G.story)), 'chapter', await page.evaluate(() => GAME.chapters()[GAME.G.chapter].id));
await page.screenshot({ path: out + '/3-refuge-card-burned.png' });
// Ilsa
await page.evaluate((p) => { document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; GAME.G.chapter = p; GAME.nextChapter(); }, await pos('chase'));
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '/4-ilsa-choice.png' });
await page.click('#chapcard [data-go="spared"]');
await page.waitForTimeout(3500);
await page.screenshot({ path: out + '/5-spearhead-card-spared.png' });
// the Form VII pick that follows the chase
await page.evaluate(() => { document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; });
for (let i = 0; i < 20 && !(await page.isVisible('#meditate [data-fork]')); i++) await page.waitForTimeout(500);
if (await page.isVisible('#meditate [data-fork]')){ await page.screenshot({ path: out + '/5b-form-vii.png' }); await page.click('#meditate [data-fork="vaapad"]'); await page.waitForTimeout(800); }
for (let i = 0; i < 6 && (await page.isVisible('#meditate.open')); i++){ await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
// the end
await page.evaluate((p) => { for (const id of ['chapcard', 'meditate']) document.getElementById(id).classList.remove('open'); GAME.G.cardUp = false; GAME.G.chapter = p; GAME.campaignWon(() => { window.__won = true; }); }, await pos('exegol'));
await page.waitForTimeout(2500);
await page.screenshot({ path: out + '/6-vexis-choice.png' });
await page.click('#chapcard [data-go="vael"]');
const epilogueUp = () => page.evaluate(() => /EPILOGUE/.test(document.querySelector('#chapcard.open .cc-act')?.textContent || ''));
for (let i = 0; i < 40 && !(await epilogueUp()); i++){
  if (await page.isVisible('#meditate [data-fork]')) await page.click('#meditate [data-fork="vaapad"]').catch(() => {});
  else if (i % 4 === 3) await page.keyboard.press('Escape');   // (skips the epilogue scene, never the card)
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: out + '/7-epilogue.png' });
console.log('story', JSON.stringify(await page.evaluate(() => GAME.G.story)));
console.log('won', await page.evaluate(() => window.__won), 'card', await page.evaluate(() => document.querySelector('#chapcard.open .cc-act')?.textContent));
console.log('errors', errors.slice(0, 10));
await browser.close();
