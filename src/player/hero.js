// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Hero swap (Jedi / Mandalorian / clone trooper, the last in testing).

import { G, player, isGunner } from '../state.js';
import { syncWeaponMesh } from './mando/weapons.js';
import { syncMandoChips } from '../game/flow.js';
import { renderControls } from '../ui/controls.js';
import { trooperStartKit } from './trooper/kit.js';
import { TROOPER_WEAPONS } from '../data/trooper.js';

/* ---------- HERO SWAP — show one hero's outfit and loadout. The Mandalorian and the trooper are both GUNNERS: they
   share the reticle and the gun HUD (the body's 'mando' class); the trooper adds its own 'trooper' class on top. ---------- */
export function setHero(hero){
  if (hero === 'trooper' && !(player.trooperParts && player.trooperParts.length)) hero = 'mando';   // (no trooper built: the page has no ?trooper)
  G.hero = hero;
  const gunner = isGunner(hero), mando = hero === 'mando', trooper = hero === 'trooper';
  if (player.saberHand) player.saberHand.visible = !gunner;
  if (player.mandoParts) for (const m of player.mandoParts) m.visible = mando;
  if (player.trooperParts) for (const m of player.trooperParts) m.visible = trooper;
  if (player.headBare)  for (const m of player.headBare) m.visible = !gunner;
  // the long Jedi ROBE skirt is hidden for the gunners — armoured legs trail straight (no dangling cone in flight)
  if (player.rig && player.rig.skirt) player.rig.skirt.visible = !gunner;
  document.body.classList.toggle('mando', gunner);
  document.body.classList.toggle('trooper', trooper);
  const xh = document.getElementById('xh'), rt = document.getElementById('reticle');
  if (xh) xh.style.display = gunner ? 'none' : '';
  if (rt) rt.style.display = gunner ? 'block' : 'none';
  renderControls(hero);   // the CONTROLS panel follows the picked hero
  const fpl = document.getElementById('fplabel'); if (fpl) fpl.textContent = trooper ? 'COMMAND' : mando ? 'GADGET POWER' : 'FORCE';
  document.getElementById('hero-jedi').classList.toggle('sel', !gunner);
  document.getElementById('hero-mando').classList.toggle('sel', mando);
  const ht = document.getElementById('hero-trooper'); if (ht) ht.classList.toggle('sel', trooper);
  if (trooper) trooperStartKit();   // the DC-15 in hand, frag charges full
  else if (mando && TROOPER_WEAPONS[player.weapon]) player.weapon = 'single';   // back from the trooper: the Mando's own blaster
  syncWeaponMesh();              // show the equipped weapon mesh (or none, off-hero)
  if (gunner) syncMandoChips();   // hide ability chips not yet earned
}
