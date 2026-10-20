// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Camera occluders: the arena's actual prop shapes, so the follow-cam never parks inside one (props in front of it
// dissolve instead: world/ink.js SEE).
//
// Every arena prop carries a back-face ink hull (world/ink.js). If the lens ends up INSIDE a prop, the prop's own
// faces are culled and the hull's back faces fill the screen solid black. The gameplay `solids` list doesn't cover
// that: it skips decoration (capitals, cap stones, gantry struts, the Exegol spire, the backdrop walls past the arena
// edge) and its walk-the-line sampling could still settle a few feet inside a wall. So the camera tests against the
// props themselves: one oriented box per mesh (its geometry's bounding box in its own frame), recorded at build time
// before the arena is baked into merged meshes.

import * as THREE from 'three';

const blockers = [];   // { inv: Matrix4 (world → mesh local), box: Box3 (local) }
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export function resetCamBlockers(){ blockers.length = 0; }

/* record every bakeable prop under `group` (the same meshes bakeArena merges: lit materials, not flagged noBake).
   Double-sided planes (banners, window glows) are skipped: they're flat, outline-free and passing through one is
   harmless, while their rotated boxes would make the lens shy away from columns for nothing. */
export function addCamBlockers(group){
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh || o.userData.noBake || o.userData.baked) return;
    for (let p = o.parent; p && p !== group; p = p.parent) if (p.userData.noBake) return;
    const m = o.material;
    if (!m || Array.isArray(m) || !(m.isMeshStandardMaterial || m.isMeshToonMaterial) || m.side === THREE.DoubleSide) return;
    const geo = o.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    blockers.push({ inv: o.matrixWorld.clone().invert(), box: geo.boundingBox.clone() });
  });
}

/* CAMERA CLEARANCE — how far along the line from the hero's head (a) to the wanted camera spot (b) the lens may sit
   (1 = all the way). Props merely BETWEEN the hero and the lens don't count: they dissolve (world/ink.js SEE), so the
   camera keeps its distance instead of lurching in past them. Only a prop the lens would end up INSIDE pulls it in, to
   just short of where the line enters that prop (backed off by `margin` so the near plane stays clear). Pulling in
   can land inside an overlapping prop, so it checks again from there. A prop that already contains the head (rare
   decoration the hero can stand in) is ignored: there is no spot along the line that would be outside it. */
export function cameraClearance(ax, ay, az, bx, by, bz, margin = 0.35){
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  if (len < 1e-4) return 1;
  let k = 1;
  for (let pass = 0; pass < 4; pass++){
    const px = ax + (bx - ax)*k, py = ay + (by - ay)*k, pz = az + (bz - az)*k;
    let best = k;
    for (const bl of blockers){
      _b.set(px, py, pz).applyMatrix4(bl.inv);
      if (!bl.box.containsPoint(_b)) continue;
      // transform the segment into the prop's frame; the parameter t along it is unchanged by an affine map
      _a.set(ax, ay, az).applyMatrix4(bl.inv); _b.set(bx, by, bz).applyMatrix4(bl.inv);
      const t = segEnterBox(_a, _b, bl.box);
      if (t >= 0) best = Math.min(best, Math.max(0, t - margin / len));
    }
    if (best >= k) break;
    k = best;
  }
  return k;
}

/* slab test: the t in [0,1] where segment a→b first enters box, or -1 if it never does (or starts inside) */
function segEnterBox(a, b, box){
  let t0 = 0, t1 = 1;
  for (const ax of ['x', 'y', 'z']){
    const o = a[ax], d = b[ax] - o, lo = box.min[ax], hi = box.max[ax];
    if (Math.abs(d) < 1e-9){ if (o < lo || o > hi) return -1; continue; }
    let n = (lo - o) / d, f = (hi - o) / d;
    if (n > f){ const s = n; n = f; f = s; }
    if (n > t0) t0 = n;
    if (f < t1) t1 = f;
    if (t0 > t1) return -1;
  }
  // t0 === 0 means the head starts inside this box: no entry point to stop at
  return t0 > 0 ? t0 : -1;
}
