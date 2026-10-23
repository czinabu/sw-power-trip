// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BATTLE MAPS: the large open fields for big battles with allied squads. Each is a level definition (like data/levels.js)
// that any mode can build: the sandbox offers them as rooms, survival rotates through them, and a story mission uses
// one as its `level` (plus the map's SPOTS for where squads start, take cover and fight over; world/arenas/*.js).
//
// They are two to three times a campaign arena across: enemy arrivals, pathing, the sun's shadows and the sky all work
// around the hero there (world/arena.js BIG_ARENA). Looks live in data/worlds.js BATTLE_WORLDS.

export { GRASSLAND_SPOTS } from '../world/arenas/grassland.js';
export { ICEFRONT_SPOTS } from '../world/arenas/icefront.js';
export { GRAVEYARD_SPOTS } from '../world/arenas/graveyard.js';
import { GRASSLAND_SPOTS } from '../world/arenas/grassland.js';
import { ICEFRONT_SPOTS } from '../world/arenas/icefront.js';
import { GRAVEYARD_SPOTS } from '../world/arenas/graveyard.js';

export const BATTLE_MAPS = {
  grassland: { id: 'grassland', short: 'GRASS SEA', spots: GRASSLAND_SPOTS,
    level: { name: 'BATTLEFIELD — THE GRASS SEA OF LOTHAL', sub: 'Open ground from the landing field to the outpost. Take it ridge by ridge.',
             arena: 150, floor: 0x7e8448, fog: 0xc8c4a0, sky: 0x3e6aa8, layout: 'grassland', waves: [], hazards: {} } },
  icefront: { id: 'icefront', short: 'ICE FRONT', spots: ICEFRONT_SPOTS,
    level: { name: 'BATTLEFIELD — THE ICE FRONT ON HOTH', sub: 'Two trench lines between the walkers and the shield generator. Hold them.',
             arena: 140, floor: 0x8a98aa, fog: 0xa4b0c0, sky: 0x5a6e8a, layout: 'icefront', waves: [], hazards: {} } },
  graveyard: { id: 'graveyard', short: 'GRAVEYARD', spots: GRAVEYARD_SPOTS,
    level: { name: 'BATTLEFIELD — THE STARSHIP GRAVEYARD OF JAKKU', sub: 'A field of wrecks from an old war. Move from cover to cover.',
             arena: 160, floor: 0xa88a60, fog: 0xdcc098, sky: 0x4a74b0, layout: 'graveyard', waves: [], hazards: {} } },
};
export const BATTLE_MAP_IDS = Object.keys(BATTLE_MAPS);
