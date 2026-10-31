// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CLONE ARC TROOPER'S CAMPAIGN WORDS (testing, and a first draft: edit freely). The trooper plays the same chapters as
// the other heroes (data/campaign.js); this file holds its own titles, chapter cards and comms lines, laid over each
// chapter as its `trooper` entry when the game loads (mergeTrooperStory below). Anything not written here falls back
// to the Mando's words (state.js heroKey).
//
// THE STORY. Years after Order 66, an ARC trooper who refused the order keeps a small band of deserter clones alive,
// hidden among the pilgrims of Jedha. On the night the order came, they got their General out while the rest of their
// company turned on them; that General is the Knight now holding Hoth's trenches. The voice is THE CAPTAIN, the old
// clone captain who keeps the band together. The rival is THE MARSHAL, a commander from the trooper's own batch who
// kept his chip and leads the Empire's purge troopers. He calls the trooper brother, and means it.
// (Planned and not built yet: a prologue mission on the night of the order, and the trooper's own chapters in place of
// the three trials: THE KILL HOUSE, BROTHERS IN ARMS and THE GENERAL. Until then the trooper plays the trials as they are.)

export const TROOPER_VOICE = 'THE CAPTAIN';

export const TROOPER_ACTS = [
  { title: 'THE ORDER',
    open: 'Eight years we have kept our heads down on Jedha, brother. Tonight the Empire came up the pilgrim road, and the Marshal is leading it.' },
  { title: 'THE LOST BROTHERS',
    open: 'The band is scattered, but not lost. Some of ours are in a cell on Lothal. The rest of our old company is holding Hoth for the General. Bring them home.' },
  { title: 'BROTHERS\' END',
    open: 'The forge was bait, and the Marshal took it home to his master. He has the refuge\'s trail. We end this where he stands: in front of the throne on Exegol.' },
];

export const TROOPER_ACT_TWO = {
  lothal: 'Break our brothers out of the Lothal prison',
  hoth: 'Join the General in the trenches',
};

// per chapter id: title (only where it differs), brief (the chapter card), and lines (the comms during the chapter)
export const TROOPER_CHAPTERS = {
  // ---------------- ACT I: THE ORDER ----------------
  siege: {
    brief: ['The Empire has found Jedha, and the temple that hid us. The Jedi are holding the steps.',
            'Eight years ago we failed to save a temple. Not this one. Form up on the stair.'],
    lines: {
      wave: [
        ['Squads on the pilgrim road. Same armour we used to wear. Do not let that slow your trigger.'],
        ['Shields in the second line. Frag them, flank them, or go through them.',
         { who: 'SGT. VANT', say: 'Captain, the Jedi are moving their archive out the back. They need ten minutes.' }],
      ],
      clear: ['The stair holds. The Jedi saw who held it with them.', 'Smoke over the east wing. They are burning the archive.'],
    } },
  archive: {
    title: 'THE BURNING ARCHIVE',
    brief: ['The archivists are carrying out what they can. Cover them.',
            'And keep your head down. I heard a voice on their channel I have not heard since the night of the order.'],
    lines: {
      wave: [
        ['Keep them off the archivists.', { who: 'THE MARSHAL', rival: true, say: 'Is that you on the stair, brother? I knew you would not stay buried.' }],
        ['The Marshal. Same batch as you, same tank on Kamino. He kept his chip. Do not answer him. Hold.'],
      ],
      clear: ['The archivists are out.', 'The Marshal is with an Inquisitor, and they are going for the younglings at the refuge. Move.'],
    } },
  refuge: {
    brief: ['The younglings reached the refuge, and the Empire followed them.',
            'One transport left. Hold the ramp until it lifts, whatever comes up that path.'],
    lines: {
      duel: [{ who: 'THE MARSHAL', rival: true, say: 'You were the best of us. Step aside, and I will tell them you died in the order.' }],
      escape: ['Let it go. The transport matters more.'],
      clear: ['The transport is clear. The refuge has a keeper, and it does not trust soldiers.'],
    } },
  'trial-first': {
    title: 'THE KEEPER\'S TEST',
    brief: ['The refuge\'s keeper watched clones march into its temple once. It will not give its younglings to one it has not tested.',
            'Show it you are not the clone it remembers.'],
    lines: {
      clear: ['The Wall stands aside. It says you fight to protect, not to obey.', 'And it has heard where the General is. Hoth.'],
    } },

  // ---------------- ACT II: THE LOST BROTHERS ----------------
  lothal: {
    brief: ['Three of ours were taken on Lothal, Patch our medic among them. The outpost is holding them for reconditioning.',
            'A slicer droid has the cell codes. Walk it in, open every door, and bring our brothers out.'],
    lines: {
      chapter: ['The droid is RX-4. It knows the codes. Keep it breathing and it opens the cells.'],
      duel: ['The captain who held the keys. Put it down and our brothers walk.'],
      clear: ['The cells are empty. Patch is with us, and he has already started on the squad\'s wounds.'],
    } },
  'trial-acrobat': {
    title: 'BROTHERS IN ARMS',
    brief: ['The prison held more than ours: the Acrobat, a Jedi the Empire never broke.',
            'It wants to see whether the clone who freed it can keep up. Keep up.'],
    lines: {
      clear: ['The Acrobat laughs. It has not fought beside a clone since the war. It will fly with us.'],
    } },
  hoth: {
    brief: ['The rebel company holding Hoth is what is left of our old one, and the General is with them.',
            'Eight years, brother. Go and stand in the trench beside them.'],
    lines: {
      chapter: [{ who: 'THE KNIGHT', say: 'I would know that armour anywhere. Hold the forward trench with me, trooper, and we will talk after.' }],
      duel: [{ who: 'THE KNIGHT', say: 'Their siege trooper. I have the left. Just like old times.' }],
      clear: ['The line held, and the General saw you hold it.', { who: 'THE KNIGHT', say: 'The hangar, when the last transport loads. There is a Jedi gathering the masters, and I want you to meet them.' }],
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
      clear: ['The forge is ash, and it was too easy.', 'It was bait. The Marshal has the refuge\'s trail, and he is taking it to his master.'],
    } },

  // ---------------- ACT III: BROTHERS' END ----------------
  chase: {
    brief: ['The Marshal\'s hunter droid has the refuge\'s trail in its memory. It is at Khel Dar, making for its ship.',
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

export const TROOPER_EPILOGUE = {
  title: 'THE BROTHERS ARE HOME',
  world: 'THE NEW REFUGE, ONE YEAR LATER',
  lines: ['The Marshal is gone. I wish there had been another way to bring him home.',
          'Patch runs the infirmary. Hammer teaches the younglings to stand a line, and the General teaches them everything else.',
          'And you took your helmet off for the first time in nine years. The younglings still say you look just like the rest of us. You don\'t.'],
};

/* lay the trooper's words over the shared campaign (data/campaign.js calls this once, as it loads) */
export function mergeTrooperStory(ACTS, ACT_TWO, CHAPTERS, EPILOGUE){
  TROOPER_ACTS.forEach((a, i) => { if (!ACTS[i]) return; ACTS[i].title.trooper = a.title; ACTS[i].open.trooper = a.open; });
  for (const k in TROOPER_ACT_TWO) if (ACT_TWO[k]) ACT_TWO[k].line.trooper = TROOPER_ACT_TWO[k];
  for (const c of CHAPTERS){
    const t = TROOPER_CHAPTERS[c.id];
    if (!t) continue;
    if (t.title){ if (typeof c.title !== 'object') c.title = { jedi: c.title, mando: c.title }; c.title.trooper = t.title; }
    if (t.brief && c.brief) c.brief.trooper = t.brief;
    if (!t.lines || !c.lines) continue;
    for (const k in t.lines){
      if (k === 'wave'){
        if (!c.lines.wave) continue;
        t.lines.wave.forEach((w, i) => { if (c.lines.wave[i]) c.lines.wave[i].trooper = w; });
      } else if (c.lines[k]) c.lines[k].trooper = t.lines[k];   // (a beat the chapter doesn't have stays unsaid)
    }
  }
  for (const k of ['title', 'world', 'lines']) EPILOGUE[k].trooper = TROOPER_EPILOGUE[k];
}
