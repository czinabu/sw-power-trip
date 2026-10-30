# World guidelines

The arenas are drawn in the same **Ink** look as the heroes, enemies and effects: cel-shaded bands, a dark ink
outline, flat painted skies. The campaign runs **Jedha → Mustafar → Exegol** ("Road to the Sith"), and each world
gets darker and more dangerous on the way to the boss.

| Level | World | Landmark | Mood | Hazards dressed as |
|---|---|---|---|---|
| 1 | Holy City of Jedha | toppled Jedi colossus, a Star Destroyer over the city | golden hour, dust | temple brazier eruption |
| 2 | Mustafar Forge | volcano, lava rivers, smokestacks | fire and ash, embers | lava channels, lava-geyser vents |
| 3 | Throne of Exegol | Sith pyramid behind the Herald's altar | lightning storm, falling ash | Sith altar pulse, violet vents |

Survival mode rotates through the same three worlds.

## What lives where

| File | Holds |
|---|---|
| `src/data/worlds.js` | Every world's look: sky, light, fog, floor, prop palette, backdrop, particles, storm, mood beats. Purely visual. `WORLD` picks the direction (`worlds`); `siege` and `frozen` are the two alternatives that were prototyped. `TRAINING_WORLDS`, `MISSION_WORLDS` and `BATTLE_WORLDS` keep their own look whatever direction is picked. |
| `src/world/arenas/*.js` | The layouts: collision, cover, climbables, hazard zones. Colours come from the world's `pal`. The battle maps share `field.js`. |
| `src/world/ink.js` | `bakeArena()` turns every static prop into toon materials, merges them per material and adds one outline hull per material. `toon()`, `inkify()` for live objects. |
| `src/world/paint.js` | Painted textures: `paintSky()` (hard colour bands, flat clouds, horizon ridges, sun or moon, aurora) and `paintFloor()` (flagstone, sand, basalt, deck, ash, snow, ice). |
| `src/world/backdrop.js` | Everything past the arena edge: mesas, spires, cliffs, towers, smokestacks, crystals, ramparts, dunes, lava rivers, and the landmarks (statue, temple, volcano, pyramid, walker, Star Destroyer). |
| `src/world/atmosphere.js` | Applies a world's lights and fog, then runs it live: mood beats and lightning. |

## Rules

- **Gameplay never changes with the look.** Layouts, `solids`, `hazardZones`, spawns and timings are identical in
  every world. A theme may recolour a hazard but keeps its telegraph: the warning state is always amber.
- **Fighters must read.** Enemies are white, grey and red armour with ink outlines, so floors stay mid-value and
  never white (that is what sank the frozen direction's level 1). Light comes from behind the default camera, so
  heroes and enemies are front-lit; the sun disc in the sky follows the light direction.
- **Backdrops stay outside the playable square** (`arenaHalf`). They have no collision. They are authored in a ring
  1.5 to 2.7 × `arenaHalf` out, then `buildBackdrop` sends them to their real distance (see **Scale** below); the sky
  dome, the outer ground and the camera's far plane grow to clear the furthest one.
- **Mood follows the fight.** `beats` eases fog, fill and sky tint from the first wave to the last, and the boss
  pushes it all the way. `storm` throws a lightning strike plus a double flash, more often as the waves climb.
- **Ink outlines:** `ink` (default 0.045) for arena props, `inkFar` (default 0.16) for the backdrop so it still
  reads at distance. Double-sided cloth (banners) is baked without an outline.

## Layouts

Each arena is authored, not rolled (`src/world/arenas/kit.js` gives a seeded random so details look the same every
run). The three plans grow with the campaign:

| Level | Plan | Hazards |
|---|---|---|
| 1 Jedha (half 21) | symmetric courtyard: walkable ziggurat, 8 columns at r 13, east/west walls, 4 L-ruins, gantry SE | summit brazier eruption, 3 drums by the walls |
| 2 Mustafar (half 26) | safe cardinal lanes, danger diagonals: smelter, 4 molten channels each ending in a vent, 8 machine blocks, 2 catwalks, 6 girders, crane S | 4 channels, 4 vents, 6 drums inside the blocks |
| 3 Exegol (half 36) | open duelling ground (r < 11) for the boss, 7 cover pods at r 22, 2 ruin platforms, columns at r 26, altar S | altar pulse, 4 vents at r 12, 7 drums |

- Every solid is axis-aligned (collision is boxes and columns). Anything visible on the floor is either solid or a
  low **climbable** step under `STEP_UP`; nothing is decoration you walk through.
- Vaultable cover stays under the 1.93 single-jump apex. The gantry tiers are above it on purpose.
- Gaps between solids are wide enough for a brute (radius about 1.1); keep that when adding cover.
- The north lane (the player's spawn side) stays clear. Enemy spawns use `edgeSpawn()` in `collision.js`, which
  picks a ring spot clear of solids, vents and hazard zones.
- Drums never sit in a hazard zone or vent radius, and vents never overlap each other.
- The camera pulls in (`cameraClearance()`) when tall cover sits between it and the hero, instead of clipping.

## Scale

Everyone in the game is about 1.5× life size (heroes ~2.7 m, a trooper 2.6 m), so lore sizes are scaled by
`HERO_SCALE` (1.5) in `world/backdrop.js`.

- **Depth.** Each backdrop kind stretches the gap past the arena edge by its `DEPTH` (mesas 4, spires 3.5, cliffs 2.5,
  towers 2…): a piece authored at 1 + x half-widths stands at 1 + x·depth, growing so it keeps its size on screen
  from the middle. It reads as far because it barely moves as you cross the arena. Dunes, ramparts, lava and crystals
  stay put; walkers (already film size) step back a little. An entry can set its own `depth`.
- **Film size.** A landmark with `size` (longest ground-plan extent, metres) is built to that size and sent out by
  the same factor: Star Destroyers 2,400 m (1.6 km × 1.5, the default for `destroyer`), the Mustafar peak 3,000 m, the
  Sith Citadel 1,500 m, the Jedi Temple 600 m, the Inflictor wreck on Jakku 2,400 m. AT-ATs stand ~34 m.
- **Haze.** The backdrop swaps scene fog for aerial perspective (`farHaze` in `world/ink.js`): it builds from the fog's
  near distance toward `haze.max` (0.8) over `haze.len` metres (3 × arena), in the fog's colour, so silhouettes
  survive kilometres out. Outlines on the backdrop thicken with distance so they still read.
- **Camera.** The lens rides low and level over the right shoulder (`camera.ja`, `mandoLensUp`, a 64° FOV), so the
  skyline rises out of frame instead of being looked down on.

## The war beyond the walls

`world/warfront.js` runs a battle past the arena edge, from a world's `warfront` entry (data/worlds.js), true to its
place in the films: TIE patrols over occupied Jedha, shuttles over the Mustafar works, X-wings against the Sith fleet
on Exegol, AT-ATs marching on Hoth with snowspeeders circling them, a quiet aftermath on Jakku. Worlds without one (the
training grounds, the indoor sandbox rooms) stay quiet.

- `flyers`: `{ kind: tie | xwing | speeder | dropship | freighter, count, wing, alt, speed, every, fire }`, each a
  formation that crosses the sky and comes back on a new heading. `walkers`, `walkerAz`, `speedersPer`.
- `blasts` (per second), `blastSize`, `flash`; `tracers: { rate, colors }`; `columns` (burning plumes), `smoke`, `wind`.
- Ground action fills a ring `reach` [1.5, 4.5] half-widths out. Everything picks up as the fight climbs (the same
  progress the mood beats use), and a blast thuds in after its flash (`distantBoom`).
- Cost: one merged mesh plus one engine glow per ship, five meshes per walker, three instanced pools (tracers,
  flashes, smoke).

## The district

A `district` backdrop entry packs tall blocks along every side of the play space, `gap` metres past the edge (kept
beyond the camera's reach behind a hero at the edge, since backdrops have no collision), with streets on the
cardinals and the odd alley: Jedha's sandstone city, the Mustafar plant halls, Exegol's monoliths, the town round the
Khel Dar route. Layouts inside the arenas, and their collision, don't change. The battle maps stay open fields, as in
the films.

## Battle maps

Three large open fields for big battles with allied squads (`data/battlemaps.js`, looks in `BATTLE_WORLDS`). Any arena
wider than `BIG_ARENA` (100, `world/arena.js`) counts as one, and `shared.arenaBig` is set while it's up.

| Map | Size | Plan (north = allies, south = enemy) | Hazards |
|---|---|---|---|
| Grass Sea of Lothal (`grassland`) | 150 | landing pad and sandbag line (z +40); three broken ridge lines (z +18, −2, −20) with spires and boulders; a downed walker west of centre (crate, leg stump, hull 4.2); Imperial outpost behind a wall with three gates, a bunker, mast and gantry | 3 mortar craters (amber warning 1.8 s, blast), 6 drums |
| Ice Front on Hoth (`icefront`) | 140 | shield generator and ion cannon; two trench lines of sandbagged berms (z +32, +10) whose gaps never line up; no-man's land of boulders, drifts, a wrecked speeder and a downed walker; Imperial barricades, a drop-ship pad and gantry | 3 walker-cannon craters, 6 drums |
| Starship Graveyard of Jakku (`graveyard`) | 160 | scavenger camp and freighter behind a scrap line (z +38); standing hull plates (4–6, hard cover) and low debris; a buried engine bell (step, step, rim 5); a crashed TIE and a downed fighter; Imperial salvage yard of container stacks and a crane gantry | 3 plasma vents by the engine, 6 drums |

- Each map's layout is a `PLAN` at the top of its file. Its `*_SPOTS` export is worked out from the same PLAN at load
  time: `allyStart` [x, z, yaw], `enemyStart`, `fronts` (the line the fight moves along), `points` (spots worth holding),
  `cover` (behind every east–west wall, facing south) and `enemyCover` (the other face, facing north). Move a wall and
  the cover spots move with it. Shared pieces (walls, rocks, spires, drifts, craters, crate stacks, the walker hulk)
  are in `world/arenas/field.js`.
- Every gap between solids is at least 3 m so squads and brutes path anywhere a trooper can; walls under 1.93 can be
  vaulted, and the high ground (walker hull, bunker, engine rim, gantries) is a chain of hops.
- What follows the hero there: the sun and its 120 m shadow box, the sky dome (300 m and up, grown to clear the backdrop, like the pursuit route), the
  drifting dust/snow (a 72 m box round the hero), wave arrivals (`edgeSpawn` picks a ring 28–40 m out, clamped inside
  the map), and the flow field (filled 46 m of walking distance out; foes beyond that walk straight in).
- Fog starts nearer as a share of the arena (`fogStart` 0.3–0.45) so the far side softens into the haze.

## Performance

- An arena's static props bake into one mesh per material plus one outline hull each: the Jedha courtyard goes from
  66 separate meshes to 8 draw calls, and the backdrop bakes the same way.
- Painted textures are drawn once per world and reused on every rebuild (survival rotates arenas mid-run). Old arena
  geometry is disposed on rebuild.
- Fuel drums are one vertex-coloured mesh plus one hull, built once per colour.
- The lightning strike is one preallocated ribbon, rewritten in place. No lights are added at runtime.
- The camera's see-through fade and clearance tests skip props whose bounding sphere is nowhere near the hero and the
  lens, so a battle map's few hundred props cost about what a campaign arena's do.
- A battle map is 38–58 draw calls and 18–49k triangles for the arena (the sandbag rows are most of it), about 70 solids, and a flow-field refresh on the
  same order as Exegol's (`npm run smoke:maps` prints all of it).

## Previewing

`npm run dev`, then open the game with `?world=worlds` (default), `?world=siege` or `?world=frozen` to play any
direction. To add a world, copy a block in `WORLD_DIRECTIONS`, change the colours and the `backdrop` list, and point
`WORLD` at it.
