// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// REVIVE: a body that's DOWNED instead of dead waits for someone to stand by it and get it up. Generic on purpose:
// the hero and the squadmates (allies/squad.js) use it now, and the online co-op partner plugs in as one more reviver.
//
//   a DOWNED BODY: { kind: 'hero' | 'ally', pos(): Vector3, need (s of channel to get it up), bleed (s until it's lost,
//                    Infinity = never), selfUp (s until it rises on its own, Infinity = never), onUp(), onLost() }
//   a REVIVER:     { kind: 'hero' | 'ally' | 'partner', pos: Vector3, hitAt (G.gt of its last hit) } — anything standing
//                  by a downed body. Who may get whom up is WHO below.
// The rules live in data/allies.js (REVIVE).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { S } from '../audio/sfx.js';
import { G, player, keys } from '../state.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { REVIVE } from '../data/allies.js';
import { showBanner } from '../ui/banners.js';
import { killHero } from '../player/damage.js';

const WHO = { hero: { ally: 1, partner: 1 }, ally: { hero: 1, partner: 1 } };
export const downed = [];
// anything that can stand in as a reviver for the hero registers a check here (the squad does: allies/squad.js),
// so the killing blow knows whether going down is a second chance or the end
const heroHelp = [];
export function addHeroReviver(fn){ heroHelp.push(fn); }

const ringGeo = new THREE.RingGeometry(0.95, 1.12, 40), discGeo = new THREE.CircleGeometry(0.95, 40);
function marker(color){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  const fill = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
  ring.rotation.x = fill.rotation.x = -Math.PI / 2; fill.position.y = 0.01;
  g.add(ring, fill); g.userData.fill = fill;
  g.scale.setScalar(REVIVE.radius / 1.1);
  scene.add(g);
  return g;
}
function dropMarker(b){ if (b.mark){ scene.remove(b.mark); b.mark.children.forEach(m => m.material.dispose()); b.mark = null; } }

export function goDown(body){
  body.prog = 0; body.t = 0;
  body.mark = marker(body.kind === 'hero' ? 0xff5a4a : 0x7bffae);
  downed.push(body);
  return body;
}
export function getUp(body, how){
  const i = downed.indexOf(body);
  if (i < 0) return;
  downed.splice(i, 1); dropMarker(body);
  body.onUp(how);
}
export function clearDowned(){
  for (const b of downed) dropMarker(b);
  downed.length = 0;
  if (player.downed){ player.downed = null; if (player.vis){ player.vis.rotation.x = 0; player.vis.position.y = 0; } }
}

/* THE HERO — a killing blow with help at hand drops you instead (player/damage.js asks here first). One second
   chance a wave (or mission objective): G.reviveLeft, refilled by the squad when a wave is cleared. */
export function heroCanGoDown(){
  return !G.training && !(G.reviveLeft <= 0) && G.reviveLeft != null && heroHelp.some(f => f());
}
export function downHero(){
  G.reviveLeft--;
  player.hp = 0;
  for (const k in keys) keys[k] = false;   // nothing held carries through the fall
  player.blockHeld = false; player.firing = false; player.trigHeld = false; player.zoom = false;
  const R = REVIVE.hero;
  player.downed = goDown({
    kind: 'hero', pos: () => playerPos(), need: R.time, bleed: R.bleed, selfUp: Infinity,
    onUp(){
      player.downed = null;
      player.hp = Math.round(maxHp() * R.hp);
      player.reviveGuardT = G.gt + R.guard;
      if (player.vis){ player.vis.rotation.x = 0; player.vis.position.y = 0; }
      const p = playerPos();
      burst(V3(p.x, 1.2, p.z), 0x7bffae, 18, 6, 5); floater(V3(p.x, 1.4, p.z), 'BACK ON YOUR FEET', '#7bffae'); S.reward(1);
    },
    onLost(){ player.downed = null; if (player.vis){ player.vis.rotation.x = 0; } killHero(); },
  });
  G.slowmo = 0.35; G.slowmoT = 0.5; G.shake = Math.max(G.shake, 0.6);
  showBanner('YOU ARE DOWN', G.reviveLeft > 0 ? 'Hold on. Your squad is coming.' : 'Hold on. Your squad is coming. This is your last chance.', 2.2);
}
// a blow on a downed hero doesn't hurt, it drains the time left
export function hitDownedHero(){ if (player.downed) player.downed.bleed -= 1; }

/* every frame (after the hero moves): run the channels, the bleed-outs and the self-recoveries. revivers is the list
   of who's standing this frame (the squad hands in its own) */
export function updateRevive(dt, revivers){
  const pp = playerPos();
  const all = revivers.slice();
  if (G.mode === 'play' && !player.downed) all.push({ kind: 'hero', pos: pp, hitAt: player.lastHurt });
  for (let i = downed.length - 1; i >= 0; i--){
    const b = downed[i], p = b.pos();
    b.t += dt;
    let near = null;
    for (const r of all){
      if (!WHO[b.kind][r.kind]) continue;
      if (Math.hypot(r.pos.x - p.x, r.pos.z - p.z) < REVIVE.radius){ near = r; break; }
    }
    if (near){
      b.prog += dt;
      if (near.hitAt != null && G.gt - near.hitAt < dt * 1.5) b.prog = Math.max(0, b.prog - REVIVE.hitSlow);   // a hit costs the reviver ground
      b.by = near.kind;
    } else { b.prog = Math.max(0, b.prog - dt * 0.5); b.by = null; }
    if (!near && b.kind === 'hero') b.bleed -= dt;
    b.mark.position.set(p.x, Math.max(0.05, p.y + 0.05), p.z);
    const k = Math.min(1, b.prog / b.need);
    b.mark.userData.fill.scale.setScalar(Math.max(0.001, k));
    b.mark.children[0].material.opacity = 0.55 + Math.sin(G.gt * 6) * 0.3;
    if (b.prog >= b.need){ getUp(b, near ? near.kind : 'self'); continue; }
    if (b.t >= b.selfUp){ getUp(b, 'self'); continue; }
    if (b.bleed <= 0){ downed.splice(i, 1); dropMarker(b); b.onLost(); }
  }
  // the hero lies where they fell (laid over the animation, which ran already this frame)
  if (player.downed && player.vis){
    const b = player.downed; b.lay = Math.min(1, (b.lay || 0) + dt * 3);
    const k = b.lay * b.lay * (3 - 2 * b.lay);
    player.vis.rotation.x = -1.35 * k; player.vis.rotation.z = 0; player.vis.position.y = 0.22 * k;
  }
}
// for the HUD: how the hero's own revive is going, or null
export function heroDownState(){
  const b = player.downed;
  return b ? { left: Math.max(0, b.bleed), prog: Math.min(1, b.prog / b.need), by: b.by } : null;
}
