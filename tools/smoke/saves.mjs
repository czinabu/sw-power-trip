// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SAVE / LOAD SMOKE — boots the BUILT game, plays into the campaign's second level with an upgraded build, saves it
// to a slot from the pause screen, starts over with NEW GAME, then loads the slot back and checks CONTINUE CAMPAIGN
// returns to that level with the same build. Also saves during a story mission and loads it back onto that mission.
//   npm run build && npm run smoke:saves            (SHOTS=<dir> also saves screenshots of the menus)

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.env.SHOTS;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
await page.addInitScript(() => {
  try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
});
const shot = async (n) => { if (!shots) return; await page.waitForTimeout(600); await page.screenshot({ path: path.join(shots, n + '.png') }); };   // past the panels' rise-in
const check = (ok, what) => { if (!ok){ console.error('FAIL: ' + what); process.exitCode = 1; } else console.log('ok: ' + what); };
const playing = () => page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 15000 });
// pause the way the unlocked fallback does (headless Esc goes to the browser, not the game)
const pause = () => page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });

await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await shot('01-menu');
// fit: the title column never scrolls
check(await page.evaluate(() => { const r = document.querySelector('.ov-inner').getBoundingClientRect(); return r.bottom <= innerHeight + 1; }), 'menu fits the window');

// CAMPAIGN as the Mando, skipped to level 2 with a build
await page.click('#hero-mando'); await page.click('#mode-campaign'); await page.click('#goText');
if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
await playing();
await page.evaluate(() => { const { G, player, startLevel } = GAME; G.xp = 777; player.up.dmg = 1.5; G.unlocked.flame = true; startLevel(1); });
await page.waitForTimeout(500);
await pause();
await shot('02-pause');
await page.click('#saveBtn'); await shot('03-save-panel');
await page.click('[data-act="save"][data-i="0"]');
check(await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('sw_save_0')); return d && d.run && d.run.idx === 1 && d.run.xp === 777; }), 'campaign saved to slot 1 with its build');
await page.click('#savesclose');
await page.click('#homeBtn'); await page.click('#homeYes');

// NEW GAME wipes progress but keeps the slot
await page.evaluate(() => localStorage.setItem('sw_camp_jedi', '1'));
await page.click('#campNewBtn'); await shot('04-new-confirm');
await page.click('#newYes');
await page.click('#trainNo');   // a fresh start offers the training grounds first, as on a first run
await playing();
check(await page.evaluate(() => GAME.G.levelIdx === 0 && GAME.G.xp === 0 && localStorage.getItem('sw_camp_jedi') === null && !!localStorage.getItem('sw_save_0')), 'new game starts fresh and keeps the save');

// LOAD from the pause screen → menu shows CONTINUE CAMPAIGN → back on level 2 with the build
await pause();
await page.click('#loadBtn'); await shot('05-load-panel');
await page.click('[data-act="load"][data-i="0"]');   // first click asks (leaves the run)
await page.click('[data-act="load"][data-i="0"]');
await page.waitForFunction(() => GAME.G.mode === 'menu');
await shot('06-continue');
check(await page.evaluate(() => document.getElementById('goText').textContent === 'CONTINUE CAMPAIGN' && GAME.G.hero === 'mando'), 'menu offers CONTINUE CAMPAIGN as the Mando');
await page.click('#goText');
if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
await playing();
check(await page.evaluate(() => GAME.G.levelIdx === 1 && GAME.G.xp === 777 && GAME.player.up.dmg === 1.5 && GAME.G.unlocked.flame), 'continued on level 2 with the saved build');

// a STORY MISSION save loads back onto that mission
await pause(); await page.click('#homeBtn'); await page.click('#homeYes');
await page.click('#hero-jedi'); await page.click('#mode-mission'); await page.click('#msn-pursuit'); await page.click('#goText');
if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
await playing();
await pause(); await page.click('#saveBtn'); await page.click('[data-act="save"][data-i="1"]');
await page.click('#savesclose'); await page.click('#homeBtn'); await page.click('#homeYes');
await page.click('#hero-mando'); await page.click('#mode-campaign');
await page.click('#campLoadBtn'); await page.click('[data-act="load"][data-i="1"]');
check(await page.evaluate(() => GAME.G.modeSel === 'mission' && GAME.G.missionId === 'pursuit' && GAME.G.hero === 'jedi' && document.getElementById('goText').textContent === 'BEGIN MISSION'), 'mission save loads onto that mission');
await page.click('#goText');
if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
await playing();
check(await page.evaluate(() => GAME.G.mission), 'the loaded mission starts');
await pause(); await shot('07-pause-mission');

for (const e of errors) console.error(e);
if (errors.length) process.exitCode = 1;
await browser.close();
