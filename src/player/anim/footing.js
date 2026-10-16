// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Footing at a standstill and at walking pace: each foot stays locked where it is on the floor, and when the body
// turns or shifts so far that a foot is out of place (stopping out of a run, turning on the spot, sinking into a
// guard, stepping into a cut) that foot takes a quick step to where the stance wants it, one foot at a time. The
// gait (gait.js) takes over as speed builds; animation.js blends the two by speed.

import * as THREE from 'three';
import { clamp } from '../../utils.js';
import { player } from '../../state.js';
import { FOOTING } from '../../data/movement.js';
import { DIM } from '../model/rig.js';
import { solveLeg, ANK, floorAt } from './gait.js';

const SCALE = 1.18;
const _inv = new THREE.Matrix4(), _v = new THREE.Vector3(), _t = new THREE.Vector3();

/* Where the stance would put a foot (vis frame): forward kinematics of the stance's joint angles, dropped onto the
   floor. h = hip pitch, k = knee bend, r = hip roll, side = -1 left / +1 right. */
function restLocal(h, k, r, side, out){
  const a = DIM.thigh, b = DIM.shin;
  const down = a * Math.cos(h) + b * Math.cos(h + k);
  return out.set(DIM.hipX * side + Math.sin(r) * down, ANK, -(a * Math.sin(h) + b * Math.sin(h + k)));
}

/* Forget the locks (the gait or the air owns the legs); the next idle frame re-plants from where the feet are. */
export function releaseFooting(){ player._footing = null; }

/* Leg angles for the idle/slow footing. `still` = the stance's [Lhip, Lknee, Rhip, Rknee], `splay` = [Lroll, Rroll].
   Returns [hip pitch, knee bend, hip roll, ankle pitch, ankle yaw] per leg. */
export function footingLegs(dt, R, vis, still, splay){
  vis.updateWorldMatrix(true, false);
  const M = vis.matrixWorld;
  _inv.copy(M).invert();
  const yaw = player.faceYaw + vis.rotation.y;
  let F = player._footing;
  if (!F){
    // plant where the feet are now; a foot still in the air finishes its step down to the stance
    F = player._footing = { feet: [R.legL, R.legR].map((L, i) => {
      L.ank.updateWorldMatrix(true, false);
      const p = new THREE.Vector3().setFromMatrixPosition(L.ank.matrixWorld);
      return { at: p, yaw, step: p.y > floorAt(p.x, p.z, i) + 0.04 ? { from: p.clone(), t: 0, dur: FOOTING.stepTime } : null };
    }), last: 0 };
  }
  // a spinning cut whips the whole body round faster than feet could step: they pivot with it
  const spin = Math.atan2(Math.sin(vis.rotation.y - (F.visYaw ?? vis.rotation.y)), Math.cos(vis.rotation.y - (F.visYaw ?? vis.rotation.y)));
  F.visYaw = vis.rotation.y;
  if (Math.abs(spin) > FOOTING.spinRate * dt){
    const c = Math.cos(spin), sn = Math.sin(spin), o = player.group.position;
    const turn = v => { const x = v.x - o.x, z = v.z - o.z; v.x = o.x + x * c + z * sn; v.z = o.z - x * sn + z * c; };
    for (const f of F.feet){ turn(f.at); if (f.step) turn(f.step.from); f.yaw += spin; }
  }
  // a grounded cut (jedi/combat.js stepIntoCut) steps INTO the strike: the lead foot (the back foot for a back
  // strike) lifts as the cut starts and plants as the blade lands, where the body will finish its drive
  const sw = player.atkT > 0 && player.swing;
  if (sw && sw.travel && F.cut !== sw){
    F.cut = sw;
    const lead = sw.back ? 1 : 0, f = F.feet[lead];
    f.step = { from: f.at.clone(), t: 0, dur: Math.max(0.1, sw.dur * FOOTING.cutStrike), cut: sw.travel };
    F.last = lead;
  }
  const legs = [[still[0], still[1], splay[0], -1], [still[2], still[3], splay[1], 1]];
  // where each foot belongs, in the world, and how far out of place it is
  const want = legs.map(([h, k, r, side], i) => {
    const p = restLocal(h, k, r, side, new THREE.Vector3()).applyMatrix4(M);
    // drifting slowly: aim the step a little ahead so it isn't immediately out of place again
    p.x += player.moveVel.x * FOOTING.lead; p.z += player.moveVel.z * FOOTING.lead;
    p.y = floorAt(p.x, p.z, i);   // onto whatever is there: the floor, a step, a crate top
    return p;
  });
  const err = F.feet.map((f, i) => Math.hypot(f.at.x - want[i].x, f.at.z - want[i].z));
  const yawErr = F.feet.map(f => Math.abs(Math.atan2(Math.sin(yaw - f.yaw), Math.cos(yaw - f.yaw))));
  // one foot steps at a time: the one most out of place, alternating when they tie
  if (!F.feet[0].step && !F.feet[1].step){
    const score = i => Math.max(err[i] / FOOTING.reach, yawErr[i] / FOOTING.turn);
    let i = score(0) > score(1) + 0.05 ? 0 : score(1) > score(0) + 0.05 ? 1 : 1 - F.last;
    if (score(i) > 1){
      F.feet[i].step = { from: F.feet[i].at.clone(), t: 0, dur: FOOTING.stepTime * (0.8 + 0.4 * clamp(err[i] / 0.5, 0, 1)) };
      F.last = i;
    }
  }
  return F.feet.map((f, i) => {
    let toe = 0;
    if (f.step){
      // the step: lift, carry and set down on the target, which follows the body until the foot lands
      const s = f.step;
      s.t += dt;
      const u = clamp(s.t / s.dur, 0, 1), e = u * u * (3 - 2 * u);
      _t.copy(want[i]);
      if (s.cut){ _t.x += s.cut.x * (1 - s.cut.done); _t.z += s.cut.z * (1 - s.cut.done); }   // where the drive ends
      f.at.lerpVectors(s.from, _t, e);
      f.at.y = Math.max(s.from.y + (want[i].y - s.from.y) * e, Math.min(s.from.y, want[i].y)) + Math.sin(Math.PI * u) * FOOTING.lift;
      f.yaw += Math.atan2(Math.sin(yaw - f.yaw), Math.cos(yaw - f.yaw)) * Math.min(1, dt / Math.max(s.dur - s.t, dt));
      toe = Math.sin(Math.PI * u) * 0.35;
      if (u >= 1){ f.at.y = want[i].y; f.yaw = yaw; f.step = null; }
    }
    else floorAt(f.at.x, f.at.z, i);   // (keeps the hips' reach-down current for a planted foot)
    // the planted (or stepping) foot into the body's frame, relative to the hip joint
    _v.copy(f.at); _v.y += vis.position.y;   // a hop in the cut (Ataru's leap) carries the feet up with it
    _v.applyMatrix4(_inv);
    const side = i === 0 ? -1 : 1;
    const hipY = R.hips.position.y - 0.06;
    const out = solveLeg(_v.z, _v.y - hipY, _v.x - DIM.hipX * side, toe - vis.rotation.x);
    // a locked foot keeps its heading in the world: it turns at the ankle instead of spinning with the body
    const tw = Math.atan2(Math.sin(f.yaw - yaw), Math.cos(f.yaw - yaw));
    out.push(clamp(tw, -FOOTING.turn, FOOTING.turn) * (vis.scale.x < 0 ? -1 : 1));
    return out;
  });
}
