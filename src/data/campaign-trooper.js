// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARC TROOPER'S OWN STORY: NO MORE ORDERS (testing, behind ?trooper; edit the words freely). What a campaign begun
// with the trooper plays, laid over the shared chapter slots the way the Mando's and the Jedi's are (data/campaign.js
// storyChapter): each entry below is keyed by a chapter id and replaces that chapter's fields in the trooper's story.
// Ids and positions stay the same, so saves, rewards, the sandbox's gates and co-op carry on as they were. The fields
// are data/campaign-mando.js's (title, world, mission, arena, kind, steps, talk, brief, lines, opening), plus `foeLook`
// on a wave chapter (the uniform its foes wear, data/allies.js). Words are plain: whoever plays the trooper's story, a
// Jedi or Mando guest included, hears this one.
// The outline (the plan, the settings, the ending's hook): the "ARC trooper story: No More Orders" doc.
//
// THE STORY. On the night of the order three clones refused it: you, SGT. VANT and BRISK got GENERAL RHENNA KAST out of
// a jungle firebase while your company turned on you. Your batch-brother THE MARSHAL kept his chip, and let you go.
// Eight years later the three of you are deserters working the VORRAN YARDS under THE CAPTAIN, the old clone who keeps
// the band together (the voice). Then the purge companies find you. Act I takes you from the yards through the garrison
// that took Brisk to the HALCYON, the medical frigate that fitted your chips, where the files say your chip never
// failed: somebody switched it off. Act II goes back to where you were made and to Kast; Act III to the relay spire,
// where the Marshal means to give the order again, and where you learn the order was never only the Empire's.
//
// Built so far: the prologue and Act I (the yards, the garrison, the frigate, the Captain's drill). Act II and III
// still play the first draft's chapters (below) on the shared maps, until they're rebuilt.

import { PURGE } from './allies.js';

export const TROOPER_VOICE = 'THE CAPTAIN';
const CAPT = TROOPER_VOICE, VANT = 'SGT. VANT', BRISK = 'BRISK', MARSHAL = 'THE MARSHAL', KAST = 'GENERAL KAST', YOU = 'YOU';
const say = (who, line) => ({ who, say: line });
const rival = (who, line) => ({ who, say: line, rival: true });

export const TROOPER_ACTS = [
  { title: 'THE DESERTERS',
    open: 'Eight years on the Vorran yards, brother. Eight years of nobody looking twice. Tonight somebody looked.' },
  { title: 'WHERE WE WERE MADE',
    open: 'Someone switched our chips off, the night before the order. Someone switched the Marshal\'s on. The answers are out there, and so is the General who walked out of that jungle with us.' },
  { title: 'NO MORE ORDERS',
    open: 'The Marshal is getting ready to send something. Every clone with a chip still in his head will hear it. We end this before he does.' },
];
// Act II's pick (the pairs as they stand, until Kamino replaces Lothal)
export const TROOPER_ACT_TWO = {
  lothal: 'Break our brothers out of the Lothal prison',
  hoth: 'Join General Kast in the trenches on Hoth',
};

// per chapter id: the trooper's story laid over that slot
export const TROOPER_CHAPTERS = {
  // ---------------- PROLOGUE: THE NIGHT OF THE ORDER (the trooper's own chapter: data/campaign.js, `story: 'trooper'`) ----------------
  order: {
    brief: ['Eight years ago. A jungle firebase on the edge of the war, and a General we would have followed anywhere.',
            'At midnight the order came, and the company turned its rifles on the General. Vant, Brisk and you did not.'],
    lines: {
      duel: [rival(MARSHAL, 'You heard the order, brother. Same as I did. Step aside.')],
      escape: ['Let him go. Get the General aboard.'],
      clear: ['The ship lifts over the canopy with the General and the three of you aboard.',
              'Eight years of hiding start tonight. So does the band.'],
    } },

  // ---------------- ACT I: THE DESERTERS ----------------
  siege: {
    title: 'DOCK SHIFT', world: 'THE VORRAN YARDS',
    arena: { layout: 'shipyard', arena: 64 }, foeLook: PURGE,
    talk: { where: 'THE VORRAN YARDS, END OF SHIFT',
      lines: [[BRISK, 'Eight years hauling cargo for a foreman who cannot count. I miss the war.'],
              [VANT, 'You do not miss the war. You miss being shot at by people who were not your foreman.'],
              [CAPT, 'Quiet, both of you. Imperial transport on final approach. It is not on the manifest.']] },
    brief: ['Eight years on the Vorran yards, armour in a locker, faces nobody looks at twice. Tonight a transport set down that is not on any manifest.',
            'Purge troopers. They are here for us. Get your armour on and hold the yard.'],
    opening: { lines: [[CAPT, 'Black armour coming off the ramp. Same make as ours, brother. Same factory.'],
                       [BRISK, 'Then they know how we fight. Good. So do we.']] },
    lines: {
      wave: [
        ['They are fanning out through the containers. Keep them off the freighter.', say(VANT, 'Brisk, stay on my side of the hull!')],
        [rival(MARSHAL, 'Eight years on a dock. Is this what you refused the order for, brother?'), 'That voice. The Marshal. Do not answer him. Hold the yard.'],
      ],
      clear: ['The yard is ours, for a moment.', say(VANT, 'Captain, Brisk is gone. They dragged him onto a speeder, toward the garrison block.'),
              'Then that is where we are going.'],
    } },
  archive: {
    title: 'THE KILL HOUSE', world: 'THE GARRISON BLOCK, VORRAN',
    kind: 'mission', mission: 'killhouse', arena: null, steps: 2,   // (it stands for the shared slot's two waves)
    talk: { where: 'BEHIND THE GARRISON WALL, IN THE RAIN',
      lines: [[VANT, 'Three rooms, a door each, all of them locked from the inside. I did kill houses on Kamino. This is a kill house.'],
              [YOU, 'Then we do it the way they taught us.'],
              [CAPT, 'Fast, loud and together. Bring him home.']] },
    brief: ['They took Brisk into the garrison block at the edge of the yards. Three rooms, a door each, and every door locked.',
            'Stack up, blow the door, clear the room. Then the next one.'],
    opening: { lines: [[CAPT, 'Towers on the yard, troopers on the door. Clear the front first.']] },
    lines: {
      breach: [
        ['Guard room. Four of them, and they did not hear us coming.'],
        [say(VANT, 'Hall\'s full of them. Watch the officer.')],
        [say(BRISK, 'About time! Is that Vant? Tell Vant he owes me a ration bar.')],
      ],
      clear: ['Brisk is out, and he talked the whole way to the gunship.',
              say(BRISK, 'They knew my number, Captain. CT-7714. Nobody on Vorran knew that.')],
    } },
  refuge: {
    title: 'WHAT THE CHIP SAYS', world: 'THE HALCYON, ADRIFT',
    mission: 'chipfiles',
    talk: { where: 'ABOARD THE GUNSHIP',
      lines: [[BRISK, 'How did they find us? Eight years and nobody looked twice.'],
              [CAPT, 'Our numbers. Someone pulled our chip records. There is only one place left that still keeps them.'],
              [VANT, 'The Halcyon. The ship that put the chips in.']] },
    brief: ['The HALCYON fitted every chip in our batch, and her records core still remembers each one. Somebody read ours.',
            'Get her power back up, pull the files, and find out what they know.'],
    opening: { lines: [[CAPT, 'A dead ship. Lights low, rifles up.'], [BRISK, 'I hate dead ships.']] },
    lines: {
      duel: [rival('CAPTAIN VORN', 'The Marshal said you would come here. He said you always come back for the paperwork.')],
      clear: ['The files are ours, and they say what I was afraid they would.',
              'Your chip did not fail, brother. Someone switched it off, the night before the order. Someone who wanted a few of us to say no.'],
    } },
  'trial-first': {
    title: 'BROTHERS IN ARMS', world: 'THE HALCYON, AFTER',
    mission: 'drill',
    talk: { where: 'THE HALCYON\'S EMPTY DECKS',
      lines: [[CAPT, 'Before we go after anyone, I want to see this squad work. Not three soldiers. One squad.'],
              [BRISK, 'Training droids? Captain, I am thirty-one years old.'],
              [CAPT, 'Then you will be thirty-one and good at it.']] },
    brief: ['The Captain has set the old training droids up on the decks, stun settings on.',
            'Take every post with your squad, not in front of it.'],
    lines: {
      clear: ['That is a squad.',
              'One more thing in those files. The officer who switched our chips off signed it: General Rhenna Kast. She knew, brother. She always knew.'],
    } },

  // ---------------- ACT II: WHERE WE WERE MADE (the first draft's chapters, until Kamino, Hoth and the foundry are rebuilt) ----------------
  lothal: {
    brief: ['Three of ours were taken on Lothal, Patch our medic among them. The outpost is holding them for reconditioning.',
            'A slicer droid has the cell codes. Walk it in, open every door, and bring our brothers out.'],
    lines: {
      chapter: ['The droid is RX-4. It knows the codes. Keep it breathing and it opens the cells.'],
      duel: ['The captain who held the keys. Put it down and our brothers walk.'],
      clear: ['The cells are empty. Patch is with us, and he has already started on the squad\'s wounds.'],
    } },
  'trial-acrobat': {
    title: 'THE ACROBAT',
    brief: ['The prison held more than ours: the Acrobat, a Jedi the Empire never broke.',
            'It wants to see whether the clone who freed it can keep up. Keep up.'],
    lines: {
      clear: ['The Acrobat laughs. It has not fought beside a clone since the war. It will fly with us.'],
    } },
  hoth: {
    brief: ['General Kast is on Hoth, holding a trench line while the rebels evacuate. She switched our chips off, brother. Time we asked her why.',
            'Eight years, brother. Go and stand in the trench beside them.'],
    lines: {
      chapter: [{ who: KAST, say: 'I would know that armour anywhere. Hold the forward trench with me, trooper, and we will talk after.' }],
      duel: [{ who: KAST, say: 'Their siege trooper. I have the left. Just like old times.' }],
      clear: ['The line held, and the General saw you hold it.', { who: KAST, say: 'The hangar, when the last transport loads. There is a Jedi gathering the masters, and I want you to meet them.' }],
    } },
  'trial-knight': {
    title: 'THE GENERAL',
    brief: ['The General wants to see what eight years did to you.',
            'It fights the way it taught you to. Do not hold back. It will know.'],
    lines: {
      clear: ['The General lowers its blade, and laughs. Hammer joins the squad: he followed the General out of the order too.',
              'The company is nearly whole.'],
    } },
  jakku: {
    brief: ['The Marshal\'s purge troopers are forged somewhere. The nav cores in Jakku\'s wrecks remember the route.',
            'And there is an old Republic gunship out in those dunes. Tally swears she can make it fly.'],
    lines: {
      clear: ['The cores give up the route: Mustafar.', 'And Tally has the gunship running. It is not pretty, but it will strafe.'],
    } },
  mustafar: {
    brief: ['The cores point to Mustafar. Every purge trooper the Marshal fields is forged there.',
            'Break the forge, and his army breaks with it.'],
    lines: {
      chapter: ['They are pouring purge armour here. Our old armour, painted black.'],
      duel: [{ who: 'THE MARSHAL', rival: true, say: 'You are walking into his trap, brother. I am only sorry I did not build it.' }, 'Ignore him. Finish the forgemaster.'],
      clear: ['The forge is ash, and it was too easy.', 'It was bait. The Marshal has the band\'s trail, and he is taking it to whoever switched his chip on.'],
    } },

  // ---------------- ACT III: NO MORE ORDERS (the first draft's, until the hunt and the relay spire are built) ----------------
  chase: {
    brief: ['The Marshal\'s hunter droid has the band\'s trail in its memory. It is at Khel Dar, making for its ship.',
            'Run it down. That trail does not leave the spaceport.'],
    lines: {
      clear: ['The trail dies with the droid.', 'Now we go to him.'],
    } },
  spearhead: {
    brief: ['The General is with us, and the masters the Jedi gathered. Our company leads the push.',
            'Break the line before the gate. The Marshal is waiting behind it.'],
    lines: {
      clear: ['The gate is open. Every brother we have is behind you.'],
    } },
  exegol: {
    brief: ['An army stands before the throne, and the Marshal stands in front of it.',
            'Whatever he says to you out there, remember who you chose to be.'],
    lines: {
      wave: [
        ['His purge troopers. All of them. Squad, on the trooper.'],
        ['The General holds the left. The Acrobat has the high ground.'],
        ['He is sending everything. That means he is afraid of you.'],
        [{ who: 'THE MARSHAL', rival: true, say: 'Enough. You and me, brother. The way they made us.' }],
      ],
      boss: ['There he is. Do not let him make it about Kamino. Make it about the ones behind you.'],
    } },
};

// the ending, with the door left open for the three heroes' last fight (the Jedi's and the Mando's stories point the same way)
export const TROOPER_EPILOGUE = {
  title: 'NO MORE ORDERS',
  world: 'THE VORRAN YARDS, ONE YEAR LATER',
  lines: ['The band has its own ship now, and nobody on it takes an order they did not choose.',
          'Kast came to the yards last week. She says the signal the Marshal meant to send was older than the chips, and older than the Republic, and that it was not finished.',
          'A Jedi heard the same signal on Jedha. A Mandalorian heard it out past the Rim. Something is coming, brother. When it does, nobody gives us the order. We choose.'],
};
