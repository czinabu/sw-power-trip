// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CONTROLS: the per-hero controls reference, as data, rendered into the menu's help panel.

/* Each group is a list of rows: [keys, action, note?]. Keys are split on spaces; '/' and '+' stay as separators.
   Keep this in step with engine/input.js when binds change. */
const CONTROLS = {
  jedi: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Look'],
      ['SPACE', 'Jump', 'Tap again in the air to double-jump'],
      ['HOLD SPACE', 'Force leap and glide', 'Spends Force'],
      ['SHIFT', 'Roll / dash', 'In a fight, SHIFT on the ground is a quick roll any way you press: it costs some stamina (each form spends its own share), with a moment of invulnerability · tap it again mid-roll (or press it in the air) to Force dash, which spends a charge (the pips on the slot) and some Force · out of a fight it just dashes, free · roll or dash just as a blow lands for a perfect dodge'],
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
      ['IN THE AIR', 'A leap is a commitment', 'Mid-fight you steer less, can\'t hold a guard, and a blow that lands hits harder and drops you', 1],
      ['W + AIR + LMB', 'Aerial cut', 'Leaping forward: a short lunge and a cut at the foe ahead · costs Force, 3s cooldown · a standing jump just swings', 1],
      ['LMB', 'Saber lock', 'Blades bound: mash to drive through · E kicks out · F shoves', 1],
      ['T / MMB', 'Lock on', 'Keeps one foe framed; press again to release', 1],
      ['1 / 2 / 3', 'Saber form', 'The three forms in your loadout, or the mouse wheel'],
      ['G', 'Switch grip', 'In Niman, regular or reverse (swings hit the same either way) · in Djem So or Shien (Form V) it swaps to the other one if you know it · Shien always holds a reverse grip, every other form a forward one', 1, ['niman', 'djemso', 'shien']],
      ['4', 'Holster saber', 'Fight with the Force alone, both hands free: RMB wards, Force powers hit 20% harder, Force refills faster and every blow you land gives a little back · 4 again draws', 1],
      ['HOLSTERED LMB', 'Force-imbued strikes', 'Jab, cross, then a finisher the key you hold picks: nothing a two-palm burst that turns bolts, W a driving lunge palm, A / D a wide backhand sweep, S a rising palm that throws light foes up · HOLD LMB to gather a charged palm and let go to fire it: a full charge breaks guards, staggers elites and bosses and turns grenades back', 1],
      ['HOLSTERED E', 'Force kicks', 'Mid-string: a spin kick that clears the ring round you · in the air: a Force stomp straight down · otherwise the front kick', 1],
      ['HOLSTERED F / C', 'Strike into power', 'Push or Pull right after a blow lands flows out of it for less Force: Push becomes a Palm Push that hits the nearest hard, Pull drags them onto your next strike', 1],
      ['H', 'Squad orders', 'With a squad · TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows): on me, hold here, move there, attack target, take cover, grenade, spread / stack, get them up · point and let go · 1-4 while it is open orders one squadmate · stand by a downed squadmate to get them up · while one stands, a killing blow downs you instead and they come to get you up', 1],
      ['N', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players, in your colour, with an arrow on their screens when it is out of view · works solo too'],
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
      ['H', 'Squad orders', 'With a squad · TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows): on me, hold here, move there, attack target, take cover, grenade, spread / stack, get them up · point and let go · 1-4 while it is open orders one squadmate · stand by a downed squadmate to get them up · while one stands, a killing blow downs you instead and they come to get you up', 1],
      ['N', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players, in your colour, with an arrow on their screens when it is out of view · works solo too'],
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
    '<b>Forms:</b> a campaign run starts on Shii-Cho, the first form every Jedi learns, and the masters you meet teach you the others. Each time you learn one you meditate and choose the three you carry on 1 / 2 / 3; that is the only time they change, so pick for the fights ahead. Each form you learn also opens its own lesson in Training.',
    { forms: ['makashi', 'soresu'], t: '<b>Sandbox forms:</b> Shii-Cho sweeps crowds and its finisher disarms blaster troopers; Makashi beats other blades but bolts cost it; Soresu holds its guard and sends bolts home. Pick yours in the sandbox panel (B).' },
    'A swing turns blaster bolts back down the line they came from. A timed parry (tap RMB) always sends a bolt straight back.',
    { forms: ['shien'], t: '<b>Shien</b> sends deflected bolts home to the shooter harder; in Djem So, G swaps to Shien.' },
    { forms: ['ataru'], t: '<b>Ataru</b> cuts harder in the air, keeps its timed parry up there, and a cut out of a Force dash is the <b>Hawk-Bat Swoop</b>. It sprays the bolts it deflects.' },
    { forms: ['djemso'], t: '<b>Djem So</b> answers a blow taken on the held guard with a <b>Fluid Riposte</b>.' },
    { forms: ['juyo'], t: '<b>Form VII:</b> Juyo burns Force with each swing and every hit feeds its fury; Vaapad feeds on blocks and parries, and a parry finds the attacker\'s Shatterpoint (your next cut on it lands double). Both take extra damage, and a loadout holds only one.' },
    'Any swing can be cancelled into a block, a Force power or a dash.',
    'Getting hit knocks your swing loose. Cut into a foe\'s strike mid-swing and the blades clash: nobody is hurt and you both reel. Bosses clash too.',
    '<b>Duellists</b> (Magnaguards, Sith acolytes) hold a guard: the pale arc beside them shows the line it covers (left, right, high, or low across the knees). They read your cut as you wind up and swing their weapon onto its line to meet it. A cut that meets a guard that holds stops dead on the blade and bounces back. Cut in past the edge of the arc (aim the angle with a flick, high or low too), kick to break it, and don\'t throw the same angle twice: they read it.',
    'Swings only hit what\'s in front of you and plant your feet, so step into range before you cut. Parry, don\'t just block: a block lets some of the blow through. Hold your guard against a duellist and your blade moves to meet its strike on the line it\'s coming in on (it follows a feint too); parry it and your riposte cuts back on the side it left open. A skilled duellist may turn that riposte and come straight back at you: keep parrying and the exchange speeds up until someone slips or the blades lock. A lock binds high, low or (out of a long exchange) body to body, and each ends its own way.',
    'Your powers <b>master themselves</b> as you use them, and the story hands you new ones. Every 500 <b>XP</b> earns a <b>skill point</b>: spend them on training when a chapter ends.',
  ],
  mando: [
    '<b>Pause</b> with TAB (or ESC); TAB or ENTER resumes. TAB keeps you in fullscreen, where ESC may drop you out.',
    '<b>Heat</b> is the gauge beside your reticle. Fill it and you overheat; press <b>R</b> to vent early.',
    '<b>Jet fuel</b> shows on the lights of your jetpack. The reticle turns orange when it runs low.',
    '<b>Gadget power</b> (bottom-left bar) fuels flame, rockets and other gadgets.',
    'The reticle turns <b>gold</b> when a target is under it.',
    'Hold RMB with the single blaster to raise a shield that deflects bolts. Firing drops it; it comes back half a second after you stop. Press E behind it to cut with the vibroblade and bash with the shield, which keeps it up but spends stamina.',
    '<b>Sith acolytes</b> bat blaster fire back. Close in: punch through their guard, charge them with W + E, catch their cuts with E and finish them with a takedown.',
    'Your gadgets <b>master themselves</b> as you use them, and the story hands you new gear. Every 500 <b>XP</b> earns a <b>skill point</b>: spend them on weapon upgrades when a chapter ends.',
  ],
};

import { TELLS, tellCss } from '../fx/tells.js';
import { formOffered, refreshSandboxScope } from '../game/sandbox-unlocks.js';
import { PAD_BINDS, PAD_GLYPHS, PAD_MENU } from '../data/gamepad.js';
import { pad } from '../engine/gamepad.js';

let showAll = false, device = 'kb';
export function toggleControlsDetail(hero){ showAll = !showAll; renderControls(hero); }
export function setControlsDevice(d){ device = d; }

/* the controller layout, straight from the binds (data/gamepad.js), so it can't drift from what the pad does */
const PAD_ORDER = ['RT', 'LT', 'A', 'B', 'X', 'Y', 'RB', 'LB', 'L3', 'R3', 'LEFT', 'UP', 'RIGHT', 'DOWN', 'VIEW'];
function padGroups(hero){
  const B = PAD_BINDS[hero] || PAD_BINDS.jedi, gl = PAD_GLYPHS[pad.family];
  const row = (name, b) => [gl[name], b.label, b.note];
  return [
    { title: 'STICKS', rows: [[gl.LS, 'Move', 'Steers any way, at the stick\'s angle'], [gl.RS, hero === 'mando' ? 'Aim' : 'Look',
      'Speed: Settings · STICK SENS' + (hero === 'jedi' ? ' · with CUT AIM: MOUSE, a flick just before RT aims the cut' : '')],
      [gl.MENU, 'Pause']] },
    { title: 'BUTTONS', rows: PAD_ORDER.filter(n => B.base[n]).map(n => row(n, B.base[n])) },
    { title: hero === 'mando' ? 'HOLD LB: GADGETS' : 'HOLD LB: POWERS', rows: PAD_ORDER.filter(n => B.lb[n]).map(n => [gl.LB + ' + ' + gl[n], B.lb[n].label, B.lb[n].note]) },
    { title: 'MENUS', rows: PAD_MENU.map(([k, a, n]) => [k.split(' / ').map(x => gl[x] || x).join(' / '), a, n]) },
  ];
}
function keycaps(keys){
  return keys.split(' ').map(k => (k === '/' || k === '+') ? '<span>' + k + '</span>' : '<kbd>' + k + '</kbd>').join('');
}
export function renderControls(hero){
  const el = document.getElementById('ctl'); if (!el) return;
  const groups = device === 'pad' ? padGroups(hero) : CONTROLS[hero] || CONTROLS.jedi;
  // no spoilers: a row or tip about a form shows once the story has taught it (a row's 5th entry: any of these forms;
  // a tip's `forms`: all of them)
  refreshSandboxScope();
  const knows = (ids, any) => !ids || (any ? ids.some(formOffered) : ids.every(formOffered));
  const tips = TIPS[hero].filter(t => typeof t === 'string' || knows(t.forms)).map(t => typeof t === 'string' ? t : t.t);
  let html = '';
  for (const g of groups){
    html += '<div class="cg"><h4>' + g.title + '</h4>';
    for (const [keys, action, note, adv, forms] of g.rows) if (knows(forms, true))
      html += '<div class="cr' + (adv ? ' adv' : '') + '" tabindex="0"><div class="ck">' + keycaps(keys) + '</div><div class="ca">' + action + (note ? '<small>' + note + '</small>' : '') + '</div></div>';
    html += '</div>';
  }
  html += '<div class="cg wide adv"><h4>GOOD TO KNOW</h4><ul class="tips">' + tips.map(t => '<li>' + t + '</li>').join('') + '</ul></div>';
  html += '<div class="cg wide"><h4>ATTACK TELLS</h4><ul class="tells">' + Object.keys(TELLS).map(k =>
    '<li><i style="background:' + tellCss(k) + '"></i><b>' + TELLS[k].name + '</b><span>' + TELLS[k].note + '</span></li>').join('') + '</ul></div>';
  el.innerHTML = html;
  el.classList.toggle('all', showAll);
  el.classList.toggle('padview', device === 'pad');
  const more = document.getElementById('howtomore');
  if (more){ more.textContent = showAll ? 'SHOW LESS' : 'SHOW ALL MOVES'; more.style.display = device === 'pad' ? 'none' : ''; }   // the pad page shows everything
  const tabs = document.getElementById('howtohero');
  if (tabs){
    tabs.innerHTML = '<span data-h="jedi" class="' + (hero === 'jedi' ? 'on' : '') + '">JEDI</span>' +
                     '<span data-h="mando" class="' + (hero === 'mando' ? 'on' : '') + '">MANDALORIAN</span>';
    const devs = document.getElementById('howtodev');
    if (devs) devs.innerHTML = '<span data-dev="kb" class="' + (device === 'kb' ? 'on' : '') + '">KEYBOARD</span>' +
                               '<span data-dev="pad" class="' + (device === 'pad' ? 'on' : '') + '">CONTROLLER</span>';
  }
}
