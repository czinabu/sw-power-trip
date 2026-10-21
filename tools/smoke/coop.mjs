// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP SMOKE TEST — runs a local PeerServer, opens two browsers on the BUILT game (dist/index.html), hosts in one,
// joins from the other with the room code, starts play in both and checks each sees the other's ghost hero.
//   npm run build && npm run smoke:coop

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9017';
const server = PeerServer({ port: 9017, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000, polling: 250 });
  return page;
}
// poll on a timer: only one of the two pages is in the foreground, and the other gets no animation frames
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, { timeout: 30000, polling: 250 });

let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#coopBtn'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, { timeout: 20000, polling: 250 });
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#coopBtn'); await guest.fill('#coopcode', code);
  await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  for (const [page, hero] of [[host, 'jedi'], [guest, 'mando']]){
    await page.click('#coopclose'); await page.click('#hero-' + hero);
    for (let i = 0; i < 5; i++){
      if (await page.evaluate(() => GAME.G.mode === 'play')) break;
      if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  await host.evaluate(() => GAME.player.group.position.set(5, 0, 3));
  await guest.waitForFunction(() => GAME.partnerShown(), null, { timeout: 15000, polling: 250 });
  await host.waitForFunction(() => GAME.partnerShown(), null, { timeout: 15000, polling: 250 });
  ok = true;
  console.log('ok   co-op: connected with code ' + code + ', each side sees the other');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ shown: GAME.partnerShown(), mode: GAME.G.mode, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
