// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// GAMEPAD: the controller layout, as data. engine/gamepad.js reads it; How to Play renders it (ui/controls.js).

/* Every bind turns a pad button into the keyboard key (or mouse button) the game already answers to, so a pad press
   runs exactly the code the key does, in every mode. Change a key in engine/input.js and the matching bind here moves
   with it.
     key:   a KeyboardEvent key, lower case (' ' is SPACE)
     mouse: 0 = LMB, 2 = RMB
   'base' is the plain layout; 'lb' is what a face button / bumper / D-pad does while LB is held (LB itself is the
   strafe hold, so the layer and the strafe go together). Anything not in 'lb' falls through to 'base'.
   SLOTS: D-pad left / up / right are the three loadout slots (keys 1 / 2 / 3: the Jedi's forms, the Mando's weapons).
   A form loadout or a fourth slot only has to change the key here. */

// standard mapping (https://w3c.github.io/gamepad/#remapping) button index → name
export const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'];

// tuning: stick dead zones and look speed (radians per second at full tilt, before the STICK SENS setting)
export const PAD_TUNE = {
  moveDead: 0.2,     // left stick: below this, no movement
  moveKey: 0.38,     // left stick: past this on an axis, that movement key counts as held (dash, flips and slides read the keys)
  lookDead: 0.14,    // right stick
  lookCurve: 1.8,    // response curve: small tilts aim finely, full tilt turns fast
  yawRate: 3.6,
  pitchRate: 2.3,
  trigger: 0.45,     // LT / RT past this are pressed
  navRepeat: [0.38, 0.12],   // menus: first repeat, then every… (seconds) while a direction is held
};

const SLOTS = {
  LEFT:  { key: '1', label: 'Slot 1' },
  UP:    { key: '2', label: 'Slot 2' },
  RIGHT: { key: '3', label: 'Slot 3' },
};

export const PAD_BINDS = {
  jedi: {
    base: {
      A:  { key: ' ', label: 'Jump', note: 'Again in the air to double-jump · hold to Force leap and glide' },
      B:  { key: 'shift', label: 'Roll / dash', note: 'Any way you push the stick · again mid-roll or in the air to Force dash' },
      Y:  { key: 'f', label: 'Force Push', note: 'Holding a foe in a Grasp, throws them' },
      X:  { key: 'c', label: 'Force Pull · hold to Grasp', note: 'Unlocks after wave 2 · beside Push, so grab-then-throw is one roll of the thumb' },
      RB: { key: 'e', label: 'Kick', note: 'Cracks a duellist\'s guard · in a saber lock, kicks out' },
      RT: { mouse: 0, label: 'Saber combo', note: 'The left stick picks the cut, as W A S D do · in a saber lock, mash it' },
      LT: { mouse: 2, label: 'Block · tap to parry', note: 'Hold LT and pull RT to throw the saber' },
      LB: { key: 'alt', label: 'Strafe (hold)', note: 'Face the crosshair while you move · also opens the LB powers' },
      L3: { key: 'z', label: 'Force slide', note: 'Out of a run' },
      R3: { key: 't', label: 'Lock on', note: 'Again to release' },
      ...SLOTS,
      DOWN: { key: '4', label: 'Holster saber' },
      VIEW: { key: 'h', label: 'Squad order', note: 'In the sandbox, opens the sandbox panel (LB + VIEW gives the order there)', sandbox: 'b' },
    },
    lb: {
      Y:  { key: 'r', label: 'Judgement / Repulse', note: 'Whichever you earned' },
      X:  { key: 'x', label: 'Jump attack / Mend', note: 'Whichever you earned' },
      RB: { key: 'v', label: 'Barrier' },
      L3: { key: 'q', label: 'Run / walk' },
      DOWN: { key: 'g', label: 'Switch grip', note: 'Regular or reverse' },
      VIEW: { key: 'h', label: 'Squad order' },
    },
  },
  mando: {
    base: {
      A:  { key: ' ', label: 'Hop · hold for jetpack', note: 'Burns fuel' },
      B:  { key: 'shift', label: 'Combat dive', note: 'Again mid-dive for a jet dive · in the air an air dodge, hold to boost' },
      X:  { key: 'r', label: 'Vent heat' },
      Y:  { key: 'f', label: 'Flamethrower (hold)', note: 'Unlocks after wave 2' },
      RB: { key: 'q', label: 'Wrist rocket' },
      RT: { mouse: 0, label: 'Fire', note: 'Headshots deal far more' },
      LT: { mouse: 2, label: 'Brace / shield / scope', note: 'Darksaber in hand: hold LT and pull RT to throw it · in the air, hover' },
      LB: { key: 'alt', label: 'Strafe (hold)', note: 'Stay square to the crosshair · also opens the LB gadgets' },
      L3: { key: 'c', label: 'Slide', note: 'Out of any run' },
      R3: { key: 'e', label: 'Close quarters', note: 'Forward + R3 jet charges, in the air a dive kick, on a floored foe a takedown' },
      ...SLOTS,
      DOWN: { key: '4', label: 'Holster' },
      VIEW: { key: 'h', label: 'Squad order', note: 'In the sandbox, opens the sandbox panel (LB + VIEW gives the order there)', sandbox: 'b' },
    },
    lb: {
      Y:  { key: 'v', label: 'Whistling Birds / Detonator', note: 'Whichever you earned' },
      X:  { key: 'x', label: 'Grapple / Jetpack Slam', note: 'Whichever you earned' },
      RB: { key: 'z', label: 'Jetpack missile' },
      DOWN: { key: 'g', label: 'Bacta stim' },
      VIEW: { key: 'h', label: 'Squad order' },
    },
  },
};

// glyphs per pad family: the layout names buttons the Xbox way; a PlayStation pad shows its own shapes
export const PAD_GLYPHS = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'VIEW', MENU: 'MENU', L3: 'L3', R3: 'R3',
          UP: 'D↑', DOWN: 'D↓', LEFT: 'D←', RIGHT: 'D→', LS: 'LS', RS: 'RS' },
  ps:   { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'CREATE', MENU: 'OPTIONS', L3: 'L3', R3: 'R3',
          UP: 'D↑', DOWN: 'D↓', LEFT: 'D←', RIGHT: 'D→', LS: 'LS', RS: 'RS' },
};
export const padFamily = (id) => /054c|playstation|dualsense|dualshock|wireless controller/i.test(id || '') ? 'ps' : 'xbox';

// the menu controls, for How to Play
export const PAD_MENU = [
  ['LS / D-PAD', 'Move between options', 'Left / right also slides a setting'],
  ['A', 'Select'],
  ['B', 'Back', 'On the pause screen, resumes'],
  ['MENU', 'Pause / resume', 'On the title screen, begins'],
  ['RS', 'Scroll a long panel'],
];
