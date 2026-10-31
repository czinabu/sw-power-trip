// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ARCADE: random missions with no story. A contract is dealt from a seed: one to three objectives in a row, lifted out of a
// mission in data/missions.js (so it plays on that mission's map, at its spots), with its foes reshuffled, a threat level
// and sometimes a twist. The words are the arcade's own (DISPATCH), so nothing here leans on the campaigns: the
// story threads can rewrite their missions freely and the arcade follows whatever missions exist.
//
// A contract's id is 'arcade:<seed>'. The same seed always deals the same contract, so a co-op guest (and a reload)
// builds the exact mission the host is playing from its id alone. missionById resolves either kind of id.
//
// Tuning, all below: KIND (each objective kind's name and dispatch lines), FOE_TIERS (who can turn up at each threat),
// TWISTS, and the contract's shape in deal(). Threat runs 1 to 5: it sets the kit you start with (KIT_AT), how tough the
// foes are (FOE_TIER_AT, the waves-deep the foes are scaled as) and the duellists' health.

import { MISSIONS } from './missions.js';

export const ARCADE_VOICE = 'DISPATCH';
export const ARCADE_PREFIX = 'arcade:';
export const isArcadeId = (id) => typeof id === 'string' && id.startsWith(ARCADE_PREFIX);

// per objective kind: what a contract built around it is called, and what dispatch says as it begins (one line is
// picked per contract). { jedi, mando, trooper } where the heroes would say it differently
const KIND = {
  hold: { name: 'HOLD', titles: ['LAST STAND', 'HOLD THE LINE', 'NO GROUND GIVEN'],
    say: [ { jedi: 'Contract up. Hold that ground until the clock runs out. Nothing gets past you.', mando: 'Simple job. Hold the spot till the clock runs out. Nobody takes it.', trooper: 'Hold that position until the timer runs out. Nothing gets through, trooper.' },
           { jedi: 'They want this ground back. Stand in it, and keep standing in it.', mando: 'They want that ground. Make it cost them. Stay on it.', trooper: 'Dig in. The ground is ours until the clock says otherwise.' } ] },
  sabotage: { name: 'SLICE', titles: ['SILENT WIRES', 'CUT THE FEED', 'LIGHTS OUT'],
    say: [ { jedi: 'Consoles marked. Reach each one and stay on it until it is done. Getting hit slows you down.', mando: 'Marked targets. Stand on each one till it\'s done. Take a hit and you lose time.', trooper: 'Targets marked. Hold on each console until it\'s done. Incoming fire costs you progress.' },
           { jedi: 'Every console you finish is one less thing calling for help. Clear the guards first.', mando: 'Clear the guards, then work the console. Faster that way.', trooper: 'Clear the guards first, then slice. By the numbers.' } ] },
  capture: { name: 'TAKE', titles: ['BREAKTHROUGH', 'FLAG BY FLAG', 'PUSH FORWARD'],
    say: [ { jedi: 'Take the posts one at a time. A post only turns while no foe stands in it.', mando: 'Take their posts, one after another. Nobody of theirs standing in it, or it won\'t turn.', trooper: 'Take each post in turn. It won\'t turn while a hostile is inside.' },
           { jedi: 'Their line is a string of posts. Cut it one knot at a time.', mando: 'One post at a time. Clear it, hold it, move on.', trooper: 'Post by post. Clear, hold, advance.' } ] },
  duel: { name: 'DUEL', titles: ['A BLADE CALLED', 'ONE ON ONE', 'THE CHAMPION'],
    say: [ { jedi: 'Someone dangerous has asked for you by name. Read the blade, not the mask.', mando: 'One target, and it\'s good. Don\'t trade blows. Make it miss, then make it pay.', trooper: 'High-value hostile. Don\'t stand in front of it. Wear it down.' },
           { jedi: 'A duel, and nothing else. Patience wins this one.', mando: 'Big bounty, one fight. Keep moving.', trooper: 'Single target. Keep your distance and keep firing.' } ] },
  escort: { name: 'ESCORT', titles: ['SAFE PASSAGE', 'PRECIOUS CARGO', 'THE LONG WALK'],
    say: [ { jedi: 'Walk it through. It stops when anything gets close to it, so clear the way ahead.', mando: 'Package walks, you clear the road. It freezes when anyone gets near it.', trooper: 'Escort duty. It halts under fire, so keep the route clear.' },
           { jedi: 'It cannot fight. You can. Stay close and keep its path clear.', mando: 'It can\'t shoot back. You can. Stay near it.', trooper: 'Stay on the package. If it drops, we start over.' } ] },
  pursuit: { name: 'CHASE', titles: ['RUN IT DOWN', 'NO ESCAPE', 'THE HUNT'],
    say: [ { jedi: 'It is running. Keep it in sight. Over the cover, not around it.', mando: 'Runner. Don\'t lose sight of it. Go over things, not around them.', trooper: 'Target is running. Keep eyes on it at all times.' },
           { jedi: 'Stay on its heels. Look for the shortcuts.', mando: 'Chase it down. Shortcuts are marked.', trooper: 'Pursue. Take the marked shortcuts if you can.' } ] },
};
export const kindName = (k) => (KIND[k] || {}).name || String(k).toUpperCase();

// who can turn up, by threat (each tier adds to the one before)
const FOE_TIERS = [
  ['grunt', 'blaster'],
  ['officer', 'lancer', 'flyer'],
  ['grenadier', 'duelist', 'phalanx', 'bomber'],
  ['brute', 'sniper'],
  ['acolyte'],
];
const KIT_AT = [3, 4, 5, 6, 7];             // the kit a contract hands you (data/store.js stages), by threat
const FOE_TIER_AT = [0, 1, 3, 5, 7];       // how many waves deep its foes are scaled, by threat (enemies/elites.js)
const DUEL_HP_AT = [0.75, 0.9, 1.0, 1.15, 1.3];   // a duellist's health, times its mission's

// a twist: a few contracts come with one (the card and the details say which)
export const TWISTS = {
  veterans: { name: 'VETERANS', line: 'Its foes are tougher and come elite more often.' },
  swarm:    { name: 'SWARM', line: 'Every group that comes for you is bigger.' },
  glass:    { name: 'GLASS CANNON', line: 'Foes hit a third harder. So do you: the kit is a step ahead.' },
};

// the arcade's lines when a contract is won
const DONE = [ { jedi: 'Contract complete. Another is waiting when you are.', mando: 'Job done. Payment\'s on its way. Another one\'s up.', trooper: 'Objective complete. Good work, trooper.' },
               { jedi: 'Well fought. Dispatch has more where that came from.', mando: 'Clean work. There\'s always another job.', trooper: 'Mission accomplished. Stand by for the next one.' } ];

/* ---------- seeded dice ---------- */
function dice(seed){   // mulberry32: the same seed rolls the same numbers on every machine
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (n) => Math.floor(r() * n);
  r.pick = (list) => list[r.int(list.length)];
  return r;
}
export const newSeed = () => (Math.random() * 0x7fffffff) >>> 0 || 1;

/* ---------- dealing a contract ---------- */
// the missions the arcade deals from: every mission that stands on its own (a campaign-only copy plays the same map as
// its original, so it's left out)
const pool = () => Object.values(MISSIONS).filter(m => !m.campaignOnly && m.objectives && m.objectives.length);
// where a contract can begin: the mission's first objective, or a later one that says where a retry of it begins
// (a chase leg or an escort leg needs its own start; a hold, a slice, a take or a duel plays from the mission's start).
// The quarry's duel needs the chase before it, so it never opens a contract
function canOpen(m, i){
  const o = m.objectives[i];
  if (o.quarry) return false;
  return i === 0 || !!o.start || (o.kind !== 'pursuit' && o.kind !== 'escort');
}
const place = (m) => m.level.name.replace(/^[A-Z ]+\s*—\s*/, '');
const clone = (v) => JSON.parse(JSON.stringify(v));   // missions are plain data (numbers, strings, arrays)

// a group of foes ({ type: count }) reshuffled for the threat: about half its troops swapped for others from the tiers
// open at that threat, the count kept (one more each with SWARM)
function reroll(g, r, threat, swarm){
  const open = FOE_TIERS.slice(0, threat).flat(), out = {};
  let n = 0;
  for (const t in g) for (let k = 0; k < g[t]; k++){ const pick = r() < 0.5 ? r.pick(open) : t; out[pick] = (out[pick] || 0) + 1; n++; }
  if (swarm){ const add = Math.max(1, Math.round(n * 0.3)); for (let k = 0; k < add; k++){ const t = r.pick(open); out[t] = (out[t] || 0) + 1; } }
  return out;
}
function rerollObjective(o, r, threat, swarm){
  const G2 = (g) => g ? reroll(g, r, threat, swarm) : g;
  for (const list of [o.consoles, o.posts]) if (list) for (const p of list) p.guards = G2(p.guards);
  if (o.pulses) o.pulses = o.pulses.map(G2);
  if (o.trickle) o.trickle.group = G2(o.trickle.group);
  for (const list of [o.ambush, o.standoff]) if (list) for (const a of list) a.group = G2(a.group);
  if (o.kind === 'duel'){
    o.hp = (o.hp || 1) * DUEL_HP_AT[threat - 1];
    delete o.escape; delete o.escapeLine;   // an arcade duel is fought to the end
    if (o.hero) for (const h in o.hero){ if (o.hero[h].hp) o.hero[h].hp *= DUEL_HP_AT[threat - 1]; delete o.hero[h].escape; }
  }
}

const cache = new Map();
// the contract dealt from this seed, as a mission definition game/mission.js can run
export function arcadeContract(seed){
  seed = seed >>> 0;
  if (cache.has(seed)) return cache.get(seed);
  const r = dice(seed), missions = pool();
  if (!missions.length) return null;
  // the kind it opens with first (every kind as likely as the others, whichever missions have it: every mission ends
  // in a duel, so picking a mission first would deal mostly duels), then a mission and a spot where that kind begins
  const opens = missions.flatMap(m => m.objectives.map((o, i) => ({ m, i, kind: o.kind })).filter(x => canOpen(x.m, x.i)));
  const leads = [...new Set(opens.map(x => x.kind))];
  const lead0 = r.pick(leads), at = r.pick(opens.filter(x => x.kind === lead0));
  const src = at.m, from = at.i;
  const roll = r(), want = roll < 0.45 ? 1 : roll < 0.8 ? 2 : 3;
  const len = Math.min(want, src.objectives.length - from);
  const threat = 1 + r.int(5);
  const tr = r();
  const twist = tr < 0.55 ? null : tr < 0.72 ? 'veterans' : tr < 0.88 ? 'swarm' : 'glass';
  const objectives = clone(src.objectives.slice(from, from + len)).map(o => {
    rerollObjective(o, r, threat, twist === 'swarm');
    o.say = r.pick((KIND[o.kind] || KIND.hold).say);
    return o;
  });
  const lead = objectives[0], kinds = objectives.map(o => o.kind);
  const where = place(src);
  const def = {
    ...src,
    id: ARCADE_PREFIX + seed, arcade: true, seed, source: src.id, threat, twist, kinds,
    trial: false, campaignOnly: false, story: undefined, opening: undefined,
    title: r.pick((KIND[lead.kind] || KIND.hold).titles),
    place: where,
    blurb: kinds.map(kindName).join(' · ').toLowerCase(),
    level: { ...src.level, name: 'ARCADE — ' + where, sub: lead.task || '' },   // (per hero, like a mission's own sub)
    start: lead.start || src.start,
    kit: KIT_AT[threat - 1] + (twist === 'glass' ? 1 : 0),
    foeTier: FOE_TIER_AT[threat - 1] + (twist === 'veterans' ? 3 : 0),
    dmgMul: twist === 'glass' ? 1.33 : 1,
    voice: ARCADE_VOICE,
    objectives,
    done: r.pick(DONE),
  };
  cache.set(seed, def);
  return def;
}
// a story mission or an arcade contract, by id
export function missionById(id){
  if (MISSIONS[id]) return MISSIONS[id];
  if (isArcadeId(id)){ const s = parseInt(id.slice(ARCADE_PREFIX.length), 10); if (s > 0) return arcadeContract(s); }
  return null;
}
export const randomArcadeId = () => ARCADE_PREFIX + newSeed();

/* ---------- the board: the Missions page's ARCADE shelf ---------- */
export const BOARD_SIZE = 6;
// six contracts from one board seed, dealt so the board shows a spread of mission types (no kind leads more than twice)
// and no two contracts from the same stretch of the same mission
export function arcadeBoard(boardSeed){
  const r = dice(boardSeed), out = [], lead = {}, seen = new Set();
  for (let tries = 0; out.length < BOARD_SIZE && tries < 60; tries++){
    const s = (r() * 0x7fffffff) >>> 0 || 1, c = arcadeContract(s);
    if (!c) break;
    const k = c.kinds[0], key = c.source + ':' + c.objectives[0].title;
    if ((lead[k] || 0) >= 2 || seen.has(key)) continue;
    lead[k] = (lead[k] || 0) + 1; seen.add(key); out.push(c);
  }
  return out;
}

/* ---------- how many this hero has won (the page's tally and the menu tile) ---------- */
export function arcadeWins(hero){ try { return parseInt(localStorage.getItem('sw_arcade_won_' + hero) || '0', 10) || 0; } catch(e){ return 0; } }
export function noteArcadeWin(hero){ try { localStorage.setItem('sw_arcade_won_' + hero, String(arcadeWins(hero) + 1)); } catch(e){} }
