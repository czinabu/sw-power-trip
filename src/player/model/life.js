// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The small life in a hero's face and hands, stepped each frame after the pose (player/animation.js, and the co-op
// partners' puppets in net/partner.js):
//   · BLINK — the Jedi's upper lids (jedi.js face) drop and lift every few seconds, now and then twice
//   · WEAR — the dust line follows the feet and the fight's soot follows target.grime (model/wear.js)
//   · HANDS — each hand eases toward the grip it's asked for: 1 a fist round a hilt or a blaster, 0 a flat open
//     palm (a Force push), between them a relaxed hand or a hooked claw (jedi.js hand, curlHand)

import { curlHand } from './jedi.js';
import { stepWear } from './wear.js';

const OPEN = 0.3;   // the lid's scale while the eye is open: just its crease shows

export function blink(target, dt){
  const R = target.rig;
  if (!R) return;
  stepWear(target);
  const B = target.blink || (target.blink = { t: 1 + Math.random() * 3, k: 0, twice: false });
  B.t -= dt;
  if (B.t <= 0){ B.k = 0.14; B.t = B.twice ? 0.22 : 2.2 + Math.random() * 3.5; B.twice = !B.twice && Math.random() < 0.2; }
  B.k = Math.max(0, B.k - dt);
  const shut = B.k > 0 ? Math.sin(B.k / 0.14 * Math.PI) : 0;
  for (const head of R.head.children){
    const lids = head.userData.lids;
    if (lids) for (const l of lids) l.scale.y = OPEN + (1 - OPEN) * shut;
  }
}

/* ease each hand toward its grip: want = { L, R } curls (0..1) */
export function gripHands(target, dt, want){
  const R = target.rig;
  if (!R) return;
  for (const [A, c] of [[R.armL, want.L], [R.armR, want.R]]){
    const hs = A.wr.userData.hands;
    if (!hs) continue;
    for (const h of hs){
      const cur = h.curl < 0 ? c : h.curl;
      curlHand(h, cur + (c - cur) * Math.min(1, dt * 14));
    }
  }
}
