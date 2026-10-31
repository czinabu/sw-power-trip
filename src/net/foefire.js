// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Foes hurting the guest, co-op phase 2 step 2. The host runs the foes, so it is the host that sees a blow or a shot leave a
// foe; it sends the guest what happened and the GUEST's browser decides what it means for the guest's own hero (block,
// parry, dodge, damage), exactly as in a solo fight. The answer goes back so the foe can react (stagger, rebound).
//   hurt / hres  a melee blow or a lancer's lunge, and how the guest took it
//   bolt / bx    a foe's shot: the guest flies its own copy; whoever spends or turns a bolt first tells the other to drop it
//   blast        a bomb, slam or grenade going off: the guest checks its own hero against it
//   tell / gren  the warning rings and the thrown grenade's landing mark, so the guest can see what is coming

import { G, shared, player, bolts, enemies } from '../state.js';
import { V3 } from '../utils.js';
import { scene } from '../engine/renderer.js';
import { fireBolt } from '../enemies/bolts.js';
import { throwGrenade, grenades } from '../enemies/grenades.js';
import { staggerEnemy } from '../enemies/damage.js';
import { endLunge, paintLungeLine } from '../enemies/tactics.js';
import { updateAimLine } from '../enemies/specials.js';
import { addPosture, drainBreath, netGuardHit } from '../enemies/duel.js';
import { DUEL } from '../data/duel.js';
import { gainXp } from '../game/progression.js';
import { hurtPlayer } from '../player/damage.js';
import { bossBlowResult, spawnBossRing } from '../boss/boss.js';
import { victory } from '../game/summary.js';
import { coopMissionDone } from '../game/mission.js';
import { showBanner } from '../ui/banners.js';
import { remoteComms } from '../game/story.js';
import { blockedOnBlade } from '../player/jedi/clash.js';
import { playerPos } from '../player/helpers.js';
import { tellFx } from '../fx/tells.js';
import { burst } from '../fx/particles.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { castHands } from '../fx/palms.js';
import { partnerPower } from './partner-fx.js';
import { partnerPuppet, partnerMate } from './partner.js';
import { S } from '../audio/sfx.js';
import { net, on, send, sendTo, guestSlots, connected } from './session.js';
import { hooks } from './run.js';
import { puppetOf, runKind } from './foes.js';

const asHost = () => net.role === 'host' && connected() && !!runKind() && !G.coopGuest;
const asGuest = () => net.role === 'guest' && connected() && G.coopGuest;
const r2 = (n) => Math.round(n * 100) / 100;
let bidN = 0;

/* ---------------- blows ---------------- */
// host: a blow from foe `e` lands on the partner's hero. Returns true when it was sent (so the host does no damage itself)
hooks.hurt = (e, dmg, pos, kind, unblockable, dx, dz) => {
  if (!asHost()) return false;
  const victim = (e === shared.boss ? shared.boss.hero : e.hero), slot = victim && victim.slot || guestSlots()[0];   // the guest this blow is for
  if (!slot) return false;
  sendTo(slot, { t: 'hurt', n: e.nid, d: r2(dmg), x: r2(pos.x), y: r2(pos.y), z: r2(pos.z), k: kind, u: unblockable ? 1 : 0, dx: dx ? r2(dx) : 0, dz: dz ? r2(dz) : 0 });
  return true;
};

on('hurt', (m) => {
  if (!asGuest()) return;
  const src = puppetOf(m.n);
  const opts = m.u ? { unblockable: true, src, by: src } : { src, by: src };
  const res = m.k === 'zap' ? hurtPlayer(m.d, null, false, false, false, opts) : hurtPlayer(m.d, V3(m.x, m.y, m.z), false, true, false, opts);
  if (res === 'hit' && m.k === 'lunge'){ player.vel.x += m.dx * 9; player.vel.z += m.dz * 9; }
  send({ t: 'hres', n: m.n, r: res, k: m.k });
});

on('hres', (m) => {
  if (net.role !== 'host') return;
  const mate = partnerMate(m.from);   // whoever took the blow
  if (m.n === 'B'){   // the boss's blow: a parry or clash opens him up
    const bp = shared.boss && !shared.boss.net ? shared.boss.group.position : null;
    if (!bp) return;
    let bx = bp.x - (mate ? mate.pos.x : 0), bz = bp.z - (mate ? mate.pos.z : 0);
    const bl = Math.hypot(bx, bz) || 1;
    bossBlowResult(m.r, bx / bl, bz / bl);
    return;
  }
  const e = enemies.find(o => o.nid === m.n);
  if (!e || e.dead) return;
  let ax = e.group.position.x - (mate ? mate.pos.x : 0), az = e.group.position.z - (mate ? mate.pos.z : 0);
  const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;   // away from the partner's hero
  if (m.r === 'parried' || m.r === 'clashed'){
    if (m.k === 'lunge') endLunge(e);
    // the Warbringer's posture takes the parry; a full bar breaks it open (duel.js), otherwise it reels as any brute does
    if (!(m.k === 'brace' && e.dp && e.dp.brace && addPosture(e, DUEL.posture.parry, ax, az))) staggerEnemy(e, ax, az);
    if (m.r === 'parried') drainBreath(e, DUEL.breath.parried);
  } else if (m.r === 'blocked' && m.k !== 'lunge') blockedOnBlade(e);
});

/* ---------------- the guest's blows on a duellist's guard ----------------
   The guest's screen decides a cut is turned (enemies/duel.js netDefend), or a kick or shove batters the guard; the posture
   and breath it costs go on the host's real foe, which breaks open there when the bar fills. */
hooks.guard = (e, k, a, l) => { if (asGuest()) send({ t: 'grd', n: e.nid, k, a: r2(a), l }); };
on('grd', (m) => {
  if (net.role !== 'host') return;
  const e = enemies.find(o => o.nid === m.n);
  if (!e || e.dead) return;
  const mate = partnerMate(m.from);
  let ax = e.group.position.x - (mate ? mate.pos.x : 0), az = e.group.position.z - (mate ? mate.pos.z : 0);
  const l = Math.hypot(ax, az) || 1;
  netGuardHit(e, m.k, +m.a || 1, m.l, ax / l, az / l);
});

/* ---------------- shots ---------------- */
hooks.bolt = (b) => {
  if (!asHost()) return;
  b.bid = ++bidN;
  const p = b.mesh.position, d = b.dir;
  send({ t: 'bolt', i: b.bid, n: b.src.nid, p: [r2(p.x), r2(p.y), r2(p.z)], d: [r2(d.x * 100) / 100, r2(d.y * 100) / 100, r2(d.z * 100) / 100], s: b.speed, m: r2(b.dmg) });
};

on('bolt', (m) => {
  if (!asGuest()) return;
  fireBolt(V3(m.p[0], m.p[1], m.p[2]), V3(m.d[0], m.d[1], m.d[2]), m.s, m.m, false, false, puppetOf(m.n));
  const nb = bolts[bolts.length - 1];
  nb.bid = m.i;
  if (m.n === 'B' && shared.boss){   // the Magistrate's barrage and volley bolts are drawn bigger and hotter
    const volley = shared.boss.state === 'volley';
    nb.mesh.material.color.setHex(volley ? 0xff7a2a : 0xffaa33); nb.mesh.scale.set(volley ? 1.5 : 1.3, volley ? 1.9 : 1.6, volley ? 1.5 : 1.3);
  }
});

hooks.bx = (b) => {
  b.bxd = true;
  if (connected()) send({ t: 'bx', i: b.bid });
};

on('bx', (m) => {
  const i = bolts.findIndex(b => b.bid === m.i);
  if (i < 0) return;
  scene.remove(bolts[i].mesh); bolts.splice(i, 1);
});

/* ---------------- blasts ---------------- */
hooks.blast = (pos, r, dmg, kind) => {
  if (!asHost()) return;
  send({ t: 'blast', x: r2(pos.x), y: r2(pos.y), z: r2(pos.z), r, d: r2(dmg), k: kind });
};

// the knock a blast gives (flat speed, lift) by kind: bomber, warbringer slam, volatile elite, grenade
const KNOCK = { a: [16, 6], s: [15, 7], v: [0, 0], g: [11, 5] };

on('blast', (m) => {
  if (!asGuest()) return;
  const pos = V3(m.x, m.y, m.z), pp = playerPos();
  if (m.k !== 'g'){   // a grenade draws its own bang from its landing mark (below)
    burst(V3(m.x, 0.5, m.z), 0xff6a3a, 18, 12, 6); spawnGroundShock(V3(m.x, 0.1, m.z), 0xffd24a, m.r, 0.5, 0.7);
    S.boom(pos, m.k === 's' ? 1.6 : 1.2); G.shake = Math.max(G.shake, 0.8);
  }
  const grenade = m.k === 'g';
  const inside = grenade ? Math.hypot(pp.x - m.x, pp.z - m.z) < m.r && pp.y < 3.2 : pp.distanceTo(pos) < m.r && player.dashT <= 0;
  if (!inside) return;
  const res = grenade ? hurtPlayer(m.d, pos, false, false, false, { unblockable: true, blast: true }) : hurtPlayer(m.d, pos);
  const [push, lift] = KNOCK[m.k] || [0, 0];
  if (push && (!grenade || res === 'hit')){
    const kx = pp.x - m.x, kz = pp.z - m.z, l = Math.hypot(kx, kz) || 1;
    player.vel.x += kx / l * push; player.vel.z += kz / l * push; player.vy = Math.max(player.vy, lift);
  }
});

/* ---------------- the partner's own shots: drawn here, the damage is done in their browser ---------------- */
hooks.pbolt = (b, color, scale) => {
  if (!asHost() && !asGuest()) return;
  const p = b.mesh.position, d = b.dir;
  send({ t: 'pb', p: [r2(p.x), r2(p.y), r2(p.z)], d: [r2(d.x * 100) / 100, r2(d.y * 100) / 100, r2(d.z * 100) / 100], s: b.speed, c: color, k: scale });
};
on('pb', (m) => {
  if (!asHost() && !asGuest()) return;
  fireBolt(V3(m.p[0], m.p[1], m.p[2]), V3(m.d[0], m.d[1], m.d[2]), m.s, 0, true, true);
  const b = bolts[bolts.length - 1];
  b.ghost = true; b.mesh.material.color.setHex(m.c); b.mesh.scale.set(m.k, m.k * 1.3, m.k);
});

/* ---------------- the partner's one-shot Force powers: out of their palms, or a ring where they stand ---------------- */
hooks.power = (k, color, r) => {
  if (!asHost() && !asGuest()) return;
  const p = playerPos();
  send({ t: 'pw', k, c: color, r: r2(r), x: r2(p.x), z: r2(p.z), h: castHands().length });
};
on('pw', (m) => {
  if (!asHost() && !asGuest()) return;
  partnerPower(partnerPuppet(m.from), m.k, m.c, m.r, m.h || 1, m.x, m.z);
});

/* ---------------- shared XP: a kill pays both heroes ---------------- */
hooks.xp = (n) => { if (asHost() && n > 0) send({ t: 'xp', n: Math.round(n) }); };
on('xp', (m) => { if (asGuest()) gainXp(m.n); });

/* ---------------- the marksman's laser sight and the lancer's lunge line (sent at the pose rate per foe) ---------------- */
const due = (e, key) => { const now = performance.now(); if (now - (e[key] || 0) < 50) return false; e[key] = now; return true; };
hooks.aim = (e, from, to, charge) => {
  if (!asHost() || !due(e, 'netAimAt')) return;
  send({ t: 'aim', n: e.nid, a: [r2(from.x), r2(from.y), r2(from.z)], b: [r2(to.x), r2(to.y), r2(to.z)], c: r2(charge) });
};
on('aim', (m) => {
  const e = asGuest() && puppetOf(m.n);
  if (!e) return;
  updateAimLine(e, V3(m.a[0], m.a[1], m.a[2]), V3(m.b[0], m.b[1], m.b[2]), m.c);
  e.aimAt = performance.now();
});
hooks.lunge = (e, pos, ry, len, locked, k) => {
  if (!asHost() || !due(e, 'netLwAt')) return;
  send({ t: 'lw', n: e.nid, x: r2(pos.x), z: r2(pos.z), y: r2(ry), l: r2(len), k: locked ? 1 : 0, p: r2(k) });
};
on('lw', (m) => {
  const e = asGuest() && puppetOf(m.n);
  if (!e) return;
  paintLungeLine(e, m.x, m.z, m.y, m.l, !!m.k, m.p);
  e.lungeAt = performance.now();
});

/* ---------------- the boss: its shockwaves, its death ---------------- */
hooks.ring = (pos, r0) => { if (asHost()) send({ t: 'ring', x: r2(pos.x), z: r2(pos.z), r: r0 }); };
on('ring', (m) => { if (asGuest()) spawnBossRing(m.x, m.z, m.r); });
hooks.bctl = (k) => { if (asGuest()) send({ t: 'bctl', k }); };
hooks.bossDead = () => { if (asHost()) send({ t: 'bdead' }); };
// story missions: the host's banners reach the guest, and its mission ending ends theirs
hooks.mbanner = (a, b, c, o) => { if (asHost()) send({ t: 'mbn', a, b, c, k: o && o.kicker }); };
on('mbn', (m) => { if (asGuest() && G.mission) showBanner(m.a, m.b, m.c, m.k ? { kicker: m.k } : undefined); });
hooks.comms = (list, now) => { if (asHost()) send({ t: 'cms', l: list, n: now ? 1 : 0 }); };
on('cms', (m) => { if (asGuest()) remoteComms(m.l, !!m.n); });
hooks.missionDone = () => { if (asHost()) send({ t: 'mdone' }); };
on('mdone', () => { if (asGuest()) coopMissionDone(); });
on('bdead', () => { if (asGuest() && G.mode === 'play'){ if (shared.boss && shared.boss.net) { /* the puppet falls with the snapshot */ } victory(); } });

/* ---------------- warnings ---------------- */
hooks.tell = (kind, pos, radius, dur) => {
  if (!asHost()) return;
  send({ t: 'tell', k: kind, x: r2(pos.x), z: r2(pos.z), r: radius, u: dur });
};
on('tell', (m) => { if (asGuest()) tellFx(m.k, V3(m.x, 0, m.z), m.r, m.u); });

hooks.gren = (e, from, at) => {
  if (!asHost()) return;
  send({ t: 'gren', fx: r2(from.x), fy: r2(from.y), fz: r2(from.z), x: r2(at.x), z: r2(at.z), r: e.t.blastR, f: e.t.fuse });
};
on('gren', (m) => {
  if (!asGuest()) return;
  throwGrenade({ t: { blastR: m.r, fuse: m.f, dmg: 0 } }, V3(m.fx, m.fy, m.fz), V3(m.x, 0, m.z), false);
  grenades[grenades.length - 1].vis = true;   // only the picture: the host's blast does the harm
});
