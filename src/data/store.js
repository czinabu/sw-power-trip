// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Progression tables: auto-unlocks, XP store forks, survival power-ups.

import { stanceUnlocked } from './stances.js';
import { G, player } from '../state.js';
import { maxHp } from '../player/helpers.js';
import { setStanceHud } from '../player/jedi/stance.js';
import { switchWeapon } from '../player/mando/weapons.js';
import { applyJetTier, applyCellTier } from '../game/progression.js';

/* ============================================================
   PROGRESSION CONFIG  (edit here to add/retune progression)
   - AUTO: weapons / forms / jetpack tiers + CORE abilities — granted automatically by stage, no XP.
   - STORE: ABILITY FORKS (choose 1 of 2, the other locks forever) + a single expensive FINAL, bought with XP.
   - MASTERY (data/mastery.js): XP-bought ranks that upgrade each ability you own.
   - Weapon-UPGRADES are a separate track: the skill-tree cards, paid with SKILL POINTS (one per wave cleared).
   Mando weapon fork (disruptor/darksaber) is the one FREE store choice. STORE_TIER_STAGE gates each tier by waveTotal.
   ============================================================ */
export const MANDO_AUTO = [
  // CORE abilities — automatic. The rocket is in the starting kit; the FLAMETHROWER (a cone of damage over time,
  // the Mando's first crowd-clearer) arrives after wave 2, the same beat the Jedi gets Force Pull and Ataru.
  { key:'rocket', stage:0, hud:'Q', name:'WRIST ROCKET',
    has:()=>!!G.unlocked.rocket,         grant(){ G.unlocked.rocket = true; } },
  { key:'flame',  stage:2, hud:'F', name:'FLAMETHROWER',
    has:()=>!!G.unlocked.flame,          grant(){ G.unlocked.flame = true; } },
  // weapon + jetpack — automatic
  { key:'dual', stage:1, hud:'2',   name:'DUAL BLASTERS',
    has:()=>!!G.unlocked.dual,           grant(){ G.unlocked.dual = true; if (player.weapon === 'single') switchWeapon('dual'); } },
  { key:'jet1', stage:3, hud:'SPACE', name:'JETPACK BOOSTER I',
    has:()=>(player.up.jetTier||0) >= 1, grant(){ player.up.jetTier = 1; applyJetTier(); } },
  { key:'jet2', stage:8, hud:'SPACE', name:'JETPACK BOOSTER II',
    has:()=>(player.up.jetTier||0) >= 2, grant(){ player.up.jetTier = 2; applyJetTier(); } },
  // POWER CELLS — the blasters hold more energy before they overheat and recover it faster (data/mando.js cells),
  // keeping pace with the fire-rate upgrades that drain it quicker
  { key:'cells1', stage:2, hud:'HOLD LMB', name:'POWER CELLS I',
    has:()=>(player.up.cellTier||0) >= 1, grant(){ player.up.cellTier = 1; applyCellTier(); } },
  { key:'cells2', stage:5, hud:'HOLD LMB', name:'POWER CELLS II',
    has:()=>(player.up.cellTier||0) >= 2, grant(){ player.up.cellTier = 2; applyCellTier(); } },
  { key:'cells3', stage:8, hud:'HOLD LMB', name:'POWER CELLS III',
    has:()=>(player.up.cellTier||0) >= 3, grant(){ player.up.cellTier = 3; applyCellTier(); } },
];
// `stage` is the survival gate (cumulative waveTotal); campaign uses level/wave. Both kept in sync in checkUnlocks.
export const JEDI_AUTO = [
  // FORCE PULL — auto-unlocks early (after wave 2); it's no longer in the starting kit
  { key:'pull',   level:0, wave:2, stage:1, hud:'C', name:'FORCE PULL',
    has:()=>!!G.unlocked.pull,        grant(){ G.unlocked.pull = true; } },
  { key:'fast',   level:0, wave:2, stage:2, hud:'1', name:'ATARU — FAST FORM',
    has:()=>stanceUnlocked('fast'),   grant(){ (G.stanceUnlocked = G.stanceUnlocked || {}).fast = true; setStanceHud(); } },
  { key:'strong', level:1, wave:2, stage:4, hud:'3', name:'DJEM SO — STRONG FORM',
    has:()=>stanceUnlocked('strong'), grant(){ (G.stanceUnlocked = G.stanceUnlocked || {}).strong = true; setStanceHud(); } },
  // FORCE JUMP gets stronger automatically as the legend grows (like the Mando jetpack)
  { key:'fj1', level:0, wave:3, stage:3, hud:'HOLD SPACE', name:'FORCE JUMP I',
    has:()=>(player.up.fjTier||0) >= 1, grant(){ player.up.fjTier = 1; } },
  { key:'fj2', level:1, wave:2, stage:6, hud:'HOLD SPACE', name:'FORCE JUMP II',
    has:()=>(player.up.fjTier||0) >= 2, grant(){ player.up.fjTier = 2; } },
];

// ABILITY STORE — fork pairs (same `fork` id = choose one, other locks). `avail()` hides a node until its
// prerequisite is met (used for the conditional FINAL upgrade). Final tier is a single expensive capstone.
export const MANDO_STORE = [
  // MID fork (after wave 4) — grapple OR jetpack slam
  { id:'grapple', tier:2, stage:3, cost:150, fork:'m_mid', ico:'⌒', nm:'GRAPPLING HOOK', ds:'Reel to cover or yank a foe · X',
    owned:()=>!!G.unlocked.grapple, buy(){ G.unlocked.grapple = true; } },
  { id:'mslam',   tier:2, stage:3, cost:150, fork:'m_mid', ico:'▼', nm:'JETPACK SLAM', ds:'Aerial ground-pound shockwave · X',
    owned:()=>!!G.unlocked.slam, buy(){ G.unlocked.slam = true; } },
  // SUSTAIN — a self-heal stim. Mutually exclusive with HUNTER'S CREED (heal-per-kill): pick ONE sustain path.
  // Cost dropped 200→150 (Pass 55b) to match its tier-2 siblings (grapple/mslam both 150) — it was priced ABOVE
  // its peers despite competing against a FREE skill-tree pick (Hunter's Creed costs no XP at all), a real value gap.
  { id:'bacta',   tier:2, stage:5, cost:150, avail:()=>!player.up.lifesteal, ico:'✚', nm:'BACTA STIM', ds:'Channel a fast self-heal (+30% vit) · G · LOCKS Hunter\'s Creed',
    owned:()=>!!G.unlocked.bacta, buy(){ G.unlocked.bacta = true; } },
  // LATE fork (after wave 7) — whistling birds OR thermal detonator (comes BEFORE the signature weapon)
  { id:'birds',   tier:3, stage:6, cost:250, fork:'m_late', ico:'✺', nm:'WHISTLING BIRDS', ds:'Homing micro-missile swarm · V',
    owned:()=>!!G.unlocked.birds, buy(){ G.unlocked.birds = true; } },
  { id:'deto',    tier:3, stage:6, cost:250, fork:'m_late', ico:'◉', nm:'THERMAL DETONATOR', ds:'Sticky charge thrown onto the crosshair → big AoE · V',
    owned:()=>!!G.unlocked.deto, buy(){ G.unlocked.deto = true; } },
  // SIGNATURE WEAPON fork (after wave 8) — the major identity choice. Both bind to key 3 (mutually exclusive).
  { id:'disruptor', tier:4, stage:7, cost:0, fork:'mainwpn', ico:'⌖', nm:'DISRUPTOR RIFLE', ds:'Scoped sniper (RMB) · spear melee · key 3 · LOCKS the Darksaber',
    owned:()=>!!G.unlocked.disruptor, buy(){ G.unlocked.disruptor = true; switchWeapon('disruptor'); } },
  { id:'darksaber', tier:4, stage:7, cost:0, fork:'mainwpn', dark:true, ico:'🗡', nm:'THE DARKSABER', ds:'Heavy beskar blade — devastating but slow · key 3 · RMB+LMB throws it, the grappling line reels it back · LOCKS the Disruptor',
    owned:()=>!!player.up.darksaber, buy(){ player.up.darksaber = true; G.unlocked.dark = true; switchWeapon('darksaber'); } },
  // FINAL (after wave 9) — the expensive capstone (needs the signature weapon first)
  { id:'jetmissile', tier:5, stage:9, cost:560, final:true, avail:()=>!!(G.unlocked.disruptor||player.up.darksaber), ico:'☄', nm:'JETPACK MISSILE', ds:'Boba-Fett back launcher — HUGE blast &amp; damage · Z · earned AFTER your signature weapon',
    owned:()=>!!G.unlocked.jetmissile, buy(){ G.unlocked.jetmissile = true; } },
];
/* JEDI ability arc — a steady, power-ASCENDING climb across the run:
   I  SIDEARM (early, cheap) — a real DEFENCE-vs-OFFENCE fork (this is where Force Barrier lives)
   II SUSTAIN (mid) — Jump Attack (a leaping shockwave strike) OR Force Mend (a self-heal)
   III ASCENSION (late) — your ULTIMATE: the two mightiest powers, mutually exclusive
   FINAL (latest, priciest) — a capstone that supercharges whichever ultimate you took.
   Costs climb with power so the strongest tools are unmistakably end-game rewards. */
export const JEDI_STORE = [
  // I — SIDEARM fork (after wave 3): reach OR survivability. Picking one LOCKS the other.
  { id:'throw',   tier:1, stage:2, cost:90,  fork:'j_arm', ico:'✦', nm:'SABER THROW', ds:'Hurl the blade — it returns · RMB+LMB',
    owned:()=>!!G.unlocked.throw,   buy(){ G.unlocked.throw = true; } },
  { id:'barrier', tier:1, stage:2, cost:90,  fork:'j_arm', ico:'⛨', nm:'FORCE BARRIER', ds:'Bubble: knockback on cast, −damage &amp; bolt-deflect, then a parting shove · V',
    owned:()=>!!G.unlocked.barrier, buy(){ G.unlocked.barrier = true; } },
  // II — SUSTAIN fork (after wave 5): clear breathing room with an AOE knockdown, OR knit your wounds. Offense vs sustain.
  { id:'jslam',   tier:2, stage:4, cost:170, fork:'j_util', ico:'▼', nm:'JUMP ATTACK', ds:'X: leap, wind up and bring the blade down in a shockwave',
    owned:()=>!!G.unlocked.slam,    buy(){ G.unlocked.slam = true; } },
  { id:'mend',    tier:2, stage:4, cost:170, fork:'j_util', avail:()=>!player.up.lifesteal, ico:'✚', nm:'FORCE MEND', ds:'Channel a big self-heal (+30% vit) · X · LOCKS Vampiric Blade',
    owned:()=>!!G.unlocked.mend,    buy(){ G.unlocked.mend = true; } },
  // III — ASCENSION fork (after wave 7): your ULTIMATE. The two most powerful Force powers, choose ONE.
  { id:'judge',   tier:3, stage:6, cost:300, fork:'j_ult', ico:'⚡', nm:'FORCE JUDGEMENT', ds:'Chain-lightning channel · R',
    owned:()=>!!G.unlocked.judge,   buy(){ G.unlocked.judge = true; } },
  { id:'repulse', tier:3, stage:6, cost:300, fork:'j_ult', ico:'❂', nm:'FORCE REPULSE', ds:'360° concussive knockback blast · R',
    owned:()=>!!G.unlocked.repulse, buy(){ G.unlocked.repulse = true; } },
  // LATE (after wave 8) — not a fork: the Force Grasp takes several foes at once
  { id:'graspMulti', tier:4, stage:7, cost:380, avail:()=>!!G.unlocked.pull, ico:'⟲', nm:"DARK LORD'S GRIP", ds:'Hold C to grasp up to 3 foes at once · F hurls them all',
    owned:()=>!!player.up.graspMulti, buy(){ player.up.graspMulti = true; } },
  // FINAL (after wave 9) — supercharges whichever ULTIMATE you chose (only the matching one shows).
  { id:'judgeUp',   tier:5, stage:8, cost:620, final:true, avail:()=>!!G.unlocked.judge,   ico:'⚡', nm:'STORM OF JUDGEMENT', ds:'Judgement strikes +3 more foes, ×1.9 damage',
    owned:()=>!!player.up.judgeUp,   buy(){ player.up.judgeUp = true; } },
  { id:'repulseUp', tier:5, stage:8, cost:620, final:true, avail:()=>!!G.unlocked.repulse, ico:'❉', nm:'FORCE NOVA', ds:'Repulse erupts with vast range &amp; power',
    owned:()=>!!player.up.repulseUp, buy(){ player.up.repulseUp = true; } },
];
// SURVIVAL POWER-UPS — repeatable, escalating XP sink so you keep scaling against the endless curve.
// Named apart from the VITALITY boon and the Jedi BULWARK training card, which can sit on the same screen.
export const ENDLESS_POWERS = [
  { id:'might',    ico:'⚔', nm:'MIGHT',      ds:'+10% weapon &amp; power damage', apply(){ player.up.dmg *= 1.10; player.up.flameDmg = (player.up.flameDmg||1)*1.10; } },   // ordnance already scales with dmg
  { id:'vitality', ico:'✚', nm:'FORTITUDE',   ds:'+22 max vitality · full heal',  apply(){ player.up.hpMax += 22; player.hp = maxHp(); } },
  { id:'alacrity', ico:'✦', nm:'ALACRITY',   ds:'+8% attack &amp; fire speed',    apply(){ player.up.atkSpeed *= 1.08; player.up.fireRate = (player.up.fireRate||1)*1.08; } },
  { id:'attune',   ico:'❂', nm:'ATTUNEMENT', ds:'+15% Force regen · −5% cost',    apply(){ player.up.forceRegen *= 1.15; player.up.abilityCostMul *= 0.95; } },
  { id:'bulwark',  ico:'⛨', nm:'RESOLVE',    ds:'take 6% less damage',            apply(){ player.up.dr = 1 - (1-(player.up.dr||0))*0.94; } },
];
