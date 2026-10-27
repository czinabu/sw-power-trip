// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Saber swings, parry, swing damage, and the Force kick.

import { CFG } from '../../data/config.js';
import { stamDelay } from '../stamina.js';
import { SWING_PATTERNS, backLineMul } from '../../data/stances.js';
import { SWING_SPINS, DEFLECT_SPINS } from '../../data/poses.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, barrels, keys, player } from '../../state.js';
import { fwd, playerPos, stance } from '../helpers.js';
import { damageEnemy, flinchEnemy, nearestEnemyInCone, staggerEnemy, interruptEnemy } from '../../enemies/damage.js';
import { damageBoss } from '../../boss/boss.js';
import { FOCUS, focusTier, focusDmgMul, addFocus } from './focus.js';
import { spawnHitSpark, spawnGroundShock } from '../../fx/vfx.js';
import { inkSprite, sparks, clashFlash } from '../../fx/ink.js';
import { DUEL } from '../../data/duel.js';
import { cutLine, duelDefend, isGuarding, guardImpact } from '../../enemies/duel.js';
import { bodyRadius } from './bladehit.js';
import { bounceOff, contactPoint } from './clash.js';
import { inReach } from '../../enemies/bodyshape.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { masteryXp } from '../../game/progression.js';
import { momentumStrike } from '../parkour.js';
import { MOVE } from '../../data/movement.js';

/* COMBO RHYTHM — fractions of a swing. A press before `open` is too early (and costs this link its flow); a single
   press from `open` on links in rhythm, and the next cut leaves at `at` (just after the follow-through). */
export const FLOW = { open: 0.5, at: 0.8 };

export function tryAttack(flow = false){
  // the blade is MID-FLIGHT (thrown) — no saber strikes until it returns to your hand. Force powers still work.
  if (shared.saberProj){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO BLADE', '#bfe8ff'); sfx(220, 0.06, 'sine', 0.04, 160); }
    return;
  }
  if (G.mode !== 'play' || player.blockHeld || player.judgeT > 0 || player.mendT > 0 || player.swingLock > 0 || player.mantle || player.hang || player.flinchT > 0) return;
  // input buffering, but ONLY in the back half of the current swing — early mashing is ignored so
  // the combo flows on rhythm instead of spraying three swings off one frantic burst of clicks.
  // A press in the back half queues the next cut. If that was the ONLY press this swing (no early click), the
  // link is IN RHYTHM: the next cut flows straight out of this one's follow-through (animation.js launches it at
  // FLOW.at) instead of waiting out the recovery. Mashing still chains, just without the flow.
  if (player.atkT > 0){
    const sw = player.swing;
    if (!sw || sw.recoil) return;   // thrown back off a blade: nothing chains out of it
    if (sw.t > sw.dur * FLOW.open) player.queuedAtk = true;
    else sw.rushed = true;
    return;
  }
  const st = stance();
  const step = (G.gt - player.lastAtkEnd < 0.9 * (st.comboGap || 1)) ? (player.comboStep + 1) % 3 : 0;
  // both the Jedi saber and the Mando DARKSABER spend stamina per swing (medium-high for the heavy darksaber)
  if (G.hero !== 'mando' || player.weapon === 'darksaber'){
    const cost = st.stamina * (step === 2 ? 1.4 : 1);
    if (player.stam < cost){
      if (G.gt - player.lastWinded > 0.6){ player.lastWinded = G.gt; floater(playerPos(), 'WINDED', '#ffaa66'); }
      return;
    }
    player.stam -= cost;
    player.stamDelay = stamDelay();
  }
  player.comboStep = step;
  // a cut out of a SLIDE ends the skid in a low sweep (parkour.js); any cut struck out of a parkour move carries its momentum
  if (player.slideT > 0){ player.slideT = 0; if (G.hero !== 'mando') player.flip = null; }
  const mom = momentumStrike();
  // slightly longer arcs read as deliberate sword strokes rather than a twitchy flurry
  const dur = (step === 2 ? 0.52 : 0.4) / (st.speed * (player.up.atkSpeed || 1));
  player.atkT = dur;
  // Jedi Academy style: swing direction follows your movement at the moment of attack
  let dirKey = 'neutral';
  if (keys['d']) dirKey = 'right';
  else if (keys['a']) dirKey = 'left';
  else if (keys['w']) dirKey = 'forward';
  else if (keys['s']) dirKey = 'back';
  // directional input drives the cut; standing swings ALTERNATE sides (never the same twirl twice),
  // and a finisher is an overhead chop.
  let pat;
  if (dirKey === 'neutral'){
    if (step === 2) pat = SWING_PATTERNS.forward;
    else { pat = player.swingFlip ? SWING_PATTERNS.diagL : SWING_PATTERNS.diagR; player.swingFlip = !player.swingFlip; }
  } else if (G.swingMirror && (dirKey === 'left' || dirKey === 'right')){
    // SWING preference: flip which side the strafe cut sweeps toward
    pat = SWING_PATTERNS[dirKey === 'left' ? 'right' : 'left'];
  } else {
    pat = SWING_PATTERNS[dirKey];
  }
  // RIPOSTE — the strike that follows a parry is a DECISIVE committed forward counter (overrides the chosen cut),
  // not just a normal swing that happens to hit harder. It reads as a clear, distinct answer.
  const ripNow = player.riposteT > 0;
  if (ripNow) pat = SWING_PATTERNS.forward;
  // BACK STRIKE — attacking while retreating (S) whirls the blade behind you to punish
  // anything closing on your back, knocking it away. No aim-assist turn: you stay facing forward.
  const backStrike = dirKey === 'back' && !ripNow;
  // the riposte is spent on THIS cut (it lands on whatever the blade meets first; see applySwingDamage)
  const cancelRip = ripNow && !!player.cancelRiposte;
  if (ripNow){ player.riposteT = 0; player.cancelRiposte = false; }
  player.swing = { t: 0, applied: false, step, dur, pat, dir: dirKey, back: backStrike, riposte: ripNow, cancelRip, flow, mom };
  player.deflectAnim = null;   // a cut takes the blade over from any catch in progress
  const spin = pickSpin(st.form, step, dirKey, { ripNow, backStrike, mom, flow, st });
  if (spin){
    player.stam -= spin.stam * st.stamina; player._spinT = G.gt; player.swing.spin = spin; player.swing.dur *= spin.dur; player.atkT = player.swing.dur; }
  // cinematic lunge toward nearest target in view — STRONG's finisher lunges harder; a RIPOSTE drives in hardest
  const lunge = ripNow ? 2.0 : ((step === 2 && st.finisherLunge) ? st.finisherLunge : st.lunge);
  const tgt = backStrike ? nearestEnemyInCone(CFG.player.comboRange, -0.35, true)
                         : nearestEnemyInCone(st.reach?.range ?? CFG.player.comboRange, 0.6);
  if (tgt && !backStrike){
    TMP.subVectors(tgt.group.position, playerPos()); TMP.y = 0;
    const d = TMP.length();
    TMP.normalize();
    // NO aim assist — you aim the cut yourself. The lunge only closes a short gap toward a foe you're already
    // facing; anything farther you have to walk into range first (footwork is part of the fight).
    if (d > 2.2) stepIntoCut(TMP, lunge * Math.min(d - 1.8, st.reach?.lungeMax ?? CFG.player.lungeMax) / 0.18);
  } else if (backStrike){
    stepIntoCut(fwd(), -4.5 * lunge);   // shove off the back foot, away from the threat
  } else {
    stepIntoCut(fwd(), 7 * lunge);   // step into the strike
  }
  if (spin) spinTravel(spin, dirKey);
  S.swing(G.hero === 'mando' ? 'dark' : G.stance);   // the blade's whoosh, voiced by form
  if (flow && G.hero !== 'mando') sfx(1250, 0.06, 'sine', 0.022, 1900);   // a faint ring: the link landed in rhythm
}
/* SPINS (data/poses.js SWING_SPINS) — which flourish, if any, this cut carries. Jedi only, on the ground, and never on a
   finisher (it has its own spin), a riposte, a back strike or a momentum strike. It must be a rhythm (flow) link, off
   cooldown, with the stamina to pay its surcharge. */
function pickSpin(form, step, dirKey, o){
  if (G.hero === 'mando' || !player.grounded || player.flip || step === 2 || o.ripNow || o.backStrike || o.mom) return null;
  const S = SWING_SPINS[form];
  if (!S || !o.flow) return null;
  const sp = (step === 1 && S.mid) || ((dirKey === 'left' || dirKey === 'right') ? S.move : null);
  if (!sp || G.gt - (player._spinT || -9) < sp.cd || player.stam < sp.stam * o.st.stamina) return null;
  return sp;
}
// a spinning cut drives further: the lunge is scaled up, and a cut with no step of its own (nothing to close on) still
// travels `reach` metres — forward, or to the side a strafe cut sweeps toward
function spinTravel(spin, dirKey){
  const sw = player.swing, f = fwd();
  if (sw.travel){
    sw.travel.x *= spin.travel; sw.travel.z *= spin.travel;
    const m = Math.hypot(sw.travel.x, sw.travel.z);
    if (m < spin.reach && m > 1e-3){ const k = spin.reach / m; sw.travel.x *= k; sw.travel.z *= k; }
  }
  if (!sw.travel || Math.hypot(sw.travel.x, sw.travel.z) < 1e-3){
    const side = dirKey === 'right' ? 1 : dirKey === 'left' ? -1 : 0;
    const dx = side ? -f.z * side : f.x, dz = side ? f.x * side : f.z;
    sw.travel = { x: dx * spin.reach, z: dz * spin.reach, done: 0 };
  }
}
// The cut's travel. On the ground it is ROOT MOTION: the same distance the old shove carried (impulse ÷ the ground
// drag in locomotion.js), but laid along the swing so the body drives through the strike with the lead foot
// (locomotion.js moves it, anim/footing.js steps the feet). In the air it stays a shove.
const GROUND_DRAG = 9;
const MOM_LABEL = { slide: 'SLIDE CUT', wallrun: 'WALL STRIKE', vault: 'VAULT STRIKE', climb: 'LEDGE STRIKE', roll: 'ROLL STRIKE' };
function stepIntoCut(dir, impulse){
  if (player.grounded && player.swing){
    player.swing.travel = { x: dir.x * impulse / GROUND_DRAG, z: dir.z * impulse / GROUND_DRAG, done: 0 };
  } else player.vel.addScaledVector(dir, impulse);
}
// Bail out of a saber swing at ANY point — into a guard/parry, a Force power, or a dash. The unspent cut is
// forfeit (that's the price of going defensive/Force mid-stroke). PARTIAL cost: an EARLY feint (first ~30%) is
// free & snappy; bailing LATE (committed, past 60%) bleeds stamina. Always leaves a blue Force-ripple + whoosh.
export function cancelSwing(){
  if (player.atkT <= 0 && player.darkT <= 0) return false;
  const k = player.swing ? clamp(player.swing.t / player.swing.dur, 0, 1) : 0.5;   // how far into the swing
  player.atkT = 0;
  player.swing = null;
  player.queuedAtk = false;
  player.lastAtkEnd = G.gt;
  player.cancelT = G.gt;   // timestamp — a parry landed just after this counts as a CANCEL-RIPOSTE (extra payoff)
  if (player.darkT > 0){ player.darkT = 0; player.darkApplied = false; }   // also checks the darksaber ability slash
  if (k > 0.6){ player.stam = Math.max(0, player.stam - 14); player.stamDelay = stamDelay(); }   // late cancels cost stamina
  // a small SABER-COLOURED spark at the hilt + a reversed-swish whoosh — reads as a CHECKED stroke, not a Force push
  // (no forward-travelling ring here on purpose: that looked like a push and was confusing the saber-throw input)
  const pp = playerPos();
  burst(V3(pp.x + fwd().x*0.4, 1.5, pp.z + fwd().z*0.4), stance().blade, 8, 5, 4, 0.7);
  sfx(640, 0.08, 'sine', 0.045, 1600); sfx(300, 0.06, 'triangle', 0.04, 900);
  return true;
}
/* A cut's damage. `only` (from anim: the blade's sweep, player/jedi/bladehit.js) lists exactly what the blade passed
   through this frame, and only those are struck. An empty list is the swing's once-per-cut pass at the strike point
   (the arc flash) with nothing hit. With no list at all (no blade in hand) it falls back to
   striking everything in the swing's arc and radius. */
export function applySwingDamage(step, only){
  const st = stance();
  const sw0 = player.swing;
  const fxPass = !only || only.length === 0;
  const isDark = G.hero === 'mando' && player.weapon === 'darksaber';
  let dmg = CFG.player.comboDamage[step] * st.dmg * player.up.dmg * focusDmgMul();   // FORCE FOCUS ramps saber damage
  const finisher = step === 2;
  let knock = (finisher ? 15 : 6) * st.knock * player.up.knock;
  // a ringing BESKAR CLANG on every heavy darksaber blow (the finisher, or any hit while a foe is in range)
  const beskarClang = () => S.clash(V3(playerPos().x + fwd().x*1.4, 1.4, playerPos().z + fwd().z*1.4), false);
  // DARKSABER — MAUL-STYLE OVERHEAD: the 3rd combo hit is a big downward smash (extra knockback + a quake)
  if (isDark && finisher){
    knock *= 1.6;
    const pp0 = playerPos();
    G.shake = Math.max(G.shake, 1.1); G.hitstop = Math.max(G.hitstop, 0.1);
    spawnGroundShock(V3(pp0.x + fwd().x*1.6, 0.1, pp0.z + fwd().z*1.6), 0xc9a6ff, 6, 0.4, 0.7);
    burst(V3(pp0.x + fwd().x*1.6, 0.6, pp0.z + fwd().z*1.6), 0xc9a6ff, 16, 9, 5, 1.0);
    S.slam(); beskarClang();
  }
  const riposte = !!(sw0 && sw0.riposte) && !(only && only.length === 0);
  if (riposte){   // parry reward: the answer lands twice as hard (more with Riposte Master)
    const cancelRip = !!sw0.cancelRip;   // parried straight out of a swing-cancel → a CRUSHING answer
    dmg *= 2 * (player.up.riposte || 1) * (cancelRip ? 1.6 : 1);
    knock *= cancelRip ? 1.8 : 1;
  }
  if (riposte && !sw0.ripFx){
    sw0.ripFx = true;   // the flash and the sting play once, on the first thing the riposte meets
    masteryXp('riposte');
    const cancelRip = !!sw0.cancelRip;
    const rp = playerPos();
    floater(rp, cancelRip ? 'COUNTER-RIPOSTE!' : 'RIPOSTE!', '#ffd24a');
    G.hitstop = Math.max(G.hitstop, cancelRip ? 0.2 : 0.16);
    G.shake = Math.max(G.shake, cancelRip ? 1.0 : 0.8);
    G.slowmo = Math.min(G.slowmo, 0.3); G.slowmoT = Math.max(G.slowmoT, 0.14);
    const rfp = V3(rp.x + fwd().x, 1.6, rp.z + fwd().z);
    clashFlash(rfp, 0xffd24a, true);
    sparks(rfp, 0xffe27a, 14, 15, { dir: fwd(), cone: 0.7, life: 0.34 });
    screenFlash('radial-gradient(ellipse at center, rgba(255,255,255,.45), rgba(255,210,90,.1) 55%, transparent 72%)', 0.85, 0.32);
    S.riposte(); sfx(140, 0.22, 'sawtooth', 0.14, 50);
  }
  // MOMENTUM — a cut out of a vault, climb, slide, wall-run or landing roll lands harder (data/movement.js MOVE.flow)
  const mom = sw0 && sw0.mom;
  if (mom){ dmg *= MOVE.flow.strikeDmg; knock *= MOVE.flow.strikeKnock; }
  // FAST cleaves wide through crowds; STRONG is a narrow, focused blow. FAST's finisher fans ~10% wider still.
  const radius = (finisher ? CFG.player.hitRadius + 1 : CFG.player.hitRadius) * (st.radiusMult || 1)
                 * (finisher && st.finisherArc ? st.finisherArc : 1);
  const back = !!(player.swing && player.swing.back);
  const f = fwd(); if (back) f.negate();   // back strike cleaves & knocks toward your rear
  const pp = playerPos();
  let hits = 0, turned = 0;
  const line = cutLine(player.swing);   // the line this cut comes in on — a duellist's guard covers one (enemies/duel.js)
  // the ARC: a cut covers what's in front of you, a strafe sweep a little wider, the finisher wider still (data/config.js)
  const A = CFG.player.swingArc, sdir = player.swing && player.swing.dir;
  const arcCos = finisher ? A.finisher : (sdir === 'left' || sdir === 'right' || back) ? A.sweep : A.cut;
  const reachUp = radius * 0.85;   // VERTICAL reach — a swing from the air can't hit foes far below you
  const tryHit = (pos, fn, obj) => {
    if (only){ if (only.includes(obj) && fn() !== false) hits++; return; }   // the blade decided: it touched this
    TMP.subVectors(pos, pp);
    if (Math.abs(TMP.y) > reachUp) return;   // must be at roughly your height (aim at them, don't sweep the ground from above)
    TMP.y = 0;
    const d = TMP.length();
    if (obj && obj !== shared.boss && obj.group && obj.t){ if (!inReach(obj, pp, radius, d > 0.3 ? f : null, arcCos)) return; }   // a foe: any of its body
    else {
      if (d > radius) return;
      if (d > 0.3 && TMP.normalize().dot(f) < arcCos) return;   // only what's in front of the blade's arc
    }
    if (fn() !== false) hits++;
  };
  let foesHit = 0, blocker = null, blockAt = null;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    tryHit(e.group.position, () => {
      // a duellist's guard may turn it (a riposte, the answer to a parry, always lands)
      // (a guard the blade already met on the way in has had its say: player/jedi/clash.js)
      if (!riposte && !back){
        const pre = sw0 && sw0.duel && sw0.duel.get(e);
        const at = pre === undefined && only && only.length ? contactPoint(e) : undefined;
        const dres = pre !== undefined ? pre : duelDefend(e, line, finisher ? 'finisher' : 'cut', G.stance === 'strong' || isDark, at);
        if (dres === 'block' || dres === 'dodge'){ turned++; if (dres === 'block' && !blocker){ blocker = e; blockAt = at; } return false; }
      }
      damageEnemy(e, dmg * (e.t.heavy ? st.heavyDmg : 1) * backLineMul(st, e), f.clone(), knock, finisher);
      foesHit++;
      if (!riposte && !e.dead) interruptEnemy(e, f, finisher || st.form === 'djemso' || isDark);   // striking first beats a wind-up
      if (mom === 'slide' && !riposte && !e.dead) staggerEnemy(e, f.x, f.z);   // a SLIDE CUT sweeps the legs out
      if (riposte && !e.dead) staggerEnemy(e, f.x, f.z);   // a RIPOSTE floors what it answers — a true counter, wide open after
      // BESKAR EDGE — a heavy darksaber hit can DISARM/stagger a staff-wielding duelist
      if (isDark && (finisher || e.t.staff) && e.t.staff && !e.dead && Math.random() < (finisher ? 0.5 : 0.18)){
        staggerEnemy(e, f.x, f.z); floater(e.group.position, 'DISARMED', '#c9a6ff');
      }
    }, e);
  }
  if (finisher && foesHit) tutEvent('finisher');
  if (foesHit && sw0 && sw0.dir !== 'neutral') tutEvent('cutHit', { dir: sw0.dir });   // which key picked the cut that landed (the training's cut lesson)
  if (shared.boss && shared.boss.hp > 0) tryHit(shared.boss.group.position, () => damageBoss(dmg * st.heavyDmg), shared.boss);
  for (let i = barrels.length-1; i >= 0; i--){
    const b = barrels[i];
    tryHit(b.mesh.position, () => { if (b.fuse < 0) b.fuse = 0.1; }, b);
  }
  // the blade bounced off a guard and found nothing else: it jars the arm, costs breath and breaks the string
  // (a guard that turned it stops the blade where they met and throws it back: player/jedi/clash.js)
  if (turned && !hits) bounceOff(blocker, blockAt);
  if (hits > 0){
    if (mom && !sw0.momFx){ sw0.momFx = true; floater(playerPos(), MOM_LABEL[mom] || 'MOMENTUM', '#9fe0c8'); }
    G.shake = Math.max(G.shake, finisher ? 0.5 : 0.2);
    addFocus(finisher ? FOCUS.gainFin : FOCUS.gainHit);   // FORCE FOCUS — clean bladework builds the flow
    // UNLEASHED (max focus): every cut releases a Force shockwave that cleaves & knocks the surrounding crowd
    if (G.hero !== 'mando' && focusTier() >= 3){
      const pp1 = playerPos(), wp = V3(pp1.x + f.x*1.4, 0.6, pp1.z + f.z*1.4);
      spawnGroundShock(V3(wp.x, 0.1, wp.z), 0xffe27a, 4.2, 0.3, 0.45);
      burst(V3(wp.x, 1.2, wp.z), 0xffe27a, 8, 8, 4, 0.8);
      for (const e of enemies){ if (e.dead || e.converted) continue; const dd = e.group.position.clone().sub(pp1).setY(0); if (inReach(e, pp1, 4.6)) damageEnemy(e, dmg*0.3, dd.clone().normalize(), 10); }
    }
    if (riposte) player.force = clamp(player.force + 10 + (player.up.parryForce || 0), 0, CFG.player.maxForce);   // a landed counter feeds the Force
    if (isDark && !finisher) beskarClang();   // every darksaber strike rings on beskar
    // STRONG stance & DARKSABER & finishers land with real weight — a brief hitstop + heavy thud (general feedback)
    const heavy = G.stance === 'strong' || isDark || finisher;
    if (heavy){
      G.hitstop = Math.max(G.hitstop, (G.stance === 'strong' || isDark ? 0.06 : 0.04) + (finisher ? 0.03 : 0));
      if (!riposte) S.heavy();
    }
    // the STRONG finisher is a BONE-CRUNCHING blow — a long hitstop freeze, a big camera quake, a brief
    // slow-mo beat, a fat arc flash AND a violent eruption of sparks/debris so the weight really lands
    if (G.stance === 'strong' && finisher && !(sw0 && sw0.heavyFx)){
      if (sw0) sw0.heavyFx = true;
      G.hitstop = Math.max(G.hitstop, 0.22);
      G.shake = Math.max(G.shake, 1.7);
      G.slowmo = Math.min(G.slowmo, 0.42); G.slowmoT = Math.max(G.slowmoT, 0.14);
      player.arcMesh.scale.setScalar(1.6);
      const pp0 = playerPos(), ip = V3(pp0.x + fwd().x*1.6, 1.2, pp0.z + fwd().z*1.6);
      spawnGroundShock(V3(ip.x, 0.1, ip.z), st.blade, 5.5, 0.34, 0.6);
      spawnGroundShock(V3(ip.x, 0.1, ip.z), 0xffffff, 8, 0.5, 0.3);
      inkSprite({ pos: ip, shape: 'star', points: 10, sharp: 0.14, color: st.blade, size: [1.6, 4.6], life: 0.2, steps: 2, coreW: 0.38 });   // the cel shockburst
      sparks(ip, st.blade, 18, 16, { life: 0.4, size: 0.6 }); sparks(ip, 0xffffff, 8, 18, { life: 0.3 });
      burst(ip, 0x9a9a9a, 8, 9, 6, 1.1);   // chips of stone
      spawnHitSpark(ip, 0xffffff, 2.0);
      screenFlash('radial-gradient(ellipse at center, rgba(180,90,255,.4), transparent 62%)', 0.7, 0.3);
      S.slam(ip); S.clash(ip, true);
    } else { player.arcMesh.scale.setScalar(1); }
  }
  // arc flash in the blade's color — leaned toward the side the cut travels (back strikes flash to the rear)
  if (!fxPass) return;
  const sw = player.swing;
  const turn = sw && sw.pat ? Math.sign(sw.pat.yT - sw.pat.yF) : 0;
  player.arcMesh.rotation.z = (sw && sw.back ? Math.PI : 0) + turn * 0.55;
  player.arcMesh.material.opacity = 0.7;
  player.arcMesh.material.color.setHex((G.hero === 'mando' && player.weapon === 'darksaber') ? 0xc9a6ff : st.blade);
}

// JEDI FRONT KICK (E) — the Jedi's hands are full of saber, so the free melee is a leg: a snapping Force-assisted
// front kick that SHOVES the front rank back to make room. Always available, NO Force cost, light damage — a pure
// space-maker (the Mando's gauntlet-punch counterpart). The short recovery (kickT) keeps it from being mashed.
const JEDI_KICK = { reach: 1.75, arc: 0.62, dmg: 10, knock: 28, recover: 0.4 };
export function forceKick(){
  if (G.mode !== 'play' || G.hero === 'mando' || player.kickT > 0 || player.judgeT > 0 || player.mendT > 0 || player.flip || player.slamming || player.hang || player.flinchT > 0) return;
  const A = JEDI_KICK;
  player.kickT = player.kickMax = A.recover;
  const f = fwd(), pp = playerPos();
  player.vel.addScaledVector(f, 4);   // drive into the kick for weight
  const cosLim = Math.cos(A.arc);
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > 2.2) continue;
    TMP.y = 0;
    if (TMP.length() - bodyRadius(e) > A.reach + 4 / 9) continue;   // the boot has to reach the body (+ the step into it)
    const kd = TMP.lengthSq() < 0.001 ? f.clone() : TMP.clone().normalize();
    if (TMP.lengthSq() > 0.001 && kd.dot(f) < cosLim) continue;
    if (isGuarding(e)) guardImpact(e, DUEL.posture.kick);   // a kick is the answer to a guard: it cracks posture wide
    damageEnemy(e, A.dmg, kd, A.knock); flinchEnemy(e, kd, 0.6); hit++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < A.reach + 1.2) damageBoss(A.dmg * 0.5);
  const ip = V3(pp.x + f.x*1.3, 1.0, pp.z + f.z*1.3);
  if (hit){
    G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.3);
    burst(ip, 0xbfe8ff, 7, 8, 4, 0.8); spawnHitSpark(ip, 0xcfe0ec, 1.0);
  } else burst(ip, 0xcfe0ec, 3, 5, 3);
  S.jump(); if (hit) S.punch(ip, 1.2);
}

/* DEFLECT ANIMATION — start a blade catch toward something arriving at `from` (a bolt, or a blocked blow). The
   catch itself (which cover, which side) is picked in anim/saber.js. A swing already in flight keeps the blade. */
export function deflectAnim(from){
  if (G.hero === 'mando' || player.atkT > 0 || !from) return;
  const cur = player.deflectAnim;
  if (cur && cur.spin && cur.t < cur.dur) return;   // a spin already sweeping the blade round covers the next bolt too
  player.deflectAnim = catchState(from);
  deflectSpin(player.deflectAnim);
}
const catchState = (from) => {
  const pp = playerPos(), fy = player.faceYaw;
  const dx = from.x - pp.x, dz = from.z - pp.z, d = Math.hypot(dx, dz) || 1;
  return {
    t: 0, dur: 0.3, pose: null,
    side: (dx * -Math.cos(fy) + dz * Math.sin(fy)) / d,   // + = the weapon (right) side
    h: from.y - (pp.y + 1.4),                              // against the chest
  };
};
/* ANTICIPATED TWIRL (Niman, data/poses.js DEFLECT_SPINS.anticipate) — called by enemies/bolts.js as a bolt comes into
   range, `eta` seconds before the catch. If the catch is certain (a parry window that will still be open, or a held
   guard) it sometimes starts the blade's twirl now, timed so the bolt lands on the blade as it passes the bottom of
   the wheel (anim/saber.js deflectPose). */
export function anticipateDeflect(from, eta){
  const S = DEFLECT_SPINS[stance().form];
  if (!S || !S.anticipate || G.hero === 'mando' || player.atkT > 0 || player.deflectAnim || !player.grounded || player.flip) return;
  if (eta < 0.04 || G.gt - (player._dflSpinT || -9) < S.cd || Math.random() > S.anticipate) return;
  if (!(player.parryT >= eta || (player.blockHeld && player.stam > 0))) return;
  const d = catchState(from);
  player._dflSpinT = G.gt;
  player._dflFlip = Math.abs(d.side) > 0.2 ? (d.side > 0 ? 1 : -1) : -(player._dflFlip || -1);
  d.spin = { turns: 0, twirl: S.twirl, side: player._dflFlip };
  d.lead = eta; d.dur = eta + S.dur;
  player.deflectAnim = d;
}
/* A catch can become a spin (data/poses.js DEFLECT_SPINS): on the move, or the second bolt of a volley. Jedi, grounded. */
function deflectSpin(d){
  const S = DEFLECT_SPINS[stance().form], recent = player._dflHits || (player._dflHits = []);
  while (recent.length && G.gt - recent[0] > 1.5) recent.shift();
  recent.push(G.gt);
  if (!S || !player.grounded || player.flip || G.gt - (player._dflSpinT || -9) < S.cd) return;
  const moving = Math.hypot(player.moveVel.x, player.moveVel.z) > 2;
  const volley = recent.length >= 2 && G.gt - recent[recent.length - 2] < S.volley;
  if (!moving && !volley) return;
  player._dflSpinT = G.gt;
  if (Math.abs(d.side) > 0.2) player._dflFlip = d.side > 0 ? 1 : -1;
  else player._dflFlip = -(player._dflFlip || -1);
  d.spin = { turns: S.turns, twirl: S.twirl, side: player._dflFlip };
  d.dur = S.dur;
  if (S.step && moving){   // a short step on in the direction of travel: the spin covers ground
    TMP.set(player.moveVel.x, 0, player.moveVel.z).normalize();
    player.vel.addScaledVector(TMP, S.step * 4);
  }
}
