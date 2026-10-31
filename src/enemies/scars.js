// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Saber damage that stays. A blade that lands burns a cut into the armour where it crossed (glowing at first, then
// cooling to a black char that the unit wears for the rest of the fight), and a killing cut can take a foe's limbs
// off (arms, legs, the head: severLimbs below). Called from the hero's blades: the Jedi saber (player/jedi/combat.js, aerial.js) and the
// Mandalorian's darksaber (player/mando/darksaber.js). Visual only: nothing here touches health or the AI.
//
// A cut is drawn by the unit's own armour material (enemies/kit.js wearArmor, up to SCARS of them). It is stored in
// the body's REST pose, pinned to the bone under it (chest, head, a thigh, a shin...), so it rides the plate it landed
// on however the body then bends.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rand, clamp } from '../utils.js';
import { SCARS } from './kit.js';
import { bladePointNear } from '../player/jedi/clash.js';
import { groundAt } from '../world/collision.js';
import { burst } from '../fx/particles.js';

export const scarClock = () => performance.now() / 1000;

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
const _c = new THREE.Vector3(), _b = new THREE.Vector3(), _w = new THREE.Vector3(), _dir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// world → the body's rest pose, through bone bi of skinned mesh sm (a direction when dir is set)
function toRest(sm, bi, v, out, dir){
  const sk = sm.skeleton;
  _m.copy(sk.bones[bi].matrixWorld).multiply(sk.boneInverses[bi]).multiply(sm.bindMatrix);
  _inv.copy(_m).invert();
  return dir ? out.copy(v).transformDirection(_inv) : out.copy(v).applyMatrix4(_inv);
}
// each named bone's joint in the rest pose (cached on the mesh)
function restJoints(sm){
  if (sm.userData.joints) return sm.userData.joints;
  const J = {};
  sm.skeleton.bones.forEach((b, i) => {
    if (!b.name) return;
    J[b.name] = { i, o: new THREE.Vector3().applyMatrix4(_m.copy(sm.skeleton.boneInverses[i]).invert()).applyMatrix4(sm.bindMatrixInverse) };
  });
  return (sm.userData.joints = J);
}
// which bone carries the skin at world point v: the helmet, the chest, a foot, shin or thigh, else the pelvis
function boneAt(sm, v){
  const J = restJoints(sm), S = J.thighL ? J.thighL.o.y / 0.94 : 1;   // the bosses' body is the trooper kit scaled up
  const at = j => toRest(sm, j.i, v, _q);
  if (J.head && at(J.head).y >= J.head.o.y - 0.05 * S) return J.head.i;
  if (J.chest && at(J.chest).y >= J.chest.o.y) return J.chest.i;
  for (const n of ['L', 'R']){
    for (const part of ['foot', 'shin', 'thigh']){
      const j = J[part + n]; if (!j) continue;
      const p = at(j);
      if (Math.sign(p.x) === Math.sign(j.o.x) && Math.abs(p.x - j.o.x) < 0.2 * S && p.y <= j.o.y + 0.04 * S) return j.i;
    }
  }
  return 0;
}

/* burn a cut where the hero's blade crossed `group`'s body. f: the blow's direction (the hero's facing); dirKey: the
   cut's line ('left' / 'right' sweep across, else a diagonal); heavy: a finisher or a heavy form, more upright.
   hit: where the blade really met the body and which way its tip was going (player/jedi/bladehit.js sw.hitAt), when
   the swing traced it; without it the cut is placed from the blade's line and the swing */
export function scarBody(group, f, dirKey, heavy, hit){
  const u = group.userData, sm = u.bodySkin, W = u.bodyMat && u.bodyMat.userData.wear;
  if (!sm || !W) return;
  group.updateMatrixWorld(true);
  const H = group.scale.x * (u.vis ? u.vis.scale.y : 1) * (u.legScale || 1), gp = group.position;
  // the height: where your blade passes the body (else somewhere on the torso), on the plate facing the blow
  _c.set(gp.x, gp.y + 1.4 * H, gp.z);
  let y = gp.y + rand(1.05, 1.65) * H;
  if (bladePointNear(_c, _b)) y = clamp(_b.y, gp.y + 0.45 * H, gp.y + 1.85 * H);
  const side = rand(-0.09, 0.09) * H;
  _w.set(gp.x - f.x * 0.2 * H + f.z * side, y, gp.z - f.z * 0.2 * H - f.x * side);
  // the line of the cut: a sweep goes across, a plain cut runs on a slant, a heavy blow comes down near upright
  _dir.set(f.z, 0, -f.x);
  if (heavy) _dir.multiplyScalar(0.35).addScaledVector(UP, Math.random() < 0.5 ? 1 : -1);
  else if (dirKey !== 'left' && dirKey !== 'right') _dir.addScaledVector(UP, rand(0.6, 1.1) * (Math.random() < 0.5 ? 1 : -1));
  else _dir.addScaledVector(UP, rand(-0.25, 0.25));
  // the traced contact wins: the very spot, and the tip's own line across the plate (flattened onto the body's face)
  if (hit && hit.at){
    _w.copy(hit.at);
    if (hit.cut && hit.cut.lengthSq() > 1e-6){ _b.copy(hit.cut).addScaledVector(f, -hit.cut.dot(f)); if (_b.lengthSq() > 1e-6) _dir.copy(_b); }
  }
  _dir.normalize();
  const bi = boneAt(sm, _w);
  const rp = toRest(sm, bi, _w, _p);
  if (rp.y < 0.25 * (u.legScale || 1)) return;   // (the boots: below where a sword arm's own rest pose lives, see kit.js)
  const rd = toRest(sm, bi, _dir, _q, true);
  const k = (W.scarNext || 0) % SCARS; W.scarNext = k + 1;
  W.uScar.value[k].set(rp.x, rp.y, rp.z, scarClock());
  W.uScarDir.value[k].set(rd.x, rd.y, rd.z, rand(0.15, 0.22) * (u.legScale || 1) * (heavy ? 1.2 : 1));
}

/* ---------- severed limbs ---------- */
const CAP = new THREE.CircleGeometry(0.075, 10);
const pieces = [];   // { o, v, spin, t, caps, rest, floor, flat, mat }

/* The limbs a unit can lose, one bit each (e.cut is the mask; the host sends it in every snapshot so a co-op guest sees the
   same cuts). A slot limb (the arms) is lifted off the body whole; a bone limb (the head, a leg at the hip, a leg below the
   knee) is shrunk to nothing inside the skinned body, and a stand-in flies off in its place. */
const LIMBS = [
  { bit: 1,  slot: 'weaponArm' }, { bit: 2, slot: 'offArm' }, { bit: 4, slot: 'offArmR' },
  { bit: 8,  bone: 'head', kind: 'head' },
  { bit: 16, bone: 'thighL', kind: 'leg' }, { bit: 32, bone: 'thighR', kind: 'leg' },
  { bit: 64, bone: 'shinL', kind: 'shin' }, { bit: 128, bone: 'shinR', kind: 'shin' },
];
const LEG_BITS = { L: 16 | 64, R: 32 | 128 };   // a leg gone at the hip takes the shin with it

const _s = new THREE.Vector3(), _qq = new THREE.Quaternion();
const SUIT = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.78, metalness: 0.2 });
const geo = {};
const G_ = (k, make) => geo[k] || (geo[k] = make());

// a stand-in for a bone limb, hanging from its origin like the real one (a leg down -y, a head up +y)
function limbProxy(kind, armor, eye, noShin){
  const g = new THREE.Group(), add = (geom, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  if (kind === 'head'){
    add(G_('neck', () => new THREE.CylinderGeometry(0.06, 0.07, 0.14, 6)), SUIT, 0, 0.02, 0);
    add(G_('helm', () => new THREE.SphereGeometry(0.2, 10, 8)), armor, 0, 0.2, 0).scale.set(1, 1.1, 1.05);
    add(G_('visor', () => new THREE.BoxGeometry(0.2, 0.04, 0.05)), new THREE.MeshBasicMaterial({ color: eye, toneMapped: false }), 0, 0.2, 0.18);
  } else {
    if (kind === 'leg'){
      add(G_('thigh', () => new THREE.CylinderGeometry(0.15, 0.12, 0.48, 7)), SUIT, 0, -0.24, 0);
      add(G_('cuisse', () => new THREE.BoxGeometry(0.17, 0.26, 0.05)), armor, 0, -0.2, 0.1);
    }
    if (noShin) return g;   // (the shin is already gone and lies elsewhere)
    const y = kind === 'leg' ? -0.48 : 0;
    add(G_('shin', () => new THREE.CylinderGeometry(0.12, 0.09, 0.4, 7)), armor, 0, y - 0.2, 0);
    add(G_('boot', () => new THREE.BoxGeometry(0.15, 0.09, 0.3)), SUIT, 0, y - 0.43, 0.06);
  }
  return g;
}

/* take limb `L` off unit `e` and send it flying. f: the way the blow was travelling */
function cutLimb(e, L, f){
  const u = e.group.userData, caps = [];
  const cap = (parent, pos, faceDown) => {
    const m = new THREE.Mesh(CAP, new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.copy(pos); m.rotation.x = faceDown ? Math.PI / 2 : -Math.PI / 2; m.userData.noAO = true;
    parent.add(m); caps.push(m);
  };
  let o, mat = null, flat = true, floor = 0.12;
  if (L.slot){
    o = u[L.slot];
    if (!o || !o.parent) return false;
    const host = o.parent;
    cap(host, o.position.clone(), false); cap(o, new THREE.Vector3(0, 0.02, 0), true);
    scene.attach(o);
    u[L.slot] = null;
  } else {
    const bone = u[L.bone];
    if (!bone || bone.userData.cut) return false;
    bone.updateWorldMatrix(true, false);
    bone.matrixWorld.decompose(_c, _qq, _s);
    const armor = mat = u.bodyMat ? new THREE.MeshStandardMaterial({ color: u.bodyMat.color, roughness: 0.5, metalness: 0.55 }) : SUIT;
    o = limbProxy(L.kind, armor, e.t.eye, L.kind === 'leg' && !!((e.cut || 0) & (L.bit << 2)));   // (bit<<2: this leg's shin)
    o.position.copy(_c); o.quaternion.copy(_qq); o.scale.copy(_s);
    scene.add(o);
    // the real limb shrinks away inside the body; the wound glows on the stump
    bone.userData.cut = true; bone.scale.setScalar(0.0001);
    if (bone.parent) cap(bone.parent, bone.position.clone(), false);
    cap(o, new THREE.Vector3(0, 0, 0), L.kind === 'head');
    flat = L.kind !== 'head'; floor = L.kind === 'head' ? 0.2 : 0.14;
    if (mat === SUIT) mat = null;
  }
  burst(o.getWorldPosition(_c), 0xffa040, 10, 6, 4, 0.5);
  pieces.push({ o, v: new THREE.Vector3(f.x * rand(2.5, 4.5), rand(3.5, 5.5), f.z * rand(2.5, 4.5)),
                spin: new THREE.Vector3(rand(-9, 9), rand(-6, 6), rand(-9, 9)), t: 0, caps, rest: false, floor, flat, mat });
  return true;
}

// where on the body the blade met it, as 0 (feet) .. 1 (crown), or null when the swing didn't trace a contact
function hitHeight(e, hit){
  if (!hit || !hit.at) return null;
  const g = e.group, H = 1.95 * g.scale.x * (g.userData.vis ? g.userData.vis.scale.y : 1);
  return clamp((hit.at.y - g.position.y) / H, 0, 1);
}

/* A killing saber cut (never a guarded one: those turn aside before they reach here) may take limbs off, more of them the
   heavier the blow. chance: the first limb's odds; each further one is half as likely. hit: where the blade really met the
   body (player/jedi/bladehit.js) so a low cut takes legs and a high one the head, else any limb is fair. Returns the mask of
   limbs taken. A boss is never cut (they aren't in the enemy list); a champion loses one limb at most, and keeps its head. */
export function severLimbs(e, f, chance, hit){
  if (e.net || !e.group || !e.group.userData) return 0;
  const u = e.group.userData, h = hitHeight(e, hit), champ = !!(e.champion || e.warbringer);
  const cut = e.cut || 0;
  // the limbs this unit still has, weighted by where the blade was: low = legs, high = the head, between = arms
  const pool = [];
  for (const L of LIMBS){
    if (cut & L.bit) continue;
    if (L.slot ? !u[L.slot] : !u[L.bone]) continue;
    if (L.bit === 64 && cut & 16 || L.bit === 128 && cut & 32) continue;   // the shin of a leg already gone
    if (champ && L.kind === 'head') continue;
    const low = L.kind === 'leg' || L.kind === 'shin', hi = L.kind === 'head';
    let w = low ? 1 : hi ? 0.8 : 1.4;
    if (h != null) w *= low ? (h < 0.5 ? 3 : 0.3) : hi ? (h > 0.78 ? 4 : 0.2) : (h >= 0.5 && h <= 0.85 ? 1.6 : 0.5);
    pool.push([L, w]);
  }
  let mask = 0, p = champ ? chance * 0.5 : chance;
  for (let n = 0; n < (champ ? 1 : 3) && pool.length && Math.random() < p; n++, p *= 0.5){
    let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0), i = 0;
    while (i < pool.length - 1 && (r -= pool[i][1]) > 0) i++;
    const L = pool.splice(i, 1)[0][0];
    mask |= L.bit;
    // a leg off at the hip takes the shin with it
    const side = L.bone === 'thighL' ? 'L' : L.bone === 'thighR' ? 'R' : null;
    if (side){ for (let j = pool.length - 1; j >= 0; j--) if (pool[j][0].bone === 'shin' + side) pool.splice(j, 1); }
  }
  if (mask) applyCuts(e, mask, f);
  return mask;
}

/* put the cuts in `mask` on `e` (the ones it doesn't wear yet). The guest calls this from the host's snapshot */
export function applyCuts(e, mask, f){
  const fresh = mask & ~(e.cut || 0);
  if (!fresh) return;
  e.cut = (e.cut || 0) | fresh;
  if (!f) f = _dir.set(-Math.sin(e.group.rotation.y), 0, -Math.cos(e.group.rotation.y));   // (no blow to follow: away from where it faces)
  for (const L of LIMBS) if (fresh & L.bit) cutLimb(e, L, f);
}

const HOLD = 7, SINK = 1.2;   // seconds an arm lies there, then how long it takes to sink away
export function updateSevered(dt){
  for (let i = pieces.length - 1; i >= 0; i--){
    const P = pieces[i], o = P.o;
    P.t += dt;
    for (const c of P.caps) c.material.opacity = Math.max(0, 1 - P.t / 2.2);
    if (!P.rest){
      P.v.y -= 22 * dt;
      o.position.addScaledVector(P.v, dt);
      o.rotation.x += P.spin.x * dt; o.rotation.y += P.spin.y * dt; o.rotation.z += P.spin.z * dt;
      const floor = groundAt(o.position.x, o.position.z, o.position.y + 0.5) + P.floor;
      if (o.position.y <= floor && P.v.y < 0){
        o.position.y = floor;
        if (Math.abs(P.v.y) > 3){ P.v.y *= -0.3; P.v.x *= 0.5; P.v.z *= 0.5; P.spin.multiplyScalar(0.4); }   // one bounce
        else { P.rest = true; if (P.flat){ o.rotation.x = Math.PI / 2 * Math.sign(o.rotation.x || 1); o.rotation.z = 0; } }   // lies flat
      }
    }
    if (P.t > HOLD) o.position.y -= dt * 0.5 / SINK;
    if (P.t > HOLD + SINK){ dropPiece(P); pieces.splice(i, 1); }
  }
}
function dropPiece(P){
  if (P.mat) P.mat.dispose();
  P.o.traverse(m => { if (m.isMesh && m.material && m.material.isMeshBasicMaterial) m.material.dispose(); });
  for (const c of P.caps){ c.parent && c.parent.remove(c); c.material.dispose(); }
  if (P.o.parent) P.o.parent.remove(P.o);
}
/* a new arena: clear them all */
export function clearSevered(){ for (const P of pieces) dropPiece(P); pieces.length = 0; }
