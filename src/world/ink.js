// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Ink look for the arenas: the same cel bands + dark ink outline as the heroes and enemies, applied to every static
// arena prop, then BAKED into one mesh per material (plus one outline hull per material) so a whole arena costs a
// couple of dozen draw calls instead of hundreds.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerProp, fadeTex, FADE_W } from './camblock.js';

export const INK = 0x07060a;   // the model outline colour

let _ramp = null;
// the heroes' toon ramp (player/model/styles.js): three lit bands and a shadow band, hard steps
function ramp(){
  if (_ramp) return _ramp;
  _ramp = new THREE.DataTexture(new Uint8Array([70, 150, 235, 255]), 4, 1, THREE.RedFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.needsUpdate = true;
  return _ramp;
}

const toonCache = new Map();
/* a cel-shaded material for an arena surface (cached per colour/side/emissive, shared across rebuilds) */
export function toon(color, o = {}){
  const id = color + '|' + (o.side || 0) + '|' + (o.emissive || 0) + '|' + (o.ei || 0) + '|' + (o.map ? o.map.uuid : '');
  if (toonCache.has(id)) return toonCache.get(id);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp() });
  if (o.side) m.side = o.side;
  if (o.emissive){ m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.map) m.map = o.map;
  toonCache.set(id, m);
  return m;
}

/* a toon material of its own (not cached): for things the game recolours or flashes per object (barrels) */
export function toonUnique(color, o = {}){
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp() });
  if (o.emissive){ m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  return m;
}

const inkCache = new Map();
/* the outline hull material: back faces pushed out along the normal, drawn in ink */
export function inkHull(width){
  const k = width.toFixed(3);
  if (inkCache.has(k)) return inkCache.get(k);
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  // the hull is dropped right at the lens: if the camera grazes (or briefly clips into) a prop, the hull's back faces
  // would otherwise fill the view solid black instead of letting you see through
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vInkDepth;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${k};`)
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vInkDepth = -mvPosition.z;');
    sh.fragmentShader = 'varying float vInkDepth;\n' + sh.fragmentShader
      .replace('void main() {', 'void main() {\n  if (vInkDepth < 0.6) discard;');
  };
  m.customProgramCacheKey = () => 'inkhull' + k;
  inkCache.set(k, m);
  return m;
}

/* SEE-THROUGH — a baked prop standing between the lens and the hero turns slightly see-through, whole and in its own
   shape, so the hero (and the fight) stay in view instead of the camera diving in past it. Each merged vertex carries
   its prop's id (aProp); world/camblock.js decides per frame which props are in the way and eases their entry in a
   small fade texture, which the vertex shader reads. The fade itself is a fine screen-door dither (no transparency
   sorting against the merged arena meshes); shadows are drawn with a separate depth material and stay whole. */
export const SEE = {
  tex: { value: fadeTex },
  amt: { value: 0.55 },     // share of a fully faded prop's pixels dropped: 0 = solid, 1 = gone
};
const seeCache = new Map();
/* the see-through variant of a baked arena material (cached per source material, shared across rebuilds) */
export function seeThrough(src){
  if (seeCache.has(src.uuid)) return seeCache.get(src.uuid);
  const m = src.clone();
  const prev = src.onBeforeCompile, key = src.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(src, sh, r);
    sh.uniforms.uSeeTex = SEE.tex; sh.uniforms.uSeeAmt = SEE.amt;
    sh.vertexShader = `attribute float aProp;\nuniform sampler2D uSeeTex;\nvarying float vSee;\n` + sh.vertexShader
      .replace('#include <project_vertex>', `#include <project_vertex>
  int sid = int(floor(aProp + 0.5));
  vSee = sid < 0 ? 0.0 : texelFetch(uSeeTex, ivec2(sid % ${FADE_W}, sid / ${FADE_W}), 0).r;`);
    sh.fragmentShader = 'varying float vSee;\nuniform float uSeeAmt;\n' + sh.fragmentShader
      .replace('void main() {', `void main() {
  if (vSee > 0.0 && vSee * uSeeAmt > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`);
  };
  m.customProgramCacheKey = () => key + '|see';
  seeCache.set(src.uuid, m);
  return m;
}

/* an outline hull for any geometry: position-only, welded so the normals average across corners */
export function hullGeo(geo){
  const c = new THREE.BufferGeometry();
  c.setAttribute('position', geo.attributes.position);
  if (geo.attributes.aProp) c.setAttribute('aProp', geo.attributes.aProp);   // baked: each prop's outline fades with it
  if (geo.index) c.setIndex(geo.index);
  const m = mergeVertices(c, 1e-3);
  m.computeVertexNormals();
  return m;
}

/* give one live (not baked) mesh the Ink look: hazards, barrels, anything the game moves or recolours */
export function inkify(mesh, width = 0.04){
  const hull = new THREE.Mesh(hullGeo(mesh.geometry), inkHull(width));
  hull.castShadow = false; hull.userData.noBake = true;
  mesh.add(hull);
  return mesh;
}

/* BAKE an arena: every MeshStandardMaterial / MeshToonMaterial mesh under `group` is converted to the toon look,
   merged per material, and given one outline hull per material. Unlit glows (MeshBasicMaterial: lava, braziers,
   beacons, the sky), points, lines and anything flagged userData.noBake stay live and untouched.
   width: outline thickness in world units. */
export function bakeArena(group, width = 0.045){
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const baked = [];
  group.traverse(o => {
    if (!o.isMesh || o.userData.noBake || o.userData.baked) return;
    for (let p = o.parent; p && p !== group; p = p.parent) if (p.userData.noBake) return;
    const src = o.material;
    if (!src || Array.isArray(src) || !(src.isMeshStandardMaterial || src.isMeshToonMaterial)) return;
    const mat = src.isMeshToonMaterial ? src
      : toon(src.color.getHex(), { side: src.side, emissive: src.emissive && src.emissive.getHex(), ei: src.emissiveIntensity });
    const g = new THREE.BufferGeometry();
    const sg = o.geometry;
    g.setAttribute('position', sg.attributes.position.clone());
    g.setAttribute('normal', sg.attributes.normal.clone());
    if (mat.map && sg.attributes.uv) g.setAttribute('uv', sg.attributes.uv.clone());
    g.setIndex(sg.index ? sg.index.clone()
      : new THREE.BufferAttribute(Uint32Array.from({ length: sg.attributes.position.count }, (_, i) => i), 1));
    g.applyMatrix4(o.matrixWorld);
    g.setAttribute('aProp', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(registerProp(o)), 1));
    const key = mat.uuid + (o.castShadow ? 's' : '') + (o.userData.noOutline || src.side === THREE.DoubleSide ? 'n' : '');
    if (!buckets.has(key)) buckets.set(key, { mat, geos: [], shadow: o.castShadow, outline: !key.endsWith('n') });
    buckets.get(key).geos.push(g);
    baked.push(o);
  });
  // lift anything that is NOT being baked out from under a baked parent, then drop the baked meshes
  const bakedSet = new Set(baked);
  for (const o of baked){
    for (const ch of [...o.children]) if (!bakedSet.has(ch)) group.attach(ch);
  }
  for (const o of baked){ if (o.parent) o.parent.remove(o); o.geometry.dispose(); }
  let calls = 0;
  for (const b of buckets.values()){
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, seeThrough(b.mat));
    m.castShadow = b.shadow; m.receiveShadow = true;
    m.userData.baked = true;
    group.add(m); calls++;
    if (b.outline && width > 0){
      const hull = new THREE.Mesh(hullGeo(merged), seeThrough(inkHull(width)));
      hull.userData.baked = true;
      group.add(hull); calls++;
    }
  }
  return { meshes: baked.length, calls };
}
