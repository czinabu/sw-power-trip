// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Progression lab (dev only: `npm run dev`, then open /tools/progression-lab.html).
// Campaign XP economy: income per wave (kills + wave clears, mirroring the game's formulas) against what the
// ability store and power mastery cost for a few representative builds.

// the store table imports game code that wires up the menus at load, so park a hidden copy of the game's markup
// in the page first, then load the tables
{ const doc = new DOMParser().parseFromString(await (await fetch('/index.html')).text(), 'text/html');
  doc.querySelectorAll('script').forEach(s => s.remove());
  const host = document.createElement('div'); host.hidden = true; host.innerHTML = doc.body.innerHTML; document.body.appendChild(host); }
const { LEVELS } = await import('../src/data/levels.js');
const { ENEMY_TYPES } = await import('../src/data/enemies.js');
const { JEDI_STORE, MANDO_STORE } = await import('../src/data/store.js');
const { MASTERY_JEDI, MASTERY_MANDO } = await import('../src/data/mastery.js');

// each build names the fork picks (store ids) and the abilities it ends up owning (mastery ids)
const BUILDS = [
  { nm: 'Jedi · throw, slam, judgement',     store: JEDI_STORE,  mastery: MASTERY_JEDI,  ids: ['push', 'pull', 'throw', 'jslam', 'judge', 'judgeUp'] },
  { nm: 'Jedi · barrier, mend, repulse',     store: JEDI_STORE,  mastery: MASTERY_JEDI,  ids: ['push', 'pull', 'barrier', 'mend', 'repulse', 'repulseUp'] },
  { nm: 'Mando · grapple, bacta, birds',     store: MANDO_STORE, mastery: MASTERY_MANDO, ids: ['rocket', 'flame', 'grapple', 'bacta', 'birds', 'jetmissile'] },
  { nm: 'Mando · slam, detonator, no bacta', store: MANDO_STORE, mastery: MASTERY_MANDO, ids: ['rocket', 'flame', 'mslam', 'deto', 'jetmissile'] },
];

function income(streak){
  const rows = []; let wt = 0, earned = 0;
  LEVELS.forEach((L, li) => L.waves.forEach((w, wi) => {
    const elite = Math.min(0.3, Math.max(0, (wt - 2) * 0.04));   // enemies/elites.js eliteChance() in the campaign
    let kill = 0;
    for (const t in w){ const sc = t === 'warbringer' ? 16 : ((ENEMY_TYPES[t] && ENEMY_TYPES[t].score) || 1);
      kill += w[t] * sc * 4 * streak * (1 + elite * 0.6); }          // enemies/damage.js: score × 4 × streak, elites ×1.6
    const clear = 140 + (wt + 1) * 28;                               // game/flow.js wave-clear payout
    earned += kill + clear;
    const last = li === LEVELS.length - 1 && wi === L.waves.length - 1;   // the final wave leads into the boss, no shop
    rows.push({ where: 'L' + (li + 1) + ' W' + (wi + 1), kill: Math.round(kill), clear, earned: Math.round(earned), shop: !last });
    wt++;
  }));
  return rows;
}
function table(head, rows){
  return '<div class="wrap"><table><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr>' + r.map(c => typeof c === 'object' ? '<td class="' + c.cls + '">' + c.v + '</td>' : '<td>' + c + '</td>').join('') + '</tr>').join('') +
    '</table></div>';
}
function render(){
  const streak = +document.getElementById('streak').value;
  document.getElementById('streakv').textContent = '×' + streak.toFixed(1);
  const rows = income(streak), spendable = rows.filter(r => r.shop).at(-1).earned;
  let html = '<h2>Income per wave</h2>' + table(['Wave', 'Kill XP', 'Clear XP', 'Earned so far', 'Upgrade screen after'],
    rows.map(r => [r.where, r.kill, r.clear, r.earned, r.shop ? 'yes' : 'boss']));
  html += '<h2>Builds · ' + spendable + ' XP spendable by the last upgrade screen</h2>' + table(
    ['Build', 'Abilities', 'Mastery (all ranks)', 'Total', 'Mastery affordable'],
    BUILDS.map(b => {
      const abil = b.store.filter(n => n.cost > 0 && b.ids.includes(n.id) || n.cost > 0 && !n.fork && !n.final && !n.avail).reduce((a, n) => a + n.cost, 0);
      const mast = b.mastery.filter(m => b.ids.includes(m.id)).reduce((a, m) => a + m.cost.reduce((x, y) => x + y, 0), 0);
      const pct = Math.round(100 * Math.max(0, Math.min(1, (spendable - abil) / mast)));
      return [b.nm, abil, mast, abil + mast, { v: pct + '%', cls: pct >= 100 ? 'warn' : 'ok' }];
    }));
  html += '<p class="hint">100% means XP runs out of things to buy before the boss. Survival adds repeatable powers on top, so it never runs dry.</p>';
  document.getElementById('out').innerHTML = html;
}
document.getElementById('streak').addEventListener('input', render);
render();
