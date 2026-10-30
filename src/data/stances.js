// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Lightsaber forms (STANCES), their order, and swing patterns.

import { G } from '../state.js';

/* SABER STANCES — the lightsaber forms, Jedi Academy style. Switch with 1/2/3 or the mouse wheel.
   dmg/speed/knock scale the saber; heavyDmg applies vs brutes & the boss;
   stamina is the cost per swing; the rest are force-power synergies.
   Each stance is a lore FORM (form/formNo) and moves like it: guards, swings and footwork live in data/poses.js,
   keyed by form — ATARU (IV) acrobatic, NIMAN (VI) saber-and-Force, DJEM SO (V) two-handed power. */
/* Each stance is a distinct TOOL, not a flat upgrade:
   FAST   = crowd-clear & mobility & force-casting — fast wide cleaves, cheap stamina, big force
            regen, but feeble per hit and nearly useless against armored brutes.
   MEDIUM = the versatile technician — even stats, lowest power cooldowns, the widest parry window.
   STRONG = the brute/boss breaker — enormous single-hit damage that shreds armor and knocks brutes
            flat, but slow, stamina-hungry, and a narrow arc that swarms punish.
   radiusMult = swing cleave radius · parryBonus = extra parry window · heavyDmg = vs armored foes.
   SWING PACE: every form swings a step slower than it first did (Ataru at Niman's old pace, Niman at Djem So's, Djem So
   slower again: a committed, crossguard-style power stroke), with damage per cut raised by the same ratio so damage per
   second is where it was. */
export const STANCES = {
  /* FORM I SHII-CHO — the first form every initiate learns (Kit Fisto, Luke at Jabba's barge). Wide, simple sweeps built
     for many foes at once; the string ends in the SARLACC SWEEP (a full turn: everything round you), and that finisher
     knocks a blaster out of a trooper's hands (DISARMING SLASH). Its clumsier bladework is what duellists read. */
  shiicho: { name: 'SHII-CHO — CROWDS', form: 'shiicho', formNo: 'I', blade: 0x4a86ff,
            dmg: 1.35, heavyDmg: 1.0, speed: 0.7, knock: 1.1, stamina: 9, lunge: 1.15, move: 1.0, accel: 1.0, twist: 0.6, bladeLen: 1.0,
            radiusMult: 1.35, comboGap: 1.0, fovKick: 0, postureMul: 1.0,
            finisherArc: 1.3,     // ROLE: the Sarlacc Sweep reaches ~30% further, all the way round (SWING_STYLE.shiicho finisher spin)
            disarm: 6,            // DISARMING SLASH: a finisher on a blaster trooper knocks its gun loose for this many seconds
            duelBlockMul: 1.25,   // LORE: a skilled duellist reads Form I's broad cuts and turns 25% more of them
            deflectScatter: 0.08, // basic blast deflection, taught early: bolts go back loosely (rad)
            gait: { amp: 1.0, lift: 1.0, bob: 0.5, lean: 1.0 },   // MOVEMENT: plain, square, athletic
            syn: 'CROWDS · Sarlacc Sweep finisher hits all around · finisher disarms blaster troopers · duellists read it' },
  /* FORM II MAKASHI — the duellist's form (Dooku): one hand, side-on, precise and economical, made to beat other blades.
     Narrow, quick cuts and thrusts; it reads a duellist's feints and stands its ground. Its weakness is blaster fire. */
  makashi: { name: 'MAKASHI — DUELS', form: 'makashi', formNo: 'II', blade: 0xffb02e,
            dmg: 1.55, heavyDmg: 0.9, speed: 0.8, knock: 0.5, stamina: 8, lunge: 1.3, move: 1.05, accel: 1.15, twist: 0.45, bladeLen: 1.0,
            radiusMult: 0.7, parryBonus: 0.06, comboGap: 1.1, fovKick: 2, postureMul: 1.1, forceRegen: 0.9,
            swordDmg: 1.4,        // ROLE: +40% against anything with a blade (duellists, acolytes, the Warbringer's kin excepted, the boss)
            readMul: 0.5,         // reads intent: a duellist's feints and held strikes come half as often
            breakRes: 1.5,        // stands its ground: a blow must hit 1.5x as hard to break its empty guard
            deflectScatter: 0.16, // LORE: Makashi has little answer to blaster fire — deflects fly wild (rad)…
            deflectStamMul: 1.5,  // …and every bolt caught on the blade costs half again the stamina
            gait: { amp: 0.92, lift: 1.1, bob: 0.3, lean: 0.9 },   // MOVEMENT: light, upright, a fencer's measured steps
            syn: 'DUELS · +40% vs blade users · reads feints · hard to guard-break · narrow arc · WEAK vs blasters' },
  /* FORM III SORESU — the wall (Obi-Wan): tight, economical blocks that send blaster fire home and wear an attacker out.
     It wins by outlasting; it has the least offence of any form. */
  soresu:  { name: 'SORESU — DEFENCE', form: 'soresu', formNo: 'III', blade: 0xcfe2ff,
            dmg: 0.95, heavyDmg: 0.9, speed: 0.66, knock: 0.6, stamina: 7, lunge: 0.9, move: 0.92, accel: 0.95, twist: 0.5, bladeLen: 1.0,
            radiusMult: 0.95, parryBonus: 0.14, comboGap: 1.0, fovKick: -1, postureMul: 0.9,
            blockStamMul: 0.4,    // ROLE: the cheapest guard in the game…
            chipMul: 0,           // …that lets no chip through a block…
            guardDeflect: 0.15,   // …and a HELD guard sends bolts back home from a wide front (facing dot), even walking
            blockTire: 12,        // each melee blow it blocks costs the attacker this much breath (data/duel.js breath)
            guardRegen: 1.4,      // stamina refills 40% faster while the guard is up
            deflectScatter: 0.04, // the form built for blaster fire: deflects go back nearly true (rad)
            gait: { amp: 0.9, lift: 0.9, bob: 0.35, lean: 0.85 },   // MOVEMENT: low, short, controlled
            syn: 'DEFENCE · held guard returns bolts · cheapest guard, no chip · tires attackers · widest parry · LOW damage' },
  ataru:  { name: 'ATARU — FAST', form: 'ataru', formNo: 'IV', blade: 0x35c8ff,
            dmg: 1.18, heavyDmg: 0.85, speed: 0.92, knock: 0.38, stamina: 6, lunge: 1.4, move: 1.15, accel: 1.3, twist: 0.4, bladeLen: 0.94,
            radiusMult: 1.45, forceRegen: 1.5, costMult: { push: 0.7, pull: 0.7 },
            comboGap: 1.25, fovKick: 6,
            reach: { lungeMax: 3.9, range: 6.5 },   // ROLE: the lunge closes up to 3.9m (others 2.4) and finds foes out to 6.5m (others 5), enough to cross the 3.2m stalker ring to an officer behind it
            moveAtk: 1.5,         // PASSIVE: keeps most of its footwork mid-swing (every other form plants its feet) — kite while you cleave
            airCutDmg: 1.35,      // LORE: the acrobat's form — any cut struck off the ground lands 35% harder
            swoop: 1,             // HAWK-BAT SWOOP: a cut out of a Force dash leaps in on the foe (player/jedi/combat.js)
            backLineDmg: 1.6,     // ROLE: hunts the back line — officers, snipers, grenadiers and jet troopers take +60% (see backLineMul)
            postureMul: 0.8,      // light cuts: each blocked cut puts 0.8× the usual strain on a guard
            deflectScatter: 0.1,  // LORE: Ataru is a duelling form with little answer to blaster fire — deflects spray (rad)
            castMul: 0.65,        // SYNERGY: snappy Force casts — the gesture fires ~35% faster
            gait: { amp: 1.0, lift: 1.3, bob: 0.45, lean: 1.25 },   // MOVEMENT: light, high-kneed, springy — a duelist on the balls of their feet
            syn: 'BACK LINE · +60% vs officers, snipers, grenadiers, jet troopers · +35% air cuts · dash into a cut: Hawk-Bat Swoop · snappy Force casts · WEAK vs armor' },
  niman:  { name: 'NIMAN — BALANCED', form: 'niman', formNo: 'VI', blade: 0x3aff8c,
            dmg: 1.5, heavyDmg: 1.42, speed: 0.64, knock: 0.85, stamina: 9, lunge: 1.15, move: 1.0, accel: 1.0, twist: 0.55, bladeLen: 1.0,
            radiusMult: 1.0, cdMult: 0.85, defCdMult: 0.5, postureMul: 1.0, parryBonus: 0.10, comboGap: 1.0, fovKick: 0,
            parryRefund: 16,      // PASSIVE: the duelist's form — a clean parry feeds extra Force back
            powerCostMul: 0.85,   // LORE: saber and Force as one — powers cost 15% less…
            castMul: 0.85,        // …snap off a little quicker…
            castFlow: true,       // …and a power cast mid-string keeps the string going: no late-cancel stamina cost (combat.js)
            blockStamMul: 0.55,   // SYNERGY: economical guard — blocking/parrying drains far less stamina
            deflectScatter: 0.05, // LORE: Niman, the jack of all forms — deflects go back roughly down the line (rad)
            gait: { amp: 1.08, lift: 1.0, bob: 0.4, lean: 1.0 },   // MOVEMENT: smooth, balanced, even strides
            syn: 'VERSATILE · cheap swings and powers · cast mid-string · −50% defence cooldowns · cheap guard · parries refund +Force' },
  djemso: { name: 'DJEM SO — STRONG', form: 'djemso', formNo: 'V', blade: 0xb24bff,
            // HEAVY & momentum-driven, not slow-motion: still the slowest swing but it now flows; the big LUNGE
            // carries the blade through. High dmg, shreds armor, weak Force synergy (forceRegen < 1, no powerDmg).
            // clearly the SLOWEST swing (well under medium's 1.0) — heavy, deliberate, weighty — but the big LUNGE
            // and high damage make each committed stroke land hard, so it reads as power, not sluggishness.
            dmg: 2.93, heavyDmg: 2.4, speed: 0.48, knock: 2.2, stamina: 18, lunge: 1.4, move: 0.85, accel: 0.6, twist: 1.0, bladeLen: 1.14,
            radiusMult: 0.8, postureMul: 1.5, forceRegen: 0.7, comboGap: 0.7, fovKick: -4,
            atkDR: 0.15,          // PASSIVE: armored commitment — soak 15% damage WHILE mid-swing
            finisherLunge: 1.6,   // the 3rd hit lunges harder, carrying the heavy blade through
            finisherRecover: 0.12,   // COST of the ×1.5 guard break: the finisher hangs ~0.12s longer before you can act again
            finisherKnock: true,  // the finisher ALWAYS floors what it hits (brutes included)
            blockRiposte: 1,      // FLUID RIPOSTE: a melee blow taken on the held guard readies a counter (player/damage.js)
            deflectScatter: 0.06, // Djem So answers blades; sending bolts home is its sister variant Shien's craft (rad)
            powerScale: 1.35, powerCostMul: 1.3,   // SYNERGY: Force powers hit with BRUTE scale (+35% radius/knock) but cost +30% Force
            gait: { amp: 1.2, lift: 0.78, bob: 0.85, lean: 0.8 },   // MOVEMENT: long, heavy, planted strides — a juggernaut's weighty stomp
            syn: 'BRUTES & BOSS · breaks guards fast · block, then Fluid Riposte · finisher floors · BIG but costly Force powers · G: Shien' },
  /* FORM V SHIEN — Djem So's sister variant (Ahsoka, Starkiller): the reverse grip, built to send blaster fire home.
     Every bolt it deflects flies straight back at the shooter and hits half again as hard; its cuts are strong but it
     gives up Djem So's raw power against armour. G swaps between the two Form V variants. */
  shien:  { name: 'SHIEN — REDIRECT', form: 'shien', formNo: 'V', blade: 0x2ee6c8,
            dmg: 1.9, heavyDmg: 1.45, speed: 0.6, knock: 1.3, stamina: 12, lunge: 1.25, move: 0.98, accel: 0.95, twist: 0.8, bladeLen: 1.0,
            radiusMult: 1.05, postureMul: 1.2, comboGap: 0.85, fovKick: -1, parryBonus: 0.04,
            deflectScatter: 0,    // ROLE: every deflect goes home, dead on the shooter…
            deflectDmg: 1.5,      // …and lands half again as hard (enemies/bolts.js)
            gait: { amp: 1.1, lift: 0.9, bob: 0.6, lean: 1.0 },   // MOVEMENT: low and prowling, weight forward
            syn: 'BLASTERS · every deflect goes home and hits +50% · reverse grip · strong cuts · G: Djem So' },
  /* FORM VII JUYO — the most ferocious form (Mace Windu's root, Vader's rage): bursts of savage, unpredictable cuts
     driven by the Force itself. Each swing burns Force as well as breath, every cut that lands feeds FURY (up to +45%
     damage), and it gives its defence away for it. Juyo and Vaapad fork: learning one closes the other for the run. */
  juyo:   { name: 'JUYO — FURY', form: 'juyo', formNo: 'VII', blade: 0xff3a3a,
            dmg: 1.75, heavyDmg: 1.35, speed: 0.78, knock: 1.1, stamina: 6, lunge: 1.4, move: 1.08, accel: 1.2, twist: 0.9, bladeLen: 1.0,
            radiusMult: 1.1, postureMul: 1.3, comboGap: 1.2, fovKick: 4, parryBonus: -0.03, forceRegen: 1.1,
            forceSwing: 5,        // ROLE: each swing burns this much Force on top of its stamina (no Force: double the stamina)
            furyHit: 0.12,        // every cut that lands feeds fury (player/jedi/fury.js)…
            furyDmg: 1.45,        // …up to +45% saber damage at full
            dmgTaken: 1.25,       // LORE: it opens the user up: blows land 25% harder
            deflectScatter: 0.12,
            gait: { amp: 1.15, lift: 1.15, bob: 0.6, lean: 1.3 },   // MOVEMENT: driving forward, never still
            syn: 'FURY · Force-fuelled swings · hits build fury (+45% dmg) · fast, savage strings · TAKES +25% damage' },
  /* FORM VII VAAPAD — Mace Windu's own Form VII: Juyo's ferocity let in and turned outward. It feeds on the opponent's
     aggression: every blow turned on its guard builds fury, a parry finds the attacker's SHATTERPOINT (the next cut on
     that foe lands double and floors it). Juyo and Vaapad fork. */
  vaapad: { name: 'VAAPAD — CONTROL', form: 'vaapad', formNo: 'VII', blade: 0xb04dff,
            dmg: 1.6, heavyDmg: 1.4, speed: 0.72, knock: 1.0, stamina: 9, lunge: 1.25, move: 1.02, accel: 1.1, twist: 0.8, bladeLen: 1.0,
            radiusMult: 1.0, postureMul: 1.2, comboGap: 1.1, fovKick: 1, parryBonus: 0.08, blockStamMul: 0.7,
            furyBlock: 0.18, furyParry: 0.35, furyHit: 0.04,   // ROLE: its fury comes from what it turns aside…
            furyDmg: 1.4,         // …up to +40% saber damage at full
            shatter: 2.0,         // SHATTERPOINT: a parried attacker is marked; your next cut on it lands ×2 and floors it
            dmgTaken: 1.1,        // walking the edge of the dark side: blows land 10% harder
            deflectScatter: 0.06,
            gait: { amp: 1.05, lift: 1.0, bob: 0.45, lean: 1.1 },   // MOVEMENT: poised, then explosive
            syn: 'CONTROL · blocks and parries build fury (+40% dmg) · a parry finds the Shatterpoint: next cut ×2 · TAKES +10% damage' },
  // THE DARKSABER — the Mando's signature melee (selected automatically when the darksaber is equipped, not a
  // switchable Jedi form). Heavy-like, but the highest damage in the game, a touch faster & more mobile than Djem So.
  darksaber: { name: 'DARKSABER', form: 'darksaber', blade: 0xc9a6ff,
            // HEAVY, CLUMSY, HIGH-RISK/HIGH-REWARD — the Mando isn't a trained duelist. SLOWEST swing in the game,
            // very stamina-hungry, sluggish to move mid-swing, with the SMALLEST parry window — but the highest damage.
            dmg: 2.8, heavyDmg: 2.6, speed: 0.55, knock: 1.6, stamina: 26, lunge: 1.4, move: 0.92, accel: 0.7, twist: 0.95, bladeLen: 1.2,
            radiusMult: 1.12, forceRegen: 1.0, dashCd: 1.2, comboGap: 0.6, fovKick: -3,
            parryBonus: -0.05, moveAtkPenalty: 0.32,   // smallest parry window · crawls while mid-swing
            deflectScatter: 0.12, // no Jedi training: a bolt off the darksaber goes back loosely (rad)
            syn: 'DARKSABER · devastating but SLOW & clumsy · huge stamina · tiny parry — time it, do not spam' },
};
// Ataru's role: bonus damage on the foes that hold the back line (officer, sniper, grenadier, jet trooper)
export const backLineMul = (st, e) => (st.backLineDmg && e && e.t && (e.t.officer || e.t.sniper || e.t.grenade || e.t.fly)) ? st.backLineDmg : 1;
// Makashi's role: bonus damage on anything that fights with a blade (a duellist's profile, not a brute's brace)
export const swordMul = (st, e) => (st.swordDmg && e && e.dp && !e.dp.brace) ? st.swordDmg : 1;
// Force-power cooldown multiplier for a stance; Niman cuts DEFENSIVE powers harder than the rest
const DEFENCE_POWERS = ['barrier', 'mend', 'repulse'];
export const cdMul = (st, id) => (st.defCdMult && DEFENCE_POWERS.includes(id) ? st.defCdMult : st.cdMult) || 1;

/* directional swing patterns — right-arm driven.
   y = shoulder yaw sweep · x = shoulder raise · z = shoulder roll (blade tilt) ·
   w = wrist snap on the saber · reach = how far the arm punches forward through the cut. */
export const SWING_PATTERNS = {
  right:    { id: 'right', yF: -1.7,  yT:  1.6,  xF: -1.15, xT: -1.15, zF: 1.1,  zT: -1.2, wF: 0.9,  wT: -0.8, reach: 0.4 },   // strafe R: blade sweeps toward the player's RIGHT (verified)
  left:     { id: 'left', yF:  1.7,  yT: -1.6,  xF: -1.15, xT: -1.15, zF: -1.2, zT: 1.1,  wF: -0.8, wT: 0.9,  reach: 0.4 },   // strafe L: blade sweeps toward the player's LEFT
  forward:  { id: 'forward', yF:  0.35, yT: -0.25, xF: -2.85, xT: -0.2,  zF: -0.2, zT: 0.1,  wF: -0.9, wT: 0.5,  reach: 0.6  },  // advance: overhead chop
  back:     { id: 'back', yF:  0.6,  yT: -0.4,  xF: -0.1,  xT: -2.5,  zF: 0.3,  zT: -0.4, wF: 0.6,  wT: -0.8, reach: 0.15 },  // retreat: rising cut
  diagL:    { id: 'diagL', yF:  1.25, yT: -0.9,  xF: -2.55, xT: -0.6,  zF: -1.0, zT: 0.6,  wF: -0.8, wT: 0.6,  reach: 0.45 },  // diagonal shoulder→hip
  diagR:    { id: 'diagR', yF: -1.25, yT:  0.9,  xF: -2.55, xT: -0.6,  zF: 1.0,  zT: -0.6, wF: 0.8,  wT: -0.6, reach: 0.45 },
  // AIMED HIGH / LOW (see CUT_AIM): the same sweeps carried at the head or down at the knees, the rising cuts that come
  // up from the floor, and the thrust. h = the height the cut lives at (drives the line a guard has to cover and the
  // hips' drop into a low cut); lunge scales the step into it.
  leftHigh: { id: 'leftHigh', yF:  1.7,  yT: -1.6,  h: 'high', reach: 0.4 },
  rightHigh:{ id: 'rightHigh', yF: -1.7,  yT:  1.6,  h: 'high', reach: 0.4 },
  leftLow:  { id: 'leftLow', yF:  1.6,  yT: -1.5,  h: 'low', drop: 0.16, reach: 0.4 },
  rightLow: { id: 'rightLow', yF: -1.6,  yT:  1.5,  h: 'low', drop: 0.16, reach: 0.4 },
  riseL:    { id: 'riseL', yF:  1.1,  yT: -0.9,  h: 'low', drop: 0.08, reach: 0.4 },     // rising: low on the weapon side, up across to the left shoulder
  riseR:    { id: 'riseR', yF: -1.1,  yT:  0.9,  h: 'low', drop: 0.08, reach: 0.4 },
  thrust:   { id: 'thrust', yF:  0.05, yT:  0.0,  h: 'low', reach: 0.8, lunge: 1.35 },  // drawn back to the hip, driven straight through (in on the low line)
};

/* CUT AIM — Jedi Academy style: where you aim picks the cut's HEIGHT: tip the view up past `pitchHigh` for a high cut,
   down past `pitchLow` for a low one (pitch is + looking down; a fight sits around 0.2, and the lock-on leaves you this
   much room: data/config.js lockOn.pitchFree). The cut's angle comes from CUT_ANGLE below. */
export const CUT_AIM = { pitchHigh: 0.04, pitchLow: 0.42 };

/* CUTS BUILT FROM AN ANGLE — a cut is the clock angle it comes FROM, in the frontal plane (degrees, counter-clockwise
   from the weapon side: 0 = from the right, sweeping left · 90 = from overhead, straight down · 180 = from the left ·
   225 / 315 = rising from the low left / low right), plus its height. Its keyframes are blended between the two tuned
   cuts either side on the clock (`anchors`, regular grip; the reverse grip takes the nearest), then lifted or dropped
   for a high or low cut (`high` / `low`: [hand y, blade y] per key; full on a flat cut, `vert` of it on a vertical
   one, where the cut crosses every height anyway).
     strings  a press with no direction given walks the form's string of angles (instead of left, right, left; 'thrust'
              in a string is the lunging thrust), each
              cut starting near where the last one finished; the string picks up where it left off unless you've
              stopped cutting for `reset` s.
     flick    MOUSE AIM (Settings · CUT AIM: MOUSE, off by default): the way the mouse moved in the last moment before the press is the way the
              blade travels (flick left: a cut from the right, sweeping left; flick down: an overhead). The motion
              decays over `tau` s and must add up to `min` px to count; the cut's height comes from the view's tilt
              from before the flick began (a flick down shouldn't turn an overhead into a low cut). */
export const CUT_ANGLE = {
  anchors: [[0, 'left'], [45, 'diagL'], [90, 'forward'], [135, 'diagR'], [180, 'right'], [225, 'riseR'], [315, 'riseL']],
  high: [[0.3, 0.18], [0.26, 0.06], [0.3, 0.18]],
  low:  [[-0.26, -0.54], [-0.26, -0.3], [-0.16, -0.14]],
  vert: 0.35,
  strings: {
    ataru:  [0, 225, 45, 180, 315, 135],   // Ataru: quick flat and diagonal cuts whipping side to side
    niman:  [135, 0, 225, 90, 315],        // Niman: round the clock, each cut flowing out of the last
    djemso: [135, 315, 90, 225, 45, 270],  // Djem So
    shiicho: [0, 180, 0, 180, 90],        // Shii-Cho: big flat sweeps back and forth, then down the middle
    makashi: ['thrust', 135, 'thrust', 45, 225],   // Makashi: thrust, a short cut off it, thrust again
    soresu:  [135, 315, 0, 180],
    shien:   [180, 0, 225, 315, 135],
    juyo:    [45, 225, 0, 315, 180, 90, 135],   // Juyo: a savage, broken rhythm: diagonals whipped off each other, no two alike
    vaapad:  [135, 315, 180, 45, 90],          // Vaapad: answers on the line the attack came from, then explodes down the middle     // Shien: reverse-grip backhands whipped out to the weapon side and back across          // Soresu: short cuts that come straight back to guard: heavy cuts down from the shoulder and back up the same line
  },
  reset: 1.2,
  // the keys, with no flick: A / D the flat cuts · W + A / D the downward diagonals · S + A / D the rising cuts · W the
  // overhead (aimed low: the lunging thrust) · S the back strike · nothing held: the form's string
  keys: { left: 0, right: 180, fwdLeft: 45, fwdRight: 135, backLeft: 315, backRight: 225, forward: 90 },
  flick: { tau: 0.09, min: 18 },
  /* FLOW — a cut that starts within `within` degrees of where the last one finished (the far side of the clock from where
     it came in), struck within `gap` s of it, flows straight on: the whole cut takes `speed` of its time and its wind-up
     `chamber` of its share, with no wrap over the top. Every form's string flows; so do your own flicks if you chain
     them round the clock. */
  flow: { within: 55, gap: 1.2, speed: 0.86, chamber: 0.65 },
  /* FOOTWORK — each cut moves the feet its own way: a step `side` m the way a flat cut sweeps (less as it turns
     diagonal), `over` m further in under an overhead, `rise` m (back) off the rear foot into a rising cut. */
  foot: { side: 0.28, over: 0.15, rise: -0.12 },
};

/* Progression is data-driven: see JEDI_AUTO in data/store.js. NIMAN is always available; ATARU and DJEM SO are
   auto-unlocked there. Which forms sit on 1 / 2 / 3 is the loadout (data/forms.js). */
export function stanceUnlocked(id){ return id === 'niman' || !!(G.stanceUnlocked && G.stanceUnlocked[id]); }
