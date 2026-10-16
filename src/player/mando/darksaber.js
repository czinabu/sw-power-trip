// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Darksaber.

import { sfx, S } from '../../audio/sfx.js';
import { V3, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, player } from '../../state.js';
import { MANDO } from '../../data/mando.js';
import { fwd, playerPos } from '../helpers.js';
import { inReach } from '../../enemies/bodyshape.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss, bossStagger } from '../../boss/boss.js';
import { spawnHitSpark } from '../../fx/vfx.js';
import { clashFlash } from '../../fx/ink.js';
import { aCost } from './weapons.js';

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
  if (player.darkT <= 0){
    if (player.darkT !== 0) player.darkT = 0;   // never leave it slightly negative (that used to disable jetpack/flame)
    if (player.darksaberMesh && player.weapon !== 'darksaber' && player.darksaberMesh.visible && player.cds.dark < MANDO.dark.cd - 0.25) player.darksaberMesh.visible = false;
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
