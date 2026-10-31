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
// Text a kind shows can be renamed per objective: sabotage `consoleName` ('UPLINK'), `doneLine` / `doneSub` (the
// banner when it's done; hold and capture take them too).
// On the big battle maps an objective after the first can have `start`: [x, z, yaw], where a retry of it begins.
// Every objective has `title` (the HUD line), and `say` / `task` per hero: the voice's line and the plain instruction.
// Any field can differ per hero: put the hero's version under `hero: { jedi: {…}, mando: {…} }`.
// `music` (optional) picks the score's cue for it (audio/music.js CUES: defend, infiltrate, duel, chase, battle…);
// by default each kind plays its own (hold: defend, sabotage: infiltrate, duel: duel).

import { REFUGE_SPOTS } from '../world/arenas/refuge.js';
import { PURSUIT_SPOTS } from '../world/arenas/pursuit.js';
import { BATTLE_MAPS, GRASSLAND_SPOTS, ICEFRONT_SPOTS, GRAVEYARD_SPOTS } from './battlemaps.js';
import { LEVELS } from './levels.js';

export const MISSION_VOICE = { jedi: 'THE BATTLEMASTER', mando: 'THE ARMORER', trooper: 'THE CAPTAIN' };
export const MISSION_COLOR = { jedi: 0x5ad2ff, mando: 0xffa040, trooper: 0x4aa8ff };

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
        time: 4.5, r: 2.4, hitLoss: 0.8,
        trickle: { every: 18, cap: 6, group: { grunt: 1, blaster: 1, flyer: 1 } } },

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
