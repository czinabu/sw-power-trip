// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CONTROLS, CONTROLLER PAGE: the same panels as the keyboard page (ui/controls.js), said the pad's way.

/* Rows are [keys, action, note?, advanced?, forms?], exactly like the keyboard table, with one difference: a key is
   written as the KEYBOARD key it presses, in braces, and the page looks up which pad button sends that key
   (data/gamepad.js PAD_BINDS), so a rebind there moves the page with it and the glyphs follow the pad (Xbox or
   PlayStation). {lmb} / {rmb} are the triggers, {space} {shift} {alt} what they say; {w} {a} {s} {d} are the left stick
   pushed that way, {mouse} the right stick; {LS} {RS} {MENU} name a stick or button outright. Braces work in the
   notes too. Plain words (HOLD, TAP, AIR, FLOW…) stay as written. Keep this in step with the keyboard table. */
export const PAD_CONTROLS = {
  jedi: [
    { title: 'MOVE', rows: [
      ['{LS}', 'Move', 'Steers any way, at the stick\'s angle'],
      ['{mouse}', 'Look', 'Speed: Settings · STICK SENS · with CUT AIM: MOUSE, a flick just before {lmb} aims the cut'],
      ['{space}', 'Jump', 'Again in the air to double-jump'],
      ['HOLD {space}', 'Force leap and glide', 'Spends Force'],
      ['{shift}', 'Roll / dash', 'In a fight, a quick roll any way you push {LS}: it costs some stamina (each form spends its own share), with a moment of invulnerability · again mid-roll (or in the air) to Force dash, which spends a charge (the pips on the slot) and some Force · out of a fight it just dashes, free · roll or dash just as a blow lands for a perfect dodge'],
      ['{q}', 'Run / walk', 'Switches between run (the default; forward sprints) and walk; the sprint turns wide, and in a fight it burns stamina (it gives out before your guard does), the walk is a brisk, menacing pace, fights included'],
      ['HOLD {alt}', 'Strafe', 'Keeps you facing the crosshair while you move: sidestep, backpedal and circle a foe · no sprint while it is held · it also opens the {alt} layer: hold it for the Force powers'],
      ['{z}', 'Force slide', 'Out of a sprint: a long skid forward that ducks blaster fire and bowls troops over · attack out of it to sweep', 1],
    ]},
    { title: 'PARKOUR', rows: [
      ['{space}', 'Vault / climb', 'Press it right in front of low cover while running at it to vault over in one move; jump at a ledge to pull up'],
      ['{LS}', 'Ledge hang', 'Catch a high lip to hang; push the stick sideways to shimmy, up (or {space}) climbs, down drops', 1],
      ['{w}', 'Wall-run', 'Jump alongside a tall wall at speed, stick forward; {space} kicks off it', 1],
      ['FLOW', 'Parkour pays', 'Every vault, climb, slide, wall-run and roll refunds Force; chain different moves for more, and the cut right after one hits harder', 1],
      ['{shift}', 'Landing roll', 'Just before a hard landing, or you stagger', 1],
    ]},
    { title: 'FIGHT', rows: [
      ['{lmb}', 'Saber combo', 'The way you push {LS} picks the cut (the needle through the crosshair shows the next one): left or right sweeps sideways, forward chops overhead (a thrust aimed low), a diagonal cuts down or up, back whirls behind you; the stick at rest walks your form\'s string of cuts. Where you aim picks its height: aim up for a high cut at the head, down for a low one at the legs (the ticks by the crosshair). A cut that starts where the last one finished flows on quicker. Every third is a finisher'],
      ['HOLD {rmb}', 'Block', 'Soaks most of a blow; heavy hits drain stamina'],
      ['TAP {rmb}', 'Parry and deflect', 'Time it as a blow or bolt lands; a missed parry can\'t be retried for a moment'],
      ['{e}', 'Kick', 'Shoves a foe back and cracks a duellist\'s guard'],
      ['IN THE AIR', 'A leap is a commitment', 'Mid-fight you steer less, can\'t hold a guard, and a blow that lands hits harder and drops you', 1],
      ['{w} + AIR + {lmb}', 'Aerial cut', 'Leaping forward: a short lunge and a cut at the foe ahead · costs Force, 3s cooldown · a standing jump just swings', 1],
      ['{lmb}', 'Saber lock', 'Blades bound: mash to drive through · {e} kicks out · {f} shoves', 1],
      ['{t}', 'Lock on', 'Keeps one foe framed; press again to release', 1],
      ['{1} / {2} / {3}', 'Saber form', 'The three forms in your loadout'],
      ['{g}', 'Switch grip', 'In Niman, regular or reverse (swings hit the same either way) · in Djem So or Shien (Form V) it swaps to the other one if you know it · Shien always holds a reverse grip, every other form a forward one', 1, ['niman', 'djemso', 'shien']],
      ['{4}', 'Holster saber', 'Fight with the Force alone, both hands free: {rmb} wards, Force powers hit 20% harder, Force refills faster and every blow you land gives a little back · {4} again draws', 1],
      ['HOLSTERED {lmb}', 'Force-imbued strikes', 'Jab, cross, then a finisher the stick picks: at rest a two-palm burst that turns bolts, forward a driving lunge palm, left or right a wide backhand sweep, back a rising palm that throws light foes up · HOLD {lmb} to gather a charged palm and let go to fire it: a full charge breaks guards, staggers elites and bosses and turns grenades back', 1],
      ['HOLSTERED {e}', 'Force kicks', 'Mid-string: a spin kick that clears the ring round you · in the air: a Force stomp straight down · otherwise the front kick', 1],
      ['HOLSTERED {f} / {c}', 'Strike into power', 'Push or Pull right after a blow lands flows out of it for less Force: Push becomes a Palm Push that hits the nearest hard, Pull drags them onto your next strike', 1],
      ['{h}', 'Squad orders', 'With a squad · TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows): {RS} picks, the D-pad orders one squadmate, let go to give it · stand by a downed squadmate to get them up · in the sandbox it opens the sandbox panel, and {alt} + {h} gives orders', 1],
      ['{n}', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players, in your colour, with an arrow on their screens when it is out of view · works solo too'],
      ['{rmb} + {space}', 'Evasive leap', 'Jump while blocking to vault clear · in a fight it spends a dash charge and is only safe at its start', 1],
    ]},
    { title: 'FORCE POWERS', rows: [
      ['{f}', 'Push', 'From the start · holding a foe in a Grasp, throws them'],
      ['{c}', 'Pull · hold to Grasp', 'Unlocks after wave 2 · grasped: {f} throws, {c} yanks in, {z} drops'],
      ['{v}', 'Barrier', 'Earned with XP · or Saber Throw (hold {rmb} and pull {lmb})'],
      ['{x}', 'Jump attack', 'Leaps if you\'re on the ground, winds up, then drives the blade down · Earned with XP · or Mend, a self-heal'],
      ['{r}', 'Judgement', 'Earned with XP · or Repulse'],
    ]},
  ],
  mando: [
    { title: 'MOVE', rows: [
      ['{LS}', 'Move', 'Steers any way, at the stick\'s angle'],
      ['{mouse}', 'Aim', 'Speed: Settings · STICK SENS · scoped, SCOPE SENS'],
      ['{space}', 'Hop', 'Run and hop at low cover to vault it; hop at a ledge to climb'],
      ['HOLD {space}', 'Jetpack thrust', 'Hover and climb; burns fuel'],
      ['{shift}', 'Combat dive', 'On the ground it dives you flat any way you push {LS}, Max Payne style, on your legs alone (no jet fuel), then you get back up: free, invulnerable through the throw, and the gun stays on target · turn the crosshair mid-dive and the lay-out rolls with it · dive just as a blow lands for a perfect dodge'],
      ['{shift} x2', 'Jet dive / rocket boost', 'Again while the dive is in the air lights the pack and throws it much farther (hold it to fly on) · just after a dive lands, the full rocket boost · both spend jet fuel', 1],
      ['{shift} (air)', 'Air dodge', 'A straight thruster kick any way you push, invulnerable for a moment, and it stops your fall · spends a jet charge (the pips on the slot) and a little fuel', 1],
      ['HOLD {shift}', 'Boost in the air', 'Keep it held after the dodge: he lays out the way you fly, Max Payne style, guns up on the crosshair · look down to dive', 1],
      ['HOLD {rmb} (air)', 'Hover', 'Hold your height and strafe; let go of the stick to stop dead', 1],
      ['HOLD {alt}', 'Strafe', 'Stay square to the crosshair while you move; running away from it no longer turns your back · it also opens the {alt} layer: hold it for the gadgets'],
      ['{c}', 'Slide', 'Feet first, out of any run, aiming too · carries far, steers a little, ducks blaster fire and keeps your aim steady · jump out of it for a long hop', 1],
      ['FLOW', 'Parkour pays', 'Vaults, climbs and slides refuel the jetpack; shots right after one hit harder'],
    ]},
    { title: 'FIGHT', rows: [
      ['{lmb}', 'Fire', 'Headshots deal far more damage'],
      ['{r}', 'Vent heat', 'Cool down before you overheat'],
      ['TAP {rmb}', 'Beskar parry', 'Just as a bolt reaches you: the vambrace ricochets it back at the shooter, harder · any gun but the Darksaber, in the air too · mistimed, it locks out for a moment'],
      ['HOLD {rmb}', 'Brace / shield / scope', 'Depends on the weapon in hand · scoped look speed is the SCOPE SENS setting'],
      ['{lmb} (disruptor)', 'Spear stab', 'Unscoped, the disruptor is an electric spear: a quick thrust that lunges in and stuns · pull again to keep jabbing', 1],
      ['{e}', 'Close quarters', 'Jab, cross, knee, vibroblade, each one stepping you in to arm\'s length · tap {e} as a blow lands to catch it on the vambrace'],
      ['HOLD {e}', 'Clinch', 'Keep it held through a blow and take the foe by the collar · {e}: beskar headbutt (the third floors it) · {lmb}: throw it the way you face, bowling over whoever it hits · brutes and guarding duellists can\'t be held', 1],
      ['{w} + {e}', 'Jet charge', 'Burn in and shoulder-check a foe a few strides ahead', 1],
      ['AIR + {e}', 'Dive kick', 'In the air: drop boot-first onto a foe below', 1],
      ['{rmb} + {e}', 'Shield and blade', 'Single blaster: vibroblade cuts and a shield bash with the shield kept up · costs stamina', 1],
      ['{e}', 'Takedown', 'On a staggered or floored foe: the vibroblade, up under the plate or driven down from one knee', 1],
      ['{1} / {2} / {3}', 'Switch weapon', '{1} your sidearm, {2} your primary, {3} the Disruptor or Darksaber · choose the sidearm and primary in the ARMORY'],
      ['{rmb} + {lmb}', 'Darksaber throw', 'Darksaber in hand: hurl it, and the grappling line reels it back through anything in its path', 1],
      ['{h}', 'Squad orders', 'With a squad · TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows): {RS} picks, the D-pad orders one squadmate, let go to give it · stand by a downed squadmate to get them up · in the sandbox it opens the sandbox panel, and {alt} + {h} gives orders', 1],
      ['{n}', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players, in your colour, with an arrow on their screens when it is out of view · works solo too'],
      ['{4}', 'Holster', 'Take a fighting stance with fists and gadgets: {lmb} / {e} swing hook, hook, uppercut, haymaker, hold {rmb} for the gauntlet shield ({lmb} behind it cuts shield and blade), and gadget power refills faster · {4} or a weapon slot draws', 1],
    ]},
    { title: 'GADGETS', rows: [
      ['{f}', 'Flamethrower', 'Unlocks after wave 2 · hold to keep it burning'],
      ['{q}', 'Wrist rocket', 'From the start'],
      ['{x}', 'Grappling hook', 'Earned with XP · or Jetpack Slam'],
      ['{v}', 'Whistling Birds', 'Earned with XP · or the Thermal Detonator, thrown onto the crosshair: aim lower to drop it close, higher to send it far'],
      ['{g}', 'Bacta stim', 'Earned with XP · a self-heal'],
      ['{z}', 'Jetpack missile', 'The final upgrade'],
    ]},
  ],
  // the clone ARC trooper (testing only: player/trooper/kit.js) plays on the Mandalorian's pad binds
  trooper: [
    { title: 'MOVE', rows: [
      ['{LS}', 'Move', 'Steers any way, at the stick\'s angle'],
      ['{mouse}', 'Aim', 'Speed: Settings · STICK SENS'],
      ['{space}', 'Jump', 'Run and jump at low cover to vault it; jump at a ledge to climb · no jetpack: the trooper fights on foot'],
      ['{shift}', 'Combat roll', 'A dive any way you push, invulnerable through the throw, and the gun stays on target'],
      ['{c}', 'Slide', 'Feet first out of a run, firing as you go'],
      ['HOLD {alt}', 'Strafe', 'Stay square to the crosshair while you move · it also opens the {alt} layer: hold it for the powers'],
    ]},
    { title: 'FIGHT', rows: [
      ['{lmb}', 'Fire', 'DC-15: a three-bolt burst · twin DC-17s: semi-auto, each pull fires the other pistol, so pull fast · headshots hit far harder'],
      ['HOLD {rmb}', 'Aim', 'Up to the eye: a tight cone and a steady reticle, with either gun'],
      ['{r}', 'Vent', 'Overheated: press it in the beat (a moment after the overheat) for a perfect vent that clears the gun at once · too early or late and it jams · not overheated: a plain vent'],
      ['{1} / {2}', 'Switch gun', 'DC-15 rifle or the twin DC-17s'],
      ['{e}', 'Rifle bash', 'A shove with the stock: staggers whoever is right in front and cracks a duellist\'s guard'],
      ['{h}', 'Squad orders', 'TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows): {RS} picks · ATTACK, GRENADE and SUPPRESS cost COMMAND POINTS, earned by your kills and the squad\'s · SUPPRESS pins the foes round the crosshair: they crawl and slow their shots · ATTACK sends two round the target\'s sides to FLANK it: they hit it harder from there'],
      ['{t}', 'Battlefield call', 'For COMMAND POINTS · a squadmate down: REINFORCE gets everyone up now · otherwise a SUPPLY DROP lands beside you: grenades, coolant and a patch-up', 1],
      ['{n}', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players'],
    ]},
    { title: 'POWERS', rows: [
      ['{g}', 'Frag grenade', 'Thrown onto the crosshair · two charges that refill one at a time'],
      ['{q}', 'Recon scan', 'A pulse that marks every foe nearby: marked foes take more damage from you and the squad', 1],
      ['{v}', 'Bubble shield', 'A dome where you stand that stops enemy bolts (fork I, against Field Medic)', 1],
      ['{f}', 'Ion grenade / breach charge', 'Ion: stuns and drops shields · Breach: a forward blast that launches (fork II: one or the other)', 1],
      ['{z}', 'Artillery barrage', 'The Commander: shells walk down round the crosshair', 1],
      ['{3}', 'AT launcher', 'The Commando: a heavy rocket off the rifle', 1],
      ['{x}', 'Gunship strafing run', 'A gunship lays a line of blasts from you toward the crosshair', 1],
    ]},
  ],
};
