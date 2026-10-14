// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Lightsaber forms (STANCES), their order, and swing patterns.

import { G } from '../state.js';

/* SABER STANCES — Jedi Academy style. Switch with 1/2/3 or the mouse wheel.
   dmg/speed/knock scale the saber; heavyDmg applies vs brutes & the boss;
   stamina is the cost per swing; the rest are force-power synergies.
   Each form also carries a distinct VISUAL identity (see the ready/block poses
   in updatePlayer): FAST = low, bladed crouch + nimble one-handed high block;
   BALANCED = upright classic ready + clean two-handed chest guard;
   STRONG = wide, squared high guard + heavy braced two-handed block. */
/* Each stance is a distinct TOOL, not a flat upgrade:
   FAST   = crowd-clear & mobility & force-casting — fast wide cleaves, cheap stamina, big force
            regen, but feeble per hit and nearly useless against armored brutes.
   MEDIUM = the versatile technician — even stats, lowest power cooldowns, the widest parry window.
   STRONG = the brute/boss breaker — enormous single-hit damage that shreds armor and knocks brutes
            flat, but slow, stamina-hungry, sluggish to dash, and a narrow arc that swarms punish.
   radiusMult = swing cleave radius · parryBonus = extra parry window · heavyDmg = vs armored foes. */
export const STANCES = {
  fast:   { name: 'SHII-CHO — FAST', blade: 0x35c8ff,
            dmg: 0.58, heavyDmg: 0.42, speed: 2.05, knock: 0.38, stamina: 6, lunge: 1.4, move: 1.42, accel: 1.7, twist: 0.4, bladeLen: 0.94,
            radiusMult: 1.45, forceRegen: 1.5, costMult: { push: 0.7, pull: 0.7 }, dashCd: 0.48,
            comboGap: 1.25, fovKick: 6,
            moveAtk: 1.08,        // PASSIVE: +8% footwork even mid-swing — kite while you cleave
            finisherArc: 1.1,     // the finisher cleaves ~10% wider — built for crowds
            castMul: 0.65,        // SYNERGY: snappy Force casts — the gesture fires ~35% faster
            swingCoil: 0.7, swingFollow: 0.85, wristSnap: 1.5,   // VISUAL: light, whippy strokes — short wind-up, extra wrist
            gait: { amp: 1.0, lift: 1.3, bob: 0.45, lean: 1.25 },   // MOVEMENT: light, high-kneed, springy — a duelist on the balls of their feet
            syn: 'CROWDS · snappy Force casts · +8% move while attacking · WEAK vs armor' },
  medium: { name: 'NIMAN — BALANCED', blade: 0x3aff8c,
            dmg: 1.0, heavyDmg: 0.95, speed: 1.0, knock: 0.85, stamina: 11, lunge: 1.15, move: 1.0, accel: 1.0, twist: 0.55, bladeLen: 1.0,
            radiusMult: 1.0, cdMult: 0.65, parryBonus: 0.10, comboGap: 1.0, fovKick: 0,
            parryRefund: 16,      // PASSIVE: the duelist's form — a clean parry feeds extra Force back
            blockStamMul: 0.55,   // SYNERGY: economical guard — blocking/parrying drains far less stamina
            swingCoil: 1.0, swingFollow: 1.0, wristSnap: 1.0,   // VISUAL: clean, textbook strokes
            gait: { amp: 1.08, lift: 1.0, bob: 0.4, lean: 1.0 },   // MOVEMENT: smooth, balanced, even strides
            syn: 'VERSATILE · −35% cooldowns · widest parry · cheap guard · parries refund +Force' },
  strong: { name: 'DJEM SO — STRONG', blade: 0xb24bff,
            // HEAVY & momentum-driven, not slow-motion: still the slowest swing but it now flows; the big LUNGE
            // carries the blade through. High dmg, shreds armor, weak Force synergy (forceRegen < 1, no powerDmg).
            // clearly the SLOWEST swing (well under medium's 1.0) — heavy, deliberate, weighty — but the big LUNGE
            // and high damage make each committed stroke land hard, so it reads as power, not sluggishness.
            dmg: 2.15, heavyDmg: 1.75, speed: 0.68, knock: 2.2, stamina: 18, lunge: 1.4, move: 0.85, accel: 0.6, twist: 1.0, bladeLen: 1.14,
            radiusMult: 0.8, forceRegen: 0.7, dashCd: 1.25, comboGap: 0.7, fovKick: -4,
            atkDR: 0.15,          // PASSIVE: armored commitment — soak 15% damage WHILE mid-swing
            finisherLunge: 1.6,   // the 3rd hit lunges harder, carrying the heavy blade through
            finisherKnock: true,  // the finisher ALWAYS floors what it hits (brutes included)
            powerScale: 1.35, powerCostMul: 1.3,   // SYNERGY: Force powers hit with BRUTE scale (+35% radius/knock) but cost +30% Force
            swingCoil: 1.5, swingFollow: 1.4, wristSnap: 0.6,   // VISUAL: a deep heavy wind-up & a crushing follow-through, little wrist
            gait: { amp: 1.2, lift: 0.78, bob: 0.85, lean: 0.8 },   // MOVEMENT: long, heavy, planted strides — a juggernaut's weighty stomp
            syn: 'BRUTES & BOSS · 15% DR mid-swing · finisher floors · BIG but costly Force powers' },
  // THE DARKSABER — the Mando's signature melee (selected automatically when the darksaber is equipped, not a
  // switchable Jedi form). Heavy-like, but the highest damage in the game, a touch faster & more mobile than Djem So.
  darksaber: { name: 'DARKSABER', blade: 0xc9a6ff,
            // HEAVY, CLUMSY, HIGH-RISK/HIGH-REWARD — the Mando isn't a trained duelist. SLOWEST swing in the game,
            // very stamina-hungry, sluggish to move mid-swing, with the SMALLEST parry window — but the highest damage.
            dmg: 2.8, heavyDmg: 2.6, speed: 0.55, knock: 1.6, stamina: 26, lunge: 1.4, move: 0.92, accel: 0.7, twist: 0.95, bladeLen: 1.2,
            radiusMult: 1.12, forceRegen: 1.0, dashCd: 1.2, comboGap: 0.6, fovKick: -3,
            parryBonus: -0.05, moveAtkPenalty: 0.32,   // smallest parry window · crawls while mid-swing
            syn: 'DARKSABER · devastating but SLOW & clumsy · huge stamina · tiny parry — time it, do not spam' },
};
export const STANCE_ORDER = ['fast', 'medium', 'strong'];   // the darksaber is NOT here — it's auto-selected, never cycled

/* directional swing patterns — right-arm driven.
   y = shoulder yaw sweep · x = shoulder raise · z = shoulder roll (blade tilt) ·
   w = wrist snap on the saber · reach = how far the arm punches forward through the cut. */
export const SWING_PATTERNS = {
  right:    { yF: -1.7,  yT:  1.6,  xF: -1.15, xT: -1.15, zF: 1.1,  zT: -1.2, wF: 0.9,  wT: -0.8, reach: 0.4 },   // strafe R: blade sweeps toward the player's RIGHT (verified)
  left:     { yF:  1.7,  yT: -1.6,  xF: -1.15, xT: -1.15, zF: -1.2, zT: 1.1,  wF: -0.8, wT: 0.9,  reach: 0.4 },   // strafe L: blade sweeps toward the player's LEFT
  forward:  { yF:  0.35, yT: -0.25, xF: -2.85, xT: -0.2,  zF: -0.2, zT: 0.1,  wF: -0.9, wT: 0.5,  reach: 0.6  },  // advance: overhead chop
  back:     { yF:  0.6,  yT: -0.4,  xF: -0.1,  xT: -2.5,  zF: 0.3,  zT: -0.4, wF: 0.6,  wT: -0.8, reach: 0.15 },  // retreat: rising cut
  diagL:    { yF:  1.25, yT: -0.9,  xF: -2.55, xT: -0.6,  zF: -1.0, zT: 0.6,  wF: -0.8, wT: 0.6,  reach: 0.45 },  // diagonal shoulder→hip
  diagR:    { yF: -1.25, yT:  0.9,  xF: -2.55, xT: -0.6,  zF: 1.0,  zT: -0.6, wF: 0.8,  wT: -0.6, reach: 0.45 },
};

/* Progression is data-driven: see PROGRESSION CONFIG (auto-unlocks + the XP ability store) further below.
   NIMAN is always available; FAST/STRONG forms are auto-unlocked there. */
export function stanceUnlocked(id){ return id === 'medium' || !!(G.stanceUnlocked && G.stanceUnlocked[id]); }
