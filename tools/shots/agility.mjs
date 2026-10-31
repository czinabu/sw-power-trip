// AGILITY CAPTURE — films the Jedi's acrobatics, form by form, from the side, frame by frame on a held clock (so every
// frame is a fixed 1/30 s step whatever the machine), for a look at the flips (testing only):
//   npm run build && node tools/shots/agility.mjs <out-dir> [forms] [moves]   (DIST=<an index.html> films another build)
//   forms: comma list (default all nine); moves: comma list of jump,double,dashf,dashb,dashs,evadeb,evadef,evades
// Writes <out-dir>/<form>-<move>/NNN.jpg, and prints the biggest one-frame turn of the body in each move (about 3.14
// is a half-turn snap).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-agility');
const FORMS = (process.argv[3] || 'shiicho,makashi,soresu,ataru,shien,djemso,niman,juyo,vaapad').split(',');
const MOVES = (process.argv[4] || 'jump,double,dashf,evadeb').split(',');
const FPS = 30, STEP = 1000 / FPS;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 520, height: 440 } });
await page.addInitScript(() => {
  // a virtual clock for the game (THREE.Clock reads performance.now) and a held frame loop: it runs free until frozen,
  // then each step advances the clock by one frame and runs that frame's callbacks once
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try { localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_trained_jedi', '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
});
page.on('pageerror', e => console.log('page error', e.message));
if (process.env.YAWS){ page.on('console', m => { if (m.text().startsWith('yaw')) console.log(m.text()); }); await page.addInitScript(() => { window.__yawLog = true; }); }
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href);
const run = ms => page.waitForTimeout(ms);
await page.waitForFunction(() => window.GAME && window.GAME.G && document.getElementById('hero-jedi'), null, { timeout: 60000 });
await page.evaluate(() => { document.getElementById('hero-jedi').click(); document.getElementById('mode-sandbox').click(); });
for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#forms [data-go]']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await run(500);
}
await run(6000);   // past the sandbox's opening beat
await page.evaluate(() => { GAME.G.unlocked.dash = true; window.__freeze(); });

// a side-on camera that follows the hero, rendered after the game's own frame
async function frame(file){
  await page.evaluate(ms => window.__step(ms), STEP);   // (one game frame)
  const r = await page.evaluate(shoot => {
    const p = GAME.player, g = p.group, c = GAME.camera, s = Math.sin(GAME.G.yaw), co = Math.cos(GAME.G.yaw);
    const x = g.position.x, y = g.position.y, z = g.position.z;
    // look across the move: side-on to the view line, a little behind and above
    c.position.set(x - co * 6.5 - s * 2.5, y + 2.2, z + s * 6.5 - co * 2.5);
    c.lookAt(x, y + 1.3, z);
    c.fov = 34; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    GAME.gfx.composer.render();
    // (read straight back after the render, before the buffer is cleared)
    if (window.__yawLog) console.log('yaw', g.rotation.y.toFixed(2), p.vis.rotation.y.toFixed(2), p.vis.rotation.z.toFixed(2), p.flip ? (p.flip.p || 0).toFixed(2) : '-', p.grounded);
    return { yaw: g.rotation.y + p.vis.rotation.y, img: shoot ? GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.85) : null };
  }, !!file);
  if (file) writeFileSync(file, Buffer.from(r.img.split(',')[1], 'base64'));
  return r.yaw;
}
const press = (k, hold = 40) => page.evaluate(([k, hold]) => {
  const down = new KeyboardEvent('keydown', { key: k }); document.dispatchEvent(down);
  setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { key: k })), hold);
}, [k, hold]);
const hold = (k, on) => page.evaluate(([k, on]) => document.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: k })), [k, on]);

for (const form of FORMS){
  await page.evaluate(f => { GAME.setLoadout([f, null, null]); GAME.switchStance(f, true); GAME.G.stanceCd = 0; }, form);
  for (const move of MOVES){
    // reset: on the ground, standing still, a fresh charge of everything
    await page.evaluate(() => { const p = GAME.player; p.vel.set(0, 0, 0); p.moveVel.set(0, 0, 0); p.force = p.maxForce || 100; p.cds.dash = 0; p.airLeft = 1; p.dashCharges = 9; GAME.G.yaw = 0; });
    for (let i = 0; i < 20; i++) await frame();
    const dir = path.join(out, `${form}-${move}`); mkdirSync(dir, { recursive: true });
    let n = 0; const shot = () => frame(path.join(dir, String(n++).padStart(3, '0') + '.jpg'));
    const yaws = [];
    const track = async k => { for (let i = 0; i < k; i++) yaws.push(await shot()); };
    const runKey = move === 'dashb' || move === 'evadeb' ? 's' : move === 'dashs' || move === 'evades' ? 'd' : 'w';
    if (move !== 'evadeb' && move !== 'jump') await hold(runKey, true);
    await track(8);
    if (move === 'jump'){ await press(' '); await track(30); }
    else if (move === 'double'){ await press(' '); await track(7); await press(' '); await track(36); }
    else if (move.startsWith('dash')){ await press('Shift'); await track(26); }
    else if (move.startsWith('evade')){
      if (move === 'evadeb') await hold('s', false);
      await page.evaluate(() => { GAME.player.blockHeld = true; });
      await press(' ');
      await page.evaluate(() => { GAME.player.blockHeld = false; });
      await track(34);
    }
    await hold(runKey, false);
    await track(12);
    // the biggest frame-to-frame turn of the body: a big one is a snap
    let worst = 0;
    for (let i = 1; i < yaws.length; i++){ const d = Math.abs(Math.atan2(Math.sin(yaws[i] - yaws[i-1]), Math.cos(yaws[i] - yaws[i-1]))); worst = Math.max(worst, d); }
    console.log(`${form} ${move}: ${n} frames, biggest yaw step ${worst.toFixed(2)} rad`);
  }
}
await browser.close();
