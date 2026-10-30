// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Third-person follow camera.

import { camera } from './renderer.js';
import { clamp, TMP } from '../utils.js';
import { shared, G, player, enemies } from '../state.js';
import { fwd, rightV, playerPos, stance } from '../player/helpers.js';
import { cameraClearance, updatePropFade } from '../world/camblock.js';
import { CFG } from '../data/config.js';

/* ============================================================
   CAMERA — third person follow
   ============================================================ */
let camDist = 5, camFov = 60, camLift = 0, camRise = 0, jaYaw = 0, jaLive = false, deadAt = -1, fovPunch = 0;
// the Jedi rig's state (JA's cameraCurLoc / cameraCurTarget): where the lens and its aim point are, each easing after
// its ideal spot on its own damping
const jaLoc = camera.position.clone(), jaTarget = camera.position.clone(), LOOK = camera.position.clone();
// smooth layered-sine noise in [-1,1] — shake that rolls instead of buzzing frame to frame
const wob = (t, s) => (Math.sin(t*23.1 + s) * 0.55 + Math.sin(t*37.7 + s*2.3) * 0.3 + Math.sin(t*61.3 + s*4.1) * 0.15);

// how crowded is the fight around the hero? nearby enemies count fully, ones at the edge of the radius fade out
function crowdAround(pp){
  const R = CFG.camera.crowdRadius;
  let n = 0;
  for (const e of enemies){
    if (e.dead || !e.group) continue;
    const d = Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z);
    if (d < R) n += d < R*0.6 ? 1 : (R - d) / (R*0.4);
  }
  return n;
}

// the resting FOV is authored for 16:9; on a narrower window (4:3, portrait) widen it so the sides don't close in
function baseFov(C){
  const f = G.fov || C.fov;   // the FOV setting, falling back to the authored default
  const a = Math.min(camera.aspect, 16/9);
  const h = 2 * Math.atan(Math.tan(f * Math.PI / 360) * 16/9);
  return Math.max(f, 2 * Math.atan(Math.tan(h / 2) / a) * 180 / Math.PI);
}

// PAUSE CUTS — behind the pause screen the lens leaves the follow rig and cuts between a few fixed shots of the hero
// in their current setting, each held still with a slow push-in. Angles are relative to the way the hero faces;
// [angle off the facing (rad), distance, lens height, aim height]
const PAUSE_SHOTS = [
  [ 0.6, 5.0, 1.4, 1.1],    // three-quarter, at chest height
  [ 1.57, 6.5, 2.2, 1.0],   // side-on, mid shot
  [-2.6, 10, 6.5, 0.6],     // high and wide over the shoulder, the whole setting
  [-0.5, 3.4, 0.6, 1.5],    // low front angle, looking up
  [ 0.15, 7.5, 3.4, 0.9],   // wide from the front
];
const PAUSE_HOLD = 4.5, PAUSE_PUSH = 0.06;   // seconds per shot; how much closer the lens creeps over a hold
let pauseCam = null;
function updatePauseCam(){
  const now = performance.now() / 1000, pp = playerPos();
  if (!pauseCam){
    // remember the live view so resuming drops straight back into it (no swoop in from the last shot)
    pauseCam = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, shot: -1, at: 0,
                 yaw: G.yaw, last: now, x: pp.x, y: pp.y, z: pp.z };
  }
  const P = pauseCam;
  if (P.shot < 0 || now - P.at > PAUSE_HOLD){
    // next shot whose view of the hero isn't walled off by a prop; try each in turn, keep the least blocked
    let pick = -1, bestK = -1;
    for (let i = 1; i <= PAUSE_SHOTS.length; i++){
      const j = (P.shot + i + PAUSE_SHOTS.length) % PAUSE_SHOTS.length, [a, dist, h] = PAUSE_SHOTS[j];
      const k = cameraClearance(P.x, P.y + 1.2, P.z, P.x + Math.sin(P.yaw + a)*dist, P.y + h, P.z + Math.cos(P.yaw + a)*dist);
      if (k > 0.85){ pick = j; break; }
      if (k > bestK){ bestK = k; pick = j; }
    }
    P.shot = pick; P.at = now;
  }
  const [a, dist, h, look] = PAUSE_SHOTS[P.shot];
  const t = Math.min(1, (now - P.at) / PAUSE_HOLD), d = dist * (1 - PAUSE_PUSH * t);
  TMP.set(P.x + Math.sin(P.yaw + a)*d, Math.max(0.4, P.y + h), P.z + Math.cos(P.yaw + a)*d);
  const k = cameraClearance(P.x, P.y + 1.2, P.z, TMP.x, TMP.y, TMP.z);
  if (k < 1) TMP.set(P.x + (TMP.x - P.x)*k, P.y + 1.2 + (TMP.y - P.y - 1.2)*k, P.z + (TMP.z - P.z)*k);
  camera.position.copy(TMP);
  camera.lookAt(P.x, P.y + look, P.z);
  const fov = baseFov(CFG.camera);
  if (Math.abs(camera.fov - fov) > 0.02){ camera.fov = fov; camera.updateProjectionMatrix(); }
  updatePropFade(camera.position, P.x, P.y, P.z, Math.min(0.05, now - P.last));   // real time: the sim's dt is 0 here
  P.last = now;
}

// a cutscene ended (game/cutscene.js): the Jedi rig starts over from its ideal spot instead of swooping in from before it
export function resetCameraRig(){ jaLive = false; camFov = camera.fov; }

export function updateCamera(dt){
  // the FOV slider wants the real gameplay camera, so the cut slideshow stands down while it's dragged
  if ((G.paused || G.sbMenu) && G.mode === 'play' && !G.fovPreview){ updatePauseCam(); return; }
  if (pauseCam){
    camera.position.copy(pauseCam.pos); camera.quaternion.copy(pauseCam.quat);
    camera.fov = pauseCam.fov; camera.updateProjectionMatrix();
    pauseCam = null;
  }
  if (G.cutscene) return;   // a cutscene has the lens (game/cutscene.js)
  const C = CFG.camera;
  const pp = playerPos();
  const f = fwd();
  const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z;
  const speed = Math.hypot(vx, vz);
  // look-ahead into motion (kept short: at this distance a long lead would push the hero out of frame)
  const tx = pp.x + clamp(vx * 0.12, -1.5, 1.5);
  const tz = pp.z + clamp(vz * 0.12, -1.5, 1.5);
  const ty = pp.y + C.pivotY;
  const rv = rightV();
  // ----- MANDO camera: HIGH + ALWAYS over a shoulder (helmet never under the crosshair) — the shoulder follows the
  //       way you last strafed, with situational distance & offset strength -----
  let camHi = 0, distMul = 1, ots = 0;
  const jedi = G.hero !== 'mando';
  if (jedi) player.camOts = 0;   // (the Jedi rig below carries its own small offset)
  else {
    const aiming = player.blockHeld || player.zoom || player.aiming > 0;
    const flying = !player.grounded;
    const lat = vx*rv.x + vz*rv.z;                        // signed strafe: +right, -left
    // never CENTRED: at this distance a centred Mando sits right under the crosshair, so aiming at a head put the
    // reticle on your own back. Stay over the right shoulder, and swap sides only on a deliberate strafe the other way
    if (Math.abs(lat) > 2.5) player.camSide = Math.sign(lat);
    const target = (player.camSide || 1) * (aiming ? C.mandoShoulderAim : flying ? C.mandoShoulderFly : C.mandoShoulder);
    player.camOts = (player.camOts || 0) + (target - (player.camOts || 0)) * Math.min(1, dt*4);   // smooth the swap
    ots = player.camOts;
    camHi = C.mandoLensUp;                                // sit over the helmet so it stays below the centred crosshair
    distMul = aiming ? 0.88 : flying ? 1.25 : 1;          // aiming tucks in over the shoulder; flight backs off for the room
  }
  // camera breathes with the action: pulls back HARD at high flight speed (Mando), softer otherwise, + for the boss
  const adsFly = G.hero === 'mando' && (player.blockHeld || player.zoom);   // aiming → steadier, tighter camera
  const pullback = jedi ? 0 : clamp(speed * 0.14, 0, 4);   // (JA's range doesn't stretch with speed)
  // COMBAT FRAMING — a pack closing in pushes the lens back and up so the whole brawl stays on screen; a quiet
  // arena (between waves, nothing near) tucks it in closer for a grounded, over-the-shoulder feel
  const boss = shared.boss && shared.boss.hp > 0 ? shared.boss : null;
  const crowd = crowdAround(pp);
  let frame = Math.min(C.crowdMax, crowd * C.crowdPull);
  let lift = Math.min(1, crowd / 5) * C.crowdLift;
  if (boss){
    // the boss is big: the closer it gets, the further back we sit so its windups stay readable
    const bd = Math.hypot(boss.group.position.x - pp.x, boss.group.position.z - pp.z);
    frame = Math.max(frame, C.bossDist + clamp(1 - (bd - 3) / 9, 0, 1) * (C.bossNear - C.bossDist));
    lift = Math.max(lift, C.crowdLift);
  } else if (G.mode === 'play' && crowd < 0.3 && shared.levelPhase !== 'fighting') frame = C.calmDist;
  if (jedi && !boss){ frame *= C.ja.frame; lift *= C.ja.frame; }   // (the boss still gets the full pull: its windups need the room)
  // DUEL FRAMING — locked onto a foe, back off with the gap between you so both blades stay on screen
  const lt = player.lockTarget, lp = lt && lt.group && lt.group.position;
  if (lp) frame = Math.max(frame, clamp(Math.hypot(lp.x - pp.x, lp.z - pp.z) * C.duelPull, 0, C.duelMax));
  if (adsFly) lift *= 0.3;   // don't drift the reticle's eye-line while aiming
  camLift += (lift - camLift) * Math.min(1, dt*2);
  const wantDist = ((jedi ? C.ja.range : C.mandoDist) + pullback + frame) * distMul;
  // draw back quicker than we settle in, so a closing pack is framed before it lands its first hit
  camDist += (wantDist - camDist) * Math.min(1, dt * (wantDist > camDist ? 3.5 : 2.2));
  const cosP = Math.cos(G.pitch), sinP = Math.sin(G.pitch);
  // DEATH — the view slowly rises and draws back off the fallen hero (real time: the death slow-mo would stall it)
  let dk = 0;
  if (G.mode === 'dead'){ if (deadAt < 0) deadAt = performance.now(); dk = Math.min(1, (performance.now() - deadAt) / 2500); dk = dk*dk*(3 - 2*dk); }
  else deadAt = -1;
  const d = camDist + dk*3;
  // where the lens is clipped back toward (JA traces from the aim point; the Mando's rig from the hero's head)
  let ox = pp.x, oy = ty, oz = pp.z;
  if (jedi){
    // ----- JEDI: Jedi Academy's rig (cg_view.cpp, CG_OffsetThirdPersonView). The ideal aim point sits vertOffset over
    // the eye; the ideal lens sits `d` behind it along the line of sight (pitch included: looking down swings it up over
    // the hero, looking up swings it down behind). Each then closes a fixed share of its gap per 50 ms -----
    const J = C.ja, k = dt / 0.05;
    const fy = -sinP, fx = f.x*cosP, fz = f.z*cosP;   // JA's camerafwd (our pitch is + looking down)
    const itx = pp.x, ity = pp.y + J.eye + J.vertOffset + camLift + dk*3, itz = pp.z;
    TMP.set(itx - fx*d, ity - fy*d, itz - fz*d);
    // turning fast stiffens the lens so it doesn't cut across the orbit (JA: yaw speed in degrees per ms, 1 → 2.5)
    let dy = Math.abs(G.yaw - jaYaw) * 180 / Math.PI % 360; if (dy > 180) dy = 360 - dy;
    let stiff = dt > 0 ? dy / (dt * 1000) : 0;
    stiff = stiff < 1 ? 0 : stiff > 2.5 ? 0.75 : (stiff - 1) * 0.5;
    jaYaw = G.yaw;
    if (!jaLive || G.fovPreview){ jaTarget.set(itx, ity, itz); jaLoc.copy(TMP); jaLive = true; }   // (re)start: no swoop in
    else {
      const tr = Math.pow(1 - J.targetDamp, k);
      jaTarget.set(itx - (itx - jaTarget.x)*tr, ity - (ity - jaTarget.y)*tr, itz - (itz - jaTarget.z)*tr);
      const pk = Math.abs(G.pitch) * 180 / Math.PI / 115;
      let df = J.cameraDamp + (1 - J.cameraDamp) * pk*pk;
      df += (1 - df) * stiff;
      const lr = df >= 1 ? 0 : Math.pow(1 - df, k);
      jaLoc.set(TMP.x - (TMP.x - jaLoc.x)*lr, TMP.y - (TMP.y - jaLoc.y)*lr, TMP.z - (TMP.z - jaLoc.z)*lr);
    }
    // JA's horizontal offset slides lens and aim together, so the view direction is unchanged
    TMP.set(jaLoc.x + rv.x*J.horz, jaLoc.y, jaLoc.z + rv.z*J.horz);
    LOOK.set(jaTarget.x + rv.x*J.horz, jaTarget.y, jaTarget.z + rv.z*J.horz);
    ox = jaTarget.x; oy = jaTarget.y; oz = jaTarget.z;
  } else {
    jaLive = false;
    TMP.set(tx - f.x*d*cosP + rv.x*ots, ty + camHi + camLift + dk*3 + d*sinP, tz - f.z*d*cosP + rv.z*ots);
  }
  // aiming up swings the lens down behind the hero; never let it sink below `minLensY` over their feet, so the
  // view never comes up from the floor. Past that point the swing it would have made raises the aim point instead,
  // so you can keep looking up at the same rate
  const lensFloor = pp.y + C.minLensY, aimRise = Math.max(0, lensFloor - TMP.y);
  if (TMP.y < lensFloor) TMP.y = lensFloor;
  if (TMP.y < 0.4) TMP.y = 0.4;
  // never park the lens INSIDE a prop (inside one, its ink hull fills the screen black): pull in along the line from
  // the hero's head. The head, not the look-ahead point, because running at a wall puts the look-ahead inside it.
  // Props merely in the way don't move the lens: they fade (below)
  const clear = v => { const k = cameraClearance(ox, oy, oz, v.x, v.y, v.z); if (k < 1) v.set(ox + (v.x - ox)*k, oy + (v.y - oy)*k, oz + (v.z - oz)*k); };
  // WALL AT YOUR BACK — pulling straight in jams the lens into the back of the hero's head. Try riding the boom up over
  // them first (as JA's and most action games' cameras do), keeping whichever height leaves the longest clear line
  let riseWant = 0;
  if (cameraClearance(ox, oy, oz, TMP.x, TMP.y, TMP.z) < 1){
    const reach = r => cameraClearance(ox, oy, oz, TMP.x, TMP.y + r, TMP.z) * Math.hypot(TMP.x - ox, TMP.y + r - oy, TMP.z - oz);
    let best = reach(0) + 0.6;   // a rise has to buy real room to be worth tipping the view down
    for (const r of C.wallRise){ const L = reach(r); if (L > best){ best = L; riseWant = r; } }
  }
  camRise += (riseWant - camRise) * Math.min(1, dt * 3);
  TMP.y += camRise;
  clear(TMP);
  // INERTIA — the camera lags when you boost / fly fast (a weighty swoop), but snaps tight when you're AIMING
  const lagBase = (adsFly) ? 0.000004 : (G.hero === 'mando' && (player.boosting || speed > 14)) ? 0.02 : 0.000008;
  // (frozen sim: dt = 0 would leave the lens stuck on the last pause cut, so the FOV preview snaps straight to the gameplay spot)
  // (the Jedi rig has already done its own easing)
  if (jedi) camera.position.copy(TMP);
  else camera.position.lerp(TMP, G.fovPreview ? 1 : 1 - Math.pow(lagBase, dt));
  // SHAKE — trauma model: strength is shake², so chip damage barely registers and a boss slam rattles the screen.
  // Smooth noise (real time, so a hitstop freeze-frame still trembles) with a touch of roll; damped while scoped.
  const now = performance.now() / 1000;
  let shakeRoll = 0;
  if (G.shake > 0){
    G.shake = Math.max(0, G.shake - dt*2.2);
    const tr = Math.min(1, G.shake) ** 2 * (player.zoom ? 0.35 : adsFly ? 0.6 : 1) * G.shakeScale;   // × the SHAKE setting
    camera.position.x += wob(now, 0.0) * tr * C.shake * 1.6;
    camera.position.y += wob(now, 1.7) * tr * C.shake * 1.6;
    camera.position.z += wob(now, 3.1) * tr * C.shake;
    shakeRoll = wob(now, 5.3) * tr * C.shakeRoll;
  }
  // HIT KICK — taking a blow knocks the lens away from where it came from, then springs back
  if (player.camKickT != null){
    const age = G.gt - player.camKickT;
    if (age < 0.3){
      const kx = pp.x - player.camKickX, kz = pp.z - player.camKickZ, kl = Math.hypot(kx, kz) || 1;
      const amt = (1 - age / 0.3) ** 2 * C.hitKick * (player.zoom ? 0.3 : 1) * G.shakeScale;
      camera.position.x += kx / kl * amt; camera.position.z += kz / kl * amt; camera.position.y -= amt * 0.3;
    }
  }
  // HANDHELD SWAY — a faint idle drift so the view feels held, not bolted on; gone when moving fast or aiming
  if (C.sway > 0 && !adsFly && G.mode === 'play'){
    const sw = C.sway * (1 - clamp(speed / 6, 0, 1));
    camera.position.x += Math.sin(now * 0.63) * sw; camera.position.y += Math.sin(now * 0.91 + 1.3) * sw * 0.7;
  }
  if (player.landDip > 0) camera.position.y -= player.landDip;   // TOUCHDOWN — the view dips with the impact (decayed in updatePlayer)
  if (camera.position.y < 0.25) camera.position.y = 0.25;        // none of the above may push the lens under the floor
  // ...or into a prop: the lag, shake, hit kick and sway all move the lens after the check above, so check where it
  // actually ended up
  clear(camera.position);
  // SEE-THROUGH — a prop standing between the lens and the hero turns slightly see-through (world/camblock.js, ink.js)
  updatePropFade(camera.position, pp.x, pp.y, pp.z, dt);
  // Mando aims a bit ABOVE its own head height; while DIVING the look target drops so the camera follows the dive angle
  const diveLook = (G.hero === 'mando' && player.boosting) ? clamp(player.vy * 0.06, -2.0, 0) : 0;
  // LOOKING DOWN — the lens climbs overhead, and aiming far past the hero from up there drops them off the bottom of the
  // screen. As the view tips over, draw the aim point back in toward the hero and down toward the waist, so they stay
  // in frame
  let td = clamp((G.pitch - C.topDownFrom) / (1.2 - C.topDownFrom), 0, 1);
  td = td*td*(3 - 2*td);
  const ahead = C.lookAhead * (1 - td * C.topDownAhead);
  if (jedi) camera.lookAt(LOOK);   // JA: the view runs from the lens through its aim point, over the hero's head
  else camera.lookAt(tx + f.x*ahead + rv.x*ots, ty + C.lookUp + 0.3 + diveLook + aimRise - td * C.topDownDrop, tz + f.z*ahead + rv.z*ots);
  // camera ROLL into a strafe — subtle for the Jedi; a pronounced Max-Payne bank for the boosting Mando, but
  // damped right down while AIMING so the shot stays readable.
  const strafe = vx * (-f.z) + vz * f.x;
  let rollGain = (G.hero === 'mando') ? (player.boosting ? 0.013 : !player.grounded ? 0.009 : 0.006) : 0.0035;
  let rollMax  = (G.hero === 'mando') ? (player.boosting ? 0.13 : 0.08) : 0.045;
  if (adsFly){ rollGain *= 0.35; rollMax *= 0.45; }
  camera.rotateZ(clamp(-strafe * rollGain, -rollMax, rollMax) + shakeRoll);
  // FOV kick on dashes and at speed; disruptor ZOOM (ADS) pulls the view in tight for precision
  // blasters get a SLIGHT aim zoom only while BRACING (hold RMB) for precision — single pulls in more than dual
  const blasterAim = (G.hero === 'mando' && !player.zoom && player.blockHeld && (player.weapon === 'single' || player.weapon === 'dual'))
                     ? (player.weapon === 'single' ? 14 : 9) : 0;    // bracing zooms in — the payoff for steadying (the lens is close already)
  // IMPACT PUNCH — heavy hitstop snaps the view in a touch (instantly, the sim is frozen) and slow-mo holds it there,
  // so the big moments feel close; it releases once the beat is over
  if (G.mode === 'play' && !player.zoom && (G.hitstop > 0.04 || G.slowmo < 0.9)) fovPunch = C.impactFov;
  else fovPunch = Math.max(0, fovPunch - dt * C.impactFov * 4);
  const wantFov = player.zoom ? 30 : (baseFov(C) + (player.dashT > 0 ? 10 : 0) + clamp(speed * 0.2, 0, 6) + (stance().fovKick || 0) - blasterAim);
  // previewing the FOV setting (often while paused, dt = 0): snap so the view follows the slider at once
  camFov = G.fovPreview ? wantFov : camFov + (wantFov - camFov) * Math.min(1, dt * (player.zoom ? 12 : 7));
  const fov = camFov - fovPunch;
  if (Math.abs(camera.fov - fov) > 0.02){ camera.fov = fov; camera.updateProjectionMatrix(); }
}
