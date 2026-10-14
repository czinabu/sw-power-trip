// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildEnemyMesh(): procedural enemy models.

import * as THREE from 'three';

/* ============================================================
   ENEMIES
   ============================================================ */
export function buildEnemyMesh(t){
  const g = new THREE.Group();
  const mat  = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.5, metalness: 0.55 });   // armor plate (flashes on hit)
  const dark = new THREE.MeshStandardMaterial({ color: 0x191c22, roughness: 0.75, metalness: 0.35 }); // bodyglove / joints
  const heavy = !!t.heavy;
  const w = heavy ? 1.3 : 1;   // brutes are broader through the chest & shoulders

  // pelvis
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42*w, 0.26, 0.3), dark);
  pelvis.position.y = 0.92; pelvis.castShadow = true; g.add(pelvis);
  // legs — thigh, knee guard, shin, boot. TAPERED CYLINDERS (not capsules) for the limb segments — capsules' rounded
  // end-caps are what made every foe read as a chain of balloon-animal pills; flat cylinder joints + a small armor
  // band at the knee/elbow break that up into something that reads as ARMORED LIMBS instead.
  function leg(side){
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.135*w, 0.105*w, 0.46, 7), dark);
    thigh.position.set(0.16*side, 0.62, 0); thigh.castShadow = true; g.add(thigh);
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.165*w, 0.09, 0.18), mat);
    knee.position.set(0.16*side, 0.4, 0.02); knee.castShadow = true; g.add(knee);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.115*w, 0.09*w, 0.4, 7), mat);
    shin.position.set(0.16*side, 0.22, 0.02); shin.castShadow = true; g.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19*w, 0.13, 0.34), dark);
    boot.position.set(0.16*side, 0.06, 0.07); boot.castShadow = true; g.add(boot);
  }
  leg(-1); leg(1);
  // torso — tapered waist into a broad armored chest
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.27*w, 0.31*w, 0.34, 9), dark);
  waist.position.y = 1.18; g.add(waist);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56*w, 0.5, 0.36), mat);
  chest.position.set(0, 1.58, 0); chest.castShadow = true; g.add(chest);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.34*w, 0.14, 0.3), dark);
  collar.position.set(0, 1.86, 0); g.add(collar);
  // shoulder pauldrons
  function pauldron(side){
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.17*w, 9, 7), mat);
    p.scale.set(1, 0.78, 1); p.position.set(0.36*w*side, 1.78, 0); p.castShadow = true; g.add(p);
  }
  pauldron(-1); pauldron(1);
  // arms — upper, elbow guard, forearm, fist (loose, static-ish)
  function mkArm(side){
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.105*w, 0.085*w, 0.34, 6), mat);
    upper.position.set(0.42*w*side, 1.5, 0); upper.rotation.z = 0.16*side; upper.castShadow = true; g.add(upper);
    const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.13*w, 0.1, 0.13), dark);
    elbow.position.set(0.46*w*side, 1.3, 0.02); elbow.castShadow = true; g.add(elbow);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.085*w, 0.065*w, 0.32, 6), dark);
    fore.position.set(0.47*w*side, 1.13, 0.04); fore.castShadow = true; g.add(fore);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), dark);
    fist.position.set(0.49*w*side, 0.93, 0.08); g.add(fist);
  }
  mkArm(-1);
  // RIGHT arm: melee foes (sword/maul) get an articulated arm that pivots at the shoulder
  // so they can physically rear back and swing — a clear, parryable telegraph.
  if (!t.ranged && t.weapon && t.weapon !== 'staff'){
    const arm = new THREE.Group();
    arm.position.set(0.42*w, 1.74, 0.04);     // shoulder pivot
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.105*w, 0.085*w, 0.34, 6), mat);
    upper.position.y = -0.2; upper.rotation.z = -0.16; upper.castShadow = true; arm.add(upper);
    const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.13*w, 0.1, 0.13), dark);
    elbow.position.set(0.02, -0.42, 0.03); elbow.castShadow = true; arm.add(elbow);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.085*w, 0.065*w, 0.32, 6), dark);
    fore.position.set(0.03, -0.55, 0.05); fore.castShadow = true; arm.add(fore);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), dark);
    fist.position.set(0.05, -0.74, 0.07); arm.add(fist);
    const grip = new THREE.Group(); grip.position.copy(fist.position); arm.add(grip);
    if (t.weapon === 'sword'){
      const blMat = new THREE.MeshStandardMaterial({ color: 0xc2cad6, roughness: 0.28, metalness: 0.85,
        emissive: 0x2a3340, emissiveIntensity: 0.35 });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.13), blMat);
      blade.position.y = -0.58; blade.castShadow = true; grip.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x33373d, metalness: 0.6, roughness: 0.4 }));
      guard.position.y = -0.06; grip.add(guard);
    } else {   // maul — a heavy two-block warhammer
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 7),
        new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 }));
      shaft.position.y = -0.58; shaft.castShadow = true; grip.add(shaft);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36*w, 0.34, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x3a3036, metalness: 0.7, roughness: 0.45 }));
      head.position.y = -1.1; head.castShadow = true; grip.add(head);
    }
    arm.rotation.x = -0.35;          // carried at the ready
    g.add(arm);
    g.userData.weaponArm = arm;
  } else {
    mkArm(1);
  }
  // neck + helmet head with a recessed glowing visor
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 7), dark);
  neck.position.y = 1.95; g.add(neck);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.14, 4, 8), mat);
  head.position.y = 2.16; head.castShadow = true; g.add(head);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.08), dark);
  brow.position.set(0, 2.14, 0.13); g.add(brow);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: t.eye }));
  eye.position.set(0, 2.13, 0.18); g.add(eye);
  if (heavy){   // brutes get a heavier helm crest
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.28), dark);
    crest.position.set(0, 2.3, 0); g.add(crest);
  }
  if (t.ranged){
    // a blaster rifle bridged across both fists
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.4, metalness: 0.5 }));
    gun.position.set(0.38, 1.0, 0.5); gun.castShadow = true; g.add(gun);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.2), dark);
    sight.position.set(0.38, 1.12, 0.55); g.add(sight);
  }
  if (t.fly){
    // a back JETPACK with twin glowing thrusters — the silhouette of a hovering jet trooper
    const jet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.52, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.45, metalness: 0.82 }));
    jet.position.set(0, 1.52, -0.3); jet.castShadow = true; g.add(jet);
    const thrusters = [];
    for (const sx of [-0.13, 0.13]){
      const th = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.2, 7),
        new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      th.position.set(sx, 1.2, -0.36); g.add(th); thrusters.push(th);
    }
    g.userData.thrusters = thrusters;   // pulsed in updateEnemies so the jets shimmer
  }
  if (t.staff){
    // a duelist's combat staff, held across the body — telegraphs a parryable melee
    const arm = new THREE.Group();
    arm.position.set(0.55, 1.5, 0.2);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 7),
      new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.7, metalness: 0.2 }));
    shaft.castShadow = true;
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xb0b6c0, roughness: 0.3, metalness: 0.8,
      emissive: t.eye, emissiveIntensity: 0.4 });
    const tip1 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 7), tipMat);
    tip1.position.y = 1.05;
    const tip2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 7), tipMat);
    tip2.position.y = -1.05; tip2.rotation.x = Math.PI;
    arm.add(shaft, tip1, tip2);
    arm.rotation.z = 0.5; arm.rotation.x = 0.3;
    g.add(arm);
    g.userData.staff = arm;
  }
  if (t.shield){
    // a broad deflector shield carried across the left arm, facing forward — eats frontal fire until it shatters
    const sMat = new THREE.MeshStandardMaterial({ color: 0x586b86, roughness: 0.4, metalness: 0.82, emissive: t.eye, emissiveIntensity: 0.22 });
    const shield = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.36, 0.08), sMat);
    panel.castShadow = true; shield.add(panel);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 0.11),
      new THREE.MeshBasicMaterial({ color: t.eye, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    rim.position.y = 0.68; shield.add(rim);
    const emblem = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.21, 18),
      new THREE.MeshBasicMaterial({ color: t.eye, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    emblem.position.z = 0.06; shield.add(emblem);
    shield.position.set(-0.46, 1.38, 0.46);
    g.add(shield); g.userData.shield = shield; g.userData.shieldMat = sMat;
  }
  if (t.bomber){
    // a volatile core glows in its chest — the charge. It pulses & flares as the fuse burns down.
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: t.eye }));
    core.position.set(0, 1.5, 0.22); g.add(core); g.userData.bombCore = core;
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.5 }));
    cage.position.copy(core.position); cage.rotation.x = Math.PI/2; g.add(cage);
  }
  if (t.sniper){
    // an extended long-barrel rifle + a glowing scope eye — the marksman silhouette
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.4, metalness: 0.6 }));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0.38, 1.05, 0.98); barrel.castShadow = true; g.add(barrel);
    const scope = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: t.eye }));
    scope.position.set(0.38, 1.18, 0.58); g.add(scope);
  }
  g.scale.setScalar(t.scale);
  g.userData.bodyMat = mat;
  g.userData.eyeMat = eye.material;
  g.userData.eye = eye;
  g.userData.eyeBase = eye.scale.clone();
  return g;
}
