// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Lightsaber stance switching and the stance HUD.

import { STANCES, STANCE_ORDER, stanceUnlocked } from '../../data/stances.js';
import { sfx } from '../../audio/sfx.js';
import { V3 } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater } from '../../fx/floaters.js';
import { G, player } from '../../state.js';
import { reigniteBlade } from '../../fx/trail.js';
import { startTwirl } from '../anim/saber.js';
import { playerPos, stance, bladeColor } from '../helpers.js';

/* ---------- stance switching: 1/2/3 or mouse wheel ---------- */
let _synT = 0;
export function setStanceHud(){
  const st = stance();
  for (const id of STANCE_ORDER){
    const chip = document.getElementById('st-' + id);
    chip.classList.toggle('active', id === G.stance);
    chip.classList.toggle('locked', !stanceUnlocked(id));   // dim the forms you haven't earned yet
  }
  // the form's strengths read for a few seconds after a change, then fade so they don't crowd the action
  const syn = document.getElementById('stancesyn');
  syn.textContent = st.syn; syn.classList.add('show');
  clearTimeout(_synT); _synT = setTimeout(() => syn.classList.remove('show'), 4000);
}
export function switchStance(id, silent){
  if (!STANCES[id] || (G.stanceCd > 0 && !silent) || G.stance === id) return;
  if (!silent && !stanceUnlocked(id)){ floater(playerPos(), 'FORM LOCKED', '#ff9a66'); sfx(120, 0.1, 'square', 0.05, 70); return; }
  G.stance = id;
  G.stanceCd = 0.35;
  const st = STANCES[id];
  // blade re-tunes to the form
  player.blade.glow.material.color.setHex(bladeColor(st));
  player.blade.light.color.setHex(bladeColor(st));
  if (!silent){ reigniteBlade(); startTwirl(); }   // snap-hiss and a twirl: the blade re-ignites in the new form's colour
  setStanceHud();
  if (!silent){
    const pp = playerPos();
    burst(V3(pp.x, 1.6, pp.z), st.blade, 10, 4, 3);
    floater(pp, st.name, '#' + ('000000' + st.blade.toString(16)).slice(-6));
    sfx(id === 'fast' ? 740 : id === 'medium' ? 540 : 320, 0.22, 'sine', 0.1, id === 'strong' ? 160 : 1480);
    sfx(90, 0.18, 'sawtooth', 0.06, 60);   // saber re-ignite growl
  }
}
