// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Stamina refill timing, eased harder the deeper the run goes (CFG.player.stamRamp). Base values hold on Padawan and
// in training, sandbox and missions.

import { CFG } from '../data/config.js';
import { G } from '../state.js';
import { clamp } from '../utils.js';

// 0 at the base values → 1 at the deepest (Exegol / survival wave 10)
export function stamDepth(){
  if (G.diff === 'padawan' || G.training || G.sandbox || G.mission) return 0;
  const R = CFG.player.stamRamp;
  return G.endless ? clamp((G.endlessWave || 0) / R.survivalWave, 0, 1) : clamp((G.waveTotal || 0) / R.campaignWave, 0, 1);
}
// seconds of rest after spending stamina before it refills
export const stamDelay = () => CFG.player.stamDelay + (CFG.player.stamRamp.delayTo - CFG.player.stamDelay) * stamDepth();
// refill per second, before upgrades
export const stamRegen = () => CFG.player.stamRegen + (CFG.player.stamRamp.regenTo - CFG.player.stamRegen) * stamDepth();
