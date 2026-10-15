// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Model lab (dev only: `npm run dev`, then open /tools/model-lab.html).
// Lines up both heroes in a few key poses under the game's own lights, so model and style changes can be judged
// side by side without playing. URL params: ?style=shard|ink|forged  &view=front|back  &orbit=1 (slow turntable).

import * as THREE from 'three';
import { scene, camera, composer, renderer } from '../src/engine/renderer.js';
import { buildHeroModel } from '../src/player/model/index.js';
import { STYLE_DEFS } from '../src/player/model/styles.js';

const q = new URLSearchParams(location.search);
const STYLE = q.get('style') || 'forged';
const VIEW = q.get('view') || 'front';

scene.background = new THREE.Color(0x0d1016);
scene.fog = new THREE.Fog(0x0d1016, 14, 30);
const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

/* ---- poses: joint angles lifted from animation.js (guards, swing, Force push, Mando aim, flight) ---- */
const POSES = {
  jedi_guard: {
    label: 'Djem So guard', hero: 'jedi',
    armR: { sh: [-1.05, -0.95, -0.5], el: [-1.2, 0, 0] }, armL: { sh: [-0.45, 0.3, 0.12], el: [-0.85, 0, 0] },
    saber: [0.15, 0, -0.35], torso: [0, 0.05, 0],
    legL: { hip: [0.05, 0, -0.3], knee: [-0.25, 0, 0] }, legR: { hip: [-0.05, 0, 0.3], knee: [-0.25, 0, 0] }, drop: -0.05,
  },
  jedi_swing: {
    label: 'Mid-swing', hero: 'jedi',
    armR: { sh: [-1.35, -0.75, -0.6], el: [-0.12, 0.2, 0] }, armL: { sh: [-0.85, 0.43, 0.12], el: [-0.67, 0, 0] },
    saber: [0.6, 0.4, -1.3], torso: [0, 0.4, 0], torsoZ: 0.12, visY: 0.25,
    legL: { hip: [-0.55, 0, -0.05], knee: [-0.35, 0, 0] }, legR: { hip: [0.4, 0, 0.08], knee: [-0.55, 0, 0] }, drop: -0.08,
  },
  jedi_push: {
    label: 'Force push', hero: 'jedi',
    armR: { sh: [-0.42, 0.05, -0.12], el: [-0.5, 0, 0] }, armL: { sh: [-1.55, 0.12, 0.12], el: [-0.12, 0, 0] },
    saber: [0.25, 0, -0.4], torso: [0, 0.16, 0], torsoZ: 0.22, visX: 0.12,
    legL: { hip: [-0.45, 0, -0.08], knee: [-0.3, 0, 0] }, legR: { hip: [0.35, 0, 0.08], knee: [-0.4, 0, 0] }, drop: -0.06,
  },
  mando_dual: {
    label: 'Dual blasters', hero: 'mando', weapon: 'dual',
    armR: { sh: [-1.45, -0.12, -0.18], el: [-0.15, 0, 0] }, armL: { sh: [-0.65, -0.45, 0.2], el: [-0.35, 0, 0] },
    torso: [0, 0, 0], legL: { hip: [-0.1, 0, -0.12], knee: [-0.1, 0, 0] }, legR: { hip: [0.1, 0, 0.12], knee: [-0.1, 0, 0] },
  },
  mando_rifle: {
    label: 'Disruptor aim', hero: 'mando', weapon: 'disruptor',
    armR: { sh: [-1.45, -0.12, -0.18], el: [-0.15, 0, 0] }, armL: { sh: [-1.45, -0.16, 0.12], el: [-0.55, 0, 0] },
    torso: [0, -0.1, 0], legL: { hip: [-0.25, 0, -0.1], knee: [-0.15, 0, 0] }, legR: { hip: [0.2, 0, 0.1], knee: [-0.25, 0, 0] },
  },
  mando_fly: {
    label: 'Jetpack flight', hero: 'mando', fly: true, yaw: 1.25,
    armR: { sh: [-2.26, -0.14, 0.16], el: [-0.22, 0, 0] }, armL: { sh: [-2.26, 0.14, -0.16], el: [-0.22, 0, 0] },
    torso: [0, 0, 0], head: [-1.15, 0, 0], visX: 0.9, lift: 0.75,
    legL: { hip: [0.05, 0, -0.04], knee: [-0.15, 0, 0] }, legR: { hip: [-0.05, 0, 0.04], knee: [-0.3, 0, 0] },
  },
};

function figure(poseName){
  const P = POSES[poseName];
  const t = { group: new THREE.Group() };
  t.group.add(buildHeroModel(t, STYLE));
  const R = t.rig, mando = P.hero === 'mando';
  for (const m of t.mandoParts) m.visible = mando;
  for (const m of t.headBare) m.visible = !mando;
  R.skirt.visible = !mando;
  t.saberHand.visible = !mando;
  t.pistols.L.visible = mando && P.weapon === 'dual';
  t.pistols.R.visible = mando && (P.weapon === 'dual' || P.weapon === 'single');
  t.rifleMesh.visible = mando && P.weapon === 'disruptor';
  const set = (o, v) => v && o.rotation.set(v[0], v[1], v[2]);
  for (const s of ['armL', 'armR']){ set(R[s].sh, P[s].sh); set(R[s].el, P[s].el); }
  for (const s of ['legL', 'legR']){ set(R[s].hip, P[s].hip); set(R[s].knee, P[s].knee); }
  set(R.torso, P.torso); set(R.head, P.head); set(t.saberHand, P.saber);
  if (P.torsoZ) R.torso.position.z = P.torsoZ;
  if (P.drop) R.hips.position.y += P.drop;
  t.vis.rotation.set(P.visX || 0, P.visY || 0, 0);
  if (P.lift) t.vis.position.y = P.lift;
  if (P.fly){ for (const g of t.jetGlow) g.material.opacity = 0.9; }
  t.blade.light.intensity = 2.5;   // the saber's real light floods a close-up; keep it low so the model reads
  t.yaw = P.yaw || 0;
  return t;
}

const HERO = q.get('hero');   // jedi | mando | (both)
const ORDER = Object.keys(POSES).filter(n => !HERO || POSES[n].hero === HERO);
const figs = ORDER.map((name, i) => {
  const f = figure(name);
  f.group.position.x = (i - (ORDER.length - 1) / 2) * (HERO ? 1.6 : 1.75);
  f.group.rotation.y = (VIEW === 'back' ? Math.PI + 0.35 : -0.35) + f.yaw;
  scene.add(f.group);
  return f;
});

camera.fov = 30;
if (HERO){ camera.position.set(0, 2.2, 8.2); camera.lookAt(0, 1.3, 0); } else { camera.position.set(0, 2.3, 10.6); camera.lookAt(0, 1.25, 0); } camera.updateProjectionMatrix();
// a soft fill from the camera side: the game shows the hero from behind, the lab shows faces
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55); fill.position.set(-4, 5, 12); scene.add(fill);
const cap = document.getElementById('cap');
cap.innerHTML = ORDER.map(n => `<span>${POSES[n].label}</span>`).join('');
const labels = [...cap.children];
function placeLabels(){
  const v = new THREE.Vector3();
  figs.forEach((f, i) => {
    v.set(f.group.position.x, 0, 0).project(camera);
    labels[i].style.cssText = `position:fixed;left:${(v.x * 0.5 + 0.5) * innerWidth}px;transform:translateX(-50%);bottom:24px`;
  });
}
document.getElementById('bar').innerHTML = Object.entries(STYLE_DEFS).map(([k, d]) =>
  `<button class="${k === STYLE ? 'on' : ''}" onclick="location.search='?style=${k}&view=${VIEW}&hero=${HERO || ''}'">${d.label}</button>`).join('')
  + `<button onclick="location.search='?style=${STYLE}&hero=${HERO || ''}&view=${VIEW === 'back' ? 'front' : 'back'}'">${VIEW === 'back' ? 'Front' : 'Back'} view</button>`;

const orbit = q.get('orbit') === '1';
renderer.setAnimationLoop(t => {
  if (orbit) for (const f of figs) f.group.rotation.y = t * 0.0004;
  placeLabels();
  composer.render();
});
window.LAB = { figs, POSES, scene, camera };
