// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY MISSIONS, as data. game/mission.js runs them one objective after another; edit the words, timings and foes freely.
//
// A mission is a level (an arena to build, like data/levels.js) plus a list of objectives run in order. Dying puts you
// back at the start of the objective you fell on. `kit` is how far into a run your gear is (the stage the automatic
// unlocks in data/store.js check against), so a mission plays with a mid-run kit instead of the bare starting one.
// `start` is [x, z, yaw] where the hero stands when it begins (yaw 0 faces north, +z). `grant` is the abilities each
// hero gets on top (G.unlocked keys; one from a fork pair, data/store.js). Foes are as tough as a run's first wave.
// `foeLook` dresses the foe types it sends in another uniform ({ type: { model, color, eye, cloth } }, enemies/look.js);
// `squadCap` is the most squadmates it has (the ARC trooper otherwise tops his squad up to his own size).
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
//   capture   take a line of posts in turn: stand in one (or send the squad onto it with H) with no foe inside
//               posts: [{ at: [x, z], guards: { type: count } }] · r · time: seconds to take each · squadRate: speed with
//               only squadmates in it · perMate: extra speed per squadmate in it · trickle: { every, cap, group } troops
//               marching on the post being taken · from: the arc they come from · aggro (see hold)
//   duel      one opponent, one on one
//               foe: the enemy type it's built from · name · hp, dmg: multipliers on that type · scale · tint
//               duel: overrides of its duelling profile (data/duel.js) · rage: at this fraction of hp it presses harder
//               (rageDuel: the profile then) · at: [x, z] where it lands · quarry: true fights the mission's quarry
//               where it stopped running instead (its name and look come from the mission's `quarry`)
//               escape (optional): at this fraction of hp it breaks off and is gone instead of falling, with
//               escapeLine ({ jedi, mando }) under its banner
//               trickle (optional): { every, cap, group } troops for the squad to hold off during the duel · from
//   escort    walk the mission's `escort` (a droid, a courier) along a path to where it's needed
//               path: [[x, z]…] its route · speed: m/s while it walks · leash: it waits for you when you're further
//               off than this · threat: a foe this close pins it down (it stops and takes fire) · dps: hp a second
//               each such foe takes off it · regen: hp a second back while nothing is on it · ambush: [{ at: [x, z]
//               (fires as it walks past here), group: { type: count }, from: the arc they come from }] foes sent at
//               it, who march on it and only turn on you when you're within `aggro` · trickle (optional) · it falls
//               and the objective restarts; its hp carries from one escort leg to the next
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
//               The leg starts as soon as you reach the quarry; standing in its way on its line catches it from a few
//               metres further off (and sooner after the last clash); running far out ahead of it (30 m, out of sight)
//               loses it like falling behind; and it only finishes a leg once you can see it or are close.
//   breach    stack up on one of the arena's doors (world/doors.js, in order), set the charge and clear the room behind it
//               door: which door · stack: [x, z] where you stand to set it · time: seconds of setting it (each squadmate
//               stacked with you speeds it up) · fuse: seconds before it blows · guards: { type: count } the room's,
//               at spots: [[x, z]…], caught reeling for `stun` seconds as the world slows for `slow` · opens: doors
//               open once the room is clear (a cell, the way back out) · joins / joinAt: squadmates freed in there
//               breachLine / breachSub: the blast's banner; lines.breach in a chapter (one entry per door) on the comms
// Any objective can set `doors`: how many of the arena's doors are open when it begins (a retry rebuilds them
// shut), and `squad`: the squad's size by then (someone freed on the way joined it).
// Text a kind shows can be renamed per objective: sabotage `consoleName` ('UPLINK'), `doneLine` / `doneSub` (the
// banner when it's done; hold and capture take them too).
// On the big battle maps an objective after the first can have `start`: [x, z, yaw], where a retry of it begins.
// Every objective has `title` (the HUD line), and `say` / `task` per hero: the voice's line and the plain instruction.
// Any field can differ per hero: put the hero's version under `hero: { jedi: {…}, mando: {…} }`.
// `music` (optional) picks the score's cue for it (audio/music.js CUES: defend, infiltrate, duel, chase, battle…);
// by default each kind plays its own (hold: defend, sabotage: infiltrate, duel: duel).

import { REFUGE_SPOTS } from '../world/arenas/refuge.js';
import { PURSUIT_SPOTS } from '../world/arenas/pursuit.js';
import { COVERT_SPOTS } from '../world/arenas/covert.js';
import { BATTLE_MAPS, GRASSLAND_SPOTS, ICEFRONT_SPOTS, GRAVEYARD_SPOTS } from './battlemaps.js';
import { LEVELS } from './levels.js';
import { JUNGLE_SPOTS } from '../world/arenas/jungle.js';
import { GARRISON_SPOTS } from '../world/arenas/garrison.js';
import { FRIGATE_SPOTS } from '../world/arenas/frigate.js';
import { TURNED, PURGE, DRILL } from './allies.js';

export const MISSION_VOICE = { jedi: 'MASTER VAEL', mando: 'THE ARMORER', trooper: 'THE CAPTAIN' };
export const MISSION_COLOR = { jedi: 0x5ad2ff, mando: 0xffa040, trooper: 0x4aa8ff };
// the same words (or value) for every hero: a mission with one story whoever plays it
const all = (v) => ({ jedi: v, mando: v, trooper: v });

export const MISSIONS = {
  refuge: {
    id: 'refuge',
    title: 'THE LAST EVACUATION',
    blurb: 'hold the ramp, slice the uplinks, duel the Inquisitor',   // the line under its card on the menu's MISSIONS list
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
        at: [0, 9], r: 6, time: 60, awayRate: 0.5,
        evacuees: { count: 16, spacing: 1.2, speed: 2.2, name: { jedi: 'YOUNGLINGS', mando: 'FOUNDLINGS' },
                    path: [...REFUGE_SPOTS.path, ...REFUGE_SPOTS.ramp] },
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, officer: 1 }, { grunt: 2, blaster: 1, grenadier: 1 },
                  { grunt: 2, lancer: 1 }, { grunt: 1, duelist: 1, blaster: 1 } ],
        every: [9, 13], cap: 6, from: [-Math.PI + 0.35, -0.35], aggro: 8 },

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
        // the first story duel, so a step gentler than the act III blades (the Long Chase's rematch is the hard one)
        foe: 'acolyte', name: 'THE INQUISITOR', hp: 4, dmg: 1.1, scale: 1.18, tint: 0xa01a22, at: [0, -6],
        duel: { block: 0.72, posture: 160, feint: 0.3, chain: 2, counter: 0.5 },
        rage: 0.55, rageDuel: { feint: 0.45, delay: 0.45, chain: 3, thrust: 0.2 },
        // it breaks off at this much health instead of falling: the Long Chase is where you finish it
        escape: 0.3, escapeLine: { jedi: 'It is wounded, and it saw which way the transports went.', mando: 'Wounded, and gone. It saw which way the transports went.' } },
    ],
    done: { jedi: 'The younglings are safe and the refuge still stands. But the Inquisitor lives, and it will be back.',
            mando: 'The foundlings are safe. The hunter got away. We will see it again.' },
  },

  // THE MANDALORIAN'S STORY (data/campaign-mando.js): the covert's last ship, on the clan's own canyon (world/arenas/covert.js)
  covert: {
    id: 'covert',
    title: 'THE LAST SHIP',
    heroes: ['mando'],   // (the Mandalorian's own story: the covert, its foundlings, VX-7)
    blurb: 'hold the ramp, kill the jammers, duel VX-7',
    level: { name: 'MISSION — THE COVERT', sub: 'The Magistrate has found the covert. One ship is left to carry the foundlings out.',
             arena: 60, floor: 0x8a5a44, fog: 0x6a3428, sky: 0x1a1830, layout: 'covert', waves: [], hazards: {} },
    start: [0, 3, 0],   // in the yard south of the blast wall, looking up at the ship and the line filing aboard
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'hold', title: 'HOLD THE RAMP',
        say: { jedi: 'The clan\'s foundlings are boarding their last ship. Nothing reaches that ramp until it is sealed.',
               mando: 'The foundlings are coming up from the tunnels. Hold the ramp until every one of them is aboard.' },
        task: { jedi: 'Guard the ramp while the foundlings board', mando: 'Guard the ramp while the foundlings board' },
        at: COVERT_SPOTS.hold, r: 6, time: 72, awayRate: 0.5,
        evacuees: { kind: 'foundling', count: 10, spacing: 1.3, speed: 2.2, name: { jedi: 'FOUNDLINGS', mando: 'FOUNDLINGS' },
                    path: [...COVERT_SPOTS.path, ...COVERT_SPOTS.ramp] },
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, officer: 1 }, { grunt: 2, blaster: 1, grenadier: 1 },
                  { grunt: 2, lancer: 1 }, { grunt: 2, blaster: 1, officer: 1 }, { grunt: 1, duelist: 1, blaster: 1 } ],
        every: [9, 14], cap: 7, from: [-Math.PI + 0.35, -0.35], aggro: 8 },

      { kind: 'sabotage', title: 'KILL THE JAMMERS', consoleName: 'JAMMER', doneLine: 'THE JAMMERS ARE DOWN', doneSub: 'The ship can call the clan.', start: [0, 3, Math.PI],
        say: { jedi: 'Three jammers on the canyon floor are keeping the ship from calling for help. Silence them.',
               mando: 'Three jammers on the canyon floor. While they stand, the ship can\'t call the rest of the clan. Kill them.' },
        task: { jedi: 'Stand at each jammer\'s console to slice it', mando: 'Stand at each jammer\'s console to slice it' },
        consoles: [ { at: COVERT_SPOTS.jammers[0], guards: { grunt: 2, blaster: 1 } },
                    { at: COVERT_SPOTS.jammers[1], guards: { lancer: 1, grunt: 2 } },
                    { at: COVERT_SPOTS.jammers[2], guards: { grenadier: 1, blaster: 1, officer: 1 } } ],
        time: 4, r: 2.2, hitLoss: 1.2,
        trickle: { every: 16, cap: 5, group: { grunt: 2, blaster: 1 } } },

      { kind: 'duel', title: 'DEFEAT VX-7', start: [0, 3, Math.PI],
        say: { jedi: 'The Magistrate\'s hunter droid. It is fast, and it reads a blade. Make it commit.',
               mando: 'VX-7. It turns blaster fire and it doesn\'t tire. Get inside its guard and break it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'duelist', name: 'VX-7', kicker: 'BOUNTY · ASSASSIN DROID', hp: 5, dmg: 1.2, scale: 1.12, tint: 0x4a5a6a, at: [0, -6],
        duel: { block: 0.72, posture: 160, feint: 0.3, chain: 2, counter: 0.55 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3, thrust: 0.25 },
        // it breaks off at this much health instead of falling, and takes a foundling with it (the Long Chase finishes it)
        escape: 0.22, escapeScene: 'vx-escape',
        escapeLine: { jedi: 'It is gone, and it has taken a child with it.', mando: 'Gone. And it took Rook.' } },
    ],
    done: { jedi: 'The ship is away with ten foundlings aboard. The droid got away with the eleventh.',
            mando: 'Ten foundlings are safe. VX-7 has Rook. We will get him back.' },
  },

  // THE BURNING ARCHIVE (the Jedi's story, chapter 2): the archive under the temple on fire. Get the archivists out
  // through the hall, cut into the Ledger's vault under the reading dais, and meet the Inquisitor who got there first.
  // The arena is the archive's (world/arenas/archive.js): the dais in the middle, the stacks in two rings, doors south.
  vault: {
    id: 'vault',
    title: 'THE BURNING ARCHIVE',
    blurb: 'get the archivists out, break into the vault, face the Inquisitor',
    story: 'campaign', act: 0, order: 1.5,   // (the Missions page: with the Burning Archive, the Jedi's chapter 2)
    level: { name: 'MISSION — THE BURNING ARCHIVE', sub: 'The archive is burning. The Ledger of Names is in the vault below it.',
             arena: 48, floor: 0x4a4234, fog: 0x2a1a14, sky: 0x1a1010, skyTop: 0x060304, sun: 0xffc890, ember: 0xff8a3a,
             fill: 0.9, sunI: 1.6, fogStart: 0.62, layout: 'archive', waves: [], hazards: {} },
    start: [0, 15, Math.PI],   // in from the south doors, looking north across the hall at the dais
    kit: 1,
    grant: { jedi: ['throw'], mando: ['grapple'] },
    objectives: [
      { kind: 'hold', title: 'GET THE ARCHIVISTS OUT',
        say: { jedi: 'The archivists are coming out of the north stacks with whatever they can carry. Hold the middle of the hall until every one of them reaches the doors.',
               mando: 'Robed folk with their arms full of scrolls, coming through the fire. Hold the hall until they are out.' },
        task: { jedi: 'Hold the hall while the archivists get out', mando: 'Hold the hall while the archivists get out' },
        at: [0, 6], r: 7, time: 60, awayRate: 0.5, unguarded: 'HALL UNGUARDED',
        evacuees: { kind: 'archivist', count: 10, spacing: 1.6, speed: 2.4, ramp: false, verb: 'OUT', name: { jedi: 'ARCHIVISTS', mando: 'ARCHIVISTS' },
                    path: [[-3, -21], [-3, -13], [-12, -6], [-12, 4], [-4, 11], [0, 16], [0, 23]] },
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, grenadier: 1 }, { grunt: 2, blaster: 1, officer: 1 }, { grunt: 1, duelist: 1, blaster: 1 } ],
        every: [10, 15], cap: 6, from: [0.4, Math.PI - 0.4], aggro: 8 },

      { kind: 'sabotage', title: 'BREAK INTO THE VAULT', consoleName: 'VAULT SEAL', consoleDone: 'OPEN', doneLine: 'THE VAULT IS OPEN', doneSub: 'Someone has already been down there.',
        start: [0, 10, Math.PI],
        say: { jedi: 'The vault is under the reading dais. Its seals are on the north and south steps. Cut through both before the fire reaches it.',
               mando: 'There is a vault under that dais. Cut the seals.' },
        task: { jedi: 'Stand at each seal to cut through it', mando: 'Stand at each seal to cut through it' },
        consoles: [ { at: [0, 4.2], guards: { grunt: 2, blaster: 1 } },
                    { at: [0, -4.2], guards: { lancer: 1, grunt: 1, officer: 1 } } ],
        time: 4.5, r: 2.2, hitLoss: 1.2,
        trickle: { every: 15, cap: 4, group: { grunt: 2, blaster: 1 } } },

      { kind: 'duel', title: 'FACE THE INQUISITOR', start: [0, 8, Math.PI],
        say: { jedi: 'It was in the vault before you. It knows how you fight. Do not let it out with the Ledger.',
               mando: 'A Jedi hunter, coming up out of the vault. Close the distance and break it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'acolyte', name: 'THE INQUISITOR', hp: 3.5, dmg: 1.1, scale: 1.18, tint: 0xa01a22, at: [0, -9],
        duel: { block: 0.72, posture: 150, feint: 0.3, chain: 2, counter: 0.5 },
        rage: 0.55, rageDuel: { feint: 0.45, delay: 0.4, chain: 3, thrust: 0.2 },
        // it breaks off: the refuge is where it comes back, and the chase where it ends
        escape: 0.3, escapeLine: { jedi: 'The mask is off. It runs for the refuge.', mando: 'Wounded, and gone into the smoke.' } },
    ],
    done: { jedi: 'The archivists are out, and the vault is open. But somebody got there first.',
            mando: 'The archivists are out. The hunter got away.' },
  },

  // THE EMBER ACADEMY (the Jedi's story, Mustafar): the forge is where Vexis trains the children he has taken. Open their
  // cells, walk them out to the ships up the north lane, and face the academy's overseer, while Vael goes after Vexis
  // himself somewhere in the smoke. It's a trap for Vael (the chapter's words: data/campaign-jedi.js mustafar).
  academy: {
    id: 'academy',
    title: 'THE EMBER ACADEMY',
    blurb: 'open the children\'s cells, get them to the ships, face the overseer',
    story: 'campaign', act: 1, order: 9.5,   // (the Missions page: with the Mustafar chapter)
    level: { ...LEVELS[1], name: 'MISSION — THE EMBER ACADEMY', sub: 'He teaches the children he has taken in the fire. Get them out.', waves: [], hazards: {} },
    start: [0, 17, Math.PI],   // the north lane, looking down the forge floor
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'sabotage', title: 'OPEN THE CELLS', consoleName: 'CELL', consoleDone: 'OPEN', doneLine: 'THE CELLS ARE OPEN', doneSub: 'The children are coming out.',
        say: { jedi: 'Three cell blocks off the forge floor: by the smelter and under the two catwalks. Cut every lock. Mind the channels: the lava rises on a cycle.',
               mando: 'Three cell blocks. Kids inside. Cut every lock, and keep off the channels when they glow.' },
        task: { jedi: 'Stand at each cell block to cut its lock', mando: 'Stand at each cell block to cut its lock' },
        consoles: [ { at: [-13.8, 4.2], guards: { grunt: 2, blaster: 1, acolyte: 1 } },
                    { at: [13.8, -4.2], guards: { grunt: 2, lancer: 1, grenadier: 1 } },
                    { at: [0, -5], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1, flyer: 1 } } },

      { kind: 'hold', title: 'GET THE CHILDREN OUT', music: 'battle', start: [0, 12, Math.PI],
        say: { jedi: 'They are running for the ships at the top of the north lane. Hold the lane until every one of them is aboard.',
               mando: 'Kids running for the ships. Hold the lane until they are all aboard.' },
        task: { jedi: 'Hold the lane while the children reach the ships', mando: 'Hold the lane while the children reach the ships' },
        at: [0, 12], r: 6, time: 50, awayRate: 0.35, unguarded: 'LANE UNGUARDED',
        evacuees: { count: 12, spacing: 1.2, speed: 2.4, ramp: false, verb: 'OUT', name: { jedi: 'CHILDREN', mando: 'CHILDREN' },
                    path: [[0, -9], [0, -1], [-3, 6], [0, 13], [0, 24]] },
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, acolyte: 1 }, { grunt: 2, sniper: 1, blaster: 1 },
                  { grunt: 2, lancer: 1, bomber: 1 }, { grunt: 1, acolyte: 1, officer: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI + 0.3, -0.3], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE OVERSEER', start: [0, 12, Math.PI],
        say: { jedi: 'The overseer who trained them comes out of the smoke. Read the swing, then punish it. I am going after Vexis.',
               mando: 'The one who ran this place. Make it miss, then hit it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'brute', name: 'THE OVERSEER', hp: 3.6, dmg: 1.2, scale: 1.35, tint: 0xff7a1e, at: [0, -12],
        rage: 0.45, trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The children are aboard and the academy is burning. But Vael has gone quiet.',
            mando: 'The kids are out. The academy burns.' },
  },

  // A STRIKE TEAM mission: `squad` squadmates form up beside the hero (allies/squad.js, data/allies.js), and `battle`
  // runs the wider war past the walls (fx/battle.js). The squad shoots the troopers; the duellists are yours.
  strike: {
    id: 'strike',
    title: 'SPEARHEAD',
    blurb: 'lead a strike team through the battle lines',
    // the Grass Sea of Lothal (data/battlemaps.js): up from the landing field, across the ridges, to the outpost's gate
    level: { ...BATTLE_MAPS.grassland.level, name: 'MISSION — THE BATTLE OF THE GRASS SEA',
             sub: 'The Empire holds the grass before its outpost. Break its line and take the gate.' },
    start: GRASSLAND_SPOTS.allyStart,   // the landing field in the north, looking south across the grass
    kit: 8,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 4, battle: true,
    objectives: [
      { kind: 'capture', title: 'BREAK THEIR LINE',
        say: { jedi: 'Your troopers are with you, General. Take their forward posts one by one. Leave the troopers to the squad, and the blades to yourself.',
               mando: 'Your clan rides with you. Take their posts one by one. They\'ll handle the troopers. The blades are yours.' },
        task: { jedi: 'Take the three posts (tap H on one to send the squad there)', mando: 'Take the three posts (tap H on one to send the squad there)' },
        r: 5, time: 9, squadRate: 0.55, perMate: 0.15, postName: 'POST', doneLine: 'THEIR LINE BREAKS', aggro: 9,
        posts: [ { at: GRASSLAND_SPOTS.points.ridge, guards: { grunt: 3, blaster: 2 } },                        // the first ridge
                 { at: GRASSLAND_SPOTS.points.walker, guards: { grunt: 3, blaster: 2, officer: 1, lancer: 1 } },   // under the downed walker
                 { at: GRASSLAND_SPOTS.points.crossroads, guards: { grunt: 2, blaster: 2, grenadier: 1, duelist: 1 } } ],
        trickle: { every: 13, cap: 10, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.35, -0.35] },

      { kind: 'hold', title: 'HOLD THE GATE', music: 'battle',
        say: { jedi: 'Their gate is open and the whole outpost is coming out of it. Hold it until the gunships arrive. If a blade comes for you, put the squad on the gate (H) and meet it.',
               mando: 'The gate\'s ours if we can keep it. Hold it till the gunships come. Put your clan on it (H) when you have to go hunting.' },
        task: { jedi: 'Hold the gate until the gunships arrive', mando: 'Hold the gate until the gunships arrive' },
        at: GRASSLAND_SPOTS.points.gate, r: 7, time: 60, awayRate: 0.25, squadRate: 0.6, overrun: 'RETAKE THE GATE', unguarded: 'GATE UNGUARDED',
        pulses: [ { grunt: 3, blaster: 2 }, { grunt: 2, blaster: 2, officer: 1 }, { grunt: 3, blaster: 1, phalanx: 1 },
                  { grunt: 2, blaster: 2, grenadier: 1 }, { grunt: 2, blaster: 1, acolyte: 1 }, { grunt: 3, blaster: 2, flyer: 1 } ],
        every: [8, 11], cap: 11, from: [-Math.PI + 0.35, -0.35], aggro: 9,
        doneLine: 'THE GUNSHIPS ARE HERE', doneSub: 'The gate is ours. Its warden is coming out.' },

      { kind: 'duel', title: 'DEFEAT THE WARDEN',
        say: { jedi: 'Their commander takes the field himself. Your men will keep his troops off you. He is yours.',
               mando: 'Their commander wants you himself. The clan will keep his troops busy. Take him.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds' },
        // the last duel before the throne in the campaign (SPEARHEAD on Exegol), so one of the toughest
        foe: 'acolyte', name: 'THE WARDEN', hp: 5, dmg: 1.25, scale: 1.2, tint: 0x8a2a1a, at: [0, -28],   // the open grass before the gate
        duel: { block: 0.78, posture: 170, feint: 0.4, chain: 2, counter: 0.6 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.35, chain: 3, thrust: 0.3 },
        trickle: { every: 12, cap: 4, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.35, -0.35],
        hero: { mando: { foe: 'duelist', name: 'THE IRON WARDEN', tint: 0x4a4a52, hp: 6,
                         duel: { block: 0.7, posture: 155, feint: 0.3, chain: 2, counter: 0.5 } } } },
    ],
    done: { jedi: 'The line is broken and the Grass Sea is ours. Your men fought well, General. So did you.',
            mando: 'The ground is ours. The clan stands. This is the Way.' },
  },

  pursuit: {
    id: 'pursuit',
    title: 'THE LONG CHASE',
    blurb: 'run the quarry down before it reaches its ship',
    level: { name: 'MISSION — THE SPACEPORT AT KHEL DAR', sub: 'It knows where the refuge went. Do not let it reach its ship.',
             arena: 56, arenaZ: 320, floor: 0xb49470, fog: 0xd8a878, sky: 0x3a5c92, layout: 'pursuit', waves: [], hazards: {} },
    start: PURSUIT_SPOTS.start,   // the south end of the town, the quarry already running up the market street
    route: PURSUIT_SPOTS.legs,     // the quarry's line through the town, one polyline per pursuit leg
    kit: 8,
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
        clash: { dmg: 0.12, time: 9, every: 16 },
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
        clash: { dmg: 0.12, time: 9, every: 16 },
        shortcuts: PURSUIT_SPOTS.shortcuts[1],
        standoff: [ { at: [4, 83], spots: [[-8, 92], [0, 92], [8, 75], [-2, 75]], group: { grunt: 2, lancer: 1, grenadier: 1, blaster: 1 } } ] },

      { kind: 'duel', quarry: true, title: { jedi: 'DEFEAT THE INQUISITOR', mando: 'BRING IN THE BOUNTY' },
        say: { jedi: 'Its ship is clamped down. Nowhere left to run. Read the blade, not the mask.',
               mando: 'Docking clamps are locked. It has to come through you. Watch the staff, and break its guard.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        // the act III rematch: tougher than the refuge's, but every clash on the run carries into it (and it can't
        // come in with less than 60% of this, game/mission.js)
        hp: 5.5, dmg: 1.3,
        duel: { block: 0.78, posture: 170, feint: 0.45, chain: 3, counter: 0.6 },
        rage: 0.5, rageDuel: { feint: 0.55, delay: 0.35, chain: 3, thrust: 0.3 },
        hero: { mando: { hp: 6.5, duel: { block: 0.72, posture: 160, feint: 0.35, chain: 2, counter: 0.55 } } } },
    ],
    done: { jedi: 'The coordinates die with it. The younglings stay hidden. Well run, and well fought.',
            mando: 'The trail is wiped and the bounty is claimed. The foundlings stay hidden. This is the Way.' },
  },

  // ---- on the battle maps (data/battlemaps.js): a map's level, renamed for the mission, and its SPOTS ----

  // HOTH: a trench defence with the full strike team. Hold the forward line, blow the walker that's shelling it,
  // fall back to the rear trench while the transports launch, then meet what comes over the berm.
  icefront: {
    id: 'icefront',
    title: 'THE TRENCH LINE',
    blurb: 'hold two trench lines and bring down a walker',
    level: { ...BATTLE_MAPS.icefront.level, name: 'MISSION — THE ICE FRONT ON HOTH',
             sub: { jedi: 'The shield generator must stand until the last transport is away.',
                    mando: 'The clan\'s ships are still in the ice hangar. Buy them the time to launch.' } },
    start: ICEFRONT_SPOTS.allyStart,
    kit: 5,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 4, battle: true,
    objectives: [
      { kind: 'hold', title: 'HOLD THE FORWARD TRENCH', music: 'battle',
        say: { jedi: 'Here they come, General. Hold the forward trench. The troopers are the squad\'s; the shields and the brutes are yours.',
               mando: 'They\'re coming over the snow. Hold the forward trench. Your clan takes the troopers; you take the heavies.' },
        task: { jedi: 'Hold the forward trench (H puts the squad on it)', mando: 'Hold the forward trench (H puts the clan on it)' },
        at: [0, 14], r: 7, time: 45, awayRate: 0.3, squadRate: 0.6, holding: 'TRENCH HELD',
        overrun: 'CLEAR THE TRENCH', unguarded: 'TRENCH UNGUARDED', doneLine: 'THE FIRST WAVE BREAKS', doneSub: 'But the walker is still firing.',
        pulses: [ { grunt: 3, blaster: 2 }, { grunt: 2, blaster: 1, phalanx: 1 }, { grunt: 2, blaster: 2, grenadier: 1 },
                  { grunt: 3, officer: 1, sniper: 1 }, { grunt: 2, blaster: 1, brute: 1 }, { grunt: 2, blaster: 2, flyer: 1 } ],
        every: [8, 11], cap: 10, from: [-Math.PI + 0.4, -0.4], aggro: 9 },

      { kind: 'sabotage', title: 'BRING DOWN THE WALKER', start: [0, 18, Math.PI], consoleName: 'CHARGE', doneLine: 'THE WALKER FALLS', doneSub: 'Its guns go quiet.',
        say: { jedi: 'That walker is shelling the trench. Get out to it and set charges on its legs. The squad will cover you.',
               mando: 'The walker\'s guns will level the trench. Fly out and plant charges on it. Don\'t stop to trade shots.' },
        task: { jedi: 'Stand at each leg to set a charge', mando: 'Stand at each leg to set a charge' },
        consoles: [ { at: [16, -16], guards: { grunt: 2, blaster: 1 } },
                    { at: [28, -24], guards: { phalanx: 1, grunt: 1, blaster: 1 } },
                    { at: [17, -27], guards: { grenadier: 1, lancer: 1, blaster: 1 } } ],
        time: 3.5, r: 2.4, hitLoss: 1.0,
        trickle: { every: 14, cap: 8, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'hold', title: 'FALL BACK TO THE REAR TRENCH', music: 'battle', start: [0, 40, Math.PI],
        say: { jedi: 'The transports are launching. Fall back to the rear trench and hold it until the last one clears the shield.',
               mando: 'The ships are lifting. Back to the rear trench. Nothing reaches the hangar till they\'re gone.' },
        task: { jedi: 'Hold the rear trench until the transports are away', mando: 'Hold the rear trench until the ships are away' },
        at: [0, 36], r: 7, time: 45, awayRate: 0.25, squadRate: 0.6, holding: 'TRANSPORTS LAUNCHING',
        overrun: 'CLEAR THE TRENCH', unguarded: 'TRENCH UNGUARDED', doneLine: 'THE LAST TRANSPORT IS AWAY', doneSub: 'Something big is coming through the snow.',
        pulses: [ { grunt: 3, blaster: 2, flyer: 1 }, { grunt: 2, lancer: 1, blaster: 1 }, { grunt: 2, blaster: 2, officer: 1 },
                  { grunt: 2, bomber: 2 }, { grunt: 2, blaster: 1, phalanx: 1, grenadier: 1 }, { grunt: 3, blaster: 1, sniper: 1 } ],
        every: [7, 10], cap: 10, from: [-Math.PI + 0.4, -0.4], aggro: 9 },

      { kind: 'duel', title: 'STOP THE AVALANCHE', start: [0, 34, Math.PI],
        say: { jedi: 'Their siege trooper walks through blaster fire like snow. Your men will hold off the rest. Don\'t trade blows with it: read the swing, then punish it.',
               mando: 'A siege trooper, built like a walker. Rifles won\'t stop it. Keep moving, hit it when it overcommits.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds' },
        foe: 'brute', name: 'THE AVALANCHE', hp: 3.2, dmg: 1.1, scale: 1.3, tint: 0xc8d4e0, at: [0, 22],
        rage: 0.45, trickle: { every: 13, cap: 4, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The transports are clear and the line held. The generator can fall now. It bought what it had to.',
            mando: 'The ships are away and the clan stands. This is the Way.' },
  },

  // JAKKU: a raid with no squad. Pull the cores out of the wrecks before the salvage crews do, then hold the
  // freighter while it warms up, and settle it with the hunter who tracked you there.
  graveyard: {
    id: 'graveyard',
    title: 'SALVAGE RIGHTS',
    blurb: 'raid the wrecks for their cores, hold the freighter',
    level: { ...BATTLE_MAPS.graveyard.level, name: 'MISSION — THE STARSHIP GRAVEYARD OF JAKKU',
             sub: { jedi: 'The cores in these wrecks remember where his ships have been.',
                    mando: 'The cores in these wrecks remember where the beskar went. The Empire wants them first.' } },
    start: GRAVEYARD_SPOTS.allyStart,
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'sabotage', title: 'SALVAGE THE CORES', consoleName: 'CORE', doneLine: 'EVERY CORE RECOVERED', doneSub: 'They know you have them.',
        say: { jedi: 'Four wrecks still hold their navigation cores, and they remember where Vexis\'s ships go. Pull each one before the salvage crews burn them. Mind the snipers on the hulls.',
               mando: 'Four cores, four wrecks, and every one remembers where the Magistrate\'s beskar goes. Pull them before his crews do. Snipers on the high plates: take the high ground or stay low.' },
        task: { jedi: 'Stand at each wreck to pull its core', mando: 'Stand at each wreck to pull its core' },
        consoles: [ { at: GRAVEYARD_SPOTS.points.engine, guards: { grunt: 2, blaster: 2 } },   // (the first core: no sniper yet)
                    { at: [42, 20], guards: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [-10, -31], guards: { grunt: 1, grenadier: 1, blaster: 1, officer: 1 },
                      found: { jedi: ['THE CAPTAIN\'S HOLOCRON', 'The Republic cruiser kept more than its route.'], mando: null } },
                    { at: [26, -54], guards: { phalanx: 1, grunt: 2, sniper: 1 } } ],
        time: 4, r: 2.4, hitLoss: 0.6,
        trickle: { every: 18, cap: 5, group: { grunt: 1, blaster: 1, flyer: 1 } } },

      { kind: 'hold', title: 'HOLD THE FREIGHTER', start: [4, 50, Math.PI],
        say: { jedi: 'The freighter needs a minute to warm its engines. Hold the camp. They will send everything they have left.',
               mando: 'Engines need a minute. Hold the camp till they\'re hot. Everything they\'ve got is coming.' },
        task: { jedi: 'Hold the camp while the freighter warms up', mando: 'Hold the camp while the freighter warms up' },
        at: [4, 46], r: 7, time: 45, awayRate: 0.4, holding: 'ENGINES WARMING',
        overrun: 'CLEAR THE CAMP', unguarded: 'CAMP UNGUARDED', doneLine: 'ENGINES HOT', doneSub: 'One more shadow in the wrecks.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, bomber: 1, blaster: 1 }, { grunt: 2, officer: 1, sniper: 1 },
                  { grunt: 2, lancer: 1, flyer: 1 }, { grunt: 2, blaster: 1, grenadier: 1 }, { grunt: 1, duelist: 1, blaster: 2 } ],
        every: [9, 13], cap: 8, from: [-Math.PI + 0.4, -0.4], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE SALVAGE MASTER', start: [4, 44, Math.PI],
        say: { jedi: 'The hunter who runs these crews has come to take the cores back. Its staff hits from both ends. Watch both.',
               mando: 'Their salvage master wants the cores back. It fights with a staff. Break its guard and it breaks.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'duelist', name: 'THE SALVAGE MASTER', hp: 4.5, dmg: 1.2, scale: 1.18, tint: 0x9a6a3a, at: [2, 34],
        duel: { block: 0.7, posture: 150, feint: 0.4, chain: 2, counter: 0.5 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.4, chain: 3, thrust: 0.25 } },
    ],
    done: { jedi: 'The cores are aboard, and a holocron with them. Every route they remember ends on Mustafar.',
            mando: 'The cores are aboard. Every route ends at the Magistrate\'s forge on Mustafar. This is the Way.' },
  },

  // LOTHAL: an escort, on the far side of the Grass Sea from SPEARHEAD's push. The slicer droid has what it came for
  // inside the outpost; walk it out up the east flank to the landing field, hold the pad until the shuttle is down,
  // then face the shield captain who followed you out.
  grassland: {
    id: 'grassland',
    title: 'THE EXTRACTION',
    blurb: 'walk a slicer droid out under fire, hold the landing pad',
    level: { ...BATTLE_MAPS.grassland.level, name: 'MISSION — THE EAST FLANK OF LOTHAL',
             sub: { jedi: 'The droid carries the outpost\'s prison codes. Get it to the shuttle.',
                    mando: 'The droid carries the outpost\'s cell codes. Get it to the ship.' } },
    start: [52, -42, 0],   // outside the outpost's east wall, just behind the droid, looking north up the flank
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    // who you walk across the field (built like a squadmate: allies/squad.js looks, enemies/mesh.js MODELS)
    escort: { jedi: { model: 'b1', name: 'RX-4', kicker: 'SLICER DROID', color: 0x7f93ae, eye: 0x5ad2ff, scale: 0.9, hp: 320 },
              mando: { model: 'b1', name: 'SCRAP', kicker: 'SLICER DROID', color: 0x9a7a4e, eye: 0xffa040, scale: 0.9, hp: 320 } },
    objectives: [
      { kind: 'escort', title: { jedi: 'ESCORT RX-4', mando: 'ESCORT SCRAP' },
        say: { jedi: 'RX-4 carries the outpost\'s cell codes: no droid, no breakout. It will not walk into blaster fire on its own. Stay close and keep the troops off it. Clear them and it walks on.',
               mando: 'Scrap has the cell codes. No droid, no breakout. It won\'t move if you\'re not with it, and it won\'t move under fire. Keep them off it.' },
        task: { jedi: 'Stay near the droid and keep foes off it', mando: 'Stay near the droid and keep foes off it' },
        path: [[51, -36], [49, -24], [49, -10], [49, 4]],
        speed: 2.6, leash: 15, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [49, -30], group: { grunt: 2, blaster: 2 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [49, -16], group: { grunt: 2, lancer: 1, grenadier: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [49, -2], group: { grunt: 2, blaster: 1, officer: 1, flyer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'escort', title: { jedi: 'ESCORT RX-4', mando: 'ESCORT SCRAP' }, start: [52, 0, 0],
        say: { jedi: 'Up the flank to the landing field. They will throw shields in front of it: break them, or go around.',
               mando: 'Last stretch to the landing field. Shield troopers ahead. Break them or flank them.' },
        task: { jedi: 'Get the droid to the landing field', mando: 'Get the droid to the landing field' },
        path: [[49, 4], [49, 20], [48, 31], [34, 36], [34, 44], [14, 50]],
        speed: 2.4, leash: 15, threat: 6, dps: 4.5, regen: 3, aggro: 7,
        ambush: [ { at: [49, 12], group: { grunt: 2, phalanx: 1, blaster: 1 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [48, 30], group: { grunt: 2, sniper: 1, grenadier: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [34, 42], group: { grunt: 2, bomber: 1, blaster: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 15, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'hold', title: 'HOLD THE LANDING PAD', music: 'defend', start: [10, 46, Math.PI],
        say: { jedi: 'The shuttle is inbound to fly the codes to the breakout team. Hold the pad until it is down. They will come over the sandbags.',
               mando: 'Ship\'s inbound for the codes. Hold the pad till it lands. They\'re coming over the sandbags.' },
        task: { jedi: 'Hold the landing pad until the shuttle lands', mando: 'Hold the landing pad until the ship lands' },
        at: [8, 52], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55, holding: 'SHUTTLE INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE SHUTTLE IS DOWN', doneSub: 'Someone followed you out.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, officer: 1, blaster: 1 }, { grunt: 2, lancer: 1, grenadier: 1 },
                  { grunt: 2, flyer: 1, blaster: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 9, from: [-Math.PI + 0.3, -0.3], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE OUTRIDER', start: [8, 50, Math.PI],
        say: { jedi: 'The outpost sent its outrider after the codes. It closes fast with that lance and lunges from range. Sidestep the charge, then make it pay.',
               mando: 'Their outrider\'s on us. Lance, and a lunge that covers ground. Don\'t stand in its line. Make it miss, then hit it.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds' },
        enter: { jedi: 'Something comes over the sandbags at a run, lance first.', mando: 'Something comes over the sandbags at a run, lance first.' },
        foe: 'lancer', name: 'THE OUTRIDER', hp: 4.5, dmg: 1.15, scale: 1.15, tint: 0x6a7a3a, at: [6, 36],
        duel: { feint: 0.35, chain: 2, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The droid is aboard and the codes with it. The prisoners will walk free. Well done.',
            mando: 'The droid is aboard and the codes with it. The cells open tonight. This is the Way.' },
  },
  // THE LOTHAL BREAKOUT: the same field and droid as the Extraction, the other way round. Walk the slicer droid in to
  // the outpost, open its cell blocks, hold the gate while the prisoners run, and meet the captain who held the keys.
  breakout: {
    id: 'breakout',
    title: 'THE LOTHAL BREAKOUT',
    blurb: 'walk a slicer droid into the outpost, open the cells, hold the gate',
    level: { ...BATTLE_MAPS.grassland.level, name: 'MISSION — THE OUTPOST ON LOTHAL',
             sub: { jedi: 'The Acrobat is in a cell behind that wall. The droid has the codes.',
                    mando: 'The ace is in a cell behind that wall. The droid has the codes.' } },
    start: [49, 14, Math.PI],   // up the east flank, behind the droid, looking south at the outpost
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    escort: { jedi: { model: 'b1', name: 'RX-4', kicker: 'SLICER DROID', color: 0x7f93ae, eye: 0x5ad2ff, scale: 0.9, hp: 320 },
              mando: { model: 'b1', name: 'SCRAP', kicker: 'SLICER DROID', color: 0x9a7a4e, eye: 0xffa040, scale: 0.9, hp: 320 } },
    objectives: [
      { kind: 'escort', title: { jedi: 'GET RX-4 TO THE GATE', mando: 'GET SCRAP TO THE GATE' },
        say: { jedi: 'RX-4 carries the outpost\'s cell codes. It will not walk into blaster fire on its own: stay close, clear the troops, and it walks on. The east gate first.',
               mando: 'Scrap has the cell codes. It won\'t move under fire, so keep them off it. East gate.' },
        task: { jedi: 'Stay near the droid and keep foes off it', mando: 'Stay near the droid and keep foes off it' },
        path: [[49, 10], [49, -6], [48, -20], [47, -36], [22, -38], [20, -46]],
        speed: 2.6, leash: 15, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [49, -4], group: { grunt: 2, blaster: 2 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [48, -22], group: { grunt: 2, lancer: 1, grenadier: 1, phalanx: 1 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [30, -37], group: { grunt: 2, blaster: 1, officer: 1, flyer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'sabotage', title: 'OPEN THE CELL BLOCKS', consoleName: 'CELL BLOCK', consoleDone: 'OPEN', doneLine: 'THE CELLS ARE OPEN', doneSub: 'The prisoners are running for the gate.', start: [20, -44, Math.PI],
        say: { jedi: 'We are in. Three cell blocks, three door panels. Stand at each while RX-4 feeds it the codes.',
               mando: 'Three cell blocks. Stand at each panel while Scrap feeds it the codes. Don\'t let them pull you off it.' },
        task: { jedi: 'Stand at each cell block\'s panel to open it', mando: 'Stand at each cell block\'s panel to open it' },
        consoles: [ { at: [30, -58], guards: { grunt: 2, blaster: 1 } },
                    { at: [-32, -52], guards: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [0, -64], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } } },

      { kind: 'hold', title: 'HOLD THE GATE', music: 'defend', start: [0, -42, 0],
        say: { jedi: 'The prisoners are running for the middle gate. Hold it until the last of them is out. The Acrobat is among them.',
               mando: 'They\'re running for the middle gate. Hold it till the last one\'s out. The ace is in there somewhere.' },
        task: { jedi: 'Hold the gate until every prisoner is out', mando: 'Hold the gate until every prisoner is out' },
        at: [0, -40], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55,
        evacuees: { kind: 'prisoner', count: 14, spacing: 1.5, speed: 3, ramp: false, verb: 'OUT', name: { jedi: 'PRISONERS', mando: 'PRISONERS' },
                    path: [[6, -51], [5, -45], [1, -40], [0, -30], [-2, -16]] },
        overrun: 'CLEAR THE GATE', unguarded: 'GATE UNGUARDED', doneLine: 'EVERY CELL IS EMPTY', doneSub: 'The last one out walked, not ran.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, officer: 1, blaster: 1 }, { grunt: 2, lancer: 1, grenadier: 1 },
                  { grunt: 2, flyer: 1, blaster: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 9, from: [-Math.PI + 0.3, -0.3], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE SHIELD CAPTAIN', start: [0, -38, Math.PI],
        say: { jedi: 'The outpost\'s captain held the keys to those cells, and it wants its prisoners back. It fights behind a riot shield. Go around it, or break it with the Force.',
               mando: 'The captain wants its prisoners back. Riot shield, stun baton. Get behind it, or blow it off its feet.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds' },
        foe: 'phalanx', name: 'THE SHIELD CAPTAIN', hp: 4, dmg: 1.2, scale: 1.22, tint: 0x5a6472, at: [8, -47],
        duel: { posture: 130, feint: 0.3, chain: 2, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The cells are empty and the Acrobat is free. It has not said thank you. It will want to test you instead.',
            mando: 'The cells are empty and the ace is out. It wants a word with whoever came for it. This is the Way.' },
  },
  // THE PENS ON TESSARIL (the Jedi's Act II): the Inquisitors' prison moon, where the children taken off the Ledger's
  // list are held until the ships come. Walk the slicer droid in from the pad, open the three cell blocks, hold the gate
  // while the children run for the ship, then the Warden who keeps them. The breakout's plan on a world of its own.
  pens: {
    id: 'pens',
    title: 'THE PENS ON TESSARIL',
    blurb: 'walk a slicer droid into the prison moon, open the cells, get the children to the ship',
    story: 'campaign', act: 1, order: 4.5,   // (the Missions page: with the Lothal chapter, which the Jedi plays here)
    level: { name: 'MISSION — THE PENS ON TESSARIL', sub: { jedi: 'An Inquisitor prison moon. The children are behind that wall.', mando: 'A prison moon. The kids are behind that wall.' },
             arena: 64, floor: 0x3a3c44, fog: 0x2a3042, sky: 0x05070e, layout: 'pens', waves: [], hazards: {} },
    start: [3, 24, Math.PI],   // on the pad, behind the droid, looking north at the prison
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    escort: { jedi: { model: 'b1', name: 'RX-4', kicker: 'SLICER DROID', color: 0x7f93ae, eye: 0x5ad2ff, scale: 0.9, hp: 320 },
              mando: { model: 'b1', name: 'SCRAP', kicker: 'SLICER DROID', color: 0x9a7a4e, eye: 0xffa040, scale: 0.9, hp: 320 } },
    objectives: [
      { kind: 'escort', title: { jedi: 'GET RX-4 TO THE GATE', mando: 'GET SCRAP TO THE GATE' },
        say: { jedi: 'RX-4 carries the prison\'s cell codes. It will not walk into blaster fire on its own: stay close, clear the guards, and it walks on. Round the rocks to the gate.',
               mando: 'Scrap has the cell codes. It won\'t move under fire, so keep them off it. Round the rocks, then the gate.' },
        task: { jedi: 'Stay near the droid and keep foes off it', mando: 'Stay near the droid and keep foes off it' },
        path: [[0, 20], [-11, 14], [-17, 3], [-12, -6], [0, -9], [0, -15]],
        speed: 2.6, leash: 15, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [-12, 13], group: { grunt: 2, blaster: 2 }, from: [Math.PI - 0.5, Math.PI + 0.4] },
                  { at: [-17, 0], group: { grunt: 2, lancer: 1, grenadier: 1, phalanx: 1 }, from: [Math.PI - 0.3, Math.PI + 0.6] },
                  { at: [-6, -8], group: { grunt: 2, blaster: 1, officer: 1, flyer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [Math.PI - 0.4, Math.PI + 0.5] },

      { kind: 'sabotage', title: 'OPEN THE CELL BLOCKS', consoleName: 'CELL BLOCK', consoleDone: 'OPEN', doneLine: 'THE CELLS ARE OPEN', doneSub: 'The children are coming out.', start: [0, -15, Math.PI],
        say: { jedi: 'We are through the wall. Three cell blocks, three door panels. Stand at each while RX-4 feeds it the codes.',
               mando: 'Three cell blocks. Stand at each panel while Scrap feeds it the codes. Don\'t let them pull you off it.' },
        task: { jedi: 'Stand at each cell block\'s panel to open it', mando: 'Stand at each cell block\'s panel to open it' },
        consoles: [ { at: [-20, -20.6], guards: { grunt: 2, blaster: 1 } },
                    { at: [20, -20.6], guards: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [0, -24.2], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      { kind: 'hold', title: 'HOLD THE GATE', music: 'defend', start: [0, -7, 0],
        say: { jedi: 'The children are running for the ship. Hold the gate until the last of them is past you.',
               mando: 'The kids are running for the ship. Hold the gate till the last one\'s past you.' },
        task: { jedi: 'Hold the gate until every child is out', mando: 'Hold the gate until every child is out' },
        at: [0, -8], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55,
        evacuees: { kind: 'youngling', count: 14, spacing: 1.5, speed: 2.6, ramp: false, verb: 'OUT', name: { jedi: 'CHILDREN', mando: 'CHILDREN' },
                    path: [[0, -23], [0, -16], [0, -9], [-4, -2], [-8, 4]] },   // (out through the gate, toward the ship on the pad)
        overrun: 'CLEAR THE GATE', unguarded: 'GATE UNGUARDED', doneLine: 'EVERY CELL IS EMPTY', doneSub: 'The last of them is running for the ship.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, officer: 1, blaster: 1 }, { grunt: 2, lancer: 1, grenadier: 1 },
                  { grunt: 2, flyer: 1, blaster: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 9, from: [Math.PI * 0.75, Math.PI * 1.15], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE WARDEN', start: [0, -8, Math.PI],
        say: { jedi: 'The Warden of the pens. An Inquisitor who never hunted: it only kept what the others caught. It will not let them go easily.',
               mando: 'The Warden. Red blade, and it thinks those kids are its property. Show it otherwise.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds' },
        enter: { jedi: 'The Warden walks out of the gate, its blade already lit.', mando: 'The Warden comes out of the gate.' },
        line: { jedi: 'Every one of them is on my list. I will have them back.', mando: 'Those are mine.' },
        foe: 'acolyte', form: 'djemso', name: 'THE WARDEN', hp: 4, dmg: 1.1, scale: 1.12, tint: 0x8a2a30, at: [0, -16],
        duel: { posture: 150, feint: 0.3, chain: 2, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The cells on Tessaril are empty, and the ship is full of children. Sera Quill walked out last.',
            mando: 'The cells are empty and the ship is full. This is the Way.' },
  },
  // THE TRIAL OF SERA QUILL (the Jedi's Act II): the trial of the Acrobat, in the yard of the prison moon she was freed from
  'trial-sera': {
    id: 'trial-sera', trial: true, heroes: ['jedi'],
    title: 'TRIAL OF SERA QUILL',
    blurb: 'the master you freed wants to see what you are',
    level: { name: 'TRIAL — THE PENS ON TESSARIL', sub: 'Sera Quill is free, and restless.',
             arena: 64, floor: 0x3a3c44, fog: 0x2a3042, sky: 0x05070e, layout: 'pens', waves: [], hazards: {} },
    start: [0, 6, Math.PI],   // outside the prison wall, in the open ground before the gate
    kit: 5,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: 'KEEP UP WITH SERA', music: 'duel',
        say: 'She strikes from the air and is gone before you answer. Catch the landing, then punish her while she breathes.',
        task: 'Win the trial',
        enter: 'Sera drops off the prison wall and lands without a sound.', kicker: 'TRIAL',
        line: 'Too slow. Again.',
        foe: 'acolyte', form: 'ataru', name: 'SERA QUILL', hp: 4, dmg: 1.0, scale: 1.0, tint: 0x3ad28a, at: [0, -5],
        duel: { feint: 0.4, chain: 3, counter: 0.4 },
        rage: 0.5, rageDuel: { chain: 4, delay: 0.3 } },
    ],
    done: 'Sera laughs for the first time in a year. She will come.',
  },
  // THE LAST LESSON (the Jedi's prologue): the temple dojo on Jedha, the night before the siege. A practice duel with
  // Ilsa Venn, who will open the temple gate to the Empire before morning. Short, low stakes, and it teaches the duel.
  'last-lesson': {
    id: 'last-lesson',
    title: 'THE LAST LESSON',
    campaignOnly: true, heroes: ['jedi'],
    blurb: 'spar with Ilsa the night before the siege',
    level: { name: 'PROLOGUE — THE TEMPLE DOJO', sub: 'Jedha. The night before.',
             arena: 48, floor: 0x6a3020, fog: 0x2a1a14, sky: 0x1a0e0a, layout: 'dojo', waves: [], hazards: {} },
    start: [0, 8, Math.PI],
    kit: 1,
    grant: { jedi: [], mando: [] },
    objectives: [
      { kind: 'duel', title: 'SPAR WITH ILSA', music: 'duel',
        say: 'Training blades, first to yield. Ilsa is faster than you and knows it. Block her chain, then answer when she overreaches.',
        task: 'Win the sparring match',
        enter: 'Ilsa thumbs her training blade to life.', kicker: 'SPARRING',
        line: 'Guard up. You always drop it when you are tired.',
        foe: 'acolyte', form: 'djemso', name: 'ILSA VENN', hp: 2, dmg: 0.45, scale: 1.0, tint: 0x4a7ad2, at: [0, -4],
        duel: { feint: 0.25, chain: 2, counter: 0.3 } },
    ],
    done: 'Ilsa yields, laughing. It is the last time you will hear her laugh for a long while.',
  },
  // RETURN TO JEDHA (the Jedi's Act III): the burned temple at night. Under the dais is an old Sith gate, Vexis's own road
  // to Exegol. Break the Inquisitors' seals on it, hold the dais while it wakes, then face what it shows you.
  'jedha-night': {
    id: 'jedha-night',
    title: 'RETURN TO JEDHA',
    campaignOnly: true, heroes: ['jedi'],
    blurb: 'open the old Sith gate under the burned temple',
    level: { name: 'MISSION — RETURN TO JEDHA', sub: 'The temple, burned and empty. Something under it is awake.',
             arena: 56, floor: 0x3a3440, fog: 0x1a1626, sky: 0x08060e, layout: 'jedhaNight', waves: [], hazards: {} },
    start: [0, 18, Math.PI],   // up the pilgrim steps, looking north at the dais
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    objectives: [
      { kind: 'sabotage', title: 'BREAK THE SEALS', consoleName: 'SEAL', consoleDone: 'BROKEN', doneLine: 'THE SEALS ARE BROKEN', doneSub: 'The dais is opening.', music: 'battle',
        say: 'The Inquisitors left three seals round the dais and a garrison to keep them. Stand at each seal until it breaks.',
        task: 'Stand at each seal to break it',
        consoles: [ { at: [-9, 6], guards: { grunt: 2, blaster: 1 } },
                    { at: [9, 6], guards: { grunt: 2, lancer: 1 } },
                    { at: [0, -10], guards: { phalanx: 1, grunt: 1, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      { kind: 'hold', title: 'HOLD THE DAIS', music: 'defend', holding: 'THE GATE IS WAKING',
        say: 'The gate is waking. Hold the dais until it opens, and keep off the summit while it burns.',
        task: 'Stay by the dais until the gate opens',
        at: [0, 0], r: 7, time: 40, awayRate: 0.35, squadRate: 0.55,
        overrun: 'CLEAR THE DAIS', unguarded: 'DAIS UNGUARDED', doneLine: 'THE GATE IS OPEN', doneSub: 'Something steps out of it.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, lancer: 1, grenadier: 1 }, { grunt: 2, officer: 1, flyer: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI, Math.PI], aggro: 8 },

      { kind: 'duel', title: 'FACE THE ECHO', music: 'duel',
        say: 'The gate shows you something with a blade. It is not real. Its strikes are.',
        task: 'Win the duel',
        enter: 'A shape of violet light steps down from the dais.', kicker: 'THE GATE',
        line: 'You came back to where it started. So did I.',
        foe: 'acolyte', form: 'djemso', name: 'THE ECHO', hp: 4, dmg: 1.15, scale: 1.1, tint: 0x6a4ad2, at: [0, -6],
        duel: { posture: 150, feint: 0.35, chain: 3, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.35, chain: 4 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: 'The echo is gone. The gate under Jedha stands open, and on the other side of it is Exegol.',
  },
  // THE MUSTAFAR FORGE: the forge floor of the second campaign level, broken for good. Charges on its three feeds,
  // hold the lane out while they burn, then the forge's master comes for whoever lit them.
  forge: {
    id: 'forge',
    title: 'THE MUSTAFAR FORGE',
    blurb: 'charge the forge\'s feeds, hold while they burn, face its master',
    level: { ...LEVELS[1], name: 'MISSION — THE MUSTAFAR FORGE', sub: { jedi: 'His war machines are forged here. Break the forge.', mando: 'Our beskar, melted down for his machines. Tear it down.' },
             waves: [], hazards: {} },
    start: [0, 17, Math.PI],   // the north lane, looking down the forge floor at the smelter
    kit: 7,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'sabotage', title: 'CHARGE THE FORGE', consoleName: 'CHARGE', doneLine: 'CHARGES SET', doneSub: 'Now get clear of it.',
        say: { jedi: 'Three feeds carry the ore into the forge: the smelter\'s and the two catwalks\'. Set a charge on each. Mind the channels: the lava rises on a cycle.',
               mando: 'Three feeds into the forge. Charge every one. Keep off the channels when they glow.' },
        task: { jedi: 'Stand at each feed to set a charge', mando: 'Stand at each feed to set a charge' },
        consoles: [ { at: [-13.8, 4.2], guards: { grunt: 2, blaster: 2, duelist: 1 } },
                    { at: [13.8, -4.2], guards: { grunt: 2, lancer: 1, grenadier: 1 } },
                    { at: [0, -5], guards: { phalanx: 1, grunt: 2, officer: 1, bomber: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 14, cap: 7, group: { grunt: 1, blaster: 1, flyer: 1 } } },

      { kind: 'hold', title: 'HOLD THE WAY OUT', music: 'battle', start: [0, 12, Math.PI],
        say: { jedi: 'The charges are burning. Hold the north lane until they blow, and do not let the guard reach them.',
               mando: 'Charges are lit. Hold the lane till they go. Nobody gets near them.' },
        task: { jedi: 'Hold the north lane until the charges blow', mando: 'Hold the north lane until the charges blow' },
        at: [0, 14], r: 6, time: 40, awayRate: 0.35, holding: 'CHARGES BURNING',
        overrun: 'CLEAR THE LANE', unguarded: 'LANE UNGUARDED', doneLine: 'THE FORGE GOES UP', doneSub: 'Every mould on Mustafar is slag.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, brute: 1 }, { grunt: 2, sniper: 1, blaster: 1 },
                  { grunt: 2, lancer: 1, bomber: 1 }, { grunt: 2, duelist: 1, officer: 1 } ],
        every: [8, 12], cap: 9, from: [-Math.PI + 0.3, -0.3], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE FORGEMASTER', start: [0, 12, Math.PI],
        say: { jedi: 'The forge\'s master comes out of the smoke. It is built like the machines it made. Read the swing, then punish it.',
               mando: 'The forgemaster. It melted our beskar with its own hands. Don\'t trade blows. Make it miss, then hit it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'brute', name: 'THE FORGEMASTER', hp: 3.6, dmg: 1.2, scale: 1.35, tint: 0xff7a1e, at: [0, -12],
        rage: 0.45, trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The forge is ash. But it fell too easily. This was never his army.',
            mando: 'The forge is ash, and it was too easy. This was bait.' },
  },
  // THE NIGHT OF THE ORDER: the ARC trooper's prologue (testing), eight years before the campaign. A jungle firebase at
  // night; the order has come, the company has turned, and the trooper and two brothers who refused it get their
  // wounded General out. Campaign only (the trooper's first chapter, data/campaign.js); one voice for every hero, so a
  // co-op partner of any kind hears the same story. The foes wear the turned company's armour (`foeLook`).
  order66: {
    id: 'order66',
    title: 'THE NIGHT OF THE ORDER',
    campaignOnly: true,
    blurb: 'get the General out when the company turns',
    level: { name: 'MISSION — THE NIGHT OF THE ORDER', sub: all('Eight years ago. The order came at midnight.'),
             arena: 76, floor: 0x34442a, fog: 0x18302a, sky: 0x070c18, layout: 'jungle', waves: [], hazards: {} },
    start: JUNGLE_SPOTS.start,   // the ruin's courtyard, where the General fell back, looking south at the firebase
    kit: 2,
    grant: all([]),
    squad: 2, squadCap: 2,       // VANT and BRISK: the two who refused it with you (and no more: the trooper's run tops up to its own size)
    foeLook: TURNED,
    escort: all({ model: 'officer', name: 'GENERAL KAST', kicker: 'JEDI · WOUNDED', color: 0x8a7458, eye: 0x5ad2ff, cloth: 0x5a4030, hp: 360 }),   // General Rhenna Kast: the Knight of the Jedi's Hoth chapter, years later
    objectives: [
      { kind: 'sabotage', title: 'CUT THE COMPANY\'S COMMS', consoleName: 'RELAY', consoleDone: 'CUT',
        doneLine: 'THE RELAYS ARE DOWN', doneSub: 'No gunship will find the General tonight.', music: 'battle',
        say: all('They turned on the General mid-sentence, brother. Our own company. Their relays are calling the gunships down on that ruin. Cut both.'),
        task: all('Stand at each relay console to cut it'),
        consoles: [ { at: JUNGLE_SPOTS.relays[0], guards: { blaster: 3 } },
                    { at: JUNGLE_SPOTS.relays[1], guards: { blaster: 2, grenadier: 1 } } ],
        time: 4, r: 2.4, hitLoss: 1.0,
        trickle: { every: 15, cap: 6, group: { blaster: 2 } } },

      { kind: 'escort', title: 'GET THE GENERAL OUT', start: [-11, 4, 0],
        say: all('The General can walk, barely. North through the trees to the landing zone. It will not walk into fire, so clear the way.'),
        task: all('Stay near the General and keep the company off it'),
        path: JUNGLE_SPOTS.walk,
        speed: 2.2, leash: 14, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [-14, 12], group: { blaster: 2, grenadier: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [-4, 19], group: { blaster: 2, sniper: 1 }, from: [-0.6, 0.6] },
                  { at: [2, 22], group: { blaster: 2, officer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 6, group: { blaster: 1, grenadier: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'hold', title: 'HOLD THE LANDING ZONE', music: 'defend', start: [6, 24, Math.PI],
        say: all('A friend with a fast ship owes me a favour, and it is coming in dark. Hold the pad until it is down. They know where we are now.'),
        task: all('Hold the landing zone until the ship is down'),
        at: [8, 26], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55, holding: 'SHIP INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE SHIP IS DOWN', doneSub: 'And someone walks out of the trees.',
        pulses: [ { blaster: 3 }, { blaster: 2, grenadier: 1 }, { blaster: 2, officer: 1 }, { blaster: 2, sniper: 1 }, { blaster: 3, grenadier: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI + 0.2, -0.2], aggro: 8 },

      { kind: 'duel', title: 'FACE THE MARSHAL', start: [6, 24, Math.PI],
        say: all('The Marshal. Same batch, same tank, same instructors. He is the one who gave the order to fire. Put him down, or at least make him run.'),
        task: all('Beat the Marshal while the squad holds the pad'),
        enter: all('The company falls back. One of them keeps walking.'),
        foe: 'officer', name: 'THE MARSHAL', kicker: 'COMMANDER · YOUR BATCH', hp: 4, dmg: 1.1, scale: 1.12, tint: 0x9a7a2a, at: JUNGLE_SPOTS.duel,
        line: all('Good soldiers follow orders, brother. You were the best of us.'),
        rage: 0.5, rageDuel: {},
        // he breaks off instead of falling: the trooper's campaign is where it ends
        escape: 0.3, escapeLine: all('He falls back into the trees. He will be back.'), escapeScene: 'marshal-escape',
        trickle: { every: 14, cap: 3, group: { blaster: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: all('The General is aboard, and the three of us with it. Nobody is coming to save the clones who refused. So we save each other. Starting tonight.'),
  },

  // ---------------- THE ARC TROOPER'S OWN STORY (data/campaign-trooper.js): campaign only, one voice for every hero ----------------
  // THE KILL HOUSE: the band's cover on the Vorran yards is blown and Brisk was taken in the raid. The Captain sends
  // you and Vant through the garrison block for him, door by door.
  killhouse: {
    id: 'killhouse',
    title: 'THE KILL HOUSE',
    campaignOnly: true,
    blurb: 'breach the garrison block, room by room, and bring Brisk out',
    level: { name: 'MISSION — THE KILL HOUSE', sub: all('The garrison block at the yards. Brisk is in there.'),
             arena: 60, floor: 0x4a4e52, fog: 0x1e242a, sky: 0x080a10, layout: 'garrison', waves: [], hazards: {} },
    start: GARRISON_SPOTS.start,
    kit: 3,
    grant: all([]),
    squad: 1, squadCap: 1,     // Vant goes in with you; Brisk joins when his cell is open
    foeLook: PURGE,
    objectives: [
      { kind: 'capture', title: 'TAKE THE YARD', music: 'battle', postName: 'FRONT',
        say: all('The yard first. Purge troopers on the door and a pair on the towers. Clear the front so we can stack up on it.'),
        task: all('Take the front of the block'),
        posts: [ { at: [-12, -4], guards: { grunt: 2, blaster: 2, sniper: 1 } } ],
        r: 4.5, time: 4, squadRate: 0.6, perMate: 0.3, doneLine: 'THE FRONT IS OURS', doneSub: 'Stack up on the door.',
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7] },
      { kind: 'breach', title: 'BREACH THE GUARD ROOM', start: [-14, -5, 0], doors: 0,
        say: all('Stack up on the door, Vant on your shoulder. Charge on the lock, then in fast. They will not see straight for a second. Use it.'),
        task: all('Stand at the door to set the charge, then clear the room'),
        door: 0, stack: GARRISON_SPOTS.stack[0], time: 2.4, fuse: 1.1, stun: 1.5,
        guards: { grunt: 2, blaster: 2 }, spots: GARRISON_SPOTS.rooms[0].spots, breachLine: 'BREACH', breachSub: 'Go, go, go.' },
      { kind: 'breach', title: 'BREACH THE INTERROGATION HALL', start: [-13, 7, Math.PI / 2], doors: 1,
        say: all('Next door, east wall. Same drill. Short bursts in there, brother; Brisk could be behind any of them.'),
        task: all('Stack up on the next door and clear the hall'),
        door: 1, stack: GARRISON_SPOTS.stack[1], time: 2.2, fuse: 1.0, stun: 1.4,
        guards: { blaster: 2, grunt: 2, officer: 1 }, spots: GARRISON_SPOTS.rooms[1].spots },
      { kind: 'breach', title: 'BREACH THE CELLS', start: [1, 7, Math.PI / 2], doors: 2,
        say: all('The cells are through there. They will have heard us coming, so they will be ready. So are we.'),
        task: all('Breach the cells and get Brisk out'),
        door: 2, stack: GARRISON_SPOTS.stack[2], time: 2.2, fuse: 1.0, stun: 1.1,
        guards: { grunt: 2, blaster: 2, grenadier: 1, officer: 1 }, spots: GARRISON_SPOTS.rooms[2].spots,
        opens: 5, joins: 1, joinAt: GARRISON_SPOTS.cell, doneLine: 'BRISK IS OUT', doneSub: 'He has opinions about the food.' },
      { kind: 'hold', title: 'HOLD FOR THE GUNSHIP', music: 'defend', start: [-12, -10, Math.PI], doors: 5, squad: 2,
        say: all('Tally is bringing the gunship in over the yard, and the garrison is waking up behind us. Hold the pad.'),
        task: all('Hold the landing pad until the gunship is down'),
        at: GARRISON_SPOTS.pad, r: 6.5, time: 40, awayRate: 0.35, squadRate: 0.55, holding: 'GUNSHIP INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE GUNSHIP IS DOWN', doneSub: 'Everyone aboard.',
        pulses: [ { grunt: 2, blaster: 1 }, { blaster: 2, grenadier: 1 }, { grunt: 3, officer: 1 }, { blaster: 2, sniper: 1 }, { grunt: 2, blaster: 2 } ],
        every: [8, 12], cap: 8, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8], aggro: 8 },
    ],
    done: all('Brisk is aboard and the yards are behind us. They knew our faces, brother. Somebody gave them our names.'),
  },

  // WHAT THE CHIP SAYS: the HALCYON, the medical frigate that fitted the clones' chips, adrift in the Vorran system.
  // Its records core still holds every chip's file, yours and the Marshal's. The Marshal wants it wiped; so does the Empire.
  chipfiles: {
    id: 'chipfiles',
    title: 'WHAT THE CHIP SAYS',
    campaignOnly: true,
    blurb: 'restore a dead frigate\'s power and pull the chip files before the purge troopers wipe them',
    level: { name: 'MISSION — WHAT THE CHIP SAYS', sub: all('The HALCYON. Every chip it fitted, it remembers.'),
             arena: 56, floor: 0x8a8e92, fog: 0x1a1e26, sky: 0x020308, layout: 'frigate', waves: [], hazards: {} },
    start: FRIGATE_SPOTS.start,
    kit: 4,
    grant: all([]),
    squad: 2, squadCap: 2,
    foeLook: PURGE,
    objectives: [
      { kind: 'sabotage', title: 'RESTORE POWER', consoleName: 'BREAKER', consoleDone: 'ON', music: 'infiltrate',
        doneLine: 'POWER RESTORED', doneSub: 'The records core is waking up.',
        say: all('The core is dead. Two breakers on the side walls bring it back. And we are not alone on this ship: there is a purge shuttle on the other airlock.'),
        task: all('Stand at each breaker to throw it'),
        consoles: [ { at: FRIGATE_SPOTS.breakers[0], guards: { grunt: 2, blaster: 1 } },
                    { at: FRIGATE_SPOTS.breakers[1], guards: { blaster: 2, grenadier: 1 } } ],
        time: 4, r: 2.6, hitLoss: 1.0,
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.6, Math.PI / 2 + 0.6] },
      { kind: 'hold', title: 'PULL THE CHIP FILES', music: 'defend', start: [0, 4, 0],
        say: all('Download running. Every clone it ever fitted, every chip, every order. Stay by the core; they will be coming to wipe it.'),
        task: all('Hold the records core until the download is done'),
        at: FRIGATE_SPOTS.core, r: 6, time: 50, awayRate: 0.3, squadRate: 0.55, holding: 'DOWNLOADING',
        overrun: 'CLEAR THE CORE', unguarded: 'CORE UNGUARDED', doneLine: 'THE FILES ARE OURS', doneSub: 'Yours. Vant\'s. Brisk\'s. And his.',
        pulses: [ { grunt: 2, blaster: 1 }, { blaster: 2, grenadier: 1 }, { grunt: 2, officer: 1 }, { blaster: 2, sniper: 1 }, { grunt: 3, blaster: 1 } ],
        every: [8, 12], cap: 8, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9], aggro: 8 },
      { kind: 'duel', title: 'STOP THE PURGE CAPTAIN', start: [0, 2, 0],
        say: all('Their captain is going for the core with a wipe spike. He is the Marshal\'s own man. Put him down before he reaches it.'),
        task: all('Beat the purge captain while the squad holds the deck'),
        enter: all('The boarding party falls back. Their captain walks through them.'),
        foe: 'officer', name: 'CAPTAIN VORN', kicker: 'PURGE CAPTAIN · THE MARSHAL\'S OWN', hp: 3.5, dmg: 1.05, scale: 1.1, tint: 0x8a1a1a, at: [0, 18],
        line: all('The Marshal sends his regards, deserter. He says your chip was a factory fault.'),
        rage: 0.5, rageDuel: {},
        trickle: { every: 14, cap: 3, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.6, Math.PI / 2 + 0.6] },
    ],
    done: all('The files are ours. Your chip never failed, brother. Somebody switched it off, the night before the order. And the Marshal\'s was switched on.'),
  },

  // BROTHERS IN ARMS: the trooper's trial. The Captain runs a live drill on the HALCYON's empty decks, stun settings
  // on the old training droids: take the posts with the squad, then hold the last of them.
  drill: {
    id: 'drill', trial: true,
    title: 'BROTHERS IN ARMS',
    campaignOnly: true,
    blurb: 'the Captain\'s drill: take the posts with your squad',
    level: { name: 'TRIAL — BROTHERS IN ARMS', sub: all('The HALCYON\'s decks, after. The Captain has set up a drill.'),
             arena: 56, floor: 0x8a8e92, fog: 0x1a1e26, sky: 0x020308, layout: 'frigate', waves: [], hazards: {} },
    start: FRIGATE_SPOTS.start,
    kit: 4,
    grant: all([]),
    squad: 2, squadCap: 2,
    foeLook: DRILL,
    objectives: [
      { kind: 'capture', title: 'TAKE THE POSTS', music: 'battle', postName: 'POST',
        say: all('Three posts, three teams of droids. I do not want to see you take them alone. Send Vant and Brisk onto each one, and cover them while they hold it.'),
        task: all('Take each post: send the squad onto it (H) and cover them'),
        posts: [ { at: FRIGATE_SPOTS.hangar, guards: { blaster: 3 } },
                 { at: FRIGATE_SPOTS.aisle, guards: { blaster: 2, grenadier: 1 } },
                 { at: FRIGATE_SPOTS.gallery, guards: { blaster: 2, sniper: 1 } } ],
        r: 4.5, time: 6, squadRate: 0.8, perMate: 0.4, doneLine: 'EVERY POST TAKEN', doneSub: 'Not bad. Again, harder.',
        trickle: { every: 12, cap: 6, group: { blaster: 2 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8], aggro: 9 },
      { kind: 'hold', title: 'HOLD THE GALLERY', music: 'defend', start: [0, 14, 0],
        say: all('Now hold it. Put the squad on the gallery and work the flanks yourself. A line holds because everyone in it trusts the next man.'),
        task: all('Hold the gallery with the squad until the drill ends'),
        at: FRIGATE_SPOTS.gallery, r: 6, time: 35, awayRate: 0.3, squadRate: 0.7, holding: 'DRILL CLOCK',
        overrun: 'RETAKE THE GALLERY', unguarded: 'GALLERY UNGUARDED', doneLine: 'DRILL COMPLETE', doneSub: 'The Captain is almost smiling.',
        pulses: [ { blaster: 3 }, { blaster: 2, grenadier: 1 }, { blaster: 2, officer: 1 }, { blaster: 3, sniper: 1 } ],
        every: [7, 10], cap: 8, from: [-Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9], aggro: 8 },
    ],
    done: all('That is a squad. Now we go and find out who switched your chip off, and why.'),
  },

  // TRIALS: the campaign's quiet one-on-ones between the battles (data/campaign.js). A master tests the hero before
  // teaching its form; for the Mando, a rival of the old clans. Stand-ins for now: built from today's duellists until the
  // seven forms' gatekeepers land, on the arenas their chapters borrow. `trial` keeps them off the Missions list until
  // the campaign has reached them.
  'trial-wall': {
    id: 'trial-wall', trial: true,
    title: { jedi: 'TRIAL OF THE WALL', mando: 'THE CHALLENGE' },
    blurb: 'a master tests you before it lets the younglings go',
    level: { name: 'TRIAL — THE HIDDEN REFUGE', sub: { jedi: 'The refuge\'s keeper has a question, and it asks with a blade.',
                                                     mando: 'A hunter of the old clans waits at the covert door.' },
             arena: 64, floor: 0x8a8478, fog: 0xa89098, sky: 0x2c3c66, layout: 'refuge', waves: [], hazards: {} },
    start: [0, 2, Math.PI],
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: { jedi: 'PASS THE WALL', mando: 'ANSWER THE CHALLENGE' }, music: 'duel',
        say: { jedi: 'The Wall barely strikes. It waits for you to tire. Push its guard open, and do not swing yourself empty.',
               mando: 'It will let you come to it. Don\'t. Make it move, then make it pay.' },
        task: { jedi: 'Win the trial', mando: 'Win the challenge' },
        enter: { jedi: 'The keeper of the refuge steps into the light.', mando: 'The challenger draws.' }, kicker: 'TRIAL',
        line: { jedi: 'Show me you can hold a door.', mando: 'By the old custom.' },
        foe: 'acolyte', form: 'soresu', name: 'THE WALL', hp: 4, dmg: 0.9, scale: 1.12, tint: 0x3a7ad2, at: [0, -6],   // a Soresu master (data/duel.js FORM_DUEL)
        duel: { block: 0.9, posture: 200, feint: 0.15, chain: 1, counter: 0.35 },
        rage: 0.4, rageDuel: { chain: 2, counter: 0.5 },
        hero: { mando: { foe: 'duelist', form: null, name: 'THE CHALLENGER', tint: 0x7a5a3a, line: 'By the old custom.' } } },
    ],
    done: { jedi: 'The Wall steps aside. The younglings are yours to keep now.',
            mando: 'The challenge is answered. The foundlings follow you now. This is the Way.' },
  },

  'trial-acrobat': {
    id: 'trial-acrobat', trial: true,
    title: { jedi: 'TRIAL OF THE ACROBAT', mando: 'THE JET ACE' },
    blurb: 'the master you freed wants to see what you are',
    level: { name: 'TRIAL — THE PRISON YARD ON LOTHAL', sub: { jedi: 'The Acrobat is free, and restless.', mando: 'The ace is free, and wants a word.' },
             arena: 52, floor: 0x6a6e72, fog: 0xc8c4a0, sky: 0x3e6aa8, layout: 'prison', waves: [], hazards: {} },
    start: [0, 16, Math.PI],
    kit: 5,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: { jedi: 'KEEP UP WITH THE ACROBAT', mando: 'GROUND THE ACE' }, music: 'duel',
        say: { jedi: 'It strikes from the air and is gone before you answer. Catch the landing, then punish it while it breathes.',
               mando: 'Fast, and it knows it. Let it come in, then don\'t let it leave.' },
        task: { jedi: 'Win the trial', mando: 'Win the fight' },
        enter: { jedi: 'Something drops off the guard tower and lands without a sound.', mando: 'The ace drops in from the guard walk.' }, kicker: 'TRIAL',
        line: { jedi: 'Too slow. Again.', mando: 'Let\'s see the armour move.' },
        foe: 'acolyte', form: 'ataru', name: 'THE ACROBAT', hp: 4, dmg: 1.0, scale: 1.0, tint: 0x3ad28a, at: [0, -6],   // an Ataru master
        duel: { feint: 0.4, chain: 3, counter: 0.4 },
        rage: 0.5, rageDuel: { chain: 4, delay: 0.3 },
        hero: { mando: { foe: 'lancer', form: null, name: 'THE JET ACE', tint: 0xd2a03a } } },
    ],
    done: { jedi: 'The Acrobat laughs for the first time in a year. It will come.',
            mando: 'The ace is with us. This is the Way.' },
  },

  'trial-knight': {
    id: 'trial-knight', trial: true,
    title: { jedi: 'TRIAL OF THE KNIGHT', mando: 'THE CLAN CHAMPION' },
    blurb: 'a general tests you blade to blade',
    level: { name: 'TRIAL — THE LAST HANGAR ON HOTH', sub: { jedi: 'The line held. The Knight is waiting.', mando: 'The champion is waiting.' },
             arena: 48, floor: 0x8a98aa, fog: 0x3a4658, sky: 0x0e1218, layout: 'hangar', waves: [], hazards: {} },
    start: [0, 14, Math.PI],
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: { jedi: 'MATCH THE KNIGHT', mando: 'BEST THE CHAMPION' }, music: 'duel',
        say: { jedi: 'It meets every careless block with a riposte. Parry, don\'t block, and answer it in kind.',
               mando: 'Beskar like yours, and it hits harder. Keep your distance until it overreaches.' },
        task: { jedi: 'Win the trial', mando: 'Win the fight' },
        enter: { jedi: 'The Knight walks out past the last transport.', mando: 'The champion steps out past the last transport.' }, kicker: 'TRIAL',
        line: { jedi: 'Show me what you learned out there.', mando: 'Beskar to beskar.' },
        foe: 'acolyte', form: 'djemso', name: 'THE KNIGHT', hp: 5, dmg: 1.15, scale: 1.15, tint: 0xd2b23a, at: [0, -8],   // a Djem So master
        duel: { block: 0.75, posture: 160, feint: 0.3, chain: 2, counter: 0.7 },
        rage: 0.45, rageDuel: { chain: 3, counter: 0.8 },
        hero: { mando: { foe: 'duelist', form: null, name: 'THE CLAN CHAMPION', tint: 0x6a7a8a } } },
    ],
    done: { jedi: 'The Knight sheathes its blade. Where you go now, it goes too.',
            mando: 'The champion stands with you. The clan is whole again. This is the Way.' },
  },
};

// SPEARHEAD ON THE ROAD TO THE CITADEL (the campaign's chapter 12): the Grass Sea battle's plan and fight, laid on
// Exegol's ash (BATTLE_WORLDS.approach) and told in the last act's words. Campaign only: the Missions list keeps the
// Grass Sea one.
{
  const S = MISSIONS.strike, sayAt = (i, say) => ({ ...S.objectives[i], say });
  MISSIONS['strike-exegol'] = { ...S, id: 'strike-exegol', campaignOnly: true,
    level: { ...S.level, layout: 'approach', name: 'MISSION — THE ROAD TO THE CITADEL',
             sub: 'His last army holds the road to the Citadel. Break its line and take the gate.' },
    objectives: [
      sayAt(0, { jedi: 'Every master you found is with you, and the troopers who held Hoth. Take their forward posts one by one. Leave the troopers to the squad, and the blades to yourself.',
                 mando: 'The whole clan rides with you. Take their posts one by one. They\'ll handle the troopers. The blades are yours.' }),
      sayAt(1, { jedi: 'The Citadel\'s gate is open and his army is pouring out of it. Hold it until the gunships come. If a blade comes for you, put the squad on the gate (H) and meet it.',
                 mando: 'The Citadel gate\'s ours if we can keep it. Hold it till the gunships come. Put your clan on it (H) when you have to go hunting.' }),
      sayAt(2, { jedi: 'The gate\'s warden comes out to meet you. Your men will keep its troops off you. It is yours. Vexis is behind it.',
                 mando: 'The warden of the gate wants you himself. The clan will keep his troops busy. The Magistrate is behind him.' }),
    ],
    done: { jedi: 'The road is open and the gate is ours. Vexis is waiting inside.',
            mando: 'The gate is down. The Magistrate is inside. This is the Way.' } };
}
