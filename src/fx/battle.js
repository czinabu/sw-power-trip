// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WIDER BATTLE: a big fight going on past the arena's edge, drawn for almost nothing. Blaster fire streaks across
// out beyond the walls and artillery bursts on the horizon, so a mission (data/missions.js `battle`) feels like one
// corner of a war without a single extra soldier to think about. No AI, no collision, one small pool of meshes.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { S } from '../audio/sfx.js';
import { V3, rand } from '../utils.js';
import { burst } from './particles.js';
import { flashLight } from './lights.js';
import { shared } from '../state.js';
import { playerPos } from '../player/helpers.js';

const N = 16;
const geo = new THREE.CapsuleGeometry(0.12, 1.6, 2, 5);
const pool = [];
const B = { on: false, boomT: 0, ally: 0x4aa8ff, foe: 0xff3322 };

// where the wider battle sits: past the arena's walls, or on a battle map (far bigger) just out to the hero's sides
function field(){
  if (!shared.arenaBig) return { cx: 0, cz: 0, h: shared.arenaHalf, hz: shared.arenaHalfZ };
  const p = playerPos();
  return { cx: p.x, cz: p.z, h: 34, hz: 34 };
}
function lane(){
  // a lane of fire out past one side of the fight, running across the line between the armies
  const { cx, cz, h, hz } = field(), side = Math.random() < 0.5 ? -1 : 1;
  const x = cx + side * (h + rand(6, 26)), z0 = cz + rand(-hz, hz * 0.4), dir = Math.random() < 0.5 ? 1 : -1;
  return { from: V3(x, rand(1.5, 9), z0), vel: V3(rand(-4, 4), rand(-0.5, 0.8), dir * rand(55, 80)) };
}
export function startBattleFx(allyColor){
  B.on = true; B.boomT = 2; B.ally = allyColor || B.ally;
  if (!pool.length) for (let i = 0; i < N; i++){
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }));
    m.visible = false; pool.push({ m, t: 0, life: 0, vel: V3(0, 0, 0) });
  }
  for (const b of pool){ scene.add(b.m); b.t = rand(-2, 0); b.m.visible = false; }
}
export function stopBattleFx(){
  if (!B.on) return;
  B.on = false;
  for (const b of pool){ scene.remove(b.m); b.m.visible = false; }
}
export function updateBattleFx(dt){
  if (!B.on) return;
  for (const b of pool){
    b.t += dt;
    if (b.t < 0) continue;
    if (!b.m.visible){
      const L = lane();
      b.m.position.copy(L.from); b.vel.copy(L.vel); b.life = rand(0.6, 1.2);
      b.m.material.color.setHex(L.vel.z > 0 ? B.ally : B.foe);
      b.m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.vel.clone().normalize());
      b.m.visible = true;
    }
    b.m.position.addScaledVector(b.vel, dt);
    if (b.t > b.life){ b.m.visible = false; b.t = rand(-1.2, -0.1); }
  }
  // artillery on the horizon: a flash, a plume, a far-off thump
  if ((B.boomT -= dt) <= 0){
    B.boomT = rand(1.6, 4.2);
    const { cx, cz, h, hz } = field(), a = rand(0, Math.PI * 2), r = rand(1.15, 1.6);
    const p = V3(cx + Math.cos(a) * h * r, 0.5, cz + Math.sin(a) * hz * r);
    burst(V3(p.x, 2, p.z), 0xffae2a, 14, 10, 9, 1.6); burst(V3(p.x, 3, p.z), 0x555555, 10, 4, 6, 2.2);
    flashLight(0xffae2a, 4, 40, V3(p.x, 6, p.z), 0.35);
    S.boom(p, 0.6);
  }
}
