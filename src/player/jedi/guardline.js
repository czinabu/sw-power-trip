// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Your guard on their line: the held block meets a duellist's strike where it's coming in, and a clean parry sets the
// riposte up on the side it left open (data/duel.js GUARD_LINE).

import { GUARD_LINE } from '../../data/duel.js';
import { SWING_PATTERNS } from '../../data/stances.js';
import { G, enemies, player } from '../../state.js';
import { playerPos, fwd } from '../helpers.js';
import { localPlayer } from '../players.js';

/* where a strike from a foe's side arrives on you, as the catch picker reads it (anim/saber.js pickDeflect): side + is
   your weapon side (right), h against the chest. The foe faces you, so its right comes in on your left. */
export function lineCatch(line){
  return GUARD_LINE.catch[line] || null;
}

/* Each frame: holding the guard with a duellist winding up at you, the blade goes to meet that strike on its line
   (a held catch on the deflect poses) and follows it if a feint switches sides. Nothing to meet, or the guard dropped:
   the held catch lets go and the form's own block takes over. The block itself still turns the blow whatever the line:
   this is where the blade waits, not a new rule. */
export function updateGuardLine(){
  const d = player.deflectAnim;
  const held = d && d.hold;
  const want = G.hero !== 'mando' && player.blockHeld && player.atkT <= 0 && !player.saberLock ? threatLine() : null;
  if (!want){ if (held) player.deflectAnim = null; return; }
  if (d && !held) return;   // a real catch (a bolt, a blow) is playing out: it hands back to the held line after
  if (held && d.line === want) return;
  const c = lineCatch(want);
  if (!c) return;
  player.deflectAnim = { t: 0, dur: 99, pose: null, side: c.side, h: c.h, hold: true, line: want };
}

// the line of the soonest strike a duellist is winding up at you, close and in front (null if none)
function threatLine(){
  const pp = playerPos(), f = fwd(), R = GUARD_LINE.range;
  let best = null, bt = Infinity;
  for (const e of enemies){
    if (!e.dp || e.dp.brace || !e.plan || e.dead || e.converted || e.net) continue;
    if (e.state !== 'windup' && e.state !== 'strike') continue;
    if (e.hero && e.hero !== localPlayer) continue;
    const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z, d = Math.hypot(dx, dz);
    if (d > R || (d > 0.5 && (dx * f.x + dz * f.z) / d < 0.2)) continue;
    const t = e.state === 'strike' ? -1 : e.st;
    if (t < bt){ bt = t; best = e.plan.side; }
  }
  return best;
}

/* the riposte after a clean parry of a duellist's strike from `line`: cut back in on the side it came from (its weapon
   has gone across and left that side open), or under an overhead with a thrust */
export function ripostePattern(line){
  const id = GUARD_LINE.riposte[line];
  return id ? SWING_PATTERNS[id] : null;
}
