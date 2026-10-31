// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The small life in a hero's face and hands, stepped each frame after the pose (player/animation.js, and the co-op
// partners' puppets in net/partner.js):
//   · BLINK — the Jedi's upper lids (jedi.js face) drop and lift every few seconds, now and then twice
//   · WEAR — the dust line follows the feet and the fight's soot follows target.grime (model/wear.js)
//   · SWAY — loose hair (a Padawan braid, long hair, a topknot) and the Mando's belt gear swing and lag as the body
//     moves, springs driven by how fast the head or hips travel and turn (hairSway, gearSway)
//   · EXPRESSION — the Jedi's brows and jaw: a level frown at rest, knitted and jaw set through a swing or a cast,
//     brows up and mouth open on a hit, the jaw working through a line he speaks in a cutscene (express)
//   · HANDS — each hand eases toward the grip it's asked for: 1 a fist round a hilt or a blaster, 0 a flat open
//     palm (a Force push), between them a relaxed hand or a hooked claw (jedi.js hand, curlHand)

import { curlHand } from './jedi.js';
import { stepWear } from './wear.js';
import * as THREE from 'three';

const OPEN = 0.3;   // the lid's scale while the eye is open: just its crease shows

export function blink(target, dt){
  const R = target.rig;
  if (!R) return;
  stepWear(target);
  sway(target, dt);
  const B = target.blink || (target.blink = { t: 1 + Math.random() * 3, k: 0, twice: false });
  B.t -= dt;
  if (B.t <= 0){ B.k = 0.14; B.t = B.twice ? 0.22 : 2.2 + Math.random() * 3.5; B.twice = !B.twice && Math.random() < 0.2; }
  B.k = Math.max(0, B.k - dt);
  const shut = B.k > 0 ? Math.sin(B.k / 0.14 * Math.PI) : 0;
  for (const head of R.head.children){
    const lids = head.userData.lids;
    if (lids) for (const l of lids) l.scale.y = OPEN + (1 - OPEN) * shut;
  }
}

/* ease each hand toward its grip: want = { L, R } curls (0..1) */
export function gripHands(target, dt, want){
  const R = target.rig;
  if (!R) return;
  for (const [A, c] of [[R.armL, want.L], [R.armR, want.R]]){
    const hs = A.wr.userData.hands;
    if (!hs) continue;
    for (const h of hs){
      const cur = h.curl < 0 ? c : h.curl;
      curlHand(h, cur + (c - cur) * Math.min(1, dt * 14));
    }
  }
}

/* ---------- sway: hair and belt gear on springs ---------- */
const _w = new THREE.Vector3(), _l = new THREE.Vector3(), _q = new THREE.Quaternion();
// one pivot: push it against the way its anchor accelerates (it lags), let gravity hang it straight, a little bounce
function spring(g, dt, ax, az, give, k = 90){
  const S = g.userData.sp || (g.userData.sp = { x: 0, z: 0, vx: 0, vz: 0 });
  const h = Math.min(dt, 1 / 30), c = 2 * Math.sqrt(k) * 0.3;
  S.vx += (k * (ax * give - S.x) - c * S.vx) * h; S.x += S.vx * h;
  S.vz += (k * (az * give - S.z) - c * S.vz) * h; S.z += S.vz * h;
  S.x = Math.max(-0.9, Math.min(0.9, S.x)); S.z = Math.max(-0.7, Math.min(0.7, S.z));
  const r = g.userData.rest;
  g.rotation.set(r.x + S.x, r.y, r.z + S.z);
}
// how its anchor moved this frame, in the anchor's own frame: forward and sideways acceleration (m/s²)
function accel(g, anchor, dt){
  const U = g.userData;
  anchor.getWorldPosition(_w);
  const v = U.pv ? _l.copy(_w).sub(U.pv).divideScalar(dt) : _l.set(0, 0, 0);
  if (v.lengthSq() > 900) v.set(0, 0, 0);   // a teleport, a respawn
  U.pv = (U.pv || new THREE.Vector3()).copy(_w);
  const a = U.vel ? v.clone().sub(U.vel).divideScalar(dt) : new THREE.Vector3();
  U.vel = (U.vel || new THREE.Vector3()).copy(v);
  anchor.getWorldQuaternion(_q).invert();
  return a.applyQuaternion(_q).clampLength(0, 60);
}
function sway(target, dt){
  if (!(dt > 0)) return;
  const R = target.rig;
  for (const head of R.head.children){
    const hs = head.userData.hairs;
    if (!hs || !head.visible) continue;
    for (const g of hs){ const a = accel(g, head, dt); spring(g, dt, a.z * -0.012 + a.y * 0.004, a.x * 0.012, g.userData.give); }
  }
  const gear = R.hips.userData.gear;
  if (gear) for (const g of gear){ if (!g.visible) continue; const a = accel(g, R.hips, dt); spring(g, dt, a.z * -0.01 + a.y * 0.006, a.x * 0.01, 1, 120); }
}

/* ---------- expression: the Jedi's brows and jaw ----------
   want: { effort 0..1 (a swing, a cast), hurt 0..1 (just hit), talk (speaking a line) } */
export function express(target, dt, want){
  const R = target.rig;
  if (!R || !(dt > 0)) return;
  const E = target.face || (target.face = { e: 0, h: 0, t: 0, jaw: 0, syl: 0, sylT: 0 });
  const ease = (c, w, r) => c + (w - c) * Math.min(1, dt * r);
  E.e = ease(E.e, want.effort || 0, 10); E.h = ease(E.h, want.hurt || 0, 18); E.t = ease(E.t, want.talk ? 1 : 0, 8);
  if ((E.sylT -= dt) <= 0){ E.syl = E.t > 0.1 ? 0.3 + Math.random() * 0.7 : 0; E.sylT = 0.07 + Math.random() * 0.08; }
  E.jaw = ease(E.jaw, Math.max(E.h * 0.35, E.e * 0.08, E.t * E.syl * 0.22), 22);
  for (const head of R.head.children){
    const U = head.userData;
    if (U.jaw) U.jaw.rotation.x = E.jaw;
    if (U.brows) for (const b of U.brows){
      const r = b.userData.rest;
      // effort: the inner ends come down and together; hurt: the brows jump up
      b.position.y = r.y - E.e * 0.006 + E.h * 0.008;
      b.rotation.z = r.z + r.side * (E.e * 0.22 - E.h * 0.3);
    }
  }
}
