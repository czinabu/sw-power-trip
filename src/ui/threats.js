// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Off-screen threat markers.

import * as THREE from 'three';
import { camera } from '../engine/renderer.js';
import { clamp } from '../utils.js';
import { shared, G, enemies, player } from '../state.js';

/* THREAT AWARENESS — project a world point to screen space; return the on-screen flag, a clamped edge position, and
   the CSS rotation (0°=up, clockwise) for an arrow pointing toward it. Powers the damage arc + off-screen markers. */
const _pv = new THREE.Vector3();
function threatScreen(world){
  _pv.copy(world).project(camera);
  const behind = _pv.z > 1;
  let nx = _pv.x, ny = _pv.y; if (behind){ nx = -nx; ny = -ny; }
  const onScreen = !behind && Math.abs(_pv.x) <= 0.98 && Math.abs(_pv.y) <= 0.98;
  const W = innerWidth, H = innerHeight;
  const sx = (nx*0.5+0.5)*W, sy = (1-(ny*0.5+0.5))*H;
  const deg = Math.atan2(sx - W/2, -(sy - H/2)) * 180/Math.PI;
  const m = 48;
  return { onScreen, behind, deg, ex: clamp(sx, m, W-m), ey: clamp(sy, m, H-m) };
}
const _threatMarks = [];
export function renderThreats(){
  const wrap = document.getElementById('threats'), dind = document.getElementById('dmgind');
  if (G.mode !== 'play'){ wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  // --- directional DAMAGE indicator: a red arc swung toward whatever last hit you ---
  if ((player.dmgIndT || 0) > 0 && player.hitFrom){
    const s = threatScreen(player.hitFrom);
    dind.style.opacity = Math.min(0.9, player.dmgIndT);
    dind.style.transform = 'rotate(' + s.deg.toFixed(0) + 'deg)';
  } else dind.style.opacity = '0';
  // --- off-screen markers for the genuinely dangerous foes: charging snipers, live bombers, boss/warbringer ---
  const threats = [];
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    let col = null;
    if (e.t.sniper && e.aimLine && e.aimLine.visible) col = '#ff3030';      // a marksman drawing a bead on you
    else if (e.t.bomber && (e.state === 'fuse' || e.state === 'chase')) col = '#ffae2a';   // a saboteur closing in
    else if (e.warbringer) col = '#ff3b3b';
    if (col) threats.push({ pos: e.group.position, col });
  }
  if (shared.boss && shared.boss.hp > 0) threats.push({ pos: shared.boss.group.position, col: '#ff5a5a' });
  let mi = 0;
  for (const th of threats){
    const s = threatScreen(th.pos);
    if (s.onScreen) continue;   // visible already — no marker needed
    let mk = _threatMarks[mi];
    if (!mk){ mk = document.createElement('div'); mk.className = 'threatmark'; mk.innerHTML = '<i></i>'; wrap.appendChild(mk); _threatMarks[mi] = mk; }
    mk.style.left = s.ex + 'px'; mk.style.top = s.ey + 'px';
    mk.style.transform = 'rotate(' + s.deg.toFixed(0) + 'deg)';
    mk.style.color = th.col; mk.style.opacity = '0.92';
    mi++;
  }
  for (let i = mi; i < _threatMarks.length; i++) _threatMarks[i].style.opacity = '0';
}
