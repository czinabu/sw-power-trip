// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SQUAD: friendly troopers who fight beside the hero (clone troopers for the Jedi, Mandalorian warriors for the
// Mando). They take orders (tap H for the smart one, hold H for the command wheel: allies/wheel.js), shoot the rank and
// file, take fire, go down and get up.
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
import { SQUAD, FODDER, REVIVE, COMMAND } from '../data/allies.js';
import { throwGrenade } from '../enemies/grenades.js';
import { crosshairPoint, lastAim } from '../player/aim.js';
import { showBanner } from '../ui/banners.js';
import { makeBeacon, removeMarker, pulseMarker } from '../game/objectives.js';
import { goDown, getUp, downed, addHeroReviver, updateRevive, heroDownState } from '../game/revive.js';
import { MISSION_COLOR } from '../data/missions.js';
import { ALLY_COLOR, ALLY_DOWN, addFriendRing, updateFriendRing, makeFriendTag } from '../fx/friend.js';

export const allies = [];
// each squadmate carries its own order (a.ord: follow · hold · move · cover · revive) and may have a mark (a.mark: the foe
// ATTACK TARGET put on it). The squad shares the formation (wide or tight), the grenade cooldown and fYaw, the
// formation's facing, eased after yours
const SQ = { formation: 'wide', moves: new Set(), grenadeAt: -99, fYaw: 0, fighting: false, saidYours: -99, tipped: false };
const FOLLOW = { kind: 'follow' };
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
  const tag = makeFriendTag(1); scene.add(tag);
  addFriendRing(g);
  const a = { def, name: def.name, role, t, group: g, tag, hp: role.hp, maxHp: role.hp, state: 'move', slot: allies.length, ord: FOLLOW, mark: null, markT: 0,
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
  allies.forEach(a => { a.ord = FOLLOW; a.mark = null; });
}
export function dismissSquadmate(){
  const a = allies.pop();
  if (a) removeAlly(a);
}
function removeAlly(a){
  if (a.body){ const i = downed.indexOf(a.body); if (i >= 0) downed.splice(i, 1); if (a.body.mark) scene.remove(a.body.mark); a.body = null; }
  scene.remove(a.group, a.tag);
  a.tag.material.dispose();
}
// a fresh level (startLevel in game/flow.js): nobody carries over
export function clearSquad(){
  for (const a of allies) removeAlly(a);
  allies.length = 0;
  dropMoves(true);
  if (markTag) markTag.visible = false;
  SQ.formation = 'wide'; SQ.grenadeAt = -99;
  G.reviveLeft = null;
  SQ.fighting = false; SQ.saidYours = -99;
}

/* ============================================================
   ORDERS — data/allies.js ORDERS · tap H: squadOrder (the smart one) · hold H: the wheel (allies/wheel.js) → giveOrder
   ============================================================ */
// a MOVE THERE order is one object shared by everyone sent, with its beacon; once nobody holds it, the beacon goes
function dropMoves(all){
  for (const o of SQ.moves){
    if (all || !allies.some(a => a.ord === o || a.prevOrd === o)){ removeMarker(o.beacon); SQ.moves.delete(o); }
  }
}
// where the crosshair meets the ground, no further than SQUAD.holdReach from the hero
function groundAim(){
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
// the foe under the crosshair, or the one nearest where it meets the ground (a few metres' grace)
function aimedFoe(){
  crosshairPoint(G.hero === 'mando' ? player.aimOff.x : 0, G.hero === 'mando' ? player.aimOff.y : 0);
  if (lastAim.target) return lastAim.target;
  const p = groundAim();
  let best = null, bd = 4.5;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || e.dummy === 'off') continue;
    const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z);
    if (d < bd){ bd = d; best = e; }
  }
  return best;
}
const say = (a, jedi, mando) => { if (a) floater(V3(a.group.position.x, 2.6, a.group.position.z), G.hero === 'mando' ? mando : jedi, '#bfe8ff'); };
const who = (i) => i == null ? allies : allies[i] ? [allies[i]] : [];
const lead = (list) => list.find(standing) || null;
export const orderLabel = (a) => !standing(a) ? 'DOWN' : a.mark && !a.mark.dead ? 'ATTACK' :
  { follow: 'ON ME', hold: 'HOLD', move: 'MOVING', cover: 'COVER', revive: 'REVIVING' }[a.ord.kind] || '';

/* give an order: `id` from data/allies.js ORDERS, to squadmate `idx` (0-3) or the whole squad (null).
   Returns false when there was nothing to do (no target, no one down, the grenade still cooling). */
export function giveOrder(id, idx = null){
  if (G.mode !== 'play' || player.downed) return false;
  if (!allies.length){ showBanner('', 'NO SQUAD WITH YOU', 0.8); return false; }
  const list = who(idx), one = idx != null, l = lead(list);
  if (!l){ showBanner('', one ? (allies[idx] ? allies[idx].name + ' IS DOWN' : 'NO SUCH SQUADMATE') : 'YOUR SQUAD IS DOWN', 0.9); return false; }
  const tag = one ? l.name : 'SQUAD';
  const ok = ORDER_FN[id] ? ORDER_FN[id](list, l, tag) : false;
  if (ok !== false) sfx(620, 0.06, 'triangle', 0.04, 820); else sfx(200, 0.06, 'triangle', 0.03, 160);
  dropMoves(false);
  return ok !== false;
}
const setOrd = (list, mk) => list.forEach(a => { a.ord = mk(a); a.prevOrd = null; });
const ORDER_FN = {
  follow(list, l, tag){
    list.forEach(a => { a.ord = FOLLOW; a.prevOrd = null; a.mark = null; });
    showBanner('', tag + ' · ON ME', 0.9); say(l, 'MOVING UP!', 'ON YOU.');
  },
  hold(list, l, tag){
    setOrd(list, a => ({ kind: 'hold', at: V3(a.group.position.x, 0, a.group.position.z) }));
    showBanner('', tag + ' · HOLD HERE', 0.9); say(l, 'HOLDING HERE!', 'HOLDING.');
  },
  move(list, l, tag){
    const at = groundAim();
    const o = { kind: 'move', at, n: list.length, beacon: makeBeacon(at.x, at.z, 0, MISSION_COLOR[G.hero], list.length > 1 ? 1.4 : 0.8) };
    SQ.moves.add(o);
    list.forEach((a, i) => { a.ord = o; a.prevOrd = null; a.moveI = i; });
    showBanner('', tag + ' · MOVE THERE', 0.9); say(l, 'COPY THAT, MOVING!', 'MOVING.');
  },
  attack(list, l, tag){
    const e = aimedFoe();
    if (!e){ showBanner('', 'NO TARGET UNDER THE CROSSHAIR', 0.9); return false; }
    if (e === shared.boss || (!isFodder(e) && !COMMAND.markElites)){ say(l, "THAT ONE'S YOURS, GENERAL!", 'THAT ONE IS YOURS.'); return false; }
    list.forEach(a => { a.mark = e; a.markT = G.gt; a.seekT = 0; });
    showBanner('', tag + ' · ATTACK MY TARGET', 0.9); say(l, isFodder(e) ? 'ENGAGING!' : 'COVERING FIRE!', isFodder(e) ? 'ON IT.' : 'SUPPRESSING.');
  },
  cover(list, l, tag){
    setOrd(list, () => ({ kind: 'cover', at: null, reT: 0, found: false }));
    showBanner('', tag + ' · TAKE COVER', 0.9); say(l, 'TAKING COVER!', 'INTO COVER.');
  },
  grenade(list, l){
    const left = COMMAND.grenadeCd - (G.gt - SQ.grenadeAt);
    if (left > 0){ showBanner('', 'GRENADE READY IN ' + Math.ceil(left) + 'S', 0.9); return false; }
    // the nearest of the chosen to the spot throws, out to their reach
    const at = groundAim();
    let t = l, bd = 1e9;
    for (const a of list){ if (!standing(a)) continue; const d = Math.hypot(a.group.position.x - at.x, a.group.position.z - at.z); if (d < bd){ bd = d; t = a; } }
    const p = t.group.position, dx = at.x - p.x, dz = at.z - p.z, d = Math.hypot(dx, dz);
    if (d > COMMAND.grenadeReach){ at.x = p.x + dx / d * COMMAND.grenadeReach; at.z = p.z + dz / d * COMMAND.grenadeReach; }
    t.throwAt = at; t.throwT = 0.35; t.kick = 1;
    SQ.grenadeAt = G.gt;
    say(t, 'FIRE IN THE HOLE!', 'DETONATOR OUT.');
  },
  revive(list, l, tag){
    const down = allies.filter(a => !standing(a) && a.body);
    if (!down.length){ showBanner('', 'NO ONE IS DOWN', 0.9); return false; }
    // each downed squadmate gets the nearest of the chosen who's standing (one each, while they last)
    const free = list.filter(a => standing(a) && a.ord.kind !== 'revive');
    if (!free.length){ showBanner('', 'ALREADY ON IT', 0.8); return false; }
    let sent = 0;
    for (const v of down){
      if (allies.some(a => a.ord.kind === 'revive' && a.ord.who === v)) continue;
      let best = null, bd = 1e9;
      for (const a of free){ if (a.ord.kind === 'revive') continue; const d = a.group.position.distanceTo(v.group.position); if (d < bd){ bd = d; best = a; } }
      if (!best) break;
      best.prevOrd = best.ord; best.ord = { kind: 'revive', who: v }; sent++;
      say(best, 'GOT YOU, ' + v.name + '!', 'ON MY WAY, ' + v.name + '.');
      if (one(list)) break;
    }
    if (!sent){ showBanner('', 'ALREADY ON IT', 0.8); return false; }
    showBanner('', tag + ' · GET THEM UP', 0.9);
  },
  formation(){
    SQ.formation = SQ.formation === 'wide' ? 'tight' : 'wide';
    showBanner('', SQ.formation === 'wide' ? 'SQUAD · SPREAD OUT' : 'SQUAD · STACK UP', 0.9);
    say(lead(allies), SQ.formation === 'wide' ? 'SPREADING OUT!' : 'STACKING UP!', SQ.formation === 'wide' ? 'SPREAD OUT.' : 'TIGHT ON YOU.');
  },
};
const one = (list) => list.length === 1;

// TAP H — the smart order: on a foe, attack it · the squad off on an order, on me · otherwise, move there
export function squadOrder(){
  if (G.mode !== 'play' || player.downed) return;
  if (!allies.length){ showBanner('', 'NO SQUAD WITH YOU', 0.8); return; }
  const e = aimedFoe();
  if (e && e !== shared.boss && (isFodder(e) || COMMAND.markElites) && !e.dead){ giveOrder('attack'); return; }
  const away = allies.some(a => standing(a) && a.ord.kind !== 'follow');
  giveOrder(away ? 'follow' : 'move');
}
// the squad's order for the HUD and tests: 'follow' · 'hold' · 'move' · 'cover' · 'mixed'
export function squadOrderName(){
  const k = [...new Set(allies.filter(standing).map(a => a.ord.kind))];
  return k.length === 1 ? k[0] : k.length ? 'mixed' : 'follow';
}
export const squadFormation = () => SQ.formation;
export const grenadeLeft = () => Math.max(0, COMMAND.grenadeCd - (G.gt - SQ.grenadeAt));

/* ============================================================
   TAKING FIRE
   ============================================================ */
export function hurtAlly(a, dmg, from){
  if (!a || !standing(a) || !(dmg > 0)) return;
  a.hp -= dmg * SQUAD.takeDmg * diffDmgMul() * (a.inCover ? COMMAND.coverTake : 1);
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
function markLive(a){
  const m = a.mark;
  if (m && (m.dead || m.converted || !enemies.includes(m) || G.gt - a.markT > COMMAND.markFor)) a.mark = null;
  return a.mark;
}
function pickTarget(a){
  const g = a.group.position, pp = playerPos();
  // ATTACK TARGET: the mark first, whenever it's in reach and sight
  const m = markLive(a);
  if (m && Math.hypot(m.group.position.x - g.x, m.group.position.z - g.z) < a.role.range * 1.3 &&
      !segBlockedBySolids(g.x, g.z, m.group.position.x, m.group.position.z)) return m;
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
  fireBolt(muzzle, dir, a.role.boltSpeed, a.role.dmg * (SQUAD.dmg[diffKey()] || 1) * (isFodder(e) ? 1 : COMMAND.markEliteDmg), true, true, a);
  bolts[bolts.length - 1].ally = a;
  bolts[bolts.length - 1].mark = isFodder(e) ? null : e;   // an elite only takes the bolts meant for it (enemies/bolts.js)
  bolts[bolts.length - 1].mesh.material.color.setHex(G.hero === 'mando' ? 0xffa040 : 0x4aa8ff);
  burst(muzzle, a.t.eye, 2, 3, 1, 0.5);
  S.enemyShot(muzzle, false);
}
// TAKE COVER: a spot near this squadmate, hard by a wall, with the wall between it and the fight
function findCover(a){
  const p = a.group.position;
  // the fight: the nearest few foes (or where the hero's looking, if there are none)
  let tx = 0, tz = 0, n = 0;
  const near = enemies.filter(e => !e.dead && !e.converted && e.state !== 'spawn')
    .map(e => [e, Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z)]).filter(x => x[1] < 34).sort((x, y) => x[1] - y[1]).slice(0, 3);
  for (const [e] of near){ tx += e.group.position.x; tz += e.group.position.z; n++; }
  if (!n){ const pp = playerPos(); tx = pp.x + Math.sin(G.yaw) * 20; tz = pp.z + Math.cos(G.yaw) * 20; }
  else { tx /= n; tz /= n; }
  let best = null, bs = 1e9;
  for (let r = 1.5; r <= COMMAND.coverSearch; r += 1.5){
    for (let k = 0; k < 16; k++){
      const an = k / 16 * Math.PI * 2, x = p.x + Math.sin(an) * r, z = p.z + Math.cos(an) * r;
      const c = navClearance(x, z);
      if (c < 0.75 || c > 2.2) continue;                         // room to stand, but a wall at hand
      if (!segBlockedBySolids(x, z, tx, tz)) continue;          // ...and that wall between it and the fight
      if (Math.hypot(tx - x, tz - z) < 5) continue;              // not in among them
      let s = r + (Math.hypot(tx - x, tz - z) > 28 ? 6 : 0);      // close by, and still in the fight
      for (const o of allies) if (o !== a && o.ord.kind === 'cover' && o.ord.at && Math.hypot(o.ord.at.x - x, o.ord.at.z - z) < 1.6) s += 8;   // one to a spot
      if (s < bs){ bs = s; best = V3(x, 0, z); }
    }
    if (best) break;
  }
  return best;
}
// the spot this squadmate is making for, and whether it's on revive duty
function wantSpot(a, medic, dt){
  const pp = playerPos(), o = a.ord;
  if (medic) return { x: pp.x, z: pp.z, r: 1.3 };
  const i = a.slot % SQUAD.slots.length;
  if (o.kind === 'revive'){ const v = o.who.group.position; return { x: v.x, z: v.z, r: 1.2 }; }
  // ATTACK TARGET: a mark out of reach or out of sight draws them in, then they go back to their order
  const m = markLive(a), p = a.group.position;
  if (m && o.kind !== 'cover'){
    const mp = m.group.position, d = Math.hypot(mp.x - p.x, mp.z - p.z);
    if (d > a.role.range || segBlockedBySolids(p.x, p.z, mp.x, mp.z)){
      const k = Math.min(1, (a.role.range * COMMAND.markChase) / (d || 1));
      return { x: mp.x + (p.x - mp.x) * k, z: mp.z + (p.z - mp.z) * k, r: 1.5, chase: true };
    }
    if (o.kind === 'follow' && d < a.role.range * 0.9) return { x: p.x, z: p.z, r: 99 };   // on its mark: stand and shoot
  }
  if (o.kind === 'hold') return { x: o.at.x, z: o.at.z, r: 0.8 };
  if (o.kind === 'cover'){
    if ((o.reT -= dt) <= 0 || !o.at){
      o.reT = COMMAND.coverEvery; const c = findCover(a);
      if (c){ o.at = c; o.found = true; }
      else if (!o.at){ o.at = V3(p.x, 0, p.z); o.found = false; say(a, 'NO COVER HERE!', 'NO COVER.'); }
    }
    return { x: o.at.x, z: o.at.z, r: 0.7 };
  }
  if (o.kind === 'move'){
    const s = SQUAD.holdSlots[(a.moveI || 0) % SQUAD.holdSlots.length], k = o.n > 1 ? SQUAD.moveSpread[SQ.formation] : 0;
    return { x: o.at.x + s[0] * k, z: o.at.z + s[1] * k, r: 1.0 };
  }
  const sl = (SQ.formation === 'tight' ? SQUAD.tightSlots : SQUAD.slots)[i], fx = Math.sin(SQ.fYaw), fz = Math.cos(SQ.fYaw);
  return { x: pp.x - fz * sl[0] + fx * sl[1], z: pp.z + fx * sl[0] + fz * sl[1], r: SQ.formation === 'tight' ? SQUAD.leash * 0.6 : SQUAD.leash };
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
  for (const o of SQ.moves) pulseMarker(o.beacon, dt, G.gt);
  updateMarkTag(dt);
  const revivers = [];
  for (const a of allies) updateAlly(a, dt, a === medic, pp);
  for (const a of allies) if (standing(a)) revivers.push({ kind: a.ord.kind === 'revive' ? 'medic' : 'ally', pos: a.group.position, hitAt: a.hitAt });
  updateRevive(dt, revivers);
}
// ATTACK TARGET: a gold diamond spins over the foe the squad was ordered onto, while anyone still has it marked
let markTag = null;
function updateMarkTag(dt){
  const m = allies.map(a => standing(a) && markLive(a)).find(Boolean);
  if (!m){ if (markTag) markTag.visible = false; return; }
  if (!markTag){ markTag = makeFriendTag(1.5); markTag.material.color.setHex(0xffc46a); scene.add(markTag); }
  const p = m.group.position, sc = m.group.scale.x || 1;
  markTag.visible = true;
  markTag.position.set(p.x, p.y + 2.9 * sc, p.z);
  markTag.rotation.y += dt * 4;
}
function updateAlly(a, dt, medic, pp){
  const g = a.group, u = g.userData, p = g.position;
  // the hit flash
  if (a.flash > 0){ a.flash -= dt; u.bodyMat.emissive.setHex(0xff4a3a); u.bodyMat.emissiveIntensity = 1.4; }
  else u.bodyMat.emissiveIntensity = 0;
  a.tag.position.set(p.x, p.y + 2.75 * a.t.scale + (standing(a) ? 0 : -1.6), p.z);
  a.tag.rotation.y += dt * 2;
  a.tag.material.color.setHex(standing(a) ? ALLY_COLOR : ALLY_DOWN);
  updateFriendRing(g, !standing(a));
  if (!standing(a)){
    g.rotation.x += (-1.2 - g.rotation.x) * Math.min(1, dt * 7);
    updateLegs(a, g, dt, 'off'); updateUpper(a, g, dt, null, 'off');
    return;
  }
  if (g.rotation.x !== 0) g.rotation.x += (0 - g.rotation.x) * Math.min(1, dt * 8);
  // recover out of the fight
  if (G.gt - a.hitAt > SQUAD.regenDelay) a.hp = Math.min(a.maxHp, a.hp + SQUAD.regen * dt);

  // MOVE — toward its spot (or the downed hero), straight when the way is open, round cover when it isn't
  // GET THEM UP: done when they're up (or gone), then back to what it was doing
  if (a.ord.kind === 'revive' && (standing(a.ord.who) || !allies.includes(a.ord.who))){ a.ord = a.prevOrd && a.prevOrd.kind !== 'revive' ? a.prevOrd : FOLLOW; a.prevOrd = null; }
  const w = wantSpot(a, medic, dt);
  let dx = w.x - p.x, dz = w.z - p.z;
  const dist = Math.hypot(dx, dz);
  const far = Math.hypot(pp.x - p.x, pp.z - p.z);
  if (far > 60 && a.ord.kind === 'follow'){   // left far behind (a long climb, a jetpack flight): catch up out of sight
    const s = findClearSpawn(pp.x - Math.sin(G.yaw) * 4, pp.z - Math.cos(G.yaw) * 4, 0.9);
    p.set(s.x, 0, s.z); a.mv.x = a.mv.z = 0;
  }
  let wantX = 0, wantZ = 0;
  if (dist > (a.moving ? w.r * 0.5 : w.r)){
    a.moving = true;
    let hx = dx / dist, hz = dz / dist;
    if (segBlockedBySolids(p.x, p.z, w.x, w.z)){
      // following: the foes' flow field already leads to the hero · holding: work round the cover's more open side
      if ((a.ord.kind === 'follow' && !w.chase) || medic){ navSteer(p.x, p.z, pp.x, pp.z, 0, steer); hx = steer.x; hz = steer.z; }
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

  a.inCover = a.ord.kind === 'cover' && a.ord.found && dist < 1.3;
  // GRENADE: the wind-up, then the lob (enemies/grenades.js, friendly: it hurts foes only)
  if (a.throwAt && (a.throwT -= dt) <= 0){
    const sc = a.t.scale, from = V3(p.x + Math.sin(g.rotation.y) * 0.4, p.y + 1.7 * sc, p.z + Math.cos(g.rotation.y) * 0.4);
    throwGrenade({ t: COMMAND.grenade }, from, a.throwAt, true);
    a.throwAt = null;
  }
  // SHOOT — the rank and file only (data/allies.js FODDER); never while getting the hero up
  if ((a.seekT -= dt) <= 0){ a.seekT = rand(0.3, 0.5); a.target = medic ? null : pickTarget(a); }
  const e = a.target && !a.target.dead && enemies.includes(a.target) ? a.target : (a.target = null);
  const sp2 = Math.hypot(a.mv.x, a.mv.z);
  const face = a.throwAt ? Math.atan2(a.throwAt.x - p.x, a.throwAt.z - p.z) : e ? Math.atan2(e.group.position.x - p.x, e.group.position.z - p.z)
             : sp2 > 0.6 ? Math.atan2(a.mv.x, a.mv.z) : a.ord.kind !== 'follow' ? g.rotation.y : SQ.fYaw;
  const dy = Math.atan2(Math.sin(face - g.rotation.y), Math.cos(face - g.rotation.y));
  g.rotation.y += clamp(dy, -9 * dt, 9 * dt);
  if (a.burstLeft > 0 && e && (a.burstT -= dt) <= 0){ a.burstLeft--; a.burstT = a.role.burstGap; shoot(a, e); }
  if ((a.fireT -= dt) <= 0 && e && Math.abs(dy) < 0.3){
    a.fireT = rand(a.role.every[0], a.role.every[1]) * (a.inCover ? COMMAND.coverFire : 1);
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
  const gl = grenadeLeft();
  const key = allies.map(a => a.name + orderLabel(a)).join() + SQ.formation + G.reviveLeft + Math.ceil(gl);
  if (key !== lastKey){
    lastKey = key;
    hud.innerHTML = '<div class="sq-head"><span>SQUAD · ' + (SQ.formation === 'wide' ? 'SPREAD' : 'STACKED') + '</span><span class="sq-ord">ORDERS <kbd>H</kbd></span></div>' +
      allies.map(a => '<div class="sq-row"><span class="sq-n">' + a.name + '</span><span class="sq-o">' + orderLabel(a) + '</span><span class="sq-bar"><i></i></span></div>').join('') +
      '<div class="sq-gr' + (gl > 0 ? '' : ' ready') + '">GRENADE ' + (gl > 0 ? Math.ceil(gl) + 'S' : 'READY') + '</div>' +
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
