// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Camera occluders: the arena's actual prop shapes, so the follow-cam never parks inside one, and a prop standing
// between the lens and the hero fades to see-through.
//
// Every arena prop carries a back-face ink hull (world/ink.js). If the lens ends up INSIDE a prop, the prop's own
// faces are culled and the hull's back faces fill the screen solid black. The gameplay `solids` list doesn't cover
// that: it skips decoration (capitals, cap stones, gantry struts, the Exegol spire, the backdrop walls past the arena
// edge) and its walk-the-line sampling could still settle a few feet inside a wall. So the camera tests against the
// props themselves: one oriented box per mesh (its geometry's bounding box in its own frame), registered by
// bakeArena as it merges them, along with the prop's id that its merged vertices carry for the fade.

import * as THREE from 'three';

const props = [];   // { inv: Matrix4 (world → mesh local), box: Box3 (local), solid: lens may not sit inside it, c, r: world bounding sphere }
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

// per-prop fade (0 solid … 1 faded), one byte per prop id, read by the baked materials' vertex shader (ink.js SEE)
export const FADE_W = 256, FADE_H = 64;
const fade = new Float32Array(FADE_W * FADE_H);
const fadeBytes = new Uint8Array(FADE_W * FADE_H);
export const fadeTex = new THREE.DataTexture(fadeBytes, FADE_W, FADE_H, THREE.RedFormat);
fadeTex.minFilter = fadeTex.magFilter = THREE.NearestFilter;
fadeTex.needsUpdate = true;

export function resetCamBlockers(){
  props.length = 0;
  fade.fill(0); fadeBytes.fill(0); fadeTex.needsUpdate = true;
}

/* register one prop mesh (bakeArena calls this for every mesh it merges) and return its id, or -1 past capacity.
   Double-sided planes (banners, window glows) still fade but never block the lens: they're flat, outline-free and
   passing through one is harmless, while their rotated boxes would make the lens shy away from columns for nothing. */
export function registerProp(o){
  if (props.length >= FADE_W * FADE_H) return -1;
  const geo = o.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  // a world bounding sphere, so the per-frame tests can skip props nowhere near the hero (a battle map has hundreds)
  const box = geo.boundingBox.clone(), c = box.getCenter(new THREE.Vector3()), r = box.getSize(_c).length() / 2 * o.matrixWorld.getMaxScaleOnAxis();
  props.push({ inv: o.matrixWorld.clone().invert(), box, solid: o.material.side !== THREE.DoubleSide, c: c.applyMatrix4(o.matrixWorld), r });
  return props.length - 1;
}

/* CAMERA CLEARANCE — how far along the line from the hero's head (a) to the wanted camera spot (b) the lens may sit
   (1 = all the way). Props merely BETWEEN the hero and the lens don't count: they fade (updatePropFade), so the
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
    for (const pr of props){
      if (!pr.solid) continue;
      const dx = px - pr.c.x, dy = py - pr.c.y, dz = pz - pr.c.z;
      if (dx*dx + dy*dy + dz*dz > pr.r*pr.r) continue;   // the lens spot is nowhere near this prop
      _b.set(px, py, pz).applyMatrix4(pr.inv);
      if (!pr.box.containsPoint(_b)) continue;
      // transform the segment into the prop's frame; the parameter t along it is unchanged by an affine map
      _a.set(ax, ay, az).applyMatrix4(pr.inv); _b.set(bx, by, bz).applyMatrix4(pr.inv);
      const t = segEnterBox(_a, _b, pr.box);
      if (t >= 0) best = Math.min(best, Math.max(0, t - margin / len));
    }
    if (best >= k) break;
    k = best;
  }
  return k;
}

/* SEE-THROUGH — every prop that cuts a sight line from the lens to the hero (feet, chest, head) eases toward faded,
   the rest ease back to solid. A prop the hero stands inside or right against is left alone (the line only counts
   up to `spare` short of the hero), so the wall at their back never flickers, and so is one whose box holds the hero's chest (an archway they walk under). */
const LINES = [0.5, 1.1, 1.8];
export function updatePropFade(cam, px, py, pz, dt, spare = 0.3){
  const ease = Math.min(1, dt * 8);
  const reach = Math.hypot(px - cam.x, py + 1 - cam.y, pz - cam.z) + 2;   // a prop that can cut a sight line is within this of the hero
  let dirty = false;
  for (let i = 0; i < props.length; i++){
    const pr = props[i];
    if (fade[i] === 0){ const dx = px - pr.c.x, dz = pz - pr.c.z, m = reach + pr.r; if (dx*dx + dz*dz > m*m) continue; }   // far off and already solid
    let hit = 0;
    _a.set(px, py + LINES[1], pz).applyMatrix4(pr.inv);
    if (!pr.box.containsPoint(_a)){
      _a.copy(cam).applyMatrix4(pr.inv);
      for (const h of LINES){
        const len = Math.hypot(px - cam.x, py + h - cam.y, pz - cam.z);
        if (len <= spare) continue;
        const k = 1 - spare / len;
        _b.set(cam.x + (px - cam.x)*k, cam.y + (py + h - cam.y)*k, cam.z + (pz - cam.z)*k).applyMatrix4(pr.inv);
        if (segHitsBox(_a, _b, pr.box)){ hit = 1; break; }
      }
    }
    const v = fade[i], nv = Math.abs(hit - v) < 0.01 ? hit : v + (hit - v) * ease;
    if (nv === v) continue;
    fade[i] = nv;
    const byte = Math.round(nv * 255);
    if (byte !== fadeBytes[i]){ fadeBytes[i] = byte; dirty = true; }
  }
  if (dirty) fadeTex.needsUpdate = true;
}

/* slab test: does segment a→b pass through box at all (starting inside counts) */
function segHitsBox(a, b, box){
  let t0 = 0, t1 = 1;
  for (const ax of ['x', 'y', 'z']){
    const o = a[ax], d = b[ax] - o, lo = box.min[ax], hi = box.max[ax];
    if (Math.abs(d) < 1e-9){ if (o < lo || o > hi) return false; continue; }
    let n = (lo - o) / d, f = (hi - o) / d;
    if (n > f){ const s = n; n = f; f = s; }
    if (n > t0) t0 = n;
    if (f < t1) t1 = f;
    if (t0 > t1) return false;
  }
  return true;
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
