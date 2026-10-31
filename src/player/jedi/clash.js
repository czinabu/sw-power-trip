// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Blade on blade: where a foe's weapon is, and what happens when your cut meets one that is ready for it.

import * as THREE from 'three';
import { CFG } from '../../data/config.js';
import { DUEL } from '../../data/duel.js';
import { sfx } from '../../audio/sfx.js';
import { clashSparks } from '../../fx/ink.js';
import { shared, G, enemies, player, isGunner } from '../../state.js';
import { playerPos, stance } from '../helpers.js';
import { cutLine, duelDefend, isGuarding } from '../../enemies/duel.js';
import { bladeClash, jarStamina } from '../damage.js';
import { bladeSegment } from './bladehit.js';

/* WHERE THE WEAPON IS — each weapon's line in its slot's own frame (enemies/mesh.js weaponArm: the grip hangs off the
   elbow, which hangs off the shoulder slot; the staff is its own slot; the boss's blade rises out of his hand). */
const ELBOW = new THREE.Vector3(0, -0.41, 0), WRIST = new THREE.Vector3(0, -0.38, 0.03), BEND = new THREE.Euler(-0.15, 0, 0);
const PIKE = new THREE.Euler(-1.1, 0, 0);
const inArm = (y, e) => { const v = new THREE.Vector3(0, y, 0); if (e) v.applyEuler(e); return v.add(WRIST).applyEuler(BEND).add(ELBOW); };
const ARM_LINE = {
  sword: [inArm(-0.05), inArm(-1.08)],
  saber: [inArm(-0.16), inArm(-1.28)],
  maul:  [inArm(0), inArm(-1.25)],
  pike:  [inArm(-0.2, PIKE), inArm(-1.98, PIKE)],
};
const STAFF_LINE = [new THREE.Vector3(0, -1.02, 0), new THREE.Vector3(0, 1.02, 0)];
const BOSS_LINE = [new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 2.3, 0)];

// a foe's weapon, base → tip, in world space; false if it carries nothing a blade can meet (blasters, droids…)
export function foeBlade(e, outB, outT){
  const u = e.group.userData;
  let node = null, line = null;
  if (u.staff){ node = u.staff; line = STAFF_LINE; }
  else if (u.weaponArm){ node = u.weaponArm; line = ARM_LINE[e.t.weapon || 'maul']; }
  if (!node || !line) return false;
  node.updateWorldMatrix(true, false);
  outB.copy(line[0]); node.localToWorld(outB);
  outT.copy(line[1]); node.localToWorld(outT);
  return true;
}
export function bossBlade(outB, outT){
  const b = shared.boss, h = b && b.group.userData.hand;
  if (!h) return false;
  h.updateWorldMatrix(true, false);
  outB.copy(BOSS_LINE[0]); h.localToWorld(outB);
  outT.copy(BOSS_LINE[1]); h.localToWorld(outT);
  return true;
}

// the closest point on segment a→b to p (into out), and the squared distance to it
function nearOnSeg(p, a, b, out){
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const L = abx * abx + aby * aby + abz * abz || 1;
  const s = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / L));
  out.set(a.x + abx * s, a.y + aby * s, a.z + abz * s);
  return out.distanceToSquared(p);
}
const FB = new THREE.Vector3(), FT = new THREE.Vector3(), PB = new THREE.Vector3(), PT = new THREE.Vector3();
const Q = new THREE.Vector3(), N = new THREE.Vector3();

/* where two blades cross: the point on the foe's weapon nearest your blade (sampled along yours). Falls back to just in
   front of the foe when either weapon can't be found. */
export function contactPoint(e){
  if (e === shared.boss ? bossBlade(FB, FT) : foeBlade(e, FB, FT)){
    if (bladeSegment(PB, PT)){
      let best = Infinity; const out = new THREE.Vector3();
      for (let i = 0; i <= 6; i++){
        Q.lerpVectors(PB, PT, i / 6);
        const d = nearOnSeg(Q, FB, FT, N);
        if (d < best){ best = d; out.copy(N); }
      }
      return out;
    }
    return FB.clone().lerp(FT, 0.5);
  }
  const g = e.group.position, pp = playerPos();
  const dx = pp.x - g.x, dz = pp.z - g.z, dl = Math.hypot(dx, dz) || 1;
  return new THREE.Vector3(g.x + dx / dl * 0.7, g.y + 1.5, g.z + dz / dl * 0.7);
}

/* WHERE A PARRY MEETS — the point on the foe's real blade a guard would catch it at: the part of the blade nearest the
   spot in front of your chest where a guard waits, kept within an arm's reach so the saber can get there. Null when the
   foe carries no blade we can find (the catch then falls back to the old height/side pick). */
const GUARD_SPOT = new THREE.Vector3();
export function parryContact(e){
  if (!(e === shared.boss ? bossBlade(FB, FT) : foeBlade(e, FB, FT))) return null;
  const pp = playerPos(), f = new THREE.Vector3(Math.sin(G.yaw), 0, Math.cos(G.yaw));
  GUARD_SPOT.set(pp.x + f.x * 0.7, pp.y + 1.4, pp.z + f.z * 0.7);
  const out = new THREE.Vector3();
  nearOnSeg(GUARD_SPOT, FB, FT, out);
  const chest = Q.set(pp.x, pp.y + 1.4, pp.z), reach = 1.5;
  N.subVectors(out, chest);
  if (N.lengthSq() > reach * reach) out.copy(chest).addScaledVector(N.normalize(), reach);
  return out;
}

/* SEAT THE FOE'S BLADE — the clash registers a little before the steel touches (DUEL.clash.reach), so a foe's weapon that
   catches your cut is turned about its shoulder until the point of it that met yours lies ON yours: the blades visibly
   cross. `from` is the contact on the foe's blade, `to` the point on yours. */
const _sp = new THREE.Vector3(), _sr = new THREE.Vector3(), _st = new THREE.Vector3(), _sq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
function seatFoeBlade(e, from, to){
  const node = e.group.userData.weaponArm;   // (a staff turns about its middle, so it keeps where it is)
  if (!node || from.distanceToSquared(to) < 0.0009) return;
  node.updateWorldMatrix(true, false);
  node.getWorldPosition(_sp);
  _sr.subVectors(from, _sp); _st.subVectors(to, _sp);
  if (_sr.lengthSq() < 1e-4 || _st.lengthSq() < 1e-4) return;
  _sq.setFromUnitVectors(_sr.normalize(), _st.normalize());
  node.parent.getWorldQuaternion(_pq);
  node.quaternion.premultiply(_sq.premultiply(_pq.clone().invert()).multiply(_pq));
  node.updateWorldMatrix(true, false);
}

/* READY BLADES — called by sweepBlade with this frame's swept blade samples (flat x,y,z), before any body is struck.
   A foe holding a guard, or one mid-strike, has its weapon where your cut is going: if the blade passes within
   DUEL.clash.reach of it, the blades meet. A guard that holds (duelDefend's usual roll, so blocks are no more common
   than before) stops the cut dead and throws it back; a strike in flight clashes (both reel, nobody is hurt). A guard
   that fails lets the blade carry on through to the body. Returns true when the cut was stopped. */
export function meetBlades(sw, pts){
  if (sw.recoil) return false;
  const C = DUEL.clash, r2 = C.reach * C.reach, pp = playerPos();
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    if (sw.met && sw.met.has(e)) continue;
    const striking = e.state === 'strike' && !e.struck;
    if (!striking && !(isGuarding(e) && !sw.riposte && !sw.back)) continue;
    const g = e.group.position;
    if (Math.hypot(g.x - pp.x, g.z - pp.z) > 5) continue;
    if (!foeBlade(e, FB, FT)) continue;
    let hit = -1;
    for (let k = 0; k < pts.length; k += 3){
      Q.set(pts[k], pts[k + 1], pts[k + 2]);
      if (nearOnSeg(Q, FB, FT, N) < r2){ hit = k; break; }
    }
    if (hit < 0) continue;
    (sw.met || (sw.met = new Set())).add(e);
    const cp = Q.clone();   // (Q: the point on your blade that met theirs)
    seatFoeBlade(e, N, cp);
    if (striking){
      e.struck = true;   // its blow is spent on your blade
      if (bladeClash(g, e, cp)) return true;
      continue;
    }
    const isDark = isGunner() && player.weapon === 'darksaber';
    const res = duelDefend(e, cutLine(sw), sw.step === 2 ? 'finisher' : 'cut', G.stance === 'djemso' || isDark, cp);
    (sw.duel || (sw.duel = new Map())).set(e, res);
    if (res === 'block'){ bounceOff(e, cp); return true; }
  }
  return false;
}

/* THE BOUNCE — a guard turned the cut: it jars the arm, costs breath and breaks the string (DUEL.bounce), and the
   blade kicks back along the arc it came in on. `e` (optional) is the foe whose weapon caught it, knocked aside. */
export function bounceOff(e, cp){
  const B = DUEL.bounce;
  jarStamina(B.stam);
  player.swingLock = Math.max(player.swingLock || 0, B.lock);
  player.queuedAtk = false; player.comboStep = 2;
  if (cp) recoilSwing(cp);
  if (e){ knockWeapon(e, 0.5); if (cp) theirSparks(e, cp); }
}

/* RECOIL — the swing runs backwards a short way from where it met the other blade, then hands back to the guard
   (player/animation.js plays it). Sparks spit from the contact and the blades ring. */
export function recoilSwing(cp){
  const sw = player.swing;
  if (cp){
    clashSparks(cp, 0xffe9b0, 4);
    clashSparks(cp, stance().blade, 2);
    sfx(2400, 0.09, 'triangle', 0.035, 1500);   // the bright ring of blade on blade, over the clash
  }
  if (!sw || sw.recoil || player.atkT <= 0) return;
  const C = DUEL.clash;
  // a light blade snaps back off the other one, a heavy one is hauled back (Ataru quickest, Djem So and the darksaber slowest)
  sw.recoil = { t: 0, dur: C.recoil * formWeight(), from: sw.t, back: Math.min(sw.t, sw.dur * C.back) };
  sw.applied = true; player.queuedAtk = false;
  G.hitstop = Math.max(G.hitstop, C.hitstop);
}

/* how a form carries a clash, from its swing speed: < 1 for the light, quick forms, > 1 for the heavy ones. It scales
   the recoil's time, and (inverted) how far a clash throws you back: Djem So stands its ground, Ataru gives way. */
export function formWeight(){
  return Math.min(1.3, Math.max(0.8, 1 / Math.sqrt(stance().speed || 1)));
}

// both blades spit: a few sparks in the other weapon's own glow colour beside yours
export function theirSparks(e, cp){
  if (e && e.t && e.t.eye) clashSparks(cp, e.t.eye, 2);
}

// a foe's weapon is knocked back off yours: shoved up and out, and its guard/AI eases it home from there
export function knockWeapon(e, amt){
  const u = e.group.userData;
  if (u.staff){ u.staff.rotation.z += amt * 1.2; u.staff.rotation.x -= amt * 0.4; }
  else if (u.weaponArm){ u.weaponArm.rotation.x -= amt * 1.4; u.weaponArm.rotation.z += amt * 0.6; }
}

/* A foe's blow stopped on your held guard: its weapon bounces off yours where they met, and the strike is spent
   (enemies/ai.js ends it there instead of finishing the chop through your blade). */
export function blockedOnBlade(e){
  const cp = contactPoint(e);
  clashSparks(cp, 0xffe9b0, 4);
  knockWeapon(e, 0.6);
  e.st = Math.min(e.st, 0);
}

// the point on your own blade nearest `p` (into out); false with no blade in hand. A deflected bolt leaves from here.
export function bladePointNear(p, out){
  if (!bladeSegment(PB, PT)) return false;
  nearOnSeg(p, PB, PT, out);
  return true;
}
