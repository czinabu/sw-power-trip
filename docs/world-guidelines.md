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
| `src/data/worlds.js` | Every world's look: sky, light, fog, floor, prop palette, backdrop, particles, storm, mood beats. Purely visual. `WORLD` picks the direction (`worlds`); `siege` and `frozen` are the two alternatives that were prototyped. |
| `src/world/arenas/*.js` | The layouts: collision, cover, climbables, hazard zones. Colours come from the world's `pal`. |
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
- **Backdrops stay outside the playable square** (`arenaHalf`) and inside the sky dome (`1.7 × arena`). They have no
  collision. Landmarks sit roughly 1.5 to 2.5 × `arenaHalf` from the centre so the fog softens but doesn't hide them.
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

## Performance

- An arena's static props bake into one mesh per material plus one outline hull each: the Jedha courtyard goes from
  66 separate meshes to 8 draw calls, and the backdrop bakes the same way.
- Painted textures are drawn once per world and reused on every rebuild (survival rotates arenas mid-run). Old arena
  geometry is disposed on rebuild.
- Fuel drums are one vertex-coloured mesh plus one hull, built once per colour.
- The lightning strike is one preallocated ribbon, rewritten in place. No lights are added at runtime.

## Previewing

`npm run dev`, then open the game with `?world=worlds` (default), `?world=siege` or `?world=frozen` to play any
direction. To add a world, copy a block in `WORLD_DIRECTIONS`, change the colours and the `backdrop` list, and point
`WORLD` at it.
