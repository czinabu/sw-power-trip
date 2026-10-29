// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The partner's held and flying powers, drawn here from what their browser says it is doing (sent with every pose):
// the flamethrower's stream, Force lightning to its targets, and the thrown saber. Damage is theirs to do; this is only
// what you see. One-shot powers (push, pull, repulse, slam) arrive as events (net/foefire.js).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, shared } from '../state.js';
import { V3, rand } from '../utils.js';
import { heroAim } from '../player/aim.js';
import { puff, inkSprite, sparks } from '../fx/ink.js';
import { FLAME } from '../player/mando/weapons.js';

const r2 = (n) => Math.round(n * 100) / 100;

// what this browser is doing with its powers right now, for the pose message (undefined when nothing)
export function fxOut(){
  const o = {};
  if (player.flaming){ const f = heroAim().dir; o.fl = [r2(f.x), r2(f.y || 0), r2(f.z)]; }   // (3D: up or down with the aim)
  if (shared.saberProj && shared.saberProj.mesh.visible){ const p = shared.saberProj.mesh.position; o.ts = [r2(p.x), r2(p.y), r2(p.z)]; }
  if (player.judgeT > 0 && player.judgeTargets && player.judgeTargets.length)
    o.jt = player.judgeTargets.slice(0, 6).map(v => [r2(v.x), r2(v.y), r2(v.z)]);
  return Object.keys(o).length ? o : undefined;
}

let cur = null, curAt = 0;
export const setPartnerFx = (fx) => { cur = fx || null; curAt = performance.now(); };

// the thrown blade
const blade = new THREE.Group();
blade.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1.7, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })),
          new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.75, 8),
            new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
blade.rotation.z = Math.PI / 2; blade.visible = false;
scene.add(blade);

// lightning: a jagged green line from the hand to each target, re-rolled on a stepped beat
const SEG = 9, bolts = [];
function makeLine(){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x7dffa0, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
  l.frustumCulled = false; l.visible = false; l.renderOrder = 2;
  scene.add(l);
  return l;
}
let beat = -1, flameEmit = 0;

// every frame, with the partner's puppet group (where they stand and which way they face)
export function updatePartnerFx(dt, g, shown){
  const live = shown && cur && performance.now() - curAt < 300 ? cur : null;
  const yaw = g.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
  // the flamethrower
  if (live && live.fl){
    const f = V3(live.fl[0], live.fl[1], live.fl[2]);
    flameEmit += dt * 64;
    for (; flameEmit >= 1; flameEmit--){
      const spread = rand(-0.3, 0.3), dx = f.x * Math.cos(spread) - f.z * Math.sin(spread), dz = f.x * Math.sin(spread) + f.z * Math.cos(spread);
      const spd = 8 * rand(2.2, 2.9), life = rand(0.32, 0.44), fy = f.y * spd;
      puff(V3(g.position.x + f.x * 0.9, g.position.y + 1.4 + f.y * 0.9 + rand(-0.1, 0.15), g.position.z + f.z * 0.9), FLAME[0][1], rand(0.9, 1.3) + 1, life,
           V3(dx * spd, fy + rand(0.6, 2.2), dz * spd), { ramp: FLAME, drag: 2.2, grav: -3, grow0: 0.25, shade: 0.3, inkW: 0.12 });
    }
    if (Math.random() < 0.5) sparks(V3(g.position.x + f.x * 1.2, g.position.y + 1.4, g.position.z + f.z * 1.2), 0xffd06a, 1, 18, { dir: f, cone: 0.3, life: 0.3, grav: -2, size: 0.4 });
  } else flameEmit = 0;
  // the thrown saber
  if (live && live.ts){
    blade.visible = true;
    blade.position.set(live.ts[0], live.ts[1], live.ts[2]);
    blade.rotation.y += dt * 22;
    if (Math.random() < dt * 30) inkSprite({ pos: blade.position, normal: V3(0, 1, 0), shape: 'ring', inner: 0.12, color: 0x7fd0ff, size: [1.8, 1.8],
                                           life: 0.09, steps: 2, op: 0.55, coreW: 0.2, inkW: 0.1 });
  } else blade.visible = false;
  // the Force lightning
  const tg = live && live.jt ? live.jt : [];
  while (bolts.length < tg.length) bolts.push(makeLine());
  const nb = Math.floor(G.gt / 0.055), roll = nb !== beat; beat = nb;
  bolts.forEach((l, i) => {
    const t = tg[i];
    if (!t){ l.visible = false; return; }
    l.visible = true;
    if (!roll && l.userData.t === t.join()) return;
    l.userData.t = t.join();
    const p = l.geometry.attributes.position, hx = g.position.x + fx * 0.5, hy = g.position.y + 1.3, hz = g.position.z + fz * 0.5;
    for (let s = 0; s <= SEG; s++){
      const k = s / SEG, j = s === 0 || s === SEG ? 0 : 1;
      p.setXYZ(s, hx + (t[0] - hx) * k + rand(-0.42, 0.42) * j, hy + (t[1] - hy) * k + rand(-0.36, 0.36) * j, hz + (t[2] - hz) * k + rand(-0.42, 0.42) * j);
    }
    p.needsUpdate = true;
  });
}
