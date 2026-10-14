// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Arena bounds and solid-object collision.

import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, solids } from '../state.js';
import { damageEnemy } from '../enemies/damage.js';

// LINE-OF-SIGHT — does any real wall/pillar/crate (shallow CLIMBABLE steps don't count, same convention as the
// avoidance steering) sit between two points? Approximated by projecting each solid's center onto the segment and
// testing whether that closest-on-segment point falls inside the (slightly expanded) solid — cheap, and exact for
// the axis-aligned boxes this game already commits to everywhere else. Used by ranged-enemy cover AI + bolt impacts.
export function segBlockedBySolids(ax, az, bx, bz){
  const dx = bx - ax, dz = bz - az, len2 = dx*dx + dz*dz || 1;
  for (const c of solids){
    if (c.climbable) continue;
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
  const h = shared.arenaHalf - 1;
  if (Math.abs(pos.x) > h){
    if (vel && Math.abs(vel.x) > 10){
      burst(pos, 0x99bbdd, 6, 5, 4);
      if (enemy && !enemy.dead) damageEnemy(enemy, 20, V3(-Math.sign(pos.x),0,0), 4);
      vel.x *= -0.4;
    }
    pos.x = clamp(pos.x, -h, h);
  }
  if (Math.abs(pos.z) > h){
    if (vel && Math.abs(vel.z) > 10){
      burst(pos, 0x99bbdd, 6, 5, 4);
      if (enemy && !enemy.dead) damageEnemy(enemy, 20, V3(0,0,-Math.sign(pos.z)), 4);
      vel.z *= -0.4;
    }
    pos.z = clamp(pos.z, -h, h);
  }
}

/* ---------- SOLID OBSTACLES — pillars (cylinders) & crates (boxes) you can collide
   with and stand on top of. Resolves horizontal penetration in `pos` and returns the
   height of the surface the body is standing over (0 = the arena floor). ---------- */
export const STEP_UP = 0.5;   // feet within this of a top "mount" onto it (auto-mantle / land)
export function collideSolids(pos, radius, climb){
  let support = 0;
  for (const c of solids){
    const top = c.h;
    if (c.box){
      const minX = c.x - c.hx, maxX = c.x + c.hx, minZ = c.z - c.hz, maxZ = c.z + c.hz;
      const insideX = pos.x > minX && pos.x < maxX;
      const insideZ = pos.z > minZ && pos.z < maxZ;
      const nx = clamp(pos.x, minX, maxX), nz = clamp(pos.z, minZ, maxZ);
      const dx = pos.x - nx, dz = pos.z - nz, d2 = dx*dx + dz*dz;
      if (!((insideX && insideZ) || d2 < radius*radius)) continue;
      if (climb && pos.y >= top - STEP_UP){ if (top > support) support = top; continue; }
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
      if (climb && pos.y >= top - STEP_UP){ if (top > support) support = top; continue; }
      if (d > 0.001){ const push = rr - d; pos.x += dx/d*push; pos.z += dz/d*push; }
    }
  }
  return support;
}

// SPAWN CLEARANCE — the intended spawn point (0, arenaHalf*0.5) sits at a fixed radius that overlaps the random-
// cover placement bands in every arena builder (e.g. Temple's low walls roll up to exactly arenaHalf*0.5; Foundry's
// machine blocks and Plains' ruins both farSpot into that radius too), and none of those placement loops know to
// avoid the spawn point itself — only each other. Rather than patch every builder's random ranges individually,
// check the ACTUAL solids after the arena is built and relocate the spawn if it landed inside/against one.
function spotBlocked(x, z, margin){
  for (const c of solids){
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
