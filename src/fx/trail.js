// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Lightsaber swing trail, blade motion smear, and the re-ignite flicker on a form change.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, isGunner } from '../state.js';
import { stance, bladeColor } from '../player/helpers.js';
import { FORM_OF } from '../data/poses.js';

/* ---------- saber motion trail ----------
   A ribbon from hilt to tip, sampled once a frame and smoothed with Catmull-Rom so even a fast Ataru cut reads as a
   clean arc. The leading edge burns white-hot and cools to the blade colour as it fades, like the films' blade
   streaks. Each form leaves its own trail: Ataru short and whippy, Djem So long and heavy, the darksaber a pale
   cold edge. */
const trailGeo = new THREE.BufferGeometry();
const glowTrailMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
// the darksaber can't glow additively (its blade is black): its streak is drawn as ink, a near-black smear with a
// white crackling edge, alpha-blended so the dark actually shows
const darkTrailMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, vertexColors: true });
export const trailMesh = new THREE.Mesh(trailGeo, glowTrailMat);
trailMesh.frustumCulled = false;
trailMesh.visible = false;
scene.add(trailMesh);
const TRAIL = {   // life (s) · core (how hot the leading edge burns) · base (how far down the blade the ribbon starts)
  shiicho:   { life: 0.22, core: 0.65, base: 0.12 },   // broad, sweeping arcs
  makashi:   { life: 0.11, core: 0.95, base: 0.4 },    // a thin, precise flick
  soresu:    { life: 0.15, core: 0.7, base: 0.25 },
  ataru:     { life: 0.13, core: 0.9, base: 0.35 },
  niman:     { life: 0.17, core: 0.75, base: 0.2 },
  djemso:    { life: 0.24, core: 0.6, base: 0.12 },
  shien:     { life: 0.2, core: 0.7, base: 0.18 },
  juyo:      { life: 0.16, core: 0.95, base: 0.22 },   // hot, ragged streaks
  vaapad:    { life: 0.19, core: 0.8, base: 0.16 },
  darksaber: { life: 0.2, core: 0.35, base: 0.15 },
};
const SUB = 4;   // Catmull-Rom subdivisions between frame samples
const trailPts = [];
const _ca = [0, 0, 0, 1], _cb = [0, 0, 0, 1];
const TRB = new THREE.Vector3(), TRT = new THREE.Vector3(), _c = new THREE.Color(), _cw = new THREE.Color(0xffffff);
let trailCol = new THREE.Color(0x55ccff), trailCfg = TRAIL.niman, tipSpeed = 0;
const cr = (p0, p1, p2, p3, t, out) => {   // centripetal-free uniform Catmull-Rom, plenty for a blade arc
  const t2 = t*t, t3 = t2*t;
  return out.set(
    0.5*((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    0.5*((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
    0.5*((2*p1.z) + (-p0.z+p2.z)*t + (2*p0.z-5*p1.z+4*p2.z-p3.z)*t2 + (-p0.z+3*p1.z-3*p2.z+p3.z)*t3));
};
export function updateTrail(dt){
  updateBladeFX(dt);
  for (const p of trailPts) p.age += dt;
  while (trailPts.length && trailPts[0].age > trailCfg.life) trailPts.shift();
  // follow whichever blade is actually swinging — the Jedi saber OR the Mando darksaber (the swing or the
  // ability slash) — so the ribbon traces the real arc, in either grip
  const bladeNode = (player.saberHand && player.saberHand.visible) ? player.saberHand
                  : (player.darksaberMesh && player.darksaberMesh.visible) ? player.darksaberMesh : null;
  const swinging = player.atkT > 0 || player.darkT > 0;
  if (swinging && bladeNode){
    const dark = bladeNode === player.darksaberMesh;
    trailCfg = TRAIL[dark ? 'darksaber' : (FORM_OF[G.stance] || 'niman')];
    trailMesh.material = dark ? darkTrailMat : glowTrailMat;
    const len = dark ? 1.3 : 0.18 + 1.6 * (stance().bladeLen || 1);   // to the blade tip
    const sampleNode = dark ? bladeNode : (player.saberBladeRoot || bladeNode);
    sampleNode.updateWorldMatrix(true, false);
    TRB.set(0, 0.1 + len * trailCfg.base, 0); sampleNode.localToWorld(TRB);
    TRT.set(0, len, 0);                        sampleNode.localToWorld(TRT);   // sample along the blade toward the tip
    const last = trailPts[trailPts.length - 1];
    tipSpeed = last && dt > 0 ? last.t.distanceTo(TRT) / dt : 0;
    trailPts.push({ b: TRB.clone(), t: TRT.clone(), age: 0 });
    if (trailPts.length > 24) trailPts.shift();
    trailCol.setHex((player.swing && player.swing.riposte) ? 0xffe27a     // a riposte cuts a brilliant GOLD arc
      : dark ? 0xd9ccff : bladeColor());
  } else tipSpeed = 0;
  if (trailPts.length < 2){ trailMesh.visible = false; return; }
  trailMesh.visible = true;
  // densify: Catmull-Rom between each pair of frame samples
  const pts = [];
  const n0 = trailPts.length;
  for (let i = 0; i < n0 - 1; i++){
    const p0 = trailPts[Math.max(0, i-1)], p1 = trailPts[i], p2 = trailPts[i+1], p3 = trailPts[Math.min(n0-1, i+2)];
    for (let s = 0; s < SUB; s++){
      const t = s / SUB;
      pts.push({ b: cr(p0.b, p1.b, p2.b, p3.b, t, new THREE.Vector3()), t: cr(p0.t, p1.t, p2.t, p3.t, t, new THREE.Vector3()),
                 age: p1.age + (p2.age - p1.age) * t });
    }
  }
  pts.push(trailPts[n0 - 1]);
  const n = pts.length;
  const pos = new Float32Array((n-1)*18);
  const col = new Float32Array((n-1)*24);
  // per sample: brightness fades with age and toward the tail; the newest edge burns toward white. The fade is
  // QUANTISED into cel bands (like the toon ramp on the models), so the streak reads as flat painted arcs.
  const dark = trailMesh.material === darkTrailMat;
  const band = (x) => Math.ceil(x * 4) / 4;
  const shade = (p, i, out) => {
    const f = Math.max(0, 1 - p.age / trailCfg.life), lead = i / (n-1);
    const k = band(f * f * lead);
    const hot = Math.pow(lead, 6) * f * trailCfg.core > 0.3 ? 1 : 0;   // a hard white leading edge, not a soft blend
    if (dark){ _c.setRGB(0.05, 0.04, 0.08).lerp(_cw, hot); out[3] = k; }
    else { _c.copy(trailCol).multiplyScalar(k).lerp(_cw, hot * 0.85); out[3] = 1; }
    out[0] = _c.r; out[1] = _c.g; out[2] = _c.b;
    return out;
  };
  let o = 0, c = 0;
  const put = (v) => { pos[o++] = v.x; pos[o++] = v.y; pos[o++] = v.z; };
  const tint = (cl) => { col[c++] = cl[0]; col[c++] = cl[1]; col[c++] = cl[2]; col[c++] = cl[3]; };
  for (let i = 0; i < n-1; i++){
    const a = pts[i], b = pts[i+1];
    put(a.b); put(a.t); put(b.t); put(a.b); put(b.t); put(b.b);
    const ca = shade(a, i, _ca), cb = shade(b, i+1, _cb);
    tint(ca); tint(ca); tint(cb); tint(ca); tint(cb); tint(cb);
  }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(col, 4));
}

/* ---------- blade FX ----------
   • motion smear: the glow sheath swells with tip speed mid-cut, so a fast stroke reads as a smear of light
   • re-ignite: changing form retracts and re-extends the blade (snap-hiss) instead of a silent recolour */
let igniteT = 0;
const IGNITE = 0.24;
export function reigniteBlade(){ igniteT = IGNITE; }
function updateBladeFX(dt){
  const B = player.blade;
  if (!B) return;
  const len = stance().bladeLen || 1;
  if (igniteT > 0){
    igniteT = Math.max(0, igniteT - dt);
    const k = 1 - igniteT / IGNITE;
    const ext = k < 0.35 ? 1 - k / 0.35 : (k - 0.35) / 0.65;          // retract, then extend (eased)
    const e = Math.max(0.02, ext < 1 ? 1 - Math.pow(1 - ext, 3) : 1);
    setBladeLen(B, len * e);
  } else if (B.blade.scale.y !== len && !isGunner()) setBladeLen(B, len);
  const smear = 1 + Math.min(0.9, tipSpeed * 0.025);
  const sx = B.glow.scale.x + (smear - B.glow.scale.x) * Math.min(1, dt * 18);
  B.glow.scale.x = B.glow.scale.z = sx;
}
// the blade meshes are centred on y≈0.95; keep the hilt end fixed as the length changes
function setBladeLen(B, s){
  B.blade.scale.y = s; B.glow.scale.y = s;
  B.blade.position.y = 0.17 + 0.78 * s; B.glow.position.y = 0.15 + 0.8 * s;
}
