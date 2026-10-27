// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Darth Vexis: build, spawn, damage, stagger, AI, shockwave rings.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { stamDelay } from '../player/stamina.js';
import { LEVELS } from '../data/levels.js';
import { BOSS_CFG, BOSS_MANDO, BOSS_GAIT } from '../data/bosses.js';
import { updateLegs } from '../enemies/gait.js';
import { scene } from '../engine/renderer.js';
import { sfx, S } from '../audio/sfx.js';
import { V3, rand, TMP } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, bolts, rings, player } from '../state.js';
import { fwd, playerPos } from '../player/helpers.js';
import { SCALE, heroScale } from '../data/coop.js';
import { heroesHere } from '../player/players.js';
import { bossTelegraph } from '../enemies/damage.js';
import { fireBolt } from '../enemies/bolts.js';
import { updateBossLightFX } from './light.js';
import { buildBoss } from './mesh.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { TELLS, tellFx } from '../fx/tells.js';
import { clampToArena } from '../world/collision.js';
import { hurtPlayer, perfectDodge } from '../player/damage.js';
import { queueSpawn } from '../game/flow.js';
import { gainXp } from '../game/progression.js';
import { victory } from '../game/summary.js';
import { showBanner } from '../ui/banners.js';
import { diffHpMul } from '../data/difficulty.js';
import { hideIndicators } from '../enemies/cleanup.js';

/* ============================================================
   BOSS — DARTH VEXIS
   ============================================================ */
export function spawnBoss(){
  const half = LEVELS[G.levelIdx].arena/2;
  const mando = G.hero === 'mando';
  const kind = mando ? 'mando' : 'sith';
  const hp = Math.round((mando ? BOSS_MANDO.hp : BOSS_CFG.hp) * diffHpMul() * heroScale(SCALE.bossHp, heroesHere()));   // DIFFICULTY scales the boss too
  const g = buildBoss(kind);
  g.userData.gait = { bob: BOSS_GAIT.bob, lean: BOSS_GAIT.lean, step(o, at){   // a footfall: dust and a thud near the hero
    const p = playerPos(), d = Math.hypot(at.x - p.x, at.z - p.z);
    if (d < BOSS_GAIT.thudRange){ G.shake = Math.max(G.shake, BOSS_GAIT.thud * (1 - d / BOSS_GAIT.thudRange * 0.6)); burst(V3(at.x, at.y + 0.1, at.z), BOSS_GAIT.dust, 3, 2, 2, 0.5); }
  } };
  g.position.set(0, 0, -half + 6);
  scene.add(g);
  bossMv.x = bossMv.z = bossMv.pivot = 0;
  shared.boss = {
    group: g, hp, maxHp: hp, phase: 1, kind,
    armor: mando ? BOSS_MANDO.armor : BOSS_CFG.armor,
    state: 'intro', st: 2.5, swingsLeft: 0, flash: 0,
    lightningCd: 4, pulseCd: 3, blinkCd: 6, volleyCd: 5, summoned: false, summonCd: 12,
    lightT: 0, lightCatch: 0, lightTick: 0,
    staggerImmuneT: 0, staggerCount: 0, blinked: false, volleyLeft: 0, enraged: false,   // anti-cheese + new-attack bookkeeping
  };
  const name = mando ? BOSS_MANDO.name : BOSS_CFG.name;
  document.getElementById('bossname').textContent = name;
  document.getElementById('bosswrap').style.display = 'block';
  const introMain = mando ? 'THE IRON MAGISTRATE' : 'DARTH VEXIS';
  const introTip = mando
    ? 'A beskar warlord — his armor laughs off chip fire. BRACE (RMB) his barrage, break his line of sight, and punish his wind-up.'
    : 'The dark side made flesh. Catch his lightning on your guard, or PUSH it back.';
  showBanner(introMain, introTip, 4);
  S.stun(); if (shared.boss) S.roar(shared.boss.group.position);
}

export function damageBoss(dmg, tick){
  if (!shared.boss || shared.boss.hp <= 0) return;
  const vulnerable = shared.boss.state === 'stunned' || shared.boss.state === 'vulnerable';
  // later PHASES toughen up — they shrug off high-tier ults/ordnance/Darksaber so they can't be melted instantly
  const cfg = (shared.boss.kind === 'mando' ? BOSS_MANDO : BOSS_CFG);
  const pr = cfg.phaseResist;
  const resist = (pr && pr[(shared.boss.phase || 1) - 1] != null) ? pr[(shared.boss.phase || 1) - 1] : 1;
  let real = (vulnerable ? dmg : dmg * (shared.boss.armor != null ? shared.boss.armor : BOSS_CFG.armor)) * resist;
  // ANTI-BURST CAP — a single instance can't delete a huge slice of the bar. A landed ult still hits HARD inside a
  // stagger window (higher cap), but spamming high-tier abilities from range no longer melts him in a few clicks.
  if (!tick){
    const cap = shared.boss.maxHp * (vulnerable ? (cfg.hitCapVuln || 0.18) : (cfg.hitCapBase || 0.10));
    if (real > cap){ real = cap; if (!vulnerable) floater(V3(shared.boss.group.position.x, 3.0, shared.boss.group.position.z), 'ARMOR HOLDS', '#cc99ff'); }
  }
  shared.boss.hp -= real;
  shared.boss.flash = Math.max(shared.boss.flash, tick ? 0.05 : 0.12);
  if (tick){
    // flamethrower DoT — pool the numbers and ember instead of spamming every frame
    shared.boss.burn = (shared.boss.burn || 0) + real;
    if (shared.boss.burn >= 14){ floater(V3(shared.boss.group.position.x, 2.6, shared.boss.group.position.z), Math.round(shared.boss.burn), '#ff9a3a'); shared.boss.burn = 0; }
    if (Math.random() < 0.4) burst(V3(shared.boss.group.position.x + rand(-0.4,0.4), rand(1.6,2.8), shared.boss.group.position.z + rand(-0.4,0.4)), 0xff7a1a, 1, 2, 3, 0.7);
    if (shared.boss.hp <= 0) killBoss();
    return;
  }
  floater(shared.boss.group.position, Math.round(real), vulnerable ? '#ffd24a' : '#cc8888');
  burst(V3(shared.boss.group.position.x, 2.4, shared.boss.group.position.z), vulnerable ? 0xffd24a : 0x884444, 6, 6, 4);
  S.impact(V3(shared.boss.group.position.x, 2.4, shared.boss.group.position.z), vulnerable ? 1.2 : 0.7);
  if (shared.boss.hp <= 0) killBoss();
}
export function bossStun(){
  if (!shared.boss || shared.boss.hp <= 0) return;
  shared.boss.state = 'stunned'; shared.boss.st = BOSS_CFG.lightning.reflectStun;
  G.shake = Math.max(G.shake, 1); G.hitstop = Math.max(G.hitstop, 0.1);
  showBanner('REFLECTED!', 'He is staggered — STRIKE NOW!', 2);
  S.stun();
  const pr = BOSS_CFG.phaseResist[(shared.boss.phase || 1) - 1] ?? 1;   // later phases blunt the reflected storm too
  const dmg = Math.round(BOSS_CFG.lightning.reflectDmg * pr);
  shared.boss.hp -= dmg;
  shared.boss.flash = 0.2;
  floater(shared.boss.group.position, dmg, '#ffd24a');
  if (shared.boss.hp <= 0) killBoss();
}
// an ABILITY stagger — a rocket/Force-power to the wind-up opens him up. Now with DIMINISHING RETURNS + a brief
// immunity so you can't perma-stunlock the boss by chaining high-tier abilities: each opening is shorter, and after
// one he RESISTS the next for a few seconds (a quick flinch instead). Parry/reflect openings bypass this (earned skill).
export function bossStagger(){
  if (!shared.boss || shared.boss.hp <= 0 || shared.boss.state === 'stunned' || shared.boss.state === 'dying') return;
  const cfg = (shared.boss.kind === 'mando' ? BOSS_MANDO : BOSS_CFG);
  if (shared.boss.staggerImmuneT > 0){   // resisting — a small flinch, not a full opening
    floater(V3(shared.boss.group.position.x, 2.8, shared.boss.group.position.z), 'RESISTED', '#cc99ff');
    burst(V3(shared.boss.group.position.x, 2.5, shared.boss.group.position.z), 0x9a6aff, 6, 5, 3);
    G.shake = Math.max(G.shake, 0.22);
    return;
  }
  shared.boss.staggerCount = (shared.boss.staggerCount || 0) + 1;
  const dur = Math.max(0.9, (cfg.combo.vulnTime || 2.0) * Math.pow(0.8, shared.boss.staggerCount - 1));   // shorter each time
  shared.boss.state = 'vulnerable'; shared.boss.st = Math.max(shared.boss.st, dur);
  shared.boss.staggerImmuneT = dur + (cfg.staggerImmune || 3.4);   // can't be re-staggered until this passes
  shared.boss.swingsLeft = 0;
  if (shared.bossLight) shared.bossLight.visible = false; shared.boss.lightT = 0;
  shared.boss.group.userData.hand.rotation.z = 0.9;
  G.shake = Math.max(G.shake, 0.7); G.hitstop = Math.max(G.hitstop, 0.09);
  burst(V3(shared.boss.group.position.x, 2.5, shared.boss.group.position.z), 0xffd24a, 18, 9, 5);
  floater(shared.boss.group.position, 'STAGGERED — OPEN!', '#ffd24a');
  S.stun();
}
function killBoss(){
  if (!shared.boss || shared.boss.state === 'dying') return;   // never re-enter the death sequence
  shared.boss.hp = 0;
  shared.boss.state = 'dying'; shared.boss.st = 1.4;
  if (G.stats) G.stats.bossKilled = true;
  gainXp(1400);   // the Herald's bounty — a climactic payout worthy of felling the boss
  if (shared.bossLight) shared.bossLight.visible = false;
  // a brief, BOUNDED kill-cam — slowmoT lets it recover on its own instead of sticking in slow motion
  G.slowmo = 0.35; G.slowmoT = Math.max(G.slowmoT, 0.6); G.shake = 1.2;
  // the fight is OVER — clear his summoned minions, pending spawns, shockwaves and lingering bolts
  G.spawnQueue.length = 0;
  for (const e of enemies){ if (!e.dead){ e.dead = true; e.state = 'fade'; e.st = 0.6; hideIndicators(e); } }
  for (const r of rings) scene.remove(r.mesh); rings.length = 0;
  for (let i = bolts.length-1; i >= 0; i--){ if (!bolts[i].friendly){ scene.remove(bolts[i].mesh); bolts.splice(i,1); } }
  showBanner(shared.boss.kind === 'mando' ? 'THE MAGISTRATE FALLS' : 'THE VOID RECLAIMS ITS HERALD', '', 3);
  burst(shared.boss.group.position.clone().setY(2), shared.boss.kind === 'mando' ? 0xffaa33 : 0xff4444, 40, 14, 10);
  burst(shared.boss.group.position.clone().setY(2), shared.boss.kind === 'mando' ? 0x66ccff : 0xbb44ff, 30, 10, 8);
  S.roar(shared.boss.group.position); S.boom(shared.boss.group.position, 2);
}

// his signature channel: Vexis's Force lightning, or the Magistrate's blaster barrage (same state, boss.kind decides)
function startLightning(){
  const b = shared.boss;
  b.state = 'lightning';
  b.lightT = b.phase === 3 ? BOSS_CFG.lightning.durP3 : BOSS_CFG.lightning.dur;
  b.lightCatch = 0; b.lightTick = 0;
  b.lightningCd = BOSS_CFG.lightning.cd;
  showBanner('', b.kind === 'mando' ? 'BLASTER BARRAGE — BRACE (RMB) to soak it or break his line of sight!' : 'FORCE LIGHTNING — raise guard (RMB) to catch it, or PUSH it back!', 1.8);
}

// the walk-up's momentum: the hero's accel / brake / pivot (data/movement.js) with the boss's weight (BOSS_GAIT)
const bossMv = { x: 0, z: 0, pivot: 0 };
function bossStride(wx, wz, dt){
  const sp = Math.hypot(bossMv.x, bossMv.z), want = Math.hypot(wx, wz);
  if (bossMv.pivot > 0) bossMv.pivot -= dt;
  else if (sp > BOSS_GAIT.pivotMinSpeed && want > 0 && wx * bossMv.x + wz * bossMv.z < Math.cos(BOSS_GAIT.pivotAngle) * want * sp) bossMv.pivot = BOSS_GAIT.pivotTime;
  if (bossMv.pivot > 0){ wx = wz = 0; }
  const dx = wx - bossMv.x, dz = wz - bossMv.z, dl = Math.hypot(dx, dz);
  const against = bossMv.pivot > 0 || wx * bossMv.x + wz * bossMv.z < 0;
  if (dl > 1e-3){ const a = Math.min(dl, (against ? BOSS_GAIT.brake : BOSS_GAIT.accel) * dt) / dl; bossMv.x += dx * a; bossMv.z += dz * a; }
}
export function updateBoss(dt){
  if (!shared.boss) return;
  const g = shared.boss.group, pp = playerPos();
  shared.boss.st -= dt;
  // SAFETY NET — any damage path that drains him to 0 triggers death, even mid-attack.
  // Fixes the boss occasionally fighting on with an empty health bar.
  if (shared.boss.state !== 'dying' && shared.boss.hp <= 0) killBoss();
  if (shared.boss.flash > 0){ shared.boss.flash -= dt; g.userData.bodyMat.emissive.setHex(0xff5544); g.userData.bodyMat.emissiveIntensity = 2; }
  else if (shared.boss.enraged){ g.userData.bodyMat.emissive.setHex(0x661414); g.userData.bodyMat.emissiveIntensity = 0.35 + Math.sin(G.gt*5)*0.18; }   // PHASE III rage aura
  else g.userData.bodyMat.emissiveIntensity = 0;

  // phase transitions — never re-trigger once he's dying (the killing blow used to fake a "PHASE III" + summon)
  const frac = shared.boss.hp / shared.boss.maxHp;
  const newPhase = frac <= BOSS_CFG.phaseAt[2] ? 3 : frac <= BOSS_CFG.phaseAt[1] ? 2 : 1;
  if (shared.boss.state !== 'dying' && shared.boss.hp > 0 && newPhase > shared.boss.phase){
    shared.boss.phase = newPhase;
    const md = shared.boss.kind === 'mando';
    if (newPhase === 2) showBanner('PHASE II', md ? 'He kicks his thrusters live — watch for the ground-pound.' : 'He calls on deeper darkness — watch the ground.', 2.5);
    if (newPhase === 3){
      shared.boss.enraged = true;   // ENRAGE — faster cooldowns, longer combos, a relentless press
      showBanner('PHASE III', md ? 'No quarter — he charges, he volleys, his clan keeps coming.' : 'Unlimited power — he blinks onto you and the nova widens. Stay moving.', 2.6);
      if (!shared.boss.summoned){
        shared.boss.summoned = true;
        for (const tn in BOSS_CFG.summon)
          for (let i = 0; i < BOSS_CFG.summon[tn]; i++) queueSpawn(tn);
      }
    }
    G.shake = 0.8;
  }
  const speed = BOSS_CFG.speed[shared.boss.phase-1];

  const toP = TMP.subVectors(pp, g.position); toP.y = 0;
  const dist = toP.length(); toP.normalize();
  const tx = toP.x, tz = toP.z;
  const st0 = shared.boss.state, walkUp = st0 === 'intro' || st0 === 'think' || st0 === 'chase';
  if (st0 !== 'stunned' && st0 !== 'dying'){
    // walking up he turns at a heavy capped rate; his attacks (windups, lightning, volleys) still aim as before
    const want = Math.atan2(tx, tz);
    if (walkUp){ const d = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)); g.rotation.y += Math.max(-BOSS_GAIT.turn * dt, Math.min(BOSS_GAIT.turn * dt, d)); }
    else g.rotation.y = want;
  }
  if (st0 !== 'chase' && st0 !== 'intro'){ bossMv.x = bossMv.z = 0; bossMv.pivot = 0; }   // momentum belongs to the walk-up

  switch (shared.boss.state){
    case 'intro':
      bossStride(tx * 3, tz * 3, dt); g.position.x += bossMv.x * dt; g.position.z += bossMv.z * dt;
      if (shared.boss.st <= 0) shared.boss.state = 'think';
      break;
    case 'think': {
      const md = shared.boss.kind === 'mando';
      if (shared.boss.lightningCd <= 0 && dist <= 6){
        // hugging him no longer dodges his signature: he breaks away first (a dark slide / a jet hop back)
        shared.boss.state = 'retreat'; shared.boss.st = BOSS_CFG.retreat.time; shared.boss.retreated = false;
      } else if (shared.boss.lightningCd <= 0 && dist > 6){
        startLightning();
      } else if (md && shared.boss.phase >= 2 && shared.boss.volleyCd <= 0 && dist > 7){
        const V = BOSS_MANDO.volley;
        shared.boss.state = 'volley'; shared.boss.st = V.rounds*V.gap + 0.3; shared.boss.volleyLeft = V.rounds; shared.boss.lightTick = 0.12; shared.boss.volleyCd = V.cd;
        showBanner('', 'AIMED VOLLEY — he leads your strafe. Break pattern, weave it!', 1.4);
      } else if (shared.boss.blinkCd <= 0 && dist > (md ? BOSS_MANDO.blink.range : BOSS_CFG.blink.range)){
        shared.boss.state = 'gapclose'; shared.boss.st = md ? 0.95 : 0.5; shared.boss.blinked = false;
        shared.boss.blinkCd = (md ? BOSS_MANDO.blink.cd : BOSS_CFG.blink.cd);
        showBanner('', md ? 'JET CHARGE — he closes the distance!' : 'DARK BLINK — he will not let you kite!', 1.3);
      } else if (shared.boss.phase >= 2 && shared.boss.pulseCd <= 0 && dist < 9){
        shared.boss.state = 'pulse'; shared.boss.st = 0.7;
        tellFx('dodge', g.position, 7, 0.7);   // the nova is dodge-only: the shared red tell
        shared.boss.pulseCd = BOSS_CFG.pulse.cd;
      } else if (dist > BOSS_CFG.combo.range - 0.5){
        shared.boss.state = 'chase'; shared.boss.st = 4;
      } else {
        shared.boss.state = 'windup'; shared.boss.st = BOSS_CFG.combo.windup;
        shared.boss.swingsLeft = BOSS_CFG.combo.swings + (shared.boss.enraged ? 1 : 0);   // ENRAGE — longer melee chains
        bossTelegraph(g, tx, tz);
      }
      break;
    }
    case 'chase':
      bossStride(tx * speed, tz * speed, dt);
      g.position.x += bossMv.x * dt;
      g.position.z += bossMv.z * dt;
      if (dist < BOSS_CFG.combo.range - 0.5 || shared.boss.st <= 0) shared.boss.state = 'think';
      break;
    case 'windup': {
      // COIL hard, then HOLD reared back overhead — a long, unmistakable tell you can parry
      const wk = 1 - Math.max(shared.boss.st,0)/BOSS_CFG.combo.windup;
      const coil = Math.pow(wk, 0.5);
      g.userData.eyes.scale.set(1 + coil*1.6, 1 + coil*2.2, 1);
      g.userData.hand.rotation.z = -0.6 - coil * 2.7;            // saber hauled up and back
      g.rotation.x = -coil * 0.32;                               // lean into the load
      g.userData.bodyMat.emissive.setHex(0x6a0d1a);
      g.userData.bodyMat.emissiveIntensity = coil * 1.2 + Math.sin(G.gt*26)*0.2*coil;
      if (coil > 0.6 && Math.random() < 0.5)
        burst(V3(g.position.x + tx*0.5, 3.2, g.position.z + tz*0.5), 0xff2a40, 1, 3, 5, 0.8);
      if (shared.boss.st <= 0){
        // strike
        g.rotation.x = 0.22;
        g.userData.hand.rotation.z = 0.9;
        g.userData.eyes.scale.set(1,1,1);
        burst(V3(g.position.x + tx*2, 1.8, g.position.z + tz*2), 0xff3333, 10, 8, 3);
        G.shake = Math.max(G.shake, 0.35);
        S.swing('strong'); S.whoosh(g.position, true);
        if (dist < BOSS_CFG.combo.range && player.dashT > 0) perfectDodge(g.position);   // dashed through it on the beat
        else if (dist < BOSS_CFG.combo.range && player.dashT <= 0){
          const res = hurtPlayer(BOSS_CFG.combo.dmg, g.position, false, true);   // melee — high ground denies it
          if (res === 'clashed' && shared.boss.swingsLeft > 1){
            // your cut met his: the blades ring apart and he's thrown back a step, but the chain presses on
            // (no posture break: that's still the parry's reward). A clash on the last blow just ends the chain.
            shared.boss.swingsLeft--;
            shared.boss.state = 'windup'; shared.boss.st = BOSS_CFG.combo.windup * BOSS_CFG.combo.clashGap;
            g.position.x -= tx * 0.6; g.position.z -= tz * 0.6;
            g.userData.hand.rotation.z = -1.4;   // his blade knocked up and back off yours
            break;
          }
          if (res === 'parried'){
            if (shared.boss.swingsLeft > 1){
              // POSTURE — an early swing parried is only DEFLECTED: he reels a beat, then presses the chain on.
              // Deflect the whole chain and the last one breaks him wide open.
              shared.boss.swingsLeft--;
              shared.boss.state = 'windup'; shared.boss.st = BOSS_CFG.combo.windup * BOSS_CFG.combo.deflectGap;
              g.position.x -= tx * 0.8; g.position.z -= tz * 0.8;   // knocked back a step
              G.shake = Math.max(G.shake, 0.45); G.hitstop = Math.max(G.hitstop, 0.06);
              burst(V3(g.position.x, 2.4, g.position.z), 0xffd24a, 8, 7, 4);
              floater(g.position, 'DEFLECTED · ' + shared.boss.swingsLeft + ' MORE', '#ffe9a8');
              break;
            }
            // the chain's last blow parried: a full posture break, the biggest melee opening in the fight
            shared.boss.state = 'vulnerable'; shared.boss.st = BOSS_CFG.combo.breakTime;
            shared.boss.swingsLeft = 0;
            G.shake = Math.max(G.shake, 0.8); G.hitstop = Math.max(G.hitstop, 0.14);
            burst(V3(g.position.x, 2.4, g.position.z), 0xffd24a, 22, 10, 6);
            floater(g.position, 'POSTURE BROKEN!', '#ffd24a');
            break;
          }
        }
        shared.boss.swingsLeft--;
        if (shared.boss.swingsLeft > 0){
          shared.boss.state = 'windup'; shared.boss.st = BOSS_CFG.combo.windup * 0.7;
          g.position.x += tx * Math.max(0, Math.min(dist - 2, 2.5));   // step in
          g.position.z += tz * Math.max(0, Math.min(dist - 2, 2.5));
        } else {
          shared.boss.state = 'vulnerable'; shared.boss.st = BOSS_CFG.combo.whiffTime;   // a short breather — parrying pays more
          floater(g.position, 'OPENING!', '#ffd24a');
        }
      }
      break;
    }
    case 'vulnerable':
      g.userData.hand.rotation.z = 0.9;
      g.rotation.x = 0.18; // staggered lean
      if (shared.boss.st <= 0){ shared.boss.state = 'think'; g.rotation.x = 0; g.userData.hand.rotation.z = -0.6; }
      break;
    case 'lightning': {
      // THE IRON MAGISTRATE's signature: a relentless BLASTER BARRAGE (no Force). Real hostile bolts you
      // BRACE to soak, strafe behind cover to break, or darksaber-deflect — all handled by the bolt system.
      if (shared.boss.kind === 'mando'){
        const B = BOSS_MANDO.barrage;
        g.userData.hand.rotation.z = -1.5 + Math.sin(G.gt*18)*0.12;   // tracking the muzzle on you
        g.userData.bodyMat.emissive.setHex(0x553311); g.userData.bodyMat.emissiveIntensity = 0.8 + Math.sin(G.gt*22)*0.3;
        shared.boss.lightTick -= dt;
        if (shared.boss.lightTick <= 0){
          shared.boss.lightTick = B.fireGap;
          const muzzle = V3(g.position.x + tx*0.9, 2.6, g.position.z + tz*0.9);
          const aimAt = V3(pp.x + rand(-B.spread, B.spread), pp.y + 1.4 + rand(-0.4, 0.4), pp.z + rand(-B.spread, B.spread));
          const dir = aimAt.sub(muzzle).normalize();
          fireBolt(muzzle, dir, B.boltSpeed, B.dmg, false, false, shared.boss);
          const bb = bolts[bolts.length-1]; if (bb){ bb.mesh.material.color.setHex(0xffaa33); bb.mesh.scale.set(1.3,1.6,1.3); }
          burst(muzzle, 0xffd28a, 2, 6, 1, 0.5);
        }
        shared.boss.lightT -= dt;
        if (shared.boss.lightT <= 0){ g.userData.bodyMat.emissiveIntensity = 0; shared.boss.state = 'think'; g.userData.hand.rotation.z = -0.6; }
        break;
      }
      g.userData.hand.rotation.z = -2.4;
      const L = BOSS_CFG.lightning;
      const handPt = V3(g.position.x + tx*0.6, 2.6, g.position.z + tz*0.6);
      // is the player guarding toward the boss?
      const facingBoss = (fwd().x*(-tx) + fwd().z*(-tz)) > 0.25;
      const guarding = player.blockHeld && player.stam > 0 && facingBoss && player.dashT <= 0;
      let endPt, col;
      if (guarding){
        // caught on the blade — a tug of war that ends in a reflect
        shared.boss.lightCatch += dt;
        player.stam = Math.max(0, player.stam - 16*dt);
        player.stamDelay = stamDelay();
        endPt = V3(pp.x + fwd().x*1.1, 1.55, pp.z + fwd().z*1.1);
        if (Math.random() < 0.6) burst(endPt, 0xbfe8ff, 1, 4, 4, 0.7);
        if (shared.boss.lightCatch >= L.catchTime || player.stam <= 0){
          if (shared.boss.lightCatch >= L.catchTime){
            shared.bossLight.visible = false; shared.boss.lightT = 0;
            floater(pp, 'REFLECTED!', '#ffd24a');
            bossStun();   // leaves him STUNNED (this used to be overwritten with 'think' right after, so the stun never happened)
            g.userData.hand.rotation.z = -0.6;
            break;
          }
        }
        col = 0x88ddff;
      } else {
        endPt = V3(pp.x, 1.5, pp.z);
        shared.boss.lightTick -= dt;
        if (shared.boss.lightTick <= 0){
          shared.boss.lightTick = L.tick;
          if (player.dashT <= 0) hurtPlayer(L.tickDmg, null);   // arcs past the guard if you're not facing it
          if (Math.random() < 0.7) burst(V3(pp.x, 1.4, pp.z), 0xcc66ff, 2, 4, 3);
        }
        shared.boss.lightCatch = Math.max(0, shared.boss.lightCatch - dt*0.6);
        col = 0xcc55ff;
      }
      updateBossLightFX(handPt, endPt, col);
      shared.boss.lightT -= dt;
      if (shared.boss.lightT <= 0){
        if (shared.bossLight) shared.bossLight.visible = false;
        shared.boss.state = 'think'; g.userData.hand.rotation.z = -0.6;
      }
      break;
    }
    case 'pulse':
      if (shared.boss.st > 0.2) g.position.y += dt*5;
      else if (g.position.y > 0){
        g.position.y = 0;
        // NOVA — later phases emit a stack of concentric waves; you must dash/jump EACH one, not just the first
        const rcfg = ((shared.boss.kind === 'mando' ? BOSS_MANDO.pulse : BOSS_CFG.pulse).rings) || [1];
        const n = rcfg[shared.boss.phase-1] || 1;
        for (let i = 0; i < n; i++) spawnRing(g.position.clone(), 1 - i*6);
        G.shake = 0.9; S.slam(g.position);
      }
      if (shared.boss.st <= 0){ shared.boss.state = 'think'; g.position.y = 0; }
      break;
    case 'gapclose': {
      // ANTI-KITE — Vexis DARK-BLINKS onto you; the Magistrate JET-CHARGES. Either way, kiting at range no longer works.
      const md = shared.boss.kind === 'mando';
      if (md){
        g.position.x += tx * 22 * dt; g.position.z += tz * 22 * dt;   // boost straight in
        g.userData.bodyMat.emissive.setHex(0x335a88); g.userData.bodyMat.emissiveIntensity = 1.2;
        if (Math.random() < 0.6) burst(V3(g.position.x - tx*0.7, 1.7, g.position.z - tz*0.7), 0x66ccff, 1, 6, 4, 0.6);
        if (dist < BOSS_CFG.combo.range + 0.4 || shared.boss.st <= 0){
          g.userData.bodyMat.emissiveIntensity = 0;
          shared.boss.state = 'windup'; shared.boss.st = BOSS_CFG.combo.windup * 0.8; shared.boss.swingsLeft = 2 + (shared.boss.enraged?1:0); bossTelegraph(g, tx, tz);
        }
        break;
      }
      g.userData.bodyMat.emissive.setHex(0x7a1aff);
      g.userData.bodyMat.emissiveIntensity = 1.5 + Math.sin(G.gt*40)*0.5;
      if (!shared.boss.blinked && shared.boss.st <= 0.2){
        shared.boss.blinked = true;
        burst(V3(g.position.x, 1.8, g.position.z), 0x8a3aff, 16, 9, 6); spawnGroundShock(g.position.clone(), 0x8a3aff, 3, 0.4, 0.5);
        g.position.x = pp.x - tx * BOSS_CFG.blink.dist; g.position.z = pp.z - tz * BOSS_CFG.blink.dist;   // reappear right on top of you
        burst(V3(g.position.x, 1.8, g.position.z), 0x8a3aff, 18, 10, 6);
        G.shake = Math.max(G.shake, 0.6); S.pull(); S.zap(g.position);
      }
      if (shared.boss.st <= 0){
        g.userData.bodyMat.emissiveIntensity = 0;
        shared.boss.state = 'windup'; shared.boss.st = BOSS_CFG.combo.windup * 0.85; shared.boss.swingsLeft = 1 + (shared.boss.enraged?1:0); bossTelegraph(g, tx, tz);
      }
      break;
    }
    case 'retreat': {   // a quick backward slide out of saber reach, then straight into lightning / the barrage
      const md = shared.boss.kind === 'mando';
      g.userData.bodyMat.emissive.setHex(md ? 0x335a88 : 0x7a1aff);
      g.userData.bodyMat.emissiveIntensity = 1.2;
      if (!shared.boss.retreated && shared.boss.st <= BOSS_CFG.retreat.time * 0.5){
        shared.boss.retreated = true;
        burst(V3(g.position.x, 1.8, g.position.z), md ? 0x66ccff : 0x8a3aff, 12, 8, 5);
        g.position.x -= tx * BOSS_CFG.retreat.dist; g.position.z -= tz * BOSS_CFG.retreat.dist;
        clampToArena(g.position, null, null);
        burst(V3(g.position.x, 1.8, g.position.z), md ? 0x66ccff : 0x8a3aff, 12, 8, 5);
        sfx(md ? 260 : 170, 0.18, 'sawtooth', 0.08, md ? 120 : 600);
      }
      if (shared.boss.st <= 0){ g.userData.bodyMat.emissiveIntensity = 0; startLightning(); }   // even if a wall stopped the slide
      break;
    }
    case 'volley': {
      // THE MAGISTRATE — a quick AIMED burst that LEADS your strafe (punishes predictable kiting; weave it)
      const V = BOSS_MANDO.volley;
      g.userData.hand.rotation.z = -1.5;
      g.userData.bodyMat.emissive.setHex(0x884422); g.userData.bodyMat.emissiveIntensity = 0.9 + Math.sin(G.gt*20)*0.3;
      shared.boss.lightTick -= dt;
      if (shared.boss.lightTick <= 0 && shared.boss.volleyLeft > 0){
        shared.boss.lightTick = V.gap; shared.boss.volleyLeft--;
        const muzzle = V3(g.position.x + tx*0.9, 2.6, g.position.z + tz*0.9);
        const lead = V3(pp.x + player.vel.x*V.lead, pp.y + 1.4, pp.z + player.vel.z*V.lead).sub(muzzle).normalize();
        fireBolt(muzzle, lead, V.boltSpeed, V.dmg, false, false, shared.boss);
        const bb = bolts[bolts.length-1]; if (bb){ bb.mesh.material.color.setHex(0xff7a2a); bb.mesh.scale.set(1.5,1.9,1.5); }
        burst(muzzle, 0xffae5a, 3, 7, 1, 0.5);
      }
      if (shared.boss.volleyLeft <= 0 && shared.boss.st <= 0){ g.userData.bodyMat.emissiveIntensity = 0; shared.boss.state = 'think'; g.userData.hand.rotation.z = -0.6; }
      break;
    }
    case 'stunned':
      g.rotation.x = 0.35;
      if (Math.random() < 0.3) burst(V3(g.position.x, 2.5, g.position.z), 0xbb88ff, 2, 4, 3);
      if (shared.boss.st <= 0){ shared.boss.state = 'think'; g.rotation.x = 0; }
      break;
    case 'dying':
      g.rotation.x += dt * 0.5;
      g.position.y -= dt * 0.4;
      g.scale.multiplyScalar(Math.max(0.01, 1 - dt*0.25));
      if (shared.boss.st <= 0){
        scene.remove(g);
        shared.boss = null;
        document.getElementById('bosswrap').style.display = 'none';
        G.slowmo = 1;
        if (G.sandbox) showBanner('', 'BOSS DEFEATED', 1.6);   // the training room: no victory screen, just the floor back
        else victory();
        return;
      }
      break;
  }
  // LEGS — the troopers' planted-foot gait on what he actually did this frame (enemies/gait.js): a walk until phase III,
  // a run after; jet boosts, hops and slides leave the ground; the death sequence lets them go
  const sNow = shared.boss.state;
  updateLegs(shared.boss, g, dt, sNow === 'dying' ? 'off' : (sNow === 'gapclose' || sNow === 'pulse' || sNow === 'retreat') ? 'air'
    : (shared.boss.phase < 3 && (sNow === 'chase' || sNow === 'intro' || sNow === 'think')) ? 'walk' : 'ground');
  const cdRate = shared.boss.enraged ? 1.6 : 1;   // ENRAGE — abilities come off cooldown faster in phase III
  // the signature's cooldown only runs once the channel is over, so even enraged he fights between casts
  if (shared.boss.state !== 'lightning' && shared.boss.state !== 'retreat') shared.boss.lightningCd -= dt*cdRate;
  shared.boss.pulseCd -= dt*cdRate; shared.boss.blinkCd -= dt*cdRate; shared.boss.volleyCd -= dt*cdRate;
  shared.boss.staggerImmuneT -= dt; shared.boss.summonCd -= dt;
  // PHASE III reinforcements — a steady trickle so you can't just turtle and out-DPS him in the open
  if (shared.boss.phase === 3 && shared.boss.state !== 'dying' && shared.boss.summonCd <= 0){
    let alive = 0; for (const e of enemies) if (!e.dead) alive++;
    if (alive < 6){ queueSpawn('grunt'); queueSpawn(shared.boss.kind === 'mando' ? 'blaster' : 'flyer'); }
    shared.boss.summonCd = 14;
  }
  clampToArena(g.position, null, null);
  document.getElementById('bossbar').style.width = Math.max(0, shared.boss.hp/shared.boss.maxHp*100) + '%';
}

/* expanding shockwave ring (boss pulse) — dash or jump to avoid */
function spawnRing(pos, r0){
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.3, 8, 40),
    new THREE.MeshBasicMaterial({ color: TELLS.dodge.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = Math.PI/2; m.position.copy(pos); m.position.y = 0.4;
  scene.add(m);
  rings.push({ mesh: m, r: (r0 != null ? r0 : 1), center: pos.clone(), hitPlayer: false });   // r0<1 = a later wave in a NOVA stack
}
export function updateRings(dt){
  const pp = playerPos();
  for (let i = rings.length-1; i >= 0; i--){
    const r = rings[i];
    r.r += BOSS_CFG.pulse.growSpeed * dt;
    r.mesh.visible = r.r > 0.3;                                  // a later NOVA wave (r0<0) stays hidden until it emerges
    r.mesh.scale.set(Math.max(0.01, r.r), Math.max(0.01, r.r), 1);
    r.mesh.material.opacity = Math.max(0, 0.85 * (1 - r.r/BOSS_CFG.pulse.maxR));
    if (!r.hitPlayer && r.r > 0.3){
      const d = Math.hypot(pp.x - r.center.x, pp.z - r.center.z);
      if (Math.abs(d - r.r) < 1.0 && pp.y < 1.1 && player.dashT <= 0){
        r.hitPlayer = true;
        hurtPlayer(BOSS_CFG.pulse.dmg, null);   // shockwaves can't be blocked — jump or dash
      }
    }
    if (r.r > BOSS_CFG.pulse.maxR){ scene.remove(r.mesh); rings.splice(i,1); }
  }
}
