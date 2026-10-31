// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP DISPLAY NAMES: the name you pick in the co-op panel (kept in this browser for next time) is sent with your hello,
// and every player sees it over your head, in the room list, on down banners and on pings. A blank name (or one made
// only of symbols) falls back to the seat: PLAYER 2.

const KEY = 'sw_coop_name';
export const NAME_MAX = 14;
const names = new Map();   // seat -> that player's name, as heard in their hello

// letters, digits and a few marks only; runs of spaces collapse; cut to NAME_MAX. Also applied to what arrives from other
// browsers, since the host relays whatever a guest sends
export const cleanName = (s) => String(s ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _'.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();

// the same filter while typing, which keeps a space at the end so you can type the next word
export const typingName = (s) => String(s ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _'.-]/gu, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, NAME_MAX);

export function savedName(){ try { return cleanName(localStorage.getItem(KEY)); } catch(e){ return ''; } }
export function saveName(s){ const n = cleanName(s); try { n ? localStorage.setItem(KEY, n) : localStorage.removeItem(KEY); } catch(e){} return n; }

export const setName = (slot, name) => { names.set(slot, cleanName(name)); };   // '' when they set none: still a player in the room
export const forgetName = (slot) => { names.delete(slot); };
export const forgetAll = () => { names.clear(); };
// the shown name of a seat: their pick (upper case, like every tag) or PLAYER n
export const nameOf = (slot) => (names.get(slot) || 'PLAYER ' + (slot + 1)).toUpperCase();
export const hasName = (slot) => !!names.get(slot);
export const seatsHeard = () => [...names.keys()];   // the seats whose hello has arrived
