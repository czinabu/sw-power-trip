// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MAP ART CAPTURE — boots the BUILT game (dist/index.html) headlessly, builds every map in turn (GAME.mapLevels) and
// saves gameplay-camera screenshots with a few troopers standing in front of the hero, so an art pass can be compared
// before and after.
//   npm run build && npm run shots:maps -- [outDir] [map,map,...]   (QUALITY=high|medium|low, default high; PW_CHROMIUM
//   a Chromium binary, when Playwright's own isn't installed)

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'shots');
const only = process.argv[3] ? process.argv[3].split(',') : null;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const q = process.env.QUALITY || 'high';
await page.addInitScript(q => {
  try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');
        localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
}, q);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.click('#hero-jedi'); await page.click('#mode-sandbox');
const tap = async sel => { if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {}); };
for (let i = 0; i < 6; i++){
  await tap('#goText'); await tap('#trainNo'); await tap('#forms [data-go]');
  if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 4000 }).then(() => true, () => false)) break;
}
await page.addStyleTag({ content: 'body > *:not(canvas){ visibility: hidden !important } canvas{ visibility: visible !important }' });

const maps = await page.evaluate(() => Object.keys(GAME.mapLevels()));
for (const id of maps){
  if (only && !only.includes(id)) continue;
  // two views: from the north (spawn side) looking south across the floor, and from the south looking back north
  for (const [view, side] of [['a', 1], ['b', -1]]){
    const info = await page.evaluate(([id, side]) => {
      const { G, player, enemies } = GAME, L = GAME.mapLevels()[id];
      GAME.sandboxClear();
      if (GAME.arena().layout !== id) GAME.buildArena(L);
      G.sandboxGod = true; player.hp = 1e4;
      // a long route (the pursuit) is shot from its start yard looking up the street, then from the market square
      // looking back; everything else from 30% out on the north / south side, facing the middle
      const d = Math.min(L.arena * 0.3, 22);
      const [x, z, yaw] = L.arenaZ ? (side > 0 ? [0, -150, 0] : [0, -100, Math.PI]) : [0, side * d, side > 0 ? Math.PI : 0];
      const s = GAME.findClearSpawn(x, z, 1.6);
      player.group.position.set(s.x, 0, s.z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0);
      G.yaw = player.faceYaw = yaw;
      return GAME.arena();
    }, [id, side]);
    await page.waitForTimeout(400);
    await page.evaluate(side => {
      const { G, player, enemies } = GAME, p = player.group.position, f = Math.cos(G.yaw) > 0 ? 1 : -1;
      GAME.sandboxClear();
      const types = ['grunt', 'blaster', 'grunt'];
      types.forEach((t, i) => {
        const s = GAME.findClearSpawn(p.x + (i - 1) * 3, p.z + f * (8 + (i % 2) * 2), 0.9);
        GAME.spawnEnemy(t, p.clone().set(s.x, 0, s.z));
        const e = enemies[enemies.length - 1]; e.dummy = true; e.home = { x: s.x, z: s.z };
      });
    }, side);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(out, `${id}-${view}.png`) });
    console.log(id, view, JSON.stringify(info));
  }
}
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
await browser.close();
