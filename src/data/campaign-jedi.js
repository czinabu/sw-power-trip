// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE JEDI'S STORY: THE LEDGER OF NAMES (edit the words freely). The Jedi plays the shared chapter slots (data/campaign.js),
// and this file is the Jedi's version of each one: its title, chapter card, comms lines, opening scene and the talk
// before it. The plan, with the cast and the endings: /mnt/project-files/ (the "Jedi story: The Ledger of Names" doc).
//
// THE STORY. The Jedha temple keeps the Ledger of Names, the only record of every Force-sensitive child the Order has
// hidden since the Purge. The night the Empire comes, the gate is opened from inside by ILSA VENN, the hero's oldest
// friend, under an Inquisitor's mask. She serves DARTH VEXIS, who was once the apprentice of the hero's master, MASTER
// OREN VAEL. Vexis wants the Ledger's children for an order of his own. The hero gathers the scattered masters (TARN ODO
// the Wall, SERA QUILL the Acrobat, GENERAL RHENNA KAST the Knight), loses Vael on Mustafar, and decides whether Ilsa,
// and Vexis himself, can still be brought home.
//
// STORY-DEPENDENT WORDS. Anywhere a line, a list of lines or a title goes, `{ by: <choice id>, <answer>: …, … }` picks
// by what the run chose (game/choices.js). The choices are JEDI_CHOICES below; `actTwo` (lothal / hoth, Act II's pick)
// counts as one too. An answer with no entry falls back to `else`, and then to nothing.

export const JEDI_VOICE = 'MASTER VAEL';
export const JEDI_VOICE_LATE = 'GENERAL KAST';   // from the chase on (a chapter's `voice`): Vael is Vexis's prisoner

// who says what, for the lines below
const VAEL = 'MASTER VAEL', ILSA = 'ILSA VENN', KAST = 'GENERAL KAST', TARN = 'TARN ODO', SERA = 'SERA QUILL', VEXIS = 'DARTH VEXIS',
  DACE = 'CAPTAIN DACE', MANDO = 'THE MANDALORIAN', HERO = 'YOU';
const say = (who, line) => ({ who, say: line });
const rival = (who, line) => ({ who, say: line, rival: true });
const INQ = { foe: 'acolyte', name: 'THE INQUISITOR', tint: 0xa01a22, scale: 1.18 };   // (data/cutscenes.js INQ.jedi)

export const JEDI_ACTS = [
  { title: 'THE FALL OF JEDHA',
    open: 'The temple has kept the Ledger of Names for twenty years. Tonight the Empire comes for it, and someone has opened the gate.' },
  { title: 'THE SCATTERED MASTERS',
    open: { by: 'ledger',
      saved: 'The Ledger knows where the last masters went: Sera Quill to a cell on Lothal, Rhenna Kast to the trenches of Hoth. Find them before Vexis reads it too.',
      burned: 'The Ledger is ash, and so is every road it knew. Tarn has heard rumours: a Jedi in a cell on Lothal, a Jedi general on Hoth. Find them.' } },
  { title: 'THE SEVENTH BLADE',
    open: 'Vexis has Master Vael. Ilsa is running to him with the last thing he needs. This is Rhenna Kast. I have the comms now. Let us end this together.' },
];
export const JEDI_ACT_TWO = {
  lothal: 'Free Sera Quill from the outpost prison. Hoth will have to hold without you for a while',
  hoth: 'Join Rhenna Kast in the trenches. Lothal will have to wait for you',
};

// before the act's pick: the voice's line under the choice (the consequence, said plainly)
export const JEDI_ACT_TWO_WARN = 'Whichever you leave for second will not wait well. Lothal will move its prisoners. Hoth will lose its forward trench.';

// per chapter id, laid over the shared slot (data/campaign.js storyChapter; the fields are listed in data/campaign-mando.js).
// Besides those: `says` replaces the voice's line on a mission chapter's objectives, by objective (null keeps the mission's),
// and `escapeLines` are the words of its duel foe's escape scene (data/cutscenes.js SCENES).
export const JEDI_CHAPTERS = {
  // ---------------- ACT I: THE FALL OF JEDHA ----------------
  siege: {
    brief: ['They are already on the pilgrim road. Somebody let them in.',
            'Hold the steps, Knight. I will find out who. Do not go looking for them yourself.'],
    talk: { where: 'THE TEMPLE DOJO, THE NIGHT BEFORE',
      lines: [[ILSA, 'Again. You drop your guard when you are tired. Vexis would have had your head twice tonight.'],
           [HERO, 'Vexis is a story Master Vael tells to keep us in the dojo.'],
           [ILSA, 'Is he? Then ask Vael why the Order hides, while the Empire hunts children in the open. Ask him why he never answers.'],
           [VAEL, 'Enough for tonight, both of you. Ilsa, a word.'],
           [ILSA, 'Not tonight, Master. I have somewhere to be.']] },
    opening: { lines: [[VAEL, 'Listen. That is the sound of a thousand years ending, unless you stand in its way.'],
              [VAEL, 'And Ilsa is not at her post.']] },
    lines: {
      wave: [
        ['They came up the pilgrim road. Nobody stopped them at the gate. Meet them on the steps.'],
        ['Heavier troops behind the first line. Do not let them reach the doors.', 'The archivists are carrying out the Ledger\'s vault. Keep the steps clear.'] ],
      clear: ['The steps are ours, for now.', 'Smoke over the east wing. The archive is burning, and the Ledger is still inside.'] } },
  archive: {
    title: 'THE BURNING ARCHIVE',
    brief: ['The archive is burning. The Ledger of Names is in the vault below it.',
            'Twenty years of hidden children, written down in one place. If the Empire reads it, none of them are hidden any more.'],
    opening: { lines: [[VAEL, 'Smoke in the archive. And there, above the stair. An Inquisitor.']],
               rival: { ...INQ, line: ['THE INQUISITOR', 'Hold the stair if you like, Knight. I already know the way down.'] } },
    lines: {
      wave: [
        ['Keep them off the archivists.', rival('THE INQUISITOR', 'You still lean left when you parry. I always told you so.')],
        ['It knows how you fight. It knows the vault. I do not like what that means. Hold.'] ],
      clear: ['The archivists are out. The Inquisitor is in the vault.',
              rival('THE INQUISITOR', 'You should not have followed me down here.'),
              'That voice. Knight, wait.',
              say(ILSA, 'Do not look at me like that. Somebody had to stop hiding.')] } },
  refuge: {
    brief: { by: 'ledger',
      saved: ['The younglings reached the refuge. So did Ilsa, and she has seen the Ledger in your hands.', 'The last transport is still loading. Hold the ramp. If she comes for it, meet her.'],
      burned: ['The younglings reached the refuge. So did Ilsa, and the ash of the Ledger did not slow her down.', 'The last transport is still loading. Hold the ramp. If she comes, meet her.'] },
    opening: { lines: [[VAEL, 'The last transport. Every youngling aboard it is a promise this temple made.'],
              [VAEL, 'She was my student too. I should have seen it.']] },
    escapeLines: [['ILSA VENN', 'Not today. I have seen which way the transport went.']],
    says: [null, null, 'Ilsa has come for you, not the refuge. Read the blade, not the face. She was always faster than you. She was never calmer.'],
    lines: {
      duel: [rival(ILSA, { by: 'ledger', saved: 'Give me the Ledger. You do not know what he will do if I come back without it.', burned: 'You burned it. Twenty years of names, and you burned them. Do you know what you have done to me?' })],
      escape: ['Let her go. The transport matters more than she does. For now.'],
      clear: ['The transport is away. The refuge has a keeper: Tarn Odo, the Wall.', 'Tarn will not trust you with the children until Tarn has tested you. And Tarn is right not to, tonight.'] } },
  'trial-first': {
    title: 'TRIAL OF THE WALL',
    brief: ['Tarn Odo has held this refuge\'s door for twenty years.', 'One of the temple\'s own just opened ours to the Empire. Tarn wants to know which side of the door you stand on.'],
    opening: { lines: [[VAEL, 'Tarn Odo has not lost a duel in twenty years. Tarn does not need to win this one. You do.']] },
    says: ['Tarn barely strikes. Tarn waits for you to tire. Push that guard open, and do not swing yourself empty.'],
    talk: { where: 'THE HIDDEN REFUGE, AT THE DOOR',
      lines: [[TARN, 'Vael\'s Knight. The temple fell tonight because a Jedi opened the gate. Why should I open mine to you?'],
           [HERO, 'Because I held the steps while she did it.'],
           [TARN, 'Then hold this.']] },
    lines: {
      clear: ['Tarn stands aside, and teaches you Soresu, the form that holds.',
              say(TARN, 'Vael. Tell your Knight about Vexis. All of it. You owe them that before you send them anywhere.'),
              'Tarn is right. Darth Vexis was my apprentice. I saw the anger in him and I told myself it would pass. I saw it in Ilsa, and I said nothing again.'] } },

  // ---------------- ACT II: THE SCATTERED MASTERS ----------------
  lothal: {
    title: 'THE LOTHAL BREAKOUT',
    brief: { by: 'actTwo',
      lothal: ['Sera Quill is held in the outpost on Lothal. A slicer droid, RX-4, carries the codes to her cell.', 'Walk the droid in through the gate, open the cells, and hold the way out until every prisoner is through it.'],
      hoth: ['We are late. The outpost heard about Hoth and moved half its prisoners off-world. Sera is still there, and she has been fighting her guards.', 'Walk RX-4 in, open what is left of the cells, and get her out.'] },
    opening: { lines: [[VAEL, 'Lothal. Grass to the horizon, and somewhere under it, Sera Quill in a cell for a year.']] },
    says: [null, null, 'The prisoners are running for the middle gate. Hold it until the last of them is out. Sera is among them.'],
    lines: {
      chapter: ['RX-4 has sliced the outpost\'s cell codes. Walk it to the gate and every door opens.'],
      duel: ['The captain who holds the keys. Finish this, and Sera walks free.'],
      clear: [say(SERA, 'A year. A whole year, and the Order sends one Knight and a droid.'), 'She is free, and furious. Let her be furious at you for a while. It will pass.'] } },
  'trial-acrobat': {
    title: 'TRIAL OF SERA QUILL',
    brief: { by: 'actTwo',
      lothal: ['Sera wants to know who came for her before she follows anyone anywhere.', 'She will not stand still. Neither should you.'],
      hoth: ['Sera is hurt, and she is angrier for it. She still wants to see what you are.', 'She will not stand still. Neither should you.'] },
    opening: { lines: [[VAEL, 'She has been caged a long time. Expect her to want to stretch.']] },
    says: ['Sera strikes from the air and is gone before you answer. Catch the landing, then punish her while she breathes.'],
    talk: { where: 'LOTHAL, OUTSIDE THE PRISON WALLS',
      lines: [[SERA, 'Vael sent you? Vael, who told us all to hide and wait? I waited a year in that cell.'],
           [HERO, 'Ilsa did not wait. She opened the temple gate for the Empire.'],
           [SERA, 'Ilsa did? Then the Order is worse off than I thought. Come on. Show me you can keep up.']] },
    lines: {
      clear: ['Sera laughs for the first time in a year. She teaches you Ataru the only way she knows: at full speed.', say(SERA, 'I will fly with you. Not for Vael. For the kids in that Ledger.')] } },
  hoth: {
    title: 'THE TRENCH LINE',
    brief: { by: 'actTwo',
      hoth: ['General Rhenna Kast is holding Hoth\'s trenches with a rebel company and a band of clones who never followed the order.', 'Fight beside her. A general judges you by the line you hold.'],
      lothal: ['We are late. Hoth\'s forward trench fell two days ago, and Kast has pulled back to the rear line.', 'Win the trench back beside her, and she might forgive us for taking so long.'] },
    opening: { lines: [[VAEL, 'Cold enough to stop a heart. Kast\'s line has held for nine days. Help it hold a tenth.']] },
    talk: { where: 'HOTH, THE COMMAND TRENCH',
      lines: [[KAST, 'You are Vael\'s? Then you are late, and so is he. Hold the forward trench, and we will talk after.'],
           [HERO, 'Those clones fight for you.'],
           [KAST, 'They got me out on the night the order came. I have been trying to deserve that since.']] },
    lines: {
      chapter: [say(KAST, 'Clones on the left, rebels on the right. You take the middle, Knight.')],
      duel: [say(KAST, 'Their siege trooper. I have the left. Take it, and I will see how you fight.')],
      clear: ['The line held, and Kast saw it.', say(KAST, 'Meet me in the hangar when the last transport is loading. Bring your blade.')] } },
  'trial-knight': {
    title: 'TRIAL OF GENERAL KAST',
    brief: ['Kast has buried too many soldiers for an Order that no longer exists.', 'She fights blade to blade, and she punishes a careless block.'],
    opening: { lines: [[VAEL, 'Kast fought in the war before the war. Listen to her blade. It is teaching.']] },
    says: ['Kast meets every careless block with a riposte. Parry, do not block, and answer her in kind.'],
    talk: { where: 'HOTH, THE HANGAR',
      lines: [[KAST, 'Vael wants the masters back together. Why? So we can hide better?'],
           [HERO, 'So Vexis does not find the children before we do.'],
           [KAST, 'That is a reason. Let us see if you are one.']] },
    lines: {
      clear: ['Kast lowers her blade, and teaches you her two edges: Djem So to break a blade, Shien to send a bolt home.',
              say(KAST, 'My troopers come with me. Where I go, they go. Tell Vael that.')] } },
  jakku: {
    title: 'SALVAGE RIGHTS',
    brief: ['Vexis is building something. The nav cores in Jakku\'s wrecks remember where his ships go.',
            'Pull the cores before his salvage crews burn them. And be careful: we are not the only ones here for them.'],
    opening: { lines: [[VAEL, 'A graveyard of ships, and every one of them remembers where it was going.'],
              [MANDO, 'Jedi. You are on my salvage.'],
              [VAEL, 'A Mandalorian. Vexis has been taking from the clans as well. Talk first, Knight.']] },
    lines: {
      chapter: [say(MANDO, 'The cores tell me where my clan\'s beskar went. You want them for something else. We can both have that.')],
      clear: ['The cores are clean. Every route ends in the same place: Mustafar.',
              say(MANDO, 'Mustafar, then. Our roads split here, Jedi. Do not make me regret this.'),
              'And in the wreck of a Republic cruiser, a holocron. Captain Aurel Dace, a duellist. Makashi: precision over power.'] } },
  mustafar: {
    title: 'THE MUSTAFAR FORGE',
    brief: ['The cores point to Mustafar. Vexis\'s war machines are forged here.',
            'I am coming with you this time. Whatever he is building, I made him, and I will see it with my own eyes.'],
    opening: { lines: [[VAEL, 'Feel that heat. That is his army being born.'],
              [VAEL, 'And something else. He knows we are here.']] },
    lines: {
      chapter: ['The forge is guarded by its own workers. Do not let the heat drive you into the channels.'],
      duel: [rival(VEXIS, 'Oren. You came yourself. I knew the forge would bring you.'), 'Knight, finish the forgemaster. I will deal with him. I should have dealt with him years ago.'],
      clear: ['The forge is ash.', say(KAST, 'Knight, this is Kast. Vael\'s signal is gone. Vexis took him. The forge was a lure, and Vael was the catch.'),
              say(KAST, 'Sit with what you have learned. You will need all of it now.'), 'The forms come together in you: Niman.'] } },

  // ---------------- ACT III: THE SEVENTH BLADE ----------------
  chase: {
    voice: JEDI_VOICE_LATE,
    brief: { by: 'ledger',
      saved: ['Ilsa came back for the Ledger while we were on Mustafar, and she got it. She is at Khel Dar, making for her ship.', 'Run her down. If Vexis gets that book, every child in it is his.'],
      burned: ['Ilsa has the refuge\'s new coordinates. Vexis cannot read the Ledger, so he will settle for the children at the refuge.', 'She is at Khel Dar, making for her ship. Run her down.'] },
    opening: { lines: [[ILSA, 'You should have let me go at the refuge. Catch me, then.'],
              [KAST, 'She is fast. So are you.']], quarry: true },
    says: [{ by: 'ledger', saved: 'Ilsa has the Ledger. Keep her in sight. Over the stalls, not around them, and take the lane north of the cross if you can climb it.',
                           burned: 'Ilsa has the refuge\'s coordinates. Keep her in sight. Over the stalls, not around them, and take the lane north of the cross if you can climb it.' },
           'She is making for the docks. The causeway is faster, if you can clear the gaps, and the stacks west of the hangars cut straight to the bay.',
           'Her ship is clamped down. Nowhere left to run. Beat her, Knight. Then we will see.'],
    lines: {
      duel: [rival(ILSA, 'He has Vael. Do you understand? If I go back with nothing, he kills him.'), 'She is not lying. Do not let that stop you. Stop her.'],
      clear: ['She is down. Her saber is out of reach.', say(ILSA, 'Go on. He taught me that the Order always finishes it. Prove him right.')] } },
  spearhead: {
    voice: JEDI_VOICE_LATE,
    brief: { by: 'ilsa',
      spared: ['Everyone you found is here: Tarn, Sera, my troopers. And Ilsa, which I still cannot believe.', 'She knows the gate. Break the line in front of it, and she will open it for us.'],
      struck: ['Everyone you found is here: Tarn, Sera and my troopers.', 'Break their line before the gate. With Ilsa gone, we open it the hard way.'] },
    says: ['My troopers are with you, Knight. Take their forward posts one by one. Leave the troopers to the squad, and the blades to yourself.'],
    opening: { lines: [[KAST, 'Look around you. Masters, troopers, the hope of every child in that Ledger. You built this army.']] },
    talk: { where: 'ABOARD KAST\'S GUNSHIP, ON THE ROAD TO EXEGOL',
      lines: { by: 'ilsa',
        spared: [[ILSA, 'Why did you spare me?'], [HERO, 'Because you were scared, not cruel. And I need someone who knows that gate.'], [ILSA, 'Then I will open it. And after that, I will find out if I can still be a Jedi.']],
        struck: [[SERA, 'Was it the right thing, with Ilsa?'], [HERO, 'It was the thing that had to happen.'], [SERA, 'That is what Vexis would say.']] } },
    lines: {
      clear: { by: 'ilsa', spared: [say(ILSA, 'The gate is open. He is through there, and so is Vael.')], struck: ['The gate is down. Vael is through there.'] } } },
  exegol: {
    voice: JEDI_VOICE_LATE,
    brief: ['Vexis is on the throne of Exegol, and Master Vael is chained beside it.', 'Whatever waits on that throne, you are not facing it alone.'],
    opening: { lines: [[KAST, 'Exegol. Whatever he was to Vael once, to you he is only the last door.']] },
    lines: {
      wave: [
        ['This is where the Sith once ruled. Do not listen to the voices in the stone.'],
        ['Tarn holds the left, Sera the sky, my troopers the right. Keep moving forward.'],
        ['He is sending everything now. That means he is afraid.'],
        [{ by: 'ilsa', spared: say(ILSA, 'Vael is alive. I can see him from here. Keep Vexis busy, and I will get to him.'), struck: 'The last of his guard. Vael is still alive. I can see him.' }] ],
      boss: [rival(VEXIS, { by: 'ilsa', spared: 'Ilsa. You brought them here. Then you can watch them die with Oren.', struck: 'You killed Ilsa. Oren\'s Knight, killing a girl on her knees. You will make a fine Sith.' }),
             say(VAEL, 'Catch his lightning, and do not let him make you angry. He is better at anger than you.')] } },
};

// an Act II world that was left for second: its foes are already dug in (this chapter id's `harder` shows on its card)
export const JEDI_LATE = { lothal: 'hoth', hoth: 'lothal' };   // the second pair, by the act's pick

/* THE CHOICES — asked on a card after a chapter is cleared (`after`), or after the last boss falls (`after: 'end'`).
   The run remembers the answer (G.story, saved with the run) and the words above pick by it; `default` stands in until
   it's asked (a save from before it was). `who` says it (the chapter's voice if not). */
export const JEDI_CHOICES = [
  { id: 'ledger', after: 'archive', default: 'saved', title: 'THE LEDGER OF NAMES',
    lines: ['Ilsa ran when the vault roof came down. The Ledger of Names is in your hands, and it is already burning at the edges.',
            'If we carry it out, it can be taken from us. If we burn it, nobody finds those children ever again. Not Vexis. Not us.'],
    options: [
      { key: 'saved', label: 'CARRY IT OUT', line: 'It shows you where the masters are. Vexis can still take it.' },
      { key: 'burned', label: 'BURN IT', line: 'Nobody can use it, and nobody can find those children. Not even you.' } ] },
  { id: 'ilsa', after: 'chase', default: 'spared', title: 'ILSA VENN',
    who: 'GENERAL KAST',
    lines: ['She is on her knees, and her saber is out of reach.', 'Whatever you choose, I will stand by it. But you are the one who has to live with it.'],
    options: [
      { key: 'spared', label: 'SPARE HER', line: 'Take her with you. She knows the way to Exegol.' },
      { key: 'struck', label: 'STRIKE HER DOWN', line: 'She opened the gate. She has had her last chance.' } ] },
  { id: 'vexis', after: 'end', default: 'ended', title: 'DARTH VEXIS',
    who: 'MASTER VAEL',
    lines: ['He is beaten. He will not get up again unless we let him.', 'He was my student. I failed him once. Let me take him home, and try again. Or end it. You have earned the right to choose.'],
    options: [
      { key: 'vael', label: 'GIVE HIM TO VAEL', line: 'Vexis lives, a prisoner. Vael tries to bring him back.' },
      { key: 'ended', label: 'END IT', line: 'Vexis falls here, on his own throne.' } ] },
];

/* THE ENDINGS — picked by Ilsa (spared / struck) and Vexis (vael / ended). The Ledger changes the last line. */
const LEDGER_LINE = { by: 'ledger',
  saved: 'The Ledger is safe in Tarn\'s keeping. One by one, we will find the children in it, before anyone else can.',
  burned: 'The Ledger is ash. Somewhere out there are children nobody will ever come for. I hope they never need us.' };
export const JEDI_ENDINGS = {
  'spared-vael': { title: 'THE LONG ROAD HOME', world: 'JEDHA, ONE YEAR LATER',
    lines: ['Vexis sits in a cell under the temple, and every evening Oren Vael sits outside it and talks. Some nights Vexis answers.',
            'Ilsa teaches the younglings what the Order got wrong. Tarn teaches them to hold. Sera teaches them to fall and get up again.',
            LEDGER_LINE] },
  'spared-ended': { title: 'THE ORDER ENDURES', world: 'JEDHA, ONE YEAR LATER',
    lines: ['Vexis is gone. Vael mourns him anyway. That is the difference between them.',
            'Ilsa stands beside you on the temple steps, where she opened the gate. She has not asked to be forgiven. She has earned some of it.',
            LEDGER_LINE] },
  'struck-vael': { title: 'WHAT IS LEFT', world: 'JEDHA, ONE YEAR LATER',
    lines: ['Vael took Vexis away on the night of Exegol, and has not come back. Kast says he is trying to save one student, since he could not save the other.',
            'You lead what is left of the Order now. The younglings ask about Ilsa. You have not found the words yet.',
            LEDGER_LINE] },
  'struck-ended': { title: 'THE SEVENTH BLADE', world: 'EXEGOL, ONE YEAR LATER',
    lines: ['You won. Vexis is dead, and so is Ilsa, and the Order has a champion who does not hesitate.',
            'Vael watches you train the younglings and says nothing. He said nothing once before, too.',
            LEDGER_LINE] },
};

// the Form VII pick right after the chase (game/meditation.js): a word on what you just did
export const JEDI_FORK_LINE = { by: 'ilsa',
  spared: 'You spared her when nobody would have blamed you. That is control. Vaapad will understand it. Juyo will not.',
  struck: 'You did not hesitate with Ilsa. Juyo knows that feeling. Be careful how much you let it in.' };
export const JEDI_CAST = [VAEL, ILSA, KAST, TARN, SERA, VEXIS, DACE, MANDO, 'THE INQUISITOR', JEDI_VOICE, JEDI_VOICE_LATE];   // (never the hero's own lines: game/cutscene.js)

// the words in scenes the Jedi shares with the other heroes (data/cutscenes.js), in the Jedi's version
export const JEDI_DUELS = {
  refuge: [[null, { by: 'ledger', saved: 'You should have left it in the fire. Give it to me.', burned: 'All those names. You did not even read them first.' }],
           [VAEL, 'Read the blade, not the face. She has always been faster than you. She has never been calmer.']],
  pursuit: [[null, 'He taught me the seventh form. Let me show you what Vael never would.']],
};
export const JEDI_BOSS = [[VEXIS, 'Oren\'s last student. Did he ever tell you what I was to him? Did he tell you about Ilsa?'],
                          [VAEL, 'Do not listen to him. Finish it.']];
export const JEDI_EPILOGUE_SCENE = { by: 'vexis', vael: [[VAEL, 'Come, my old apprentice. We have a long way to go.']], ended: [[VAEL, 'It is over.']] };
