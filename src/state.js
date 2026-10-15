// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shared run state: G (run/session state), the player object, entity arrays, held keys, and `shared` for values that get reassigned.

import * as THREE from 'three';
import { CFG } from './data/config.js';
import { V3 } from './utils.js';

/* Values that get REASSIGNED during play live here (ES module imports are read-only),
   so every file reads and writes them as shared.<name>. */
export const shared = {
  AC: null,
  humGain: null,
  masterGain: null,
  // MASTER VOLUME — a single gain node every sound (sfx/hum/music) routes through, so one slider controls all of it.
  masterVol: (() => { const v = parseFloat(localStorage.getItem('sw_vol')); return isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); })(),
  boss: null,
  saberProj: null,
  bossLight: null,
  _barrierMesh: null,
  _grappleLine: null,
  arenaGroup: new THREE.Group(),
  arenaHalf: 20,
  ambient: null,   // drifting embers / ash / dust
  templeBrazier: null,
  levelPhase: 'idle',   // idle | between | fighting | bossfight
  phaseT: 0,
  lockFallback: false,   // pointer lock unavailable (e.g. embedded preview) — play with plain mouse-move look
};

/* ============================================================
   GAME STATE
   ============================================================ */
export const G = {
  mode: 'menu',          // menu | play | dead | victory
  paused: false,         // true while the pause/ESC overlay is up — freezes the whole sim
  skillSelect: false, skillPoints: 0, skillSpent: 0,   // between-wave skill-tree pause
  saberGrip: 'regular',   // player preference: 'regular' or 'reverse' lightsaber grip (visual only)
  swingMirror: false,   // player preference: flips which way strafe-L/R directional cuts sweep
  mouseSens: 1,          // player preference: mouse look sensitivity multiplier
  levelIdx: 0, wave: 0, waveTotal: -1,   // waveTotal = cumulative waves started (drives Mando ability unlocks)
  yaw: 0, pitch: 0.35,
  hitstop: 0, shake: 0, slowmo: 1, slowmoT: 0,
  gt: 0,
  streak: 0, streakT: 0,
  spawnQueue: [],
  unlocked: {},
  stance: 'medium', stanceCd: 0,
  hero: 'jedi',          // 'jedi' (saber/Force) or 'mando' (jetpack/blasters) — chosen on the menu
  // SURVIVAL / ENDLESS mode
  modeSel: 'campaign',   // menu pick: 'campaign' | 'endless'
  endless: false,        // true while a survival run is active
  endlessWave: 0,        // current survival wave (1-based)
  mut: null,             // active wave mutator id (or null)
  arenaRot: 0,           // which authored arena the survival run is currently on
};
export let rockets = [], birds = [], detos = [], grapples = [];   // mando projectiles / hooks
export const enemies = [], bolts = [], orbs = [], barrels = [], vents = [], rings = [], vfx = [], pillars = [], solids = [], hazardZones = [];

export const keys = {};

/* ============================================================
   PLAYER
   ============================================================ */
export const player = {
  group: new THREE.Group(),
  vis: null,                     // visual rig — flips/leans without moving the logic root
  hp: CFG.player.maxHp, force: CFG.player.maxForce,
  vy: 0, grounded: true, airLeft: CFG.player.airJumps,
  vel: V3(0,0,0),               // impulse velocity (lunge/dash)
  moveVel: V3(0,0,0),           // input velocity with momentum
  faceYaw: 0, flip: null, queuedAtk: false,
  atkT: 0, comboStep: 0, lastAtkEnd: -9, swing: null,
  dashT: 0, lastHurt: -9,
  stam: CFG.player.maxStam, stamDelay: 0, lastWinded: -9, exhausted: false, heartT: 0,
  blockHeld: false, blockT: 0, parryT: 0, riposteT: 0,
  castT: 0, castMax: 0.3, castKind: '', swingFlip: false,   // force-cast hand gesture + neutral swing alternator
  // skill-tree upgrade multipliers/bonuses (reset each new campaign)
  up: { dmg: 1, forceRegen: 1, move: 1, knock: 1, parry: 0, lifesteal: 0, hpMax: 0, dashCdMult: 1, stamRegen: 1,
        atkSpeed: 1, dr: 0, blockStam: 1, riposte: 1, parryForce: 0, tempest: false,
        fireRate: 1, fuelEff: 1, flameDmg: 1, flameRange: 1, rocketDmg: 1, rocketR: 1, braceDR: 0, aim: 0, darksaber: false, abilityCostMul: 1 },
  skills: {},   // id → rank taken in the skill tree
  judgeT: 0, judgeTick: 0, judgeTargets: [],
  barrierT: 0, mendT: 0, mendMax: 0.7,
  cancelT: -9, cancelDR: 0, swingLock: 0,   // swing-cancel system: riposte-window timestamp, brief DR, re-swing lockout
  runPhase: 0,
  cds: { push:0, slam:0, throw:0, dash:0, pull:0, judge:0, repulse:0, barrier:0, mend:0, rocket:0, flame:0, dark:0, birds:0, deto:0, grapple:0, missile:0, bacta:0 },
  saberPivot: null, saberHand: null, arcMesh: null, blade: null, rig: null,
  // mando
  fireCd: 0, firePistol: 1, firing: false, jetActive: false, mandoParts: null, pistols: null, lockOn: false,
  darkT: 0, darkApplied: false, darksaberMesh: null, darkLight: null,
  weapon: 'single', heat: 0, overheat: false, ventT: 0, heatDelay: 0, grappleActive: null,
  zoom: false, aiming: 0, recoilKick: 0,
  jet: 100, jetMax: 100, stabT: 0,   // dedicated jetpack FUEL (separate from ability Force); disruptor stab timer
  aimOff: { x: 0, y: 0 },            // screen-space crosshair drift (free-aim like BF2 / Helldivers)
};
