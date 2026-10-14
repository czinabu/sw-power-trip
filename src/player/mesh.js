// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildPlayer(): the procedural player rig (Jedi + Mando parts, saber, jetpack).

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { scene } from '../engine/renderer.js';
import { player } from '../state.js';

function buildPlayer(){
  const g = player.group;
  const vis = new THREE.Group();   // everything visual lives here so flips/leans don't move the root
  g.add(vis);
  player.vis = vis;

  // Mace Windu — dark Jedi robes, deep-brown skin, a clean-shaven head
  const robeMat  = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.92 });
  const tunicMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.86 });
  const skinMat  = new THREE.MeshStandardMaterial({ color: 0x4a2e1e, roughness: 0.6 });
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0x1e150d, roughness: 0.6 });

  // hips root — the whole body hangs off this
  const hips = new THREE.Group(); hips.position.y = 1.04; vis.add(hips);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.22), darkMat);   // dark base (Jedi skirt covers it; Mando legs read clean)
  pelvis.castShadow = true; hips.add(pelvis);

  // legs — TAPERED CYLINDERS (not capsules) for the limb segments + a small knee guard, same de-capsule convention
  // buildEnemyMesh/buildBoss already use (Pass 53) — capsules' rounded end-caps read as balloon-animal pills.
  function buildLeg(side){
    const hip = new THREE.Group(); hip.position.set(0.11*side, -0.06, 0); hips.add(hip);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.4, 7), darkMat);
    upper.position.y = -0.22; upper.castShadow = true; hip.add(upper);
    const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.1), darkMat);
    kneeGuard.position.y = -0.43; hip.add(kneeGuard);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.058, 0.38, 7), darkMat);
    lower.position.y = -0.2; lower.castShadow = true; knee.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.24), darkMat);
    foot.position.set(0, -0.41, 0.05); knee.add(foot);
    return { hip, knee };
  }
  const legL = buildLeg(-1), legR = buildLeg(1);

  // robe skirt over the legs — kept SHORTER so the shins/boots (and the stance splay) read clearly;
  // its width also flares per stance in updatePlayer (wide DJEM SO vs slim SHII-CHO).
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.46, 0.66, 12, 1, true), robeMat);
  skirt.position.y = -0.32; skirt.castShadow = true; hips.add(skirt);

  // torso
  const torso = new THREE.Group(); torso.position.y = 0.16; hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.225, 0.46, 10), tunicMat);   // tapered barrel, not a pill
  chest.position.y = 0.42; chest.castShadow = true; torso.add(chest);
  // shoulder yoke + raised collar give the torso real shoulders instead of a tube
  const yoke = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 7), tunicMat);
  yoke.scale.set(1, 0.5, 0.8); yoke.position.y = 0.6; yoke.castShadow = true; torso.add(yoke);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.16, 9), robeMat);
  collar.position.y = 0.66; torso.add(collar);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.26), darkMat);
  belt.position.y = 0.13; torso.add(belt);
  const tabL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.02), robeMat);
  tabL.position.set(-0.09, 0.42, 0.21); torso.add(tabL);
  const tabR = tabL.clone(); tabR.position.x = 0.09; torso.add(tabR);
  const tabBL = tabL.clone(); tabBL.position.set(-0.09, 0.42, -0.2); torso.add(tabBL);
  const tabBR = tabL.clone(); tabBR.position.set(0.09, 0.42, -0.2); torso.add(tabBR);

  // bare head — a face the galaxy knows
  const headG = new THREE.Group(); headG.position.y = 0.78; torso.add(headG);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), skinMat);
  neck.position.y = -0.02; headG.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), skinMat);
  skull.position.y = 0.13; skull.castShadow = true; headG.add(skull);
  // clean-shaven head — a faint trimmed beard line frames the jaw, no hood
  const beard = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 12, Math.PI*0.9), darkMat);
  beard.position.set(0, 0.07, 0.045); beard.rotation.set(Math.PI*0.62, 0, Math.PI);
  headG.add(beard);

  function buildArm(side){
    const sh = new THREE.Group(); sh.position.set(0.27*side, 0.62, 0); torso.add(sh);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), tunicMat);   // deltoid / shoulder cap
    cap.scale.set(1, 0.85, 1); cap.castShadow = true; sh.add(cap);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.062, 0.3, 6), tunicMat);
    upper.position.y = -0.17; upper.castShadow = true; sh.add(upper);
    const elbowGuard = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.05, 0.085), tunicMat);
    elbowGuard.position.y = -0.32; sh.add(elbowGuard);
    const el = new THREE.Group(); el.position.y = -0.34; sh.add(el);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.05, 0.28, 6), robeMat);
    fore.position.y = -0.16; fore.castShadow = true; el.add(fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.066, 0.09, 8), darkMat);   // forearm bracer
    cuff.position.y = -0.28; el.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), skinMat);
    hand.scale.set(1, 0.85, 1.15); hand.position.y = -0.34; el.add(hand);
    return { sh, el };
  }
  const armL = buildArm(-1), armR = buildArm(1);
  armL.sh.rotation.z = 0.12; armR.sh.rotation.z = -0.12;

  // saber gripped in the right hand
  const saberHand = new THREE.Group();
  saberHand.position.y = -0.34;
  armR.el.add(saberHand);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.85, roughness: 0.3 }));
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.022, 1.55, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  blade.position.y = 0.95;
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 1.6, 8),
    new THREE.MeshBasicMaterial({ color: 0x33bbff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 0.95;
  const slight = new THREE.PointLight(0x44bbff, 8, 9);
  slight.position.y = 0.9;
  saberHand.add(hilt, blade, glow, slight);
  saberHand.rotation.z = -0.4;
  saberHand.rotation.x = 0.25;
  player.saberHand = saberHand;
  player.saberPivot = armR.sh;   // the arm drives the saber now
  player.blade = { blade, glow, light: slight };

  /* ---------- MANDALORIAN kit — hidden until you pick the bounty hunter ----------
     Each plate is parented to the bone it rides on (so it tracks the body) and
     collected in mandoParts; setHero() toggles their .visible as a group. */
  const beskar = new THREE.MeshStandardMaterial({ color: 0x9eadbd, metalness: 0.9,  roughness: 0.3 });
  const beskar2= new THREE.MeshStandardMaterial({ color: 0x5f6b78, metalness: 0.85, roughness: 0.42 });
  const charc  = new THREE.MeshStandardMaterial({ color: 0x1f242b, metalness: 0.5,  roughness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xb84327, metalness: 0.35, roughness: 0.55 });   // weathered red flash
  const visorM = new THREE.MeshStandardMaterial({ color: 0x0b0f14, metalness: 0.7, roughness: 0.2, emissive: 0x0c2630, emissiveIntensity: 0.5 });
  const cloth  = new THREE.MeshStandardMaterial({ color: 0x796a52, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
  const mandoParts = [];
  const mp = (mesh, parent) => { parent.add(mesh); mesh.visible = false; mandoParts.push(mesh); return mesh; };

  // helmet — Din-Djarin profile: domed crown, single visor, raised keel crest, side comm pods
  const helm = new THREE.Group(); helm.position.copy(headG.position); mp(helm, torso);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.175, 18, 14), beskar);
  dome.scale.set(1, 1.16, 1.08); dome.position.y = 0.15; dome.castShadow = true; helm.add(dome);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.168, 18, 14, 0, Math.PI*2, Math.PI*0.4, Math.PI*0.52), beskar2);
  face.position.set(0, 0.12, 0.02); face.scale.set(1, 1.05, 1.1); helm.add(face);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.085, 0.13), beskar2);   // narrowed jaw
  chin.position.set(0, 0.02, 0.055); helm.add(chin);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.04, 0.05), beskar);
  brow.position.set(0, 0.205, 0.145); helm.add(brow);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.058, 0.03), visorM);    // single visor slit
  visor.position.set(0, 0.15, 0.158); visor.rotation.x = -0.07; helm.add(visor);
  const visorLow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.03), visorM);
  visorLow.position.set(0, 0.1, 0.16); helm.add(visorLow);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.34, 0.05), beskar);      // raised crest up the dome
  keel.position.set(0, 0.2, 0.125); keel.rotation.x = 0.52; helm.add(keel);
  for (const sx of [-1,1]){ const ear = new THREE.Mesh(new THREE.BoxGeometry(0.032,0.085,0.075), charc); ear.position.set(0.165*sx, 0.13, 0.015); helm.add(ear); }
  const finPivot = new THREE.Group(); finPivot.position.set(-0.17, 0.24, 0.02); finPivot.rotation.z = 0.22; helm.add(finPivot);
  const finBar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.17, 0.028), charc); finBar.position.y = 0.09; finPivot.add(finBar);
  const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.03,0.04), accent); finTip.position.y = 0.18; finPivot.add(finTip);

  // chest cuirass + central keystone + collar + utility belt with pouches
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.33, 0.17), beskar);
  chestPlate.position.set(0, 0.42, 0.05); chestPlate.castShadow = true; mp(chestPlate, torso);
  const pecL = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.16,0.05), beskar2); pecL.position.set(-0.09,0.47,0.14); mp(pecL, torso);
  const pecR = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.16,0.05), beskar2); pecR.position.set(0.09,0.47,0.14); mp(pecR, torso);
  const keystone = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), accent);
  keystone.scale.set(1, 1.5, 0.5); keystone.position.set(0, 0.4, 0.15); mp(keystone, torso);
  const abdomen = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.19, 0.15), beskar2);
  abdomen.position.set(0, 0.2, 0.05); mp(abdomen, torso);
  const collarM = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.11, 12), charc);
  collarM.position.set(0, 0.62, 0); mp(collarM, torso);
  const mBelt = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.075, 0.25), charc); mBelt.position.set(0, 0.12, 0); mp(mBelt, torso);
  for (const bx of [-0.13, 0.13]){ const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.1,0.07), beskar2); pouch.position.set(bx, 0.1, 0.13); mp(pouch, torso); }

  // half-cape draped over the left shoulder
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.62, 1, 3), cloth);
  cape.position.set(-0.16, 0.4, -0.13); cape.rotation.set(0.16, 0.28, 0.04); mp(cape, torso);

  // pauldrons (red on the right) + segmented bracers
  const pauldR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 9), accent);
  pauldR.scale.set(1.15, 0.62, 1.15); pauldR.position.set(0.03, 0.05, 0); mp(pauldR, armR.sh);
  const pauldRtrim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 6, 14, Math.PI), beskar); pauldRtrim.rotation.x = Math.PI/2; pauldRtrim.position.set(0.03,0.05,0); mp(pauldRtrim, armR.sh);
  const pauldL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), beskar);
  pauldL.scale.set(1.15, 0.62, 1.15); pauldL.position.set(-0.03, 0.05, 0); mp(pauldL, armL.sh);
  for (const arm of [armL, armR]){
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.076, 0.22, 10), beskar2);
    br.position.y = -0.2; mp(br, arm.el);
    const brPlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.05), beskar); brPlate.position.set(0, -0.18, 0.055); mp(brPlate, arm.el);
  }

  // thigh plates, knee guards, armored SHIN greaves + boots, and a right-hip holster — beefs up the skinny legs
  for (const leg of [{ hip: legL.hip, knee: legL.knee }, { hip: legR.hip, knee: legR.knee }]){
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.15), beskar2); thigh.position.set(0, -0.2, 0.02); mp(thigh, leg.hip);
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.14, 0.15), beskar); knee.position.set(0, -0.02, 0.04); mp(knee, leg.knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.15), beskar2); shin.position.set(0, -0.2, 0.02); mp(shin, leg.knee);   // calf greave
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.28), charc);   boot.position.set(0, -0.41, 0.05); mp(boot, leg.knee);   // armored boot
  }
  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.17, 0.085), charc); holster.position.set(0.05, -0.3, 0.05); mp(holster, legR.hip);

  // JETPACK — a lore-accurate Mandalorian pack (Boba/Death-Watch silhouette): a ribbed central housing, twin DOMED
  // side thrusters, a central SPIRE/antenna, an accent spine, and twin bell nozzles. (jet group's -z faces the camera.)
  const jet = new THREE.Group(); jet.position.set(0, 0.46, -0.36); mp(jet, torso);
  const jback = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.58, 0.18), charc); jback.castShadow = true; jet.add(jback);   // base housing
  const jcore = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.1), beskar2); jcore.position.z = -0.1; jet.add(jcore); // raised central block (toward camera)
  // two vertical ribbed "fuel-rod" panels in the centre — the iconic pack detail
  for (const sx of [-1, 1]){
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.06), beskar); rod.position.set(0.055*sx, 0, -0.16); jet.add(rod);
    for (let k = 0; k < 5; k++){ const rib = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.012, 0.03), charc); rib.position.set(0.055*sx, -0.17 + k*0.085, -0.19); jet.add(rib); }
  }
  const jspine = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.46, 0.03), accent); jspine.position.set(0, 0, -0.2); jet.add(jspine);   // accent spine
  // twin flanking THRUSTER TANKS with domed bullet tops + a tiny finial
  for (const sx of [-1, 1]){
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 16), beskar2);
    tank.position.set(0.2*sx, -0.02, 0); tank.castShadow = true; jet.add(tank);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI*2, 0, Math.PI*0.5), beskar);
    dome.position.set(0.2*sx, 0.23, 0); jet.add(dome);
    const nub = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), beskar); nub.position.set(0.2*sx, 0.33, 0); jet.add(nub);
  }
  // side COMM ANTENNA — a thin rod + tip (always present), and a central MOUNT CAP the missile seats on
  const antRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.3, 6), beskar); antRod.position.set(0.13, 0.46, -0.02); jet.add(antRod);
  const antTip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 6), accent); antTip.position.set(0.13, 0.63, -0.02); jet.add(antTip);
  const jcap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, 0.1, 12), beskar); jcap.position.y = 0.32; jet.add(jcap);
  // LOADED MISSILE — the Boba back-launcher ordnance: it only appears once the JETPACK MISSILE ability is UNLOCKED,
  // and it visibly LAUNCHES (vanishes) when fired (Z), returning when the ability recharges. Toggled in updatePlayer.
  const jmiss = new THREE.Group(); jmiss.position.set(0, 0.43, -0.03);
  jmiss.add(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.3, 12), beskar2));                                   // body
  const mn = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.13, 12), accent); mn.position.y = 0.215; jmiss.add(mn);        // nose cone
  const mc = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.05, 12), charc); mc.position.y = -0.16; jmiss.add(mc); // tail collar
  for (let fi = 0; fi < 3; fi++){ const a = fi/3*Math.PI*2; const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.06), beskar);
    fin.position.set(Math.cos(a)*0.06, -0.12, Math.sin(a)*0.06); fin.rotation.y = -a; jmiss.add(fin); }
  jet.add(jmiss); jmiss.visible = false; player.jetMissileMesh = jmiss;
  // shoulder straps tying the pack to the chest so it reads as worn, not floating
  for (const sx of [-1, 1]){
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.04), charc);
    strap.position.set(0.13*sx, 0.16, 0.16); strap.rotation.x = -0.34; mp(strap, torso);
  }
  // bottom rocket NOZZLES — bell-shaped, splayed slightly outward
  const nozzles = [];
  for (const sx of [-1, 1]){
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.17, 12), beskar);
    noz.position.set(0.2*sx, -0.35, 0.01); noz.rotation.z = -0.1*sx; jet.add(noz);
    const glowN = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.025, 0.13, 8),
      new THREE.MeshBasicMaterial({ color: 0x59c6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowN.position.set(0.2*sx - 0.02*sx, -0.47, 0.01); glowN.rotation.z = -0.1*sx; jet.add(glowN); nozzles.push(glowN);
  }
  player.jetGlow = nozzles;
  // DIEGETIC FUEL GAUGE — twin LED strips on the side-tanks' rear faces (the side the camera sees). Toned DOWN
  // (smaller/dimmer) and set WIDER apart (one per tank) per request. Fills bottom→top; cyan → amber → red when low.
  const fuelSegs = [], SEG_N = 6;
  for (const sx of [-1, 1]){
    for (let i = 0; i < SEG_N; i++){
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.02),
        new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      seg.position.set(0.2*sx, -0.17 + i*0.072, -0.105);   // on each flanking tank's rear face
      jet.add(seg);
      fuelSegs.push({ mesh: seg, thr: i / SEG_N });
    }
  }
  player.jetFuelSegs = fuelSegs;

  // ---- BLASTER PISTOL — a proper sidearm silhouette: slide, frame, barrel, sight, trigger guard ----
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x16191e, metalness: 0.6, roughness: 0.4 });
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x8a929c, metalness: 0.85, roughness: 0.3 });
  function buildPistol(){
    const p = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.15, 0.07), gunDark); grip.rotation.x = 0.34; grip.position.y = -0.02; p.add(grip);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.24), gunDark); frame.position.set(0, 0.09, 0.07); p.add(frame);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.05, 0.26), gunMetal); slide.position.set(0, 0.135, 0.07); p.add(slide);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.16, 10), gunMetal); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.115, 0.26); p.add(barrel);
    const emit = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.03, 8), new THREE.MeshBasicMaterial({ color: 0xffb84a })); emit.rotation.x = Math.PI/2; emit.position.set(0, 0.115, 0.33); p.add(emit);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.03), gunMetal); sight.position.set(0, 0.165, 0.18); p.add(sight);
    const tguard = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 10, Math.PI), gunDark); tguard.rotation.set(0, 0, 0); tguard.position.set(0, 0.05, 0.12); p.add(tguard);
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.04), accent); flash.position.set(0, 0.115, 0.07); p.add(flash);
    return p;
  }
  // the raised aim pose tilts the forearm ~1.3rad back, which used to swing the barrel skyward;
  // pre-rotate the guns forward so the barrel points OUT at the reticle instead of straight up
  const pistolL = buildPistol(); pistolL.position.y = -0.34; pistolL.rotation.x = 1.15; armL.el.add(pistolL);
  const pistolR = buildPistol(); pistolR.position.y = -0.34; pistolR.rotation.x = 1.15; armR.el.add(pistolR);

  // ---- DISRUPTOR — a long TWO-HANDED rifle with a real scope and electro-prongs at the muzzle (the spear tip) ----
  const rifle = new THREE.Group(); rifle.position.set(0, -0.34, 0); rifle.rotation.x = 1.15; armR.el.add(rifle);
  rifle.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.18), gunDark)).position.set(0, 0.06, -0.14);              // stock
  rifle.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.52), gunMetal)).position.set(0, 0.1, 0.16);              // receiver
  const rBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.6, 10), gunMetal); rBar.rotation.x = Math.PI/2; rBar.position.set(0, 0.11, 0.56); rifle.add(rBar);
  for (const sx of [-1, 1]){ const prong = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.16, 6), gunMetal); prong.rotation.x = -Math.PI/2; prong.position.set(0.028*sx, 0.11, 0.9); rifle.add(prong); }
  const rProngGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); rProngGlow.position.set(0, 0.11, 0.92); rifle.add(rProngGlow);
  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 12), gunDark); scopeTube.rotation.x = Math.PI/2; scopeTube.position.set(0, 0.185, 0.16); rifle.add(scopeTube);
  rifle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0x66ddff }))).position.set(0, 0.185, 0.07);   // lens
  const rGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), gunDark); rGrip.rotation.x = 0.3; rGrip.position.set(0, 0.0, 0.04); rifle.add(rGrip);
  player.rifleMesh = rifle; player.rifleProngGlow = rProngGlow;

  // ---- THE DARKSABER — black blade, white-violet edge (a real weapon now: visible while equipped) ----
  const darkHand = new THREE.Group(); darkHand.position.y = -0.34; darkHand.visible = false; darkHand.rotation.set(0.25, 0, -0.4); armR.el.add(darkHand);
  const dHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.28, 8), new THREE.MeshStandardMaterial({ color: 0x0c0d11, metalness: 0.85, roughness: 0.28 }));
  const dPommel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2030, metalness: 0.7, roughness: 0.4 })); dPommel.position.y = -0.16;
  const dBlade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.18, 0.02), new THREE.MeshBasicMaterial({ color: 0x07060c })); dBlade.position.y = 0.72;
  const dEdge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.24, 0.012), new THREE.MeshBasicMaterial({ color: 0xe7dcff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); dEdge.position.y = 0.72;
  const dGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.02), new THREE.MeshBasicMaterial({ color: 0x9a5cff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })); dGlow.position.y = 0.72;
  const dLight = new THREE.PointLight(0x9a6cff, 6, 7); dLight.position.y = 0.7;
  darkHand.add(dHilt, dPommel, dGlow, dEdge, dBlade, dLight);
  player.darksaberMesh = darkHand; player.darkLight = dLight;
  player.pistols = { L: pistolL, R: pistolR };   // weapon meshes are shown/hidden by syncWeaponMesh(), not setHero

  player.mandoParts = mandoParts;
  player.headBare = [skull, beard];

  player.rig = { hips, torso, head: headG, skirt, legL, legR, armL, armR };
  vis.scale.setScalar(1.18);

  // swing arc flash — centred on the FORWARD direction (thetaStart shifted by -90°), not the player's left
  const arc = new THREE.Mesh(new THREE.RingGeometry(0.9, CFG.player.hitRadius, 26, 1, -Math.PI/2 - 1.2, 2.4),
    new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  arc.rotation.x = -Math.PI/2;
  arc.position.y = 1.5;
  g.add(arc);
  player.arcMesh = arc;

  scene.add(g);
}
buildPlayer();
