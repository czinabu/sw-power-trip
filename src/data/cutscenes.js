// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CUTSCENES, as data: the words and players of the campaign's short in-engine scenes (game/cutscene.js plays them).
// Edit the words freely. A line is [who, what they say]; `who` and the line can each be { jedi, mando } or plain.
//
// Which scenes play, and when:
//   OPENINGS[chapter id]   after BEGIN on the chapter card: a wide look at the place, the chapter's title, then the
//                          hero and a line or two. `rival` adds the Inquisitor (or VX-7) watching from across the field,
//                          with its own line; `quarry: true` frames the chase's quarry where it already stands.
//   DUELS[mission id]      before a mission's duel foe steps in: it walks up, its name comes up, it speaks. Without an
//                          entry here the foe says its objective's `line` (data/missions.js). Plays in the campaign and
//                          the Missions tab alike.
//   BOSS                   in the campaign, as Darth Vexis or the Iron Magistrate arrives on Exegol.
//   SCENES[id]             any other scene, played by id from game code: playScene(id, { mark: [x, z] })
//                          (the Inquisitor's escape, the epilogue: the story beats in game/story.js call these).
// Every scene skips with Enter, Space or Esc (A or MENU on a pad); in co-op either player's skip ends it for both.

import { VOICE } from './campaign.js';

// the frame: letterbox bars (a share of the screen's height each), fades, and how long a line stays up at the least
export const CUT = { bars: 0.11, fadeIn: 0.4, fadeOut: 0.35, minLine: 2.6, readRate: 15 };   // readRate: characters a second

const INQ = { jedi: { foe: 'acolyte', name: 'THE INQUISITOR', tint: 0xa01a22, scale: 1.18 },
              mando: { foe: 'duelist', name: 'VX-7', tint: 0x4a5a6a, scale: 1.12 } };

export const OPENINGS = {
  // ---------------- ACT I ----------------
  siege: {
    jedi:  [[VOICE.jedi, 'Listen. That is the sound of a thousand years ending, unless you stand in its way.']],
    mando: [[VOICE.mando, 'They came with the dawn. Let them learn what sleeps under this temple.']] },
  archive: {
    jedi:  [[VOICE.jedi, 'Smoke in the archive. And there, above the stair. That is no soldier.']],
    mando: [[VOICE.mando, 'A hunter droid walks with them. It is counting our doors.']],
    rival: { ...INQ, line: { jedi: ['THE INQUISITOR', 'Run, little Knight. I only need to see which way you run.'],
                             mando: ['VX-7', 'Covert located. Counting foundlings.'] } } },
  refuge: {
    jedi:  [[VOICE.jedi, 'The last transport. Every youngling aboard it is a promise we made.']],
    mando: [[VOICE.mando, 'One ship between the foundlings and the Magistrate. That ship lifts.']] },
  'trial-first': {
    jedi:  [[VOICE.jedi, 'The Wall has not lost a duel in twenty years. It does not need to win this one. You do.']],
    mando: [[VOICE.mando, 'The old custom is older than any of us. Answer it with respect. Then win.']] },

  // ---------------- ACT II ----------------
  lothal: {
    jedi:  [[VOICE.jedi, 'Lothal. Grass to the horizon, and somewhere under it, a cell.']],
    mando: [[VOICE.mando, 'The ace is under that outpost. The droid is our key. Keep it whole.']] },
  'trial-acrobat': {
    jedi:  [[VOICE.jedi, 'It has been caged a long time. Expect it to want to stretch.']],
    mando: [[VOICE.mando, 'The ace flies like it has nothing to lose. Ground it.']] },
  hoth: {
    jedi:  [[VOICE.jedi, 'Cold enough to stop a heart. The Knight\'s line has held nine days. Help it hold a tenth.']],
    mando: [[VOICE.mando, 'The champion is in those trenches. So is the Empire. Reach the first through the second.']] },
  'trial-knight': {
    jedi:  [[VOICE.jedi, 'The Knight fought in the war before the war. Listen to its blade. It is teaching.']],
    mando: [[VOICE.mando, 'Beskar against beskar. The champion respects only the one still standing.']] },
  jakku: {
    jedi:  [[VOICE.jedi, 'A graveyard of ships, and every one of them remembers where it was going.']],
    mando: [[VOICE.mando, 'Old wrecks, older routes. The cores know where his beskar goes.']] },
  mustafar: {
    jedi:  [[VOICE.jedi, 'Feel that heat? That is his army being born. End it here.']],
    mando: [[VOICE.mando, 'That glow is our beskar, melting. Take it back.']] },

  // ---------------- ACT III ----------------
  chase: {
    jedi:  [['THE SEVENTH BLADE', 'Catch me, then. I have somewhere to be.'], [VOICE.jedi, 'It is faster than it was. So are you.']],
    mando: [['VX-7', 'Pursuer identified. Evasion protocol.'], [VOICE.mando, 'It runs. Good. Things that run can be caught.']],
    quarry: true },
  spearhead: {
    jedi:  [[VOICE.jedi, 'Look around you. Masters, troopers, the hope of the younglings. You built this army.']],
    mando: [[VOICE.mando, 'The clan rides together again. It has been a long time.']] },
  exegol: {
    jedi:  [[VOICE.jedi, 'Exegol. Whatever he was to me once, to you he is only the last door.']],
    mando: [[VOICE.mando, 'Exegol. The Magistrate\'s throne. Bring it down.']] },
};

// a mission duel's entrance: the foe's words (the first line is spoken by the foe itself when its who is null)
export const DUELS = {
  refuge: {
    jedi:  [[null, 'You fight like the master who trained you. I left the last one on the archive steps.'],
            [VOICE.jedi, 'Read the blade, not the mask.']],
    mando: [[null, 'A Mandalorian, guarding Jedi children. How far the clans have fallen.']] },
  strike: {
    jedi:  [[null, 'Vexis said a Knight would come. He did not say you would come with so few.']],
    mando: [[null, 'The Magistrate sends his regards. And his beskar.']] },
  pursuit: {
    jedi:  [[null, 'He taught me the seventh form, Knight. Let me show you what your master never could.']],
    mando: [[null, 'Bounty located. Termination authorised.']] },
  icefront: {
    jedi:  [[null, 'The line ends here, General.']],
    mando: [[null, 'Your champion is next.']] },
  graveyard: {
    jedi:  [[null, 'Everything on Jakku belongs to someone. Today it belongs to Vexis.']],
    mando: [[null, 'Fine plates. I\'ll strip them off you myself.']] },
  grassland: {
    jedi:  [[null, 'This pad is closed, Jedi.']],
    mando: [[null, 'Nothing lands on my pad.']] },
};

// the last boss arrives (campaign only)
export const BOSS = {
  jedi:  [['DARTH VEXIS', 'My old master\'s last student. Did they ever tell you what I was to them?'],
          [VOICE.jedi, 'Do not listen to him. Finish it.']],
  mando: [['THE IRON MAGISTRATE', 'Every covert I break makes this armour heavier. Yours will make it whole.'],
          [VOICE.mando, 'This is the Way.']],
};

// scenes played by id (playScene): `shots` is 'mark' (a look at the spot passed in, then back to the hero) or 'hero'
export const SCENES = {
  'inq-escape': { shots: 'mark', actor: INQ,
    jedi:  [['THE INQUISITOR', 'Not today, Knight. I have seen which way the ships went.']],
    mando: [['VX-7', 'Damage critical. Withdrawing. Heading logged.']] },
  epilogue: { shots: 'hero',
    jedi:  [[VOICE.jedi, 'It is over. The younglings are safe, and the Order has its masters again.']],
    mando: [[VOICE.mando, 'The foundlings are home. The clan is whole. This is the Way.']] },
};
