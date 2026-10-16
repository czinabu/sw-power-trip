// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BOONS: roguelite boon pool and rarity weights.

import { CFG } from './config.js';
import { player } from '../state.js';
import { maxHp } from '../player/helpers.js';

/* ============================================================
   BOONS — a roguelite build layer. One FREE choice of 3 on every wave clear (campaign & survival). Boons stack into
   emergent builds and hook into the combat systems. Rarity weights the roll; "once" boons are unique build pivots.
   ============================================================ */
export const BOONS = [
  // —— COMMON (stat, stackable) ——
  { id:'vitality', r:'common', ico:'✚', nm:'VITALITY',     ds:'+25 max vitality · heal to full',
    apply(){ player.up.hpMax += 25; player.hp = maxHp(); } },
  { id:'keen',     r:'common', ico:'⚔', nm:'KEEN EDGE',     ds:'+14% all damage',
    apply(){ player.up.dmg *= 1.14; player.up.flameDmg=(player.up.flameDmg||1)*1.14; } },   // ordnance already scales with dmg
  { id:'swift',    r:'common', ico:'✦', nm:'SWIFT STRIKES', ds:'+12% attack & fire speed',
    apply(){ player.up.atkSpeed *= 1.12; player.up.fireRate=(player.up.fireRate||1)*1.12; } },
  { id:'reserves', r:'common', ico:'❂', nm:'DEEP RESERVES', ds:'+20% Force/fuel regen · −8% ability cost',
    apply(){ player.up.forceRegen *= 1.20; player.up.abilityCostMul *= 0.92; } },
  { id:'ironhide', r:'common', ico:'⛨', nm:'IRONHIDE',      ds:'take 9% less damage',
    apply(){ player.up.dr = 1 - (1-(player.up.dr||0))*0.91; } },
  { id:'fleet',    r:'common', ico:'➳', nm:'FLEETFOOT',     ds:'+12% move speed · −15% dash cooldown',
    apply(){ player.up.move *= 1.12; player.up.dashCdMult *= 0.85; } },
  // —— RARE (build pivots, once) ——
  { id:'glass',    r:'rare', once:true, ico:'✷', nm:'GLASS CANNON', ds:'+40% damage · −25 max vitality',
    apply(){ player.up.dmg *= 1.40; player.up.hpMax -= 25; player.hp = Math.min(player.hp, maxHp()); } },
  { id:'blood',    r:'rare', once:true, ico:'♥', nm:'BLOODTHIRST',  ds:'kills heal 4% of max vitality',
    apply(){ player.boon.blood = true; } },
  { id:'exec',     r:'rare', once:true, ico:'☠', nm:'EXECUTIONER',  ds:'your hits finish foes under 22% vitality',
    apply(){ player.boon.exec = true; } },
  { id:'adrenal',  r:'rare', once:true, ico:'⚡', nm:'ADRENALINE',   ds:'below 35% vitality: −25% damage taken · +18% move',
    apply(){ player.boon.adrenal = true; } },
  { id:'momentum', r:'rare', once:true, ico:'➤', nm:'MOMENTUM',     ds:'each kill: +6% move speed (5s, stacks ×5)',
    apply(){ player.boon.momentum = true; } },
  { id:'secwind',  r:'rare', once:true, ico:'⟳', nm:'SECOND WIND',  ds:'each wave clear, heal an extra 30% vitality',
    apply(){ player.boon.secwind = true; } },
  // —— LEGENDARY (run-defining, once) ——
  { id:'phoenix',  r:'legendary', once:true, ico:'✸', nm:'PHOENIX',     ds:'cheat death once — revive at 50% vitality',
    apply(){ player.boon.phoenix = true; player.phoenixReady = true; } },
  { id:'echo',     r:'legendary', once:true, ico:'❖', nm:'ECHO STRIKE', ds:'your hits ring out a second time for 40%',
    apply(){ player.boon.echo = true; } },
  { id:'nexus',    r:'legendary', once:true, ico:'✺', nm:'FORCE NEXUS', ds:'+45% Force/fuel regen · −22% ability cost',
    apply(){ player.up.forceRegen *= 1.45; player.up.abilityCostMul *= 0.78; player.force = CFG.player.maxForce; } },
];
export const BOON_BY_ID = Object.fromEntries(BOONS.map(b => [b.id, b]));
export const RARITY_W = { common:0.62, rare:0.30, legendary:0.08 };
