// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The NPC model kit: enemies and bosses are drawn in the heroes' Ink style (player/model/styles.js) with the same
// chiseled geometry kit (player/model/shapes.js), then BAKED so a crowd stays cheap to draw.
//
//   1. A design function dresses a scene graph with k.add() / k.slot() / k.glow(), exactly like a hero outfit.
//   2. bake() merges every styled mesh into one mesh per material per SLOT (a slot is a group the game animates:
//      the weapon arm, the staff, the shield, the boss's saber hand), plus ONE ink-outline hull per slot.
//      Glows (eyes, thrusters, the bomb core, blades) stay as their own live meshes, since the game pulses them.
//      A BONE (k.bone, the legs) is a joint inside a slot: its meshes still merge into the slot's, rigidly skinned to it,
//      so it bends without costing a draw call of its own.
//   3. instantiate() builds a fresh group from the cached bake: shared geometry and materials, except the armour
//      material ('armor' key), which every unit gets its own copy of so hit flashes and elite tints stay per unit.
//
// A design runs once per enemy type; every spawn after that only creates groups and meshes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeStyle } from '../player/model/styles.js';

let _S = null;
const style = () => _S || (_S = makeStyle('ink'));

// shared NPC palette: surface properties per material key. 'armor' takes the unit's own colour (t.color).
export const NPC_MATERIALS = {
  armor:   { r: 0.5, m: 0.55 },              // armour plates — the per-unit material (flashes, elite tint, windup glow)
  armor2:  { r: 0.55, m: 0.5 },              // secondary plates: the armour colour, darker (set per design)
  suit:    { c: 0x1b1e24, r: 0.78, m: 0.2 },  // bodyglove / joints
  black:   { c: 0x0c0d10, r: 0.5, m: 0.4 },   // lenses, grilles, vents
  metal:   { c: 0x8a929c, r: 0.3, m: 0.85 },  // bare metal: blades, rings, droid frame
  gun:     { c: 0x16191e, r: 0.4, m: 0.6 },   // blaster bodies
  leather: { c: 0x2a2018, r: 0.8 },
  skin:    { c: 0x9c7a62, r: 0.75 },         // a bare face (the officer under its cap)
  cloth:   { c: 0x4a3f33, r: 0.95, side: THREE.DoubleSide },
};

const _inv = new THREE.Matrix4();

// the builder a design function receives
function makeBuilder(colors){
  const S = style();
  const root = new THREE.Group(); root.userData.slot = 'body';
  const mat = key => {
    const d = { ...NPC_MATERIALS[key] || {}, ...(colors[key] != null ? { c: colors[key] } : {}) };
    return S.mat('npc:' + key, d);
  };
  // methods default their parent to this.root, so k.within(group) gives a builder that dresses that group instead
  const k = {
    root,
    within(g){ return { ...this, root: g }; },
    /* place a styled mesh: k.add(geo, 'armor', parent, [x,y,z], [rx,ry,rz], {outline, scale}) */
    add(geo, key, parent = this.root, p, r, o){
      const m = S.add(geo, mat(key), parent, p, r, o);
      m.userData.key = key;
      return m;
    },
    group(parent = this.root, p = [0,0,0], r = [0,0,0]){
      const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...r); parent.add(g); return g;
    },
    /* a joint inside the slot it sits in (a leg's hip, knee, ankle): its meshes skin to it (see bake) */
    bone(name, parent = this.root, p = [0,0,0], r = [0,0,0]){
      const g = this.group(parent, p, r); g.userData.bone = name; return g;
    },
    /* an animated group the game drives (weapon arm, staff, shield, boss hand). Its meshes bake separately. */
    slot(name, parent = this.root, p = [0,0,0], r = [0,0,0]){
      const g = this.group(parent, p, r); g.userData.slot = name; return g;
    },
    /* an unlit glow that stays live: eyes, thrusters, cores, blades. tag names the userData hook it fills;
       unique: true gives every unit its own material (for glows the game recolours or fades per unit) */
    glow(geo, color, parent = this.root, p = [0,0,0], r = [0,0,0], o = {}){
      const additive = o.opacity != null;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial(additive
        ? { color, transparent: true, opacity: o.opacity, blending: THREE.AdditiveBlending, depthWrite: false }
        : { color, toneMapped: false }));
      m.position.set(...p); m.rotation.set(...r);
      if (o.scale) Array.isArray(o.scale) ? m.scale.set(...o.scale) : m.scale.setScalar(o.scale);
      m.userData.live = { tag: o.tag, unique: !!o.unique };
      parent.add(m);
      return m;
    },
    /* a live non-mesh object (point light, eye group of several glows) */
    live(obj, parent = this.root, tag){ obj.userData.live = { tag }; parent.add(obj); return obj; },
  };
  return k;
}

// o's transform relative to `to` (through any plain groups between), as position / rotation / scale
function relTo(o, to){
  const position = new THREE.Vector3(), quat = new THREE.Quaternion(), scale = new THREE.Vector3();
  (to ? new THREE.Matrix4().multiplyMatrices(_inv.copy(to.matrixWorld).invert(), o.matrixWorld) : o.matrix).decompose(position, quat, scale);
  return { position, rotation: new THREE.Euler().setFromQuaternion(quat), scale };
}

// merge a design's scene graph into per-slot geometry
function bake(root){
  root.updateMatrixWorld(true);
  const slots = [], index = new Map();
  const slotOf = o => { while (!o.userData.slot) o = o.parent; return o; };
  const boneOf = o => { while (!o.userData.slot && !o.userData.bone) o = o.parent; return o; };
  const insideLive = o => { for (let p = o.parent; p; p = p.parent) if (p.userData.live) return true; return false; };
  root.traverse(o => {
    if (!o.userData.slot) return;
    const parent = o === root ? null : slotOf(o.parent);
    // placed relative to its parent SLOT, through any plain groups between (the bosses' scaled-up body)
    const s = { name: o.userData.slot, parent: parent && parent.userData.slot, ...relTo(o, parent),
      byKey: new Map(), hulls: [], live: [], bones: [], boneIdx: new Map([[o, 0]]) };   // bone 0: the slot itself
    index.set(o, s); slots.push(s);
  });
  // each slot's bones, parents first, placed relative to their parent bone
  root.traverse(o => {
    if (!o.userData.bone) return;
    const s = index.get(slotOf(o)), up = boneOf(o.parent);
    s.boneIdx.set(o, s.bones.length + 1);
    s.bones.push({ name: o.userData.bone, parent: s.boneIdx.get(up), ...relTo(o, up) });
  });
  // rigid skinning: every vertex follows the one bone its mesh hangs from (0 = the slot)
  const skin = (g, s, o) => {
    if (!s.bones.length) return g;
    const n = g.attributes.position.count, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
    idx.fill(0); const b = s.boneIdx.get(boneOf(o.parent));
    for (let i = 0; i < n; i++){ idx[i*4] = b; wt[i*4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    return g;
  };
  let hullMat = null;
  root.traverse(o => {
    if (o.userData.slot || insideLive(o)) return;   // slot groups are rebuilt; a live object's children travel with it
    const so = slotOf(o.parent), s = index.get(so);
    const rel = new THREE.Matrix4().multiplyMatrices(_inv.copy(so.matrixWorld).invert(), o.matrixWorld);
    if (o.userData.live){
      const c = o.clone(); rel.decompose(c.position, c.quaternion, c.scale);
      s.live.push(c);
      return;
    }
    if (!o.isMesh || !o.userData.key) return;      // plain groups, and the hulls (merged with their mesh below)
    if (!s.byKey.has(o.userData.key)) s.byKey.set(o.userData.key, { mat: o.material, geos: [] });
    s.byKey.get(o.userData.key).geos.push(skin(strip(o.geometry).applyMatrix4(rel), s, o));
    const hull = o.children.find(c => c.isMesh && !c.userData.key);
    if (hull){ hullMat = hull.material; s.hulls.push(skin(strip(hull.geometry).applyMatrix4(rel), s, o)); }
  });
  for (const s of slots){
    s.meshes = [...s.byKey].map(([key, { mat, geos }]) => ({ key, mat, geo: mergeGeometries(geos) }));
    s.hull = s.hulls.length ? mergeGeometries(s.hulls) : null;
    s.hullMat = hullMat;
    delete s.byKey; delete s.hulls; delete s.boneIdx;
  }
  return slots;
}
// position + normal only, non-indexed, so every part merges with every other
function strip(g){
  const c = (g.index ? g.toNonIndexed() : g.clone());
  for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal') c.deleteAttribute(k);
  if (!c.attributes.normal) c.computeVertexNormals();
  return c;
}

/* build (once) and cache a design. design(k, colors) dresses k.root; returns the bake */
const CACHE = new Map();
export function bakeDesign(id, design, colors = {}){
  if (CACHE.has(id)) return CACHE.get(id);
  const k = makeBuilder(colors);
  design(k);
  const baked = { slots: bake(k.root) };
  CACHE.set(id, baked);
  return baked;
}

/* a fresh unit from a bake. Returns the root group; its userData holds bodyMat (this unit's own armour material)
   plus every slot by name and every tagged live object (tags ending in [] collect into arrays). */
export function instantiate(baked){
  const groups = new Map();
  let bodyMat = null;
  const ud = {}, binds = [];
  for (const s of baked.slots){
    const g = new THREE.Group();
    g.position.copy(s.position); g.rotation.copy(s.rotation); g.scale.copy(s.scale);
    groups.set(s.name, g);
    if (s.parent) groups.get(s.parent).add(g);
    if (s.name !== 'body') ud[s.name] = g;
    // the slot's bones (plain groups: a skeleton only reads their world matrices), exposed by name like the slots
    let bones = null;
    if (s.bones.length){
      bones = [g];
      for (const b of s.bones){
        const j = new THREE.Group();
        j.position.copy(b.position); j.rotation.copy(b.rotation); j.scale.copy(b.scale);
        bones[b.parent].add(j); bones.push(j); ud[b.name] = j;
      }
    }
    const Mesh = (geo, m) => {
      if (!bones) return new THREE.Mesh(geo, m);
      const sm = new THREE.SkinnedMesh(geo, m);
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      sm.boundingSphere = geo.boundingSphere.clone(); sm.boundingSphere.radius += 0.6;   // the rest pose's, with room for a stride
      binds.push([sm, bones]);
      return sm;
    };
    for (const { key, mat, geo } of s.meshes){
      let m = mat;
      if (key === 'armor'){
        if (!bodyMat){ bodyMat = mat.clone(); bodyMat.emissive.setHex(0); bodyMat.emissiveIntensity = 0; }
        m = bodyMat;
      }
      const mesh = Mesh(geo, m);
      mesh.castShadow = true;
      g.add(mesh);
    }
    if (s.hull){
      const h = Mesh(s.hull, s.hullMat);
      h.castShadow = false;
      g.add(h);
    }
    for (const src of s.live){
      const c = src.clone();
      if (c.isMesh && src.userData.live.unique) c.material = src.material.clone();
      if (!c.isMesh) c.traverse(o => { if (o.isMesh && o.userData.live && o.userData.live.unique) o.material = o.material.clone(); });
      g.add(c);
      const tag = src.userData.live.tag;
      if (!tag) continue;
      if (tag.endsWith('[]')){ const n = tag.slice(0, -2); (ud[n] = ud[n] || []).push(c); }
      else ud[tag] = c;
    }
  }
  const root = groups.get('body');
  // bind the skinned meshes in the rest pose, one skeleton per slot
  root.updateMatrixWorld(true);
  const skels = new Map();
  for (const [m, bones] of binds){
    if (!skels.has(bones)) skels.set(bones, new THREE.Skeleton(bones));
    m.bind(skels.get(bones), m.matrixWorld);
  }
  root.userData = { ...ud, bodyMat };
  return root;
}
