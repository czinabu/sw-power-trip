// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Painted Ink textures for the arenas: a banded sky dome (hard colour steps, flat clouds, horizon ridges, a sun or
// moon with an ink rim) and tiling floor patterns. Everything is drawn once per arena build onto a canvas.

import * as THREE from 'three';

const css = h => '#' + ('000000' + (h >>> 0).toString(16)).slice(-6);
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
const shade = (h, k) => { const c = new THREE.Color(h); c.multiplyScalar(k); return c.getHex(); };

// a seeded random, so a theme paints the same sky every time (rebuilds don't shimmer)
function rng(seed){ let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0) % 100000) / 100000; }

function tex(c, repeat){
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}

/* direction (x,z) on the sky sphere → canvas u (SphereGeometry: x = -cos(2πu), z = sin(2πu)) */
export function azToU(az){ const u = Math.atan2(Math.sin(az), -Math.cos(az)) / (Math.PI*2); return (u + 1) % 1; }

/* ---------- SKY ----------
   s: { top, horizon, below, bands, stars, sun:{az, el, color, size, kind}, clouds:{color, under, count, lo, hi, seed},
        ridges:[{color, h, rough, seed}], aurora:{colors:[…]} } */
export function paintSky(s){
  const W = 1024, H = 512, HZ = H/2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const R = rng(s.seed || 7);
  // hard-stepped bands from zenith to horizon (thinner near the horizon, like a painted gradient)
  const n = s.bands || 6;
  for (let i = 0; i < n; i++){
    const y0 = HZ * Math.pow(i/n, 0.75), y1 = HZ * Math.pow((i+1)/n, 0.75);
    x.fillStyle = css(mix(s.top, s.horizon, Math.pow(i/(n-1), 1.15)));
    x.fillRect(0, y0, W, y1 - y0 + 1);
  }
  x.fillStyle = css(s.below ?? s.horizon); x.fillRect(0, HZ, W, H - HZ);
  // stars in the upper bands (dim, so bloom doesn't smear them)
  for (let i = 0; i < (s.stars || 0); i++){
    x.fillStyle = 'rgba(255,255,255,' + (0.25 + R()*0.45).toFixed(2) + ')';
    const sz = R() < 0.1 ? 2 : 1;
    x.fillRect(R()*W, R()*HZ*0.6, sz, sz);
  }
  // aurora: wavy curtains of flat colour (frozen world)
  if (s.aurora){
    s.aurora.colors.forEach((col, k) => {
      x.globalAlpha = 0.35;
      x.fillStyle = css(col);
      x.beginPath();
      const base = HZ*(0.28 + k*0.1);
      x.moveTo(0, base);
      for (let u = 0; u <= W; u += 8) x.lineTo(u, base + Math.sin(u/W*Math.PI*2*(3+k) + k)*18 + Math.sin(u/W*Math.PI*2*7)*6);
      for (let u = W; u >= 0; u -= 8) x.lineTo(u, base + 26 + Math.sin(u/W*Math.PI*2*(3+k) + k)*18 + 40*Math.max(0, Math.sin(u/W*Math.PI*2*5)));
      x.fill();
      x.globalAlpha = 1;
    });
  }
  // sun / moon: flat disc, a lighter core, a thin ink rim (it sits low so it backlights the arena)
  if (s.sun){
    const u = azToU(s.sun.az) * W, v = (0.5 - s.sun.el/Math.PI) * H, r = s.sun.size || 26;
    for (const du of [-W, 0, W]){
      if (s.sun.halo){ x.fillStyle = css(s.sun.halo); x.globalAlpha = 0.35; x.beginPath(); x.arc(u+du, v, r*2.1, 0, 7); x.fill(); x.globalAlpha = 1; }
      x.fillStyle = css(s.sun.color); x.beginPath(); x.arc(u+du, v, r, 0, 7); x.fill();
      if (s.sun.kind === 'moon'){ x.fillStyle = css(shade(s.sun.color, 0.82)); x.beginPath(); x.arc(u+du - r*0.3, v - r*0.15, r*0.28, 0, 7); x.arc(u+du + r*0.35, v + r*0.3, r*0.18, 0, 7); x.fill(); }
      else { x.fillStyle = '#fffbe8'; x.beginPath(); x.arc(u+du, v, r*0.62, 0, 7); x.fill(); }
      if (s.sun.twin){ x.fillStyle = css(s.sun.twin); x.beginPath(); x.arc(u+du + r*2.6, v + r*0.9, r*0.7, 0, 7); x.fill(); }
    }
  }
  // flat clouds: lumpy strips with a darker underside band (cel), wrapping around the dome
  if (s.clouds){
    const cl = s.clouds, CR = rng(cl.seed || 11);
    for (let i = 0; i < (cl.count || 14); i++){
      const cx = CR()*W, cy = HZ*(cl.lo + CR()*(cl.hi - cl.lo)), len = 60 + CR()*170, th = 6 + CR()*12;
      for (const du of [-W, 0, W]){
        x.fillStyle = css(cl.under); blob(x, cx+du, cy + th*0.35, len, th, CR);
        x.fillStyle = css(cl.color); blob(x, cx+du, cy, len*0.94, th*0.8, CR);
      }
    }
  }
  // horizon ridges: far silhouettes, back to front (each one darker), seamless around the dome
  for (const r of s.ridges || []){
    const RR = rng(r.seed || 3), ph = [RR()*6, RR()*6, RR()*6, RR()*6];
    x.fillStyle = css(r.color);
    x.beginPath(); x.moveTo(0, HZ + 6);
    for (let u = 0; u <= W; u += 4){
      const t = u / W * Math.PI * 2;
      let h = 0.55 + 0.25*Math.sin(t*2 + ph[0]) + 0.13*Math.sin(t*5 + ph[1]) + (r.rough || 0.08)*Math.sin(t*17 + ph[2]) + (r.rough || 0.08)*0.6*Math.sin(t*41 + ph[3]);
      if (r.spiky) h += r.spiky * Math.pow(Math.abs(Math.sin(t*23 + ph[1])), 12);
      x.lineTo(u, HZ - Math.max(0, h) * r.h * HZ);
    }
    x.lineTo(W, HZ + 6); x.fill();
  }
  return tex(c);
}
function blob(x, cx, cy, len, th, R){
  x.beginPath();
  const n = 5;
  for (let i = 0; i < n; i++){
    const px = cx - len/2 + (i + 0.5) * len/n, rr = th * (0.7 + R()*0.6) * (i === 0 || i === n-1 ? 0.75 : 1);
    x.ellipse(px, cy, len/n*0.85, rr, 0, 0, 7);
  }
  x.fill();
}

/* ---------- FLOORS ----------
   f: { kind: flagstone|sand|basalt|deck|parquet|ash|snow|ice, base, line, hi, glow, seed }. One 512px tile = 9 world units. */
export function paintFloor(f){
  const N = 512;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  const R = rng(f.seed || 5);
  const base = f.base, line = f.line ?? shade(base, 0.62), hi = f.hi ?? shade(base, 1.18);
  x.fillStyle = css(base); x.fillRect(0, 0, N, N);
  // draw fn at the 9 wrap offsets so shapes crossing an edge tile seamlessly
  const wrap = fn => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]){ x.save(); x.translate(dx, dy); fn(); x.restore(); } };
  const speckle = (n, a, b) => { for (let i = 0; i < n; i++){ x.fillStyle = R() < 0.5 ? a : b; x.fillRect(R()*N, R()*N, 1 + R()*2, 1 + R()*2); } };
  // random shapes are rolled ONCE, then stroked at every wrap offset (rolling inside wrap() would break the tiling)
  const crack = (px, py, steps, len) => { const p = [[px, py]]; let h = R()*Math.PI*2; for (let j = 0; j < steps; j++){ h += (R()-0.5)*1.4; const l = len*(0.4 + R()*0.5); px += Math.cos(h)*l; py += Math.sin(h)*l; p.push([px, py]); } return p; };   // a heading that wanders, so cracks run instead of scribbling
  const stroke = p => { x.beginPath(); p.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); };
  const fill = p => { x.beginPath(); p.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.fill(); };
  const crackPath = (px, py, steps, len) => { const p = crack(px, py, steps, len); return () => stroke(p); };

  if (f.kind === 'flagstone'){
    // offset rows of big slabs; a few slabs a shade lighter or darker; grout in a dark line
    const rows = 4;
    for (let r = 0; r < rows; r++){
      const h = N/rows, off = (r % 2) * N/6;
      let u = -off;
      while (u < N){
        const w = N/3 * (0.7 + R()*0.6);
        const k = R();
        x.fillStyle = css(k < 0.2 ? hi : k > 0.82 ? shade(base, 0.86) : base);
        wrap(() => x.fillRect(u, r*h, w, h));
        x.strokeStyle = css(line); x.lineWidth = 4;
        wrap(() => x.strokeRect(u, r*h, w, h));
        u += w;
      }
    }
    x.strokeStyle = css(shade(line, 1.1)); x.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const d = crackPath(R()*N, R()*N, 3, 50); wrap(d); }
    speckle(900, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.07)');
  } else if (f.kind === 'sand'){
    // wind ripples: long wavy strokes in a light and a dark tone
    for (let i = 0; i < 26; i++){
      const y0 = R()*N, amp = 6 + R()*8, ph = R()*6, len = 120 + R()*240, x0 = R()*N;
      x.strokeStyle = css(i % 3 === 0 ? line : hi); x.lineWidth = i % 3 === 0 ? 2.5 : 3.5;
      wrap(() => { x.beginPath(); for (let u = 0; u <= len; u += 6){ const px = x0 + u, py = y0 + Math.sin(u/40 + ph)*amp; u ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); });
    }
    for (let i = 0; i < 10; i++){ x.fillStyle = css(shade(base, 0.9)); const px = R()*N, py = R()*N, r = 10 + R()*24; wrap(() => { x.beginPath(); x.ellipse(px, py, r*1.8, r*0.6, 0, 0, 7); x.fill(); }); }
    speckle(1400, 'rgba(255,240,210,0.06)', 'rgba(60,30,0,0.06)');
  } else if (f.kind === 'basalt' || f.kind === 'ash'){
    // polygonal plates split by cracks; basalt cracks glow (lava), ash cracks are just dark
    for (let i = 0; i < 18; i++){ x.fillStyle = css(R() < 0.5 ? shade(base, 0.86) : shade(base, 1.1)); const px = R()*N, py = R()*N, r = 30 + R()*50, p = []; for (let k = 0; k < 6; k++){ const a = k/6*Math.PI*2 + R()*0.4, rr = r*(0.7+R()*0.4); p.push([px + Math.cos(a)*rr, py + Math.sin(a)*rr]); } wrap(() => fill(p)); }
    const glow = f.kind === 'basalt' && f.glow;
    for (let i = 0; i < 12; i++){
      const p = crack(R()*N, R()*N, 9, 46), lit = glow && R() < 0.55;
      if (lit){ x.strokeStyle = css(line); x.lineWidth = 7; wrap(() => stroke(p)); }   // a dark lip around the glowing seam
      x.strokeStyle = css(lit ? glow : line); x.lineWidth = lit ? 2.5 : 3;
      wrap(() => stroke(p));
    }
    speckle(1600, 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.1)');
  } else if (f.kind === 'deck'){
    // metal deck plates with seams, rivets and a few hazard stripes
    const P = N/4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++){
      x.fillStyle = css((i + j) % 2 ? base : shade(base, 1.07)); x.fillRect(i*P, j*P, P, P);
      x.strokeStyle = css(line); x.lineWidth = 4; x.strokeRect(i*P, j*P, P, P);
      x.fillStyle = css(shade(line, 0.8));
      for (const [a, b] of [[8,8],[P-8,8],[8,P-8],[P-8,P-8]]){ x.beginPath(); x.arc(i*P+a, j*P+b, 3, 0, 7); x.fill(); }
    }
    if (f.stripe){
      const j = Math.floor(R()*4);
      x.save(); x.beginPath(); x.rect(0, j*P + P*0.4, N, P*0.2); x.clip();
      for (let u = -N; u < N*2; u += 28){ x.fillStyle = css(f.stripe); x.beginPath(); x.moveTo(u, j*P+P*0.4); x.lineTo(u+14, j*P+P*0.4); x.lineTo(u+14+P*0.2, j*P+P*0.6); x.lineTo(u+P*0.2, j*P+P*0.6); x.fill(); }
      x.restore();
    }
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
    for (let i = 0; i < 10; i++) { const d = crackPath(R()*N, R()*N, 2, 40); wrap(d); }
    speckle(1200, 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.08)');
  } else if (f.kind === 'parquet'){
    // long polished floorboards in staggered runs, each board a shade off its neighbours, with a fine grain
    const rows = 8, h = N/rows;
    for (let r = 0; r < rows; r++){
      let u = -R()*N/2;
      while (u < N){
        const w = N/2 * (0.6 + R()*0.7), k = R();
        x.fillStyle = css(k < 0.3 ? hi : k > 0.75 ? shade(base, 0.88) : base);
        wrap(() => x.fillRect(u, r*h, w, h));
        x.strokeStyle = css(line); x.lineWidth = 2.5;
        wrap(() => x.strokeRect(u, r*h, w, h));
        x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1;
        for (let g = 0; g < 3; g++){ const gy = r*h + h*(0.25 + R()*0.5), dy = (R()-0.5)*3, u0 = u; wrap(() => { x.beginPath(); x.moveTo(u0 + 6, gy); x.lineTo(u0 + w - 6, gy + dy); x.stroke(); }); }
        u += w;
      }
    }
    speckle(700, 'rgba(255,230,200,0.05)', 'rgba(0,0,0,0.06)');
  } else if (f.kind === 'snow' || f.kind === 'ice'){
    // soft drifts as flat lighter/darker shapes; ice gets white crack lines
    for (let i = 0; i < 16; i++){ x.fillStyle = css(R() < 0.5 ? hi : shade(base, 0.93)); const px = R()*N, py = R()*N, r = 20 + R()*50, rot = R()*0.6; wrap(() => { x.beginPath(); x.ellipse(px, py, r*2, r*0.7, rot, 0, 7); x.fill(); }); }
    if (f.kind === 'ice'){
      x.strokeStyle = css(hi); x.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const d = crackPath(R()*N, R()*N, 4, 70); wrap(d); }
    }
    x.strokeStyle = css(line); x.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const d = crackPath(R()*N, R()*N, 3, 40); wrap(d); }
    speckle(800, 'rgba(255,255,255,0.12)', 'rgba(40,60,90,0.06)');
  }
  return tex(c, true);
}
