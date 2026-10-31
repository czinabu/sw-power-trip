// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TRAINING: the training grounds' lessons for each hero, as data. game/tutorial.js runs them; edit the words and counts freely.
//
// Each hero trains in their own place (world/arenas/hall.js, forge.js) and is taught by a voice of their order: the
// line in `say` is theirs, in character; `keys` and `do` underneath are the plain instruction. A step passes when the
// game sees the move actually work `need` times (a block doesn't count for a parry), never on a timer.
//
// LESSONS — the training is a set of short lessons, each a handful of steps, picked from the LESSON BOARD between them
// (game/tutorial.js). A first visit plays the BASICS straight through; after that the board opens on arrival.
//   id       saved as done in localStorage sw_lesson_<hero>_<id>
//   name / sub   the board's card · group: 'basics' or the advanced group (FORMS for the Jedi, ARSENAL for the Mando)
//   form     a lightsaber form lesson: it opens once the story has taught that form (game/sandbox-unlocks.js
//            formOffered), and it never names a form the hero hasn't learned (the board shows a sealed card instead)
//   kit / any   a gear or power lesson: it opens once the story has reached that unlock (an auto-unlock key or a store
//            id from data/store.js), or any of the ids in `any`
//   loadout  the three forms on 1 / 2 / 3 while it runs (Jedi). The basics teach in Shii-Cho alone
//   holstered  (Jedi) the saber starts on the belt, unignited; lessons without it start with the blade drawn
//   done     the teacher's line when it's passed
//
// Step fields
//   sec    starts a new section: its name is shown as a banner when the step begins
//   say    the teacher's line · keys: keycaps ('/' and '+' stay as separators, '·' splits groups) · do: the task
//   needs  the step only runs once the story has reached this form or unlock (else the lesson skips it)
//   ev     a training event to count (game/tutor-bus.js): doubleJump dash slide vault climb roll wallrun finisher parry
//          deflect perfectDodge cancel pushHit kill headshot vent shieldReflect catch charge takedown bash rocketHit
//          kick riposte swoop shatter palmHit chargedPalm palmPush pullStrike grab headbutt throw
//          cutHit (data.dir: which key picked a cut that landed) cutHeight (data.h: high / mid / low, where it was aimed)
//          guardBreak (a duellist's guard shattered)
//   alt    a second event that also passes the step (sparDown: a sparring partner beaten to its last sliver)
//   of     with ev 'kill': only foes of this type count · stance / weapon: only while in that saber form / loadout
//   air    only counts off the ground · grip: only while the saber is held in this grip ('reverse')
//   uniq   count each different value of this event field once (cutHit 'dir': three different cuts)
//   use    a power used, counted each time it starts: ['cd', key] its cooldown starts · ['flag', f] player[f] turns on
//   poll   a held state to time instead, in seconds: glide sprint strafe boost single holstered drawn · stance (G.stance is
//          `stance`) · grip (the saber held in `grip`) · or 'refuel' (burn the jetpack below a quarter, then land and
//          let it fill)
//   reach  [x, z, top?]: get there, standing on a surface that high if given (a beacon marks it) · mark: [x, z, y?] a
//          beacon that only guides
//   course a run of checkpoints, one beacon at a time: { at: [x, z, top?], keys, do, r, slide, after, land, hint }
//            slide  pass it sliding (the slide gate) · after: an event to do on the way there (vault the blocks)
//            land   be on the ground there · hint: what to tell a player who got there without doing it
//   clear  done when every foe on the field is down (the trial) · heal: start the step at full health, Force and fuel
//   spawn  [{ type, at: [x, z], dummy, sparring, rooted }] placed when the step starts, cleared when it ends:
//            dummy    stands and takes it (never attacks)
//            sparring can't be destroyed (it fights back, so you can practise against it as long as it takes)
//            rooted   holds its ground (a blaster that stays put)
//          or 'wave' with `wave: { type: count }`: they march in from the edge like a real wave
//   respawn put a dummy back when one falls before the step is done
//   loadout  (Jedi) swap the three forms as the step starts · give: { unlocked: {…}, up: {…} } hands over gear or a
//          power for the step (a store fork's other half is switched off: X and V each fire one of a pair)
//   grant  'jet1' fits Jetpack Booster I (a real run earns it by wave 3) · 'dual' hands the Mando his second blaster
//   toast  a mastery id (data/mastery.js): as the step passes, the corner note its rank I would show in a real fight, the
//          training's preview of how a power grows by use

export const TRAINING_LEVELS = {
  jedi: { name: 'TRAINING — THE TRAINING HALL', sub: 'Above the clouds, the temple keeps its oldest lessons.',
          arena: 48, floor: 0x9a948a, fog: 0xc4b8c0, sky: 0x35609e, layout: 'hall', waves: [], hazards: {} },
  mando: { name: 'TRAINING — THE ARMORER\'S FORGE', sub: 'The covert hides its forge from the stars.',
           arena: 48, floor: 0x55504c, fog: 0x3a2420, sky: 0x060814, layout: 'forge', waves: [], hazards: {} },
  // the clone trooper (testing): the band's hidden range, laid out on the forge's yard until it has a place of its own
  trooper: { name: 'TRAINING — THE HIDDEN RANGE', sub: 'Deserters keep their edge where no one is looking.',
           arena: 48, floor: 0x4c5056, fog: 0x1c2a36, sky: 0x060a14, layout: 'forge', waves: [], hazards: {} },
};

export const TEACHER = { jedi: 'THE BATTLEMASTER', mando: 'THE ARMORER', trooper: 'THE CAPTAIN' };
export const BEACON = { jedi: 0x5ad2ff, mando: 0xffa040, trooper: 0x4aa8ff };
// the board's group names: the basics, then what the story opens
export const LESSON_GROUPS = {
  jedi:  { basics: 'THE BASICS', more: 'THE FORMS AND POWERS', sealed: 'A FORM NOT YET LEARNED', sealedPower: 'A POWER NOT YET EARNED' },
  mando: { basics: 'THE BASICS', more: 'THE ARSENAL', sealed: 'GEAR NOT YET FORGED', sealedPower: 'GEAR NOT YET FORGED' },
  trooper: { basics: 'THE BASICS', more: 'THE DRILLS', sealed: 'NOT YET ISSUED', sealedPower: 'NOT YET ISSUED' },
};

const CIRCLE = [[-2.2, -2.5], [0, -3.2], [2.2, -2.5]];   // three spots across the duelling circle, facing the player
const CROWD = [[-1.2, -3], [1.2, -3], [-0.6, -4.4], [0.6, -4.4]];   // a tight knot of four, for a sweeping finisher
const dummies = (spots, o = {}) => spots.map(at => ({ type: 'grunt', at, dummy: true, ...o }));
const partner = (type = 'grunt', at = [0, -4]) => [{ type, at, sparring: true }];
const shooter = (at = [0, -9]) => [{ type: 'blaster', at, sparring: true, rooted: true }];
const BASE = ['shiicho', null, null];   // the basics teach in Shii-Cho, Form I, the form every initiate starts with

export const LESSONS = {
  jedi: [
    /* ---------------- THE BASICS ---------------- */
    { id: 'steps', group: 'basics', name: 'FIRST STEPS', sub: 'Walk, jump, dash, sprint, slide and glide', loadout: BASE, holstered: true,
      done: 'Good. Your feet know the Force now. Next, the lanes.',
      steps: [
        { sec: 'THE TERRACE', say: 'Every lesson begins with a single step. Come to the circle.',
          keys: 'W A S D · MOUSE', do: 'Walk to the light', reach: [0, 0] },
        { say: 'The Force lifts those who let it. Jump, and at the top of the rise, jump again.',
          keys: 'SPACE + SPACE', do: 'Double-jump', ev: 'doubleJump', need: 2 },
        { say: 'A Jedi is never where the blow falls. Step aside in an instant, any way you choose.',
          keys: 'SHIFT', do: 'Dash: press SHIFT while holding any direction (or none)', ev: 'dash', need: 3 },
        { say: 'Run with your whole body.',
          keys: 'W', do: 'Sprint: hold W to run forward (you run by default; Q switches to a walk and back, so tap it again if you are walking)', poll: 'sprint', need: 1.5 },
        { say: 'Now drop low and let the Force carry you, far past where your legs would. The dash is for dodging; the slide is for distance, and it bowls over whoever stands in the way.',
          keys: 'W · Z', do: 'Force-slide: press Z during a sprint (not while strafing with ALT or walking)', ev: 'slide', need: 2 },
        { say: 'Reach for the Force as you leave the ground, and it will hold you.',
          keys: 'HOLD SPACE', do: 'Force-leap and glide', poll: 'glide', need: 1.2 },
        { say: 'In a fight, never turn your back. Keep your eyes on the foe and let your feet circle.',
          keys: 'HOLD ALT + A / D / S', do: 'Strafe: hold ALT and sidestep or backpedal while you keep facing the crosshair (LB on a controller)', poll: 'strafe', need: 1.5 },
      ] },
    { id: 'lanes', group: 'basics', name: 'THE LANES', sub: 'Vault, climb, roll, run the wall, then the gauntlet', loadout: BASE, holstered: true,
      done: 'You flow over the ground like water. Now, the blade.',
      steps: [
        { sec: 'THE LANES', say: 'Stones in your path are only stones. Do not jump them: run straight at one and flow over it without breaking stride.',
          keys: 'W · SPACE', do: 'Run right up to a block on the west lane and press SPACE at its edge to vault it', ev: 'vault', need: 2, mark: [-12, 8.5] },
        { say: 'Climb the watchtower. Catch each ledge and pull yourself up.',
          keys: 'SPACE · W', do: 'Reach the top of the watchtower', reach: [-17.4, -16, 7.4] },
        { say: 'From this height a fall breaks the careless. Step off, and roll as you meet the ground.',
          keys: 'SHIFT', do: 'Drop off the sheer north side, and press SHIFT just before you land', ev: 'roll', need: 1, mark: [-17.4, -11] },
        { say: 'A wall is a path for those who move fast enough. Run along the long wall.',
          keys: 'W + SPACE', do: 'Run at the east wall, jump alongside it and hold W', ev: 'wallrun', need: 2, mark: [12.2, 7.5] },
        { sec: 'THE GAUNTLET', say: 'Now all of it, without stopping. Under, over, up, down, along the wall, and back to me.',
          course: [
            { at: [-8, 11], r: 1.6, slide: true, keys: 'W · Z', do: 'Sprint west and Force-slide under the bar', hint: 'SLIDE UNDER IT' },
            { at: [-12, -8.5], after: 'vault', keys: 'W · SPACE', do: 'Vault the blocks down the west lane', hint: 'VAULT THE BLOCKS' },
            { at: [-17.4, -16, 7.4], keys: 'SPACE · W', do: 'Climb the watchtower' },
            { at: [-17.4, -9.5], r: 3, after: 'roll', land: true, keys: 'SHIFT', do: 'Drop off the north side and roll as you land', hint: 'ROLL AS YOU LAND' },
            { at: [12.2, 8], r: 2.2, after: 'wallrun', keys: 'W + SPACE', do: 'Run along the east wall', hint: 'RUN THE WALL' },
            { at: [0, 0], keys: 'W', do: 'Back to the circle' },
          ] },
      ] },
    { id: 'blade', group: 'basics', name: 'SHII-CHO · THE BLADE', sub: 'Cuts, their angles and heights, the finisher', loadout: BASE,
      done: 'Shii-Cho is the root of every form. Never forget it. Now, the guard.',
      steps: [
        { sec: 'THE BLADE', say: 'This is Shii-Cho, the first form, the one every initiate learns. Your saber is an extension of your will. Cut down the targets.',
          keys: 'LMB', do: 'Destroy 3 targets', ev: 'kill', need: 3, spawn: dummies(CIRCLE) },
        { say: 'Your feet choose the cut. Strafe and the blade sweeps sideways, step in and it chops down, step back and it whirls behind you.',
          keys: 'A / D / W + LMB', do: 'Land cuts in 3 different directions: hold A, D or W as you click', ev: 'cutHit', uniq: 'dir', need: 3, respawn: true,
          spawn: dummies(CIRCLE, { sparring: true }) },
        { say: 'Where your eyes go, the blade follows. Lift your gaze and it cuts high; lower it and it sweeps low.',
          keys: 'AIM + LMB', do: 'Land a high, a middle and a low cut: aim up, level, then down (the ticks by the crosshair show which)', ev: 'cutHeight', uniq: 'h', need: 3, respawn: true,
          spawn: dummies(CIRCLE, { sparring: true }) },
        { say: 'Three cuts make a string, and in Shii-Cho the third is the Sarlacc Sweep: it cuts all the way round you. It was made for crowds.',
          keys: 'LMB LMB LMB', do: 'Land 2 Sarlacc Sweep finishers on the crowd', ev: 'finisher', need: 2, respawn: true,
          spawn: dummies(CROWD, { sparring: true }) },
      ] },
    { id: 'guard', group: 'basics', name: 'GUARD AND COUNTER', sub: 'Parry, deflect, dodge, cancel and kick', loadout: BASE,
      done: 'A good guard wins more fights than a good cut. Now, the Force.',
      steps: [
        { sec: 'THE GUARD', say: 'A held guard only slows a blow. Meet it the moment it lands, and it is yours.',
          keys: 'TAP RMB', do: 'Parry 3 strikes from your sparring partner', ev: 'parry', need: 3, spawn: partner() },
        { say: 'Blaster fire is only light. Turn it back on the hand that sent it.',
          keys: 'TAP RMB', do: 'Deflect 3 bolts', ev: 'deflect', need: 3, spawn: shooter() },
        { say: 'Let the strike pass through where you were. Move as it falls, not before.',
          keys: 'SHIFT', do: 'Perfect dodge: roll just as a blow lands', ev: 'perfectDodge', need: 1, spawn: partner() },
        { say: 'No cut must be finished. Break it off, and guard.',
          keys: 'LMB · RMB', do: 'Start a swing, then cancel it into your guard', ev: 'cancel', need: 1 },
        { say: 'Your feet are weapons too. A kick shoves a foe off balance, and it cracks a blade\'s guard.',
          keys: 'E', do: 'Kick your sparring partner twice', ev: 'kick', need: 2, spawn: partner() },
      ] },
    { id: 'force', group: 'basics', name: 'THE FORCE', sub: 'Push, fighting holstered, and how your powers grow', loadout: BASE,
      done: 'The Force is your ally, and a powerful ally it is. Now, a real opponent.',
      steps: [
        { sec: 'THE FORCE', say: 'The Force is not a weapon. But it can move one.',
          keys: 'F', do: 'Hit 3 targets with Force Push', ev: 'pushHit', need: 3, respawn: true, spawn: dummies(CIRCLE) },
        { say: 'A power grows the more you use it. In a real fight, use one enough and it is mastered: a note in the corner tells you what changed. Push them again.',
          keys: 'F', do: 'Hit 5 more targets with Force Push', ev: 'pushHit', need: 5, respawn: true, spawn: dummies(CIRCLE),
          toast: 'push' },
        { needs: 'pull', say: 'What you push away, you may also draw near. Tap to pull a foe to you; hold, and you hold them.',
          keys: 'C', do: 'Pull 3 times', use: ['cd', 'pull'], need: 3, respawn: true, spawn: dummies([[0, -8], [-3, -9], [3, -9]]) },
        { sec: 'HOLSTERED', say: 'Put the blade away. A Jedi is never unarmed: with both hands free, the Force flows through them harder.',
          keys: '4', do: 'Holster your saber', poll: 'holstered', need: 0.3 },
        { say: 'Strike with the Force in your palms. Jab, cross, and the key you hold picks the finisher.',
          keys: 'LMB LMB · W / A / D / S + LMB', do: 'Land 6 Force strikes on your partner', ev: 'palmHit', need: 6, respawn: true,
          spawn: dummies([[0, -3]], { sparring: true }) },
        { say: 'Gather it. Hold, and let it build in your hands, then release it all at once. A full charge breaks a guard and turns blaster fire.',
          keys: 'HOLD LMB · RELEASE', do: 'Fire a charged palm', ev: 'chargedPalm', need: 1,
          spawn: dummies([[0, -3.4]], { sparring: true }) },
        { say: 'Land a blow and push straight out of it. The strike flows into the power, and it costs you less.',
          keys: 'LMB · F', do: 'Land a strike, then Push right after it: a Palm Push', ev: 'palmPush', need: 1, respawn: true,
          spawn: dummies([[0, -3]], { sparring: true }) },
        { say: 'Now draw again.',
          keys: '4', do: 'Draw your saber', poll: 'drawn', need: 0.3 },
      ] },
    { id: 'duel', group: 'basics', name: 'THE DUEL', sub: 'Read a guard, break it, win the duel', loadout: BASE,
      done: 'You read its guard and broke it. Remember how.',
      steps: [
        { sec: 'THE DUEL', say: 'A Magnaguard blocks one side at a time. The pale arc shows which. Kick through its guard, or cut where the arc is not.',
          keys: 'E · W / A / D + LMB', do: 'Break its guard: kick it (E) twice in a row',
          ev: 'guardBreak', alt: 'sparDown', need: 1, spawn: partner('duelist', [0, -6]) },
        { say: 'When the guard breaks, it reels. Strike then. If your blades lock, mash LMB.',
          keys: 'E · LMB', do: 'Defeat the Magnaguard', ev: 'kill', of: 'duelist', need: 1,
          spawn: [{ type: 'duelist', at: [0, -6] }] },
      ] },
    { id: 'trial', group: 'basics', name: 'THE TRIAL', sub: 'Everything at once, against real foes',
      done: 'You are ready. Each form the masters teach you out there opens a new lesson here. Come back when you learn one. May the Force be with you.',
      steps: [
        { sec: 'THE TRIAL', say: 'No more lessons. Troopers first. Use your blade, the Force and your feet. Each wave you clear in a real fight, and each clean parry or dodge, earns skill points to spend when a chapter ends.',
          keys: '', do: 'Defeat the troopers', clear: true, heal: true, spawn: 'wave', wave: { grunt: 3, blaster: 1 } },
        { say: 'And now a blade. Read its guard, as I showed you.',
          keys: '', do: 'Defeat the Magnaguard', clear: true, heal: true, spawn: 'wave', wave: { duelist: 1 } },
      ] },

    /* ---------------- THE FORMS — each opens when the story teaches it (data/forms.js FORM_PATH) ---------------- */
    { id: 'soresu', group: 'more', form: 'soresu', name: 'FORM III · SORESU', sub: 'The wall: a guard that outlasts every attack', loadout: ['shiicho', 'soresu', null],
      done: 'Soresu does not win quickly. It does not lose at all.',
      steps: [
        { sec: 'SORESU', say: 'Soresu is the wall. Hold your guard against blaster fire and the bolts go home on their own.',
          keys: '2 · HOLD RMB', do: 'In Soresu, turn 4 bolts with your guard', ev: 'deflect', stance: 'soresu', need: 4, spawn: shooter() },
        { say: 'Every blow it blocks tires the one who throws it. Let your partner wear himself out on your blade.',
          keys: 'TAP RMB', do: 'In Soresu, parry 3 strikes', ev: 'parry', stance: 'soresu', need: 3, spawn: partner() },
      ] },
    { id: 'ataru', group: 'more', form: 'ataru', name: 'FORM IV · ATARU', sub: 'The acrobat: cuts in the air and the Hawk-Bat Swoop', loadout: ['shiicho', 'ataru', null],
      done: 'Ataru is joy in motion. Never stand still with it.',
      steps: [
        { sec: 'ATARU', say: 'Ataru is the form of the acrobat. Its cuts land harder in the air. Leap, and strike as you fall.',
          keys: '2 · SPACE · LMB', do: 'In Ataru, land 3 cuts off the ground', ev: 'cutHit', air: true, stance: 'ataru', need: 3, respawn: true,
          spawn: [...dummies(CIRCLE, { sparring: true }), { type: 'flyer', at: [0, -8], sparring: true }] },   // (a jet trooper hovers at your height: cuts in the air reach it too)
        { say: 'Dash, and cut out of the dash. That is the Hawk-Bat Swoop: it springs you off the ground and drives you in twice as far.',
          keys: 'SHIFT · LMB', do: 'In Ataru, land 2 Hawk-Bat Swoops', ev: 'swoop', stance: 'ataru', need: 2, respawn: true,
          spawn: dummies([[0, -6], [-2.5, -6.5], [2.5, -6.5]], { sparring: true }) },
        { say: 'Ataru was made for the ones who hang back: snipers, officers, grenadiers. Reach them fast and they fall.',
          keys: 'SHIFT · LMB', do: 'In Ataru, bring down the sniper and the officer', ev: 'kill', stance: 'ataru', need: 2, respawn: true,
          spawn: [{ type: 'sniper', at: [-3, -11], dummy: true }, { type: 'officer', at: [3, -11], dummy: true }] },
      ] },
    { id: 'formv', group: 'more', form: 'djemso', name: 'FORM V · DJEM SO AND SHIEN', sub: 'Power blows, the Fluid Riposte, and the reverse grip', loadout: ['shiicho', 'djemso', null],
      done: 'Two roads from one form. Choose the one the fight asks for.',
      steps: [
        { sec: 'DJEM SO', say: 'Djem So meets force with greater force: slow, heavy blows that break armour and floor the biggest foes.',
          keys: '2 · LMB', do: 'In Djem So, bring down the armoured brute', ev: 'kill', of: 'brute', stance: 'djemso', need: 1, respawn: true,
          spawn: [{ type: 'brute', at: [0, -4], dummy: true }] },
        { say: 'Take the blow on your held guard, then answer it at once. That is the Fluid Riposte, and it lands twice as hard.',
          keys: 'HOLD RMB · LMB', do: 'In Djem So, land 2 ripostes', ev: 'riposte', stance: 'djemso', need: 2, spawn: partner() },
        { needs: 'shien', sec: 'SHIEN', say: 'Form V has a second road: Shien. Press G and the blade turns over in your hand. Shien always holds a reverse grip.',
          keys: 'G', do: 'Swap to Shien', poll: 'stance', stance: 'shien', need: 0.4 },
        { needs: 'shien', say: 'Shien sends blaster fire straight back at the one who fired it, harder than it came.',
          keys: 'TAP RMB', do: 'In Shien, send 4 bolts home', ev: 'deflect', stance: 'shien', need: 4, spawn: shooter() },
      ] },
    { id: 'makashi', group: 'more', form: 'makashi', name: 'FORM II · MAKASHI', sub: 'The duellist\'s form, against a blade', loadout: ['shiicho', 'makashi', null],
      done: 'Precision over power. Makashi was made for this.',
      steps: [
        { sec: 'MAKASHI', say: 'Makashi is the duellist\'s form: one hand, side-on, precise. It reads feints, and its cuts bite harder into anything with a blade.',
          keys: '2 · E · LMB', do: 'In Makashi, break the Magnaguard\'s guard', ev: 'guardBreak', alt: 'sparDown', stance: 'makashi', need: 1,
          spawn: partner('duelist', [0, -6]) },
        { say: 'Now finish it.',
          keys: 'LMB', do: 'In Makashi, defeat the Magnaguard', ev: 'kill', of: 'duelist', stance: 'makashi', need: 1,
          spawn: [{ type: 'duelist', at: [0, -6] }] },
      ] },
    { id: 'niman', group: 'more', form: 'niman', name: 'FORM VI · NIMAN', sub: 'The balanced form, and a grip of your choosing', loadout: ['shiicho', 'niman', null],
      done: 'A little of every form, and saber and Force as one. That is Niman.',
      steps: [
        { sec: 'NIMAN', say: 'Niman is balance. Every clean parry gives you Force back.',
          keys: '2 · TAP RMB', do: 'In Niman, parry 2 strikes', ev: 'parry', stance: 'niman', need: 2, spawn: partner() },
        { say: 'In Niman, saber and Force are one. Throw a power in the middle of a string and the string goes on.',
          keys: 'LMB · F', do: 'In Niman, hit 3 targets with Force Push', ev: 'pushHit', stance: 'niman', need: 3, respawn: true, spawn: dummies(CIRCLE) },
        { sec: 'THE GRIP', say: 'Niman is the only form that lets you choose your grip. Press G to turn the blade over into a reverse grip.',
          keys: 'G', do: 'Switch to a reverse grip', poll: 'grip', grip: 'reverse', stance: 'niman', need: 0.4 },
        { say: 'The blade hits the same either way. Fight in the grip that feels like yours. G turns it back.',
          keys: 'LMB', do: 'In a reverse grip, land 3 cuts', ev: 'cutHit', grip: 'reverse', need: 3, respawn: true,
          spawn: dummies(CIRCLE, { sparring: true }) },
      ] },
    { id: 'formvii', group: 'more', form: 'juyo', name: 'FORM VII · JUYO AND VAAPAD', sub: 'The fury, and the two roads of the seventh form', loadout: ['shiicho', 'juyo', null],
      done: 'In a real run you will walk only one of these roads. Choose it well.',
      steps: [
        { sec: 'JUYO', say: 'Juyo lets the fury in. Every cut that lands feeds it, and the fury makes the next one harder. It burns Force as it goes.',
          keys: '2 · LMB', do: 'In Juyo, cut down 5 targets', ev: 'kill', stance: 'juyo', need: 5, respawn: true, spawn: dummies(CROWD) },
        { sec: 'VAAPAD', loadout: ['shiicho', 'vaapad', null], say: 'Vaapad takes the fury from the one who attacks you. Your blocks and parries feed it.',
          keys: '2 · TAP RMB', do: 'In Vaapad, parry 2 strikes', ev: 'parry', stance: 'vaapad', need: 2, spawn: partner() },
        { say: 'A parry in Vaapad finds the attacker\'s Shatterpoint. Your next cut on it lands double and floors it.',
          keys: 'TAP RMB · LMB', do: 'Parry, then strike the Shatterpoint', ev: 'shatter', stance: 'vaapad', need: 1, spawn: partner() },
      ] },

    /* ---------------- THE POWERS — each step opens when the story reaches that power ---------------- */
    { id: 'powers', group: 'more', any: ['barrier', 'throw', 'jslam', 'mend', 'judge', 'repulse'], name: 'FORCE POWERS', sub: 'The powers the story has opened to you', loadout: BASE,
      done: 'In a real run each pair is a choice: you will carry one of the two.',
      steps: [
        { needs: 'barrier', sec: 'THE POWERS', give: { unlocked: { barrier: true, throw: false } }, say: 'Wrap yourself in the Force, and let the fire break on it.',
          keys: 'V', do: 'Raise a Force Barrier', use: ['cd', 'barrier'], need: 1, spawn: shooter() },
        { needs: 'throw', give: { unlocked: { throw: true, barrier: false } }, say: 'Let the blade fly. It will come home to your hand.',
          keys: 'HOLD RMB + LMB', do: 'Throw your saber at the targets twice', use: ['cd', 'throw'], need: 2, respawn: true, spawn: dummies([[0, -8], [-3, -9], [3, -9]]) },
        { needs: 'jslam', give: { unlocked: { slam: true, mend: false } }, say: 'Leap high, raise the blade, and bring it down like a hammer.',
          keys: 'X', do: 'Jump Attack the knot of targets', use: ['cd', 'slam'], need: 1, respawn: true, spawn: dummies(CROWD) },
        { needs: 'mend', give: { unlocked: { mend: true, slam: false } }, hurt: 0.45, say: 'The Force mends what it touches. Even you.',
          keys: 'X', do: 'Mend yourself', use: ['cd', 'mend'], need: 1 },
        { needs: 'judge', give: { unlocked: { judge: true, repulse: false } }, say: 'Judgement. Let them answer for what they have done.',
          keys: 'R', do: 'Call down Judgement on the targets', use: ['cd', 'judge'], need: 1, respawn: true, spawn: dummies(CIRCLE) },
        { needs: 'repulse', give: { unlocked: { repulse: true, judge: false } }, say: 'Gather the Force inward, then release it all.',
          keys: 'R', do: 'Repulse the crowd', use: ['cd', 'repulse'], need: 1, respawn: true, spawn: dummies(CROWD) },
      ] },
  ],

  mando: [
    /* ---------------- THE BASICS ---------------- */
    { id: 'yard', group: 'basics', name: 'THE YARD', sub: 'Walk, climb over cover, dive',
      done: 'You move like a hunter. Now, the jetpack.',
      steps: [
        { sec: 'THE YARD', say: 'Walk with me, foundling. To the forge.',
          keys: 'W A S D · MOUSE', do: 'Walk to the forge', reach: [0, 3.6] },
        { say: 'Beskar is heavy. Do not hop the crates: run straight at one and climb over it without stopping.',
          keys: 'W · SPACE', do: 'Run right up to a crate on the west lane and press SPACE at its edge', ev: 'vault', need: 1, mark: [-11, 8] },
        { say: 'Do not stand where the shot is going.',
          keys: 'SHIFT', do: 'Dive on the ground (SHIFT again mid-dive lights the jetpack)', ev: 'dash', need: 2 },
        { say: 'Never turn your back on a target. Hold your aim and circle it: your feet move, your barrel does not.',
          keys: 'HOLD ALT + A / D / S', do: 'Strafe: hold ALT and sidestep or backpedal while you keep facing the crosshair (LB on a controller)', poll: 'strafe', need: 1.5 },
        { say: 'Drop and slide when the gap is low. The bar on the north lane: under it.',
          keys: 'W · C', do: 'Run at the bar and slide under it', ev: 'slide', need: 1, mark: [-7, 11] },
      ] },
    { id: 'jetpack', group: 'basics', name: 'THE JETPACK', sub: 'The high ground, fuel, and the boost',
      done: 'The sky is a place to fight from. Never a place to run dry.',
      steps: [
        { sec: 'THE JETPACK', say: 'I have reforged your booster. The jetpack is not for running. It is for the high ground. Take the lookout.',
          keys: 'HOLD SPACE', do: 'Fly to the top of the lookout', reach: [13.6, -9.4, 7.7], grant: 'jet1' },
        { say: 'The jetpack drinks fuel. Watch the gauge: in the air it barely refills, on the ground it fills fast. Never run dry above a drop.',
          keys: 'HOLD SPACE', do: 'Burn your fuel below a quarter, then land and let it refill', poll: 'refuel' },
        { say: 'In the air, burn hard. Look down to dive.',
          keys: 'HOLD SPACE + HOLD SHIFT', do: 'Boost through the air', poll: 'boost', need: 0.8 },
      ] },
    { id: 'course', group: 'basics', name: 'THE COURSE', sub: 'Under, over, up and across, without stopping',
      done: 'A hunter who can move is a hunter who lives. Now, the blaster.',
      steps: [
        { sec: 'THE COURSE', say: 'A hunter who cannot move is a target. Run my course: under, over, up and across.',
          course: [
            { at: [-7, 11], r: 1.6, slide: true, keys: 'W · C', do: 'Run west and slide under the bar', hint: 'SLIDE UNDER IT' },
            { at: [-11, -4], after: 'vault', keys: 'W · SPACE', do: 'Climb over the crates down the west lane', hint: 'OVER THE CRATES' },
            { at: [0, -11.5], after: 'vault', keys: 'W · SPACE', do: 'Climb over the sandbag wall', hint: 'OVER THE WALL' },
            { at: [13.6, -9.4, 7.7], keys: 'HOLD SPACE', do: 'Jet to the top of the lookout' },
            { at: [-2, 12], r: 2.4, land: true, keys: 'HOLD SPACE + HOLD SHIFT', do: 'Boost across the yard and land on the marker' },
            { at: [0, 3.6], after: 'dash', keys: 'SHIFT', do: 'Dive into the forge', hint: 'DIVE IN (SHIFT)' },
          ] },
      ] },
    { id: 'blaster', group: 'basics', name: 'THE BLASTER', sub: 'Headshots, heat, and the gauntlet shield',
      done: 'Shoot clean, keep cool, and let the shield take what you cannot dodge.',
      steps: [
        { sec: 'THE BLASTER', say: 'A clean shot ends the fight before it starts. Aim for the head.',
          keys: 'LMB', do: 'Land 3 headshots on the targets', ev: 'headshot', need: 3, respawn: true, mark: [0, -6],
          spawn: dummies([[-4, -14], [0, -15], [4, -14]]) },
        { say: 'A hot barrel is a dead hunter. Clear the heat before it locks.',
          keys: 'LMB · R', do: 'Fire, then vent your heat', ev: 'vent', need: 1 },
        { say: 'The gauntlet shield returns what is sent. Raise it to their fire.',
          keys: 'HOLD RMB', do: 'Reflect 3 bolts with your shield', ev: 'shieldReflect', need: 3, spawn: shooter([9, 6]) },
        { say: 'Shield and blaster share one gauntlet. The moment you fire, the shield drops on its own, and it comes back half a second after your last shot. Shield up, wait for your gap, then shoot.',
          keys: 'HOLD RMB · LMB', do: 'Shoot down the trooper: firing lowers your shield, so pick your moment', ev: 'kill', of: 'blaster', need: 1,
          spawn: [{ type: 'blaster', at: [9, 6], rooted: true }] },
      ] },
    { id: 'beskar', group: 'basics', name: 'BESKAR', sub: 'The parry: send their fire home, with any gun',
      done: 'The shield takes fire. Beskar gives it back.',
      steps: [
        { sec: 'BESKAR', say: 'The shield holds what you cannot dodge. Beskar does more. Raise your arm the instant their bolt arrives and it goes straight back to the one who fired it.',
          keys: 'TAP RMB', do: 'Ricochet 3 bolts: tap RMB just as each one reaches you', ev: 'beskarParry', need: 3, spawn: shooter([0, -9]) },
        { say: 'It is timing, not luck. Raise it too early and you will not raise it again in time. Any gun, even in the air: the armour is always with you.',
          keys: 'HOLD SPACE · TAP RMB', do: 'Ricochet 2 more (try one from the air)', ev: 'beskarParry', need: 2, spawn: shooter([0, -9]) },
      ] },
    { id: 'close', group: 'basics', name: 'CLOSE QUARTERS', sub: 'Catch, charge, takedown, the shield bash, the clinch, your fists',
      done: 'Your armour is a weapon. Never forget it.',
      steps: [
        { sec: 'CLOSE QUARTERS', say: 'When they come close, your armour is a weapon. Catch the blow on your vambrace.',
          keys: 'TAP E', do: 'Catch a strike: tap E as the blow lands', ev: 'catch', need: 1, spawn: partner() },
        { say: 'Close the distance in one burn.',
          keys: 'W + E', do: 'Jet-charge into the target', ev: 'charge', need: 1, respawn: true, spawn: dummies([[0, -5]]) },
        { say: 'Strike until it reels. Then end it.',
          keys: 'E E E E · E', do: 'Stagger the target with the full string, then take it down', ev: 'takedown', need: 1, respawn: true,
          spawn: dummies([[0, -4]], { sparring: true }) },
        { say: 'Keep the shield up and the blade does the work. Cut, cut, then drive the beskar into them.',
          keys: 'HOLD RMB + E · E · E', do: 'Behind the shield, cut twice and land the shield bash', ev: 'bash', need: 1, respawn: true,
          spawn: dummies([[-0.8, -5], [0.8, -5]], { sparring: true }) },
        { say: 'Close enough to touch is close enough to hold. Keep the button down as you strike and take it by the collar.',
          keys: 'HOLD E', do: 'Grab the target', ev: 'grab', need: 1, respawn: true, spawn: dummies([[0, -3]], { sparring: true }) },
        { say: 'Beskar is harder than whatever they wear. Use your head.',
          keys: 'HOLD E · E', do: 'Headbutt the target you hold', ev: 'headbutt', need: 2, respawn: true, spawn: dummies([[0, -3]], { sparring: true }) },
        { say: 'Then put it somewhere useful. Throw it into its friend.',
          keys: 'HOLD E · LMB', do: 'Grab the near target and throw it', ev: 'throw', need: 1, respawn: true,
          spawn: dummies([[0, -3], [0, -8]], { sparring: true }) },
        { say: 'Sometimes the blaster is in the way. Put it up and fight with your fists and your gadgets.',
          keys: '4 · E E E E · E', do: 'Holstered, take the target down with your fists', ev: 'takedown', weapon: 'fists', need: 1, respawn: true,
          spawn: dummies([[0, -4]], { sparring: true }) },
        { say: 'Draw again.',
          keys: '1', do: 'Draw your blaster', poll: 'single', need: 0.3 },
      ] },
    { id: 'gadgets', group: 'basics', name: 'GADGETS', sub: 'The wrist rocket, and how your gear grows',
      done: 'Gear wins fights. Use it, and it grows with you.',
      steps: [
        { sec: 'GADGETS', say: 'The wrist rocket does not kill. It puts a crowd on its back, and gives you the opening.',
          keys: 'Q', do: 'Knock down the group with a rocket', ev: 'rocketHit', need: 3, respawn: true,
          spawn: dummies([[6.4, 5], [8, 4.4], [7.4, 6.2]]) },
        { say: 'Gear grows with use. In a real fight, use a gadget enough and it is mastered: a note in the corner tells you what changed. Again.',
          keys: 'Q', do: 'Knock down 6 more with rockets', ev: 'rocketHit', need: 6, respawn: true,
          spawn: dummies([[6.4, 5], [8, 4.4], [7.4, 6.2]]),
          toast: 'rocket' },
      ] },
    { id: 'acolyte', group: 'basics', name: 'THE ACOLYTE', sub: 'A blade that sends your bolts back',
      done: 'Blades are not to be feared. Only respected.',
      steps: [
        { sec: 'THE ACOLYTE', say: 'A Sith blade sends your bolts back. Get close, break its guard, and finish it.',
          keys: 'W + E · E', do: 'Defeat the acolyte', ev: 'kill', of: 'acolyte', need: 1,
          spawn: [{ type: 'acolyte', at: [0, -7] }] },
      ] },
    { id: 'trial', group: 'basics', name: 'THE TRIAL', sub: 'Everything at once, against real foes',
      done: 'You have learned what I can teach for now. The forge will make you more as you earn it, and I will teach it here. This is the Way.',
      steps: [
        { sec: 'THE TRIAL', say: 'Show me. Each wave you clear in a real fight, and each clean catch or dodge, earns skill points to spend when a chapter ends. This is the Way.',
          keys: '', do: 'Win the trial', clear: true, heal: true, spawn: 'wave', wave: { grunt: 4, blaster: 2, flyer: 1 } },
      ] },

    /* ---------------- THE ARSENAL — each opens when the story forges it ---------------- */
    { id: 'dual', group: 'more', kit: 'dual', name: 'TWO BLASTERS', sub: 'Your sidearm: precision or close work',
      done: 'One for the shot, two for the storm.',
      steps: [
        { sec: 'SIDEARMS', say: 'One blaster is for precision: the headshot, and the shield on the same arm. Two blasters are for close work: hold the trigger and they pour fire, but there is no shield behind them.',
          keys: '1 · HOLD LMB', do: 'Draw the dual blasters and drop the 3 targets up close', ev: 'kill', weapon: 'dual', need: 3, grant: 'dual', kit: { sidearm: 'dual' }, respawn: true,
          spawn: dummies([[-1.6, -5.4], [0, -6], [1.6, -5.4]]) },
        { say: 'You carry one sidearm. The other waits in the armory: each time a run hands you a gun, you choose which to carry.',
          keys: '1', do: 'Draw the single blaster again', kit: { sidearm: 'single' }, poll: 'single', need: 0.3 },
      ] },
    { id: 'primaries', group: 'more', any: ['carbine', 'repeater'], name: 'PRIMARIES', sub: 'The pulse carbine and the heavy repeater, on 2',
      done: 'A primary for the job, a sidearm for the rest.',
      steps: [
        { needs: 'carbine', sec: 'THE CARBINE', give: { unlocked: { carbine: true } }, kit: { primary: 'carbine' },
          say: 'The carbine. Three bolts a pull, steady from the hip. Each burst climbs: bring it back down onto them.',
          keys: '2 · LMB', do: 'With the pulse carbine, drop the 3 targets at range', ev: 'kill', weapon: 'carbine', need: 3, respawn: true,
          spawn: dummies([[-4, -14], [0, -15], [4, -14]]) },
        { needs: 'repeater', sec: 'THE REPEATER', give: { unlocked: { repeater: true } }, kit: { primary: 'repeater' },
          say: 'The repeater must wind up. Hold the trigger and keep it on them. When it cooks, it cooks for a while: vent before it locks.',
          keys: '2 · HOLD LMB', do: 'With the heavy repeater, cut down the 5 targets', ev: 'kill', weapon: 'repeater', need: 5, respawn: true,
          spawn: dummies([[-3, -9], [-1.5, -10], [0, -9], [1.5, -10], [3, -9]]) },
      ] },
    { id: 'flame', group: 'more', kit: 'flame', name: 'THE FLAMETHROWER', sub: 'Fire for a crowd that will not listen',
      done: 'Fire clears the way. Mind the gadget power it burns.',
      steps: [
        { sec: 'THE FLAMETHROWER', say: 'Fire clears a crowd that will not listen. Hold it on them.',
          keys: 'F', do: 'Burn the crowd', give: { unlocked: { flame: true } }, use: ['flag', 'flaming'], need: 2, respawn: true,
          spawn: dummies([[-1.2, -5], [1.2, -5], [0, -6]]) },
      ] },
    { id: 'gear', group: 'more', any: ['grapple', 'mslam', 'birds', 'deto', 'bacta'], name: 'FORGED GEAR', sub: 'The gadgets the story has opened to you',
      done: 'In a real run each pair is a choice: you will carry one of the two.',
      steps: [
        { needs: 'grapple', sec: 'FORGED GEAR', give: { unlocked: { grapple: true, slam: false } }, say: 'Pull yourself into the fight, or pull the fight to you.',
          keys: 'X', do: 'Fire the grappling hook', use: ['cd', 'grapple'], need: 2, respawn: true, spawn: dummies([[0, -9]]) },
        { needs: 'mslam', give: { unlocked: { slam: true, grapple: false } }, say: 'Drop from the sky and shake the ground.',
          keys: 'HOLD SPACE · X', do: 'Jet up, then slam down by the targets', use: ['flag', 'slamming'], need: 1, respawn: true, spawn: dummies(CROWD) },
        { needs: 'birds', give: { unlocked: { birds: true, deto: false } }, say: 'Whistling Birds. Let them sing.',
          keys: 'V', do: 'Loose the Whistling Birds', use: ['cd', 'birds'], need: 1, respawn: true, spawn: dummies([[-3, -8], [0, -9], [3, -8]]) },
        { needs: 'deto', give: { unlocked: { deto: true, birds: false } }, say: 'A thermal detonator does not miss twice. Aim lower to drop it close, higher to send it far.',
          keys: 'V', do: 'Throw a detonator into the targets', use: ['cd', 'deto'], need: 1, respawn: true, spawn: dummies([[-1, -9], [1, -9], [0, -10]]) },
        { needs: 'bacta', give: { unlocked: { bacta: true } }, hurt: 0.45, say: 'Bacta. Stay in the fight.',
          keys: 'G', do: 'Use a bacta stim', use: ['cd', 'bacta'], need: 1 },
      ] },
    { id: 'signature', group: 'more', any: ['disruptor', 'darksaber'], name: 'THE THIRD WEAPON', sub: 'The disruptor rifle and the Darksaber',
      done: 'In a real run the forge gives you one of the two. Know them both.',
      steps: [
        { needs: 'disruptor', sec: 'THE DISRUPTOR', give: { unlocked: { disruptor: true }, up: { darksaber: false } }, say: 'The disruptor. One shot, nothing left. It ends a fight from afar.',
          keys: '3 · LMB', do: 'With the disruptor, drop the 2 far targets', ev: 'kill', weapon: 'disruptor', need: 2, respawn: true,
          spawn: dummies([[-4, -16], [4, -16]]) },
        { needs: 'darksaber', sec: 'THE DARKSABER', give: { unlocked: { disruptor: false, dark: true }, up: { darksaber: true } }, say: 'The Darksaber. It is not the blade that is strong, but the one who wields it.',
          keys: '3 · LMB', do: 'With the Darksaber, cut down 3 targets', ev: 'kill', weapon: 'darksaber', need: 3, respawn: true,
          spawn: dummies(CIRCLE) },
        { needs: 'darksaber', say: 'Throw it, and your line will bring it home.',
          keys: 'HOLD RMB + LMB', do: 'Throw the Darksaber', use: ['shared', 'darkProj'], need: 1, respawn: true, spawn: dummies([[0, -8]]) },
      ] },
    { id: 'missile', group: 'more', kit: 'jetmissile', name: 'THE JETPACK MISSILE', sub: 'The final upgrade',
      done: 'The last thing the forge makes. Use it well.',
      steps: [
        { sec: 'THE MISSILE', give: { unlocked: { jetmissile: true } }, say: 'The jetpack carries a missile. Use it well.',
          keys: 'Z', do: 'Fire the jetpack missile at the targets', use: ['cd', 'missile'], need: 1, respawn: true, spawn: dummies([[-2, -10], [2, -10], [0, -11]]) },
      ] },
  ],
  // the clone ARC trooper (testing): the basics on the forge yard's layout (world/arenas/forge.js), taught by the Captain
  trooper: [
    { id: 'yard', group: 'basics', name: 'ON YOUR FEET', sub: 'Move, vault, roll, strafe and slide',
      done: 'Good. You still move like an ARC. Now show me you still shoot like one.',
      steps: [
        { sec: 'ON YOUR FEET', say: 'On your feet, trooper. No jetpacks in this outfit. To the marker.',
          keys: 'W A S D · MOUSE', do: 'Walk to the marker', reach: [0, 3.6] },
        { say: 'Cover is for hiding behind, until it is in your way. Then go over it.',
          keys: 'W · SPACE', do: 'Run right up to a crate on the west lane and press SPACE at its edge', ev: 'vault', need: 1, mark: [-11, 8] },
        { say: 'When they shoot, be somewhere else.',
          keys: 'SHIFT', do: 'Combat roll (SHIFT)', ev: 'dash', need: 2 },
        { say: 'Keep your muzzle on the target and your feet moving.',
          keys: 'HOLD ALT + A / D / S', do: 'Strafe: hold ALT and sidestep or backpedal while you keep facing the crosshair', poll: 'strafe', need: 1.5 },
        { say: 'Low bar on the north lane. Slide it.',
          keys: 'W · C', do: 'Run at the bar and slide under it', ev: 'slide', need: 1, mark: [-7, 11] },
      ] },
    { id: 'rifle', group: 'basics', name: 'THE DC-15', sub: 'Bursts, aim, headshots and the active vent',
      done: 'Bursts, aim, and the vent on the beat. That is how we stayed alive.',
      steps: [
        { sec: 'THE DC-15', say: 'Three bolts a trigger pull. Put them on the head.',
          keys: 'LMB', do: 'Land 3 headshots on the targets', ev: 'headshot', need: 3, respawn: true, mark: [0, -6],
          spawn: dummies([[-4, -14], [0, -15], [4, -14]]) },
        { say: 'Bring it up to your eye when it counts. The cone closes and the reticle settles.',
          keys: 'HOLD RMB · LMB', do: 'Aim in and drop a target', ev: 'kill', need: 1, respawn: true, spawn: dummies([[0, -15]]) },
        { say: 'Run it hot. When it locks, wait for the beat and hit R: do it right and the coils clear at once.',
          keys: 'LMB · R', do: 'Overheat the rifle, then vent it with R (on the beat clears it at once)', ev: 'vent', need: 1 },
      ] },
    { id: 'pistols', group: 'basics', name: 'TWIN DC-17s', sub: 'A pistol in each hand, a gun on each button',
      done: 'Two guns, two targets. Rex would be proud.',
      steps: [
        { sec: 'TWIN DC-17s', say: 'Sidearms. Left button, right pistol. Right button, left pistol. Work them both.',
          keys: '2 · LMB · RMB', do: 'Switch to the twin DC-17s and drop 3 targets', ev: 'kill', need: 3, respawn: true,
          spawn: dummies([[-5, -10], [5, -10], [0, -12]]) },
        { say: 'They fire out of a roll. Never stop shooting.',
          keys: 'SHIFT · LMB', do: 'Roll, firing as you come up', ev: 'dash', need: 1 },
      ] },
    { id: 'close', group: 'basics', name: 'GRENADES AND THE STOCK', sub: 'Frag out, and the rifle bash',
      done: 'That is the basics. The rest you learn with the squad.',
      steps: [
        { sec: 'FRAG OUT', say: 'Frag on the cluster. Aim low to drop it close, high to throw it long.',
          keys: 'G', do: 'Throw a frag grenade into the group', ev: 'grenade', need: 1,
          spawn: dummies([[-1, -11], [1, -11], [0, -12.5]]) },
        { say: 'Too close to shoot? Hit them with the stock.',
          keys: 'E', do: 'Bash the target with the rifle', ev: 'kick', need: 2, respawn: true, spawn: dummies([[0, -4]], { sparring: true }) },
        { say: 'Now all of it, on a live target.',
          keys: 'LMB · G · E', do: 'Take down the trooper', ev: 'kill', of: 'blaster', need: 1,
          spawn: [{ type: 'blaster', at: [9, 6], rooted: true }] },
      ] },
  ],
};

/* UNLOCK DRILLS — in a real run, a newly earned ability gets one line and a moment to try it (game/tutorial.js).
   use: how the game knows you tried it: ['cd', key] its cooldown starts · ['stance', s] · ['weapon', w] ·
   ['flag', f] player[f] turns on · none: a passive gain, the line just shows for a moment */
export const DRILLS = {
  jedi: {
    pull:    { say: 'What you push away, you may also draw near. Hold it, and you hold them.', key: 'C', use: ['cd', 'pull'] },
    ataru:   { say: 'Ataru, the form of the acrobat. Strike from everywhere at once.', key: '1', use: ['stance', 'ataru'] },
    djemso:  { say: 'Djem So. Meet force with greater force.', key: '3', use: ['stance', 'djemso'] },
    fj1:     { say: 'The Force carries you higher now.', key: 'HOLD SPACE' },
    fj2:     { say: 'Higher still. Trust it.', key: 'HOLD SPACE' },
    barrier: { say: 'Wrap yourself in the Force, and let the fire break on it.', key: 'V', use: ['cd', 'barrier'] },
    throw:   { say: 'Let the blade fly. It will come home to your hand.', key: 'RMB + LMB', use: ['cd', 'throw'] },
    slam:    { say: 'Leap high, raise the blade, and bring it down like a hammer.', key: 'X', use: ['cd', 'slam'] },
    mend:    { say: 'The Force mends what it touches. Even you.', key: 'X', use: ['cd', 'mend'] },
    judge:   { say: 'Judgement. Let them answer for what they have done.', key: 'R', use: ['cd', 'judge'] },
    repulse: { say: 'Gather the Force inward, then release it all.', key: 'R', use: ['cd', 'repulse'] },
  },
  mando: {
    dual:       { say: 'Two blasters. Twice the answer. You carry one sidearm: choose.', key: '1', use: ['weapon', 'dual'] },
    carbine:    { say: 'A carbine. Three bolts a pull. Keep it on them.', key: '2', use: ['weapon', 'carbine'] },
    repeater:   { say: 'The heavy repeater. Let it wind up, and do not let go.', key: '2', use: ['weapon', 'repeater'] },
    flame:      { say: 'Fire clears a crowd that will not listen.', key: 'F', use: ['flag', 'flaming'] },
    jet1:       { say: 'Your jetpack burns longer now.', key: 'HOLD SPACE' },
    jet2:       { say: 'Longer still. The sky is yours.', key: 'HOLD SPACE' },
    grapple:    { say: 'Pull yourself into the fight, or pull the fight to you.', key: 'X', use: ['cd', 'grapple'] },
    slam:       { say: 'Drop from the sky and shake the ground.', key: 'X', use: ['flag', 'slamming'] },
    birds:      { say: 'Whistling Birds. Let them sing.', key: 'V', use: ['cd', 'birds'] },
    deto:       { say: 'A thermal detonator does not miss twice.', key: 'V', use: ['cd', 'deto'] },
    bacta:      { say: 'Bacta. Stay in the fight.', key: 'G', use: ['cd', 'bacta'] },
    jetmissile: { say: 'The jetpack carries a missile. Use it well.', key: 'Z', use: ['cd', 'missile'] },
    darksaber:  { say: 'The Darksaber. It is not the blade that is strong, but the one who wields it. Throw it, and your line will bring it home.', key: '3 · RMB + LMB', use: ['weapon', 'darksaber'] },
    disruptor:  { say: 'The disruptor. One shot, nothing left.', key: '3', use: ['weapon', 'disruptor'] },
  },
  trooper: {},   // (testing: the trooper earns nothing in a run yet)
};
