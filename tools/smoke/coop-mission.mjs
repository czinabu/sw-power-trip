// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP MISSION SMOKE TEST — a shared story mission: two browsers on the BUILT game, the host starts a mission, the guest
// joins it from the co-op panel; then the guest must follow the host's objectives, markers and chase quarry, and its
// mission must end when the host's does.
//   npm run build && npm run smoke:coop-mission

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9020';
const server = PeerServer({ port: 9020, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 30000, polling: 250 };   // on a timer: only one of the two pages is in the foreground

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_camp_mando', '1'); } catch(e){}   // Survival unlocked
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);

let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  // the host starts Survival
  await host.click('#hero-jedi'); await host.click('#mode-mission'); await host.click('#msn-pursuit');
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await host.waitForTimeout(800);
  }
  if (!(await host.evaluate(() => GAME.G.mission))) throw new Error('the host did not start the mission');
  // the guest sees the run and joins it
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.click('#hero-mando');
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await guest.isVisible('#forms [data-go]')) await guest.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await guest.waitForTimeout(800);
  }
  if (!(await guest.evaluate(() => GAME.G.coopGuest && GAME.G.mission && GAME.G.missionId === 'pursuit'))) throw new Error('the guest did not join the host\'s mission');
  // the host's first objective begins: the guest follows, with its markers
  await host.waitForFunction(() => GAME.missionState().o, null, poll);
  await guest.waitForFunction(() => GAME.missionState().begun === 0 && GAME.missionState().o, null, poll);
  const mk = await host.evaluate(() => GAME.missionState().markers.length);
  await guest.waitForFunction((n) => GAME.missionState().markers.length === n, mk, poll);
  // the chase: the guest shows the quarry the host is running
  await guest.waitForFunction(() => GAME.missionState().quarry, null, poll);
  if (await guest.evaluate(() => GAME.enemies.some(e => !e.net))) throw new Error('the guest is running foes of its own');
  // the host's objective is done: the guest moves on to the next one
  const i0 = await host.evaluate(() => GAME.missionState().i);
  await host.evaluate(() => GAME.skipObjective());
  await host.waitForFunction((i) => GAME.missionState().i === i + 1, i0, poll);
  await guest.waitForFunction((i) => GAME.missionState().i === i + 1, i0, poll);
  // the host's last objective: the guest's mission ends with it
  await host.bringToFront();
  for (let k = 0; k < 120 && !(await host.evaluate(() => GAME.missionState().won || GAME.G.mode !== 'play')); k++){
    await host.evaluate(() => { if (GAME.missionState().o) GAME.skipObjective(); });
    await host.waitForTimeout(400);
  }
  await guest.waitForFunction(() => GAME.G.mode === 'victory', null, poll);
  ok = true;
  console.log('ok   co-op mission: the guest joined the host\'s mission, followed its objectives, markers and quarry, and finished with it');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, mission: GAME.G.missionId, i: GAME.missionState().i, o: !!GAME.missionState().o, mk: GAME.missionState().markers.length, q: !!GAME.missionState().quarry, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op mission\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
