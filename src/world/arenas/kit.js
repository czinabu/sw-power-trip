// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shared pieces for the authored arena builders: solid boxes and columns, the overwatch gantry, low rubble steps,
// and a seeded random so an arena looks the same every run (layouts are authored, not rolled).
//
// Collision is axis-aligned (boxes) or round (columns), so every solid here is placed axis-aligned. Anything the
// player can see standing on the floor is either solid or a low CLIMBABLE step: nothing is decoration you walk
// through. Something overhead you could land on (a lintel, a beam, a wing) is a SLAB, solid only from its underside up
// (world/collision.js). `npm run smoke:collision` lists any prop that is still a picture you pass through.

import * as THREE from 'three';
import { shared, pillars, solids } from '../../state.js';

export function seeded(seed){ let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0) % 100000) / 100000; }

export function arenaKit(){
  const g = shared.arenaGroup;
  const box = (x, z, hx, hz, h, mat, o = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(hx*2, h, hz*2), mat);
    m.position.set(x, (o.y || 0) + h/2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    if (o.solid !== false) solids.push({ x, z, hx, hz, h: (o.y || 0) + h, box: true, climbable: !!o.climbable });
    return m;
  };
  const column = (x, z, r, h, mat, o = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * (o.taper ?? 0.88), r, h, o.seg || 10), mat);
    m.position.set(x, h/2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    solids.push({ x, z, r, h });
    if (o.wallKick !== false) pillars.push({ x, z, r, h });
    return m;
  };
  /* an overhead SLAB's collision (no mesh): solid from y0 up to h over the box footprint, walked under, stood on */
  const slab = (x, z, hx, hz, y0, h, o = {}) => solids.push({ x, z, hx, hz, y0, h, box: true, ...o });
  const deco = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  /* OVERWATCH GANTRY — a three-tier climb (tiers 2.6 / 5.1 / 7.7). The Mando flies straight up; the Jedi needs chained
     double-jumps (each tier is above a single jump's ~1.93 apex). Ground melee can't follow, but snipers and flyers
     still reach the deck, so it's a vantage point, not a safe spot. dir flips which way the stair climbs. */
  const gantry = (gx, gz, mats, dir = [1, 1]) => {
    const [sx, sz] = dir;
    const t1 = { x: gx,          z: gz,          h: 2.6, hx: 1.3, hz: 1.3 };
    const t2 = { x: gx + 1.8*sx, z: gz + 1.4*sz, h: 5.1, hx: 1.2, hz: 1.2 };
    const t3 = { x: gx + 3.6*sx, z: gz + 2.6*sz, h: 7.7, hx: 1.9, hz: 1.9 };
    box(t1.x, t1.z, t1.hx, t1.hz, t1.h, mats.a);
    box(t2.x, t2.z, t2.hx, t2.hz, t2.h, mats.b);
    box(t3.x, t3.z, t3.hx, t3.hz, t3.h, mats.a);
    for (const [a, b] of [[t1, t2], [t2, t3]]){   // diagonal struts: visual only
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.h - a.h, len = Math.hypot(dx, dy, dz);
      const st = deco(new THREE.CylinderGeometry(0.12, 0.12, len, 6), mats.strut, (a.x+b.x)/2, (a.h+b.h)/2, (a.z+b.z)/2);
      st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    }
    deco(new THREE.BoxGeometry(2.4, 0.6, 0.1), mats.strut, t3.x, t3.h + 0.7, t3.z + 1.7*sz);   // deck rail
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: mats.beacon }));
    beacon.position.set(t3.x, t3.h + 1.3, t3.z); g.add(beacon);
    return [t1, t2, t3];
  };
  /* a low rubble step: a toppled drum or slab you can walk over (climbable, under STEP_UP), so it never snags */
  const rubble = (x, z, len, rad, mat, alongX) => {
    const m = deco(new THREE.CylinderGeometry(rad, rad*1.08, len, 8), mat, x, rad*0.8, z, alongX ? 0 : Math.PI/2, 0, alongX ? Math.PI/2 : 0);
    solids.push({ x, z, hx: alongX ? len/2 : rad, hz: alongX ? rad : len/2, h: rad*1.6, box: true, climbable: true });
    return m;
  };
  /* a SLIDE GATE for the training courses: two posts and a low bar across a lane running along x (the bar spans z).
     The bar is only a picture, not a solid (collision boxes stand on the floor): game/tutorial.js counts the gate
     only when you pass it sliding. */
  const slideGate = (x, z, span, post, bar) => {
    for (const s of [-1, 1]) column(x, z + s * span, 0.18, 1.7, post, { wallKick: false, seg: 8, taper: 1 });
    deco(new THREE.BoxGeometry(0.22, 0.22, span * 2), bar, x, 1.15, z).userData.passThrough = true;   // (the collision audit skips it)
  };
  /* a STATION SIGN for the training grounds: a lit plate with a name on it, standing over (or flush against) the station
     it names, facing `ry`. Only a picture (the collision audit skips it): it hangs high or lies flat on a face. */
  const sign = (text, x, y, z, ry, o = {}) => {
    const W = 512, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), ink = o.ink || '#ffe2a0', edge = o.edge || 'rgba(255,214,130,.85)';
    c.fillStyle = o.plate || 'rgba(8,16,28,.82)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = edge; c.lineWidth = 6; c.strokeRect(9, 9, W - 18, H - 18);
    c.fillStyle = edge; for (const sx of [24, W - 24]) c.fillRect(sx - 4, H / 2 - 4, 8, 8);
    let px = o.size || 58;
    const font = () => '700 ' + px + 'px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink;
    if ('letterSpacing' in c) c.letterSpacing = '6px';
    c.font = font();
    while (px > 24 && c.measureText(text).width > W - 84){ px -= 2; c.font = font(); }   // shrink a long name to fit the plate
    c.fillText(text, W / 2, H / 2 + 3);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const w = o.w || 3.2;
    const geo = new THREE.PlaneGeometry(w, w * H / W);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, fog: o.fog ?? true }));
    const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a121c, transparent: true, opacity: 0.85, fog: o.fog ?? true }));
    back.rotation.y = Math.PI; back.userData.passThrough = true; back.userData.noBake = true; m.add(back);   // seen from behind: just the plate
    m.position.set(x, y, z); m.rotation.y = ry || 0; m.userData.passThrough = true; m.userData.noBake = true;
    g.add(m); return m;
  };
  /* a BANNER hung flat against a face (or from a beam): cloth, a hem, and an emblem disc. Only a picture, like a sign */
  const banner = (x, y, z, ry, w, h, cloth, hem, mark) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry || 0;
    const mk = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.userData.passThrough = true; grp.add(m); return m; };
    mk(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9, side: THREE.DoubleSide }), 0, 0, 0);
    mk(new THREE.PlaneGeometry(w, h * 0.08), new THREE.MeshStandardMaterial({ color: hem, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), 0, -h * 0.46, 0.01);
    mk(new THREE.PlaneGeometry(w, h * 0.05), new THREE.MeshStandardMaterial({ color: hem, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), 0, h * 0.47, 0.01);
    if (mark != null) mk(new THREE.RingGeometry(w * 0.16, w * 0.24, 20), new THREE.MeshBasicMaterial({ color: mark, side: THREE.DoubleSide }), 0, h * 0.18, 0.015);
    g.add(grp); return grp;
  };
  /* a lit strip set flush into the floor: the lanes that lead from the spawn to each station */
  const strip = (x0, z0, x1, z1, wdt, color, op = 0.4) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, len), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(x1 - x0, z1 - z0);
    m.position.set((x0 + x1) / 2, 0.025, (z0 + z1) / 2); m.userData.passThrough = true; m.receiveShadow = false;
    g.add(m); return m;
  };
  /* a CORNER BASTION: the fall-back spot in a square arena's corner, past the round edge ring where foes arrive. Two
     climbable steps (0.5, then 1.0) rise toward the corner, a broken wall (1.6: it stops a bolt, and it can still be
     vaulted) guards the steps on the arena side, and a column on the corner side gives a wall-kick up. So a corner is a
     raised position with cover facing the fight, instead of an empty patch of floor a long way from anything; it's
     still a corner (cornered, and the steps are open to the flanks). (sx, sz) points outward, toward the corner. */
  const bastion = (cx, cz, sx, sz, mats) => {
    box(cx, cz, 2.3, 2.3, 0.5, mats.a, { climbable: true });
    box(cx + sx*0.8, cz + sz*0.8, 1.4, 1.4, 1.0, mats.b, { climbable: true });
    // the guard walls on the two inner sides: one along x (facing the arena north/south), one shorter along z
    box(cx - sx*0.4, cz - sz*2.6, 1.9, 0.3, 1.6, mats.b);
    box(cx - sx*2.6, cz + sz*0.3, 0.3, 1.2, 1.6, mats.a);
    deco(new THREE.BoxGeometry(0.7, 0.3, 0.5), mats.a, cx - sx*0.9, 1.75, cz - sz*2.6, 0, 0.3, 0);   // a fallen cap stone
    column(cx + sx*2.6, cz - sz*1.4, 0.55, 3.4, mats.b, { taper: 0.8, seg: 7 });
  };
  return { box, column, slab, deco, gantry, rubble, slideGate, sign, banner, strip, bastion };
}

/* polar → x,z (angle 0 = +x, π/2 = +z, the side the player spawns on) */
export const at = (a, r) => [Math.cos(a)*r, Math.sin(a)*r];
