// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// End of run: run summary and victory.

import { clamp } from '../utils.js';
import { G, player } from '../state.js';
import { BOON_BY_ID } from '../data/boons.js';
import { showBanner } from '../ui/banners.js';
import { icon } from '../ui/icons.js';
import { overlay, survivalUnlocked, refreshSurvivalLock, setOverlayState } from '../ui/menus.js';
import { closeReadout } from './readout.js';
import { readoutSummaryHtml } from '../ui/readout-ui.js';
import { campaignWon } from './campaign.js';

/* ---------- END-OF-RUN SUMMARY + SCORE ---------- */
export function endRun(won){
  const st = G.stats; if (!st || st._ended) return;   // compute once per end (cleared on re-entering play)
  st._ended = true;
  closeReadout();
  const elapsed = Math.max(0, G.gt - (st.startGt || 0));
  const endless = !!G.endless;
  const waves = endless ? (G.endlessWave || 0) : clamp((G.waveTotal || 0) + 1, 0, 99);
  const acc = st.shotsFired > 0 ? st.shotsHit / st.shotsFired : -1;
  const score = Math.max(0, Math.round(
    st.kills * 12 + waves * (endless ? 200 : 120) + st.bestStreak * 20 + (st.parries + st.deflects) * 15 +
    (st.bossKilled ? 1500 : 0) + (acc > 0 ? acc * 400 : 0) - st.dmgTaken * 0.35));
  const mission = !!G.mission && G.chapter < 0;   // (a campaign chapter that is a mission still counts as the campaign)
  const key = endless ? 'sw_best_endless' : mission ? 'sw_best_mission' : 'sw_best_score';   // survival and missions keep their OWN bests
  let best = 0; try { best = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch(e){}
  const newBest = score > best;
  if (newBest){ try { localStorage.setItem(key, String(score)); } catch(e){} best = score; }
  st.summary = { won, elapsed, waves, acc, score, best, newBest, endless, mission };
  renderRunSummary();
}
function renderRunSummary(){
  const st = G.stats, s = st && st.summary, el = document.getElementById('runsummary');
  if (!s || !el) return;
  const mm = Math.floor(s.elapsed / 60), ss = Math.round(s.elapsed % 60);
  const timeStr = mm + ':' + (ss < 10 ? '0' : '') + ss;
  const stat = (label, val) => '<div class="rs-stat"><div class="rs-v">' + val + '</div><div class="rs-l">' + label + '</div></div>';
  let grid = stat('TIME', timeStr) + (s.mission ? '' : stat(s.endless ? 'WAVE REACHED' : 'WAVES', s.waves)) + stat('KILLS', st.kills) +
             stat('BEST STREAK', '×' + st.bestStreak) + stat('DEFENSE', st.parries + st.deflects);
  if (s.acc >= 0) grid += stat('ACCURACY', Math.round(s.acc * 100) + '%');
  grid += stat('DMG TAKEN', Math.round(st.dmgTaken));
  const title = s.endless ? 'SURVIVAL ENDED' : s.mission ? (s.won ? 'MISSION COMPLETE' : 'MISSION FAILED') : (s.won ? 'VICTORY' : 'YOU HAVE FALLEN');
  let boonHtml = '';
  if (player.boons && Object.keys(player.boons).length){
    let items = '';
    for (const id in player.boons){ const b = BOON_BY_ID[id]; if (!b) continue;
      items += '<span class="' + b.r + '">' + icon(b.ico) + b.nm + (player.boons[id] > 1 ? ' ×' + player.boons[id] : '') + '</span>';
    }
    boonHtml = '<div class="rs-boons"><div class="rs-bl">YOUR BUILD</div>' + items + '</div>';
  }
  el.innerHTML =
    '<div class="rs-title">' + title + '</div>' +
    '<div class="rs-score">SCORE <b>' + s.score.toLocaleString() + '</b>' +
      (s.newBest ? '<span class="rs-best new">★ NEW BEST</span>' : '<span class="rs-best">BEST ' + s.best.toLocaleString() + '</span>') + '</div>' +
    '<div class="rs-grid c' + (s.acc >= 0 ? 4 : 3) + '">' + grid + '</div>' +
    boonHtml + readoutSummaryHtml();
  el.style.display = 'block';
}

export function victory(afterEpilogue){
  if (!afterEpilogue && G.chapter >= 0 && G.mode === 'play'){ campaignWon(() => victory(true)); return; }   // the campaign's end: its epilogue first
  endRun(true);
  G.mode = 'victory';
  G.slowmo = 1; G.slowmoT = 0;   // the fight is won — drop out of slow motion
  // record this hero's CAMPAIGN clear — SURVIVAL unlocks once BOTH heroes have finished the campaign
  const hadBoth = survivalUnlocked();
  try { localStorage.setItem('sw_camp_' + G.hero, '1'); } catch(e){}
  const newlyUnlocked = !hadBoth && survivalUnlocked();
  refreshSurvivalLock();
  showBanner('YOU WIN', 'Balance restored. The legend grows.', 999);
  setTimeout(()=>{
    if (G.mode !== 'victory') return;
    document.exitPointerLock();
    // always raise the win screen (not just in the embedded fallback)
    overlay.style.display = 'flex';
    setOverlayState('victory');
    document.getElementById('ovsub').textContent = newlyUnlocked ? '★ SURVIVAL MODE UNLOCKED ★' : 'THE HERALD OF THE VOID IS NO MORE';
  }, 1400);
}
