// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A FOE LOOK: a story mission can dress the enemy types it sends in another uniform (data/missions.js `foeLook`: the
// ARC trooper's prologue turns them into the clone company that took the order). Only the look changes (model,
// colours); every number stays the type's own. startLevel sets it for the arena being built, and clears it otherwise.

import { ENEMY_TYPES } from '../data/enemies.js';

let LOOK = null;
export function setFoeLook(map){ LOOK = map || null; }
// the type as this arena dresses it (spawns, co-op puppets, cutscene stand-ins)
export function foeType(name){
  const t = ENEMY_TYPES[name], o = LOOK && LOOK[name];
  return t && o ? { ...t, ...o } : t;
}
