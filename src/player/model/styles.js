// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Render styles for the hero models. The geometry kit is shared; a style decides how the chiseled planes are
// shaded (flat facets, cel bands + ink outline, or creased hard-surface with reflections and glowing seams).

import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { renderer } from '../../engine/renderer.js';

export const STYLE_DEFS = {
  // SHARD — every plane is its own flat facet; a soft top-to-bottom value ramp keeps it from reading as raw low-poly
  shard:  { label: 'Shard',  flat: true,  gradient: [0.68, 1.06], jitter: 0.14, crease: 0,    env: 0,    outline: 0,     toon: false, seams: false },
  // INK — cel-shaded bands with a dark ink outline: comic-book silhouettes that stay readable in a crowd
  ink:    { label: 'Ink',    flat: false, gradient: null,          crease: 0.55, env: 0,    outline: 0.014, toon: true,  seams: false },
  // FORGED — crisp creased hard-surface, real reflections on metal, and emissive seam lines VFX can drive later
  forged: { label: 'Forged', flat: false, gradient: [0.8, 1.04],   crease: 0.55, env: 1,    outline: 0,     toon: false, seams: true },
};

/* the one palette both heroes draw from: c colour, r roughness, m metalness, e emissive */
export const PALETTE = {
  // Jedi (Mace Windu)
  robe:    { c: 0x3b2a1e, r: 0.9 },
  tunic:   { c: 0x9c7d58, r: 0.85 },
  tabard:  { c: 0x5b4331, r: 0.88 },
  leather: { c: 0x23170f, r: 0.65 },
  skin:    { c: 0x5c3826, r: 0.55 },
  hair:    { c: 0x140e0a, r: 0.8 },
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

export function makeStyle(name = 'forged'){
  const cfg = STYLE_DEFS[name] || STYLE_DEFS.forged;
  const mats = new Map();
  let outlineMat = null;

  function mat(key, over = {}){
    const id = key + JSON.stringify(over);
    if (mats.has(id)) return mats.get(id);
    const d = { ...PALETTE[key], ...over };
    let m;
    if (cfg.toon){
      // cel bands flatten metal; lift metals a touch so beskar still reads bright against the suit
      const c = new THREE.Color(d.c);
      if (d.m) c.offsetHSL(0, -0.05, 0.08);
      m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp() });
    } else {
      m = new THREE.MeshStandardMaterial({
        color: d.c, roughness: d.r ?? 0.8, metalness: (d.m || 0) * (cfg.env ? 1 : 0.75), flatShading: cfg.flat,
        vertexColors: !!cfg.gradient,
      });
      if (cfg.env){ m.envMap = envMap(); m.envMapIntensity = d.m ? 0.4 : 0.2; }
    }
    if (d.e){ m.emissive = new THREE.Color(d.e); m.emissiveIntensity = d.ei ?? 1; }
    if (d.side) m.side = d.side;
    mats.set(id, m);
    return m;
  }

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
    const material = typeof key === 'string' ? mat(key) : key;
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

  // glowing seam line (FORGED only) — a thin emissive strip VFX can pulse later; no-op for the other styles
  const seamMats = new Map();
  function seam(geo, color, parent, p, r, o = {}){
    if (!cfg.seams) return null;
    if (!seamMats.has(color)) seamMats.set(color, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const m = new THREE.Mesh(geo, seamMats.get(color));
    m.position.set(...p); if (r) m.rotation.set(...r);
    if (o.scale) m.scale.set(...o.scale);
    parent.add(m);
    return m;
  }

  return { name, cfg, mat, add, seam, seamMats };
}
