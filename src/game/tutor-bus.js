// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The training bus: gameplay code reports moves that worked (a parry, a vault, a headshot) and the tutorial listens.
// Kept free of imports so any module can call tutEvent() without pulling the tutorial in.

let listener = null;
export function setTutListener(fn){ listener = fn; }
export function tutEvent(name, data){ if (listener) listener(name, data); }
