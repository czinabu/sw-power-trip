// the trooper on the title screen's turntable, for a look at the model (testing only): node tools/shots/trooper-shot.mjs [out-dir]
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || root;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.addInitScript(() => { try { localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'high'); } catch(e){} });
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href + '?trooper');
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.click('#hero-trooper');
await page.waitForTimeout(4000);
// hide the menu panel so the stand shows clear
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.style.visibility = 'hidden'; });
for (let i = 0; i < (+process.env.FRAMES || 6); i++){ await page.waitForTimeout(i ? 1800 : 300); await page.screenshot({ timeout: 180000, path: path.join(out, `trooper-stand-${i}.png`), clip: { x: 760, y: 40, width: 340, height: 520 } }); }
await browser.close();
