// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SMOKE TEST — boots the BUILT game (dist/index.html) in headless Chromium and plays each hero for a short scripted
// fight in a random look from the character customizer: walk in, turn toward the nearest foe, attack and fire off the
// hero's moves. Then story missions picked from the menu's MISSIONS list (the strike team mission with its squad, the
// Lothal escort), skipping ahead through their objectives so every kind (the hold, the sabotage, the capture, the escort,
// the chase legs, the duels) gets set up and played, and the sandbox, with foes and a boss called in from its panel.
// Fails on any page error or console error, or if the fight never gets going (no frames, no enemies, nothing hit).
//   npm run build && npm run smoke            (SMOKE_SECONDS=… sets the game time per hero, default 20)

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const GAME_SECONDS = +(process.env.SMOKE_SECONDS || 20);
const REAL_LIMIT_MS = 150000;   // headless WebGL is slow; give up on a hero after this much wall time

// each hero's moves, pressed in turn during the fight (keys from engine/input.js)
const MOVES = {
  jedi:  ['e', 'f', 'shift', ' ', 'c', '2', 'q', 'Alt', '3', 'g', '4', 'f', '1', '4'],
  mando: ['e', 'q', 'shift', ' ', 'f', 'c', '2', 'r', '4', 'e', '4', '1', 'e', 'e'],
};

if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;

// a mission run passes once its last objective (a duel) is up: the HUD line then names the opponent
const DUEL_LINE = { refuge: /INQUISITOR/, pursuit: /VX-7|SEVENTH BLADE/, strike: /WARDEN/, grassland: /SHIELD CAPTAIN/ };
// [hero, menu mode, story mission]
for (const [hero, mode, mission] of [['jedi', 'campaign'], ['mando', 'campaign'], ['jedi', 'mission', 'refuge'], ['mando', 'mission', 'pursuit'], ['jedi', 'mission', 'strike'], ['mando', 'mission', 'grassland'], ['mando', 'sandbox']]){
  const label = hero + (mode === 'campaign' ? '' : ' ' + (mission || mode));
  const errors = [];
  // small window on the LOW preset: headless Chromium draws WebGL in software, and this keeps it at a usable frame rate
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await page.addInitScript(([sandbox, mission, hero]) => {
    if (sandbox) try { localStorage.setItem('sw_camp_mando', '1'); } catch(e){}   // the sandbox unlocks after a campaign win
    if (mission) try { localStorage.setItem('sw_mission_' + mission + '_' + hero, '1'); } catch(e){}   // a story mission opens once the campaign has cleared it
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}   // fullscreen has its own check below
    // headless pointer lock grants or refuses at random from run to run; refuse it every time so the game takes its
    // unlocked fallback (the embedded-preview path) and the run always starts the same way
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, [mode === 'sandbox', mission, hero]);
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  const log = [];
  page.on('console', m => { log.push(m.type() + ': ' + m.text()); if (m.type() === 'error') errors.push('console error: ' + m.text()); });

  const t0 = Date.now();
  let result;
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.click('#hero-' + hero);
    // restyle the hero in the customizer first, so the fight runs on a rebuilt player model
    if (mode === 'campaign'){ await page.click('#cztoggle'); await page.click('#czrandom'); await page.click('#czdone'); }
    // a story mission: MISSIONS on the mode row, then its card in the list that opens under it
    if (mode === 'mission'){ await page.click('#mode-mission'); await page.click('#msn-' + mission); }
    else await page.click('#mode-' + mode);
    // BEGIN, then give the game a few seconds to drop into the fight; click again if it's still on the menu
    let started = false;
    for (let i = 0; i < 5 && !started; i++){
      // short timeouts: the overlay can hide between the visibility check and the click (the mission's PLAY starts it on its own)
      if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
      if (await page.isVisible('#trainNo')) await page.click('#trainNo', { timeout: 2000 }).catch(() => {});   // first run asks about training: go straight to the campaign
      if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 3000 }).catch(() => {});   // (a long arena may still be building: the menu can close mid-click)
      if (await page.isVisible('#trainNo')) await page.click('#trainNo');   // first run asks about training: go straight to the campaign
      // a button can hide between the visibility check and the click (the run starts on its own): a short click that
      // gives up quietly instead of Playwright's 30 s wait for an element that is gone for good
      const tap = async sel => { if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {}); };
      await tap('#goText');
      await tap('#trainNo');   // first run asks about training: go straight to the campaign
      await tap('#forms [data-go]');   // the Jedi's forms page before the fight (ui/forms-ui.js): FIGHT
      started = await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 3000 }).then(() => true, () => false);
    }
    if (!started){
      const st = await page.evaluate(() => {
        const ov = document.getElementById('overlay');
        const b = document.getElementById('goText').getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return JSON.stringify({ mode: GAME.G.mode, paused: GAME.G.paused, overlay: document.getElementById('ovsub')?.textContent,
          lock: document.pointerLockElement ? 'locked' : 'none', button: [b.x, b.y, b.width, b.height].map(Math.round),
          hit: hit && (hit.id || hit.className || hit.tagName), overlayShown: ov.style.display, overlayClass: ov.className, training: GAME.G.training, modeSel: GAME.G.modeSel });
      });
      await page.screenshot({ path: path.join(root, `smoke-${label.replace(' ', '-')}.png`) }).catch(() => {});
      throw new Error('never left the menu; state: ' + st + '\n' + log.slice(-15).join('\n'));
    }
    // the sandbox: call foes in from its panel (B), switch a power, then close it and fight them
    if (mode === 'sandbox'){
      await page.keyboard.press('b');
      await page.click('[data-n="3"]'); await page.click('[data-foe="grunt"]'); await page.click('[data-foe="acolyte"]');
      await page.click('[data-kit="birds"]'); await page.click('[data-foe="boss"]');
      await page.click('#sbsquadadd'); await page.click('#sbsquadadd');   // two squadmates fight beside the hero
      await page.click('#sbdone');
    }
    await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });

    const startGt = await page.evaluate(() => GAME.G.gt);
    await page.keyboard.down('w');
    const objectives = mode === 'mission' ? await page.evaluate(() => GAME.missionState().def.objectives.length) : 0;
    let step = 0, skips = 0, everHit = false;   // a mission skips past (and clears) earlier foes, so remember any hit
    for (;;){
      const s = await page.evaluate(() => {
        const { G, player, enemies } = GAME;
        // keep the hero standing so the whole run is exercised (this checks for crashes, not balance)
        player.hp = Math.max(player.hp, 1e3);
        // a campaign chapter opens on its card, and between waves the upgrade screen holds the game: take them straight back into the fight
        const card = document.querySelector('#chapcard.open [data-go]'); if (card) card.click();
        if (G.cutscene) GAME.cutscene.skipScene();   // (the cutscenes have their own suite: tools/smoke/cutscenes.mjs)
        if (G.skillSelect){ const b = document.getElementById('continueBtn'); if (b) b.click(); }
        if (G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
        // turn toward the nearest live foe, the way a player would
        const p = player.group.position;
        let best = null, bd = 1e9;
        for (const e of enemies){
          if (e.dead || e.converted) continue;
          const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z);
          if (d < bd){ bd = d; best = e; }
        }
        if (best) G.yaw = Math.atan2(best.group.position.x - p.x, best.group.position.z - p.z);
        G.pitch = 0.1;
        return { gt: G.gt, mode: G.mode, near: bd, enemies: enemies.length,
                 hit: (G.stats && G.stats.kills) > 0 || enemies.some(e => e.maxHp && e.hp < e.maxHp) };
      });
      everHit = everHit || s.hit;
      if (s.gt - startGt >= GAME_SECONDS || s.mode !== 'play' || Date.now() - t0 > REAL_LIMIT_MS) break;
      // a mission: a few seconds of each objective, then on to the next (the duel plays out to the end of the run, so it
      // gets the bigger share: on a slow runner it takes a while for the duellist to arrive and close in)
      const every = Math.min(0.18, 0.54 / Math.max(1, objectives - 1));
      if (mode === 'mission' && skips < objectives - 1 && s.gt - startGt > GAME_SECONDS * every * (skips + 1)){
        if (await page.evaluate(() => GAME.skipObjective())) skips++;
      }
      // attack: a click (saber swing / blaster shot), and a move every few steps
      await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
      if (step % 3 === 0){ const k = MOVES[hero][(step / 3) % MOVES[hero].length]; await page.keyboard.press(k === ' ' ? 'Space' : k === 'shift' ? 'Shift' : k); }
      // back off a little when right on top of the pack, so movement and pathing get exercised too
      if (s.near < 2.5){ await page.keyboard.up('w'); await page.keyboard.down('s'); await page.waitForTimeout(150); await page.keyboard.up('s'); await page.keyboard.down('w'); }
      step++;
      await page.waitForTimeout(120);
    }
    await page.keyboard.up('w');

    result = await page.evaluate(start => {
      const { G, enemies } = GAME;
      const hurt = enemies.filter(e => e.maxHp && e.hp < e.maxHp).length;
      return { gameSeconds: +(G.gt - start).toFixed(1), frames: window.__frames, mode: G.mode, level: G.levelIdx,
               wave: G.waveTotal || 0, enemies: enemies.length, kills: (G.stats && G.stats.kills) || 0, hurt,
               objective: document.getElementById('waveinfo').textContent, squad: GAME.squad.allies.length };
    }, startGt);
    if (mode === 'mission') result.skips = skips;
    result.everHit = everHit;
  } catch (e){
    errors.push('script: ' + e.message);
  }
  await page.close();

  // the same error usually fires every frame: report each one once, with how often it happened
  const seen = new Map();
  for (const e of errors) seen.set(e, (seen.get(e) || 0) + 1);
  const problems = [...seen].map(([e, n]) => n > 1 ? `${e}\n(×${n})` : e);
  if (result){
    if (result.frames < 30) problems.push(`only ${result.frames} frames rendered`);
    if (result.gameSeconds < GAME_SECONDS * 0.5) problems.push(`game only advanced ${result.gameSeconds}s`);
    if (result.mode !== 'play' && !(mode === 'mission' && result.mode === 'victory')) problems.push(`left play mode (mode: ${result.mode})`);
    if (mode === 'mission' && !DUEL_LINE[mission].test(result.objective)) problems.push('the mission never reached its duel');
    if (!result.enemies && !result.kills) problems.push('no enemies ever spawned');
    if ((mission === 'strike' || mode === 'sandbox') && !result.squad) problems.push('the squad never formed up');
    if (!result.kills && !result.hurt && !result.everHit) problems.push('the hero never hit anything');
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${label.padEnd(14)} ${JSON.stringify(result || {})} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  for (const p of problems) console.log('     ' + p.split('\n').slice(0, 20).join('\n     '));
  if (problems.length) failed = true;
}

// FULLSCREEN — on by default: the first click takes the page fullscreen, and the toggle in SETTINGS turns it off (and stays off)
{
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  const problems = [];
  page.on('pageerror', e => problems.push('page error: ' + e.message));
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.click('#hero-mando');
    const on = await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 3000 }).then(() => true, () => false);
    if (!on) problems.push('the first click did not go fullscreen');
    await page.click('#settoggle');
    if (on && !await page.waitForFunction(() => document.querySelector('#settings .fsval').textContent === 'ON', null, { timeout: 2000 }).then(() => true, () => false))
      problems.push('settings toggle does not say ON in fullscreen');
    await page.click('#settings .fsctl');
    const off = await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 }).then(() => true, () => false);
    if (!off) problems.push('the settings toggle did not leave fullscreen');
    if (await page.evaluate(() => localStorage.getItem('sw_fullscreen')) !== '0') problems.push('turning fullscreen off was not remembered');
    if (await page.evaluate(() => GAME.G.mode) !== 'menu') problems.push('the fullscreen toggle launched the game');
    // the ROADMAP button opens its panel over the menu, and never starts a run
    await page.click('#setclose');
    await page.click('#rmtoggle');
    if (!await page.evaluate(() => document.getElementById('roadmap').classList.contains('open'))) problems.push('the ROADMAP button did not open the roadmap');
    if (await page.evaluate(() => GAME.G.mode) !== 'menu') problems.push('the ROADMAP button launched the game');
  } catch (e){ problems.push('script: ' + e.message); }
  await page.close();
  console.log(`${problems.length ? 'FAIL' : 'ok  '} fullscreen, roadmap`);
  for (const p of problems) console.log('     ' + p);
  if (problems.length) failed = true;
}

await browser.close();
process.exit(failed ? 1 : 0);
