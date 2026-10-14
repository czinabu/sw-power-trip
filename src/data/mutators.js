// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MUTATORS: survival-mode wave modifiers.


// WAVE MUTATORS — a single modifier rolled per wave (from wave 3) for variety. Wired into the relevant systems via G.mut.
export const MUTATORS = [
  { id:'berserk',  name:'BERSERK',     col:'#ff6a4a', tip:'enemies move & strike faster' },
  { id:'volatile', name:'VOLATILE',    col:'#ff9a3a', tip:'enemies erupt on death' },
  { id:'swarm',    name:'SWARM',       col:'#ffd24a', tip:'a tide of grunts' },
  { id:'marksmen', name:'MARKSMEN',    col:'#7fd4ff', tip:'more blasters · faster bolts' },
  { id:'ironhide', name:'IRONHIDE',    col:'#9cc8e8', tip:'reinforced — tougher to kill' },
  { id:'frenzy',   name:'FRENZY',      col:'#ff5a5a', tip:'they hit harder · you earn more XP' },
  { id:'skyfall',  name:'SKY ASSAULT', col:'#66ccff', tip:'jet troopers swarm the sky' },
  { id:'windfall', name:'WINDFALL',    col:'#7bffae', tip:'a breather — faster regen · double XP' },
];
