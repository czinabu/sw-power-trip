// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The troopers' legs: the hero's locomotion (player/anim/gait.js and footing.js) on the enemy rig. The same
// motion-captured stride is played by distance travelled, sized to the trooper's leg; a foot on the ground is
// locked where it touched down in the world, and two-bone IK puts each ankle on its target. So a trooper walks
// when it prowls and runs when it charges, plants and brakes to a stop, steps round when it turns on the spot,
// strafes and backpedals on the same paths, and stands each foot on what is under it (the hips sink to let the
// lower one reach). The body inside (vis) takes the stride's bob and sway and leans with acceleration.
//
// Driven from the unit's MEASURED motion, so every state that moves it (a chase, a lunge, a fuse run, the pursuit
// quarry on its path) gets real footwork without the AI doing anything for it.

import * as THREE from 'three';
import { clamp } from '../utils.js';
import { GAIT, FOOTING } from '../data/movement.js';
import { groundAt, STEP_UP } from '../world/collision.js';
import { LEG, mocapStride, mocapFoot, mocapBody } from '../player/anim/mocap.js';
import { LEG_E } from './mesh.js';

const THIGH = LEG_E.hipY - LEG_E.kneeY, SHIN = LEG_E.kneeY - LEG_E.ankY, LEG_L = THIGH + SHIN;   // model units
const HERO_SCALE = 1.18, LEG_M = LEG * HERO_SCALE;   // the hero's leg in metres (the clips are sized to it)
const K = LEG_L / LEG;                               // trooper model units per hero rig unit
const _inv = new THREE.Matrix4(), _v = new THREE.Vector3();
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (cur, want, dt, rate) => cur + (want - cur) * (1 - Math.exp(-rate * dt));

/* Pose a unit's legs for this frame, after it has moved. `o` holds the gait state (an enemy, the quarry), `g` is
   its group (enemies/mesh.js). mode: 'ground' (run), 'walk' (the prowl: held to the captured walk at any pace),
   'air' (jet troopers, a leap: the legs hang) or 'off' (a state that owns the whole body: they relax straight). */
export function updateLegs(o, g, dt, mode = 'ground'){
  const u = g.userData, vis = u.vis;
  if (!u.thighL || !vis || !(dt > 0)) return;
  const L = o.legs || (o.legs = { cyc: 0, step: 0.5, vx: 0, vz: 0, ax: 0, az: 0, px: g.position.x, pz: g.position.z,
                                  locks: [null, null], offs: [[0, 0], [0, 0]], foot: null, ank: [null, null], drop: [0, 0],
                                  lean: 0, bank: 0, bob: 0, sway: 0 });
  const sc = g.scale.x;
  // measured ground velocity, smoothed; a jump in place (a teleport, a respawn) re-plants instead of striding
  let rx = (g.position.x - L.px) / dt, rz = (g.position.z - L.pz) / dt;
  L.px = g.position.x; L.pz = g.position.z;
  if (rx * rx + rz * rz > 900){ rx = rz = 0; L.vx = L.vz = 0; L.locks = [null, null]; L.foot = null; }
  const pvx = L.vx, pvz = L.vz;
  L.vx = ease(L.vx, rx, dt, 14); L.vz = ease(L.vz, rz, dt, 14);
  const ka = 1 - Math.exp(-GAIT.accelSmooth * dt);
  L.ax += ((L.vx - pvx) / dt - L.ax) * ka; L.az += ((L.vz - pvz) / dt - L.az) * ka;
  const legs = [[u.thighL, u.shinL, u.footL], [u.thighR, u.shinR, u.footR]];

  if (mode === 'off' || mode === 'air'){
    // nothing to stand on: the feet let go, the legs hang (a little bent in the air) and the body settles
    L.locks = [null, null]; L.foot = null; L.ank = [null, null];
    const hip = mode === 'air' ? -0.18 : 0, knee = mode === 'air' ? 0.4 : 0;
    legs.forEach(([th, sh, ft], i) => {
      th.rotation.x = ease(th.rotation.x, hip * (i ? 0.6 : 1.2), dt, 10); th.rotation.z = ease(th.rotation.z, 0, dt, 10);
      sh.rotation.x = ease(sh.rotation.x, knee, dt, 10); ft.rotation.x = ease(ft.rotation.x, 0.2 * knee, dt, 10);
    });
    vis.position.set(0, 0, 0); vis.rotation.set(0, 0, 0);
    L.lean = L.bank = L.bob = L.sway = 0;
    return;
  }

  // the body's frame: +z forward along its heading, +x to its side
  const yaw = g.rotation.y, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const toWorld = (lx, lz, out) => out.set(g.position.x + (lx * cy + lz * sy) * sc, 0, g.position.z + (-lx * sy + lz * cy) * sc);
  const speed = Math.hypot(L.vx, L.vz);
  const vf = L.vx * sy + L.vz * cy, vr = L.vx * cy - L.vz * sy;
  const base = g.position.y;
  // where an ankle rests at (x, z): on what it stands on, a step up at most STEP_UP, at most reachDown below
  const floorAt = (x, z, i) => {
    const d = clamp(groundAt(x, z, base + STEP_UP) - base, -GAIT.reachDown * sc, STEP_UP);
    L.drop[i] = d;
    return base + d + LEG_E.ankY * sc;
  };
  const w = smooth(GAIT.blendFrom, GAIT.blendTo, speed);
  const want = [null, null];
  const hipX = i => legs[i][0].position.x;

  // GAIT — the captured stride for this speed, in the hero's measure, then sized to this leg
  let mc = null;
  if (w > 0){
    const vH = speed * LEG_M / (LEG_L * sc);
    mc = mocapStride(vH, mode === 'walk');
    L.step += (mc.stride / 2 * (mode === 'walk' ? GAIT.walkStride : 1) - L.step) * Math.min(1, dt * 6);
    L.cyc += vH * dt / (2 * L.step);
    const fr = speed > 0.05 ? vr / speed : 0, ff = speed > 0.05 ? vf / speed : 1;
    [0, 0.5].forEach((off, i) => {
      const p = (L.cyc + off) % 1, d = mc.duty[i], swing = p >= d;
      const f = mocapFoot(mc, i, p, 2 * L.step / HERO_SCALE);
      const s = f.s * K, lift = f.h * K * w * sc;
      const P = toWorld(hipX(i) + s * fr + f.x * K, s * ff, new THREE.Vector3());
      if (!swing){
        // touch down: lock this spot in the world and hold it for the whole stance (the heel rises off it)
        if (!L.locks[i]){ L.locks[i] = P.clone(); L.locks[i].y = floorAt(P.x, P.z, i); }
        else floorAt(L.locks[i].x, L.locks[i].z, i);
        want[i] = L.locks[i].clone(); want[i].y += lift;
      } else {
        // lift off from where the lock actually is, then ease back onto the path through the swing
        if (L.locks[i]){ L.offs[i][0] = L.locks[i].x - P.x; L.offs[i][1] = L.locks[i].z - P.z; L.locks[i] = null; }
        const uu = (p - d) / (1 - d), fade = 1 - uu * uu * (3 - 2 * uu);
        P.x += L.offs[i][0] * fade; P.z += L.offs[i][1] * fade;
        P.y = floorAt(P.x, P.z, i) + lift;
        want[i] = P;
      }
    });
  } else L.locks = [null, null];

  // FOOTING — standing and slow: each foot stays put, and steps when the body has moved or turned off it
  if (w < 1){
    let F = L.foot;
    if (!F){
      F = L.foot = { feet: [0, 1].map(i => {
        const at = L.ank[i] ? L.ank[i].clone() : toWorld(hipX(i), 0, new THREE.Vector3());
        if (!L.ank[i]) at.y = floorAt(at.x, at.z, i);
        return { at, yaw, step: null };
      }), last: 0 };
    }
    const rest = [0, 1].map(i => {
      const p = toWorld(hipX(i), 0, new THREE.Vector3());
      p.x += L.vx * FOOTING.lead; p.z += L.vz * FOOTING.lead;
      p.y = floorAt(p.x, p.z, i);
      return p;
    });
    const angle = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    const score = i => Math.max(Math.hypot(F.feet[i].at.x - rest[i].x, F.feet[i].at.z - rest[i].z) / (FOOTING.reach * sc),
                                angle(yaw - F.feet[i].yaw) / FOOTING.turn);
    // one foot steps at a time: the one most out of place, alternating when they tie
    if (!F.feet[0].step && !F.feet[1].step){
      const s0 = score(0), s1 = score(1);
      const i = s0 > s1 + 0.05 ? 0 : s1 > s0 + 0.05 ? 1 : 1 - F.last;
      if (score(i) > 1){ F.feet[i].step = { from: F.feet[i].at.clone(), t: 0, dur: FOOTING.stepTime }; F.last = i; }
    }
    F.feet.forEach((f, i) => {
      if (f.step){
        const st = f.step;
        st.t += dt;
        const k = clamp(st.t / st.dur, 0, 1), e = k * k * (3 - 2 * k);
        f.at.lerpVectors(st.from, rest[i], e);
        f.at.y += Math.sin(Math.PI * k) * FOOTING.lift * sc;
        if (k >= 1){ f.at.copy(rest[i]); f.yaw = yaw; f.step = null; }
      } else floorAt(f.at.x, f.at.z, i);
      want[i] = want[i] ? want[i].lerp(f.at, 1 - w) : f.at.clone();
    });
  }
  if (w >= 1) L.foot = null;

  // the BODY: the stride's bob and sway, the hips sinking to the lower foot, a lean into the speed and with the
  // acceleration (a push to start, a sit-back to stop, a bank into a turn)
  const body = mc ? mocapBody(mc, L.cyc % 1) : null;
  const bob = body ? (body.y - (1 - mc.hipH) * LEG) * K * w : 0;
  const sink = Math.min(0, L.drop[0], L.drop[1]) * GAIT.hipSink / sc;
  L.bob = ease(L.bob, bob - 0.012, dt, 20);
  L.sway = body ? body.sway * K * w : 0;
  const af = L.ax * sy + L.az * cy, ar = L.ax * cy - L.az * sy;
  L.lean = ease(L.lean, clamp(af * GAIT.accelLean, -GAIT.accelMax, GAIT.accelMax) + Math.min(0.12, Math.max(0, vf) * 0.012) * w, dt, 12);
  L.bank = ease(L.bank, -clamp(ar * GAIT.accelBank, -GAIT.accelMax, GAIT.accelMax), dt, 12);
  vis.position.set(L.sway, L.bob + sink, 0);
  vis.rotation.set(L.lean, 0, L.bank + (body ? body.roll * 0.5 * w : 0));

  // IK — each ankle onto its target, in the body's own frame (so a coil, a lean or a hit reaction never lifts the
  // planted feet off the floor)
  vis.updateWorldMatrix(true, false);
  _inv.copy(vis.matrixWorld).invert();
  const pitch = g.rotation.x + vis.rotation.x;
  legs.forEach(([th, sh, ft], i) => {
    L.ank[i] = want[i];
    _v.copy(want[i]).applyMatrix4(_inv);
    const [hip, bend, roll] = solve(_v.z - th.position.z, _v.y - th.position.y, _v.x - th.position.x);
    th.rotation.set(hip, 0, roll);
    sh.rotation.x = bend;
    ft.rotation.x = -(hip + bend) - pitch;   // the boot stays flat to the ground
  });
}

// two-bone IK in the leg's plane: dz forward, dy down (negative), dx sideways. Returns [hip pitch, knee bend, hip
// roll] like player/anim/gait.js solveLeg (hip − = thigh forward, knee + = bent).
function solve(dz, dy, dx){
  const a = THIGH, b = SHIN;
  const roll = Math.asin(clamp(dx / Math.max(Math.hypot(dz, dy, dx), 1e-4), -0.6, 0.6));
  const D = clamp(Math.hypot(dz, dy), 0.2, a + b - 0.001);
  const bend = Math.PI - Math.acos(clamp((a*a + b*b - D*D) / (2*a*b), -1, 1));
  const alpha = Math.acos(clamp((a*a + D*D - b*b) / (2*a*D), -1, 1));
  return [-(Math.atan2(dz, -dy) + alpha), bend, roll];
}
