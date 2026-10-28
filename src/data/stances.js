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
   radiusMult = swing cleave radius · parryBonus = extra parry window · heavyDmg = vs armored foes. */
export const STANCES = {
  fast:   { name: 'ATARU — FAST', form: 'ataru', formNo: 'IV', blade: 0x35c8ff,
            dmg: 0.64, heavyDmg: 0.46, speed: 1.7, knock: 0.38, stamina: 6, lunge: 1.4, move: 1.25, accel: 1.7, twist: 0.4, bladeLen: 0.94,
            radiusMult: 1.45, forceRegen: 1.5, costMult: { push: 0.7, pull: 0.7 },
            comboGap: 1.25, fovKick: 6,
            reach: { lungeMax: 3.9, range: 6.5 },   // ROLE: the lunge closes up to 3.9m (others 2.4) and finds foes out to 6.5m (others 5), enough to cross the 3.2m stalker ring to an officer behind it
            moveAtk: 1.5,         // PASSIVE: keeps most of its footwork mid-swing (every other form plants its feet) — kite while you cleave
            finisherArc: 1.1,     // the finisher cleaves ~10% wider — built for crowds
            backLineDmg: 1.6,     // ROLE: hunts the back line — officers, snipers, grenadiers and jet troopers take +60% (see backLineMul)
            postureMul: 0.8,      // light cuts: each blocked cut puts 0.8× the usual strain on a guard
            deflectScatter: 0.1,  // LORE: Ataru is a duelling form with little answer to blaster fire — deflects spray (rad)
            castMul: 0.65,        // SYNERGY: snappy Force casts — the gesture fires ~35% faster
            gait: { amp: 1.0, lift: 1.3, bob: 0.45, lean: 1.25 },   // MOVEMENT: light, high-kneed, springy — a duelist on the balls of their feet
            syn: 'BACK LINE · +60% vs officers, snipers, grenadiers, jet troopers · snappy Force casts · keeps moving · soft on guards · WEAK vs armor' },
  medium: { name: 'NIMAN — BALANCED', form: 'niman', formNo: 'VI', blade: 0x3aff8c,
            dmg: 1.04, heavyDmg: 0.99, speed: 0.92, knock: 0.85, stamina: 11, lunge: 1.15, move: 1.0, accel: 1.0, twist: 0.55, bladeLen: 1.0,
            radiusMult: 1.0, cdMult: 0.85, defCdMult: 0.5, postureMul: 1.0, parryBonus: 0.10, comboGap: 1.0, fovKick: 0,
            parryRefund: 16,      // PASSIVE: the duelist's form — a clean parry feeds extra Force back
            blockStamMul: 0.55,   // SYNERGY: economical guard — blocking/parrying drains far less stamina
            deflectScatter: 0.05, // LORE: Niman, the jack of all forms — deflects go back roughly down the line (rad)
            gait: { amp: 1.08, lift: 1.0, bob: 0.4, lean: 1.0 },   // MOVEMENT: smooth, balanced, even strides
            syn: 'VERSATILE · −50% defence cooldowns (barrier, mend, repulse) · −15% others · widest parry · cheap guard · parries refund +Force' },
  strong: { name: 'DJEM SO — STRONG', form: 'djemso', formNo: 'V', blade: 0xb24bff,
            // HEAVY & momentum-driven, not slow-motion: still the slowest swing but it now flows; the big LUNGE
            // carries the blade through. High dmg, shreds armor, weak Force synergy (forceRegen < 1, no powerDmg).
            // clearly the SLOWEST swing (well under medium's 1.0) — heavy, deliberate, weighty — but the big LUNGE
            // and high damage make each committed stroke land hard, so it reads as power, not sluggishness.
            dmg: 2.2, heavyDmg: 1.8, speed: 0.64, knock: 2.2, stamina: 18, lunge: 1.4, move: 0.85, accel: 0.6, twist: 1.0, bladeLen: 1.14,
            radiusMult: 0.8, postureMul: 1.5, forceRegen: 0.7, comboGap: 0.7, fovKick: -4,
            atkDR: 0.15,          // PASSIVE: armored commitment — soak 15% damage WHILE mid-swing
            finisherLunge: 1.6,   // the 3rd hit lunges harder, carrying the heavy blade through
            finisherRecover: 0.12,   // COST of the ×1.5 guard break: the finisher hangs ~0.12s longer before you can act again
            finisherKnock: true,  // the finisher ALWAYS floors what it hits (brutes included)
            deflectScatter: 0.02, // LORE: Form V's Shien variant — redirected fire goes home to the shooter (rad)
            powerScale: 1.35, powerCostMul: 1.3,   // SYNERGY: Force powers hit with BRUTE scale (+35% radius/knock) but cost +30% Force
            gait: { amp: 1.2, lift: 0.78, bob: 0.85, lean: 0.8 },   // MOVEMENT: long, heavy, planted strides — a juggernaut's weighty stomp
            syn: 'BRUTES & BOSS · breaks guards fast · 15% DR mid-swing · finisher floors · BIG but costly Force powers' },
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
// Force-power cooldown multiplier for a stance; Niman cuts DEFENSIVE powers harder than the rest
const DEFENCE_POWERS = ['barrier', 'mend', 'repulse'];
export const cdMul = (st, id) => (st.defCdMult && DEFENCE_POWERS.includes(id) ? st.defCdMult : st.cdMult) || 1;
export const STANCE_ORDER = ['fast', 'medium', 'strong'];   // the darksaber is NOT here — it's auto-selected, never cycled

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
     strings  a press with no direction given walks the form's string of angles (instead of left, right, left), each
              cut starting near where the last one finished; the string picks up where it left off unless you've
              stopped cutting for `reset` s.
     flick    MOUSE AIM (Settings · CUT AIM): the way the mouse moved in the last moment before the press is the way the
              blade travels (flick left: a cut from the right, sweeping left; flick down: an overhead). The motion
              decays over `tau` s and must add up to `min` px to count; the cut's height comes from the view's tilt
              from before the flick began (a flick down shouldn't turn an overhead into a low cut). */
export const CUT_ANGLE = {
  anchors: [[0, 'left'], [45, 'diagL'], [90, 'forward'], [135, 'diagR'], [180, 'right'], [225, 'riseR'], [315, 'riseL']],
  high: [[0.3, 0.18], [0.26, 0.06], [0.3, 0.18]],
  low:  [[-0.26, -0.54], [-0.26, -0.3], [-0.16, -0.14]],
  vert: 0.35,
  strings: {
    fast:   [0, 225, 45, 180, 315, 135],   // Ataru: quick flat and diagonal cuts whipping side to side
    medium: [135, 0, 225, 90, 315],        // Niman: round the clock, each cut flowing out of the last
    strong: [135, 315, 90, 225, 45, 270],  // Djem So: heavy cuts down from the shoulder and back up the same line
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

/* Progression is data-driven: see PROGRESSION CONFIG (auto-unlocks + the XP ability store) further below.
   NIMAN is always available; FAST/STRONG forms are auto-unlocked there. */
export function stanceUnlocked(id){ return id === 'medium' || !!(G.stanceUnlocked && G.stanceUnlocked[id]); }
