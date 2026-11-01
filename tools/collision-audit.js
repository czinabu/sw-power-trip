// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Collision audit (dev only, run by tools/smoke/collision.mjs: `npm run smoke:collision`).
// Builds every arena layout without baking it and checks each prop the player can reach against the collision solids:
// anything you can see standing in the play space that you would walk (or sink) through is listed, worst first.
// A prop is sampled on a 0.4 m grid over its footprint inside the playable rectangle. At each sample a ray down finds
// the prop's visible top and a ray up its underside; the sample is a MISS when the collision there (the highest solid
// top under it, as groundAt sees it) sits well under the visible top while the underside is low enough to walk into.
// Overhead props (underside above head height) are listed apart as LEDGES: you pass under them, but anything you can
// fly or jump onto should hold you.

import * as THREE from 'three';
import { shared, solids, pillars, hazardZones, vents, barrels } from '../src/state.js';
import { scene } from '../src/engine/renderer.js';
import { themeFor } from '../src/data/worlds.js';
import { buildBackdrop } from '../src/world/backdrop.js';
import { moundY } from '../src/world/collision.js';
import { LEVELS } from '../src/data/levels.js';
import { BATTLE_MAPS } from '../src/data/battlemaps.js';
import { MISSIONS } from '../src/data/missions.js';
import { SANDBOX_LEVELS } from '../src/data/sandbox.js';
import { TRAINING_LEVELS } from '../src/data/tutorial.js';
import { buildTempleArena } from '../src/world/arenas/temple.js';
import { buildFoundryArena } from '../src/world/arenas/foundry.js';
import { buildPlainsArena } from '../src/world/arenas/plains.js';
import { buildHallArena } from '../src/world/arenas/hall.js';
import { buildForgeArena } from '../src/world/arenas/forge.js';
import { buildRefugeArena } from '../src/world/arenas/refuge.js';
import { buildPursuitArena } from '../src/world/arenas/pursuit.js';
import { buildDojoArena } from '../src/world/arenas/dojo.js';
import { buildThroneArena } from '../src/world/arenas/throne.js';
import { buildGrasslandArena } from '../src/world/arenas/grassland.js';
import { buildIcefrontArena } from '../src/world/arenas/icefront.js';
import { buildGraveyardArena } from '../src/world/arenas/graveyard.js';
import { buildArchiveArena } from '../src/world/arenas/archive.js';
import { buildPrisonArena } from '../src/world/arenas/prison.js';
import { buildHangarArena } from '../src/world/arenas/hangar.js';
import { buildJungleArena } from '../src/world/arenas/jungle.js';
import { buildShipyardArena } from '../src/world/arenas/shipyard.js';
import { buildGarrisonArena } from '../src/world/arenas/garrison.js';
import { buildFrigateArena } from '../src/world/arenas/frigate.js';
import { buildSithArena } from '../src/world/arenas/sith.js';
import { CHAPTERS } from '../src/data/campaign.js';
import { TROOPER_CHAPTERS } from '../src/data/campaign-trooper.js';
import { MANDO_CHAPTERS } from '../src/data/campaign-mando.js';
import { buildOutpostArena } from '../src/world/arenas/outpost.js';
import { buildCovertArena } from '../src/world/arenas/covert.js';

const BUILDERS = { temple: buildTempleArena, foundry: buildFoundryArena, plains: buildPlainsArena, hall: buildHallArena,
  forge: buildForgeArena, refuge: buildRefugeArena, pursuit: buildPursuitArena, dojo: buildDojoArena, throne: buildThroneArena,
  grassland: buildGrasslandArena, icefront: buildIcefrontArena, graveyard: buildGraveyardArena,
  approach: buildGrasslandArena, archive: buildArchiveArena, prison: buildPrisonArena, hangar: buildHangarArena, sith: buildSithArena,
  jungle: buildJungleArena, outpost: buildOutpostArena, covert: buildCovertArena, shipyard: buildShipyardArena, garrison: buildGarrisonArena, frigate: buildFrigateArena };

const STEP = 0.4;          // sample spacing
const SINK = 0.45;         // a visible top this far over the collision top is a miss (thin caps and trims sit under it)
const HEAD = 1.9;          // an underside above this is overhead: you walk under it
const REACH = 16;          // overhead props higher than this are out of anyone's reach
const MIN_AREA = 0.35;     // m² of missed footprint before a prop is listed (unless &all=1)


/* every level config in the game, one per layout (a layout is built the same way in every mode that uses it) */
function levelsByLayout(){
  const out = {};
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 5) return;
    if (o.layout && typeof o.layout === 'string' && o.arena && !out[o.layout]) out[o.layout] = o;
    for (const v of Object.values(o)) walk(v, depth + 1);
  };
  walk({ LEVELS, BATTLE_MAPS, MISSIONS, SANDBOX_LEVELS, TRAINING_LEVELS, CHAPTERS, MANDO_CHAPTERS, TROOPER_CHAPTERS });   // (a chapter can stage its level on its own arena)
  return out;
}

/* the collision top under a point, the way a body standing there meets it (its radius reaches past the point) */
function solidTop(x, z, pad){
  let g = 0;
  for (const c of solids){
    if (c.mound){ g = Math.max(g, moundY(c, x, z)); continue; }
    if (c.h <= g) continue;
    const inside = c.box ? Math.abs(x - c.x) <= c.hx + pad && Math.abs(z - c.z) <= c.hz + pad : Math.hypot(x - c.x, z - c.z) <= c.r + pad;
    if (inside && (c.y0 ?? 0) <= g + 0.01) g = c.h;   // a raised slab (y0) only counts once you're on something under it
  }
  return g;
}
/* the raised slabs (solids with y0): the top of one whose footprint holds (x, z) and whose underside sits near `under` */
function slabTop(x, z, pad, under){
  let g = -1;
  for (const c of solids){
    if (!c.y0 || c.y0 > under + 0.6) continue;
    const inside = c.box ? Math.abs(x - c.x) <= c.hx + pad && Math.abs(z - c.z) <= c.hz + pad : Math.hypot(x - c.x, z - c.z) <= c.r + pad;
    if (inside && c.h > g) g = c.h;
  }
  return g;
}

const ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0), O = new THREE.Vector3();

function isBackdrop(o){ for (let p = o.parent; p; p = p.parent) if (p.userData.backdrop) return true; return false; }
function propsOf(group){
  const list = [];
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh || !o.visible || o.userData.passThrough) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.side === THREE.BackSide || (m.transparent && m.opacity < 0.9)) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.max.y < 0.15) return;                                         // floor, decals, flat inlays
    if (b.max.x - b.min.x < 0.2 || b.max.z - b.min.z < 0.2) return;     // poles, wires, thin rails: nothing to stand on
    list.push({ o, b });
  });
  return list;
}

const _w = new THREE.Vector3();
function name(o){
  const g = o.geometry.type.replace('Geometry', ''), p = o.getWorldPosition(_w);
  return `${g} @ ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
}

function auditLayout(id, L, opt){
  scene.remove(shared.arenaGroup);
  shared.arenaGroup = new THREE.Group();
  shared.arenaHalf = L.arena / 2; shared.arenaHalfZ = (L.arenaZ || L.arena) / 2;
  shared.arenaLevel = L; shared.arenaBig = L.arena > 100;
  pillars.length = 0; solids.length = 0; hazardZones.length = 0;
  for (const v of vents) scene.remove(v.group); vents.length = 0;
  for (const b of barrels) scene.remove(b.mesh); barrels.length = 0;
  const T = themeFor(L);
  BUILDERS[id]({ ...L, pal: (T && T.pal) || {} });
  if (T && T.backdrop){
    const back = buildBackdrop(T.backdrop, L.arena/2, T.seed || 1, shared.arenaHalfZ);
    back.userData.backdrop = true;
    shared.arenaGroup.add(back); solids.push(...back.userData.solids);
  }
  const hx = shared.arenaHalf - 1, hz = shared.arenaHalfZ - 1;   // clampToArena's rectangle
  const misses = [], ledges = [];
  for (const { o, b } of propsOf(shared.arenaGroup)){
    const x0 = Math.max(b.min.x, -hx), x1 = Math.min(b.max.x, hx), z0 = Math.max(b.min.z, -hz), z1 = Math.min(b.max.z, hz);
    if (x0 >= x1 || z0 >= z1) continue;                                  // wholly outside the play space
    let miss = 0, ledge = 0, worst = 0, ledgeY = 0, at = null;
    for (let x = x0 + STEP/2; x < x1; x += STEP) for (let z = z0 + STEP/2; z < z1; z += STEP){
      O.set(x, b.max.y + 1, z); ray.set(O, DOWN); ray.far = b.max.y + 2;
      const hd = ray.intersectObject(o, false)[0];
      if (!hd) continue;                                                  // the prop doesn't cover this sample
      const top = hd.point.y;
      O.set(x, -0.5, z); ray.set(O, UP); ray.far = b.max.y + 2;
      const hu = ray.intersectObject(o, false)[0];
      const under = hu ? Math.max(0, hu.point.y) : 0;
      if (top < 0.25) continue;
      if (under > HEAD){                                                  // overhead: does it hold you once you're up there?
        if (under > REACH) continue;
        const held = Math.max(slabTop(x, z, 0.25, under), solidTop(x, z, 0.25));
        if (held < top - SINK - 0.3){ ledge++; ledgeY = Math.max(ledgeY, top); }
        continue;
      }
      const sink = top - solidTop(x, z, 0.25);
      if (sink > SINK){ miss++; if (sink > worst){ worst = sink; at = [+x.toFixed(1), +z.toFixed(1), +top.toFixed(1)]; } }
    }
    const area = miss * STEP * STEP, larea = ledge * STEP * STEP;
    if (area >= MIN_AREA || (opt.all && area > 0)) misses.push({ prop: name(o), area: +area.toFixed(2), sink: +worst.toFixed(2), at, backdrop: isBackdrop(o) });
    if (larea >= MIN_AREA * 2) ledges.push({ prop: name(o), area: +larea.toFixed(2), top: +ledgeY.toFixed(1) });
  }
  misses.sort((a, b) => b.area * b.sink - a.area * a.sink);
  ledges.sort((a, b) => b.area - a.area);
  return { id, solids: solids.length, misses, ledges };
}

/* the level config a layout is built from (the first one in the game that uses it) */
export const levelFor = id => levelsByLayout()[id];

/* audit every layout (or the ones named): [{ id, solids, misses: [...], ledges: [...] }]. The game must be loaded (the
   arena builders lean on its scene and data), so this runs inside the game page: `await import('/tools/collision-audit.js')`. */
export function auditMaps(o = {}){
  const all = levelsByLayout(), keep = shared.arenaGroup;
  const ids = o.maps || Object.keys(BUILDERS), result = [];
  for (const id of ids){
    if (!all[id]){ result.push({ id, error: 'no level uses this layout' }); continue; }
    try { result.push(auditLayout(id, all[id], o)); } catch (e){ result.push({ id, error: String(e && e.stack || e) }); }
  }
  shared.arenaGroup = keep; scene.add(keep);
  return result;
}
