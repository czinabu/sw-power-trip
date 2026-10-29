// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Darksaber.

import * as THREE from 'three';
import { scene } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, player } from '../../state.js';
import { collideSolids, groundAt } from '../../world/collision.js';
import { MANDO } from '../../data/mando.js';
import { fwd, playerPos } from '../helpers.js';
import { inReach, distToBody } from '../../enemies/bodyshape.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss, bossStagger } from '../../boss/boss.js';
import { spawnHitSpark } from '../../fx/vfx.js';
import { clashFlash } from '../../fx/ink.js';
import { aCost, mandoAimPoint } from './weapons.js';
import { scarBody, severArm } from '../../enemies/scars.js';

/* THE DARKSABER — the Mando's earned melee: a heavy arc-slash that cleaves the front, deflects bolts,
   and shatters a boss wind-up. Drawn only for the swing. */
export const DARK_DUR = 0.42;
function darksaberSlash(){
  if (G.mode !== 'play' || G.hero !== 'mando' || !player.up.darksaber) return;
  if (player.cds.dark > 0 || player.darkT > 0 || player.force < aCost(MANDO.dark.cost)) return;
  player.force -= aCost(MANDO.dark.cost); player.cds.dark = MANDO.dark.cd;
  player.darkT = DARK_DUR; player.darkApplied = false; player.aiming = 0.6;
  if (player.darksaberMesh) player.darksaberMesh.visible = true;
  player.vel.addScaledVector(fwd(), 6.5);   // lunge into the cut
  S.swing('dark'); sfx(70, 0.22, 'sine', 0.1, 38);
}
export function updateDark(dt){
  if (player.darkLight) player.darkLight.intensity = player.darkT > 0 ? 6 : 0;
  updateDarkThrow(dt);
  if (player.darkT <= 0){
    if (player.darkT !== 0) player.darkT = 0;   // never leave it slightly negative (that used to disable jetpack/flame)
    if (player.darksaberMesh && player.weapon !== 'darksaber' && !shared.darkProj && !(player.weapon === 'fists' && player.drawnWeapon === 'darksaber') && player.darksaberMesh.visible && player.cds.dark < MANDO.dark.cd - 0.25) player.darksaberMesh.visible = false;
    return;
  }
  player.darkT -= dt;
  const A = MANDO.dark, pp = playerPos(), f = fwd();
  // deflect incoming bolts back during the swing — the darksaber answers blaster fire
  for (const b of bolts){
    if (b.friendly) continue;
    if (b.mesh.position.distanceTo(V3(pp.x, b.mesh.position.y, pp.z)) < 2.8){
      b.friendly = true; b.dir.set(f.x, 0, f.z).normalize(); b.dmg = 34; b.speed *= 1.3; b.mesh.material.color.setHex(0xb98cff);
      clashFlash(b.mesh.position.clone(), 0xc9a6ff, false); S.deflect(b.mesh.position);
    }
  }
  // the cut lands just past the apex
  if (!player.darkApplied && player.darkT < DARK_DUR*0.55){
    player.darkApplied = true;
    const cpt = V3(pp.x + f.x*1.7, 1.5, pp.z + f.z*1.7);
    burst(cpt, 0xb98cff, 18, 11, 5, 1.1); burst(cpt, 0xffffff, 8, 13, 4);
    spawnHitSpark(cpt, 0xc9a6ff, 1.5);
    screenFlash('radial-gradient(ellipse at center, rgba(150,90,255,.3), transparent 60%)', 0.5, 0.25);
    G.shake = Math.max(G.shake, 0.55); G.hitstop = Math.max(G.hitstop, 0.07);
    const cosLim = Math.cos(A.arc);
    for (const e of enemies){
      if (e.dead || e.converted || e.state === 'spawn') continue;
      TMP.subVectors(e.group.position, pp); TMP.y = 0;
      const d = TMP.length();
      if (!inReach(e, pp, A.range, d > 0.4 ? f : null, cosLim)) continue;   // the slash reaches any of the body in its arc
      TMP.normalize();
      damageEnemy(e, A.dmg * player.up.dmg, TMP.clone(), A.knock); flinchEnemy(e, f, 0.9);
      scarBody(e.group, f, 'left', true);   // a darksaber sweep burns its line across the plates (enemies/scars.js)
      if (e.dead) severArm(e, f, 0.4);
    }
    if (shared.boss && shared.boss.hp > 0){
      TMP.subVectors(shared.boss.group.position, pp); TMP.y = 0;
      if (TMP.length() < A.range + 1){
        damageBoss(A.dmg * player.up.dmg);
        if (shared.boss.hp > 0 && (shared.boss.state === 'windup' || shared.boss.state === 'lightning' || shared.boss.state === 'chase')) bossStagger();
      }
    }
  }
}

/* DARKSABER THROW (RMB + LMB) — the blade leaves the hand spinning flat along the aim and cuts everything it passes.
   At the end of its flight (or the first wall) the gauntlet fires the grappling line, latches the hilt and reels it
   home, cutting again on the way back. The real blade mesh flies: it's lifted off the hand socket into the scene and
   put back exactly where it was when it's caught. Nothing to swing or guard with until then. */
const _dq = new THREE.Quaternion(), _de = new THREE.Euler(0, 0, 0, 'YXZ'), _dmid = new THREE.Vector3();
const BLADE_MID = 0.62;   // the blade spins about its middle, not the hilt
function darkHand(){ const pp = playerPos(); return V3(pp.x, pp.y + 1.45, pp.z); }
function darkLine(){
  if (!shared._darkLine){
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    shared._darkLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xbfe8ff }));
    shared._darkLine.frustumCulled = false; shared._darkLine.visible = false; scene.add(shared._darkLine);
  }
  return shared._darkLine;
}
export function darksaberThrow(){
  const A = MANDO.darkThrow, m = player.darksaberMesh;
  if (G.mode !== 'play' || G.hero !== 'mando' || !player.up.darksaber || player.weapon !== 'darksaber' || !m) return;
  if (shared.darkProj || player.cds.darkThrow > 0 || player.darkT > 0 || player.atkT > 0) return;
  if (player.force < aCost(A.cost)){ if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO POWER', '#ff9a66'); } return; }
  player.force -= aCost(A.cost); player.cds.darkThrow = A.cd; player.aiming = 0.6;
  player.blockHeld = false; player.parryT = 0;   // the guard goes with the blade
  const o = darkHand(), aim = mandoAimPoint();
  const dir = V3(aim.x - o.x, aim.y - o.y, aim.z - o.z);
  if (dir.lengthSq() < 0.01) dir.copy(fwd());
  dir.normalize();   // straight down the reticle: up at a jetpacker, down onto a foe below
  const home = { parent: m.parent, pos: m.position.clone(), quat: m.quaternion.clone(), scale: m.scale.clone() };
  scene.attach(m); m.visible = true;
  if (player.darkLight) player.darkLight.intensity = 6;
  shared.darkProj = { mesh: m, home, pos: o.clone().addScaledVector(dir, 0.8), dir, phase: 'out', t: 0, traveled: 0, spin: 0, hitSet: new Set() };
  S.swing('dark'); sfx(70, 0.22, 'sine', 0.1, 38); sfx(140, 0.3, 'sawtooth', 0.04, 60);
  floater(playerPos(), 'DARKSABER', '#c9a6ff');
}
// put the blade back in the hand (a catch, or a level reset)
export function catchDarksaber(quiet){
  const dp = shared.darkProj; if (!dp) return;
  const m = dp.mesh, h = dp.home;
  if (h.parent){ h.parent.add(m); m.position.copy(h.pos); m.quaternion.copy(h.quat); m.scale.copy(h.scale); }
  m.visible = G.hero === 'mando' && player.weapon === 'darksaber';
  shared.darkProj = null;
  if (shared._darkLine) shared._darkLine.visible = false;
  if (!quiet){ sfx(900, 0.05, 'square', 0.04, 420); sfx(60, 0.18, 'sine', 0.08, 40); G.shake = Math.max(G.shake, 0.2); }
}
function darkCut(dp){
  const A = MANDO.darkThrow, p = dp.pos;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || dp.hitSet.has(e)) continue;
    if (distToBody(e, p) < 1.1){
      dp.hitSet.add(e);
      // going out it knocks them along its flight; coming back it drags them a step toward you
      const kd = dp.phase === 'reel' ? TMP.set(dp.dir.x, 0, dp.dir.z).negate().normalize().clone() : TMP.set(dp.dir.x, 0, dp.dir.z).normalize().clone();
      damageEnemy(e, A.dmg * player.up.dmg, kd, A.knock); flinchEnemy(e, kd, 0.7);
      scarBody(e.group, kd, 'left', false);
      spawnHitSpark(p.clone(), 0xc9a6ff, 1.1); S.saberHit(p, 1);
    }
  }
  if (shared.boss && shared.boss.hp > 0 && !dp.hitSet.has(shared.boss) && p.distanceTo(shared.boss.group.position.clone().setY(p.y)) < 2.2 && p.y < shared.boss.group.position.y + 4.2){
    dp.hitSet.add(shared.boss); damageBoss(A.dmg * player.up.dmg);
  }
}
function updateDarkThrow(dt){
  const dp = shared.darkProj; if (!dp) return;
  if (G.hero !== 'mando'){ catchDarksaber(true); return; }
  const A = MANDO.darkThrow, line = darkLine(), hand = darkHand();
  dp.t += dt;
  if (dp.phase === 'out'){
    const step = A.speed * dt;
    dp.pos.addScaledVector(dp.dir, step); dp.traveled += step;
    _dmid.copy(dp.pos); collideSolids(_dmid, 0.25, false);
    const floor = groundAt(dp.pos.x, dp.pos.z, Infinity) + 0.4;   // thrown down at the deck, it latches where it lands
    const wall = _dmid.distanceToSquared(dp.pos) > 1e-6 || dp.pos.y < floor;
    if (wall){ dp.pos.copy(_dmid); dp.pos.y = Math.max(floor, dp.pos.y); spawnHitSpark(dp.pos.clone(), 0xe7dcff, 0.9); sfx(1400, 0.05, 'square', 0.04, 600); }
    darkCut(dp);
    if (wall || dp.traveled >= A.range){ dp.phase = 'latch'; dp.t = 0; S.dash(); sfx(900, 0.06, 'square', 0.05, 320); }   // fire the line
  } else if (dp.phase === 'latch'){
    if (dp.t >= A.latch){ dp.phase = 'reel'; dp.t = 0; dp.hitSet.clear(); sfx(160, 0.12, 'sawtooth', 0.06, 70); }
  } else {
    TMP.subVectors(hand, dp.pos); const d = TMP.length();
    if (d < 1.2 || dp.t > 2.5){ catchDarksaber(false); return; }
    TMP.multiplyScalar(1 / d); dp.dir.copy(TMP).negate();   // dir points away from the hand, so a cut on the way back drags toward you
    dp.pos.addScaledVector(TMP, Math.min(d, A.reelSpeed * dt));
    darkCut(dp);
  }
  // spin flat about the blade's middle (faster in flight, a lazy turn while the line flies out to it)
  dp.spin += dt * (dp.phase === 'latch' ? 8 : 24);
  _de.set(Math.PI / 2, dp.spin, 0); _dq.setFromEuler(_de);
  dp.mesh.quaternion.copy(_dq);
  _dmid.set(0, BLADE_MID, 0).applyQuaternion(_dq).multiply(dp.mesh.scale);
  dp.mesh.position.copy(dp.pos).sub(_dmid);
  if (player.darkLight) player.darkLight.intensity = 6;
  // the grappling line: shoots out to the hilt during the latch, then stays taut while it reels in
  const a = line.geometry.attributes.position;
  if (dp.phase === 'out'){ line.visible = false; }
  else {
    line.visible = true;
    const k = dp.phase === 'latch' ? Math.min(1, dp.t / A.latch) : 1;
    a.setXYZ(0, hand.x, hand.y, hand.z);
    a.setXYZ(1, hand.x + (dp.pos.x - hand.x) * k, hand.y + (dp.pos.y - hand.y) * k, hand.z + (dp.pos.z - hand.z) * k);
    a.needsUpdate = true;
  }
}
