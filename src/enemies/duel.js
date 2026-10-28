// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Duelling foes: guards and posture, feints, delayed strikes, strings, counters, bolt deflection, and the saber lock.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { stamDelay } from '../player/stamina.js';
import { DUEL, DUEL_PROFILES, WARBRINGER, WARBRINGER_PROFILE, GUARD_POSE, BLOCK_POSE, WIND } from '../data/duel.js';
import { scene, camera } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP, dampToward } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { sparks, clashFlash } from '../fx/ink.js';
import { spawnHitSpark, spawnGroundShock } from '../fx/vfx.js';
import { G, enemies, player } from '../state.js';
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

const LINES = ['L', 'R', 'H', 'Lo'];   // the lines a guard covers (Lo: the legs)
const SIDES = ['L', 'R', 'H'];         // the lines a foe strikes from
const GUARDING = { chase: 1, recover: 1 };
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
  if (sw.pat.h === 'low' && !/^rise/.test(sw.pat.id)) return 'Lo';   // a sweep at the knees or a thrust aimed low (the rising cuts come up across a side)
  return sw.pat.yF < -0.5 ? 'L' : sw.pat.yF > 0.5 ? 'R' : 'H';
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
    g.position.x += e.dodgeX * DUEL.dodgeStep * dt; g.position.z += e.dodgeZ * DUEL.dodgeStep * dt;
    g.rotation.x = -0.25 * Math.max(0, e.dodgeT) / 0.3;
  }
  const guarding = !p.brace && GUARDING[e.state] && dist < DUEL.guardRange && !e.converted;   // (a bracing foe holds no guard: no pose, no arc)
  // hold the weapon on the guarded line (the readable tell), back to the carry otherwise
  if (guarding && !(e.dodgeT > 0)){
    readCut(e, dist);
    guardPose(e, dt);
  }
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
function makePostureBar(e){
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
  bbg.visible = !!e.dp.stam;
  scene.add(grp); e.postBar = grp;
}

/* ---------------- weapon poses ---------------- */
// the guard on its line, or (a cut read and about to be met: readCut) the block out on the cut's line, snapped there fast
function guardPose(e, dt){
  const u = e.group.userData;
  const blk = e.blockLine && G.gt - e.blockAt < DUEL.read.hold;
  const P = blk ? BLOCK_POSE : GUARD_POSE, line = blk ? e.blockLine : e.guard, k = blk ? DUEL.read.rate : 9;
  if (u.staff){
    const p = P.staff[line];
    u.staff.rotation.z = dampToward(u.staff.rotation.z, p[0], dt, k);
    u.staff.rotation.x = dampToward(u.staff.rotation.x, p[1], dt, k);
  } else if (u.weaponArm){
    const p = P.sword[line];
    u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, p[0], dt, k);
    u.weaponArm.rotation.z = dampToward(u.weaponArm.rotation.z, p[1], dt, k);
  }
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
export function windupPose(e, coil){
  const u = e.group.userData, s = e.plan.side, heavy = !!e.t.heavy;
  if (u.staff){
    const w = WIND.staff[s];
    u.staff.rotation.z = 0.5 + (w[0] - 0.5) * coil;
    u.staff.rotation.x = 0.3 + (w[1] - 0.3) * coil;
  } else if (u.weaponArm){
    const w = WIND.sword[s];
    u.weaponArm.rotation.x = -0.35 + (w[0] + 0.35) * coil * (heavy ? 1.1 : 1);
    u.weaponArm.rotation.z = w[1] * coil;
  }
  if (s === 'T') e.group.rotation.x = -coil * 0.25;   // a thrust loads back onto the rear foot, low
}
// strike: from the wind-up through to the far side of the body (a thrust drives straight out)
export function strikePose(e, chop){
  const u = e.group.userData, s = e.plan.side;
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
}

/* ---------------- offence: plan a wind-up ---------------- */
// called the moment a duelling foe commits to a swing (ai.js has set e.wu / e.st / the telegraph)
export function planAttack(e, quick){
  const p = e.dp, m = diffMul();
  const sides = SIDES.filter(l => l !== e.lastSide);
  const plan = { side: sides[(Math.random() * sides.length) | 0], feint: false, hold: 0, chain: 0, thrust: false };
  spend(e, quick ? DUEL.breath.counter : DUEL.breath.swing);   // (it swings on an empty tank too, but the tank shows it)
  if (!quick){
    plan.thrust = Math.random() < p.thrust * m;
    const r = p.ramp ? tacticsRamp() : 1;   // the rank and file pick up their tricks as the run deepens (tactics.js)
    plan.feint = !plan.thrust && Math.random() < p.feint * m * r;
    plan.hold = Math.random() < p.delay * m * r ? rand(DUEL.delayHold[0], DUEL.delayHold[1]) : 0;
    plan.chain = p.chain ? (Math.random() * (p.chain + 1)) | 0 : 0;
    if (e.winded) plan.chain = 0;
  }
  if (plan.thrust){ plan.side = 'T'; plan.chain = 0; thrustTell(e); }
  e.plan = plan;
  e.lastSide = plan.side;
  e.wuBase = e.wu;
  e.wu += plan.hold; e.st = e.wu;
}
// a THRUST can't be stopped by a held guard: the shared parry-or-dodge tell (fx/tells.js)
function thrustTell(e){ tellFx('parry', e.group.position, 2.6); }
// a quick strike out of turn order: the answer to a blocked cut, or a riposte after a dodge (it still needs a free turn: ai.js)
export function quickStrike(e, wind){
  e.state = 'windup'; e.wu = wind; e.st = wind;
  planAttack(e, true);
  S.windup(e.group.position, false);
  e.group.userData.bodyMat.emissive.setHex(0xff2a18);
}
// the feint check, run every wind-up frame: past the break point it snaps to the other side and comes in fast
export function maybeFeint(e, wk){
  const pl = e.plan;
  if (!pl || !pl.feint || wk < DUEL.feintAt) return false;
  pl.feint = false;
  const o = ['L', 'R', 'H'].filter(l => l !== pl.side);
  pl.side = o[(Math.random() * o.length) | 0];
  e.lastSide = pl.side;
  e.wu = e.wuBase = DUEL.feintRewind; e.st = e.wu;
  S.whoosh(e.group.position, false);
  sparks(V3(e.group.position.x, 1.9, e.group.position.z), e.t.eye, 4, 5, { life: 0.2 });
  return true;
}
// after a strike: another cut in the string? (returns true if it chained)
export function chainNext(e){
  const pl = e.plan;
  if (!pl || pl.chain <= 0 || e.dead) return false;
  pl.chain--;
  if (!spend(e, DUEL.breath.chain)){ pl.chain = 0; return false; }   // out of breath: the string ends here
  const o = ['L', 'R', 'H'].filter(l => l !== pl.side);
  pl.side = o[(Math.random() * o.length) | 0];
  e.lastSide = pl.side;
  pl.hold = 0; pl.feint = false;
  e.state = 'windup'; e.wu = e.wuBase = DUEL.chainWindup; e.st = e.wu;
  S.windup(e.group.position, false);
  return true;
}

/* ---------------- defence: does this blow get turned? ---------------- */
// kind: 'cut' | 'finisher' | 'punch' | 'punchHeavy'. Returns 'block', 'dodge', 'break' (guard shattered, blow lands)
// or null (it lands normally).
export function duelDefend(e, line, kind, heavy, at){
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
    addPosture(e, base * (light ? W.cut : 1) * (G.hero !== 'mando' ? stance().postureMul || 1 : heavy ? P.heavyMul : 1), dx / dl, dz / dl);
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
    e.dodgeT = 0.3; e.dodgeX = -dx / dl; e.dodgeZ = -dz / dl;
    e.state = 'recover'; e.st = Math.max(e.st, 0.35);
    floater(V3(g.position.x, g.position.y + 1.2, g.position.z), 'SLIPPED', '#c8d4e0');
    S.dash();
    if (Math.random() < p.counter * m) e.counterQueued = true;
    return 'dodge';
  }
  // PARRY — a mash is read, whatever line it comes in on: the blade is thrown off and it answers at once
  if (dec === 'parry' && spend(e, DUEL.breath.block)){
    e.rhyN = 0; e.counterQueued = true; e.guard = line;
    const cp = at || V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7);
    punishMash(cp);
    floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'PARRIED', '#ff8a5a');
    return 'block';
  }
  if (dec !== 'block' || !spend(e, DUEL.breath.block)){
    // it lands: the guard swings over to cover that line next time
    if (Math.random() < 0.6){ e.guard = line; e.guardT = rand(DUEL.guardShift[0], DUEL.guardShift[1]); }
    e.lineStreak = 0;
    return null;
  }
  // BLOCKED — the guard turns it; posture takes the strain
  e.lineStreak = (e.lastLine === line) ? e.lineStreak + 1 : 1;
  e.lastLine = line; e.guard = line;
  const P = DUEL.posture;
  const cost = (kind === 'finisher' ? P.finisher : kind === 'punchHeavy' ? P.punchHeavy : kind === 'punch' ? P.punch : P.cut) * (G.hero !== 'mando' ? stance().postureMul || 1 : heavy ? P.heavyMul : 1);   // saber forms set their own strain (Ataru 0.8, Niman 1, Djem So 1.5); fists and the darksaber keep the heavy multiplier
  // the flash goes where the blades cross (`at`, from player/jedi/clash.js), else just in front of the foe
  const cp = at || V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7);
  if (addPosture(e, cost, dx / dl, dz / dl)) return 'break';
  e.arcFlash = 0.6;
  clashFlash(cp, G.hero === 'mando' ? 0xffd28a : stance().blade, false);
  sparks(cp, 0xffe9b0, 8, 10, { life: 0.26 });
  S.clash(cp, false);
  G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.2);
  if (e.lineStreak >= DUEL.adaptAfter) floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'READ YOU', '#ffb35a');
  else floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'BLOCKED', '#c8d4e0');
  // and the answer: a fast riposte, if it has the skill and the breath
  if (G.gt - e.counterAt > DUEL.counterCd && Math.random() < p.counter * m * (e.lineStreak >= DUEL.adaptAfter ? 1.5 : 1)
      && (e.breath == null || e.breath >= DUEL.breath.counter)) e.counterQueued = true;
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
  const onLine = line === e.guard;
  let chance = onLine ? p.block : p.block * DUEL.offLine;
  if (onLine && e.lineStreak >= DUEL.adaptAfter) chance = 0.95;   // it has your rhythm: same cut, same answer
  if (kind === 'finisher') chance *= 0.75;
  return Math.random() < chance * m && has(DUEL.breath.block) ? 'block' : null;
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
function punishMash(cp){
  const R = DUEL.rhythm;
  player.stam = Math.max(0, player.stam - R.stam); player.stamDelay = stamDelay();
  player.flinchT = player.flinchMax = Math.max(player.flinchT || 0, R.flinch);
  player.queuedAtk = false;
  clashFlash(cp, 0xff8a5a, true);
  sparks(cp, 0xffc890, 12, 12, { life: 0.3 });
  S.parry(cp);
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
  sparks(cp, 0xffd24a, 16, 13, { life: 0.36 });
  G.hitstop = Math.max(G.hitstop, 0.12); G.shake = Math.max(G.shake, 0.6);
  G.slowmo = Math.min(G.slowmo, 0.4); G.slowmoT = Math.max(G.slowmoT, 0.15);
  return true;
}
// a kick or shoulder-check into a guard: no block roll, just posture (JA: the kick is the answer to a turtle)
export function guardImpact(e, amt){
  if (!e.dp || !GUARDING[e.state]) return false;
  const pp = playerPos(), g = e.group;
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dl = Math.hypot(dx, dz) || 1;
  return addPosture(e, amt, dx / dl, dz / dl);
}
// is this foe holding a guard right now (facing you, not mid-swing)?
export const isGuarding = e => !!e.dp && !!GUARDING[e.state] && !e.converted && !e.dead;

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
   blade gets through. Hold too long and the bind breaks apart.
   ============================================================ */
export const LOCK = { foe: null, bal: 0, t: 0, fx: 0, buzz: 0 };
let lockEl = null, lockFill = null;
function lockBar(show){
  if (!lockEl){ lockEl = document.getElementById('lockbar'); lockFill = lockEl && lockEl.querySelector('.lb-fill'); }
  if (lockEl) lockEl.classList.toggle('on', show);
}
export function startLock(e){
  if (LOCK.foe || !e.dp || !e.dp.lock) return false;
  LOCK.foe = e; LOCK.bal = 0; LOCK.t = 0; LOCK.fx = 0; LOCK.buzz = 0;
  e.state = 'lock'; e.st = 99; e.plan = null;
  player.saberLock = true; player.atkT = 0; player.swing = null; player.queuedAtk = false; player.parryT = 0;
  const pp = playerPos(), g = e.group;
  TMP.subVectors(g.position, pp); TMP.y = 0; const d = TMP.length() || 1; TMP.divideScalar(d);
  g.position.x = pp.x + TMP.x * 1.75; g.position.z = pp.z + TMP.z * 1.75;   // close in, blade to blade
  g.rotation.y = Math.atan2(-TMP.x, -TMP.z);
  const cp = lockPoint();
  clashFlash(cp, stance().blade, true);
  sparks(cp, 0xffe9b0, 18, 14, { life: 0.4 });
  S.clash(cp, true);
  G.hitstop = Math.max(G.hitstop, 0.12); G.shake = Math.max(G.shake, 0.6);
  G.slowmo = Math.min(G.slowmo, 0.35); G.slowmoT = Math.max(G.slowmoT, 0.25);
  if (!G.seenLock){ G.seenLock = true; showBanner('SABER LOCK', 'Mash LMB to drive through · E to kick out · F to Force-shove', 2.6); }
  lockBar(true);
  if (G.stats) G.stats.locks = (G.stats.locks || 0) + 1;
  return true;
}
function lockPoint(){
  const pp = playerPos(), q = LOCK.foe ? LOCK.foe.group.position : pp;
  return V3((pp.x + q.x) / 2, pp.y + 1.55, (pp.z + q.z) / 2);
}
export function updateSaberLock(dt){
  const e = LOCK.foe;
  if (!e) return;
  if (e.dead || e.state !== 'lock' || G.mode !== 'play'){ endLock(); return; }
  if (player.dashT > 0 || player.flinchT > 0.3){ splitLock(); return; }   // dashed (or knocked) out of it
  LOCK.t += dt;
  LOCK.bal -= e.dp.push * diffMul() * dt * (0.8 + LOCK.t * 0.15);   // it bears down harder the longer it lasts
  const g = e.group, pp = playerPos(), u = g.userData;
  // face to face, weapon high and forward, leaning in
  g.rotation.y = Math.atan2(pp.x - g.position.x, pp.z - g.position.z);
  g.rotation.x = dampToward(g.rotation.x, 0.14 + Math.max(0, -LOCK.bal) * 0.12, dt, 10);
  if (u.weaponArm){ u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, -1.75 + Math.sin(G.gt * 31) * 0.04, dt, 14); u.weaponArm.rotation.z = dampToward(u.weaponArm.rotation.z, -0.35, dt, 14); }
  if (u.staff){ u.staff.rotation.z = dampToward(u.staff.rotation.z, -1.3, dt, 14); u.staff.rotation.x = dampToward(u.staff.rotation.x, 0.6, dt, 14); }
  g.userData.bodyMat.emissive.setHex(0xff3a1a); g.userData.bodyMat.emissiveIntensity = 0.3 + Math.max(0, -LOCK.bal) * 0.8;
  // your blade braced against it (the catch pose, held at the bind)
  if (G.hero !== 'mando' || player.weapon === 'darksaber'){
    const dx = g.position.x - pp.x, dz = g.position.z - pp.z, fy = player.faceYaw;
    if (!player.deflectAnim) player.deflectAnim = { t: 0, dur: 0.3, pose: null, side: (dx * -Math.cos(fy) + dz * Math.sin(fy)) / (Math.hypot(dx, dz) || 1) * 0.3, h: 0.25 };
    player.deflectAnim.t = Math.min(player.deflectAnim.t, 0.07);
  }
  // the bind sizzles: sparks spit from the contact, a crackling buzz, the lens trembles
  const cp = lockPoint();
  if ((LOCK.fx -= dt) <= 0){ LOCK.fx = 0.05; sparks(cp, Math.random() < 0.5 ? 0xffe9b0 : stance().blade, 3, 7, { life: 0.22, size: 0.45 }); }
  if ((LOCK.buzz -= dt) <= 0){ LOCK.buzz = 0.11; sfx(rand(90, 120), 0.12, 'sawtooth', 0.03, rand(140, 180)); }
  G.shake = Math.max(G.shake, 0.1 + Math.abs(LOCK.bal) * 0.15);
  if (lockFill) lockFill.style.left = (50 + clamp(LOCK.bal, -1, 1) * 50) + '%';
  if (LOCK.bal >= 1) winLock('OVERPOWERED');
  else if (LOCK.bal <= -1) loseLock();
  else if (LOCK.t > DUEL.lock.time) splitLock();
}
// LMB in a lock: drive the blade. Each press costs a little stamina; a dry press barely moves it.
export function lockPress(){
  if (!LOCK.foe) return;
  const L = DUEL.lock;
  const formMul = G.hero === 'mando' ? 1.1 : G.stance === 'strong' ? L.heavyPress : G.stance === 'fast' ? L.fastPress : 1;
  const dry = player.stam < L.stam;
  player.stam = Math.max(0, player.stam - L.stam); player.stamDelay = stamDelay();
  LOCK.bal += L.press * formMul * (dry ? 0.35 : 1);
  sparks(lockPoint(), 0xffffff, 3, 9, { life: 0.18, size: 0.4 });
  sfx(rand(150, 190), 0.06, 'square', 0.03, 90);
}
// E in a lock: a boot to the gut ends it — if you have the stamina
export function lockKick(){
  if (!LOCK.foe) return;
  if (player.stam < DUEL.lock.kickStam){ floater(playerPos(), 'WINDED', '#ffaa66'); return; }
  player.stam -= DUEL.lock.kickStam; player.stamDelay = stamDelay();
  if (G.hero !== 'mando'){ player.kickT = player.kickMax = 0.4; }
  else { player.meleeT = player.meleeMax = 0.4; player.meleeKind = 'knee'; }
  winLock('KICKED LOOSE', 22);
}
// F in a lock: a Force shove at point-blank range
export function lockPush(){
  if (!LOCK.foe || G.hero === 'mando') return false;
  if (player.force < DUEL.lock.pushCost) return false;
  player.force -= DUEL.lock.pushCost;
  player.castT = player.castMax = 0.3; player.castKind = 'push';
  S.push();
  winLock('FORCE SHOVE', 30);
  return true;
}
function winLock(label, knock){
  const e = LOCK.foe, pp = playerPos(), g = e.group;
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dl = Math.hypot(dx, dz) || 1;
  endLock();
  e.state = 'recover';
  staggerEnemy(e, dx / dl, dz / dl, label);
  e.st += 0.4; e.posture = 0;
  drainBreath(e, DUEL.breath.lock);   // a bind lost takes the wind out of it
  tutEvent('guardBreak', e);   // winning the bind breaks its guard too
  if (knock) damageEnemy(e, 8, V3(dx / dl, 0, dz / dl), knock);
  player.riposteT = CFG.player.riposteTime + 0.3; player.ripLine = null;
  const cp = lockPoint();
  clashFlash(cp, 0xffd24a, true);
  sparks(cp, 0xffe27a, 18, 15, { dir: V3(dx / dl, 0.2, dz / dl), cone: 0.8, life: 0.36 });
  screenFlash('radial-gradient(ellipse at center, rgba(255,240,180,.5), transparent 65%)', 0.8, 0.3);
  G.hitstop = Math.max(G.hitstop, 0.16); G.slowmo = Math.min(G.slowmo, 0.3); G.slowmoT = Math.max(G.slowmoT, 0.3);
  S.parry(cp);
  if (G.stats) G.stats.locksWon = (G.stats.locksWon || 0) + 1;
}
function loseLock(){
  const e = LOCK.foe, g = e.group;
  endLock();
  e.state = 'recover'; e.st = 0.25; e.counterQueued = true;
  player.parryT = 0;
  hurtPlayer(DUEL.lock.loseDmg * enemyDmgScale(), g.position, false, true, false, { unblockable: true, noClash: true });
  player.flinchT = player.flinchMax = CFG.player.flinch.heavy; player.flinchHeavy = true;
  floater(playerPos(), 'OVERPOWERED', '#ff6a3a');
}
function splitLock(){
  const e = LOCK.foe, pp = playerPos(), g = e.group;
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dl = Math.hypot(dx, dz) || 1;
  endLock();
  e.state = 'recover'; e.st = 0.5;
  flinchEnemy(e, V3(dx / dl, 0, dz / dl), 1.2);
  player.vel.x -= dx / dl * 6; player.vel.z -= dz / dl * 6;
  S.clash(lockPoint(), false);
}
export function endLock(){
  const e = LOCK.foe;
  LOCK.foe = null;
  player.saberLock = false;
  player.deflectAnim = null;
  lockBar(false);
  if (e && e.state === 'lock' && !e.dead){ e.state = 'recover'; e.st = 0.4; }
}
