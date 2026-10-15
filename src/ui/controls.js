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
      ['SHIFT', 'Dash', 'A dodge-flip with brief invulnerability'],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Saber combo', 'Cuts follow your movement; every third is a finisher'],
      ['HOLD RMB', 'Block', 'Absorbs hits; costs stamina'],
      ['TAP RMB', 'Parry and deflect', 'Time it as a blow or bolt lands to counter'],
      ['E', 'Kick', 'Shoves a foe back'],
      ['1 / 2 / 3', 'Saber form', 'Or the mouse wheel'],
      ['G', 'Switch grip', 'Regular or reverse; swings hit the same either way'],
      ['RMB + SPACE', 'Evasive leap', 'Jump while blocking to vault clear'],
    ]},
    { title: 'FORCE POWERS', rows: [
      ['F', 'Push', 'From the start'],
      ['C', 'Pull', 'Unlocks after wave 2'],
      ['V', 'Barrier', 'Earned with XP · or Saber Throw (RMB + LMB)'],
      ['X', 'Slam', 'Earned with XP · or Mend, a self-heal'],
      ['R', 'Judgement', 'Earned with XP · or Repulse'],
    ]},
  ],
  mando: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Aim'],
      ['SPACE', 'Hop'],
      ['HOLD SPACE', 'Jetpack thrust', 'Hover and climb; burns fuel'],
      ['HOLD SHIFT', 'Boost in the air', 'Look down to dive'],
      ['SHIFT', 'Dodge on the ground'],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Fire', 'Headshots deal far more damage'],
      ['R', 'Vent heat', 'Cool down before you overheat'],
      ['HOLD RMB', 'Brace / shield / scope', 'Depends on the weapon in hand'],
      ['E', 'Gauntlet punch', 'Tap twice for a combo'],
      ['1 / 2 / 3', 'Switch weapon', 'Or the mouse wheel'],
    ]},
    { title: 'GADGETS', rows: [
      ['F', 'Flamethrower', 'From the start'],
      ['Q', 'Wrist rocket', 'From the start'],
      ['X', 'Grappling hook', 'Earned with XP · or Jetpack Slam'],
      ['V', 'Whistling Birds', 'Earned with XP · or Thermal Detonator'],
      ['H', 'Bacta stim', 'Earned with XP · a self-heal'],
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
    'After each wave, spend <b>XP</b> on new abilities and on mastering the ones you have, and <b>skill points</b> on training.',
  ],
  mando: [
    '<b>Heat</b> is the gauge beside your reticle. Fill it and you overheat; press <b>R</b> to vent early.',
    '<b>Jet fuel</b> shows on the lights of your jetpack. The reticle turns orange when it runs low.',
    '<b>Gadget power</b> (bottom-left bar) fuels flame, rockets and other gadgets.',
    'The reticle turns <b>gold</b> when a target is under it.',
    'Hold RMB with the single blaster to raise a shield that deflects bolts.',
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
