// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ROADMAP panel: a read-only overlay on the main menu (its ROADMAP button) listing what's shipped and planned (data/roadmap.js).

import { ROADMAP, ROADMAP_STATUS } from '../data/roadmap.js';

const panel = document.getElementById('roadmap');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// One column per status group, in this order; 'next' and 'later' share the PLANNED column.
const COLUMNS = [['now'], ['next', 'later'], ['done']];

function render(){
  document.getElementById('rmlist').innerHTML = COLUMNS.map((statuses) => {
    const phases = ROADMAP.filter((p) => statuses.includes(p.status));
    const head = ROADMAP_STATUS[statuses[0]];
    return `<div class="rm-col rm-${statuses[0]}">
      <div class="rm-st">${head}</div>
      ${phases.map((p) => `<div class="rm-phase">
        <h4>${esc(p.title)}${p.status === 'later' ? ' <span class="rm-later">LATER</span>' : ''}</h4>
        <ul>${p.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>`).join('')}
    </div>`;
  }).join('');
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
