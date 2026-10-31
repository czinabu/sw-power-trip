// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The partner's held and flying powers, drawn here from what their browser says it is doing (sent with every pose):
// the flamethrower's stream, Force lightning to its targets, and the thrown saber. Damage is theirs to do; this is only
// what you see. One-shot powers (push, pull, repulse, slam) arrive as events (net/foefire.js) and are drawn by
// partnerPower. Their Force leaves their palms and their flame their gauntlet, as yours do (fx/palms.js).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, shared } from '../state.js';
import { V3, rand } from '../utils.js';
import { heroAim } from '../player/aim.js';
import { puff, inkSprite, sparks } from '../fx/ink.js';
import { FLAME } from '../player/mando/weapons.js';
import { spawnPushWave, spawnGroundShock } from '../fx/vfx.js';
import { palmPoints } from '../fx/palms.js';

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

// one player's powers as drawn here: what they last said they were doing (cur), the thrown blade, the lightning lines
export function makePartnerFx(){
  const blade = new THREE.Group();
  blade.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1.7, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })),
            new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.75, 8),
              new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
  blade.rotation.z = Math.PI / 2; blade.visible = false;
  scene.add(blade);
  return { cur: null, curAt: 0, blade, bolts: [], beat: -1, flameEmit: 0 };
}
// the partner's hands that throw their Force: both when their fists glow (saber holstered: jedi/palm.js), else the free one
const mateHands = (mate) => mate && mate.fistGlow && mate.fistGlow[0].material.opacity > 0.05 ? ['L', 'R'] : ['L'];

/* one of a partner's one-shot powers (net/foefire.js): their puppet (null when not on screen), k, its colour, its radius and how many hands threw it */
export function partnerPower(mate, k, color, r, hands, x, z){
  const seen = mate && mate.group.visible && mate.rig;
  const hs = hands > 1 ? ['L', 'R'] : ['L'];
  if (seen && (k === 'push' || k === 'pull')){
    const y = mate.group.rotation.y, dir = V3(Math.sin(y), 0, Math.cos(y));
    if (k === 'push'){ spawnPushWave(null, dir, color, 0.6, hs, mate); return; }
    for (const at of palmPoints(hs, mate)){   // the pull: streaks drawn in out of the front into the reaching palm
      sparks(V3(at.x + dir.x * 5, at.y, at.z + dir.z * 5), color, 5, 22, { dir: dir.clone().negate(), cone: 0.15, life: 0.22, grav: 0, stretch: 4, size: 0.4 });
      inkSprite({ pos: at, shape: 'star', points: 6, sharp: 0.3, color, size: [0.12, 0.42], life: 0.12, delay: 0.2, steps: 2, coreW: 0.45 });
    }
    return;
  }
  spawnGroundShock(V3(x, 0.1, z), color, r, 0.45, 0.7);
  if (seen && k === 'repulse') for (const at of palmPoints(hs, mate)) inkSprite({ pos: at, shape: 'star', points: 8, sharp: 0.18, color, size: [0.2, 0.9], life: 0.14, steps: 2, coreW: 0.4 });
}

const SEG = 9;
function makeLine(){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x7dffa0, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
  l.frustumCulled = false; l.visible = false; l.renderOrder = 2;   // (lightning: a jagged green line from the hand to each target, re-rolled on a stepped beat)
  scene.add(l);
  return l;
}

// every frame, with the partner's puppet group (where they stand and which way they face)
export function updatePartnerFx(st, dt, g, shown, mate){
  const { blade, bolts } = st;
  const live = shown && st.cur && performance.now() - st.curAt < 300 ? st.cur : null;
  const yaw = g.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
  // the flamethrower
  if (live && live.fl){
    const f = V3(live.fl[0], live.fl[1], live.fl[2]);
    const nz = (mate && mate.rig ? palmPoints(['gauntlet'], mate)[0] : V3(g.position.x + f.x * 0.9, g.position.y + 1.4 + f.y * 0.9, g.position.z + f.z * 0.9)).addScaledVector(f, 0.12);
    st.flameEmit += dt * 64;
    for (; st.flameEmit >= 1; st.flameEmit--){
      const spread = rand(-0.3, 0.3), dx = f.x * Math.cos(spread) - f.z * Math.sin(spread), dz = f.x * Math.sin(spread) + f.z * Math.cos(spread);
      const spd = 8 * rand(2.2, 2.9), life = rand(0.32, 0.44), fy = f.y * spd;
      puff(V3(nz.x, nz.y + rand(-0.05, 0.05), nz.z), FLAME[0][1], rand(0.9, 1.3) + 1, life,
           V3(dx * spd, fy + rand(0.6, 2.2), dz * spd), { ramp: FLAME, drag: 2.2, grav: -3, grow0: 0.08, shade: 0.3, inkW: 0.12 });
    }
    if (Math.random() < 0.5) sparks(nz, 0xffd06a, 1, 18, { dir: f, cone: 0.3, life: 0.3, grav: -2, size: 0.4 });
  } else st.flameEmit = 0;
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
  const nb = Math.floor(G.gt / 0.055), roll = nb !== st.beat; st.beat = nb;
  bolts.forEach((l, i) => {
    const t = tg[i];
    if (!t){ l.visible = false; return; }
    l.visible = true;
    if (!roll && l.userData.t === t.join()) return;
    l.userData.t = t.join();
    // from their palm (the bolts take turns between both palms when the saber is holstered)
    const hs = mateHands(mate), hp = mate && mate.rig ? palmPoints([hs[i % hs.length]], mate)[0] : V3(g.position.x + fx * 0.5, g.position.y + 1.3, g.position.z + fz * 0.5);
    const p = l.geometry.attributes.position, hx = hp.x, hy = hp.y, hz = hp.z;
    for (let s = 0; s <= SEG; s++){
      const k = s / SEG, j = s === 0 || s === SEG ? 0 : 1;
      p.setXYZ(s, hx + (t[0] - hx) * k + rand(-0.42, 0.42) * j, hy + (t[1] - hy) * k + rand(-0.36, 0.36) * j, hz + (t[2] - hz) * k + rand(-0.42, 0.42) * j);
    }
    p.needsUpdate = true;
  });
}
