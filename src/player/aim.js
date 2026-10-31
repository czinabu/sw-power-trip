// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AIM — where every aimed ability points, pitch included: the crosshair ray (the Jedi's fixed centre dot, the Mando's
// drifting reticle) and a height-aware cone test, so a power only reaches a foe in the air when it is aimed up at it.

import * as THREE from 'three';
import { camera } from '../engine/renderer.js';
import { shared, G, enemies, player } from '../state.js';
import { sweepHit, bodyRadius, bodyHeight, chestPos } from '../enemies/bodyshape.js';
import { groundAt } from '../world/collision.js';

/* The crosshair ray, cast from the lens through the reticle (`ox`, `oy`: its pixel offset from the screen centre). It
   stops at the first thing it meets: a foe's body (its real hitbox, bodyshape.js), the boss, or the floor / a solid
   prop. Nothing at all: a point far out along it. */
const AIM_OPEN = 300, AIM_FAR = 80, FLOOR_FAR = 60, FLOOR_STEP = 0.5;
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _far = new THREE.Vector3(), _p = new THREE.Vector3();
export const crosshairRay = () => _ray.ray;
// what the last cast found: the foe under the crosshair (or null), and whether it stopped on the floor / a prop
export const lastAim = { target: null, floor: false };
export function crosshairPoint(ox = 0, oy = 0){
  _ndc.set(ox * 2 / innerWidth, -oy * 2 / innerHeight);
  _ray.setFromCamera(_ndc, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  let bestT = 1e9, target = null;
  // foes: the shot converges a hand's depth INTO the body, so a bolt from the gun (a little off the camera ray) still
  // lands where the crosshair was
  _far.copy(o).addScaledVector(d, AIM_FAR);
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const h = sweepHit(e, o, _far, 0);
    if (!h) continue;
    const t = h.t * AIM_FAR + 0.15;
    if (t >= 1 && t < bestT){ bestT = t; target = e; }
  }
  // the boss: an upright column the crosshair has to be over
  const B = shared.boss;
  if (B && B.hp > 0){
    const p = B.group.position, dh2 = d.x*d.x + d.z*d.z;
    if (dh2 > 1e-6){
      const t = ((p.x - o.x)*d.x + (p.z - o.z)*d.z) / dh2;
      const rx = o.x + d.x*t - p.x, rz = o.z + d.z*t - p.z, ry = o.y + d.y*t;
      if (t >= 1 && t < bestT && rx*rx + rz*rz < 1.7*1.7 && ry > p.y + 0.3 && ry < p.y + 3.6){ bestT = t; target = B; }
    }
  }
  // the floor or a prop in the way, marched along the ray (before whatever foe it found)
  let floor = false;
  for (let t = 1; t < Math.min(bestT, FLOOR_FAR); t += FLOOR_STEP){
    _p.copy(o).addScaledVector(d, t);
    if (_p.y <= groundAt(_p.x, _p.z, Infinity)){ bestT = t; target = null; floor = true; break; }
  }
  lastAim.target = target; lastAim.floor = floor;
  // open air: the ray ends at the arena's wall (what the bolt will really hit), else far out along it. A short fallback
  // made the gun's offset from the lens cross the shot over the reticle and fly on past it, off to the side.
  if (bestT > 1e8){
    const hx = (shared.arenaHalf || 0), hz = (shared.arenaHalfZ || 0);
    let tw = AIM_OPEN;
    if (hx > 0 && Math.abs(d.x) > 1e-4) tw = Math.min(tw, ((d.x > 0 ? hx : -hx) - o.x) / d.x);
    if (hz > 0 && Math.abs(d.z) > 1e-4) tw = Math.min(tw, ((d.z > 0 ? hz : -hz) - o.z) / d.z);
    bestT = Math.max(tw, 5);
  }
  const t = bestT;
  return new THREE.Vector3(o.x + d.x*t, o.y + d.y*t, o.z + d.z*t);
}

/* where the hero is aiming right now: the Mando through his reticle; the Jedi through the centre dot, or straight at
   the foe he's locked onto (the lock frames it, so that's where he means) */
export function aimPoint(){
  const lt = player.lockTarget;
  if (G.hero !== 'mando' && lt && lt.group && (lt === shared.boss ? lt.hp > 0 : !lt.dead)){
    lastAim.target = lt; lastAim.floor = false;
    return lt.t ? chestPos(lt) : lt.group.position.clone().setY(lt.group.position.y + 1.8);
  }
  return G.hero === 'mando' ? crosshairPoint(player.aimOff.x, player.aimOff.y) : crosshairPoint(0, 0);
}

/* the aim from a point on the hero (a hand, the chest): the unit direction toward what the crosshair is over, plus
   where it lands and whether that was the floor. Kept on player.aim so the co-op partner can be told the pitch. */
export function aimFrom(origin){
  const point = aimPoint();
  const dir = point.clone().sub(origin);
  if (dir.lengthSq() < 0.01) dir.set(Math.sin(G.yaw), 0, Math.cos(G.yaw));
  dir.normalize();
  const aim = { dir, point, floor: lastAim.floor, target: lastAim.target, origin: origin.clone() };
  player.aimPitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  return aim;
}
// the hero's own aim origin: chest height
export const aimOrigin = () => { const p = player.group.position; return new THREE.Vector3(p.x, p.y + 1.4, p.z); };
export const heroAim = () => aimFrom(aimOrigin());

/* IN THE AIM — is any of an upright column (feet `y0` to head `y1`, radius `r`, standing at `p`) inside the aimed cone?
   Sideways the cone keeps each power's authored spread (`cosLim`, about the aim's heading); up and down it is narrow
   (`vHalf` rad, plus the body's own size), so a level shove passes under a jetpacker and a stream aimed at the sky
   flies over the troops on the ground. Once the aim line meets the floor it runs on along it at chest height, the way
   a stream splashes along the deck, so foes standing past that spot still get caught. */
const DEF_V = 0.14;
export function columnInAim(aim, p, y0, y1, r, range, cosLim, vHalf = DEF_V){
  const o = aim.origin, dir = aim.dir;
  const x = p.x - o.x, z = p.z - o.z, s = Math.hypot(x, z);
  const dh = Math.hypot(dir.x, dir.z);
  // the aim line's slope; past the spot it meets the floor, the line follows the floor at chest height instead
  const slope = dh > 1e-3 ? dir.y / dh : (dir.y < 0 ? -1e3 : 1e3);
  let lineY = o.y + slope * s;
  const steep = dh < 0.35;   // aimed nearly straight up or down: the heading means little, the 3D angle decides
  if (aim.floor && slope < 0){
    const fy = groundAt(p.x, p.z, o.y) + 0.9;
    if (lineY < fy) lineY = fy;
  }
  // nearest height of the body to that line, and the 3D reach to it
  const ny = Math.max(y0, Math.min(y1, lineY));
  const dy = ny - o.y, dist = Math.hypot(s, dy);
  if (dist - r > range) return false;
  if (dist <= r + 0.3) return true;   // right on top of you
  if (steep){
    // the angle between the aim and the nearest point of the body, against the wider of the two spreads
    const half = Math.max(Math.acos(Math.max(-1, Math.min(1, cosLim))), vHalf);
    const c = (x*dir.x + dy*dir.y + z*dir.z) / dist;
    return Math.acos(Math.max(-1, Math.min(1, c))) <= half + Math.asin(Math.min(1, r / dist));
  }
  // sideways: the authored cone about the aim's heading (the body's width widens it up close)
  if (s > r){
    const half = Math.acos(Math.max(-1, Math.min(1, cosLim)));
    const c = (x*dir.x + z*dir.z) / (s * dh);
    if (Math.acos(Math.max(-1, Math.min(1, c))) > half + Math.asin(Math.min(1, r / s))) return false;
  }
  // up and down: how far the body sits off the aim line, as an angle seen from the hero
  const off = Math.abs(ny - lineY);
  return Math.atan2(off, Math.max(s, 0.5)) <= vHalf + Math.asin(Math.min(1, 0.3 / dist));
}
// a foe in the aim (its hitbox: bodyshape.js; a body knocked flat lies low)
const DOWN = { knockdown: 1, getup: 1, ragdoll: 1 };
export function inAim(e, aim, range, cosLim, vHalf){
  const p = e.group.position, h = DOWN[e.state] ? 0.8 : bodyHeight(e);
  return columnInAim(aim, p, p.y, p.y + h, bodyRadius(e), range, cosLim, vHalf);
}
// the boss in the aim
export function bossInAim(aim, range, cosLim, vHalf){
  const B = shared.boss;
  if (!B || !(B.hp > 0)) return false;
  const p = B.group.position;
  return columnInAim(aim, p, p.y + 0.3, p.y + 3.6, 1.7, range, cosLim, vHalf);
}
// a point the aimed line reaches `dist` out (held above the floor), e.g. where a stray bolt ends
export function alongAim(aim, dist){
  const v = aim.origin.clone().addScaledVector(aim.dir, Math.min(dist, aim.origin.distanceTo(aim.point)));
  v.y = Math.max(v.y, groundAt(v.x, v.z, v.y + 0.5) + 0.3);
  return v;
}
