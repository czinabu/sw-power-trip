// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CFG: player and ability tuning. Edit here to retune the game.


/* ============================================================
   CONFIG — EDIT THESE TO TUNE THE GAME
   ============================================================ */

export const CFG = {
  player: {
    maxHp: 100, maxForce: 100, forceRegen: 13, hpRegen: 2, hpRegenDelay: 6,   // Force regens a touch slower → abilities are deliberate, not spammed
    speed: 7.2, accel: 34, jumpVel: 10.2, gravity: 27, airJumps: 1,
    radius: 0.55,                    // collision radius vs solid pillars/crates
    maxStam: 100, stamRegen: 22, stamDelay: 0.62,   // stamina system for swings/blocks — slower recovery, longer delay (no mindless mashing)
    blockStamCost: 12, blockMoveCost: 0,
    parryWindow: 0.16,               // a TIMED window — opens the instant you click RMB
    parryWhiffLock: 0.42,            // a window that catches nothing leaves the guard unable to parry for this long (no spamming RMB)
    blockChip: 0.22,                 // fraction of a BLOCKED melee blow that still gets through the guard (a parry takes none)
    blockHeavy: 20,                  // blows at least this strong cost proportionally more stamina to block
    riposteTime: 0.9,                // the counter must follow the parry promptly
    comboDamage: [30, 30, 56],      // damage per combo step (3rd is finisher) — toned down for a stiffer challenge
    comboRange: 5.0,                 // lunge targeting range
    lungeMax: 2.4,                   // the farthest a cut's lunge closes on a foe — close the rest of the gap yourself
    hitRadius: 3.2,                  // swing damage radius
    // swing ARCS as cosines off your facing: a cut hits ~140° in front, a strafe sweep ~160°, the finisher ~190°
    swingArc: { cut: 0.34, sweep: 0.17, finisher: -0.1 },
    // HIT REACTIONS — a blow that lands staggers you: the swing is knocked loose and your feet slow
    flinch: { light: 0.2, heavy: 0.42, heavyDmg: 20, ranged: 0.1, move: 0.25, knock: 4.5, immune: 0.6 },
    // PERFECT DODGE — a dash that starts within `window` s of a blow landing slows time and arms a counter
    perfectDodge: { window: 0.16, slowmo: 0.3, slowT: 0.5, refund: 1, cd: 1.0 },
    // BLADE CLASH — your cut meets a foe's strike mid-arc: neither lands, both recoil
    clash: { from: 0.15, to: 0.75, knock: 9, push: 5, stam: 6 },
    // SOFT LOCK-ON (T / middle mouse) — the camera keeps one foe framed
    lockOn: { range: 22, keep: 28, cone: 0.55, yawPull: 7, pitch: 0.2, pitchPull: 2.5 },
  },
  abilities: {
    // BASIC powers — cheap, available from the start
    push:   { cost: 20, cd: 1.4,  range: 15, angle: 1.15, dmg: 2,  knock: 24 },   // pure UTILITY — a hard interrupting SHOVE, near-zero damage. cd 0.9→1.4: it also reflects every bolt in the cone, so it was a near-constant shield from wave 1
    dash:   { cost: 16, cd: 0.9,  speed: 30, time: 0.34 },  // dash grants i-frames + a flip (spends Force)
    pull:   { cost: 30, cd: 3.0,  range: 18, angle: 1.2 },
    // ADVANCED powers — expensive, earned as the legend grows. The mightiest eat most of the bar.
    throw:  { cost: 38, cd: 5.0,  range: 16, dmg: 22, speed: 24 },
    slam:   { cost: 64, cd: 5.5,  radius: 10, dmg: 7, knock: 21,      // JUMP ATTACK — the wave is an AOE knockdown for breathing room…
              strike: 30, core: 2.6, leap: 11,                        // …the blade itself hits hard on whoever you land on; leap = ground take-off carry
              bigWave: 0, bigScale: 1.6 },                            // bigWave (mastery rank II): a double-jump dive lands a bigScale-wider wave
    // FORCE GRASP — hold the Pull key: after `hold` seconds the foe in your aim locks into your grasp
    grasp:  { hold: 1.0, cost: 26, drain: 18, maxT: 5, dist: 4.2, range: 16, angle: 0.5,
              throwSpeed: 30, throwDmg: 18, yankDmg: 4, bumpDmg: 8, bumpKnock: 20, bumpSpeed: 4.5 },
    // the late ULTIMATES are deliberately TAXING — big Force cost + long cooldown so they're a deliberate beat, never spam
    judge:  { cost: 72, cd: 12.0, range: 14, angle: 0.9, targets: 4, time: 1.3, tick: 0.12, dmg: 7 },  // chain lightning channel
    repulse:{ cost: 82, cd: 11.0, radius: 13, dmg: 30, knock: 36 },   // FORCE REPULSE — a 360° concussive blast
    // FORCE BARRIER — the kit's lone DEFENSIVE power: a brief bubble that soaks damage and auto-deflects bolts.
    // `cd` starts when the bubble DROPS (see forceBarrier), so a cast comes back every cd + dur = 11s, as before.
    barrier:{ cost: 35, cd: 8.0, dur: 3.0, dr: 0.7, radius: 2.4, knockR: 6.5, castKnock: 20, expireKnock: 11 },
    // FORCE MEND — pour the Force into your own wounds: a big restorative pulse. Steep cost + long cd (no spamming).
    mend:   { cost: 55, cd: 16.0, heal: 0.30 },   // heal = fraction of MAX vitality (a strong relief, not a full reset — pressure persists). shared by Bacta Stim
  },
  convertDmgMult: 3,   // damage dealt by Force-converted allies (legacy enemy-state machinery)
  bossReflectWindow: 5.0,  // orb must be within this distance when you PUSH (precise timing)
  killStreakTimeout: 4.0,
  // CAMERA — follow-cam feel (see src/engine/camera.js)
  camera: {
    // LENS — a big-budget third-person framing: the hero fills about a third of the frame height, the lens rides at
    // shoulder height just off the right shoulder, and a moderate FOV keeps the backdrop large (a wide FOV shrinks
    // everything past the hero, which is what made the arenas read small)
    fov: 60,                  // vertical degrees at rest (was 70: ~106° across a 16:9 screen, a fisheye on the props)
    pivotY: 1.9,              // the lens orbits a point this high over the hero's feet (just over head height)
    minLensY: 1.3,            // looking up swings the lens down, but never lower than this over the hero's feet
    shoulder: 0.75,           // Jedi lens sits this far right of the spine, so the foe ahead is never hidden behind you
    lookAhead: 5,             // the lens aims this far past the hero...
    lookUp: -0.15,            // ...and this high over the pivot (a hair under it keeps the hero's boots in frame)
    topDownFrom: 0.45,        // past this pitch (radians, looking down) the aim point starts drawing in toward the hero...
    topDownAhead: 0.5,        // ...losing up to this share of the look-ahead at the steepest pitch...
    topDownDrop: 0.5,         // ...and sinking this far, so a hero seen from overhead sits in frame, not off the bottom edge
    baseDist: 5.4,            // resting follow distance (was 8.2)
    calmDist: 0.6,            // between waves / nothing nearby: ease back a touch so an empty arena never feels cramped
    crowdRadius: 10,          // enemies inside this range count toward the crowd pull-back
    crowdPull: 0.4,           // extra distance per nearby enemy...
    crowdMax: 2.6,            // ...capped here, so a brawl always fits on screen
    mandoShoulder: 0.95,      // MANDO lens offset off the shoulder (never centred, see camera.js)...
    mandoShoulderAim: 1.25,   // ...wider while aiming / bracing, so the reticle is always clear of the helmet...
    mandoShoulderFly: 1.05,   // ...and in the air
    duelPull: 0.18,           // LOCK-ON: per metre to the locked foe, the lens backs off so both duelists stay framed...
    duelMax: 1.6,             // ...up to this much
    crowdLift: 0.5,           // and the lens rises up to this much so the pack reads over the hero's shoulders
    bossDist: 2.4,            // boss fights sit further back...
    bossNear: 3.4,            // ...and further still (up to this) while the boss is right on top of you
    shake: 0.19,              // screen-shake strength at 100% on the SHAKE slider (trauma² — small hits stay subtle, big ones land hard)
    shakeRoll: 0.02,          // max roll (radians) at full trauma
    hitKick: 0.28,            // the lens is knocked away from whatever hit you
    impactFov: 3.5,           // FOV punch-in on heavy hitstop / slow-mo beats
    sway: 0.035,              // idle handheld drift (0 to disable)
  },
};
