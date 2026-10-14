// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Procedural floor, sky and ember textures.

import * as THREE from 'three';
import { rand } from '../utils.js';

/* ---------- procedural textures ---------- */
function hexCss(h){ return '#' + ('000000' + h.toString(16)).slice(-6); }
export function makeFloorTex(baseHex){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = hexCss(baseHex); x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++){
    x.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
    x.fillRect(Math.random()*256, Math.random()*256, rand(1,3), rand(1,3));
  }
  x.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 14; i++){
    x.beginPath();
    let px = Math.random()*256, py = Math.random()*256;
    x.moveTo(px, py);
    for (let j = 0; j < 4; j++){ px += rand(-40,40); py += rand(-40,40); x.lineTo(px, py); }
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
export function makeSkyTex(topHex, horizonHex){
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hexCss(topHex));
  grad.addColorStop(0.62, hexCss(horizonHex));
  grad.addColorStop(1, hexCss(horizonHex));
  x.fillStyle = grad; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 90; i++){
    x.fillStyle = 'rgba(255,255,255,' + rand(0.15, 0.5).toFixed(2) + ')';   // dim enough not to bloom into smears
    x.fillRect(Math.random()*64, rand(20, 130), 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let emberSprite = null;
export function makeEmberSprite(){
  if (emberSprite) return emberSprite;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad; x.fillRect(0, 0, 32, 32);
  emberSprite = new THREE.CanvasTexture(c);
  return emberSprite;
}
