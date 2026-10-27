// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Renderer, scene, camera, post-processing (antialiasing, ambient occlusion, light shafts, bloom, colour grade), base lights,
// resize handling.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ============================================================
   ENGINE SETUP
   ============================================================ */
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;   // moodier, more filmic contrast
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 400);

/* post-processing: scene → ambient occlusion → bloom (sabers, bolts and embers glow) → tone map → colour grade.
   ANTIALIASING: the canvas's own antialias does nothing once the scene is drawn into the composer's buffers, so the
   buffers are multisampled themselves (setMSAA, per quality preset in engine/quality.js). */
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
export function setMSAA(n){
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== n){ rt.samples = n; rt.dispose(); }
}
export const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

/* AMBIENT OCCLUSION — soft contact shadow in corners, under props and where a body meets the floor, so nothing
   floats. HIGH quality only (it draws the scene a second time for depth and normals). Only solid surfaces take part:
   glows, blades, particles, sprites, see-through props and the ink hulls (back faces) are left out, so a saber or a
   muzzle flash never darkens the floor around it. It runs at CSS-pixel resolution and fades out with distance, so
   the fogged backdrop isn't smudged. */
export const aoPass = new GTAOPass(scene, camera, innerWidth, innerHeight);
aoPass.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.5, thickness: 1.2, scale: 1.25, samples: 12 });
aoPass.updatePdMaterial({ samples: 12, radius: 6 });
aoPass.blendIntensity = 0.85;
const _aoHidden = [];
function noAO(o){
  if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO) return true;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return !!m && (m.transparent || m.side === THREE.BackSide || m.toneMapped === false || m.blending === THREE.AdditiveBlending);
}
aoPass.overrideVisibility = function(){ this.scene.traverseVisible(o => { if (noAO(o)){ o.visible = false; _aoHidden.push(o); } }); };
aoPass.restoreVisibility = function(){ for (const o of _aoHidden) o.visible = true; _aoHidden.length = 0; };
const _aoSize = aoPass.setSize.bind(aoPass);
aoPass.setSize = (w, h) => { const k = 1 / Math.max(1, renderer.getPixelRatio()); _aoSize(Math.round(w * k), Math.round(h * k)); };
// the stock blend multiplies the AO in everywhere: this one fades it out from aoFade.near to aoFade.far metres
export const aoFade = { near: 18, far: 46 };
Object.assign(aoPass.blendMaterial.uniforms, { tDepth: { value: aoPass.depthTexture }, cameraNear: { value: 0.1 }, cameraFar: { value: 400 },
  fadeNear: { value: aoFade.near }, fadeFar: { value: aoFade.far } });
aoPass.blendMaterial.fragmentShader = `
  uniform float intensity, cameraNear, cameraFar, fadeNear, fadeFar;
  uniform sampler2D tDiffuse, tDepth;
  varying vec2 vUv;
  void main(){
    float d = texture2D(tDepth, vUv).x;
    float z = cameraNear * cameraFar / ((cameraFar - cameraNear) * d - cameraFar);   // view-space z (negative)
    float k = intensity * (1.0 - smoothstep(fadeNear, fadeFar, -z));
    vec4 texel = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(mix(vec3(1.0), texel.rgb, k), texel.a);
  }`;
aoPass.blendMaterial.needsUpdate = true;
const _aoRender = aoPass.render.bind(aoPass);
aoPass.render = (...a) => {
  const u = aoPass.blendMaterial.uniforms;
  u.cameraNear.value = camera.near; u.cameraFar.value = camera.far; u.fadeNear.value = aoFade.near; u.fadeFar.value = aoFade.far;
  _aoRender(...a);
};
composer.addPass(aoPass);

/* LIGHT SHAFTS — god rays from the painted sun: each pixel marches toward the sun's spot on screen through the AO
   pass's depth buffer, and every step that lands on open sky adds a little of the sun's colour, so the light
   streams between pillars, spires and wrecks. Uses that depth, so it runs with the AO (HIGH); world/air.js aims it
   and sets its strength per world. Added before the bloom, so the brightest rays glow. */
export const shaftPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: aoPass.depthTexture }, sunUv: { value: new THREE.Vector2(0.5, 0.5) },
    strength: { value: 0 }, color: { value: new THREE.Color(1, 0.95, 0.85) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 sunUv; uniform float strength; uniform vec3 color;
    varying vec2 vUv;
    #define N 24
    void main(){
      vec4 src = texture2D(tDiffuse, vUv);
      vec2 dstep = (sunUv - vUv) / float(N) * 0.9;
      float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 uv = vUv + dstep * jitter;
      float lit = 0.0, w = 1.0, wsum = 0.0;
      for (int i = 0; i < N; i++){
        vec2 c = clamp(uv, 0.001, 0.999);
        lit += step(0.99999, texture2D(tDepth, c).x) * w;
        wsum += w; w *= 0.94; uv += dstep;
      }
      lit /= wsum;
      float fall = 1.0 - smoothstep(0.0, 0.85, length((vUv - sunUv) * vec2(1.6, 1.0)));   // strongest near the sun
      // only where the view itself isn't open sky: the rays fall across the arena, the sky keeps its painted look
      float onSky = step(0.99999, texture2D(tDepth, vUv).x);
      gl_FragColor = vec4(src.rgb + color * lit * fall * strength * (1.0 - 0.75 * onSky), src.a);
    }`,
});
shaftPass.enabled = false;
composer.addPass(shaftPass);
export const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.82, 0.55, 0.78);
composer.addPass(bloomPass);
/* SCENE GLOW — the bloom and the blade lights are tuned for a dark arena. In a bright one (pale stone, ice, snow) the
   sunlit floor already sits near the bloom threshold, so the bloom hazes the whole view, and a blade's light lifts a
   pale wall or floor right next to it past white into a blown-out halo. setSceneGlow eases both off as the arena
   gets brighter: b 0 (dark, the tuned look) → 1 (bright). The blade core plus its additive glow sits well over the
   raised threshold, so sabers keep their bloom. world/atmosphere.js sets it per arena; the menu stand (ui/showcase.js)
   swaps in its own threshold for its frame and puts this one back. */
export const glow = { b: 0, light: 1 };   // light: multiplier for the blade PointLights (player/model/weapons.js, boss)
export function setSceneGlow(b){
  glow.b = b;
  bloomPass.threshold = 0.78 + 0.16 * b;
  bloomPass.strength = 0.82 - 0.24 * b;
  glow.light = 1 - 0.55 * b;
}
composer.addPass(new OutputPass());

/* COLOUR GRADE — after tone mapping, on the display image: a little more colour and contrast, and a split tone (the
   shadows lean toward the arena's sky fill, the highlights toward its sun) so each world has its own cast. Brightness
   is kept: the tint is normalised to its own luminance. world/atmosphere.js sets it per arena (setGrade); the menu
   stand switches it off for its frame (ui/showcase.js). The vignette is the CSS #cine overlay. */
export const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 1 }, sat: { value: 1.1 }, contrast: { value: 1.08 },
    shadow: { value: new THREE.Color(0.93, 0.97, 1.06) }, high: { value: new THREE.Color(1.05, 1.0, 0.93) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float amount, sat, contrast; uniform vec3 shadow, high;
    varying vec2 vUv;
    const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
    void main(){
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;
      float l = dot(c, LUM);
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5;
      vec3 tint = mix(shadow, high, smoothstep(0.12, 0.75, l));
      c *= tint / max(dot(tint, LUM), 1e-3);
      gl_FragColor = vec4(mix(src.rgb, clamp(c, 0.0, 1.0), amount), src.a);
    }`,
});
composer.addPass(gradePass);
export const GRADE_DEFAULT = { sat: 1.1, contrast: 1.08, shadow: 0xedf7ff, high: 0xfff4e6 };
export function setGrade(g = GRADE_DEFAULT){
  const u = gradePass.uniforms;
  u.sat.value = g.sat ?? GRADE_DEFAULT.sat; u.contrast.value = g.contrast ?? GRADE_DEFAULT.contrast;
  if (g.shadow instanceof THREE.Color) u.shadow.value.copy(g.shadow); else u.shadow.value.setHex(g.shadow ?? GRADE_DEFAULT.shadow, THREE.LinearSRGBColorSpace);
  if (g.high instanceof THREE.Color) u.high.value.copy(g.high); else u.high.value.setHex(g.high ?? GRADE_DEFAULT.high, THREE.LinearSRGBColorSpace);
}
setGrade();

/* the menu stand draws its own little stage through this same composer: no AO (it would sample the game scene) and
   no arena grade */
let _standAO = false, _standShafts = false;
export function standPost(on){
  if (on){ _standAO = aoPass.enabled; _standShafts = shaftPass.enabled; aoPass.enabled = shaftPass.enabled = false; gradePass.uniforms.amount.value = 0; }
  else { aoPass.enabled = _standAO; shaftPass.enabled = _standShafts; gradePass.uniforms.amount.value = 1; }
}

export const hemi = new THREE.HemisphereLight(0x8fb0d6, 0x231a16, 0.62);   // dimmer ambient → more contrast & mood
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff2dd, 1.55);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 160;
sun.shadow.radius = 3.5;        // softer, more natural shadow edges
sun.shadow.bias = -0.0004;
scene.add(sun);
// cool rim/back light to separate silhouettes from the gloom — key to an "immersive" 3D look
export const rim = new THREE.DirectionalLight(0x5a7fd8, 0.5);
rim.position.set(-26, 18, -30);
scene.add(rim);

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* renderer.compile, but as the game draws: the scene is drawn into the composer's render target, where three.js builds a
   different shader variant (no tone mapping, linear output) than for the screen. Compiling against the screen, as a bare
   renderer.compile does, builds programs the game never uses and leaves the real ones to compile on first draw. */
export function compileLive(){
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(composer.readBuffer);
  try {
    renderer.compile(scene, camera);
    // the AO pass's own programs (its depth/normal override, the AO, denoise and blend shaders) would otherwise
    // compile on the first frame it runs: run it once here into the composer's spare buffer
    if (aoPass.enabled) aoPass.render(renderer, composer.writeBuffer, composer.readBuffer);
  } finally { renderer.setRenderTarget(prev); }
}
