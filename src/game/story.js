// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE STORY AS IT HAPPENS: the voice in your ear during a chapter (the comms strip), and the story's beats, named so
// anything else can hang off them (a cutscene, a sting).
//
// A BEAT is a moment in a chapter: 'chapter' (its card closed, the fight starts) · 'wave' (info.n, counted from 0 within
// the chapter) · 'boss' · 'clear' · 'inquisitor' (the refuge duel's foe steps in) · 'escape' (it breaks off) · 'epilogue'.
// storyBeat plays the chapter's lines for the beat (data/campaign.js `lines`), then tells whoever listens (onStory).

import { G, heroKey } from '../state.js';
import { VOICE, forHero } from '../data/campaign.js';
import { hooks } from '../net/run.js';
import { chapterAt } from './campaign.js';

const box = document.getElementById('comms');
const who = box.querySelector('.cm-who'), say = box.querySelector('.cm-say'), tutor = document.getElementById('tutor');
const queue = [];
let cur = null, left = 0;

// a line is a string (the hero's voice: the Battlemaster, the Armorer) or { who, say } (anyone else)
const speaker = (l) => typeof l === 'string' ? heroKey(VOICE) : l.who;
const words = (l) => typeof l === 'string' ? l : l.say;
const holdFor = (text) => 2.4 + text.length * 0.05;

// queue lines on the strip. Co-op: the host's lines go over to the guest too (its own beats stay quiet: game/flow.js
// doesn't run there), so both screens hear the same thing
export function comms(lines, opts = {}){
  if (!lines) return;
  lines = Array.isArray(lines) ? lines : [lines];
  if (!lines.length) return;
  if (opts.now){ queue.length = 0; cur = null; left = 0; }
  for (const l of lines) queue.push({ who: speaker(l), say: words(l), rival: typeof l === 'object' && !!l.rival });
  if (hooks.comms && !opts.remote) hooks.comms(queue.slice(-lines.length), !!opts.now);
}
// from the host, already worked out (net/foefire.js)
export function remoteComms(list, now){
  if (now){ queue.length = 0; cur = null; left = 0; }
  queue.push(...list);
}
export function clearComms(){ queue.length = 0; cur = null; left = 0; box.classList.remove('on'); }

// runs on the sim's time (held while paused or on the upgrade screen: main.js)
export function updateComms(dt){
  if (G.mode !== 'play'){ if (cur || queue.length) clearComms(); return; }
  if (cur && (left -= dt) > 0) return;
  if (cur){ cur = null; box.classList.remove('on'); left = 0.35; return; }   // a breath between lines
  if (left > 0){ left -= dt; return; }
  if (!queue.length) return;
  cur = queue.shift();
  who.textContent = cur.who; say.textContent = cur.say;
  box.classList.toggle('rival', cur.rival);
  // a mission's briefing panel low on the screen: sit just above it rather than on top of it
  const r = tutor.classList.contains('on') && tutor.getBoundingClientRect();
  box.style.bottom = r && r.bottom > innerHeight * 0.5 ? (innerHeight - r.top + 10) + 'px' : '';
  box.classList.add('on');
  left = holdFor(cur.say);
}
export const commsBusy = () => !!cur || queue.length > 0;

/* ---------- beats ---------- */
const CUT_IN = new Set(['duel', 'escape', 'boss']);   // these speak over whatever's still queued: they're about what's in front of you
const listeners = {};
export function onStory(beat, fn){ (listeners[beat] = listeners[beat] || []).push(fn); }
export function storyBeat(beat, info = {}){
  if (G.chapter < 0) return;
  const c = chapterAt(G.chapter);
  if (!c) return;
  info = { ...info, chapter: c.id, pos: G.chapter, hero: G.hero };
  if (!G.coopGuest && !info.quiet) comms(linesFor(c, beat, info), { now: CUT_IN.has(beat) });
  for (const fn of listeners[beat] || []) fn(info);
}
// a chapter's lines for a beat: `lines.wave` is one entry per wave of the chapter, the rest one entry per beat
function linesFor(c, beat, info){
  const L = c.lines && c.lines[beat];
  if (!L) return null;
  return forHero(beat === 'wave' ? L[info.n] : L, G.hero) || null;
}
