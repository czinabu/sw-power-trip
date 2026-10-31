// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CLONE ARC TROOPER's progression (testing only), in the same shapes as data/store.js and data/skills.js:
//   TROOPER_AUTO   handed over by the run (no choice): the recon scan, a third frag, power cells, a third clone
//   TROOPER_STORE  the choices: fork I (defence or sustain), fork II (control), the signature fork (Commander or
//                  Commando, at Mustafar like the Mando's), and the final power at the Spearhead
//   TROOPER_SKILLS the skill-point cards (the GAR training track)
// `chapter` opens it in the story campaign (at that chapter's close), `stage` (cumulative waves) everywhere else. In the
// campaign the powers cost no XP (a fork is a free pick); the XP prices are survival's. Powers: player/trooper/abilities.js.

import { G, player } from '../state.js';
import { maxHp } from '../player/helpers.js';
import { applyCellTier } from '../game/progression.js';
import { addSquadmate, squadSize } from '../allies/squad.js';
import { SQUAD } from './allies.js';
import { TROOPER } from './trooper.js';
import { switchWeapon } from '../player/mando/weapons.js';

export const TROOPER_AUTO = [
  { key:'scan', stage:1, chapter:'siege', hud:'Q', name:'RECON SCAN',
    has:()=>!!G.unlocked.scan, grant(){ G.unlocked.scan = true; } },
  { key:'frag3', stage:3, chapter:'archive', hud:'G', name:'FRAG POUCH · 3 GRENADES',
    has:()=>(player.up.fragExtra || 0) >= 1, grant(){ player.up.fragExtra = 1; player.fragCharges = (player.fragCharges || 0) + 1; } },
  // the guns' energy, as the Mando's (data/mando.js cells)
  { key:'cells1', stage:2, chapter:'archive', hud:'HOLD LMB', name:'POWER CELLS I',
    has:()=>(player.up.cellTier||0) >= 1, grant(){ player.up.cellTier = 1; applyCellTier(); } },
  { key:'cells2', stage:5, chapter:'trial-knight', hud:'HOLD LMB', name:'POWER CELLS II',
    has:()=>(player.up.cellTier||0) >= 2, grant(){ player.up.cellTier = 2; applyCellTier(); } },
  { key:'cells3', stage:8, chapter:'chase', hud:'HOLD LMB', name:'POWER CELLS III',
    has:()=>(player.up.cellTier||0) >= 3, grant(){ player.up.cellTier = 3; applyCellTier(); } },
  // the company finds him: one more clone on the line from here on (allies/squad.js trooperSquad)
  { key:'squad3', stage:4, chapter:'hoth', hud:'H', name:'HAMMER JOINS · SQUAD OF 3',
    has:()=>(player.up.squadExtra || 0) >= 1, grant(){ player.up.squadExtra = 1; if (squadSize() < SQUAD.max) addSquadmate(); } },
];

export const TROOPER_STORE = [
  // FORK I (after the first trial) — defence or sustain
  { id:'bshield', tier:2, stage:3, chapter:'trial-first', cost:150, fork:'t_mid', ico:'⛨', nm:'BUBBLE SHIELD', ds:'A dome where you stand that stops enemy bolts, for you and the squad · V',
    owned:()=>!!G.unlocked.bshield, buy(){ G.unlocked.bshield = true; } },
  { id:'medic', tier:2, stage:3, chapter:'trial-first', cost:150, fork:'t_mid', ico:'✚', nm:'FIELD MEDIC', ds:'Patch joins the squad · revives take half as long · you knit slowly once clear of a hit',
    owned:()=>!!G.unlocked.medic, buy(){ G.unlocked.medic = true; if (squadSize() < SQUAD.max) addSquadmate(); } },
  // FORK II (after the Acrobat's trial) — control
  { id:'ion', tier:3, stage:6, chapter:'trial-acrobat', cost:250, fork:'t_late', ico:'ϟ', nm:'ION GRENADE', ds:'Stuns everything in the blast (droids and jet troopers twice as long) and drops shields · F',
    owned:()=>!!G.unlocked.ion, buy(){ G.unlocked.ion = true; } },
  { id:'breach', tier:3, stage:6, chapter:'trial-acrobat', cost:250, fork:'t_late', ico:'▣', nm:'BREACH CHARGE', ds:'Slap a charge down ahead: it blows a cone forward and launches all in it · F',
    owned:()=>!!G.unlocked.breach, buy(){ G.unlocked.breach = true; } },
  // SIGNATURE fork (Mustafar) — the identity choice
  { id:'commander', tier:4, stage:7, chapter:'mustafar', cost:0, fork:'t_sig', ico:'⚑', nm:'COMMANDER', ds:'ARTILLERY BARRAGE on the crosshair · Z · and a fourth clone on the line · LOCKS Commando',
    owned:()=>!!G.unlocked.artillery, buy(){ G.unlocked.artillery = true; player.up.squadExtra = (player.up.squadExtra || 0) + 1; if (squadSize() < SQUAD.max) addSquadmate(); } },
  { id:'commando', tier:4, stage:7, chapter:'mustafar', cost:0, fork:'t_sig', dark:true, ico:'⌖', nm:'COMMANDO', ds:'The rifle\'s AT LAUNCHER on key 3 · and you hit 18% harder · LOCKS Commander',
    owned:()=>!!G.unlocked.launcher, buy(){ G.unlocked.launcher = true; player.up.dmg *= TROOPER.launcher.dmg; switchWeapon('launcher'); } },
  // FINAL (Spearhead) — the showpiece, after the signature
  { id:'strafe', tier:5, stage:9, chapter:'spearhead', cost:560, final:true, avail:()=>!!(G.unlocked.artillery || G.unlocked.launcher), ico:'✈', nm:'GUNSHIP STRAFING RUN', ds:'A gunship lays a line of blasts from you toward the crosshair · X',
    owned:()=>!!G.unlocked.strafe, buy(){ G.unlocked.strafe = true; } },
];

export const TROOPER_SKILLS = [
  // ---- TIER I — CADET: Kamino basics ----
  { id:'tplate',  ico:'⛊', nm:'PHASE II PLATE',   tier:1, max:3, ds:'+20 max vitality &amp; patch up',
    fl:'Better armour. Same brothers inside it.', apply(){ player.up.hpMax += 20; player.hp = Math.min(player.hp + 20, maxHp()); } },
  { id:'marks',   ico:'⁌', nm:'MARKSMAN',          tier:1, max:3, ds:'+15% blaster damage',
    fl:'Aim small, miss small.', apply(){ player.up.dmg *= 1.15; } },
  { id:'drill',   ico:'➤', nm:'KAMINO DRILL',      tier:1, max:3, ds:'+10% fire rate · +6% move speed',
    fl:'Again. And again. Until it is not a thought.', apply(){ player.up.fireRate = (player.up.fireRate || 1) * 1.1; player.up.move *= 1.06; } },
  { id:'demo',    ico:'✸', nm:'DEMOLITIONS',       tier:1, max:2, ds:'+30% grenade, charge and launcher damage',
    fl:'Everything is a door if you bring enough.', apply(){ player.up.ordnance = (player.up.ordnance || 1) * 1.3; } },
  { id:'cardio',  ico:'❖', nm:'FORCED MARCH',      tier:1, max:3, ds:'+20 max stamina · +10% regen',
    fl:'Nobody carries you on the march.', apply(){ player.up.maxStam += 20; player.up.stamRegen *= 1.1; player.stam += 20; } },
  // ---- TIER II — ARC: specialist training ----
  { id:'vent',    ico:'↻', nm:'COOLANT DISCIPLINE',tier:2, max:2, ds:'+40% guns cool faster · −20% heat per shot',
    fl:'Count the shots. Feel the barrel.', apply(){ player.up.heatCool = (player.up.heatCool || 1) * 1.4; player.up.heatMul = (player.up.heatMul || 1) * 0.8; } },
  { id:'lead',    ico:'⚑', nm:'LEAD FROM THE FRONT',tier:2, max:2, ds:'Your squad hits 25% harder and takes 15% less',
    fl:'They follow the one who goes first.', apply(){ player.up.squadDmg = (player.up.squadDmg || 1) * 1.25; player.up.squadDr = (player.up.squadDr || 1) * 0.85; } },
  { id:'cool',    ico:'◈', nm:'COOL UNDER FIRE',   tier:2, max:2, ds:'Take 8% less damage · +15% ability energy regen',
    fl:'Breathe. Then shoot.', apply(){ player.up.dr = 1 - (1-(player.up.dr||0))*0.92; player.up.forceRegen *= 1.15; } },
  // ---- TIER III — COMMAND: capstones (one rank) ----
  { id:'arcvet',  ico:'❂', nm:'ARC VETERAN',       tier:3, max:1, ds:'+35 max vitality · take 15% less damage',
    fl:'Eight years of not dying is a skill.', apply(){ player.up.hpMax += 35; player.hp = Math.min(player.hp + 35, maxHp()); player.up.dr = 1 - (1-(player.up.dr||0))*0.85; } },
  { id:'firepower',ico:'⚡', nm:'OVERWHELMING FIRE', tier:3, max:1, ds:'+30% weapon damage · +20% fire rate',
    fl:'Suppress. Advance. Repeat.', apply(){ player.up.dmg *= 1.3; player.up.fireRate = (player.up.fireRate||1)*1.2; } },
  { id:'brothers',ico:'✺', nm:'BAND OF BROTHERS',  tier:3, max:1, ds:'Squadmates revive in a third of the time · each standing one adds 4% to your damage',
    fl:'No one gets left behind. Not again.', apply(){ player.up.reviveMul = (player.up.reviveMul || 1) * 0.33; player.up.brothers = 1; } },
];
