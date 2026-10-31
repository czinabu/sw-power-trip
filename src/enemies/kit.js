// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The NPC model kit: enemies and bosses are drawn in the heroes' Ink style (player/model/styles.js) with the same
// chiseled geometry kit (player/model/shapes.js), then BAKED so a crowd stays cheap to draw.
//
//   1. A design function dresses a scene graph with k.add() / k.slot() / k.glow(), exactly like a hero outfit.
//   2. bake() merges every styled mesh into one mesh per material per SLOT (a slot is a group the game animates:
//      the weapon arm, the staff, the shield, the boss's saber hand), plus ONE ink-outline hull per slot.
//      Glows (eyes, thrusters, the bomb core, blades) stay as their own live meshes, since the game pulses them.
//      A BONE (k.bone: the legs, the waist, the neck) is a joint inside a slot: its meshes still merge into the slot's,
//      skinned to it, so it bends without costing a draw call of its own. A bone given a blend radius bends SMOOTHLY:
//      the skin within that reach of the joint is shared with the bone across it, so a knee, a hip, the waist and the
//      neck fold like one body instead of hinging as separate parts.
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
  eyew:    { c: 0xcfc6b8, r: 0.6 },          // the whites of its eyes
  hair:    { c: 0x2a2018, r: 0.85 },
  lip:     { c: 0x6a4434, r: 0.7 },
  cloth:   { c: 0x4a3f33, r: 0.95, side: THREE.DoubleSide },
  mark:    { c: 0xc8601c, r: 0.6, m: 0.3 },   // rank and field paint (enemies/mesh.js markings)
};

const _inv = new THREE.Matrix4();
export const SCARS = 6;   // saber cuts a unit's armour keeps (the oldest is reused)
export const HITS = 8;    // other marks it keeps: blaster scorches, dents, cracks, torn-off plates (enemies/scars.js markHit)

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
    /* a joint inside the slot it sits in (a leg's hip, knee, ankle): its meshes skin to it (see bake).
       o.blend: how far along the bone (either side of the joint) the skin is shared with its parent; o.reach: how far
       out from the bone's line that sharing goes (keeps a hip from pulling the far side of the pelvis along) */
    bone(name, parent = this.root, p = [0,0,0], r = [0,0,0], o = {}){
      const g = this.group(parent, p, r); g.userData.bone = name;
      if (o.blend) g.userData.blend = { R: o.blend, L: o.reach ?? 1 };
      return g;
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
    const parent = o === root ? null : slotOf(o.parent), pj = o === root ? null : boneOf(o.parent);
    // placed relative to its parent SLOT, through any plain groups between (the bosses' scaled-up body); a slot that
    // hangs inside one of its parent's bones (the weapon arm on the chest) rides that bone instead
    const s = { name: o.userData.slot, parent: parent && parent.userData.slot, parentBone: pj && pj.userData.bone || null, ...relTo(o, pj),
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
  // each blended joint in its slot's space: where it is, the line of its bone, and how far its shared skin reaches
  for (const [so, s] of index){
    s.joints = [];
    for (const [j, bi] of s.boneIdx){
      if (!bi || !j.userData.blend) continue;
      const M = new THREE.Matrix4().multiplyMatrices(_inv.copy(so.matrixWorld).invert(), j.matrixWorld);
      const at = new THREE.Vector3().setFromMatrixPosition(M), axis = new THREE.Vector3().setFromMatrixColumn(M, 1);
      const sc = axis.length(); axis.normalize();
      s.joints.push({ bi, up: s.boneIdx.get(boneOf(j.parent)), at, axis, R: j.userData.blend.R * sc, L: j.userData.blend.L * sc });
    }
  }
  // skinning: every vertex follows the bone its mesh hangs from (0 = the slot), and near a blended joint it shares
  // up to half its weight with the bone on the other side, fading out over the joint's radius. Both sides meet at
  // exactly half and half on the joint itself, so the skin stays closed however far the joint bends.
  const _d = new THREE.Vector3(), _p = new THREE.Vector3();
  const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const skin = (g, s, o) => {
    if (!s.bones.length) return g;
    const n = g.attributes.position.count, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
    const b = s.boneIdx.get(boneOf(o.parent)), pos = g.attributes.position;
    const near = s.joints.filter(J => J.bi === b || J.up === b);   // this bone's own joint, and its children's
    for (let i = 0; i < n; i++){
      idx[i*4] = b; wt[i*4] = 1;
      if (!near.length) continue;
      _p.fromBufferAttribute(pos, i);
      let best = 0, other = 0;
      for (const J of near){
        _d.subVectors(_p, J.at);
        const t = _d.dot(J.axis), lat = _d.addScaledVector(J.axis, -t).length();
        const w = 0.5 * (1 - ss(Math.abs(t) / J.R)) * (1 - ss((lat - J.L * 0.7) / (J.L * 0.3)));
        if (w > best){ best = w; other = J.bi === b ? J.up : J.bi; }
      }
      if (best > 0.001){ idx[i*4+1] = other; wt[i*4] = 1 - best; wt[i*4+1] = best; }
    }
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
      // a live glow inside a bone (a visor on the head) rides that bone
      const j = boneOf(o.parent), c = o.clone();
      (j.userData.bone ? new THREE.Matrix4().multiplyMatrices(_inv.copy(j.matrixWorld).invert(), o.matrixWorld) : rel).decompose(c.position, c.quaternion, c.scale);
      c.userData.liveBone = j.userData.bone || null;
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
    delete s.byKey; delete s.hulls; delete s.boneIdx; delete s.joints;
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

/* WEAR on a unit's armour plates: chipped paint showing grey metal under it, and grime that climbs from the boots,
   both seeded per unit so no two troopers in a squad are worn the same. Laid over the Ink surface the source
   material carries (clone() drops shader hooks, so they are re-attached here). o.wear 0 (parade fresh) → 1 (beaten);
   o.seed picks the pattern. The grime is measured from the unit's feet (uBase, set each frame by enemies/upper.js). */
function makeWear(o){
  return { uSeed: { value: o.seed ?? Math.random() * 97 }, uWear: { value: o.wear ?? 0.5 }, uBase: { value: 0 }, uScale: { value: 1 },
    // saber cuts (enemies/scars.js): each a short burnt line in the body's rest pose (xyz, when it was cut; direction,
    // half its length). Fresh, the line glows; it cools to a black char that stays
    uScar: { value: Array.from({ length: SCARS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uScarDir: { value: Array.from({ length: SCARS }, () => new THREE.Vector4(0, 0, 0, 0)) }, uNow: { value: 0 },
    // HIT MARKS (enemies/scars.js markHit): xyz in the rest pose, when; then size, kind (1 scorch · 2 dent · 3 crack ·
    // 4 a plate torn off, the suit showing), a per-mark seed
    uHit: { value: Array.from({ length: HITS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uHitK: { value: Array.from({ length: HITS }, () => new THREE.Vector4(0, 0, 0, 0)) } };
}
// both of a unit's plate materials (the armour and its darker trim) share one set of wear uniforms, so a cut runs on
// across the seam between them
function wearArmor(m, src, W){
  const base = src.onBeforeCompile, key = src.customProgramCacheKey();
  m.userData.wear = W;
  m.onBeforeCompile = (sh, r) => {
    base.call(m, sh, r);
    Object.assign(sh.uniforms, W);
    sh.vertexShader = 'varying vec3 vRest;\nvarying float vWY;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = `varying vec3 vRest;
      varying float vWY;
      uniform float uSeed, uWear, uBase, uScale, uNow;
      uniform vec4 uScar[${SCARS}], uScarDir[${SCARS}], uHit[${HITS}], uHitK[${HITS}];
      float wHash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float wNoise(vec3 p){
        vec3 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
        return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float n = wNoise(vRest * 9.0 + uSeed) * 0.65 + wNoise(vRest * 23.0 - uSeed) * 0.35;
        float chip = step(0.8 - 0.14 * uWear, n);                          // hard-edged chips, Ink style
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.38, 0.41), chip * 0.75);
        float h = (vWY - uBase) / uScale;                                   // height above the feet, in model units
        float grime = (1.0 - smoothstep(0.05, 0.75, h)) * (0.25 + 0.5 * wNoise(vRest * 4.0 + uSeed * 3.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.48, 0.4), step(0.18, grime * uWear) * 0.8);
      }
      float scarHot = 0.0;
      {
        float scarChar = 0.0;
        for (int i = 0; i < ${SCARS}; i++){
          vec4 s = uScar[i], d = uScarDir[i];
          if (d.w <= 0.0) continue;
          vec3 r = vRest - s.xyz;
          float t = clamp(dot(r, d.xyz), -d.w, d.w), dist = length(r - d.xyz * t);
          float taper = 1.0 - pow(abs(t) / d.w, 4.0), wob = wNoise(vRest * 31.0 + float(i) * 7.0);
          float core = 1.0 - step(0.016 * taper + 0.008 * wob, dist);            // the cut itself, pointed at both ends
          float halo = 1.0 - step(0.04 * taper + 0.022 * wob, dist);          // the scorched plate around it
          scarChar = max(scarChar, max(core, halo * 0.5));
          scarHot = max(scarHot, core * exp(-(uNow - s.w) * 1.3));
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.035, 0.03), scarChar);
      }
      {
        // HIT MARKS, drawn in hard Ink steps: a sooty blaster scorch with a hot core that cools, a dent (a dark crease
        // ring round a bright pushed-in face, the paint knocked off), a starburst crack across a helm, a torn-off plate
        for (int i = 0; i < ${HITS}; i++){
          vec4 h = uHit[i], hk = uHitK[i];
          if (hk.x <= 0.0) continue;
          vec3 r = vRest - h.xyz;
          float n = wNoise(vRest * 40.0 + hk.z), d = length(r) / hk.x + (n - 0.5) * 0.35;
          if (d > 1.3) continue;
          float age = uNow - h.w;
          if (hk.y < 1.5){        // scorch
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.05, 0.045), 1.0 - step(0.75, d));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55, (1.0 - step(1.15, d)) * step(0.75, d));
            scarHot = max(scarHot, (1.0 - step(0.28, d)) * exp(-age * 3.0) * 0.5);   // glows a moment, then cools
          } else if (hk.y < 2.5){ // dent
            float ring = step(0.62, d) * (1.0 - step(0.86, d));
            float face = 1.0 - step(0.62, d);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.42, 0.45), face * step(0.45, n) * 0.85);   // bare metal where the paint came off
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25, face * (1.0 - step(0.45, n)) * 0.6);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.04, 0.05), ring * 0.9);
          } else if (hk.y < 3.5){ // crack
            float a = atan(r.y, r.x + r.z * 0.6) * 5.0 + hk.z * 6.0 + wNoise(vRest * 18.0 + hk.z) * 3.0;
            float ray = step(0.9, abs(sin(a))) * (1.0 - step(1.0, d));
            float pit = 1.0 - step(0.18, d);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.03, 0.035), max(ray, pit));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.3, (1.0 - step(0.4, d)) * (1.0 - max(ray, pit)) * 0.5);
          } else {                // a plate torn off: the dark suit under it, a ragged bright metal edge
            float hole = 1.0 - step(0.85, d), lip = step(0.85, d) * (1.0 - step(1.02, d));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.11, 0.13), hole);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.57, 0.6), lip);
          }
        }
      }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(2.6, 0.8, 0.2) * scarHot;   // over 1: the bloom catches a fresh cut`);
  };
  m.customProgramCacheKey = () => key + '-wear';
}

/* a fresh unit from a bake. Returns the root group; its userData holds bodyMat (this unit's own armour material)
   plus every slot by name and every tagged live object (tags ending in [] collect into arrays). */
export function instantiate(baked, o = {}){
  const groups = new Map();
  let bodyMat = null, plateMat = null, W = null;
  const wear = () => W || (W = makeWear(o));
  const ud = {}, binds = [], joints = new Map();   // joints: 'slot/bone' → its group
  for (const s of baked.slots){
    const g = new THREE.Group();
    g.position.copy(s.position); g.rotation.copy(s.rotation); g.scale.copy(s.scale);
    groups.set(s.name, g);
    if (s.parent) (s.parentBone ? joints.get(s.parent + '/' + s.parentBone) : groups.get(s.parent)).add(g);
    if (s.name !== 'body') ud[s.name] = g;
    // the slot's bones (plain groups: a skeleton only reads their world matrices), exposed by name like the slots
    let bones = null;
    if (s.bones.length){
      bones = [g];
      for (const b of s.bones){
        const j = new THREE.Group();
        j.position.copy(b.position); j.rotation.copy(b.rotation); j.scale.copy(b.scale); j.name = b.name;
        bones[b.parent].add(j); bones.push(j); ud[b.name] = j; joints.set(s.name + '/' + b.name, j);
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
        if (!bodyMat){
          bodyMat = mat.clone(); bodyMat.emissive.setHex(0); bodyMat.emissiveIntensity = 0;
          // clone() drops the shader hooks: carry the Ink surface (chrome on the plates) and add this unit's wear
          wearArmor(bodyMat, mat, wear());
        }
        m = bodyMat;
      } else if (key === 'armor2'){
        // the trim plates are this unit's own too: they wear, and take saber cuts, with the armour
        if (!plateMat){ plateMat = mat.clone(); wearArmor(plateMat, mat, wear()); }
        m = plateMat;
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
      (src.userData.liveBone ? joints.get(s.name + '/' + src.userData.liveBone) : g).add(c);
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
  // the body's own skinned mesh: enemies/scars.js reads its skeleton to pin a cut to the plate it landed on
  const bodySkin = (binds.find(([m]) => m.parent === root && m.material === bodyMat) || [])[0] || null;
  root.userData = { ...ud, bodyMat, plateMat, bodySkin };
  return root;
}
