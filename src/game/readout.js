// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// COMBAT READOUT: per-wave numbers (damage taken by foe, time at low stamina, parries, deflects and blocks, wave length),
// collected in every mode and shown in the run summary (game/summary.js) and the sandbox's live panel (ui/hud.js).
// Waves have their own segment; modes without waves (training, missions, the sandbox, the boss) run as one.

import { G, shared, enemies, player } from '../state.js';
import { maxStam } from '../player/helpers.js';

const MAX_SEGMENTS = 60;   // a long survival run keeps its latest waves; the totals still count them all
const LOW_STAM = 0.32;     // the same line as the danger vignette (player/update.js)
const FOE_REACH = 3.5;     // a blow lands from at most this far from the foe that threw it

const blank = (label, boss) => ({ label, boss: !!boss, t0: G.gt, t1: null, dmg: {}, hits: 0, lowStam: 0, parries: 0, deflects: 0, blocks: 0, dodges: 0 });
function sumInto(a, b){
  for (const k in b.dmg) a.dmg[k] = (a.dmg[k] || 0) + b.dmg[k];
  a.hits += b.hits; a.lowStam += b.lowStam; a.parries += b.parries; a.deflects += b.deflects; a.blocks += b.blocks; a.dodges += b.dodges;
}

export function resetReadout(){ G.readout = { segs: [], cur: null, lastSrc: 'hazard', total: { ...blank('TOTAL'), len: 0 } }; }
const RO = () => G.readout || (resetReadout(), G.readout);

// the open segment: waves open theirs in startWave / startEndlessWave; anything else opens one on its first event
function cur(){
  const r = RO();
  if (r.cur) return r.cur;
  if (shared.levelPhase === 'between') return null;   // the lull after a clear belongs to no wave
  r.cur = blank(shared.boss ? 'BOSS' : G.sandbox ? 'SANDBOX' : G.training ? 'TRAINING' : G.mission ? 'MISSION' : 'FIGHT', !!shared.boss);
  return r.cur;
}
export function beginWave(label){ endWave(); RO().cur = blank(label); }
export function endWave(){
  const r = RO(), c = r.cur;
  if (!c) return;
  c.t1 = G.gt;
  r.segs.push(c); if (r.segs.length > MAX_SEGMENTS) r.segs.shift();
  sumInto(r.total, c); r.total.len += c.t1 - c.t0;
  r.cur = null;
}
// the sandbox's reset button: start counting again from now
export function restartReadout(){ resetReadout(); }

// who a blow came from: the bolt's shooter, the boss, the foe standing at the blow, or the world (hazards, mission fire)
function sourceOf(fromPos, opts){
  if (opts && opts.blast) return 'grenade';
  const s = opts && opts.src;
  if (s) return s === shared.boss ? 'boss' : (s.type || 'hazard');
  if (shared.boss && shared.boss.hp > 0 && (!fromPos || shared.boss.group.position.distanceTo(fromPos) < 0.01)) return 'boss';
  if (!fromPos) return 'hazard';
  let best = 'hazard', bd = FOE_REACH;
  for (const e of enemies){
    if (e.converted) continue;
    const d = Math.hypot(e.group.position.x - fromPos.x, e.group.position.z - fromPos.z);
    if (d < bd){ bd = d; best = e.type; }
  }
  return best;
}
// a blow that landed (after every reduction); the guard's chip damage keeps the source of the block that let it through
export function noteDamage(dmg, fromPos, opts, chip, silent){
  const c = cur(); if (!c) return;
  const r = RO(), src = chip ? r.lastSrc : sourceOf(fromPos, opts);
  r.lastSrc = src;
  c.dmg[src] = (c.dmg[src] || 0) + dmg;
  if (!chip && !silent) c.hits++;
}
// a blow that never landed: 'parries', 'deflects', 'blocks' or 'dodges'
export function noteDefense(kind, fromPos, opts){
  const c = cur(); if (!c) return;
  c[kind]++;
  if (fromPos || opts) RO().lastSrc = sourceOf(fromPos, opts);
}
export function noteStamina(dt){
  if (G.mode !== 'play') return;
  if (player.exhausted || player.stam / maxStam() < LOW_STAM){ const c = cur(); if (c) c.lowStam += dt; }
}
// the sandbox's live box: shown unless switched off (remembered)
export function readoutOn(){ try { return localStorage.getItem('sw_readout') !== '0'; } catch(e){ return true; } }
export function setReadoutOn(on){ try { localStorage.setItem('sw_readout', on ? '1' : '0'); } catch(e){} }
export function closeReadout(){ endWave(); }

// everything the summary and the sandbox panel draw: finished waves, the one in progress, and the totals so far
export function readoutData(){
  const r = RO(), total = { ...blank('TOTAL'), len: 0 };
  sumInto(total, r.total);
  total.len = r.total.len;
  if (r.cur){ sumInto(total, r.cur); total.len += G.gt - r.cur.t0; }
  const waves = r.segs.map(s => ({ ...s, len: s.t1 - s.t0 }));
  const live = r.cur ? { ...r.cur, len: G.gt - r.cur.t0 } : null;
  return { waves, live, total };
}

export const FOE_LABEL = { grunt: 'GRUNT', blaster: 'BLASTER', brute: 'BRUTE', duelist: 'DUELIST', acolyte: 'ACOLYTE', boss: 'BOSS', grenade: 'GRENADE', hazard: 'HAZARD' };
export const foeLabel = (k) => FOE_LABEL[k] || String(k).toUpperCase();
export const dmgSum = (o) => Object.values(o.dmg).reduce((a, b) => a + b, 0);
export const fmtLen = (s) => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
