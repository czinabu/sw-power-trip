// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MANDALORIAN'S OWN STORY: what a campaign begun with the Mando plays, laid over the shared chapter slots
// (data/campaign.js). Edit the words freely.
//
// THE STORY. Years ago the hero pulled a boy out of a burning freighter and brought him home to a hidden covert in the
// canyons of ORVANE, an Outer Rim salt world. The boy is ROOK, nine now, and he talks too much and wants a helmet more
// than anything. The voice is THE ARMORER, who keeps the covert's forge. OSSIK VANE, the guild broker in the salt town
// of SALT HOLLOW, has handed the hero jobs for ten years. THE IRON MAGISTRATE, an Imperial warlord who wears armour
// beaten out of the beskar of every covert he has broken, holds Ossik's daughter NELL, and Ossik pays for her with the
// covert's location. The Magistrate does not want the hero dead. He wants the foundlings: raised in his armour, they
// will be the clans' strength turned into his. His hunter droid VX-7 takes Rook in Act I, and the rest of the story is
// the hero gathering the scattered clan and getting the boy back.
//
// How it lies over the chapters: each entry below is keyed by a chapter id and replaces that chapter's fields for a run
// whose story is the Mando's (G.storyHero: the hero who began the run, or a co-op host's). Ids and positions stay the
// same, so saves, the rewards each chapter hands out, the sandbox's unlocks and co-op all carry on as they were.
//   title, world      the chapter card's name and place
//   mission, arena    a mission chapter's mission (data/missions.js), and/or the map it's staged on ({ layout, arena }):
//                     a wave chapter's level is laid over with `arena` the same way (world/arena.js)
//   brief             the voice's lines on the chapter card
//   talk              the SCENE between chapters, on the card above the brief: { where, lines: [[who, say]…] }
//   lines             the comms during the chapter, as in data/campaign.js (wave per wave; chapter, duel, escape, clear, boss)
//   opening           the chapter's opening scene (data/cutscenes.js OPENINGS): { lines: [[who, say]…], rival?: {…} }
// Words here are plain (not per hero): whoever plays the Mando's story, a Jedi guest included, hears this story.
// The Jedi's story and the trooper's keep the chapters' own words and maps (and the trooper's file).

export const MANDO_VOICE = 'THE ARMORER';
// the cast who talk over comms or off screen: a cutscene line of theirs doesn't move the hero's mouth (game/cutscene.js)
export const MANDO_CAST = new Set(['ROOK', 'OSSIK VANE', 'VX-7', 'THE IRON MAGISTRATE', 'KAEL VARR', 'SKYE', 'BRAKKA', 'NELL']);
const A = MANDO_VOICE, ROOK = 'ROOK', OSSIK = 'OSSIK VANE', VX = 'VX-7', MAG = 'THE IRON MAGISTRATE';
const VX7 = { foe: 'duelist', name: 'VX-7', tint: 0x4a5a6a, scale: 1.12 };

// the act cards and Act II's pick, for the Mando's story
export const MANDO_ACTS = [
  { title: 'THE BROKEN COVERT',
    open: 'Orvane. Salt flats, red canyons, and under them a covert that has stayed hidden for twenty years. Someone has just sold it.' },
  { title: 'THE SCATTERED CLAN',
    open: 'The covert is ash and Rook is gone. The clan that lived through it is scattered: Skye caged on the Magistrate\'s prison barge, Brakka dug in on Thane with foundlings of their own. Each of them saw a piece of where the Magistrate keeps his foundlings. Bring them home, and bring the pieces.' },
  { title: 'THE IRON THRONE',
    open: 'VX-7 is running for the Magistrate with the last of the covert\'s secrets in its head. The Magistrate is waiting on Duren, his foundry world, on a throne of other people\'s armour. Rook is with him.' },
];
export const MANDO_ACT_TWO = {
  lothal: 'Break Skye out of the Gallows, the Magistrate\'s prison barge',
  hoth: 'Reach Brakka at the old holdfast on Thane before the hunters do',
};
// the pick's buttons, for the Mando's story (the shared ones name the Jedi's worlds)
export const MANDO_ACT_TWO_LABEL = { lothal: 'SKYE FIRST', hoth: 'BRAKKA FIRST' };

export const MANDO_CHAPTERS = {
  // ---------------- ACT I: THE BROKEN COVERT ----------------
  siege: {
    title: 'A JOB IN SALT HOLLOW', world: 'SALT HOLLOW, ORVANE',
    arena: { layout: 'outpost', arena: 60 },
    talk: { where: 'ABOARD THE CINDERWAKE, LOW OVER THE SALT FLATS',
      lines: [[ROOK, 'You said next time I could come. This is next time.'],
              ['YOU', 'You said that. I said no.'],
              [ROOK, 'Then bring me back something. A real helmet. Not a bucket with eye holes.'],
              [OSSIK, 'Is that the boy? Tell him old Ossik says hello. Your mark is in the cantina, friend. Easy money. I owe you an easy one.']] },
    brief: ['Ossik Vane has put work your way for ten years, and he says this one is easy: a deserter with a price on him, drinking in Salt Hollow.',
            'Collect him and come home. Rook is waiting up.'],
    opening: { lines: [[OSSIK, 'Funny thing. The deserter left an hour ago. The men who came in after him did not.'], [A, 'That is not a bounty. That is an ambush. Fight your way to the pad.']] },
    lines: {
      wave: [
        ['Imperial armour in the market. Remnant troops, the Magistrate\'s colours. They were waiting for you.', { who: OSSIK, say: 'I\'m sorry. I am. I didn\'t have a choice.' }],
        ['Ossik has gone quiet. More of them on the rooftops. Clear the street and get to your ship.'] ],
      clear: [{ who: OSSIK, say: 'They have Nell. My girl. They said they only wanted you away from home for an hour.' },
              'An hour. He sold them the covert. Come home. Now.'],
    } },
  archive: {
    title: 'SMOKE OVER THE COVERT', world: 'THE COVERT, ORVANE',
    arena: { layout: 'covert', arena: 60 },
    talk: { where: 'THE CANYON, AT DUSK',
      lines: [['YOU', 'Armorer. Report.'],
              [A, 'They came down the canyon walls on cables. The upper yard is theirs. The foundlings are in the lower hangar.'],
              ['YOU', 'Rook?'],
              [A, 'With the others. He tried to take a blaster off the rack. I took it back.']] },
    brief: ['The covert is burning. The Magistrate\'s troops hold the upper yard, and the only way to the hangar is through them.',
            'The clan is carrying the foundlings down to the last ship. Clear the yard so they can.'],
    opening: { lines: [[A, 'Something walks with them that is not a soldier. It is counting our doors.']],
               rival: { ...VX7, line: [VX, 'Designate located. Covert confirmed. Counting foundlings: eleven.'] } },
    lines: {
      wave: [
        ['Keep them off the stair to the hangar.', { who: VX, rival: true, say: 'Mandalorian. The Magistrate does not require you. Stand aside and live.' }],
        ['That is VX-7, the Magistrate\'s hunter. It is not here for you. It is here for them. Hold the yard.'] ],
      clear: ['The yard is ours, for a moment.', 'The droid slipped past us into the tunnels. It is going for the hangar. Go.'],
    } },
  refuge: {
    title: 'THE LAST SHIP', world: 'THE COVERT, ORVANE',
    mission: 'covert',
    talk: { where: 'THE LOWER HANGAR',
      lines: [[ROOK, 'I knew you\'d come. I told them you\'d come.'],
              ['YOU', 'Get on the ship, Rook.'],
              [ROOK, 'I can help. I know where all the jammers are, I watched them put them up—'],
              [A, 'Rook. The ship.']] },
    brief: ['The last ship is loading in the hangar mouth, and the Magistrate has jammers on the canyon walls to keep it from calling for the rest of the clan.',
            'Hold the ramp. Then kill the jammers. Then deal with the droid.'],
    opening: { lines: [[A, 'Eleven foundlings and one ship. That ship lifts.']] },
    lines: {
      duel: [{ who: VX, rival: true, say: 'Foundling count aboard: ten. One unaccounted for. Searching.' }, 'One unaccounted for. Where is Rook?'],
      escape: [{ who: ROOK, say: 'Let go of me! LET GO!' }, 'It has Rook. It has Rook!'],
      clear: ['The ship is up with ten foundlings aboard. VX-7 is gone, and Rook with it.',
              'I know. I know. We will get him back. But not alone.'],
    } },
  'trial-first': {
    title: 'THE EXILE\'S CHALLENGE', world: 'THE COVERT, ORVANE',
    arena: { layout: 'covert', arena: 60 },
    talk: { where: 'THE BURNED-OUT YARD, AT NIGHT',
      lines: [['KAEL VARR', 'Twenty years I stayed away from this covert. I come back and find it in cinders and a child taken on your watch.'],
              [A, 'Kael Varr was our best hunter, before he left us. He knows where the clan went when it scattered.'],
              ['KAEL VARR', 'By the old custom, I can challenge for the right to lead this hunt. I am challenging.']] },
    brief: ['Kael Varr walked away from the covert before Rook was born. He came back tonight, because the whole sector heard it burn.',
            'He will not follow you into this unless you put him on the ground first. That is the custom. Answer it.'],
    opening: { lines: [[A, 'He is better than he looks, and he looks very good. Respect him. Then beat him.']] },
    lines: {
      clear: ['Kael yields, and takes your hand.', { who: 'KAEL VARR', say: 'Skye is in a cell on the Gallows, his prison barge. Brakka went to ground on Thane two years back. And the Magistrate\'s droid always runs to the same place: wherever he is.' }],
    } },

  // ---------------- ACT II: THE SCATTERED CLAN ----------------
  lothal: {
    title: 'THE GALLOWS', world: 'THE STORM SEA OF VELL',
    mission: 'gallows',
    talk: { where: 'ABOARD THE CINDERWAKE, OVER THE STORM SEA',
      lines: [['KAEL VARR', 'Skye flew our patrols for six years. She got caught running guns for the rebels, and they put her on the Gallows. She never said a word about the covert.'],
              [A, 'The Gallows is the Magistrate\'s prison barge. It never comes to port. Nobody has ever walked off it.'],
              ['YOU', 'Then she flies off it.'],
              [A, 'Rook used to sit on her ship\'s wing and call out targets. She will want to know.']] },
    brief: ['Skye, the clan\'s ace, is in a cell on the Gallows, a prison barge riding out a storm on the sea of Vell. Her gunship is impounded on its deck.',
            'Open the cells, get every prisoner onto her ship, and deal with the warden. Skye flew over the Magistrate\'s yards. She knows where his ships go.'],
    opening: { lines: [[A, 'Three locks hold every cell on that barge. Open them, and the barge is ours.'], ['YOU', 'And the warden?'], [A, 'The warden will come to you.']] },
    lines: {
      chapter: ['The guard is spread thin in this weather. Move fast.'],
      duel: ['The warden. Put it down and the Gallows is empty.'],
      clear: ['The cells are empty. Skye is out, and she has already heard about Rook.'],
    } },
  'trial-acrobat': {
    title: 'SKYE', world: 'THE STORM SEA OF VELL',
    arena: { layout: 'barge', arena: 60 },
    talk: { where: 'THE BARGE\'S DECK, AFTER THE STORM',
      lines: [['SKYE', 'You let them take him. From our own hangar. On your watch.'],
              ['YOU', 'Yes.'],
              ['SKYE', 'Then you\'d better fly like I do, because I\'m not following anyone slower than me to get him back.']] },
    brief: ['Skye is free, and furious, mostly with you.', 'Out here an argument means a fight. Keep her on the ground.'],
    lines: {
      clear: ['Skye lands, laughing for the first time in a year.', { who: 'SKYE', say: 'His supply ships run through the wrecks on Jakku. Fine. I\'ll fly.' }],
    } },
  hoth: {
    title: 'THE HOLDFAST', world: 'THE CEDAR FOREST OF THANE',
    mission: 'holdfast',
    talk: { where: 'ABOARD THE CINDERWAKE, LOW OVER THE TREES',
      lines: [['KAEL VARR', 'Two years ago another covert fell to him, out at Ash Hollow. Brakka got five of its foundlings out and went to ground in a fort our grandparents built on Thane.'],
              [A, 'The Magistrate\'s hunters reached Thane a week ago. Brakka has not answered since.'],
              ['YOU', 'Brakka never answers.'],
              ['KAEL VARR', 'True. But Brakka always shows up. This time, nobody has.']] },
    brief: ['Brakka, the clan\'s champion, is holding the old holdfast in the cedar forest of Thane with five foundlings from a covert that fell before ours.',
            'The Magistrate\'s hunters are in the trees. Hold the gate, light the signal cairns so the ship can find you, and get them all out.'],
    opening: { lines: [['BRAKKA', 'Five little ones in the tower and forty hunters in the trees. You took your time.'], ['YOU', 'Hold the wall. I have the gate.']] },
    lines: {
      chapter: [{ who: 'BRAKKA', say: 'They come up the lane every hour. Same lane. Hunters, not soldiers.' }],
      duel: [{ who: 'BRAKKA', say: 'The Houndmaster. It took Ash Hollow. I have the wall. It is yours.' }],
      clear: ['The hunters are broken and the cairns are burning. The Cinderwake is coming down through the trees.',
              { who: 'BRAKKA', say: 'Five foundlings, and every one of them is still breathing. Now tell me how they took the boy.' }],
    } },
  'trial-knight': {
    title: 'BRAKKA', world: 'THE CEDAR FOREST OF THANE',
    arena: { layout: 'holdfast', arena: 60 },
    talk: { where: 'THE HOLDFAST\'S COURTYARD, AT DUSK',
      lines: [['BRAKKA', 'I trained you. I put the first dent in that helmet. If you\'ve gone soft, Rook pays for it.'],
              ['YOU', 'Then find out.']] },
    brief: ['Brakka will not take a step toward the Magistrate behind anyone who cannot beat them.', 'Beskar to beskar.'],
    lines: {
      clear: ['Brakka takes your hand, and gives you the heavy repeater off their own back.',
              { who: 'BRAKKA', say: 'He melts down every covert he breaks. Ash Hollow\'s beskar went to a meltworks on Caldus, an ice moon. Ours will be there now. Follow the metal, and you find the boy.' }],
    } },
  jakku: {
    talk: { where: 'A COMMS CALL, ON THE WAY TO JAKKU',
      lines: [[OSSIK, 'Don\'t hang up. Please. The Magistrate\'s ships pull their routes off the old wrecks on Jakku. The nav cores remember everything.'],
              ['YOU', 'Why should I believe you?'],
              [OSSIK, 'Because I have nothing left to sell. He still has Nell. Get the cores and you find where he keeps them both.'],
              ['SKYE', 'And watch yourself out there. Somebody with a lightsaber is digging in the same wrecks.']] },
    brief: ['Ossik says the Magistrate\'s routes are written in the nav cores of Jakku\'s old wrecks. Ossik has lied before.',
            'Pull the cores anyway. If he is telling the truth, they lead to the meltworks.'],
    lines: {
      duel: ['The salvage master wants the cores back, and that Jedi from the wrecks is on its other flank.', 'Work with it. Just this once.'],
      clear: ['The Jedi nods once and is gone into the dunes. The cores give up the route: Caldus, the ice moon. Brakka was right.', 'And Ossik told the truth. For once.'],
    } },
  mustafar: {
    title: 'THE MELTWORKS', world: 'CALDUS, THE ICE MOON',
    mission: 'meltworks',
    talk: { where: 'ABOARD THE CINDERWAKE, ABOVE THE ICE OF CALDUS',
      lines: [['BRAKKA', 'Look at the moulds on the scans. Those are not for soldiers. They are small.'],
              [A, 'Helmets. He is making helmets for children.'],
              ['SKYE', 'Out of our beskar.']] },
    brief: ['The Magistrate\'s meltworks is cut into the ice of Caldus, and the covert\'s beskar is being poured there into armour sized for foundlings.',
            'Break the meltworks. If Rook is there, bring him out.'],
    lines: {
      chapter: ['Every mould in this place has a child\'s face on it. Burn it down.'],
      duel: [{ who: VX, rival: true, say: 'Designate: the Mandalorian. Bounty revised. Value: doubled.' }, 'Let it count. Finish the forgemaster.'],
      clear: ['The meltworks are slag. Rook was never here: it was bait, and VX-7 was watching to see if you would take it.',
              'But in the meltworks\' cells, a girl who says her father is a broker in Salt Hollow. Nell. Ossik\'s debt is paid.'],
    } },

  // ---------------- ACT III: THE IRON THRONE ----------------
  chase: {
    talk: { where: 'A TRANSMISSION, ON EVERY CLAN CHANNEL',
      lines: [[MAG, 'You broke my meltworks. I have more. You took the broker\'s girl. I have more of those as well.'],
              [MAG, 'The boy asks for you every day. He has stopped asking whether you are coming. Come to Duren, and I will let you watch me put the helmet on him.'],
              ['SKYE', 'Got it. The droid\'s ship just landed at Khel Dar to refuel. The way through Duren\'s defences is in its head.']] },
    brief: ['VX-7 is at the Khel Dar spaceport, refuelling for its run home to the Magistrate. Its memory holds the codes for the guns around Duren.',
            'Run it down before it lifts. This time it does not get away.'],
    lines: {
      duel: [{ who: VX, rival: true, say: 'Escape vector denied. Engaging. Note: the foundling Rook asked me to tell you he is not scared.' }],
      clear: ['VX-7 is scrap. Its memory core gives up Duren\'s gun codes.', 'Now we go and get him.'],
    } },
  spearhead: {
    title: 'THE IRON ROAD', world: 'DUREN, THE FOUNDRY WORLD',
    mission: 'iron-road',
    talk: { where: 'ABOARD THE CINDERWAKE, DOWN THROUGH THE SMOKE OF DUREN',
      lines: [[OSSIK, 'Nell is safe with the Armorer. I\'m flying the dropship in. Don\'t argue.'],
              ['KAEL VARR', 'Every hunter who ever left this clan is in the air behind us. All of them came back.'],
              ['BRAKKA', 'Then let us knock.']] },
    brief: ['The whole clan rides together for the first time since the covert fell, and Ossik Vane is flying the dropship.',
            'The Magistrate\'s last army holds the iron road to his citadel. Take their line, take their gate. He is behind it, and so is Rook.'],
    lines: {
      clear: ['The gate is down. The clan rides in together.'],
    } },
  exegol: {
    title: 'THE IRON THRONE', world: 'THE IRON CITADEL, DUREN',
    arena: { layout: 'citadel', arena: 64 },
    talk: { where: 'THE GATE OF THE IRON CITADEL',
      lines: [['YOU', 'Rook.'],
              [ROOK, '...You came.'],
              [MAG, 'He wears your covert\'s beskar now. Every foundling I take, I take from a Mandalorian, and every one of them will be mine. Starting with yours.']] },
    brief: ['The Magistrate holds his citadel with everything he has left. Rook stands beside a throne built out of the helmets of every covert he has broken.',
            'Through the Iron Guard, then through him. This is the Way.'],
    lines: {
      wave: [
        ['The Magistrate\'s Iron Guard. Best he has left.'],
        ['Brakka takes the left flank. Skye has the sky. Kael is with you.'],
        ['He is sending everything now. That is fear.'],
        [{ who: ROOK, say: 'I\'m not his! I told him every day! I\'m not his!' }, 'You heard him. The last line. Then the throne.'] ],
      boss: ['The Magistrate himself, in armour made from a hundred coverts. Blaster fire will not mark it.', 'Make him come to you. Then break him.'],
    } },
};

// the end. Its last lines point past this story: the Magistrate was a supplier, not the one he answered to (room left for
// the finale all three heroes will share)
export const MANDO_EPILOGUE = {
  title: 'THE CLAN IS WHOLE',
  world: 'THE NEW COVERT, ORVANE, ONE SEASON LATER',
  lines: ['The Magistrate is gone. The beskar he stole is back in our forge, and it is being made into what it was always meant to be.',
          'Skye flies patrol. Brakka trains the foundlings, all sixteen of them. Kael stayed. Ossik runs our supplies, and Nell will not stop asking Skye for flying lessons.',
          'And Rook has his first real helmet, beaten out of the Magistrate\'s own armour. He has not taken it off in a week.',
          'One more thing. Half the beskar the Magistrate took never reached his meltworks. His ledgers show it going out past the Rim, to a buyer who paid him in warships and never gave a name.',
          'Whoever is building an army out there, the Jedi from Jakku has been asking the same questions. Keep your armour on. This is the Way.'],
};

// the scenes for the Mando's story that aren't a chapter's opening (data/cutscenes.js)
export const MANDO_BOSS = [[MAG, 'You came all this way for one boy. That is why your clans lose, Mandalorian. You never learned to let go of anything.'],
                           [A, 'This is the Way.']];
