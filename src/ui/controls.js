// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HOW TO PLAY: the per-hero controls reference, as data, rendered into the menu's help panel.

/* Each group is a list of rows: [keys, action, note?]. Keys are split on spaces; '/' and '+' stay as separators.
   Keep this in step with engine/input.js when binds change. */
const CONTROLS = {
  jedi: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Look'],
      ['SPACE', 'Jump', 'Tap again in the air to double-jump'],
      ['HOLD SPACE', 'Force leap and glide', 'Spends Force'],
      ['SHIFT', 'Roll / dash', 'In a fight, SHIFT on the ground is a quick roll any way you press: it costs some stamina (Ataru least, Djem So most), with a moment of invulnerability · tap it again mid-roll (or press it in the air) to Force dash, which spends a charge (the pips on the slot) and some Force · out of a fight it just dashes, free · roll or dash just as a blow lands for a perfect dodge'],
      ['Q', 'Run / walk', 'Switches between run (the default; forward sprints) and walk; the sprint turns wide, and in a fight it burns stamina (it gives out before your guard does), the walk is a brisk, menacing pace, fights included'],
      ['HOLD ALT', 'Strafe', 'Keeps you facing the crosshair while you move: sidestep, backpedal and circle a foe without turning your back · no sprint while it is held'],
      ['Z', 'Force slide', 'Out of a sprint: a long skid forward that ducks blaster fire and bowls troops over · attack out of it to sweep', 1],
    ]},
    { title: 'PARKOUR', rows: [
      ['SPACE', 'Vault / climb', 'Press it right in front of low cover while running at it to vault over in one move; jump at a ledge to pull up'],
      ['A / D', 'Ledge hang', 'Catch a high lip to hang; A/D shimmy, W or SPACE climbs, S drops', 1],
      ['W', 'Wall-run', 'Jump alongside a tall wall at speed; SPACE kicks off it', 1],
      ['FLOW', 'Parkour pays', 'Every vault, climb, slide, wall-run and roll refunds Force; chain different moves for more, and the cut right after one hits harder', 1],
      ['SHIFT', 'Landing roll', 'Just before a hard landing, or you stagger', 1],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Saber combo', 'The key you hold picks the cut (the needle through the crosshair shows the next one): A / D sweep sideways, W chops overhead (a thrust aimed low), W or S with A / D cut diagonally down or up, S whirls behind you; nothing held walks your form\'s string of cuts. Where you aim picks its height: aim up for a high cut at the head, down for a low one at the legs (the ticks by the crosshair). A cut that starts where the last one finished flows on quicker. Every third is a finisher. Settings · CUT AIM: MOUSE lets a flick of the mouse just before you click aim the cut at any angle round the clock'],
      ['HOLD RMB', 'Block', 'Soaks most of a blow; heavy hits drain stamina'],
      ['TAP RMB', 'Parry and deflect', 'Time it as a blow or bolt lands; a missed parry can\'t be retried for a moment'],
      ['E', 'Kick', 'Shoves a foe back and cracks a duellist\'s guard'],
      ['IN THE AIR', 'A leap is a commitment', 'Mid-fight you steer less, can\'t hold a guard, and a blow that lands hits harder and drops you · Ataru keeps its timed parry and its control up there', 1],
      ['W + AIR + LMB', 'Aerial cut', 'Leaping forward: a short lunge and a cut at the foe ahead · costs Force, 3s cooldown · a standing jump just swings', 1],
      ['LMB', 'Saber lock', 'Blades bound: mash to drive through · E kicks out · F shoves', 1],
      ['T / MMB', 'Lock on', 'Keeps one foe framed; press again to release', 1],
      ['1 / 2 / 3', 'Saber form', 'The three forms in your loadout, or the mouse wheel'],
      ['G', 'Switch grip', 'Regular or reverse; swings hit the same either way', 1],
      ['4', 'Holster saber', 'Fight with the Force alone, both hands free: LMB throws palm strikes (every third is a burst), RMB wards, Force powers hit 20% harder and Force refills faster · 4 again draws', 1],
      ['H', 'Squad order', 'With a squad: hold the spot under the crosshair, H again to bring them back on you · stand by a downed squadmate to get them up · while you have one standing, a killing blow downs you instead and they come to get you up', 1],
      ['RMB + SPACE', 'Evasive leap', 'Jump while blocking to vault clear · in a fight it spends a dash charge and is only safe at its start', 1],
    ]},
    { title: 'FORCE POWERS', rows: [
      ['F', 'Push', 'From the start'],
      ['C', 'Pull · hold to Grasp', 'Unlocks after wave 2 · grasped: F throws, C yanks in, Z drops'],
      ['V', 'Barrier', 'Earned with XP · or Saber Throw (RMB + LMB)'],
      ['X', 'Jump attack', 'Leaps if you\'re on the ground, winds up, then drives the blade down · Earned with XP · or Mend, a self-heal'],
      ['R', 'Judgement', 'Earned with XP · or Repulse'],
    ]},
  ],
  mando: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Aim'],
      ['SPACE', 'Hop', 'Run and hop at low cover to vault it; hop at a ledge to climb'],
      ['HOLD SPACE', 'Jetpack thrust', 'Hover and climb; burns fuel'],
      ['SHIFT', 'Combat dive', 'On the ground SHIFT dives you flat any way you press, Max Payne style, on your legs alone (no jet fuel), then you get back up: free, invulnerable through the throw, and the gun stays on target · turn the crosshair mid-dive and the lay-out rolls with it (dive left, look left, land on your back) · dive just as a blow lands for a perfect dodge'],
      ['SHIFT x2', 'Jet dive / rocket boost', 'SHIFT again while the dive is in the air lights the pack and throws it much farther (hold it to fly on) · just after a dive lands, the full rocket boost · both spend jet fuel', 1],
      ['SHIFT (air)', 'Air dodge', 'A straight thruster kick any way you press, invulnerable for a moment, and it stops your fall · spends a jet charge (the pips on the slot) and a little fuel', 1],
      ['HOLD SHIFT', 'Boost in the air', 'Keep SHIFT held after the dodge: he lays out the way you fly, Max Payne style, guns up on the crosshair · look down to dive', 1],
      ['HOLD RMB (air)', 'Hover', 'Hold your height and strafe; let go of the keys to stop dead', 1],
      ['HOLD ALT', 'Strafe', 'Stay square to the crosshair while you move; running away from it no longer turns your back'],
      ['C', 'Slide', 'Feet first, out of any run, aiming too · carries far, steers a little, ducks blaster fire and keeps your aim steady · jump out of it for a long hop', 1],
      ['FLOW', 'Parkour pays', 'Vaults, climbs and slides refuel the jetpack; shots right after one hit harder'],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Fire', 'Headshots deal far more damage'],
      ['R', 'Vent heat', 'Cool down before you overheat'],
      ['HOLD RMB', 'Brace / shield / scope', 'Depends on the weapon in hand · scoped look speed is the SCOPE SENS setting'],
      ['LMB (disruptor)', 'Spear stab', 'Unscoped, the disruptor is an electric spear: a quick thrust that lunges in and stuns · click again to keep jabbing', 1],
      ['E', 'Close quarters', 'Jab, cross, knee, vibroblade · tap E as a blow lands to catch it on the vambrace'],
      ['W + E', 'Jet charge', 'Burn in and shoulder-check a foe a few strides ahead', 1],
      ['SPACE + E', 'Dive kick', 'In the air: drop boot-first onto a foe below', 1],
      ['RMB + E', 'Shield and blade', 'Single blaster: vibroblade cuts and a shield bash with the shield kept up · costs stamina', 1],
      ['E', 'Takedown', 'On a staggered or floored foe: finish it', 1],
      ['1 / 2 / 3', 'Switch weapon', 'Or the mouse wheel'],
      ['RMB + LMB', 'Darksaber throw', 'Darksaber in hand: hurl it, and the grappling line reels it back through anything in its path', 1],
      ['H', 'Squad order', 'With a squad: hold the spot under the crosshair, H again to bring them back on you · stand by a downed squadmate to get them up · while you have one standing, a killing blow downs you instead and they come to get you up', 1],
      ['4', 'Holster', 'Take a fighting stance with fists and gadgets: LMB / E swing hook, hook, uppercut, haymaker, hold RMB for the gauntlet shield (LMB behind it cuts shield and blade), and gadget power refills faster · 4 or 1 / 2 / 3 draws', 1],
    ]},
    { title: 'GADGETS', rows: [
      ['F', 'Flamethrower', 'Unlocks after wave 2'],
      ['Q', 'Wrist rocket', 'From the start'],
      ['X', 'Grappling hook', 'Earned with XP · or Jetpack Slam'],
      ['V', 'Whistling Birds', 'Earned with XP · or the Thermal Detonator, thrown onto the crosshair: aim lower to drop it close, higher to send it far'],
      ['G', 'Bacta stim', 'Earned with XP · a self-heal'],
      ['Z', 'Jetpack missile', 'The final upgrade'],
    ]},
  ],
};
const TIPS = {
  jedi: [
    '<b>Pause</b> with TAB (or ESC); TAB or ENTER resumes. TAB keeps you in fullscreen, where ESC may drop you out.',
    '<b>Stamina</b> is the violet gauge beside your crosshair. Swings and blocks spend it; run dry and your guard breaks.',
    '<b>Force</b> (bottom-left bar) powers your abilities and refills over time.',
    '<b>Focus</b> builds with clean hits and parries and boosts your damage. Taking a hit breaks it.',
    '<b>Forms:</b> Ataru for crowds, Niman for all-round play, Djem So for brutes and bosses.',
    'A swing turns blaster bolts back down the line they came from: Djem So sends them home to the shooter, Ataru sprays them. A timed parry (tap RMB) always sends a bolt straight back.',
    'Any swing can be cancelled into a block, a Force power or a dash.',
    'Getting hit knocks your swing loose. Cut into a foe\'s strike mid-swing and the blades clash: nobody is hurt and you both reel. Bosses clash too.',
    '<b>Duellists</b> (Magnaguards, Sith acolytes) hold a guard: the pale arc beside them shows the line it covers (left, right, high, or low across the knees). They read your cut as you wind up and swing their weapon onto its line to meet it. A cut that meets a guard that holds stops dead on the blade and bounces back. Cut in past the edge of the arc (aim the angle with a flick, high or low too), kick to break it, and don\'t throw the same angle twice: they read it.',
    'Swings only hit what\'s in front of you and plant your feet, so step into range before you cut. Parry, don\'t just block: a block lets some of the blow through. Hold your guard against a duellist and your blade moves to meet its strike on the line it\'s coming in on (it follows a feint too); parry it and your riposte cuts back on the side it left open. A skilled duellist may turn that riposte and come straight back at you: keep parrying and the exchange speeds up until someone slips or the blades lock. A lock binds high, low or (out of a long exchange) body to body, and each ends its own way.',
    'After each wave, spend <b>XP</b> on new abilities and on mastering the ones you have, and <b>skill points</b> on training.',
  ],
  mando: [
    '<b>Pause</b> with TAB (or ESC); TAB or ENTER resumes. TAB keeps you in fullscreen, where ESC may drop you out.',
    '<b>Heat</b> is the gauge beside your reticle. Fill it and you overheat; press <b>R</b> to vent early.',
    '<b>Jet fuel</b> shows on the lights of your jetpack. The reticle turns orange when it runs low.',
    '<b>Gadget power</b> (bottom-left bar) fuels flame, rockets and other gadgets.',
    'The reticle turns <b>gold</b> when a target is under it.',
    'Hold RMB with the single blaster to raise a shield that deflects bolts. Firing drops it; it comes back half a second after you stop. Press E behind it to cut with the vibroblade and bash with the shield, which keeps it up but spends stamina.',
    '<b>Sith acolytes</b> bat blaster fire back. Close in: punch through their guard, charge them with W + E, catch their cuts with E and finish them with a takedown.',
    'After each wave, spend <b>XP</b> on new gadgets and on mastering the ones you have, and <b>skill points</b> on weapon upgrades.',
  ],
};

import { TELLS, tellCss } from '../fx/tells.js';

let showAll = false;
export function toggleControlsDetail(hero){ showAll = !showAll; renderControls(hero); }
function keycaps(keys){
  return keys.split(' ').map(k => (k === '/' || k === '+') ? '<span>' + k + '</span>' : '<kbd>' + k + '</kbd>').join('');
}
export function renderControls(hero){
  const el = document.getElementById('ctl'); if (!el) return;
  const groups = CONTROLS[hero] || CONTROLS.jedi;
  let html = '';
  for (const g of groups){
    html += '<div class="cg"><h4>' + g.title + '</h4>';
    for (const [keys, action, note, adv] of g.rows)
      html += '<div class="cr' + (adv ? ' adv' : '') + '" tabindex="0"><div class="ck">' + keycaps(keys) + '</div><div class="ca">' + action + (note ? '<small>' + note + '</small>' : '') + '</div></div>';
    html += '</div>';
  }
  html += '<div class="cg wide adv"><h4>GOOD TO KNOW</h4><ul class="tips">' + TIPS[hero].map(t => '<li>' + t + '</li>').join('') + '</ul></div>';
  html += '<div class="cg wide"><h4>ATTACK TELLS</h4><ul class="tells">' + Object.keys(TELLS).map(k =>
    '<li><i style="background:' + tellCss(k) + '"></i><b>' + TELLS[k].name + '</b><span>' + TELLS[k].note + '</span></li>').join('') + '</ul></div>';
  el.innerHTML = html;
  el.classList.toggle('all', showAll);
  const more = document.getElementById('howtomore');
  if (more) more.textContent = showAll ? 'SHOW LESS' : 'SHOW ALL MOVES';
  const tabs = document.getElementById('howtohero');
  if (tabs){
    tabs.innerHTML = '<span data-h="jedi" class="' + (hero === 'jedi' ? 'on' : '') + '">JEDI</span>' +
                     '<span data-h="mando" class="' + (hero === 'mando' ? 'on' : '') + '">MANDALORIAN</span>';
  }
}
