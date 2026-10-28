// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The troopers' upper body: the chest bone at the waist and the head bone at the neck (enemies/mesh.js upper/helmet).
// Laid over whatever the AI does with the whole body (its heading, its coil and lean, the hit-reaction spring):
//   · AIM — the chest turns and tips toward the target, the head takes the rest, so a trooper on the move still
//     points its rifle and its eyes at you; with nothing to watch the head glances about now and then
//   · BREATH — a slow rise and fall, a little quicker for the brutes
//   · RECOIL — a shot (o.kick, set where it fires) snaps the shoulders back
//   · FLINCH — a hit (o.flinch / o.flinchDir, enemies/damage.js) knocks the chest the way the blow pushed
//   · WIND-UP — a melee foe draws its weapon shoulder back as it coils and whips it through on the strike
// mode 'off' (dead, floored, held in the Force) eases it all back to the rest pose; 'hold' freezes it (stasis).
// It also tells the unit's armour wear (kit.js wearArmor) where the feet are, so the grime starts at the boots.

import { clamp } from '../utils.js';

const ease = (cur, want, dt, rate) => cur + (want - cur) * (1 - Math.exp(-rate * dt));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function updateUpper(o, g, dt, aim, mode = 'on'){
  const u = g.userData, W = u.bodyMat && u.bodyMat.userData.wear;
  if (W){ W.uBase.value = g.position.y; W.uScale.value = g.scale.x * (u.vis ? u.vis.scale.y : 1); }
  const ch = u.chest, hd = u.head;
  if (!ch || !(dt > 0) || mode === 'hold') return;
  const U = o.upper || (o.upper = { yaw: 0, pitch: 0, hy: 0, hp: 0, twist: 0, kick: 0, fl: 0, fr: 0,
                                    t: Math.random() * 10, look: 0, lookT: 0, hx0: hd ? hd.rotation.x : 0 });
  U.t += dt;
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
      // idle: now and then a glance to one side, held a moment
      if ((U.lookT -= dt) <= 0){ U.look = Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 1.1; U.lookT = 1.5 + Math.random() * 2.5; }
      hy = U.look;
    }
    // the melee wind-up: the weapon shoulder (+x) draws back with the coil, then whips through the strike
    if (o.t && !o.t.ranged && o.state === 'windup') twist = 0.32 * Math.sqrt(clamp(1 - Math.max(o.st, 0) / (o.wu || 1), 0, 1));
    else if (o.t && !o.t.ranged && o.state === 'strike') twist = -0.26;
  }
  const r = mode === 'off' ? 6 : 9;
  U.yaw = ease(U.yaw, yaw, dt, r); U.pitch = ease(U.pitch, pitch, dt, r);
  U.hy = ease(U.hy, hy, dt, r + 3); U.hp = ease(U.hp, hp, dt, r + 3);
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
  const heavy = o.t && o.t.heavy, breath = mode === 'off' ? 0 : Math.sin(U.t * (heavy ? 2.2 : 1.7)) * 0.018;
  const kick = U.kick * U.kick;
  ch.rotation.set(U.pitch + breath - kick * 0.16 + U.fl * 0.3, U.yaw + U.twist, -U.fr * 0.25);
  if (hd) hd.rotation.set(U.hx0 + U.hp - breath * 0.6 + kick * 0.05 + U.fl * 0.2 - snap * 0.55, U.hy - U.twist * 0.6 - snap * (U.snapSide || 0) * 0.4, -U.fr * 0.15 + snap * (U.snapSide || 0) * 0.35);
}
