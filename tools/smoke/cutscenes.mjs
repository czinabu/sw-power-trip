// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CUTSCENES SMOKE TEST — the campaign's in-engine scenes (game/cutscene.js) on the BUILT game, as both heroes:
//   · a chapter's opening plays when its card closes, holds the fight still, and hands back to play on its own
//   · Enter skips one
//   · a mission duel's entrance plays before its foe, and the foe steps in once it ends
//   · co-op: the host's duel entrance plays for the guest too, and the guest's skip ends it for both
//   npm run build && npm run smoke:cutscenes

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9021';
const server = PeerServer({ port: 9021, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 120000, polling: 250 };   // a slow runner's sim crawls: a mission takes a while to reach its duel

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
async function play(page, hero){
  await page.click('#hero-' + hero); await page.click('#mode-campaign');
  for (let i = 0; i < 5 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight (ui/forms-ui.js): FIGHT
    await page.waitForTimeout(800);
  }
}
const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); });
const fail = (msg) => { throw new Error(msg); };

let ok = false;
try {
  /* ---------- solo, both heroes ---------- */
  for (const hero of ['jedi', 'mando']){
    const page = await open(hero);
    await play(page, hero);
    await page.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll);
    await begin(page);
    if (!(await page.evaluate(() => GAME.G.cutscene && document.getElementById('cutscene').classList.contains('on')))) fail(hero + ': chapter 1 opened without its scene');
    const gt = await page.evaluate(() => GAME.G.gt);
    await page.waitForTimeout(1500);
    if (await page.evaluate((g) => GAME.G.gt !== g, gt)) fail(hero + ': the fight ran on under the opening scene');
    await page.waitForFunction(() => !GAME.G.cutscene, null, poll);   // it ends on its own...
    if (await page.evaluate(() => document.body.classList.contains('cutscene'))) fail(hero + ': the letterbox stayed up');
    // ...and Enter skips one (chapter 2's opening, with the Inquisitor or VX-7 watching)
    await page.evaluate(() => GAME.startChapter(1)); await begin(page);
    if (!(await page.evaluate(() => GAME.G.cutscene))) fail(hero + ': chapter 2 opened without its scene');
    await page.keyboard.press('Enter');
    if (await page.evaluate(() => GAME.G.cutscene)) fail(hero + ': Enter did not skip the scene');
    // a mission duel: its entrance, then the foe
    await page.evaluate(() => GAME.startMission('trial-knight', 0));
    await page.waitForFunction(() => GAME.G.cutscene, null, poll);
    if (await page.evaluate(() => GAME.enemies.some(e => e.champion))) fail(hero + ': the duel foe stepped in before its entrance');
    await page.evaluate(() => GAME.cutscene.skipScene());
    await page.waitForFunction(() => GAME.enemies.some(e => e.champion), null, poll);
    // a retry after a death doesn't replay it
    await page.evaluate(() => GAME.startMission('trial-knight', 0, false, { retry: true }));
    await page.waitForFunction(() => GAME.enemies.some(e => e.champion) || GAME.G.cutscene, null, poll);
    if (await page.evaluate(() => GAME.G.cutscene)) fail(hero + ': the duel entrance replayed') ;
    await page.close();
    console.log(hero + ': opening, skip and duel entrance OK');
  }

  /* ---------- co-op: the host's duel entrance reaches the guest; the guest's skip ends both ---------- */
  const host = await open('host'), guest = await open('guest');
  await host.click('#coopBtn'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#coopBtn'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  for (const p of [host, guest]) await p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose'); await guest.click('#coopclose');
  await host.click('#hero-jedi'); await host.click('#mode-mission'); await host.click('#msn-refuge');
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight (ui/forms-ui.js): FIGHT
    await host.waitForTimeout(800);
  }
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#hero-mando'); await guest.click('#coopBtn'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await guest.isVisible('#forms [data-go]')) await guest.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight (ui/forms-ui.js): FIGHT
    await guest.waitForTimeout(800);
  }
  if (!(await guest.evaluate(() => GAME.G.coopGuest && GAME.G.mission))) fail('the guest did not join the host\'s mission');
  await host.evaluate(() => GAME.startMission('refuge', 2));   // straight on to the duel (the guest follows the restart)
  await host.waitForFunction(() => GAME.G.cutscene, null, poll);
  await guest.waitForFunction(() => GAME.G.cutscene, null, poll);
  await host.waitForFunction(() => GAME.coopRun.guestScene, null, poll);   // the host's foes hold for the guest's scene too
  await guest.keyboard.press('Enter');
  await host.waitForFunction(() => !GAME.G.cutscene, null, poll);
  if (await guest.evaluate(() => GAME.G.cutscene)) fail('the guest\'s skip did not end its own scene');
  await host.waitForFunction(() => !GAME.coopRun.guestScene, null, poll);
  await host.waitForFunction(() => GAME.enemies.some(e => e.champion), null, poll);
  console.log('co-op: shared duel entrance and skip OK');

  if (errors.length) fail('page errors:\n  ' + errors.slice(0, 8).join('\n  '));
  ok = true;
  console.log('CUTSCENES SMOKE OK');
} catch(e){
  console.error('CUTSCENES SMOKE FAILED: ' + e.message);
  if (errors.length) console.error(errors.slice(0, 8).join('\n'));
}
await browser.close();
server.close && server.close();
process.exit(ok ? 0 : 1);
