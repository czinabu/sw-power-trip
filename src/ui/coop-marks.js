// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP SCREEN MARKS: a chip that sits over a spot in the world (a downed partner, a ping), or, when that spot is
// off-screen or behind you, pinned to the screen edge with an arrow pointing the way to turn. The same edge rule as the
// objective waypoint (ui/hud.js renderWaypoint).

import * as THREE from 'three';
import { camera } from '../engine/renderer.js';

// each seat's colour: the host gold, the guests blue, green and pink (the ping marker and its chip, the name tag's edge)
export const SEAT_COLORS = [0xffd24a, 0x5ac8ff, 0x7bffae, 0xff8ad8];
export const seatCss = (slot) => '#' + (SEAT_COLORS[slot] ?? SEAT_COLORS[1]).toString(16).padStart(6, '0');

export function makeChip(cls){
  const el = document.createElement('div');
  el.className = 'coopchip ' + (cls || '');
  el.innerHTML = '<b class="cc-arrow">▲</b><i class="cc-dot"></i><span class="cc-t"></span><span class="cc-d"></span>';
  document.getElementById('hud').appendChild(el);
  return el;
}

const _v = new THREE.Vector3();
// put the chip over `world` (a Vector3), with its text and, when it isn't next to you, the distance
export function placeChip(el, world, text, dist, color){
  _v.copy(world).project(camera);
  let x = _v.x, y = _v.y;
  const behind = _v.z > 1;
  if (behind){ x = -x; y = -y; }   // behind the camera: flip so it points the way to turn
  const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.85;
  if (off){ const k = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85) || 1; x /= k; y /= k; if (behind) y = Math.min(y, -0.85); }
  el.style.left = ((x + 1) / 2 * 100).toFixed(2) + '%';
  el.style.top = ((1 - y) / 2 * 100).toFixed(2) + '%';
  el.classList.toggle('edge', off);
  if (off) el.querySelector('.cc-arrow').style.transform = 'rotate(' + (Math.atan2(x, y) * 180 / Math.PI).toFixed(0) + 'deg)';
  if (color) el.style.setProperty('--cc', color);
  const t = el.querySelector('.cc-t'); if (t.textContent !== text) t.textContent = text;
  const d = el.querySelector('.cc-d'), ds = dist >= 6 ? Math.round(dist) + ' m' : ''; if (d.textContent !== ds) d.textContent = ds;
  el.style.display = 'block';
}
export const hideChip = (el) => { if (el) el.style.display = 'none'; };
