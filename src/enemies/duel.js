// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Duelling foes: guards and posture, feints, delayed strikes, strings, counters, bolt deflection, and the saber lock.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { stamDelay } from '../player/stamina.js';
import { DUEL, DUEL_PROFILES, WARBRINGER, WARBRINGER_PROFILE, GUARD_POSE, BLOCK_POSE, WIND, FOE_CUTS, FOE_STRINGS, FOOTWORK, STRING_DIFF } from '../data/duel.js';
import { scene, camera } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP, dampToward } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { sparks, clashFlash, clashSparks } from '../fx/ink.js';
import { spawnHitSpark, spawnGroundShock } from '../fx/vfx.js';
import { G, enemies, player, isGunner } from '../state.js';
import { fwd, playerPos, stance } from '../player/helpers.js';
import { staggerEnemy, damageEnemy, flinchEnemy } from './damage.js';
import { hurtPlayer } from '../player/damage.js';
import { enemyDmgScale } from '../game/survival.js';
import { showBanner } from '../ui/banners.js';
import { tacticsRamp } from './tactics.js';
import { tutEvent } from '../game/tutor-bus.js';
import { dropToken } from './director.js';
import { tellFx } from '../fx/tells.js';
import { heroesHere } from '../player/players.js';
import { hooks } from '../net/run.js';

const LINES = ['L', 'R', 'H', 'Lo'];   // the lines a guard covers (Lo: the legs)
const SIDES = ['L', 'R', 'H'];         // the lines a foe strikes from
const GUARDING = { chase: 1, recover: 1 };
const GUARD_ANG = { R: 0, H: 90, L: 180, Lo: 270 };   // where on the clock each guard's arc is centred (DUEL.arc)
const angDist = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
/* where on the clock round the body an angle cut arrives (DUEL.arc): its angle, carried toward the top for a high flat
   cut and the bottom for a low one; null for a keyed cut (thrust, back strike, finisher, riposte), which keeps its line */
function arrival(sw){
  const pat = sw && sw.pat;
  if (!pat || pat.ang == null || sw.riposte || sw.step === 2 && !sw.flick) return null;
  const A = DUEL.arc, c = Math.abs(Math.cos(pat.ang * Math.PI / 180));
  const to = pat.h === 'high' ? 90 : pat.h === 'low' ? 270 : null;
  if (to == null) return pat.ang;
  const d = ((((to - pat.ang) % 360) + 540) % 360) - 180;   // the short way round toward it
  return (pat.ang + Math.sign(d) * Math.min(Math.abs(d), (pat.h === 'high' ? A.high : A.low) * c) + 360) % 360;
}
const DIFF_MUL = { padawan: 0.7, knight: 1, master: 1.15 };
const diffMul = () => DIFF_MUL[G.diff] || 1;

/* ELITE RAMP (DUEL.eliteRamp) — how far a duellist's skill has grown this deep into the run. 1 = as listed. */
export function eliteRamp(){
  const R = DUEL.eliteRamp, n = G.endless ? (G.endlessWave || 0) : (G.waveTotal || 0);
  if (n <= R.full) return R.from + (1 - R.from) * clamp((n - 1) / (R.full - 1), 0, 1);
  return 1 + (R.max - 1) * clamp((n - R.full) / (R.top - R.full), 0, 1);
}
const skill = e => (e.dp && e.dp.elite ? eliteRamp() : 1);

/* ---------------- breath (DUEL.breath): a duellist's own stamina ---------------- */
// spend `amt` if it has it (true), or come up short (false). A foe without a breath pool always has it.
function spend(e, amt){
  if (e.breath == null) return true;
  if (e.winded || e.breath < amt) return false;
  e.breath -= amt; e.breathAt = G.gt;
  if (e.breath < e.breathMax * DUEL.breath.winded) wind(e);
  return true;
}
// run it dry: no guard, no answer; it gives up its turn and backs off to catch its breath
function wind(e){
  if (e.winded || e.dead) return;
  e.winded = true; e.counterQueued = false;
  if (e.token) dropToken(e, true);
  const g = e.group;
  floater(V3(g.position.x, g.position.y + 1.5, g.position.z), 'WINDED', '#9fd8ff');
}
// your pressure drains it: a parried swing, a lock lost (no-op on foes without breath)
export function drainBreath(e, amt){
  if (e.breath == null || e.dead) return;
  e.breath = Math.max(0, e.breath - amt); e.breathAt = G.gt;
  if (e.breath < e.breathMax * DUEL.breath.winded) wind(e);
}

/* which line a cut comes in on, from where the blade starts (screen left / right / overhead). The strafe cuts start on
   the far side (D sweeps left → right, so it arrives on the LEFT), the overhead and finisher come down HIGH. */
export function cutLine(sw){
  if (!sw || !sw.pat) return 'H';
  if (sw.step === 2 || sw.riposte) return 'H';
  return patLine(sw.pat);
}
// the line a cut pattern comes in on, whatever the swing
function patLine(pat){
  if (pat.line) return pat.line;   // an angle cut knows its own (player/jedi/cutaim.js anglePattern)
  if (pat.h === 'low' && !/^rise/.test(pat.id)) return 'Lo';   // a sweep at the knees or a thrust aimed low (the rising cuts come up across a side)
  return pat.yF < -0.5 ? 'L' : pat.yF > 0.5 ? 'R' : 'H';
}

/* ============================================================
   THE EXCHANGE (DUEL.exchange) — parry, riposte, re-parry, strike back: the back and forth of a prequel duel.
   ============================================================ */
// you parried its strike: does it keep the exchange going (true: it recovers to meet your riposte) or reel (false)?
export function rallyOnParry(e){
  const p = e.dp, X = DUEL.exchange;
  if (!p || !p.rally || p.brace || e.dead || e.converted) return false;
  const n = e.exch && G.gt - e.exch.at < X.gap ? e.exch.n : 0;
  // the beats have run long: the blades bind
  if (n >= X.lockAt && p.lock && startLock(e, 'body')){ e.exch = null; e.rallyT = 0; return true; }
  if (Math.random() >= p.rally * diffMul() * skill(e) * Math.pow(X.decay, n) || !spend(e, X.breath)){
    if (n >= 1) e.flourishNext = G.gt + DUEL.flourish.after;   // the exchange is over: it resets with a twirl
    e.exch = null; return false;
  }
  e.exch = { n: n + 1, at: G.gt };
  e.rallyT = G.gt + X.window;
  e.state = 'recover'; e.st = X.recover; e.plan = null; e.counterQueued = false;
  e.group.userData.bodyMat.emissiveIntensity = 0;
  const g = e.group;
  if (n >= 1) floater(V3(g.position.x, g.position.y + 1.7, g.position.z), 'EXCHANGE ×' + (n + 1), '#ffe9a8');
  return true;
}
// your riposte meets a foe still in the exchange: its weapon is there on the riposte's line, it turns it and comes
// straight back at you, a little faster than the beat before
export function rallyParry(e, sw, at){
  if (!e.exch || !(e.rallyT > G.gt) || e.dead || e.state === 'stagger' || e.state === 'lock') return false;
  const X = DUEL.exchange, n = e.exch.n;
  e.rallyT = 0; e.exch.at = G.gt;
  const line = sw && sw.pat ? patLine(sw.pat) : 'H';
  e.guard = e.blockLine = line; e.blockAt = G.gt;
  const g = e.group, pp = playerPos(), dx = pp.x - g.position.x, dz = pp.z - g.position.z, dl = Math.hypot(dx, dz) || 1;
  const cp = at || V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7);
  clashFlash(cp, isGunner() ? 0xffd28a : stance().blade, true);
  clashSparks(cp, 0xffe9b0, 5);
  S.clash(cp, true, e.form);
  sfx(1700 + n * 220, 0.08, 'triangle', 0.035, 1200);   // each beat rings a little higher
  G.hitstop = Math.max(G.hitstop, 0.07); G.shake = Math.max(G.shake, 0.35);
  G.slowmo = Math.min(G.slowmo, 0.55); G.slowmoT = Math.max(G.slowmoT, 0.1);
  floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'RE-PARRIED', '#ffd24a');
  // and back at you: the next strike of the exchange, quicker each beat (ai.js fires it once a turn is free)
  e.exchWind = X.windup[Math.min(n - 1, X.windup.length - 1)];
  e.counterQueued = true; e.counterAt = -9;
  e.state = 'recover'; e.st = Math.min(e.st, 0.05);
  return true;
}

/* ---------------- setup ---------------- */
export function initDuel(e, profile){
  const p = profile || DUEL_PROFILES[e.type];
  if (!p) return;
  e.dp = p;
  e.posture = 0; e.postureAt = -9;
  e.guard = LINES[(Math.random() * LINES.length) | 0];
  e.guardT = rand(DUEL.guardShift[0], DUEL.guardShift[1]);
  e.lineStreak = 0; e.lastLine = null;
  e.counterAt = -9;
  e.lastSide = null;
  e.rhyN = 0; e.rhyAt = -9;   // your cutting rhythm at it (DUEL.rhythm)
  if (p.stam){ e.breathMax = e.breath = p.stam * skill(e); e.breathAt = -9; e.winded = false; }
}
// the Warbringer: posture and breath on a brute's body, and its swing held longer (data/duel.js WARBRINGER). Co-op
// raises the bar: each extra hero adds WARBRINGER.coop of it again.
export function initWarbringer(e){
  initDuel(e, { ...WARBRINGER_PROFILE, posture: Math.round(WARBRINGER.posture * (1 + WARBRINGER.coop * (heroesHere() - 1))) });
  e.swing = WARBRINGER.swing;
}
const showsGuard = e => e.dp && e.dp.block >= 0.4;

/* ---------------- per-frame (called from ai.js for every living duelling foe) ---------------- */
export function updateDuel(e, dt, dist){
  const g = e.group, p = e.dp;
  // posture drains back once the foe has been left alone for a moment
  if (e.posture > 0 && G.gt - e.postureAt > DUEL.posture.regenDelay) e.posture = Math.max(0, e.posture - DUEL.posture.regen * dt);
  // breath comes back once it stops spending; winded, it stays out of the fight until it has enough of it again
  if (e.breath != null){
    const B = DUEL.breath;
    if (e.breath < e.breathMax && G.gt - e.breathAt > B.regenDelay) e.breath = Math.min(e.breathMax, e.breath + B.regen * (e.winded ? 1.25 : 1) * dt);
    if (e.winded){
      if (e.breath >= e.breathMax * B.recover) e.winded = false;
      else e.tokenRest = Math.max(e.tokenRest || 0, B.retreat);   // no turn while it gets its wind back: it holds the ring
    }
  }
  // the guard shifts lines every so often (and after a hit lands on a line it wasn't covering)
  if ((e.guardT -= dt) <= 0){
    e.guardT = rand(DUEL.guardShift[0], DUEL.guardShift[1]);
    if (!(e.lineStreak >= DUEL.adaptAfter)){ const o = LINES.filter(l => l !== e.guard); e.guard = o[(Math.random() * o.length) | 0]; }
  }
  // a slipped cut: the backstep carries it clear
  if (e.dodgeT > 0){
    e.dodgeT -= dt;
    if (p.flip){   // ATARU: a backflip clear, up and over (FORM_DUEL flip)
      const k = clamp(1 - e.dodgeT / DUEL.flipTime, 0, 1), step = (DUEL.dodgeStep * 0.3 + p.flip) / DUEL.flipTime;
      g.position.x += e.dodgeX * step * dt; g.position.z += e.dodgeZ * step * dt;
      e.flipY = Math.sin(k * Math.PI) * DUEL.flipHeight;   // (ai.js puts it on top of the ground under it)
      g.rotation.x = Math.atan2(Math.sin(-k * Math.PI * 2), Math.cos(k * Math.PI * 2));   // one full turn back, kept in ±π (net/foes.js turns puppets the short way)
      if (e.dodgeT <= 0){ e.flipY = 0; g.rotation.x = 0; }
    } else {
      g.position.x += e.dodgeX * DUEL.dodgeStep * dt; g.position.z += e.dodgeZ * DUEL.dodgeStep * dt;
      if (e.dodgeSide) g.rotation.z = -0.22 * e.dodgeSide * Math.max(0, e.dodgeT) / 0.3;   // leaning out the way it steps
      else g.rotation.x = -0.25 * Math.max(0, e.dodgeT) / 0.3;
      if (e.dodgeT <= 0) g.rotation.z = 0;
    }
  }
  // out of a cut: the hips come back up, the chest squares, a low sweep's yaw unwinds; a finished string skips back out
  if (e.state !== 'windup' && e.state !== 'strike'){
    if (e.cutDrop) e.cutDrop = dampToward(e.cutDrop, 0, dt, 10);
    if (e.cutTwist) e.cutTwist = dampToward(e.cutTwist, 0, dt, 10);
    e.cutYaw = 0;
    if (g.userData.weaponArm && g.userData.weaponArm.rotation.y) g.userData.weaponArm.rotation.y = dampToward(g.userData.weaponArm.rotation.y, 0, dt, 12);
  }
  if (e.skipT > 0){
    e.skipT -= dt;
    if (e.state === 'recover' && !(e.dodgeT > 0)){
      const pp = playerPos(), ax = g.position.x - pp.x, az = g.position.z - pp.z, al = Math.hypot(ax, az) || 1;
      const v = FOOTWORK.back / FOOTWORK.backT;
      g.position.x += ax / al * v * dt; g.position.z += az / al * v * dt;
    } else e.skipT = 0;
  }
  const guarding = !p.brace && GUARDING[e.state] && dist < DUEL.guardRange && !e.converted;   // (a bracing foe holds no guard: no pose, no arc)
  // hold the weapon on the guarded line (the readable tell), back to the carry otherwise
  if (guarding && !(e.dodgeT > 0)){
    readCut(e, dist);
    if (!flourish(e, dt, dist)) guardPose(e, dt);
  } else if (e.flourishT > 0 || e.fl0) endFlourish(e);
  // the guard arc: a pale crescent on the covered side, brighter as you close in
  if (showsGuard(e)){
    if (!g.userData.guardArc) makeGuardArc(e);
    const a = g.userData.guardArc;
    a.visible = guarding && !e.dead && !e.winded;   // winded: the guard is down
    if (a.visible){
      const want = e.guard === 'R' ? 0 : e.guard === 'L' ? Math.PI : e.guard === 'Lo' ? -Math.PI / 2 : Math.PI / 2;
      a.rotation.z = dampToward(a.rotation.z, want, dt, 14);
      e.arcFlash = Math.max(0, (e.arcFlash || 0) - dt * 4);
      a.material.opacity = clamp(1 - dist / DUEL.guardRange, 0.15, 0.6) + e.arcFlash;
      a.material.color.setHex(e.lineStreak >= DUEL.adaptAfter ? 0xffb35a : 0xfff0c8);   // amber: it has read your cut
    }
  }
  // posture bar over the head while the guard is under pressure, and its breath under it once it has spent some
  const spent = e.breath != null && e.breath < e.breathMax - 0.5;
  if ((e.posture > 0.5 || spent || p.brace) && !e.dead && (p.brace || dist < DUEL.guardRange * 2)){   // the Warbringer's bar is always up, like its health bar
    if (!e.postBar) makePostureBar(e);
    const b = e.postBar, k = clamp(e.posture / p.posture, 0, 1);
    b.visible = true;
    // the Warbringer's bar hangs just under its health bar, a little wider so it reads from across the arena
    if (p.brace) b.position.set(g.position.x, g.position.y + 2.7 * g.scale.x - 0.38, g.position.z);
    else b.position.set(g.position.x, g.position.y + 2.55 * (e.t.scale || 1), g.position.z);
    if (p.brace) b.scale.set(1.9, 1.9, 1);
    b.quaternion.copy(camera.quaternion);
    b.userData.fill.scale.x = Math.max(0.001, k);
    b.userData.fill.position.x = -(1 - k) * 0.55;
    b.userData.fill.material.color.setHex(e.state === 'stagger' && p.brace ? 0xffffff : k > 0.75 ? 0xff6a3a : 0xffd24a);   // broken: the bar flashes white, the opening to punish
    const br = b.userData.breath;
    br.visible = e.breath != null;
    if (br.visible){
      const kb = clamp(e.breath / e.breathMax, 0, 1);
      br.scale.x = Math.max(0.001, kb);
      br.position.x = -(1 - kb) * 0.55;
      br.material.color.setHex(e.winded ? 0x3a5a8a : 0x9fd8ff);
    }
  } else if (e.postBar) e.postBar.visible = false;
}

export function cleanupDuel(e){
  if (e.postBar){ scene.remove(e.postBar); e.postBar = null; }
}

function makeGuardArc(e){
  const geo = new THREE.RingGeometry(0.82, 0.95, 18, 1, -0.95, 1.9);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.position.set(0, 1.35, 0.3);
  m.renderOrder = 5;
  e.group.add(m); e.group.userData.guardArc = m;
}
function makePostureBar(e, hasBreath = !!e.dp.stam){
  const grp = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.11), new THREE.MeshBasicMaterial({ color: 0x140d04, transparent: true, opacity: 0.75, depthTest: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd24a, depthTest: false, toneMapped: false }));
  fill.position.z = 0.01;
  // breath: a thin pale strip under the posture bar
  const bbg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.06), new THREE.MeshBasicMaterial({ color: 0x0a1018, transparent: true, opacity: 0.75, depthTest: false }));
  bbg.position.y = -0.1;
  const breath = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.03), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, depthTest: false, toneMapped: false }));
  breath.position.set(0, -0.1, 0.01);
  grp.add(bg, fill, bbg, breath); grp.renderOrder = 998; grp.userData.fill = fill; grp.userData.breath = breath;
  bbg.visible = hasBreath;
  scene.add(grp); e.postBar = grp;
}

/* ---------------- weapon poses ---------------- */
// the guard on its line, or (a cut read and about to be met: readCut) the block out on the cut's line, snapped there fast
function guardPose(e, dt){
  const u = e.group.userData;
  const blk = e.blockLine && G.gt - e.blockAt < DUEL.read.hold;
  const P = blk ? BLOCK_POSE : GUARD_POSE, line = blk ? e.blockLine : e.guard, k = blk ? DUEL.read.rate : 9;
  if (u.staff){
    const p = P.staff[line] || P.staff.H;   // (a line with no pose of its own, an angle cut's or a thrust's: the high guard)
    u.staff.rotation.z = dampToward(u.staff.rotation.z, p[0], dt, k);
    u.staff.rotation.x = dampToward(u.staff.rotation.x, p[1], dt, k);
  } else if (u.weaponArm){
    const p = P.sword[line] || P.sword.H;
    u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, p[0], dt, k);
    u.weaponArm.rotation.z = dampToward(u.weaponArm.rotation.z, p[1], dt, k);
  }
}

/* FLOURISH — a duellist between exchanges twirls its blade in a circle off its guard (a staff spins whole turns) and
   settles back into the stance (DUEL.flourish). Anything it has to answer cuts it short. */
function flourish(e, dt, dist){
  const F = DUEL.flourish, u = e.group.userData;
  if (!e.dp.lock) return false;   // only the true duellists show off
  if (e.flourishNext == null) e.flourishNext = G.gt + rand(F.every[0], F.every[1]);
  const busy = (e.blockLine && G.gt - e.blockAt < DUEL.read.hold) || e.counterQueued || e.winded || e.rallyT > G.gt;
  if (!(e.flourishT > 0)){
    if (busy || G.gt < e.flourishNext || dist < F.range[0] || dist > F.range[1]) return false;
    e.flourishT = F.dur; e.flourishNext = G.gt + F.dur + rand(F.every[0], F.every[1]);
    e.fl0 = u.staff ? [u.staff.rotation.z, u.staff.rotation.x] : u.weaponArm ? [u.weaponArm.rotation.x, u.weaponArm.rotation.z] : [0, 0];
    sfx(rand(240, 300), 0.22, 'sine', 0.02, rand(520, 640));   // the hum of the blade whirling
  }
  if (busy){ endFlourish(e); return false; }
  e.flourishT -= dt;
  const k = 1 - Math.max(0, e.flourishT) / F.dur, w = Math.sin(Math.PI * k), a = k * Math.PI * 2;
  if (u.staff){
    // two whole turns, eased in and out, then back to where it started
    u.staff.rotation.z = e.fl0[0] + (k * k * (3 - 2 * k)) * Math.PI * 4;
    u.staff.rotation.x = e.fl0[1] + (0.3 - e.fl0[1]) * w;
  } else if (u.weaponArm){
    // the blade drawn up and round in a circle off the guard, twice, and back
    u.weaponArm.rotation.x = e.fl0[0] + (-1.45 - e.fl0[0]) * w + Math.sin(a * 2) * 0.55 * w;
    u.weaponArm.rotation.z = e.fl0[1] + (Math.cos(a * 2) - 1) * 0.5 * w;
  }
  if (e.flourishT <= 0) endFlourish(e);
  return true;
}
function endFlourish(e){
  const u = e.group.userData;
  if (e.flourishT > 0 || e.fl0){
    // a spun staff comes back to the same angle less its whole turns, so the guard doesn't unwind it
    if (u.staff) u.staff.rotation.z = e.fl0 ? e.fl0[0] + (((u.staff.rotation.z - e.fl0[0]) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI : u.staff.rotation.z;
  }
  e.flourishT = 0; e.fl0 = null;
}

/* READ — your cut is still in its chamber and this guard has seen which line it's on (DUEL.read). The block is decided
   now, with the same odds it would have at contact (decide), and a block or parry sends the weapon out onto that line
   (guardPose) to be there when the blade arrives. The decision rides on the swing (sw.reads) for duelDefend to use. */
function readCut(e, dist){
  const sw = player.swing, Rd = DUEL.read;
  if (!sw || sw.riposte || sw.back || sw.recoil || dist > Rd.range || sw.t > sw.dur * Rd.by) return;
  if (sw.reads && sw.reads.has(e)) return;
  if (!canGuard(e)) return;
  const g = e.group, pp = playerPos(), f = fwd();
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dl = Math.hypot(dx, dz) || 1;
  if ((f.x * dx + f.z * dz) / dl < Rd.face) return;   // the cut isn't aimed at it
  const line = cutLine(sw), kind = sw.step === 2 ? 'finisher' : 'cut';
  const dec = decide(e, line, kind, G.gt - e.rhyAt < DUEL.rhythm.gap ? e.rhyN + 1 : 1);
  (sw.reads || (sw.reads = new Map())).set(e, { line, dec });
  if (dec === 'block' || dec === 'parry'){ e.blockLine = line; e.blockAt = G.gt; }
}
/* THE CUT IN MOTION (data/duel.js FOE_CUTS) — the weapon travels from wherever it was when the wind-up began (the
   guard, or the end of the last cut in a string, so a string flows) back to the cut's wind-up, then through it to the
   follow-through. The chest turns with it, the body leans, the hips sink under a low cut, the spin turns the whole body.
   A plan without a cut (the old three lines) takes the line's WIND pose. */
const lerp = (a, b, k) => a + (b - a) * k;
const STAFF_END = { L: [-1.6, 0.9], R: [1.7, 0.9], H: [0.9, 0.9], T: [-1.5, -0.3], Lo: [-1.2, -1.0] };   // where a staff's cut on each line ends
function armNow(e){
  const u = e.group.userData;
  if (u.staff) return [u.staff.rotation.z, u.staff.rotation.x];
  if (u.weaponArm) return [u.weaponArm.rotation.x, u.weaponArm.rotation.z, u.weaponArm.rotation.y];
  return null;
}
function cutFrom(e){
  const pl = e.plan, c = pl.c, u = e.group.userData;
  if (u.staff) return c && c.staff ? c.staff.from : WIND.staff[pl.side] || WIND.staff.H;
  return c ? c.from : WIND.sword[pl.side] || WIND.sword.H;
}
function setArm(e, p){
  const u = e.group.userData;
  if (u.staff){ u.staff.rotation.z = p[0]; u.staff.rotation.x = p[1]; }
  else if (u.weaponArm){ u.weaponArm.rotation.x = p[0]; u.weaponArm.rotation.z = p[1]; u.weaponArm.rotation.y = p[2] || 0; }
}
export function windupPose(e, coil){
  const pl = e.plan, c = pl.c, s = pl.side, u = e.group.userData;
  const w = cutFrom(e), w0 = pl.w0 || (u.staff ? [0.5, 0.3] : [-0.35, 0, 0]);
  setArm(e, (u.staff ? [0, 1] : [0, 1, 2]).map(i => lerp(w0[i] || 0, w[i] || 0, coil)));
  if (!c){ if (s === 'T') e.group.rotation.x = -coil * 0.25; return; }   // a thrust loads back onto the rear foot, low
  e.group.rotation.x = c.lean[0] * coil;
  e.cutTwist = c.twist[0] * coil;
  e.cutDrop = c.slam ? 0 : (c.drop || 0) * coil;
  e.cutYaw = c.yaw ? c.yaw[0] * coil : 0;
  e.group.rotation.y += e.cutYaw;   // (ai.js has just squared it to the target)
}
// strike: from the wind-up through to the far side of the body (a thrust drives straight out)
export function strikePose(e, chop){
  const pl = e.plan, c = pl.c, u = e.group.userData, s = pl.side;
  if (!c){
    if (u.staff){
      const w = WIND.staff[s];
      const endZ = s === 'L' ? -1.6 : s === 'R' ? 1.7 : s === 'T' ? -1.5 : 0.9;
      u.staff.rotation.z = w[0] + (endZ - w[0]) * chop;
      u.staff.rotation.x = s === 'T' ? -0.4 + chop * 0.1 : 0.9;
    } else if (u.weaponArm){
      const w = WIND.sword[s];
      if (s === 'T'){ u.weaponArm.rotation.x = w[0] + (-1.55 - w[0]) * chop; u.weaponArm.rotation.z = 0; }
      else {
        u.weaponArm.rotation.x = w[0] + ((s === 'H' ? 0.75 : -0.9) - w[0]) * chop;
        u.weaponArm.rotation.z = w[1] + ((s === 'H' ? 0 : -w[1] * 0.8) - w[1]) * chop;
      }
    }
    e.group.rotation.x = s === 'T' ? -0.25 + chop * 0.55 : -0.4 * (1 - chop) + 0.22 * chop;
    return;
  }
  // the spin throws the arm straight out and lets the body's turn carry the blade round
  const ka = c.yaw ? Math.min(1, chop * 4) : chop;
  const from = cutFrom(e), to = u.staff ? (c.staff ? c.staff.to : STAFF_END[s]) : c.to;
  setArm(e, (u.staff ? [0, 1] : [0, 1, 2]).map(i => lerp(from[i] || 0, to[i] || 0, ka)));
  e.group.rotation.x = lerp(c.lean[0], c.lean[1], chop);
  e.cutTwist = lerp(c.twist[0], c.twist[1], chop);
  e.cutDrop = (c.drop || 0) * (c.line === 'Lo' ? 1 - 0.3 * chop : c.slam ? chop : 1 - chop);
  e.cutYaw = c.yaw ? lerp(c.yaw[0], c.yaw[1], chop) : 0;
  const face = e.group.rotation.y;
  e.group.rotation.y = face + e.cutYaw;
  // footwork: the step goes the way the cut sweeps, a little at a time through the strike
  if (c.side){
    const want = c.side * 0.35 * chop, d = want - (pl.sideDone || 0);
    e.group.position.x += Math.cos(face) * d; e.group.position.z -= Math.sin(face) * d;
    pl.sideDone = want;
  }
}
// the strike begins: how far its step carries it in (spread over the strike up to the blow: ai.js)
export function startCut(e, dist){
  const pl = e.plan, c = pl.c;
  const base = pl.side === 'T' ? 1.4 : e.t.heavy ? 0.9 : 0.5;
  pl.lunge = Math.min(base + (c ? c.step : 0), Math.max(0, dist - 1.2));
  pl.lunged = 0; pl.sideDone = 0;
  if (c && c.yaw) sfx(rand(210, 250), 0.3, 'sawtooth', 0.025, rand(520, 600));   // the spin's rising hum
}
// one strike frame's share of the step in; returns how far it moved this frame
export function cutStep(e, k, tx, tz){
  const pl = e.plan;
  if (!pl || !(pl.lunge > 0)) return 0;
  const want = pl.lunge * Math.min(1, k / (pl.hitK || 0.5)), d = want - pl.lunged;
  if (d <= 0) return 0;
  e.group.position.x += tx * d; e.group.position.z += tz * d;
  pl.lunged = want;
  return d;
}
// the blow lands: a slam drives into the ground
export function cutLands(e){
  const c = e.plan && e.plan.c;
  if (!c || !c.slam) return;
  const g = e.group, f = g.rotation.y - (e.cutYaw || 0);
  const at = V3(g.position.x + Math.sin(f) * 1.6, 0.05, g.position.z + Math.cos(f) * 1.6);
  spawnGroundShock(at, e.form ? 0xffd27a : e.t.eye, 2.6, 0.35, 0.7);
  sparks(V3(at.x, 0.2, at.z), 0xffe0a0, 10, 9, { life: 0.3 });
  G.shake = Math.max(G.shake, 0.4);
}

/* ---------------- offence: plan a wind-up ---------------- */
// called the moment a duelling foe commits to a swing (ai.js has set e.wu / e.st / the telegraph)
export function planAttack(e, quick){
  const p = e.dp, m = diffMul();
  const sides = SIDES.filter(l => l !== e.lastSide);
  const plan = { side: sides[(Math.random() * sides.length) | 0], cut: null, c: null, feint: false, hold: 0, chain: 0, thrust: false, n: 1, w0: armNow(e) };
  spend(e, quick ? DUEL.breath.counter : DUEL.breath.swing);   // (it swings on an empty tank too, but the tank shows it)
  if (!quick){
    e.measT = null;   // its next turn measures the distance afresh (FOOTWORK)
    plan.thrust = Math.random() < p.thrust * m;
    const r = p.ramp ? tacticsRamp() : 1;   // the rank and file pick up their tricks as the run deepens (tactics.js)
    const rd = !isGunner() ? stance().readMul || 1 : 1;   // Makashi reads intent: fewer feints and held strikes get through
    plan.feint = !plan.thrust && Math.random() < p.feint * m * r * rd;
    plan.hold = Math.random() < p.delay * m * r * rd ? rand(DUEL.delayHold[0], DUEL.delayHold[1]) : 0;
    plan.chain = stringLen(e);
    if (e.winded) plan.chain = 0;
  }
  setCut(plan, plan.thrust ? 'thrust' : nextCut(e, null));
  if (plan.thrust){ plan.side = 'T'; plan.chain = 0; thrustTell(e); }
  e.plan = plan;
  e.lastSide = plan.side;
  e.wuBase = e.wu;
  e.wu += plan.hold; e.st = e.wu;
}
// how many more cuts this string runs to: up to the profile's chain, shorter on Padawan, longer for a Master's duellists
function stringLen(e){
  const p = e.dp;
  if (!p.chain) return 0;
  const d = STRING_DIFF[G.diff] || 0;
  const max = Math.max(0, p.chain + (d > 0 && !p.elite ? 0 : d));
  return (Math.random() * (max + 1)) | 0;
}
// the next cut of its string (FOE_STRINGS), one that doesn't come in on `avoid`; null for a foe with no string
function nextCut(e, avoid){
  const S = e.dp && FOE_STRINGS[e.dp.moves];
  if (!S) return null;
  if (e.strI == null || G.gt - (e.strAt || -9) > FOE_STRINGS.reset) e.strI = (Math.random() * S.cuts.length) | 0;   // a new string starts somewhere new
  let id = S.cuts[e.strI % S.cuts.length];
  for (let n = 0; n < S.cuts.length; n++){
    const c = S.cuts[(e.strI + n) % S.cuts.length];
    if (FOE_CUTS[c].line !== avoid){ id = c; e.strI += n; break; }
  }
  e.strI++; e.strAt = G.gt;
  return id;
}
function setCut(plan, id){
  const c = id && FOE_CUTS[id];
  plan.cut = c ? id : null; plan.c = c || null;
  plan.hitK = c && c.hitK || 0.5; plan.swingMul = c && c.swing || 1; plan.dmg = c && c.dmg || 1;
  plan.fin = !!(c && c.fin);
  if (c) plan.side = c.line;
}
// a THRUST can't be stopped by a held guard: the shared parry-or-dodge tell (fx/tells.js)
function thrustTell(e){ tellFx('parry', e.group.position, 2.6); }
// a quick strike out of turn order: the answer to a blocked cut, or a riposte after a dodge (it still needs a free turn: ai.js)
export function quickStrike(e, wind){
  e.state = 'windup'; e.wu = wind; e.st = wind;
  planAttack(e, true);
  S.windup(e.group.position, false);
  if (e.riposteNext) floater(V3(e.group.position.x, e.group.position.y + 1.5, e.group.position.z), 'RIPOSTE', '#ffb35a');
  e.group.userData.bodyMat.emissive.setHex(0xff2a18);
}
// the feint check, run every wind-up frame: past the break point it snaps to the other side and comes in fast
export function maybeFeint(e, wk){
  const pl = e.plan;
  if (!pl || !pl.feint || wk < DUEL.feintAt) return false;
  pl.feint = false;
  const was = pl.side;
  setCut(pl, nextCut(e, was));
  if (!pl.c || pl.side === was || pl.side === 'T'){   // (no string, or it only had the one line: the old switch)
    const o = ['L', 'R', 'H'].filter(l => l !== was);
    setCut(pl, null); pl.side = o[(Math.random() * o.length) | 0];
  }
  pl.w0 = armNow(e);
  e.lastSide = pl.side;
  e.wu = e.wuBase = DUEL.feintRewind; e.st = e.wu;
  if (e.form) S.swing(e.form, e.group.position); else S.whoosh(e.group.position, false);
  sparks(V3(e.group.position.x, 1.9, e.group.position.z), e.t.eye, 4, 5, { life: 0.2 });
  return true;
}
// after a strike: another cut in the string? (returns true if it chained). The last cut of a long enough string may be
// its FINISHER (the spin, the slam: FOE_STRINGS fin), wound up longer and lit amber so it reads
export function chainNext(e){
  const pl = e.plan;
  if (!pl || pl.chain <= 0 || e.dead) return false;
  pl.chain--;
  if (!spend(e, DUEL.breath.chain)){ pl.chain = 0; return false; }   // out of breath: the string ends here
  const Str = FOE_STRINGS[e.dp.moves], p = e.dp;
  const fin = pl.chain === 0 && Str && Str.fin && p.finisher && G.diff !== 'padawan' && pl.n + 1 >= Str.finAfter
    && Math.random() < p.finisher * skill(e);
  const was = pl.side;
  pl.w0 = armNow(e);
  setCut(pl, fin ? Str.fin : nextCut(e, was));
  if (!pl.c){ const o = ['L', 'R', 'H'].filter(l => l !== was); pl.side = o[(Math.random() * o.length) | 0]; }
  pl.n++;
  e.lastSide = pl.side;
  pl.hold = 0; pl.feint = false;
  const wu = pl.fin ? Math.max(DUEL.chainWindup, e.t.windup * 0.8) * (pl.c.wind || 1) : DUEL.chainWindup;
  e.state = 'windup'; e.wu = e.wuBase = wu; e.st = e.wu;
  if (pl.side === 'T') thrustTell(e);
  S.windup(e.group.position, pl.fin);
  return true;
}

/* ---------------- footwork (data/duel.js FOOTWORK) ---------------- */
// with its turn, a duellist holds just outside its reach for a beat before it steps in (true while it measures)
export function measuring(e, dt, dist){
  const F = FOOTWORK;
  if (!e.dp || !e.dp.footwork || !e.token || e.winded){ e.measT = null; return false; }
  if (e.measT == null){
    if (dist > e.t.range + F.reachIn + F.measure + 1.5) return false;
    e.measT = rand(F.beat[0], F.beat[1]) * (G.diff === 'padawan' ? F.padawan : 1);
  }
  if (e.measT > 0){ e.measT -= dt; return true; }
  return false;
}
// how much further out than a plain trooper it may start its wind-up (its cut steps in to close it)
export const footReach = e => e.dp && e.dp.footwork && !e.winded ? FOOTWORK.reachIn : 0;
// its string is over: it skips back out of your reach (not after a finisher: that one leaves it standing there, open)
export function stringDone(e){
  if (e.dp && e.dp.footwork && !(e.plan && e.plan.fin) && Math.random() < 0.6) e.skipT = FOOTWORK.backT;
}

/* ---------------- defence: does this blow get turned? ---------------- */
// kind: 'cut' | 'finisher' | 'punch' | 'punchHeavy'. Returns 'block', 'dodge', 'break' (guard shattered, blow lands)
// or null (it lands normally).
export function duelDefend(e, line, kind, heavy, at){
  if (e.net) return netDefend(e, line, kind, heavy, at);   // a co-op guest's blow on the host's duellist (below)
  const p = e.dp;
  if (!p || e.dead || e.converted || !GUARDING[e.state] || e.stunT > 0 || e.dodgeT > 0) return null;
  const g = e.group, pp = playerPos();
  const efx = Math.sin(g.rotation.y), efz = Math.cos(g.rotation.y);
  const dx = pp.x - g.position.x, dz = pp.z - g.position.z, dl = Math.hypot(dx, dz) || 1;
  // RHYTHM — how quickly this blow follows your last one at it (DUEL.rhythm): a mash builds a streak it can read
  const R = DUEL.rhythm;
  e.rhyN = G.gt - e.rhyAt < R.gap ? e.rhyN + 1 : 1; e.rhyAt = G.gt;
  if ((efx * dx + efz * dz) / dl < 0.35) return null;   // a blow from the flank or behind always lands
  // BRACING (the Warbringer): it turns nothing, the blow lands, but the strain builds: light cuts a little, a finisher,
  // heavy punch or Djem So cut in full (the stance's own multiplier), and every blow takes a little breath
  if (p.brace){
    const P = DUEL.posture, W = WARBRINGER, light = kind === 'cut' || kind === 'punch';
    const base = kind === 'finisher' ? P.finisher : kind === 'punchHeavy' ? P.punchHeavy : kind === 'punch' ? P.punch : P.cut;
    drainBreath(e, kind === 'finisher' ? W.drain.finisher : W.drain.cut);
    addPosture(e, base * (light ? W.cut : 1) * (!isGunner() ? stance().postureMul || 1 : heavy ? P.heavyMul : 1), dx / dl, dz / dl);
    return null;
  }
  if (G.gt < (e.openUntil || 0)) return null;           // caught recovering from its own swing: the guard isn't up yet
  if (e.winded) return null;                             // out of breath: nothing left to guard with
  const m = diffMul() * skill(e);
  // what it does with this blow: the call it made when it read the cut in the chamber (readCut), else made now
  const sw = player.swing, rd = sw && sw.reads && sw.reads.get(e);
  const dec = rd && rd.line === line ? rd.dec : decide(e, line, kind, e.rhyN);
  if (rd) sw.reads.set(e, { line: null, dec: null });   // spent: a second contact on the same swing rolls afresh
  // a light cut seen coming: the agile ones slip it with a backstep
  if (dec === 'dodge' && spend(e, DUEL.breath.dodge)){
    e.dodgeT = p.flip ? DUEL.flipTime : 0.3; e.dodgeX = -dx / dl; e.dodgeZ = -dz / dl;
    // a SIDESTEP: out to one side of the cut and round you a little, instead of straight back
    e.dodgeSide = !p.flip && Math.random() < (p.side || 0) ? (Math.random() < 0.5 ? 1 : -1) : 0;
    if (e.dodgeSide){ const sx = -dz / dl * e.dodgeSide - dx / dl * 0.35, sz = dx / dl * e.dodgeSide - dz / dl * 0.35, sl = Math.hypot(sx, sz); e.dodgeX = sx / sl; e.dodgeZ = sz / sl; }
    e.state = 'recover'; e.st = Math.max(e.st, e.dodgeT + 0.05);
    floater(V3(g.position.x, g.position.y + 1.2, g.position.z), p.flip ? 'FLIPPED CLEAR' : e.dodgeSide ? 'SIDESTEP' : 'SLIPPED', '#c8d4e0');
    S.dash();
    if (Math.random() < p.counter * m) e.counterQueued = true;
    return 'dodge';
  }
  // PARRY — a mash is read, whatever line it comes in on: the blade is thrown off and it answers at once
  if (dec === 'parry' && spend(e, DUEL.breath.block)){
    e.rhyN = 0; e.counterQueued = true; e.guard = line;
    const cp = at || V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7);
    punishMash(cp, e.form);
    floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'PARRIED', '#ff8a5a');
    return 'block';
  }
  const ang = kind === 'cut' || kind === 'finisher' ? arrival(sw) : null;
  if (dec !== 'block' || !spend(e, DUEL.breath.block)){
    // it lands: the guard swings over to cover that line next time
    if (Math.random() < 0.6){ e.guard = line; e.guardT = rand(DUEL.guardShift[0], DUEL.guardShift[1]); }
    e.lineStreak = 0;
    return null;
  }
  // BLOCKED — the guard turns it; posture takes the strain. The same cut again (the same line, or an angle cut within
  // DUEL.arc.repeat of the last) builds its read of you
  const same = ang != null && e.lastAng != null ? angDist(ang, e.lastAng) < DUEL.arc.repeat : e.lastLine === line;
  e.lineStreak = same ? e.lineStreak + 1 : 1;
  e.lastLine = line; e.lastAng = ang; e.guard = line;
  const P = DUEL.posture;
  const cost = (kind === 'finisher' ? P.finisher : kind === 'punchHeavy' ? P.punchHeavy : kind === 'punch' ? P.punch : P.cut) * (!isGunner() ? stance().postureMul || 1 : heavy ? P.heavyMul : 1);   // saber forms set their own strain (Ataru 0.8, Niman 1, Djem So 1.5); fists and the darksaber keep the heavy multiplier
  // the flash goes where the blades cross (`at`, from player/jedi/clash.js), else just in front of the foe
  const cp = at || V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7);
  if (addPosture(e, cost, dx / dl, dz / dl)) return 'break';
  e.arcFlash = 0.6;
  clashFlash(cp, isGunner() ? 0xffd28a : stance().blade, false);
  clashSparks(cp, 0xffe9b0, 4);
  S.clash(cp, false, e.form);
  G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.2);
  if (p.tire && !isGunner()){ player.stam = Math.max(0, player.stam - p.tire); player.stamDelay = stamDelay(); }   // SORESU: the wall wears you out
  if (e.lineStreak >= DUEL.adaptAfter) floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'READ YOU', '#ffb35a');
  else floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'BLOCKED', '#c8d4e0');
  // and the answer: a fast riposte, if it has the skill and the breath
  if (G.gt - e.counterAt > DUEL.counterCd && Math.random() < p.counter * m * (e.lineStreak >= DUEL.adaptAfter ? 1.5 : 1)
      && (e.breath == null || e.breath >= DUEL.breath.counter)){ e.counterQueued = true; if (p.riposte) e.riposteNext = true; }   // DJEM SO: the answer lands harder
  return 'block';
}

/* the roll behind a guard's answer to a blow on `line` ('dodge' | 'parry' | 'block' | null), with no side effects: the
   agile slip a light blow, a mash (rhyN quick blows in a row) gets parried, and otherwise the guard holds by its odds on
   the line it covers (block), much worse off it (offLine), near certain on a line you keep repeating (adaptAfter) */
function decide(e, line, kind, rhyN){
  const p = e.dp, m = diffMul() * skill(e), R = DUEL.rhythm;
  const has = amt => e.breath == null || (!e.winded && e.breath >= amt);
  if (p.dodge && (kind === 'cut' || kind === 'punch') && Math.random() < p.dodge * m && has(DUEL.breath.dodge)) return 'dodge';
  if (p.parry && rhyN > R.after && kind !== 'finisher' && Math.random() < p.parry * m && has(DUEL.breath.block)) return 'parry';
  // how squarely the guard covers it: on the line, or (an angle cut) how far inside its arc it arrives (DUEL.arc)
  const ang = kind === 'cut' || kind === 'finisher' ? arrival(player.swing) : null;
  let cover = line === e.guard ? 1 : 0;
  if (ang != null){
    const A = DUEL.arc, d = angDist(ang, GUARD_ANG[e.guard] ?? 90);
    cover = 1 - THREE.MathUtils.smoothstep(d, A.cover, A.cover + A.feather);
  }
  // SEALED ARC — a cut that arrives inside the glowing crescent (the side it is guarding) never gets through: flank it to the
  // open side, or break its guard (kick, parry, saber lock, posture) / wait out its shift. Winded or caught open it has no arc.
  const onLine = cover > 0.5;
  if (onLine && has(DUEL.breath.block)) return 'block';
  let chance = p.block * (DUEL.offLine + (1 - DUEL.offLine) * cover);
  if (onLine && e.lineStreak >= DUEL.adaptAfter) chance = 0.95;   // it has your rhythm: same cut, same answer
  if (kind === 'finisher') chance *= 0.75;
  if (!isGunner()) chance *= stance().duelBlockMul || 1;   // Shii-Cho's broad cuts are easy to read
  return Math.random() < Math.min(0.95, chance * m) && has(DUEL.breath.block) ? 'block' : null;
}
// can it answer a blow from you at all right now (facing you, guard up, not caught open or winded, not a brace)?
function canGuard(e){
  const p = e.dp;
  if (!p || p.brace || e.dead || e.converted || !GUARDING[e.state] || e.stunT > 0 || e.dodgeT > 0) return false;
  if (G.gt < (e.openUntil || 0) || e.winded) return false;
  const g = e.group, pp = playerPos();
  const dx = pp.x - g.position.x, dz = pp.z - g.position.z, dl = Math.hypot(dx, dz) || 1;
  return (Math.sin(g.rotation.y) * dx + Math.cos(g.rotation.y) * dz) / dl >= 0.35;
}

// your mashed cut is parried: the swing is thrown wide, the arm jars and the breath goes out of you
function punishMash(cp, form){
  const R = DUEL.rhythm;
  player.stam = Math.max(0, player.stam - R.stam); player.stamDelay = stamDelay();
  player.flinchT = player.flinchMax = Math.max(player.flinchT || 0, R.flinch);
  player.queuedAtk = false;
  clashFlash(cp, 0xff8a5a, true);
  clashSparks(cp, 0xffc890, 5);
  S.parry(cp, form);
  G.hitstop = Math.max(G.hitstop, 0.09); G.shake = Math.max(G.shake, 0.45);
}

// add guard strain; past the profile's posture the guard BREAKS (staggered, wide open). Returns true on a break.
export function addPosture(e, amt, awayX, awayZ){
  if (!e.dp || e.dead) return false;
  e.posture += amt; e.postureAt = G.gt;
  if (e.posture < e.dp.posture) return false;
  e.posture = 0; e.lineStreak = 0; e.counterQueued = false;
  staggerEnemy(e, awayX, awayZ, e.dp.brace ? 'POSTURE BROKEN' : 'GUARD BROKEN');
  tutEvent('guardBreak', e);
  e.st += 0.3;   // a broken guard stays open a touch longer than a parried swing
  if (e.dp.brace){ e.st = WARBRINGER.open; e.openUntil = G.gt + e.st; }   // the Warbringer's break: a long opening, every blow lands harder
  const g = e.group, cp = V3(g.position.x, g.position.y + 1.6, g.position.z);
  clashFlash(cp, 0xffd24a, true);
  clashSparks(cp, 0xffd24a, 6);
  G.hitstop = Math.max(G.hitstop, 0.12); G.shake = Math.max(G.shake, 0.6);
  G.slowmo = Math.min(G.slowmo, 0.4); G.slowmoT = Math.max(G.slowmoT, 0.15);
  return true;
}
// a kick or shoulder-check into a guard: no block roll, just posture (JA: the kick is the answer to a turtle)
export function guardImpact(e, amt){
  if (e.net){ if (isGuarding(e) && hooks.guard) hooks.guard(e, 'impact', amt, line0(e)); return false; }   // co-op guest: the host's foe takes it
  if (!e.dp || !GUARDING[e.state]) return false;
  const pp = playerPos(), g = e.group;
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dl = Math.hypot(dx, dz) || 1;
  return addPosture(e, amt, dx / dl, dz / dl);
}
// is this foe holding a guard right now (facing you, not mid-swing)?
export const isGuarding = e => e.net ? !!(e.ng && e.ng[1]) && !e.dead : !!e.dp && !!GUARDING[e.state] && !e.converted && !e.dead;

/* ---------------- a saber user bats your blaster bolt straight back ---------------- */
export function deflectPlayerBolt(e, b){
  const p = e.dp;
  if (!p || !p.deflect || e.dead || e.converted || !(GUARDING[e.state] || e.state === 'windup')) return false;
  const g = e.group;
  const efx = Math.sin(g.rotation.y), efz = Math.cos(g.rotation.y);
  if (-(b.dir.x * efx + b.dir.z * efz) < 0.4) return false;   // only what comes at its front
  if (Math.random() >= p.deflect * diffMul()) return false;
  const pp = playerPos(), from = b.mesh.position.clone();
  const aim = V3(pp.x + rand(-0.7, 0.7), pp.y + 1.3 + rand(-0.4, 0.4), pp.z + rand(-0.7, 0.7)).sub(from).normalize();
  b.dir.copy(aim); b.friendly = false; b.playerShot = false; b.life = 3; b.dmg *= 0.7;
  b.mesh.material.color.setHex(0xff3322);
  b.mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), aim);
  b.mesh.position.addScaledVector(aim, 0.6);
  e.guard = 'H'; e.arcFlash = 0.5;
  if (e.group.userData.weaponArm) e.group.userData.weaponArm.rotation.z = rand(-1, 1);
  clashFlash(from, e.t.eye, false);
  S.deflect(from);
  floater(V3(g.position.x, g.position.y + 1.2, g.position.z), 'DEFLECTED', '#ff8a7a');
  return true;
}

/* ============================================================
   SABER LOCK — blades bind. Mash LMB to drive through (your form decides how hard each press pushes), break it with a
   kick (E) for stamina or a Force push (F) for Force. Win: the foe reels, guard broken, your riposte is up. Lose: its
   blade gets through. Hold too long and the bind breaks apart. Where the blades met sets the kind of bind (high, low,
   mid, or body to body out of a long exchange: DUEL.lockKinds), how it looks, how hard it bears down and how it ends.
   ============================================================ */
export const LOCK = { foe: null, bal: 0, t: 0, fx: 0, buzz: 0, kind: 'mid', next: 0, tell: 0, surge: 0, met: 0 };
const lockKind = () => DUEL.lockKinds[LOCK.kind] || DUEL.lockKinds.mid;
// the kind of bind a clash at `at` makes (no contact point: the height of your cut)
export function lockKindAt(at){
  const A = DUEL.lockKinds.at, sw = player.swing;
  if (!at) return sw && sw.h === 'high' ? 'high' : sw && sw.h === 'low' ? 'low' : 'mid';
  const y = at.y - playerPos().y;
  return y > A.high ? 'high' : y < A.low ? 'low' : 'mid';
}
let lockEl = null, lockFill = null;
function lockBar(show){
  if (!lockEl){ lockEl = document.getElementById('lockbar'); lockFill = lockEl && lockEl.querySelector('.lb-fill'); }
  if (lockEl) lockEl.classList.toggle('on', show);
  if (lockEl && !show) lockEl.classList.remove('tell', 'surge');
}
export function startLock(e, kind){
  if (LOCK.foe || !e.dp || !e.dp.lock) return false;
  LOCK.foe = e; LOCK.bal = 0; LOCK.t = 0; LOCK.fx = 0; LOCK.buzz = 0; LOCK.kind = DUEL.lockKinds[kind] ? kind : 'mid';
  LOCK.next = rand(DUEL.lock.surge.first[0], DUEL.lock.surge.first[1]); LOCK.tell = LOCK.surge = 0; LOCK.met = 0;
  const K = lockKind();
  e.flourishT = 0; e.fl0 = null;
  e.state = 'lock'; e.st = 99; e.plan = null;
  player.saberLock = true; player.atkT = 0; player.swing = null; player.queuedAtk = false; player.parryT = 0;
  const pp = playerPos(), g = e.group;
  TMP.subVectors(g.position, pp); TMP.y = 0; const d = TMP.length() || 1; TMP.divideScalar(d);
  g.position.x = pp.x + TMP.x * K.dist; g.position.z = pp.z + TMP.z * K.dist;   // close in, blade to blade (body to body)
  g.rotation.y = Math.atan2(-TMP.x, -TMP.z);
  player.lockFace = player.faceYaw = Math.atan2(TMP.x, TMP.z);   // squared to it for the whole bind (player/animation.js)
  const cp = lockPoint();
  clashFlash(cp, stance().blade, true);
  clashSparks(cp, 0xffe9b0, 6);
  S.clash(cp, true, e.form);
  G.hitstop = Math.max(G.hitstop, 0.12); G.shake = Math.max(G.shake, 0.6);
  G.slowmo = Math.min(G.slowmo, 0.35); G.slowmoT = Math.max(G.slowmoT, 0.25);
  if (!G.seenLock){ G.seenLock = true; showBanner('SABER LOCK', 'Mash LMB to drive through · E to kick out · F to Force-shove', 2.6); }
  if (K.label) floater(V3(cp.x, cp.y + 0.45, cp.z), K.label, '#ffe9a8');
  lockBar(true);
  if (G.stats) G.stats.locks = (G.stats.locks || 0) + 1;
  return true;
}
// where the blades cross: between you, slid toward whoever is giving ground
function lockPoint(){
  const pp = playerPos(), q = LOCK.foe ? LOCK.foe.group.position : pp;
  const k = 0.5 + clamp(LOCK.bal, -1, 1) * DUEL.lock.press3d.slide;
  return V3(pp.x + (q.x - pp.x) * k, pp.y + lockKind().y, pp.z + (q.z - pp.z) * k);
}
export function updateSaberLock(dt){
  const e = LOCK.foe;
  if (!e) return;
  if (e.dead || e.state !== 'lock' || G.mode !== 'play'){ endLock(); return; }
  if (player.dashT > 0 || player.flinchT > 0.3){ splitLock(); return; }   // dashed (or knocked) out of it
  LOCK.t += dt;
  const K = lockKind(), L = DUEL.lock, Sg = L.surge, P3 = L.press3d;
  // THE SURGE — every so often it gathers itself (its body flares, the bar's edge glows: the tell), then bears down
  // hard for a beat. Meet it with your own presses and you hold the line; let it come and the bind slides your way.
  if (LOCK.surge > 0) LOCK.surge -= dt;
  else if (LOCK.tell > 0){
    if ((LOCK.tell -= dt) <= 0){
      LOCK.surge = Sg.dur; LOCK.met = 0;
      sfx(rand(70, 85), 0.3, 'sawtooth', 0.05, rand(40, 50));   // the grind of it bearing down
      G.shake = Math.max(G.shake, 0.4);
    }
  } else if ((LOCK.next -= dt) <= 0){
    LOCK.tell = Sg.tell / Math.sqrt(diffMul()); LOCK.next = rand(Sg.every[0], Sg.every[1]);
    sfx(rand(300, 340), Sg.tell, 'triangle', 0.025, rand(620, 700));   // the rising whine before it pushes
    if (!G.seenSurge){ G.seenSurge = true; floater(V3(e.group.position.x, e.group.position.y + 2.1, e.group.position.z), 'IT BEARS DOWN · MASH TO MEET IT', '#ff9a6a'); }
  }
  if (lockEl){ lockEl.classList.toggle('tell', LOCK.tell > 0); lockEl.classList.toggle('surge', LOCK.surge > 0); }
  const surging = LOCK.surge > 0;
  LOCK.bal -= e.dp.push * K.push * diffMul() * dt * (0.8 + LOCK.t * 0.15) * (surging ? Sg.mul : 1);   // it bears down harder the longer it lasts
  const g = e.group, pp = playerPos(), u = g.userData;
  // face to face, weapon on the bind's line; whoever is winning leans in, the loser bends back (body to body: chest to chest)
  const ax = g.position.x - pp.x, az = g.position.z - pp.z, ad = Math.hypot(ax, az) || 1;
  g.rotation.y = Math.atan2(-ax, -az);
  player.lockFace = Math.atan2(ax, az);
  const b = clamp(LOCK.bal, -1, 1);
  const want = K.dist + b * P3.give;   // driven back as you win, crowding you as it does
  g.position.x = pp.x + ax / ad * dampToward(ad, want, dt, 6); g.position.z = pp.z + az / ad * dampToward(ad, want, dt, 6);
  g.rotation.x = dampToward(g.rotation.x, (LOCK.kind === 'body' ? 0.24 : 0.14) - b * P3.lean + (surging ? 0.1 : 0), dt, 10);
  const tr = Math.sin(G.gt * 31) * (0.04 + (surging ? 0.05 : 0));   // the blades tremble against each other, worse in a surge
  if (u.weaponArm){ u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, K.arm[0] + tr - b * P3.arm, dt, 14); u.weaponArm.rotation.z = dampToward(u.weaponArm.rotation.z, K.arm[1], dt, 14); }
  if (u.staff){ u.staff.rotation.z = dampToward(u.staff.rotation.z, K.staff[0] - b * P3.arm, dt, 14); u.staff.rotation.x = dampToward(u.staff.rotation.x, K.staff[1], dt, 14); }
  const flare = LOCK.tell > 0 ? 0.6 + Math.sin(G.gt * 40) * 0.4 : 0;
  g.userData.bodyMat.emissive.setHex(flare ? 0xffd0a0 : 0xff3a1a); g.userData.bodyMat.emissiveIntensity = 0.3 + Math.max(0, -b) * 0.8 + flare + (surging ? 0.5 : 0);
  // your blade braced against it (the catch pose, held at the bind): pressed down toward you as you lose, up and over it
  // as you win
  if (!isGunner() || player.weapon === 'darksaber'){
    const fy = player.faceYaw;
    if (!player.deflectAnim) player.deflectAnim = { t: 0, dur: 0.3, pose: null, side: (ax * -Math.cos(fy) + az * Math.sin(fy)) / ad * 0.3, h: K.h };
    player.deflectAnim.t = Math.min(player.deflectAnim.t, 0.07);
    if (player.lockPush > 0) player.lockPush -= dt;
    player.deflectAnim.h = K.h + (b < 0 ? b * P3.sink : b * P3.rise) + tr * 0.5 + Math.max(0, player.lockPush || 0) * 0.8;
  }
  // the bind sizzles: sparks spit from the contact, a crackling buzz, the lens trembles (all of it harder in a surge)
  const cp = lockPoint();
  if ((LOCK.fx -= dt) <= 0){ LOCK.fx = surging ? 0.025 : 0.05; sparks(cp, Math.random() < 0.5 ? 0xffe9b0 : stance().blade, surging ? 3 : 2, surging ? 8 : 6, { life: 0.16, size: 0.34 }); }
  if ((LOCK.buzz -= dt) <= 0){ LOCK.buzz = surging ? 0.07 : 0.11; sfx(rand(90, 120), 0.12, 'sawtooth', 0.03, rand(140, 180)); }
  G.shake = Math.max(G.shake, 0.1 + Math.abs(LOCK.bal) * 0.15 + (surging ? 0.15 : 0));
  if (lockFill) lockFill.style.left = (50 + clamp(LOCK.bal, -1, 1) * 50) + '%';
  if (LOCK.bal >= 1) winLock(K.win);
  else if (LOCK.bal <= -1) loseLock();
  else if (LOCK.t > DUEL.lock.time) splitLock();
}
// LMB in a lock: drive the blade. Each press costs a little stamina; a dry press barely moves it.
export function lockPress(){
  if (!LOCK.foe) return;
  const L = DUEL.lock;
  const formMul = isGunner() ? 1.1 : G.stance === 'djemso' ? L.heavyPress : G.stance === 'ataru' ? L.fastPress : 1;
  const dry = player.stam < L.stam;
  player.stam = Math.max(0, player.stam - L.stam); player.stamDelay = stamDelay();
  // a press into its surge MEETS it: worth more, and the first few say so
  const meet = LOCK.surge > 0 ? L.surge.meet : 1;
  LOCK.bal += L.press * formMul * (dry ? 0.35 : 1) * meet;
  if (meet > 1 && ++LOCK.met === 3) floater(V3(LOCK.foe.group.position.x, LOCK.foe.group.position.y + 1.9, LOCK.foe.group.position.z), 'MET IT', '#ffe9a8');
  player.lockPush = 0.12;   // each shove jolts your blade up into its (updateSaberLock)
  sparks(lockPoint(), 0xffffff, 3, 9, { life: 0.18, size: 0.4 });
  sfx(rand(150, 190), 0.06, 'square', 0.03, 90);
}
// E in a lock: a boot to the gut ends it — if you have the stamina
export function lockKick(){
  if (!LOCK.foe) return;
  if (player.stam < DUEL.lock.kickStam){ floater(playerPos(), 'WINDED', '#ffaa66'); return; }
  player.stam -= DUEL.lock.kickStam; player.stamDelay = stamDelay();
  if (!isGunner()){ player.kickT = player.kickMax = 0.4; }
  else { player.meleeT = player.meleeMax = 0.4; player.meleeKind = 'knee'; }
  winLock('KICKED LOOSE', 22);
}
// F in a lock: a Force shove at point-blank range
export function lockPush(){
  if (!LOCK.foe || isGunner()) return false;
  if (player.force < DUEL.lock.pushCost) return false;
  player.force -= DUEL.lock.pushCost;
  player.castT = player.castMax = 0.3; player.castKind = 'push';
  S.push();
  winLock('FORCE SHOVE', 30);
  return true;
}
function winLock(label, knock){
  const e = LOCK.foe, pp = playerPos(), g = e.group, K = lockKind();
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dl = Math.hypot(dx, dz) || 1;
  endLock();
  if (e.net && hooks.guard) hooks.guard(e, 'lockwin', 0, '');   // co-op guest: the host's foe loses its wind (net/foefire.js)
  e.state = 'recover';
  // a low bind won throws it aside, off its feet's line, with its knees giving; the others drive it straight back
  const sd = K.side ? (Math.random() < 0.5 ? 1 : -1) : 0;
  const sx = dx / dl - dz / dl * sd * 0.9, sz = dz / dl + dx / dl * sd * 0.9, sl = Math.hypot(sx, sz) || 1;
  staggerEnemy(e, sx / sl, sz / sl, label);
  if (K.side && !e.t.heavy) e.buckle = 0.4;
  knock = Math.max(knock || 0, K.knock || 0);
  e.st += 0.4 + (K.open || 0); e.posture = 0;
  drainBreath(e, DUEL.breath.lock);   // a bind lost takes the wind out of it
  tutEvent('guardBreak', e);   // winning the bind breaks its guard too
  if (knock) damageEnemy(e, 8, V3(dx / dl, 0, dz / dl), knock);
  player.riposteT = CFG.player.riposteTime + 0.3; player.ripLine = null;
  const cp = lockPoint();
  clashFlash(cp, 0xffd24a, true);
  clashSparks(cp, 0xffe27a, 6, { dir: V3(dx / dl, 0.2, dz / dl), cone: 0.8 });
  screenFlash('radial-gradient(ellipse at center, rgba(255,240,180,.22), transparent 45%)', 0.5, 0.2);
  G.hitstop = Math.max(G.hitstop, 0.16); G.slowmo = Math.min(G.slowmo, 0.3); G.slowmoT = Math.max(G.slowmoT, 0.3);
  S.parry(cp, LOCK.foe && LOCK.foe.form);
  if (G.stats) G.stats.locksWon = (G.stats.locksWon || 0) + 1;
}
function loseLock(){
  const e = LOCK.foe, g = e.group, K = lockKind();
  endLock();
  if (e.net && hooks.guard) hooks.guard(e, 'lockloss', 0, '');   // co-op guest: the host's foe answers
  e.state = 'recover'; e.st = 0.25; e.counterQueued = true;
  player.parryT = 0;
  hurtPlayer(DUEL.lock.loseDmg * enemyDmgScale(), g.position, false, true, false, { unblockable: true, noClash: true });
  player.flinchT = player.flinchMax = CFG.player.flinch.heavy; player.flinchHeavy = true;
  floater(playerPos(), K.lose, '#ff6a3a');
}
function splitLock(){
  const e = LOCK.foe, pp = playerPos(), g = e.group;
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dl = Math.hypot(dx, dz) || 1;
  endLock();
  e.state = 'recover'; e.st = 0.5;
  flinchEnemy(e, V3(dx / dl, 0, dz / dl), 1.2);
  player.vel.x -= dx / dl * 6; player.vel.z -= dz / dl * 6;
  S.clash(lockPoint(), false, LOCK.foe && LOCK.foe.form);
}
export function endLock(){
  const e = LOCK.foe;
  LOCK.foe = null;
  player.saberLock = false; player.lockFace = null;
  player.deflectAnim = null;
  lockBar(false);
  if (e && e.state === 'lock' && !e.dead){ e.state = 'recover'; e.st = 0.4; }
  if (e) e.flourishNext = G.gt + DUEL.flourish.after + 0.6;   // the bind broken, it resets its stance with a twirl
}

/* ---------------- online co-op: the host's duellists on the guest's screen ----------------
   The host runs every duellist (net/foes.js), so its guard, posture and breath live there. Each snapshot carries a
   foe's guard as `duelRec`; the guest keeps it on the puppet (e.ng) to draw the crescent and the posture bar, and to
   meet its own cuts with the same rules a solo fight has (the sealed arc, the off-line odds). A cut the guest's screen
   turns is sent back (hooks.guard), and the host puts the posture and breath it costs on the real foe. */
const NG = { line: 0, up: 1, posture: 2, breath: 3, read: 4, block: 5, brace: 6, winded: 7,
  lock: 8, push: 9, deflect: 10, dodge: 11, parry: 12, flip: 13, side: 14, max: 15, elite: 16 };   // (8 on: its profile, for the puppet's e.dp)
const line0 = e => LINES[e.ng ? e.ng[NG.line] : 2] || 'H';
// host: a duellist's guard as the snapshot sends it, or 0
export function duelRec(e){
  const p = e.dp;
  if (!p) return 0;
  const up = !p.brace && GUARDING[e.state] && !e.converted && !(e.stunT > 0) && !(e.dodgeT > 0) && !(G.gt < (e.openUntil || 0)) && !e.winded;
  return [Math.max(0, LINES.indexOf(e.guard)), up ? 1 : 0, Math.round(clamp(e.posture / p.posture, 0, 1) * 100),
    e.breath != null ? Math.round(clamp(e.breath / e.breathMax, 0, 1) * 100) : -1, e.lineStreak >= DUEL.adaptAfter ? 1 : 0,
    Math.round((p.block || 0) * 100), p.brace ? 1 : 0, e.winded ? 1 : 0,
    p.lock ? 1 : 0, Math.round((p.push || 0) * 100), Math.round((p.deflect || 0) * 100), Math.round((p.dodge || 0) * 100),
    Math.round((p.parry || 0) * 100), Math.round((p.flip || 0) * 100), Math.round((p.side || 0) * 100), p.posture || 0, p.elite ? 1 : 0];
}
// guest: the puppet's own copy of the profile, from the snapshot (what its bolt deflection, the saber lock and the
// Makashi bonus read), rebuilt only when it changes
export function netProfile(e){
  const n = e.ng;
  if (!n || n.length <= NG.elite){ e.dp = null; e.dpKey = ''; return; }
  const key = n.slice(NG.block).join();
  if (key === e.dpKey) return;
  e.dpKey = key;
  e.dp = { block: n[NG.block] / 100, brace: !!n[NG.brace], lock: !!n[NG.lock], push: n[NG.push] / 100, deflect: n[NG.deflect] / 100,
    dodge: n[NG.dodge] / 100, parry: n[NG.parry] / 100, flip: n[NG.flip] / 100, side: n[NG.side] / 100, posture: n[NG.max], elite: !!n[NG.elite] };
}
// guest: does the host's duellist turn this blow? Same rules as duelDefend, read off the snapshot
function netDefend(e, line, kind, heavy, at){
  const n = e.ng;
  if (!n || e.dead) return null;
  const g = e.group, pp = playerPos();
  const dx = pp.x - g.position.x, dz = pp.z - g.position.z, dl = Math.hypot(dx, dz) || 1;
  const R = DUEL.rhythm;   // your rhythm at it, kept here: a mash builds a streak it can read
  e.rhyN = G.gt - (e.rhyAt ?? -9) < R.gap ? (e.rhyN || 0) + 1 : 1; e.rhyAt = G.gt;
  if ((Math.sin(g.rotation.y) * dx + Math.cos(g.rotation.y) * dz) / dl < 0.35) return null;   // the flank or the back always lands
  const P = DUEL.posture;
  const mul = !isGunner() ? stance().postureMul || 1 : heavy ? P.heavyMul : 1;
  if (n[NG.brace]){ if (hooks.guard) hooks.guard(e, kind, mul, line); return null; }   // the Warbringer braces: the strain builds on the host
  if (!n[NG.up]) return null;
  const p = e.dp || {}, m = diffMul() * (p.elite ? eliteRamp() : 1), fresh = !n[NG.winded];
  // a light blow seen coming: the agile ones slip it (the host moves the foe: the next snapshot shows the step or the flip)
  if (p.dodge && (kind === 'cut' || kind === 'punch') && fresh && Math.random() < p.dodge * m){
    if (hooks.guard) hooks.guard(e, 'dodge', 0, line);
    floater(V3(g.position.x, g.position.y + 1.2, g.position.z), p.flip ? 'FLIPPED CLEAR' : 'SLIPPED', '#c8d4e0');
    S.dash();
    return 'dodge';
  }
  // a mash is read and thrown off, whatever line it comes in on
  if (p.parry && e.rhyN > R.after && kind !== 'finisher' && fresh && Math.random() < p.parry * m){
    if (hooks.guard) hooks.guard(e, 'parry', 0, line);
    e.rhyN = 0;
    punishMash(at || V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7), e.form);
    floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'PARRIED', '#ff8a5a');
    return 'block';
  }
  const ang = kind === 'cut' || kind === 'finisher' ? arrival(player.swing) : null;
  const guard = LINES[n[NG.line]] || 'H';
  let cover = line === guard ? 1 : 0;
  if (ang != null){ const A = DUEL.arc, d = angDist(ang, GUARD_ANG[guard] ?? 90); cover = 1 - THREE.MathUtils.smoothstep(d, A.cover, A.cover + A.feather); }
  const onLine = cover > 0.5;   // the SEALED ARC: inside the crescent it is always turned
  let chance = n[NG.block] / 100 * (DUEL.offLine + (1 - DUEL.offLine) * cover) * m;
  if (kind === 'finisher') chance *= 0.75;
  if (!isGunner()) chance *= stance().duelBlockMul || 1;
  if (!onLine && !(Math.random() < Math.min(0.95, chance))) return null;
  if (hooks.guard) hooks.guard(e, kind, mul, line);
  e.arcFlash = 0.6;
  const cp = at || V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7);
  clashFlash(cp, isGunner() ? 0xffd28a : stance().blade, false);
  clashSparks(cp, 0xffe9b0, 4);
  S.clash(cp, false, e.form);
  G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.2);
  floater(V3(g.position.x, g.position.y + 1.3, g.position.z), n[NG.read] ? 'READ YOU' : 'BLOCKED', n[NG.read] ? '#ffb35a' : '#c8d4e0');
  return 'block';
}
// host: the guest's blow met this duellist's guard (kind 'impact': a kick, a shove or a fall into it, amt its posture;
// 'dodge' / 'parry': the guest's screen saw it slip or throw off the blow; 'lockwin' / 'lockloss': a saber lock with the
// guest ended). (ax, az): away from the guest's hero
export function netGuardHit(e, kind, amt, line, ax, az){
  const p = e.dp;
  if (!p || e.dead) return;
  const P = DUEL.posture;
  if (kind === 'impact'){ if (GUARDING[e.state]) addPosture(e, amt, ax, az); return; }
  if (kind === 'dodge'){
    if (!spend(e, DUEL.breath.dodge)) return;
    e.dodgeT = p.flip ? DUEL.flipTime : 0.3; e.dodgeX = ax; e.dodgeZ = az;
    e.dodgeSide = !p.flip && Math.random() < (p.side || 0) ? (Math.random() < 0.5 ? 1 : -1) : 0;
    if (e.dodgeSide){ const sx = az * e.dodgeSide + ax * 0.35, sz = -ax * e.dodgeSide + az * 0.35, sl = Math.hypot(sx, sz) || 1; e.dodgeX = sx / sl; e.dodgeZ = sz / sl; }
    e.state = 'recover'; e.st = Math.max(e.st, e.dodgeT + 0.05);
    if (Math.random() < p.counter * diffMul() * skill(e)) e.counterQueued = true;
    return;
  }
  if (kind === 'parry'){ if (spend(e, DUEL.breath.block)){ e.rhyN = 0; e.counterQueued = true; if (LINES.includes(line)) e.guard = line; } return; }
  if (kind === 'lockwin'){ e.posture = 0; drainBreath(e, DUEL.breath.lock); e.flourishNext = G.gt + DUEL.flourish.after + 0.6; return; }
  if (kind === 'lockloss'){ e.counterQueued = true; e.flourishNext = G.gt + DUEL.flourish.after + 0.6; return; }
  const base = kind === 'finisher' ? P.finisher : kind === 'punchHeavy' ? P.punchHeavy : kind === 'punch' ? P.punch : P.cut;
  if (p.brace){
    const W = WARBRINGER, light = kind === 'cut' || kind === 'punch';
    drainBreath(e, kind === 'finisher' ? W.drain.finisher : W.drain.cut);
    addPosture(e, base * (light ? W.cut : 1) * amt, ax, az);
    return;
  }
  spend(e, DUEL.breath.block);
  if (LINES.includes(line)){ e.lineStreak = e.lastLine === line ? e.lineStreak + 1 : 1; e.lastLine = line; e.guard = line; }
  e.arcFlash = 0.6;
  addPosture(e, base * amt, ax, az);
}
// guest: the crescent and the posture bar over a host's duellist, from the snapshot (updateDuel draws them for the host)
export function updatePuppetDuel(e, dt){
  const n = e.ng, g = e.group, a = g.userData.guardArc;
  if (!n){ if (a) a.visible = false; if (e.postBar) e.postBar.visible = false; return; }
  const pp = playerPos(), dist = Math.hypot(pp.x - g.position.x, pp.z - g.position.z);
  if (n[NG.block] >= 40){
    if (!a) makeGuardArc(e);
    const arc = g.userData.guardArc;
    arc.visible = !!n[NG.up] && !e.dead && dist < DUEL.guardRange;
    if (arc.visible){
      const L = LINES[n[NG.line]];
      const want = L === 'R' ? 0 : L === 'L' ? Math.PI : L === 'Lo' ? -Math.PI / 2 : Math.PI / 2;
      arc.rotation.z = dampToward(arc.rotation.z, want, dt, 14);
      e.arcFlash = Math.max(0, (e.arcFlash || 0) - dt * 4);
      arc.material.opacity = clamp(1 - dist / DUEL.guardRange, 0.15, 0.6) + e.arcFlash;
      arc.material.color.setHex(n[NG.read] ? 0xffb35a : 0xfff0c8);
    }
  }
  const brace = !!n[NG.brace], hasBreath = n[NG.breath] >= 0, spent = hasBreath && n[NG.breath] < 99;
  if ((n[NG.posture] > 0 || spent || brace) && !e.dead && (brace || dist < DUEL.guardRange * 2)){
    if (!e.postBar) makePostureBar(e, hasBreath);
    const b = e.postBar, k = n[NG.posture] / 100;
    b.visible = true;
    if (brace){ b.position.set(g.position.x, g.position.y + 2.7 * g.scale.x - 0.38, g.position.z); b.scale.set(1.9, 1.9, 1); }
    else b.position.set(g.position.x, g.position.y + 2.55 * (e.t.scale || 1), g.position.z);
    b.quaternion.copy(camera.quaternion);
    b.userData.fill.scale.x = Math.max(0.001, k);
    b.userData.fill.position.x = -(1 - k) * 0.55;
    b.userData.fill.material.color.setHex(e.state === 'stagger' && brace ? 0xffffff : k > 0.75 ? 0xff6a3a : 0xffd24a);
    const br = b.userData.breath;
    br.visible = hasBreath;
    if (hasBreath){
      const kb = n[NG.breath] / 100;
      br.scale.x = Math.max(0.001, kb);
      br.position.x = -(1 - kb) * 0.55;
      br.material.color.setHex(n[NG.winded] ? 0x3a5a8a : 0x9fd8ff);
    }
  } else if (e.postBar) e.postBar.visible = false;
}
