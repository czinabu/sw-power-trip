// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Rolling and picking boons.

import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { G, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { renderProgress } from '../ui/store-ui.js';
import { BOONS, BOON_BY_ID, RARITY_W } from '../data/boons.js';
import { icon } from '../ui/icons.js';

function boonEligible(b){
  if (b.hero && b.hero !== G.hero) return false;
  if (b.once && ((player.boons && player.boons[b.id]) || 0) > 0) return false;
  return true;
}
export function rollBoons(){
  const avail = BOONS.filter(boonEligible), pick = [];
  while (pick.length < 3 && avail.length){
    let sum = 0; for (const b of avail) sum += RARITY_W[b.r];
    let r = Math.random()*sum, chosen = avail[0];
    for (const b of avail){ r -= RARITY_W[b.r]; if (r <= 0){ chosen = b; break; } }
    pick.push(chosen.id); avail.splice(avail.indexOf(chosen), 1);
  }
  return pick;
}
export function pickBoon(id){
  if (!G.skillSelect || G.boonPicked) return;
  const b = BOON_BY_ID[id]; if (!b || !boonEligible(b)) return;
  player.boons[id] = (player.boons[id] || 0) + 1;
  b.apply();
  G.boonPicked = true;
  const col = b.r==='legendary' ? '#ffd24a' : b.r==='rare' ? '#7fd4ff' : '#cfe6ff';
  floater(playerPos(), b.nm + '!', col);
  burst(playerPos().clone().setY(1.7), b.r==='legendary'?0xffd24a:b.r==='rare'?0x7fd4ff:0xcfe6ff, 18, 8, 6);
  sfx(b.r==='legendary'?700:560, 0.22, 'sine', 0.13, 1100); sfx(160, 0.18, 'sawtooth', 0.05, 70);
  updateBoonStrip(); renderProgress();
}
export function updateBoonStrip(){
  const el = document.getElementById('boonstrip'); if (!el) return;
  if (G.mode !== 'play' || !player.boons || !Object.keys(player.boons).length){ if (el._k !== ''){ el.innerHTML = ''; el._k = ''; } return; }
  let key = ''; for (const id in player.boons) key += id + player.boons[id] + ',';
  if (key === el._k) return;   // unchanged — skip the rebuild (safe to call every frame)
  el._k = key;
  let html = '';
  for (const id in player.boons){ const b = BOON_BY_ID[id], n = player.boons[id]; if (!b) continue;
    html += '<div class="bn '+b.r+'">'+icon(b.ico)+b.nm+(n>1?' ×'+n:'')+'</div>'; }
  el.innerHTML = html;
}
