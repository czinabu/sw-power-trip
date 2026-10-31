// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MAP AUDIT — boots the BUILT game (dist/index.html) headlessly, builds every map in turn (GAME.mapLevels) and draws a
// top-down PLAN of each one (north, the hero's spawn side, is up) with a level-design read-out beside it:
//   · solids shaded by what they do: a step you walk up, cover you can vault (< 1.93), hard cover, a wall-kick column,
//     an overhead slab; hazard zones and fuel drums in their warning colours; the hero's spawn and the enemy edge ring;
//   · a heat wash of EXPOSURE: open floor shaded by how far it is from the nearest cover a body can hide behind;
//   · cells a trooper can reach but a brute can't (chokes), and floor no grounded foe can reach at all (pockets).
// The numbers go to <outDir>/audit.json so a layout pass can be compared before and after.
//   npm run build && node tools/shots/map-audit.mjs [outDir] [map,map,...]

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'shots/audit');
const only = process.argv[3] ? process.argv[3].split(',') : null;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.addInitScript(() => {
  try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');
        localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('audit', 'NotSupportedError')); };
});
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

const maps = await page.evaluate(() => Object.keys(GAME.mapLevels()));
const report = {};
for (const id of maps){
  if (only && !only.includes(id)) continue;
  const res = await page.evaluate(id => {
    const { solids, hazardZones, shared } = GAME, L = GAME.mapLevels()[id];
    GAME.sandboxClear();
    GAME.buildArena(L);
    const hx = shared.arenaHalf, hz = shared.arenaHalfZ, big = shared.arenaBig;
    const APEX = 1.93, HARD = 1.5, STEP = 0.5;
    // ---- what each solid does ----
    const kind = c => c.y0 ? 'slab' : c.mound ? 'mound' : (c.climbable && c.h <= STEP + 0.05) || c.h <= STEP ? 'step'
      : !c.box ? 'column' : c.h < HARD ? 'low' : c.h < APEX ? 'vault' : 'hard';
    const ground = solids.filter(c => !c.y0 && !c.mound);
    const cover = ground.filter(c => c.h >= 1.2 && !(c.climbable && c.h <= STEP + 0.05));   // a crouched body hides behind it
    const distTo = (c, x, z) => c.box ? Math.hypot(Math.max(0, Math.abs(x - c.x) - c.hx), Math.max(0, Math.abs(z - c.z) - c.hz))
      : Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r);
    const inside = (x, z) => ground.some(c => c.h > STEP + 0.05 && !c.climbable && distTo(c, x, z) <= 0);
    // ---- exposure grid: open floor, its distance to the nearest cover ----
    const CS = big ? 2 : 1;
    let open = 0, exposed = 0, sheltered = 0, worst = 0, sum = 0;
    const cells = [];
    for (let x = -hx + CS/2; x < hx; x += CS) for (let z = -hz + CS/2; z < hz; z += CS){
      if (inside(x, z)) continue;
      let d = 99; for (const c of cover){ const e = distTo(c, x, z); if (e < d) d = e; }
      open++; sum += Math.min(d, 30); if (d > 8) exposed++; if (d < 3) sheltered++; if (d > worst && d < 99) worst = d;
      cells.push([x, z, d]);
    }
    // ---- reachability from the flow field's clearance (a trooper / a brute) ----
    const N = GAME.nav.NAV; let choke = 0, pocket = 0;
    const chokeCells = [], pocketCells = [];
    if (N && N.clear && !big){
      const n = N.n, nz = N.nz, cx = ix => N.ox + (ix + 0.5) * 0.6, cz = iz => N.oz + (iz + 0.5) * 0.6;
      // flood each body size from the edge ring (where the foes arrive): what can a trooper reach, what can a brute?
      const flood = need => {
        const seen = new Uint8Array(n * nz), q = [];
        for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < n; ix++){
          const i = iz * n + ix, r = Math.hypot(cx(ix) / hx, cz(iz) / hz);
          if (r > 0.75 && r < 0.92 && N.clear[i] >= need){ seen[i] = 1; q.push(i); }
        }
        while (q.length){ const i = q.pop(), ix = i % n, iz = (i / n) | 0;
          for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]){ const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= n || jz >= nz) continue;
            const j = jz * n + jx; if (!seen[j] && N.clear[j] >= need){ seen[j] = 1; q.push(j); } } }
        return seen;
      };
      const trooper = flood(0.62), brute = flood(0.95);
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < n; ix++){
        const i = iz * n + ix, x = cx(ix), z = cz(iz);
        if (N.clear[i] < 0.62) continue;
        if (!trooper[i]){ pocket++; pocketCells.push([x, z]); }            // floor no grounded foe reaches
        else if (N.clear[i] >= 0.95 && !brute[i]){ choke++; chokeCells.push([x, z]); }   // open floor a brute can't get to
      }
    }
    // ---- sightlines: the longest straight run at chest height (1.3) through open floor, sampled across the plan ----
    const blocks = (x, z) => ground.some(c => c.h >= 1.3 && distTo(c, x, z) <= 0);
    let longest = 0;
    for (let k = 0; k < 64; k++){
      const a = k / 64 * Math.PI;
      for (let o = -0.8; o <= 0.8; o += 0.2){
        let run = 0, best = 0;
        const dx = Math.cos(a), dz = Math.sin(a), px = -dz * o * hx, pz = dx * o * hz;
        for (let t = -Math.max(hx, hz) * 1.5; t < Math.max(hx, hz) * 1.5; t += 0.5){
          const x = px + dx * t, z = pz + dz * t;
          if (Math.abs(x) > hx || Math.abs(z) > hz) { run = 0; continue; }
          if (blocks(x, z)) run = 0; else { run += 0.5; if (run > best) best = run; }
        }
        if (best > longest) longest = best;
      }
    }
    const heights = [...new Set(ground.filter(c => c.h >= 0.4).map(c => Math.round(c.h * 2) / 2))].sort((a, b) => a - b);
    const spawn = GAME.findClearSpawn(0, hx * 0.5, 1.55);
    let spawnCover = 99; for (const c of cover) spawnCover = Math.min(spawnCover, distTo(c, spawn.x, spawn.z));
    const counts = {}; for (const c of solids){ const k = kind(c); counts[k] = (counts[k] || 0) + 1; }
    // ---- the plan ----
    const PX = 900, sc = (PX - 40) / (2 * Math.max(hx, hz)), W = Math.round(hx * 2 * sc + 40), H = Math.round(hz * 2 * sc + 40);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const X = x => 20 + (x + hx) * sc, Z = z => 20 + (hz - z) * sc;   // +z (north, the spawn side) up
    g.fillStyle = '#1a1c20'; g.fillRect(0, 0, W, H);
    for (const [x, z, d] of cells){
      const t = Math.min(d, 12) / 12;
      g.fillStyle = d > 8 ? `rgba(220,70,50,${0.25 + t * 0.35})` : d < 3 ? 'rgba(80,140,90,0.55)' : `rgba(200,170,80,${0.25 + t * 0.3})`;
      g.fillRect(X(x - CS/2), Z(z + CS/2), CS * sc + 0.5, CS * sc + 0.5);
    }
    g.fillStyle = 'rgba(255,0,255,0.8)'; for (const [x, z] of chokeCells) g.fillRect(X(x - 0.3), Z(z + 0.3), 0.6 * sc, 0.6 * sc);
    g.fillStyle = 'rgba(0,200,255,0.8)'; for (const [x, z] of pocketCells) g.fillRect(X(x - 0.3), Z(z + 0.3), 0.6 * sc, 0.6 * sc);
    const col = { step: '#8a8f80', low: '#b0a070', vault: '#d0b050', hard: '#f0f0f0', column: '#a0c8ff', mound: '#607050' };
    for (const c of solids){
      const k = kind(c);
      if (k === 'slab'){ g.strokeStyle = 'rgba(160,200,255,0.7)'; g.setLineDash([3, 3]); g.strokeRect(X(c.x - c.hx), Z(c.z + c.hz), c.hx * 2 * sc, c.hz * 2 * sc); g.setLineDash([]); continue; }
      if (c.mound){ g.fillStyle = 'rgba(96,112,80,0.35)'; g.beginPath(); g.arc(X(c.x), Z(c.z), (c.r || 3) * sc, 0, 7); g.fill(); continue; }
      g.fillStyle = col[k];
      if (c.box) g.fillRect(X(c.x - c.hx), Z(c.z + c.hz), c.hx * 2 * sc, c.hz * 2 * sc);
      else { g.beginPath(); g.arc(X(c.x), Z(c.z), c.r * sc, 0, 7); g.fill(); }
      if (c.h >= 2.5 && (c.box ? c.hx * c.hz : c.r * c.r) * sc * sc > 120){ g.fillStyle = '#222'; g.font = '10px sans-serif'; g.fillText(c.h.toFixed(1), X(c.x) - 8, Z(c.z) + 4); }
    }
    for (const hzn of hazardZones){
      g.strokeStyle = '#ff3030'; g.lineWidth = 2;
      if (hzn.kind === 'point'){ g.beginPath(); g.arc(X(hzn.cx), Z(hzn.cz), hzn.r * sc, 0, 7); g.stroke(); }
      else { g.save(); g.translate(X(hzn.cx), Z(hzn.cz)); g.rotate(-Math.atan2(hzn.dirZ, hzn.dirX)); g.strokeRect(-hzn.halfLen * sc, -hzn.halfW * sc, hzn.halfLen * 2 * sc, hzn.halfW * 2 * sc); g.restore(); }
      g.lineWidth = 1;
    }
    // the enemy edge ring and the hero's spawn
    if (!big){ g.strokeStyle = 'rgba(255,90,90,0.6)'; g.setLineDash([6, 4]);
      for (const r of [0.75, 0.92]){ g.beginPath(); g.ellipse(X(0), Z(0), hx * r * sc, hz * r * sc, 0, 0, 7); g.stroke(); } g.setLineDash([]); }
    g.fillStyle = '#40ff80'; g.beginPath(); g.arc(X(spawn.x), Z(spawn.z), 7, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.fillText(id + '  (' + (hx * 2).toFixed(0) + ' × ' + (hz * 2).toFixed(0) + ' m)', 24, 16);
    return {
      img: cv.toDataURL('image/png'),
      m: { size: [hx * 2, hz * 2], solids: solids.length, counts, coverPieces: cover.length,
        exposedPct: Math.round(exposed / open * 100), shelteredPct: Math.round(sheltered / open * 100),
        meanCoverDist: +(sum / open).toFixed(1), worstCoverDist: +worst.toFixed(1), longestSightline: longest,
        heights, chokeCells: choke, pocketCells: pocket, spawn: [+spawn.x.toFixed(1), +spawn.z.toFixed(1)], spawnCoverDist: +spawnCover.toFixed(1),
        hazards: hazardZones.length },
    };
  }, id);
  writeFileSync(path.join(out, id + '.png'), Buffer.from(res.img.split(',')[1], 'base64'));
  report[id] = res.m;
  console.log(id.padEnd(10), JSON.stringify(res.m));
}
writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 1));
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
await browser.close();
