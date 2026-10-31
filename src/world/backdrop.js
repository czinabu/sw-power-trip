// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Backdrops: everything OUTSIDE the playable square. Distant silhouettes and landmarks that tell you where you are
// (mesas, spires, a volcano, a city, a temple, a downed walker, a Star Destroyer overhead). No collision, no gameplay:
// they sit beyond arenaHalf (keepOut slides any piece that reaches into the play space back out), are built from plain
// meshes, and are baked into the Ink look with a thicker outline so they still read at distance. The one exception is
// the low ground at the edge (dunes, drifts, the sand piled round a wreck): where a hill runs in over the play space it
// is real ground, a walkable mound in the arena's solids (returned in grp.userData.solids). A theme lists them as
// { kind, ...params } (see data/worlds.js).

import * as THREE from 'three';
import { mound } from './collision.js';

const PI = Math.PI;
// seeded random so a theme's backdrop is the same every rebuild
function rng(seed){ let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0) % 100000) / 100000; }

const matCache = new Map();
function mat(color, o = {}){
  const id = color + '|' + (o.e || 0) + '|' + (o.ei || 0);
  if (!matCache.has(id)){
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    if (o.e){ m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; }
    matCache.set(id, m);
  }
  return matCache.get(id);
}
const glowCache = new Map();
function glowMat(color){
  if (!glowCache.has(color)) glowCache.set(color, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  return glowCache.get(color);
}

function put(grp, geo, m, x, y, z, rx = 0, ry = 0, rz = 0, s){
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  if (s) o.scale.set(s[0], s[1], s[2]);
  o.castShadow = false; o.receiveShadow = false;
  grp.add(o);
  return o;
}
// polar spots around the arena: angle a, radius r (world units)
const P = (a, r) => [Math.cos(a)*r, Math.sin(a)*r];

/* KEEP OUT OF THE PLAY SPACE. The ring of backdrop sits at a radius round the arena, but the arena is a rectangle: on
   a diagonal its corner reaches out past that radius, so a wide cliff or mesa there would stand inside the play space,
   where nothing collides with it. A piece (`objs`, measured by `from`) that reaches into the rectangle slides straight
   out along whichever axis is the shorter way. Anything wholly above OUT_TOP (a hovering destroyer, a smoke plume) is
   out of reach and stays put. */
const OUT_TOP = 16, PAD = 0.6;
let LIM = [1e9, 1e9];   // the play space's half-width and half-depth, for the build in progress
const _b = new THREE.Box3(), _u = new THREE.Box3();
function keepOut(objs, from = objs){
  _u.makeEmpty();
  for (const o of from){ o.updateMatrixWorld(true); _b.setFromObject(o); if (!_b.isEmpty() && _b.min.y < OUT_TOP) _u.union(_b); }
  if (_u.isEmpty()) return;
  const hx = LIM[0] + PAD, hz = LIM[1] + PAD;
  if (_u.max.x <= -hx || _u.min.x >= hx || _u.max.z <= -hz || _u.min.z >= hz) return;
  const cx = (_u.min.x + _u.max.x) / 2, cz = (_u.min.z + _u.max.z) / 2;
  const mx = cx >= 0 ? hx - _u.min.x : -hx - _u.max.x, mz = cz >= 0 ? hz - _u.min.z : -hz - _u.max.z;
  for (const o of objs){ if (Math.abs(mx) <= Math.abs(mz)) o.position.x += mx; else o.position.z += mz; o.updateMatrixWorld(true); }
}
// the meshes a builder has added since `n0` (one backdrop piece)
const since = (grp, n0) => grp.children.slice(n0);
/* a HILL that runs in over the play space is ground you walk on: a mound solid matching its half-ellipsoid
   (scale [a, h, b] turned by -ang, standing at y) — or nothing, if it stays outside */
function hill(grp, x, y, z, a, h, b, ang){
  const r = Math.max(a, b);
  if (Math.abs(x) - r >= LIM[0] || Math.abs(z) - r >= LIM[1]) return;
  (grp.userData.solids ||= []).push(mound(x, z, a, b, ang, y, y + h));
}
const rand2 = (R, a, b) => a + R() * (b - a);
// keep a clear arc (e.g. where the sun sits, or a landmark) — returns a spread of angles outside the skipped arcs
function angles(n, R, skip = []){
  const out = [];
  for (let i = 0; i < n * 3 && out.length < n; i++){
    const a = (i / n) * PI * 2 + (R() - 0.5) * (PI * 2 / n) * 0.8;
    if (skip.some(([c, w]) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < w)) continue;
    out.push(a);
  }
  return out;
}

const BUILD = {
  /* layered rock mesas (desert): stacked tapered slabs */
  mesas(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r), n0 = grp.children.length;
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = o.w[0] + R()*(o.w[1] - o.w[0]);
      let y = 0, ww = w;
      const tiers = 2 + Math.floor(R()*2);
      for (let t = 0; t < tiers; t++){
        const th = h / tiers * (t === tiers - 1 ? 0.8 : 1.1);
        put(grp, new THREE.CylinderGeometry(ww*0.42, ww*0.5, th, 7), mat(t % 2 ? o.color : o.color2 || o.color), x, y + th/2, z, 0, R()*PI, 0, [1, 1, 0.7 + R()*0.5]);
        y += th; ww *= 0.72 + R()*0.15;
      }
      keepOut(since(grp, n0));
    }
  },
  /* jagged spires / rock needles */
  spires(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = o.w ? o.w[0] + R()*(o.w[1] - o.w[0]) : h * 0.16, n0 = grp.children.length;
      // a jagged needle: a 4-sided cone squashed and leaned at random, with a shorter shard beside it
      put(grp, new THREE.ConeGeometry(w, h, 4), mat(o.color), x, h/2 - 0.5, z, (R()-0.5)*0.22, R()*PI, (R()-0.5)*0.22, [0.6 + R()*0.8, 1, 0.6 + R()*0.8]);
      if (R() < 0.7) put(grp, new THREE.ConeGeometry(w*0.6, h*(0.35 + R()*0.3), 4), mat(o.color2 || o.color), x + w*(R() < 0.5 ? 1 : -1), h*0.2, z + (R()-0.5)*w*1.5, (R()-0.5)*0.5, R()*PI, (R()-0.5)*0.5, [0.7 + R()*0.6, 1, 0.7 + R()*0.6]);
      if (o.glow && R() < 0.5) put(grp, new THREE.BoxGeometry(0.25, h*0.35, 0.25), glowMat(o.glow), x, h*0.35, z, 0, 0, (R()-0.5)*0.4);
      keepOut(since(grp, n0));
    }
  },
  /* a near-continuous ring of faceted cliffs: encloses the arena (ice walls, canyon walls) */
  cliffs(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = half * (o.w || 0.3) * (0.8 + R()*0.5);
      keepOut([put(grp, crag(Math.floor(a * 1000)), mat(R() < 0.5 ? o.color : o.color2 || o.color), x, h*0.35, z, R()*PI, R()*PI, R()*PI, [w, h, w*0.7])]);
    }
  },
  /* city towers with lit windows */
  towers(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = 2.5 + R()*4, n0 = grp.children.length;
      const t = put(grp, new THREE.BoxGeometry(w, h, w*(0.7 + R()*0.6)), mat(R() < 0.5 ? o.color : o.color2 || o.color), x, h/2, z, 0, -a, 0);
      if (R() < 0.5) put(grp, new THREE.CylinderGeometry(0.15, w*0.3, h*0.25, 4), mat(o.color), x, h + h*0.12, z, 0, -a, 0);
      if (o.windows){
        const rows = Math.floor(h / 4);
        for (let k = 0; k < rows; k++) if (R() < 0.55){
          const wm = new THREE.Mesh(new THREE.PlaneGeometry(w*0.8, 0.5), glowMat(o.windows));
          wm.position.set(0, -h/2 + 2 + k*4, -(w*(0.35)) - 0.6); wm.rotation.y = PI; t.add(wm);
        }
      }
      keepOut(since(grp, n0));
    }
  },
  /* industrial smokestacks with a glowing lip and a frozen smoke plume */
  stacks(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = 1.6 + R()*1.6, n0 = grp.children.length;
      put(grp, new THREE.CylinderGeometry(w*0.8, w, h, 10), mat(o.color), x, h/2, z);
      put(grp, new THREE.CylinderGeometry(w*0.85, w*0.85, 0.6, 10), mat(o.band || o.color), x, h*0.7, z);
      if (o.glow) put(grp, new THREE.TorusGeometry(w*0.75, 0.25, 6, 12), glowMat(o.glow), x, h, z, PI/2);
      if (o.smoke) for (let k = 0; k < 6; k++){   // a frozen plume, drifting downwind and spreading as it rises
        const sz = w*(1.1 + k*0.55);
        put(grp, new THREE.IcosahedronGeometry(1, 1), mat(o.smoke), x + k*sz*0.55, h + 1 + k*sz*0.6, z + (R()-0.5)*sz*0.4, R(), R()*PI, R(), [sz, sz*0.75, sz]);
      }
      const piece = since(grp, n0); keepOut(piece, piece.slice(0, 2));   // measured by the stack itself, the plume goes with it
    }
  },
  /* glowing crystal clusters (kyber) */
  crystals(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const n = 3 + Math.floor(R()*3), n0 = grp.children.length;
      for (let k = 0; k < n; k++){
        const h = (o.h[0] + R()*(o.h[1] - o.h[0])) * (k ? 0.6 : 1), w = h*0.14;
        put(grp, new THREE.ConeGeometry(w, h, 6), mat(o.color, { e: o.glow, ei: 0.55 }), x + (R()-0.5)*w*4, h*0.4, z + (R()-0.5)*w*4, (R()-0.5)*0.7, R()*PI, (R()-0.5)*0.7);
      }
      keepOut(since(grp, n0));
    }
  },
  /* a city/holy-city RAMPART just outside the arena edge: wall segments with crenellations and gate towers */
  ramparts(grp, o, half, R){
    const r = half * (o.r || 1.12), n = o.segments || 16, h = o.h || 4;
    for (let i = 0; i < n; i++){
      const a = (i / n) * PI * 2;
      if (o.gaps && o.gaps.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.2)) continue;
      const [x, z] = P(a, r), len = 2 * PI * r / n * 1.02, n0 = grp.children.length;
      const seg = put(grp, new THREE.BoxGeometry(len, h * (0.75 + R()*0.4), 1.6), mat(o.color), x, h/2, z, 0, -a + PI/2, 0);
      if (R() < 0.7) for (let k = -2; k <= 2; k++) if (R() < 0.75){
        const m = new THREE.Mesh(new THREE.BoxGeometry(len*0.12, 0.9, 1.7), mat(o.color2 || o.color));
        m.position.set(k * len * 0.2, h/2 + 0.3, 0); seg.add(m);
      }
      if (i % 4 === 0){
        const th = h * 1.8;
        put(grp, new THREE.BoxGeometry(3.2, th, 3.2), mat(o.color2 || o.color), x, th/2, z, 0, -a, 0);
        put(grp, new THREE.ConeGeometry(2.5, 2.4, 4), mat(o.roof || o.color), x, th + 1.2, z, 0, -a + PI/4, 0);
      }
      keepOut(since(grp, n0));
    }
  },
  /* LANDMARK — a toppled colossal Jedi statue (Jedha): a hooded head on its side and a broken forearm */
  statue(grp, o, half){
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1, g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = -o.az + PI/2; grp.add(g);
    const m = mat(o.color), m2 = mat(o.color2 || o.color);
    put(g, new THREE.IcosahedronGeometry(5*s, 1), m, 0, 3.8*s, 0, 0, 0, 0.5, [1, 1.15, 0.95]);           // the head
    put(g, new THREE.ConeGeometry(7.2*s, 13*s, 6, 1, true), m2, 0.6*s, 4.2*s, 0, 0, 0, -PI/2 + 0.5);   // hood
    put(g, new THREE.BoxGeometry(2.2*s, 0.9*s, 1.1*s), mat(o.dark || 0x2a2018), 2.0*s, 3.2*s, 4.4*s, 0, 0, 0.5); // brow shadow
    put(g, new THREE.CylinderGeometry(1.8*s, 2.1*s, 14*s, 7), m, -16*s, 1.6*s, 6*s, PI/2 - 0.1, 0.5, 0);    // forearm
    put(g, new THREE.BoxGeometry(4*s, 3*s, 4.4*s), m2, -22.5*s, 2.2*s, 9.5*s, 0.3, 0.5, 0.2);               // fist
    put(g, new THREE.CylinderGeometry(0.7*s, 0.7*s, 7*s, 8), mat(o.metal || 0x8a8070), -22.5*s, 3.5*s, 9.5*s, 0, 0.5, PI/2 - 0.3);  // the hilt it still grips
  },
  /* LANDMARK — the Jedi Temple: a stepped ziggurat with five spires (the middle one tallest) */
  temple(grp, o, half){
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1, g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = -o.az + PI/2; grp.add(g);
    let y = 0;
    for (const [w, h] of [[34, 5], [28, 5], [22, 5], [17, 4]]){ put(g, new THREE.BoxGeometry(w*s, h*s, w*0.6*s), mat(o.color), 0, y + h*s/2, 0); y += h*s; }
    for (const [dx, dz, h] of [[0, 0, 26], [-6, -3, 17], [6, -3, 17], [-6, 3, 17], [6, 3, 17]]){
      put(g, new THREE.CylinderGeometry(0.4*s, 1.8*s, h*s, 6), mat(o.color2 || o.color), dx*s, y + h*s/2, dz*s);
      if (o.glow) put(g, new THREE.SphereGeometry(0.45*s, 6, 4), glowMat(o.glow), dx*s, y + h*s + 0.3, dz*s);
    }
  },
  /* LANDMARK — a volcano with lava streaks and a glowing crater */
  volcano(grp, o, half){
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1;
    put(grp, new THREE.CylinderGeometry(6*s, 30*s, 34*s, 9), mat(o.color), x, 17*s - 1, z);
    put(grp, new THREE.CylinderGeometry(7*s, 7*s, 1.2*s, 9), glowMat(o.lava), x, 34*s - 1.2, z);
    // lava streaks lying on the slope: each one rotated to face out along its angle, then leaned in to match the cone
    for (let k = 0; k < 5; k++){
      const a = k * 1.3 + 0.4, g = new THREE.Group();
      g.position.set(x + Math.cos(a)*18.6*s, 16.5*s - 1, z + Math.sin(a)*18.6*s); g.rotation.y = -a; grp.add(g);
      put(g, new THREE.BoxGeometry(0.6*s, 36*s*(0.6 + 0.4*((k*7) % 3)/2), 1.2*s), glowMat(o.lava), 0, 0, 0, 0, 0, 0.615);
    }
  },
  /* LANDMARK — a Sith pyramid / citadel with a burning slit and a ring of standing obelisks */
  pyramid(grp, o, half){
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1;
    put(grp, new THREE.ConeGeometry(26*s, 40*s, 4), mat(o.color), x, 20*s - 0.5, z, 0, PI/4 - o.az, 0);
    put(grp, new THREE.BoxGeometry(1.2*s, 20*s, 0.6*s), glowMat(o.glow), x - Math.cos(o.az)*12.5*s, 12*s, z - Math.sin(o.az)*12.5*s, 0, -o.az + PI/2, 0);
    // a row of standing obelisks in front of it, between the citadel and the arena
    for (let k = 0; k < 6; k++){
      const [ox, oz] = P(o.az + (k - 2.5) * 0.16, half * (o.r - 0.32));
      put(grp, new THREE.CylinderGeometry(0.4*s, 1.4*s, (12 + (k % 3) * 3)*s, 4), mat(o.color2 || o.color), ox, (6 + (k % 3) * 1.5)*s, oz, 0, k, 0);
    }
  },
  /* LANDMARK — a downed AT-AT walker: hull on its side, head, splayed and broken legs */
  walker(grp, o, half){
    if (o.stand) return BUILD.walkerUp(grp, o, half);
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1, g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = -o.az + 0.6; grp.add(g);
    const m = mat(o.color), m2 = mat(o.color2 || o.color);
    put(g, new THREE.BoxGeometry(16*s, 7*s, 7*s), m, 0, 3.6*s, 0, 0.5, 0, 0.08);                      // hull, rolled
    put(g, new THREE.BoxGeometry(5*s, 3.4*s, 3.2*s), m2, 11*s, 2.2*s, 1.2*s, 0.4, 0.3, -0.25);          // head in the snow
    put(g, new THREE.CylinderGeometry(0.9*s, 0.9*s, 4.4*s, 6), m2, 7.4*s, 3*s, 0.8*s, 0, 0, PI/2 - 0.2); // neck
    for (const [lx, lz, rx, rz, len] of [[-5, -4, 1.1, 0.2, 13], [5, -4.4, 1.25, -0.2, 11], [-4.5, 4.5, -0.3, 0.4, 7], [4, 5, 0.2, -0.9, 9]]){
      put(g, new THREE.BoxGeometry(1.4*s, len*s, 1.6*s), m2, lx*s, len*s*0.32, lz*s, rx, 0, rz);
    }
    if (o.glow) put(g, new THREE.BoxGeometry(0.6*s, 0.6*s, 2*s), glowMat(o.glow), 13.6*s, 2.4*s, 1.2*s, 0.4, 0.3, -0.25);
  },
  /* LANDMARK — a walker STANDING on the horizon (o.stand) instead of downed: hull on four straight legs, head forward */
  walkerUp(grp, o, half){
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1, g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = -o.az + PI/2 + (o.turn || 0.4); grp.add(g);
    const m = mat(o.color), m2 = mat(o.color2 || o.color);
    put(g, new THREE.BoxGeometry(6.4*s, 6*s, 14*s), m, 0, 16.5*s, 0);                                    // hull
    put(g, new THREE.BoxGeometry(5*s, 1.2*s, 12*s), m2, 0, 20*s, 0);                                     // the armoured spine
    put(g, new THREE.BoxGeometry(3.2*s, 2.8*s, 5*s), m2, 0, 14.2*s, 11.4*s, 0.12);                       // head, low and forward
    put(g, new THREE.CylinderGeometry(1.2*s, 1.4*s, 3.6*s, 8), m2, 0, 15.2*s, 8.2*s, PI/2 - 0.25);       // neck
    for (const sx of [-0.8, 0.8]) put(g, new THREE.CylinderGeometry(0.22*s, 0.22*s, 2.6*s, 6), m2, sx*s, 13.4*s, 14.2*s, PI/2);   // chin guns
    for (const [lx, lz] of [[-2.6, -5.2], [2.6, -5.2], [-2.6, 5.0], [2.6, 5.0]]){
      const k = lz > 0 ? 1 : -1;   // the knees bend the same way front and back
      put(g, new THREE.BoxGeometry(0.9*s, 7*s, 1.1*s), m2, lx*s, 10.4*s, (lz + 0.6*k)*s, -0.18*k, 0, 0);   // upper leg
      put(g, new THREE.SphereGeometry(0.8*s, 8, 6), m, lx*s, 7*s, (lz + 1.2*k)*s);                            // knee
      put(g, new THREE.BoxGeometry(0.8*s, 7*s, 1.0*s), m2, lx*s, 3.6*s, (lz + 0.6*k)*s, 0.18*k, 0, 0);    // lower leg
      put(g, new THREE.CylinderGeometry(1.0*s, 1.3*s, 0.7*s, 8), m, lx*s, 0.35*s, lz*s);                   // foot
    }
    if (o.glow) put(g, new THREE.BoxGeometry(2.2*s, 0.4*s, 0.2*s), glowMat(o.glow), 0, 14.8*s, 13.95*s);
  },
  /* LANDMARK — a crashed Star Destroyer, stern buried in the sand, bow raised and rolled onto one side (Jakku) */
  wreck(grp, o, half){
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1, g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.set(0, -o.az + PI/2, 0); grp.add(g);
    const h = new THREE.Group(); h.rotation.set(-0.16, 0, o.roll ?? 0.55); g.add(h);   // bow up, rolled
    const m = mat(o.color), m2 = mat(o.color2 || o.color);
    put(h, new THREE.ConeGeometry(14*s, 70*s, 3), m, 0, 6*s, 0, PI/2, 0, 0, [1, 1, 0.22]);             // the dagger hull
    put(h, new THREE.BoxGeometry(10*s, 4*s, 7*s), m2, 0, 10.5*s, -22*s);                                // superstructure
    put(h, new THREE.BoxGeometry(14*s, 1.6*s, 2.4*s), m2, 0, 13.4*s, -24*s);                            // bridge
    for (const ex of [-5, 0, 5]) put(h, new THREE.CylinderGeometry(1.8*s, 2.2*s, 3*s, 10), m2, ex*s, 6*s, -35.5*s, PI/2);   // dead engines
    const sand = put(grp, new THREE.SphereGeometry(1, 12, 6, 0, PI*2, 0, PI/2), mat(o.sand || 0xa4865c), x, -0.2, z, 0, -o.az, 0, [30*s, 5*s, 14*s]);   // sand piled at the impact
    keepOut([g, sand], [g]);   // the hull stays out of the play space; the sand round it may run in (then it's ground)
    hill(grp, sand.position.x, -0.2, sand.position.z, 30*s, 5*s, 14*s, o.az);
  },
  /* LANDMARK — a Star Destroyer hanging in the sky (silhouette wedge with engine glow) */
  destroyer(grp, o, half){
    const [x, z] = P(o.az, half * o.r), s = o.scale || 1, g = new THREE.Group();
    g.position.set(x, o.y * s, z); g.rotation.set(0.08, -o.az + PI, 0.12); grp.add(g);
    const m = mat(o.color), m2 = mat(o.color2 || o.color);
    put(g, new THREE.ConeGeometry(12*s, 60*s, 3), m, 0, 0, 0, PI/2, 0, 0, [1, 1, 0.22]);                    // the dagger hull
    put(g, new THREE.BoxGeometry(9*s, 3.5*s, 6*s), m2, 0, 3.5*s, -20*s);                                     // superstructure
    put(g, new THREE.BoxGeometry(12*s, 1.4*s, 2*s), m2, 0, 6*s, -22*s);                                      // bridge
    if (o.glow) for (const ex of [-4, 0, 4]) put(g, new THREE.CylinderGeometry(1.4*s, 1.4*s, 0.6*s, 10), glowMat(o.glow), ex*s, 0.8*s, -30.2*s, PI/2);
  },
  /* LAVA RIVERS crossing the ground outside the arena: meandering glowing ribbons with a dark crust edge */
  lavaflows(grp, o, half, R){
    for (const a0 of angles(o.count, R, o.skip)){
      const pts = [];
      let a = a0, r = half * 1.04;
      while (r < half * (o.reach || 2.6)){ pts.push([Math.cos(a)*r, Math.sin(a)*r]); r += half*0.12; a += (R() - 0.5) * 0.12; }
      const w = (o.w || 1.6) * (0.7 + R()*0.6);
      for (const [col, ww, y] of [[o.crust || 0x1a0c08, w*1.9, -0.03], [o.lava, w, -0.02]]){
        const pos = [], idx = [];
        pts.forEach(([x, z], i) => {
          const [nx, nz] = pts[Math.min(i+1, pts.length-1)], [px, pz] = pts[Math.max(i-1, 0)];
          let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          const k = ww * (1 + 0.6*i/pts.length);   // widens as it runs out toward the lava lake
          pos.push(x - dz*k, y, z + dx*k, x + dz*k, y, z - dx*k);
          if (i) idx.push(i*2-2, i*2-1, i*2, i*2-1, i*2+1, i*2);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        const m = new THREE.Mesh(g, col === o.lava ? glowMat(o.lava) : new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
        m.material.side = THREE.DoubleSide;
        grp.add(m);
      }
    }
  },
  /* the DISTRICT round the arena: tall buildings packed along every side of the play space, just past the edge, so
     the fight happens at the bottom of a city instead of on a stage. Everyone is ~1.5× life size, so a five-storey
     block is 20 m here. `gap` keeps them clear of the camera's reach behind a hero at the edge (they have no
     collision); streets open on the cardinals (`streets`, metres wide) and here and there between blocks. */
  district(grp, o, half, R){
    const halfZ = LIM[1], gap = o.gap ?? 10, street = o.streets ?? 10;
    for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){
      const along = nz ? half : halfZ, edge = nz ? halfZ : half;
      let u = -along - gap - 8;
      while (u < along + gap + 8){
        const w = rand2(R, ...(o.w || [7, 14])), d = rand2(R, ...(o.d || [7, 12]));
        if (Math.abs(u + w/2) < street/2 + w/2 || R() < (o.alleys ?? 0.12)){ u += w * 0.6; continue; }   // a street / an alley
        const c = u + w/2, off = edge + gap + d/2;
        const x = nz ? c : nx * off, z = nz ? nz * off : c, sx = nz ? w : d, sz = nz ? d : w;
        const h = rand2(R, ...(o.h || [12, 26])), col = R() < 0.5 ? o.color : (o.color2 ?? o.color);
        put(grp, new THREE.BoxGeometry(sx, h, sz), mat(col), x, h/2, z);
        put(grp, new THREE.BoxGeometry(sx + 0.6, 0.8, sz + 0.6), mat(o.trim ?? o.color2 ?? o.color), x, h + 0.4, z);   // parapet
        if (o.detail !== false) facade(grp, o, x, z, sx, sz, h, col, -nx, -nz);
        if (o.setback && R() < o.setback){   // a narrower storey stepped back on top
          const h2 = h * rand2(R, 0.25, 0.5);
          put(grp, new THREE.BoxGeometry(sx * 0.6, h2, sz * 0.6), mat(o.color2 ?? o.color), x, h + h2/2, z);
        }
        if (o.domes && R() < o.domes) put(grp, new THREE.SphereGeometry(Math.min(sx, sz) * 0.34, 12, 6, 0, PI*2, 0, PI/2), mat(o.roof ?? o.color2 ?? o.color), x, h + 0.8, z);
        if (o.spires && R() < o.spires){ const sh = h * rand2(R, 0.4, 0.9); put(grp, new THREE.ConeGeometry(Math.min(sx, sz) * 0.2, sh, 4), mat(o.roof ?? o.color2 ?? o.color), x, h + sh/2 + 0.8, z, 0, PI/4, 0); }
        if (o.windows){   // rows of lit (or dark) windows on the face toward the arena
          const fx = -nx, fz = -nz, face = nz ? sx : sz;
          for (let y = 3.5; y < h - 2; y += 4) for (let t = -face/2 + 1.5; t < face/2 - 1; t += 2.6) if (R() < (o.lit ?? 0.35)){
            const wm = put(grp, new THREE.PlaneGeometry(1.1, 1.6), mat(o.windows, { e: o.windows, ei: 1.1 }), x + (nz ? t : fx * (sx/2 + 0.05)), y, z + (nz ? fz * (sz/2 + 0.05) : t), 0, nz ? (fz > 0 ? 0 : PI) : fx * PI/2, 0);
            wm.userData.noOutline = true;
          }
        }
        if (o.slits && R() < 0.6){   // a glowing slit down the face (Exegol)
          const fx = -nx, fz = -nz;
          put(grp, new THREE.BoxGeometry(nz ? 0.5 : 0.2, h * 0.6, nz ? 0.2 : 0.5), mat(o.slits, { e: o.slits, ei: 1.4 }), x + fx * (sx/2 + 0.05), h * 0.45, z + fz * (sz/2 + 0.05));
        }
        u += w + rand2(R, 0, 1.5);
      }
    }
  },
  /* low DUNES / snow drifts just outside the edge so the floor doesn't end in a hard line */
  dunes(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r), w = half*(0.25 + R()*0.2);
      const h = o.h * (0.6 + R()*0.6);
      put(grp, new THREE.SphereGeometry(1, 10, 6, 0, PI*2, 0, PI/2), mat(o.color), x, -0.2, z, 0, -a, 0, [w, h, w*0.45]);
      hill(grp, x, -0.2, z, w, h, w*0.45, a);   // a dune that runs in over the play space is walked up, not through
    }
  },
};

/* a CRAG: a once-subdivided icosahedron with its corners pushed in and out, so a cliff reads as broken rock with
   faces catching the light at many angles instead of one big faceted gem (a handful of variants, shared) */
const cragCache = new Map();
function crag(seed){
  const k = ((seed % 6) + 6) % 6;
  if (cragCache.has(k)) return cragCache.get(k);
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, R = rng(k * 7919 + 13);
  const moved = new Map();
  for (let i = 0; i < p.count; i++){
    const id = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);   // shared corners move together
    if (!moved.has(id)) moved.set(id, 0.78 + R() * 0.4);
    const f = moved.get(id);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  cragCache.set(k, g);
  return g;
}

/* FACADE detail on a district block, so the city reads as buildings rather than plain boxes: a darker plinth the
   block stands on, a string course every couple of storeys, and on the face toward the arena dark door and window
   recesses (`recess`, default a deep shade of the wall; no outline, so they stay crisp at distance). All of it bakes
   into the backdrop's per-material meshes, and it rolls its own dice so the district's layout is unchanged. */
const dim = (h, k) => new THREE.Color(h).multiplyScalar(k).getHex();
function facade(grp, o, x, z, sx, sz, h, col, fx, fz){
  const R = rng((Math.round(x * 7.3) * 73856093) ^ (Math.round(z * 5.1) * 19349663) ^ Math.round(h * 13));   // its own dice: the layout's rolls stay as they were
  const plinth = o.plinth ?? dim(o.trim ?? col, 0.78), course = o.trim ?? o.color2 ?? col;
  put(grp, new THREE.BoxGeometry(sx + 0.3, 2.2, sz + 0.3), mat(plinth), x, 1.1, z);
  for (let y = 8; y < h - 3; y += 8) put(grp, new THREE.BoxGeometry(sx + 0.24, 0.45, sz + 0.24), mat(course), x, y, z);
  const rec = mat(o.recess ?? dim(col, 0.42)), face = fz ? sx : sz, along = fz !== 0;
  const at = (t, y, w, hh) => {
    const m = put(grp, new THREE.BoxGeometry(along ? w : 0.3, hh, along ? 0.3 : w), rec,
      x + (along ? t : fx * (sx/2 + 0.02)), y, z + (along ? fz * (sz/2 + 0.02) : t));
    m.userData.noOutline = true;
  };
  if (R() < 0.6) at(rand2(R, -face*0.25, face*0.25), 1.9, 2.0, 3.8);   // a doorway
  if (o.windows) return;   // lit windows already fill the face
  for (let y = 5.5; y < h - 3; y += 4) for (let t = -face/2 + 1.8; t < face/2 - 1.2; t += 3.2) if (R() < (o.dark ?? 0.45)) at(t, y, 1.0, 1.7);
}

/* DEPTH — the backdrop used to stand in a ring just past the arena walls (1.5 to 2.7 × arenaHalf), so a "distant"
   mountain range was 50 m away and a Star Destroyer hung 50 m off: a diorama. Each kind now stretches the gap past
   the edge by `depth` (a piece authored at r = 1 + x half-widths stands at 1 + x·depth), growing as it goes so it
   keeps the same size on screen from the middle. It reads as truly far because it now parallaxes like it: hardly
   moving as you cross the arena. The low ground (dunes, ramparts, lava, the crystals) stays where it is; AT-ATs are
   already their real size and only step back a little. A theme entry can set its own `depth`.
   SIZE — a landmark with a size from the films is built TO that size instead: `size` (or the kind's default below) is
   its longest ground-plan extent in metres, and it moves out by the same factor, so it fills the same share of the sky
   as authored but stands at its real distance. Everyone in the game is about 1.5× life size (a trooper is 2.6 m),
   so lore sizes are scaled to match: an Imperial Star Destroyer (1,600 m) is 2,400 m here. */
const DEPTH = { mesas: 4, spires: 3.5, cliffs: 2.5, towers: 2, stacks: 1.6, statue: 3, temple: 3, pyramid: 3,
  volcano: 4, walker: 1.3 };
export const HERO_SCALE = 1.5;
const SIZE = { destroyer: 1600 * HERO_SCALE };
const _b2 = new THREE.Box3();
function stretch(objs, k, half, halfZ, whole, size){
  if (!objs.length) return 1;
  // a single landmark (a statue, a temple…) moves as one; a field of mesas or spires piece by piece
  let cx = 0, cz = 0;
  if (whole){ for (const o of objs){ cx += o.position.x; cz += o.position.z; } cx /= objs.length; cz /= objs.length; }
  let fs = 0;
  if (size){
    _u.makeEmpty();
    for (const o of objs){ o.updateMatrixWorld(true); _b2.setFromObject(o); _u.union(_b2); }
    fs = _u.isEmpty() ? 0 : size / Math.max(_u.max.x - _u.min.x, _u.max.z - _u.min.z);
  } else if (!(k > 1)) return 1;
  for (const o of objs){
    const x = whole ? cx : o.position.x, z = whole ? cz : o.position.z;
    // how far out it stands, in half-widths of the (possibly long) play space it faces
    const r = Math.hypot(x / half, z / halfZ);
    const f = fs || (r > 1 ? (1 + (r - 1) * k) / r : 1);
    if (f === 1) continue;
    o.position.multiplyScalar(f); o.scale.multiplyScalar(f);
  }
  return fs || k;
}

/* build a theme's backdrop into its own group (baked by the caller with a thick outline). halfZ: a long arena's
   half-depth (the play space is half × halfZ). The hills that reach the play space come back in grp.userData.solids. */
const PIECES = new Set(['district', 'mesas', 'spires', 'cliffs', 'towers', 'stacks', 'crystals', 'ramparts', 'wreck', 'lavaflows', 'dunes']);   // these keep each piece out themselves
export function buildBackdrop(list, half, seed = 1, halfZ = half){
  const grp = new THREE.Group();
  grp.userData.solids = [];
  const R = rng(seed);
  LIM = [half, halfZ];
  for (const o of list || []){
    const fn = BUILD[o.kind];
    if (!fn) continue;
    const n0 = grp.children.length;
    const s0 = grp.userData.solids.length;
    fn(grp, o, half, R);
    if (!PIECES.has(o.kind)) keepOut(since(grp, n0));   // a single landmark (a statue, a walker, a volcano…)
    const whole = !PIECES.has(o.kind) || o.kind === 'wreck';
    const f = stretch(since(grp, n0), o.depth ?? DEPTH[o.kind] ?? 1, half, halfZ, whole, o.size ?? SIZE[o.kind]);
    if (f > 1 && whole) grp.userData.solids.length = s0;   // a landmark sent out to its real distance leaves no ground in reach
  }
  return grp;
}
