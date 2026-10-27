// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The holstered Jedi's LMB: a Force strike string (two palm strikes, then a burst), tuned in CFG.holster.

import { CFG } from '../../data/config.js';
import { stamDelay } from '../stamina.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, TMP } from '../../utils.js';
import { floater } from '../../fx/floaters.js';
import { shared, G, enemies, bolts, player } from '../../state.js';
import { forcePower, fwd, playerPos, stance } from '../helpers.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss } from '../../boss/boss.js';
import { inReach } from '../../enemies/bodyshape.js';
import { guardImpact, isGuarding } from '../../enemies/duel.js';
import { focusDmgMul, addFocus } from './focus.js';
import { spawnPushWave } from '../../fx/vfx.js';
import { sparks } from '../../fx/ink.js';

const POSTURE = { palm: 20, burst: 40 };   // how hard each beat cracks a duellist's guard (a kick is DUEL.posture.kick)

// LMB with the saber holstered. A press late in a strike queues the next one; early mashing is ignored.
export function forceStrike(){
  if (G.mode !== 'play' || player.blockHeld || player.judgeT > 0 || player.mendT > 0 || player.kickT > 0 || player.mantle || player.hang || player.flinchT > 0) return;
  const H = CFG.holster;
  if (player.palmT > 0){ if (player.palmT < player.palmMax * 0.5) player.palmQueued = true; return; }
  const step = G.gt - player.lastPalmEnd < H.comboGap ? (player.palmStep + 1) % H.strike.length : 0;
  const B = H.strike[step];
  if (player.stam < B.stamina){
    if (G.gt - player.lastWinded > 0.6){ player.lastWinded = G.gt; floater(playerPos(), 'WINDED', '#ffaa66'); }
    return;
  }
  player.stam -= B.stamina; player.stamDelay = stamDelay();
  if (player.slideT > 0) player.slideT = 0;
  player.palmStep = step;
  player.palmT = player.palmMax = B.dur;
  player.palm = { B, hand: B.burst ? 'both' : (step % 2 ? 'R' : 'L'), landed: false };
  player.vel.addScaledVector(fwd(), B.burst ? 5 : 3);   // step into it
  sfx(B.burst ? 160 : 260, 0.08, 'sine', 0.04, B.burst ? 70 : 120);   // the air gathering in the palm
}

// per frame (Jedi): run the strike's clock, land it on its contact frame, chain a queued press
export function updateForceStrike(dt){
  if (!(player.palmT > 0)) return;
  player.palmT -= dt;
  const P = player.palm;
  if (P && !P.landed && player.palmMax - player.palmT >= P.B.dur * P.B.contact){ P.landed = true; landStrike(P.B); }
  if (player.palmT <= 0){
    player.palmT = 0; player.palm = null; player.lastPalmEnd = G.gt;
    if (player.palmQueued){ player.palmQueued = false; forceStrike(); }
  }
}

function landStrike(B){
  const f = fwd(), pp = playerPos(), cosLim = Math.cos(B.angle);
  const col = stance().blade;
  spawnPushWave(pp.clone(), f.clone(), col, B.burst ? 0.45 : 0.2);
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > 2.5) continue;
    TMP.y = 0;
    const d = TMP.length();
    if (!inReach(e, pp, B.range, d > 1.2 ? f : null, cosLim)) continue;
    const dir = d > 0.01 ? TMP.clone().normalize() : f.clone();
    if (isGuarding(e)) guardImpact(e, B.burst ? POSTURE.burst : POSTURE.palm);   // the Force goes round a blade: it batters the guard instead
    damageEnemy(e, B.dmg * (player.up.dmg || 1) * focusDmgMul() * forcePower(), dir, B.knock * forcePower() * (1 - d / B.range * 0.4) * (player.up.knock || 1));
    flinchEnemy(e, dir, B.burst ? 1 : 0.5);
    hit++;
  }
  if (shared.boss && shared.boss.hp > 0){
    TMP.subVectors(shared.boss.group.position, pp); TMP.y = 0;
    if (TMP.length() < B.range + 1 && TMP.normalize().dot(f) > cosLim){ damageBoss(B.dmg * 0.5); hit++; }
  }
  // the burst also turns blaster fire in the cone back on the shooters, like a small Push
  if (B.burst) for (const b of bolts){
    if (b.friendly) continue;
    TMP.subVectors(b.mesh.position, pp); TMP.y = 0;
    if (TMP.length() < B.range && TMP.normalize().dot(f) > cosLim){ b.friendly = true; b.dir.negate(); b.dmg = 20; b.mesh.material.color.setHex(0x66ccff); }
  }
  const ip = V3(pp.x + f.x * 1.4, pp.y + 1.4, pp.z + f.z * 1.4);
  sparks(ip, col, B.burst ? 10 : 5, B.burst ? 9 : 6, { dir: f, cone: 0.5, life: 0.22, grav: 0 });
  if (hit){
    addFocus(B.burst ? 8 : 4);
    G.hitstop = Math.max(G.hitstop, B.burst ? 0.06 : 0.03); G.shake = Math.max(G.shake, B.burst ? 0.35 : 0.18);
    if (B.burst) S.push(); else S.punch(ip, 0.8);
  }
}
