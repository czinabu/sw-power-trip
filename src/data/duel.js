// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL: how sword-armed foes fight back (guards, feints, strings, saber locks) and the Mandalorian's close-quarters kit.


/* DUELLING — Jedi Academy style. A foe with a profile below doesn't just walk in and chop: it holds a GUARD on one
   side (the glowing arc beside it shows which), turns blows that come in on that line, and answers with feints,
   delayed strikes and strings of cuts. Spamming the same cut into a guard gets it blocked and countered; reading the
   guard and cutting in on the open line (A / D / W pick where your cut starts) gets through.

   Per-type profile (missing type = fights the old way):
     block    chance to turn a cut that arrives on the guarded line (a side it isn't guarding: block × offLine)
     posture  how much blocking it can take before its guard BREAKS (staggered, wide open)
     feint    chance a wind-up is a fake: it rears back, then switches side and strikes fast (early parries whiff)
     delay    chance it HOLDS the apex of a wind-up for an extra beat (punishes parrying on reflex)
     chain    the most extra cuts it strings after the first (each one a quick, shorter wind-up)
     counter  chance it answers a block with an immediate riposte
     thrust   chance a strike is a lunging THRUST that a held block can't stop (parry it or dodge; white-red tell)
     dodge    chance it steps back out of a cut it sees coming instead of blocking
     deflect  chance it bats a blaster bolt back at the shooter (saber users only)
     lock     a cut that meets its strike mid-arc becomes a SABER LOCK instead of a plain clash
     push     how hard it drives a saber lock (balance per second)
     ramp     feint and delay grow with run depth (data/tactics.js RAMP): the rank and file learn tricks as the run goes on
     stam     BREATH: the foe's own stamina (DUEL.breath). Blocking, slipping, swinging and countering spend it; run it dry
              and it can't guard or answer until it has backed off and caught its breath. Absent = no breath to manage.
     parry    chance it PARRIES a cut that comes in on the rhythm of a mash (DUEL.rhythm): your blade is thrown wide,
              you lose stamina and it ripostes. Spacing your cuts (or changing line) never gets parried.
     elite    its skill climbs with run depth (DUEL.eliteRamp): a little gentler than listed early on, past it at the end
     rally    chance it keeps an EXCHANGE going when you parry it (DUEL.exchange): instead of reeling it recovers in time to
              turn your riposte and come straight back at you, faster each beat */
export const DUEL_PROFILES = {
  // the rank and file: barely a guard, rarely an answer (they learn a few tricks as the run deepens: `ramp`)
  grunt:   { block: 0.06, posture: 28,  feint: 0.2,  delay: 0.3,  chain: 0, counter: 0.05, thrust: 0,    dodge: 0, ramp: true },
  phalanx: { block: 0,    posture: 60,  feint: 0.15, delay: 0.35, chain: 1, counter: 0.3,  thrust: 0,    dodge: 0, ramp: true },
  // the duellists: a guard, breath to manage, and a parry for anyone who mashes
  duelist: { block: 0.55, posture: 70,  feint: 0.25, delay: 0.25, chain: 1, counter: 0.45, thrust: 0.1,  dodge: 0.1, lock: true, push: 0.38,
             stam: 100, parry: 0.5, elite: true, rally: 0.45 },
  acolyte: { block: 0.72, posture: 95,  feint: 0.3,  delay: 0.3,  chain: 2, counter: 0.6,  thrust: 0.15, dodge: 0.2, deflect: 0.75, lock: true, push: 0.5,
             stam: 130, parry: 0.7, elite: true, rally: 0.65 },
};

/* A FORM MASTER — a duel objective with a `form` (the trials in data/missions.js) is a master of that lightsaber form
   and fights the way the form does in the lore. Its form's profile below takes the place of its foe type's (the
   mission's own `duel` tuning goes on top), its blade burns in the form's colour (data/stances.js), and its swings
   and clashes take the form's sound (audio/sfx.js FORM_SOUND). On top of the profile keys above:
     tire     each of your cuts it blocks costs you this much stamina (Soresu outlasts an attacker)
     riposte  a counter after a block lands this much harder, and comes as often as `counter` says (Djem So)
     flip     its slip is a backflip clear, carried `flip` m further than a backstep (Ataru)
   The Mandalorian's champions keep their own weapons and profiles (missions' hero.mando). */
export const FORM_DUEL = {
  // the Wall: barely strikes, turns nearly everything, sends every bolt home and wears you out
  soresu: { block: 0.9, posture: 210, feint: 0.1, delay: 0.2, chain: 1, counter: 0.3, thrust: 0, dodge: 0.05, deflect: 1,
            lock: true, push: 0.45, stam: 190, parry: 0.55, elite: true, rally: 0.5, tire: 8 },
  // the Acrobat: a light guard, flips out of your cuts and comes back in long, quick strings
  ataru:  { block: 0.42, posture: 80, feint: 0.4, delay: 0.15, chain: 3, counter: 0.5, thrust: 0.2, dodge: 0.45, deflect: 0.35,
            lock: true, push: 0.35, stam: 120, parry: 0.4, elite: true, rally: 0.55, flip: 2.2 },
  // the Knight: meets a blow on the guard and answers it at once, harder; drives a saber lock
  djemso: { block: 0.7, posture: 170, feint: 0.25, delay: 0.3, chain: 2, counter: 0.75, thrust: 0.15, dodge: 0.05, deflect: 0.6,
            lock: true, push: 0.7, stam: 150, parry: 0.55, elite: true, rally: 0.6, riposte: 1.35 },
};

/* THE WARBRINGER (survival's champion, game/survival.js spawnChampion; the sandbox and campaign mid-bosses call the
   same function). A brute with a POSTURE bar instead of a guard: it never turns a blow, but a good parry or a heavy
   blow wears the bar down, and a full bar BREAKS it, leaving it wide open for a long, punishable stagger.
     posture   the bar at one hero; each extra hero in co-op adds `coop` of it again, so two heroes face 150 × 1.6
     stam      its breath (DUEL.breath rules: a parried swing drains it, run dry it can't attack until it has recovered)
     cut       a landed light cut builds this fraction of a duellist's cut strain; a finisher, kick, palm or charge builds
               the full amount, so Djem So's finisher (stance postureMul 1.5) hits it hardest. A parry costs it DUEL.posture.parry
     drain     breath a landed cut / finisher takes off it
     open      seconds a broken posture leaves it staggered and open (damage × DUEL.open.dmg while it lasts)
     swing     its held overhead, modelled on the brute's (TROOP_MELEE.brute): every swing is held at the top, longer than a
               brute's, and comes down unblockable (the shared parry-or-dodge tell). The leap slam stays dodge-only. */
export const WARBRINGER = {
  posture: 150, coop: 0.6, stam: 120,
  cut: 0.35, drain: { cut: 5, finisher: 16 },
  open: 2.6,
  swing: { hold: 1, holdT: [0.5, 0.8], feint: 0 },
};
// the duel profile it carries (enemies/duel.js initDuel): `brace` = no guard and no duellist's plan, just posture and breath
export const WARBRINGER_PROFILE = { block: 0, brace: true, posture: WARBRINGER.posture, feint: 0, delay: 0, chain: 0, counter: 0, thrust: 0, dodge: 0, stam: WARBRINGER.stam };

export const DUEL = {
  offLine: 0.22,          // a guard still turns this fraction of its block chance on the lines it ISN'T covering
  guardShift: [0.9, 1.8], // seconds a guard holds a line before shifting (it also shifts to cover a line it was just hit on)
  adaptAfter: 2,          // blocks on the SAME line in a row before it locks that line down (block → 0.95)
  guardRange: 7,          // the guard arc only shows on foes this close
  /* GUARD ARCS — an angle cut (player/jedi/cutaim.js) arrives at a point on the clock round the foe's body: the angle it
     comes from, carried `high` degrees toward the top for a high flat cut and `low` toward the bottom for a low one. A
     guard covers the arc the pale crescent shows, centred on its line (R 0°, H 90°, L 180°, Lo 270°): full block odds
     within `cover` degrees of the centre, fading to the off-line odds `feather` degrees further out, so a cut placed
     just past the edge of its guard gets through. Blocked cuts within `repeat` degrees of the last one count as the
     same cut for its read (adaptAfter): vary the angle and it can't lock you down. */
  arc: { cover: 40, feather: 25, repeat: 30, high: 30, low: 60 },
  /* READING A CUT — a duellist that holds a guard sees your cut coming: while the blade is still in its chamber (before
     `by` of the swing) and you are within `range` and squared up to it, it decides then and there whether it will turn
     it (the same odds as ever), and if so its weapon swings over onto the line your cut comes in on (BLOCK_POSE) and
     holds there `hold` s, so the blades meet where they would in a real duel. `rate` is how fast the weapon gets there. */
  read: { range: 4.6, by: 0.32, face: 0.55, hold: 0.55, rate: 26 },
  // POSTURE — what each kind of blow costs a guard (blocked cuts build it; posture drains back when left alone)
  posture: { cut: 14, finisher: 26, heavyMul: 1.6, kick: 45, parry: 55, punch: 12, punchHeavy: 30, charge: 50, regen: 9, regenDelay: 1.6 },
  jarGap: 0.45,           // seconds: blade contacts (clash, bounce) closer together than this cost stamina once, not each
  bounce: { stam: 8, lock: 0.22 },   // a cut turned by a guard bounces off: this much stamina and a short re-swing lockout
  /* BLADE ON BLADE (player/jedi/clash.js) — your cut meets a weapon that is READY for it (a guard, or a strike in
     flight) where the two actually cross. reach: how close the blades must pass (m, glow included: generous on
     purpose); recoil: seconds the swing takes to kick back off the other blade; back: how much of the swing it rewinds;
     hitstop: the freeze on contact. The boss's blows clash too (data/bosses.js combo.clashGap). */
  clash: { reach: 0.22, recoil: 0.17, back: 0.3, hitstop: 0.07 },
  /* BREATH — a duellist's stamina (profile `stam`). What each act costs it; it refills `regen`/s once it has gone
     `regenDelay` s without spending. Below `winded` × its pool it is WINDED: it can't block, slip or counter, its guard
     arc goes dark, and it gives up its attack turn and backs off until it is over `recover` × its pool again. Your
     pressure is what drains it: block after block, a parried swing, a lock you push. */
  breath: { block: 18, dodge: 20, swing: 12, chain: 9, counter: 10, parried: 25, lock: 22, regen: 24, regenDelay: 1.0,
            winded: 0.2, recover: 0.6, retreat: 1.2 },
  /* RHYTHM — a duellist reads a mash. A cut that arrives within `gap` s of your last one at it extends a streak; from
     the `after`th quick cut on, its guard may PARRY instead of just block (profile `parry`): your swing is thrown off
     (`flinch` s, `stam` stamina) and it ripostes straight away. A beat of patience, a feint of your own or a new line
     resets the streak. */
  rhythm: { gap: 0.8, after: 2, stam: 18, flinch: 0.35 },
  /* OPENINGS — any melee foe that swings and misses, or finishes its string, is open while it recovers (`share` of its
     recovery): a duellist can't guard in it, and a blow that lands there hits `dmg`× harder (a well placed cut). */
  open: { share: 0.85, dmg: 1.3 },
  /* ELITE RAMP — the duellists start a touch below their listed skill and grow past it: `from` on the first wave, 1 by
     wave `full`, up to `max` by wave `top` (campaign waves add up; survival counts its own). Block, counter, parry and
     breath scale with it, so the late game belongs to whoever has learned to read a guard. */
  eliteRamp: { from: 0.8, full: 9, max: 1.25, top: 22 },
  /* THE EXCHANGE — a prequel duel's back and forth. Parry a duellist's strike and, by its `rally` (× `decay` for each beat
     already traded, × its skill), it doesn't reel: it recovers in `recover` s, turns your riposte if it comes inside
     `window` s, and strikes straight back with a wind-up from `windup` (one per beat, quicker each time) for you to
     parry again. Each beat costs it `breath`. A beat later than `gap` s after the last starts a new exchange. At
     `lockAt` beats the blades bind (a saber lock) instead. Any other blow, a block instead of a parry, or a foe cutting
     in from the side breaks the rhythm. The exchanging foe still needs a free attack turn to strike back, so a crowd
     keeps its two-at-a-time limit. */
  exchange: { decay: 0.8, recover: 0.22, window: 1.1, windup: [0.34, 0.3, 0.27, 0.24], breath: 10, gap: 3, lockAt: 4 },
  // ENEMY OFFENCE
  feintAt: 0.7,           // a feint breaks off this far into its wind-up...
  feintRewind: 0.26,      // ...and the real strike winds up this fast from the other side
  delayHold: [0.22, 0.42],// extra seconds a delayed strike hangs at the apex
  chainWindup: 0.3,       // wind-up of each follow-on cut in a string
  counterWindup: 0.24,    // wind-up of a riposte after a block
  counterCd: 1.6,         // a foe counters at most this often
  thrustDmg: 1.35,        // a thrust hits this much harder than a cut
  dodgeStep: 7,           // backstep speed when it slips a cut
  flipTime: 0.5, flipHeight: 1.3,   // an Ataru master's slip is a backflip this long and this high (FORM_DUEL flip)
  // SABER LOCK — blades bind; mash LMB to drive through, or break it with a kick (E) or a Force push (F)
  lock: { chance: 0.7, time: 3.2, press: 0.15, stam: 3, kickStam: 22, pushCost: 18, loseDmg: 16, heavyPress: 1.35, fastPress: 0.85 },
  /* LOCK KINDS — where the blades bind sets how the lock looks and how it ends (enemies/duel.js startLock). A clash more
     than `at.high` m above your feet binds HIGH, one under `at.low` binds LOW; an exchange run to `lockAt` beats ends
     CORPS-À-CORPS, hilt to hilt. label: called out as it binds. win / lose: called out at the end. h: your catch height.
     y: the bind's height. dist: how close you stand. arm / staff: its weapon at the bind (as GUARD_POSE). push: how hard
     it bears down (× its profile push). Winning: open adds to its stagger (thrown high, wide open), side throws it aside
     with its knees buckling, knock shoves it clear. */
  lockKinds: {
    at: { high: 1.75, low: 1.2 },
    mid:  { label: null,            win: 'OVERPOWERED',  lose: 'OVERPOWERED', h: 0.25,  y: 1.55, dist: 1.75, arm: [-1.75, -0.35], staff: [-1.3, 0.6],  push: 1 },
    high: { label: 'HIGH BIND',     win: 'THROWN HIGH',  lose: 'BEATEN DOWN', h: 0.7,   y: 1.95, dist: 1.7,  arm: [-2.65, -0.1],  staff: [-1.6, 1.25], push: 0.9,  open: 0.45 },
    low:  { label: 'LOW BIND',      win: 'SWEPT ASIDE',  lose: 'SWEPT',       h: -0.45, y: 0.95, dist: 1.8,  arm: [-0.75, -0.6],  staff: [0.9, -0.9],  push: 1.1,  side: true },
    body: { label: 'CORPS-À-CORPS', win: 'SHOVED CLEAR', lose: 'SHOULDERED',  h: 0.05,  y: 1.35, dist: 1.15, arm: [-1.2, -1.0],   staff: [-1.1, 0.2],  push: 1.25, knock: 16 },
  },
  /* FLOURISH — a duellist between exchanges twirls its blade (or spins its staff) and settles back into its stance: every
     `every` s while it circles you `range` m out, and `after` s after an exchange ends or a lock breaks. It lasts `dur` s
     and drops the moment it has to guard (a cut read) or strike. */
  flourish: { every: [4, 7], range: [1.6, 6.5], after: 0.5, dur: 0.75 },
};

/* POSES — what a duellist's weapon shows you (enemies/duel.js eases into these; tools/enemy-lab.html ?pose=guardL…windT
   previews them). Sword arms: [weaponArm.rotation.x (raise), .z (out to its side + / across the body -)].
   Staffs: [staff.rotation.z, .x]. */
// guard: where the weapon is held tells you the covered line. weaponArm x raises it, z swings it out (+) or across (-).
// Lo is the low guard: the arm held forward, down and across so the blade (or the staff's lower end) covers the knees.
export const GUARD_POSE = {
  sword: { R: [-1.15, 0.55], L: [-1.25, -0.85], H: [-2.35, 0.25], Lo: [-0.7, -0.45] },
  staff: { R: [0.0, 0.25],   L: [1.25, 0.6],    H: [-1.0, 1.2],  Lo: [0.7, -0.7] },   // staff: [rotation.z, rotation.x]
};
/* BLOCKS — where the weapon goes to MEET a cut it has read (enemies/duel.js readCut): pushed further out onto the line
   than the guard, so your blade crosses it where the cut was going. A high block is held across over the head, a
   side block stands up beside the body on that side, a low block sweeps down point-first across the legs. */
export const BLOCK_POSE = {
  sword: { R: [-1.35, 0.85], L: [-1.45, -1.1], H: [-2.7, 0.05], Lo: [-0.6, -0.75] },
  staff: { R: [-0.25, 0.45], L: [1.5, 0.75],   H: [-1.35, 1.35], Lo: [0.85, -0.95] },
};
// wind-up: where the weapon rears back to is where the strike comes FROM (T = a thrust, drawn back low)
export const WIND = {
  sword: { R: [-1.75, 1.35], L: [-1.9, -1.15], H: [-2.6, 0.2], T: [0.15, 0.1] },
  staff: { R: [-2.0, 0.4],   L: [1.9, 0.5],     H: [-2.9, 1.2], T: [-1.4, -0.4] },
};

/* YOUR GUARD ON THEIR LINE (player/jedi/guardline.js). Hold the guard while a duellist within `range` winds up at you
   and your blade goes to meet that strike where it will come in, the way Jedi Academy's blocks did: catch is where on
   you each line arrives, in the deflect picker's terms (side: + your weapon side, h: against the chest; the foe faces
   you, so its right comes in on your left, a thrust straight down the middle). A clean parry then cuts back on the
   line it left open (riposte: the cut's pattern in data/stances.js SWING_PATTERNS). */
export const GUARD_LINE = {
  range: 4.5,
  catch: { R: { side: -0.6, h: 0.1 }, L: { side: 0.6, h: 0.1 }, H: { side: 0.15, h: 0.65 }, T: { side: 0.05, h: -0.1 }, Lo: { side: 0.4, h: -0.6 } },
  riposte: { R: 'diagR', L: 'diagL', H: 'thrust', T: 'forward', Lo: 'forward' },
};

/* THE MANDALORIAN'S CLOSE-QUARTERS KIT (E). No Jedi forms, but a bounty hunter who has fought every kind of thing:
   (the string's blows rock a foe back `shove` units and never launch it; a foe they kill crumples where it stands.
   Only the jet-powered moves, the charge and the dive kick, throw bodies. Each blow LANDS `contact` seconds after the
   press, when the fist reaches full extension: a short chamber, then a snap into the target)
   a four-beat string (jab, cross, knee, vibroblade), a jet-assisted charge (W + E with a foe ahead), a dive kick
   (E in the air), a vambrace CATCH (E as a blow lands turns it on the beskar and staggers the attacker) and a
   TAKEDOWN on anything staggered or floored. */
export const MANDO_MELEE = {
  string: [
    { name: 'jab',   dmg: 13, knock: 8,  line: 'L', recover: 0.3,  lunge: 4.5, shove: 0.3, contact: 0.07 },
    { name: 'cross', dmg: 16, knock: 12, line: 'R', recover: 0.34, lunge: 5,   shove: 0.45, contact: 0.1 },
    { name: 'knee',  dmg: 18, knock: 14, line: 'H', recover: 0.4,  lunge: 5.5, shove: 0.9, contact: 0.12, heavy: true },
    { name: 'blade', dmg: 30, knock: 22, line: 'R', recover: 0.52, lunge: 6.5, shove: 0.5, contact: 0.13, heavy: true, stagger: true },
  ],
  /* HOLSTERED (4): with his weapon put away the string becomes a brawler's — real swings, not quick shots: a lead
     hook, a rear hook, a rising uppercut, then a wound-up overhand haymaker that staggers. Each one sweeps a wider arc
     and reaches a little further than the armed string (`reach`, `arc`), and hits harder. */
  fists: [
    { name: 'hookL',    dmg: 17, knock: 10, line: 'L', recover: 0.36, lunge: 4.5, shove: 0.45, contact: 0.11, reach: 1.7, arc: 1.0 },
    { name: 'hookR',    dmg: 19, knock: 12, line: 'R', recover: 0.38, lunge: 5,   shove: 0.55, contact: 0.12, reach: 1.7, arc: 1.0 },
    { name: 'upper',    dmg: 22, knock: 14, line: 'H', recover: 0.42, lunge: 5,   shove: 0.9,  contact: 0.13, reach: 1.6, arc: 0.8, heavy: true },
    { name: 'haymaker', dmg: 36, knock: 24, line: 'R', recover: 0.58, lunge: 7,   shove: 0.6,  contact: 0.17, reach: 1.85, arc: 1.05, heavy: true, stagger: true },
  ],
  combo: 0.55,            // seconds after a strike's recovery the next press still continues the string
  reach: 1.45, arc: 0.75,   // a fist lands within arm's length (+ the step it carries) of the body, in front
  catchWindow: 0.2,       // a blow landing this soon after E is caught on the vambrace
  catchWhiff: 0.55,       // a catch window that caught nothing can't reopen for this long
  charge: { minD: 3.2, maxD: 9, fuel: 18, cd: 1.4, dmg: 22, knock: 26, speed: 26 },
  dive: { fuel: 14, cd: 1.0, dmg: 26, radius: 3.2, knock: 20, speed: 30 },
  takedown: { range: 2.0, dmg: 70, maxFrac: 0.6 },   // + this fraction of a light foe's max health (not heavies/bosses)
  /* SHIELD AND BLADE — E while the single blaster's shield is up (RMB). The wrist vibroblade cuts from behind the
     disc and the shield STAYS UP (firing drops it, cutting doesn't), so this is the crowd tool: a wide hack, a
     backhand, then a shield BASH that staggers the light foes in front of you for takedowns. Every beat spends the
     stamina the shield soaks with, you still move at brace speed and your back is open, so it holds a line rather
     than out-damaging the blaster. `arc` is the half-angle in radians, `stam` the cost of the beat. */
  guard: {
    string: [
      { name: 'hackA', dmg: 20, knock: 10, line: 'R', recover: 0.36, lunge: 2.5, shove: 0.6, contact: 0.11, reach: 2.2, arc: 1.15, stam: 8 },
      { name: 'hackB', dmg: 20, knock: 10, line: 'L', recover: 0.36, lunge: 2.5, shove: 0.6, contact: 0.11, reach: 2.2, arc: 1.15, stam: 8 },
      { name: 'bash',  dmg: 10, knock: 6,  line: 'H', recover: 0.55, lunge: 5,   shove: 0.8, contact: 0.12, reach: 2.3, arc: 1.0,  stam: 14, heavy: true, stagger: true },
    ],
    posture: 22,          // what the bash costs a duellist's guard (on top of the cut it lands as)
    takedownReach: 1.6,   // behind the shield a takedown reaches this much further: the bash stumbles foes back out of arm's length
  },
};
