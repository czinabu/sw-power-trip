// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Cut aim, Jedi Academy style: each cut is an angle on the clock plus a height (data/stances.js CUT_ANGLE). A mouse
// flick, the movement keys or the form's string pick the angle; where you aim picks the height.

import { CUT_AIM, CUT_ANGLE, SWING_PATTERNS } from '../../data/stances.js';
import { G, keys, player } from '../../state.js';

const D2R = Math.PI / 180;

/* 'high' | 'mid' | 'low' — how far the view is tipped up or down from where it sits in a fight. (The view orbits the hero
   from behind, so the crosshair's line crosses a foe close in front LOWER as you look up: the tip of the view is the
   honest read of where you mean to cut, the way the crosshair rises over a foe's head as you look up.) */
export function cutHeight(pitch = aimPitch()){
  return pitch < CUT_AIM.pitchHigh ? 'high' : pitch > CUT_AIM.pitchLow ? 'low' : 'mid';
}

/* ---------------- the mouse flick (engine/input.js feeds it every mouse move) ---------------- */
const FL = { x: 0, y: 0, at: 0, calm: 0.2 };
const now = () => performance.now() / 1000;
function decayed(){
  const k = Math.exp(-(now() - FL.at) / CUT_ANGLE.flick.tau);
  return { x: FL.x * k, y: FL.y * k };
}
export function noteFlick(dx, dy){
  const d = decayed();
  // the view's tilt from before this flick began: that's the height you were aiming at
  if (Math.hypot(d.x, d.y) < CUT_ANGLE.flick.min * 0.5) FL.calm = G.pitch;
  FL.x = d.x + dx; FL.y = d.y + dy; FL.at = now();
}
// the angle a flick right now would cut from, or null (no flick worth reading)
export function flickAngle(){
  if (!G.cutMouse) return null;
  const d = decayed();
  if (Math.hypot(d.x, d.y) < CUT_ANGLE.flick.min) return null;
  // the blade travels the way the mouse went (screen y runs down); the cut comes from the opposite side
  return ((Math.atan2(d.y, -d.x) / D2R) + 360) % 360;
}
const aimPitch = () => (flickAngle() != null ? FL.calm : G.pitch);

/* a cut from `ang` degrees at height h, as a swing pattern: the side it comes in on (yF / yT: the body's turn, and the
   line a guard has to cover: enemies/duel.js patLine), and the hips' drop into a low flat cut */
export function anglePattern(ang, h){
  ang = ((ang % 360) + 360) % 360;
  const c = Math.cos(ang * D2R), s = Math.sin(ang * D2R), side = Math.abs(c) > 0.38;
  const line = h === 'low' && Math.abs(c) > 0.6 && Math.abs(s) < 0.45 ? 'Lo' : side ? (c > 0 ? 'R' : 'L') : 'H';
  return { id: 'ang', ang, h, line, yF: side ? c * 1.6 : 0.35, yT: side ? -c * 1.5 : -0.25,
    drop: h === 'low' ? 0.04 + 0.12 * Math.abs(c) : s < -0.5 ? 0.08 : 0, reach: 0.4 };
}
// the key family the rest of the swing code reads (the arc's width, strafe spins, the training's cut lesson)
function dirOf(ang){
  const c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
  return Math.abs(c) > 0.7 ? (c > 0 ? 'left' : 'right') : s > 0 ? 'forward' : 'neutral';
}
// the form's string: the next angle in it, picked up where it left off unless you stopped cutting a while
function stringAngle(advance){
  const S = CUT_ANGLE.strings[G.hero === 'mando' ? 'strong' : G.stance] || CUT_ANGLE.strings.medium;
  const st = player.cutStr || (player.cutStr = { i: 0, at: -9 });
  if (G.gt - st.at > CUT_ANGLE.reset) st.i = 0;
  const ang = S[st.i % S.length];
  if (advance){ st.i++; st.at = G.gt; }
  return ang;
}
const mirror = ang => (G.swingMirror ? (540 - ang) % 360 : ang);   // SWING preference: flip which way the side cuts sweep

/* the cut for this press: { pat, dir, h, flick } — dir is the key family (neutral / left / right / forward / back);
   pat the cut (an angle cut, or a keyed one: the thrust, the back strike, the finisher's). `advance` false only
   previews it (the HUD dial). */
export function pickCut(step, advance = true){
  const K = CUT_ANGLE.keys, w = keys['w'], s = keys['s'], a = keys['a'], d = keys['d'];
  const h = cutHeight();
  const fa = flickAngle();
  if (fa != null) return { pat: anglePattern(fa, h), dir: dirOf(fa), h, flick: true };
  const side = d ? 'right' : a ? 'left' : null;
  let ang = null, dir, id;
  if (side){ dir = side; ang = w ? (side === 'left' ? K.fwdLeft : K.fwdRight) : s ? (side === 'left' ? K.backLeft : K.backRight) : K[side]; }
  else if (w){ dir = 'forward'; if (h === 'low') id = 'thrust'; else ang = K.forward; }
  else if (s){ dir = 'back'; id = 'back'; }
  else {
    dir = 'neutral';
    if (step === 2) id = 'forward';
    else ang = stringAngle(advance);
  }
  if (id) return { pat: SWING_PATTERNS[id], dir, h };
  return { pat: anglePattern(mirror(ang), h), dir, h };
}
