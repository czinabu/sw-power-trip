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
    riposteTime: 1.6,
    comboDamage: [30, 30, 56],      // damage per combo step (3rd is finisher) — toned down for a stiffer challenge
    comboRange: 7.5,                 // lunge targeting range
    hitRadius: 3.6,                  // swing damage radius
  },
  abilities: {
    // BASIC powers — cheap, available from the start
    push:   { cost: 20, cd: 0.9,  range: 15, angle: 1.15, dmg: 2,  knock: 24 },   // pure UTILITY — a hard interrupting SHOVE, near-zero damage
    dash:   { cost: 16, cd: 0.9,  speed: 30, time: 0.34 },  // dash grants i-frames + a flip (spends Force)
    pull:   { cost: 30, cd: 3.0,  range: 18, angle: 1.2 },
    // ADVANCED powers — expensive, earned as the legend grows. The mightiest eat most of the bar.
    throw:  { cost: 38, cd: 5.0,  range: 16, dmg: 22, speed: 24 },
    slam:   { cost: 64, cd: 5.5,  radius: 10, dmg: 7, knock: 21 },   // AOE knockdown to clear breathing room, not a finisher
    // the late ULTIMATES are deliberately TAXING — big Force cost + long cooldown so they're a deliberate beat, never spam
    judge:  { cost: 72, cd: 12.0, range: 14, angle: 0.9, targets: 4, time: 1.3, tick: 0.12, dmg: 7 },  // chain lightning channel
    repulse:{ cost: 82, cd: 11.0, radius: 13, dmg: 30, knock: 36 },   // FORCE REPULSE — a 360° concussive blast
    // FORCE BARRIER — the kit's lone DEFENSIVE power: a brief bubble that soaks damage and auto-deflects bolts.
    barrier:{ cost: 35, cd: 11.0, dur: 3.0, dr: 0.7, radius: 2.4, knockR: 6.5, castKnock: 20, expireKnock: 11 },
    // FORCE MEND — pour the Force into your own wounds: a big restorative pulse. Steep cost + long cd (no spamming).
    mend:   { cost: 55, cd: 16.0, heal: 0.30 },   // heal = fraction of MAX vitality (a strong relief, not a full reset — pressure persists). shared by Bacta Stim
  },
  convertDmgMult: 3,   // damage dealt by Force-converted allies (legacy enemy-state machinery)
  bossReflectWindow: 5.0,  // orb must be within this distance when you PUSH (precise timing)
  killStreakTimeout: 4.0,
  // CAMERA — follow-cam feel (see src/engine/camera.js)
  camera: {
    baseDist: 8.2,            // resting follow distance
    calmDist: -0.7,           // between waves / nothing nearby: tuck in closer for a more grounded, personal view
    crowdRadius: 10,          // enemies inside this range count toward the crowd pull-back
    crowdPull: 0.32,          // extra distance per nearby enemy...
    crowdMax: 1.8,            // ...capped here, so a brawl always fits on screen
    crowdLift: 0.5,           // and the lens rises up to this much so the pack reads over the hero's shoulders
    bossDist: 1.4,            // boss fights sit further back...
    bossNear: 2.0,            // ...and further still (up to this) while the boss is right on top of you
    shake: 0.32,              // screen-shake strength (trauma² — small hits stay subtle, big ones land hard)
    shakeRoll: 0.035,         // max roll (radians) at full trauma
    hitKick: 0.42,            // the lens is knocked away from whatever hit you
    impactFov: 3.5,           // FOV punch-in on heavy hitstop / slow-mo beats
    sway: 0.035,              // idle handheld drift (0 to disable)
  },
};
