// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mandalorian kit tuning (MANDO, MANDO_WEAPONS) plus Jedi Force-jump tuning.

import { G, player } from '../state.js';

/* ---------- MANDALORIAN loadout ---------- */
export const HEADSHOT_MULT = 2.4;   // a blaster bolt to the head zone hits this much harder
export const MANDO = {
  boltSpeed: 48, spread: 0.003,   // bolts go through the crosshair; a touch slower than before so LEADING moving targets matters
  braceDR: 0.6,                                             // beskar brace: incoming damage ×(1-this)
  // JETPACK runs on its OWN fuel (player.jet, separate from ability Force). Limited: drains fast, regen on the ground.
  jetThrust: 46, jetMaxUp: 8.0, jetDrain: 20, jetRegen: 7, jetRegenGround: 30, fallCap: 15, jetHover: 8,   // fuel is a real commitment: barely trickles back in the air, recovers only on the ground (touch down to refuel)
  // MOMENTUM FLIGHT. SPACE = vertical thrust (hover/climb). SHIFT (tap, airborne) = AIR DODGE (data/mobility.js); held = directional BOOST that drives
  // you where you're moving/facing and DIVES when you look down — strong forward momentum that CARRIES on release.
  airAccel: 26, airSpeed: 12, airSpeedMax: 24, airDrag: 0.55,   // gentle WASD steer · ref · momentum cap · low drift drag
  climbBase: 8.5, climbRange: 7, diveCap: 32,                   // SPACE vertical: base hover/climb + more looking up
  boostThrust: 50, boostDrain: 20, boostDiveAccel: 40,          // SHIFT boost: horizontal thrust · fuel/s · look-down dive accel
  // the boosted flight's Max Payne lay-out (player/animation.js): the most it lies over (rad) flying forward / backward /
  // sideways (and how far a side lay-out rolls onto the back), at full speed and height, and how fast it follows
  // POWER CELLS (auto, data/store.js MANDO_AUTO) — the guns' energy: each tier holds more heat before an overheat (cap)
  // and sheds it faster (cool), so the fire-rate upgrades that drain it quicker have something to draw on
  cells: { cap: [1, 1.25, 1.5, 1.8], cool: [1, 1.1, 1.2, 1.3] },
  // firing the jetpack missile he leans in over it, the pack aimed down the reticle: how far (rad), for how long (s),
  // and how fast it goes in
  missileLean: { lean: 0.4, time: 0.75, in: 0.08 },
  flightLean: { fwd: 1.2, back: 1.05, side: 1.1, sideUp: 0.22, rate: 8 },
  boostDash: { speed: 30, time: 0.30, cd: 0.6, fuel: 16 },      // ROCKET BOOST on the ground (SHIFT twice); spends jet fuel · the dive and air dodge: data/mobility.js
  // ABILITY base costs are deliberately STEEP — upgrades (player.up.abilityCostMul) bring them down
  flame: { range: 8.5, angle: 0.5, dmg: 42, knock: 4, fuel: 52 },  // F (HELD) — flamethrower, Force/sec in a cone (drains faster now)
  // Q — wrist rocket: a PRECISE stagger. Knocks down the foe it hits and anyone right beside it, minimal damage. It used
  // to be a 6.6m, 60-knock blast every 2.4s from wave 1 (area denial on demand, and the same job as the detonator); the
  // wide blast now belongs to the THERMAL DETONATOR, and mastery grows the rocket back toward it late in the run.
  rocket: { cost: 34, cd: 4.0, speed: 34, dmg: 6, radius: 3.2, knock: 24 },
  // late/heavy ordnance is TAXING — long cooldowns + steep Force so the big blasts are a deliberate beat, not spam
  jetMissile: { cost: 74, cd: 14.0, speed: 30, dmg: 180, radius: 11, knock: 28 },  // Z — Boba-Fett back launcher: HUGE blast
  dark: { cost: 36, cd: 0.6, dmg: 78, range: 5.6, arc: 1.4, knock: 20 },      // DARKSABER weapon — LMB slash
  // DARKSABER THROW (RMB + LMB, Darksaber in hand) — hurl the spinning blade, then the gauntlet's grappling line latches
  // on and reels it home, cutting again on the way back. Every foe it touches is cut once going out and once coming back.
  darkThrow: { cost: 30, cd: 6.0, dmg: 58, speed: 30, range: 18, latch: 0.16, reelSpeed: 40, knock: 10 },
  birds: { cost: 48, cd: 7.5, count: 6, dmg: 20, radius: 2.6, speed: 26, knock: 6 },   // V — whistling birds (homing)
  deto:  { cost: 42, cd: 5.2, fuse: 1.15, dmg: 72, radius: 6.5, knock: 22, range: 26, minRange: 3, flight: [0.35, 0.9] },   // thrown onto the reticle (range m; flight s, near → far)           // V — thermal detonator (sticky) — THE Mando area blast (radius 5.5→6.5 as the rocket shrank)
  grapple: { cost: 18, cd: 1.2, range: 26, pullSpeed: 42 },                            // C — grappling hook
  // X (air) — jetpack slam (jet fuel). A beat of wind-up (the pack fires up, he rises a little with the fist cocked),
  // then the jets flip and drive him down; the landing is a superhero three-point with the fist in the deck. The
  // farther he falls the harder it lands (up to boost× damage/radius from fallFull m), and foes inside core are stunned.
  slam:  { cost: 34, dmg: 46, radius: 9, knock: 14, diveVel: 44, wind: 0.3, rise: 5, core: 3.5, stun: 1.4,
           fallFull: 12, boost: 1.35 },                     // X (air) — jetpack slam (jet fuel)
  // (the E melee kit — string, catch, charge, dive kick, takedown — is tuned in data/duel.js MANDO_MELEE)
  // BACTA STIM (G) — the Mando's self-heal: jam a bacta injector into the gauntlet line. Mirrors the Jedi's Force
  // Mend (a quick channel → a big restore). Mutually exclusive with HUNTER'S CREED (heal-per-kill) so you commit to
  // ONE sustain path. Heal amount reuses CFG.abilities.mend.heal via mendComplete(). Cooldown tightened 14→10s (Pass
  // 55b) — at 14s its total healing-per-fight didn't clearly beat just taking BESKAR PLATING's free heal-on-pickup,
  // making the 200-XP purchase (now 150, see MANDO_STORE) feel pointless next to Hunter's Creed's free per-kill trickle.
  bacta: { cost: 42, cd: 10.0, channel: 0.5 },
};
// THE GUNS. fire: 'semi'(1/click) · 'auto'(hold) · 'burst'(a click fires `burst` bolts `burstGap` s apart) · 'rifle'(disruptor) · 'saber'(melee)
// ENERGY model (Battlefront-2 style): no ammo. Each shot adds HEAT; cap it and you OVERHEAT and must wait for a full
// vent. `heat` = per-shot, `cool`/`overCool` = recovery per second (normal / while overheated). `vent` = how long the
// manual vent (R) locks the trigger: a pistol dumps its heat in a flick, the repeater's coolant takes a real beat.
// hipSpread/braceSpread = bolt cone (rad) hipfire vs while BRACING (hold RMB) · braceDmg = damage ×while braced.
// foStart/foEnd = distance where damage starts/finishes falling off · foMin = min damage mult (bracing also lifts this).
// kick = recoil per shot (the hand and the reticle jump) · climb = how far each shot walks the reticle up (px) ·
// flinch = how hard a bolt rocks the foe it hits · size = the bolt's thickness · col = its colour.
// `slot`: the LOADOUT slot the gun goes in (KIT_SLOTS below) — a SIDEARM on 1, a PRIMARY on 2. `twoHand` guns are
// shouldered (one long-gun model at a time: player/model/weapons.js); only the disruptor has a `scope` on RMB.
// BRACING is the core skill: it tightens the cone hard, boosts damage, and stretches your effective range.
export const MANDO_WEAPONS = {
  single:    { name: 'BLASTER PISTOL', short: 'PISTOL', slot: 'sidearm', fire: 'semi', fireCd: 0.15, dmg: 32, dual: false, heat: 0.115, cool: 0.6, overCool: 0.46,
               hipSpread: 0.008, braceSpread: 0.002, braceDmg: 1.08, foStart: 18, foEnd: 44, foMin: 0.5, kick: 0.3, vent: 0.45 },   // bolts track the reticle; the SWAY is the difficulty
  dual:      { name: 'DUAL BLASTERS', short: 'DUAL', slot: 'sidearm', fire: 'auto', fireCd: 0.11, dmg: 13, dual: true,  heat: 0.066, cool: 0.66, overCool: 0.5,
               hipSpread: 0.02, braceSpread: 0.006, braceDmg: 1.12, foStart: 8, foEnd: 24, foMin: 0.35, kick: 0.18, vent: 0.6 },    // a touch looser, but still honest to the reticle
  // PULSE CARBINE — the mid-range primary: three-round bursts that walk up the target (pull the reticle back down
  // between bursts), accurate even from the hip, shorter falloff than the pistol, no shield behind it
  carbine:   { name: 'PULSE CARBINE', short: 'CARBINE', slot: 'primary', fire: 'burst', burst: 3, burstGap: 0.068, fireCd: 0.36, dmg: 21, heat: 0.046, cool: 0.72, overCool: 0.55,
               hipSpread: 0.011, braceSpread: 0.003, braceDmg: 1.1, foStart: 22, foEnd: 52, foMin: 0.55, kick: 0.17, climb: 3.2, flinch: 0.5,
               size: 1.25, col: 0x8fe8ff, twoHand: true, vent: 0.55 },
  // HEAVY REPEATER — the crowd shredder: it SPINS UP while the trigger is held (spin.from → spin.to seconds between
  // shots over spin.up s; it winds back down over spin.down once you let go), heavy recoil and a wide cone, every bolt
  // rocks the foe, he walks slower while it fires (slow), and it cooks fast: an overheat or a vent costs a long beat
  repeater:  { name: 'HEAVY REPEATER', short: 'REPEATER', slot: 'primary', fire: 'auto', fireCd: 0.055, dmg: 15, heat: 0.021, cool: 0.4, overCool: 0.26,
               hipSpread: 0.03, braceSpread: 0.011, braceDmg: 1.06, foStart: 14, foEnd: 36, foMin: 0.45, kick: 0.24, climb: 0.9, flinch: 0.25,
               size: 1.7, col: 0xff8a4a, twoHand: true, spin: { from: 0.22, to: 0.055, up: 1.1, down: 1.4 }, slow: 0.55, vent: 1.1 },
  disruptor: { name: 'DISRUPTOR', short: 'DISRUPTOR', fire: 'rifle', fireCd: 0.7, dmg: 150, dual: false, heat: 0.42, cool: 0.5, overCool: 0.4,
               hipSpread: 0, braceSpread: 0, braceDmg: 1, foStart: 999, foEnd: 999, foMin: 1, vent: 0.7,
               twoHand: true, scope: true, stabDmg: 38, stabRange: 5.2, stabStun: 2.0,   // pinpoint sniper; else a fast electric spear
               // the stab: the whole move (s), the share of it where the prongs land (chamber → drive), the gap to the next
               // jab (a click inside the last stretch queues it), and the lunge
               stabTime: 0.34, stabHit: 0.3, stabCd: 0.38, stabQueue: 0.14, stabLunge: 9 },
  darksaber: { name: 'DARKSABER', short: 'DARKSABER', fire: 'saber', melee: true },                              // LMB slash; unlocked at the wave-5 fork
  fists:     { name: 'HOLSTERED', short: 'HOLSTER', fire: 'fists', melee: true },                              // 4: weapon holstered, LMB throws the close-quarters string (not in the wheel)
};

/* THE LOADOUT (the Mando's answer to the Jedi's three forms) — two slots: a SIDEARM on 1 and a PRIMARY on 2. Key 3
   stays the signature weapon (the Disruptor or the Darksaber, the store's fork) and 4 holsters. Each slot holds one gun
   of its kind or null; the guns not carried stay in the ARMORY (ui/armory-ui.js). A campaign or survival run starts on
   RUN_KIT and grows as the run is handed guns (ARMORY_PATH): a gun for an empty slot goes straight in, one for a full
   slot opens the armory to choose which to carry. The training grounds' lessons set their own; a mission or the
   sandbox starts on what was picked before the fight (else DEFAULT_KIT, from what the story has opened). */
export const KIT_SLOTS = ['sidearm', 'primary'];
export const KIT_LABEL = { sidearm: 'SIDEARM', primary: 'PRIMARY' };
export const RUN_KIT = { sidearm: 'single', primary: null };
export const DEFAULT_KIT = { sidearm: 'single', primary: 'carbine' };
// where a run is handed each gun (the auto-unlocks in data/store.js are built from this): `chapter` for the campaign,
// `stage` (waveTotal) for survival and the missions. The blaster pistol is in the starting kit.
export const ARMORY_PATH = [
  { weapon: 'carbine',  chapter: 'siege',        stage: 1 },   // the first primary: taken off the siege's dead
  { weapon: 'dual',     chapter: 'archive',      stage: 2 },   // a second pistol: now the sidearm is a choice
  { weapon: 'repeater', chapter: 'trial-knight', stage: 5 },   // the heavy gun, the bounty for the champion's trial
];
// THE ARMORY CODEX — what each gun is for, shown on the armory page (ui/armory-ui.js). Keep in step with MANDO_WEAPONS.
export const ARMORY_CODEX = {
  single:   { tag: 'PRECISION', best: 'Single targets, headshots, and holding a line', lore: 'A Mandalorian\'s first gun: a heavy blaster pistol on the same arm as the gauntlet\'s shield.',
              pros: ['Pinpoint, with the longest reach of the blasters', 'The gauntlet shield: hold RMB to send frontal fire back', 'Headshots hit 2.4×'],
              cons: ['One bolt at a time', 'Firing drops the shield for half a second'] },
  dual:     { tag: 'CLOSE WORK', best: 'Rushing troopers and anything within ten metres', lore: 'Two pistols, one in each hand. Fire poured out up close, and nothing behind it.',
              pros: ['Hold the trigger: they pour fire', 'The fastest kill up close', 'Bracing (RMB) tightens them into real damage'],
              cons: ['Harsh falloff past ten metres', 'No shield: bracing is offence only'] },
  carbine:  { tag: 'MID RANGE', best: 'Troopers at mid range, officers, jet troopers', lore: 'A shouldered pulse carbine. Three bolts a pull, steady from the hip.',
              pros: ['Three-round bursts, accurate even moving', 'Long reach before damage drops off', 'A quick vent'],
              cons: ['Each burst climbs: pull it back on target', 'No shield behind it'] },
  repeater: { tag: 'SUPPRESSION', best: 'Crowds, brutes and shields', lore: 'A heavy repeating blaster off a dead gunner\'s emplacement. It has to wind up, and then it does not stop.',
              pros: ['Spins up to the highest fire rate of any gun', 'Every bolt rocks the foe it hits', 'Holds a crowd back on its own'],
              cons: ['Slow to wind up, wide cone, heavy recoil', 'You walk slower while it fires', 'Cooks fast, and an overheat or a vent costs a long beat'] },
};
const _gunOwned = { single: () => true, dual: () => !!G.unlocked.dual, carbine: () => !!G.unlocked.carbine, repeater: () => !!G.unlocked.repeater,
  disruptor: () => !!G.unlocked.disruptor, darksaber: () => !!player.up.darksaber, fists: () => true };
// the hero has this gun at all (in the armory or in hand)
export function weaponOwned(name){ const f = _gunOwned[name]; return !!(f && f()); }
// a loadout as stored or handed in → { sidearm, primary }, each a gun of that slot the hero owns, or null. The
// sidearm never stays empty: the blaster pistol is always there.
export function cleanKit(kit, owned = weaponOwned){
  const out = {};
  for (const s of KIT_SLOTS){
    const id = kit && kit[s];
    out[s] = id && MANDO_WEAPONS[id] && MANDO_WEAPONS[id].slot === s && owned(id) ? id : null;
  }
  if (!out.sidearm) out.sidearm = 'single';
  return out;
}
export const kitOf = () => G.mandoKit || RUN_KIT;
// the best kit for what the hero owns: the pistol (its shield) and the newest primary
export function bestKit(owned = weaponOwned){
  const prim = ARMORY_PATH.map(p => p.weapon).filter(w => MANDO_WEAPONS[w].slot === 'primary' && owned(w)).pop() || null;
  return cleanKit({ sidearm: 'single', primary: prim }, owned);
}
// the weapon on each number key: 1 sidearm · 2 primary · 3 signature (Disruptor or Darksaber, whichever was taken)
export const signatureWeapon = () => player.up.darksaber ? 'darksaber' : 'disruptor';
export function keyWeapon(k){ const kit = kitOf(); return k === '1' ? kit.sidearm : k === '2' ? kit.primary : k === '3' ? signatureWeapon() : null; }
// the wheel's order: what's carried
export function carriedOrder(){ const kit = kitOf(); return [kit.sidearm, kit.primary, signatureWeapon()].filter(w => w && weaponUnlocked(w)); }
// BESKAR PARRY — TAP RMB as a bolt arrives: the vambrace comes up and the bolt RICOCHETS straight back at whoever
// fired it, harder and faster than it came (any gun but the Darksaber, which parries like a lightsaber; works in the
// air too — it's armour, not footwork). window: how long a press stays live (s; difficulty adds its window) · lock: a
// press that catches nothing can't be pressed again for this long, so mashing RMB doesn't work · dmg: the ricochet's
// damage, × the bolt's (at least min) · speed: × the bolt's speed · vent: share of the gun's heat it bleeds off ·
// stam: stamina handed back · pose: how long the vambrace stays up after a catch (the left arm's block pose)
export const BESKAR_PARRY = { window: 0.2, lock: 0.4, dmg: 2.4, min: 34, speed: 1.6, vent: 0.35, stam: 10, pose: 0.22 };
// JEDI aerial Force-control — only kicks in when you HOLD space (a tap is just a normal jump). The TAKEOFF
// costs the bulk of the Force up front, then a slow drain while held; it arcs to an apex under gentled gravity
// then a graceful (not floaty) glide-down. Power LEVELS UP automatically (player.up.fjTier), like the jetpack.
export const JEDI_FORCE = { soarAccel: 20, soarMax: 11.5, riseGravity: 0.72, glideFall: 4.2 };
export const JUMP_HOLD_THRESH = 0.14;   // hold space longer than this (airborne) to trigger the Force jump vs. a tap
export const DJUMP_FORCE = 14;   // the Jedi double-jump spends this much Force (no Force → no second jump)
export const WALLKICK_FORCE = 8;   // a wall-kick now spends this much Force — was free, let it be chained for unlimited altitude
export const MELEE_WINDUP_GAP = 0.25;   // min seconds between two hostile melee foes starting a windup on the player
export function forceJumpPow(){   // scales with the auto-leveled Force-jump tier (weak early, strong late)
  const t = player.up.fjTier || 0;
  return { takeoff:  [6.5, 10, 13.5][t] || 6.5,    // initial leap added on top of the jump
           initCost: [34, 30, 26][t]   || 34,      // the big up-front Force cost (the majority of a jump)
           holdCost: [9, 7.5, 6][t]    || 9,       // slow drain/sec while still rising
           glideCost:[4, 3.5, 3][t]    || 4 };     // even slower drain/sec while gliding down
}
// the hero can draw this gun right now: owned, and (for a sidearm or primary) carried in the loadout
export function weaponUnlocked(name){
  if (!weaponOwned(name)) return false;
  const W = MANDO_WEAPONS[name];
  return !W || !W.slot || kitOf()[W.slot] === name;
}
