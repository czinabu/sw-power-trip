// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildEnemyMesh(): the enemy troopers, drawn in the heroes' Ink style (see kit.js for how they're baked).
//
// Each ENEMY_TYPES entry names a MODEL below. A model is a design function that dresses one trooper; the
// unit's armour colour (t.color), eye colour (t.eye) and flags (heavy, ranged, weapon, staff, shield, fly, bomber,
// sniper) pick the details. Models are pure looks: hit ranges, speeds and AI never read the mesh.
//
// The hooks the game drives (ai.js, damage.js, elites.js) are the same as before:
//   bodyMat (armour: hit flash, windup glow, elite tint) · eye + eyeBase (swells on windup) · weaponArm (sword/maul
//   swing, pivots at the shoulder) · staff · shield + shieldMat · bombCore · thrusters[]

import * as THREE from 'three';
import { loft, limb, plate, block, shard, chamfer, ngon, KEEL, SHIELD, HEAD } from '../player/model/shapes.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeDesign, instantiate } from './kit.js';

const PI = Math.PI;
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const scalePts = (pts, s) => pts.map(([x, y]) => [x * s, y * s]);
const BOOT = [[-0.075,0.035],[-0.09,-0.075],[0.16,-0.085],[0.21,-0.05],[0.1,0.0],[0.03,0.04]];

/* ---------------- shared trooper body ----------------
   Ground at y 0, facing +z. The weapon arm hangs from the +x shoulder (0.42w, 1.74), as it always has. */

export function legs(k, w, o = {}){
  const shin = o.shin || 'armor';
  for (const s of [-1, 1]){
    const x = 0.16 * s;
    k.add(limb(0.5, [[-0.04,0.21*w,0.22],[0.2,0.2*w,0.2],[0.8,0.15*w,0.16],[1,0.14*w,0.15]], KEEL), 'suit', k.root, [x, 0.94, 0]);
    k.add(plate([[-0.08,0],[0.08,0],[0.085,-0.22],[0,-0.27],[-0.085,-0.22]], 0.03, 0.01), 'armor', k.root, [x, 0.9, 0.1], [-0.06, 0, 0], { scale: [w, 1, 1] });
    k.add(block(0.15*w, 0.1, 0.15, 0.4), 'armor2', k.root, [x, 0.46, 0.035]);
    k.add(limb(0.38, [[0,0.15*w,0.16],[0.25,0.17*w,0.18],[0.85,0.13*w,0.14],[1,0.125*w,0.135]], KEEL), shin, k.root, [x, 0.46, 0.01]);
    k.add(plate(scalePts(BOOT, 1.15), 0.13*w, 0.014), o.boot || 'suit', k.root, [x, 0.1, 0], [0, -PI/2, 0]);
  }
}

export function hips(k, w){
  k.add(loft([{ y:0.84, w:0.38*w, d:0.26 }, { y:0.98, w:0.44*w, d:0.29 }, { y:1.08, w:0.4*w, d:0.27 }], SHIELD), 'suit');
  k.add(loft([{ y:1.0, w:0.47*w, d:0.31 }, { y:1.1, w:0.46*w, d:0.305 }], SHIELD), 'armor2');
  k.add(plate([[-0.06,-0.04],[0.06,-0.04],[0.06,0.04],[-0.06,0.04]], 0.02, 0.006), 'metal', k.root, [0, 1.05, 0.16], [0,0,0], { outline: false });
  k.add(plate([[-0.08,0],[0.08,0],[0.05,-0.15],[-0.05,-0.15]], 0.025, 0.008), 'armor', k.root, [0, 0.98, 0.14], [-0.1, 0, 0]);
  for (const s of [-1, 1]) k.add(block(0.08, 0.1, 0.07, 0.3), 'black', k.root, [0.2*w*s, 1.04, 0.1], [0, 0.3*s, 0], { outline: false });   // belt pouches
}

export function torso(k, w, o = {}){
  k.add(loft([{ y:1.07, w:0.36*w, d:0.24 }, { y:1.33, w:0.38*w, d:0.25 }], SHIELD), 'suit');
  const ab = plate([[-0.12,-0.035],[0.12,-0.035],[0.13,0.03],[-0.13,0.03]], 0.026, 0.008);
  k.add(ab, 'armor2', k.root, [0, 1.17, 0.125], [0.04, 0, 0], { scale: [w, 1, 1] });
  k.add(ab, 'armor2', k.root, [0, 1.25, 0.13], [0.06, 0, 0], { scale: [w * 1.06, 1, 1] });
  k.add(loft([{ y:1.3, w:0.42*w, d:0.28 }, { y:1.48, w:0.6*w, d:0.36 }, { y:1.7, w:0.64*w, d:0.36 }, { y:1.82, w:0.48*w, d:0.3 }, { y:1.88, w:0.28, d:0.22 }], SHIELD), 'armor');
  // chest detail: a centre seam, a control box, and the backpack
  k.add(block(0.03, 0.26, 0.03, 0.3), 'armor2', k.root, [0, 1.58, 0.185], [0,0,0], { outline: false });
  if (o.box !== false) k.add(block(0.13, 0.07, 0.04, 0.3), 'black', k.root, [0.12*w, 1.62, 0.18], [0,0,0], { outline: false });
  if (o.pack !== false) k.add(block(0.38*w, 0.42, 0.16, 0.3), 'suit', k.root, [0, 1.55, -0.23]);
  k.add(loft([{ y:1.83, w:0.28, d:0.22 }, { y:1.98, w:0.18, d:0.16 }], chamfer(0.45)), 'suit');   // gorget
}

export function pauldrons(k, w, key = 'armor', size = 1){
  for (const s of [-1, 1]){
    k.add(loft([{ y:-0.08, w:0.24*w*size, d:0.24*size }, { y:0.03, w:0.23*w*size, d:0.23*size }, { y:0.09, w:0.15*w*size, d:0.17*size }], chamfer(0.42)),
      key, k.root, [0.39*w*s, 1.8, 0], [0, 0, -0.32*s]);
  }
}

/* an arm hanging from `parent`'s origin: upper, elbow (its own group so it can bend), forearm, glove.
   Returns the grip group (centre of the fist) for a held weapon. */
export function arm(k, parent, w, o = {}){
  k.add(limb(0.4, [[-0.06,0.15*w,0.15],[0.1,0.15*w,0.15],[1,0.115*w,0.115]], chamfer(0.4)), 'suit', parent);
  const el = k.group(parent, [0, -0.41, 0], [o.bend || 0, 0, 0]);
  k.add(block(0.13*w, 0.1, 0.14, 0.4), 'armor2', el, [0, 0, 0.01]);
  k.add(limb(0.3, [[0,0.13*w,0.13],[0.6,0.135*w,0.13],[1,0.105*w,0.1]], KEEL), o.fore || 'armor', el, [0, -0.02, 0.005]);
  k.add(block(0.12*w, 0.13, 0.13, 0.35), 'suit', el, [0, -0.38, 0.02]);
  return k.group(el, [0, -0.38, 0.03]);
}
// a static arm from the left (-x) or right (+x) shoulder; rot = [forward lift (negative = forward), twist, outward splay
// (negative = across the body)], mirrored for the side
export function sideArm(k, w, s, rot = [0, 0, 0], o){
  const sh = k.group(k.root, [0.42*w*s, 1.74, 0], [rot[0], rot[1]*s, (0.12 + rot[2])*s]);
  return arm(k, sh, w, o);
}

// an arm from a shoulder that lands its fist on `target` (body space): a two-bone solve, elbow hanging down
const UPPER = 0.41, FORE = 0.38;
function reachArm(k, w, s, target, o = {}){
  const sp = new THREE.Vector3(0.42*w*s, 1.74, 0);
  const dir = new THREE.Vector3(...target).sub(sp);
  const d = Math.min(dir.length(), UPPER + FORE - 0.01);
  dir.normalize();
  const a = Math.acos((UPPER*UPPER + d*d - FORE*FORE) / (2*UPPER*d));      // shoulder: upper arm off the line
  const b = Math.PI - Math.acos((UPPER*UPPER + FORE*FORE - d*d) / (2*UPPER*FORE));   // elbow bend
  const sh = k.group(k.root, sp.toArray());
  sh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (o.twist || 0) * s))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a));
  return arm(k, sh, w, { ...o, bend: -b });
}

/* ---------------- helmets (built on a neck group at y 1.96) ---------------- */

const HELMETS = {
  // PURGE TROOPER: tall angular helm, swept faceplate, one burning visor slit, centre crest
  purge(k, h, t){
    k.add(loft([{ y:-0.02, w:0.25, d:0.27 }, { y:0.12, w:0.29, d:0.31 }, { y:0.28, w:0.28, d:0.31 }, { y:0.37, w:0.2, d:0.27 }, { y:0.42, w:0.08, d:0.2 }], HEAD), 'armor', h);
    k.add(loft([{ y:-0.04, w:0.22, d:0.08, z:0.13 }, { y:0.16, w:0.27, d:0.08, z:0.15 }], chamfer(0.3)), 'armor2', h);
    k.add(block(0.24, 0.05, 0.05, 0.3), 'black', h, [0, 0.19, 0.17], [0,0,0], { outline: false });
    k.add(block(0.035, 0.24, 0.34, 0.3), 'armor2', h, [0, 0.36, -0.01]);
    for (const s of [-1, 1]) k.add(block(0.03, 0.14, 0.12, 0.3), 'black', h, [0.135*s, 0.06, 0.08], [0, 0.3*s, 0], { outline: false });
    k.glow(new THREE.BoxGeometry(0.22, 0.035, 0.03), t.eye, h, [0, 0.19, 0.19], [0,0,0], { tag: 'eye' });
  },
  // STORMTROOPER: domed helm, brow ridge, teardrop lenses, frowning breather, ear caps
  storm(k, h, t){
    k.add(loft([{ y:-0.02, w:0.25, d:0.26 }, { y:0.08, w:0.3, d:0.31 }, { y:0.22, w:0.31, d:0.31 }, { y:0.33, w:0.27, d:0.28 }, { y:0.4, w:0.15, d:0.17 }], HEAD), 'armor', h);
    k.add(block(0.29, 0.04, 0.06, 0.3), 'armor2', h, [0, 0.27, 0.13], [-0.2, 0, 0]);
    k.add(loft([{ y:-0.03, w:0.16, d:0.1, z:0.14 }, { y:0.1, w:0.12, d:0.08, z:0.13 }], chamfer(0.4)), 'armor', h);
    k.add(plate([[-0.06,0.01],[0.06,0.01],[0.04,-0.04],[-0.04,-0.04]], 0.015, 0.004), 'black', h, [0, 0.05, 0.19], [0,0,0], { outline: false });
    for (const s of [-1, 1]) k.add(loft([{ y:-0.03, w:0.07, d:0.07 }, { y:0.03, w:0.06, d:0.06 }], ngon(8, PI/8)), 'armor2', h, [0.155*s, 0.15, 0], [0, 0, PI/2]);
    const eyes = k.live(new THREE.Group(), h, 'eye');
    const lens = plate([[-0.045,0.025],[0.04,0.025],[0.05,-0.005],[0.01,-0.04],[-0.035,-0.02]], 0.01, 0);
    for (const s of [-1, 1]){
      const m = new THREE.Mesh(lens, new THREE.MeshBasicMaterial({ color: t.eye, toneMapped: false }));
      m.position.set(0.065*s, 0.19, 0.155); m.rotation.set(0, 0.35*s, 0); m.scale.x = s; eyes.add(m);
    }
  },
  // HEAVY: wide squat helm with a grilled faceplate and a deep visor slot
  heavy(k, h, t){
    k.add(loft([{ y:-0.04, w:0.33, d:0.33 }, { y:0.16, w:0.36, d:0.36 }, { y:0.28, w:0.31, d:0.33 }, { y:0.35, w:0.18, d:0.22 }], HEAD), 'armor', h);
    k.add(loft([{ y:-0.06, w:0.28, d:0.09, z:0.15 }, { y:0.15, w:0.3, d:0.09, z:0.16 }], chamfer(0.25)), 'armor2', h);
    for (let i = 0; i < 3; i++) k.add(block(0.2, 0.018, 0.02, 0.2), 'black', h, [0, -0.02 + i*0.04, 0.21], [0,0,0], { outline: false });
    k.add(block(0.26, 0.05, 0.05, 0.3), 'black', h, [0, 0.19, 0.2], [0,0,0], { outline: false });
    k.add(block(0.06, 0.16, 0.3, 0.3), 'armor2', h, [0, 0.33, -0.02]);
    k.glow(new THREE.BoxGeometry(0.24, 0.035, 0.03), t.eye, h, [0, 0.19, 0.22], [0,0,0], { tag: 'eye' });
  },
  // MAGNAGUARD: narrow droid skull, twin eyes, a wrapped cowl
  magna(k, h, t){
    k.add(loft([{ y:0.0, w:0.17, d:0.19 }, { y:0.18, w:0.21, d:0.24 }, { y:0.3, w:0.18, d:0.22 }, { y:0.36, w:0.1, d:0.14 }], HEAD), 'armor', h);
    k.add(block(0.14, 0.08, 0.06, 0.3), 'black', h, [0, 0.07, 0.1], [0,0,0], { outline: false });
    k.add(loft([{ y:-0.08, w:0.4, d:0.36 }, { y:0.06, w:0.32, d:0.3 }, { y:0.16, w:0.26, d:0.27, z:-0.02 }, { y:0.3, w:0.2, d:0.22, z:-0.04 }], chamfer(0.45)), 'cloth', h, [0, 0, -0.02]);
    const eyes = k.live(new THREE.Group(), h, 'eye');
    for (const s of [-1, 1]){
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), new THREE.MeshBasicMaterial({ color: t.eye, toneMapped: false }));
      m.position.set(0.045*s, 0.19, 0.115); eyes.add(m);
    }
  },
  // JET TROOPER: rounded helm, T-visor, a rangefinder stalk
  jet(k, h, t){
    k.add(loft([{ y:-0.02, w:0.25, d:0.26 }, { y:0.08, w:0.29, d:0.3 }, { y:0.22, w:0.3, d:0.31 }, { y:0.33, w:0.27, d:0.28 }, { y:0.4, w:0.14, d:0.16 }], HEAD), 'armor', h);
    k.add(loft([{ y:-0.03, w:0.18, d:0.1, z:0.12 }, { y:0.1, w:0.2, d:0.08, z:0.13 }], chamfer(0.4)), 'armor2', h);
    k.add(plate([[-0.11,0.025],[0.11,0.025],[0.11,-0.012],[0.025,-0.02],[0.022,-0.12],[-0.022,-0.12],[-0.025,-0.02],[-0.11,-0.012]], 0.02, 0.004), 'black', h, [0, 0.21, 0.15], [0,0,0], { outline: false });
    const eyes = k.live(new THREE.Group(), h, 'eye');
    const bar = (w2, h2, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 0.01), new THREE.MeshBasicMaterial({ color: t.eye, toneMapped: false })); m.position.set(0, y, 0.165); eyes.add(m); };
    bar(0.19, 0.012, 0.215); bar(0.012, 0.1, 0.16);
    k.add(block(0.025, 0.2, 0.025, 0.3), 'metal', h, [-0.16, 0.3, 0.02], [0.3, 0, 0.1]);
    k.add(block(0.05, 0.035, 0.06, 0.3), 'armor2', h, [-0.16, 0.39, 0.06]);
  },
  // SHORETROOPER: domed helm under a wide brim, dark visor band
  riot(k, h, t){
    k.add(loft([{ y:-0.02, w:0.26, d:0.27 }, { y:0.1, w:0.3, d:0.31 }, { y:0.24, w:0.3, d:0.31 }, { y:0.34, w:0.25, d:0.27 }, { y:0.4, w:0.12, d:0.14 }], HEAD), 'armor', h);
    k.add(loft([{ y:0.0, w:0.4, d:0.42, z:0.02 }, { y:0.03, w:0.38, d:0.4, z:0.02 }], chamfer(0.5)), 'armor2', h, [0, 0.24, 0]);
    k.add(plate([[-0.12,0.03],[0.12,0.03],[0.1,-0.03],[-0.1,-0.03]], 0.02, 0.004), 'black', h, [0, 0.18, 0.15], [0,0,0], { outline: false });
    k.add(loft([{ y:-0.04, w:0.17, d:0.1, z:0.12 }, { y:0.1, w:0.15, d:0.08, z:0.13 }], chamfer(0.4)), 'armor', h);
    k.glow(new THREE.BoxGeometry(0.2, 0.02, 0.01), t.eye, h, [0, 0.18, 0.168], [0,0,0], { tag: 'eye' });
  },
  // SCOUT TROOPER: big brow visor jutting forward, a long breather snout
  scout(k, h, t){
    k.add(loft([{ y:0.0, w:0.24, d:0.25 }, { y:0.14, w:0.27, d:0.28 }, { y:0.3, w:0.26, d:0.28 }, { y:0.38, w:0.14, d:0.17 }], HEAD), 'armor', h);
    k.add(loft([{ y:0.0, w:0.3, d:0.14, z:0.12 }, { y:0.1, w:0.32, d:0.17, z:0.14 }], chamfer(0.35)), 'armor2', h, [0, 0.17, 0]);
    k.add(loft([{ y:-0.06, w:0.1, d:0.12, z:0.15 }, { y:0.14, w:0.14, d:0.12, z:0.12 }], chamfer(0.4)), 'armor', h);
    k.add(block(0.27, 0.045, 0.05, 0.3), 'black', h, [0, 0.2, 0.24], [0,0,0], { outline: false });
    k.glow(new THREE.BoxGeometry(0.24, 0.022, 0.01), t.eye, h, [0, 0.2, 0.268], [0,0,0], { tag: 'eye' });
  },
};

function helmet(k, name, t, y = 1.96){
  const h = k.group(k.root, [0, y, 0]);
  k.add(loft([{ y:-0.04, w:0.14, d:0.14 }, { y:0.08, w:0.13, d:0.13 }], ngon(6, PI/6)), 'suit', h);   // neck
  HELMETS[name](k, h, t);
  return h;
}

/* ---------------- weapons ---------------- */

// melee weapon arm: pivots at the +x shoulder, carried at the ready (rotation.x = -0.35)
function weaponArm(k, t, w){
  const a = k.slot('weaponArm', k.root, [0.42*w, 1.74, 0.04], [-0.35, 0, 0]);
  const grip = arm(k, a, w, { bend: -0.15 });
  if (t.weapon === 'sword'){
    // vibro-sword: a long single-edged blade with a glowing edge line
    k.add(plate([[-0.035,0],[0.04,0],[0.05,-0.88],[0,-1.08],[-0.03,-0.94]], 0.022, 0.006), 'metal', grip, [0, -0.1, 0], [0, PI/2, 0]);
    k.glow(new THREE.BoxGeometry(0.006, 0.8, 0.012), t.eye, grip, [0, -0.55, 0.055]);
    k.add(block(0.24, 0.045, 0.09, 0.35), 'gun', grip, [0, -0.08, 0]);
    k.add(loft([{ y:-0.08, w:0.045, d:0.045 }, { y:0.12, w:0.04, d:0.04 }], ngon(6)), 'leather', grip);
    k.add(block(0.06, 0.05, 0.06, 0.4), 'gun', grip, [0, 0.14, 0]);
  } else if (t.weapon === 'saber'){
    // lightsaber: a ribbed hilt in the fist and a blade of light down the same line the vibro-sword takes
    k.add(loft([{ y:-0.12, w:0.05, d:0.05 }, { y:0.16, w:0.055, d:0.055 }], ngon(8, PI/8)), 'metal', grip, [0, 0.02, 0]);
    k.add(loft([{ y:0, w:0.065, d:0.065 }, { y:0.05, w:0.06, d:0.06 }], ngon(8, PI/8)), 'black', grip, [0, -0.14, 0]);
    k.add(block(0.03, 0.08, 0.03, 0.3), 'gun', grip, [0, 0.04, 0.045], [0,0,0], { outline: false });
    k.glow(new THREE.CylinderGeometry(0.022, 0.016, 1.12, 8), 0xffffff, grip, [0, -0.72, 0]);
    k.glow(new THREE.CylinderGeometry(0.06, 0.045, 1.16, 8), t.eye, grip, [0, -0.72, 0], [0,0,0], { opacity: 0.55 });
  } else {
    // vibro-maul: a long haft and a two-faced hammer head with glowing power cells
    k.add(loft([{ y:-1.15, w:0.07, d:0.07 }, { y:0.12, w:0.065, d:0.065 }], ngon(6)), 'leather', grip);
    k.add(block(0.4*w, 0.36, 0.34, 0.25), 'armor2', grip, [0, -1.1, 0]);
    for (const s of [-1, 1]) k.add(block(0.08, 0.4, 0.38, 0.3), 'metal', grip, [0.22*w*s, -1.1, 0]);
    k.add(shard(0.1, 0.22, 0.1), 'metal', grip, [0, -1.28, 0], [PI, 0, 0]);
    for (const s of [-1, 1]) k.glow(new THREE.BoxGeometry(0.03, 0.22, 0.01), t.eye, grip, [0.09*s, -1.1, 0.176]);
  }
  return a;
}

// blaster rifle held at the ready across the chest (E-11 style; long = the sniper's DLT-19x, shouldered), with both
// hands on it
function rifle(k, t, w, long){
  const at = long ? [0.2, 1.5, 0.32] : [0.22, 1.32, 0.36], yaw = long ? -0.05 : -0.18;
  const g = k.group(k.root, at, [0, yaw, 0]);
  reachArm(k, w, 1, [at[0], at[1] - 0.14, at[2]], { twist: 0.3 });
  const fore = new THREE.Vector3(0, -0.04, long ? 0.38 : 0.3).applyEuler(g.rotation).add(new THREE.Vector3(...at));
  reachArm(k, w, -1, fore.toArray(), { twist: -0.3 });
  k.add(block(0.08, 0.13, 0.5, 0.3), 'gun', g);
  k.add(loft([{ y:0, w:0.06, d:0.06 }, { y:long ? 0.95 : 0.36, w:0.05, d:0.05 }], ngon(8, PI/8)), 'gun', g, [0, 0.02, 0.25], [PI/2, 0, 0]);
  if (long) for (let i = 0; i < 3; i++) k.add(loft([{ y:0, w:0.075, d:0.075 }, { y:0.08, w:0.075, d:0.075 }], ngon(8, PI/8)), 'metal', g, [0, 0.02, 0.4 + i*0.2], [PI/2, 0, 0], { outline: false });
  k.add(block(0.05, 0.16, 0.08, 0.3), 'gun', g, [0, -0.12, 0.02], [0.3, 0, 0]);   // grip / magazine
  k.add(block(0.06, 0.09, 0.2, 0.3), 'gun', g, [0, -0.02, -0.32]);               // stock
  k.add(loft([{ y:-0.1, w:0.05, d:0.05 }, { y:0.1, w:0.05, d:0.05 }], ngon(8, PI/8)), 'black', g, [0, 0.11, 0.04], [PI/2, 0, 0]);   // scope
  if (long) k.glow(new THREE.SphereGeometry(0.035, 8, 6), t.eye, g, [0, 0.11, 0.15]);   // scope eye (the marksman tell)
  return g;
}

// the Imperial cog as ONE glow mesh: a hex ring and six teeth
let _cog = null;
function cogGeometry(){
  if (_cog) return _cog;
  const parts = [new THREE.RingGeometry(0.11, 0.17, 6)];
  for (let i = 0; i < 6; i++){
    const a = i / 6 * PI * 2;
    parts.push(new THREE.PlaneGeometry(0.03, 0.06).rotateZ(-a).translate(Math.sin(a)*0.2, Math.cos(a)*0.2, 0));
  }
  return (_cog = mergeGeometries(parts));
}

/* ---------------- the models ---------------- */

export const MODELS = {
  // PURGE TROOPER — the rank-and-file melee hunter with a vibro-sword (grunt)
  purge(k, t){
    const w = 1;
    legs(k, w); hips(k, w); torso(k, w); pauldrons(k, w, 'armor2', 0.9);
    sideArm(k, w, -1, [-0.12, 0, 0.05]);
    weaponArm(k, t, w);
    helmet(k, 'purge', t);
  },
  // STORMTROOPER — the blaster line (blaster)
  storm(k, t){
    const w = 1;
    legs(k, w); hips(k, w); torso(k, w); pauldrons(k, w, 'armor', 0.85);
    rifle(k, t, w, false);
    helmet(k, 'storm', t);
  },
  // HEAVY ASSAULT TROOPER — the brute with a vibro-maul: broad, plated, high collar
  heavy(k, t){
    const w = 1.3;
    legs(k, w, { boot: 'armor2' }); hips(k, w); torso(k, w);
    k.add(loft([{ y:1.78, w:0.62, d:0.42 }, { y:1.98, w:0.5, d:0.4 }], chamfer(0.4)), 'armor2');   // raised collar
    pauldrons(k, w, 'armor', 1.25);
    for (const s of [-1, 1]) k.add(shard(0.07, 0.18, 0.07), 'metal', k.root, [0.5*s, 1.92, 0], [0, 0, -0.3*s]);
    sideArm(k, w, -1, [-0.1, 0, 0.08]);
    weaponArm(k, t, w);
    helmet(k, 'heavy', t, 1.94);
  },
  // MAGNAGUARD — a cloaked droid duelist with a double-ended electrostaff (duelist)
  magna(k, t){
    const w = 0.92;
    legs(k, w, { shin: 'metal' }); hips(k, w); torso(k, w, { pack: false });
    // cloak: a cape off both shoulders and a short mantle
    k.add(plate([[-0.3,0],[0.3,0],[0.36,-1.2],[0.12,-1.32],[-0.12,-1.32],[-0.36,-1.2]], 0.014, 0.004), 'cloth', k.root, [0, 1.86, -0.21], [0.1, 0, 0], { outline: false });
    k.add(loft([{ y:1.62, w:0.66, d:0.44 }, { y:1.82, w:0.52, d:0.36 }, { y:1.9, w:0.3, d:0.26 }], chamfer(0.45)), 'cloth');
    sideArm(k, w, 1, [-0.75, 0, -0.1], { bend: -0.6, fore: 'metal' });
    sideArm(k, w, -1, [-0.6, 0, -0.2], { bend: -0.6, fore: 'metal' });
    const staff = k.slot('staff', k.root, [0.55, 1.5, 0.2], [0.3, 0, 0.5]);
    k.add(loft([{ y:-0.95, w:0.065, d:0.065 }, { y:0.95, w:0.065, d:0.065 }], ngon(6)), 'metal', staff);
    for (const s of [-1, 1]){
      k.add(loft([{ y:0, w:0.1, d:0.1 }, { y:0.08, w:0.09, d:0.09 }], ngon(6)), 'black', staff, [0, 0.82*s, 0], [s < 0 ? PI : 0, 0, 0]);
      k.add(shard(0.09, 0.26, 0.09), 'metal', staff, [0, 0.9*s, 0], [s < 0 ? PI : 0, 0, 0]);
      k.glow(new THREE.SphereGeometry(0.1, 8, 6), t.eye, staff, [0, 1.02*s, 0], [0,0,0], { opacity: 0.55, scale: [1, 1.6, 1] });
    }
    for (const s of [-0.3, 0.3]) k.add(block(0.08, 0.08, 0.08, 0.35), 'leather', staff, [0, s, 0], [0,0,0], { outline: false });
    helmet(k, 'magna', t, 1.97);
  },
  // SITH ACOLYTE — a hooded saber duellist in a dark tunic and long cloak (acolyte)
  acolyte(k, t){
    const w = 0.96;
    legs(k, w); hips(k, w); torso(k, w, { pack: false });
    k.add(plate([[-0.32,0],[0.32,0],[0.4,-1.45],[0.14,-1.6],[-0.14,-1.6],[-0.4,-1.45]], 0.014, 0.004), 'cloth', k.root, [0, 1.86, -0.22], [0.08, 0, 0], { outline: false });
    k.add(loft([{ y:1.6, w:0.64, d:0.44 }, { y:1.82, w:0.5, d:0.36 }, { y:1.9, w:0.3, d:0.26 }], chamfer(0.45)), 'cloth');
    k.add(plate([[-0.22,0],[0.22,0],[0.26,-0.62],[-0.26,-0.62]], 0.014, 0.004), 'cloth', k.root, [0, 1.12, 0.17], [-0.05, 0, 0], { outline: false });   // tabard
    sideArm(k, w, -1, [-0.3, 0, 0.12], { bend: -0.5 });
    weaponArm(k, t, w);
    helmet(k, 'purge', t);
  },
  // JET TROOPER — rocket pack, T-visor, carbine (flyer)
  jet(k, t){
    const w = 1;
    legs(k, w); hips(k, w); torso(k, w, { pack: false }); pauldrons(k, w, 'armor2', 0.85);
    rifle(k, t, w, false);
    // the pack: core, twin fuel tanks, flared nozzles, and the live thruster flames
    const pack = k.group(k.root, [0, 1.52, -0.3]);
    k.add(block(0.36, 0.5, 0.18, 0.3), 'suit', pack);
    k.add(block(0.22, 0.38, 0.06, 0.3), 'armor2', pack, [0, 0.02, -0.1]);
    for (const s of [-1, 1]){
      k.add(loft([{ y:-0.22, w:0.15, d:0.15 }, { y:0.2, w:0.15, d:0.15 }, { y:0.27, w:0.08, d:0.08 }], ngon(8, PI/8)), 'armor', pack, [0.17*s, 0.02, -0.03]);
      k.add(loft([{ y:-0.08, w:0.08, d:0.08 }, { y:0.06, w:0.14, d:0.14 }], ngon(8, PI/8)), 'metal', pack, [0.13*s, -0.32, -0.06], [PI, 0, 0]);
      k.glow(new THREE.CylinderGeometry(0.05, 0.09, 0.2, 7), 0x66ccff, pack, [0.13*s, -0.48, -0.06], [0,0,0], { opacity: 0.9, unique: true, tag: 'thrusters[]' });
    }
    helmet(k, 'jet', t);
  },
  // SHORETROOPER with a riot shield and a vibro-sword (phalanx)
  riot(k, t){
    const w = 1.05;
    legs(k, w); hips(k, w); torso(k, w); pauldrons(k, w, 'armor2', 1.0);
    k.add(plate([[-0.25,0],[0.25,0],[0.28,-0.5],[-0.28,-0.5]], 0.014, 0.004), 'cloth', k.root, [0, 1.12, 0.17], [-0.06, 0, 0], { outline: false });   // kama
    sideArm(k, w, -1, [-0.85, 0, 0.1], { bend: -0.7 });
    weaponArm(k, t, w);
    // deflector shield on the left arm: a tall chamfered slab with a view slit, a glowing rim and the Imperial cog
    const sh = k.slot('shield', k.root, [-0.46, 1.38, 0.46]);
    k.add(plate([[-0.4,0.6],[-0.3,0.7],[0.3,0.7],[0.4,0.6],[0.4,-0.56],[0.28,-0.68],[-0.28,-0.68],[-0.4,-0.56]], 0.07, 0.016), 'shield', sh);
    k.add(plate([[-0.32,0.5],[0.32,0.5],[0.32,0.44],[-0.32,0.44]], 0.02, 0.004), 'black', sh, [0, 0, 0.045], [0,0,0], { outline: false });
    k.add(plate([[-0.06,0.38],[0.06,0.38],[0.06,-0.6],[-0.06,-0.6]], 0.02, 0.006), 'armor2', sh, [0, 0, 0.045], [0,0,0], { outline: false });
    k.glow(new THREE.BoxGeometry(0.66, 0.025, 0.01), t.eye, sh, [0, 0.47, 0.062], [0,0,0], { opacity: 0.85 });
    k.glow(cogGeometry(), t.eye, sh, [0, -0.12, 0.062], [0,0,0], { opacity: 0.8 });
    helmet(k, 'riot', t);
  },
  // B1 SABOTEUR DROID — a skinny battle droid with a thermal charge strapped to its chest (bomber)
  b1(k, t){
    for (const s of [-1, 1]){
      const x = 0.13 * s;
      k.add(limb(0.48, [[-0.03,0.09,0.09],[1,0.07,0.07]], chamfer(0.35)), 'armor', k.root, [x, 0.94, 0]);
      k.add(block(0.1, 0.07, 0.1, 0.4), 'metal', k.root, [x, 0.46, 0]);
      k.add(limb(0.38, [[0,0.075,0.08],[0.7,0.09,0.1],[1,0.06,0.07]], KEEL), 'armor', k.root, [x, 0.46, 0]);
      k.add(plate([[-0.06,0.03],[-0.06,-0.06],[0.17,-0.06],[0.19,-0.03],[0.04,0.03]], 0.09, 0.008), 'armor2', k.root, [x, 0.07, 0], [0, -PI/2, 0]);
    }
    k.add(loft([{ y:0.86, w:0.32, d:0.18 }, { y:1.0, w:0.34, d:0.2 }], chamfer(0.4)), 'armor2');
    k.add(loft([{ y:1.0, w:0.06, d:0.06 }, { y:1.32, w:0.06, d:0.06 }], ngon(6)), 'metal');   // spine
    k.add(loft([{ y:1.28, w:0.36, d:0.2 }, { y:1.5, w:0.44, d:0.28 }, { y:1.72, w:0.42, d:0.26 }, { y:1.8, w:0.3, d:0.2 }], SHIELD), 'armor');
    k.add(block(0.32, 0.4, 0.18, 0.3), 'armor2', k.root, [0, 1.52, -0.2]);   // backpack
    k.add(loft([{ y:1.78, w:0.05, d:0.05 }, { y:2.02, w:0.045, d:0.045 }], ngon(6)), 'metal', k.root, [0, 0, 0.03], [0.18, 0, 0]);   // neck
    for (const s of [-1, 1]){
      const sh = k.group(k.root, [0.25*s, 1.72, 0], [-0.15, 0, 0.14*s]);
      k.add(block(0.11, 0.1, 0.11, 0.4), 'armor2', sh);
      k.add(limb(0.38, [[0,0.06,0.06],[1,0.05,0.05]], chamfer(0.35)), 'armor', sh);
      k.add(limb(0.34, [[0,0.055,0.055],[1,0.045,0.045]], chamfer(0.35)), 'armor', sh, [0, -0.38, 0]);
      k.add(block(0.08, 0.1, 0.06, 0.3), 'metal', sh, [0, -0.76, 0.02]);
    }
    // the long droid head: snout forward, skull back, two small eyes
    const h = k.group(k.root, [0, 2.05, 0.06], [0.25, 0, 0]);
    k.add(loft([{ y:-0.08, w:0.14, d:0.16 }, { y:0.05, w:0.16, d:0.18 }, { y:0.12, w:0.1, d:0.12 }], chamfer(0.35)), 'armor', h, [0, 0, -0.02]);
    k.add(loft([{ y:0, w:0.12, d:0.1 }, { y:0.3, w:0.07, d:0.06 }], chamfer(0.35)), 'armor', h, [0, -0.02, 0.03], [PI/2 - 0.2, 0, 0]);
    const eyes = k.live(new THREE.Group(), h, 'eye');
    for (const s of [-1, 1]){
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshBasicMaterial({ color: t.eye, toneMapped: false }));
      m.position.set(0.055*s, 0.03, 0.07); eyes.add(m);
    }
    // the charge: a glowing core in a ribbed cage, strapped across the chest
    k.glow(new THREE.SphereGeometry(0.17, 12, 10), t.eye, k.root, [0, 1.5, 0.2], [0,0,0], { unique: true, tag: 'bombCore' });
    for (const a of [0, PI/2]) k.add(new THREE.TorusGeometry(0.19, 0.022, 5, 12), 'metal', k.root, [0, 1.5, 0.2], [0, a, 0], { outline: false });
    k.add(block(0.5, 0.05, 0.06, 0.3), 'leather', k.root, [0, 1.5, 0.12], [0, 0, 0.5], { outline: false });
  },
  // SCOUT SNIPER — scout helm, camo poncho, a long DLT-19x (sniper)
  scout(k, t){
    const w = 0.95;
    legs(k, w); hips(k, w); torso(k, w);
    k.add(loft([{ y:1.3, w:0.78, d:0.52 }, { y:1.62, w:0.7, d:0.46 }, { y:1.84, w:0.48, d:0.34 }, { y:1.94, w:0.24, d:0.2 }], chamfer(0.45)), 'cloth');   // poncho
    rifle(k, t, w, true);
    helmet(k, 'scout', t);
  },
};

/* ---------------- build ---------------- */

export function buildEnemyMesh(t){
  const id = t.model + ':' + t.color.toString(16) + ':' + t.eye.toString(16);
  const baked = bakeDesign(id, k => MODELS[t.model](k, t), {
    armor: t.color, armor2: shade(t.color, 0.62), shield: shade(t.color, 1.15), cloth: t.cloth ?? 0x3f382e,
  });
  const g = instantiate(baked);
  const u = g.userData;
  if (u.shield) u.shieldMat = u.shield.children[0].material;
  if (u.eye) u.eyeMat = u.eye.material || u.eye.children[0].material;
  u.eyeBase = u.eye ? u.eye.scale.clone() : new THREE.Vector3(1, 1, 1);
  g.scale.setScalar(t.scale);
  return g;
}
