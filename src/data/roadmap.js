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
    items: ['Saber spins are earned: rhythm links only, on a cooldown, for extra stamina', 'Campaign waves 2 and 3 eased: fewer bodies in the late waves', 'Ataru hunts the back line (+60% vs officers, snipers, grenadiers, jet troopers)', 'Guard strain per form: Ataru 0.8×, Niman 1×, Djem So 1.5×', 'Niman cooldowns shift to defence: barrier, mend, repulse'] },
  { title: 'Menus', status: 'done',
    items: ['Main menu: play choices first, fits on one screen', 'How to Play: basics first, details on hover', 'Roadmap panel'] },
  { title: 'Save and load', status: 'done',
    items: ['New Game, Save Game and Load Game', 'Three save slots: wins, unlocks, bests and look', 'Campaign saves keep your upgrades mid-run'] },
  { title: 'Online co-op: two heroes', status: 'done',
    items: ['Join with a code, see each other in the arena', 'Partner fully animated, in their own look', 'Enemies pick which hero to go after'] },
  { title: 'Sharper visuals', status: 'done',
    items: ['Smooth edges: antialiasing back on', 'Each world gets its own colour grade', 'Soft contact shadows (ambient occlusion, High)'] },
  { title: 'Richer worlds', status: 'now',
    items: ['Detailed floors, lasting scorch marks', 'Ground mist, light shafts, deeper skies'] },
  { title: 'Online co-op: fight together', status: 'next',
    items: ['Host runs the enemies for both players', 'Hits, parries and revives across the connection'] },
  { title: 'More content', status: 'next',
    items: ['More missions on the battle maps', 'New enemy types', 'Gamepad support', 'Upgrade picks that don\'t pause the fight'] },
  { title: 'Combat readout', status: 'done',
    items: ['Per-wave damage by foe, low-stamina time, parries and blocks', 'Shown in the run summary and a live sandbox box'] },
  { title: 'Attack tells', status: 'done',
    items: ['One colour and sound each for parry-or-dodge, dodge-only and area attacks', 'Same cues on every foe, boss and hazard, in every mode', 'Legend in How to Play'] },
  { title: 'Form movement and recovery', status: 'done',
    items: ['Ataru dashes and lunges far enough to reach officers behind the front ring', 'Djem So\'s finisher hangs a beat longer, the cost of its guard break', 'Run speed and Niman unchanged, in every mode'] },
  { title: 'Stamina ramp', status: 'done',
    items: ['Stamina refills later and slower deeper in: 0.5s to 0.8s delay, 30 to 26 per second', 'Full by Exegol or survival wave 10', 'Padawan, training, sandbox and missions unchanged'] },
  { title: 'Melee guard break', status: 'done',
    items: ['A heavy melee blow on an empty guard breaks it: a short stagger, and the next hit lands in full', 'Bolts keep the cheap stamina block; the beskar brace and darksaber follow the same rule', 'Same in every mode, co-op included'] },
  { title: 'Balance, round two', status: 'next',
    items: ['Guard meter for the Warbringer boss', 'Survival scaling and mission pulses, from real playtest notes'] },
  { title: 'Co-op, fully', status: 'later',
    items: ['Co-op survival runs with shared upgrades', 'Missions and bosses in co-op', '2 to 4 players', 'Enemies scale with squad size'] },
  { title: 'Beyond', status: 'later',
    items: ['Assassinate missions', 'Mission medals and best times', 'Save files you can export and share', 'Duel mode', 'Local split-screen'] },
];

export const ROADMAP_STATUS = { done: 'SHIPPED', now: 'IN PROGRESS', next: 'PLANNED', later: 'LATER' };
