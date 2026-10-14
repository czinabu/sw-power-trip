// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Hero swap (Jedi / Mandalorian).

import { G, player } from '../state.js';
import { syncWeaponMesh } from './mando/weapons.js';
import { syncMandoChips } from '../game/flow.js';
import { renderControls } from '../ui/controls.js';

/* ---------- HERO SWAP — toggle the Jedi rig vs. the Mandalorian loadout ---------- */
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
  renderControls(hero);   // the HOW TO PLAY panel follows the picked hero
  const fpl = document.getElementById('fplabel'); if (fpl) fpl.textContent = mando ? 'GADGET POWER' : 'FORCE';
  document.getElementById('hero-jedi').classList.toggle('sel', !mando);
  document.getElementById('hero-mando').classList.toggle('sel', mando);
  syncWeaponMesh();              // show the equipped weapon mesh (or none, off-hero)
  if (mando) syncMandoChips();   // hide ability chips not yet earned
}
