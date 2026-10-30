// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CAMPAIGN, as data: three acts of chapters, played in order (game/campaign.js runs them). Edit the words freely.
//
// A chapter is one of
//   waves     a stretch of a wave level: `level` (index into data/levels.js) and `waves: [from, to]` (to is exclusive).
//             The level's boss steps in only when the chapter runs to the level's last wave.
//   mission   a story mission (data/missions.js) by id. In the campaign it keeps your build instead of the mission's
//             fixed kit, and ends on the next chapter's card instead of the victory screen.
// `title` and `world` can differ per hero ({ jedi, mando }); `brief` is the voice's lines on the chapter's card, per hero.
// `pair` puts a chapter in one of Act II's two pairs, which the player plays in the order they pick (ACT_TWO).
// `standIn` notes what the chapter borrows until its own arena or fighter lands (the plan's later phases).
// `lines` is what's said during the chapter, on the comms strip (game/story.js), per hero. `wave` has one entry per wave
// of the chapter; the rest are story beats: duel (a mission's duel foe steps in) · escape (it breaks off) · boss · clear.
// A line is a string (the voice: VOICE) or { who, say } for anyone else; `rival: true` marks the enemy talking.

export const VOICE = { jedi: 'THE BATTLEMASTER', mando: 'THE ARMORER' };

export const ACTS = [
  { title: { jedi: 'THE FALL OF JEDHA', mando: 'THE BROKEN COVERT' },
    open: { jedi: 'The temple has stood for a thousand years. Tonight the Empire means to end it.',
            mando: 'The covert under the old temple has stayed hidden for a generation. Tonight it was found.' } },
  { title: { jedi: 'THE SCATTERED MASTERS', mando: 'THE SCATTERED CLAN' },
    open: { jedi: 'The Order is scattered. Two masters still live: one in a cell on Lothal, one in the trenches of Hoth. Find them both.',
            mando: 'The clan is scattered. Our ace is caged on Lothal; our champion holds the line on Hoth. Bring them home.' } },
  { title: { jedi: 'THE SEVENTH BLADE', mando: 'THE IRON THRONE' },
    open: { jedi: 'Sit with me a moment. The forge was a feint, and the Inquisitor has found the new refuge. And there is something I should have told you long ago: Vexis was my apprentice.',
            mando: 'The forge was a feint. VX-7 has the foundlings\' trail and is taking it to the Magistrate. We end this on Exegol.' } },
];

// Act II's pick: which pair goes first (the other follows), then the rest of the act
export const ACT_TWO = {
  lothal: { label: 'LOTHAL FIRST', line: { jedi: 'Free the Acrobat from the outpost prison', mando: 'Break the ace out of the outpost prison' } },
  hoth:   { label: 'HOTH FIRST',   line: { jedi: 'Join the Knight in the trenches', mando: 'Join the champion in the trenches' } },
};

export const CHAPTERS = [
  // ---------------- ACT I ----------------
  { id: 'siege', act: 0, kind: 'waves', level: 0, waves: [0, 2], world: 'JEDHA',
    title: 'SIEGE OF THE TEMPLE',
    brief: { jedi: ['The Empire has come to Jedha, and to the temple you swore to keep.', 'Hold the steps, Knight. Everything inside depends on it.'],
             mando: ['The Magistrate\'s army has found the covert under the old temple.', 'The foundlings are below us. Nothing reaches the stair.'] },
    lines: {
    wave: [
      { jedi: ['They come up the pilgrim road. Meet them on the steps.'], mando: ['First squads on the old road. Hold the stair.'] },
      { jedi: ['Heavier troops behind the first line. Do not let them reach the doors.', 'The archivists have begun to move the oldest texts. Keep the steps clear.'], mando: ['They brought shields. Go around them, or go through them.', 'The clan is carrying the forge tools down. Buy them the time.'] } ],
    clear: { jedi: ['The steps are ours, for now.', 'Smoke over the east wing. The archive is burning.'], mando: ['The stair holds.', 'They\'ve set the upper halls alight. Fall back to the forge level.'] } } },
  { id: 'archive', act: 0, kind: 'waves', level: 0, waves: [2, 4], world: 'JEDHA',
    title: { jedi: 'THE BURNING ARCHIVE', mando: 'SMOKE AND STONE' }, standIn: 'the temple steps, until the archive arena',
    brief: { jedi: ['The archive is burning. The archivists are carrying out what they can.', 'Buy them time. And be careful: something came with this army that is not a soldier.'],
             mando: ['They\'re burning the temple to smoke us out. The forge is still below.', 'Hold them while the clan carries out what it can.'] },
    lines: {
    wave: [
      { jedi: ['Keep them off the archivists.', { who: 'THE INQUISITOR', rival: true, say: 'A Knight on the steps. How quaint. The Order sends its children to die for paper.' }], mando: ['Keep them off the bearers.', { who: 'THE INQUISITOR', rival: true, say: 'Mandalorians, under a Jedi temple. The Magistrate will pay twice for this.' }] },
      { jedi: ['That voice. An Inquisitor is with them, watching from the wall. Do not chase it. Hold.'], mando: ['That one in black is a Jedi hunter. Let it watch. Hold the line.'] } ],
    clear: { jedi: ['The archive is lost, but its keepers are out.', 'The Inquisitor has gone after the younglings. To the refuge, quickly.'], mando: ['The bearers are clear.', 'The hunter went after the foundlings. Get to the refuge.'] } } },
  { id: 'refuge', act: 0, kind: 'mission', mission: 'refuge', world: 'THE HIDDEN REFUGE',
    title: 'THE LAST EVACUATION',
    brief: { jedi: ['The younglings reached the refuge. So did the Empire.', 'The last transport is still loading. Hold the ramp, and if that masked Inquisitor shows itself again, meet it.'],
             mando: ['The foundlings reached the refuge, and the Magistrate\'s hunters followed.', 'One transport left. Hold the ramp.'] },
    lines: {
    duel: { jedi: [{ who: 'THE INQUISITOR', rival: true, say: 'You led me here, Knight. Every one of them is mine now.' }], mando: [{ who: 'THE INQUISITOR', rival: true, say: 'The children of the clan, and their tin guardian. I will take them all.' }] },
    escape: { jedi: ['Let it go. The transport matters more than the kill.', { who: 'THE INQUISITOR', rival: true, say: 'Run, then. I know where your little ships are going.' }], mando: ['Let it run. The foundlings come first.', { who: 'THE INQUISITOR', rival: true, say: 'Fly away, children. I will be waiting where you land.' }] },
    clear: { jedi: ['The refuge has a keeper. It will want to know who you are.'], mando: ['A hunter of the old clans guards the covert door. It will have words with you.'] } } },
  { id: 'trial-first', act: 0, kind: 'mission', mission: 'trial-wall', world: 'THE HIDDEN REFUGE',
    title: { jedi: 'TRIAL OF THE WALL', mando: 'THE CHALLENGE' }, trial: true,
    brief: { jedi: ['The refuge\'s keeper will not hand the younglings to a knight it has not tested.', 'The Wall has held that door for twenty years. Show it you can hold one too.'],
             mando: ['A hunter of the old clans waits at the covert door. By our custom it may challenge whoever leads the foundlings out.', 'Answer it.'] },
    lines: {
    clear: { jedi: ['The Wall stands aside. It says you hold a door the way it does.', 'It will take the younglings on. And it has heard where the other masters are.'], mando: ['The challenger yields, and the clan has one more blade.', 'It knows where the others went.'] } } },

  // ---------------- ACT II ----------------
  { id: 'lothal', act: 1, kind: 'mission', mission: 'grassland', pair: 'lothal', world: 'LOTHAL',
    title: 'THE LOTHAL BREAKOUT', standIn: 'today\'s Extraction, until the breakout rework',
    brief: { jedi: ['The Acrobat is held in the outpost on Lothal. A slicer droid carries the codes to its cell.', 'Get the droid and its codes to the shuttle. Hold the pad until it lands.'],
             mando: ['Our ace is caged in the Lothal outpost. The droid knows the cell codes.', 'Get it to the shuttle. Keep it breathing.'] },
    lines: {
    clear: { jedi: ['The codes are on the shuttle. The Acrobat is free, and furious.'], mando: ['The ace is out. It has a temper.'] } } },
  { id: 'trial-acrobat', act: 1, kind: 'mission', mission: 'trial-acrobat', pair: 'lothal', world: 'LOTHAL',
    title: { jedi: 'TRIAL OF THE ACROBAT', mando: 'THE JET ACE' }, trial: true,
    brief: { jedi: ['You freed the Acrobat. Now the Acrobat wants to see what you are.', 'It will not stand still. Neither should you.'],
             mando: ['The ace is free, and wants to know who came for it.', 'Out here that means a fight. Keep it on the ground.'] },
    lines: {
    clear: { jedi: ['The Acrobat laughs for the first time in a year. It will fly with us.'], mando: ['The ace is grounded and grinning. It rides with the clan.'] } } },
  { id: 'hoth', act: 1, kind: 'mission', mission: 'icefront', pair: 'hoth', world: 'HOTH',
    title: 'THE TRENCH LINE',
    brief: { jedi: ['The Knight is holding Hoth\'s trenches with what is left of a rebel company.', 'Fight beside them. A general judges you by the line you hold.'],
             mando: ['Our champion holds the trenches on Hoth with the rebels.', 'Fight at its side, and it will hear you out.'] },
    lines: {
    clear: { jedi: ['The line held. The Knight saw it.'], mando: ['The trenches held. The champion watched you hold them.'] } } },
  { id: 'trial-knight', act: 1, kind: 'mission', mission: 'trial-knight', pair: 'hoth', world: 'HOTH',
    title: { jedi: 'TRIAL OF THE KNIGHT', mando: 'THE CLAN CHAMPION' }, trial: true,
    brief: { jedi: ['The line held. The Knight will meet you between the last transports.', 'It fights blade to blade, and punishes a careless block.'],
             mando: ['The champion won\'t follow anyone it hasn\'t fought.', 'Beskar to beskar, then.'] },
    lines: {
    clear: { jedi: ['The Knight lowers its blade. Two masters found, and the Order is a little less scattered.'], mando: ['The champion takes your hand. The clan is nearly whole.'] } } },
  { id: 'jakku', act: 1, kind: 'mission', mission: 'graveyard', world: 'JAKKU',
    title: 'SALVAGE RIGHTS',
    brief: { jedi: ['Vexis is building an army somewhere. The old nav cores in Jakku\'s wrecks remember where his ships go.', 'Pull the cores before his salvage crews burn them.'],
             mando: ['The Magistrate\'s beskar is forged somewhere. Jakku\'s wrecks remember the route.', 'Take the cores. Get out on the freighter.'] },
    lines: {
    clear: { jedi: ['The cores are clean. Every route ends in the same place: Mustafar.'], mando: ['The cores give up the route. Mustafar.'] } } },
  { id: 'mustafar', act: 1, kind: 'waves', level: 1, waves: [0, 4], world: 'MUSTAFAR',
    title: 'THE MUSTAFAR FORGE', standIn: 'the foundry waves, until the forge mission',
    brief: { jedi: ['The cores point to Mustafar. His war machines are forged here.', 'Break the forge, and the army breaks with it.'],
             mando: ['Mustafar. Our beskar, melted down for his machines.', 'Tear the forge down.'] },
    lines: {
    wave: [
      { jedi: ['The forge is guarded by its own workers. Do not let the heat drive you into the vents.'], mando: ['They pour beskar into the moulds here. Our beskar. Burn it down.'] },
      { jedi: ['Good. Keep moving. Stand still on this rock and it will cook you.'], mando: ['Keep moving. The ground here is not your friend.'] },
      { jedi: [{ who: 'THE INQUISITOR', rival: true, say: 'Still following, Knight? You are walking into a trap he built for you.' }], mando: [{ who: 'VX-7', rival: true, say: 'TARGET CONFIRMED. MANDALORIAN. BOUNTY: DOUBLED.' }] },
      { jedi: ['The last of the foundry guard. Then the forge falls.'], mando: ['Last of them. Then we bring the roof down.'] } ],
    clear: { jedi: ['The forge is ash. But it was too easy.', 'This was never his army. It was a lure.'], mando: ['The forge is ash, and it was too easy.', 'This was bait.'] } } },

  // ---------------- ACT III ----------------
  { id: 'chase', act: 2, kind: 'mission', mission: 'pursuit', world: 'KHEL DAR',
    title: 'THE LONG CHASE',
    brief: { jedi: ['The Inquisitor is carrying the refuge\'s coordinates to Vexis. It is at Khel Dar, making for its ship.', 'Run it down. It does not leave that spaceport.'],
             mando: ['VX-7 has the foundlings\' trail in its memory. It\'s at Khel Dar.', 'Run it down before it reaches its ship.'] },
    lines: {
    duel: { jedi: [{ who: 'THE INQUISITOR', rival: true, say: 'Enough running. Come and take your coordinates, Knight.' }], mando: [{ who: 'VX-7', rival: true, say: 'ESCAPE VECTOR DENIED. ENGAGING.' }] },
    clear: { jedi: ['The coordinates never reach him.', 'Now we go to him.'], mando: ['The trail dies with the droid.', 'Now we go to him.'] } } },
  { id: 'spearhead', act: 2, kind: 'mission', mission: 'strike', world: 'THE ROAD TO EXEGOL',
    title: 'SPEARHEAD', standIn: 'the Lothal grass sea, until the Exegol approach map',
    brief: { jedi: ['The masters you found are with you now, and so are the troopers who held Hoth.', 'Break the line before the gate. Vexis is waiting behind it.'],
             mando: ['The clan rides together again.', 'Take their line, take their gate. The Magistrate is behind it.'] },
    lines: {
    clear: { jedi: ['The gate is open. Gather the masters.'], mando: ['The gate is down. The clan rides in together.'] } } },
  { id: 'exegol', act: 2, kind: 'waves', level: 2, waves: [0, 4], world: 'EXEGOL',
    title: 'THRONE OF EXEGOL',
    brief: { jedi: ['An army stands before you, and Vexis stands behind it.', 'Whatever waits on that throne, you are not facing it alone.'],
             mando: ['The Magistrate holds Exegol with everything he has left.', 'Through the army, then through him. This is the Way.'] },
    lines: {
    wave: [
      { jedi: ['This is where the Sith once ruled. Do not listen to the voices in the stone.'], mando: ['The Magistrate\'s guard. Best he has left.'] },
      { jedi: ['The masters are with you. The Wall holds the left, the Knight the right.'], mando: ['The champion takes the left flank, the ace the sky.'] },
      { jedi: ['He is sending everything now. That means he is afraid.'], mando: ['Everything he has. That\'s fear.'] },
      { jedi: ['The last of his guard. Remember what I taught him, and what I did not.'], mando: ['The last line. Then the throne.'] } ],
    boss: { jedi: ['He comes. Vexis. My apprentice, once.', 'Catch his lightning, and do not let him make you angry.'], mando: ['The Magistrate himself. His armour turns blaster fire.', 'Make him come to you. Then break him.'] } } },
];

// after the last chapter's boss: the epilogue's card, before the victory screen (game/campaign.js showEpilogue)
export const EPILOGUE = {
  title: { jedi: 'THE ORDER ENDURES', mando: 'THE CLAN IS WHOLE' },
  world: { jedi: 'JEDHA, ONE YEAR LATER', mando: 'THE NEW COVERT' },
  lines: { jedi: ['Vexis is gone. I wish I had found a gentler way to end what I began with him.',
                  'The Wall teaches the younglings to hold. The Acrobat teaches them to fall and rise again. The Knight teaches them to stand their ground.',
                  'And you, who were sent to keep a temple, have kept something better. The Order endures because you did.'],
           mando: ['The Magistrate is gone, and the beskar he stole is back in the forge.',
                   'The ace flies patrol. The champion trains the foundlings. Every one of them is home.',
                   'You did not choose this clan. You kept it anyway. This is the Way.'] },
};

// the order a run plays them in: Act II's pairs follow the player's pick (default Lothal first, before the pick is made)
export function chapterOrder(first){
  const lothal = CHAPTERS.filter(c => c.pair === 'lothal'), hoth = CHAPTERS.filter(c => c.pair === 'hoth');
  const pairs = first === 'hoth' ? [...hoth, ...lothal] : [...lothal, ...hoth];
  const at = CHAPTERS.findIndex(c => c.pair);
  return [...CHAPTERS.slice(0, at), ...pairs, ...CHAPTERS.slice(at).filter(c => !c.pair)];
}
// where the pick is made: the first chapter of Act II
export const ACT_TWO_AT = CHAPTERS.findIndex(c => c.pair);
// a save from before the chapters (data/levels.js index) picks up on the chapter that opens that level
export const CHAPTER_OF_LEVEL = [0, CHAPTERS.findIndex(c => c.id === 'mustafar'), CHAPTERS.findIndex(c => c.id === 'exegol')];
export const forHero = (v, hero) => v && typeof v === 'object' && !Array.isArray(v) ? v[hero] : v;
