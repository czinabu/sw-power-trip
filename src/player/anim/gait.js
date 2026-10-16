// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Planted-foot gait: the stride clock advances by distance travelled, each foot follows a stance/swing path whose
// ground contact moves back at exactly the body's speed, and two-bone leg IK puts the ankle on that path. So feet
// plant and push instead of swinging on a sine and skating, steps lengthen and quicken with speed, walking has
// both feet down for a moment and running has a flight phase. Strafing and backpedalling use the same paths in the
// direction of travel. Also tracks acceleration for the body's lean (animation.js poseBody).

import { clamp } from '../../utils.js';
import { player } from '../../state.js';
import { GAIT } from '../../data/movement.js';
import { DIM } from '../model/rig.js';

const TAU = Math.PI * 2;
const SCALE = 1.18;                                   // hero model scale (model/index.js): world metres → rig units
const ANK = DIM.hipY - 0.06 - DIM.thigh - DIM.shin;   // ankle height above the floor with the legs straight
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

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
  const stepWant = Math.min(GAIT.step[0] + GAIT.step[1] * speed, GAIT.step[2]) * (style.amp || 1);
  g.step += (stepWant - g.step) * Math.min(1, dt * 6);   // eased, so a speed change doesn't jolt the foot targets
  g.cyc += speed * dt / (2 * g.step);                   // one cycle = two steps
  g.run = run;
  g.duty = lerp(GAIT.duty[0], GAIT.duty[1], run);
  g.lift = lerp(GAIT.lift[0], GAIT.lift[1], run) * (style.lift || 1);
  g.w = smooth(GAIT.blendFrom, GAIT.blendTo, speed);
  // the old sine stride had the left thigh furthest forward at sin(ph) = -1: keep that relation for the arms
  player.runPhase = g.cyc * TAU - Math.PI / 2;
  return g;
}

/* Hip height offset for the gait: lower at a run, dipping at each footfall (mid-stance of either foot). */
export function gaitHipOffset(g, style){
  if (!g || !(g.w > 0)) return 0;
  const p = g.cyc % 1;
  const bob = lerp(GAIT.bob[0], GAIT.bob[1], g.run) * ((style.bob || 0.4) / 0.4);
  const dip = 0.5 + 0.5 * Math.cos(TAU * 2 * (p - g.duty / 2));   // 1 at each foot's mid-stance
  return -(GAIT.runDrop * g.run + bob * dip) * g.w;
}

/* Leg angles for both feet on their gait paths. `fwd`/`right` is the direction of travel in the body's frame
   (unit), hipsY the hips joint height, lean the body's forward tilt (vis.rotation.x) so the feet stay on the floor
   under a leaning body (and the planted foot stays flat). Returns [hipX, kneeX, hipZ, ankX] for the left leg, then the right. */
export function gaitLegs(g, fwd, right, hipsY, visY, lean){
  const out = [];
  const sweep = 2 * g.step * g.duty / SCALE;   // ground contact distance per footfall, rig units
  const hy = hipsY - 0.06;                       // hip joint height (rig units, vis frame)
  const cl = Math.cos(-lean), sl = Math.sin(-lean);
  for (const off of [0, 0.5]){                   // left foot, then right half a cycle later
    const p = (g.cyc + off) % 1;
    let s, lift, toe;
    if (p < g.duty){
      // STANCE — planted: the foot slides back under the body at exactly the travel speed (so in the world it stays put)
      const u = p / g.duty;
      s = sweep * (0.5 - u); lift = 0;
      toe = u > 0.75 ? (u - 0.75) / 0.25 * 0.45 : u < 0.12 ? -0.18 * (1 - u / 0.12) : 0;   // heel strike, roll, toe-off
    } else {
      // SWING — peel off behind, the heel kicks up (more at a run), reach through and set down ahead. The path leaves
      // and arrives at the stance's speed (a Hermite curve with those end tangents), so the foot lifts off and sets
      // down still in the world instead of skidding in
      const u = (p - g.duty) / (1 - g.duty), u2 = u * u, u3 = u2 * u;
      const m = -sweep / g.duty * (1 - g.duty);   // the stance's foot velocity, in swing-u units
      s = (2*u3 - 3*u2 + 1) * -sweep/2 + (u3 - 2*u2 + u) * m + (-2*u3 + 3*u2) * sweep/2 + (u3 - u2) * m;
      lift = Math.sin(Math.PI * Math.pow(u, 0.75)) * g.lift / SCALE * g.w;
      toe = lerp(0.5, -0.1, u);
    }
    // the ground point in the hero group's frame, then into the (leaning) body's frame
    const gz = s * fwd, gx = s * right, gy = ANK + lift;
    const y = gy * cl - gz * sl - visY, z = gy * sl + gz * cl;
    out.push(solveLeg(z, y - hy, gx, toe - lean));
  }
  return out;
}

// two-bone IK in the leg's plane: thigh then shin, the knee bending forward. dz forward, dy down (negative), dx to the
// body's right. Returns [hip pitch, knee bend, hip roll, ankle].
function solveLeg(dz, dy, dx, toe){
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
