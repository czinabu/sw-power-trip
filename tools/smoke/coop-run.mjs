// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP RUN SMOKE TEST — the shared Survival fight (co-op phase 2): two browsers on the BUILT game, the host starts a
// Survival run, the guest joins it from the co-op panel; then the guest must show the host's foes as puppets (the same
// numbers), and a blow the guest lands on one must reach the host's copy of it.
//   npm run build && npm run smoke:coop-run

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9018';
const server = PeerServer({ port: 9018, host: '127.0.0.1', path: '/' });
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
  await host.click('#coopBtn'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#coopBtn'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  // the host starts Survival
  await host.click('#hero-jedi'); await host.click('#mode-endless');
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    await host.waitForTimeout(800);
  }
  // the guest sees the run and joins it
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.click('#hero-mando');
  await guest.click('#coopBtn'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    await guest.waitForTimeout(800);
  }
  if (!(await guest.evaluate(() => GAME.G.coopGuest))) throw new Error('the guest did not join the host\'s run');
  // the host's foes appear on the guest as puppets with the same numbers
  const ids = (page, puppets) => page.evaluate((p) => GAME.enemies.filter(e => !!e.net === p).map(e => e.nid).sort((a, b) => a - b), puppets);
  await host.waitForFunction(() => GAME.enemies.length >= 3, null, poll);
  await guest.waitForFunction(() => GAME.enemies.filter(e => e.net).length >= 3, null, poll);
  const [h, g] = [await ids(host, false), await ids(guest, true)];
  const shared = g.filter(n => h.includes(n));
  if (shared.length < 3) throw new Error('puppets do not match the host\'s foes: host ' + h + ' guest ' + g);
  if (await guest.evaluate(() => GAME.enemies.some(e => !e.net))) throw new Error('the guest is running foes of its own');
  // a blow the guest lands reaches the host's copy
  const target = shared[0];
  const hp0 = await host.evaluate((n) => GAME.enemies.find(e => e.nid === n).hp, target);
  await guest.evaluate((n) => { const e = GAME.enemies.find(o => o.nid === n); GAME.damageEnemy(e, 15, null, 0, false, false); }, target);
  await host.waitForFunction(([n, hp]) => { const e = GAME.enemies.find(o => o.nid === n); return !e || e.dead || e.hp < hp; }, [target, hp0], poll);
  // a foe's shot: the host fires one at where the guest stands; the guest flies its own copy, takes the hit itself, and the host's copy is dropped
  const gp = await guest.evaluate(() => { const p = GAME.player.group.position; return [p.x, p.y, p.z, GAME.player.hp]; });
  await host.evaluate(([x, y, z, n]) => {
    const e = GAME.enemies.find(o => o.nid === n), m = new GAME.camera.position.constructor(x + 7, y + 1.4, z), d = new m.constructor(-1, 0, 0);
    GAME.fireBolt(m, d, 14, 9, false, true, e);
  }, [...gp.slice(0, 3), target]);
  await guest.waitForFunction((hp) => GAME.player.hp < hp, gp[3], poll);
  await host.waitForFunction(() => !GAME.bolts.some(b => b.bid), null, poll);
  // a melee blow: sent to the guest, taken there, and answered
  const hp1 = await guest.evaluate(() => GAME.player.hp);
  await host.evaluate(([x, y, z, n]) => { const e = GAME.enemies.find(o => o.nid === n); GAME.coopHooks.hurt(e, 6, { x: x + 1, y, z }, 'melee', true); }, [...gp.slice(0, 3), target]);
  await guest.waitForFunction((hp) => GAME.player.hp < hp, hp1, poll);
  ok = true;
  console.log('ok   co-op run: the guest joined the host\'s Survival run, shows ' + shared.length + '+ of its foes as puppets, a blow on one reached the host, and a shot and a blow from one hurt the guest');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, foes: GAME.enemies.map(e => [e.nid, !!e.net]), status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op run\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
