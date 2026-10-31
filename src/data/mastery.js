// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// POWER MASTERY: ranks earned by use that upgrade the abilities you own, plus abil(), the tuned-parameter lookup.

import { CFG } from './config.js';
import { MANDO } from './mando.js';
import { G } from '../state.js';

/* ============================================================
   POWER MASTERY — every ability you own can be mastered twice, by USING it in a fight (game/upgrades.js trainAbility).
   Rank I and rank II each change the ability's tuning (`mul` multiplies a field of its CFG/MANDO entry, `add` adds
   to it). Ranks stack, and the ability code reads its numbers through abil(id) so a rank takes effect everywhere.
   `uses` is how many uses each rank asks for, counted from when you got it ([rank I, rank II in total]): the
   long-cooldown powers ask for fewer, so each rank takes roughly the same stretch of fighting.
   `r2` is the waveTotal rank II opens at, so an early ability can't be fully mastered within a wave or two of
   arriving (uses past the rank I mark still count; rank II lands at the first wave clear once it's open).
   `cost` is the old XP price of [rank I, rank II], kept only for /tools/progression-lab.html. Ids match the store
   ids where they differ from the cooldown key (jslam / mslam) so the two slams stay separate.
   ============================================================ */
export const MASTERY_JEDI = [
  { id:'push', nm:'FORCE PUSH', ico:'➤', cost:[250, 500], uses:[20, 45], r2:3, base:()=>CFG.abilities.push, owned:()=>!!G.unlocked.push,
    ranks:[ { ds:'Shoves 60% harder · wider cone', mul:{ knock:1.6, angle:1.2 } },
            { ds:'Full-power LAUNCH (+75% shove) · −35% cooldown · +25% reach', mul:{ knock:1.75, cd:0.65, range:1.25 } } ] },
  { id:'pull', nm:'FORCE PULL', ico:'⟲', cost:[300, 550], uses:[14, 32], r2:4, base:()=>CFG.abilities.pull, owned:()=>!!G.unlocked.pull,
    ranks:[ { ds:'Hauls them in much harder · +30% reach · wider grasp', add:{ pwr:0.3 }, mul:{ range:1.3, angle:1.2 } },
            { ds:'Full-power YANK · −40% cooldown · −30% Force cost', add:{ pwr:0.3 }, mul:{ cd:0.6, cost:0.7 } } ] },
  { id:'throw', nm:'SABER THROW', ico:'✦', cost:[350, 650], uses:[12, 28], r2:5, base:()=>CFG.abilities.throw, owned:()=>!!G.unlocked.throw,
    ranks:[ { ds:'+60% blade damage', mul:{ dmg:1.6 } },
            { ds:'Flies 30% further &amp; faster · −35% cooldown', mul:{ range:1.3, speed:1.25, cd:0.65 } } ] },
  { id:'barrier', nm:'FORCE BARRIER', ico:'⛨', cost:[350, 650], uses:[8, 18], r2:5, base:()=>CFG.abilities.barrier, owned:()=>!!G.unlocked.barrier,
    ranks:[ { ds:'Lasts +1.5s · harder cast shove', add:{ dur:1.5 }, mul:{ castKnock:1.4 } },
            { ds:'Blocks 80% damage · −35% cooldown · wider shoves', add:{ dr:0.1 }, mul:{ cd:0.65, knockR:1.25 } } ] },
  { id:'jslam', nm:'JUMP ATTACK', ico:'▼', cost:[450, 800], uses:[10, 24], r2:6, base:()=>CFG.abilities.slam, owned:()=>!!G.unlocked.slam,
    ranks:[ { ds:'Double damage · +25% radius', mul:{ dmg:2, radius:1.25, strike:1.4 } },
            { ds:'SHOCKWAVE: a dive from a double jump lands a far bigger wave · −25% cooldown', add:{ bigWave:1 }, mul:{ cd:0.75 } } ] },
  { id:'mend', nm:'FORCE MEND', ico:'✚', cost:[450, 800], uses:[5, 12], r2:6, base:()=>CFG.abilities.mend, owned:()=>!!G.unlocked.mend,
    ranks:[ { ds:'Heals 42% vitality (was 30%)', add:{ heal:0.12 } },
            { ds:'−25% cooldown · −25% Force cost', mul:{ cd:0.75, cost:0.75 } } ] },
  { id:'judge', nm:'FORCE JUDGEMENT', ico:'⚡', cost:[600, 1000], uses:[6, 14], r2:8, base:()=>CFG.abilities.judge, owned:()=>!!G.unlocked.judge,
    ranks:[ { ds:'+40% damage · channels 30% longer', mul:{ dmg:1.4, time:1.3 } },
            { ds:'−35% cooldown · +20% reach', mul:{ cd:0.65, range:1.2 } } ] },
  { id:'repulse', nm:'FORCE REPULSE', ico:'❂', cost:[600, 1000], uses:[6, 14], r2:8, base:()=>CFG.abilities.repulse, owned:()=>!!G.unlocked.repulse,
    ranks:[ { ds:'+40% damage · +15% radius · hurls 50% harder', mul:{ dmg:1.4, radius:1.15, knock:1.5 } },
            { ds:'Full-power BLAST (+33% hurl) · −35% cooldown · −20% Force cost', mul:{ cd:0.65, cost:0.8, knock:1.33 } } ] },
];
export const MASTERY_MANDO = [
  { id:'rocket', nm:'WRIST ROCKET', ico:'⏶', cost:[250, 500], uses:[12, 28], r2:3, base:()=>MANDO.rocket, owned:()=>!!G.unlocked.rocket,
    ranks:[ { ds:'+25% blast radius · 50% more knockback · double damage', mul:{ radius:1.25, knock:1.5, dmg:2 } },
            { ds:'Full-power BLAST (+32% knockback) · −40% cooldown · −25% Force cost', mul:{ cd:0.6, cost:0.75, knock:1.32 } } ] },
  { id:'flame', nm:'FLAMETHROWER', ico:'✦', cost:[250, 500], uses:[15, 35], r2:4, base:()=>MANDO.flame, owned:()=>!!G.unlocked.flame,
    ranks:[ { ds:'+30% damage · +20% reach', mul:{ dmg:1.3, range:1.2 } },
            { ds:'Burns 30% less Force · wider spray', mul:{ fuel:0.7, angle:1.2 } } ] },
  { id:'grapple', nm:'GRAPPLING HOOK', ico:'⌒', cost:[300, 550], uses:[15, 35], r2:5, base:()=>MANDO.grapple, owned:()=>!!G.unlocked.grapple,
    ranks:[ { ds:'+30% reach · reels 25% faster', mul:{ range:1.3, pullSpeed:1.25 } },
            { ds:'Half the cooldown · −40% Force cost', mul:{ cd:0.5, cost:0.6 } } ] },
  { id:'mslam', nm:'JETPACK SLAM', ico:'▼', cost:[300, 550], uses:[10, 24], r2:5, base:()=>MANDO.slam, owned:()=>!!G.unlocked.slam,
    ranks:[ { ds:'+60% damage · +25% radius · 50% more knockback', mul:{ dmg:1.6, radius:1.25, knock:1.5 } },
            { ds:'Burns 35% less jet fuel · full-power SLAM (+48% knockback)', mul:{ cost:0.65, knock:1.48 } } ] },
  { id:'bacta', nm:'BACTA STIM', ico:'✚', cost:[400, 700], uses:[5, 12], r2:7, base:()=>Object.assign({ heal: CFG.abilities.mend.heal }, MANDO.bacta), owned:()=>!!G.unlocked.bacta,
    ranks:[ { ds:'Heals 42% vitality (was 30%)', add:{ heal:0.12 } },
            { ds:'−25% cooldown · injects 40% faster', mul:{ cd:0.75, channel:0.6 } } ] },
  { id:'birds', nm:'WHISTLING BIRDS', ico:'✺', cost:[500, 850], uses:[8, 18], r2:9, base:()=>MANDO.birds, owned:()=>!!G.unlocked.birds,
    ranks:[ { ds:'+3 birds per volley', add:{ count:3 } },
            { ds:'+50% damage · −30% cooldown', mul:{ dmg:1.5, cd:0.7 } } ] },
  { id:'deto', nm:'THERMAL DETONATOR', ico:'◉', cost:[500, 850], uses:[10, 24], r2:9, base:()=>MANDO.deto, owned:()=>!!G.unlocked.deto,
    ranks:[ { ds:'+30% blast radius &amp; damage', mul:{ radius:1.3, dmg:1.3 } },
            { ds:'−40% cooldown · 30% shorter fuse', mul:{ cd:0.6, fuse:0.7 } } ] },
  { id:'jetmissile', nm:'JETPACK MISSILE', ico:'☄', cost:[650, 1000], uses:[5, 12], r2:10, base:()=>MANDO.jetMissile, owned:()=>!!G.unlocked.jetmissile,
    ranks:[ { ds:'+40% damage · +20% blast radius', mul:{ dmg:1.4, radius:1.2 } },
            { ds:'−35% cooldown · −20% Force cost', mul:{ cd:0.65, cost:0.8 } } ] },
];
const BY_ID = Object.fromEntries([...MASTERY_JEDI, ...MASTERY_MANDO].map(m => [m.id, m]));
export function masterySet(){ return G.hero === 'mando' ? MASTERY_MANDO : MASTERY_JEDI; }
export function masteryRank(id){ return (G.mastery && G.mastery[id]) || 0; }

// the ability's tuning with its mastery ranks applied. Built fresh on each call (a small copy), so live edits to
// CFG / MANDO from the console still take effect.
export function abil(id){
  const m = BY_ID[id], r = masteryRank(id);
  const v = Object.assign({}, m.base());
  for (let i = 0; i < r; i++){
    const rk = m.ranks[i];
    for (const k in rk.mul || {}) v[k] *= rk.mul[k];
    for (const k in rk.add || {}) v[k] += rk.add[k];
  }
  return v;
}
// the heal fraction mendComplete() restores — Force Mend for the Jedi, Bacta Stim for the Mando
export function healFrac(){ return abil(G.hero === 'mando' ? 'bacta' : 'mend').heal; }
