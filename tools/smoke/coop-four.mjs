// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP FOUR-PLAYER SMOKE TEST — a host and three guests on the BUILT game: all join the host's Survival run, each sees the
// other three as partners and the host's foes as puppets, a foe's blow reaches only the guest it was meant for, a guest's
// blow reaches the host's foe, and when one guest leaves the others drop them.
//   npm run build && npm run smoke:coop-four

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9021';
const server = PeerServer({ port: 9021, host: '127.0.0.1', path: '/' });
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
const play = async (page) => {
  for (let i = 0; i < 6 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await page.waitForTimeout(800);
  }
  // (four slow headless pages leave heroes standing in the fight for a long while: keep them up)
  await page.evaluate(() => { setInterval(() => { if (GAME.G.mode === 'play' && GAME.player.hp < 50) GAME.player.hp = 100; }, 100); });
};

let ok = false;
try {
  const host = await open('host'), guests = [await open('guest1'), await open('guest2'), await open('guest3')];
  await host.bringToFront(); await host.waitForSelector('#mode-coop', { state: 'visible', timeout: 60000 });
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  for (const g of guests){
    await g.bringToFront(); await g.waitForSelector('#mode-coop', { state: 'visible', timeout: 60000 });
    await g.click('#mode-coop'); await g.fill('#coopcode', code); await g.click('#coopjoin');
    await connected(g);
  }
  await host.waitForFunction(() => /4 of 4 players/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose');
  await host.click('#hero-jedi'); await host.click('#mode-endless');
  await play(host);
  for (const g of guests){
    await g.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
    await g.click('#coopclose'); await g.click('#hero-mando');
    await g.click('#mode-coop'); await g.click('#coopjoinrun');
    await play(g);
    if (!(await g.evaluate(() => GAME.G.coopGuest))) throw new Error('a guest did not join the host\'s run');
  }
  // everyone sees the other three, posed
  for (const [name, page] of [['host', host], ...guests.map((g, i) => ['guest' + (i + 1), g])])
    await page.waitForFunction(() => { const a = GAME.partnerInfo().all; return a.length === 3 && a.every(p => p.shown && p.posed); }, null, poll)
      .catch(async () => { throw new Error(name + ' does not see three posed partners: ' + JSON.stringify(await page.evaluate(() => GAME.partnerInfo().all))); });
  // the host's foes are on every guest's screen
  await host.waitForFunction(() => GAME.enemies.length >= 3, null, poll);
  for (const g of guests) await g.waitForFunction(() => GAME.enemies.filter(e => e.net).length >= 3, null, poll);
  if (await guests[2].evaluate(() => GAME.enemies.some(e => !e.net))) throw new Error('a guest is running foes of its own');
  // a blow lands on exactly the guest it was meant for: the second one
  const hps = await Promise.all(guests.map(g => g.evaluate(() => GAME.player.hp)));
  await host.evaluate(() => {
    const info = GAME.partnerInfo().all.find(p => p.slot === 2), e = GAME.enemies[0];
    e.hero = GAME.partnerMate(2); GAME.coopHooks.hurt(e, 6, e.group.position, 'melee', true);
  });
  await guests[1].waitForFunction((hp) => GAME.player.hp < hp, hps[1], poll);
  await host.waitForTimeout(800);
  const after = await Promise.all(guests.map(g => g.evaluate(() => GAME.player.hp)));
  if (after[0] < hps[0] || after[2] < hps[2]) throw new Error('a blow meant for the second guest hurt another: ' + hps + ' -> ' + after);
  // a guest's blow reaches the host's foe
  const target = await guests[2].evaluate(() => GAME.enemies.find(e => e.net).nid);
  const hp0 = await host.evaluate((n) => GAME.enemies.find(e => e.nid === n).hp, target);
  await guests[2].evaluate((n) => { const e = GAME.enemies.find(o => o.nid === n); GAME.damageEnemy(e, 15, null, 0, false, false); }, target);
  await host.waitForFunction(([n, hp]) => { const e = GAME.enemies.find(o => o.nid === n); return !e || e.dead || e.hp < hp; }, [target, hp0], poll);
  // two guests with an upgrade screen open hold the host's next wave until both close it
  for (const g of [guests[0], guests[1]]) await g.evaluate(() => { GAME.G.skillSelect = true; });
  await host.waitForFunction(() => GAME.coopRun.guestPicking, null, poll);
  await guests[0].evaluate(() => { GAME.G.skillSelect = false; });
  await host.waitForTimeout(800);
  if (!(await host.evaluate(() => GAME.coopRun.guestPicking))) throw new Error('the host stopped waiting when only one of two guests closed their upgrade screen');
  await guests[1].evaluate(() => { GAME.G.skillSelect = false; });
  await host.waitForFunction(() => !GAME.coopRun.guestPicking, null, poll);
  // a guest leaves: the host and the others drop them
  await guests[2].evaluate(() => document.getElementById('coopleave').click());
  for (const page of [host, guests[0], guests[1]])
    await page.waitForFunction(() => GAME.partnerInfo().all.filter(p => p.shown).length === 2, null, poll);
  ok = true;
  console.log('ok   co-op four: a host and three guests share a Survival run, see each other, take blows meant for them, and drop a guest who leaves');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, partners: GAME.partnerInfo().all.length, foes: GAME.enemies.length, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op four\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
