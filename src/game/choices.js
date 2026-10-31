// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY CHOICES: the campaign's decisions that carry forward (save the Ledger or burn it, spare Ilsa or strike her down…).
// A story lists its choices (data/campaign-jedi.js JEDI_CHOICES), each asked on a card after a chapter is cleared, or
// after the last boss (`after: 'end'`). The answers live in G.story ({ choice id: answer key }), saved with the run
// (game/saves.js) and sent to a co-op guest with the host's run (net/foes.js), so both screens tell the same story.
//
// Words that change with a choice are written `{ by: <choice id>, <answer>: …, else: … }` anywhere a line, a list of
// lines or a title goes; storyWords resolves them. `actTwo` (Act II's pick: lothal / hoth) counts as a choice too.

import { G } from '../state.js';
import { JEDI_CHOICES } from '../data/campaign-jedi.js';

const CHOICES = { jedi: JEDI_CHOICES };

// the answer to a choice so far: before it's made (or on a save from before it was asked), the choice's `default`
const CHOICE = {};
for (const s in CHOICES) for (const c of CHOICES[s]) CHOICE[c.id] = c;
export const answered = (id) => !!(G.story && G.story[id]);
export function answer(id){
  if (id === 'actTwo') return G.actTwo || 'lothal';   // (Lothal first until the pick is made, as the chapters run)
  return (G.story && G.story[id]) || (CHOICE[id] && CHOICE[id].default) || null;
}
export function choose(id, key){ G.story = { ...(G.story || {}), [id]: key }; }
export const resetStory = () => { G.story = {}; };

// words with the run's choices filled in, all the way down: `{ by }` picks its answer's entry (or `else`), lists drop
// what resolves to nothing (but keep their places when `keep`: a list indexed by wave or objective)
export function storyWords(v, keep = false){
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)){ const out = v.map(x => storyWords(x)); return keep ? out : out.filter(x => x != null); }
  if (v.by){ const a = answer(v.by); return storyWords(a != null && a in v ? v[a] : v.else, keep); }
  const out = {};
  for (const k in v) out[k] = storyWords(v[k], k === 'wave' || k === 'says');
  return out;
}

// the choice a story asks after this chapter (or 'end'), if it hasn't been answered yet
export function choiceAfter(story, after){
  return (CHOICES[story] || []).find(c => c.after === after && !answered(c.id)) || null;
}
// every choice a story has, answered or not (the epilogue's recap)
export const storyChoices = (story) => CHOICES[story] || [];
