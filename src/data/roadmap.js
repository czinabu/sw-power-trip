// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ROADMAP: shown on the main menu's ROADMAP panel, grouped by status. Every PR that ships a feature
// or notable change updates this file: move finished items into 'done' (keep the list short, drop
// the oldest) and add new plans under 'next' or 'later'. Keep entries to a few words.
// status is 'done' (shipped), 'now' (in progress), 'next' (planned) or 'later' (an idea for down the road).

export const ROADMAP = [
  { title: 'Combat and movement', status: 'done',
    items: ['Grounded combat: rolls and parries', 'Saber stamina tuning, free running', 'Jedi and Mando camera rigs', 'Smoother first use: saber throw, bosses, squads, arena sound, pathing, saber-throw light'] },
  { title: 'Battle maps and squads', status: 'done',
    items: ['Three large battle maps', 'Allied squads, downed allies and revive', 'SPEARHEAD on the Grass Sea of Lothal'] },
  { title: 'Missions', status: 'done',
    items: ['Missions tab: pick any single mission', 'Hoth trench defence, Jakku salvage raid', 'Lothal escort: walk a droid out under fire'] },
  { title: 'Balance pass', status: 'done',
    items: ['Campaign waves 2 and 3 eased: fewer bodies in the late waves'] },
  { title: 'Menus', status: 'done',
    items: ['Main menu: play choices first, fits on one screen', 'How to Play: basics first, details on hover', 'Roadmap panel'] },
  { title: 'Save and load', status: 'done',
    items: ['New Game, Save Game and Load Game', 'Three save slots: wins, unlocks, bests and look', 'Campaign saves keep your upgrades mid-run'] },
  { title: 'Online co-op', status: 'now',
    items: ['Phase 1: join with a code, see each other in the arena'] },
  { title: 'More content', status: 'next',
    items: ['More missions on the battle maps', 'New enemy types', 'Gamepad support', 'Upgrade picks that don\'t pause the fight'] },
  { title: 'Balance, round two', status: 'next',
    items: ['Survival scaling and mission pulses, from real playtest notes'] },
  { title: 'Co-op, fully', status: 'later',
    items: ['2 to 4 players fighting together', 'Enemies scale with squad size'] },
  { title: 'Beyond', status: 'later',
    items: ['Assassinate missions', 'Mission medals and best times', 'Save files you can export and share', 'Duel mode', 'Local split-screen'] },
];

export const ROADMAP_STATUS = { done: 'SHIPPED', now: 'IN PROGRESS', next: 'PLANNED', later: 'LATER' };
