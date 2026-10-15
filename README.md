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
  data/              tuning tables: config, stances, enemies, levels, bosses, mando, skills, store, mastery, boons, mutators, difficulty, worlds (arena looks)
  engine/            renderer + post-processing, graphics quality, input, camera
  audio/             mixer + voice builder (engine.js), sound bank (sfx.js), adaptive per-world score (music.js), loops + ambience (director.js)
  fx/                particles, floating text, VFX lights, saber trail, one-shot VFX, ambient embers
  player/            hero swap, movement, damage, updatePlayer (update.js), animation
    model/           hero models: rig + sockets, outfit slots (jedi.js, mando.js), weapons, render styles, looks
    jedi/            stances, focus, saber combat, Force powers, Judgement FX
    mando/           weapons, gadgets, darksaber
  enemies/           meshes, elites, special moves, spawning, damage, AI, attack turns (director.js), blaster bolts
  boss/              boss lightning FX and the boss itself
  world/             arena builder, arenas/ (temple, foundry, plains layouts), Ink bake, painted skies/floors, backdrops, atmosphere, collision, hazards (see docs/world-guidelines.md)
  game/              level/wave flow, survival mode, progression, boons, end-of-run summary
  ui/                banners, threat markers, HUD, store overlay, menus, controls (How to Play data)
```

Each file starts with a one-line description. Balance changes usually only touch `src/data/`.

**Shared state.** Objects like `G`, `player`, `CFG` and the entity arrays are exported and mutated in place from any file. A few values get *reassigned* during play (`boss`, `saberProj`, `levelPhase`, `phaseT`, `arenaGroup`, `arenaHalf`, the audio context, …). ES module imports are read-only, so those live on the `shared` object in `src/state.js` and are used as `shared.boss`, `shared.levelPhase`, and so on. (The name `shared` was picked because `state` is already used as a local variable inside the music code.) A new variable that other files need to reassign belongs there too.

**Load order.** Module top-level code runs once at startup in the order `src/main.js` imports it, which matches the order of the original single file. Keep new top-level code to declarations where possible and do setup in functions.

**Adding an ability:** add its function (under `player/jedi/` or `player/mando/`), a HUD slot (`#ab-*` in `index.html`; powers go in `#abilities`, basic moves in `#basics`), a keybind (`engine/input.js`), a How to Play row (`ui/controls.js`), a store/auto-unlock entry (`data/store.js`), and a HUD cooldown row (`ui/hud.js`).

**Changing the heroes' look:** everything a character creator would change lives in `src/player/model/appearance.js` as plain data: outfit variant per slot, colours, build (bulk, shoulders, head) and the Mando's glowing seams. New outfit pieces are a function under a slot in `jedi.js` / `mando.js`; new weapons are an entry in `weapons.js` (its `grip` decides how it's held). Preview with `npm run dev` and open `/tools/model-lab.html`, which lines both heroes up in key poses (`?look=hooded` shows a sample alternate look; `?style=shard|forged` shows the other render styles).

**Changing sounds:** every sound is synthesized. One-shots are recipes in the `S` bank in `src/audio/sfx.js` (a few layered tones and noise bursts each); most take a world position so they pan and fade with distance. Continuous sounds (saber hums, jetpack, flamethrower, each world's ambience) live in `src/audio/director.js`, and each world's score (key, tempo, chords, melody, drum kit) is a palette in `src/audio/music.js`. Audition all of it with `npm run dev` and `/tools/sound-lab.html`.

**Changing progression:** between waves there are two currencies with one job each. XP buys abilities (`data/store.js`: auto-unlocks, fork pairs, finals) and mastery ranks that upgrade abilities you own (`data/mastery.js`); in survival it also buys the repeatable powers. Skill points, one per wave cleared, buy training (`data/skills.js`). Ability code reads its tuning through `abil(id)`, so a mastery rank is just a multiplier or bonus on a field of the ability's `CFG.abilities` / `MANDO` entry. To check prices against what a campaign pays out, run `npm run dev` and open `/tools/progression-lab.html`.

**Live tweaking:** `window.GAME` in the browser console exposes the config tables and most game functions.

## Features

**Two playable heroes:**
- **Jedi** — three lightsaber stances (Ataru / Niman / Djem So), parry & riposte combat, Force powers (Push, Pull, Slam, Repulse, Judgement, Barrier, Saber Throw, Mend), a Force Focus flow meter that rewards aggressive play
- **Mandalorian** — jetpack flight with momentum/boost/dive/hover, dual blasters + disruptor rifle + darksaber, flamethrower, wrist rockets, whistling birds, grappling hook, jetpack missile, gauntlet shield

**Campaign** — 3 authored arenas on the road to the Sith (Holy City of Jedha, Mustafar Forge, Throne of Exegol), 4 waves each escalating to an end-boss (Darth Vexis for the Jedi, The Iron Magistrate for the Mando)

**Survival mode** — unlocked after beating the campaign as both heroes. Endless escalating waves, 8 wave mutators, Warbringer mid-boss every 10 waves, arena rotation, repeatable power-ups, roguelite boon picks each wave

**9 enemy types** — grunts, blaster troopers, staff duelists, brutes, jet troopers, shield sentinels, saboteur bombers, snipers (with laser-sight telegraph), and the Warbringer mid-boss with a leap-slam attack

**Combat depth:**
- Directional saber swings tied to WASD movement
- Timed parry window into a riposte counter-attack
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
- Built with the assistance of [Claude Code](https://claude.ai/code)
## License

Copyright (c) 2026 Caleb Zinabu. All rights reserved. See [LICENSE](LICENSE) for details.
