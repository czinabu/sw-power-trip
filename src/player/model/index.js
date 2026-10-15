// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildHeroModel(): one rig dressed as BOTH heroes (setHero toggles which is visible) from a look (appearance.js),
// plus the weapon loadout. Writes the hooks the rest of the game uses (player.rig, player.saberHand, player.jetGlow, …)
// onto `target`. Rebuild with a different look to restyle: nothing outside this folder knows about outfits.

import * as THREE from 'three';
import { buildRig, MIRROR } from './rig.js';
import { makeStyle } from './styles.js';
import { resolveLook } from './appearance.js';
import { JEDI_PARTS } from './jedi.js';
import { MANDO_PARTS } from './mando.js';
import { mountLoadout } from './weapons.js';

export function buildHeroModel(target, lookIn = {}){
  const look = resolveLook(lookIn);
  const S = makeStyle(look.style, { ...look.jedi.palette, ...look.mando.palette });
  const R = buildRig();

  const jedi = dress(R, S, look.jedi, JEDI_PARTS, target);
  const mando = dress(R, S, look.mando, MANDO_PARTS, target);
  for (const p of mando.parts) p.visible = false;
  mountLoadout(R, S, target);

  target.vis = R.vis;
  target.rig = {
    hips: R.hips, torso: R.torso, chest: R.chest, head: R.head, back: R.back, cape: R.cape,
    skirt: R.skirt, flaps: R.flaps, legL: R.legL, legR: R.legR, armL: R.armL, armR: R.armR, sockets: R.sockets,
  };
  target.mandoParts = mando.parts;
  target.headBare = jedi.parts;   // setHero() shows these for the Jedi and hides them for the Mando
  target.look = look;
  R.vis.scale.set(1.18 * MIRROR, 1.18, 1.18);   // mirrored so the weapon hand (armR) is his RIGHT hand
  return R.vis;
}

// dress the rig in one hero's outfit: run the chosen variant of every slot through a small kit that styles each
// mesh, applies the build proportions and records it as one of that hero's parts
function dress(R, S, hero, PARTS, player){
  const parts = [];
  const B = hero.build;
  const limbJoints = new Set([R.legL.hip, R.legL.knee, R.armL.sh, R.armL.el, R.legR.hip, R.legR.knee, R.armR.sh, R.armR.el]);
  // each hero gets its own head root so the head-size knob never touches the other hero
  const headRoot = new THREE.Group(); headRoot.scale.setScalar(B.head); R.head.add(headRoot); parts.push(headRoot);
  const HR = { ...R, head: headRoot };
  const shape = (m, parent) => {
    if (limbJoints.has(parent)){ m.scale.x *= B.bulk; m.scale.z *= B.bulk; }
    else if (parent === R.chest || parent === R.torso){ m.scale.x *= B.shoulders; m.position.x *= B.shoulders; }
  };
  const k = {
    style: S,
    mat: (key, over) => S.mat(key, over),
    add(geo, mat, parent, p, r, o){ const m = S.add(geo, mat, parent, p, r, o); shape(m, parent); parts.push(m); return m; },
    group(parent, p = [0,0,0], r = [0,0,0]){ const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...r); parent.add(g); parts.push(g); return g; },
    seam(geo, color, parent, p, r){ if (!hero.seams) return null; const m = S.seam(geo, color, parent, p, r); parts.push(m); return m; },
  };
  for (const [slot, variants] of Object.entries(PARTS)){
    const pick = hero.parts[slot];
    const fn = variants[pick] || Object.values(variants)[0];
    if (!variants[pick]) console.warn(`look: no ${slot} variant "${pick}", using the first one`);
    fn(HR, k, player);
  }
  return { parts };
}
