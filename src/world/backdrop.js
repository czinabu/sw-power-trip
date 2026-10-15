// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Backdrops: everything OUTSIDE the playable square. Distant silhouettes and landmarks that tell you where you are
// (mesas, spires, a volcano, a city, a temple, a downed walker, a Star Destroyer overhead). No collision, no gameplay:
// they sit beyond arenaHalf, are built from plain meshes, and are baked into the Ink look with a thicker outline so
// they still read at distance. A theme lists them as { kind, ...params } (see data/worlds.js).

import * as THREE from 'three';

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
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = o.w[0] + R()*(o.w[1] - o.w[0]);
      let y = 0, ww = w;
      const tiers = 2 + Math.floor(R()*2);
      for (let t = 0; t < tiers; t++){
        const th = h / tiers * (t === tiers - 1 ? 0.8 : 1.1);
        put(grp, new THREE.CylinderGeometry(ww*0.42, ww*0.5, th, 7), mat(t % 2 ? o.color : o.color2 || o.color), x, y + th/2, z, 0, R()*PI, 0, [1, 1, 0.7 + R()*0.5]);
        y += th; ww *= 0.72 + R()*0.15;
      }
    }
  },
  /* jagged spires / rock needles */
  spires(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = o.w ? o.w[0] + R()*(o.w[1] - o.w[0]) : h * 0.16;
      // a jagged needle: a 4-sided cone squashed and leaned at random, with a shorter shard beside it
      put(grp, new THREE.ConeGeometry(w, h, 4), mat(o.color), x, h/2 - 0.5, z, (R()-0.5)*0.22, R()*PI, (R()-0.5)*0.22, [0.6 + R()*0.8, 1, 0.6 + R()*0.8]);
      if (R() < 0.7) put(grp, new THREE.ConeGeometry(w*0.6, h*(0.35 + R()*0.3), 4), mat(o.color2 || o.color), x + w*(R() < 0.5 ? 1 : -1), h*0.2, z + (R()-0.5)*w*1.5, (R()-0.5)*0.5, R()*PI, (R()-0.5)*0.5, [0.7 + R()*0.6, 1, 0.7 + R()*0.6]);
      if (o.glow && R() < 0.5) put(grp, new THREE.BoxGeometry(0.25, h*0.35, 0.25), glowMat(o.glow), x, h*0.35, z, 0, 0, (R()-0.5)*0.4);
    }
  },
  /* a near-continuous ring of faceted cliffs: encloses the arena (ice walls, canyon walls) */
  cliffs(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = half * (o.w || 0.3) * (0.8 + R()*0.5);
      put(grp, new THREE.IcosahedronGeometry(1, 0), mat(R() < 0.5 ? o.color : o.color2 || o.color), x, h*0.35, z, R()*PI, R()*PI, R()*PI, [w, h, w*0.7]);
    }
  },
  /* city towers with lit windows */
  towers(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = 2.5 + R()*4;
      const t = put(grp, new THREE.BoxGeometry(w, h, w*(0.7 + R()*0.6)), mat(R() < 0.5 ? o.color : o.color2 || o.color), x, h/2, z, 0, -a, 0);
      if (R() < 0.5) put(grp, new THREE.CylinderGeometry(0.15, w*0.3, h*0.25, 4), mat(o.color), x, h + h*0.12, z, 0, -a, 0);
      if (o.windows){
        const rows = Math.floor(h / 4);
        for (let k = 0; k < rows; k++) if (R() < 0.55){
          const wm = new THREE.Mesh(new THREE.PlaneGeometry(w*0.8, 0.5), glowMat(o.windows));
          wm.position.set(0, -h/2 + 2 + k*4, -(w*(0.35)) - 0.6); wm.rotation.y = PI; t.add(wm);
        }
      }
    }
  },
  /* industrial smokestacks with a glowing lip and a frozen smoke plume */
  stacks(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const h = o.h[0] + R()*(o.h[1] - o.h[0]), w = 1.6 + R()*1.6;
      put(grp, new THREE.CylinderGeometry(w*0.8, w, h, 10), mat(o.color), x, h/2, z);
      put(grp, new THREE.CylinderGeometry(w*0.85, w*0.85, 0.6, 10), mat(o.band || o.color), x, h*0.7, z);
      if (o.glow) put(grp, new THREE.TorusGeometry(w*0.75, 0.25, 6, 12), glowMat(o.glow), x, h, z, PI/2);
      if (o.smoke) for (let k = 0; k < 6; k++){   // a frozen plume, drifting downwind and spreading as it rises
        const sz = w*(1.1 + k*0.55);
        put(grp, new THREE.IcosahedronGeometry(1, 1), mat(o.smoke), x + k*sz*0.55, h + 1 + k*sz*0.6, z + (R()-0.5)*sz*0.4, R(), R()*PI, R(), [sz, sz*0.75, sz]);
      }
    }
  },
  /* glowing crystal clusters (kyber) */
  crystals(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r);
      const n = 3 + Math.floor(R()*3);
      for (let k = 0; k < n; k++){
        const h = (o.h[0] + R()*(o.h[1] - o.h[0])) * (k ? 0.6 : 1), w = h*0.14;
        put(grp, new THREE.ConeGeometry(w, h, 6), mat(o.color, { e: o.glow, ei: 0.55 }), x + (R()-0.5)*w*4, h*0.4, z + (R()-0.5)*w*4, (R()-0.5)*0.7, R()*PI, (R()-0.5)*0.7);
      }
    }
  },
  /* a city/holy-city RAMPART just outside the arena edge: wall segments with crenellations and gate towers */
  ramparts(grp, o, half, R){
    const r = half * (o.r || 1.12), n = o.segments || 16, h = o.h || 4;
    for (let i = 0; i < n; i++){
      const a = (i / n) * PI * 2;
      if (o.gaps && o.gaps.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.2)) continue;
      const [x, z] = P(a, r), len = 2 * PI * r / n * 1.02;
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
  /* low DUNES / snow drifts just outside the edge so the floor doesn't end in a hard line */
  dunes(grp, o, half, R){
    for (const a of angles(o.count, R, o.skip)){
      const r = half * (o.r[0] + R()*(o.r[1] - o.r[0])), [x, z] = P(a, r), w = half*(0.25 + R()*0.2);
      put(grp, new THREE.SphereGeometry(1, 10, 6, 0, PI*2, 0, PI/2), mat(o.color), x, -0.2, z, 0, -a, 0, [w, o.h * (0.6 + R()*0.6), w*0.45]);
    }
  },
};

/* build a theme's backdrop into its own group (baked by the caller with a thick outline) */
export function buildBackdrop(list, half, seed = 1){
  const grp = new THREE.Group();
  const R = rng(seed);
  for (const o of list || []){
    const fn = BUILD[o.kind];
    if (fn) fn(grp, o, half, R);
  }
  return grp;
}
