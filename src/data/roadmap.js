// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ROADMAP: what's planned next, shown on the main menu's ROADMAP panel. Edit freely —
// status is 'now' (in progress), 'next' (planned) or 'later' (an idea for down the road).

export const ROADMAP = [
  { title: 'Polish the core game', status: 'now',
    items: ['Combat, camera and movement feel', 'Menus, HUD and upgrade screens', 'Balance across all three levels'] },
  { title: 'Missions', status: 'next',
    items: ['Hold the line: defend a point until time runs out', 'Sabotage: destroy targets under fire', 'Extraction: reach the landing zone and survive', 'A Missions mode beside Campaign and Survival'] },
  { title: 'Squad-ready', status: 'next',
    items: ['Gamepad support', 'Revive downed allies', 'Upgrade picks that don\'t pause the fight'] },
  { title: 'Online co-op', status: 'later',
    items: ['2 to 4 players: one hosts, friends join with a code', 'Jedi and Mandalorian in the same squad', 'Enemies and bosses scale with squad size'] },
  { title: 'Bigger missions', status: 'later',
    items: ['Escort a prisoner or droid', 'Assassinate a marked target', 'Multi-stage raids ending in a boss', 'Objectives that need both heroes'] },
  { title: 'Beyond', status: 'later',
    items: ['Duel mode: 1v1 with fixed loadouts', 'Local split-screen', 'More arenas'] },
];

export const ROADMAP_STATUS = { now: 'IN PROGRESS', next: 'UP NEXT', later: 'LATER' };
