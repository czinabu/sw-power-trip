// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PING (N, or LB + D-pad up on a pad): mark the spot or the foe under your crosshair for everyone in the room. Each
// player's ping is a beam and ring in their seat's colour where it landed (riding the foe, if it was one), and a chip
// over it, pinned to the screen edge with an arrow when it's off-screen. One ping per player at a time: a new one moves
// it. With nobody else in the room it still shows for you (a habit you can practise solo, in every mode).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, shared, enemies } from '../state.js';
import { crosshairPoint, lastAim } from '../player/aim.js';
import { playerPos } from '../player/helpers.js';
import { worldKey } from '../player/players.js';
import { sfx } from '../audio/sfx.js';
import { SEAT_COLORS, seatCss, makeChip, placeChip, hideChip } from '../ui/coop-marks.js';
import { net, on, send, connected } from './session.js';

const PING = { life: 6, gap: 0.6, beam: 7 };   // seconds a ping stays up · the shortest gap between your own · beam height (m)
const pings = new Map();   // slot -> { pos, foe, until, mark, chip }
let lastAt = -9;
const r2 = (n) => Math.round(n * 100) / 100;

function makeMark(color){
  const g = new THREE.Group();
  const mat = (o) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PING.beam, 6, 1, true), mat(0.55));
  beam.position.y = PING.beam / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32), mat(0.85));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
  g.add(beam, ring); g.userData.ring = ring;
  g.renderOrder = 6;
  scene.add(g);
  return g;
}

const foeBy = (n) => n === 'B' ? shared.boss : n != null ? enemies.find(e => e.nid === n && !e.dead) || null : null;

function place(slot, x, y, z, foeId){
  if (![x, y, z].every(Number.isFinite)) return;
  let P = pings.get(slot);
  if (!P){ P = { pos: new THREE.Vector3(), mark: makeMark(SEAT_COLORS[slot] ?? SEAT_COLORS[1]), chip: makeChip('ping') }; pings.set(slot, P); }
  P.pos.set(x, y, z); P.foe = foeBy(foeId); P.until = G.gt + PING.life; P.born = G.gt;
  sfx(1320, 0.07, 'triangle', 0.04, 1760); setTimeout(() => sfx(1760, 0.08, 'triangle', 0.035, 1980), 70);   // a bright two-note blip
}

// N: ping what's under the crosshair (the Mando through his reticle's offset)
export function pingHere(){
  if (G.mode !== 'play' || G.paused || G.gt - lastAt < PING.gap) return;
  lastAt = G.gt;
  const p = crosshairPoint(G.hero === 'mando' ? player.aimOff.x : 0, G.hero === 'mando' ? player.aimOff.y : 0);
  const t = lastAim.target, id = t ? (t === shared.boss ? 'B' : t.nid ?? null) : null;
  const at = t && t.group ? t.group.position : p;
  place(net.slot || 0, at.x, at.y, at.z, id);
  if (connected()) send({ t: 'ping', x: r2(at.x), y: r2(at.y), z: r2(at.z), n: id, w: worldKey() });
}

on('ping', (m) => {
  if (G.mode !== 'play' || (m.w && m.w !== worldKey())) return;   // pinged in another arena: nothing to point at here
  place(m.from || 0, m.x, m.y, m.z, m.n);
});

// every frame: follow a pinged foe, fade out, and keep the chip over it (or on the screen edge)
export function updatePings(){
  const pp = playerPos();
  for (const [slot, P] of pings){
    const live = G.mode === 'play' && G.gt < P.until;
    P.mark.visible = live;
    if (!live){ hideChip(P.chip); continue; }
    if (P.foe && (P.foe.dead || (P.foe === shared.boss && !(P.foe.hp > 0)))) P.foe = null;   // it died: the mark stays where it fell
    if (P.foe && Number.isFinite(P.foe.group.position.x)) P.pos.copy(P.foe.group.position);
    P.mark.position.set(P.pos.x, P.pos.y, P.pos.z);
    const age = G.gt - P.born, k = Math.min(1, age / 0.25), fade = Math.min(1, (P.until - G.gt) / 0.8);
    P.mark.userData.ring.scale.setScalar(0.4 + k * 0.6 + Math.sin(G.gt * 7) * 0.06);
    P.mark.children.forEach(c => { c.material.opacity = (c === P.mark.userData.ring ? 0.85 : 0.55) * fade; });
    const mine = slot === (net.slot || 0), d = Math.hypot(P.pos.x - pp.x, P.pos.z - pp.z);
    const who = mine ? 'YOUR PING' : 'PLAYER ' + (slot + 1);
    const what = P.foe ? (P.foe === shared.boss ? 'BOSS' : 'ENEMY') : 'HERE';
    _top.set(P.pos.x, P.pos.y + (P.foe ? 2.9 : 1.8), P.pos.z);
    placeChip(P.chip, _top, who + ' · ' + what, d, seatCss(slot));
    P.chip.style.opacity = fade.toFixed(2);
  }
}
const _top = new THREE.Vector3();
// for the co-op smoke test: the pings up now, by seat
export const pingInfo = () => [...pings].filter(([, P]) => P.mark.visible).map(([slot, P]) => ({ slot, foe: P.foe ? (P.foe.nid ?? 'B') : null, x: r2(P.pos.x), z: r2(P.pos.z) }));
