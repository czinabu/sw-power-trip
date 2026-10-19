// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildPlayer(): the procedural player model (see ./model for the rig, outfits and gear) + the swing arc flash.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { scene } from '../engine/renderer.js';
import { player } from '../state.js';
import { buildHeroModel } from './model/index.js';
import { SAMPLE_LOOKS, mergeLook } from './model/appearance.js';
import { lookFromPicks } from '../data/customize.js';

/* the hero look: the player's customizer picks (saved in localStorage), with dev overrides on top:
   ?style=shard|ink|forged  ?look=<a SAMPLE_LOOKS name> */
const params = new URLSearchParams(location.search);
const DEV_LOOK = { ...(SAMPLE_LOOKS[params.get('look')] || {}), ...(params.get('style') ? { style: params.get('style') } : {}) };
const PICKS_KEY = 'sw_look';
export function loadPicks(){
  try { const p = JSON.parse(localStorage.getItem(PICKS_KEY)); return p && typeof p === 'object' ? p : {}; } catch(e){ return {}; }
}
export function savePicks(picks){ try { localStorage.setItem(PICKS_KEY, JSON.stringify(picks)); } catch(e){} }
export const lookOf = (picks) => mergeLook(lookFromPicks(picks), DEV_LOOK);

function buildPlayer(){
  const g = player.group;
  g.add(buildHeroModel(player, lookOf(loadPicks())));   // everything visual lives in player.vis so flips/leans don't move the root

  // swing arc flash — centred on the FORWARD direction (thetaStart shifted by -90°), not the player's left
  const arc = new THREE.Mesh(new THREE.RingGeometry(0.9, CFG.player.hitRadius, 26, 1, -Math.PI/2 - 1.2, 2.4),
    new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  arc.rotation.x = -Math.PI/2;
  arc.position.y = 1.5;
  g.add(arc);
  player.arcMesh = arc;

  scene.add(g);
}
buildPlayer();

/* restyle the player to new customizer picks (from the menu, between runs): swap the model under player.group for a
   fresh build and drop the pieces the animation adds to the old rig on demand, so they grow back on the new one */
export function rebuildPlayerModel(picks){
  const g = player.group, old = player.vis;
  g.remove(old);
  disposeTree(old);
  for (const k of ['wristBlade', 'shieldMesh']){ if (player[k]){ player[k].removeFromParent(); disposeTree(player[k]); } player[k] = null; }
  player._footing = null; player._legIK = null;
  g.add(buildHeroModel(player, lookOf(picks)));
}

export function disposeTree(root){
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose();
  });
}
