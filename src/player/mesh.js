// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildPlayer(): the procedural player model (see ./model for the rig, outfits and gear) + the swing arc flash.

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { scene } from '../engine/renderer.js';
import { player } from '../state.js';
import { buildHeroModel } from './model/index.js';

// render style for the hero models (prototype switch: ?style=shard|ink|forged)
const STYLE = new URLSearchParams(location.search).get('style') || 'forged';

function buildPlayer(){
  const g = player.group;
  g.add(buildHeroModel(player, STYLE));   // everything visual lives in player.vis so flips/leans don't move the root

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
