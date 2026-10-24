// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// First-use hitch killer: everything a fight needs is built or compiled before the fight, not on its first use.

import * as THREE from 'three';
import { scene, compileLive } from './renderer.js';
import { arenaBuilt } from '../world/arena.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { SQUAD } from '../data/allies.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { buildBoss } from '../boss/mesh.js';
import { inkProbe } from '../fx/ink.js';
import { ensureBossLight } from '../boss/light.js';
import { ensureBarrierMesh } from '../player/jedi/force.js';
import { ensureJudgeLines } from '../player/jedi/judgement-fx.js';
import { shared } from '../state.js';

/* ---------- 1. SHADERS ----------
   three.js builds a shader program the first time a material variant is drawn, and again for every material when the
   scene's light count changes. renderer.compile only sees VISIBLE objects, so a few hidden "specimens" (one per
   material variant the fight spawns later) are shown for the compile, then hidden again. Runs after every arena
   build, so each mode (campaign, missions, training, sandbox, survival, battle maps) gets it; programs are cached,
   so repeat builds only pay for what's new. */
const basic = o => new THREE.MeshBasicMaterial(o);
const GEO = new THREE.BoxGeometry(0.01, 0.01, 0.01);
const specimens = [];
function specimen(obj){ obj.visible = false; obj.frustumCulled = false; scene.add(obj); specimens.push(obj); return obj; }
function buildSpecimens(){
  const mats = [
    basic({}),                                                                                       // plain (thrown blade, bolts, markers)
    basic({ toneMapped: false }),                                                                   // bolts, grenades: bloom-hot colours
    basic({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),   // rings, glows
    basic({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),   // the Mando's deflector disc
    basic({ transparent: true, depthWrite: false, side: THREE.BackSide, toneMapped: false }),       // bolt ink outlines
    basic({ transparent: true, depthTest: false, toneMapped: false }),                              // squad tags
    new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.6, roughness: 0.4 }),            // rockets, birds, thermal detonators
  ];
  for (const m of mats) specimen(new THREE.Mesh(GEO, m));
  specimen(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
                          new THREE.LineBasicMaterial({ color: 0xbfe8ff })));   // grapple and Darksaber lines
  specimen(buildEnemyMesh(ENEMY_TYPES.grunt));   // the skinned, outlined trooper material every foe and squadmate shares
}
const lazy = [];   // objects that other modules build on first use: shown for the compile, then put back
function showLazy(){
  ensureBossLight(); ensureBarrierMesh(); ensureJudgeLines();
  lazy.length = 0;
  for (const o of [inkProbe, shared.bossLight, shared._barrierMesh]) if (o) lazy.push([o, o.visible]);
}
let built = false;
export function prewarmShaders(){
  if (!built){ built = true; buildSpecimens(); }
  showLazy();
  for (const [o] of lazy) o.visible = true;
  for (const o of specimens) o.visible = true;
  // the boss arrives with two point lights (his blade and his aura): that changes the light count, which recompiles
  // every material. Compile with them here so the programs are cached before he walks in, then take them away.
  const extra = [0, 1].map(() => new THREE.PointLight(0xffffff, 0, 10));
  for (const l of extra) scene.add(l);
  try { compileLive(); } catch(e){}
  for (const l of extra) scene.remove(l);
  try { compileLive(); } catch(e){}
  for (const o of specimens) o.visible = false;
  for (const [o, v] of lazy) o.visible = v;
}
arenaBuilt.push(prewarmShaders);

/* ---------- 2. MODELS ----------
   A model is built (lofted, merged, skinned) the first time its type spawns. Do them all up front, one per idle
   slice, while the menu is up, so no spawn pays for it. */
const jobs = [];
for (const t of Object.values(ENEMY_TYPES)) jobs.push(() => buildEnemyMesh(t));
for (const roster of Object.values(SQUAD.roster)) for (const d of roster) jobs.push(() => buildEnemyMesh({ model: d.model, color: d.color, eye: d.eye, cloth: d.cloth, scale: d.scale || 1, ranged: true }));
jobs.push(() => buildBoss('sith'), () => buildBoss('mando'));
const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 1500 }) : f => setTimeout(f, 60);
function next(){
  const job = jobs.shift();
  if (!job) return;
  try { job(); } catch(e){}
  idle(next);
}
idle(next);
