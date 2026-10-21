// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Duelling foes: guards and posture, feints, delayed strikes, strings, counters, bolt deflection, and the saber lock.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { DUEL, DUEL_PROFILES, GUARD_POSE, WIND } from '../data/duel.js';
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

const LINES = ['L', 'R', 'H'];
const GUARDING = { chase: 1, recover: 1 };
const DIFF_MUL = { padawan: 0.7, knight: 1, master: 1.15 };
const diffMul = () => DIFF_MUL[G.diff] || 1;

/* which line a cut comes in on, from where the blade starts (screen left / right / overhead). The strafe cuts start on
   the far side (D sweeps left → right, so it arrives on the LEFT), the overhead and finisher come down HIGH. */
export function cutLine(sw){
  if (!sw || !sw.pat) return 'H';
  if (sw.step === 2 || sw.riposte) return 'H';
  return sw.pat.yF < -0.5 ? 'L' : sw.pat.yF > 0.5 ? 'R' : 'H';
}

/* ---------------- setup ---------------- */
export function initDuel(e){
  const p = DUEL_PROFILES[e.type];
  if (!p) return;
  e.dp = p;
  e.posture = 0; e.postureAt = -9;
  e.guard = LINES[(Math.random() * 3) | 0];
  e.guardT = rand(DUEL.guardShift[0], DUEL.guardShift[1]);
  e.lineStreak = 0; e.lastLine = null;
  e.counterAt = -9;
  e.lastSide = null;
}
const showsGuard = e => e.dp && e.dp.block >= 0.4;

/* ---------------- per-frame (called from ai.js for every living duelling foe) ---------------- */
export function updateDuel(e, dt, dist){
  const g = e.group, p = e.dp;
  // posture drains back once the foe has been left alone for a moment
  if (e.posture > 0 && G.gt - e.postureAt > DUEL.posture.regenDelay) e.posture = Math.max(0, e.posture - DUEL.posture.regen * dt);
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
  const guarding = GUARDING[e.state] && dist < DUEL.guardRange && !e.converted;
  // hold the weapon on the guarded line (the readable tell), back to the carry otherwise
  if (guarding && !(e.dodgeT > 0)) guardPose(e, dt);
  // the guard arc: a pale crescent on the covered side, brighter as you close in
  if (showsGuard(e)){
    if (!g.userData.guardArc) makeGuardArc(e);
    const a = g.userData.guardArc;
    a.visible = guarding && !e.dead;
    if (a.visible){
      const want = e.guard === 'R' ? 0 : e.guard === 'L' ? Math.PI : Math.PI / 2;
      a.rotation.z = dampToward(a.rotation.z, want, dt, 14);
      e.arcFlash = Math.max(0, (e.arcFlash || 0) - dt * 4);
      a.material.opacity = clamp(1 - dist / DUEL.guardRange, 0.15, 0.6) + e.arcFlash;
      a.material.color.setHex(e.lineStreak >= DUEL.adaptAfter ? 0xffb35a : 0xfff0c8);   // amber: it has read your cut
    }
  }
  // posture bar over the head while the guard is under pressure
  if (e.posture > 0.5 && !e.dead){
    if (!e.postBar) makePostureBar(e);
    const b = e.postBar, k = clamp(e.posture / p.posture, 0, 1);
    b.visible = true;
    b.position.set(g.position.x, g.position.y + 2.55 * (e.t.scale || 1), g.position.z);
    b.quaternion.copy(camera.quaternion);
    b.userData.fill.scale.x = Math.max(0.001, k);
    b.userData.fill.position.x = -(1 - k) * 0.55;
    b.userData.fill.material.color.setHex(k > 0.75 ? 0xff6a3a : 0xffd24a);
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
  grp.add(bg, fill); grp.renderOrder = 998; grp.userData.fill = fill;
  scene.add(grp); e.postBar = grp;
}

/* ---------------- weapon poses ---------------- */
function guardPose(e, dt){
  const u = e.group.userData;
  if (u.staff){
    const p = GUARD_POSE.staff[e.guard];
    u.staff.rotation.z = dampToward(u.staff.rotation.z, p[0], dt, 9);
    u.staff.rotation.x = dampToward(u.staff.rotation.x, p[1], dt, 9);
  } else if (u.weaponArm){
    const p = GUARD_POSE.sword[e.guard];
    u.weaponArm.rotation.x = dampToward(u.weaponArm.rotation.x, p[0], dt, 9);
    u.weaponArm.rotation.z = dampToward(u.weaponArm.rotation.z, p[1], dt, 9);
  }
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
  const sides = LINES.filter(l => l !== e.lastSide);
  const plan = { side: sides[(Math.random() * sides.length) | 0], feint: false, hold: 0, chain: 0, thrust: false };
  if (!quick){
    plan.thrust = Math.random() < p.thrust * m;
    const r = p.ramp ? tacticsRamp() : 1;   // the rank and file pick up their tricks as the run deepens (tactics.js)
    plan.feint = !plan.thrust && Math.random() < p.feint * m * r;
    plan.hold = Math.random() < p.delay * m * r ? rand(DUEL.delayHold[0], DUEL.delayHold[1]) : 0;
    plan.chain = p.chain ? (Math.random() * (p.chain + 1)) | 0 : 0;
  }
  if (plan.thrust){ plan.side = 'T'; plan.chain = 0; thrustTell(e); }
  e.plan = plan;
  e.lastSide = plan.side;
  e.wuBase = e.wu;
  e.wu += plan.hold; e.st = e.wu;
}
// a THRUST can't be stopped by a held guard: a white-hot tell, a sharp rising whine
function thrustTell(e){
  const g = e.group;
  spawnGroundShock(g.position, 0xffffff, 2.6, 0.45, 0.8);
  burst(V3(g.position.x, 1.8, g.position.z), 0xffffff, 8, 5, 3, 0.8);
  sfx(1400, 0.22, 'sawtooth', 0.04, 2600);
}
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
export function duelDefend(e, line, kind, heavy){
  const p = e.dp;
  if (!p || e.dead || e.converted || !GUARDING[e.state] || e.stunT > 0 || e.dodgeT > 0) return null;
  const g = e.group, pp = playerPos();
  const efx = Math.sin(g.rotation.y), efz = Math.cos(g.rotation.y);
  const dx = pp.x - g.position.x, dz = pp.z - g.position.z, dl = Math.hypot(dx, dz) || 1;
  if ((efx * dx + efz * dz) / dl < 0.35) return null;   // a blow from the flank or behind always lands
  const m = diffMul();
  // a light cut seen coming: the agile ones slip it with a backstep
  if (p.dodge && (kind === 'cut' || kind === 'punch') && Math.random() < p.dodge * m){
    e.dodgeT = 0.3; e.dodgeX = -dx / dl; e.dodgeZ = -dz / dl;
    e.state = 'recover'; e.st = Math.max(e.st, 0.35);
    floater(V3(g.position.x, g.position.y + 1.2, g.position.z), 'SLIPPED', '#c8d4e0');
    S.dash();
    if (Math.random() < p.counter * m) e.counterQueued = true;
    return 'dodge';
  }
  const onLine = line === e.guard;
  let chance = onLine ? p.block : p.block * DUEL.offLine;
  if (onLine && e.lineStreak >= DUEL.adaptAfter) chance = 0.95;   // it has your rhythm: same cut, same answer
  if (kind === 'finisher') chance *= 0.75;
  chance *= m;
  if (Math.random() >= chance){
    // it lands: the guard swings over to cover that line next time
    if (Math.random() < 0.6){ e.guard = line; e.guardT = rand(DUEL.guardShift[0], DUEL.guardShift[1]); }
    e.lineStreak = 0;
    return null;
  }
  // BLOCKED — the guard turns it; posture takes the strain
  e.lineStreak = (e.lastLine === line) ? e.lineStreak + 1 : 1;
  e.lastLine = line; e.guard = line;
  const P = DUEL.posture;
  const cost = (kind === 'finisher' ? P.finisher : kind === 'punchHeavy' ? P.punchHeavy : kind === 'punch' ? P.punch : P.cut) * (heavy ? P.heavyMul : 1);
  const cp = V3(g.position.x + dx / dl * 0.7, g.position.y + 1.5, g.position.z + dz / dl * 0.7);
  if (addPosture(e, cost, dx / dl, dz / dl)) return 'break';
  e.arcFlash = 0.6;
  clashFlash(cp, G.hero === 'mando' ? 0xffd28a : stance().blade, false);
  sparks(cp, 0xffe9b0, 8, 10, { life: 0.26 });
  S.clash(cp, false);
  G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.2);
  if (e.lineStreak >= DUEL.adaptAfter) floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'READ YOU', '#ffb35a');
  else floater(V3(g.position.x, g.position.y + 1.3, g.position.z), 'BLOCKED', '#c8d4e0');
  // and the answer: a fast riposte, if it has the skill and the breath
  if (G.gt - e.counterAt > DUEL.counterCd && Math.random() < p.counter * m * (e.lineStreak >= DUEL.adaptAfter ? 1.5 : 1)) e.counterQueued = true;
  return 'block';
}

// add guard strain; past the profile's posture the guard BREAKS (staggered, wide open). Returns true on a break.
export function addPosture(e, amt, awayX, awayZ){
  if (!e.dp || e.dead) return false;
  e.posture += amt; e.postureAt = G.gt;
  if (e.posture < e.dp.posture) return false;
  e.posture = 0; e.lineStreak = 0; e.counterQueued = false;
  staggerEnemy(e, awayX, awayZ, 'GUARD BROKEN');
  tutEvent('guardBreak', e);
  e.st += 0.3;   // a broken guard stays open a touch longer than a parried swing
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
  player.stam = Math.max(0, player.stam - L.stam); player.stamDelay = CFG.player.stamDelay;
  LOCK.bal += L.press * formMul * (dry ? 0.35 : 1);
  sparks(lockPoint(), 0xffffff, 3, 9, { life: 0.18, size: 0.4 });
  sfx(rand(150, 190), 0.06, 'square', 0.03, 90);
}
// E in a lock: a boot to the gut ends it — if you have the stamina
export function lockKick(){
  if (!LOCK.foe) return;
  if (player.stam < DUEL.lock.kickStam){ floater(playerPos(), 'WINDED', '#ffaa66'); return; }
  player.stam -= DUEL.lock.kickStam; player.stamDelay = CFG.player.stamDelay;
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
  tutEvent('guardBreak', e);   // winning the bind breaks its guard too
  if (knock) damageEnemy(e, 8, V3(dx / dl, 0, dz / dl), knock);
  player.riposteT = CFG.player.riposteTime + 0.3;
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
