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
  // a power on the guest's side (a foe floored there) lands on the host's real foe
  const t2 = shared[1];
  await guest.evaluate((n) => { const e = GAME.enemies.find(o => o.nid === n); e.state = 'knockdown'; e.st = 3; }, t2);
  await host.waitForFunction((n) => { const e = GAME.enemies.find(o => o.nid === n); return !e || e.dead || e.state === 'knockdown'; }, t2, poll);
  // a foe the guest holds in the Force grasp is placed on the host where the guest holds it
  const t3 = shared[2];
  await guest.evaluate((n) => { const e = GAME.enemies.find(o => o.nid === n); e.state = 'grasped'; e.group.position.set(3, 2, 3); }, t3);
  await host.waitForFunction((n) => { const e = GAME.enemies.find(o => o.nid === n); return !e || e.dead || (e.state === 'grasped' && Math.abs(e.group.position.y - 2) < 0.3); }, t3, poll);
  await guest.evaluate((n) => { const e = GAME.enemies.find(o => o.nid === n); e.state = 'knockdown'; e.st = 1; }, t3);
  // the marksman's laser sight and the lancer's line are drawn on the guest
  await host.evaluate((n) => { const e = GAME.enemies.find(o => o.nid === n), p = e.group.position; GAME.coopHooks.aim(e, p, { x: p.x + 5, y: p.y, z: p.z }, 0.5); GAME.coopHooks.lunge(e, p, 0, 6, true, 0.5); }, t3);
  await guest.waitForFunction((n) => { const e = GAME.enemies.find(o => o.nid === n); return e && e.aimLine && e.aimLine.visible && e.lungeLine && e.lungeLine.visible; }, t3, poll);
  // the partner's shots are drawn on the other screen
  await host.evaluate(() => GAME.spawnBlasterBolt(new GAME.camera.position.constructor(0, 1.5, 0), new GAME.camera.position.constructor(1, 0, 0), 5, 0x66ccff, 1, {}));
  await guest.waitForFunction(() => GAME.bolts.some(b => b.ghost), null, poll);
  // a kill on the host pays the guest XP too
  const xp0 = await guest.evaluate(() => GAME.G.xp || 0);
  await host.evaluate((n) => { const e = GAME.enemies.find(o => o.nid === n); if (e) GAME.damageEnemy(e, 99999, null, 0, false, false); }, t2);
  await guest.waitForFunction((x) => (GAME.G.xp || 0) > x, xp0, poll);
  // the host waits in the lull while the guest's upgrade screen is open, and goes on a moment after it closes
  const w0 = await host.evaluate(() => GAME.G.endlessWave);
  await host.evaluate(() => { GAME.shared.levelPhase = 'between'; GAME.shared.phaseT = 1.5; });
  await guest.waitForFunction(() => GAME.G.skillSelect, null, poll);
  await host.waitForFunction(() => GAME.coopRun.guestPicking, null, poll);
  await host.waitForTimeout(2500);
  if (await host.evaluate((w) => GAME.G.endlessWave !== w, w0)) throw new Error('the host started the next wave while the guest was still picking');
  await guest.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });
  await host.waitForFunction((w) => GAME.G.endlessWave !== w, w0, poll);
  // a pause on one side does not freeze the other's fight: the host's foes keep moving while the guest's pause is up
  await guest.evaluate(() => { GAME.G.paused = true; });
  const gt0 = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((t) => GAME.G.gt > t + 1, gt0, poll);
  await guest.waitForFunction(() => { window.__gt0 = window.__gt0 || GAME.G.gt; return GAME.G.gt > window.__gt0 + 0.5; }, null, poll);
  await guest.evaluate(() => { GAME.G.paused = false; });
  ok = true;
  console.log('ok   co-op run: the guest joined the host\'s Survival run, shows ' + shared.length + '+ of its foes as puppets, a blow on one reached the host, and a shot and a blow from one hurt the guest, a power, the partner shots and shared XP work');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, foes: GAME.enemies.map(e => [e.nid, !!e.net]), status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op run\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
