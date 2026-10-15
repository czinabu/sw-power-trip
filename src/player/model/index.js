// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildHeroModel(): assembles the rig, both heroes' outfits and the hand-held gear in one render style,
// and writes the hooks the rest of the game uses (player.rig, player.saberHand, player.jetGlow, …) onto `target`.

import { buildRig } from './rig.js';
import { makeStyle } from './styles.js';
import { dressJedi } from './jedi.js';
import { dressMando } from './mando.js';
import { buildGear } from './gear.js';

export function buildHeroModel(target, styleName){
  const S = makeStyle(styleName);
  const R = buildRig();
  const jedi = dressJedi(R, S);
  const mando = dressMando(R, S, target);
  buildGear(R, S, target);

  target.vis = R.vis;
  target.rig = {
    hips: R.hips, torso: R.torso, chest: R.chest, head: R.head, back: R.back,
    skirt: R.skirt, flaps: R.flaps, cape: mando.cape,
    legL: R.legL, legR: R.legR, armL: R.armL, armR: R.armR,
  };
  target.mandoParts = mando.parts;
  target.headBare = jedi.parts;   // setHero() shows these for the Jedi and hides them for the Mando
  target.modelStyle = S;
  R.vis.scale.setScalar(1.18);
  return R.vis;
}
