// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SQUAD: friendly troopers who fight beside the hero (clone troopers for the Jedi, Mandalorian warriors for the
// Mando). They follow you, or hold the spot you point at (H), shoot the rank and file, take fire, go down and get up.
// The tuning and the balance rules are data/allies.js; who calls them in is the mode (a mission's `squad`, the sandbox
// panel, survival's REINFORCEMENTS power).
//
// Squadmates live in their own list, not in `enemies`, so nothing the hero throws can hurt them and nothing that
// counts foes counts them. The foes' side of it is in enemies/ai.js (foeAllyTarget) and enemies/bolts.js (allySweep).

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, dampAngle } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, bolts, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { SCALE } from '../data/coop.js';
import { heroesHere } from '../player/players.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { sweepHit } from '../enemies/bodyshape.js';
import { fireBolt } from '../enemies/bolts.js';
import { segBlockedBySolids, clampToArena, collideSolids, findClearSpawn } from '../world/collision.js';
import { navSteer, navClearance } from '../enemies/nav.js';
import { diffDmgMul } from '../data/difficulty.js';
import { SQUAD, FODDER, REVIVE } from '../data/allies.js';
import { showBanner } from '../ui/banners.js';
import { makeBeacon, removeMarker, pulseMarker } from '../game/objectives.js';
import { goDown, getUp, downed, addHeroReviver, updateRevive, heroDownState } from '../game/revive.js';
import { MISSION_COLOR } from '../data/missions.js';

export const allies = [];
// the squad's standing order: 'follow' (on me) or 'hold' (at holdAt); fYaw is the formation's facing, eased after yours
const SQ = { order: 'follow', holdAt: null, beacon: null, fYaw: 0, fighting: false, saidYours: -99, tipped: false };
const steer = { x: 0, z: 0 };
const diffKey = () => (G.diff in SQUAD.dmg ? G.diff : 'knight');
const standing = a => a.state !== 'down';
export const isFodder = e => !!FODDER[e.type] && !e.champion && !e.warbringer;
export const squadSize = () => allies.length;
export const squadStanding = () => allies.filter(standing).length;
// squadmates standing inside a zone (a mission's hold or capture post counts them)
export const squadIn = (x, z, r) => allies.filter(a => standing(a) && Math.hypot(a.group.position.x - x, a.group.position.z - z) < r).length;

/* ============================================================
   CALLING THEM IN
   ============================================================ */
// add the next squadmate on the hero's roster (up to SQUAD.max), at `at` or just behind the hero
export function addSquadmate(at){
  if (allies.length >= SQUAD.max) return null;
  const roster = SQUAD.roster[G.hero] || SQUAD.roster.jedi;
  const def = roster.find(d => !allies.some(a => a.def === d)) || roster[allies.length % roster.length];
  const role = SQUAD.roles[def.role];
  const t = { model: def.model, color: def.color, eye: def.eye, cloth: def.cloth, scale: def.scale || 1, ranged: true };
  const g = buildEnemyMesh(t);
  const pp = playerPos(), fx = Math.sin(G.yaw), fz = Math.cos(G.yaw);
  const want = at || { x: pp.x - fx * 3 + rand(-2, 2), z: pp.z - fz * 3 + rand(-2, 2) };
  const s = findClearSpawn(want.x, want.z, 0.9);
  g.position.set(s.x, 0, s.z); g.rotation.y = G.yaw;
  scene.add(g);
  // a small diamond over the head marks a friend at a glance (and turns red while it's down)
  const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({ color: MISSION_COLOR[G.hero], toneMapped: false, depthTest: false, transparent: true }));
  tag.renderOrder = 998; scene.add(tag);
  const a = { def, name: def.name, role, t, group: g, tag, hp: role.hp, maxHp: role.hp, state: 'move', slot: allies.length,
              mv: { x: 0, z: 0 }, fireT: rand(0.5, 1.5), burstLeft: 0, burstT: 0, target: null, seekT: 0, hitAt: -99,
              flash: 0, body: null, stuckT: 0, sideT: 0, side: 1, lastX: s.x, lastZ: s.z };
  allies.push(a);
  if (G.reviveLeft == null) refill();
  return a;
}
export function spawnSquad(n, at){
  for (let i = 0; i < n; i++) addSquadmate(at && { x: at[0] + (i % 2 ? 1.6 : -1.6) * (1 + (i >> 1)), z: at[1] - 1.2 * (i >> 1) });
  SQ.fYaw = G.yaw;
}
// put the squad back around the hero (a new arena built in place, a jump ahead): clear spots just behind
export function regroupSquad(){
  const pp = playerPos(), fx = Math.sin(G.yaw), fz = Math.cos(G.yaw);
  allies.forEach((a, i) => {
    const s = findClearSpawn(pp.x - fx * 3 + (i % 2 ? 1.8 : -1.8) * (1 + (i >> 1)), pp.z - fz * 3, 0.9);
    a.group.position.set(s.x, 0, s.z); a.mv.x = a.mv.z = 0; a.legs = null;
  });
  if (SQ.order === 'hold') setOrder('follow');
}
export function dismissSquadmate(){
  const a = allies.pop();
  if (a) removeAlly(a);
  if (!allies.length) setOrder('follow');
}
function removeAlly(a){
  if (a.body){ const i = downed.indexOf(a.body); if (i >= 0) downed.splice(i, 1); if (a.body.mark) scene.remove(a.body.mark); a.body = null; }
  scene.remove(a.group, a.tag);
  a.tag.geometry.dispose(); a.tag.material.dispose();
}
// a fresh level (startLevel in game/flow.js): nobody carries over
export function clearSquad(){
  for (const a of allies) removeAlly(a);
  allies.length = 0;
  setOrder('follow');
  G.reviveLeft = null;
  SQ.fighting = false; SQ.saidYours = -99;
}

/* ============================================================
   ORDERS — H: hold the spot under the crosshair · H again: on me
   ============================================================ */
function setOrder(order, at){
  SQ.order = order; SQ.holdAt = at || null;
  if (SQ.beacon){ removeMarker(SQ.beacon); SQ.beacon = null; }
  if (order === 'hold' && at) SQ.beacon = makeBeacon(at.x, at.z, 0, MISSION_COLOR[G.hero], 1.4);
}
// where the crosshair meets the ground, no further than SQUAD.holdReach from the hero
function aimPoint(){
  const o = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
  const pp = playerPos();
  let x, z;
  if (d.y < -0.03){ const k = (o.y - pp.y) / -d.y; x = o.x + d.x * k; z = o.z + d.z * k; }
  else { x = pp.x + Math.sin(G.yaw) * 12; z = pp.z + Math.cos(G.yaw) * 12; }
  const dx = x - pp.x, dz = z - pp.z, l = Math.hypot(dx, dz);
  if (l > SQUAD.holdReach){ x = pp.x + dx / l * SQUAD.holdReach; z = pp.z + dz / l * SQUAD.holdReach; }
  const p = V3(x, 0, z); clampToArena(p, null, null);
  return p;
}
export function squadOrder(){
  if (G.mode !== 'play' || player.downed) return;
  if (!allies.length){ showBanner('', 'NO SQUAD WITH YOU', 0.8); return; }
  const lead = allies.find(standing) || allies[0];
  if (SQ.order === 'follow'){
    setOrder('hold', aimPoint());
    showBanner('', 'SQUAD · HOLD THERE', 0.9);
    floater(V3(lead.group.position.x, 2.6, lead.group.position.z), G.hero === 'mando' ? 'HOLDING.' : 'COPY THAT, HOLDING!', '#bfe8ff');
  } else {
    setOrder('follow');
    showBanner('', 'SQUAD · ON ME', 0.9);
    floater(V3(lead.group.position.x, 2.6, lead.group.position.z), G.hero === 'mando' ? 'ON YOU.' : 'MOVING UP!', '#bfe8ff');
  }
  sfx(620, 0.06, 'triangle', 0.04, 820);
}
export const squadOrderName = () => SQ.order;

/* ============================================================
   TAKING FIRE
   ============================================================ */
export function hurtAlly(a, dmg, from){
  if (!a || !standing(a) || !(dmg > 0)) return;
  a.hp -= dmg * SQUAD.takeDmg * diffDmgMul();
  a.hitAt = G.gt; a.flash = 0.14;
  if (a.hp <= 0) downAlly(a);
}
// a blast (a detonator, a saboteur) catches any squadmate inside it
export function blastAllies(pos, r, dmg){
  for (const a of allies){
    if (!standing(a)) continue;
    const d = Math.hypot(a.group.position.x - pos.x, a.group.position.z - pos.z);
    if (d < r) hurtAlly(a, dmg * (1 - d / r * 0.4), pos);
  }
}
// the first standing squadmate a bolt's step a→b passes through: { ally, t } or null (enemies/bolts.js)
export function allySweep(a, b, pad){
  let best = null;
  for (const al of allies){
    if (!standing(al)) continue;
    const g = al.group.position;
    if (Math.abs(g.x - b.x) > 4 && Math.abs(g.x - a.x) > 4) continue;   // cheap reject: nowhere near this step
    if (Math.abs(g.z - b.z) > 4 && Math.abs(g.z - a.z) > 4) continue;
    const h = sweepHit(al, a, b, pad);
    if (h && (!best || h.t < best.t)) best = { ally: al, t: h.t };
  }
  return best;
}
function downAlly(a){
  a.state = 'down'; a.hp = 0; a.target = null; a.mv.x = a.mv.z = 0;
  floater(V3(a.group.position.x, 2.2, a.group.position.z), a.name + ' DOWN', '#ff8a7a');
  burst(V3(a.group.position.x, 1.2, a.group.position.z), 0xff6a4a, 10, 5, 4);
  if (!SQ.tipped){ SQ.tipped = true; showBanner('SQUADMATE DOWN', 'Stand beside them to get them up, or they rise on their own.', 2.6); }
  a.body = goDown({
    kind: 'ally', pos: () => a.group.position, need: REVIVE.ally.time, bleed: Infinity, selfUp: SQUAD.downTime[diffKey()],
    onUp(how){ a.body = null; standUp(a, how === 'self' ? SQUAD.getUpHp : Math.max(SQUAD.getUpHp, 0.65)); },
  });
}
function standUp(a, share){
  a.state = 'move'; a.hp = Math.max(a.hp, Math.round(a.maxHp * share)); a.hitAt = G.gt;
  floater(V3(a.group.position.x, 2.2, a.group.position.z), a.name + ' IS UP', '#7bffae');
}
// a wave (or objective) cleared: everyone up and patched, and the hero's second chance back
export function refill(){
  G.reviveLeft = (REVIVE.hero.revives[diffKey()] ?? 1) + SCALE.revives * (heroesHere() - 1);   // a partner in the fight earns more second chances
  for (const a of allies){ if (a.body) getUp(a.body, 'clear'); a.hp = a.maxHp; }
}

/* ============================================================
   THE FOES' SIDE — may this foe turn on a squadmate? (enemies/ai.js, every frame for each foe)
   Only the rank and file, only when a squadmate is clearly nearer than the hero, and never more than
   SQUAD.aggroShare of the living troopers at once. With the hero down, every trooper looks for a squadmate.
   ============================================================ */
export function foeAllyTarget(e, pp){
  if (!allies.length || e.converted || e.dummy || e.dead || !isFodder(e) || e.t.bomber){ e.allyTgt = null; e.onAlly = false; return null; }
  if (G.gt >= (e.allyCheck || 0)){
    e.allyCheck = G.gt + rand(0.6, 1.0);
    const g = e.group.position;
    let best = null, bd = 1e9;
    for (const a of allies){
      if (!standing(a)) continue;
      const d = Math.hypot(a.group.position.x - g.x, a.group.position.z - g.z);
      if (d < bd){ bd = d; best = a; }
    }
    const dp = Math.hypot(pp.x - g.x, pp.z - g.z);
    let ok = !!best && (player.downed || (bd + SQUAD.aggroBy < dp && bd < e.t.range + 6));
    if (ok && !player.downed && e.allyTgt !== best){
      let fodder = 0, on = 0;
      for (const o of enemies){ if (o.dead || !isFodder(o)) continue; fodder++; if (o !== e && o.allyTgt) on++; }
      ok = on < Math.floor(fodder * SQUAD.aggroShare);
    }
    e.allyTgt = ok ? best : null;
  }
  if (e.allyTgt && !standing(e.allyTgt)){ e.allyTgt = null; e.allyCheck = 0; }
  e.onAlly = !!e.allyTgt;
  return e.allyTgt;
}

/* ============================================================
   EVERY FRAME
   ============================================================ */
function pickTarget(a){
  const g = a.group.position, pp = playerPos();
  const focus = G.squadFocus && G.gt - (G.squadFocusT || -99) < SQUAD.focusFor ? G.squadFocus : null;
  let best = null, bs = 1e9;
  for (const e of enemies){
    if (e.dead || e.state === 'spawn' || !isFodder(e)) continue;
    const d = Math.hypot(e.group.position.x - g.x, e.group.position.z - g.z);
    if (d > a.role.range) continue;
    // nearest first; the trooper you're fighting, one shooting at this squadmate, or one close to you jump the queue
    const s = d - (e === focus ? 10 : 0) - (e.allyTgt === a ? 4 : 0) - (Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z) < 6 ? 3 : 0);
    if (s >= bs) continue;
    if (segBlockedBySolids(g.x, g.z, e.group.position.x, e.group.position.z)) continue;
    bs = s; best = e;
  }
  return best;
}
function shoot(a, e){
  const g = a.group, sc = a.t.scale;
  const fy = g.rotation.y, mx = g.position.x + Math.sin(fy) * 0.55, mz = g.position.z + Math.cos(fy) * 0.55;
  const muzzle = V3(mx, g.position.y + 1.42 * sc, mz);
  const tp = e.group.position, es = e.group.scale.x || 1;
  const dir = V3(tp.x - mx, tp.y + 1.3 * es - muzzle.y, tp.z - mz).normalize();
  const sp = a.role.spread;
  dir.x += rand(-sp, sp); dir.y += rand(-sp, sp) * 0.5; dir.z += rand(-sp, sp); dir.normalize();
  a.kick = 1;
  fireBolt(muzzle, dir, a.role.boltSpeed, a.role.dmg * (SQUAD.dmg[diffKey()] || 1), true, true, a);
  bolts[bolts.length - 1].ally = a;
  bolts[bolts.length - 1].mesh.material.color.setHex(G.hero === 'mando' ? 0xffa040 : 0x4aa8ff);
  burst(muzzle, a.t.eye, 2, 3, 1, 0.5);
  S.enemyShot(muzzle, false);
}
// the spot this squadmate is making for, and whether it's on revive duty
function wantSpot(a, medic){
  const pp = playerPos();
  if (medic) return { x: pp.x, z: pp.z, r: 1.3 };
  const i = a.slot % SQUAD.slots.length;
  if (SQ.order === 'hold' && SQ.holdAt){ const o = SQUAD.holdSlots[i]; return { x: SQ.holdAt.x + o[0], z: SQ.holdAt.z + o[1], r: 1.0 }; }
  const o = SQUAD.slots[i], fx = Math.sin(SQ.fYaw), fz = Math.cos(SQ.fYaw);
  return { x: pp.x - fz * o[0] + fx * o[1], z: pp.z + fx * o[0] + fz * o[1], r: SQUAD.leash };
}
export function updateSquad(dt){
  if (!allies.length){ if (downed.length || G.coopRevive) updateRevive(dt, []); return; }
  const pp = playerPos();
  SQ.fYaw = dampAngle(SQ.fYaw, G.yaw, 1.6, dt);
  allies.forEach((a, i) => { a.slot = i; });
  // a wave or objective cleared: everyone up, patched, and the hero's second chance back
  const hostiles = enemies.some(e => !e.dead && !e.converted) || G.spawnQueue.length > 0 || !!shared.boss;
  if (hostiles) SQ.fighting = true;
  else if (SQ.fighting){ SQ.fighting = false; refill(); }
  // the hero is down: the nearest squadmate standing drops everything and runs to them
  let medic = null;
  if (player.downed){
    let bd = 1e9;
    for (const a of allies){ if (!standing(a)) continue; const d = Math.hypot(a.group.position.x - pp.x, a.group.position.z - pp.z); if (d < bd){ bd = d; medic = a; } }
  }
  // the hero picked a fight that's theirs: the squad says so, once in a while
  if (G.squadFocus && !G.squadFocus.dead && !isFodder(G.squadFocus) && G.gt - G.squadFocusT < 0.2 && G.gt - SQ.saidYours > 25){
    const lead = allies.find(standing);
    if (lead){ SQ.saidYours = G.gt; floater(V3(lead.group.position.x, 2.6, lead.group.position.z), G.hero === 'mando' ? 'THAT ONE IS YOURS.' : "THAT ONE'S YOURS, GENERAL!", '#bfe8ff'); }
  }
  if (SQ.beacon) pulseMarker(SQ.beacon, dt, G.gt);
  const revivers = [];
  for (const a of allies) updateAlly(a, dt, a === medic, pp);
  for (const a of allies) if (standing(a)) revivers.push({ kind: 'ally', pos: a.group.position, hitAt: a.hitAt });
  updateRevive(dt, revivers);
}
function updateAlly(a, dt, medic, pp){
  const g = a.group, u = g.userData, p = g.position;
  // the hit flash
  if (a.flash > 0){ a.flash -= dt; u.bodyMat.emissive.setHex(0xff4a3a); u.bodyMat.emissiveIntensity = 1.4; }
  else u.bodyMat.emissiveIntensity = 0;
  a.tag.position.set(p.x, p.y + 2.75 * a.t.scale + (standing(a) ? 0 : -1.6), p.z);
  a.tag.rotation.y += dt * 2;
  a.tag.material.color.setHex(standing(a) ? MISSION_COLOR[G.hero] : 0xff5a4a);
  if (!standing(a)){
    g.rotation.x += (-1.2 - g.rotation.x) * Math.min(1, dt * 7);
    updateLegs(a, g, dt, 'off'); updateUpper(a, g, dt, null, 'off');
    return;
  }
  if (g.rotation.x !== 0) g.rotation.x += (0 - g.rotation.x) * Math.min(1, dt * 8);
  // recover out of the fight
  if (G.gt - a.hitAt > SQUAD.regenDelay) a.hp = Math.min(a.maxHp, a.hp + SQUAD.regen * dt);

  // MOVE — toward its spot (or the downed hero), straight when the way is open, round cover when it isn't
  const w = wantSpot(a, medic);
  let dx = w.x - p.x, dz = w.z - p.z;
  const dist = Math.hypot(dx, dz);
  const far = Math.hypot(pp.x - p.x, pp.z - p.z);
  if (far > 60 && SQ.order === 'follow'){   // left far behind (a long climb, a jetpack flight): catch up out of sight
    const s = findClearSpawn(pp.x - Math.sin(G.yaw) * 4, pp.z - Math.cos(G.yaw) * 4, 0.9);
    p.set(s.x, 0, s.z); a.mv.x = a.mv.z = 0;
  }
  let wantX = 0, wantZ = 0;
  if (dist > (a.moving ? w.r * 0.5 : w.r)){
    a.moving = true;
    let hx = dx / dist, hz = dz / dist;
    if (segBlockedBySolids(p.x, p.z, w.x, w.z)){
      // following: the foes' flow field already leads to the hero · holding: work round the cover's more open side
      if (SQ.order === 'follow' || medic){ navSteer(p.x, p.z, pp.x, pp.z, 0, steer); hx = steer.x; hz = steer.z; }
      else {
        if ((a.sideT -= dt) <= 0){ a.sideT = 1.2; a.side = navClearance(p.x - hz * 1.6, p.z + hx * 1.6) >= navClearance(p.x + hz * 1.6, p.z - hx * 1.6) ? 1 : -1; }
        const ox = hx, oz = hz; hx = ox * 0.4 - oz * a.side; hz = oz * 0.4 + ox * a.side; const l = Math.hypot(hx, hz); hx /= l; hz /= l;
      }
    }
    const sp = a.role.speed * (dist > 14 || medic ? 1.3 : dist < 3 ? 0.6 : 1);
    wantX = hx * sp; wantZ = hz * sp;
  } else a.moving = false;
  // keep out of each other's and the hero's way
  for (const o of allies){
    if (o === a) continue;
    const ox = p.x - o.group.position.x, oz = p.z - o.group.position.z, d2 = ox*ox + oz*oz;
    if (d2 < 2.2 && d2 > 1e-4){ const k = 2.4 / Math.sqrt(d2); wantX += ox * k; wantZ += oz * k; }
  }
  if (!medic){ const ox = p.x - pp.x, oz = p.z - pp.z, d2 = ox*ox + oz*oz; if (d2 < 2.6 && d2 > 1e-4){ const k = 3 / Math.sqrt(d2); wantX += ox * k; wantZ += oz * k; } }
  const ac = 16 * dt;
  a.mv.x += clamp(wantX - a.mv.x, -ac, ac); a.mv.z += clamp(wantZ - a.mv.z, -ac, ac);
  p.x += a.mv.x * dt; p.z += a.mv.z * dt;
  p.y = collideSolids(p, 0.7 * a.t.scale, true);
  clampToArena(p, null, null);
  // pinned (a corner, a crowd): sidestep for a moment
  if (a.moving){
    a.stuckT += dt;
    if (a.stuckT > 0.6){
      if (Math.hypot(p.x - a.lastX, p.z - a.lastZ) < 0.5){ a.side = -a.side; a.sideT = 1.2; a.mv.x += -dz / (dist || 1) * a.side * 4; a.mv.z += dx / (dist || 1) * a.side * 4; }
      a.stuckT = 0; a.lastX = p.x; a.lastZ = p.z;
    }
  }

  // SHOOT — the rank and file only (data/allies.js FODDER); never while getting the hero up
  if ((a.seekT -= dt) <= 0){ a.seekT = rand(0.3, 0.5); a.target = medic ? null : pickTarget(a); }
  const e = a.target && !a.target.dead && enemies.includes(a.target) ? a.target : (a.target = null);
  const sp2 = Math.hypot(a.mv.x, a.mv.z);
  const face = e ? Math.atan2(e.group.position.x - p.x, e.group.position.z - p.z)
             : sp2 > 0.6 ? Math.atan2(a.mv.x, a.mv.z) : SQ.order === 'hold' ? g.rotation.y : SQ.fYaw;
  const dy = Math.atan2(Math.sin(face - g.rotation.y), Math.cos(face - g.rotation.y));
  g.rotation.y += clamp(dy, -9 * dt, 9 * dt);
  if (a.burstLeft > 0 && e && (a.burstT -= dt) <= 0){ a.burstLeft--; a.burstT = a.role.burstGap; shoot(a, e); }
  if ((a.fireT -= dt) <= 0 && e && Math.abs(dy) < 0.3){
    a.fireT = rand(a.role.every[0], a.role.every[1]);
    shoot(a, e);
    a.burstLeft = a.role.burst - 1; a.burstT = a.role.burstGap;
  }
  updateLegs(a, g, dt, sp2 < 3.2 ? 'walk' : 'ground');
  updateUpper(a, g, dt, e ? e.group.position : null);   // rifle and eyes on its mark (enemies/upper.js)
}

/* ============================================================
   THE HUD — the squad strip (bottom left) and the hero's revive prompt
   ============================================================ */
let hud = null, downEl = null;
function buildHud(){
  hud = document.createElement('div'); hud.id = 'squadhud';
  downEl = document.createElement('div'); downEl.id = 'downed';
  downEl.innerHTML = '<div class="dn-t">YOU ARE DOWN</div><div class="dn-s"></div><div class="dn-bar"><i></i></div>';
  const root = document.getElementById('hud') || document.body;
  root.appendChild(hud); root.appendChild(downEl);
}
let lastKey = '';
export function updateSquadHud(){
  if (!hud) buildHud();
  const show = G.mode === 'play' && allies.length > 0;
  hud.style.display = show ? '' : 'none';
  const d = heroDownState();
  downEl.style.display = d && G.mode === 'play' ? '' : 'none';
  if (d){
    downEl.querySelector('.dn-s').textContent = d.by ? 'GETTING YOU UP…' : (squadStanding() ? 'YOUR SQUAD IS COMING · ' : 'NO ONE IS COMING · ') + d.left.toFixed(1) + 'S';
    downEl.querySelector('i').style.width = (d.prog * 100).toFixed(1) + '%';
  }
  if (!show) return;
  const key = allies.map(a => a.name).join() + SQ.order + G.reviveLeft;
  if (key !== lastKey){
    lastKey = key;
    hud.innerHTML = '<div class="sq-head"><span>SQUAD</span><span class="sq-ord">' + (SQ.order === 'hold' ? 'HOLDING' : 'ON ME') + ' <kbd>H</kbd></span></div>' +
      allies.map(a => '<div class="sq-row"><span class="sq-n">' + a.name + '</span><span class="sq-bar"><i></i></span></div>').join('') +
      '<div class="sq-rev">' + (G.reviveLeft > 0 ? 'THEY CAN GET YOU UP ×' + G.reviveLeft : 'NO SECOND CHANCE LEFT THIS WAVE') + '</div>';
  }
  const rows = hud.querySelectorAll('.sq-row');
  allies.forEach((a, i) => {
    const r = rows[i]; if (!r) return;
    r.classList.toggle('down', !standing(a));
    r.querySelector('i').style.width = (standing(a) ? clamp(a.hp / a.maxHp, 0, 1) * 100 : (a.body ? Math.min(1, a.body.prog / a.body.need) * 100 : 0)).toFixed(1) + '%';
  });
}

// the hero can only go down (rather than fall) with someone standing to come for them (game/revive.js)
addHeroReviver(() => allies.some(standing));
