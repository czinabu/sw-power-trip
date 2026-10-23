// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shared pieces for the large open battle maps (grassland, icefront, graveyard): cover walls laid out as plain data,
// the cover spots squads read off them, rocks, drifts, craters and wrecked walkers.
//
// A battle map keeps its layout in a PLAN at the top of its file so the map's SPOTS (where allies and enemies start,
// the cover lines, the points to hold) can be worked out at load time, before any arena is built: a story mission
// (data/missions.js) imports them like REFUGE_SPOTS. The builder then walks the same PLAN, so the two never drift apart.
// +z is the hero's side (north, where allies start); the enemy comes from -z.

import * as THREE from 'three';
import { solids } from '../../state.js';

/* a cover wall in a PLAN: [x, z, half-length, h, alongX (1) or alongZ (0)] → the box it stands as */
export const wallBox = ([x, z, hl, h, ax]) => ({ x, z, hx: ax ? hl : 0.55, hz: ax ? 0.55 : hl, h });

/* COVER SPOTS behind every wall that runs east–west: a spot every ~2.6 m along its length, just off the face away from
   the threat, and the way to face over it. side +1 = the north face (allies, facing south: yaw π), -1 = the south face
   (enemies, facing north: yaw 0). Walls that run north–south give flank cover and aren't listed. */
export function coverSpots(walls, side, step = 2.6){
  const out = [];
  for (const w of walls){
    const b = wallBox(w);
    if (!w[4] || b.h < 0.9) continue;
    const n = Math.max(1, Math.floor((b.hx * 2) / step)), z = b.z + side * (b.hz + 0.85);
    for (let i = 0; i < n; i++) out.push([+(b.x - b.hx + (i + 0.5) * (b.hx * 2 / n)).toFixed(2), +z.toFixed(2), side > 0 ? Math.PI : 0]);
  }
  return out;
}

export function fieldKit(K, R){
  /* a cover wall from a PLAN row: a solid box and a cap along the top, dressed as sandbags (o.bags), buttressed (o.buttress),
     a starship hull plate (o.plate) or broken (o.jag). mats: { body, cap } */
  const wall = (w, mats, o = {}) => {
    const b = wallBox(w), ax = w[4];
    K.box(b.x, b.z, b.hx, b.hz, b.h, mats.body);
    if (mats.cap) K.deco(new THREE.BoxGeometry(b.hx*2 + 0.1, 0.16, b.hz*2 + 0.14), mats.cap, b.x, b.h + 0.06, b.z);
    if (o.bags){   // sandbag rows: rounded bags laid along the top
      const len = b.hx*2 > b.hz*2 ? b.hx*2 : b.hz*2, n = Math.floor(len / 0.9);
      for (let i = 0; i < n; i++){
        const t = -len/2 + (i + 0.5) * len/n;
        K.deco(new THREE.CapsuleGeometry(0.26, 0.42, 2, 6), mats.cap || mats.body, b.x + (ax ? t : 0), b.h + 0.2, b.z + (ax ? 0 : t), 0, ax ? 0 : Math.PI/2, Math.PI/2);
      }
    } else if (o.buttress && (ax ? b.hx : b.hz) > 3){
      const len = ax ? b.hx : b.hz;
      for (let t = -len + 1.6; t < len - 1; t += 3.2) K.deco(new THREE.BoxGeometry(ax ? 0.4 : 1.4, b.h + 0.1, ax ? 1.4 : 0.4), mats.cap || mats.body, b.x + (ax ? t : 0), (b.h + 0.1)/2, b.z + (ax ? 0 : t));
    }
    if (o.plate){   // a starship hull plate: frame ribs, panel seams and a torn top edge
      const len = ax ? b.hx : b.hz;
      for (let t = -len + 1.2; t < len - 0.6; t += 2.4) K.deco(new THREE.BoxGeometry(ax ? 0.3 : b.hx*2 + 0.16, b.h, ax ? b.hz*2 + 0.16 : 0.3), mats.cap || mats.body, b.x + (ax ? t : 0), b.h/2, b.z + (ax ? 0 : t));
      for (let y = 1.3; y < b.h - 0.5; y += 1.5) K.deco(new THREE.BoxGeometry(b.hx*2 + (ax ? 0.02 : 0.08), 0.12, b.hz*2 + (ax ? 0.08 : 0.02)), mats.cap || mats.body, b.x, y, b.z);
      for (let i = 0; i < 3; i++){
        const t = (R() - 0.5) * len * 1.6;
        K.deco(new THREE.ConeGeometry(0.45 + R()*0.45, 1 + R()*1.4, 4), mats.body, b.x + (ax ? t : 0), b.h + 0.45, b.z + (ax ? 0 : t), (R() - 0.5)*0.6, R()*3, (R() - 0.5)*0.6);
      }
    }
    if (o.jag){   // a broken top: a few chunks stacked off the cap
      for (let i = 0; i < 3; i++){
        const t = (R() - 0.5) * (ax ? b.hx : b.hz) * 1.6;
        K.deco(new THREE.BoxGeometry(0.6 + R()*0.8, 0.3 + R()*0.4, 0.8), mats.cap || mats.body, b.x + (ax ? t : 0), b.h + 0.2, b.z + (ax ? 0 : t), 0, ax ? 0 : Math.PI/2, (R() - 0.5)*0.4);
      }
    }
  };
  /* a boulder or rock outcrop: collides as a column, drawn as a lumpy faceted rock (two shards) */
  const rock = (x, z, r, h, mat, mat2) => {
    solids.push({ x, z, r, h });
    K.deco(new THREE.DodecahedronGeometry(1, 0), mat, x, h*0.45, z, R()*3, R()*3, R()*3).scale.set(r*1.05, h*0.58, r*1.05);
    K.deco(new THREE.DodecahedronGeometry(1, 0), mat2 || mat, x + r*0.3, h*0.72, z - r*0.2, R()*3, R()*3, R()*3).scale.set(r*0.7, h*0.35, r*0.7);
  };
  /* a tall rock SPIRE (the grasslands' needles): a wall-kick column, tapered, with a broken crown and a skirt of rubble */
  const spire = (x, z, r, h, mat, mat2) => {
    K.column(x, z, r, h, mat, { taper: 0.45, seg: 7 });
    K.deco(new THREE.ConeGeometry(r*0.55, h*0.22, 6), mat2 || mat, x + r*0.1, h + h*0.08, z, 0.1, R()*3, 0.08);
    K.deco(new THREE.CylinderGeometry(r*1.25, r*1.45, 0.5, 7), mat2 || mat, x, 0.25, z, 0, R()*3, 0);
  };
  /* a low DRIFT or dune you walk over: a climbable step under STEP_UP, drawn as a squashed mound */
  const drift = (x, z, hx, hz, mat) => {
    solids.push({ x, z, hx, hz, h: 0.42, box: true, climbable: true });
    K.deco(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI*2, 0, Math.PI/2), mat, x, 0, z).scale.set(hx*1.15, 0.46, hz*1.15);
  };
  /* a scorched CRATER on the floor: a dark ring decal (flat, nothing to trip on). Mortar hazards sit on these */
  const crater = (x, z, r, mat) => {
    K.deco(new THREE.RingGeometry(r*0.35, r, 18), mat, x, 0.025, z, -Math.PI/2).receiveShadow = true;
    K.deco(new THREE.CircleGeometry(r*0.35, 14), mat, x, 0.02, z, -Math.PI/2);
  };
  /* a crate stack: a tall crate with a short one beside it, so it climbs in two hops (1.1 then 2.2) */
  const crates = (x, z, mat, mat2, flip = 1) => {
    K.box(x, z, 0.9, 0.9, 2.2, mat);
    K.box(x + 1.7*flip, z + 0.2, 0.8, 0.8, 1.1, mat2 || mat);
  };
  /* a DOWNED WALKER hulk you can climb and fight from: the hull lies along x (or z), the head off one end and the
     legs splayed as low steps. The hull top is high ground (4.2): crate, a broken leg stump, then the hull. Every
     piece touches the hull, so there's no pocket between them for a body to wedge into. */
  const walkerHulk = (x, z, alongX, mats) => {
    const L = (dx, dz) => alongX ? [x + dx, z + dz] : [x + dz, z + dx];
    const hb = (dx, dz, hl, hw, h, mat, o) => { const [px, pz] = L(dx, dz); return K.box(px, pz, alongX ? hl : hw, alongX ? hw : hl, h, mat, o); };
    const hull = hb(0, 0, 7.5, 3.0, 4.2, mats.hull);
    hull.rotation[alongX ? 'x' : 'z'] = 0.05;   // rolled a touch onto its side
    hb(9.6, 0.8, 2.1, 1.5, 2.6, mats.dark);                     // the head, nose down in the ground
    { const [px, pz] = L(7.8, 0.6); K.deco(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 8), mats.dark, px, 2.4, pz, alongX ? 0 : Math.PI/2, 0, alongX ? Math.PI/2 : 0); }   // neck
    if (mats.glow){ const [px, pz] = L(11.8, 0.8); K.deco(new THREE.BoxGeometry(alongX ? 0.3 : 1.6, 0.4, alongX ? 1.6 : 0.3), mats.glow, px, 1.6, pz); }   // a dead viewport
    for (const [dx, dz, h] of [[-4.5, 3.85, 2.9], [3.8, 3.85, 1.8]]){ const [px, pz] = L(dx, dz); K.column(px, pz, 0.85, h, mats.dark, { taper: 0.9, seg: 8 }); }   // broken leg stumps
    for (const [dx, dz] of [[-4.0, -5.2], [4.4, -5.2]]) hb(dx, dz, 0.8, 2.2, 1.0, mats.dark);   // legs lying in the dirt (vault them)
    hb(-6.2, 3.9, 0.9, 0.9, 1.6, mats.crate || mats.dark);     // a cargo crate against the hull and the stump: the first hop up
    // armour plates along the hull's sides, and the gun chin
    { const [px, pz] = L(0, 0); K.deco(new THREE.BoxGeometry(alongX ? 13 : 4.4, 0.8, alongX ? 4.4 : 13), mats.plate || mats.dark, px, 4.5, pz); }   // the armoured spine
    { const [px, pz] = L(-2, -3.05); K.deco(new THREE.BoxGeometry(alongX ? 2.2 : 0.14, 1.6, alongX ? 0.14 : 2.2), mats.dark, px, 1.6, pz); }       // a side hatch, blown open
    for (let i = -2; i <= 2; i++){ const [px, pz] = L(i * 2.8, 3.05); K.deco(new THREE.BoxGeometry(alongX ? 2.4 : 0.2, 2.6, alongX ? 0.2 : 2.4), mats.plate || mats.dark, px, 2.3, pz); }
    { const [px, pz] = L(11.2, 0.8); K.deco(new THREE.BoxGeometry(alongX ? 1.2 : 0.4, 0.4, alongX ? 0.4 : 1.2), mats.dark, px, 0.9, pz); }
  };
  return { wall, rock, spire, drift, crater, crates, walkerHulk };
}

/* a mortar / cannon strike zone on a crater: an amber telegraph, then a blast that hurts whoever stands in it */
export const strike = (x, z, r, t, color, o = {}) => ({ kind: 'point', cx: x, cz: z, r, period: o.period ?? 11, warnDur: o.warn ?? 1.8,
  activeDur: o.active ?? 0.8, dmg: o.dmg ?? 26, color, flash: true, t });
