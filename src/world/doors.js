// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BREACHABLE DOORS: solid doors an arena puts in a wall gap (the garrison's kill house, world/arenas/garrison.js), in the
// order a mission breaches them (game/mission.js `breach`). A door is a live mesh (never baked into the arena's batch,
// so it can vanish) and a solid; opening it drops the solid and re-lays the enemy pathing grid. setDoorsOpen(n) opens
// the first n and closes the rest, so a retry from a later room and a co-op guest following the host both land on the
// same doors.

import { shared, solids } from '../state.js';
import { buildNav } from '../enemies/nav.js';

export function resetDoors(){ shared.doors = []; }
export function addDoor(mesh, solid, at){
  mesh.userData.noBake = true;   // (world/ink.js: a baked mesh couldn't be hidden)
  (shared.doors || (shared.doors = [])).push({ mesh, solid, at, open: false });
}
export const doorAt = (k) => shared.doors && shared.doors[k];
export const doorsOpen = () => (shared.doors || []).filter(d => d.open).length;
export function setDoorsOpen(n){
  let changed = false;
  (shared.doors || []).forEach((d, k) => {
    const open = k < n;
    if (open === d.open) return;
    d.open = open; d.mesh.visible = !open; changed = true;
    const i = solids.indexOf(d.solid);
    if (open && i >= 0) solids.splice(i, 1);
    else if (!open && i < 0) solids.push(d.solid);
  });
  if (changed) buildNav();
  return changed;
}
