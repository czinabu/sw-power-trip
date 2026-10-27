// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// COMBAT READOUT drawing (game/readout.js has the numbers): the table in the run summary and the sandbox's live box.

import { readoutData, foeLabel, dmgSum, fmtLen } from '../game/readout.js';

const SUMMARY_ROWS = 10;   // the latest waves; a long survival run would otherwise run off the screen
const top = (o) => { let k = null, v = 0; for (const t in o.dmg) if (o.dmg[t] > v){ v = o.dmg[t]; k = t; } return k; };
const defs = (o) => o.parries + o.deflects + o.blocks;

// damage by foe as a bar per source, biggest first
function bars(total){
  const all = dmgSum(total);
  if (all <= 0) return '<div class="ro-none">No damage taken</div>';
  return Object.entries(total.dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
    '<div class="ro-bar"><span class="ro-k">' + foeLabel(k) + '</span><i style="width:' + Math.max(3, v / all * 100).toFixed(0) + '%"></i><b>' + Math.round(v) + '</b></div>').join('');
}
const totals = (t) =>
  '<div class="ro-tot"><span>PARRIES <b>' + t.parries + '</b></span><span>DEFLECTS <b>' + t.deflects + '</b></span><span>BLOCKS <b>' + t.blocks + '</b></span>' +
  '<span>LOW STAMINA <b>' + t.lowStam.toFixed(1) + 's' + (t.len > 0 ? ' · ' + Math.round(t.lowStam / t.len * 100) + '%' : '') + '</b></span></div>';

// the run summary's section: totals, damage by foe, then one row per wave
export function readoutSummaryHtml(){
  const { waves, total } = readoutData();
  if (!waves.length && dmgSum(total) <= 0 && defs(total) <= 0) return '';
  const rows = waves.slice(-SUMMARY_ROWS).map((w) =>
    '<tr><td>' + w.label + '</td><td>' + fmtLen(w.len) + '</td><td>' + Math.round(dmgSum(w)) + '</td><td>' + (top(w) ? foeLabel(top(w)) : '–') +
    '</td><td>' + w.lowStam.toFixed(1) + 's</td><td>' + w.parries + ' / ' + w.deflects + ' / ' + w.blocks + '</td></tr>').join('');
  return '<div class="rs-readout"><div class="rs-bl">COMBAT READOUT</div>' + totals(total) + '<div class="ro-bars">' + bars(total) + '</div>' +
    (rows ? '<table class="ro-tab"><tr><th>WAVE</th><th>TIME</th><th>DMG</th><th>MOST FROM</th><th>LOW STAM</th><th>PARRY / DEFL / BLOCK</th></tr>' + rows + '</table>' : '') + '</div>';
}

// the sandbox's live box: this stretch so far, then the totals since the last reset
export function readoutLiveHtml(){
  const { live, total } = readoutData();
  const t = live || total;
  return '<div class="ro-h">COMBAT READOUT <span>' + fmtLen(t.len) + '</span></div>' + totals(t) +
    '<div class="ro-bars">' + bars(t) + '</div>' +
    '<div class="ro-hint">' + (dmgSum(t) > 0 ? Math.round(dmgSum(t)) + ' damage taken · ' + t.hits + ' hits' : 'Fight something') + '</div>';
}
