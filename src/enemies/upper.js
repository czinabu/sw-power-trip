// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The troopers' upper body: the chest bone at the waist and the head bone at the neck (enemies/mesh.js upper/helmet).
// Laid over whatever the AI does with the whole body (its heading, its coil and lean, the hit-reaction spring):
//   · AIM — the chest turns and tips toward the target, the head takes the rest, so a trooper on the move still
//     points its rifle and its eyes at you; with nothing to watch the head glances about now and then
//   · BREATH — a slow rise and fall, a little quicker for the brutes
//   · RECOIL — a shot (o.kick, set where it fires) snaps the shoulders back
//   · FLINCH — a hit (o.flinch / o.flinchDir, enemies/damage.js) knocks the chest the way the blow pushed
//   · WIND-UP — a melee foe draws its weapon shoulder back as it coils and whips it through on the strike
//   · CAPE — a cape (enemies/mesh.js cape) streams back off the shoulders as the unit runs, swings out on a turn or a
//     sidestep and settles in folds when it stops, each band lagging the one above it
//   · STANCE — each type stands its own way (STANCE below): a brute's slow heavy breath and weight shift, a droid's
//     twitchy servo glances and no breath at all, an officer's raised chin, a scout's hunch, a purge trooper's prowl
//   · FACE — a unit with a face (enemies/detail.js) blinks, and works its jaw when it talks (an officer's order, a
//     line in a cutscene: userData.talk) or grimaces when it's hit; slack-jawed and half-lidded when it falls
//   · GEAR — the pouches, holster and canteen on the belt (detail.js belt) bounce with each footfall and lag a turn
// mode 'off' (dead, floored, held in the Force) eases it all back to the rest pose; 'hold' freezes it (stasis).
// It also tells the unit's armour wear (kit.js wearArmor) where the feet are, so the grime starts at the boots.

import { clamp } from '../utils.js';
import { LID_OPEN } from './detail.js';
import { solveHolds } from './holds.js';

const ease = (cur, want, dt, rate) => cur + (want - cur) * (1 - Math.exp(-rate * dt));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* how each type carries itself at rest. br/ba: breath rate and depth · sw/sa: a slow weight shift side to side (chest
   roll) · cp/hp: the chest's and head's resting pitch (+ forward/down, − chin up) · gl: seconds between idle glances
   [min, max] · gr: how fast a glance turns the head (a droid's snaps) · tilt: how far a glance cocks the head */
const STANCE = {
  default:  { br: 1.7, ba: 0.018, sw: 0.5, sa: 0.012, cp: 0, hp: 0, gl: [1.5, 4], gr: 12, tilt: 0 },
  heavy:    { br: 1.3, ba: 0.03, sw: 0.35, sa: 0.035, cp: 0.05, hp: 0.04, gl: [2.5, 5], gr: 7, tilt: 0 },
  b1:       { br: 0, ba: 0, sw: 0, sa: 0, cp: 0.06, hp: -0.05, gl: [0.5, 1.4], gr: 40, tilt: 0.3 },
  magna:    { br: 0, ba: 0, sw: 0.25, sa: 0.01, cp: -0.03, hp: 0, gl: [2, 3.5], gr: 30, tilt: 0.12 },
  officer:  { br: 1.4, ba: 0.014, sw: 0.3, sa: 0.008, cp: -0.05, hp: -0.1, gl: [2.5, 5], gr: 8, tilt: 0 },
  scout:    { br: 2.0, ba: 0.016, sw: 0.4, sa: 0.01, cp: 0.12, hp: -0.08, gl: [1, 2.5], gr: 16, tilt: 0 },
  purge:    { br: 1.9, ba: 0.02, sw: 0.6, sa: 0.02, cp: 0.08, hp: 0.06, gl: [1.2, 3], gr: 14, tilt: 0.05 },
  lancer:   { br: 1.9, ba: 0.02, sw: 0.6, sa: 0.02, cp: 0.08, hp: 0.06, gl: [1.2, 3], gr: 14, tilt: 0.05 },
  acolyte:  { br: 1.5, ba: 0.016, sw: 0.4, sa: 0.015, cp: 0.04, hp: 0.08, gl: [2, 4], gr: 9, tilt: 0 },
};

export function updateUpper(o, g, dt, aim, mode = 'on'){
  const u = g.userData, W = u.bodyMat && u.bodyMat.userData.wear;
  if (W){ W.uBase.value = g.position.y; W.uScale.value = g.scale.x * (u.vis ? u.vis.scale.y : 1); W.uNow.value = performance.now() / 1000; }   // (now: how long ago each saber cut was made, enemies/scars.js)
  const ch = u.chest, hd = u.head;
  if (!ch || !(dt > 0) || mode === 'hold') return;
  const U = o.upper || (o.upper = { yaw: 0, pitch: 0, hy: 0, hp: 0, twist: 0, kick: 0, fl: 0, fr: 0,
                                    t: Math.random() * 10, look: 0, lookT: 0, hx0: hd ? hd.rotation.x : 0 });
  U.t += dt;
  const ST = STANCE[u.model] || STANCE.default;
  let yaw = 0, pitch = 0, hy = 0, hp = 0, twist = 0;
  if (mode !== 'off'){
    if (aim){
      // the target in the body's own frame: its bearing off the heading, and its elevation from the chest
      const s = g.scale.x, dx = aim.x - g.position.x, dz = aim.z - g.position.z;
      const a = wrap(Math.atan2(dx, dz) - g.rotation.y);
      const el = Math.atan2((aim.y + 1.4) - (g.position.y + 1.5 * s), Math.max(0.6, Math.hypot(dx, dz)));
      yaw = clamp(a * 0.6, -0.5, 0.5); hy = clamp(a - yaw, -0.7, 0.7);
      pitch = clamp(-el * 0.5, -0.3, 0.3); hp = clamp(-el * 0.5, -0.4, 0.4);
      U.lookT = 0;
    } else {
      // idle: now and then a glance to one side, held a moment (a droid snaps its head and cocks it)
      if ((U.lookT -= dt) <= 0){
        U.look = Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 1.1; U.lookT = ST.gl[0] + Math.random() * (ST.gl[1] - ST.gl[0]);
        U.tilt = ST.tilt ? (Math.random() - 0.5) * 2 * ST.tilt : 0;
      }
      hy = U.look;
    }
    // the melee wind-up: the weapon shoulder (+x) draws back with the coil, then whips through the strike
    // (a duellist's cut turns the chest its own way through the swing: enemies/duel.js cutTwist)
    if (o.cutTwist != null && (o.state === 'windup' || o.state === 'strike')) twist = o.cutTwist;
    else if (o.t && !o.t.ranged && o.state === 'windup') twist = 0.32 * Math.sqrt(clamp(1 - Math.max(o.st, 0) / (o.wu || 1), 0, 1));
    else if (o.t && !o.t.ranged && o.state === 'strike') twist = -0.26;
  }
  const r = mode === 'off' ? 6 : 9;
  U.yaw = ease(U.yaw, yaw, dt, r); U.pitch = ease(U.pitch, pitch, dt, r);
  U.hy = ease(U.hy, hy, dt, aim ? r + 3 : ST.gr); U.hp = ease(U.hp, hp, dt, r + 3);
  U.ht = ease(U.ht || 0, mode === 'off' || aim ? 0 : U.tilt || 0, dt, ST.gr);
  U.twist = ease(U.twist, twist, dt, o.state === 'strike' ? 30 : 12);
  // recoil: a shot snaps the shoulders back, settling over a fifth of a second
  if (o.kick){ U.kick = Math.max(U.kick, o.kick); o.kick = 0; }
  U.kick = Math.max(0, U.kick - dt * 5);
  // flinch: the chest goes with the blow (back from the front, forward from behind, sideways from the flank)
  let fl = 0, fr = 0;
  if (o.flinch > 0 && o.flinchDir && mode !== 'off'){
    const k = clamp(o.flinch / 0.15, 0, 1), y = g.rotation.y, d = o.flinchDir;
    fl = (d.x * Math.sin(y) + d.z * Math.cos(y)) * k; fr = (d.x * Math.cos(y) - d.z * Math.sin(y)) * k;
  }
  U.fl = ease(U.fl, fl, dt, 30); U.fr = ease(U.fr, fr, dt, 30);
  // a cut at the head (enemies/damage.js zoneReact) whips it back and off to the side the blade went, then it recovers
  if (o.headSnap > 0){ U.snap = Math.max(U.snap || 0, o.headSnap); U.snapSide = o.headSide || 0; o.headSnap = 0; }
  U.snap = Math.max(0, (U.snap || 0) - dt * 3.5);
  const snap = mode === 'off' ? 0 : U.snap * U.snap;
  const on = mode === 'off' ? 0 : 1, breath = on * Math.sin(U.t * ST.br) * ST.ba;
  // the stance: its resting carriage, eased in (so a fall or a stasis lets go of it smoothly) and a slow weight shift
  U.st = ease(U.st ?? 0, on, dt, 3);
  const shift = Math.sin(U.t * ST.sw) * ST.sa * U.st, talk = on * talking(U, u, o, dt);
  const kick = U.kick * U.kick;
  ch.rotation.set(U.pitch + breath - kick * 0.16 + U.fl * 0.3 + ST.cp * U.st, U.yaw + U.twist, -U.fr * 0.25 + shift);
  if (hd) hd.rotation.set(U.hx0 + U.hp - breath * 0.6 + kick * 0.05 + U.fl * 0.2 - snap * 0.55 + ST.hp * U.st + talk * Math.sin(U.t * 7.3) * 0.04,
    U.hy - U.twist * 0.6 - snap * (U.snapSide || 0) * 0.4, -U.fr * 0.15 + snap * (U.snapSide || 0) * 0.35 + U.ht - shift * 0.6);
  if (u.lids || u.jaw) faceLife(U, o, u, dt, mode, talk);
  if (u.gearL || u.gearR || u.gearB) gearSwing(U, o, g, u, dt, mode);
  if (u.cape0) capeSwing(U, g, u, dt, mode);
  if (u.offArm || u.offArmR) armsSwing(U, o, g, u, dt, mode, breath);
  if (u.holds && mode !== 'off') solveHolds(u);   // hands that stay on a staff or a pike haft as it moves (enemies/holds.js)
  // FALLING (dead, floored): the chest curls and the head lolls with the body's tip, so a fall isn't a rigid plank
  if (mode === 'off'){
    const f = fallOf(g);
    if (f){
      ch.rotation.x += f * 0.24;   // curled in over the belly, whichever way it falls
      if (hd){ hd.rotation.x += -Math.sign(g.rotation.x || 1) * f * 0.35; hd.rotation.z += (U.lollSide || (U.lollSide = Math.random() < 0.5 ? -1 : 1)) * f * 0.3; }
    }
  }
}

// how far the body has tipped over (0 upright → 1 lying flat), from the group's pitch and roll
export const fallOf = g => Math.min(1, Math.max(Math.abs(Math.atan2(Math.sin(g.rotation.x), Math.cos(g.rotation.x))), Math.abs(g.rotation.z) * 1.4) / 1.35);

/* the FREE ARMS (enemies/mesh.js ARM_SWING): on the move each swings opposite its own side's leg, wider as the unit
   runs, and the elbow-led swing settles to a hang when it stops; standing, they ride the breath. Felled, they fling
   out from the body as it goes over and fall loose */
function armsSwing(U, o, g, u, dt, mode, breath){
  const A = U.arms || (U.arms = { base: [u.offArm, u.offArmR].map(a => a ? a.rotation.clone() : null), sw: 0, fl: 0, out: Math.random() * 0.4 });
  const amp = u.armSwing || [0, 0];
  const L = o.legs, sp = L ? Math.hypot(L.vx, L.vz) / (g.scale.x || 1) : 0;
  const run = mode === 'on' ? Math.min(1, sp / 5) : 0;
  A.sw = ease(A.sw, run, dt, 8);
  const ph = L ? L.cyc * Math.PI * 2 : 0;
  A.fl = ease(A.fl, mode === 'off' && !u.staff && !u.shield ? fallOf(g) : 0, dt, 10);   // (hands on a staff or behind a shield keep their hold)
  [u.offArm, u.offArmR].forEach((a, i) => {
    const b = A.base[i];
    if (!a || !b) return;
    const s = i ? 1 : -1;   // the left arm swings with the right leg (cycle phase 0.5), the right with the left
    const swing = amp[i] * A.sw * 0.55 * Math.sin(ph + (i ? 0 : Math.PI));
    const k = A.fl;   // felled: the arm lets go of its pose and flops out to the side, palm to the floor
    a.rotation.x = (b.x + swing + (amp[i] ? breath * 0.6 : 0)) * (1 - k) - k * (0.25 + A.out * 0.5);
    a.rotation.z = (b.z + s * amp[i] * A.sw * 0.06) * (1 - k) + s * k * (0.95 + A.out);
    a.rotation.y = b.y;
  });
}

/* the cape's bands are springs: each is pushed toward an angle set by how the body moves (forward speed lifts it
   back, sideways speed and turning swing it out the other way) and lags behind it, the lower bands more loosely,
   so it streams, swings and settles rather than tracking the body stiffly. A band never folds in through the body */
const LIFT = [0.5, 0.32, 0.3], SWAY = [0.5, 0.35, 0.3], STIFF = [55, 38, 28];
function capeSwing(U, g, u, dt, mode){
  const bones = [u.cape0, u.cape1, u.cape2];
  const C = U.cape || (U.cape = { px: g.position.x, pz: g.position.z, ry: g.rotation.y, rest: bones.map(b => b ? b.rotation.x : 0),
                                  a: [0, 0, 0], va: [0, 0, 0], z: [0, 0, 0], vz: [0, 0, 0] });
  const h = Math.min(dt, 1 / 30), s = g.scale.x || 1;
  let vx = (g.position.x - C.px) / dt / s, vz = (g.position.z - C.pz) / dt / s;
  const sp = Math.hypot(vx, vz);
  if (sp > 14){ vx = vz = 0; }   // a teleport or a respawn: no gust
  const turn = wrap(g.rotation.y - C.ry) / dt;
  C.px = g.position.x; C.pz = g.position.z; C.ry = g.rotation.y;
  const y = g.rotation.y, fwd = vx * Math.sin(y) + vz * Math.cos(y), side = vx * Math.cos(y) - vz * Math.sin(y);
  const run = mode === 'off' ? 0 : clamp(fwd * 0.085, -0.04, 0.75) + Math.min(0.15, Math.abs(side) * 0.03);
  const out = mode === 'off' ? 0 : clamp(-side * 0.05 - turn * 0.12, -0.45, 0.45);
  const flutter = Math.min(1, sp / 6) * 0.05;
  for (let i = 0; i < 3; i++){
    const b = bones[i];
    if (!b) continue;
    const k = STIFF[i], c = 2 * Math.sqrt(k) * 0.55;   // a little under-damped: it overshoots and swings back once
    const want = run * LIFT[i] + flutter * Math.sin(U.t * 8 + i * 1.3);
    C.va[i] += (k * (want - C.a[i]) - c * C.va[i]) * h; C.a[i] += C.va[i] * h;
    C.vz[i] += (k * (out * SWAY[i] - C.z[i]) - c * C.vz[i]) * h; C.z[i] += C.vz[i] * h;
    C.a[i] = Math.max(C.a[i], i ? -0.12 : -0.04);   // never in through the back or the legs
    b.rotation.x = C.rest[i] + C.a[i];
    b.rotation.z = C.z[i];
  }
}

/* TALKING: an officer barking an order (its 'order' state), or any unit given a line (userData.talk, set by a
   cutscene while its line is up). Returns 0..1, eased, for the jaw and a nod of the head */
function talking(U, u, o, dt){
  const want = u.talk || o.state === 'order' ? 1 : 0;
  U.tk = ease(U.tk || 0, want, dt, 8);
  return U.tk;
}

/* the FACE (enemies/detail.js face): lids that blink every few seconds (now and then twice), a jaw that works through
   syllables while it talks, gapes for a moment when it's hit and hangs slack when it falls */
function faceLife(U, o, u, dt, mode, talk){
  const F = U.face || (U.face = { t: 1 + Math.random() * 3, k: 0, twice: false, jaw: 0, syl: 0, sylT: 0 });
  F.t -= dt;
  if (F.t <= 0 && mode !== 'off'){ F.k = 0.13; F.t = F.twice ? 0.2 : 2 + Math.random() * 3.5; F.twice = !F.twice && Math.random() < 0.2; }
  F.k = Math.max(0, F.k - dt);
  const hurt = o.flinch > 0 ? clamp(o.flinch / 0.15, 0, 1) : 0;
  const shut = mode === 'off' ? 0.55 : Math.max(F.k > 0 ? Math.sin(F.k / 0.13 * Math.PI) : 0, hurt * 0.8);
  if (u.lids) u.lids.scale.y = LID_OPEN + (1 - LID_OPEN) * shut;
  if (!u.jaw) return;
  // syllables: a new mouth shape every ~0.1 s while talking, never the same twice
  if ((F.sylT -= dt) <= 0){ F.syl = talk > 0.1 ? 0.25 + Math.random() * 0.75 : 0; F.sylT = 0.07 + Math.random() * 0.08; }
  const want = mode === 'off' ? 0.3 : Math.max(talk * F.syl * 0.32, hurt * 0.38);
  F.jaw = ease(F.jaw, want, dt, 22);
  u.jaw.rotation.x = F.jaw;
}

/* the belt's GEAR (enemies/detail.js belt): each piece is a damped pendulum hanging from the belt. Every footfall
   kicks it (twice per stride), the body's acceleration swings it the other way and a turn throws it out, so it
   bounces and lags instead of riding the hips rigidly. Felled, it hangs toward the floor as the body tips */
function gearSwing(U, o, g, u, dt, mode){
  const P = U.gear || (U.gear = { a: [0, 0, 0], va: [0, 0, 0], z: [0, 0, 0], vz: [0, 0, 0], ry: g.rotation.y, ph: 0 });
  const L = o.legs, s = g.scale.x || 1, h = Math.min(dt, 1 / 30);
  const y = g.rotation.y, turn = wrap(y - P.ry) / dt; P.ry = y;
  let fwd = 0, side = 0, af = 0, as = 0, bounce = 0;
  if (L){
    fwd = (L.vx * Math.sin(y) + L.vz * Math.cos(y)) / s; side = (L.vx * Math.cos(y) - L.vz * Math.sin(y)) / s;
    af = (L.ax * Math.sin(y) + L.az * Math.cos(y)) / s; as = (L.ax * Math.cos(y) - L.az * Math.sin(y)) / s;
    const sp = Math.hypot(fwd, side);
    bounce = Math.min(1, sp / 6) * Math.sin(L.cyc * Math.PI * 4);   // two footfalls a stride
  }
  const f = mode === 'off' ? fallOf(g) : 0;
  [u.gearL, u.gearR, u.gearB].forEach((b, i) => {
    if (!b) return;
    const k = 70 + i * 10, c = 2 * Math.sqrt(k) * 0.35;   // springy: it swings past and back once or twice
    const wantA = clamp(-af * 0.02 + fwd * 0.02, -0.6, 0.6) + bounce * 0.14 - f * Math.sign(g.rotation.x || 1) * 0.9;
    const wantZ = clamp(as * 0.02 - side * 0.015 + turn * 0.05, -0.5, 0.5) + (i === 1 ? -1 : 1) * Math.abs(bounce) * 0.05;
    P.va[i] += (k * (wantA - P.a[i]) - c * P.va[i]) * h; P.a[i] += P.va[i] * h;
    P.vz[i] += (k * (wantZ - P.z[i]) - c * P.vz[i]) * h; P.z[i] += P.vz[i] * h;
    b.rotation.x = clamp(P.a[i], -0.9, 1.0) * (i === 2 ? -1 : 1);   // the canteen hangs behind: it swings the other way
    b.rotation.z = clamp(P.z[i], -0.6, 0.6);
  });
}
