// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOCUS: the Jedi combat-flow meter.

import { sfx } from '../../audio/sfx.js';
import { V3, clamp } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { G, player, isGunner } from '../../state.js';
import { playerPos } from '../helpers.js';

/* ============================================================
   PLAYER COMBAT & ABILITIES
   ============================================================ */
/* ============================================================
   FORCE FOCUS — a Jedi combat-FLOW meter. Landing saber hits, deflections, and (especially) PARRIES build FOCUS; it
   decays out of combat, EBBS at the peak, and DROPS when you take a hit. Rising tiers ramp saber damage, Force regen
   and footwork — so the deep bladework (parry/riposte/deflect/cleave) finally PAYS OFF, and trading hits is punished.
   (Mando keeps its own kit; Focus is Jedi-only.)
   ============================================================ */
export const FOCUS = {
  thresh: [34, 67, 98], dmg: [1, 1.12, 1.2, 1.3], regen: [1, 1.3, 1.6, 2.0], move: [1, 1.0, 1.05, 1.12],
  decay: 16, ebb: 13, hitLoss: 0.55, gainHit: 4, gainFin: 7, gainDeflect: 7, gainParry: 16, gainKill: 6,
  ripBonus: 0.8,   // UNLEASHED: a parry's riposte window runs this much longer, and the riposte cut costs no stamina
  names: ['', 'FOCUSED', 'ATTUNED', 'UNLEASHED'],
};
export function focusTier(){ const f = player.focus || 0; return f >= FOCUS.thresh[2] ? 3 : f >= FOCUS.thresh[1] ? 2 : f >= FOCUS.thresh[0] ? 1 : 0; }
export function focusDmgMul(){ return isGunner() ? 1 : FOCUS.dmg[focusTier()]; }
export function freeRiposte(){ return !isGunner() && focusTier() >= 3; }
export function riposteWindow(base){ return freeRiposte() ? base + FOCUS.ripBonus : base; }
export function focusRegenMul(){ return isGunner() ? 1 : FOCUS.regen[focusTier()]; }
export function focusMoveMul(){ return isGunner() ? 1 : FOCUS.move[focusTier()]; }
export function addFocus(n){ if (isGunner() || G.mode !== 'play') return; player.focus = clamp((player.focus || 0) + n, 0, 100); player.focusHitT = 0; }
export function updateFocus(dt){
  if (isGunner()) return;
  player.focusHitT = (player.focusHitT || 0) + dt;
  const t = focusTier();
  const drain = t >= 3 ? FOCUS.ebb : (player.focusHitT > 1.6 ? FOCUS.decay : 0);   // top tier ebbs; else decays out of combat
  if (drain) player.focus = Math.max(0, (player.focus || 0) - drain*dt);
  if (t > (player._focusTier || 0)){   // a tier-up beat
    const pp = playerPos();
    floater(V3(pp.x, 2.2, pp.z), FOCUS.names[t], t >= 3 ? '#ffd24a' : '#8fe0ff');
    burst(V3(pp.x, 1.4, pp.z), t >= 3 ? 0xffd24a : 0x8fe0ff, 14, 7, 5);
    sfx(t >= 3 ? 700 : 480, 0.18, 'sine', 0.1, t >= 3 ? 1300 : 900);
    if (t >= 3) screenFlash('radial-gradient(ellipse at center, rgba(255,220,120,.25), transparent 60%)', 0.5, 0.3);
  }
  player._focusTier = t;
}
