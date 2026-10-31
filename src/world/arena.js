// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Arena group and buildArena(), which dispatches to the arena builders.

import * as THREE from 'three';
import { renderer, scene, camera, hemi, sun } from '../engine/renderer.js';
import { V3, rand } from '../utils.js';
import { shared, player, barrels, vents, pillars, solids, hazardZones } from '../state.js';
import { spawnVent, spawnBarrel, setHazardStyle } from './hazards.js';
import { makeFloorTex, makeSkyTex } from './textures.js';
import { buildAmbient } from '../fx/ambient.js';
import { themeFor } from '../data/worlds.js';
import { paintSky, paintFloor } from './paint.js';
import { buildBackdrop } from './backdrop.js';
import { bakeArena, toon, toonGround, farHaze } from './ink.js';
import { resetCamBlockers } from './camblock.js';
import { applyAtmosphere, clearAtmosphere } from './atmosphere.js';
import { buildTempleArena } from './arenas/temple.js';
import { buildFoundryArena } from './arenas/foundry.js';
import { buildPlainsArena } from './arenas/plains.js';
import { buildHallArena } from './arenas/hall.js';
import { buildForgeArena } from './arenas/forge.js';
import { buildRefugeArena } from './arenas/refuge.js';
import { buildPursuitArena } from './arenas/pursuit.js';
import { buildDojoArena } from './arenas/dojo.js';
import { buildThroneArena } from './arenas/throne.js';
import { buildGrasslandArena } from './arenas/grassland.js';
import { buildIcefrontArena } from './arenas/icefront.js';
import { buildGraveyardArena } from './arenas/graveyard.js';
import { buildArchiveArena } from './arenas/archive.js';
import { buildOutpostArena } from './arenas/outpost.js';
import { buildCovertArena } from './arenas/covert.js';
import { buildPensArena } from './arenas/pens.js';
import { buildPrisonArena } from './arenas/prison.js';
import { buildHangarArena } from './arenas/hangar.js';
import { buildSithArena } from './arenas/sith.js';
import { buildJungleArena } from './arenas/jungle.js';
import { buildNav } from '../enemies/nav.js';
import { clearScorch } from '../fx/scorch.js';
import { clearSevered } from '../enemies/scars.js';
import { buildAir, clearAir } from './air.js';
import { buildWarfront, clearWarfront } from './warfront.js';

/* ============================================================
   ARENA
   ============================================================ */

/* an arena wider than this is a BATTLE MAP (data/battlemaps.js): far bigger than the sun's shadow box and the reach of
   one flow field, so the light, the sky dome, enemy arrivals and pathing all work around wherever the hero is */
export const BIG_ARENA = 100;
export const arenaBuilt = [];   // callbacks run when a build finishes (engine/prewarm.js compiles what the fight will need)

scene.add(shared.arenaGroup);

export function buildArena(L){
  clearScorch();   // last arena's burn marks
  clearSevered();  // and any severed arms still lying about
  clearAir();
  clearWarfront();
  scene.remove(shared.arenaGroup);
  disposeArena(shared.arenaGroup);
  shared.arenaGroup = new THREE.Group();
  scene.add(shared.arenaGroup);
  resetCamBlockers();
  shared.arenaHalf = L.arena / 2;
  shared.arenaHalfZ = (L.arenaZ || L.arena) / 2;   // L.arenaZ: a long arena, deeper north–south than it is wide
  shared.arenaLevel = L;
  shared.arenaBig = L.arena > BIG_ARENA;            // a battle map: spawns, pathing, light and sky work around the hero (see BIG_ARENA)
  shared.ambient = null; shared.mist = null;
  shared.arenaWalled = false;    // a room walled in on all four sides (the sandbox rooms): bolts stop at its walls
  shared.dojoRemotes = null;      // the sandbox room's hovering remotes (world/arenas/dojo.js)
  shared.templeBrazier = null;   // cleared each rebuild; the temple layout re-assigns it (so we never flicker a stale mesh)
  pillars.length = 0;
  solids.length = 0;              // (cleared before the world: its backdrop hills that run into the play space are ground)

  const T = themeFor(L);
  shared.arenaLayout = (T && T.sound) || L.layout || 'temple';   // the training grounds borrow a campaign arena's sound
  setHazardStyle(T && (T.hazards || {}));
  if (T) buildWorld(L, T);
  else {
  clearAtmosphere();
  scene.fog = new THREE.Fog(L.fog, L.arena*(L.fogStart || 0.5), L.arena*1.9);
  renderer.setClearColor(L.sky);
  sun.color.setHex(L.sun || 0xfff2dd);
  // per-level brightness — the later arenas were too dark to read enemies; lift the ambient fill + key light there
  hemi.intensity = L.fill || 0.62;
  sun.intensity = L.sunI || 1.55;

  // sky dome with stars
  const skyTex = makeSkyTex(L.skyTop || 0x05070d, L.fog);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(L.arena*1.7, 20, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  shared.arenaGroup.add(sky);

  // textured battlefield floor
  const floorTex = makeFloorTex(L.floor);
  floorTex.repeat.set(L.arena/9, L.arena/9);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L.arena, L.arena, 8, 8),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  shared.arenaGroup.add(floor);

  // boundary glow grid (subtle) — warm sandstone-gold under the temple, cool blue elsewhere
  const gc = L.layout === 'temple' ? [0x6a572c, 0x46391d] : [0x336688, 0x224455];
  const grid = new THREE.GridHelper(L.arena, Math.floor(L.arena/4), gc[0], gc[1]);
  grid.position.y = 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  shared.arenaGroup.add(grid);
  }

  buildAmbient(T ? { ...L, ambient: T.ambient } : L);

  // scattered pillars — atmosphere AND solid wall-jump surfaces for parkour.
  // Tall ones ring the edge for depth; squat ones sit in the play space, low enough to
  // leap onto and fight from.
  // clear hazards up-front so AUTHORED builders can place their own (the random fallback at the end is non-authored only)
  for (const v of vents) scene.remove(v.group); vents.length = 0;
  for (const b of barrels) scene.remove(b.mesh); barrels.length = 0;
  hazardZones.length = 0;
  // AUTHORED per-level layouts get their own builder; everything else uses the scattered procedural cover below.
  const LP = { ...L, pal: (T && T.pal) || {} };   // builders read their colours from the world's palette
  if (L.layout === 'temple'){ buildTempleArena(LP); }
  else if (L.layout === 'foundry'){ buildFoundryArena(LP); }
  else if (L.layout === 'plains'){ buildPlainsArena(LP); }
  else if (L.layout === 'hall'){ buildHallArena(LP); }
  else if (L.layout === 'forge'){ buildForgeArena(LP); }
  else if (L.layout === 'refuge'){ buildRefugeArena(LP); }
  else if (L.layout === 'pursuit'){ buildPursuitArena(LP); }
  else if (L.layout === 'dojo'){ buildDojoArena(LP); }
  else if (L.layout === 'throne'){ buildThroneArena(LP); }
  else if (L.layout === 'grassland'){ buildGrasslandArena(LP); }
  else if (L.layout === 'icefront'){ buildIcefrontArena(LP); }
  else if (L.layout === 'graveyard'){ buildGraveyardArena(LP); }
  else if (L.layout === 'approach'){ buildGrasslandArena(LP); }   // the Grass Sea's plan, in Exegol's ash (the spearhead chapter)
  else if (L.layout === 'archive'){ buildArchiveArena(LP); }
  else if (L.layout === 'outpost'){ buildOutpostArena(LP); }   // the Mando's story: Salt Hollow on Orvane
  else if (L.layout === 'covert'){ buildCovertArena(LP); }     // the Mando's story: the clan's covert
  else if (L.layout === 'prison'){ buildPrisonArena(LP); }
  else if (L.layout === 'pens'){ buildPensArena(LP); }
  else if (L.layout === 'hangar'){ buildHangarArena(LP); }
  else if (L.layout === 'sith'){ buildSithArena(LP); }
  else if (L.layout === 'jungle'){ buildJungleArena(LP); }
  else {
  // pick a spot at least `gap` clear of every other obstacle so cover stays SPREAD OUT — clustered obstacles
  // form walls that trap the enemy AI. Returns null if no open spot is found (so we just place fewer).
  function farSpot(minR, maxR, gap, tries){
    for (let t = 0; t < (tries || 18); t++){
      const a = Math.random()*Math.PI*2, r = rand(minR, maxR);
      const x = Math.cos(a)*r, z = Math.sin(a)*r;
      let ok = true;
      for (const s of solids){
        const sr = s.box ? Math.hypot(s.hx, s.hz) : s.r;
        if (Math.hypot(x - s.x, z - s.z) < gap + sr){ ok = false; break; }
      }
      if (ok) return { x, z };
    }
    return null;
  }
  const pillarCount = Math.floor(L.arena/7);   // fewer pillars, well separated
  const stoneMat = new THREE.MeshStandardMaterial({ color: L.floor, roughness: 0.95, metalness: 0.1 });
  for (let i = 0; i < pillarCount; i++){
    const inPlay = i % 4 < 1;   // mostly ring the edge; only ~1 in 4 sits in the play space
    const spot = farSpot(inPlay ? shared.arenaHalf*0.3 : shared.arenaHalf*0.6, inPlay ? shared.arenaHalf*0.55 : shared.arenaHalf*0.92, 7.5);
    if (!spot) continue;
    const h = inPlay ? rand(2.0, 3.4) : rand(4.5, 8.5);   // in-play pillars are mountable
    const rad = rand(0.8, 1.3);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(rad*0.9, rad, h, 8), stoneMat);
    p.position.set(spot.x, h/2, spot.z);
    p.castShadow = true; p.receiveShadow = true;
    shared.arenaGroup.add(p);
    pillars.push({ x: spot.x, z: spot.z, r: rad, h });
    solids.push({ x: spot.x, z: spot.z, r: rad, h });
  }

  // CRATES & STEPPED PLATFORMS — solid boxes to jump on, fight from, and chain off of.
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x57606e, roughness: 0.8, metalness: 0.25 });
  const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x6a5340, roughness: 0.85, metalness: 0.15 });
  function addCrate(x, z, hx, hz, h, mat){
    const m = new THREE.Mesh(new THREE.BoxGeometry(hx*2, h, hz*2), mat);
    m.position.set(x, h/2, z); m.castShadow = true; m.receiveShadow = true;
    // subtle edge frame so the platform reads clearly
    const edge = new THREE.Mesh(new THREE.BoxGeometry(hx*2+0.04, 0.06, hz*2+0.04),
      new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.6, metalness: 0.4 }));
    edge.position.y = h/2; m.add(edge);
    shared.arenaGroup.add(m);
    solids.push({ x, z, hx, hz, h, box: true });
  }
  const crateCount = Math.floor(L.arena/12);   // fewer crates, spaced clear of the pillars and each other
  for (let i = 0; i < crateCount; i++){
    const spot = farSpot(shared.arenaHalf*0.2, shared.arenaHalf*0.62, 6.5);
    if (!spot) continue;
    const x = spot.x, z = spot.z, a = Math.atan2(z, x);
    if (Math.random() < 0.4){
      // a two-step ziggurat — a low crate beside a taller one so you can climb up (kept as a tight, climbable pair)
      const lo = rand(1.0, 1.5), hi = lo + rand(0.9, 1.5);
      addCrate(x, z, rand(1.1,1.5), rand(1.1,1.5), hi, crateMat);
      const off = rand(1.7, 2.2), oa = a + rand(-0.7, 0.7);
      addCrate(x + Math.cos(oa)*off, z + Math.sin(oa)*off, rand(0.9,1.3), rand(0.9,1.3), lo, crateMat2);
    } else {
      addCrate(x, z, rand(1.0,1.6), rand(1.0,1.6), rand(1.1, 2.4), Math.random()<0.5?crateMat:crateMat2);
    }
  }
  }   // end procedural (non-authored) layout

  // RANDOM hazards — non-authored levels only (the authored builders place theirs intentionally, already done above)
  if (!L.layout){
    const hz = L.hazards || {};
    for (let i = 0; i < (hz.vents||0); i++){
      const a = (i / hz.vents) * Math.PI*2 + rand(-0.4,0.4);
      const r = rand(shared.arenaHalf*0.3, shared.arenaHalf*0.7);
      spawnVent(V3(Math.cos(a)*r, 0, Math.sin(a)*r));
    }
    for (let i = 0; i < (hz.barrels||0); i++){
      const a = Math.random()*Math.PI*2;
      const r = rand(shared.arenaHalf*0.2, shared.arenaHalf*0.8);
      spawnBarrel(V3(Math.cos(a)*r, 0, Math.sin(a)*r));
    }
  }
  buildNav();   // the enemy pathing grid follows the new layout (enemies/nav.js)
  // INK: cel-shade every static prop and merge them into a handful of draw calls (glows and hazards stay live)
  if (T) shared.arenaBake = bakeArena(shared.arenaGroup, T.ink ?? 0.045);
  player.grime = 0;   // a fresh field: the soot of the last fight comes off the hero (player/model/wear.js)
  for (const f of arenaBuilt) f();
}

/* what's built and what it costs to draw (the battle-map smoke test reads it: tools/smoke/maps.mjs) */
export function arenaInfo(){
  const L = shared.arenaLevel || {};
  let calls = 0, tris = 0;
  shared.arenaGroup.traverse(o => { if (!o.isMesh || !o.visible) return; calls++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; });
  return { layout: L.layout, half: shared.arenaHalf, halfZ: shared.arenaHalfZ, big: shared.arenaBig, solids: solids.length, calls, tris: Math.round(tris) };
}

// painted textures are drawn once per theme and reused on every rebuild (survival rotates arenas mid-run)
const paintCache = new WeakMap();
function painted(T, make){ if (!paintCache.has(T)) paintCache.set(T, make()); return paintCache.get(T); }

/* free the previous arena's GPU geometry (materials and painted textures are shared caches, so they stay) */
function disposeArena(g){
  g.traverse(o => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); });
}

/* a themed world: painted sky, lights + fog (atmosphere.js), painted floor, an outer ground that runs out to the
   horizon, and the backdrop landmarks (baked here with a thicker outline so they read at distance) */
const ORGANIC = new Set(['sand', 'snow', 'ice', 'grass', 'ash', 'basalt']);   // ground without a laid-out grid: its tile can be turned to break the repeat
function buildWorld(L, T){
  const lt = T.light, sunSpec = T.sky.sun && { ...T.sky.sun, az: T.sky.sun.az ?? Math.atan2(lt.dir[2], lt.dir[0]) };
  const tx = painted(T, () => ({ sky: paintSky({ ...T.sky, sun: sunSpec }), floor: paintFloor(T.floor) }));
  const W = L.arena, D = L.arenaZ || L.arena, long = D > W, roam = long || W > BIG_ARENA;
  // a long arena's or a battle map's dome rides along with the camera (atmosphere.js), so it never has to reach past
  // the far plane
  const skyR = roam ? 300 : L.arena*1.7;   // (grown below to clear the backdrop)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(skyR, 32, 16),
    new THREE.MeshBasicMaterial({ map: tx.sky, side: THREE.BackSide, fog: false }));
  sky.userData.noBake = true;
  shared.arenaGroup.add(sky);
  applyAtmosphere(T, L, sky);
  const sunDir = sunSpec ? new THREE.Vector3(Math.cos(sunSpec.az) * Math.cos(sunSpec.el), Math.sin(sunSpec.el), Math.sin(sunSpec.az) * Math.cos(sunSpec.el)) : null;
  buildAir(T, L, sky, sunDir);   // drifting clouds, ground mist, light shafts (world/air.js)

  const floorTex = tx.floor;
  floorTex.repeat.set(W/9, D/9);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 8, long ? 40 : 8), toonGround(0xffffff, { map: floorTex, mix: ORGANIC.has(T.floor.kind) }));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; floor.userData.noBake = true;
  shared.arenaGroup.add(floor);
  // the ground past the edge: a plain ring (no outline), a hair lower so the floor always wins where they overlap
  const outerR = Math.max(W, D)*(roam && !long ? 1.6 : 1.2);
  const outer = new THREE.Mesh(new THREE.RingGeometry(W*0.5, outerR, 48, 1), toonGround(T.outer ?? T.floor.base, { macro: 0.1 }));
  outer.rotation.x = -Math.PI/2; outer.position.y = -0.04; outer.receiveShadow = true; outer.userData.noBake = true;
  shared.arenaGroup.add(outer);
  // a dark ink line marks the playable edge (the same square the movement clamp uses; a long arena is walled in instead)
  if (!long){
  const edge = new THREE.Mesh(new THREE.RingGeometry(L.arena*0.5 - 0.12, L.arena*0.5 + 0.12, 4, 1, Math.PI/4),
    new THREE.MeshBasicMaterial({ color: 0x07060a, transparent: true, opacity: 0.35 }));
  edge.rotation.x = -Math.PI/2; edge.rotation.z = 0; edge.scale.setScalar(Math.SQRT2); edge.position.y = 0.02;
  shared.arenaGroup.add(edge);
  }

  const back = buildBackdrop(T.backdrop, L.arena/2, T.seed || 1, D/2);
  shared.arenaGroup.add(back);
  solids.push(...back.userData.solids);   // the edge's hills, where they run in over the play space
  bakeArena(back, T.inkFar ?? 0.16, true);
  // the backdrop stands far past the arena's fog: it takes the far haze instead (world/ink.js), glows included
  back.traverse(o => { if (o.isMesh || o.isPoints) o.material = farHaze(o.material); });
  // the HORIZON: the sky dome and the ground run out past the furthest landmark
  const reach = new THREE.Box3().setFromObject(back);
  const far = reach.isEmpty() ? 0 : Math.max(-reach.min.x, reach.max.x, -reach.min.z, reach.max.z) * 1.15;
  if (far > skyR){ sky.scale.setScalar(far / skyR); }
  camera.far = Math.max(4000, far * 1.3); camera.updateProjectionMatrix();
  if (far > outerR){
    outer.geometry.dispose();
    outer.geometry = new THREE.RingGeometry(W*0.5, far, 64, 1);
    outer.material = farHaze(outer.material);
  }
  buildWarfront(T, L);   // the war beyond the walls (world/warfront.js)
}
