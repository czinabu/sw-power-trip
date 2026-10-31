// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The ONLINE CO-OP panel (main menu and pause): host a room or join one by its code, and the connection readout on the HUD.

import { audioInit } from '../audio/sfx.js';
import { net, on, host, join, leave, cleanCode, lastRoom } from '../net/session.js';
import { savedName, saveName, typingName, nameOf, seatsHeard } from '../net/names.js';
import { SEAT_COLORS } from './coop-marks.js';
import { coopRun } from '../net/run.js';
import { onRunChange } from '../net/foes.js';
import { launchCoopRun } from './menus.js';
import { G } from '../state.js';
import { missionTitle } from '../game/mission.js';

const panel = document.getElementById('coop');
const statusEl = document.getElementById('coopstatus');
const codeIn = document.getElementById('coopcode');
const leaveBtn = document.getElementById('coopleave');
const pingEl = document.getElementById('netping');
const nameIn = document.getElementById('coopname');
const rosterEl = document.getElementById('cooproster');
const runBtn = document.getElementById('coopjoinrun');

const setOpen = (open) => { panel.classList.toggle('open', open); if (open) render(); };
for (const id of ['coopBtn', 'mode-coop']) document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setOpen(true); });
document.getElementById('coopclose').addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });
panel.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === panel) setOpen(false); });   // never launches or resumes the game
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false); });

// your display name: kept in this browser, filtered as you type, sent to the others when you connect
nameIn.value = savedName();
nameIn.addEventListener('input', () => { nameIn.value = typingName(nameIn.value); saveName(nameIn.value); });
nameIn.addEventListener('blur', () => { nameIn.value = saveName(nameIn.value); });
nameIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') nameIn.blur(); });
nameIn.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('coophost').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); host(); });
document.getElementById('coopjoin').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); join(codeIn.value); });
leaveBtn.addEventListener('click', (e) => { e.stopPropagation(); leave(false); });
runBtn.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setOpen(false); launchCoopRun(); });
codeIn.addEventListener('input', () => { codeIn.value = cleanCode(codeIn.value); });
codeIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') join(codeIn.value); });
codeIn.addEventListener('click', (e) => e.stopPropagation());

const runName = () => coopRun.k === 'm' ? 'the mission ' + missionTitle(coopRun.mid) : coopRun.k === 'c' ? (coopRun.ch >= 0 ? 'chapter ' + (coopRun.ch + 1) : 'level ' + (coopRun.lv + 1)) + ' of the campaign' : 'a Survival run';
const waveText = () => coopRun.k === 'm' || coopRun.mid ? '' : ', wave ' + (coopRun.k === 'c' ? coopRun.w - (coopRun.wf || 0) + 1 : coopRun.w);
// who is in the room: everyone's picked name (or PLAYER n) in their seat colour
function renderRoster(){
  const live = net.status === 'connected';
  rosterEl.style.display = live ? 'flex' : 'none';
  rosterEl.textContent = '';
  if (!live) return;
  const seats = [...new Set([net.slot, 0, ...seatsHeard()])].sort();
  for (const k of seats){
    const el = document.createElement('span');
    el.style.borderColor = '#' + SEAT_COLORS[k].toString(16).padStart(6, '0');
    el.textContent = k === net.slot ? (savedName() || nameOf(k)).toUpperCase() : nameOf(k);
    if (k === 0){ const h = document.createElement('i'); h.textContent = 'HOST'; el.appendChild(h); }
    if (k === net.slot){ const h = document.createElement('i'); h.textContent = 'YOU'; el.appendChild(h); }
    rosterEl.appendChild(el);
  }
}
function render(){
  const s = net.status;
  nameIn.disabled = s === 'connected' || s === 'reconnecting';   // the name goes out with your hello: pick it before you connect
  renderRoster();
  statusEl.className = s === 'connected' ? 'ok' : s === 'failed' ? 'bad' : '';
  if (s === 'hosting') statusEl.innerHTML = 'Room code<span class="code">' + net.code + '</span>Waiting for your friends to join (up to 3)…';
  else if (s === 'joining') statusEl.textContent = 'Joining room ' + net.code + '…';
  else if (s === 'connected'){
    const guest = net.role === 'guest';
    const msg = !coopRun.on ? (guest ? 'Connected. Waiting for the host to start a run, then you can join it here.' : 'Connected. Start a campaign, a story mission or a Survival run and your friends can join it. Training and the sandbox you each play on your own.')
      : guest ? (G.coopGuest ? 'Fighting alongside the host' + waveText() + '.' : G.mode === 'menu' ? 'The host is on ' + runName() + waveText() + '.' : 'The host is in a run. Go back to the main menu to join it.')
      : 'Your friends can join your run from this panel.';
    // the host keeps the code in view while there is room: one more friend can still come in
    if (!guest && net.guests < 3) statusEl.innerHTML = '<span class="players">' + (net.guests + 1) + ' of 4 players</span> Room code<span class="code">' + net.code + '</span>' + msg;
    else if (!guest) statusEl.innerHTML = '<span class="players">4 of 4 players</span>' + msg;
    else statusEl.textContent = msg;
  }
  else if (s === 'reconnecting') statusEl.textContent = 'Connection lost. Getting back into room ' + net.code + '…';
  else if (s === 'failed') statusEl.textContent = net.error;
  else statusEl.textContent = '';
  leaveBtn.style.display = s === 'idle' ? 'none' : 'inline-flex';
  runBtn.style.display = s === 'connected' && net.role === 'guest' && coopRun.on && !G.coopGuest && G.mode === 'menu' ? 'inline-flex' : 'none';
  const live = s === 'connected';
  pingEl.classList.toggle('on', live || s === 'reconnecting');
  if (live) pingEl.textContent = 'ONLINE · ' + (net.ping ? net.ping + ' MS' : '…');
  else if (s === 'reconnecting') pingEl.textContent = 'RECONNECTING…';
  if ((s === 'idle' || s === 'failed') && !codeIn.value) codeIn.value = lastRoom();   // the last room joined, ready to rejoin
}
on('status', render);
on('ping', render);
on('closed', render);
on('hello', () => setTimeout(render, 0));   // after net/partner.js has noted the name
onRunChange(render);
