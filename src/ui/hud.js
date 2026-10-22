// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// updateHud(): per-frame HUD refresh.

import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { clamp } from '../utils.js';
import { shared, G, enemies, player } from '../state.js';
import { MANDO, MANDO_WEAPONS, weaponUnlocked } from '../data/mando.js';
import { abil } from '../data/mastery.js';
import { maxHp, maxStam } from '../player/helpers.js';
import { FOCUS, focusTier } from '../player/jedi/focus.js';
import { mandoWeapon } from '../player/mando/weapons.js';
import { MUTATORS } from '../data/mutators.js';
import { nextStoreGoal } from '../game/progression.js';
import { updateBoonStrip } from '../game/boons.js';
import { renderThreats } from './threats.js';
import { svgIcon, SLOT_ICON } from './icons.js';
import { trainingProgress, trainingChecklist } from '../game/tutorial.js';
import { missionChecklist } from '../game/mission.js';
import { objectiveHud } from '../game/objectives.js';
import { MOBILITY, MANDO_MOBILITY } from '../data/mobility.js';
import { maxCharges, inCombat, formMob } from '../player/mobility.js';

// give every power slot its icon once (key badge top-left, icon centre, name below)
for (const id in SLOT_ICON){ const el = document.getElementById(id); if (el) el.querySelector('.key').insertAdjacentHTML('afterend', svgIcon(SLOT_ICON[id])); }

// write text/HTML only when it changed — the HUD refreshes every frame
function setText(el, v){ if (el._t !== v){ el._t = v; el.textContent = v; } }
function setHtml(el, v){ if (el._h !== v){ el._h = v; el.innerHTML = v; } }
const $ = (id) => document.getElementById(id);

// top-right objectives checklist (training lessons, mission objectives): a window of up to 7 rows around the current one
function renderChecklist(c){
  const el = $('objlist');
  if (!c){ el.classList.remove('on'); return; }
  const cur = Math.max(0, c.items.findIndex(i => i.now)), n = c.items.length;
  const from = Math.max(0, Math.min(cur - 2, n - 7)), rows = c.items.slice(from, from + 7);
  el.classList.add('on');
  setHtml(el, '<div class="ol-h">' + c.title + '</div>' + rows.map(i =>
    '<div class="ol-i' + (i.done ? ' done' : i.now ? ' now' : '') + '"><b>' + (i.done ? '✓' : i.now ? '▶' : '○') + '</b><span>' + i.text + '</span></div>' +
      (i.sub && i.sub.length ? '<div class="ol-s">' + i.sub.join('<br>') + (i.frac != null ? '<span class="ol-b"><i style="width:' + (clamp(i.frac, 0, 1) * 100).toFixed(1) + '%"></i></span>' : '') + '</div>' : '')).join('') +
    (n > 7 ? '<div class="ol-n">' + c.items.filter(i => i.done).length + ' / ' + n + ' DONE</div>' : ''));
}

/* ABILITY COOLDOWNS — the slot shades over and counts down while a power recharges. The full length is learned from
   the moment the timer jumps up (so stance / upgrade cooldown multipliers are reflected without duplicating them). */
const _cdPrev = {}, _cdMax = {};
function cdSlot(id, key, cost){
  const el = $(id); if (!el || el.style.display === 'none') return;
  const left = player.cds[key] || 0, prev = _cdPrev[key] || 0;
  if (left > prev + 0.05) _cdMax[key] = left;
  _cdPrev[key] = left;
  const frac = left > 0 && _cdMax[key] ? clamp(left / _cdMax[key], 0, 1) : 0;
  el.style.setProperty('--cd', frac.toFixed(3));
  if (!el._cdt) el._cdt = el.querySelector('.cdt');
  if (el._cdt) setText(el._cdt, left >= 1 ? String(Math.ceil(left)) : '');
  if (prev > 0 && left <= 0 && (_cdMax[key] || 0) >= 2){ el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }   // just came off cooldown
  el.classList.toggle('cool', left > 0);
  if (cost != null) el.classList.toggle('nofp', left <= 0 && player.force < cost * (player.up.abilityCostMul || 1));   // the price the cast actually charges
}

// MANDO weapon slots: 1 blaster · 2 dual · 3 the signature weapon (Disruptor or Darksaber, whichever you took) · 4 holstered
function renderWeaponSlots(){
  const sig = player.up.darksaber ? 'darksaber' : 'disruptor';
  const slots = [['1','single'],['2','dual'],['3',sig],['4','fists']];
  let key = player.weapon;
  for (const [, w] of slots) key += weaponUnlocked(w) ? '1' : '0';
  const wrap = $('wslots'); if (wrap._k === key + sig) return;
  wrap._k = key + sig;
  wrap.innerHTML = slots.map(([k, w]) => {
    const own = weaponUnlocked(w), nm = own ? (w === 'fists' ? 'HOLSTER' : MANDO_WEAPONS[w].name) : 'LOCKED';
    return '<span class="wslot' + (player.weapon === w ? ' on' : '') + (own ? '' : ' lock') + '"><span class="kc">' + k + '</span>' + nm + '</span>';
  }).join('');
}

export function updateHud(){
  const mh = maxHp();
  $('hpbar').style.width = (player.hp / mh * 100) + '%';
  setText($('hpval'), Math.max(0, Math.ceil(player.hp)) + ' / ' + Math.round(mh));
  $('hpmeter').classList.toggle('low', player.hp > 0 && player.hp / mh < 0.3);
  $('fpbar').style.width = (player.force / CFG.player.maxForce * 100) + '%';
  setText($('fpval'), String(Math.max(0, Math.floor(player.force))));
  updateBoonStrip();   // active-boon strip (no-op unless the set changed)
  renderThreats();     // directional damage arc + off-screen danger markers
  // HIT MARKER — pop an X at the crosshair when a shot lands (white hit · gold headshot · red kill)
  { const hm = document.getElementById('hitmark'), t = player.hitMarkT || 0;
    if (G.hero === 'mando' && t > 0){
      hm.style.opacity = Math.min(1, t * 1.5);
      hm.style.color = player.hitMarkKind === 'kill' ? '#ff4a4a' : player.hitMarkKind === 'head' ? '#ffd24a' : '#ffffff';
      hm.style.transform = 'translate(-50%,-50%) scale(' + (1 + t*0.4 + (player.hitMarkKind === 'kill' ? 0.25 : 0)).toFixed(2) + ')';
    } else hm.style.opacity = '0'; }
  // FORCE FOCUS meter — Jedi only (hidden for the Mando by CSS)
  if (G.hero !== 'mando'){
    const fcw = $('fcwrap'), t = focusTier();
    $('fcbar').style.width = (player.focus || 0) + '%';
    setText($('fclabel'), t > 0 ? ('FOCUS · ' + FOCUS.names[t]) : 'FOCUS');
    fcw.classList.toggle('t3', t >= 3);
  }
  // JET FUEL now reads on the JETPACK itself (diegetic LED gauge); JEDI stamina lives by the crosshair — bar unused
  document.getElementById('smwrap').style.display = 'none';
  // Crosshair-side gauge — sits right beside the reticle/crosshair so your swing fuel reads without glancing away.
  //  JEDI: violet SABER STAMINA.  MANDO: energy/HEAT (blasters, blue) or stamina (DARKSABER, violet). The Mando
  //  version tracks the free-aim reticle drift; the Jedi crosshair is fixed-centre, so its gauge stays put.
  { const em = document.getElementById('energymeter'), ef = document.getElementById('energyfill');
    const showE = G.mode === 'play' && (G.hero === 'jedi' || G.hero === 'mando');
    em.style.display = showE ? 'block' : 'none';
    if (showE){
      const saber = G.hero === 'jedi' || mandoWeapon().melee;   // saber forms → stamina gauge; blasters → heat gauge
      if (saber){
        ef.style.height = (player.stam / maxStam() * 100) + '%';
        em.classList.add('saberbar');
        em.classList.toggle('over', player.exhausted);   // guard broken → flashes red
      } else {
        ef.style.height = ((1 - player.heat) * 100) + '%';
        em.classList.remove('saberbar');
        em.classList.toggle('over', player.overheat);
      }
      em.style.transform = (G.hero === 'mando') ? 'translate(' + player.aimOff.x.toFixed(1) + 'px,' + player.aimOff.y.toFixed(1) + 'px)' : 'none';
    } }
  // bottom XP meter — fills toward the next affordable ability
  { const goal = nextStoreGoal(), xm = document.getElementById('xpmeter');
    const showX = G.mode === 'play';
    xm.style.display = showX ? 'block' : 'none';
    if (showX){
      if (goal){ const frac = clamp((G.xp || 0) / goal.cost, 0, 1);
        $('xpmeterfill').style.width = (frac*100) + '%';
        xm.classList.toggle('ready', frac >= 1);
        setHtml($('xpmetertxt'), frac >= 1 ? 'READY TO UNLOCK · ' + goal.nm
          : '<span class="nx">NEXT</span> ' + goal.nm + ' <span class="nx">· ' + (G.xp||0) + ' / ' + goal.cost + ' XP</span>');
      } else { $('xpmeterfill').style.width = '100%'; xm.classList.remove('ready');
        setText($('xpmetertxt'), 'XP ' + (G.xp || 0)); } } }
  const L = LEVELS[G.levelIdx];
  let alive = 0;
  for (const e of enemies) if (!e.dead && !e.converted) alive++;
  const total = alive + G.spawnQueue.length;
  // run progress: where you are · which wave · what's left
  const hostiles = total > 0 ? '<span class="wi-h">' + total + ' HOSTILE' + (total === 1 ? '' : 'S') + ' REMAIN</span>' : '';
  document.body.classList.toggle('training', !!G.training);
  document.body.classList.toggle('sandbox', !!G.sandbox);
  if (G.training){
    const tp = trainingProgress();
    setHtml($('waveinfo'), '<span class="wi-l">TRAINING · ' + tp.place + '</span><span class="wi-w">LESSON ' + tp.lesson + ' / ' + tp.total + '</span>');
  } else if (G.mission){
    const o = objectiveHud();
    if (o) setHtml($('waveinfo'), '<span class="wi-l">' + o.kicker + '</span><span class="wi-w">' + o.title + '</span>' +
      '<span class="wi-h' + (o.warn ? ' warn' : '') + '">' + o.status + '</span>' +
      (o.frac != null ? '<span class="wi-bar"><i style="width:' + (clamp(o.frac, 0, 1) * 100).toFixed(1) + '%"></i></span>' : ''));
  } else if (G.sandbox){
    setHtml($('waveinfo'), '<span class="wi-l">SANDBOX · ' + (G.hero === 'mando' ? 'THE THRONE ROOM' : 'THE TRAINING ROOM') + '</span><span class="wi-w">PRESS B FOR FOES &amp; POWERS</span>' + hostiles +
      (G.sandboxGod ? '<span class="wi-h">GOD MODE</span>' : ''));
  } else if (G.endless){
    const mut = G.mut ? MUTATORS.find(m => m.id === G.mut) : null;
    setHtml($('waveinfo'), '<span class="wi-l">SURVIVAL</span><span class="wi-w">WAVE ' + G.endlessWave + '</span>' + hostiles +
      (mut ? '<span class="wi-h"><span class="wi-mut" style="color:' + mut.col + '">' + mut.name + '</span></span>' : ''));
  } else {
    const place = (L.name.split('—')[1] || L.name).trim();
    const wave = shared.boss ? 'BOSS FIGHT'
                             : 'WAVE ' + Math.min(G.wave+1, L.waves.length) + ' / ' + L.waves.length;
    setHtml($('waveinfo'), '<span class="wi-l">LEVEL ' + (G.levelIdx + 1) + ' · ' + place + '</span><span class="wi-w">' + wave + '</span>' +
      (shared.boss ? '' : hostiles));
  }
  renderChecklist(G.mode === 'play' && !G.sandbox ? (G.training ? trainingChecklist() : G.mission ? missionChecklist() : null) : null);
  if (G.hero !== 'mando'){   // holstered (4): LMB is a Force strike and RMB a ward instead of saber and block
    setText($('ab-atk').querySelector('.an'), player.holstered ? 'FORCE STRIKE' : 'SABER');
    setText($('ab-block').querySelector('.an'), player.holstered ? 'WARD' : 'BLOCK');
  }
  if (G.hero === 'mando'){
    // weapon + ammo readout
    const W = mandoWeapon();
    renderWeaponSlots();
    const ammoEl = document.getElementById('ammoLabel');
    ammoEl.textContent = W.melee ? '— —' : (W.fire === 'rifle' && !player.zoom) ? 'SPEAR' : (player.overheat ? 'OVERHEAT' : Math.round((1 - player.heat) * 100) + '%');
    document.getElementById('ab-blaster').classList.toggle('reloading', player.overheat);
    document.getElementById('ab-blaster').classList.toggle('nofp', !W.melee && player.overheat);
    document.getElementById('ab-reload').classList.toggle('cool', player.overheat || player.ventT > 0);
    document.getElementById('ab-reload').classList.toggle('nofp', !W.melee && player.heat <= 0.02);
    // RMB chip tells you what bracing DOES on this weapon: SINGLE projects the deflecting SHIELD; DUAL is an
    // offensive brace; the Darksaber GUARDS; the Disruptor SCOPES. Flag the shield when it's out of stamina to deflect.
    const braceEl = document.getElementById('ab-brace');
    if (braceEl){
      setText(braceEl.querySelector('.an'), W.fire === 'fists' ? 'SHIELD' : W.melee ? 'GUARD' : W.twoHand ? 'SCOPE' : player.weapon === 'single' ? 'SHIELD' : 'BRACE');
      braceEl.classList.toggle('nofp', player.weapon === 'single' && player.blockHeld && player.stam <= 0);
    }
    // E chip: behind the raised shield, E cuts with the vibroblade instead of punching
    const meleeEl = document.getElementById('ab-melee');
    if (meleeEl) setText(meleeEl.querySelector('.an'), player.isShielding ? 'BLADE' : 'PUNCH');
    // cooldown / fuel-gated abilities
    const cdab = [['ab-rocket','rocket',abil('rocket').cost],['ab-deto','deto',abil('deto').cost],
                  ['ab-birds','birds',abil('birds').cost],['ab-grapple','grapple',abil('grapple').cost],
                  ['ab-missile','missile',abil('jetmissile').cost],['ab-bacta','bacta',abil('bacta').cost],
                  ['ab-dthrow','darkThrow',MANDO.darkThrow.cost]];
    for (const [id, key, cost] of cdab) cdSlot(id, key, cost);
    document.getElementById('ab-flame').classList.toggle('nofp', player.force < 5);
    document.getElementById('ab-flame').classList.toggle('cool', !!player.flaming);
    document.getElementById('ab-jet').classList.toggle('nofp', player.jet < 12);    // jet FUEL low
    document.getElementById('ab-jet').classList.toggle('cool', !!player.jetActive);
    mandoShiftSlot();
    document.getElementById('ab-mslam').classList.toggle('nofp', player.grounded || player.jet < abil('mslam').cost);   // air-only, jet fuel
    // DYNAMIC CROSSHAIR — line gap / colour / ring react to the situation
    const rt = document.getElementById('reticle');
    if (rt){
      const spd = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
      const adsAim = (player.blockHeld || player.zoom) && !mandoWeapon().melee;   // bracing/scoping a blaster → ADS star
      let gap = 4 + Math.min(8, spd * 0.55) + (player.boosting ? 7 : 0) + player.recoilKick * 16;
      // BRACING steadies the aim — SINGLE's beskar shield-brace snaps the cone in HARD (good ADS); DUAL's offensive
      // brace only tightens a little (minor ADS — it's an aggressive stance, not a marksman's perch).
      if (player.blockHeld && !mandoWeapon().melee) gap *= (player.weapon === 'dual' ? 0.72 : 0.45);
      if (player.zoom) gap = 1.5;                                  // ADS pulls it in tight for precision
      gap = clamp(gap, 1.5, 24);
      let col = '120,210,255', ringOp = 0.24, dotOp = 0.9;
      if (player.blockHeld){ col = '158,176,191'; }                // bracing → beskar-steel
      if (player.jet < 18){ col = '255,120,70'; }                  // low jet fuel → amber-red warning
      if (player.lockOn){ col = '255,207,74'; ringOp = 0.6; dotOp = 1; }   // target under the reticle → gold
      rt.style.setProperty('--gap', gap.toFixed(1) + 'px');
      rt.style.setProperty('--col', col);
      rt.style.setProperty('--ringScale', (player.zoom ? 0.66 : 1).toFixed(2));
      rt.style.setProperty('--ringOp', ringOp.toFixed(2));
      rt.style.setProperty('--dotOp', dotOp.toFixed(2));
      rt.style.transform = 'translate(' + player.aimOff.x.toFixed(1) + 'px,' + player.aimOff.y.toFixed(1) + 'px)';   // free-aim drift
      rt.classList.toggle('reload', player.overheat);
      rt.classList.toggle('lock', !!player.lockOn);
      rt.classList.toggle('ads', adsAim);   // collapse into the tight 4-point STAR while aiming/bracing
    }
    return;
  }
  document.getElementById('ab-block').classList.toggle('nofp', player.stam < CFG.player.blockStamCost);
  const jediSlots = [['ab-push','push',abil('push').cost],['ab-slam','slam',abil('jslam').cost],
                ['ab-throw','throw',abil('throw').cost],
                ['ab-pull','pull',abil('pull').cost],['ab-judge','judge',abil('judge').cost],
                ['ab-repulse','repulse',abil('repulse').cost],['ab-barrier','barrier',abil('barrier').cost],
                ['ab-mend','mend',abil('mend').cost]];
  for (const [id, key, cost] of jediSlots) cdSlot(id, key, cost);
  dashSlot();
}

/* MANDO SHIFT: what it does right now (DIVE on the ground, AIR DODGE in the air), with
   pips for the air-dodge jet charges. */
function mandoShiftSlot(){
  const el = $('ab-boost'); if (!el) return;
  const A = MANDO_MOBILITY.airDodge, n = player.jetCharges ?? A.charges, fight = inCombat(), air = !player.grounded;
  if (!el._chg){ el.insertAdjacentHTML('beforeend', '<span class="chg"></span>'); el._chg = el.querySelector('.chg'); }
  setHtml(el._chg, '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(Math.max(0, A.charges - n)));
  const fl = player.flip, diving = !!fl && fl.kind === 'dive' && !fl.landT;   // in a dive's air SHIFT is the jet dive
  const cool = diving ? (!!fl.jet || player.jet < MANDO_MOBILITY.dive.jet.fuel)
             : air ? (player.jet < A.fuel || (fight && n < 1)) : player.cds.roll > 0;
  el.classList.toggle('cool', cool);
  setText(el.querySelector('.an'), diving ? 'JET DIVE' : air ? 'AIR DODGE' : 'DIVE');
}

/* DASH: pips for the Force dash charges, the shade showing the next one refilling. Out of a fight the dash is free:
   the slot reads ready whatever the charges say. */
function dashSlot(){
  const el = $('ab-dash'); if (!el || el.style.display === 'none') return;
  const max = maxCharges(), n = player.dashCharges ?? max, fight = inCombat();
  if (!el._chg){ el.insertAdjacentHTML('beforeend', '<span class="chg"></span>'); el._chg = el.querySelector('.chg'); }
  setHtml(el._chg, '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(Math.max(0, max - n)));
  const empty = fight && n < 1;
  el.style.setProperty('--cd', empty ? (1 - (player.dashRecharge || 0)).toFixed(3) : '0');
  el.classList.toggle('cool', empty);
  el.classList.toggle('nofp', fight && !empty && player.force < MOBILITY.dash.cost * (formMob().dashCost ?? 1));
  setText(el.querySelector('.an'), fight ? 'ROLL' : 'DASH');
}
