# Notes for contributors (human or Claude)

- **Roadmap:** never edit a shared list. Add a new file `src/data/roadmap/<YYYY-MM-DD>-<slug>.js`
  (format in `src/data/roadmap/README.md`). Every PR that ships a feature or notable change adds one.
  One file per entry keeps parallel PRs from conflicting.
- **Other shared append-only lists:** avoid appending to the same spot in a shared file from many PRs;
  prefer a new file per addition where practical.
