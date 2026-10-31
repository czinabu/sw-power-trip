// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Render styles for the hero models. The geometry kit is shared; a style decides how the chiseled planes are
// shaded (flat facets, cel bands + ink outline, or creased hard-surface with reflections).

import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { renderer, hemi, darkFill } from '../../engine/renderer.js';

export const STYLE_DEFS = {
  // SHARD — every plane is its own flat facet; a soft top-to-bottom value ramp keeps it from reading as raw low-poly
  shard:  { label: 'Shard',  flat: true,  gradient: [0.68, 1.06], jitter: 0.14, crease: 0,    env: 0,    outline: 0,     toon: false },
  // INK (the game's look) — cel-shaded bands with a dark ink outline: comic-book silhouettes that read in a crowd
  ink:    { label: 'Ink',    flat: false, gradient: null,          crease: 0.55, env: 0,    outline: 0.014, toon: true },
  // FORGED — crisp creased hard-surface with real reflections on metal
  forged: { label: 'Forged', flat: false, gradient: [0.8, 1.04],   crease: 0.55, env: 1,    outline: 0,     toon: false },
};

/* surface properties per material name: c default colour, r roughness, m metalness, e emissive.
   The look's palette (appearance.js) overrides c, so recolouring never touches this table. */
export const MATERIALS = {
  // Jedi (Mace Windu)
  robe:    { c: 0x3b2a1e, r: 0.9 },
  tunic:   { c: 0x9c7d58, r: 0.85 },
  tabard:  { c: 0x6b4f37, r: 0.88 },
  leather: { c: 0x23170f, r: 0.65 },
  skin:    { c: 0x5c3826, r: 0.55 },
  hair:    { c: 0x140e0a, r: 0.8 },
  eyes:    { c: 0x2a1a10, r: 0.3 },
  boot:    { c: 0x1a120c, r: 0.6 },
  trim:    { c: 0xb08a4a, r: 0.4, m: 0.7 },
  // Mandalorian
  beskar:  { c: 0x9aa7b5, r: 0.34, m: 0.9 },
  beskar2: { c: 0x667381, r: 0.4,  m: 0.85 },
  suit:    { c: 0x2e343d, r: 0.75, m: 0.15 },
  accent:  { c: 0xb84327, r: 0.5,  m: 0.35 },
  visor:   { c: 0x07090c, r: 0.15, m: 0.8, e: 0x0c2630, ei: 0.6 },
  cloth:   { c: 0x7b6b52, r: 0.96, side: THREE.DoubleSide },
  strap:   { c: 0x3a2e22, r: 0.8 },
  // weapons
  gunDark: { c: 0x16191e, r: 0.4, m: 0.6 },
  gunMetal:{ c: 0x8a929c, r: 0.3, m: 0.85 },
  hilt:    { c: 0x9aa4b0, r: 0.3, m: 0.85 },
};

let _env = null;
function envMap(){
  if (_env) return _env;
  const pm = new THREE.PMREMGenerator(renderer);
  _env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return _env;
}

let _ramp = null;
function toonRamp(){
  if (_ramp) return _ramp;
  _ramp = new THREE.DataTexture(new Uint8Array([70, 150, 235, 255]), 4, 1, THREE.RedFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.needsUpdate = true;
  return _ramp;
}

// vertical value ramp baked into vertex colours (darker at the bottom of each part)
function bakeGradient(g, [lo, hi]){
  g.computeBoundingBox();
  const { min, max } = g.boundingBox, p = g.attributes.position, h = Math.max(1e-4, max.y - min.y);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++){
    const k = lo + (hi - lo) * ((p.getY(i) - min.y) / h);
    col[i*3] = col[i*3+1] = col[i*3+2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/* SURFACE for the Ink look: cel bands alone make beskar and cloth read the same. Metal gets a stylised chrome
   reflection (the arena's sky above a dark horizon line, mirrored in the plate, from the ambient light's own
   colours so every arena tints it), a hard sun glint and a bright fresnel rim; rougher metal blurs the horizon.
   Cloth and leather stay matte with only a faint soft rim, so the two materials separate at a glance. */
const SKY = { value: hemi.color }, GROUND = { value: hemi.groundColor };
/* INK RIM: a thin stepped band of light just inside the ink outline, brightest on upward-facing edges (the sky
   catching the shoulders, the crown, the top of each arm). With the black hull outside it, every character keeps a
   light-then-dark edge that lifts it off a dark arena or a busy backdrop. One knob for the whole cast (heroes,
   squadmates, enemies, bosses all draw through this surface). */
export const inkRim = { value: 0.34 };
function inkSurface(m, metal, rough, rimK = 1){
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uSky: SKY, uGround: GROUND, uMetal: { value: metal }, uRough: { value: rough }, uFill: darkFill, uRim: inkRim, uRimK: { value: rimK } });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSky, uGround;\nuniform float uMetal, uRough, uFill, uRim, uRimK;')
      .replace('#include <opaque_fragment>', `
        vec3 vv = normalize(vViewPosition);   // towards the camera
        vec3 nn = normalize(normal);
        float lit = dot(reflectedLight.directDiffuse, vec3(0.333)) / max(dot(diffuseColor.rgb, vec3(0.333)), 1e-3);
        float rim = pow(1.0 - clamp(dot(nn, vv), 0.0, 1.0), 3.0);
        vec3 surf = vec3(0.0);
        if (uMetal > 0.0){
          vec3 r = inverseTransformDirection(reflect(-vv, nn), viewMatrix);   // world-space reflection
          float w = mix(0.015, 0.2, uRough);
          float sky = smoothstep(-w, w, r.y);
          float horizon = 1.0 - smoothstep(0.0, w * 1.5 + 0.03, abs(r.y));   // the dark line where sky meets ground
          vec3 env = mix(uGround * 0.5, uSky * (0.75 + 0.6 * smoothstep(0.35, 0.9, r.y)), sky) * (1.0 - 0.55 * horizon);
          outgoingLight = mix(outgoingLight, outgoingLight * 0.45 + env * diffuseColor.rgb * 1.5, uMetal);
          #if NUM_DIR_LIGHTS > 0
            float glint = pow(max(dot(nn, normalize(directionalLights[0].direction + vv)), 0.0), mix(90.0, 18.0, uRough));
            surf += directionalLights[0].color * smoothstep(0.45, 0.6, glint) * step(0.6, lit) * uMetal * 0.7;
          #endif
          surf += uSky * smoothstep(0.45, 0.55, rim) * uMetal * 0.45;
        } else {
          surf += uSky * rim * (1.0 - uRough) * 0.35 * diffuseColor.rgb;   // leather catches a little; wool almost none
          // dark cloth in the arena: an albedo-independent sky fill plus a cool rim so black robes keep their folds and edges
          float dark = 1.0 - smoothstep(0.004, 0.03, dot(diffuseColor.rgb, vec3(0.333)));   // black cloth and hair only, never skin
          vec3 fill = mix(vec3(dot(uSky, vec3(0.333))), uSky, 0.25);                       // near-neutral so black stays black
          surf += fill * (0.035 + 0.3 * rim) * dark * uFill;
        }
        {
          float upw = clamp(inverseTransformDirection(nn, viewMatrix).y, 0.0, 1.0);
          float band = smoothstep(0.42, 0.52, rim);   // stepped, like the cel bands: an edge, not a glow
          vec3 rimC = mix(uSky, vec3(1.0), 0.45) * (0.45 + 0.55 * upw);
          surf += rimC * band * uRim * uRimK * (1.0 - 0.6 * uMetal);
        }
        outgoingLight += surf;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'ink-surface-' + (metal > 0 ? 'm' : 'c');
  return m;
}

export function makeStyle(name = 'ink', colors = {}){
  const cfg = STYLE_DEFS[name] || STYLE_DEFS.forged;
  const mats = new Map();
  let outlineMat = null;

  function mat(key, over = {}){
    const id = key + JSON.stringify(over);
    if (mats.has(id)) return mats.get(id);
    const d = { ...MATERIALS[key], ...(colors[key] != null ? { c: colors[key] } : {}), ...over };
    if (d.shade) d.c = new THREE.Color(d.c).multiplyScalar(d.shade).getHex();
    let m;
    if (cfg.toon){
      // cel bands flatten metal; lift metals a touch so beskar still reads bright against the suit
      const c = new THREE.Color(d.c);
      if (d.m) c.offsetHSL(0, -0.05, 0.08);
      m = inkSurface(new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp() }), Math.min(1, Math.max(0, ((d.m || 0) - 0.2) / 0.7)), d.r ?? 0.8, d.noRim ? 0 : 1);
    } else {
      m = new THREE.MeshStandardMaterial({
        color: d.c, roughness: d.r ?? 0.8, metalness: (d.m || 0) * (cfg.env ? 1 : 0.75), flatShading: cfg.flat,
        vertexColors: !!cfg.gradient,
      });
      if (cfg.env){ m.envMap = envMap(); m.envMapIntensity = d.m ? 0.4 : 0.2; }
    }
    if (d.e){ m.emissive = new THREE.Color(d.e); m.emissiveIntensity = d.ei ?? 1; }
    if (d.side) m.side = d.side;
    if (d.o != null){ m.transparent = true; m.opacity = d.o; m.depthWrite = false; }   // see-through parts (light stubble)
    m.userData.ink = { key, over };
    mats.set(id, m);
    return m;
  }
  /* small un-outlined details (eyes, brows, nose, mouth, visor slits) sit at grazing angles on the head, where the rim
     band would draw stray light lines across the face: they get the same material without the rim (heroes only: NPC
     bakes group meshes by material, so their materials stay one per key) */
  const noRim = m => m.userData.ink && cfg.toon && !m.userData.ink.key.startsWith('npc:') ? mat(m.userData.ink.key, { ...m.userData.ink.over, noRim: 1 }) : m;

  function prep(g){
    if (g.userData.styled) return g.userData.styled;
    let out = g;
    if (cfg.gradient) bakeGradient(out, cfg.gradient);
    if (cfg.jitter){
      // every triangle gets its own small value shift, so facets read like cut stone even under flat light
      out = out.index ? out.toNonIndexed() : out;
      const col = out.attributes.color;
      for (let t = 0; t < col.count; t += 3){
        const k = 1 + (Math.sin(t * 12.9898 + 78.233) * 43758.5453 % 1) * cfg.jitter;
        for (let v = t; v < t + 3; v++) col.setXYZ(v, col.getX(v) * k, col.getY(v) * k, col.getZ(v) * k);
      }
    }
    if (cfg.crease){
      // the crease pass hashes positions to 1cm; work at 100x so small parts (visor slits, finials) keep their edges
      out = toCreasedNormals(out.clone().scale(100, 100, 100), cfg.crease).scale(0.01, 0.01, 0.01);
      // a sliver triangle (the fingers' ridges have a few) comes out with a zero normal; the shader's normalize() of it is
      // NaN, which the bloom blur smears into a black box on GPUs that don't clamp it (seen on Firefox)
      const n = out.attributes.normal;
      for (let i = 0; i < n.count; i++) if (!(n.getX(i) ** 2 + n.getY(i) ** 2 + n.getZ(i) ** 2 > 1e-6)) n.setXYZ(i, 0, 1, 0);
    }
    g.userData.styled = out;
    return out;
  }

  function outlineGeo(g){
    if (g.userData.hull) return g.userData.hull;
    const c = g.clone();
    for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k);
    const m = mergeVertices(c, 1e-4);
    m.computeVertexNormals();
    g.userData.hull = m;
    return m;
  }

  function inkMaterial(){
    if (outlineMat) return outlineMat;
    outlineMat = new THREE.MeshBasicMaterial({ color: 0x07060a, side: THREE.BackSide });
    outlineMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
        `vec3 transformed = position + normal * ${cfg.outline.toFixed(4)};`);
    };
    return outlineMat;
  }

  /* place a styled mesh: S.add(geo, 'beskar', parent, [x,y,z], [rx,ry,rz], {shadow, outline, scale}) */
  function add(geo, key, parent, p = [0,0,0], r = [0,0,0], o = {}){
    let material = typeof key === 'string' ? mat(key) : key;
    if (o.outline === false) material = noRim(material);
    const m = new THREE.Mesh(prep(geo), material);
    m.position.set(p[0], p[1], p[2]);
    m.rotation.set(r[0], r[1], r[2]);
    if (o.scale) Array.isArray(o.scale) ? m.scale.set(...o.scale) : m.scale.setScalar(o.scale);
    m.castShadow = o.shadow !== false;
    if (cfg.outline && o.outline !== false){
      const hull = new THREE.Mesh(outlineGeo(geo), inkMaterial());
      hull.castShadow = false;
      m.add(hull);
    }
    parent.add(m);
    return m;
  }

  /* place a SKINNED styled mesh: one continuous surface that bends with the rig instead of a rigid piece per joint.
     geo is built in `frame`'s space (a rig joint, in the rest pose), `bones` are rig joints and
     weigh(x, y, z) → [[boneIndex, weight], …] (up to 4, summing to 1) says how much each joint carries a vertex.
     The mesh hangs off `root` (the model root, vis); its ink hull is a skinned child so hiding the mesh hides both. */
  function addSkinned(geo, key, root, frame, bones, weigh, o = {}){
    root.updateWorldMatrix(true, true);   // the rest pose: bind against it
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(frame.matrixWorld);
    const skinned = g => {
      const out = g.clone(), p = out.attributes.position, n = p.count;
      const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
      for (let i = 0; i < n; i++){
        const ws = weigh(p.getX(i), p.getY(i), p.getZ(i));
        for (let j = 0; j < ws.length && j < 4; j++){ idx[i*4+j] = ws[j][0]; wt[i*4+j] = ws[j][1]; }
      }
      out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
      out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
      return out.applyMatrix4(toRoot);
    };
    const skeleton = new THREE.Skeleton(bones);   // rig groups work as bones: a skeleton only reads their world matrices
    const bind = (m, parent) => {
      m.frustumCulled = false;   // the bounds would be the rest pose's; the hero is always on screen anyway
      parent.add(m); m.updateMatrixWorld(true);
      m.bind(skeleton, m.matrixWorld);
      return m;
    };
    const m = bind(new THREE.SkinnedMesh(skinned(prep(geo)), typeof key === 'string' ? mat(key) : key), root);
    m.castShadow = o.shadow !== false;
    if (cfg.outline && o.outline !== false){
      const hull = bind(new THREE.SkinnedMesh(skinned(outlineGeo(geo)), inkMaterial()), m);
      hull.castShadow = false;
    }
    return m;
  }

  // glowing seam line — a thin unlit strip VFX can pulse later (the look decides whether a hero has them)
  const seamMats = new Map();
  function seam(geo, color, parent, p, r, o = {}){
    if (!seamMats.has(color)) seamMats.set(color, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const m = new THREE.Mesh(geo, seamMats.get(color));
    m.position.set(...p); if (r) m.rotation.set(...r);
    if (o.scale) m.scale.set(...o.scale);
    parent.add(m);
    return m;
  }

  const outline = () => cfg.outline ? inkMaterial() : null;
  return { name, cfg, mat, add, addSkinned, outline, seam, seamMats };
}
