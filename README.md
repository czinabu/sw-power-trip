# POWER TRIP

A Star Wars-inspired third-person action game built with [Three.js](https://threejs.org/). No frameworks, no asset files: procedural meshes, synthesized audio, and adaptive music. The source is split into small modules by system, and the build still produces one self-contained HTML file.

## Play

Needs [Node.js](https://nodejs.org/) 22 or newer.

```sh
npm install        # once
npm run dev        # play at the printed localhost URL; reloads instantly as you edit
npm run build      # writes dist/index.html, one self-contained file you can double-click or share
npm run smoke      # after a build: plays both heroes headlessly for a short fight, fails on any error
```

Every pull request runs the build and the smoke test automatically (`.github/workflows/check.yml`); a red check means the game failed to build or threw an error mid-fight. The first run needs the test browser once: `npx playwright install chromium`.

Opening `index.html` directly does not work (browsers block module imports from `file://`); use `npm run dev`, or open the built `dist/index.html`.

The old single-file versions (0.1 to 2.9) are kept in `archive/` for reference and still open with a double-click.

## Project layout

```
index.html           HUD and menu markup; loads styles/ and src/main.js
styles/              base.css, hud.css, menus.css, store.css
src/
  main.js            imports every module in load order, runs the main loop, exposes window.GAME
  state.js           G (run state), player, entity arrays, keys, and `shared` (values that get reassigned)
  utils.js           math helpers
  data/              tuning tables: config, movement, stances, enemies, levels, bosses, mando, skills, store, mastery, boons, mutators, difficulty, worlds (arena looks)
  engine/            renderer + post-processing, graphics quality, input, camera
  audio/             mixer + voice builder (engine.js), sound bank (sfx.js), adaptive orchestral score with hero themes and mission cues (music.js), loops + ambience (director.js)
  fx/                particles, floating text, VFX lights, saber trail, one-shot VFX, ambient embers
  player/            hero swap, movement, parkour, damage, updatePlayer (update.js), animation
    model/           hero models: rig + sockets, outfit slots (jedi.js, mando.js), weapons, render styles, looks
    jedi/            stances, focus, saber combat, Force powers, Judgement FX
    mando/           weapons, gadgets, darksaber
  enemies/           meshes, elites, special moves, spawning, damage, AI, pathing (nav.js), attack turns (director.js), blaster bolts (see docs/enemy-ai.md)
  boss/              boss lightning FX and the boss itself
  world/             arena builder, arenas/ (temple, foundry, plains layouts; hall and forge for training; refuge for the story mission), Ink bake, painted skies/floors, backdrops, atmosphere, collision, hazards (see docs/world-guidelines.md)
  game/              level/wave flow, survival mode, training (tutorial.js), story missions (mission.js, objectives.js), progression, boons, end-of-run summary
  ui/                banners, threat markers, HUD, store overlay, menus, the title screen's hero turntable (showcase.js), controls (How to Play data)
```

Each file starts with a one-line description. Balance changes usually only touch `src/data/`.

**Shared state.** Objects like `G`, `player`, `CFG` and the entity arrays are exported and mutated in place from any file. A few values get *reassigned* during play (`boss`, `saberProj`, `levelPhase`, `phaseT`, `arenaGroup`, `arenaHalf`, the audio context, …). ES module imports are read-only, so those live on the `shared` object in `src/state.js` and are used as `shared.boss`, `shared.levelPhase`, and so on. (The name `shared` was picked because `state` is already used as a local variable inside the music code.) A new variable that other files need to reassign belongs there too.

**Load order.** Module top-level code runs once at startup in the order `src/main.js` imports it, which matches the order of the original single file. Keep new top-level code to declarations where possible and do setup in functions.

**Adding an ability:** add its function (under `player/jedi/` or `player/mando/`), a HUD slot (`#ab-*` in `index.html`; powers go in `#abilities`, basic moves in `#basics`), a keybind (`engine/input.js`), a How to Play row (`ui/controls.js`), a store/auto-unlock entry (`data/store.js`), and a HUD cooldown row (`ui/hud.js`).

**Changing the heroes' look:** everything a character creator would change lives in `src/player/model/appearance.js` as plain data: outfit variant per slot, colours, build (bulk, shoulders, head) and the Mando's glowing seams. New outfit pieces are a function under a slot in `jedi.js` / `mando.js`: `k.add()` hangs a rigid piece (armour, boots, a belt) on one joint, and `k.skin()` lays one continuous skinned surface over a run of joints (trousers over hip and knee, a sleeve over shoulder and elbow, the torso from pelvis to collar) so cloth and suits bend at the joints instead of showing a seam (`skin.js`), and `k.cloth()` hangs a piece of simulated cloth from a joint (the robe panels and cape hem; `cloth.js`); new weapons are an entry in `weapons.js` (its `grip` decides how it's held). Preview with `npm run dev` and open `/tools/model-lab.html`, which lines both heroes up in key poses (`?look=hooded` shows a sample alternate look; `?style=shard|forged` shows the other render styles).

**Changing sounds:** every sound is synthesized. One-shots are recipes in the `S` bank in `src/audio/sfx.js` (a few layered tones and noise bursts each); most take a world position so they pan and fade with distance. Continuous sounds (saber hums, jetpack, flamethrower, each world's ambience) live in `src/audio/director.js`, and each world's score (key, tempo, chords, melody, drum kit) is a palette in `src/audio/music.js`. Audition all of it with `npm run dev` and `/tools/sound-lab.html`.

**Changing progression:** between waves there are two currencies with one job each. XP buys abilities (`data/store.js`: auto-unlocks, fork pairs, finals) and mastery ranks that upgrade abilities you own (`data/mastery.js`); in survival it also buys the repeatable powers. Skill points, one per wave cleared, buy training (`data/skills.js`). Ability code reads its tuning through `abil(id)`, so a mastery rank is just a multiplier or bonus on a field of the ability's `CFG.abilities` / `MANDO` entry. To check prices against what a campaign pays out, run `npm run dev` and open `/tools/progression-lab.html`.

**Changing movement and combat feel:** grounded movement and parkour (air control, fall weight, landing stagger and roll, mantle/vault reach, ledge hang, wall-run, sprint and slide, turn rate and pivots) the gait (step length, foot lift, hip bob, acceleration lean; `GAIT`) and standing footwork (when a foot steps; `FOOTING`) are tuned in `src/data/movement.js`; the code lives in `src/player/parkour.js` and `locomotion.js`. The run and jump are shaped by motion capture (`src/data/mocap.js`, made by `tools/mocap/convert.mjs`; `?mocap=0` turns it off; see docs/animation-guidelines.md). Parry/block strictness, swing arcs, lunge reach, hit flinch, perfect dodge, blade clashes and lock-on are in `CFG.player` (`src/data/config.js`); lock-on lives in `src/player/lockon.js`. How sword-armed foes duel back (guards, posture, feints, delayed strikes, strings, counters, saber locks) and the Mandalorian's close-quarters kit are tuned in `src/data/duel.js`; the code is `src/enemies/duel.js` and `src/player/mando/melee.js` (see docs/enemy-ai.md).

**Changing the tutorial:** each hero's lessons are data in `src/data/tutorial.js`: the teacher's line, the keys, what counts as done (a move that worked, a spot to reach, foes to beat) and what to set up. A lesson counts moves the game reports through `src/game/tutor-bus.js` (`tutEvent('parry')` and so on), so a new kind of lesson needs one `tutEvent` call where that move succeeds. The same file holds the one-line drills shown when a new ability unlocks in a real run.

**Live tweaking:** `window.GAME` in the browser console exposes the config tables and most game functions.

## Features

**Two playable heroes:**
- **Jedi** — three lightsaber stances (Ataru / Niman / Djem So), parry & riposte combat, Force powers (Push, Pull, Slam, Repulse, Judgement, Barrier, Saber Throw, Mend), a Force Focus flow meter that rewards aggressive play
- **Mandalorian** — jetpack flight with momentum/boost/dive/hover, dual blasters + disruptor rifle + darksaber, flamethrower, wrist rockets, whistling birds, grappling hook, jetpack missile, gauntlet shield, and a close-quarters kit on E (jab, cross, knee, vibroblade string; shield and blade behind the gauntlet shield; vambrace catch; jet charge; dive kick; takedowns)

**Training** — a short tutorial for each hero in its own place (the Jedi training hall, the Armorer's forge). The Battlemaster or the Armorer teaches the starting kit one move at a time, and each lesson only passes when the move actually works. New abilities earned later get a one-line drill when they unlock.

**Campaign** — 3 authored arenas on the road to the Sith (Holy City of Jedha, Mustafar Forge, Throne of Exegol), 4 waves each escalating to an end-boss (Darth Vexis for the Jedi, The Iron Magistrate for the Mando)

**Story (experimental, under EXTRAS on the menu)** — The Last Evacuation, a mission at a hidden mountain refuge in three objectives: guard the transport's ramp while the younglings (or foundlings) file aboard (officers call in the reinforcements, so drop them first), the transport lifts off, slice three Imperial uplinks, then a one-on-one duel with the Inquisitor. Dying restarts the objective you fell on. Missions are data (`data/missions.js`) built from reusable objective pieces (`game/objectives.js`: zones, consoles, timers, the objective HUD line).

**Survival mode** — unlocked after beating the campaign as both heroes. Endless escalating waves, 8 wave mutators, Warbringer mid-boss every 10 waves, arena rotation, repeatable power-ups, roguelite boon picks each wave

**10 enemy types** — grunts, blaster troopers, staff duelists, Sith acolytes (saber duellists), brutes, jet troopers, shield sentinels, saboteur bombers, snipers (with laser-sight telegraph), and the Warbringer mid-boss with a leap-slam attack

**Combat depth:**
- Directional saber swings tied to WASD movement
- Timed parry window into a riposte counter-attack
- Duellists that fight back, Jedi Academy style: they hold a guard on one line (cut in on another), feint, hold strikes, string cuts, counter a blocked blow, and bind blades in a saber lock; kicks and heavy blows break their posture
- Per-stance Force synergy (fast = snappy casts, medium = efficient guard, strong = powerful but costly)
- Bolt deflection and aimed reflection
- Headshot system for blasters
- Kill streaks, XP economy, and a between-wave upgrade screen: ability forks, two mastery ranks per ability, and tiered training

**Polish:**
- Procedural adaptive score with its own key, tempo and instruments per world (Jedha, Mustafar, Exegol), building from a pad to full percussion and boss brass with the fight, plus stings for waves, clears, unlocks and bosses
- Synthesized, positional sound design: lightsaber hums per form, blaster fire, saber burns and clashes, explosions, per-world ambience and reverb, with separate music and effects volume
- Difficulty selector (Padawan / Knight / Master)
- Directional damage indicators and off-screen threat markers
- Diegetic jetpack fuel gauge (LED strips on the pack)
- Hit markers, screen flash, hitstop, camera shake, slow-mo beats
- Run summary with score tracking and localStorage leaderboard

## Controls

### Jedi
| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look |
| LMB | Saber combo (direction follows WASD) |
| RMB | Block / Parry (timed click) |
| Space | Jump / Hold for Force Leap |
| Shift | Dash-flip |
| 1/2/3 | Switch stance |
| F | Force Push |
| C | Force Pull |
| E | Kick |

### Mandalorian
| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look / Aim |
| LMB | Fire weapon |
| RMB | Brace (shield with single blaster) |
| Space | Jetpack thrust |
| Shift | Boost (air) / Dodge (ground) |
| 1/2/3 | Switch weapon |
| R | Vent heat |
| E | Gauntlet punch |
| Z | Jetpack missile |

**M** toggle music | **P** cycle graphics quality

## Tech

- **Three.js** (r160, pinned) from npm
- **EffectComposer** + UnrealBloomPass for glow
- **Web Audio API** for all sound (procedural synthesis — no audio files)
- **Vite** for the dev server and build, with `vite-plugin-singlefile` to inline everything into one HTML file
- Motion capture: the data used in this project was obtained from [mocap.cs.cmu.edu](http://mocap.cs.cmu.edu). The database was created with funding from NSF EIA-0196217.
- Built with the assistance of [Claude Code](https://claude.ai/code)
## License

Copyright (c) 2026 Caleb Zinabu. All rights reserved. See [LICENSE](LICENSE) for details.
