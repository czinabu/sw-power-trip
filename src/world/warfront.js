// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WAR BEYOND THE WALLS: a battle that never stops past the arena edge, so a fight in a courtyard reads as one corner
// of something huge. Fighters and dropships cross the sky in formation, AT-ATs march on the horizon with snowspeeders
// circling them, blasts go up across the city, smoke columns climb from what's already burning, and tracer fire
// streaks between the lines. A world lists what it has in `warfront` (data/worlds.js), true to its place in the
// films; a world without one (the training rooms) stays quiet. Purely visual: no collision, no damage, nothing the
// hero can reach. Everything here stands outside the play space and takes the backdrop's far haze (world/ink.js).
//
// Sizes follow the backdrop's HERO_SCALE (everyone is ~1.5× life size): a TIE fighter is 11 m across, an X-wing
// 19 m long, an AT-AT 34 m tall. Cost: a handful of merged ship meshes, two walkers, and three instanced pools
// (tracers, flashes, smoke), so the whole battle is roughly 20-30 draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from '../utils.js';
import { shared, G } from '../state.js';
import { farHaze } from './ink.js';
import { fightMood } from './atmosphere.js';
import { distantBoom } from '../audio/director.js';
import { camera } from '../engine/renderer.js';

const PI = Math.PI;
const W = { on: false };   // the live battle (one per arena build)

/* ---------- ships: each one a single merged, vertex-coloured mesh, nose along +z (so lookAt points it) ---------- */
function part(list, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1){
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  list.push(g);
}
const SHIPS = {
  // TIE fighter (7.2 m → 11 m): ball cockpit, two hexagonal wing panels
  tie(o){ const L = [], hull = o.color ?? 0x6a7078, panel = o.color2 ?? 0x23262e;
    part(L, new THREE.IcosahedronGeometry(1.7, 1), hull);
    part(L, new THREE.CylinderGeometry(0.5, 0.5, 8.4, 6), hull, 0, 0, 0, 0, 0, PI/2);
    for (const s of [-1, 1]) part(L, new THREE.CylinderGeometry(5.4, 5.4, 0.35, 6), panel, s*4.4, 0, 0, 0, 0, PI/2);
    return { L, engine: [[0, 0, -1.6]], glow: 0xff6a4a }; },
  // X-wing (12.5 m → 19 m): long nose, four wings in an X, four engines
  xwing(o){ const L = [], hull = o.color ?? 0xd0ccc4, mark = o.color2 ?? 0xb0402a;
    part(L, new THREE.BoxGeometry(1.6, 1.5, 11), hull, 0, 0, 1);
    part(L, new THREE.ConeGeometry(0.8, 6, 4), hull, 0, 0, 9.4, PI/2, 0, PI/4);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
      part(L, new THREE.BoxGeometry(8.5, 0.25, 3.2), sx > 0 ? hull : mark, sx*4.6, sy*1.2, -3, 0, 0, sy*sx*0.22);
      part(L, new THREE.CylinderGeometry(0.55, 0.55, 4, 8), hull, sx*1.6, sy*0.9, -4, PI/2, 0, 0);
    }
    return { L, engine: [[1.6, 0.9, -6], [-1.6, 0.9, -6], [1.6, -0.9, -6], [-1.6, -0.9, -6]], glow: 0xff7a5a }; },
  // snowspeeder (5.3 m → 8 m): a flat wedge with a raised cockpit, orange flashes
  speeder(o){ const L = [], hull = o.color ?? 0xd8d2c6, mark = o.color2 ?? 0xd8702a;
    part(L, new THREE.BoxGeometry(4.6, 1.2, 6.4), hull, 0, 0, 0);
    part(L, new THREE.ConeGeometry(2.4, 3.2, 4), hull, 0, 0, 4.6, PI/2, 0, PI/4, 1, 1, 0.45);
    part(L, new THREE.BoxGeometry(1.8, 0.9, 2.2), mark, 0, 0.9, 0.6);
    for (const s of [-1, 1]) part(L, new THREE.BoxGeometry(0.9, 0.9, 3), mark, s*2.6, 0, -1.4);
    return { L, engine: [[2.6, 0, -3], [-2.6, 0, -3]], glow: 0xffa060 }; },
  // Imperial dropship / lander (≈40 m): a slab hull, folded wings, a bank of engines
  dropship(o){ const L = [], hull = o.color ?? 0x8a8e96, dark = o.color2 ?? 0x50545c;
    part(L, new THREE.BoxGeometry(10, 6, 26), hull, 0, 0, 0);
    part(L, new THREE.BoxGeometry(6, 4, 8), dark, 0, 3.4, 6);
    part(L, new THREE.ConeGeometry(5.5, 8, 4), hull, 0, 0, 17, PI/2, 0, PI/4, 1, 1, 0.6);
    for (const s of [-1, 1]) part(L, new THREE.BoxGeometry(14, 0.8, 9), dark, s*11, 1.6, -4, 0, 0, s*-0.5);
    return { L, engine: [[3, 0, -13.2], [-3, 0, -13.2], [0, 1.5, -13.2]], glow: 0x9ad8ff }; },
  // a light freighter (35 m → 52 m): the saucer, two forward mandibles, the cockpit tube off to the side
  freighter(o){ const L = [], hull = o.color ?? 0xb8b2a6, dark = o.color2 ?? 0x7a766e;
    part(L, new THREE.CylinderGeometry(17, 18, 4.5, 20), hull);
    for (const s of [-1, 1]) part(L, new THREE.BoxGeometry(5, 3.6, 16), hull, s*4.5, 0, 22);
    part(L, new THREE.CylinderGeometry(2.2, 2.2, 12, 10), dark, 18, 0, 8, PI/2, 0, 0);
    part(L, new THREE.CylinderGeometry(4, 4, 1.2, 12), dark, 0, 2.8, 0);
    return { L, engine: [[0, 0, -17.6]], glow: 0x9ad8ff, wide: 20 }; },
};
const shipCache = new Map();
function shipGeo(kind, o){
  const id = kind + '|' + (o.color ?? '') + '|' + (o.color2 ?? '');
  if (!shipCache.has(id)){
    const s = SHIPS[kind](o), big = kind === 'dropship' || kind === 'freighter' ? 2.4 : 1;
    // the engine glows, merged into one unlit mesh per ship
    const eng = mergeGeometries(s.engine.map(e => new THREE.SphereGeometry(0.7 * big, 8, 6).translate(e[0], e[1], e[2])), false);
    shipCache.set(id, { geo: mergeGeometries(s.L, false), eng, glow: s.glow });
  }
  return shipCache.get(id);
}
const shipMat = farHaze(new THREE.MeshToonMaterial({ vertexColors: true }));
const glowMats = new Map();
const glowMat = c => { if (!glowMats.has(c)) glowMats.set(c, new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false })); return glowMats.get(c); };

/* ---------- an AT-AT (22.5 m → 34 m tall) that marches: a body and four legs that swing in the walk ---------- */
function walker(o){
  const g = new THREE.Group(), L = [], hull = o.color ?? 0x7a8494, dark = o.color2 ?? 0x5e6878;
  part(L, new THREE.BoxGeometry(9, 8.5, 21), hull, 0, 27, 0);
  part(L, new THREE.BoxGeometry(7, 3, 17), dark, 0, 31.5, 0);
  part(L, new THREE.CylinderGeometry(1.8, 1.8, 6, 8), dark, 0, 26, 12.5, PI/2, 0, 0);
  part(L, new THREE.BoxGeometry(5, 5, 8), hull, 0, 25.5, 18.5);
  part(L, new THREE.BoxGeometry(5.2, 1.4, 1), dark, 0, 26, 22.6);
  const body = new THREE.Mesh(mergeGeometries(L, false), shipMat); g.add(body);
  const legGeo = (() => { const l = []; part(l, new THREE.BoxGeometry(2.4, 11, 2.4), hull, 0, -5.5, 0); part(l, new THREE.BoxGeometry(2, 11, 2), dark, 0, -16.5, 0);
    part(l, new THREE.CylinderGeometry(2.4, 2.8, 1.4, 10), dark, 0, -22.3, 0); return mergeGeometries(l, false); })();
  const legs = [];
  for (const [lx, lz, ph] of [[3.6, 7.5, 0], [-3.6, 7.5, PI], [3.6, -7.5, PI], [-3.6, -7.5, 0]]){
    const leg = new THREE.Mesh(legGeo, shipMat); leg.position.set(lx, 23, lz); leg.userData.ph = ph; g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs; g.userData.head = new THREE.Vector3(0, 25.5, 23);
  return g;
}

/* ---------- placement: a point on the battle ring, an ellipse round the (possibly long) play space ---------- */
function ringPoint(r0, r1, out = new THREE.Vector3(), a = rand(0, PI*2)){
  const r = rand(r0, r1);
  return out.set(Math.cos(a) * r * W.half + W.cx, 0, Math.sin(a) * r * W.halfZ + W.cz);
}

/* build the battle for a world (called from world/arena.js buildWorld once the backdrop is up) */
export function buildWarfront(T, L){
  clearWarfront();
  const F = T.warfront;
  if (!F) return;
  const grp = new THREE.Group(); grp.userData.noBake = true;
  shared.arenaGroup.add(grp);
  Object.assign(W, { on: true, F, grp, half: L.arena / 2, halfZ: (L.arenaZ || L.arena) / 2, cx: 0, cz: 0,
    ships: [], walkers: [], tracers: [], flashes: [], puffs: [], columns: [], later: [], nextBlast: rand(0.5, 2), nextVolley: rand(0.2, 1), t: 0 });
  W.reach = F.reach ?? [1.5, 4.5];   // the ring the ground battle fills, in half-widths of the play space

  // FLIGHTS — each entry is a group that crosses the sky, leaves, and comes back on a new heading
  for (const fl of F.flyers || []){
    for (let k = 0; k < (fl.count || 1); k++){
      const s = shipGeo(fl.kind, fl), wing = [];
      for (let j = 0; j < (fl.wing || 1); j++){
        const m = new THREE.Group();
        m.add(new THREE.Mesh(s.geo, shipMat));
        m.add(new THREE.Mesh(s.eng, glowMat(fl.glow ?? s.glow)));
        grp.add(m); wing.push(m);
      }
      const sh = { fl, wing, t: 0, dur: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), wait: k * rand(2, 5) + rand(0, 3), fireT: rand(0.3, 1.2) };
      for (const m of wing) m.visible = false;
      W.ships.push(sh);
    }
  }
  // WALKERS — AT-ATs marching slowly across the far field, speeders circling them
  for (let k = 0; k < (F.walkers || 0); k++){
    const g = walker(F.walker || {}); grp.add(g);
    const a = (F.walkerAz ?? -PI/2) + (k - ((F.walkers || 1) - 1) / 2) * 0.5;
    ringPoint(W.reach[1] * 0.75, W.reach[1] * 0.75, g.position, a);
    g.lookAt(W.cx, 0, W.cz);   // they march inward, toward the fight
    W.walkers.push({ g, step: rand(0, PI*2), fireT: rand(1, 3) });
  }
  for (const w of W.walkers) for (let j = 0; j < (F.speedersPer || 0); j++){
    const s = shipGeo('speeder', {}), m = new THREE.Group();
    m.add(new THREE.Mesh(s.geo, shipMat));
    grp.add(m);
    W.ships.push({ orbit: w, wing: [m], ang: j * PI, rad: rand(38, 55), alt: rand(10, 18), spd: rand(0.35, 0.5) * (j % 2 ? -1 : 1), fireT: rand(0.5, 1.5) });
  }
  // TRACERS, FLASHES, SMOKE — instanced pools; an unused slot is scaled to nothing
  const tr = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), 40);
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), 10);
  const pf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), farHaze(new THREE.MeshToonMaterial({ color: 0xffffff })), 140);
  for (const im of [tr, fl, pf]){ im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hideAll(im); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(im.count * 3), 3); grp.add(im); }
  W.tr = tr; W.fl = fl; W.pf = pf;
  W.smokeCol = new THREE.Color(F.smoke ?? 0x3a3634);
  // COLUMNS — fires already burning out there, each sending up a slow, leaning plume
  for (let k = 0; k < (F.columns || 0); k++) W.columns.push({ p: ringPoint(W.reach[0] + 0.3, W.reach[1], new THREE.Vector3()), every: rand(0.45, 0.8), t: rand(0, 1), size: rand(0.8, 1.4) });
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function hideAll(im){ for (let i = 0; i < im.count; i++) im.setMatrixAt(i, ZERO); im.instanceMatrix.needsUpdate = true; }

export function clearWarfront(){ W.on = false; W.grp = null; }

/* ---------- spawners ---------- */
function tracer(from, to, color, speed = 260){
  if (W.tracers.length >= W.tr.count) return;
  W.tracers.push({ a: from.clone(), b: to.clone(), t: 0, dur: from.distanceTo(to) / speed, color });
}
function flash(p, size){
  if (W.flashes.length >= W.fl.count) return;
  W.flashes.push({ p: p.clone(), t: 0, size });
  const d = p.distanceTo(camera.position);
  if (G.mode === 'play' && !G.paused) distantBoom(d);
  for (let k = 0; k < 4; k++) puff(_v.set(p.x + rand(-3, 3) * size * 0.1, p.y + k * size * 0.25, p.z + rand(-3, 3) * size * 0.1), size * rand(0.35, 0.6), rand(5, 8), 3);
}
function puff(p, size, life, rise){
  if (W.puffs.length >= W.pf.count) return;
  W.puffs.push({ p: p.clone(), size, life, rise, t: 0, drift: rand(0.6, 1.4) });
}
/* a skirmish somewhere on the ring: two knots of fighters trading fire across a gap */
function volley(){
  const F = W.F, cols = F.tracers?.colors || [0xff3a2a, 0x3aff6a];
  const a = rand(0, PI*2), A = ringPoint(W.reach[0], W.reach[1], new THREE.Vector3(), a), B = ringPoint(W.reach[0], W.reach[1], new THREE.Vector3(), a + rand(0.15, 0.5) * (Math.random() < 0.5 ? -1 : 1));
  A.y = rand(1, 4); B.y = rand(1, 4);
  const n = 2 + Math.floor(Math.random() * 4), side = Math.random() < 0.5;
  for (let k = 0; k < n; k++){
    const [s, e] = (k + (side ? 1 : 0)) % 2 ? [A, B] : [B, A];
    _v.copy(s).add(_w.set(rand(-6, 6), rand(0, 2), rand(-6, 6))); _s.copy(e).add(_w.set(rand(-8, 8), rand(-1, 3), rand(-8, 8)));
    W.tracers.length < W.tr.count && W.tracers.push({ a: _v.clone(), b: _s.clone(), t: -k * 0.12, dur: _v.distanceTo(_s) / 220, color: cols[((k + (side ? 1 : 0)) % 2) % cols.length] });
  }
}

/* ---------- the per-frame update (fx/ambient.js) ---------- */
export function updateWarfront(dt){
  if (!W.on || !W.grp) return;
  const F = W.F, mood = fightMood(), heat = 1 + mood * 1.5;
  W.t += dt;
  // ships
  for (const sh of W.ships){
    if (sh.orbit){   // a speeder circling its walker, strafing it now and then
      sh.ang += sh.spd * dt;
      const c = sh.orbit.g.position, m = sh.wing[0];
      m.position.set(c.x + Math.cos(sh.ang) * sh.rad, sh.alt + Math.sin(W.t * 0.7 + sh.rad) * 3, c.z + Math.sin(sh.ang) * sh.rad);
      _v.set(c.x + Math.cos(sh.ang + Math.sign(sh.spd) * 0.2) * sh.rad, m.position.y, c.z + Math.sin(sh.ang + Math.sign(sh.spd) * 0.2) * sh.rad);
      m.lookAt(_v); m.rotateZ(-Math.sign(sh.spd) * 0.5);
      if ((sh.fireT -= dt) <= 0){ sh.fireT = rand(0.8, 2.2); tracer(m.position, _w.copy(c).setY(rand(18, 30)), F.tracers?.colors?.[1] ?? 0xff5a3a, 300); }
      continue;
    }
    const fl = sh.fl;
    if (sh.dur <= 0){
      if ((sh.wait -= dt) > 0) continue;
      // a new pass: in from one side of the sky, out the other, across the arena or along its flank
      const D = Math.max(W.half, W.halfZ) * (fl.far ?? 6), alt = rand(...(fl.alt || [30, 80])), a = rand(0, PI*2), off = rand(-1, 1) * Math.max(W.half, W.halfZ) * (fl.spread ?? 2.5);
      const ox = -Math.sin(a) * off, oz = Math.cos(a) * off;
      sh.from.set(W.cx + Math.cos(a) * D + ox, alt, W.cz + Math.sin(a) * D + oz);
      sh.to.set(W.cx - Math.cos(a) * D + ox, alt + rand(-15, 15), W.cz - Math.sin(a) * D + oz);
      sh.dur = sh.from.distanceTo(sh.to) / rand(...(fl.speed || [60, 100])); sh.t = 0;
      for (const m of sh.wing) m.visible = true;
    }
    sh.t += dt;
    const k = sh.t / sh.dur;
    sh.wing.forEach((m, j) => {
      // a loose formation: wingmen trail back and out to alternating sides
      _v.lerpVectors(sh.from, sh.to, k);
      _w.subVectors(sh.to, sh.from).normalize();
      const side = j === 0 ? 0 : (j % 2 ? 1 : -1) * Math.ceil(j / 2), back = Math.ceil(j / 2) * 22;
      m.position.set(_v.x - _w.x * back - _w.z * side * 16, _v.y + side * 2 + Math.sin(W.t * 1.3 + j) * 1.5, _v.z - _w.z * back + _w.x * side * 16);
      _s.copy(m.position).add(_w);
      m.lookAt(_s); m.rotateZ(Math.sin(W.t * 0.9 + j * 2) * 0.25);
    });
    if (fl.fire && (sh.fireT -= dt) <= 0){   // fighters strafe the ground battle as they pass
      sh.fireT = rand(0.4, 1.1) / heat;
      const m = sh.wing[Math.floor(Math.random() * sh.wing.length)];
      _w.subVectors(sh.to, sh.from).normalize();
      tracer(m.position, _v.copy(m.position).addScaledVector(_w, 160).setY(0), fl.fire, 340);
    }
    if (k >= 1){ sh.dur = 0; sh.wait = rand(...(fl.every || [4, 12])) / heat; for (const m of sh.wing) m.visible = false; }
  }
  // walkers: a slow, heavy stride toward the fight, firing their chin guns into the lines
  for (const w of W.walkers){
    w.step += dt * 0.9;
    const g = w.g, legs = g.userData.legs;
    for (const l of legs) l.rotation.x = Math.sin(w.step + l.userData.ph) * 0.22;
    g.position.y = Math.abs(Math.sin(w.step)) * 0.5;
    const dist = Math.hypot(g.position.x - W.cx, g.position.z - W.cz);
    if (dist > Math.max(W.half, W.halfZ) * (W.reach[0] + 0.6)) g.translateZ(dt * 4);   // they stop short of the walls
    if ((w.fireT -= dt) <= 0){
      w.fireT = rand(1.2, 3) / heat;
      _v.copy(g.userData.head).applyMatrix4(g.matrixWorld);
      g.getWorldDirection(_w);
      const hit = _v.clone().addScaledVector(_w, rand(80, 160)).add(_s.set(rand(-30, 30), 0, rand(-30, 30))).setY(0);
      const col = F.tracers?.colors?.[0] ?? 0xff3a2a;
      tracer(_v, hit, col, 200);
      tracer(_v.add(_s.set(1.5, 0, 0)), hit, col, 200);
      if (Math.random() < 0.6) W.later.push({ t: hit.distanceTo(_v) / 200, p: hit.setY(2) });
    }
  }
  // walker shots landing
  W.later = W.later.filter(h => (h.t -= dt) > 0 || (flash(h.p, rand(8, 13)), false));
  // the ground battle: blasts and volleys, faster as the fight climbs
  if (F.blasts && (W.nextBlast -= dt) <= 0){
    W.nextBlast = rand(0.6, 1.6) / (F.blasts * heat);
    const p = ringPoint(W.reach[0] + 0.3, W.reach[1], new THREE.Vector3()); p.y = rand(0, 4);
    flash(p, rand(9, 16) * (F.blastSize ?? 1));
  }
  if (F.tracers && (W.nextVolley -= dt) <= 0){ W.nextVolley = rand(0.3, 1.0) / ((F.tracers.rate ?? 1) * heat); volley(); }
  for (const c of W.columns){
    if ((c.t -= dt) <= 0){ c.t = c.every; puff(_v.copy(c.p).add(_w.set(rand(-3, 3), 0, rand(-3, 3))), rand(10, 14) * c.size, rand(12, 16), 7); }
  }
  // draw the pools
  let i = 0;
  W.tracers = W.tracers.filter(t => (t.t += dt) < t.dur);
  for (const t of W.tracers){
    if (t.t < 0) continue;
    const k = t.t / t.dur;
    _v.lerpVectors(t.a, t.b, k); _w.subVectors(t.b, t.a).normalize();
    const d = _v.distanceTo(camera.position), th = Math.max(0.3, d * 0.004);   // thicker with distance so it still reads
    _q.setFromUnitVectors(_s.set(0, 0, 1), _w);
    W.tr.setMatrixAt(i, _m.compose(_v, _q, _s.set(th, th, Math.max(8, d * 0.06))));
    W.tr.setColorAt(i, _c.setHex(t.color).multiplyScalar(2.2));
    i++;
  }
  for (; i < W.tr.count; i++) W.tr.setMatrixAt(i, ZERO);
  W.tr.instanceMatrix.needsUpdate = true; W.tr.instanceColor.needsUpdate = true;
  i = 0;
  W.flashes = W.flashes.filter(f => (f.t += dt) < 0.55);
  for (const f of W.flashes){
    const k = f.t / 0.55;
    W.fl.setMatrixAt(i, _m.compose(f.p, _q.identity(), _s.setScalar(f.size * (0.15 + Math.sqrt(k) * 0.45))));
    W.fl.setColorAt(i, _c.setHex(F.flash ?? 0xffa040).multiplyScalar(3 * (1 - k) * (1 - k)));
    i++;
  }
  for (; i < W.fl.count; i++) W.fl.setMatrixAt(i, ZERO);
  W.fl.instanceMatrix.needsUpdate = true; W.fl.instanceColor.needsUpdate = true;
  i = 0;
  const wind = F.wind ?? [3, 1];
  W.puffs = W.puffs.filter(p => (p.t += dt) < p.life);
  for (const p of W.puffs){
    const k = p.t / p.life;
    p.p.y += p.rise * dt * (1 - k * 0.5); p.p.x += wind[0] * p.drift * dt; p.p.z += wind[1] * p.drift * dt;
    const s = p.size * (0.5 + k * 1.3) * (k > 0.75 ? (1 - k) * 4 : 1);
    W.pf.setMatrixAt(i, _m.compose(p.p, _q.identity(), _s.setScalar(Math.max(0.01, s))));
    W.pf.setColorAt(i, _c.copy(W.smokeCol).multiplyScalar(k < 0.08 ? 2.2 : 1));   // fresh smoke still lit by the fire
    i++;
  }
  for (; i < W.pf.count; i++) W.pf.setMatrixAt(i, ZERO);
  W.pf.instanceMatrix.needsUpdate = true; W.pf.instanceColor.needsUpdate = true;
}

/* for the smoke tests and the console: what the battle is running right now */
export function warfrontInfo(){ return W.on ? { ships: W.ships.length, walkers: W.walkers.length, tracers: W.tracers.length, flashes: W.flashes.length, puffs: W.puffs.length } : null; }
