// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Online co-op connection: one browser hosts under a short room code, the other joins with it. A WebRTC data channel
// (PeerJS: its free broker only introduces the two browsers, then they talk directly) carries small JSON messages.
// This file knows nothing about the game: ghost.js and coop-ui.js listen to it through on().

const ID_PREFIX = 'swpt-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I: easy to read out over voice chat
const CODE_LEN = 5;

/* the session, shared by everything that reads it: status is idle | hosting | joining | connected | failed */
export const net = {
  status: 'idle', role: null, code: '', error: '', ping: 0, peerPlays: false,
};

let peer = null, conn = null, pingTimer = 0, sendAt = 0;
const listeners = {};
export function on(event, fn){ (listeners[event] ||= []).push(fn); }
function emit(event, ...args){ for (const fn of listeners[event] || []) fn(...args); }
function setStatus(status, error = ''){ net.status = status; net.error = error; emit('status', net); }

const newCode = () => Array.from({ length: CODE_LEN }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);

/* STUN is enough for most home networks. For strict ones (some schools, offices, phone hotspots) the relay
   credentials come from /api/turn (api/turn.js, which holds the Cloudflare key); where that isn't deployed
   or fails, play simply goes on with STUN only. */
async function iceServers(){
  const stun = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  try {
    if (location.protocol === 'file:') return stun;   // the built single file opened from disk has no server to ask
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch('/api/turn', { signal: ctl.signal }); clearTimeout(timer);
    if (!res.ok) return stun;
    const { iceServers: relay } = await res.json();
    return Array.isArray(relay) ? relay : stun;
  } catch(e){ return stun; }
}

async function makePeer(id){
  const { Peer } = await import('peerjs');
  // ?peerhost=host&peerport=9000 points at a self-hosted PeerServer instead of the free PeerJS cloud one (also how the tests run)
  const q = new URLSearchParams(location.search), own = q.get('peerhost');
  const where = own ? { host: own, port: +q.get('peerport') || 9000, path: '/', secure: q.get('peersecure') === '1' } : {};
  return new Peer(id, { ...where, config: { iceServers: await iceServers() }, debug: 0 });
}

export async function host(attempt = 0){
  leave(true);
  net.role = 'host'; net.code = newCode(); setStatus('hosting');
  try { peer = await makePeer(ID_PREFIX + net.code); } catch(e){ return fail('Could not start the connection.'); }
  const mine = peer;
  peer.on('open', () => emit('status', net));
  peer.on('connection', (c) => {
    if (conn){ c.on('open', () => c.close()); return; }   // two players for now: a third is turned away
    attach(c);
  });
  peer.on('error', (err) => {
    if (mine !== peer) return;
    if (err.type === 'unavailable-id' && attempt < 4) return void host(attempt + 1);   // the code was taken: draw another
    fail(describe(err));
  });
}

export async function join(code){
  code = cleanCode(code);
  if (code.length !== CODE_LEN) return fail('Enter the 5-letter room code.');
  leave(true);
  net.role = 'guest'; net.code = code; setStatus('joining');
  try { peer = await makePeer(); } catch(e){ return fail('Could not start the connection.'); }
  const mine = peer;
  peer.on('error', (err) => { if (mine === peer) fail(err.type === 'peer-unavailable' ? 'No room with that code.' : describe(err)); });
  peer.on('open', () => {
    const c = peer.connect(ID_PREFIX + code, { serialization: 'json' });
    attach(c);
    setTimeout(() => { if (net.status === 'joining' && mine === peer) fail('Timed out. Check the code, or try again.'); }, 15000);
  });
}

function describe(err){
  return err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error'
    ? 'Could not reach the matchmaking service.' : 'Connection problem (' + (err.type || 'unknown') + ').';
}
function fail(message){ leave(true); setStatus('failed', message); }

function attach(c){
  conn = c;
  c.on('open', () => {
    setStatus('connected');
    emit('open');
    pingTimer = setInterval(() => send({ t: 'ping', at: performance.now() }), 2000);
  });
  c.on('data', (m) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ping') return void send({ t: 'pong', at: m.at });
    if (m.t === 'pong'){ net.ping = Math.round(performance.now() - m.at); emit('ping', net.ping); return; }
    emit(m.t, m);
  });
  c.on('close', () => { if (conn === c){ conn = null; clearInterval(pingTimer); emit('closed'); if (net.role === 'host' && peer){ setStatus('hosting'); } else leave(false, 'The host left the game.'); } });
  c.on('error', () => {});
}

export const connected = () => !!conn && conn.open;
export function send(msg){ if (conn && conn.open) conn.send(msg); }

/* state at ~15 per second: callers pass a function so the message is only built when it is due */
export function sendEvery(ms, build){
  const now = performance.now();
  if (now - sendAt < ms || !connected()) return;
  sendAt = now; send(build());
}

export function leave(quiet, message = ''){
  clearInterval(pingTimer);
  if (conn){ try { conn.close(); } catch(e){} conn = null; }
  if (peer){ try { peer.destroy(); } catch(e){} peer = null; }
  net.role = null; net.ping = 0; net.peerPlays = false;
  if (!quiet){ net.code = ''; setStatus(message ? 'failed' : 'idle', message); emit('closed'); }
}
