// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Renderer, scene, camera, bloom post-processing, base lights, resize handling.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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

/* bloom post-processing — sabers, bolts and embers glow */
export const composer = new EffectComposer(renderer);
export const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
export const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.82, 0.55, 0.78);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

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
