// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TRAINING: the tutorial for each hero, as data. game/tutorial.js runs it; edit the words and counts freely.
//
// Each hero trains in their own place (world/arenas/hall.js, forge.js) and is taught by a voice of their order: the
// line in `say` is theirs, in character; `keys` and `do` underneath are the plain instruction. A step passes when the
// game sees the move actually work `need` times (a block doesn't count for a parry), never on a timer.
//
// Step fields
//   sec    starts a new section: its name is shown as a banner when the step begins
//   say    the teacher's line · keys: keycaps ('/' and '+' stay as separators, '·' splits groups) · do: the task
//   ev     a training event to count (game/tutor-bus.js): doubleJump dash slide vault climb roll wallrun finisher parry
//          deflect perfectDodge cancel pushHit kill headshot vent shieldReflect catch charge takedown
//   of     with ev 'kill': only foes of this type count
//   poll   a held state to time instead, in seconds: glide sprint boost · or 'forms' (count the saber forms used)
//   reach  [x, z, top?]: get there, standing on a surface that high if given (a beacon marks it) · mark: [x, z, y?] a
//          beacon that only guides
//   clear  done when every foe on the field is down (the trial)
//   spawn  [{ type, at: [x, z], dummy, sparring, rooted }] placed when the step starts, cleared when it ends:
//            dummy    stands and takes it (never attacks)
//            sparring can't be destroyed (it fights back, so you can practise against it as long as it takes)
//            rooted   holds its ground (a blaster that stays put)
//          or 'wave' with `wave: { type: count }`: they march in from the edge like a real wave
//   respawn put a dummy back when one falls before the step is done
//   grant  'forms' unlocks Ataru and Djem So · 'jet1' fits Jetpack Booster I (a real run earns it by wave 3)

export const TRAINING_LEVELS = {
  jedi: { name: 'TRAINING — THE TRAINING HALL', sub: 'Above the clouds, the temple keeps its oldest lessons.',
          arena: 44, floor: 0x9a948a, fog: 0xc4b8c0, sky: 0x35609e, layout: 'hall', waves: [], hazards: {} },
  mando: { name: 'TRAINING — THE ARMORER\'S FORGE', sub: 'The covert hides its forge from the stars.',
           arena: 44, floor: 0x55504c, fog: 0x3a2420, sky: 0x060814, layout: 'forge', waves: [], hazards: {} },
};

export const TEACHER = { jedi: 'THE BATTLEMASTER', mando: 'THE ARMORER' };
export const BEACON = { jedi: 0x5ad2ff, mando: 0xffa040 };

const CIRCLE = [[-2.2, -2.5], [0, -3.2], [2.2, -2.5]];   // three spots across the duelling circle, facing the player

export const TRAINING = {
  jedi: [
    { sec: 'THE TERRACE', say: 'Every lesson begins with a single step. Come to the circle.',
      keys: 'W A S D · MOUSE', do: 'Walk to the light', reach: [0, 0] },
    { say: 'The Force lifts those who let it. Jump, and at the top of the rise, jump again.',
      keys: 'SPACE + SPACE', do: 'Double-jump', ev: 'doubleJump', need: 2 },
    { say: 'A Jedi is never where the blow falls.',
      keys: 'SHIFT', do: 'Dash in any direction', ev: 'dash', need: 3 },
    { say: 'Run with your whole body. Then let the ground carry you.',
      keys: 'HOLD SHIFT + W · Q', do: 'Sprint, then slide', ev: 'slide', need: 1 },
    { say: 'Reach for the Force as you leave the ground, and it will hold you.',
      keys: 'HOLD SPACE', do: 'Force-leap and glide', poll: 'glide', need: 1.2 },

    { sec: 'THE LANES', say: 'Stones in your path are only stones. Run at them and go over.',
      keys: 'W + SPACE', do: 'Vault the blocks on the west lane', ev: 'vault', need: 2, mark: [-12, 8.5] },
    { say: 'Climb the watchtower. Catch each ledge and pull yourself up.',
      keys: 'SPACE · W', do: 'Reach the top of the watchtower', reach: [-17.4, -16, 7.4] },
    { say: 'From this height a fall breaks the careless. Step off, and roll as you meet the ground.',
      keys: 'SHIFT', do: 'Drop off the sheer side, and press SHIFT just before you land', ev: 'roll', need: 1, mark: [-17.4, -11] },
    { say: 'A wall is a path for those who move fast enough. Run along the long wall.',
      keys: 'W + SPACE', do: 'Run at the east wall, jump alongside it and hold W', ev: 'wallrun', need: 2, mark: [12.2, 7.5] },

    { sec: 'THE BLADE', say: 'Your saber is an extension of your will. Cut down the targets.',
      keys: 'LMB', do: 'Destroy 3 targets', ev: 'kill', need: 3,
      spawn: CIRCLE.map(at => ({ type: 'grunt', at, dummy: true })) },
    { say: 'Three cuts make a form. Let the third one end it.',
      keys: 'LMB LMB LMB', do: 'Land 2 combo finishers', ev: 'finisher', need: 2,
      spawn: [{ type: 'grunt', at: [-1.4, -3], dummy: true, sparring: true }, { type: 'grunt', at: [1.4, -3], dummy: true, sparring: true }] },
    { say: 'A held guard only slows a blow. Meet it the moment it lands, and it is yours.',
      keys: 'TAP RMB', do: 'Parry 3 strikes from your sparring partner', ev: 'parry', need: 3,
      spawn: [{ type: 'grunt', at: [0, -4], sparring: true }] },
    { say: 'Blaster fire is only light. Turn it back on the hand that sent it.',
      keys: 'TAP RMB', do: 'Deflect 3 bolts', ev: 'deflect', need: 3,
      spawn: [{ type: 'blaster', at: [0, -9], sparring: true, rooted: true }] },
    { say: 'Let the strike pass through where you were. Move as it falls, not before.',
      keys: 'SHIFT', do: 'Perfect dodge: dash just as a blow lands', ev: 'perfectDodge', need: 1,
      spawn: [{ type: 'grunt', at: [0, -4], sparring: true }] },
    { say: 'No cut must be finished. Break it off, and guard.',
      keys: 'LMB · RMB', do: 'Start a swing, then cancel it into your guard', ev: 'cancel', need: 1 },

    { sec: 'THE FORCE', say: 'The Force is not a weapon. But it can move one.',
      keys: 'F', do: 'Hit 3 targets with Force Push', ev: 'pushHit', need: 3, respawn: true,
      spawn: CIRCLE.map(at => ({ type: 'grunt', at, dummy: true })) },

    { sec: 'THE DUEL', say: 'A trained blade guards a line. The pale arc shows you which. Strike the open side, or break the guard with your boot.',
      keys: 'A / D / W · E', do: 'Defeat the Magnaguard', ev: 'kill', of: 'duelist', need: 1,
      spawn: [{ type: 'duelist', at: [0, -6] }] },

    { sec: 'THE FORMS', say: 'Ataru leaps, Niman balances, Djem So overwhelms. Know all three.',
      keys: '1 / 2 / 3', do: 'Fight in each saber form', poll: 'forms', need: 3, grant: 'forms', respawn: true,
      spawn: CIRCLE.map(at => ({ type: 'grunt', at, dummy: true })) },

    { sec: 'THE TRIAL', say: 'No more lessons. Show me what you have learned.',
      keys: '', do: 'Win the trial', clear: true, spawn: 'wave', wave: { grunt: 4, blaster: 2, duelist: 1 } },
  ],

  mando: [
    { sec: 'THE YARD', say: 'Walk with me, foundling. To the forge.',
      keys: 'W A S D · MOUSE', do: 'Walk to the forge', reach: [0, 3.6] },
    { say: 'Beskar is heavy. Your legs must be stronger than it.',
      keys: 'W + SPACE', do: 'Hop the crates on the west lane', ev: 'vault', need: 1, mark: [-11, 8] },
    { say: 'Do not stand where the shot is going.',
      keys: 'SHIFT', do: 'Thruster-dodge on the ground', ev: 'dash', need: 2 },

    { sec: 'THE JETPACK', say: 'I have reforged your booster. The jetpack is not for running. It is for the high ground. Take the lookout.',
      keys: 'HOLD SPACE', do: 'Fly to the top of the lookout', reach: [13.6, -9.4, 7.7], grant: 'jet1' },
    { say: 'In the air, burn hard. Look down to dive.',
      keys: 'HOLD SPACE + HOLD SHIFT', do: 'Boost through the air', poll: 'boost', need: 0.8 },

    { sec: 'THE BLASTER', say: 'A clean shot ends the fight before it starts. Aim for the head.',
      keys: 'LMB', do: 'Land 3 headshots on the targets', ev: 'headshot', need: 3, respawn: true, mark: [0, -6],
      spawn: [[-4, -14], [0, -15], [4, -14]].map(at => ({ type: 'grunt', at, dummy: true })) },
    { say: 'A hot barrel is a dead hunter. Clear the heat before it locks.',
      keys: 'LMB · R', do: 'Fire, then vent your heat', ev: 'vent', need: 1 },
    { say: 'The gauntlet shield returns what is sent. Raise it to their fire.',
      keys: 'HOLD RMB', do: 'Reflect 3 bolts with your shield', ev: 'shieldReflect', need: 3,
      spawn: [{ type: 'blaster', at: [9, 6], sparring: true, rooted: true }] },
    { say: 'Now answer it. Lower the shield, and fire.',
      keys: 'LMB', do: 'Shoot down the trooper', ev: 'kill', of: 'blaster', need: 1,
      spawn: [{ type: 'blaster', at: [9, 6], rooted: true }] },

    { sec: 'CLOSE QUARTERS', say: 'When they come close, your armor is a weapon. Catch the blow on your vambrace.',
      keys: 'TAP E', do: 'Catch a strike: tap E as the blow lands', ev: 'catch', need: 1,
      spawn: [{ type: 'grunt', at: [0, -4], sparring: true }] },
    { say: 'Close the distance in one burn.',
      keys: 'W + E', do: 'Jet-charge into the target', ev: 'charge', need: 1, respawn: true,
      spawn: [{ type: 'grunt', at: [0, -5], dummy: true }] },
    { say: 'Strike until it reels. Then end it.',
      keys: 'E E E E · E', do: 'Stagger the target with the full string, then take it down', ev: 'takedown', need: 1, respawn: true,
      spawn: [{ type: 'grunt', at: [0, -4], dummy: true, sparring: true }] },

    { sec: 'GADGETS', say: 'The wrist rocket does not kill. It puts a crowd on its back, and gives you the opening.',
      keys: 'Q', do: 'Knock down the group with a rocket', ev: 'rocketHit', need: 3, respawn: true,
      spawn: [[6.4, 5], [8, 4.4], [7.4, 6.2]].map(at => ({ type: 'grunt', at, dummy: true })) },

    { sec: 'THE ACOLYTE', say: 'A Sith blade sends your bolts back. Get close, break its guard, and finish it.',
      keys: 'W + E · E', do: 'Defeat the acolyte', ev: 'kill', of: 'acolyte', need: 1,
      spawn: [{ type: 'acolyte', at: [0, -7] }] },

    { sec: 'THE TRIAL', say: 'Show me. This is the Way.',
      keys: '', do: 'Win the trial', clear: true, spawn: 'wave', wave: { grunt: 4, blaster: 2, flyer: 1 } },
  ],
};

export const TRAINING_DONE = {
  jedi: 'You are ready. Go now, and may the Force be with you.',
  mando: 'You have learned what I can teach. Your armor is your own now. This is the Way.',
};

/* UNLOCK DRILLS — in a real run, a newly earned ability gets one line and a moment to try it (game/tutorial.js).
   use: how the game knows you tried it: ['cd', key] its cooldown starts · ['stance', s] · ['weapon', w] ·
   ['flag', f] player[f] turns on · none: a passive gain, the line just shows for a moment */
export const DRILLS = {
  jedi: {
    pull:    { say: 'What you push away, you may also draw near.', key: 'C', use: ['cd', 'pull'] },
    fast:    { say: 'Ataru, the form of the acrobat. Strike from everywhere at once.', key: '1', use: ['stance', 'fast'] },
    strong:  { say: 'Djem So. Meet force with greater force.', key: '3', use: ['stance', 'strong'] },
    fj1:     { say: 'The Force carries you higher now.', key: 'HOLD SPACE' },
    fj2:     { say: 'Higher still. Trust it.', key: 'HOLD SPACE' },
    barrier: { say: 'Wrap yourself in the Force, and let the fire break on it.', key: 'V', use: ['cd', 'barrier'] },
    throw:   { say: 'Let the blade fly. It will come home to your hand.', key: 'RMB + LMB', use: ['cd', 'throw'] },
    slam:    { say: 'From above, bring the Force down like a hammer.', key: 'X', use: ['cd', 'slam'] },
    mend:    { say: 'The Force mends what it touches. Even you.', key: 'X', use: ['cd', 'mend'] },
    judge:   { say: 'Judgement. Let them answer for what they have done.', key: 'R', use: ['cd', 'judge'] },
    repulse: { say: 'Gather the Force inward, then release it all.', key: 'R', use: ['cd', 'repulse'] },
  },
  mando: {
    dual:       { say: 'Two blasters. Twice the answer.', key: '2', use: ['weapon', 'dual'] },
    flame:      { say: 'Fire clears a crowd that will not listen.', key: 'F', use: ['flag', 'flaming'] },
    jet1:       { say: 'Your jetpack burns longer now.', key: 'HOLD SPACE' },
    jet2:       { say: 'Longer still. The sky is yours.', key: 'HOLD SPACE' },
    grapple:    { say: 'Pull yourself into the fight, or pull the fight to you.', key: 'X', use: ['cd', 'grapple'] },
    slam:       { say: 'Drop from the sky and shake the ground.', key: 'X', use: ['flag', 'slamming'] },
    birds:      { say: 'Whistling Birds. Let them sing.', key: 'V', use: ['cd', 'birds'] },
    deto:       { say: 'A thermal detonator does not miss twice.', key: 'V', use: ['cd', 'deto'] },
    bacta:      { say: 'Bacta. Stay in the fight.', key: 'H', use: ['cd', 'bacta'] },
    jetmissile: { say: 'The jetpack carries a missile. Use it well.', key: 'Z', use: ['cd', 'missile'] },
    darksaber:  { say: 'The Darksaber. It is not the blade that is strong, but the one who wields it.', key: '3', use: ['weapon', 'darksaber'] },
    disruptor:  { say: 'The disruptor. One shot, nothing left.', key: '3', use: ['weapon', 'disruptor'] },
  },
};
