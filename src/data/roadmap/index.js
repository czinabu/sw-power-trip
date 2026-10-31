// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ROADMAP: shown on the main menu's ROADMAP panel, grouped by status. See README.md in this folder.
// Every entry is its OWN file in this folder (so parallel PRs never edit the same lines and never
// conflict); this module gathers them all with Vite's import.meta.glob and sorts newest first.
const files = import.meta.glob('./*.js', { eager: true, import: 'default' });

export const ROADMAP = Object.entries(files)
  .filter(([, e]) => e && typeof e === 'object' && e.title)
  .sort(([fa, a], [fb, b]) =>
    String(b.date || '').localeCompare(String(a.date || '')) ||   // newest date first
    (b.seq || 0) - (a.seq || 0) ||                                // then the legacy order
    fb.localeCompare(fa))                                         // then filename, newest first
  .map(([, e]) => ({ title: e.title, status: e.status, items: e.items }));

export const ROADMAP_STATUS = { done: 'SHIPPED', now: 'IN PROGRESS', next: 'PLANNED', later: 'LATER' };
