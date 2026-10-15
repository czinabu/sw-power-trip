// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WEAPON MODELS — a registry of hand-held gear, each mounted on a named rig socket (rig.js) with its own grip.
//   hold   — which pose family the weapon wants (saber-1h, pistol, rifle-2h). animation.js still picks poses by
//            hero/weapon today; this tag is where per-weapon holds plug in when that's reworked.
//   socket — default mount (handR / handL / back / hipL / hipR)
//   grip   — position + rotation of the weapon in the socket: change this to change how it's held
//            (the lightsaber also has a regular/reverse grip preference, see applySaberGrip)
//   build  — returns { group, ...hooks } built in the current render style
// Adding a weapon type = one entry here + mounting it in mountLoadout().

import * as THREE from 'three';
import { loft, plate, block, ngon, chamfer } from './shapes.js';

const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
const GRIP_Y = -0.04;   // where the fist closes, below the wrist joint

export const WEAPON_MODELS = {
  saber: {
    hold: 'saber-1h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [0.25, 0, -0.4] },
    build(S){
      const g = new THREE.Group(), root = new THREE.Group(); g.add(root);   // root flips for the regular grip (see applySaberGrip)
      S.add(loft([
        { y:-0.13, w:0.06, d:0.06 }, { y:-0.11, w:0.078, d:0.078 }, { y:-0.08, w:0.066, d:0.066 },
        { y:0.06, w:0.066, d:0.066 }, { y:0.08, w:0.086, d:0.086 }, { y:0.12, w:0.08, d:0.08 }, { y:0.13, w:0.06, d:0.06 },
      ], ngon(8, Math.PI/8)), 'hilt', root);
      for (let i = 0; i < 4; i++) S.add(block(0.072, 0.012, 0.072, 0.4), 'leather', root, [0, -0.05 + i*0.03, 0], [0,0,0], { outline: false });
      S.add(block(0.022, 0.035, 0.03, 0.3), 'gunDark', root, [0, 0.02, 0.038], [0,0,0], { outline: false });   // activator
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.022, 1.55, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      blade.position.y = 0.95;
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 1.6, 8), glowMat(0x33bbff, 0.45));
      glow.position.y = 0.95;
      const light = new THREE.PointLight(0x44bbff, 8, 9); light.position.y = 0.9;
      root.add(blade, glow, light);
      return { group: g, bladeRoot: root, blade, glow, light };
    },
  },

  pistol: {
    hold: 'pistol', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [1.15, 0, 0] },   // pre-tilted so the raised aim pose points at the reticle
    build(S){
      const g = new THREE.Group();
      S.add(block(0.05, 0.15, 0.068, 0.3), 'gunDark', g, [0, -0.02, 0], [0.34, 0, 0]);
      S.add(block(0.05, 0.085, 0.24, 0.3), 'gunDark', g, [0, 0.09, 0.07]);
      S.add(loft([{ y:-0.13, w:0.058, d:0.05 }, { y:0.13, w:0.058, d:0.05 }], chamfer(0.4)), 'gunMetal', g, [0, 0.135, 0.07], [Math.PI/2, 0, 0]);
      S.add(loft([{ y:-0.08, w:0.042, d:0.042 }, { y:0.08, w:0.036, d:0.036 }], ngon(6)), 'gunMetal', g, [0, 0.115, 0.26], [Math.PI/2, 0, 0]);
      const emit = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.03, 8), new THREE.MeshBasicMaterial({ color: 0xffb84a }));
      emit.rotation.x = Math.PI/2; emit.position.set(0, 0.115, 0.34); g.add(emit);
      S.add(block(0.01, 0.02, 0.03, 0.2), 'gunMetal', g, [0, 0.168, 0.18], [0,0,0], { outline: false });
      S.add(block(0.054, 0.02, 0.04, 0.2), 'accent', g, [0, 0.115, 0.07], [0,0,0], { outline: false });
      return { group: g };
    },
  },

  disruptor: {
    hold: 'rifle-2h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [1.15, 0, 0] },
    build(S){
      const g = new THREE.Group();
      S.add(block(0.06, 0.1, 0.18, 0.3), 'gunDark', g, [0, 0.06, -0.14]);
      S.add(block(0.07, 0.1, 0.52, 0.3), 'gunMetal', g, [0, 0.1, 0.16]);
      S.add(loft([{ y:-0.3, w:0.048, d:0.048 }, { y:0.3, w:0.04, d:0.04 }], ngon(6)), 'gunMetal', g, [0, 0.11, 0.56], [Math.PI/2, 0, 0]);
      for (const sx of [-1, 1]) S.add(loft([{ y:0, w:0.03, d:0.03 }, { y:0.16, w:0.002, d:0.002 }], ngon(4)), 'gunMetal', g, [0.028*sx, 0.11, 0.82], [Math.PI/2, 0, 0]);
      const prongGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat(0x7fe0ff, 0)); prongGlow.position.set(0, 0.11, 0.92); g.add(prongGlow);
      S.add(loft([{ y:-0.1, w:0.06, d:0.06 }, { y:0.1, w:0.06, d:0.06 }], ngon(8, Math.PI/8)), 'gunDark', g, [0, 0.185, 0.16], [Math.PI/2, 0, 0]);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8), new THREE.MeshBasicMaterial({ color: 0x66ddff }));
      lens.rotation.x = Math.PI/2; lens.position.set(0, 0.185, 0.055); g.add(lens);
      S.add(block(0.05, 0.12, 0.06, 0.3), 'gunDark', g, [0, 0, 0.04], [0.3, 0, 0]);
      return { group: g, prongGlow };
    },
  },

  darksaber: {
    hold: 'saber-1h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [0.25, 0, -0.4] },
    build(S){
      const g = new THREE.Group();
      S.add(loft([{ y:-0.14, w:0.07, d:0.07 }, { y:0.12, w:0.082, d:0.082 }, { y:0.14, w:0.07, d:0.07 }], ngon(8, Math.PI/8)), S.mat('gunDark', { c: 0x0c0d11 }), g);
      S.add(block(0.06, 0.05, 0.06, 0.4), S.mat('gunDark', { c: 0x2a2030 }), g, [0, -0.16, 0]);
      const blade = new THREE.Mesh(plate([[-0.035,0],[0.035,0],[0.04,1.1],[0,1.2],[-0.04,1.1]], 0.02, 0), new THREE.MeshBasicMaterial({ color: 0x07060c }));
      blade.position.y = 0.12;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.24, 0.012), glowMat(0xe7dcff, 0.9)); edge.position.y = 0.72;
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.02), glowMat(0x9a5cff, 0.4)); glow.position.y = 0.72;
      const light = new THREE.PointLight(0x9a6cff, 6, 7); light.position.y = 0.7;
      g.add(glow, edge, blade, light);
      return { group: g, light };
    },
  },
};

/* SABER GRIP — a player preference: 'regular' (blade out of the thumb side) or 'reverse' (Shien reverse grip, blade
   out of the pinky side along the forearm). Visual only: swing reach and damage don't depend on the blade mesh.
   The animated node (player.saberHand) is untouched; only the hilt+blade root inside it flips. The saber's built
   orientation (root unrotated) runs the blade back up the forearm, i.e. it IS the reverse grip, so 'regular' is
   the flipped one. Checked in game: regular points the blade away from the elbow, reverse back toward it. */
let saberGrip = 'regular';
export function applySaberGrip(player, grip){
  saberGrip = grip === 'reverse' ? 'reverse' : 'regular';
  const root = player.saberBladeRoot;
  if (root) root.rotation.x = saberGrip === 'reverse' ? 0 : Math.PI;
}

export function mountWeapon(R, S, id, socket){
  const def = WEAPON_MODELS[id];
  const w = def.build(S);
  w.group.position.set(...def.grip.pos);
  w.group.rotation.set(...def.grip.rot);
  w.group.userData.weapon = { id, hold: def.hold };
  R.sockets[socket || def.socket].add(w.group);
  return w;
}

// the current loadout for both heroes, wired to the hooks the game already uses (player.saberHand, player.pistols, …)
export function mountLoadout(R, S, player){
  const saber = mountWeapon(R, S, 'saber');
  player.saberHand = saber.group;
  player.saberPivot = R.armR.sh;
  player.blade = { blade: saber.blade, glow: saber.glow, light: saber.light };
  player.saberBladeRoot = saber.bladeRoot;
  applySaberGrip(player, saberGrip);

  player.pistols = { L: mountWeapon(R, S, 'pistol', 'handL').group, R: mountWeapon(R, S, 'pistol', 'handR').group };

  const rifle = mountWeapon(R, S, 'disruptor');
  player.rifleMesh = rifle.group; player.rifleProngGlow = rifle.prongGlow;

  const dark = mountWeapon(R, S, 'darksaber');
  dark.group.visible = false;
  player.darksaberMesh = dark.group; player.darkLight = dark.light;
}
