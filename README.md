# POWER TRIP

A Star Wars-inspired third-person action game built with [Three.js](https://threejs.org/). No frameworks, no asset files: procedural meshes, synthesized audio, and adaptive music. The source is split into small modules by system, and the build still produces one self-contained HTML file.

## Play

Needs [Node.js](https://nodejs.org/) 22 or newer.

```sh
npm install        # once
npm run dev        # play at the printed localhost URL; reloads instantly as you edit
npm run build      # writes dist/index.html, one self-contained file you can double-click or share
```

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
  data/              tuning tables: config, stances, enemies, levels, bosses, mando, skills, store, boons, mutators, difficulty
  engine/            renderer + post-processing, graphics quality, input, camera
  audio/             sound effects, adaptive music
  fx/                particles, floating text, VFX lights, saber trail, one-shot VFX, ambient embers
  player/            hero swap, movement, damage, updatePlayer (update.js), animation
    model/           hero models: rig + sockets, outfit slots (jedi.js, mando.js), weapons, render styles, looks
    jedi/            stances, focus, saber combat, Force powers, Judgement FX
    mando/           weapons, gadgets, darksaber
  enemies/           meshes, elites, special moves, spawning, damage, AI, blaster bolts
  boss/              boss lightning FX and the boss itself
  world/             textures, collision, hazards, arena builder, arenas/ (temple, foundry, plains)
  game/              level/wave flow, survival mode, progression, boons, end-of-run summary
  ui/                banners, threat markers, HUD, store overlay, menus, controls (How to Play data)
```

Each file starts with a one-line description. Balance changes usually only touch `src/data/`.

**Shared state.** Objects like `G`, `player`, `CFG` and the entity arrays are exported and mutated in place from any file. A few values get *reassigned* during play (`boss`, `saberProj`, `levelPhase`, `phaseT`, `arenaGroup`, `arenaHalf`, the audio context, …). ES module imports are read-only, so those live on the `shared` object in `src/state.js` and are used as `shared.boss`, `shared.levelPhase`, and so on. (The name `shared` was picked because `state` is already used as a local variable inside the music code.) A new variable that other files need to reassign belongs there too.

**Load order.** Module top-level code runs once at startup in the order `src/main.js` imports it, which matches the order of the original single file. Keep new top-level code to declarations where possible and do setup in functions.

**Adding an ability:** add its function (under `player/jedi/` or `player/mando/`), a HUD slot (`#ab-*` in `index.html`; powers go in `#abilities`, basic moves in `#basics`), a keybind (`engine/input.js`), a How to Play row (`ui/controls.js`), a store/auto-unlock entry (`data/store.js`), and a HUD cooldown row (`ui/hud.js`).

**Changing the heroes' look:** everything a character creator would change lives in `src/player/model/appearance.js` as plain data: outfit variant per slot, colours, build (bulk, shoulders, head) and the Mando's glowing seams. New outfit pieces are a function under a slot in `jedi.js` / `mando.js`; new weapons are an entry in `weapons.js` (its `grip` decides how it's held). Preview with `npm run dev` and open `/tools/model-lab.html`, which lines both heroes up in key poses (`?look=hooded` shows a sample alternate look; `?style=shard|forged` shows the other render styles).

**Live tweaking:** `window.GAME` in the browser console exposes the config tables and most game functions.

## Features

**Two playable heroes:**
- **Jedi** — three lightsaber stances (Ataru / Niman / Djem So), parry & riposte combat, Force powers (Push, Pull, Slam, Repulse, Judgement, Barrier, Saber Throw, Mend), a Force Focus flow meter that rewards aggressive play
- **Mandalorian** — jetpack flight with momentum/boost/dive/hover, dual blasters + disruptor rifle + darksaber, flamethrower, wrist rockets, whistling birds, grappling hook, jetpack missile, gauntlet shield

**Campaign** — 3 authored arenas (Temple Steps, Foundry Assault, The Scarred Plain), 4 waves each escalating to an end-boss (Darth Vexis for the Jedi, The Iron Magistrate for the Mando)

**Survival mode** — unlocked after beating the campaign as both heroes. Endless escalating waves, 8 wave mutators, Warbringer mid-boss every 10 waves, arena rotation, repeatable power-ups, roguelite boon picks each wave

**9 enemy types** — grunts, blaster troopers, staff duelists, brutes, jet troopers, shield sentinels, saboteur bombers, snipers (with laser-sight telegraph), and the Warbringer mid-boss with a leap-slam attack

**Combat depth:**
- Directional saber swings tied to WASD movement
- Timed parry window into a riposte counter-attack
- Per-stance Force synergy (fast = snappy casts, medium = efficient guard, strong = powerful but costly)
- Bolt deflection and aimed reflection
- Headshot system for blasters
- Kill streaks, XP economy, and a between-wave upgrade store

**Polish:**
- Procedural adaptive music (builds from ambient pad to full percussion based on combat intensity)
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
- Built with the assistance of [Claude Code](https://claude.ai/code)
## License

Copyright (c) 2026 Caleb Zinabu. All rights reserved. See [LICENSE](LICENSE) for details.
