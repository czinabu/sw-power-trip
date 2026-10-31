// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The squad in online co-op. The HOST's browser runs the squadmates (allies/squad.js) and sends where each stands, its
// order and health about 10 times a second; the GUEST's browser draws them as puppets, sees their bolts and grenades,
// and can command them: its orders (the tap of H and the command wheel) come here and are given on the host's side,
// pointed where the guest pointed. ON ME from the guest has the squad form up on the guest. A squadmate runs to whichever
// hero is down, and the guest calling in reinforcements calls them in on the host.

import { G, shared, bolts } from '../state.js';
import { V3 } from '../utils.js';
import { fireBolt } from '../enemies/bolts.js';
import { throwGrenade, grenades } from '../enemies/grenades.js';
import { COMMAND } from '../data/allies.js';
import { squadLink, squadSnap, syncNetSquad, dropNetSquad, giveOrder, addSquadmate, allies } from '../allies/squad.js';
import { partnerSpot } from './partner.js';
import { net, on, send, connected } from './session.js';
import { puppetOf, runKind } from './foes.js';

const asHost = () => net.role === 'host' && connected() && !!runKind() && !G.coopGuest && G.mode === 'play';
const asGuest = () => net.role === 'guest' && connected() && G.coopGuest;
const r2 = (n) => Math.round(n * 100) / 100;
const SEND_MS = 100;
let sentAt = 0, hostSent = false, heardAt = 0;

/* ---------- host ---------- */
squadLink.partner = (slot) => (asHost() ? partnerSpot(slot) : null);
squadLink.shot = (m, d, speed) => {
  if (!asHost()) return;
  send({ t: 'sqb', p: [r2(m.x), r2(m.y), r2(m.z)], d: [r2(d.x), r2(d.y), r2(d.z)], s: speed, c: G.hero === 'mando' ? 0xffa040 : 0x4aa8ff });
};
squadLink.lob = (from, at) => {
  if (!asHost()) return;
  send({ t: 'sqg', f: [r2(from.x), r2(from.y), r2(from.z)], a: [r2(at.x), r2(at.z)] });
};
// an order the guest gave, given here with the guest's aim; ON ME means on them
on('sqo', (m) => {
  if (!asHost()) return;
  giveOrder(m.id, m.idx == null ? null : m.idx, { partner: m.from || true, at: m.at, target: m.target });   // (partner: whose ON ME it is)
});
on('sqadd', () => { if (asHost()) addSquadmate(); });

export function updateSquadNet(){
  // host: the squad, while there is one (and one last empty list when it goes, so the guest's puppets go too)
  if (asHost()){
    if (allies.length || hostSent){
      const now = performance.now();
      if (now - sentAt >= SEND_MS){
        sentAt = now;
        send({ t: 'sq', ...squadSnap(e => e === shared.boss ? 'B' : e.nid) });
        hostSent = allies.length > 0;
      }
    }
  } else if (hostSent){ hostSent = false; if (connected()) send({ t: 'sq', l: [] }); }
  // guest: nothing heard for a while (the host left, or the fight ended), drop the puppets
  if (!asGuest() || performance.now() - heardAt > 2000){ if (allies.some(a => a.net)) dropNetSquad(); }
}

/* ---------- guest ---------- */
squadLink.order = (o) => { if (asGuest()) send({ t: 'sqo', ...o }); };
squadLink.add = () => { if (asGuest()) send({ t: 'sqadd' }); };
on('sq', (m) => {
  if (!asGuest()) return;
  heardAt = performance.now();
  syncNetSquad(m, puppetOf);
});
on('sqb', (m) => {
  if (!asGuest()) return;
  fireBolt(V3(m.p[0], m.p[1], m.p[2]), V3(m.d[0], m.d[1], m.d[2]), m.s, 0, true, true, null);
  const b = bolts[bolts.length - 1];
  b.ghost = true; b.mesh.material.color.setHex(m.c);   // only the picture: the host's copy does the damage
});
on('sqg', (m) => {
  if (!asGuest()) return;
  throwGrenade({ t: { ...COMMAND.grenade, dmg: 0 } }, V3(m.f[0], m.f[1], m.f[2]), V3(m.a[0], 0, m.a[1]), true);
  grenades[grenades.length - 1].vis = true;
});
on('status', (n) => { if (n.status !== 'connected') dropNetSquad(); });
