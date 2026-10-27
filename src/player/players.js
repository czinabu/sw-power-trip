// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PLAYERS — every hero in the fight. players[0] is always this browser's own hero (the `player` object in state.js);
// in online co-op each partner is one more entry, a puppet posed from their browser's state (net/partner.js).
// Built as a list, not "me and a partner", so the same code takes 2 to 4 players later.
//
// An entry: { id, local, name, pos (Vector3, the feet), vel (Vector3), down (downed or dead: no target),
//             here (in this same arena and fighting: something enemies can go after) }

import { G, player } from '../state.js';

const me = {
  id: 'local', local: true, name: 'YOU',
  get pos(){ return player.group.position; },
  get vel(){ return player.vel; },
  get down(){ return !!player.downed; },
  get here(){ return true; },   // the AI always has this hero to fall back on
};
export const players = [me];
export const localPlayer = me;

export function addPlayer(p){ if (!players.includes(p)) players.push(p); return p; }
export function removePlayer(p){ const i = players.indexOf(p); if (i > 0) players.splice(i, 1); }

// how many heroes are in this fight: this one, plus each partner in the same arena and mode (1 solo, so scaling by it
// changes nothing there). Bosses, champions and revives read it when they start (data/coop.js SCALE)
export const heroesHere = () => Math.max(1, players.filter(p => p.here).length);

// heroes an enemy may pick right now: in this arena and on their feet
export const targetable = (p) => !!p && p.here && !p.down;

/* which arena and mode this browser is in, so a partner only counts as being in the same fight when theirs matches */
export function worldKey(){
  const mode = G.sandbox ? 'sandbox' : G.training ? 'training' : G.mission ? 'mission:' + G.missionId
    : G.endless ? 'survival:' + G.arenaRot : 'campaign:' + G.levelIdx;
  return mode;
}
