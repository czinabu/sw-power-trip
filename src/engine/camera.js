// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Third-person follow camera.

import { camera } from './renderer.js';
import { rand, clamp, TMP } from '../utils.js';
import { shared, G, player } from '../state.js';
import { fwd, rightV, playerPos, stance } from '../player/helpers.js';

/* ============================================================
   CAMERA — third person follow
   ============================================================ */
let camDist = 8.5, camFov = 70;
export function updateCamera(dt){
  const pp = playerPos();
  const f = fwd();
  const vx = player.moveVel.x + player.vel.x, vz = player.moveVel.z + player.vel.z;
  const speed = Math.hypot(vx, vz);
  // look-ahead into motion
  const tx = pp.x + clamp(vx * 0.18, -2.4, 2.4);
  const tz = pp.z + clamp(vz * 0.18, -2.4, 2.4);
  const ty = pp.y + 2.4;
  const rv = rightV();
  // ----- MANDO camera: HIGH (helmet never over the crosshair) + a DIRECTIONAL shoulder offset that follows the
  //       way you're strafing/flying, with situational distance & offset strength (see the design table) -----
  let camHi = 0, distMul = 1, ots = 0;
  if (G.hero === 'mando'){
    const aiming = player.blockHeld || player.zoom || player.aiming > 0;
    const flying = !player.grounded;
    const lat = vx*rv.x + vz*rv.z;                        // signed strafe: +right, -left
    // CENTERED when standing still — only offset toward the side you're actually moving
    const moving = Math.abs(lat) > 0.8;
    const target = moving ? Math.sign(lat) * (aiming ? 1.5 : flying ? 0.85 : 0.6) : 0;
    player.camOts = (player.camOts || 0) + (target - (player.camOts || 0)) * Math.min(1, dt*4);   // smooth the swap
    ots = player.camOts;
    camHi = 2.5;                                          // sit HIGH so the helmet stays well below the centred crosshair
    distMul = aiming ? 0.9 : flying ? 1.12 : 1;
  }
  // camera breathes with the action: pulls back HARD at high flight speed (Mando), softer otherwise, + for the boss
  const adsFly = G.hero === 'mando' && (player.blockHeld || player.zoom);   // aiming → steadier, tighter camera
  const pullback = (G.hero === 'mando') ? clamp(speed * 0.14, 0, 4) : clamp(speed * 0.08, 0, 2);
  const wantDist = (8.2 + pullback + (shared.boss && shared.boss.hp > 0 ? 1.4 : 0)) * distMul;
  camDist += (wantDist - camDist) * Math.min(1, dt*3.5);
  const cosP = Math.cos(G.pitch), sinP = Math.sin(G.pitch);
  TMP.set(tx - f.x*camDist*cosP + rv.x*ots, ty + camHi + camDist*sinP, tz - f.z*camDist*cosP + rv.z*ots);
  if (TMP.y < 0.4) TMP.y = 0.4;
  // INERTIA — the camera lags when you boost / fly fast (a weighty swoop), but snaps tight when you're AIMING
  const lagBase = (adsFly) ? 0.00002 : (G.hero === 'mando' && (player.boosting || speed > 14)) ? 0.02 : 0.00004;
  camera.position.lerp(TMP, 1 - Math.pow(lagBase, dt));
  if (G.shake > 0){
    G.shake = Math.max(0, G.shake - dt*2.2);
    camera.position.x += rand(-1,1) * G.shake * 0.22;
    camera.position.y += rand(-1,1) * G.shake * 0.22;
  }
  if (player.landDip > 0) camera.position.y -= player.landDip;   // TOUCHDOWN — the view dips with the impact (decayed in updatePlayer)
  // Mando aims a bit ABOVE its own head height; while DIVING the look target drops so the camera follows the dive angle
  const diveLook = (G.hero === 'mando' && player.boosting) ? clamp(player.vy * 0.06, -2.0, 0) : 0;
  camera.lookAt(tx + f.x*3 + rv.x*ots, ty + (G.hero === 'mando' ? 0.7 : 0.5) + diveLook, tz + f.z*3 + rv.z*ots);
  // camera ROLL into a strafe — subtle for the Jedi; a pronounced Max-Payne bank for the boosting Mando, but
  // damped right down while AIMING so the shot stays readable.
  const strafe = vx * (-f.z) + vz * f.x;
  let rollGain = (G.hero === 'mando') ? (player.boosting ? 0.013 : !player.grounded ? 0.009 : 0.006) : 0.0035;
  let rollMax  = (G.hero === 'mando') ? (player.boosting ? 0.13 : 0.08) : 0.045;
  if (adsFly){ rollGain *= 0.35; rollMax *= 0.45; }
  camera.rotateZ(clamp(-strafe * rollGain, -rollMax, rollMax));
  // FOV kick on dashes and at speed; disruptor ZOOM (ADS) pulls the view in tight for precision
  // blasters get a SLIGHT aim zoom only while BRACING (hold RMB) for precision — single pulls in more than dual
  const blasterAim = (G.hero === 'mando' && !player.zoom && player.blockHeld && (player.weapon === 'single' || player.weapon === 'dual'))
                     ? (player.weapon === 'single' ? 28 : 20) : 0;   // bracing zooms in HARD now — the payoff for steadying
  const wantFov = player.zoom ? 30 : (70 + (player.dashT > 0 ? 15 : 0) + clamp(speed * 0.22, 0, 6) + (stance().fovKick || 0) - blasterAim);
  camFov += (wantFov - camFov) * Math.min(1, dt * (player.zoom ? 12 : 7));
  if (Math.abs(camera.fov - camFov) > 0.02){ camera.fov = camFov; camera.updateProjectionMatrix(); }
}
