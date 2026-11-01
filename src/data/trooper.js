// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CLONE ARC TROOPER kit tuning (testing only: the hero shows on the menu with ?trooper in the URL). Edit freely.
// The trooper is a GUNNER like the Mando (state.js isGunner): it shares the reticle, bolts, heat and hit markers, but
// it fights on foot with no jetpack, leads a clone squad, and its guns are its own (TROOPER_WEAPONS below).
// STILL TO BUILD before it leaves testing: gamepad binds (the Mando's for now), its cutscene and mission lines (the
// Mando's for now), its own DC-15 model (the carbine's for now),
// a heat bar per pistol, and its story's Act II and III (data/campaign-trooper.js: Act I is built).

/* WEAPONS — the same fields as data/mando.js MANDO_WEAPONS (heat, cool, spreads, falloff), plus:
     fire 'burst'  the DC-15 rifle: one click fires `burst` bolts `burstGap` apart. RMB aims (the steady stance)
     fire 'twin'   the twin DC-17s, semi-auto: each LMB click fires the other pistol (each on its own `fireCd`, no two
                   shots closer than `twinGap`), one heat bar; RMB aims
     col           the bolt colour (clone blue, where the Mando's run orange) */
export const TROOPER_WEAPONS = {
  rifle:   { name: 'DC-15 RIFLE', short: 'DC-15', fire: 'burst', burst: 3, burstGap: 0.075, fireCd: 0.36, dmg: 15, dual: false, col: 0x4aa8ff,
             heat: 0.075, cool: 0.62, overCool: 0.45, hipSpread: 0.012, braceSpread: 0.003, braceDmg: 1.1, foStart: 20, foEnd: 46, foMin: 0.55,
             twoHand: true, vent: 0.5, trooper: true },
  pistols: { name: 'TWIN DC-17s', short: 'DC-17s', fire: 'twin', fireCd: 0.15, twinGap: 0.07, dmg: 21, dual: true, col: 0x6ab8ff,
             heat: 0.07, cool: 0.8, overCool: 0.52, hipSpread: 0.014, braceSpread: 0.006, braceDmg: 1, foStart: 10, foEnd: 26, foMin: 0.4,
             vent: 0.5, trooper: true },
  // the Commando's anti-armour module (key 3): one heavy rocket a pull, a long reload between, and it cooks the gun
  launcher: { name: 'AT LAUNCHER', short: 'LAUNCHER', fire: 'launcher', fireCd: 1.6, dmg: 130, radius: 4.6, knock: 26, speed: 30, dual: false, col: 0xffa04a,
              heat: 0.45, cool: 0.5, overCool: 0.4, hipSpread: 0, braceSpread: 0, braceDmg: 1, foStart: 999, foEnd: 999, foMin: 1,
              twoHand: true, vent: 0.9, trooper: true },
};
/* THE MODULAR DC-15 — one rifle, its MODULES swapped by pressing 1 again while it's in hand (player/trooper/kit.js
   swapModule). Each is the rifle's own numbers with these laid over; the run hands them over (data/trooper-progression.js
   TROOPER_AUTO: `unlock` is the G.unlocked key). The heat stays with the gun through a swap.
     burst     the stock rifle (above): a three-bolt burst a click
     auto      AUTO BARREL: hold LMB to fire, lighter bolts, more heat and a wider cone: the crowd and suppression module
     marksman  MARKSMAN SCOPE: one heavy bolt a click with a long reach; RMB raises the scope (zoomed, dead steady) */
export const RIFLE_MODS = {
  burst:    { label: 'BURST' },
  auto:     { label: 'AUTO BARREL', unlock: 'modAuto', fire: 'auto', fireCd: 0.1, dmg: 11, heat: 0.036, cool: 0.55, overCool: 0.42,
              hipSpread: 0.022, braceSpread: 0.009, foStart: 16, foEnd: 38 },
  marksman: { label: 'MARKSMAN SCOPE', unlock: 'modScope', fire: 'semi', fireCd: 0.8, dmg: 58, heat: 0.2, cool: 0.55, overCool: 0.42,
              hipSpread: 0.012, braceSpread: 0, braceDmg: 1.25, foStart: 40, foEnd: 80, foMin: 0.8, scope: true, vent: 0.6 },
};
export const RIFLE_MOD_ORDER = ['burst', 'auto', 'marksman'];
{ const R = TROOPER_WEAPONS.rifle;   // each module as a whole weapon (mando/weapons.js mandoWeapon returns it while it's fitted)
  R.mods = {};
  for (const k of RIFLE_MOD_ORDER) if (k !== 'burst') R.mods[k] = { ...R, ...RIFLE_MODS[k], mods: null, mod: k, name: 'DC-15 · ' + RIFLE_MODS[k].label, short: 'DC-15 · ' + RIFLE_MODS[k].label.split(' ')[0] }; }
export const TROOPER_WEAPON_ORDER = ['rifle', 'pistols', 'launcher'];
// the trooper's guns borrow the Mando's held-weapon models and poses for now: the rifle is the carbine's model on the
// long-gun mount, the pistols the dual blasters (player/animation.js, holster.js, model/weapons.js)
export const GUN_LOOK = { rifle: 'carbine', pistols: 'dual', launcher: 'repeater' };
export const gunLook = (w) => GUN_LOOK[w] || w;

export const TROOPER = {
  /* COMMAND POINTS (player/trooper/command.js): earned in the fight, spent on the orders that matter and the
     battlefield calls (T). ON ME, MOVE, HOLD, COVER and GET THEM UP stay free */
  command: {
    max: 100, start: 30,
    gain: { kill: 5, elite: 12, squadKill: 3 },
    cost: { attack: 10, grenade: 15, suppress: 15 },
    // SUPPRESS: for `time` the squad fires `fire` × as often on the foes within `radius` of the point; a foe its bolts
    // hit is PINNED for `pin` s: it moves at `slow` × and coils its shots `windup` × as long
    suppress: { time: 8, radius: 8, fire: 0.5, pin: 2.5, slow: 0.35, windup: 1.6, prefer: 8 },
    // FLANK: ATTACK TARGET sends the first two standing squadmates round the mark, `wide` m to its sides and `back` m
    // beyond it (seen from the hero); off the hero's line, their bolts on it hit `dmg` × as hard
    flank: { wide: 6.5, back: 1.5, dmg: 1.5 },
    // BATTLEFIELD CALLS (T): REINFORCE when someone is down (everyone up now), otherwise a SUPPLY DROP that lands beside
    // you after `delay`: grenades topped up, the guns cooled, `heal` of your health back
    supply: { cost: 30, delay: 1.2, heal: 0.15, cd: 5 },
    reinforce: { cost: 40, cd: 5 },
  },
  // ACTIVE VENT (R) while overheated: press inside the window (seconds into the overheat) for a perfect vent that
  // clears the gun at once; press outside it and the gun jams for `jam` more seconds. Not overheated, R is a plain vent.
  vent: { window: [0.35, 0.7], jam: 0.7 },
  // FRAG GRENADE (G): cooked onto the crosshair. Charges refill one at a time.
  frag: { charges: 2, recharge: 11, reach: 24, minRange: 3, fuse: 1.1, dmg: 70, radius: 5.5, knock: 20, flight: [0.35, 0.9] },
  // RIFLE BASH (E): a short shove with the stock that staggers whoever is right in front
  bash: { range: 2.6, arc: 0.9, dmg: 14, knock: 9, stun: 0.9, cd: 0.7 },
  squadMin: 2,   // the trooper always brings at least this many clones, in every mode that allows a squad
  // ---- the powers the run hands over or lets him choose (data/trooper-progression.js), cast in player/trooper/abilities.js.
  // Each spends ability energy (the bar under vitality) and has a cooldown; mastery ranks (data/mastery.js) retune them.
  // RECON SCAN (Q): a pulse that marks every foe within `range` for `time` s: marked foes take `mark`× damage from
  // everyone, the squad included, and show a tag over their heads
  scan: { cost: 24, cd: 12, range: 32, time: 7, mark: 1.2 },
  // BUBBLE SHIELD (V): a dome thrown down where he stands. Enemy bolts that reach it stop dead; it lasts `time` s
  shield: { cost: 40, cd: 18, radius: 4.2, time: 7 },
  // FIELD MEDIC: the squad's medic joins, revives take `revive`× as long, and every squadmate (and the hero) slowly
  // knits `regen` vitality a second while out of a fight's hit for 3 s
  medic: { revive: 0.55, regen: 2.5 },
  // ION GRENADE (F): lobbed like a frag; foes in the blast are stunned for `stun` s (droids and jet troopers twice as
  // long), shields drop, and little damage is done
  ion: { cost: 30, cd: 10, reach: 24, minRange: 3, fuse: 0.9, radius: 6, stun: 2.2, dmg: 14 },
  // BREACH CHARGE (F): slapped on the ground ahead, it blows after `fuse` s in a forward cone: big damage and a launch
  breach: { cost: 34, cd: 11, fuse: 1.2, range: 9, arc: 0.85, dmg: 95, knock: 30, lift: 9 },
  // ARTILLERY BARRAGE (Z, Commander): `shells` shells land round the crosshair `delay` s after the call, `gap` s apart
  artillery: { cost: 60, cd: 20, delay: 1.3, shells: 6, gap: 0.22, spread: 4.5, radius: 4.5, dmg: 75, knock: 22, reach: 40 },
  // ANTI-ARMOUR LAUNCHER (3, Commando): a slow, heavy rocket off the rifle's launcher module; the Commando also hits harder
  launcher: { dmg: 1.18 },
  // GUNSHIP STRAFING RUN (X, the final power): a gunship flies a line from the hero toward the crosshair and lays
  // `blasts` blasts along it, `gap` s apart
  strafe: { cost: 80, cd: 26, length: 34, blasts: 9, gap: 0.12, delay: 1.0, radius: 3.8, dmg: 70, knock: 18 },
};
