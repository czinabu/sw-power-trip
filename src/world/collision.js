// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Arena bounds and solid-object collision.

import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, solids, hazardZones, vents, player } from '../state.js';
import { damageEnemy } from '../enemies/damage.js';

/* SOLID SHAPES (the `solids` list). Every one is a footprint standing on the floor up to its top `h`:
     · a BOX { x, z, hx, hz, h, box: true } or a COLUMN { x, z, r, h }; climbable = a low step you walk over;
     · either with `y0`: an overhead SLAB (a ship's wing, a lintel, a crane beam), solid only from y0 up to h, so a body
       walks underneath it (its head clears y0) and stands on top of it. A `soft` slab (a cloth awning) is a one-way
       platform: a body jumps up through it and lands on it from above, and never bonks its head on it;
     · a MOUND { mound: true, x, z, a, b, cos, sin, base, h }: a smooth hill (a half-ellipsoid whose long axis a runs
       along (cos, sin), rising from `base` to its top h). Ground you walk up and down, never a wall: always climbable. */
export const BODY_H = 1.8;   // a standing body's height: an overhead slab whose underside clears it is walked under
export function moundY(c, x, z){
  const dx = x - c.x, dz = z - c.z, u = (dx*c.cos + dz*c.sin) / c.a, v = (dz*c.cos - dx*c.sin) / c.b, q = u*u + v*v;
  return q >= 1 ? -1 : Math.max(0, c.base + (c.h - c.base) * Math.sqrt(1 - q));
}
export const mound = (x, z, a, b, ang, base, h) => ({ mound: true, climbable: true, x, z, a, b, cos: Math.cos(ang), sin: Math.sin(ang), base, h });

// LINE-OF-SIGHT — does any real wall/pillar/crate (shallow CLIMBABLE steps don't count, same convention as the
// avoidance steering) sit between two points? Approximated by projecting each solid's center onto the segment and
// testing whether that closest-on-segment point falls inside the (slightly expanded) solid — cheap, and exact for
// the axis-aligned boxes this game already commits to everywhere else. Used by ranged-enemy cover AI + bolt impacts.
export function segBlockedBySolids(ax, az, bx, bz){
  const dx = bx - ax, dz = bz - az, len2 = dx*dx + dz*dz || 1;
  for (const c of solids){
    if (c.climbable || c.y0) continue;   // steps and hills don't hide you, and an overhead slab is seen under
    let t = ((c.x - ax)*dx + (c.z - az)*dz) / len2; t = clamp(t, 0, 1);
    const px = ax + dx*t, pz = az + dz*t;
    if (c.box){
      if (px > c.x - c.hx - 0.3 && px < c.x + c.hx + 0.3 && pz > c.z - c.hz - 0.3 && pz < c.z + c.hz + 0.3) return c;
    } else {
      if (Math.hypot(px - c.x, pz - c.z) < c.r + 0.3) return c;
    }
  }
  return null;
}

export function clampToArena(pos, vel, enemy){
  const h = shared.arenaHalf - 1, hz = shared.arenaHalfZ - 1;
  if (Math.abs(pos.x) > h){
    if (vel && Math.abs(vel.x) > 10){
      burst(pos, 0x99bbdd, 6, 5, 4);
      if (enemy && !enemy.dead) damageEnemy(enemy, 20, V3(-Math.sign(pos.x),0,0), 4);
      vel.x *= -0.4;
    }
    pos.x = clamp(pos.x, -h, h);
  }
  if (Math.abs(pos.z) > hz){
    if (vel && Math.abs(vel.z) > 10){
      burst(pos, 0x99bbdd, 6, 5, 4);
      if (enemy && !enemy.dead) damageEnemy(enemy, 20, V3(0,0,-Math.sign(pos.z)), 4);
      vel.z *= -0.4;
    }
    pos.z = clamp(pos.z, -hz, hz);
  }
}

/* ---------- SOLID OBSTACLES — pillars (cylinders) & crates (boxes) you can collide
   with and stand on top of. Resolves horizontal penetration in `pos` and returns the
   height of the surface the body is standing over (0 = the arena floor). A hill (mound) is ground: it holds the body
   up wherever it is, whatever `climb` says. An overhead slab a body is under only stops its head: that is reported in
   `ceilHit` (the lowest underside the head met this call, Infinity if none) for the caller to stop the rise. ---------- */
export const STEP_UP = 0.5;   // feet within this of a top "mount" onto it (auto-mantle / land)
export let ceilHit = Infinity;
// a hard overhead slab the body is beside: true while the body is under it (a head that rises into its underside is
// noted in ceilHit), false once the body is up level with it (then it's a wall, or a top to stand on, like any solid)
function underSlab(c, pos, over){
  if (pos.y >= c.y0) return false;
  if (over && pos.y + BODY_H > c.y0) ceilHit = Math.min(ceilHit, c.y0);
  return true;
}
export function collideSolids(pos, radius, climb){
  let support = 0;
  ceilHit = Infinity;
  for (const c of solids){
    if (c.mound){ const y = moundY(c, pos.x, pos.z); if (y > support) support = y; continue; }
    const top = c.h;
    if (c.box){
      const minX = c.x - c.hx, maxX = c.x + c.hx, minZ = c.z - c.hz, maxZ = c.z + c.hz;
      const insideX = pos.x > minX && pos.x < maxX;
      const insideZ = pos.z > minZ && pos.z < maxZ;
      const nx = clamp(pos.x, minX, maxX), nz = clamp(pos.z, minZ, maxZ);
      const dx = pos.x - nx, dz = pos.z - nz, d2 = dx*dx + dz*dz;
      if (!((insideX && insideZ) || d2 < radius*radius)) continue;
      if (c.soft){ if (climb && pos.y >= c.y0 - 0.4 && top > support) support = top; continue; }   // a canopy only catches a body coming down onto it
      if (c.y0 && underSlab(c, pos, insideX && insideZ)) continue;
      if (climb && pos.y >= top - STEP_UP){ if (top > support) support = top; continue; }
      if (pos.y >= top) continue;   // feet already clear of the top (jumping off it): nothing to push out of
      if (insideX && insideZ){   // deep inside — eject through the nearest face
        const dl = pos.x - minX, dr = maxX - pos.x, db = pos.z - minZ, df = maxZ - pos.z;
        const m = Math.min(dl, dr, db, df);
        if (m === dl) pos.x = minX - radius; else if (m === dr) pos.x = maxX + radius;
        else if (m === db) pos.z = minZ - radius; else pos.z = maxZ + radius;
      } else {
        const d = Math.sqrt(d2) || 1, push = radius - d;
        pos.x += dx/d*push; pos.z += dz/d*push;
      }
    } else {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), rr = c.r + radius;
      if (d >= rr) continue;
      if (c.soft){ if (climb && pos.y >= c.y0 - 0.4 && top > support) support = top; continue; }
      if (c.y0 && underSlab(c, pos, d < c.r)) continue;
      if (climb && pos.y >= top - STEP_UP){ if (top > support) support = top; continue; }
      if (pos.y >= top) continue;
      if (d > 0.001){ const push = rr - d; pos.x += dx/d*push; pos.z += dz/d*push; }
    }
  }
  return support;
}

// GROUND UNDER A POINT — the highest solid top directly under (x, z) that is no higher than maxY (0 = the arena
// floor). The body's support (collideSolids) is measured over its whole radius; feet ask this for their own spot.
export function groundAt(x, z, maxY){
  let g = 0;
  for (const c of solids){
    if (c.mound){ const y = moundY(c, x, z); if (y > g && y <= maxY) g = y; continue; }
    if (c.h > maxY || c.h <= g) continue;
    if (c.box ? Math.abs(x - c.x) <= c.hx && Math.abs(z - c.z) <= c.hz : Math.hypot(x - c.x, z - c.z) <= c.r) g = c.h;
  }
  return g;
}

// IS A POINT INSIDE SOLID — the floor, a hill, or a pillar/crate/wall whose body spans the point's height. Unlike
// groundAt this respects overhead slabs (a point under one is open air), so a ray can pass under a beam.
export function solidAt(x, y, z){
  if (y <= 0) return true;
  for (const c of solids){
    if (c.mound){ if (y <= moundY(c, x, z)) return true; continue; }
    if (y > c.h || y < (c.y0 || 0)) continue;
    if (c.box ? Math.abs(x - c.x) <= c.hx && Math.abs(z - c.z) <= c.hz : Math.hypot(x - c.x, z - c.z) <= c.r) return true;
  }
  return false;
}

// SPAWN CLEARANCE — the intended spawn point (0, arenaHalf*0.5) sits at a fixed radius that overlaps the random-
// cover placement bands in every arena builder (e.g. Temple's low walls roll up to exactly arenaHalf*0.5; Foundry's
// machine blocks and Plains' ruins both farSpot into that radius too), and none of those placement loops know to
// avoid the spawn point itself — only each other. Rather than patch every builder's random ranges individually,
// check the ACTUAL solids after the arena is built and relocate the spawn if it landed inside/against one.
function spotBlocked(x, z, margin){
  for (const c of solids){
    if (c.mound || c.y0) continue;   // a body can stand on a hill, or under a slab
    if (c.box){
      const nx = clamp(x, c.x - c.hx, c.x + c.hx), nz = clamp(z, c.z - c.hz, c.z + c.hz);
      const dx = x - nx, dz = z - nz;
      if (dx*dx + dz*dz < margin*margin) return true;
    } else {
      if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return true;
    }
  }
  return false;
}
export function findClearSpawn(x0, z0, margin){
  if (!spotBlocked(x0, z0, margin)) return { x: x0, z: z0 };
  // spiral outward in rings around the intended spot until a clear circle of `margin` radius is found
  for (let ring = 1; ring <= 12; ring++){
    const r = ring * 0.8;
    for (let i = 0; i < 12; i++){
      const a = (i / 12) * Math.PI*2;
      const x = x0 + Math.cos(a)*r, z = z0 + Math.sin(a)*r;
      if (!spotBlocked(x, z, margin)) return { x, z };
    }
  }
  return { x: x0, z: z0 };   // shouldn't happen — cover is sparse relative to arena size
}

/* EDGE SPAWN — a random point on the arena's edge ring (r = arenaHalf × [lo, hi]) that is clear of every solid, vent
   and hazard zone, so a foe never pops in inside a girder or onto a live vent. radius = the body's radius. */
function spotInHazard(x, z, pad){
  for (const v of vents) if (Math.hypot(x - v.group.position.x, z - v.group.position.z) < 2.6 + pad) return true;
  for (const hz of hazardZones){
    if (hz.kind === 'point'){ if (Math.hypot(x - hz.cx, z - hz.cz) < hz.r + pad) return true; continue; }
    const dx = x - hz.cx, dz = z - hz.cz, t = clamp(dx*hz.dirX + dz*hz.dirZ, -hz.halfLen, hz.halfLen);
    if (Math.hypot(x - (hz.cx + hz.dirX*t), z - (hz.cz + hz.dirZ*t)) < hz.halfW + pad) return true;
  }
  return false;
}
export function edgeSpawn(lo = 0.75, hi = 0.92, radius = 0.8){
  if (shared.arenaBig) return nearSpawn(radius);
  let x = 0, z = 0;
  for (let t = 0; t < 24; t++){
    const a = Math.random()*Math.PI*2, r = shared.arenaHalf * (lo + Math.random()*(hi - lo));
    x = Math.cos(a)*r; z = Math.sin(a)*r;
    if (!spotBlocked(x, z, radius) && !spotInHazard(x, z, radius)) break;
  }
  return V3(x, 0, z);
}
/* a BATTLE MAP's edge is a minute's run away, so a wave arrives on a ring round the hero instead (NEAR_SPAWN m out,
   kept inside the arena): close enough to reach the fight, far enough to come in from the fog */
const NEAR_SPAWN = [28, 40];
function nearSpawn(radius){
  const p = player.group.position, lim = shared.arenaHalf - 3, limZ = shared.arenaHalfZ - 3;
  let x = 0, z = 0;
  for (let t = 0; t < 24; t++){
    const a = Math.random()*Math.PI*2, r = NEAR_SPAWN[0] + Math.random()*(NEAR_SPAWN[1] - NEAR_SPAWN[0]);
    x = clamp(p.x + Math.cos(a)*r, -lim, lim); z = clamp(p.z + Math.sin(a)*r, -limZ, limZ);
    if (Math.hypot(x - p.x, z - p.z) < NEAR_SPAWN[0] * 0.6) continue;   // clamped up against the hero at the arena edge
    if (!spotBlocked(x, z, radius) && !spotInHazard(x, z, radius)) break;
  }
  return V3(x, 0, z);
}
