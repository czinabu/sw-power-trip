// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Planted-foot gait: the stride clock advances by distance travelled, each foot follows a stance/swing path whose
// ground contact moves back at exactly the body's speed, and two-bone leg IK puts the ankle on that path. So feet
// plant and push instead of swinging on a sine and skating, steps lengthen and quicken with speed, walking has
// both feet down for a moment and running has a flight phase. Strafing and backpedalling use the same paths in the
// direction of travel. Also tracks acceleration for the body's lean (animation.js poseBody).

import * as THREE from 'three';
import { clamp } from '../../utils.js';
import { player } from '../../state.js';
import { GAIT } from '../../data/movement.js';
import { DIM } from '../model/rig.js';
import { groundAt, STEP_UP } from '../../world/collision.js';
import { MOCAP_ON, LEG, mocapStride, mocapFoot, mocapBody } from './mocap.js';
import { footDust } from '../../fx/footdust.js';

const TAU = Math.PI * 2;
const _inv = new THREE.Matrix4(), _hinv = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _h = new THREE.Vector3();
const SCALE = 1.18;                                   // hero model scale (model/index.js): world metres → rig units
export const ANK = DIM.hipY - 0.06 - DIM.thigh - DIM.shin;   // ankle height above the floor with the legs straight
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/* The ankle's resting height (world y) for a foot planted at (x, z): on whatever it stands on there, a step up at most
   STEP_UP above the body's support and at most GAIT.reachDown below it (a foot off an edge hangs, toes down). Also
   records how far the lowest foot sits below the support this frame, so the hips can sink to reach it. */
export function floorAt(x, z, i){
  const base = player.group.position.y;
  const d = clamp(groundAt(x, z, base + STEP_UP) - base, -GAIT.reachDown, STEP_UP);
  (player._footDrop || (player._footDrop = [0, 0]))[i] = d;
  return base + d + ANK * SCALE;
}

/* Advance the stride clock and acceleration estimate. `speed` is ground speed (m/s). Returns the gait state the
   pose needs this frame; player.runPhase follows the clock so the arm pump and run twist stay in step. */
export function advanceGait(dt, speed, style){
  const g = player._gait || (player._gait = { cyc: 0, step: GAIT.step[0], ax: 0, az: 0, pvx: 0, pvz: 0, inT: 0 });
  // acceleration of the steering velocity (impulses like dashes are excluded: the flips own those)
  if (dt > 0){
    const k = 1 - Math.exp(-GAIT.accelSmooth * dt);
    g.ax += ((player.moveVel.x - g.pvx) / dt - g.ax) * k;
    g.az += ((player.moveVel.z - g.pvz) / dt - g.az) * k;
  }
  g.pvx = player.moveVel.x; g.pvz = player.moveVel.z;
  const run = smooth(GAIT.runFrom, GAIT.runAt, speed);
  // the motion-captured stride (anim/mocap.js) sets the step length and the feet's time on the ground; without it
  // the procedural stride does
  const mc = MOCAP_ON ? mocapStride(speed, player.walking) : null;
  const stepWant = (mc ? mc.stride / 2 : Math.min(GAIT.step[0] + GAIT.step[1] * speed, GAIT.step[2]))
                   * (style.amp || 1) * (player.walking ? GAIT.walkStride : 1);
  g.step += (stepWant - g.step) * Math.min(1, dt * 6);   // eased, so a speed change doesn't jolt the foot targets
  g.cyc += speed * dt / (2 * g.step);                   // one cycle = two steps
  g.run = run;
  g.mc = mc;
  g.dutyF = mc ? mc.duty : null;
  g.duty = mc ? (mc.duty[0] + mc.duty[1]) / 2 : lerp(GAIT.duty[0], GAIT.duty[1], run);
  g.body = mc ? mocapBody(mc, g.cyc % 1) : null;   // the pelvis and chest for this moment of the stride
  g.lift = lerp(GAIT.lift[0], GAIT.lift[1], run) * (style.lift || 1);
  g.w = smooth(GAIT.blendFrom, GAIT.blendTo, speed);
  // the old sine stride had the left thigh furthest forward at sin(ph) = -1: keep that relation for the arms
  player.runPhase = g.cyc * TAU - Math.PI / 2;
  return g;
}

/* Hip height offset for the gait: lower at a run, dipping at each footfall (mid-stance of either foot). */
export function gaitHipOffset(g, style){
  if (!g || !(g.w > 0)) return 0;
  // the captured bob, about the captured hip height (a runner's legs never straighten under them)
  if (g.body) return (g.body.y * ((style.bob || 0.4) / 0.4) - (1 - g.mc.hipH) * LEG) * g.w;
  const p = g.cyc % 1;
  const bob = lerp(GAIT.bob[0], GAIT.bob[1], g.run) * ((style.bob || 0.4) / 0.4);
  const dip = 0.5 + 0.5 * Math.cos(TAU * 2 * (p - g.duty / 2));   // 1 at each foot's mid-stance
  return -(GAIT.runDrop * g.run + bob * dip) * g.w;
}

/* Leg angles for both feet on their gait paths. `fwd`/`right` is the direction of travel in the body's frame (unit).
   The path is followed in the body's frame (lean-compensated, so the feet stay on the floor under a leaning body),
   but a foot in its stance is LOCKED where it touched down in the world: the path alone would drag it when the
   speed or the stride shape changes under it (a hard stop, a turn). Its swing then starts from wherever the lock
   left it and blends back onto the path. Returns [hip pitch, knee bend, hip roll, ankle] for the left leg, then
   the right. */
export function gaitLegs(g, fwd, right, R, vis){
  const out = [];
  const sweep = 2 * g.step * g.duty / SCALE;   // ground contact distance per footfall, rig units
  // the legs are solved in the pelvis' frame: the captured stride tips and turns the pelvis under the body
  R.hips.updateMatrix();
  _hinv.copy(R.hips.matrix).invert();
  const lean = vis.rotation.x, cl = Math.cos(-lean), sl = Math.sin(-lean);
  vis.updateWorldMatrix(true, false);
  _inv.copy(vis.matrixWorld).invert();
  const floor = player.group.position.y + ANK * SCALE;
  const locks = g.locks || (g.locks = [null, null]), offs = g.offs || (g.offs = [[0, 0], [0, 0]]);
  [0, 0.5].forEach((off, i) => {                // left foot, then right half a cycle later
    const side = i === 0 ? -1 : 1;
    const p = (g.cyc + off) % 1;
    let s, lift, toe, u, side2 = 0, swing = p >= (g.dutyF ? g.dutyF[i] : g.duty);
    if (g.mc){
      // CAPTURED — the foot's real path: heel strike, roll, toe-off, the heel kicking up and the reach through,
      // stretched to the stride actually taken
      const d = g.dutyF[i], f = mocapFoot(g.mc, i, p, 2 * g.step / SCALE);
      u = swing ? (p - d) / (1 - d) : p / d;
      s = f.s; lift = f.h * g.w; toe = f.toe; side2 = f.x;
    } else if (!swing){
      // STANCE — on the path the foot slides back under the body at exactly the travel speed (still in the world)
      u = p / g.duty;
      s = sweep * (0.5 - u); lift = 0;
      toe = u > 0.75 ? (u - 0.75) / 0.25 * 0.45 : u < 0.12 ? -0.18 * (1 - u / 0.12) : 0;   // heel strike, roll, toe-off
    } else {
      // SWING — peel off behind, the heel kicks up (more at a run), reach through and set down ahead. The path leaves
      // and arrives at the stance's speed (a Hermite curve with those end tangents), so the foot lifts off and sets
      // down still in the world instead of skidding in
      u = (p - g.duty) / (1 - g.duty);
      const u2 = u * u, u3 = u2 * u;
      const m = -sweep / g.duty * (1 - g.duty);   // the stance's foot velocity, in swing-u units
      s = (2*u3 - 3*u2 + 1) * -sweep/2 + (u3 - 2*u2 + u) * m + (-2*u3 + 3*u2) * sweep/2 + (u3 - u2) * m;
      lift = Math.sin(Math.PI * Math.pow(u, 0.75)) * g.lift / SCALE * g.w;
      toe = lerp(0.5, -0.1, u);
    }
    // the path point in the hero group's frame, then into the (leaning) body's frame
    const gz = s * fwd, gx = s * right + side2, gy = ANK + lift;
    _p.set(DIM.hipX * side + gx, gy * cl - gz * sl - vis.position.y, gy * sl + gz * cl);
    if (!swing){
      // touch down: lock this spot in the world and hold it for the whole stance
      if (!locks[i]){ locks[i] = _p.clone().applyMatrix4(vis.matrixWorld); locks[i].y = floorAt(locks[i].x, locks[i].z, i); footDust(locks[i], Math.hypot(player.moveVel.x, player.moveVel.z)); }   // a puff of the floor's dust (fx/footdust.js)
      else floorAt(locks[i].x, locks[i].z, i);
      _p.copy(locks[i]).applyMatrix4(_inv);
      _p.y += lift;   // the heel rising off the ground toward toe-off (the captured stride; 0 for the procedural one)
    } else {
      if (locks[i]){
        // lift off from where the lock actually is, then ease back onto the path through the swing
        _q.copy(locks[i]).applyMatrix4(_inv);
        offs[i][0] = _q.x - _p.x; offs[i][1] = _q.z - _p.z;
        locks[i] = null;
      }
      const fade = 1 - u * u * (3 - 2 * u);
      _p.x += offs[i][0] * fade; _p.z += offs[i][1] * fade;
      // over a step or an edge the swing rides the ground under it
      _q.copy(_p).applyMatrix4(vis.matrixWorld);
      _p.y += (floorAt(_q.x, _q.z, i) - floor) / SCALE;
    }
    _h.copy(_p).applyMatrix4(_hinv);   // into the pelvis' frame, from its hip joint
    out.push(solveLeg(_h.z, _h.y + 0.06, _h.x - DIM.hipX * side, toe - lean - R.hips.rotation.x));
  });
  return out;
}

/* Drop the stance locks (the gait isn't driving the legs). */
export function releaseGait(g){ if (g) g.locks = null; }

// two-bone IK in the leg's plane: thigh then shin, the knee bending forward. dz forward, dy down (negative), dx to the
// body's right. Returns [hip pitch, knee bend, hip roll, ankle].
export function solveLeg(dz, dy, dx, toe){
  const a = DIM.thigh, b = DIM.shin;
  const d3 = Math.hypot(dz, dy, dx);
  const roll = Math.asin(clamp(dx / Math.max(d3, 1e-4), -0.6, 0.6));
  const dSag = Math.hypot(dz, dy);
  const D = clamp(dSag, 0.2, a + b - 0.001);
  const bend = Math.PI - Math.acos(clamp((a*a + b*b - D*D) / (2*a*b), -1, 1));
  const toward = Math.atan2(dz, -dy);                                        // forward of straight down
  const alpha = Math.acos(clamp((a*a + D*D - b*b) / (2*a*D), -1, 1));         // thigh ahead of the hip→ankle line
  const hip = -(toward + alpha);
  return [hip, bend, roll, -(hip + bend) + toe];
}
