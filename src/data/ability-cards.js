// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ABILITY CARDS — the small screen that opens when the run hands over a new ability (data/store.js JEDI_AUTO / MANDO_AUTO,
// announced by game/flow.js, shown by ui/ability-card.js): what it does, and a short looping clip of it in the game.
// Keyed by the auto-unlock's key (data/store.js JEDI_AUTO / MANDO_AUTO) or the store node's id (JEDI_STORE / MANDO_STORE: shown
// once the store page closes). A store entry names itself (name, hud); an auto-unlock takes both from its table. A form keeps
// its own screen (game/meditation.js).
// clip   a small animated WebP of the ability in the game (src/assets/abilities/), inlined into the build
import pull from '../assets/abilities/pull.webp?inline';
import jump from '../assets/abilities/jump.webp?inline';
import flame from '../assets/abilities/flame.webp?inline';
import dual from '../assets/abilities/dual.webp?inline';
import jet from '../assets/abilities/jet.webp?inline';
import throwClip from '../assets/abilities/throw.webp?inline';
import barrier from '../assets/abilities/barrier.webp?inline';
import jslam from '../assets/abilities/jslam.webp?inline';
import mend from '../assets/abilities/mend.webp?inline';
import judge from '../assets/abilities/judge.webp?inline';
import repulse from '../assets/abilities/repulse.webp?inline';
import grip from '../assets/abilities/grip.webp?inline';
import grapple from '../assets/abilities/grapple.webp?inline';
import mslam from '../assets/abilities/mslam.webp?inline';
import bacta from '../assets/abilities/bacta.webp?inline';
import birds from '../assets/abilities/birds.webp?inline';
import deto from '../assets/abilities/deto.webp?inline';
import disruptor from '../assets/abilities/disruptor.webp?inline';
import darksaber from '../assets/abilities/darksaber.webp?inline';
import missile from '../assets/abilities/missile.webp?inline';

export const ABILITY_CARDS = {
  pull: { clip: pull, lines: ['Hold C to lock a foe in your Force Grasp. It hangs in the air and follows your aim: sweep it into other foes to bowl them over.',
                              'While you hold it, F hurls it, a tap of C yanks it onto your blade and Z drops it. A quick tap of C is a plain Force Pull.'] },
  fj1:  { clip: jump, lines: ['Hold SPACE in the air to leap on the Force: a high arc, then a slow glide down.',
                              'The take-off costs most of your Force up front, then a little for as long as you hold it.'] },
  fj2:  { clip: jump, lines: ['Force Jump grows: a higher take-off, a cheaper hold and a cheaper glide.',
                              'Hold SPACE in the air, as before.'] },
  flame:{ clip: flame, lines: ['Hold F to sweep a cone of flame in front of you. It burns every foe it touches over time, so it clears crowds.',
                               'It runs on your Gadget Power bar.'] },
  dual: { clip: dual, lines: ['A second sidearm: two blasters on 1. Hold LMB to fire both, for far more fire up close than the single blaster, but no shield behind them.',
                              'You carry one sidearm: choose next which goes on 1. The other waits in the armory.'] },
  jet1: { clip: jet, lines: ['Hold SPACE to burn the jetpack: more lift and a bigger fuel tank than the stock pack.',
                             'Hovering burns less fuel, so the pack lasts longer in the air.'] },
  jet2: { clip: jet, lines: ['The jetpack grows again: stronger lift, a bigger tank and a thriftier hover.',
                             'Hold SPACE, as before.'] },
  cells1: { clip: dual, lines: ['Your blasters hold more energy before they overheat, and recover it faster.',
                                'Hold LMB for longer bursts.'] },
  cells2: { clip: dual, lines: ['A second power cell: the blasters hold more energy again, and cool faster.'] },
  cells3: { clip: dual, lines: ['The final power cell: the longest bursts and the fastest cooling yet.'] },
  // ---- the upgrade store: the abilities you pick or are handed (data/store.js) ----
  throw:  { name: 'SABER THROW', hud: 'RMB + LMB', clip: throwClip, lines: ['Hurl your blade at the foe in your crosshair. It cuts what it meets, then flies back to your hand.',
                                  'While it is in flight you have no saber, though your Force powers still work.'] },
  barrier:{ name: 'FORCE BARRIER', hud: 'V', clip: barrier, lines: ['Raise a bubble of Force round you. The cast throws foes back, then the bubble cuts the damage you take and deflects bolts.',
                                  'When it ends it gives a parting shove.'] },
  jslam:  { name: 'JUMP ATTACK', hud: 'X', clip: jslam, lines: ['Leap, wind up and bring the blade down: a shockwave that hits the foes round where you land.'] },
  mend:   { name: 'FORCE MEND', hud: 'X', clip: mend, lines: ['Channel the Force to knit your wounds, healing about 30% of your vitality.',
                                  'Choosing it locks Vampiric Blade for the run.'] },
  judge:  { name: 'FORCE JUDGEMENT', hud: 'R', clip: judge, lines: ['Hold R to channel chain lightning that leaps from foe to foe.',
                                  'Choosing it closes Force Repulse for the run.'] },
  repulse:{ name: 'FORCE REPULSE', hud: 'R', clip: repulse, lines: ['A concussive blast all round you that throws every foe nearby back.',
                                  'Choosing it closes Force Judgement for the run.'] },
  graspMulti:{ name: "DARK LORD'S GRIP", hud: 'HOLD C', clip: grip, lines: ['Force Grasp takes up to three foes at once, fanned out ahead of you. F hurls them all.'] },
  judgeUp:{ name: 'STORM OF JUDGEMENT', hud: 'R', clip: judge, lines: ['Judgement strikes three more foes and hits 1.9 times as hard.'] },
  repulseUp:{ name: 'FORCE NOVA', hud: 'R', clip: repulse, lines: ['Repulse erupts with vast range and power.'] },
  grapple:{ name: 'GRAPPLING HOOK', hud: 'X', clip: grapple, lines: ['Fire a line to reel yourself to cover, or yank a foe in to you.',
                                  'Choosing it locks the Jetpack Slam.'] },
  mslam:  { name: 'JETPACK SLAM', hud: 'X', clip: mslam, lines: ['In the air, drive down on the jetpack: a ground-pound shockwave on landing.',
                                  'Choosing it locks the Grappling Hook.'] },
  bacta:  { name: 'BACTA STIM', hud: 'G', clip: bacta, lines: ['Channel a quick self-heal, about 30% of your vitality.',
                                  'Choosing it locks Hunter\'s Creed.'] },
  birds:  { name: 'WHISTLING BIRDS', hud: 'V', clip: birds, lines: ['Release a swarm of homing micro-missiles that seek out foes.',
                                  'Choosing it locks the Thermal Detonator.'] },
  deto:   { name: 'THERMAL DETONATOR', hud: 'V', clip: deto, lines: ['Throw a sticky charge onto the crosshair: a big blast when it goes off.',
                                  'Choosing it locks the Whistling Birds.'] },
  disruptor:{ name: 'DISRUPTOR RIFLE', hud: '3', clip: disruptor, lines: ['A scoped sniper rifle: hold RMB to scope, LMB to fire. Up close it has a spear.',
                                  'Choosing it locks the Darksaber.'] },
  darksaber:{ name: 'THE DARKSABER', hud: '3', clip: darksaber, lines: ['A heavy beskar blade: devastating, but slow and costly in stamina. RMB + LMB throws it and the grappling line reels it back.',
                                  'Choosing it locks the Disruptor Rifle.'] },
  jetmissile:{ name: 'JETPACK MISSILE', hud: 'Z', clip: missile, lines: ['Launch a missile from the jetpack: a huge blast and huge damage.',
                                  'Earned after your signature weapon.'] },
};
