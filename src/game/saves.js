// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SAVE SLOTS: three local slots, each a snapshot of the player's progress, plus the campaign run when saved mid-campaign.

import { G, player } from '../state.js';
import { LEVELS } from '../data/levels.js';
import { MISSIONS } from '../data/missions.js';
import { switchStance } from '../player/jedi/stance.js';
import { resumeChapter, chapterLabel } from './campaign.js';
import { chapterOrder, forHero, CHAPTER_OF_LEVEL } from '../data/campaign.js';
import { DEFAULT_LOADOUT, cleanLoadout, migrateForm } from '../data/forms.js';
import { clearMeditation } from './meditation.js';
import { MANDO_WEAPONS, RUN_KIT, cleanKit } from '../data/mando.js';

/* PROGRESS lives in localStorage keys spread across the game (campaign/mission/training wins, bests, the customizer's
   look, the sandbox's picks). A slot copies those keys, so loading one puts every mode's locks and ticks back exactly.
   Settings (volume, sensitivity, FOV, graphics, fullscreen) are the player's, not the save's, and stay as they are. */
export const SLOTS = 3;
export const AUTO = 'auto';   // the autosave's own slot (game/autosave.js): shown beside the three, loadable but never saved to by hand
const slotKey = (i) => 'sw_save_' + i;
const PROGRESS = /^sw_(camp_|trained_|lesson_|best_|sandbox_|mission_.+_(jedi|mando)$)|^sw_(asktrain|look)$/;
// what NEW GAME clears: everything above but the hero's look and the sandbox's map/kit picks
const FRESH_KEEP = /^sw_(look|sandbox_)/;

function progressKeys(){
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (PROGRESS.test(k)) out.push(k); } } catch(e){}
  return out;
}
const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));

/* THE CAMPAIGN RUN — the build carried from chapter to chapter. A loaded run restarts the saved chapter from its
   checkpoint (the same way a retry after a death does), with every upgrade, boon and unlock it had. */
export function inCampaignRun(){ return G.mode === 'play' && (G.chapter >= 0 || (!G.endless && !G.training && !G.mission && !G.sandbox)); }
function snapshotRun(){
  return {
    idx: G.levelIdx, chapter: G.chapter, actTwo: G.actTwo, checkpoint: clone(G.checkpoint), stance: G.stance, loadout: [...G.loadout], mandoKit: { ...(G.mandoKit || RUN_KIT) }, weapon: player.weapon,
    unlocked: clone(G.unlocked), stanceUnlocked: clone(G.stanceUnlocked), formFork: G.formFork || null, mandoChoiceShown: G.mandoChoiceShown,
    xp: G.xp, xpEarned: G.xpEarned, skillPoints: G.skillPoints, skillSpent: G.skillSpent,
    powerLv: clone(G.powerLv), mastery: clone(G.mastery), masteryUse: clone(G.masteryUse), xpPoints: G.xpPoints, seenTypes: clone(G.seenTypes),
    up: clone(player.up), phoenixReady: !!player.phoenixReady, boon: clone(player.boon), boons: clone(player.boons), skills: clone(player.skills),
    stats: G.stats ? { ...clone({ ...G.stats, summary: null }), elapsed: G.gt - (G.stats.startGt || 0) } : null,
  };
}
// the run as it stands, shaped like a loaded save's (G.resumeRun): the menu's CONTINUE CAMPAIGN picks it up
export const captureRun = () => ({ ...snapshotRun(), hero: G.hero });
// put a saved build back (called right before its chapter starts again, game/campaign.js resumeChapter; the saber form goes
// back after it, with switchStance)
export function restoreRun(run){
  G.levelIdx = run.idx; G.checkpoint = clone(run.checkpoint) || { idx: run.idx, waveTotal: -1, boss: false };
  G.waveTotal = G.checkpoint.waveTotal;
  player.weapon = run.weapon || (run.hero === 'trooper' ? 'rifle' : 'single');
  G.unlocked = clone(run.unlocked) || {}; G.stanceUnlocked = migrateUnlocked(run.stanceUnlocked);
  if ((run.loadout || []).includes('niman') || run.stance === 'niman') G.stanceUnlocked.niman = true;   // a run saved when every hero started on Niman keeps it
  G.loadout = cleanLoadout(run.loadout || DEFAULT_LOADOUT); G.mandoChoiceShown = !!run.mandoChoiceShown;
  // the Mando's guns: a save from before the loadouts carried both pistols, so it keeps whichever was in hand (the run
  // hands out the primaries again as it goes on: game/flow.js checkUnlocks)
  G.mandoKit = cleanKit(run.mandoKit || { sidearm: run.weapon === 'dual' ? 'dual' : 'single', primary: null });
  { const W = MANDO_WEAPONS[player.weapon]; if (W && W.slot && G.mandoKit[W.slot] !== player.weapon) player.weapon = G.mandoKit.sidearm; }
  G.formFork = run.formFork || null; clearMeditation();   // (forms the saved chapter has passed are taught again as it starts)
  G.xp = run.xp || 0; G.xpEarned = run.xpEarned || 0; G.skillPoints = run.skillPoints || 0; G.skillSpent = run.skillSpent || 0;
  G.powerLv = clone(run.powerLv) || {}; G.mastery = clone(run.mastery) || {}; G.seenTypes = clone(run.seenTypes) || {};
  G.masteryUse = clone(run.masteryUse) || {}; G.xpPoints = run.xpPoints;   // (undefined on an older save: game/upgrades.js starts counting from its XP)
  G.boonOffer = null; G.boonPicked = false;
  Object.assign(player.up, clone(run.up));
  player.boon = clone(run.boon) || {}; player.boons = clone(run.boons) || {}; player.skills = clone(run.skills) || {};
  player.momentumStacks = 0; player.momentumT = 0; player.phoenixReady = !!run.phoenixReady;
  player.focus = 0; player.focusHitT = 0; player._focusTier = 0;
  if (run.stats){ const { elapsed, ...st } = run.stats; G.stats = { ...st, startGt: G.gt - (elapsed || 0), summary: null }; }
}

// earned forms, keyed by form id (saves from before the forms had ids keyed them fast / strong)
function migrateUnlocked(su){
  const out = {};
  for (const k in su || {}) if (su[k]) out[migrateForm(k)] = true;
  return out;
}

// a loaded save's run waits on the menu (G.resumeRun) until BEGIN picks it up, as long as the same hero is picked
export function canResume(){ return !!(G.resumeRun && G.resumeRun.hero === G.hero); }   // (a declaration: menus.js can call it while modules are still loading)
export const resumeLabel = () => savedChapter(G.resumeRun, G.hero);
// 'ACT II · CH 6' for the saved run the menu would continue (the campaign tile)
export function resumeProgress(){
  const run = G.resumeRun; if (!run) return '';
  const pos = run.chapter != null && run.chapter >= 0 ? run.chapter : CHAPTER_OF_LEVEL[run.idx] || 0, c = chapterOrder(run.actTwo)[pos];
  return c ? 'ACT ' + ['I', 'II', 'III'][c.act] + ' · CH ' + (pos + 1) : '';
}
export const hasSaves = () => { for (const i of [0, 1, 2, AUTO]) if (readSlot(i)) return true; return false; };
export function resumeRun(){
  const run = G.resumeRun; G.resumeRun = null;
  restoreRun(run);
  resumeChapter(run);   // (a save from before the chapters picks up on the chapter that opens its level)
  switchStance(migrateForm(run.stance) || 'shiicho', true);
}
// 'CHAPTER 3 · THE LAST EVACUATION' for a saved run, without starting it
function savedChapter(run, hero){
  const pos = run.chapter != null && run.chapter >= 0 ? run.chapter : CHAPTER_OF_LEVEL[run.idx] || 0, c = chapterOrder(run.actTwo)[pos];
  return c ? 'CHAPTER ' + (pos + 1) + ' · ' + forHero(c.title, hero) : 'LEVEL ' + (run.idx + 1) + ' · ' + placeOf(LEVELS[run.idx]);
}

/* ---------- slots ---------- */
export function readSlot(i){
  try { const d = JSON.parse(localStorage.getItem(slotKey(i))); return d && d.v === 1 ? d : null; } catch(e){ return null; }
}
// opts.auto: the autosave. A co-op guest's run is the host's, so only its progress is kept; away from a campaign run (training,
// a mission, survival…) the slot keeps the campaign run it already had, unless opts.finished (the campaign was won) lets it go
export function writeSlot(i, opts = {}){
  const progress = {};
  try { for (const k of progressKeys()) progress[k] = localStorage.getItem(k); } catch(e){}
  let run, where = whereNow(), hero = G.hero;
  if (inCampaignRun()) run = G.coopGuest ? null : snapshotRun();
  else if (G.mode === 'menu' && canResume()) run = G.resumeRun;
  else run = null;
  if (opts.auto && !run && !opts.finished){ const prev = readSlot(i); if (prev && prev.run){ run = prev.run; where = prev.where; hero = prev.hero; } }
  const data = { v: 1, at: Date.now(), hero, diff: G.diff, modeSel: G.modeSel, missionId: G.missionId, progress, where, run };
  if (opts.auto) data.auto = true;
  try { localStorage.setItem(slotKey(i), JSON.stringify(data)); return true; } catch(e){ return false; }
}
export function deleteSlot(i){ try { localStorage.removeItem(slotKey(i)); } catch(e){} }
// swap the live progress for a slot's (the menu then refreshes its locks, picks and look: ui/saves-ui.js)
export function loadSlotProgress(data){
  try {
    for (const k of progressKeys()) localStorage.removeItem(k);
    for (const k in data.progress) if (PROGRESS.test(k)) localStorage.setItem(k, data.progress[k]);
  } catch(e){}
}
// NEW GAME: wipe the wins, bests and training ticks (the look and the saved slots stay)
export function clearProgress(){
  try { for (const k of progressKeys()) if (!FRESH_KEEP.test(k)) localStorage.removeItem(k); } catch(e){}
}

/* ---------- labels ---------- */
const placeOf = (L) => (L && L.name.split('—').map(t => t.trim())[1]) || '';
// where the player is right now, in a few words for the slot card
function whereNow(){
  if (inCampaignRun()) return 'CAMPAIGN · ' + (G.chapter >= 0 ? chapterLabel() : 'LEVEL ' + (G.levelIdx + 1) + ' · ' + placeOf(LEVELS[G.levelIdx]));
  if (G.mode === 'menu' && canResume()) return 'CAMPAIGN · ' + savedChapter(G.resumeRun, G.resumeRun.hero);
  if (G.mode === 'play' && G.mission) return 'MISSION · ' + forHero((MISSIONS[G.missionId] || {}).title || '', G.hero);
  if (G.mode === 'play' && G.endless) return 'SURVIVAL';
  if (G.mode === 'play' && G.training) return 'TRAINING';
  if (G.mode === 'play' && G.sandbox) return 'SANDBOX';
  return 'MAIN MENU';
}
// what the slot holds: wins across the campaign, missions and training
export function slotSummary(data){
  const p = data.progress || {}, on = (k) => p[k] === '1';
  const camp = ['jedi', 'mando'].filter(h => on('sw_camp_' + h)).length;
  const msn = Object.keys(p).filter(k => /^sw_mission_.+_(jedi|mando)$/.test(k) && p[k] === '1').length;
  const parts = [];
  if (camp) parts.push('Campaign won ×' + camp);
  if (msn) parts.push(msn + ' mission win' + (msn === 1 ? '' : 's'));
  if (on('sw_trained_jedi') || on('sw_trained_mando')) parts.push('trained');
  return parts.join(' · ') || (data.run ? 'First campaign under way' : 'Fresh start');
}
