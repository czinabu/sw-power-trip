// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SANDBOX'S UNLOCKS: the sandbox opens once Act I of the campaign is cleared (with either hero), and offers only
// what the story has shown so far: the foes met, the powers and forms the run could have earned, the worlds visited.
// Beating the campaign with either hero opens everything. Nothing here is a list to keep in sync by hand: it is all
// read from the chapters (data/campaign.js), their levels and missions, and the progression tables (data/store.js).
//
// Progress is the set of chapter ids cleared, per hero (localStorage sw_camp_ch_<hero>, kept by the save slots like
// the other sw_camp_ keys). The sandbox offers what either hero has reached.

import { G, isGunner } from '../state.js';
import { CHAPTERS as ALL_CHAPTERS, chapterOrder, chapterNo } from '../data/campaign.js';
import { LEVELS } from '../data/levels.js';
import { MISSIONS } from '../data/missions.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { BATTLE_MAPS } from '../data/battlemaps.js';
import { FORMS, STARTING_FORMS } from '../data/forms.js';
import { JEDI_AUTO, MANDO_AUTO, JEDI_STORE, MANDO_STORE } from '../data/store.js';
import { STORE_TIER_STAGE } from './progression.js';

const HEROES = ['jedi', 'mando'];
const CHAPTERS = ALL_CHAPTERS.filter(c => !c.prologue);   // the story every hero shares (the ARC trooper's prologue isn't a gate)
const key = (hero) => 'sw_camp_ch_' + hero;
function read(hero){
  try { const v = JSON.parse(localStorage.getItem(key(hero))); if (Array.isArray(v)) return v; } catch(e){}
  return [];
}
// the campaign beaten with either hero (game/summary.js victory) opens everything
export function sandboxFull(){
  try { return HEROES.some(h => localStorage.getItem('sw_camp_' + h) === '1'); } catch(e){ return false; }
}
// every chapter id either hero has cleared
function cleared(){ return new Set(HEROES.flatMap(read)); }
const actOneDone = (done) => CHAPTERS.filter(c => c.act === 0).every(c => done.has(c.id));
export function sandboxUnlocked(){ return sandboxFull() || actOneDone(cleared()); }
// for the menu's card: how far the story is that the sandbox follows
export function sandboxProgress(){ const done = cleared(); return { n: CHAPTERS.filter(c => done.has(c.id)).length, of: CHAPTERS.length }; }

// game/campaign.js: chapter `pos` of this run is starting, so every chapter before it is cleared (onlyLast: just the one
// before it, for a co-op guest who joined partway and only played on from there). True when this opened the sandbox.
export function recordChapters(pos, onlyLast){
  if (!(pos > 0)) return false;
  const was = sandboxUnlocked();
  const list = chapterOrder(G.actTwo).slice(onlyLast ? pos - 1 : 0, pos).map(c => c.id);
  const have = read(G.hero), add = list.filter(id => !have.includes(id));
  if (add.length){ try { localStorage.setItem(key(G.hero), JSON.stringify([...have, ...add])); } catch(e){} }
  return !was && sandboxUnlocked();
}

// the Missions list keeps a mission locked (and unspoiled) until a hero has cleared it in the campaign: its chapter is
// in the cleared set, or either hero has won it (the campaign marks that, game/mission.js), or the campaign is beaten
// the chapter that opens a mission on the Missions list: the one that plays it, or one that plays its story version (`opens`)
const playsMission = (c, id) => c.mission === id || (c.opens || []).includes(id);
export function missionUnlocked(id){
  const m = MISSIONS[id]; if (!m) return false;
  if (sandboxFull()) return true;
  const done = cleared(), ch = CHAPTERS.find(c => playsMission(c, id));
  return (!!ch && done.has(ch.id)) || HEROES.some(h => { try { return localStorage.getItem('sw_mission_' + id + '_' + h) === '1'; } catch(e){ return false; } });
}
// 'CHAPTER 3' for the card of a locked mission: where the campaign reaches it ('' when no chapter does)
export function missionChapterNo(id){
  const i = chapterOrder(G.actTwo).findIndex(c => playsMission(c, id));
  return i < 0 ? '' : chapterNo(i);
}

/* ---------- what the story so far has shown ---------- */
// a mission's foes: every { type: count } group anywhere in its objectives (pulses, guards, ambushes…), and every
// named fighter's `foe` (duels, trials, the quarry, per-hero overrides)
const isFoe = (k) => !!ENEMY_TYPES[k] || k === 'warbringer';
function missionFoes(m, out, depth = 0){
  if (!m || typeof m !== 'object' || depth > 8) return;
  if (Array.isArray(m)){ for (const v of m) missionFoes(v, out, depth + 1); return; }
  const ks = Object.keys(m);
  if (ks.length && ks.every(k => isFoe(k) && typeof m[k] === 'number')){ ks.forEach(k => out.add(k)); return; }
  for (const k of ks){
    if (k === 'foe' && typeof m[k] === 'string') out.add(m[k]);
    else if (k !== 'level') missionFoes(m[k], out, depth + 1);
  }
}

let scope = null;
// work out what's open from the chapters cleared; game/sandbox.js calls this as the sandbox starts
export function refreshSandboxScope(){
  const full = sandboxFull(), done = cleared();
  const list = CHAPTERS.filter(c => done.has(c.id));
  const foes = new Set(), maps = new Set(['room']);
  let depth = 0;   // the run's waveTotal by the end of these chapters: a wave apiece, a mission counts one
  const reachedWaves = [];   // [level, last wave index] of each wave chapter, for the Jedi's level/wave gates
  for (const c of list){
    if (c.kind === 'waves'){
      const L = LEVELS[c.level]; if (!L) continue;
      const [from, to] = c.waves || [0, L.waves.length];
      for (const w of L.waves.slice(from, to)) for (const t in w) foes.add(t);
      if (L.boss && to >= L.waves.length) foes.add('boss');
      depth += to - from;
      reachedWaves.push([c.level, to - 1]);
    } else {
      const m = MISSIONS[c.mission]; if (!m) continue;
      missionFoes(m.objectives, foes);
      for (const id in BATTLE_MAPS) if (m.level && m.level.layout === BATTLE_MAPS[id].level.layout) maps.add(id);
      depth += c.steps || 1;
      if (c.level != null && c.waves) reachedWaves.push([c.level, c.waves[1] - 1]);   // a mission standing in for a level's waves
    }
  }
  const autoReached = (u) => u.chapter ? done.has(u.chapter)   // a form or a power: the chapter that hands it out (data/forms.js FORM_PATH, data/store.js)
    : u.level != null && !isGunner()
    ? reachedWaves.some(([lv, w]) => lv > u.level || (lv === u.level && w >= u.wave))   // the campaign gates the Jedi's by level and wave (game/flow.js)
    : depth >= (u.stage || 0);
  const storeReached = (n) => n.chapter ? done.has(n.chapter) : depth >= (n.stage != null ? n.stage : (STORE_TIER_STAGE[n.tier] || 0));
  scope = { full, foes, maps, autoReached, storeReached };
  return scope;
}
const S = () => scope || refreshSandboxScope();
export const sandboxIsFull = () => S().full;

// FOES: a regular type, the Warbringer, or 'boss' (the end-boss)
export const foeOffered = (id) => S().full || S().foes.has(id);
export const mapOffered = (id) => S().full || S().maps.has(id);

// POWERS: a kit row (data/sandbox.js) names where the campaign hands it out with `from` (an auto-unlock key or a store
// id; its own id by default), or `tiers` (auto keys, lowest first). A row with no match anywhere stays open.
function source(id){
  const hero = isGunner() ? 'mando' : 'jedi';
  const a = (hero === 'mando' ? MANDO_AUTO : JEDI_AUTO).find(u => u.key === id);
  if (a) return { reached: () => S().autoReached(a) };
  const s = (hero === 'mando' ? MANDO_STORE : JEDI_STORE).find(n => n.id === id);
  if (s) return { reached: () => S().storeReached(s) };
  return null;
}
const reached = (id) => { const s = source(id); return !s || s.reached(); };
// how many of a tiered row's tiers the story has reached (all of them once the campaign is beaten)
export function kitTier(r){
  if (!r.tiers) return 1;
  return S().full ? r.tiers.length : r.tiers.filter(reached).length;
}
export function kitOffered(r){
  if (S().full) return true;
  if (r.tiers) return kitTier(r) > 0;
  return reached(r.from || r.id);
}

// FORMS: the Jedi's starting form (Shii-Cho) is always there; a form the campaign hands out (an auto-unlock under the form's id)
// is there once the story reaches it; a ready form the campaign doesn't hand out yet stays open, so it can be tried
// until it has its place in the story
export function formOffered(id){
  if (!FORMS[id] || !FORMS[id].ready) return false;
  if (S().full || STARTING_FORMS.includes(id)) return true;
  const u = JEDI_AUTO.find(a => a.key === id);
  return !u || S().autoReached(u);
}

// TRAINING (game/tutorial.js): has the story reached this form, power or piece of gear yet, for the hero picked? A form
// goes by formOffered; anything else by where the campaign hands it out (an auto-unlock key or a store id)
export function storyReached(id){
  if (FORMS[id]) return formOffered(id);
  return S().full || reached(id);
}
