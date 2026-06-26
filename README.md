# POWER TRIP

A Star Wars-inspired third-person action game built entirely in a single HTML file using [Three.js](https://threejs.org/). No build tools, no frameworks, no asset files — just one self-contained file with procedural meshes, synthesized audio, and adaptive music.

## Play

Open `sw_power_trip_1.8.html` in any modern browser. No install required.

## Features

**Two playable heroes:**
- **Jedi** — three lightsaber stances (Shii-Cho / Niman / Djem So), parry & riposte combat, Force powers (Push, Pull, Slam, Repulse, Judgement, Barrier, Saber Throw, Mend), a Force Focus flow meter that rewards aggressive play
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

- **Three.js** (r160) via CDN importmap
- **EffectComposer** + UnrealBloomPass for glow
- **Web Audio API** for all sound (procedural synthesis — no audio files)
- Single `<script type="module">` — everything in one file

## License

Copyright (c) 2026 Caleb Zinabu. All rights reserved. See [LICENSE](LICENSE) for details.
