// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MISSIONS PAGE'S SHELVES (ui/missions-ui.js): which story each mission belongs to, under which act, and how hard
// it is. Nothing here is a list of missions to keep in sync: a mission finds its shelf from the campaign chapter that
// plays it (data/campaign.js), so a new chapter's mission lands under its act on its own.
//
// A mission can also say where it goes, in data/missions.js:
//   story: 'mando-saga'   a story from STORIES below (its own shelf on the page, after the campaign)
//   act: 1                which of that story's acts it sits under (0 = the first)
//   order: 3              its place in that act (lower first; by default the order it was written in)
//   heroes: ['mando']     only these heroes see it (by default every hero does)
//   rank: 4               its threat, 1 to 5 (by default: how far into the campaign it comes)
// A mission no chapter plays and with no `story` lands under SIDE MISSIONS.
//
// Chapters read per hero: a chapter's `mission`, `opens` and `title` can be { jedi, mando, trooper } (a hero's own
// story overlay laid over the shared chapters), and the shelf follows the hero picked on the page.

import { ACTS, CHAPTERS, chapterOrder, forHero } from './campaign.js';
import { MISSIONS } from './missions.js';

// stories, in the order the page shows them. `heroes` (optional) limits who sees the story; `acts` are each act's name
// (a string, or { jedi, mando, trooper })
export const STORIES = [
  { id: 'campaign', title: 'THE CAMPAIGN', acts: ACTS.map(a => a.title) },   // the story every hero plays
  // a hero's own story goes here, e.g.
  // { id: 'mando-saga', title: 'THE MANDALORIAN\'S HUNT', heroes: ['mando'], acts: ['THE BOUNTY', 'THE COVERT'] },
  // { id: 'arc-chapters', title: 'THE ARC TROOPER', heroes: ['trooper'], acts: ['THE ORDER'] },
];
export const SIDE_STORY = { id: 'side', title: 'SIDE MISSIONS', acts: [''] };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

// the chapter that plays a mission for this hero (its own mission, or one its story version opens), and where it falls
const playsFor = (c, id, hero) => forHero(c.mission, hero) === id || (forHero(c.opens, hero) || []).includes(id);
export function missionChapter(id, hero){
  const order = chapterOrder(false), i = order.findIndex(c => playsFor(c, id, hero));
  return i < 0 ? null : { chapter: order[i], pos: i };
}
export const missionForHero = (m, hero) => !m.campaignOnly && (!m.heroes || m.heroes.includes(hero));

// where a mission sits: { story, act, pos }
export function missionShelf(m, hero){
  if (m.story) return { story: m.story, act: m.act || 0, pos: m.order ?? 0 };
  const at = missionChapter(m.id, hero);
  return at ? { story: 'campaign', act: at.chapter.act || 0, pos: at.pos } : { story: 'side', act: 0, pos: m.order ?? 0 };
}
// 1 to 5: its own `rank`, else how far into the campaign it comes (a side mission sits in the middle)
export function missionRank(m, hero){
  if (m.rank) return m.rank;
  const s = missionShelf(m, hero);
  if (s.story !== 'campaign') return 3;
  return Math.max(1, Math.min(5, Math.ceil((s.pos + 1) / CHAPTERS.length * 5)));
}

// the page, for one hero: [{ id, title, groups: [{ title, missions: [mission…] }] }], empty shelves left out
export function missionShelves(hero){
  const stories = [...STORIES.filter(s => !s.heroes || s.heroes.includes(hero)), SIDE_STORY];
  const list = Object.values(MISSIONS).filter(m => missionForHero(m, hero));
  const placed = list.map((m, i) => ({ m, i, s: missionShelf(m, hero) }));
  return stories.map(st => {
    const mine = placed.filter(p => p.s.story === st.id || (st === SIDE_STORY && !stories.some(o => o.id === p.s.story)));
    const groups = st.acts.map((a, ai) => ({
      title: st === SIDE_STORY ? '' : 'ACT ' + ROMAN[ai] + (forHero(a, hero) ? ' · ' + forHero(a, hero) : ''),
      missions: mine.filter(p => (st === SIDE_STORY ? 0 : Math.min(p.s.act, st.acts.length - 1)) === ai)
                    .sort((a, b) => a.s.pos - b.s.pos || a.i - b.i).map(p => p.m),
    })).filter(g => g.missions.length);
    return { id: st.id, title: forHero(st.title, hero), groups };
  }).filter(s => s.groups.length);
}
