// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// OBJECTIVES: the reusable pieces a mode builds its goals from. The voice panel (a line in character over the task),
// world markers (beacons, zones, consoles), zone checks, and the objective line on the HUD (ui/hud.js reads it).
// The training grounds (game/tutorial.js) and story missions (game/mission.js) both run on these.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { enemies } from '../state.js';
import { playerPos } from '../player/helpers.js';

/* ============================================================
   THE VOICE PANEL — the line in character, then the plain task with its keys and a count
   ============================================================ */
const panel = document.getElementById('tutor');
const el = (sel) => panel.querySelector(sel);
function keycaps(keys){
  if (!keys) return '';
  return keys.split(' · ').map(g => g.split(' ').map(k => (k === '/' || k === '+') ? '<span>' + k + '</span>' : '<kbd>' + k + '</kbd>').join(''))
    .join('<span class="then">then</span>');
}
// opts.drill drops the panel low on the screen, out of the fight's way
export function showPanel(who, say, keys, task, opts = {}){
  el('.tt-who').textContent = who;
  el('.tt-say').textContent = say;
  el('.tt-keys').innerHTML = keycaps(keys);
  el('.tt-task').textContent = task || '';
  el('.tt-count').textContent = opts.count || '';
  panel.classList.toggle('done', !!opts.done);
  panel.classList.toggle('drill', !!opts.drill);
  panel.classList.add('on');
}
export function setPanelCount(text, done){
  el('.tt-count').textContent = text;
  panel.classList.toggle('done', !!done);
}
export function hidePanel(){ panel.classList.remove('on', 'done', 'drill'); }

/* ============================================================
   MARKERS — a column of light over a spot to reach (r widens the ring into a zone), and a console to slice
   ============================================================ */
export function makeBeacon(x, z, y, color, r = 1){
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 14, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.y = 7;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9 * r, 0.9 * r + 0.25, Math.max(32, Math.round(r * 24))),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.06;
  g.add(beam, ring);
  g.position.set(x, y || 0, z);
  g.userData.ring = ring; g.userData.beam = beam;
  scene.add(g);
  return g;
}
export function setMarkerColor(m, color){ m.traverse(o => { if (o.material && o.material.color && !o.userData.keep) o.material.color.setHex(color); }); }
// spin and pulse the ring (call each frame while it's up)
export function pulseMarker(m, dt, gt){
  m.userData.ring.rotation.z += dt * 1.5;
  m.userData.ring.material.opacity = 0.55 + Math.sin(gt * 4) * 0.25;
}
export function removeMarker(m){
  scene.remove(m);
  m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}
// a waist-high terminal with a lit screen, under a beacon; setMarkerColor recolours screen and beam together
export function makeConsole(x, z, yaw, color){
  const m = makeBeacon(x, z, 0, color, 1.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.6, metalness: 0.7 }));
  body.position.y = 0.55; body.userData.keep = true;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  screen.position.set(0, 0.92, 0.29); screen.rotation.x = -0.35;
  const top = new THREE.Group(); top.add(body, screen); top.rotation.y = yaw || 0;
  m.add(top);
  return m;
}

/* ============================================================
   ZONES — is the hero (or a foe) standing in it
   ============================================================ */
export function heroIn(x, z, r){ const p = playerPos(); return Math.hypot(p.x - x, p.z - z) < r; }
export function hostilesIn(x, z, r){
  let n = 0;
  for (const e of enemies) if (!e.dead && !e.converted && Math.hypot(e.group.position.x - x, e.group.position.z - z) < r) n++;
  return n;
}
export function hostilesAlive(){ let n = 0; for (const e of enemies) if (!e.dead && !e.converted) n++; return n; }

/* ============================================================
   THE OBJECTIVE LINE — what the top-left HUD shows while a mode runs objectives
   { kicker, title, status, frac (0..1, or null for no bar), warn (status in red) }; null hands the line back
   ============================================================ */
let current = null;
export function setObjectiveHud(o){ current = o; }
export function objectiveHud(){ return current; }
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
