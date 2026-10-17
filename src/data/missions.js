// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY MISSIONS, as data. game/mission.js runs them one objective after another; edit the words, timings and foes freely.
//
// A mission is a level (an arena to build, like data/levels.js) plus a list of objectives run in order. Dying puts you
// back at the start of the objective you fell on. `kit` is how far into a run your gear is (the stage the automatic
// unlocks in data/store.js check against), so a mission plays with a mid-run kit instead of the bare starting one.
//
// Objective kinds and their fields
//   hold      stand by a spot until a timer runs out
//               at [x, z], r: the zone · time: seconds of progress needed · awayRate: progress speed while you're out of
//               the zone and no foe is in it (in it: full speed; a foe in it while you're out: it stalls)
//               pulses: reinforcement groups { type: count }, sent in turn · every: [with an officer alive, without]
//               seconds between pulses (officers call them in, so drop the officers) · cap: most foes on the field
//   sabotage  reach each console and stay on it to slice it
//               consoles: [{ at: [x, z], guards: { type: count } }] · time: seconds of slicing each · r: how close
//               hitLoss: seconds of slicing lost when you're hit · trickle: { every, cap, group } light reinforcements
//   duel      one opponent, one on one
//               foe: the enemy type it's built from · name · hp, dmg: multipliers on that type · scale · tint
//               duel: overrides of its duelling profile (data/duel.js) · rage: at this fraction of hp it presses harder
//               (rageDuel: the profile then) · at: [x, z] where it lands
// Every objective has `title` (the HUD line), and `say` / `task` per hero: the voice's line and the plain instruction.

import { LEVELS } from './levels.js';

export const MISSION_VOICE = { jedi: 'THE BATTLEMASTER', mando: 'THE ARMORER' };
export const MISSION_COLOR = { jedi: 0x5ad2ff, mando: 0xffa040 };

export const MISSIONS = {
  temple: {
    id: 'temple',
    title: 'THE LAST EVACUATION',
    level: { ...LEVELS[0], name: 'MISSION — THE LAST EVACUATION', waves: [],
             sub: 'The Empire is at the temple gates. The last transport is still loading.' },
    kit: 4,
    objectives: [
      { kind: 'hold', title: 'HOLD THE LANDING PAD',
        say: { jedi: 'The younglings are boarding. Nothing reaches that ramp until the transport is sealed.',
               mando: 'The foundlings are boarding. Hold the pad until the transport lifts. This is the Way.' },
        task: { jedi: 'Defend the landing pad until the evacuation is done', mando: 'Defend the landing pad until the evacuation is done' },
        at: [0, 13], r: 4.5, time: 75, awayRate: 0.5,
        pulses: [ { grunt: 3, blaster: 1, officer: 1 }, { grunt: 2, blaster: 2, grenadier: 1 }, { grunt: 3, lancer: 1, officer: 1 },
                  { grunt: 2, blaster: 2, duelist: 1 }, { grunt: 3, grenadier: 1, lancer: 1, officer: 1 } ],
        every: [8, 13], cap: 12 },

      { kind: 'sabotage', title: 'SLICE THE UPLINKS',
        say: { jedi: 'They are calling down a bombardment on the temple. Silence their uplinks before it falls.',
               mando: 'Their uplinks are calling in the bombardment. Slice them. Quickly.' },
        task: { jedi: 'Stand at each uplink console to slice it', mando: 'Stand at each uplink console to slice it' },
        consoles: [ { at: [-16, 3],  guards: { grunt: 2, blaster: 1 } },
                    { at: [16, -4],  guards: { lancer: 1, grunt: 2 } },
                    { at: [-4, -17], guards: { grenadier: 1, blaster: 1, officer: 1 } } ],
        time: 4, r: 2.2, hitLoss: 1.2,
        trickle: { every: 14, cap: 6, group: { grunt: 2, blaster: 1 } } },

      { kind: 'duel', title: 'DEFEAT THE INQUISITOR',
        say: { jedi: 'The Inquisitor has come for you, not the temple. Read the blade, not the mask.',
               mando: 'A hunter of Jedi. It turns a blaster bolt with ease. Close the distance and break it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'acolyte', name: 'THE INQUISITOR', hp: 6, dmg: 1.25, scale: 1.18, tint: 0xa01a22, at: [0, -8],
        duel: { block: 0.78, posture: 170, feint: 0.35, chain: 2, counter: 0.6 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.4, chain: 3, thrust: 0.25 } },
    ],
    done: { jedi: 'The transport is away and the temple still stands. Well fought.',
            mando: 'The foundlings are safe. The hunter is not. This is the Way.' },
  },
};
