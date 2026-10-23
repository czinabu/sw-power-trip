// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY MISSIONS, as data. game/mission.js runs them one objective after another; edit the words, timings and foes freely.
//
// A mission is a level (an arena to build, like data/levels.js) plus a list of objectives run in order. Dying puts you
// back at the start of the objective you fell on. `kit` is how far into a run your gear is (the stage the automatic
// unlocks in data/store.js check against), so a mission plays with a mid-run kit instead of the bare starting one.
// `start` is [x, z, yaw] where the hero stands when it begins (yaw 0 faces north, +z). `grant` is the abilities each
// hero gets on top (G.unlocked keys; one from a fork pair, data/store.js). Foes are as tough as a run's first wave.
//
// Objective kinds and their fields
//   hold      stand by a spot until a timer runs out
//               at [x, z], r: the zone · time: seconds of progress needed · awayRate: progress speed while you're out of
//               the zone and no foe is in it (in it: full speed; a foe in it while you're out: it stalls)
//               pulses: reinforcement groups { type: count }, sent in turn · every: [with an officer alive, without]
//               seconds between pulses (officers call them in, so drop the officers) · cap: most foes on the field
//               from: [a0, a1] the arc of the edge they arrive from (radians, 0 = east, -π/2 = south) · aggro: a foe
//               marches on the zone and only fights you when you're this close to it
//               squadRate (optional): progress speed with only squadmates (allies/squad.js) in the zone
//               evacuees: { count, path: [[x, z]…] (from their shelter to the ship's hatch), spacing, speed, name } the
//               people being saved, filing aboard as the timer runs (they stop and huddle while it stalls)
//   sabotage  reach each console and stay on it to slice it
//               consoles: [{ at: [x, z], guards: { type: count } }] · time: seconds of slicing each · r: how close
//               hitLoss: seconds of slicing lost when you're hit · trickle: { every, cap, group } light reinforcements
//   capture   take a line of posts in turn: stand in one (or put the squad on it with H) with no foe inside
//               posts: [{ at: [x, z], guards: { type: count } }] · r · time: seconds to take each · squadRate: speed with
//               only squadmates in it · perMate: extra speed per squadmate in it · trickle: { every, cap, group } troops
//               marching on the post being taken · from: the arc they come from · aggro (see hold)
//   duel      one opponent, one on one
//               foe: the enemy type it's built from · name · hp, dmg: multipliers on that type · scale · tint
//               duel: overrides of its duelling profile (data/duel.js) · rage: at this fraction of hp it presses harder
//               (rageDuel: the profile then) · at: [x, z] where it lands · quarry: true fights the mission's quarry
//               where it stopped running instead (its name and look come from the mission's `quarry`)
//               trickle (optional): { every, cap, group } troops for the squad to hold off during the duel · from
//   pursuit   chase the quarry along one leg of its route (the arena's spots) without losing it
//               leg: which leg · sight: how far you can see it (m; walls block the view) · lost: seconds out of
//               sight before it gets away (the objective restarts) · pace: [[gap m, speed m/s]…] how fast it runs for
//               how far ahead of you it is (it eases off when you fall behind and sprints when you close in)
//               shove: how close you can get before it throws you back and breaks away · the route itself is the
//               mission's `route` (one polyline per leg) and who runs it is its `quarry`
//               ambush: [{ at: [x, z] (fires as the quarry runs past here), spots: [[x, z]…], group: { type: count } }]
//               foes stepping out of doorways (optional: the spaceport keeps its runs clear and fights only at standoffs)
//               shortcuts: [{ zone: [x0, x1, z0, z1], at: [x, z] }] parkour lanes that cut a corner: a beacon marks the
//               way in, and inside one the escape clock holds · start: [x, z, yaw] where a retry of this leg begins
//               standoff: [{ at: [x, z], spots, group, line }] it stops here to cut through a sealed way and its guard
//               (group, at spots) holds you off; it runs on once they're down (or bolts if you get ahead of it) · clash: { dmg, time, every } catch it on
//               open ground and it turns to fight until you've taken dmg (a fraction of its hp) off it or `time` runs
//               out, then breaks away; again no sooner than `every` seconds. The wounds carry into the quarry duel.
// Every objective has `title` (the HUD line), and `say` / `task` per hero: the voice's line and the plain instruction.
// Any field can differ per hero: put the hero's version under `hero: { jedi: {…}, mando: {…} }`.
// `music` (optional) picks the score's cue for it (audio/music.js CUES: defend, infiltrate, duel, chase, battle…);
// by default each kind plays its own (hold: defend, sabotage: infiltrate, duel: duel).

import { REFUGE_SPOTS } from '../world/arenas/refuge.js';
import { PURSUIT_SPOTS } from '../world/arenas/pursuit.js';

export const MISSION_VOICE = { jedi: 'THE BATTLEMASTER', mando: 'THE ARMORER' };
export const MISSION_COLOR = { jedi: 0x5ad2ff, mando: 0xffa040 };

export const MISSIONS = {
  refuge: {
    id: 'refuge',
    title: 'THE LAST EVACUATION',
    blurb: 'hold, sabotage, then a duel',   // the line under its card in EXTRAS
    level: { name: 'MISSION — THE HIDDEN REFUGE', sub: 'The Empire has found the refuge. The last transport is still loading.',
             arena: 64, floor: 0x8a8478, fog: 0xa89098, sky: 0x2c3c66, layout: 'refuge', waves: [], hazards: {} },
    start: [0, 2, 0],   // south of the ramp, looking at the transport and the line filing aboard
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'hold', title: 'HOLD THE RAMP',
        say: { jedi: 'The younglings are boarding. Nothing reaches that ramp until the transport is sealed.',
               mando: 'The foundlings are boarding. Hold the ramp until the transport lifts. This is the Way.' },
        task: { jedi: 'Guard the ramp while the younglings board', mando: 'Guard the ramp while the foundlings board' },
        at: [0, 9], r: 6, time: 75, awayRate: 0.5,
        evacuees: { count: 16, spacing: 1.2, speed: 2.2, name: { jedi: 'YOUNGLINGS', mando: 'FOUNDLINGS' },
                    path: [...REFUGE_SPOTS.path, ...REFUGE_SPOTS.ramp] },
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, officer: 1 }, { grunt: 2, blaster: 1, grenadier: 1 },
                  { grunt: 2, lancer: 1 }, { grunt: 2, blaster: 1, officer: 1 }, { grunt: 1, duelist: 1, blaster: 1 } ],
        every: [9, 14], cap: 7, from: [-Math.PI + 0.35, -0.35], aggro: 8 },

      { kind: 'sabotage', title: 'SLICE THE UPLINKS',
        say: { jedi: 'They are calling down a bombardment on the refuge. Silence their uplinks before it falls.',
               mando: 'Their uplinks are calling in the bombardment. Slice them. Quickly.' },
        task: { jedi: 'Stand at each uplink console to slice it', mando: 'Stand at each uplink console to slice it' },
        consoles: [ { at: REFUGE_SPOTS.uplinks[0], guards: { grunt: 2, blaster: 1 } },
                    { at: REFUGE_SPOTS.uplinks[1], guards: { lancer: 1, grunt: 2 } },
                    { at: REFUGE_SPOTS.uplinks[2], guards: { grenadier: 1, blaster: 1, officer: 1 } } ],
        time: 4, r: 2.2, hitLoss: 1.2,
        trickle: { every: 16, cap: 5, group: { grunt: 2, blaster: 1 } } },

      { kind: 'duel', title: 'DEFEAT THE INQUISITOR',
        say: { jedi: 'The Inquisitor has come for you, not the refuge. Read the blade, not the mask.',
               mando: 'A hunter of Jedi. It turns a blaster bolt with ease. Close the distance and break it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'acolyte', name: 'THE INQUISITOR', hp: 5, dmg: 1.25, scale: 1.18, tint: 0xa01a22, at: [0, -6],
        duel: { block: 0.78, posture: 170, feint: 0.35, chain: 2, counter: 0.6 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.4, chain: 3, thrust: 0.25 } },
    ],
    done: { jedi: 'The younglings are safe and the refuge still stands. Well fought.',
            mando: 'The foundlings are safe. The hunter is not. This is the Way.' },
  },

  // A STRIKE TEAM mission: `squad` squadmates form up beside the hero (allies/squad.js, data/allies.js), and `battle`
  // runs the wider war past the walls (fx/battle.js). The squad shoots the troopers; the duellists are yours.
  strike: {
    id: 'strike',
    title: 'SPEARHEAD',
    blurb: 'lead a strike team through the battle lines',
    level: { name: 'MISSION — THE BATTLE OF THE WASTES', sub: 'The army holds the wastes before the citadel. Break its line.',
             arena: 72, floor: 0x3b2f31, fog: 0x401a22, sky: 0x1a080c, skyTop: 0x090103, sun: 0xffb0a0, ember: 0xff4a55,
             fill: 0.98, sunI: 1.9, fogStart: 0.6, layout: 'plains', waves: [], hazards: {} },
    start: [0, 30, Math.PI],   // the north edge, looking south across the wastes at their line
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 4, battle: true,
    objectives: [
      { kind: 'capture', title: 'BREAK THEIR LINE',
        say: { jedi: 'Your troopers are with you, General. Take their forward posts one by one. Leave the troopers to the squad, and the blades to yourself.',
               mando: 'Your clan rides with you. Take their posts one by one. They\'ll handle the troopers. The blades are yours.' },
        task: { jedi: 'Take the three posts (H sends the squad to hold one)', mando: 'Take the three posts (H sends the squad to hold one)' },
        r: 5, time: 9, squadRate: 0.55, perMate: 0.15, postName: 'POST', doneLine: 'THEIR LINE BREAKS', aggro: 9,
        posts: [ { at: [12, 17], guards: { grunt: 3, blaster: 2 } },
                 { at: [-15, 2], guards: { grunt: 3, blaster: 2, officer: 1, lancer: 1 } },
                 { at: [9, -13], guards: { grunt: 2, blaster: 2, grenadier: 1, duelist: 1 } } ],
        trickle: { every: 13, cap: 10, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.35, -0.35] },

      { kind: 'hold', title: 'HOLD THE GROUND', music: 'battle',
        say: { jedi: 'They are throwing everything at us. Hold the ground until the gunships arrive. If a blade comes for you, put the squad on the ground (H) and meet it.',
               mando: 'They want the ground back. Hold it till the gunships come. Put your clan on it (H) when you have to go hunting.' },
        task: { jedi: 'Hold the ground until the gunships arrive', mando: 'Hold the ground until the gunships arrive' },
        at: [0, -3], r: 7, time: 60, awayRate: 0.25, squadRate: 0.6, overrun: 'RETAKE THE GROUND', unguarded: 'GROUND UNGUARDED',
        pulses: [ { grunt: 3, blaster: 2 }, { grunt: 2, blaster: 2, officer: 1 }, { grunt: 3, blaster: 1, phalanx: 1 },
                  { grunt: 2, blaster: 2, grenadier: 1 }, { grunt: 2, blaster: 1, acolyte: 1 }, { grunt: 3, blaster: 2, flyer: 1 } ],
        every: [8, 11], cap: 11, from: [-Math.PI + 0.35, -0.35], aggro: 9 },

      { kind: 'duel', title: 'DEFEAT THE WARDEN',
        say: { jedi: 'Their commander takes the field himself. Your men will keep his troops off you. He is yours.',
               mando: 'Their commander wants you himself. The clan will keep his troops busy. Take him.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds' },
        foe: 'acolyte', name: 'THE WARDEN', hp: 4.5, dmg: 1.2, scale: 1.2, tint: 0x8a2a1a, at: [0, -14],
        duel: { block: 0.75, posture: 165, feint: 0.35, chain: 2, counter: 0.55 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.4, chain: 3, thrust: 0.25 },
        trickle: { every: 12, cap: 4, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.35, -0.35],
        hero: { mando: { foe: 'duelist', name: 'THE IRON WARDEN', tint: 0x4a4a52, hp: 5,
                         duel: { block: 0.7, posture: 155, feint: 0.3, chain: 2, counter: 0.5 } } } },
    ],
    done: { jedi: 'The line is broken and the wastes are ours. Your men fought well, General. So did you.',
            mando: 'The ground is ours. The clan stands. This is the Way.' },
  },

  pursuit: {
    id: 'pursuit',
    title: 'THE LONG CHASE',
    blurb: 'run it down before it reaches its ship',
    level: { name: 'MISSION — THE SPACEPORT AT KHEL DAR', sub: 'It knows where the refuge went. Do not let it reach its ship.',
             arena: 56, arenaZ: 320, floor: 0xb49470, fog: 0xd8a878, sky: 0x3a5c92, layout: 'pursuit', waves: [], hazards: {} },
    start: PURSUIT_SPOTS.start,   // the south end of the town, the quarry already running up the market street
    route: PURSUIT_SPOTS.legs,     // the quarry's line through the town, one polyline per pursuit leg
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    // who you are chasing (built from an enemy type, like the refuge's duel)
    quarry: { jedi: { foe: 'acolyte', name: 'THE SEVENTH BLADE', kicker: 'INQUISITOR', tint: 0xa01a22, scale: 1.15 },
              mando: { foe: 'duelist', name: 'VX-7', kicker: 'BOUNTY · ASSASSIN DROID', tint: 0x4a5a6a, scale: 1.12 } },
    objectives: [
      { kind: 'pursuit', leg: 0,
        title: { jedi: 'CHASE THE INQUISITOR', mando: 'CHASE THE BOUNTY' },
        say: { jedi: 'The Inquisitor carries the refuge\'s new coordinates. Keep it in sight. Over the stalls, not around them, and take the lane north of the cross if you can climb it.',
               mando: 'The droid has the foundlings\' trail in its memory core. Run it down. Use the jetpack, use the walls. The lane north of the cross cuts its corner.' },
        task: { jedi: 'Keep the Inquisitor in sight', mando: 'Keep the bounty in sight' },
        sight: 42, lost: 6, shove: 3.0,
        pace: [[-6, 11.5], [6, 10.2], [14, 9.0], [24, 8.2], [36, 7.4]],
        clash: { dmg: 0.12, time: 12, every: 9 },
        shortcuts: PURSUIT_SPOTS.shortcuts[0],
        standoff: [ { at: [0, -100], spots: [[-10, -104], [10, -104], [-9, -96], [9, -96]], group: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [6, 6], spots: [[-6, 0], [14, 14], [-10, 14], [2, 22]], group: { grunt: 2, officer: 1, blaster: 1 } } ] },

      { kind: 'pursuit', leg: 1, start: PURSUIT_SPOTS.checkpoint,
        title: { jedi: 'CHASE THE INQUISITOR', mando: 'CHASE THE BOUNTY' },
        say: { jedi: 'It is making for the docks. The causeway is faster, if you can clear the gaps, and the stacks west of the hangars cut straight to the bay.',
               mando: 'It\'s heading for the docking bay. Take the causeway. Don\'t lose it in the hangars.' },
        task: { jedi: 'Keep the Inquisitor in sight', mando: 'Keep the bounty in sight' },
        sight: 42, lost: 6, shove: 3.0,
        pace: [[-6, 11.5], [6, 10.4], [14, 9.2], [24, 8.4], [36, 7.6]],
        clash: { dmg: 0.12, time: 12, every: 9 },
        shortcuts: PURSUIT_SPOTS.shortcuts[1],
        standoff: [ { at: [4, 83], spots: [[-8, 92], [0, 92], [8, 75], [-2, 75]], group: { grunt: 2, lancer: 1, grenadier: 1, blaster: 1 } } ] },

      { kind: 'duel', quarry: true, title: { jedi: 'DEFEAT THE INQUISITOR', mando: 'BRING IN THE BOUNTY' },
        say: { jedi: 'Its ship is clamped down. Nowhere left to run. Read the blade, not the mask.',
               mando: 'Docking clamps are locked. It has to come through you. Watch the staff, and break its guard.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        hp: 4.5, dmg: 1.2,
        duel: { block: 0.75, posture: 160, feint: 0.4, chain: 2, counter: 0.55 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.4, chain: 3, thrust: 0.25 },
        hero: { mando: { hp: 5, duel: { block: 0.7, posture: 150, feint: 0.3, chain: 2, counter: 0.5 } } } },
    ],
    done: { jedi: 'The coordinates die with it. The younglings stay hidden. Well run, and well fought.',
            mando: 'The trail is wiped and the bounty is claimed. The foundlings stay hidden. This is the Way.' },
  },
};
