// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// POSE SYNC for online co-op: read this browser's hero pose into a compact message, and lay a received one onto a
// partner's puppet. Both heroes are built by the same buildHeroModel (player/model), so the joints line up one to one,
// whatever outfit each player picked. Sending the finished pose (not the inputs behind it) means every animation,
// from a saber string to a Mando's jetpack dive, shows on the partner exactly as their own screen draws it, and
// animation.js never has to know a second hero exists.

import * as THREE from 'three';

// the rig joints, in a fixed order (model/rig.js): their rotations travel as quaternions
const JOINTS = ['vis', 'hips', 'torso', 'chest', 'head', 'back', 'cape', 'skirt', 'flaps.F', 'flaps.B', 'flaps.L', 'flaps.R',
  'legL.hip', 'legL.knee', 'legL.ank', 'legR.hip', 'legR.knee', 'legR.ank', 'armL.sh', 'armL.el', 'armL.wr', 'armR.sh', 'armR.el', 'armR.wr'];
// ...and the ones animation also moves (the hips bob and shift, the torso leans, a flip lifts the whole visual root)
const MOVED = ['vis', 'hips', 'torso'];
// hand-held gear: which socket each hangs on (in hand or stowed: player/holster.js), and how it sits there
const GEAR = ['saberHand', 'saberBladeRoot', 'pistols.L', 'pistols.R', 'rifleMesh', 'darksaberMesh'];
const SOCKETS = ['handR', 'handL', 'back', 'belt', 'hipL', 'hipR'];

const at = (o, path) => path.split('.').reduce((a, k) => a && a[k], o);
const jointOf = (hero, name) => name === 'vis' ? hero.vis : at(hero.rig, name);
// a partner's blade glows gently: the full-strength saber light is tuned for the one hero the camera follows
const PARTNER_LIGHT = 3;
const r3 = (n) => Math.round(n * 1000) / 1000;

/* ---------- sending: this browser's hero → a message ---------- */
export function readPose(hero){
  const q = [], p = [], gear = [];
  for (const n of JOINTS){ const j = jointOf(hero, n); q.push(r3(j.quaternion.x), r3(j.quaternion.y), r3(j.quaternion.z), r3(j.quaternion.w)); }
  for (const n of MOVED){ const j = jointOf(hero, n); p.push(r3(j.position.x), r3(j.position.y), r3(j.position.z)); }
  for (const n of GEAR){
    const m = at(hero, n);
    if (!m){ gear.push(null); continue; }
    const s = n === 'saberBladeRoot' ? -1 : SOCKETS.findIndex(k => hero.rig.sockets[k] === m.parent);
    gear.push([m.visible ? 1 : 0, s, r3(m.position.x), r3(m.position.y), r3(m.position.z), r3(m.quaternion.x), r3(m.quaternion.y), r3(m.quaternion.z), r3(m.quaternion.w)]);
  }
  const B = hero.blade, jet = hero.jetGlow && hero.jetGlow[0];
  const fx = {
    blade: B && B.blade.visible ? 1 : 0, bc: B ? B.glow.material.color.getHex() : 0,
    dark: hero.darkBlades && hero.darkBlades[0].visible ? 1 : 0,
    jet: jet ? r3(jet.material.opacity) : 0, jetS: jet ? r3(jet.scale.y) : 1,
    miss: hero.jetMissileMesh && hero.jetMissileMesh.visible ? 1 : 0,
  };
  return { q, p, gear, fx };
}

/* ---------- receiving: a message → the partner's puppet, smoothed ----------
   Each new pose eases in from whatever the puppet shows right now over about one message gap, so the partner moves
   continuously however unevenly the messages arrive. */
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

export function makePoseTrack(){
  return { from: null, to: null, t0: 0, span: 50, last: 0 };
}

// capture where the puppet is now as the start of the next blend
function snapshot(hero){
  const q = [], p = [];
  for (const n of JOINTS){ const j = jointOf(hero, n); q.push(j.quaternion.x, j.quaternion.y, j.quaternion.z, j.quaternion.w); }
  for (const n of MOVED){ const j = jointOf(hero, n); p.push(j.position.x, j.position.y, j.position.z); }
  return { q, p };
}

export function pushPose(track, hero, pose, now){
  if (!pose || !Array.isArray(pose.q) || pose.q.length !== JOINTS.length * 4) return;
  track.span = track.last ? Math.min(200, Math.max(30, now - track.last)) : 50;
  track.last = now;
  track.from = track.to ? snapshot(hero) : null;
  track.to = pose; track.t0 = now;
  applyGear(hero, pose);
}

export function stepPose(track, hero, now){
  const to = track.to;
  if (!to) return;
  const from = track.from, k = from ? Math.min(1, (now - track.t0) / track.span) : 1;
  JOINTS.forEach((n, i) => {
    const j = jointOf(hero, n), o = i * 4;
    _qb.set(to.q[o], to.q[o + 1], to.q[o + 2], to.q[o + 3]).normalize();
    if (from && k < 1){ _qa.set(from.q[o], from.q[o + 1], from.q[o + 2], from.q[o + 3]); j.quaternion.copy(_qa).slerp(_qb, k); }
    else j.quaternion.copy(_qb);
  });
  MOVED.forEach((n, i) => {
    const j = jointOf(hero, n), o = i * 3;
    for (let a = 0; a < 3; a++){
      const b = to.p[o + a], v = from && k < 1 ? from.p[o + a] + (b - from.p[o + a]) * k : b;
      j.position.setComponent(a, v);
    }
  });
}

// gear and glows switch at once: they're on/off states (a blade lit, a pistol drawn), not motion to smooth
function applyGear(hero, pose){
  GEAR.forEach((n, i) => {
    const m = at(hero, n), s = pose.gear && pose.gear[i];
    if (!m || !s) return;
    m.visible = !!s[0];
    if (s[1] >= 0){ const sock = hero.rig.sockets[SOCKETS[s[1]]]; if (sock && m.parent !== sock) sock.add(m); }
    m.position.set(s[2], s[3], s[4]);
    m.quaternion.set(s[5], s[6], s[7], s[8]).normalize();
  });
  const fx = pose.fx || {}, B = hero.blade;
  if (B){
    B.blade.visible = B.glow.visible = !!fx.blade;
    if (fx.bc){ B.glow.material.color.setHex(fx.bc); B.light.color.setHex(fx.bc); }
    B.light.intensity = fx.blade ? PARTNER_LIGHT : 0;   // dimmed, never hidden: a light switching off recompiles shaders
  }
  if (hero.darkBlades) for (const b of hero.darkBlades) b.visible = !!fx.dark;
  if (hero.darkLight) hero.darkLight.intensity = fx.dark ? PARTNER_LIGHT * 0.8 : 0;
  if (hero.jetGlow) for (const g of hero.jetGlow){ g.material.opacity = fx.jet || 0; g.scale.y = fx.jetS || 1; }
  if (hero.jetMissileMesh) hero.jetMissileMesh.visible = !!fx.miss;
}

export const POSE_JOINTS = JOINTS;   // for the co-op smoke test
