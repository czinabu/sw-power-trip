// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CAMPAIGN: three acts of chapters (data/campaign.js), one run carried from the first to the last. A chapter is a
// stretch of a wave level (game/flow.js) or a story mission played with the run's build (game/mission.js). Each opens on
// a chapter card: where you are in the story, the voice's briefing and the act's chapters so far. Between Act I and
// Act II the card asks which pair of chapters comes first.

import { autosave } from './autosave.js';
import { G, shared } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { LEVELS } from '../data/levels.js';
import { ACT_TWO, actTwoAt, CHAPTER_OF_LEVEL, chapterOrder, chapterNo, forHero, storyVoice, actTitle, actOpen, actTwoLine, actTwoLabel, epilogueText, storyHero } from '../data/campaign.js';
import { startLevel, checkUnlocks, chapterRewards, releaseUnlockBanners } from './flow.js';
import { startMission } from './mission.js';
import { openSkillTree } from '../ui/store-ui.js';
import { earnWavePoint } from './upgrades.js';
import { showBanner } from '../ui/banners.js';
import { storyBeat, clearComms } from './story.js';
import { playOpening, resetScenes, playScene } from './cutscene.js';
import { recordChapters } from './sandbox-unlocks.js';
import { choiceAfter, choose, resetStory, storyChoices, answer, storyWords } from './choices.js';
import { JEDI_ACT_TWO_WARN, JEDI_EPILOGUE_SCENE } from '../data/campaign-jedi.js';

const ROMAN = ['I', 'II', 'III'];
export const chapters = () => chapterOrder(G.actTwo);
export const chapterAt = (pos) => chapters()[pos];
export const inChapters = () => G.chapter >= 0;
export const chapterTitle = (c) => forHero(c.title, G.hero);
// 'CHAPTER 3 · THE LAST EVACUATION', for the pause screen, the save slots and the menu's CONTINUE line
export function chapterLabel(pos = G.chapter){
  const c = chapterAt(pos);
  return c ? chapterNo(pos) + ' · ' + chapterTitle(c) : '';
}

/* ---------- starting and moving through the run ---------- */
// BEGIN CAMPAIGN: a fresh build on chapter 1
export function startCampaign(){
  G.actTwo = null; G.storyHero = null;   // (the story is this hero's own: data/campaign.js storyHero; the ARC trooper's opens on its prologue)
  resetStory();   // (and nothing in it has been chosen yet: game/choices.js)
  G.levelIdx = 0; G.waveTotal = -1;   // (as a fresh build starts: a prologue's checkpoint is taken before its build resets)
  startChapter(0, { fresh: true });
}
// opts: fresh (a brand-new run: reset the build) · retry (after a death, or a loaded save: back to the chapter's
// checkpoint, no card unless opts.card) · guest (co-op: follow the host's chapter, the host runs it)
export function startChapter(pos, opts = {}){
  const c = chapterAt(pos);
  if (!c) return;
  G.chapter = pos; G.chapterClosed = null;   // (set again when it closes: game/flow.js chapterClosed)
  if (!opts.guest) recordChapters(pos);   // the sandbox follows the story (a co-op guest's is followChapter's)
  const title = chapterTitle(c), no = chapterNo(pos), name = no + ' — ' + title, sub = 'ACT ' + ROMAN[c.act] + ' · ' + c.world;
  if (opts.retry && G.checkpoint && G.checkpoint.ch === pos) G.waveTotal = G.checkpoint.waveTotal;
  if (c.kind === 'waves'){
    startLevel(c.level, { level: { ...LEVELS[c.level], ...c.arena, name, sub }, waves: c.waves, resume: !opts.fresh, retry: opts.retry, chapter: true });
  } else {
    if (!opts.retry){ G.checkpoint = { idx: G.levelIdx, ch: pos, waveTotal: G.waveTotal, boss: false }; autosave('chapter'); }
    startMission(c.mission, 0, !!opts.guest, { retry: !!opts.retry, chapter: { name, sub, arena: c.arena, fresh: !!opts.fresh, guests: c.guests, evacuees: c.evacuees, kicker: no + ' · ' + title, clear: (c.lines && forHero(c.lines.clear, G.hero)) || null, done: chapterCleared } });
  }
  if (opts.guest){ G.coopGuest = true; G.coopWasGuest = true; G.coopJoin = false; shared.levelPhase = G.mission ? 'mission' : 'between'; shared.phaseT = 0; }
  if (!opts.retry || opts.card) showCard(pos);
}
// after a death: the chapter again from its checkpoint (a wave chapter from its first wave, or the boss)
export function retryChapter(){ startChapter(G.chapter, { retry: true }); }
// a loaded save: back on its chapter, with the card to say where the story was. A save from before the chapters
// (it knew only the level) picks up on the chapter that opens that level.
export function resumeChapter(run){
  G.actTwo = run.actTwo || null; G.storyHero = null;
  const pos = run.chapter != null && run.chapter >= 0 ? run.chapter : CHAPTER_OF_LEVEL[run.idx] || 0;
  if (G.checkpoint && !(G.checkpoint.ch >= 0)) G.checkpoint.ch = pos;
  startChapter(pos, { retry: true, card: true });
}
// co-op: a guest joins the host's campaign on its chapter, with the kit that far into a run earns
export function joinCampaign(pos, actTwo, wave, waveTotal){
  startLevel(0);   // a full fresh setup (kit, build, stats)
  G.waveTotal = waveTotal; G.actTwo = actTwo || null;   // (the host's run: its order of chapters; G.storyHero is set with it, net/foes.js)
  startChapter(pos, { guest: true });
  if (!G.mission) G.wave = wave;
  checkUnlocks();
}
// co-op guest: the host moved on to another chapter
export function followChapter(pos, actTwo){
  G.actTwo = actTwo || null;
  recordChapters(pos, true);   // the chapter played alongside the host
  startChapter(pos, { guest: true });
  showBanner('', 'THE HOST MOVES ON', 1.6);
}

// a mission chapter's last objective fell (a wave chapter's last wave is game/flow.js's): the clear's XP and second
// wind, the upgrade screen, then the next chapter. A co-op guest waits for the host to move the run on.
function chapterCleared(){
  const c = chapterAt(G.chapter);
  G.waveTotal += c?.steps ?? 1;   // a mission counts as a step deeper into the run (foes, store tiers and the Mando's gear follow it); `steps` when it stands for a level's waves
  // a mission standing in for a level's waves (Mustafar): the run is as far into that level as its waves would have taken it
  if (c && c.level != null && c.waves){ G.levelIdx = c.level; G.wave = c.waves[1]; checkUnlocks(1600); }
  G.chapterClosed = G.chapter;   // its closing page offers the powers it hands out (game/flow.js chapterClosed)
  chapterRewards();
  earnWavePoint();   // a mission chapter's skill point (game/upgrades.js), spent on the page that opens next
  storyBeat('clear', { quiet: !!G.mission });   // a mission's clear lines are already on its Chapter complete card (game/mission.js)
  if (G.coopGuest){ openSkillTree(); return; }
  shared.levelPhase = 'chapterdone'; shared.phaseT = 2.6;   // the voice's last word, then the upgrade screen and the road on (game/flow.js)
}
// the 'travel' beat ran out (game/flow.js): the next chapter, or Act II's pick when it's due
export function nextChapter(){
  const pos = G.chapter + 1;
  if (!chapterAt(pos)) return;
  // a story's choice that follows the chapter just cleared comes first (game/choices.js); the host makes it in co-op
  const done = chapterAt(G.chapter), choice = !G.coopGuest && done && choiceAfter(done.story, done.id);
  if (choice) return void showChoice(choice, nextChapter);
  if (pos === actTwoAt() && !G.actTwo) return void showPick(pos, recordChapters(pos));
  startChapter(pos);
}

/* ---------- the chapter card ---------- */
const card = document.getElementById('chapcard');
let onGo = null;
export const cardUp = () => card.classList.contains('open');
function openCard(html, go){
  card.innerHTML = html;
  card.classList.add('open');
  G.skillSelect = true;   // freezes the sim and keeps the pause screen away while the cursor is free (see ui/menus.js)
  G.cardUp = true;
  onGo = go;
  document.getElementById('banner').style.opacity = '0';
  document.exitPointerLock();
  for (const b of card.querySelectorAll('[data-go]')) b.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); if (onGo) onGo(b.dataset.go); });
}
// shut the card (also the main menu's way out: quiet skips the pointer lock and the held banners)
export function closeCard(quiet){
  if (!cardUp()) return;
  card.classList.remove('open');
  G.cardUp = false; onGo = null;
  if (G.skillSelect && !document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
  releaseUnlockBanners();
}
const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
// the act's chapters: ticked, the one you're on, and what's ahead
function roster(act, pos){
  return '<ol class="cc-roster">' + chapters().map((c, i) => c.act !== act ? '' :
    '<li class="' + (i < pos ? 'done' : i === pos ? 'now' : '') + '"><span class="n">' + (c.prologue ? '·' : chapterNo(i).replace('CHAPTER ', '')) + '</span>' + esc(chapterTitle(c)) +
    (c.trial ? '<span class="tag">TRIAL</span>' : c.prologue ? '<span class="tag">PROLOGUE</span>' : '') + '<span class="w">' + esc(c.world) + '</span></li>').join('') + '</ol>';
}
function head(c, pos){
  return '<div class="cc-act">ACT ' + ROMAN[c.act] + ' · ' + esc(actTitle(c.act)) + '</div>' +
    '<div class="cc-num">' + chapterNo(pos) + (c.trial ? ' · TRIAL' : '') + '</div>' +
    '<h1 class="cc-title">' + esc(chapterTitle(c)) + '</h1><div class="cc-world">' + esc(c.world) + '</div>';
}
function voice(lines, who){
  return '<div class="cc-voice"><div class="cc-who">' + esc(who || storyVoice(undefined, chapterAt(G.chapter))) + '</div>' + lines.map(l => '<p>' + esc(l) + '</p>').join('') + '</div>';
}
// the scene between chapters (a story's own chapter `talk`): where it happens, then who says what, line by line
function talk(t){
  if (!t || !t.lines || !t.lines.length) return '';
  return '<div class="cc-talk">' + (t.where ? '<div class="cc-where">' + esc(t.where) + '</div>' : '') +
    t.lines.map(([who, say], i) => '<p style="--i:' + i + '"' + (who === 'YOU' ? ' class="you"' : '') + '><b>' + esc(who) + '</b>' + esc(say) + '</p>').join('') + '</div>';
}
export function showCard(pos){
  const c = chapterAt(pos), list = chapters();
  const opensAct = !c.prologue && (pos === 0 || list[pos - 1].act !== c.act || list[pos - 1].prologue);   // (a prologue is before the act: its opening line waits for chapter 1)
  const lines = [...(opensAct && pos !== actTwoAt() ? [actOpen(c.act)] : []), ...forHero(c.brief, G.hero)];   // (Act II's opening line was on its pick)
  openCard('<div class="cc-inner hero-' + G.hero + '">' + head(c, pos) + talk(c.talk) + voice(lines) + roster(c.act, pos) +
    '<div class="cc-btns"><div class="btn primary go" data-go="1">' + (G.coopGuest ? 'READY' : 'BEGIN') + '</div></div>' +
    '<div class="cc-hint">Enter or click to begin</div></div>', () => {
      closeCard(); S.reward(1);
      playOpening(c.id, { k: c.prologue ? 'PROLOGUE' : chapterNo(pos) + ' · ACT ' + ROMAN[c.act], h: chapterTitle(c), p: c.world }, c.opening);   // the chapter's opening scene (game/cutscene.js)
      storyBeat('chapter');
    });
  resetScenes();   // a new visit to the chapter: its scenes play again
  MUSIC.unlockSting();
}
// sandboxOpened: clearing Act I just opened the sandbox, so the card says so
function showPick(pos, sandboxOpened){
  const c = chapterAt(pos);
  openCard('<div class="cc-inner hero-' + G.hero + '">' +
    '<div class="cc-act">ACT ' + ROMAN[c.act] + '</div><h1 class="cc-title">' + esc(actTitle(c.act)) + '</h1>' +
    voice([actOpen(c.act), ...(storyHero() === 'jedi' ? [JEDI_ACT_TWO_WARN] : []), 'Which first is yours to choose.']) +
    (sandboxOpened ? '<div class="cc-unlock">★ SANDBOX UNLOCKED · try the foes and powers you have met so far, from the main menu</div>' : '') +
    '<div class="cc-pick">' + Object.keys(ACT_TWO).map(k => '<div class="cc-opt brk" data-go="' + k + '"><b>' + esc(actTwoLabel(k)) + '</b><span>' + esc(actTwoLine(k)) + '</span></div>').join('') + '</div>' +
    '</div>', (k) => { if (!ACT_TWO[k]) return; G.actTwo = k; S.reward(1); startChapter(pos); });
  MUSIC.unlockSting();
}
// A STORY'S CHOICE (game/choices.js): the question, who asks it and the two answers. A click picks (no Enter: it has to
// be meant). then: what follows once it's made (the next chapter, or the epilogue)
function showChoice(ch, then){
  const c = chapterAt(G.chapter);
  openCard('<div class="cc-inner cc-choice hero-' + G.hero + '">' +
    '<div class="cc-act">ACT ' + ROMAN[c ? c.act : 2] + ' · A CHOICE</div><h1 class="cc-title">' + esc(ch.title) + '</h1>' +
    voice(storyWords(ch.lines), ch.who) +
    '<div class="cc-pick">' + ch.options.map(o => '<div class="cc-opt brk" data-go="' + o.key + '"><b>' + esc(o.label) + '</b><span>' + esc(o.line) + '</span></div>').join('') + '</div>' +
    '<div class="cc-hint">This choice stays with you for the rest of the story</div>' +
    '</div>', (k) => {
      if (!ch.options.some(o => o.key === k)) return;
      choose(ch.id, k); S.reward(1); closeCard(true); autosave('choice'); then();
    });
  MUSIC.unlockSting();
}
// the epilogue's line under its number: what this run chose (LEDGER SAVED · ILSA SPARED…)
function choicesRecap(){
  const list = storyChoices(storyHero()).filter(ch => ch.options.length);
  return list.map(ch => { const o = ch.options.find(o => o.key === answer(ch.id)); return o ? o.label : ''; }).filter(Boolean).join(' · ');
}
// THE END: the last chapter's boss is down. The epilogue's card, then the victory screen (game/summary.js victory)
export function campaignWon(then){
  storyBeat('epilogue');
  clearComms();
  G.slowmo = 1; G.slowmoT = 0;
  const card = () => { if (G.mode === 'play') showEpilogue(then); else then(); };
  const own = storyHero() === 'jedi' ? { lines: () => storyWords(JEDI_EPILOGUE_SCENE) } : null;
  // a last look at the hero (game/cutscene.js), then the card. Each screen plays its own in co-op (both get here). A story's
  // last choice (the Jedi's: what becomes of Vexis) comes first; a co-op guest takes the host's
  const scene = () => { if (G.mode !== 'play' || !playScene('epilogue', { onDone: card, share: false, lines: own && own.lines() })) card(); };
  const last = !G.coopGuest && choiceAfter(storyHero(), 'end');
  setTimeout(() => { if (last && G.mode === 'play') showChoice(last, scene); else scene(); }, 1200);
}
function showEpilogue(then){
  openCard('<div class="cc-inner hero-' + G.hero + '">' +
    '<div class="cc-act">EPILOGUE</div><div class="cc-num">' + chapters().filter(c => !c.prologue).length + ' CHAPTERS · ' + (G.actTwo === 'hoth' ? 'HOTH' : 'LOTHAL') + ' FIRST' +
    (choicesRecap() ? ' · ' + esc(choicesRecap()) : '') + '</div>' +
    '<h1 class="cc-title">' + esc(epilogueText('title')) + '</h1><div class="cc-world">' + esc(epilogueText('world')) + '</div>' +
    voice(epilogueText('lines')) +
    '<div class="cc-acts">' + ['ACT I', 'ACT II', 'ACT III'].map((a, k) => '<div class="cc-done"><b>' + a + '</b> ' + esc(actTitle(k)) + '</div>').join('') + '</div>' +
    '<div class="cc-btns"><div class="btn primary go" data-go="1">CONTINUE</div></div>' +
    '<div class="cc-hint">Enter or click to continue</div></div>', () => { closeCard(true); then(); });
  MUSIC.unlockSting();
}

// Enter (or Space) takes the card's one button; the pick needs a click
window.addEventListener('keydown', (e) => {
  if (!cardUp() || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
  if (!card.querySelector('.go')) return;
  e.preventDefault(); e.stopPropagation();
  if (onGo) onGo('1');
}, true);
