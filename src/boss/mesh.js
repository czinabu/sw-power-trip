// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildBoss(): the boss models in the Ink style — Darth Vexis (the Jedi's boss) and the Iron Magistrate (the
// Mandalorian's). They wear the same trooper kit as the enemies (enemies/mesh.js), built 1.4x larger, so they read
// as the officers of that army.
//
// Hooks boss.js drives: bodyMat (hit flash, rage aura, windups) · pivot (weapon shoulder) · hand (weapon swing,
// rotation.z) · eyes (swell on windup) · the legs and vis (enemies/gait.js, see updateBoss).

import * as THREE from 'three';
import { glow } from '../engine/renderer.js';
import { loft, limb, plate, block, shard, chamfer, ngon, HEAD } from '../player/model/shapes.js';
import { bakeDesign, instantiate } from '../enemies/kit.js';
import { legs, hips, torso, pauldrons, sideArm, upper, cape, NECK, SOFT, SOFT_COLLAR, SOFT_LIMB, dome, cap } from '../enemies/mesh.js';

const PI = Math.PI;
const BODY = 1.4;   // the bosses are the trooper kit at 1.4x

const LOOKS = {
  sith:  { armor: 0x2a171d, armor2: 0x150b0f, suit: 0x0b0a0d, cloth: 0x0c0709, metal: 0x8a8f98, eye: 0xff2222, seam: 0xff2a3a, weapon: 0xff2222, aura: 0x8822cc },
  mando: { armor: 0x7f8fa3, armor2: 0x515a66, suit: 0x2b2f36, cloth: 0x7a5a32, metal: 0xb6bcc6, eye: 0xffc23a, seam: 0xffa646, weapon: 0xffaa33, aura: 0xff8a3a },
};

// a thin unlit trim line (the glowing seams the hero's Mando armour has)
const seam = (k, c, parent, p, size, r = [0,0,0]) => k.glow(new THREE.BoxGeometry(...size), c, parent, p, r);

function sith(k, L){
  let b = k.within(k.group(k.root, [0,0,0])); b.root.scale.setScalar(BODY);
  const w = 1.3;
  legs(b, w, { boot: 'armor2' }); hips(b, w);
  // long split robe over the legs
  b.add(loft([{ y:0.22, w:0.78, d:0.6 }, { y:0.62, w:0.66, d:0.48 }, { y:1.08, w:0.52, d:0.34 }], SOFT), 'cloth');
  b.add(plate([[-0.14,0.02],[0.14,0.02],[0.16,-0.82],[0,-0.9],[-0.16,-0.82]], 0.02, 0.006), 'armor2', b.root, [0, 1.06, 0.2], [-0.16, 0, 0]);
  b = upper(b);   // everything above the waist rides the chest (enemies/upper.js)
  torso(b, w, { box: false, pack: false });
  // spiked pauldrons over a heavy mantle
  b.add(loft([{ y:1.66, w:0.96, d:0.5 }, { y:1.84, w:0.72, d:0.42 }, { y:1.92, w:0.4, d:0.3 }], SOFT_COLLAR), 'cloth');
  pauldrons(b, w, 'armor', 1.2);
  for (const s of [-1, 1]){
    b.add(shard(0.06, 0.22, 0.06), 'metal', b.root, [0.52*s, 1.9, 0.06], [0, 0, -0.35*s]);
    b.add(shard(0.05, 0.16, 0.05), 'metal', b.root, [0.58*s, 1.86, -0.08], [0, 0, -0.6*s]);
  }
  // chest: control box, crimson seams
  b.add(block(0.18, 0.12, 0.04, 0.3), 'black', b.root, [0, 1.6, 0.19]);
  for (const s of [-1, 1]) seam(b, L.seam, b.root, [0.2*s, 1.58, 0.19], [0.008, 0.24, 0.008], [0, 0, 0.3*s]);
  seam(b, L.seam, b.root, [0, 1.12, 0.17], [0.28, 0.008, 0.008]);
  // cape from both shoulders to the ankles, streaming behind him as he comes (enemies/upper.js)
  cape(b, [[-0.44,0],[0.44,0],[0.56,-1.62],[0.2,-1.72],[-0.2,-1.72],[-0.56,-1.62]], [0, 1.86, -0.27], 0.08, 0.016);
  sideArm(b, w, -1, [-0.18, 0, 0.1]);
  // helm: a skull-like dome, a flared neck guard, a fanged breather, burning eye slits — under a raised hood
  const h = b.bone('head', b.root, [0, 1.95, 0], [0,0,0], NECK);
  b.add(loft([{ y:-0.04, w:0.15, d:0.15 }, { y:0.08, w:0.14, d:0.14 }], ngon(6, PI/6)), 'suit', h);
  b.add(dome([{ y:-0.02, w:0.27, d:0.28 }, { y:0.12, w:0.3, d:0.32 }, { y:0.27, w:0.3, d:0.32 }, { y:0.37, w:0.22, d:0.27 }, { y:0.42, w:0.1, d:0.16 }]), 'armor', h);
  b.add(loft([{ y:-0.08, w:0.44, d:0.36, z:-0.04 }, { y:0.08, w:0.32, d:0.3, z:-0.02 }], SOFT_COLLAR), 'armor2', h);   // neck guard
  b.add(loft([{ y:-0.06, w:0.12, d:0.06, z:0.0 }, { y:0.1, w:0.2, d:0.08, z:0.0 }], ngon(3, -PI/2)), 'armor2', h, [0, 0, 0.14]);   // breather
  for (const s of [-1, 1]) b.add(shard(0.04, 0.08, 0.03), 'metal', h, [0.04*s, 0.0, 0.16], [PI, 0, 0], { outline: false });
  b.add(loft([{ y:-0.02, w:0.46, d:0.44, z:-0.05 }, { y:0.22, w:0.42, d:0.42, z:-0.05 }, { y:0.42, w:0.3, d:0.36, z:-0.07 }, { y:0.5, w:0.12, d:0.18, z:-0.1 }], SOFT_COLLAR), 'cloth', h, [0, 0, -0.03]);
  const eyes = b.live(new THREE.Group(), h, 'eyes');
  for (const s of [-1, 1]){
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: L.eye, toneMapped: false }));
    m.position.set(0.065*s, 0.2, 0.165); m.rotation.z = -0.25*s; eyes.add(m);
  }
  return b;
}

function mando(k, L){
  let b = k.within(k.group(k.root, [0,0,0])); b.root.scale.setScalar(BODY);
  const w = 1.35;
  legs(b, w, { boot: 'armor2' }); hips(b, w);
  // bronze battle tabard, front and back
  b.add(plate([[-0.16,0.02],[0.16,0.02],[0.2,-0.6],[0,-0.7],[-0.2,-0.6]], 0.02, 0.006), 'cloth', b.root, [0, 1.06, 0.2], [-0.1, 0, 0], { outline: false });
  b.add(plate([[-0.28,0.02],[0.28,0.02],[0.34,-0.82],[0,-0.92],[-0.34,-0.82]], 0.02, 0.006), 'cloth', b.root, [0, 1.06, -0.2], [0.12, 0, 0], { outline: false });
  b = upper(b);
  torso(b, w, { box: false });
  // cuirass plates, keystone, glowing seams
  const pec = [[0.0,0.0],[0.2,0.02],[0.23,0.16],[0.18,0.23],[0.02,0.2]];
  b.add(plate(pec, 0.045, 0.014), 'armor', b.root, [0.015, 1.46, 0.18], [-0.06, 0.22, 0]);
  b.add(plate(pec.map(([x, y]) => [-x, y]).reverse(), 0.045, 0.014), 'armor', b.root, [-0.015, 1.46, 0.18], [-0.06, -0.22, 0]);
  b.add(shard(0.06, 0.13, 0.04), 'armor2', b.root, [0, 1.35, 0.2]);
  for (const s of [-1, 1]) seam(b, L.seam, b.root, [0.25*s, 1.6, 0.17], [0.008, 0.2, 0.008], [0, 0, 0.25*s]);
  seam(b, L.seam, b.root, [0, 1.21, 0.165], [0.3, 0.008, 0.008]);
  pauldrons(b, w, 'armor', 1.3);
  sideArm(b, w, -1, [-0.18, 0, 0.1]);
  // a war-cloak off the left shoulder, hanging clear of the pack's tank (Boba's way)
  cape(b, [[-0.14,0],[0.14,0],[0.2,-1.24],[0.04,-1.36],[-0.2,-1.28]], [-0.47, 1.86, -0.25], 0.1);
  // jetpack: core, twin domed tanks, nozzles with steady blue flames
  const jet = b.group(b.root, [0, 1.52, -0.32]);
  b.add(block(0.46, 0.6, 0.2, 0.3), 'suit', jet);
  for (const s of [-1, 1]){
    b.add(loft([{ y:-0.28, w:0.2, d:0.2 }, { y:0.22, w:0.2, d:0.2 }, { y:0.3, w:0.14, d:0.14 }, { y:0.36, w:0.05, d:0.05 }], ngon(8, PI/8)), 'armor2', jet, [0.22*s, 0, -0.04]);
    b.add(loft([{ y:-0.1, w:0.1, d:0.1 }, { y:0.08, w:0.18, d:0.18 }], ngon(8, PI/8)), 'metal', jet, [0.22*s, -0.38, -0.04], [PI, 0, 0]);
    b.glow(new THREE.CylinderGeometry(0.06, 0.11, 0.24, 8), 0x66ccff, jet, [0.22*s, -0.56, -0.04], [0,0,0], { opacity: 0.85 });
  }
  b.add(block(0.04, 0.5, 0.03, 0.3), 'cloth', jet, [0, 0, -0.11], [0,0,0], { outline: false });
  // helm: Mandalorian dome, T-visor, cheek flares, rangefinder
  const h = b.bone('head', b.root, [0, 1.95, 0], [0,0,0], NECK);
  b.add(loft([{ y:-0.04, w:0.15, d:0.15 }, { y:0.08, w:0.14, d:0.14 }], ngon(6, PI/6)), 'suit', h);
  b.add(dome([{ y:-0.02, w:0.27, d:0.29, z:0.005 }, { y:0.08, w:0.28, d:0.3, z:0.005 }, { y:0.24, w:0.3, d:0.32 }, { y:0.36, w:0.28, d:0.31 }, { y:0.43, w:0.21, d:0.25 }, { y:0.46, w:0.1, d:0.13 }]), 'armor', h);
  b.add(plate([[-0.125,0.03],[0.125,0.03],[0.132,-0.012],[0.032,-0.024],[0.03,-0.14],[-0.03,-0.14],[-0.032,-0.024],[-0.132,-0.012]], 0.02, 0.004), 'black', h, [0, 0.26, 0.152], [0,0,0], { outline: false });
  b.add(block(0.17, 0.06, 0.08, 0.4), 'armor2', h, [0, 0.03, 0.11]);
  for (const s of [-1, 1]) b.add(block(0.04, 0.09, 0.1, 0.35), 'armor2', h, [0.15*s, 0.2, 0]);
  b.add(block(0.022, 0.22, 0.03, 0.3), 'metal', h, [-0.17, 0.36, 0.01], [0, 0, 0.22]);
  const eyes = b.live(new THREE.Group(), h, 'eyes');
  const bar = (bw, bh, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.01), new THREE.MeshBasicMaterial({ color: L.eye, toneMapped: false })); m.position.set(0, y, 0.165); eyes.add(m); };
  bar(0.23, 0.014, 0.265); bar(0.014, 0.12, 0.2);
  return b;
}

// the weapon arm: shoulder pivot (pivot) → hand (hand, swings on rotation.z) → saber or war-spear
function weaponArm(k, L, kind){
  const pivot = k.slot('pivot', k.root, [0.75, 2.1, 0.1]);
  k.add(loft(cap(0.36, 0.36).map(c => ({ ...c, y: c.y * 1.4 })), SOFT), 'armor', pivot, [0.04, 0.32, -0.08], [0, 0, -0.32]);
  k.add(limb(0.5, [[-0.12,0.23,0.23],[0.1,0.22,0.22],[1,0.17,0.17]], SOFT_LIMB), 'suit', pivot, [0.02, 0.32, -0.08], [0, 0, -0.25]);
  k.add(block(0.2, 0.15, 0.21, 0.4), 'armor2', pivot, [-0.1, -0.2, -0.1]);
  const hand = k.slot('hand', pivot, [0, 0, 0], [0, 0, -0.6]);
  k.add(loft([{ y:-0.1, w:0.16, d:0.17 }, { y:0.0, w:0.18, d:0.19 }, { y:0.1, w:0.16, d:0.17 }], SOFT_LIMB), 'suit', hand);   // the gauntlet
  if (kind === 'sith'){
    k.add(loft([{ y:-0.14, w:0.07, d:0.07 }, { y:0.18, w:0.075, d:0.075 }, { y:0.2, w:0.095, d:0.095 }, { y:0.23, w:0.085, d:0.085 }], ngon(8, PI/8)), 'metal', hand);
    k.add(block(0.03, 0.05, 0.03, 0.3), 'armor2', hand, [0, 0.08, 0.045], [0,0,0], { outline: false });
  } else {
    // war-spear: a beskar haft through the fist and a broad spearhead past the glowing blade
    k.add(loft([{ y:-0.9, w:0.08, d:0.08 }, { y:0.25, w:0.08, d:0.08 }], ngon(6)), 'metal', hand);
    k.add(shard(0.12, 0.22, 0.12), 'metal', hand, [0, -0.9, 0], [PI, 0, 0]);
    k.add(plate([[-0.12,0],[0.12,0],[0.04,0.36],[0,0.44],[-0.04,0.36]], 0.03, 0.01), 'armor', hand, [0, 2.28, 0], [0, PI/2, 0]);
    for (const y of [0.16, -0.5]) k.add(block(0.11, 0.06, 0.11, 0.35), 'cloth', hand, [0, y, 0], [0,0,0], { outline: false });
  }
  // the blade itself stays exactly as before: white core, coloured glow, and its light
  const blade = k.glow(new THREE.CylinderGeometry(0.05, 0.035, 2.1, 8), 0xffffff, hand, [0, 1.25, 0]);
  blade.material.toneMapped = true;
  k.glow(new THREE.CylinderGeometry(0.13, 0.1, 2.15, 8), L.weapon, hand, [0, 1.25, 0], [0,0,0], { opacity: 0.5 });
  const sl = new THREE.PointLight(L.weapon, 5 * glow.light, 10); sl.position.y = 1.2; k.live(sl, hand);   // softer than before: cel bands blow out under a strong close light
}

export function buildBoss(kind){
  const L = LOOKS[kind === 'mando' ? 'mando' : 'sith'];
  const baked = bakeDesign('boss:' + kind, k => {
    // the weapon shoulder rides the chest too: a group there that undoes the body's scale, so the arm keeps its place
    const up = (kind === 'mando' ? mando : sith)(k, L);
    const arm = up.group(up.root); arm.scale.setScalar(1 / BODY);
    weaponArm(k.within(arm), L, kind);
    const aura = new THREE.PointLight(L.aura, 4, 14); aura.position.set(0, 0.25, 1.4); k.live(aura);   // pools on the floor in front of him
  }, { armor: L.armor, armor2: L.armor2, suit: L.suit, cloth: L.cloth, metal: L.metal });
  // like the troopers (enemies/mesh.js): the group carries place and heading, `vis` inside it takes the gait's bob and lean.
  // The trooper legs sit in the 1.4x body group, so enemies/gait.js is told how much bigger they are (legScale)
  const vis = instantiate(baked, { wear: 0.2 }), g = new THREE.Group();   // a warlord keeps his armour clean: battle-worn, not grimy
  g.rotation.order = 'YXZ';   // leans and the fall in his own frame, as the troopers (enemies/mesh.js)
  g.add(vis);
  g.userData = vis.userData;
  g.userData.armSwing = [0.55, 0];   // the free left arm swings with his stride (enemies/upper.js)
  g.userData.vis = vis; g.userData.legScale = BODY;
  g.scale.setScalar(1.35);
  return g;
}
