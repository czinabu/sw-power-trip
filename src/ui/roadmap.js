// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ROADMAP panel: a read-only overlay on the main menu listing what's planned (data/roadmap.js).

import { ROADMAP, ROADMAP_STATUS } from '../data/roadmap.js';

const panel = document.getElementById('roadmap');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(){
  document.getElementById('rmlist').innerHTML = ROADMAP.map((p, i) =>
    `<div class="rm-phase rm-${p.status}">
      <div class="rm-top"><span class="rm-n">${i + 1}</span><span class="rm-st">${ROADMAP_STATUS[p.status] || ''}</span></div>
      <h4>${esc(p.title)}</h4>
      <ul>${p.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>`).join('');
}

export function setRoadmap(open){
  panel.classList.toggle('open', open);
  if (open) render();
}

document.getElementById('rmtoggle').addEventListener('click', (e) => { e.stopPropagation(); setRoadmap(true); });
document.getElementById('rmclose').addEventListener('click', (e) => { e.stopPropagation(); setRoadmap(false); });
panel.addEventListener('click', (e) => {
  e.stopPropagation();   // reading the roadmap must never launch or resume the game
  if (e.target === panel) setRoadmap(false);   // click the backdrop to close
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) setRoadmap(false); });
