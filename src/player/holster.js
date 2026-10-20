// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Holstering (4): the Jedi clips his saber to his belt and fights with the Force alone; the Mando holsters his weapon and fights with his fists and gadgets.

import { G, shared, player } from '../state.js';
import { sfx } from '../audio/sfx.js';
import { floater } from '../fx/floaters.js';
import { reigniteBlade } from '../fx/trail.js';
import { showBanner } from '../ui/banners.js';
import { weaponUnlocked } from '../data/mando.js';
import { playerPos } from './helpers.js';
import { cancelSwing } from './jedi/combat.js';
import { switchWeapon } from './mando/weapons.js';

/* Where each stowed weapon hangs: a rig socket (model/rig.js) and its position + rotation there. The hilts clip on
   upright at the left hip; the blasters drop barrel-down into the thigh holsters; the rifle rides the pack. */
const STOW = {
  saber:     { socket: 'belt', pos: [0, -0.04, 0],      rot: [0.25, 0, 0.18] },
  darksaber: { socket: 'belt', pos: [0, -0.04, 0],      rot: [0.25, 0, 0.18] },
  pistolR:   { socket: 'hipR', pos: [0.02, -0.1, 0.02], rot: [Math.PI / 2, 0, 0] },
  pistolL:   { socket: 'hipL', pos: [-0.02, -0.1, 0.02], rot: [Math.PI / 2, 0, 0] },
  rifle:     { socket: 'back', pos: [-0.24, -0.42, -0.3], rot: [-Math.PI / 2, 0, -0.32, 'ZXY'] },   // slung up the pack's left side, muzzle over the shoulder
};
const SABER_LIGHT = 8;   // the blade's PointLight at full (model/weapons.js); dimmed to 0 rather than hidden so no shader recompiles

/* move `mesh` into its stowed spot (key in STOW), or back into the hand it was mounted in (key null) */
function place(mesh, key){
  if (!mesh) return;
  const u = mesh.userData;
  if (!u.hand) u.hand = mesh.parent;   // the hand socket it was mounted on (model/weapons.js mountWeapon)
  if (key){
    const at = STOW[key], sock = player.rig.sockets[at.socket];
    if (mesh.parent !== sock){ sock.add(mesh); mesh.position.set(...at.pos); mesh.rotation.set(...at.rot); }
  } else if (mesh.parent !== u.hand){
    u.hand.add(mesh);
    mesh.position.set(0, -0.04, 0);   // the grip (GRIP_Y in model/weapons.js)
    mesh.rotation.order = 'XYZ';   // (a stowed spot may have set its own)
    if (u.restQ) mesh.quaternion.copy(u.restQ);
  }
}

// is the current hero fighting without the weapon in hand?
export function holstered(){ return G.hero === 'mando' ? player.weapon === 'fists' : !!player.holstered; }

/* hang every weapon where the current state says: the Jedi saber in hand or on the belt (blade out or off), the
   Mando's last-drawn weapon in hand or stowed. Visibility (which weapon is the Mando's) is syncWeaponMesh's job. */
export function syncHolster(){
  if (!player.rig || !player.rig.sockets) return;
  const jediAway = G.hero !== 'mando' && !!player.holstered;
  place(player.saberHand, jediAway ? 'saber' : null);
  const B = player.blade;
  if (B){ B.blade.visible = B.glow.visible = !jediAway; B.light.intensity = jediAway ? 0 : SABER_LIGHT; }
  const away = G.hero === 'mando' && player.weapon === 'fists', w = player.drawnWeapon;
  if (player.pistols){
    place(player.pistols.R, away && (w === 'single' || w === 'dual') ? 'pistolR' : null);
    place(player.pistols.L, away && w === 'dual' ? 'pistolL' : null);
  }
  place(player.rifleMesh, away && w === 'disruptor' ? 'rifle' : null);
  place(player.darksaberMesh, away && w === 'darksaber' ? 'darksaber' : null);
  if (player.darkBlades) for (const b of player.darkBlades) b.visible = !away;
}

export function toggleHolster(){
  if (G.mode !== 'play') return;
  if (G.hero === 'mando'){
    if (shared.darkProj) return;   // the darksaber is out on the grappling line: catch it first
    if (player.weapon === 'fists') switchWeapon(weaponUnlocked(player.drawnWeapon) ? player.drawnWeapon : 'single');
    else {
      if (player.atkT > 0) cancelSwing();   // a darksaber swing in flight
      player.drawnWeapon = player.weapon;
      player.firing = false;
      switchWeapon('fists');
    }
    return;
  }
  if (shared.saberProj){   // the blade is still in flight: catch it first
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO BLADE', '#bfe8ff'); }
    return;
  }
  if (player.atkT > 0) cancelSwing();
  player.holstered = !player.holstered;
  player.deflectAnim = null; player.palmT = 0; player.palm = null; player.palmQueued = false;
  syncHolster();
  if (player.holstered){
    showBanner('', 'SABER HOLSTERED · THE FORCE ALONE', 1.0);
    sfx(300, 0.12, 'sawtooth', 0.05, 70); sfx(900, 0.05, 'square', 0.03, 600);   // the blade dies, the hilt clicks onto the belt
  } else {
    showBanner('', 'SABER DRAWN', 0.8);
    reigniteBlade();   // snap-hiss
    sfx(360, 0.2, 'sine', 0.09, 1300); sfx(90, 0.16, 'sawtooth', 0.05, 60);
  }
}
