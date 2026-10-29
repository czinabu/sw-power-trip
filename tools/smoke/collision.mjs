// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// COLLISION SMOKE TEST — serves the game's sources (Vite dev server), builds every arena layout unbaked and audits it
// (tools/collision-audit.js): fails on any prop in the play space you would walk through, sink into, or fall through
// from above. Then it drops the hero onto a few of the shapes the audit can't judge by eye (a hill at a battle map's
// edge, a dome on a spaceport roof, a market awning, the transport's wing) and checks the body stands on them.
//   npm run smoke:collision          (MAPS=grassland,pursuit audits only those layouts)

import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-proxy-server', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
page.setDefaultTimeout(0);
const errors = [];
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
await page.addInitScript(() => { try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); } catch(e){} });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };

try {
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
  const maps = process.env.MAPS ? process.env.MAPS.split(',') : undefined;
  const result = await page.evaluate(async maps => (await import('/tools/collision-audit.js')).auditMaps({ maps }), maps);
  for (const r of result){
    if (r.error){ check(false, `${r.id}: ${r.error}`); continue; }
    check(!r.misses.length && !r.ledges.length, `${r.id}: ${r.solids} solids, ${r.misses.length} props to walk through, ${r.ledges.length} to fall through`);
    for (const m of r.misses) console.log(`    walk-through ${m.prop}${m.backdrop ? ' (backdrop)' : ''}: ${m.area} m², sinks ${m.sink} m (worst at x ${m.at[0]}, z ${m.at[1]}, top ${m.at[2]})`);
    for (const m of r.ledges) console.log(`    fall-through ${m.prop}: ${m.area} m², top ${m.top}`);
  }

  // STAND ON IT — build a layout the way the game does, put a body over a spot and let collision settle it
  const stand = (layout, find) => page.evaluate(async ([layout, find]) => {
    const { buildArena } = await import('/src/world/arena.js');
    const { collideSolids, groundAt, moundY } = await import('/src/world/collision.js');
    const { solids } = await import('/src/state.js');
    const L = (await import('/tools/collision-audit.js')).levelFor(layout);
    buildArena(L);
    const c = solids.find(new Function('c', 'return ' + find));
    if (!c) return { error: 'no such solid' };
    const p = { x: c.x, y: 30, z: c.z };
    // fall onto it, the way a landing does: drop, collide (climbing), settle on the support
    for (let i = 0; i < 400; i++){ p.y -= 0.12; const s = collideSolids(p, 0.55, true); if (p.y <= s){ p.y = s; break; } }
    const want = c.mound ? moundY(c, c.x, c.z) : c.h;
    return { y: +p.y.toFixed(2), want: +want.toFixed(2), ground: +groundAt(p.x, p.z, p.y + 0.5).toFixed(2) };
  }, [layout, find]);
  for (const [layout, find, what] of [
    ['grassland', 'c.mound', 'a hill at the Grass Sea\'s edge'],
    ['pursuit', 'c.mound', 'a dome on a spaceport roof'],
    ['pursuit', 'c.soft', 'a market awning'],
    ['refuge', 'c.y0 && c.hx > 2.5', 'the transport\'s wing'],
    ['pursuit', 'c.y0 && c.hx > 20', 'the hangar crane\'s beam'],
  ]){
    const s = await stand(layout, find);
    check(!s.error && Math.abs(s.y - s.want) < 0.05 && s.y > 0.5, `${what}: lands at ${s.y} (top ${s.want}, ground ${s.ground})${s.error ? ' ' + s.error : ''}`);
  }
  // WALK UNDER IT — a body on the street walks under the awnings and the crane's beam without being shoved
  const under = await page.evaluate(async () => {
    const { collideSolids, ceilHit } = await import('/src/world/collision.js');
    const { solids } = await import('/src/state.js');
    const c = solids.find(c => c.y0 && !c.soft && c.hx > 20);
    const p = { x: c.x, y: 0, z: c.z };
    collideSolids(p, 0.55, true);
    return { moved: Math.hypot(p.x - c.x, p.z - c.z), ceil: (await import('/src/world/collision.js')).ceilHit };
  });
  check(under.moved < 1e-6 && under.ceil === Infinity, `walking under the crane's beam: shoved ${under.moved.toFixed(2)} m, head ${under.ceil === Infinity ? 'clear' : 'bonked'}`);
} catch (e){
  check(false, 'the collision run: ' + (e.stack || e.message));
}
for (const e of errors) check(false, e);
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
