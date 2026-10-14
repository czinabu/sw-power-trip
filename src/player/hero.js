// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Hero swap (Jedi / Mandalorian) and control-help text.

import { G, player } from '../state.js';
import { syncWeaponMesh } from './mando/weapons.js';
import { syncMandoChips } from '../game/flow.js';

/* ---------- HERO SWAP — toggle the Jedi rig vs. the Mandalorian loadout ---------- */
const CTL_TEXT = {
  jedi: '<b>WASD</b> move · <b>MOUSE</b> look · <b>TAP SPACE</b> jump · <b>×2</b> double-jump · <b>HOLD SPACE</b> Force LEAP + glide (spends Force, auto-levels) · <b>1/2/3</b>/<b>WHEEL</b> stance<br>'+
        '<b>LMB</b> saber combo · <b>CANCEL</b> a swing any time into RMB guard, <b>F</b>/<b>C</b> push/pull, or <b>SHIFT</b> dash · cancel into a parry for a COUNTER-RIPOSTE · while blocking <b>SPACE</b>+<b>WASD</b> = flip<br>'+
        '<b>E</b> KICK (shove) · <b>SHIFT</b> dash-flip · core: <b>F</b> push · <b>C</b> pull · earned (spend XP): <b>X</b> slam-or-mend · <b>R</b> judgement-or-repulse · <b>V</b> barrier · RMB+LMB throw · <b>P</b> graphics',
  mando:'<b>LMB</b> fire (aim for the HEAD — don\'t OVERHEAT) · <b>R</b> vent heat · <b>hold RMB</b>: SINGLE = GAUNTLET SHIELD (deflects bolts, costs stamina) · DUAL = aggressive brace · <b>E</b> GAUNTLET PUNCH (tap twice for a combo)<br>'+
        '<b>1</b> BLASTER · <b>2</b> DUAL · <b>3</b> SIGNATURE WEAPON (Disruptor <i>or</i> Darksaber) · <b>WHEEL</b> cycle<br>'+
        '<b>HOLD SPACE</b> JETPACK thrust (hover/climb) · <b>HOLD SHIFT</b> in air = BOOST + look DOWN to DIVE · ground SHIFT = dodge · <b>Z</b> MISSILE · XP: <b>F</b> flame <b>Q</b> rocket <b>X</b> slam-or-grapple <b>V</b> birds-or-detonator <b>H</b> bacta stim · <b>P</b> graphics',
};
export function setHero(hero){
  G.hero = hero;
  const mando = hero === 'mando';
  if (player.saberHand) player.saberHand.visible = !mando;
  if (player.mandoParts) for (const m of player.mandoParts) m.visible = mando;
  if (player.headBare)  for (const m of player.headBare) m.visible = !mando;
  // the long Jedi ROBE skirt is hidden for the Mando — beskar legs trail straight (no dangling cone in flight)
  if (player.rig && player.rig.skirt) player.rig.skirt.visible = !mando;
  document.body.classList.toggle('mando', mando);
  const xh = document.getElementById('xh'), rt = document.getElementById('reticle');
  if (xh) xh.style.display = mando ? 'none' : '';
  if (rt) rt.style.display = mando ? 'block' : 'none';
  const ctl = document.getElementById('ctl'); if (ctl) ctl.innerHTML = CTL_TEXT[hero];
  document.getElementById('hero-jedi').classList.toggle('sel', !mando);
  document.getElementById('hero-mando').classList.toggle('sel', mando);
  syncWeaponMesh();              // show the equipped weapon mesh (or none, off-hero)
  if (mando) syncMandoChips();   // hide ability chips not yet earned
}
