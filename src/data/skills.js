// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Skill trees for both heroes (SKILLS, MANDO_SKILLS) and tier gates.

import { CFG } from './config.js';
import { G, player } from '../state.js';
import { maxHp } from '../player/helpers.js';
import { MANDO_STORE, JEDI_STORE } from './store.js';

/* ============================================================
   SKILL TREE — a tiered path. Tier I is open from the start; the powerful
   ADEPT (II) and MASTER (III) skills only unlock once you've invested enough,
   so the strongest abilities are earned, not handed out.
   ============================================================ */
export const TIER_REQ = { 1: 0, 2: 2, 3: 4 };   // total skill points spent to unlock each tier
export const TIER_NAME = { 1: 'PADAWAN', 2: 'KNIGHT', 3: 'MASTER' };
export const SKILLS = [
  // ---- TIER I — PADAWAN foundations, stackable ----
  { id:'vit',   ico:'✚', nm:'IRON LIFE',     tier:1, max:3, ds:'+20 max vitality &amp; heal',
    fl:'Endure. The galaxy still needs you standing.', apply(){ player.up.hpMax += 20; player.hp = Math.min(player.hp + 20, maxHp()); } },
  { id:'edge',  ico:'⚔', nm:'HONED EDGE',    tier:1, max:3, ds:'+14% saber damage',
    fl:'A sharper blade asks fewer questions.', apply(){ player.up.dmg *= 1.14; } },
  { id:'flow',  ico:'✦', nm:'FORCE FLOW',    tier:1, max:3, ds:'+22% Force regen',
    fl:'Let it move through you, never from you.', apply(){ player.up.forceRegen *= 1.22; } },
  { id:'swift', ico:'➤', nm:'FLEET FOOT',    tier:1, max:3, ds:'+8% move speed · −12% dash CD',
    fl:'Be where the blow is not.', apply(){ player.up.move *= 1.08; player.up.dashCdMult *= 0.88; } },
  { id:'focus', ico:'◈', nm:'SERENITY',      tier:1, max:2, ds:'+0.04s parry window · +20% stamina',
    fl:'A still mind parries what a fast hand cannot.', apply(){ player.up.parry += 0.04; player.up.stamRegen *= 1.2; } },
  // ---- TIER II — KNIGHT disciplines, needs 2 spent ----
  { id:'jugg',  ico:'✷', nm:'JUGGERNAUT',    tier:2, max:2, ds:'+30% knockback · +10% saber damage',
    fl:'Meet force with greater force.', apply(){ player.up.knock *= 1.3; player.up.dmg *= 1.1; } },
  { id:'vamp',  ico:'✸', nm:'VAMPIRIC BLADE',tier:2, max:2, ds:'Heal +7 vitality per kill · LOCKS Force Mend',
    // mutually exclusive with FORCE MEND, AND now gated to the same wave FORCE MEND's store slot opens (its
    // `stage`) — previously this only needed 2 skill points spent (often wave 2-3, well before Mend's stage:4
    // store gate even existed), so a player could lock in the free "heal per kill" path before the paid heal
    // ability was ever a real alternative. Both are now a genuine either/or choice from the same wave onward.
    avail:()=>!G.unlocked.mend && (G.waveTotal||0) >= JEDI_STORE.find(n=>n.id==='mend').stage,
    fl:'Their fall becomes your second wind.', apply(){ player.up.lifesteal += 7; } },
  { id:'bulw',  ico:'⛨', nm:'BULWARK',       tier:2, max:2, ds:'Block costs −35% stamina · +15 max vit',
    fl:'The mountain does not tire.', apply(){ player.up.blockStam *= 0.65; player.up.hpMax += 15; player.hp = Math.min(player.hp + 15, maxHp()); } },
  { id:'rip',   ico:'⟲', nm:'RIPOSTE MASTER',tier:2, max:2, ds:'Parry refunds +Force · riposte +50%',
    fl:'Turn their certainty into their undoing.', apply(){ player.up.riposte = (player.up.riposte||1) * 1.5; player.up.parryForce = (player.up.parryForce||0) + 8; } },
  // ---- TIER III — MASTER capstones, needs 4 spent, one rank only ----
  { id:'unstop',ico:'❂', nm:'UNBREAKABLE',   tier:3, max:1, ds:'+35 max vitality · take 18% less damage',
    fl:'Wounds are rumors you choose not to believe.', apply(){ player.up.hpMax += 35; player.hp = Math.min(player.hp + 35, maxHp()); player.up.dr = 1 - (1-(player.up.dr||0))*0.82; } },
  { id:'storm', ico:'⚡', nm:'BLADE STORM',   tier:3, max:1, ds:'+35% saber damage · +20% attack speed',
    fl:'Become the tempest with a thousand edges.', apply(){ player.up.dmg *= 1.35; player.up.atkSpeed *= 1.2; } },
  { id:'ascend',ico:'✺', nm:'ASCENDANT',     tier:3, max:1, ds:'+70% Force regen · +20% knockback · restore Force',
    fl:'The Force has no bottom. Drink deeply.', apply(){ player.up.forceRegen *= 1.7; player.up.knock *= 1.2; player.force = CFG.player.maxForce; } },
  { id:'tempest',ico:'❉',nm:'CATACLYSM',     tier:3, max:1, ds:'Saber finishers erupt in a Force shockwave',
    fl:'End the argument. End the arguers.', apply(){ player.up.tempest = true; } },
];
/* ---- MANDALORIAN creed — its own authentic upgrade path (clan, armor, jetpack, arsenal) ---- */
export const TIER_NAME_MANDO = { 1: 'FOUNDLING', 2: 'VERD', 3: 'MANDALORE' };
export const MANDO_SKILLS = [
  // ---- TIER I — FOUNDLING: the basics of the Way ----
  { id:'plating', ico:'⛊', nm:'BESKAR PLATING',  tier:1, max:3, ds:'+20 max vitality &amp; repair',
    fl:'This is the Way. The armor is the warrior.', apply(){ player.up.hpMax += 20; player.hp = Math.min(player.hp + 20, maxHp()); } },
  { id:'trigger', ico:'⁌', nm:'MODIFIED TRIGGERS',tier:1, max:3, ds:'+15% blaster damage',
    fl:'A hunter is only as sharp as the iron they carry.', apply(){ player.up.dmg *= 1.15; } },
  { id:'thrust',  ico:'⏶', nm:'TUNED THRUSTERS', tier:1, max:3, ds:'Jetpack burns −16% fuel',
    fl:'The sky is just another place to stand.', apply(){ player.up.fuelEff = (player.up.fuelEff || 1) * 0.84; } },
  { id:'fleet',   ico:'➤', nm:'GUNSLINGER',      tier:1, max:3, ds:'+10% fire rate · +6% move speed',
    fl:'Draw fast. Draw first.', apply(){ player.up.fireRate = (player.up.fireRate || 1) * 1.1; player.up.move *= 1.06; } },
  { id:'optics',  ico:'◈', nm:'TARGETING VISOR', tier:1, max:2, ds:'+10% blaster damage · steadier aim',
    fl:'The HUD never blinks.', apply(){ player.up.dmg *= 1.1; player.up.aim = (player.up.aim || 0) + 0.35; } },
  // ---- TIER II — VERD (warrior): specialised gear ----
  { id:'gam',     ico:'⛨', nm:'FULL BESKAR\'GAM', tier:2, max:2, ds:'Brace soaks +18% · +15 max vit',
    fl:'Let them break their blades on you.', apply(){ player.up.braceDR = (player.up.braceDR || 0) + 0.18; player.up.hpMax += 15; player.hp = Math.min(player.hp + 15, maxHp()); } },
  { id:'ord',     ico:'✸', nm:'ORDNANCE EXPERT',  tier:2, max:2, ds:'+45% rocket, detonator &amp; bird damage · bigger blasts',
    fl:'If one charge is good, six are better.', apply(){ player.up.rocketDmg = (player.up.rocketDmg || 1) * 1.45; player.up.rocketR = (player.up.rocketR || 1) * 1.2; } },
  { id:'incend',  ico:'✦', nm:'INCENDIARY FUEL',  tier:2, max:2, ds:'Flamethrower +45% damage &amp; reach',
    fl:'Some bounties are best brought in warm.', apply(){ player.up.flameDmg = (player.up.flameDmg || 1) * 1.45; player.up.flameRange = (player.up.flameRange || 1) * 1.18; } },
  { id:'creed',   ico:'✸', nm:'HUNTER\'S CREED',  tier:2, max:2, ds:'Heal +8 vitality per kill · LOCKS Bacta Stim',
    // same fix as Jedi VAMPIRIC BLADE above: gated to the same wave BACTA STIM's store slot opens (its `stage`),
    // not just tier-2 skill points spent — so Creed can no longer be locked in before Bacta is even a real choice.
    avail:()=>!G.unlocked.bacta && (G.waveTotal||0) >= MANDO_STORE.find(n=>n.id==='bacta').stage,
    fl:'The Tribe endures because the hunter returns.', apply(){ player.up.lifesteal += 8; } },
  // ---- TIER III — MANDALORE: capstones (one rank) ----
  { id:'super',   ico:'❂', nm:'SUPERCOMMANDO',    tier:3, max:1, ds:'+35 max vitality · take 18% less damage',
    fl:'Death Watch trained. Forged in fire.', apply(){ player.up.hpMax += 35; player.hp = Math.min(player.hp + 35, maxHp()); player.up.dr = 1 - (1-(player.up.dr||0))*0.82; } },
  { id:'arsenal', ico:'⚡', nm:'FULL ARSENAL',     tier:3, max:1, ds:'+30% weapon damage · +20% fire rate',
    fl:'Bring everything. Leave nothing.', apply(){ player.up.dmg *= 1.3; player.up.fireRate = (player.up.fireRate||1)*1.2; player.up.rocketDmg = (player.up.rocketDmg||1)*1.3; player.up.flameDmg = (player.up.flameDmg||1)*1.3; } },
  { id:'marshal', ico:'✺', nm:'SKY MARSHAL',      tier:3, max:1, ds:'Jetpack barely sips fuel · refuel now',
    fl:'They will look up, and they will fear.', apply(){ player.up.fuelEff = (player.up.fuelEff||1)*0.55; player.up.move *= 1.1; player.force = CFG.player.maxForce; } },
  // NOTE: the Darksaber is NOT a skill-tree pick — it's one half of the wave-10 weapon FORK
  // (DISRUPTOR *or* DARKSABER, never both). See openMandoChoice().
];
