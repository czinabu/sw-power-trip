// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CLONE ARC TROOPER kit tuning (testing only: the hero shows on the menu with ?trooper in the URL). Edit freely.
// The trooper is a GUNNER like the Mando (state.js isGunner): it shares the reticle, bolts, heat and hit markers, but
// it fights on foot with no jetpack, leads a clone squad, and its guns are its own (TROOPER_WEAPONS below).

/* WEAPONS — the same fields as data/mando.js MANDO_WEAPONS (heat, cool, spreads, falloff), plus:
     fire 'burst'  the DC-15 rifle: one click fires `burst` bolts `burstGap` apart. RMB aims (the steady stance)
     fire 'twin'   the twin DC-17s: LMB fires the right pistol, RMB the left, each on its own cooldown, one heat bar
     col           the bolt colour (clone blue, where the Mando's run orange) */
export const TROOPER_WEAPONS = {
  rifle:   { name: 'DC-15 RIFLE', short: 'DC-15', fire: 'burst', burst: 3, burstGap: 0.075, fireCd: 0.36, dmg: 15, dual: false, col: 0x4aa8ff,
             heat: 0.075, cool: 0.62, overCool: 0.45, hipSpread: 0.012, braceSpread: 0.003, braceDmg: 1.1, foStart: 20, foEnd: 46, foMin: 0.55,
             twoHand: true, vent: 0.5, trooper: true },
  pistols: { name: 'TWIN DC-17s', short: 'DC-17s', fire: 'twin', fireCd: 0.2, dmg: 21, dual: true, col: 0x6ab8ff,
             heat: 0.085, cool: 0.7, overCool: 0.52, hipSpread: 0.014, braceSpread: 0.014, braceDmg: 1, foStart: 10, foEnd: 26, foMin: 0.4,
             vent: 0.5, trooper: true },
};
export const TROOPER_WEAPON_ORDER = ['rifle', 'pistols'];
// the trooper's guns borrow the Mando's held-weapon models and poses for now: the rifle is the carbine's model on the
// long-gun mount, the pistols the dual blasters (player/animation.js, holster.js, model/weapons.js)
export const GUN_LOOK = { rifle: 'carbine', pistols: 'dual' };
export const gunLook = (w) => GUN_LOOK[w] || w;

export const TROOPER = {
  // ACTIVE VENT (R) while overheated: press inside the window (seconds into the overheat) for a perfect vent that
  // clears the gun at once; press outside it and the gun jams for `jam` more seconds. Not overheated, R is a plain vent.
  vent: { window: [0.35, 0.7], jam: 0.7 },
  // FRAG GRENADE (G): cooked onto the crosshair. Charges refill one at a time.
  frag: { charges: 2, recharge: 11, reach: 24, minRange: 3, fuse: 1.1, dmg: 70, radius: 5.5, knock: 20, flight: [0.35, 0.9] },
  // RIFLE BASH (E): a short shove with the stock that staggers whoever is right in front
  bash: { range: 2.6, arc: 0.9, dmg: 14, knock: 9, stun: 0.9, cd: 0.7 },
  squadMin: 2,   // the trooper always brings at least this many clones, in every mode that allows a squad
};
