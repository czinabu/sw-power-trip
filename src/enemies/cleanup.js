// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Every overlay a foe owns outside its body: the mid-boss health bar (spawn.js), the duelist's posture bar (duel.js),
// the marksman's laser sight (specials.js) and the lancer's lunge line (tactics.js). They live in the scene, not on
// the body, so removing the body alone leaves them behind. Anything that kills or clears a foe goes through here.

import { scene } from '../engine/renderer.js';
import { cleanupDuel } from './duel.js';
import { cleanupTactics, dropLungeLine } from './tactics.js';

// the moment a foe dies: nothing it was showing stays up while the body ragdolls and fades
export function hideIndicators(e){
  if (e.hpBar) e.hpBar.visible = false;
  if (e.postBar) e.postBar.visible = false;
  if (e.aimLine) e.aimLine.visible = false;
  dropLungeLine(e);
}
// take a foe off the field: its body and every overlay it owns (the caller drops it from `enemies`)
export function removeEnemy(e){
  scene.remove(e.group);
  cleanupDuel(e); cleanupTactics(e);
  if (e.aimLine){ scene.remove(e.aimLine); e.aimLine.material.dispose(); e.aimLine = null; }
  if (e.hpBar){ scene.remove(e.hpBar); e.hpBar = null; e.hpBarFill = null; }
}
