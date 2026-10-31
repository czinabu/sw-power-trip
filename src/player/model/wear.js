// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HERO WEAR: dust and battle damage on the heroes, laid over their Ink surface (styles.js) the way the troopers' wear is
// (enemies/kit.js wearArmor), in the same hard-edged Ink steps:
//   · DUST climbs from the boots: robes and suit hems go dusty, boots dirtier still
//   · SCUFFS on metal: the beskar's paint chipped back to bare grey; on cloth, worn pale patches and darker stains
//   · SOOT from the fight: every hit the hero takes (player.grime, player/damage.js) blackens a few more scorch spots,
//     until the next arena wipes it clean
// How worn a hero starts is a customizer pick (data/customize.js BATTLE WEAR: look.<hero>.wear 0 fresh → 1 battered),
// saved with the look, so co-op partners and the menu turntable show it too.

import * as THREE from 'three';
import { MATERIALS } from './styles.js';

/* patch every material of one hero's parts (dress() in model/index.js) with wear uniforms W; returns W */
export function heroWear(parts, wear = 0.4){
  const W = { uHWear: { value: wear }, uHGrime: { value: 0 }, uHBase: { value: 0 }, uHScale: { value: 1 } };
  const seen = new Set();
  const patch = m => {
    if (!m || seen.has(m) || m.isMeshBasicMaterial || m.userData.heroWear) return;
    seen.add(m); m.userData.heroWear = W;
    const base = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    const ink = m.userData.ink, metal = ink ? ((MATERIALS[ink.key] || {}).m || 0) : (m.metalness || 0);
    m.onBeforeCompile = (sh, r) => {
      if (base) base.call(m, sh, r);
      Object.assign(sh.uniforms, W);
      sh.vertexShader = 'varying vec3 vHRest;\nvarying float vHWY;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHRest = position;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vHWY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = `varying vec3 vHRest;
        varying float vHWY;
        uniform float uHWear, uHGrime, uHBase, uHScale;
        float hHash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float hNoise(vec3 p){
          vec3 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
          return mix(mix(mix(hHash(i), hHash(i + vec3(1,0,0)), f.x), mix(hHash(i + vec3(0,1,0)), hHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hHash(i + vec3(0,0,1)), hHash(i + vec3(1,0,1)), f.x), mix(hHash(i + vec3(0,1,1)), hHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          float n = hNoise(vHRest * 26.0) * 0.6 + hNoise(vHRest * 61.0 + 7.0) * 0.4;
          float h = (vHWY - uHBase) / uHScale;                                    // height above the feet, in metres
          // dust from the boots up: a hard line that rises with the wear, broken by the noise
          float dust = step(h + (n - 0.5) * 0.25, 0.12 + 0.55 * uHWear);
          vec3 dustC = vec3(0.52, 0.47, 0.4);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, dustC * dot(diffuseColor.rgb, vec3(0.6)) * 2.0 + dustC * 0.08, 0.6), dust);
          ${metal > 0.4
            ? `// chipped paint on the plates: bare grey metal at the edges of the wear
          float chip = step(0.86 - 0.16 * uHWear, n);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.44, 0.47), chip * 0.8);`
            : `// worn pale patches and darker stains on cloth, leather and skin
          float pale = step(0.9 - 0.12 * uHWear, n), stain = step(n, 0.08 + 0.1 * uHWear);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.18 + 0.02, pale * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, stain * 0.6);`}
          // soot from the hits taken this fight
          float soot = step(1.0 - 0.35 * uHGrime, hNoise(vHRest * 9.0 + 31.0) * 0.7 + n * 0.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.05, 0.045), soot * 0.85);
        }`);
    };
    m.customProgramCacheKey = () => key + '-hwear' + (metal > 0.4 ? 'm' : 'c');
    m.needsUpdate = true;
  };
  for (const p of parts) p.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patch); });
  return W;
}

/* each frame (model/life.js): the dust line follows the feet, and the fight's soot follows player.grime */
const _v = new THREE.Vector3();
export function stepWear(target){
  const list = target.wearU;
  if (!list || !target.vis) return;
  target.vis.getWorldPosition(_v);
  const s = target.vis.scale.y || 1;
  for (const W of list){ W.uHBase.value = _v.y; W.uHScale.value = s / 1.18; W.uHGrime.value = Math.min(1, target.grime || 0); }
}
