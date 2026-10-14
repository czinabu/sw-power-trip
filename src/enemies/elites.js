// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Enemy HP scaling and elite traits.

import * as THREE from 'three';
import { S } from '../audio/sfx.js';
import { clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { shared, G, enemies, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { damageEnemy } from './damage.js';
import { damageBoss } from '../boss/boss.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { hurtPlayer } from '../player/damage.js';
import { diffHpMul } from '../data/difficulty.js';

// Enemies HARDEN as the run deepens so the army keeps pace with the player's
// compounding damage/lifesteal/streak power. Scales with cumulative waves cleared;
// tuned to sit just under a typical upgrade curve so fights stay tense, not brutal.
export function enemyHpScale(){
  const wt = G.waveTotal || 0;
  // CAMPAIGN: a gentle linear ramp. SURVIVAL: COMPOUNDS past wave ~5 so enemy HP keeps pace with the player's
  // snowballing (boons + repeatable power-ups multiply damage exponentially; a flat +5%/wave fell way behind).
  const s = G.endless ? (1 + wt*0.06) * Math.pow(1.05, Math.max(0, wt-5)) : (1 + wt*0.05);
  return s * (G.mut === 'ironhide' ? 1.4 : 1) * diffHpMul();   // DIFFICULTY scales enemy durability
}

/* ---------- ELITE MODIFIERS — variety on top of the base types ----------
   A rolled-in trait that re-skins an ordinary foe into a threat worth noticing:
   SWIFT close fast, VITAL soak punishment, VOLATILE detonate on death. Frequency
   ramps with run depth so early waves stay clean and late ones get spicy. */
export const ELITES = {
  swift:    { tint: 0x35e0ff, label: 'SWIFT',    spd: 1.5,  scale: 0.92, hp: 1.0 },
  vital:    { tint: 0x53ff8c, label: 'VITAL',    spd: 0.95, scale: 1.16, hp: 1.9 },
  volatile: { tint: 0xff7a2a, label: 'VOLATILE', spd: 1.1,  scale: 1.0,  hp: 1.0 },
};
const ELITE_KEYS = Object.keys(ELITES);
export function eliteChance(){ return clamp(((G.waveTotal || 0) - 2) * (G.endless ? 0.05 : 0.04), 0, G.endless ? 0.55 : 0.3); }   // survival floods with elites late
const _eliteCol = new THREE.Color();
export function applyElite(e, g){
  if (Math.random() > (G.eliteSurge ? 0.85 : eliteChance())) return;   // survival ELITE SURGE: nearly everything comes elite
  const id = ELITE_KEYS[(Math.random()*ELITE_KEYS.length)|0];
  const m = ELITES[id];
  e.elite = id;
  e.hp = Math.round(e.hp * m.hp); e.maxHp = e.hp;
  e.spd *= m.spd;
  g.scale.multiplyScalar(m.scale);
  g.userData.bodyMat.color.lerp(_eliteCol.setHex(m.tint), 0.5);   // armor takes the trait's hue
  // a slowly spinning additive halo at the feet — reads instantly as "this one is special"
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 24),
    new THREE.MeshBasicMaterial({ color: m.tint, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = Math.PI/2; ring.position.y = 0.08;
  g.add(ring); g.userData.eliteRing = ring;
}
// VOLATILE death blast — a contained barrel-style detonation that hits foes, the boss, and a nearby player
export function volatileBlast(pos, source){
  burst(pos, 0xff7722, 18, 10, 7); burst(pos, 0xffd755, 10, 7, 5);
  spawnGroundShock(pos.clone(), 0xff8a3a, 5, 0.5, 0.6);
  G.shake = Math.max(G.shake, 0.6); G.hitstop = Math.max(G.hitstop, 0.04);
  S.boom();
  for (const o of enemies){
    if (o === source || o.dead) continue;
    if (o.group.position.distanceTo(pos) < 5)
      damageEnemy(o, 45, o.group.position.clone().sub(pos).setY(0).normalize(), 18);
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pos) < 5) damageBoss(30);
  const pp = playerPos();
  if (pp.distanceTo(pos) < 4.5 && player.dashT <= 0) hurtPlayer(16, pos);
}
