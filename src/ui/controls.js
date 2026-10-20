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
      ['Q', 'Dash', 'A short dodge-flip any way you press, with brief invulnerability; dash just as a blow lands for a perfect dodge'],
      ['HOLD SHIFT + W', 'Sprint', 'Burns stamina; turns wide'],
      ['C', 'Force slide', 'Out of a sprint: a long skid forward that ducks blaster fire and bowls troops over · attack out of it to sweep'],
    ]},
    { title: 'PARKOUR', rows: [
      ['SPACE', 'Vault / climb', 'Press it right in front of low cover while running at it to vault over in one move; jump at a ledge to pull up'],
      ['A / D', 'Ledge hang', 'Catch a high lip to hang; A/D shimmy, W or SPACE climbs, S drops'],
      ['W', 'Wall-run', 'Jump alongside a tall wall at speed; SPACE kicks off it'],
      ['FLOW', 'Parkour pays', 'Every vault, climb, slide, wall-run and roll refunds Force; chain different moves for more, and the cut right after one hits harder'],
      ['Q', 'Landing roll', 'Just before a hard landing, or you stagger'],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Saber combo', 'The key you hold picks the cut: A / D sweep sideways, W chops overhead, S whirls behind you; every third is a finisher'],
      ['HOLD RMB', 'Block', 'Soaks most of a blow; heavy hits drain stamina'],
      ['TAP RMB', 'Parry and deflect', 'Time it as a blow or bolt lands; a missed parry can\'t be retried for a moment'],
      ['E', 'Kick', 'Shoves a foe back and cracks a duellist\'s guard'],
      ['LMB', 'Saber lock', 'Blades bound: mash to drive through · E kicks out · F shoves'],
      ['T / MMB', 'Lock on', 'Keeps one foe framed; press again to release'],
      ['1 / 2 / 3', 'Saber form', 'Or the mouse wheel'],
      ['G', 'Switch grip', 'Regular or reverse; swings hit the same either way'],
      ['4', 'Holster saber', 'Fight with the Force alone: LMB throws palm strikes (every third is a burst), RMB wards, and Force refills faster · 4 again draws'],
      ['RMB + SPACE', 'Evasive leap', 'Jump while blocking to vault clear'],
    ]},
    { title: 'FORCE POWERS', rows: [
      ['F', 'Push', 'From the start'],
      ['C', 'Pull', 'Unlocks after wave 2 (C while sprinting is the Force slide)'],
      ['V', 'Barrier', 'Earned with XP · or Saber Throw (RMB + LMB)'],
      ['X', 'Slam', 'Earned with XP · or Mend, a self-heal'],
      ['R', 'Judgement', 'Earned with XP · or Repulse'],
    ]},
  ],
  mando: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Aim'],
      ['SPACE', 'Hop', 'Run and hop at low cover to vault it; hop at a ledge to climb'],
      ['HOLD SPACE', 'Jetpack thrust', 'Hover and climb; burns fuel'],
      ['HOLD SHIFT', 'Boost in the air', 'Look down to dive'],
      ['SHIFT', 'Dodge on the ground'],
      ['C', 'Slide', 'Out of a run; ducks blaster fire and steadies your aim'],
      ['FLOW', 'Parkour pays', 'Vaults, climbs and slides refuel the jetpack; shots right after one hit harder'],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Fire', 'Headshots deal far more damage'],
      ['R', 'Vent heat', 'Cool down before you overheat'],
      ['HOLD RMB', 'Brace / shield / scope', 'Depends on the weapon in hand'],
      ['E', 'Close quarters', 'Jab, cross, knee, vibroblade · tap E as a blow lands to catch it on the vambrace'],
      ['W + E', 'Jet charge', 'Burn in and shoulder-check a foe a few strides ahead'],
      ['SPACE + E', 'Dive kick', 'In the air: drop boot-first onto a foe below'],
      ['RMB + E', 'Shield and blade', 'Single blaster: vibroblade cuts and a shield bash with the shield kept up · costs stamina'],
      ['E', 'Takedown', 'On a staggered or floored foe: finish it'],
      ['1 / 2 / 3', 'Switch weapon', 'Or the mouse wheel'],
      ['RMB + LMB', 'Darksaber throw', 'Darksaber in hand: hurl it, and the grappling line reels it back through anything in its path'],
      ['4', 'Holster', 'Fight with fists and gadgets: LMB throws the close-quarters string, RMB braces, and gadget power refills faster · 4 or 1 / 2 / 3 draws'],
    ]},
    { title: 'GADGETS', rows: [
      ['F', 'Flamethrower', 'Unlocks after wave 2'],
      ['Q', 'Wrist rocket', 'From the start'],
      ['X', 'Grappling hook', 'Earned with XP · or Jetpack Slam'],
      ['V', 'Whistling Birds', 'Earned with XP · or Thermal Detonator'],
      ['G', 'Bacta stim', 'Earned with XP · a self-heal'],
      ['Z', 'Jetpack missile', 'The final upgrade'],
    ]},
  ],
};
const TIPS = {
  jedi: [
    '<b>Stamina</b> is the violet gauge beside your crosshair. Swings and blocks spend it; run dry and your guard breaks.',
    '<b>Force</b> (bottom-left bar) powers your abilities and refills over time.',
    '<b>Focus</b> builds with clean hits and parries and boosts your damage. Taking a hit breaks it.',
    '<b>Forms:</b> Ataru for crowds, Niman for all-round play, Djem So for brutes and bosses.',
    'Any swing can be cancelled into a block, a Force power or a dash.',
    'Getting hit knocks your swing loose. Cut into a foe\'s strike mid-swing and the blades clash: nobody is hurt and you both reel.',
    '<b>Duellists</b> (Magnaguards, Sith acolytes) hold a guard: the pale arc beside them. Cut in on the other side, kick to break it, and don\'t throw the same cut twice: they read it.',
    'Swings only hit what\'s in front of you and plant your feet, so step into range before you cut. Parry, don\'t just block: a block lets some of the blow through.',
    'After each wave, spend <b>XP</b> on new abilities and on mastering the ones you have, and <b>skill points</b> on training.',
  ],
  mando: [
    '<b>Heat</b> is the gauge beside your reticle. Fill it and you overheat; press <b>R</b> to vent early.',
    '<b>Jet fuel</b> shows on the lights of your jetpack. The reticle turns orange when it runs low.',
    '<b>Gadget power</b> (bottom-left bar) fuels flame, rockets and other gadgets.',
    'The reticle turns <b>gold</b> when a target is under it.',
    'Hold RMB with the single blaster to raise a shield that deflects bolts. Firing drops it; it comes back half a second after you stop. Press E behind it to cut with the vibroblade and bash with the shield, which keeps it up but spends stamina.',
    '<b>Sith acolytes</b> bat blaster fire back. Close in: punch through their guard, charge them with W + E, catch their cuts with E and finish them with a takedown.',
    'After each wave, spend <b>XP</b> on new gadgets and on mastering the ones you have, and <b>skill points</b> on weapon upgrades.',
  ],
};

function keycaps(keys){
  return keys.split(' ').map(k => (k === '/' || k === '+') ? '<span>' + k + '</span>' : '<kbd>' + k + '</kbd>').join('');
}
export function renderControls(hero){
  const el = document.getElementById('ctl'); if (!el) return;
  const groups = CONTROLS[hero] || CONTROLS.jedi;
  let html = '';
  for (const g of groups){
    html += '<div class="cg"><h4>' + g.title + '</h4>';
    for (const [keys, action, note] of g.rows)
      html += '<div class="cr"><div class="ck">' + keycaps(keys) + '</div><div class="ca">' + action + (note ? '<small>' + note + '</small>' : '') + '</div></div>';
    html += '</div>';
  }
  html += '<div class="cg wide"><h4>GOOD TO KNOW</h4><ul class="tips">' + TIPS[hero].map(t => '<li>' + t + '</li>').join('') + '</ul></div>';
  el.innerHTML = html;
  const tabs = document.getElementById('howtohero');
  if (tabs){
    tabs.innerHTML = '<span data-h="jedi" class="' + (hero === 'jedi' ? 'on' : '') + '">JEDI</span>' +
                     '<span data-h="mando" class="' + (hero === 'mando' ? 'on' : '') + '">MANDALORIAN</span>';
  }
}
