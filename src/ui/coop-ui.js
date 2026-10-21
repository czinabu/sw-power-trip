// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The ONLINE CO-OP panel (main menu and pause): host a room or join one by its code, and the connection readout on the HUD.

import { audioInit } from '../audio/sfx.js';
import { net, on, host, join, leave, cleanCode } from '../net/session.js';

const panel = document.getElementById('coop');
const statusEl = document.getElementById('coopstatus');
const codeIn = document.getElementById('coopcode');
const leaveBtn = document.getElementById('coopleave');
const pingEl = document.getElementById('netping');

const setOpen = (open) => { panel.classList.toggle('open', open); if (open) render(); };
document.getElementById('coopBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setOpen(true); });
document.getElementById('coopclose').addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });
panel.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === panel) setOpen(false); });   // never launches or resumes the game
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false); });

document.getElementById('coophost').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); host(); });
document.getElementById('coopjoin').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); join(codeIn.value); });
leaveBtn.addEventListener('click', (e) => { e.stopPropagation(); leave(false); });
codeIn.addEventListener('input', () => { codeIn.value = cleanCode(codeIn.value); });
codeIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') join(codeIn.value); });
codeIn.addEventListener('click', (e) => e.stopPropagation());

function render(){
  const s = net.status;
  statusEl.className = s === 'connected' ? 'ok' : s === 'failed' ? 'bad' : '';
  if (s === 'hosting') statusEl.innerHTML = 'Room code<span class="code">' + net.code + '</span>Waiting for your friend to join…';
  else if (s === 'joining') statusEl.textContent = 'Joining room ' + net.code + '…';
  else if (s === 'connected') statusEl.textContent = 'Connected. Start a mode and you will see each other in the arena.';
  else if (s === 'failed') statusEl.textContent = net.error;
  else statusEl.textContent = '';
  leaveBtn.style.display = s === 'idle' ? 'none' : 'inline-flex';
  const live = s === 'connected';
  pingEl.classList.toggle('on', live);
  if (live) pingEl.textContent = 'ONLINE · ' + (net.ping ? net.ping + ' MS' : '…');
}
on('status', render);
on('ping', render);
on('closed', render);
