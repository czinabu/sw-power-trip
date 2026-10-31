// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shock vents and explosive barrels.

import { blastAllies } from '../allies/squad.js';
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { S } from '../audio/sfx.js';
import { V3, rand } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, G, enemies, barrels, vents, hazardZones, player } from '../state.js';
import { flashLight } from '../fx/lights.js';
import { playerPos } from '../player/helpers.js';
import { damageEnemy } from '../enemies/damage.js';
import { damageBoss } from '../boss/boss.js';
import { hurtPlayer } from '../player/damage.js';
import { toon, toonUnique, inkify, hullGeo, inkHull } from './ink.js';
import { scorchGround } from '../fx/scorch.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TELLS } from '../fx/tells.js';
import { MOVE } from '../data/movement.js';
import { collideSolids, clampToArena } from './collision.js';

// the world theme's hazard colours (set by buildArena); null = the original look
let hzPal = null;
export function setHazardStyle(pal){ hzPal = pal || null; }

// the Ink fuel drum: body + two dark hoops merged into ONE vertex-coloured mesh (plus one outline hull), built once
// per colour, so a field of barrels stays cheap
const drumCache = new Map();
function drumGeo(color){
  if (drumCache.has(color)) return drumCache.get(color);
  const paint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n*3);
    for (let i = 0; i < n; i++){ a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
  const parts = [paint(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 10), color)];
  for (const y of [-0.32, 0.32]) parts.push(paint(new THREE.CylinderGeometry(0.575, 0.575, 0.1, 10).translate(0, y, 0), 0x2a2224));
  const g = mergeGeometries(parts, false);
  const out = { g, hull: hullGeo(g) };
  drumCache.set(color, out);
  return out;
}

/* ============================================================
   HAZARDS — shock vents & explosive barrels (level config)
   ============================================================ */
export function spawnVent(pos){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.18, 18),
    hzPal ? toon(hzPal.vent ?? 0x2a3340) : new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.5, metalness: 0.6 }));
  base.position.y = 0.09; base.receiveShadow = true; g.add(base);
  if (hzPal) inkify(base, 0.05);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 18),
    new THREE.MeshBasicMaterial({ color: (hzPal && hzPal.ventIdle) ?? 0x113355 }));
  core.position.y = 0.2; g.add(core);
  g.position.copy(pos);
  scene.add(g);
  // per-world colours: idle → warn (always the same amber, so the telegraph reads everywhere) → active
  vents.push({ group: g, core, cycle: rand(0, 3),
    cols: { idle: (hzPal && hzPal.ventIdle) ?? 0x113355, active: (hzPal && hzPal.ventActive) ?? 0x55ddff } });
}
export function updateVents(dt){
  for (const v of vents){
    v.cycle = (v.cycle + dt) % 3.0;
    const active = v.cycle > 2.0;          // 1s active per 3s cycle
    const warn = v.cycle > 1.5 && !active;
    v.core.material.color.setHex(active ? v.cols.active : warn ? TELLS.area.color : v.cols.idle);
    if (active){
      if (Math.random() < 0.4) burst(V3(v.group.position.x + rand(-1.5,1.5), 0.3, v.group.position.z + rand(-1.5,1.5)), v.cols.active, 1, 2, 9, 0.8);
      const pp = playerPos();
      if (pp.distanceTo(v.group.position) < 2.4 && pp.y < 1) hurtPlayer(12*dt + 0.001, v.group.position, true);
      for (const e of enemies){
        if (e.dead) continue;
        if (e.group.position.distanceTo(v.group.position) < 2.4 && e.hitCd <= 0){
          e.hitCd = 0.4;
          damageEnemy(e, 18, V3(rand(-1,1),0,rand(-1,1)).normalize(), 6);
        }
      }
    }
  }
}
export function spawnBarrel(pos){
  let m;
  if (hzPal){
    const d = drumGeo(hzPal.barrel ?? 0xa33820);
    const mat = toonUnique(0xffffff, { emissive: 0x441100, ei: 0.6 }); mat.vertexColors = true;   // own material: the fuse flashes it
    m = new THREE.Mesh(d.g, mat);
    const hull = new THREE.Mesh(d.hull, inkHull(0.035)); hull.castShadow = false; m.add(hull);
    m.userData.keepGeo = true; hull.userData.keepGeo = true;   // shared, cached geometry
  } else {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xa33820, roughness: 0.5, metalness: 0.3, emissive: 0x441100, emissiveIntensity: 0.6 }));
  }
  m.position.copy(pos); m.position.y = 0.6;
  m.castShadow = true;
  scene.add(m);
  barrels.push({ mesh: m, vel: V3(0,0,0), flying: false, fuse: -1 });
}
function explodeBarrel(b, idx){
  const p = b.mesh.position;
  burst(p, 0xff7722, 22, 11, 8);
  burst(p, 0xffdd55, 12, 8, 6);
  scorchGround(p, 4.6);
  G.shake = Math.max(G.shake, 0.8); G.hitstop = Math.max(G.hitstop, 0.05);
  S.boom(p, 1.2);
  for (const e of enemies){
    if (e.dead) continue;
    if (e.group.position.distanceTo(p) < 6)
      damageEnemy(e, 85, e.group.position.clone().sub(p).setY(0).normalize(), 24);
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(p) < 6) damageBoss(50);
  const pp = playerPos();
  blastAllies(p, 5, 18);   // a barrel catches the squad too
  if (pp.distanceTo(p) < 5 && player.dashT <= 0) hurtPlayer(18, p);
  for (const ob of barrels){ if (ob !== b && ob.fuse < 0 && ob.mesh.position.distanceTo(p) < 5) ob.fuse = rand(0.15, 0.4); }
  scene.remove(b.mesh);
  barrels.splice(idx, 1);
}
// a barrel is a physical thing: a body moving through it (a run, a slide, a ragdoll flung into it) shoves it along, it
// slides to a stop and rebounds off pillars and crates (a barrel hit hard enough still blows: grenades/bolts/the Force)
function shoveBarrel(b, dt){
  const P = MOVE.prop, m = b.mesh.position;
  const hit = (x, z, vx, vz) => {
    const dx = m.x - x, dz = m.z - z, d = Math.hypot(dx, dz), sp = Math.hypot(vx, vz);
    if (d > P.reach || d < 0.001 || sp < P.shoveSpeed) return;
    if (dx * vx + dz * vz <= 0) return;   // only a body moving TOWARD it pushes
    b.vel.x += dx / d * sp * P.shove * dt * 6; b.vel.z += dz / d * sp * P.shove * dt * 6;
  };
  const pp = playerPos();
  hit(pp.x, pp.z, player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  for (const e of enemies){
    if (e.dead && e.state !== 'ragdoll') continue;
    if (e.state === 'ragdoll' || e.state === 'knockdown') hit(e.group.position.x, e.group.position.z, e.vel.x, e.vel.z);
  }
  const sp = Math.hypot(b.vel.x, b.vel.z);
  if (sp > P.maxSpeed){ b.vel.x *= P.maxSpeed / sp; b.vel.z *= P.maxSpeed / sp; }
  if (sp < 0.05){ b.vel.x = b.vel.z = 0; return; }
  m.x += b.vel.x * dt; m.z += b.vel.z * dt;
  const bx = m.x, bz = m.z, by = m.y;
  collideSolids(m, P.radius, false); m.y = by;
  const mx = m.x - bx, mz = m.z - bz;
  if (mx || mz){ const l = Math.hypot(mx, mz), nx = mx / l, nz = mz / l, vn = b.vel.x * nx + b.vel.z * nz; if (vn < 0){ b.vel.x -= nx * vn * (1 + P.bounce); b.vel.z -= nz * vn * (1 + P.bounce); } }
  clampToArena(m, b.vel, null);
  b.mesh.rotation.z = dampTo(b.mesh.rotation.z, 0, dt);
  const k = Math.max(0, 1 - dt * P.drag); b.vel.x *= k; b.vel.z *= k;
}
const dampTo = (v, t, dt) => v + (t - v) * Math.min(1, dt * 8);
export function updateBarrels(dt){
  for (let i = barrels.length-1; i >= 0; i--){
    const b = barrels[i];
    if (b.fuse >= 0){
      b.fuse -= dt;
      b.mesh.material.emissiveIntensity = 2 + Math.sin(G.gt*40)*1.5;
      if (b.fuse <= 0){ explodeBarrel(b, i); continue; }
    }
    if (!b.flying) shoveBarrel(b, dt);
    if (b.flying){
      b.vel.y -= 20*dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += dt*8;
      let hit = b.mesh.position.y < 0.3;
      if (!hit) for (const e of enemies){
        if (e.dead) continue;
        if (b.mesh.position.distanceTo(e.group.position.clone().setY(b.mesh.position.y)) < 1.4){ hit = true; break; }
      }
      if (!hit && shared.boss && shared.boss.hp > 0 && b.mesh.position.distanceTo(shared.boss.group.position.clone().setY(b.mesh.position.y)) < 2) hit = true;
      if (hit){ explodeBarrel(b, i); continue; }
    }
  }
}
/* ---------- DYNAMIC GROUND HAZARDS — molten channels (foundry) / brazier eruption (temple) / void-rift pulse
   (plains). Each arena builder pushes a zone (line or point) into `hazardZones`; a per-zone telegraph→active cycle
   (staggered phase so they don't all fire in sync) drives sparks + a damage tick to WHOEVER is standing in it —
   player or enemy. Turns the levels' set-dressing into a real tactical element: shove a foe in with a push/kick,
   bait one to camp it, or get punished yourself for not watching your footing. Same tick/cooldown convention as
   the existing vents (silent hurtPlayer tick + e.hitCd-gated damageEnemy, no hitstop spam). */
export function hazardContains(hz, x, z){
  if (hz.kind === 'point') return Math.hypot(x - hz.cx, z - hz.cz) < hz.r;
  const dx = x - hz.cx, dz = z - hz.cz;
  const t = Math.max(-hz.halfLen, Math.min(hz.halfLen, dx*hz.dirX + dz*hz.dirZ));
  return Math.hypot(x - (hz.cx + hz.dirX*t), z - (hz.cz + hz.dirZ*t)) < hz.halfW;
}
export function updateHazardZones(dt){
  const pp = playerPos();
  for (const hz of hazardZones){
    hz.t += dt;
    const cyc = hz.t % hz.period;
    const active = cyc >= hz.period - hz.activeDur;
    const warn = !active && cyc >= hz.period - hz.activeDur - hz.warnDur;
    if (active && !hz._wasActive && hz.flash) flashLight(hz.color, 2.2, 9, V3(hz.cx, 0.5, hz.cz), 0.5);
    hz._wasActive = active;
    const spread = hz.halfLen || 0.5;
    if (active){
      if (Math.random() < dt*7) burst(V3(hz.cx + rand(-1,1)*spread, 0.3, hz.cz + rand(-1,1)*spread), hz.color, 1, 2.5, 8, 0.7);
    } else if (warn && Math.random() < dt*2.5){
      burst(V3(hz.cx + rand(-1,1)*spread*0.7, 0.15, hz.cz + rand(-1,1)*spread*0.7), TELLS.area.color, 1, 1.2, 4, 0.4);
    }
    if (!active) continue;
    if (hazardContains(hz, pp.x, pp.z) && pp.y < 1.6) hurtPlayer(hz.dmg*dt + 0.001, V3(hz.cx, 0, hz.cz), true);
    for (const e of enemies){
      if (e.dead) continue;
      if (hazardContains(hz, e.group.position.x, e.group.position.z) && e.hitCd <= 0){
        e.hitCd = 0.4;
        damageEnemy(e, hz.dmg*1.4, V3(rand(-1,1),0,rand(-1,1)).normalize(), 7);
      }
    }
  }
}
