# Roadmap entries

The main menu's ROADMAP panel is built from the files in this folder: **one file per entry**.

**To add or change a roadmap item, add a NEW file here. Do not edit a shared list.** Parallel PRs
that each add their own file never conflict. (They used to all append to one `roadmap.js`, and nearly
every PR hit a merge conflict.)

## New entry

Create `src/data/roadmap/<YYYY-MM-DD>-<short-slug>.js`:

```js
export default {
  title: 'Short title',
  status: 'done',            // 'done' | 'now' | 'next' | 'later'
  date: '2026-10-31',        // today; newest date shows first
  items: [
    'One short line per point, revealed when the title is clicked',
    'Same in every mode: story, training, survival, sandbox, missions and co-op',
  ],
};
```

To move an existing item (say `next` -> `done`), edit only that item's own file.
`index.js` gathers every `*.js` here and sorts by `date`, newest first. Files named `legacy-*` are the
entries migrated from the old single file (ordered by `seq`).
