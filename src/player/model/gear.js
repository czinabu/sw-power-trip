// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Hand-held gear: the Jedi lightsaber, Mando blaster pistols, the disruptor rifle and the Darksaber.
// Everything mounts on the wrist joints, so a future wrist animation carries the weapon with it.

import * as THREE from 'three';
import { loft, plate, block, ngon, chamfer } from './shapes.js';

const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

export function buildGear(R, S, player){
  const grip = R.armR.wr, gripL = R.armL.wr;
  const GRIP_Y = -0.04;   // where the fist closes, below the wrist joint

  /* ---- lightsaber: faceted hilt, glowing blade ---- */
  const saberHand = new THREE.Group(); saberHand.position.y = GRIP_Y; grip.add(saberHand);
  S.add(loft([
    { y:-0.13, w:0.06, d:0.06 }, { y:-0.11, w:0.078, d:0.078 }, { y:-0.08, w:0.066, d:0.066 },
    { y:0.06, w:0.066, d:0.066 }, { y:0.08, w:0.086, d:0.086 }, { y:0.12, w:0.08, d:0.08 }, { y:0.13, w:0.06, d:0.06 },
  ], ngon(8, Math.PI/8)), 'hilt', saberHand);
  for (let i = 0; i < 4; i++) S.add(block(0.072, 0.012, 0.072, 0.4), 'leather', saberHand, [0, -0.05 + i*0.03, 0], [0,0,0], { outline: false });
  S.add(block(0.022, 0.035, 0.03, 0.3), 'gunDark', saberHand, [0, 0.02, 0.038], [0,0,0], { outline: false });   // activator
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.022, 1.55, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  blade.position.y = 0.95;
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 1.6, 8), glowMat(0x33bbff, 0.45));
  glow.position.y = 0.95;
  const light = new THREE.PointLight(0x44bbff, 8, 9); light.position.y = 0.9;
  saberHand.add(blade, glow, light);
  saberHand.rotation.set(0.25, 0, -0.4);
  player.saberHand = saberHand;
  player.saberPivot = R.armR.sh;
  player.blade = { blade, glow, light };

  /* ---- blaster pistol ---- */
  const accent = S.mat('accent');
  function buildPistol(){
    const p = new THREE.Group();
    S.add(block(0.05, 0.15, 0.068, 0.3), 'gunDark', p, [0, -0.02, 0], [0.34, 0, 0]);
    S.add(block(0.05, 0.085, 0.24, 0.3), 'gunDark', p, [0, 0.09, 0.07]);
    S.add(loft([{ y:-0.13, w:0.058, d:0.05 }, { y:0.13, w:0.058, d:0.05 }], chamfer(0.4)), 'gunMetal', p, [0, 0.135, 0.07], [Math.PI/2, 0, 0]);
    S.add(loft([{ y:-0.08, w:0.042, d:0.042 }, { y:0.08, w:0.036, d:0.036 }], ngon(6)), 'gunMetal', p, [0, 0.115, 0.26], [Math.PI/2, 0, 0]);
    const emit = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.03, 8), new THREE.MeshBasicMaterial({ color: 0xffb84a }));
    emit.rotation.x = Math.PI/2; emit.position.set(0, 0.115, 0.34); p.add(emit);
    S.add(block(0.01, 0.02, 0.03, 0.2), 'gunMetal', p, [0, 0.168, 0.18], [0,0,0], { outline: false });
    S.add(block(0.054, 0.02, 0.04, 0.2), accent, p, [0, 0.115, 0.07], [0,0,0], { outline: false });
    return p;
  }
  // pre-rotated so the raised aim pose points the barrel at the reticle
  const pistolL = buildPistol(); pistolL.position.y = GRIP_Y; pistolL.rotation.x = 1.15; gripL.add(pistolL);
  const pistolR = buildPistol(); pistolR.position.y = GRIP_Y; pistolR.rotation.x = 1.15; grip.add(pistolR);
  player.pistols = { L: pistolL, R: pistolR };

  /* ---- disruptor rifle ---- */
  const rifle = new THREE.Group(); rifle.position.y = GRIP_Y; rifle.rotation.x = 1.15; grip.add(rifle);
  S.add(block(0.06, 0.1, 0.18, 0.3), 'gunDark', rifle, [0, 0.06, -0.14]);
  S.add(block(0.07, 0.1, 0.52, 0.3), 'gunMetal', rifle, [0, 0.1, 0.16]);
  S.add(loft([{ y:-0.3, w:0.048, d:0.048 }, { y:0.3, w:0.04, d:0.04 }], ngon(6)), 'gunMetal', rifle, [0, 0.11, 0.56], [Math.PI/2, 0, 0]);
  for (const sx of [-1, 1]) S.add(loft([{ y:0, w:0.03, d:0.03 }, { y:0.16, w:0.002, d:0.002 }], ngon(4)), 'gunMetal', rifle, [0.028*sx, 0.11, 0.82], [Math.PI/2, 0, 0]);
  const rProngGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat(0x7fe0ff, 0)); rProngGlow.position.set(0, 0.11, 0.92); rifle.add(rProngGlow);
  S.add(loft([{ y:-0.1, w:0.06, d:0.06 }, { y:0.1, w:0.06, d:0.06 }], ngon(8, Math.PI/8)), 'gunDark', rifle, [0, 0.185, 0.16], [Math.PI/2, 0, 0]);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8), new THREE.MeshBasicMaterial({ color: 0x66ddff }));
  lens.rotation.x = Math.PI/2; lens.position.set(0, 0.185, 0.055); rifle.add(lens);
  S.add(block(0.05, 0.12, 0.06, 0.3), 'gunDark', rifle, [0, 0, 0.04], [0.3, 0, 0]);
  player.rifleMesh = rifle; player.rifleProngGlow = rProngGlow;

  /* ---- the Darksaber: black blade, white-violet edge ---- */
  const darkHand = new THREE.Group(); darkHand.position.y = GRIP_Y; darkHand.visible = false; darkHand.rotation.set(0.25, 0, -0.4); grip.add(darkHand);
  const dHiltMat = new THREE.MeshStandardMaterial({ color: 0x0c0d11, metalness: 0.85, roughness: 0.28 });
  S.add(loft([{ y:-0.14, w:0.07, d:0.07 }, { y:0.12, w:0.082, d:0.082 }, { y:0.14, w:0.07, d:0.07 }], ngon(8, Math.PI/8)), dHiltMat, darkHand);
  S.add(block(0.06, 0.05, 0.06, 0.4), S.mat('gunDark', { c: 0x2a2030 }), darkHand, [0, -0.16, 0]);
  const dBlade = new THREE.Mesh(plate([[-0.035,0],[0.035,0],[0.04,1.1],[0,1.2],[-0.04,1.1]], 0.02, 0), new THREE.MeshBasicMaterial({ color: 0x07060c }));
  dBlade.position.y = 0.12;
  const dEdge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.24, 0.012), glowMat(0xe7dcff, 0.9)); dEdge.position.y = 0.72;
  const dGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.02), glowMat(0x9a5cff, 0.4)); dGlow.position.y = 0.72;
  const dLight = new THREE.PointLight(0x9a6cff, 6, 7); dLight.position.y = 0.7;
  darkHand.add(dGlow, dEdge, dBlade, dLight);
  player.darksaberMesh = darkHand; player.darkLight = dLight;
}
