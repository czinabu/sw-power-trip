// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// spawnEnemy(), boss bars for big enemies, first-sighting tips.

import * as THREE from 'three';
import { ENEMY_TYPES } from '../data/enemies.js';
import { scene } from '../engine/renderer.js';
import { V3, rand } from '../utils.js';
import { G, enemies } from '../state.js';
import { buildEnemyMesh } from './mesh.js';
import { enemyHpScale, applyElite } from './elites.js';
import { attachHitboxDebug } from './bodyshape.js';
import { foeTipToast } from '../game/upgrades.js';
import { initDuel } from './duel.js';
import { foeType } from './look.js';

// a floating boss-style health bar for elite/mid-boss units, billboarded toward the camera each frame
export function makeBossBar(e){
  const grp = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.26),
    new THREE.MeshBasicMaterial({ color: 0x1a0306, transparent: true, opacity: 0.82, depthTest: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(2.26, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b, depthTest: false }));
  fill.position.z = 0.01;
  grp.add(bg, fill); grp.renderOrder = 999;
  scene.add(grp); e.hpBar = grp; e.hpBarFill = fill;
}
// FIRST-ENCOUNTER TIPS — the first time a notable foe shows up in a run, a one-line banner teaches its counter.
const TYPE_TIPS = {
  phalanx: ['SENTINEL', 'Its shield eats frontal fire — FLANK it, or break the guard with a finisher / heavy / RIPOSTE.'],
  bomber:  ['SABOTEUR', 'It rushes, then DETONATES — and blows on death. Kill it at range, PUSH it off, or DASH clear.'],
  sniper:  ['MARKSMAN', 'A laser marks you as it charges a hard shot. Break line of sight, DASH as it fires, or close in.'],
  brute:   ['BRUTE', 'A wall of muscle — too heavy to stagger lightly. Parry its swing, or floor it with a heavy blow.'],
  duelist: ['MAGNAGUARD', 'The pale arc shows the side it blocks. Cut the other side, or kick (E) twice to break its guard, then strike.'],
  acolyte: ['SITH ACOLYTE', 'A trained saber duellist. It feints, strings cuts, deflects blaster fire and binds blades. Read its guard, break it, punish the opening.'],
  officer: ['IMPERIAL OFFICER', 'It calls VOLLEYS and FLANKS for its squad. Hit it while its arm is up to cut the order off, and drop it to make its troops falter.'],
  grenadier: ['GRENADIER', 'It lobs detonators over cover. The ring is where it lands: get out before it fills. A Jedi can PUSH one back.'],
  lancer:  ['PURGE LANCER', 'From range it marks a line and LUNGES down it. Step off the line as it locks, or parry the point. A miss leaves it wide open.'],
  flyer:   ['JET TROOPER', 'It hovers out of saber reach. Pull or shove it down to bust its jetpack, blast it out of the sky, or deflect its fire.'],
};
function maybeTip(typeName){
  if (!G.seenTypes) G.seenTypes = {};
  if (G.seenTypes[typeName]) return;
  G.seenTypes[typeName] = true;
  const tip = TYPE_TIPS[typeName];
  if (tip && G.mode === 'play' && !G.training) foeTipToast(tip[0], tip[1]);   // in training the teacher explains it
}
let nextNid = 0;   // every foe's number, the same on both screens in co-op (net/foes.js)
export function spawnEnemy(typeName, pos){
  const t = ENEMY_TYPES[typeName];
  const nid = ++nextNid;
  const g = buildEnemyMesh(foeType(typeName), { seed: nid });   // (dressed as the mission has it: enemies/look.js) (its marking and face follow its number: the same on both co-op screens)
  g.position.copy(pos);
  scene.add(g);
  const hp = Math.round(t.hp * enemyHpScale());
  const e = {
    nid, type: typeName, t, group: g, hp, maxHp: hp, state: 'spawn', st: 0.5,
    vel: V3(0,0,0), flash: 0, hitCd: 0, dead: false,
    converted: false, convT: 0, struck: false, stumble: 0, burn: 0, flinch: 0,
    spd: t.speed * rand(0.88, 1.14),   // per-unit variance so crowds move organically
    elite: null,
    shieldHp: t.shield ? t.shieldHp : 0, shieldBroken: false,   // SENTINEL frontal guard
    aimLine: null,                                              // MARKSMAN laser sight (lazily built)
  };
  applyElite(e, g);
  attachHitboxDebug(e);   // ?hitbox draws it
  initDuel(e);   // sword-armed foes fight back: guards, feints, strings (duel.js)
  enemies.push(e);
  maybeTip(typeName);   // one-time onboarding tip the first time this archetype appears in a run
}
