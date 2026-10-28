// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ATTACK TELLS: one colour and one sound per kind of danger, shared by every foe, boss and hazard, so a glance says what
// to do. Add a new attack by picking a kind here, never by inventing a colour. The How to Play legend reads this table.
//   parry  white and red: a thrust or lunge. A held block fails; parry it or dodge it.
//   dodge  red: unblockable. Roll, dash or jump; nothing else helps.
//   area   amber: a blast or zone on the ground. Move out of the ring.

import { V3 } from '../utils.js';
import { sfx } from '../audio/sfx.js';
import { burst } from './particles.js';
import { hooks } from '../net/run.js';
import { spawnGroundShock } from './vfx.js';

export const TELLS = {
  parry: { color: 0xffffff, accent: 0xff3a3a, name: 'PARRY OR DODGE', note: 'A thrust or lunge. A held block will not stop it: parry it or step away.' },
  dodge: { color: 0xff2a2a, accent: 0xff2a2a, name: 'DODGE', note: 'Unblockable. Roll, dash or jump it; parrying will not work.' },
  area:  { color: 0xffae2a, accent: 0xffae2a, name: 'MOVE', note: 'A blast or zone on the ground. Get out of the ring before it lands.' },
};
export const tellCss = k => '#' + TELLS[k].color.toString(16).padStart(6, '0');

// the sound of each kind (a rising whine, a two-note alarm, a low bell), so it reads even off screen
export function tellSound(kind){
  if (kind === 'parry') sfx(1400, 0.22, 'sawtooth', 0.04, 2600);
  else if (kind === 'dodge'){ sfx(560, 0.1, 'square', 0.05, 420); setTimeout(() => sfx(420, 0.14, 'square', 0.05, 300), 90); }
  else sfx(300, 0.3, 'sine', 0.07, 200);
}
// the flash at a foe's feet (or the landing mark): a ring in the kind's colour, a burst over it, and its sound
export function tellFx(kind, pos, radius, dur = 0.45){
  if (hooks.tell) hooks.tell(kind, pos, radius, dur);   // co-op: the other browser sees the warning too
  const T = TELLS[kind];
  spawnGroundShock(V3(pos.x, 0.1, pos.z), T.color, radius, dur, 0.8);
  burst(V3(pos.x, 1.8, pos.z), T.accent, 8, 5, 3, 0.8);
  tellSound(kind);
}
