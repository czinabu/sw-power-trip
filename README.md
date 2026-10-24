# POWER TRIP

A Star Wars-inspired third-person action game built with [Three.js](https://threejs.org/). No frameworks, no asset files: procedural meshes, synthesized audio, and adaptive music. The source is split into small modules by system, and the build still produces one self-contained HTML file.

## Play

Needs [Node.js](https://nodejs.org/) 22 or newer.

```sh
npm install        # once
npm run dev        # play at the printed localhost URL; reloads instantly as you edit
npm run build      # writes dist/index.html, one self-contained file you can double-click or share
npm run smoke      # after a build: plays both heroes headlessly for a short fight, fails on any error
npm run smoke:maps # after a build: a short fight on each battle map (sandbox and survival), and what each one costs to draw
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
  data/              tuning tables: config, movement, stances, enemies, levels, bosses, mando, skills, store, mastery, boons, mutators, difficulty, worlds (arena looks), sandbox, battlemaps, allies (the squad and revive rules)
  engine/            renderer + post-processing, graphics quality, input, camera
  audio/             mixer + voice builder (engine.js), sound bank (sfx.js), adaptive orchestral score with hero themes and mission cues (music.js), loops + ambience (director.js)
  fx/                particles, floating text, VFX lights, saber trail, one-shot VFX, ambient embers, the wider battle past a mission's edge (battle.js)
  player/            hero swap, movement, parkour, damage, updatePlayer (update.js), animation
    model/           hero models: rig + sockets, outfit slots (jedi.js, mando.js), weapons, render styles, looks
    jedi/            stances, focus, saber combat, blade-on-blade clashes (clash.js), Force powers, Judgement FX
    mando/           weapons, gadgets, darksaber
  enemies/           meshes, elites, special moves, spawning, damage, AI, pathing (nav.js), attack turns (director.js), blaster bolts (see docs/enemy-ai.md)
  allies/            the hero's strike team: squadmates, orders, who they shoot and who shoots them (squad.js)
  boss/              boss lightning FX and the boss itself
  net/               online co-op: room-code connection over WebRTC (session.js), the partner's hero (partner.js) and pose sync (pose.js); see below
  world/             arena builder, arenas/ (temple, foundry, plains layouts; hall and forge for training; refuge and pursuit for the story missions; dojo and throne for the sandbox; grassland, icefront and graveyard, the battle maps, with field.js for their shared pieces), Ink bake, painted skies/floors, backdrops, atmosphere, collision, hazards (see docs/world-guidelines.md)
  game/              level/wave flow, survival mode, training (tutorial.js), story missions (mission.js, objectives.js), the sandbox (sandbox.js), progression, boons, end-of-run summary
  ui/                banners, threat markers, HUD, store overlay, menus, the sandbox panel (sandbox-ui.js), the title screen's hero turntable (showcase.js), controls (How to Play data)
```

Each file starts with a one-line description. Balance changes usually only touch `src/data/`.

**Shared state.** Objects like `G`, `player`, `CFG` and the entity arrays are exported and mutated in place from any file. A few values get *reassigned* during play (`boss`, `saberProj`, `levelPhase`, `phaseT`, `arenaGroup`, `arenaHalf`, the audio context, …). ES module imports are read-only, so those live on the `shared` object in `src/state.js` and are used as `shared.boss`, `shared.levelPhase`, and so on. (The name `shared` was picked because `state` is already used as a local variable inside the music code.) A new variable that other files need to reassign belongs there too.

**Load order.** Module top-level code runs once at startup in the order `src/main.js` imports it, which matches the order of the original single file. Keep new top-level code to declarations where possible and do setup in functions.

**Adding an ability:** add its function (under `player/jedi/` or `player/mando/`), a HUD slot (`#ab-*` in `index.html`; powers go in `#abilities`, basic moves in `#basics`), a keybind (`engine/input.js`), a How to Play row (`ui/controls.js`), a store/auto-unlock entry (`data/store.js`), and a HUD cooldown row (`ui/hud.js`).

**Changing the heroes' look:** the menu's CUSTOMIZE screen (`src/ui/customizer.js`) offers the rows and options listed in `src/data/customize.js` (skin, hair, robes, helmet, armour colours…); each option is a partial look, and the player's picks are saved in localStorage and rebuild the hero when they press DONE. Everything a look can change lives in `src/player/model/appearance.js` as plain data: outfit variant per slot, colours, build (bulk, shoulders, head) and the Mando's glowing seams. New outfit pieces are a function under a slot in `jedi.js` / `mando.js`: `k.add()` hangs a rigid piece (armour, boots, a belt) on one joint, and `k.skin()` lays one continuous skinned surface over a run of joints (trousers over hip and knee, a sleeve over shoulder and elbow, the torso from pelvis to collar) so cloth and suits bend at the joints instead of showing a seam (`skin.js`), and `k.cloth()` hangs a piece of simulated cloth from a joint (the robe panels and cape hem; `cloth.js`); new weapons are an entry in `weapons.js` (its `grip` decides how it's held). Preview with `npm run dev` and open `/tools/model-lab.html`, which lines both heroes up in key poses (`?look=hooded` shows a sample alternate look; `?style=shard|forged` shows the other render styles).

**Changing sounds:** every sound is synthesized. One-shots are recipes in the `S` bank in `src/audio/sfx.js` (a few layered tones and noise bursts each); most take a world position so they pan and fade with distance. Continuous sounds (saber hums, jetpack, flamethrower, each world's ambience) live in `src/audio/director.js`, and each world's score (key, tempo, chords, melody, drum kit) is a palette in `src/audio/music.js`. Audition all of it with `npm run dev` and `/tools/sound-lab.html`.

**Changing progression:** between waves there are two currencies with one job each. XP buys abilities (`data/store.js`: auto-unlocks, fork pairs, finals) and mastery ranks that upgrade abilities you own (`data/mastery.js`); in survival it also buys the repeatable powers. Skill points, one per wave cleared, buy training (`data/skills.js`). Ability code reads its tuning through `abil(id)`, so a mastery rank is just a multiplier or bonus on a field of the ability's `CFG.abilities` / `MANDO` entry. To check prices against what a campaign pays out, run `npm run dev` and open `/tools/progression-lab.html`.

**Changing movement and combat feel:** grounded movement and parkour (air control, fall weight, landing stagger and roll, mantle/vault reach, ledge hang, wall-run, sprint and slide, turn rate and pivots) the gait (step length, foot lift, hip bob, acceleration lean; `GAIT`) and standing footwork (when a foot steps; `FOOTING`) are tuned in `src/data/movement.js`; the code lives in `src/player/parkour.js` and `locomotion.js`. The run and jump are shaped by motion capture (`src/data/mocap.js`, made by `tools/mocap/convert.mjs`; `?mocap=0` turns it off; see docs/animation-guidelines.md). Parry/block strictness, swing arcs, lunge reach, hit flinch, perfect dodge, blade clashes and lock-on are in `CFG.player` (`src/data/config.js`); lock-on lives in `src/player/lockon.js`. How sword-armed foes duel back (guards, posture, feints, delayed strikes, strings, counters, saber locks) and the Mandalorian's close-quarters kit are tuned in `src/data/duel.js`; the code is `src/enemies/duel.js` and `src/player/mando/melee.js` (see docs/enemy-ai.md).

**Changing the tutorial:** each hero's lessons are data in `src/data/tutorial.js`: the teacher's line, the keys, what counts as done (a move that worked, a spot to reach, foes to beat) and what to set up. A lesson counts moves the game reports through `src/game/tutor-bus.js` (`tutEvent('parry')` and so on), so a new kind of lesson needs one `tutEvent` call where that move succeeds. The same file holds the one-line drills shown when a new ability unlocks in a real run.

**Live tweaking:** `window.GAME` in the browser console exposes the config tables and most game functions.

## Features

**Two playable heroes:**
- **Jedi** — three lightsaber stances (Ataru / Niman / Djem So), parry & riposte combat, Force powers (Push, Pull, Slam, Repulse, Judgement, Barrier, Saber Throw, Mend), a Force Focus flow meter that rewards aggressive play, and a holster toggle (4) to clip the saber to the belt and fight with the Force alone (both hands cast every power, palm strikes and a burst on LMB, a Force ward on RMB, Force powers 20% stronger and faster Force regen)
- **Mandalorian** — jetpack flight with momentum/boost/dive/hover, dual blasters + disruptor rifle + darksaber, flamethrower, wrist rockets, whistling birds, grappling hook, jetpack missile, gauntlet shield, and a close-quarters kit on E (jab, cross, knee, vibroblade string; shield and blade behind the gauntlet shield; vambrace catch; jet charge; dive kick; takedowns), and a holster toggle (4) to put the weapon away and fight from a boxer's stance with fists and gadgets (LMB or E swings hook, hook, uppercut, haymaker; RMB raises the gauntlet shield; faster gadget power regen)

**Training** — a short tutorial for each hero in its own place (the Jedi training hall, the Armorer's forge). The Battlemaster or the Armorer teaches the starting kit one move at a time, and each lesson only passes when the move actually works. New abilities earned later get a one-line drill when they unlock.

**Sandbox** — unlocks on the menu once the campaign has been beaten with either hero. The Jedi train in the temple's indoor training room (a wide duelling mat with ring inlays, wood-panelled walls, viewing benches and the Jedi crest), the Mandalorian in the palace throne room at Sundari (dark green walls of tall chamfered windows, a stepped dais and the throne before its glowing orange panel); either way there are no waves and no clock. Press **B** for the panel: call in any enemy type (one, three or five at a time, optionally all elite or as standing dummies), the Warbringer or your hero's end-boss, switch any ability on or off (powers that share a key are a pair, one at a time), clear the floor, heal, or turn on god mode. Each hero's last kit is remembered. The lists live in `data/sandbox.js`.

**Campaign** — 3 authored arenas on the road to the Sith (Holy City of Jedha, Mustafar Forge, Throne of Exegol), 4 waves each escalating to an end-boss (Darth Vexis for the Jedi, The Iron Magistrate for the Mando)

**Missions** — pick **MISSIONS** on the menu's mode row and a list of every story mission opens under it: pick one (each card names its place and shows which heroes have won it) and BEGIN, or double-click it. The menu keeps the last one picked.

**The Last Evacuation** — a mission at a hidden mountain refuge in three objectives: guard the transport's ramp while the younglings (or foundlings) file aboard (officers call in the reinforcements, so drop them first), the transport lifts off, slice three Imperial uplinks, then a one-on-one duel with the Inquisitor. Dying restarts the objective you fell on.

**The Long Chase** runs down a fleeing quarry (an Inquisitor for the Jedi, an assassin droid bounty for the Mando) through the spaceport at Khel Dar: one long, narrow street that snakes through a sandstone port town to the docking bay. Keep it in sight (lose it for six seconds and it gets away), cross the market stalls, alley fence, terraces and causeway gaps with the parkour flow, get past the troops it calls out of the doorways, then duel it when it's cornered at its ship. Four times it stops to cut through a sealed way while a squad holds you off, and it runs on once they're down. Catch it on open ground and it turns to fight until you've hurt it, then breaks away; those wounds carry into the final duel. The run has a checkpoint at the plaza.

Missions are data (`data/missions.js`: hold, sabotage, capture, escort, pursuit and duel objectives; the battle-map missions reuse a map's level and its SPOTS) built from reusable objective pieces (`game/objectives.js`: zones, consoles, timers, the objective HUD line). An arena can be long instead of square (`arenaZ` in its level: the pursuit route is 56 × 320); bounds, enemy pathing, the shadow box and the sky all follow it.

**Spearhead** is a large-battle mission with a strike team of four at your back: clone troopers for the Jedi, Mandalorians for the Mando. It is fought across the Grass Sea of Lothal, one of the battle maps: push from the landing field and take three posts (the first ridge, the downed walker, the crossroads), hold the Imperial outpost's gate while the whole garrison comes out of it, then duel the Warden in the grass before it. On a battle map, reinforcements and the wider battle's fire come in around the fight instead of from the far edge. **H** orders the squad to hold the spot under the crosshair, and H again brings them back on you.

**The Trench Line** (Hoth, the Ice Front, with the strike team): hold the forward trench, go out into the snow and set charges on the walker that's shelling it, fall back and hold the rear trench while the transports launch, then stop the Avalanche, a siege trooper champion, while the squad holds off the rest.

**Salvage Rights** (Jakku, the Starship Graveyard, alone): pull the navigation cores out of four wrecks (snipers on the hull plates, a core inside the Imperial yard), hold the scavenger camp while the freighter's engines warm up, then duel the Salvage Master.

**The Extraction** (Lothal, up the Grass Sea's east flank, with two squadmates): an escort. Walk a slicer droid out of the outpost and up the flank to the landing field: it only walks while you're near it and nothing is on it, and troops sent at it pin it down and wear it away (lose it and the leg restarts). Then hold the landing pad until the shuttle is down, and beat the Shield Captain who followed you out.

**The squad** — allies hold ground and soften the rank and file; duellists, heavies and bosses are always yours. A squadmate's bolt is weak, their kills pay half XP and nothing toward streaks, Focus or boons, and at most half the troopers can be on them at once, so you always have a fight of your own. Squadmates that drop are down, not dead: stand by one to get it up, or it gets up on its own. With a squadmate standing, a killing blow downs you instead and the nearest one runs to get you up, once per wave or objective (twice on Padawan). The revive code (`game/revive.js`) knows nothing about who is reviving whom, so online co-op can use it for partners. The tuning is all in `data/allies.js`. The squad is also in the sandbox (the panel's SQUAD row) and survival (the REINFORCEMENTS power, which brings an extra trooper a wave for each squadmate).

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
| Shift | Dash-flip (any direction; also the landing roll) |
| Q | Sprint / walk toggle |
| Left Alt (sprinting) | Force slide |
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

## Online co-op (early test)

The main menu's ONLINE CO-OP panel hosts a room (a 5-letter code) or joins one. Two browsers connect directly over WebRTC through the free PeerJS broker, and each sees the other as a second hero in their own customizer look. Fighting together (both browsers fighting the same enemies) is not built yet.

- **Players list.** `src/player/players.js` holds every hero in the fight: `players[0]` is always this browser's hero (`player`), and each partner is one more entry. Code that needs "a hero" rather than "my hero" goes through it, so going from 2 to 4 players is mostly balance and testing.
- **The partner's pose.** Each browser sends its hero's finished pose about 20 times a second (`net/pose.js`: every rig joint, which weapon is out and where it hangs, blade and jet glows). The partner's puppet eases between poses, so every animation shows exactly as on their own screen, and `animation.js` never needs to know about a second hero.
- **Enemies pick a hero.** `src/enemies/targets.js` lets each foe choose which hero to go after, by distance and by how many foes are already on each, so a crowd splits between you. Attack turns and ranged slots (`director.js`) are per hero. Solo, there is one hero and nothing changes. Until each browser shares the same enemies, a blow aimed at the partner's puppet does no damage. Tuning lives in `data/coop.js`.

- `?peerhost=host&peerport=9000` in the page URL uses your own PeerServer (`npx peerjs --port 9000`) instead of the free cloud broker.
- `api/turn.js` is a Vercel function that hands out Cloudflare TURN relay credentials for strict networks. Set `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` on the Vercel project to turn it on; without them the game uses STUN only.
- `npm run build && npm run smoke:coop` opens two browsers against a local PeerServer, connects them and checks each sees the other, that the partner is posed from the network, and that enemies go after both heroes.
