// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Mandalorian outfit, split into SLOTS (legs, torso, arms, helmet, cape, jetpack) with named variants, the same
// way jedi.js works. Every Mando part starts hidden; setHero() shows them for the bounty hunter.
// The jetpack variant must set player.jetGlow / jetFuelSegs / jetMissileMesh (flight.js and gadgets.js drive them).

import * as THREE from 'three';
import { loft, limb, plate, block, shard, chamfer, ngon, KEEL, SHIELD, HEAD } from './shapes.js';
import { hand } from './jedi.js';
import { seg } from './skin.js';

const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const SEAM_COOL = 0x5fd8ff, SEAM_WARM = 0xff7a3d;

export const MANDO_PARTS = {
  legs: {
    // suit, thigh plate, knee cop, shin greave, armored boot, right-hip holster
    armored(R, k){
      for (const L of [R.legL, R.legR]){
        // the flight suit: one surface over hip and knee, down into the boot
        k.skin('suit', [
          ...seg(0.45, [[-0.06,0.18,0.18],[0.2,0.17,0.17],[0.75,0.13,0.14],[1,0.11,0.12]]),
          ...seg(0.41, [[0.1,0.14,0.15],[0.45,0.135,0.145],[0.8,0.115,0.125],[1,0.115,0.125]], 0.45),
        ], { bones: [L.hip, L.knee], at: [0.45] });
        k.add(plate([[-0.07,0],[0.07,0],[0.078,-0.2],[0,-0.25],[-0.078,-0.2]], 0.03, 0.01), 'beskar2', L.hip, [0, -0.07, 0.085], [-0.06, 0, 0]);
        k.add(plate([[-0.055,0.04],[0.055,0.04],[0.065,-0.02],[0,-0.07],[-0.065,-0.02]], 0.03, 0.01), 'beskar', L.knee, [0, 0, 0.07]);
        k.add(limb(0.32, [[0,0.125,0.11,0.02],[0.3,0.15,0.13,0.02],[1,0.12,0.1,0.02]], KEEL), 'beskar2', L.knee, [0, -0.08, 0]);
        k.add(plate([[-0.075,0.035],[-0.09,-0.075],[0.16,-0.085],[0.21,-0.05],[0.1,0.0],[0.03,0.04]], 0.115, 0.014),
          'strap', L.ank, [0, 0, 0], [0, -Math.PI/2, 0]);
        k.seam(new THREE.BoxGeometry(0.008, 0.2, 0.008), SEAM_COOL, L.knee, [0, -0.2, 0.085]);   // greave line
      }
      k.add(block(0.075, 0.17, 0.09, 0.35), 'strap', R.legR.hip, [0.06, -0.28, 0.04]);
    },
  },

  torso: {
    // suit under pec plates, segmented abdomen, keystone, belt + pouches, back plate, pack straps
    cuirass(R, k){
      // the suit from pelvis to collar is one surface that bends and twists through the hips, torso and chest joints
      k.skin('suit', [
        { t:-0.12, w:0.3, d:0.2 }, { t:0, w:0.34, d:0.22 }, { t:0.16, w:0.31, d:0.2 }, { t:0.36, w:0.29, d:0.19 },
        ...seg(1, [[0,0.33,0.22],[0.14,0.46,0.27],[0.27,0.52,0.26],[0.35,0.36,0.2],[0.4,0.2,0.15]], 0.46),
      ], { bones: [R.hips, R.torso, R.chest], at: [0.16, 0.46], blend: 0.07, profile: SHIELD, dir: 1 });
      k.add(loft([{ y:0.04, w:0.38, d:0.26 }, { y:0.17, w:0.37, d:0.255 }], SHIELD), 'strap', R.torso);
      for (const bx of [-0.12, 0.12]) k.add(block(0.085, 0.1, 0.06, 0.3), 'beskar2', R.torso, [bx, 0.08, 0.14]);
      const abPlate = plate([[-0.115,-0.035],[0.115,-0.035],[0.125,0.03],[-0.125,0.03]], 0.028, 0.008);
      k.add(abPlate, 'beskar2', R.torso, [0, 0.25, 0.108], [0.05, 0, 0]);
      k.add(abPlate, 'beskar2', R.torso, [0, 0.32, 0.112], [0.08, 0, 0], { scale: [1.08, 1, 1] });
      k.seam(new THREE.BoxGeometry(0.22, 0.008, 0.008), SEAM_WARM, R.torso, [0, 0.285, 0.13]);

      const pec = [[0.0,0.0],[0.165,0.02],[0.19,0.13],[0.15,0.19],[0.02,0.17]];
      k.add(plate(pec, 0.04, 0.012), 'beskar', R.chest, [0.012, 0.12, 0.125], [-0.06, 0.22, 0]);
      k.add(plate(mirror(pec), 0.04, 0.012), 'beskar', R.chest, [-0.012, 0.12, 0.125], [-0.06, -0.22, 0]);
      for (const sx of [-1, 1]) k.seam(new THREE.BoxGeometry(0.008, 0.16, 0.008), SEAM_COOL, R.chest, [0.19*sx, 0.2, 0.1], [0, 0, 0.25*sx]);
      k.add(shard(0.05, 0.11, 0.03), 'accent', R.chest, [0, 0.03, 0.14]);   // keystone
      k.add(loft([{ y:0.33, w:0.24, d:0.2 }, { y:0.43, w:0.17, d:0.16 }], chamfer(0.45)), 'suit', R.chest);   // gorget
      k.add(plate([[-0.17,0],[0.17,0],[0.15,0.24],[-0.15,0.24]], 0.03, 0.01), 'beskar2', R.chest, [0, 0.06, -0.125]);
      for (const sx of [-1, 1]) k.add(block(0.05, 0.42, 0.03, 0.2), 'strap', R.chest, [0.13*sx, 0.18, 0.13], [-0.25, 0, 0]);
    },
  },

  arms: {
    // suit sleeves, pauldrons (accent colour on the right), bracers with a gauntlet plate, gloves
    pauldrons(R, k){ arms(R, k, true); },
    // no shoulder armour, for a lighter scout look
    bare(R, k){ arms(R, k, false); },
  },

  helmet: {
    // T-visor, chiseled dome, comm caps, rangefinder stalk
    tvisor(R, k){
      const helm = k.group(R.head);
      k.add(loft([{ y:-0.1, w:0.12, d:0.12 }, { y:0.04, w:0.11, d:0.11 }], ngon(6, Math.PI/6)), 'suit', helm);
      k.add(loft([
        { y:0.0,  w:0.205, d:0.225, z:0.005 },
        { y:0.07, w:0.215, d:0.235, z:0.005 },
        { y:0.2,  w:0.235, d:0.25 },
        { y:0.3,  w:0.222, d:0.24, z:-0.005 },
        { y:0.36, w:0.165, d:0.19, z:-0.01 },
        { y:0.385,w:0.08,  d:0.1,  z:-0.01 },
      ], HEAD), 'beskar', helm);
      k.add(plate([[-0.098,0.026],[0.098,0.026],[0.104,-0.01],[0.026,-0.02],[-0.026,-0.02],[-0.104,-0.01]], 0.02, 0.003), 'visor', helm, [0, 0.205, 0.121], [0, 0, 0], { outline: false });
      k.add(plate([[-0.024,0],[0.024,0],[0.019,-0.11],[-0.019,-0.11]], 0.02, 0.003), 'visor', helm, [0, 0.192, 0.12], [0.07, 0, 0], { outline: false });
      k.add(block(0.13, 0.05, 0.07, 0.4), 'beskar2', helm, [0, 0.03, 0.08]);   // chin guard
      for (const sx of [-1, 1]) k.add(block(0.03, 0.07, 0.075, 0.35), 'suit', helm, [0.118*sx, 0.15, 0.0]);
      const fin = k.group(helm, [-0.13, 0.25, 0.01], [0, 0, 0.22]);
      k.add(block(0.016, 0.17, 0.024, 0.3), 'suit', fin, [0, 0.085, 0]);
      k.add(shard(0.03, 0.05, 0.03), 'accent', fin, [0, 0.17, 0]);
      k.seam(new THREE.BoxGeometry(0.17, 0.006, 0.006), SEAM_COOL, helm, [0, 0.205, 0.134]);
    },
  },

  cape: {
    // Both capes are worn UNDER the jetpack, as Boba and Din wear theirs: the top panel hangs in the gap between the
    // back plate and the pack, and a cloth hem hangs free below the pack (capeHem, simulated by cloth.js). animation.js only
    // lets the top panel sway sideways in that gap; the hem takes the trail and flutter, so it never swings through
    // the pack. (The pack's front face sits at chest z ≈ -0.26, the back plate at ≈ -0.14.)
    // half cape off the left shoulder (Boba): a strip shows beside the left tank, the ragged hem below the pack
    half(R, k){
      R.cape.position.set(-0.2, 0.36, -0.2); R.cape.rotation.set(0, 0, 0);
      k.add(plate([[-0.18,0.0],[0.13,0.0],[0.15,-0.74],[-0.2,-0.74]], 0.012, 0.004), 'cloth', R.cape, [0, 0, 0], [0, 0, 0], { outline: false });
      capeHem(R, k, { top: [-0.2, 0.15], bottom: [-0.22, 0.12], drop: [-0.4, -0.24], dip: 0.04 });
    },
    // full cape across both shoulders, down to the knees below the pack
    full(R, k){
      R.cape.position.set(0, 0.36, -0.2); R.cape.rotation.set(0, 0, 0);
      k.add(plate([[-0.26,0.0],[0.26,0.0],[0.29,-0.74],[-0.29,-0.74]], 0.012, 0.004), 'cloth', R.cape, [0, 0, 0], [0, 0, 0], { outline: false });
      capeHem(R, k, { top: [-0.29, 0.29], bottom: [-0.33, 0.33], drop: [-0.5, -0.5], dip: 0.06 });
    },
    none(){},
  },

  jetpack: {
    // Boba-style pack: ribbed core, twin domed tanks, bell nozzles, antenna, mount for the back missile
    standard(R, k, player){
      const jet = k.group(R.back, [0, 0, -0.22]);   // its -z faces the camera
      k.add(block(0.4, 0.58, 0.18, 0.3), 'suit', jet);
      k.add(block(0.24, 0.48, 0.1, 0.3), 'beskar2', jet, [0, 0, -0.1]);
      for (const sx of [-1, 1]){
        k.add(block(0.08, 0.44, 0.06, 0.35), 'beskar', jet, [0.055*sx, 0, -0.16]);
        for (let i = 0; i < 5; i++) k.add(new THREE.BoxGeometry(0.088, 0.012, 0.03), 'suit', jet, [0.055*sx, -0.17 + i*0.085, -0.19], [0,0,0], { outline: false });
        k.add(loft([{ y:-0.25, w:0.2, d:0.2 }, { y:0.2, w:0.2, d:0.2 }, { y:0.26, w:0.16, d:0.16 }, { y:0.32, w:0.06, d:0.06 }], ngon(8, Math.PI/8)), 'beskar2', jet, [0.2*sx, -0.02, 0]);
        k.add(loft([{ y:-0.09, w:0.09, d:0.09 }, { y:0.08, w:0.17, d:0.17 }], ngon(8, Math.PI/8)), 'beskar', jet, [0.2*sx, -0.35, 0.01], [0, 0, -0.1*sx]);
        k.seam(new THREE.BoxGeometry(0.006, 0.2, 0.006), SEAM_COOL, jet, [0.055*sx, 0, -0.195]);
      }
      k.add(block(0.028, 0.46, 0.03, 0.3), 'accent', jet, [0, 0, -0.2]);
      k.add(loft([{ y:-0.15, w:0.03, d:0.03 }, { y:0.15, w:0.022, d:0.022 }], ngon(6)), 'beskar', jet, [0.13, 0.46, -0.02]);
      k.add(shard(0.04, 0.07, 0.04), 'accent', jet, [0.13, 0.6, -0.02]);
      k.add(loft([{ y:-0.05, w:0.17, d:0.17 }, { y:0.05, w:0.12, d:0.12 }], ngon(8, Math.PI/8)), 'beskar', jet, [0, 0.32, 0]);

      // back missile: shown once the JETPACK MISSILE ability is unlocked, hidden while it recharges
      const jmiss = new THREE.Group(); jmiss.position.set(0, 0.43, -0.03); jet.add(jmiss);
      k.style.add(loft([{ y:-0.15, w:0.124, d:0.124 }, { y:0.15, w:0.124, d:0.124 }], ngon(8, Math.PI/8)), k.mat('beskar2'), jmiss);
      k.style.add(loft([{ y:0.15, w:0.124, d:0.124 }, { y:0.28, w:0.001, d:0.001 }], ngon(8, Math.PI/8)), k.mat('accent'), jmiss);
      for (let fi = 0; fi < 3; fi++){ const a = fi/3*Math.PI*2;
        k.style.add(plate([[0,0],[0.05,-0.02],[0.05,-0.1],[0,-0.07]], 0.012, 0.003), k.mat('beskar'), jmiss, [Math.cos(a)*0.05, -0.08, Math.sin(a)*0.05], [0, -a, 0]); }
      jmiss.visible = false; player.jetMissileMesh = jmiss;

      const glowMat = () => new THREE.MeshBasicMaterial({ color: 0x59c6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      player.jetGlow = [-1, 1].map(sx => {
        const g = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.025, 0.13, 8), glowMat());
        g.position.set(0.18*sx, -0.47, 0.01); g.rotation.z = -0.1*sx; jet.add(g); return g;
      });
      // diegetic fuel gauge: LED strips on the tanks' camera-facing side, filled bottom → top by flight.js
      const fuelSegs = [], SEG_N = 6;
      for (const sx of [-1, 1]) for (let i = 0; i < SEG_N; i++){
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.02),
          new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
        seg.position.set(0.2*sx, -0.17 + i*0.072, -0.105); jet.add(seg);
        fuelSegs.push({ mesh: seg, thr: i / SEG_N });
      }
      player.jetFuelSegs = fuelSegs;
    },
  },
};

/* the cape below the pack is real cloth (cloth.js), pinned along the bottom of the top panel: it trails, flutters
   and swings on a turn by itself, and the legs and hips push it aside. top/bottom = [left x, right x],
   drop = how far each side hangs, dip = extra length at the middle */
function capeHem(R, k, { top, bottom, drop, dip }){
  const lerp = (a, b, t) => a + (b - a) * t;
  R.cape.userData.hem = k.group(R.cape, [0, -0.74, 0]);   // marks the cape as worn under the pack (animation.js)
  k.cloth('cloth', R.cape, { W: 6, H: 7, thick: 0.012, outline: false, capsules: k.bodyCapsules(), slack: 0.8,
    rest: (u, v) => {
      const t = (u + 1) / 2;
      return [lerp(lerp(top[0], top[1], t), lerp(bottom[0], bottom[1], t), v),
        -0.73 + v * (lerp(drop[0], drop[1], t) - dip * (1 - Math.abs(u))), 0];
    } });
}

function arms(R, k, pauldrons){
  for (const A of [R.armL, R.armR]){
    const s = A.side;
    k.skin('suit', [
      ...seg(0.34, [[-0.18,0.14,0.14],[0.06,0.15,0.15],[0.5,0.125,0.125],[1,0.1,0.105]]),
      ...seg(0.3, [[0.5,0.095,0.095],[1,0.08,0.08]], 0.34),
    ], { bones: [A.sh, A.el], at: [0.34], blend: 0.05, profile: chamfer(0.4) });
    if (pauldrons) k.add(loft([{ y:-0.06, w:0.21, d:0.2 }, { y:0.03, w:0.2, d:0.19 }, { y:0.08, w:0.13, d:0.15 }], chamfer(0.42)),
      s > 0 ? 'accent' : 'beskar', A.sh, [0.025*s, 0.035, 0], [0, 0, -0.32*s]);
    k.add(limb(0.24, [[0,0.11,0.105],[0.6,0.115,0.11],[1,0.098,0.095]], KEEL), 'beskar2', A.el, [0, -0.04, 0]);
    k.add(plate([[-0.04,0],[0.04,0],[0.045,-0.12],[-0.045,-0.12]], 0.02, 0.006), 'beskar', A.el, [0, -0.08, 0.058]);
    k.seam(new THREE.BoxGeometry(0.008, 0.18, 0.008), SEAM_COOL, A.el, [0, -0.16, 0.07]);
    hand(A, k, 'strap');
  }
}
