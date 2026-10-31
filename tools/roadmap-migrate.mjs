// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// One-off helper for branches made before the roadmap was split into one file per entry.
// If your merge hits a modify/delete conflict on src/data/roadmap.js:
//   git show <your-branch-or-MERGE_HEAD>:src/data/roadmap.js > /tmp/old-roadmap.mjs
//   node tools/roadmap-migrate.mjs /tmp/old-roadmap.mjs
//   git rm src/data/roadmap.js
// Every entry in that old file whose title isn't already in src/data/roadmap/ becomes its own file.
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/roadmap-migrate.mjs <old roadmap.js>'); process.exit(1); }
const { ROADMAP } = await import(pathToFileURL(path.resolve(src)).href);
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data/roadmap');
const have = new Set();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js'))
  have.add((await import(pathToFileURL(path.join(dir, f)).href)).default.title);
const today = new Date().toISOString().slice(0, 10);
const fresh = ROADMAP.filter((e) => !have.has(e.title));
fresh.forEach((e, i) => {
  const slug = e.title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50).replace(/-$/, '');
  const file = path.join(dir, `${today}-${slug}.js`);
  fs.writeFileSync(file, '// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.\nexport default {\n'
    + `  title: ${JSON.stringify(e.title)},\n  status: ${JSON.stringify(e.status)},\n  date: '${today}', seq: ${fresh.length - i},\n  items: [\n`
    + e.items.map((s) => '    ' + JSON.stringify(s)).join(',\n') + ',\n  ],\n};\n');
  console.log('added', path.relative(process.cwd(), file));
});
if (!fresh.length) console.log('nothing new: every entry is already in src/data/roadmap/');
