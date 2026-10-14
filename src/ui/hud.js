// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// updateHud(): per-frame HUD refresh.

import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { clamp } from '../utils.js';
import { shared, G, enemies, player } from '../state.js';
import { MANDO } from '../data/mando.js';
import { maxHp } from '../player/helpers.js';
import { FOCUS, focusTier } from '../player/jedi/focus.js';
import { mandoWeapon } from '../player/mando/weapons.js';
import { MUTATORS } from '../data/mutators.js';
import { nextStoreGoal } from '../game/progression.js';
import { updateBoonStrip } from '../game/boons.js';
import { renderThreats } from './threats.js';

export function updateHud(){
  document.getElementById('hpbar').style.width = (player.hp / maxHp() * 100) + '%';
  document.getElementById('fpbar').style.width = (player.force / CFG.player.maxForce * 100) + '%';
  updateBoonStrip();   // active-boon strip (no-op unless the set changed)
  renderThreats();     // directional damage arc + off-screen danger markers
  // HIT MARKER — pop an X at the crosshair when a shot lands (white hit · gold headshot · red kill)
  { const hm = document.getElementById('hitmark'), t = player.hitMarkT || 0;
    if (G.hero === 'mando' && t > 0){
      hm.style.opacity = Math.min(1, t * 1.5);
      hm.style.color = player.hitMarkKind === 'kill' ? '#ff4a4a' : player.hitMarkKind === 'head' ? '#ffd24a' : '#ffffff';
      hm.style.transform = 'translate(-50%,-50%) scale(' + (1 + t*0.4 + (player.hitMarkKind === 'kill' ? 0.25 : 0)).toFixed(2) + ')';
    } else hm.style.opacity = '0'; }
  // FORCE FOCUS meter — Jedi only
  const fcw = document.getElementById('fcwrap'), fcl = document.getElementById('fclabel');
  if (G.hero === 'mando'){ fcw.style.display = 'none'; fcl.style.display = 'none'; }
  else {
    fcw.style.display = ''; fcl.style.display = '';
    document.getElementById('fcbar').style.width = (player.focus || 0) + '%';
    const t = focusTier();
    fcl.textContent = t > 0 ? ('FOCUS · ' + FOCUS.names[t]) : 'FOCUS';
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
        ef.style.height = (player.stam / CFG.player.maxStam * 100) + '%';
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
        document.getElementById('xpmeterfill').style.width = (frac*100) + '%';
        xm.classList.toggle('ready', frac >= 1);
        document.getElementById('xpmetertxt').textContent = (frac >= 1 ? 'READY: ' : 'XP ' + (G.xp||0) + ' / ' + goal.cost + ' → ') + goal.nm;
      } else { document.getElementById('xpmeterfill').style.width = '100%'; xm.classList.remove('ready');
        document.getElementById('xpmetertxt').textContent = 'XP ' + (G.xp || 0); } } }
  const L = LEVELS[G.levelIdx];
  let alive = 0;
  for (const e of enemies) if (!e.dead && !e.converted) alive++;
  const total = alive + G.spawnQueue.length;
  if (G.endless){
    const mut = G.mut ? MUTATORS.find(m => m.id === G.mut) : null;
    document.getElementById('waveinfo').innerHTML = 'SURVIVAL · WAVE <b>' + G.endlessWave + '</b>' +
      (total > 0 ? '  ·  HOSTILES: ' + total : '') + (mut ? '  ·  <span style="color:'+mut.col+'">'+mut.name+'</span>' : '');
  } else {
    document.getElementById('waveinfo').textContent =
      L.name.split('—')[0].trim() + '  ·  WAVE ' + Math.min(G.wave+1, L.waves.length) + '/' + L.waves.length +
      (total > 0 ? '  ·  HOSTILES: ' + total : '') + (shared.boss ? '  ·  SITH LORD ENGAGED' : '');
  }
  if (G.hero === 'mando'){
    // weapon + ammo readout
    const W = mandoWeapon();
    document.getElementById('wpnLabel').textContent = W.name;
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
      braceEl.lastChild.textContent = W.melee ? 'GUARD' : W.twoHand ? 'SCOPE' : player.weapon === 'single' ? 'SHIELD' : 'BRACE';
      braceEl.classList.toggle('nofp', player.weapon === 'single' && player.blockHeld && player.stam <= 0);
    }
    // cooldown / fuel-gated abilities
    const cdab = [['ab-rocket','rocket',MANDO.rocket.cost],['ab-deto','deto',MANDO.deto.cost],
                  ['ab-birds','birds',MANDO.birds.cost],['ab-grapple','grapple',MANDO.grapple.cost],
                  ['ab-missile','missile',MANDO.jetMissile.cost],['ab-bacta','bacta',MANDO.bacta.cost]];
    for (const [id, key, cost] of cdab){
      const el = document.getElementById(id); if (!el) continue;
      el.classList.toggle('cool', player.cds[key] > 0);
      el.classList.toggle('nofp', player.cds[key] <= 0 && player.force < cost);
    }
    document.getElementById('ab-flame').classList.toggle('nofp', player.force < 5);
    document.getElementById('ab-flame').classList.toggle('cool', !!player.flaming);
    document.getElementById('ab-jet').classList.toggle('nofp', player.jet < 12);    // jet FUEL low
    document.getElementById('ab-jet').classList.toggle('cool', !!player.jetActive);
    document.getElementById('ab-boost').classList.toggle('cool', player.cds.dash > 0 || player.jet < MANDO.boostDash.fuel);
    document.getElementById('ab-mslam').classList.toggle('nofp', player.grounded || player.jet < MANDO.slam.cost);   // air-only, jet fuel
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
  const abil = [['ab-push','push',CFG.abilities.push.cost],['ab-slam','slam',CFG.abilities.slam.cost],
                ['ab-throw','throw',CFG.abilities.throw.cost],['ab-dash','dash',0],
                ['ab-pull','pull',CFG.abilities.pull.cost],['ab-judge','judge',CFG.abilities.judge.cost],
                ['ab-repulse','repulse',CFG.abilities.repulse.cost],['ab-barrier','barrier',CFG.abilities.barrier.cost],
                ['ab-mend','mend',CFG.abilities.mend.cost]];
  for (const [id, key, cost] of abil){
    const el = document.getElementById(id);
    el.classList.toggle('cool', player.cds[key] > 0);
    el.classList.toggle('nofp', player.cds[key] <= 0 && player.force < cost);
  }
}
