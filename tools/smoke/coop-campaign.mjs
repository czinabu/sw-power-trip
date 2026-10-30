// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP CAMPAIGN SMOKE TEST — the shared campaign fight: two browsers on the BUILT game, the host starts the campaign, the
// guest joins it from the co-op panel; then the guest must be on the same level with the host's foes as puppets, and
// follow the host's wave clear.
//   npm run build && npm run smoke:coop-campaign

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9019';
const server = PeerServer({ port: 9019, host: '127.0.0.1', path: '/' });
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
  await host.click('#hero-jedi'); await host.click('#mode-campaign');
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await host.waitForTimeout(800);
  }
  const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); GAME.cutscene.skipScene(); });   // the chapter card, and its opening scene (tools/smoke/cutscenes.mjs tests those)
  await host.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll); await begin(host);
  // the guest sees the run and joins it
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.click('#hero-mando');
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await guest.isVisible('#forms [data-go]')) await guest.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await guest.waitForTimeout(800);
  }
  if (!(await guest.evaluate(() => GAME.G.coopGuest))) throw new Error('the guest did not join the host\'s run');
  if (!(await guest.evaluate(() => GAME.G.chapter === 0 && document.querySelector('#chapcard.open')))) throw new Error('the guest did not join the host\'s chapter');
  await begin(guest);
  if (!(await guest.evaluate(() => GAME.G.coopGuest))) throw new Error('the guest did not join the host\'s campaign');
  if (await guest.evaluate(() => GAME.G.endless)) throw new Error('the guest joined Survival, not the campaign');
  await host.waitForFunction(() => GAME.enemies.length >= 3, null, poll);
  await guest.waitForFunction(() => GAME.enemies.filter(e => e.net).length >= 3, null, poll);
  if (await guest.evaluate(() => GAME.enemies.some(e => !e.net))) throw new Error('the guest is running foes of its own');
  // the host's wave clears mid-chapter: the guest earns its own skill point (a note in the corner, no upgrade screen)
  const w0 = await host.evaluate(() => GAME.G.wave), sp0 = await guest.evaluate(() => GAME.G.skillPoints || 0);
  await host.evaluate(() => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; });
  await guest.waitForFunction((p) => (GAME.G.skillPoints || 0) > p, sp0, poll);
  await host.waitForFunction((w) => GAME.G.wave === w + 1, w0, poll);
  if (await guest.evaluate(() => GAME.G.skillSelect)) throw new Error('the guest\'s upgrade screen opened mid-chapter');
  // the host moves on to a mission chapter: the guest follows it there, shown the host's objectives
  await guest.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });
  await host.evaluate(() => GAME.startChapter(2)); await begin(host);
  await guest.waitForFunction(() => GAME.G.chapter === 2 && GAME.G.mission && GAME.G.coopGuest && GAME.missionState().def.id === 'refuge', null, poll);
  await begin(guest);
  // the story's voice lines: what the host's chapter says, the guest hears too (game/story.js comms)
  await host.evaluate(() => GAME.storyBeat('escape'));
  await guest.waitForFunction(() => /transport matters|foundlings come first/.test(document.querySelector('#comms .cm-say').textContent), null, poll);
  // the host moves on to the next level: the guest follows, still a guest
  await guest.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });
  await host.evaluate(() => GAME.startLevel(1, { resume: true }));
  await guest.waitForFunction(() => GAME.G.levelIdx === 1 && GAME.G.coopGuest, null, poll);
  // (on that level) a boss fight: the guest gets a boss puppet; its blows reach the host's boss; the host's boss blows and powers reach across
  await guest.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });
  await host.evaluate(() => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; GAME.shared.levelPhase = 'bossfight'; GAME.spawnBoss(); });
  await guest.waitForFunction(() => GAME.boss && GAME.boss.net, null, poll);
  const bhp = await host.evaluate(() => GAME.boss.hp);
  await guest.evaluate(() => GAME.damageBoss(500, false));
  await host.waitForFunction((h) => GAME.boss && GAME.boss.hp < h, bhp, poll);
  const ghp = await guest.evaluate(() => GAME.player.hp);
  await host.evaluate(() => { const b = GAME.boss; GAME.coopHooks.hurt(b, 7, b.group.position, 'bossmelee', false); });
  await guest.waitForFunction((h) => GAME.player.hp < h, ghp, poll);
  await host.evaluate(() => { const b = GAME.boss; b.state = 'chase'; b.st = 5; });
  await guest.evaluate(() => GAME.bossStagger());
  await host.waitForFunction(() => GAME.boss && GAME.boss.state === 'vulnerable', null, poll);
  // the host's boss dies: the guest's fight ends too
  await host.bringToFront();   // the death sequence runs on the host's frames, which a background page does not get
  await host.evaluate(() => { GAME.damageBoss(1e9, true); });
  await guest.waitForFunction(() => GAME.G.mode !== 'play' && !GAME.boss, null, poll);
  ok = true;
  console.log('ok   co-op campaign: the guest joined the host\'s level, shows its foes as puppets, and followed the wave clear');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, lv: GAME.G.levelIdx, wave: GAME.G.wave, foes: GAME.enemies.map(e => [e.nid, !!e.net]), boss: GAME.boss ? [GAME.boss.state, GAME.boss.hp, !!GAME.boss.net] : null, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op campaign\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
