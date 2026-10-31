// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WORLDS: the look of each arena (sky, light, fog, floor, prop palette, backdrop landmarks, ambient particles, and
// how the mood shifts as the fight climbs). Purely visual: layouts, collision, spawns and hazards live in the arena
// builders and LEVELS and are the same in every world. Edit colours freely.
//
// Three directions were prototyped; WORLD picks the one the game uses (the world lab can show any of them).
//   siege  — one temple world across one day: dawn courtyard → Imperial foundry at dusk → the burning city at night
//   worlds — three worlds on the road to the Sith: Jedha's holy city → Mustafar's forge → Exegol's storm
//   frozen — the ice world of Ilum: crystal temple → foundry cut into the glacier → frozen battlefield under aurora

export const WORLD_DIRECTIONS = {
  siege: {
    label: 'Siege of the Temple',
    temple: {
      sky: { top: 0x2a3f6a, horizon: 0xf0c8a8, below: 0x9a8c8c, bands: 7, stars: 30,
        sun: { el: 0.12, color: 0xffe2b8, halo: 0xffc898, size: 30 },
        clouds: { color: 0xf4d2bc, under: 0xb98a8e, count: 16, lo: 0.45, hi: 0.85 },
        ridges: [{ color: 0x8a7f96, h: 0.1, rough: 0.05 }] },
      fog: 0xc6aca8, fogStart: 0.72, fogEnd: 2.9,
      light: { sun: 0xffdcb4, sunI: 1.75, dir: [15, 34, 37], hemiSky: 0xb8c6e6, hemiGround: 0x5a4a44, fill: 0.78, rim: 0xffc0a0, rimI: 0.45 },
      floor: { kind: 'flagstone', base: 0x8f8575, seed: 4 },
      outer: 0x7a7066,
      pal: { stone: 0xa89c86, stoneD: 0x7c705e, trim: 0xd8b46a, banner: 0x7a2026, brazier: 0xff9a3a, inlay: 0xb08a3a },
      backdrop: [
        { kind: 'temple', az: -2.3, r: 2.2, scale: 1.1, color: 0x9a8e86, color2: 0xb0a49a, glow: 0xffd890 },
        { kind: 'towers', count: 26, r: [1.5, 2.6], h: [14, 36], color: 0x6c6c84, color2: 0x7c7890, windows: 0xffe0a8, skip: [[-2.3, 0.35]] },
        { kind: 'destroyer', az: -1.6, r: 2.2, y: 30, scale: 0.9, color: 0x8890a0, color2: 0x737b8c, glow: 0x9ad8ff },
      ],
      ambient: { kind: 'dust', color: 0xffe4c8, count: 120, size: 0.28 },
      beats: { fog: 0xd0a080, fill: 1.08, tint: 0xffd0a0 },
    },
    foundry: {
      sky: { top: 0x2a1a30, horizon: 0xff8a3a, below: 0x5a3020, bands: 7, stars: 10,
        sun: { el: 0.08, color: 0xffb060, halo: 0xff8040, size: 46 },
        clouds: { color: 0x6a3a3a, under: 0x3a2028, count: 18, lo: 0.4, hi: 0.9 },
        ridges: [{ color: 0x4a2a2a, h: 0.08, rough: 0.04 }] },
      fog: 0x8a4a34, fogStart: 0.72, fogEnd: 2.9,
      light: { sun: 0xffb478, sunI: 1.85, dir: [25, 36, -31], hemiSky: 0xd89a7a, hemiGround: 0x3a2018, fill: 0.9, rim: 0xff8a50, rimI: 0.55 },
      floor: { kind: 'deck', base: 0x4e4a4c, stripe: 0xd9a43a, seed: 9 },
      outer: 0x3a3030,
      pal: { metal: 0x58606a, metalD: 0x30343a, rust: 0x7a4e32, stripe: 0xd9a43a, molten: 0xff7a1e, beacon: 0xff5040 },
      backdrop: [
        { kind: 'stacks', count: 6, r: [1.4, 2.0], h: [22, 34], color: 0x3a3436, band: 0xd9a43a, glow: 0xff8a2a, smoke: 0x4a3a3a },
        { kind: 'towers', count: 22, r: [1.5, 2.6], h: [12, 30], color: 0x3a2e34, color2: 0x4a3a40, windows: 0xff9a4a },
        { kind: 'destroyer', az: 2.2, r: 1.45, y: 34, scale: 1.0, color: 0x5a5a66, color2: 0x4a4a56, glow: 0x9ad8ff },
      ],
      ambient: { kind: 'embers', color: 0xff7733, count: 190 },
      beats: { fog: 0x9a3a22, fill: 1.1, tint: 0xff8060 },
    },
    plains: {
      sky: { top: 0x0a0610, horizon: 0x9a3018, below: 0x2a1010, bands: 7, stars: 60,
        sun: { el: 0.5, color: 0xd8d0c8, size: 16, kind: 'moon' },
        clouds: { color: 0x4a2622, under: 0x24121a, count: 22, lo: 0.35, hi: 0.95 },
        ridges: [{ color: 0x2a1414, h: 0.06, rough: 0.05 }] },
      fog: 0x4a2020, fogStart: 0.72, fogEnd: 2.9,
      light: { sun: 0xffb0a0, sunI: 1.75, dir: [14, 50, 40], hemiSky: 0xc07a7a, hemiGround: 0x2a1418, fill: 0.98, rim: 0xff7050, rimI: 0.6 },
      floor: { kind: 'ash', base: 0x4a3c3c, seed: 13 },
      outer: 0x2e2224,
      pal: { stone: 0x5c4a4c, stoneD: 0x3e3032, dark: 0x1e1418, voidGlow: 0x9a3bff, beacon: 0x9a3bff },
      backdrop: [
        { kind: 'temple', az: -Math.PI/2, r: 2.1, scale: 1.0, color: 0x3a2a2c, color2: 0x2a1e20, glow: 0xff5a2a },
        { kind: 'towers', count: 30, r: [1.4, 2.6], h: [12, 34], color: 0x2a2024, color2: 0x342628, windows: 0xff6a2a, skip: [[-Math.PI/2, 0.35]] },
        { kind: 'destroyer', az: 0.4, r: 1.4, y: 36, scale: 1.1, color: 0x4a4650, color2: 0x3a3640, glow: 0xff7a5a },
        { kind: 'destroyer', az: 2.6, r: 1.6, y: 44, scale: 0.7, color: 0x4a4650, color2: 0x3a3640, glow: 0xff7a5a },
      ],
      ambient: { kind: 'ash', color: 0xb8a8a8, count: 200, size: 0.26, opacity: 0.6 },
      storm: { every: [4, 9], fill: 0.9, sky: 0.5, ramp: 2, color: 0xff9a6a },   // turbolaser flashes from the fleet overhead
      beats: { fog: 0x6a1a1a, fill: 1.05, tint: 0xff5a40 },
    },
  },

  worlds: {
    label: 'Road to the Sith',
    temple: {   // JEDHA — the holy city at golden hour
      sky: { top: 0x46689a, horizon: 0xd9a46a, below: 0xb08458, bands: 7, stars: 0,
        sun: { el: 0.2, color: 0xffe2a8, halo: 0xe8b070, size: 18 },
        clouds: { color: 0xe8c08e, under: 0xb88a62, count: 10, lo: 0.5, hi: 0.85 },
        ridges: [{ color: 0xb88a5e, h: 0.1, rough: 0.04, seed: 3 }, { color: 0x9c7250, h: 0.06, rough: 0.06, seed: 8 }] },
      // art pass: a paler, less orange dust haze so the city steps back in layers; a cool rim against the warm key so
      // figures lift off the sandstone; the floor a greyer stone than the walls round it
      fog: 0xd0b08a, fogStart: 0.75, fogEnd: 3.0,
      light: { sun: 0xffdcae, sunI: 1.7, dir: [15, 34, 37], hemiSky: 0xb8c8e4, hemiGround: 0x6a5240, fill: 0.7, rim: 0x9ab4e8, rimI: 0.5 },
      floor: { kind: 'flagstone', base: 0x9c866a, seed: 4 },
      outer: 0xb08a5e,
      pal: { stone: 0xb89a70, stoneD: 0x8e7250, trim: 0xd8b46a, banner: 0xa8402a, brazier: 0xffa040, inlay: 0xc08a3a },
      backdrop: [
        // the holy city closes in round the courtyard: sandstone blocks four to six storeys high, domes and towers on top
        { kind: 'district', h: [12, 24], w: [7, 13], color: 0xc29c6e, color2: 0xa8845a, trim: 0x86643f, roof: 0x9c5e3a, domes: 0.3, spires: 0.12, setback: 0.3, gap: 9 },
        // NiJedha's great wall, out past the district
        { kind: 'ramparts', r: 2.3, segments: 30, h: 9, color: 0xae8c64, color2: 0x987a56, roof: 0x7a4e32, gaps: [-2.4] },
        { kind: 'statue', az: -2.4, r: 2.1, scale: 1.3, color: 0xa88a66, color2: 0x8e7052, dark: 0x4a3828, metal: 0x7a7266 },
        // the holy city itself, packed between the walls and the mesas (towers stretch out to 2-5 half-widths)
        { kind: 'towers', count: 34, r: [1.75, 2.6], h: [10, 22], color: 0xa8865e, color2: 0x96764f, skip: [[-2.4, 0.35], [-1.8, 0.2]] },
        { kind: 'mesas', count: 9, r: [2.2, 2.7], h: [20, 36], w: [18, 34], color: 0xae7a52, color2: 0x986a48, skip: [[-2.4, 0.45]] },
        { kind: 'dunes', count: 10, r: [1.75, 2.0], h: 4, color: 0xbc9064 },
        // the Empire is already here: a Star Destroyer hangs over the holy city (the threat the campaign walks toward)
        { kind: 'destroyer', az: -1.8, r: 2.3, y: 22, scale: 1.2, color: 0x8a8c96, color2: 0x767884, glow: 0x9ad8ff },
      ],
      hazards: { vent: 0x5a4430, ventIdle: 0x2a1e12, barrel: 0xa33820 },
      ambient: { kind: 'dust', color: 0xffe2b0, count: 130, size: 0.3 },
      // the occupation: TIE patrols over the holy city, the partisans hitting the garrison street by street (Rogue One)
      warfront: { flyers: [{ kind: 'tie', count: 2, wing: 2, alt: [35, 70], speed: [70, 100], every: [5, 10], fire: 0x5aff6a }],
        blasts: 0.45, tracers: { rate: 0.8, colors: [0xff3a2a, 0xff7a3a] }, columns: 3, smoke: 0x4a4038 },
      beats: { fog: 0xc0784a, fill: 1.06, tint: 0xff9a68 },
    },
    foundry: {   // MUSTAFAR — the forgeworks on the lava flats
      sky: { top: 0x1a0a08, horizon: 0xc8461c, below: 0x3a1408, bands: 7, stars: 0,
        clouds: { color: 0x4a2a24, under: 0x24120e, count: 24, lo: 0.3, hi: 0.95 },
        ridges: [{ color: 0x2a120c, h: 0.14, rough: 0.1, spiky: 0.6, seed: 5 }, { color: 0x150a08, h: 0.07, rough: 0.12, seed: 9 }] },
      fog: 0x5e2616, fogStart: 0.72, fogEnd: 2.9,
      // art pass: a cool rim from the ash sky against the lava key, so troopers and the hero cut out of the red murk;
      // the forge metal a cooler steel than the basalt it stands on
      light: { sun: 0xffb080, sunI: 1.8, dir: [30, 40, -27], hemiSky: 0xe8987a, hemiGround: 0x5a2416, fill: 0.92, rim: 0x7a96e0, rimI: 0.6 },
      floor: { kind: 'basalt', base: 0x443a38, glow: 0xff7a1e, seed: 9 },
      outer: 0x1e1414,
      pal: { metal: 0x606a76, metalD: 0x30363e, rust: 0x6b4a32, stripe: 0xd9a43a, molten: 0xff7a1e, beacon: 0xff5040 },
      backdrop: [
        { kind: 'volcano', az: 2.4, r: 2.6, scale: 0.75, size: 3000,   // a real Mustafar peak: kilometres across, kilometres off
        color: 0x2a1a18, lava: 0xff6a1a },
        // the forgeworks' plant halls and smelter towers wall in the floor, lava light in their vents
        { kind: 'district', h: [14, 30], w: [8, 15], color: 0x3c424c, color2: 0x4c535e, trim: 0x7a5236, setback: 0.4, slits: 0xff7a1e, gap: 10, alleys: 0.2, recess: 0x1a0c08 },
        { kind: 'spires', count: 14, r: [1.6, 2.4], h: [10, 24], color: 0x241816, color2: 0x30201c, glow: 0xff5a14, skip: [[2.4, 0.4]] },
        { kind: 'stacks', count: 4, r: [1.6, 1.8], h: [18, 26], color: 0x2e2a2c, band: 0xd9a43a, glow: 0xff8a2a, smoke: 0x5a4440, skip: [[2.4, 0.5]] },
        { kind: 'lavaflows', count: 7, lava: 0xff6a1a, crust: 0x1a0c08, w: 1.4, reach: 3.0 },
      ],
      // vents are lava geysers here: dark crust → amber warning → a molten burst
      hazards: { vent: 0x2e2626, ventIdle: 0x2a0e06, ventActive: 0xff8a2a, barrel: 0x8a3020 },
      ambient: { kind: 'embers', color: 0xff7733, count: 220 },
      // the mining works: shuttles ferrying ore, TIE escorts, the odd eruption out on the flats; no one fights here
      warfront: { flyers: [{ kind: 'dropship', count: 2, alt: [45, 90], speed: [25, 40], every: [6, 14] }, { kind: 'tie', count: 1, wing: 2, alt: [50, 90], speed: [70, 100], every: [10, 18] }],
        blasts: 0.2, blastSize: 1.6, flash: 0xff5a1a, columns: 5, smoke: 0x2a2220 },
      beats: { fog: 0x7a2210, fill: 1.12, tint: 0xff6a40 },
    },
    plains: {   // EXEGOL — the Sith wastes under a lightning storm
      sky: { top: 0x06060c, horizon: 0x4a5266, below: 0x16141c, bands: 6, stars: 0,
        clouds: { color: 0x525a70, under: 0x20242e, count: 30, lo: 0.25, hi: 0.95 },
        ridges: [{ color: 0x14121a, h: 0.12, rough: 0.12, spiky: 1.2, seed: 21 }] },
      // art pass: a darker, warmer ash floor so the white armour pops off it, and a lighter haze cap so the monoliths
      // and the Citadel stay dark silhouettes against the storm instead of one blue-grey wash
      fog: 0x3c485c, fogStart: 0.2, fogEnd: 1.15, haze: { len: 40, max: 0.8 },
      light: { sun: 0xb4c4e8, sunI: 1.3, dir: [14, 50, 40], hemiSky: 0x8a9cc0, hemiGround: 0x2e2a36, fill: 0.85, rim: 0x8a9cf0, rimI: 0.7 },
      floor: { kind: 'ash', base: 0x56505c, seed: 13 },
      outer: 0x2c2834,
      pal: { stone: 0x726678, stoneD: 0x463c4c, dark: 0x1a1620, voidGlow: 0x7f8ee0, beacon: 0x7f8ee0 },
      backdrop: [
        { kind: 'pyramid', az: -Math.PI/2, r: 2.2, scale: 1.0, size: 1500,   // the Sith Citadel: a mountain of a building
        color: 0x1a1620, color2: 0x241e2a, glow: 0x8a98e8 },
        // Sith monoliths stand round the duelling ground, violet light in their slits
        { kind: 'district', h: [18, 36], w: [5, 10], d: [5, 9], color: 0x1a1620, color2: 0x241e2a, roof: 0x2c2634, spires: 0.35, slits: 0x7f8ee0, streets: 16, alleys: 0.35, gap: 12 },
        { kind: 'spires', count: 14, r: [1.5, 2.3], h: [14, 34], color: 0x221e2a, color2: 0x2c2634, skip: [[-Math.PI/2, 0.45]] },
        { kind: 'cliffs', count: 12, r: [1.8, 2.5], h: [10, 18], w: 0.35, color: 0x24202c, color2: 0x1c1822, skip: [[-Math.PI/2, 0.5]] },
      ],
      // vents are Sith vents: violet when they fire
      hazards: { vent: 0x2a2632, ventIdle: 0x140c22, ventActive: 0x9aa6ee, barrel: 0x8a2a30 },
      ambient: { kind: 'ash', color: 0xa0aac0, count: 120, size: 0.22, opacity: 0.45 },
      mist: { color: 0x7e8aa4, count: 46, size: 11, opacity: 0.16 },
      // the last battle: Resistance X-wings diving through the Sith fleet's TIEs (red X-wing bolts, green TIE fire), the ground forces below
      warfront: { flyers: [{ kind: 'tie', count: 2, wing: 3, alt: [40, 110], speed: [80, 120], every: [3, 7], color2: 0x4a1218, fire: 0x5aff6a },
        { kind: 'xwing', count: 2, wing: 2, alt: [40, 110], speed: [80, 120], every: [3, 7], fire: 0xff3a2a }],
        blasts: 0.55, flash: 0xc8d4ff, tracers: { rate: 1, colors: [0xff3a2a, 0x5aff6a] }, columns: 2, smoke: 0x1e1a24 },
      storm: { every: [2.5, 6], fill: 1.9, sky: 1.4, ramp: 2, fogFlash: 0.55, color: 0xdce6ff },
      beats: { fog: 0x232a40, fill: 1.08, tint: 0x8fa0e0 },
    },
  },

  frozen: {
    label: 'The Frozen Front',
    temple: {   // ILUM — the crystal temple in the glacier
      sky: { top: 0x3c6a9c, horizon: 0xdcecf6, below: 0xb8ccdc, bands: 7, stars: 0,
        sun: { el: 0.25, color: 0xffffff, halo: 0xd8ecff, size: 22 },
        clouds: { color: 0xf0f6fc, under: 0xb4c8dc, count: 14, lo: 0.45, hi: 0.9 },
        ridges: [{ color: 0xb4c8dc, h: 0.16, rough: 0.1, spiky: 0.5, seed: 2 }, { color: 0x94aec8, h: 0.08, rough: 0.08, seed: 6 }] },
      fog: 0xb8cadb, fogStart: 0.72, fogEnd: 2.9,
      light: { sun: 0xf4f8ff, sunI: 1.65, dir: [-38, 40, 12], hemiSky: 0xc8dcf4, hemiGround: 0x5a6a80, fill: 0.72, rim: 0x8ad8ff, rimI: 0.5 },
      floor: { kind: 'ice', base: 0x8ea2b6, seed: 4 },   // blue-grey, not white: white troopers must still read on it
      outer: 0xc4d4e2,
      pal: { stone: 0xa8b8c8, stoneD: 0x7c8ea2, trim: 0x7ad0ff, banner: 0x2a4a7a, brazier: 0x6ad8ff, inlay: 0x4aa8d8 },
      backdrop: [
        { kind: 'cliffs', count: 16, r: [1.5, 2.2], h: [12, 24], w: 0.32, color: 0xb4c8dc, color2: 0x9ab2ca },
        { kind: 'crystals', count: 9, r: [1.08, 1.25], h: [5, 10], color: 0x8ad8ff, glow: 0x3aa8ff },
        { kind: 'dunes', count: 12, r: [1.1, 1.3], h: 3, color: 0xdce8f2 },
      ],
      ambient: { kind: 'snow', color: 0xffffff, count: 220, size: 0.22, opacity: 0.8 },
      beats: { fog: 0x9ab0c8, fill: 0.95, tint: 0xb0d0ff },
    },
    foundry: {   // the Imperial foundry cut into the ice
      sky: { top: 0x4a5a70, horizon: 0xa8b8c8, below: 0x8a98a8, bands: 6, stars: 0,
        clouds: { color: 0xb8c4d0, under: 0x7a8898, count: 28, lo: 0.2, hi: 0.95 },
        ridges: [{ color: 0x8a9cb0, h: 0.14, rough: 0.1, spiky: 0.4, seed: 7 }] },
      fog: 0x8c9aac, fogStart: 0.72, fogEnd: 2.9,
      light: { sun: 0xe8f0ff, sunI: 1.7, dir: [-34, 46, 14], hemiSky: 0xb8c8e0, hemiGround: 0x3a3a44, fill: 0.85, rim: 0xff8a40, rimI: 0.5 },
      floor: { kind: 'deck', base: 0x5a6470, stripe: 0xd9a43a, seed: 9 },
      outer: 0xb8c6d4,
      pal: { metal: 0x606c78, metalD: 0x353c46, rust: 0x6b5a4a, stripe: 0xd9a43a, molten: 0xff7a1e, beacon: 0xff5040 },
      backdrop: [
        { kind: 'cliffs', count: 18, r: [1.5, 2.2], h: [14, 26], w: 0.3, color: 0xa8bccf, color2: 0x8aa2b8 },
        { kind: 'stacks', count: 5, r: [1.15, 1.3], h: [16, 24], color: 0x3a4048, band: 0xd9a43a, glow: 0xff8a2a, smoke: 0x8a9098 },
      ],
      ambient: { kind: 'snow', color: 0xffffff, count: 240, size: 0.22, opacity: 0.75 },
      beats: { fog: 0x7a7a8a, fill: 1.05, tint: 0xffb090 },
    },
    plains: {   // the frozen battlefield at night, under the aurora
      sky: { top: 0x040814, horizon: 0x1c3456, below: 0x14202e, bands: 6, stars: 90,
        sun: { el: 0.55, color: 0xe8f0ff, size: 15, kind: 'moon' },
        aurora: { colors: [0x2affa0, 0x8a5aff] },
        ridges: [{ color: 0x14243a, h: 0.12, rough: 0.1, spiky: 0.5, seed: 12 }] },
      fog: 0x1e2e44, fogStart: 0.72, fogEnd: 2.9,
      light: { sun: 0xc8d8ff, sunI: 1.7, dir: [14, 50, 40], hemiSky: 0x90a8d0, hemiGround: 0x1a2030, fill: 0.98, rim: 0x6ae8c0, rimI: 0.6 },
      floor: { kind: 'snow', base: 0x6a7c92, seed: 13 },
      outer: 0x5a6a80,
      pal: { stone: 0x5e6a7c, stoneD: 0x3e4858, dark: 0x141a26, voidGlow: 0x9a3bff, beacon: 0x9a3bff },
      backdrop: [
        { kind: 'pyramid', az: -Math.PI/2, r: 2.2, scale: 0.9, color: 0x161c28, color2: 0x202836, glow: 0xb050ff },
        { kind: 'walker', az: -1.0, r: 1.45, scale: 1.2, color: 0x7a8494, color2: 0x5e6878, glow: 0xff5a3a },
        { kind: 'cliffs', count: 14, r: [1.6, 2.3], h: [12, 22], w: 0.32, color: 0x3e4c60, color2: 0x324054, skip: [[-Math.PI/2, 0.45]] },
      ],
      ambient: { kind: 'snow', color: 0xe8f0ff, count: 260, size: 0.22, opacity: 0.8 },
      beats: { fog: 0x2a1630, fill: 1.05, tint: 0xd060ff },
    },
  },
};

export let WORLD = 'worlds';
export function setWorld(name){ if (WORLD_DIRECTIONS[name]) WORLD = name; }
// preview another direction without editing code: open the game with ?world=siege (or worlds / frozen)
try { const q = new URLSearchParams(location.search).get('world'); if (q) setWorld(q); } catch(e){}

/* TRAINING GROUNDS — the two tutorial arenas (data/tutorial.js) keep one look whatever WORLD is picked */
export const TRAINING_WORLDS = {
  hall: {   // the Jedi training hall: an open terrace high on the temple mountain, at dawn
    sky: { top: 0x35609e, horizon: 0xf0d2b0, below: 0xa8a0a0, bands: 7, stars: 12,
      sun: { el: 0.14, color: 0xfff0d0, halo: 0xffd0a0, size: 24 },
      clouds: { color: 0xf6dcc4, under: 0xb09098, count: 12, lo: 0.3, hi: 0.7 },
      ridges: [{ color: 0x8a8ca4, h: 0.16, rough: 0.12, spiky: 0.5, seed: 4 }, { color: 0x6c7088, h: 0.08, rough: 0.08, seed: 11 }] },
    fog: 0xc4b8c0, fogStart: 0.75, fogEnd: 3.0,
    // art pass: less fill and a darker floor than the pale terrace stone, so white troopers don't sink into it
    light: { sun: 0xffe6c4, sunI: 1.7, dir: [-20, 34, 30], hemiSky: 0xbcd0f0, hemiGround: 0x4e4a56, fill: 0.7, rim: 0x9ad8ff, rimI: 0.5 },
    floor: { kind: 'flagstone', base: 0x88827a, seed: 6 },
    outer: 0x8a8480,
    pal: { stone: 0xb4b0a6, stoneD: 0x88847c, trim: 0xd8c48a, kyber: 0x5ad2ff },
    backdrop: [
      { kind: 'cliffs', count: 16, r: [1.5, 2.3], h: [10, 22], w: 0.32, color: 0x7c7c92, color2: 0x686a82, skip: [[-1.6, 0.4]] },
      { kind: 'temple', az: -1.6, r: 2.3, scale: 1.2, size: 600,   // the Jedi Temple's ziggurat, its tallest spire ~800 m up
      color: 0xb0aaa4, color2: 0xc4beb6, glow: 0x9ad8ff },
      { kind: 'crystals', count: 7, r: [1.15, 1.3], h: [3, 6], color: 0x8ad8ff, glow: 0x3aa8ff, skip: [[-1.6, 0.5]] },
    ],
    ambient: { kind: 'dust', color: 0xfff0d8, count: 110, size: 0.26 },
    // peacetime above the clouds: only a cruiser passing high over the temple now and then
    warfront: { flyers: [{ kind: 'dropship', count: 1, alt: [110, 160], speed: [30, 45], every: [18, 30], color: 0xd8d4cc, color2: 0xa83a2a }] },
    beats: { fog: 0xc8b0b0, fill: 1.0, tint: 0xffe0c0 },
    sound: 'temple',
  },
  forge: {   // the Armorer's forge: the covert's yard in a canyon, at night, lit by the hearth
    sky: { top: 0x060814, horizon: 0x5a2c1c, below: 0x1a1210, bands: 6, stars: 80,
      sun: { el: 0.5, color: 0xe0d8d0, size: 14, kind: 'moon' },
      clouds: { color: 0x3a2a2a, under: 0x1a1214, count: 10, lo: 0.4, hi: 0.9 },
      ridges: [{ color: 0x24181a, h: 0.14, rough: 0.1, spiky: 0.3, seed: 15 }] },
    fog: 0x3a2420, fogStart: 0.72, fogEnd: 2.9,
    light: { sun: 0xffc090, sunI: 1.75, dir: [22, 40, -26], hemiSky: 0xc08a70, hemiGround: 0x2a1a16, fill: 0.95, rim: 0xff8a40, rimI: 0.6 },
    floor: { kind: 'deck', base: 0x55504c, stripe: 0xd9a43a, seed: 12 },
    outer: 0x2a2220,
    pal: { metal: 0x606870, metalD: 0x30343a, beskar: 0xb0b8c0, sand: 0x806a52, stripe: 0xd9a43a, molten: 0xff7a1e, beacon: 0xff8a3a },
    backdrop: [
      { kind: 'cliffs', count: 18, r: [1.4, 2.1], h: [14, 26], w: 0.34, color: 0x3a2a26, color2: 0x2e2220 },
      { kind: 'stacks', count: 3, r: [1.5, 1.7], h: [16, 22], color: 0x2e2a2c, band: 0xd9a43a, glow: 0xff8a2a, smoke: 0x4a3a38 },
    ],
    ambient: { kind: 'embers', color: 0xff8a3a, count: 150 },
    beats: { fog: 0x5a2a1a, fill: 1.05, tint: 0xff8a50 },
    sound: 'foundry',
  },
  dojo: {   // the sandbox's training room inside the temple: warm wood and cream panels under a dark ceiling, lamp-lit
    mist: false,   // indoors
    sky: { top: 0x1a0e0a, horizon: 0x3a2218, below: 0x2a1810, bands: 5, stars: 0 },
    fog: 0x2a1a14, fogStart: 1.4, fogEnd: 4.0, clear: 0x1a0e0a,
    light: { sun: 0xffe2c0, sunI: 1.45, dir: [-12, 40, 18], hemiSky: 0xffd8b8, hemiGround: 0x4a2a1e, fill: 1.0, rim: 0xffc890, rimI: 0.35 },
    floor: { kind: 'parquet', base: 0x6a3020, seed: 8 },
    glow: 0.6,   // the pale duelling mat, not the dark parquet, fills the view: ease the bloom and blade light for it
    outer: 0x3a1a12,
    pal: { wood: 0x5a2a1c, woodD: 0x3a1a12, panel: 0xcfc4ae, metal: 0x8a8a86, crest: 0x2a140e, mat: 0xa8946f, matHi: 0xb6a27c, inlay: 0x6a2618 },   // mat: sanded tan, not near-white (a lit blade blew cream out)
    backdrop: [],
    ambient: { kind: 'dust', color: 0xfff0d8, count: 70, size: 0.2 },
    beats: { fog: 0x2a1a14, fill: 1.0, tint: 0xffe0c0 },
    sound: 'temple',
  },
  throne: {   // the Mandalorian's sandbox: the palace throne room at Sundari, grey daylight through tall windows
    mist: false,   // indoors
    sky: { top: 0x10161a, horizon: 0x26302e, below: 0x1a2220, bands: 5, stars: 0 },
    fog: 0x1e2826, fogStart: 1.4, fogEnd: 4.0, clear: 0x10161a,
    light: { sun: 0xdce8f0, sunI: 1.5, dir: [26, 30, -14], hemiSky: 0xa8c4c8, hemiGround: 0x1e2a28, fill: 0.85, rim: 0x9ad0e0, rimI: 0.4 },
    floor: { kind: 'deck', base: 0x3a4c46, line: 0x1e2826, seed: 19 },
    outer: 0x1a2220,
    pal: { green: 0x4a6a60, greenD: 0x2e403a, frame: 0x1a2220, throne: 0x7a3a2a, glass: 0x9aaab2, lamp: 0xffd23a, glow: 0xe0703a },
    backdrop: [],
    ambient: { kind: 'dust', color: 0xe0eef0, count: 60, size: 0.18 },
    beats: { fog: 0x1e2826, fill: 0.95, tint: 0xd0e8e0 },
    sound: 'temple',
  },
};

/* STORY MISSIONS — the mission arenas (data/missions.js) keep one look whatever WORLD is picked */
export const MISSION_WORLDS = {
  refuge: {   // the hidden refuge: a valley floor under the peaks at dusk, the transport's lights on the pad
    sky: { top: 0x2c3c66, horizon: 0xe8a878, below: 0x8a7a7c, bands: 7, stars: 40,
      sun: { el: 0.08, color: 0xffd0a0, halo: 0xff9a70, size: 26 },
      clouds: { color: 0xe0a890, under: 0x8a6670, count: 12, lo: 0.4, hi: 0.85 },
      ridges: [{ color: 0x5a6078, h: 0.22, rough: 0.14, spiky: 0.6, seed: 21 }, { color: 0x484c62, h: 0.12, rough: 0.1, spiky: 0.4, seed: 5 }] },
    fog: 0xa89098, fogStart: 0.75, fogEnd: 3.0,
    // art pass: darker granite peaks against the dusk sky, a cool rim, and a less washed-out valley floor
    light: { sun: 0xffd0a8, sunI: 1.7, dir: [-24, 30, 30], hemiSky: 0xb0bce0, hemiGround: 0x423c3a, fill: 0.74, rim: 0x9aaee8, rimI: 0.5 },
    floor: { kind: 'flagstone', base: 0x7e786c, seed: 9 },
    outer: 0x6e6862,
    pal: { stone: 0x9a968e, stoneD: 0x726e68, metal: 0x6a727e, imperial: 0x3a3e46, stripe: 0xd9a43a, crate: 0x8a7458, lamp: 0xffc070 },
    backdrop: [
      { kind: 'cliffs', count: 20, r: [1.8, 2.5], h: [18, 36], w: 0.3, color: 0x6c6a80, color2: 0x5a5a70 },
      { kind: 'destroyer', az: -1.2, r: 2.3, y: 26, scale: 1.0, color: 0x8a8c96, color2: 0x767884, glow: 0x9ad8ff },
    ],
    ambient: { kind: 'dust', color: 0xffe0c8, count: 110, size: 0.26 },
    // the Empire has found the refuge: TIEs strafing the valley, landers coming down, the defenders firing back
    warfront: { flyers: [{ kind: 'tie', count: 3, wing: 2, alt: [30, 70], speed: [70, 100], every: [4, 8], fire: 0x5aff6a }, { kind: 'dropship', count: 1, alt: [45, 70], speed: [22, 32], every: [8, 14] }],
      blasts: 0.65, tracers: { rate: 1, colors: [0xff3a2a, 0xff7a3a] }, columns: 3, smoke: 0x3a3234 },
    beats: { fog: 0xc08870, fill: 1.05, tint: 0xffc8a0 },
    sound: 'temple',
  },
  jungle: {   // the jungle firebase on the night of the order (the ARC trooper's prologue): moonlight through the canopy, fireflies
    sky: { top: 0x070c18, horizon: 0x1f3a3a, below: 0x0e1a14, bands: 6, stars: 90,
      sun: { el: 0.45, color: 0xdfe8ff, size: 14, kind: 'moon' },
      clouds: { color: 0x2a3a48, under: 0x101820, count: 10, lo: 0.4, hi: 0.85 },
      ridges: [{ color: 0x0c1a12, h: 0.2, rough: 0.2, spiky: 0.9, seed: 11 }, { color: 0x10241a, h: 0.12, rough: 0.14, spiky: 0.6, seed: 3 }] },
    fog: 0x18302a, fogStart: 0.55, fogEnd: 2.2,
    // night, but the troopers must still read: a cool moon key, a teal rim, and a fill that keeps the floor off black
    light: { sun: 0xa8c4ff, sunI: 1.3, dir: [-20, 40, 18], hemiSky: 0x6a8aa8, hemiGround: 0x1e2a1c, fill: 0.8, rim: 0x7ad8c0, rimI: 0.55 },
    floor: { kind: 'grass', base: 0x34442a, seed: 41 },
    outer: 0x22301e,
    pal: { bark: 0x4a3a2c, barkD: 0x30261c, leaf: 0x1e4a2a, leafD: 0x163a20, stone: 0x5a6a5a, stoneD: 0x3e4a3e, moss: 0x3a6a32,
           metal: 0x5a6252, metalD: 0x3a4036, bag: 0x6a6448, crate: 0x5a5038, lamp: 0xffc070, fungus: 0x5affd0, red: 0xff3a2a, stripe: 0xb08a2a },
    backdrop: [
      { kind: 'cliffs', count: 22, r: [1.4, 2.0], h: [20, 34], w: 0.3, color: 0x10221a, color2: 0x0c1a14 },
      { kind: 'spires', count: 26, r: [1.2, 1.8], h: [22, 40], w: [1.5, 3], color: 0x1a2a1c, color2: 0x142218 },   // the jungle's giants, as silhouettes
    ],
    ambient: { kind: 'dust', color: 0xc8ff7a, count: 140, size: 0.2, opacity: 0.7 },   // fireflies
    mist: { color: 0x5a8a7a, count: 40, size: 10, opacity: 0.14 },
    // the company's gunships hunting over the canopy, blue bolts in the trees
    warfront: { flyers: [{ kind: 'dropship', count: 2, alt: [30, 55], speed: [20, 30], every: [7, 12] }],
      blasts: 0.35, tracers: { rate: 0.7, colors: [0x3a8aff, 0x6ab0ff] }, columns: 2, smoke: 0x1a2420 },
    beats: { fog: 0x24403a, fill: 1.05, tint: 0xa0e0d0 },
    hazards: { barrel: 0x6a5a2a },
    sound: 'plains',
  },
  pursuit: {   // the spaceport at Khel Dar: a sandstone port town in the late-afternoon sun, a Star Destroyer over the docks
    sky: { top: 0x3a5c92, horizon: 0xf0b070, below: 0xb08a62, bands: 7, stars: 0,
      sun: { el: 0.16, color: 0xffe0a0, halo: 0xffb070, size: 22 },
      clouds: { color: 0xf0c898, under: 0xb08868, count: 9, lo: 0.5, hi: 0.85 },
      ridges: [{ color: 0xc09060, h: 0.08, rough: 0.05, seed: 7 }, { color: 0xa47a52, h: 0.05, rough: 0.07, seed: 2 }] },
    fog: 0xd8a878, fogStart: 0.9, fogEnd: 3.4,
    light: { sun: 0xffdcb0, sunI: 1.75, dir: [-22, 34, 18], hemiSky: 0xbcd0f0, hemiGround: 0x7a5a3a, fill: 0.8, rim: 0xffc890, rimI: 0.5 },
    floor: { kind: 'flagstone', base: 0xb49470, seed: 17 },
    outer: 0xb08a5e,
    pal: { wall: 0xc8a67c, wallD: 0xa8845c, trim: 0x8a6440, roof: 0x7a5236, metal: 0x6a727e, imperial: 0x3a3e46, stripe: 0xd9a43a,
           crate: 0x8a7458, cloth: [0xb8402a, 0x2a6a8a, 0xd8a03a, 0x5a7a3a], lamp: 0xffc070, glass: 0x2a4a6a },
    backdrop: [
      // the Empire's ship hangs over the docks at the end of the run: the place the quarry is running for
      // the town runs on past the route: more sandstone blocks, domes and towers
      { kind: 'district', h: [10, 22], w: [7, 12], color: 0xc8a67c, color2: 0xa8845c, trim: 0x8a6440, roof: 0x7a5236, domes: 0.25, spires: 0.1, setback: 0.3, gap: 6, streets: 0 },
      { kind: 'destroyer', az: Math.PI/2, r: 5.2, y: 34, scale: 1.1, color: 0x8a8c96, color2: 0x767884, glow: 0x9ad8ff },
    ],
    ambient: { kind: 'dust', color: 0xffe2b0, count: 420, size: 0.3 },
    // a working port under occupation: freighters lifting off, a TIE pair on patrol, trouble in a few streets
    warfront: { flyers: [{ kind: 'freighter', count: 2, alt: [40, 120], speed: [30, 55], every: [8, 16] }, { kind: 'tie', count: 1, wing: 2, alt: [40, 80], speed: [70, 100], every: [8, 14] }],
      blasts: 0.15, tracers: { rate: 0.4, colors: [0xff3a2a, 0xff7a3a] }, columns: 2, smoke: 0x4a4038 },
    beats: { fog: 0xd08a5a, fill: 1.06, tint: 0xffa070 },
    sound: 'temple',
  },
  archive: {   // the temple archive on Jedha, burning: a smoke-brown sky over the holy city, the stacks alight
    sky: { top: 0x3a3440, horizon: 0xd88a4a, below: 0x8a6448, bands: 7, stars: 0,
      sun: { el: 0.16, color: 0xffc080, halo: 0xff9050, size: 22 },
      clouds: { color: 0x5a4640, under: 0x2e2420, count: 18, lo: 0.3, hi: 0.9 },
      ridges: [{ color: 0x9c7250, h: 0.08, rough: 0.05, seed: 3 }] },
    fog: 0x8a5a3a, fogStart: 0.8, fogEnd: 3.0,
    // art pass: a cooler smoke-shadow rim against the fire light, a greyer floor than the sandstone walls, and the
    // charred stacks a burnt umber rather than a black hole in the frame
    light: { sun: 0xffc890, sunI: 1.7, dir: [18, 34, 30], hemiSky: 0xc0a898, hemiGround: 0x4e3628, fill: 0.82, rim: 0x8ea4dc, rimI: 0.5 },
    floor: { kind: 'flagstone', base: 0x8e7a62, seed: 23 },
    outer: 0x7a5c40,
    pal: { stone: 0xb89a70, stoneD: 0x8e7250, trim: 0xd8b46a, wood: 0x5e3c24, woodD: 0x3e2618, char: 0x3a2a20, scroll: 0xd8c8a0,
           fire: 0xff8a2a, ember: 0xffc060, holo: 0x7ad8ff, sky: 0x6a4a3a },
    backdrop: [
      { kind: 'district', h: [14, 26], w: [7, 13], color: 0xa8865e, color2: 0x8e7050, trim: 0x8a6a46, roof: 0x9a6a42, domes: 0.3, spires: 0.12, setback: 0.3, gap: 9 },
      { kind: 'destroyer', az: -1.8, r: 2.3, y: 24, scale: 1.2, color: 0x8a8c96, color2: 0x767884, glow: 0x9ad8ff },
    ],
    ambient: { kind: 'embers', color: 0xff9a40, count: 180 },
    warfront: { flyers: [{ kind: 'tie', count: 2, wing: 2, alt: [35, 70], speed: [70, 100], every: [5, 10], fire: 0x5aff6a }],
      blasts: 0.35, tracers: { rate: 0.6, colors: [0xff3a2a, 0xff7a3a] }, columns: 4, smoke: 0x3a3030 },
    beats: { fog: 0xa0502a, fill: 1.08, tint: 0xff8a50 },
    hazards: { barrel: 0xa33820 },
    sound: 'temple',
  },
  prison: {   // the prison outpost on Lothal: a grey Imperial yard under the Grass Sea's afternoon sky
    sky: { top: 0x3e6aa8, horizon: 0xf0d098, below: 0x9a9a6a, bands: 7, stars: 0,
      sun: { el: 0.24, color: 0xfff0c0, halo: 0xffd890, size: 20 },
      clouds: { color: 0xeee0c8, under: 0xb09c88, count: 12, lo: 0.45, hi: 0.9 },
      ridges: [{ color: 0x8a9a7a, h: 0.07, rough: 0.05, seed: 6 }] },
    fog: 0xb8b896, fogStart: 0.85, fogEnd: 3.2,   // art pass: a less milky haze so the yard doesn't wash out
    light: { sun: 0xfff0d0, sunI: 1.7, dir: [-24, 40, 26], hemiSky: 0xbcd0f0, hemiGround: 0x4a4e52, fill: 0.85, rim: 0xffd8a0, rimI: 0.45 },
    floor: { kind: 'deck', base: 0x6a6e72, stripe: 0xd9a43a, seed: 31 },
    outer: 0x767c44,
    pal: { wall: 0x7a8088, wallD: 0x50565e, imperial: 0x3a3e46, stripe: 0xd9a43a, containers: [0x5a6a5e, 0x7a5a3a, 0x4a5a72], crate: 0x7e6a50,
           red: 0xff3a2a, lamp: 0xffd090, shock: 0x6ad8ff, paint: 0xd8d0b8 },
    backdrop: [
      { kind: 'spires', count: 16, r: [1.6, 2.4], h: [18, 36], w: [3, 6], color: 0x8a8070, color2: 0x7a705e },
      { kind: 'dunes', count: 12, r: [1.3, 1.6], h: 4, color: 0x767c44 },
      { kind: 'destroyer', az: -1.3, r: 2.2, y: 40, scale: 1.1, color: 0x8a8c96, color2: 0x767884, glow: 0x9ad8ff },
    ],
    ambient: { kind: 'dust', color: 0xfff0c8, count: 120, size: 0.26 },
    warfront: { flyers: [{ kind: 'tie', count: 1, wing: 2, alt: [40, 90], speed: [70, 100], every: [8, 14], fire: 0x5aff6a }, { kind: 'dropship', count: 1, alt: [45, 70], speed: [22, 32], every: [12, 20] }] },
    beats: { fog: 0xd0b088, fill: 1.05, tint: 0xffd0a0 },
    hazards: { barrel: 0xa33820 },
    sound: 'temple',
  },
  hangar: {   // the rebel hangar on Hoth: a cave cut in the glacier, work lamps and the shield's blue at the mouth
    mist: false,   // indoors
    sky: { top: 0x0e1218, horizon: 0x2a3444, below: 0x1a2028, bands: 5, stars: 0 },
    fog: 0x3a4658, fogStart: 1.3, fogEnd: 3.8, clear: 0x0e1218,
    light: { sun: 0xe8f0ff, sunI: 1.45, dir: [-14, 40, 22], hemiSky: 0xb8cce8, hemiGround: 0x343c4a, fill: 0.82, rim: 0xffb070, rimI: 0.5 },
    floor: { kind: 'snow', base: 0x5e6c80, seed: 37 },   // art pass: packed, trodden snow, a value below the white troopers
    outer: 0x5a6474,
    pal: { ice: 0x9ab4cc, iceD: 0x6e88a4, rock: 0x4a5462, metal: 0x8a929c, metalD: 0x4a525c, stripe: 0xd06a2a, pod: 0xb0aa9a, crate: 0x6a5a48,
           lamp: 0xffc070, shield: 0x7ad8ff, outside: 0xc8d4e0, dusk: 0x5a6e8a, mark: 0xd06a2a, shed: 0xbfe8ff },
    backdrop: [],
    ambient: { kind: 'snow', color: 0xf4f8ff, count: 140, size: 0.2, opacity: 0.6 },
    beats: { fog: 0x4a5468, fill: 1.0, tint: 0xd8e0ff },
    hazards: { barrel: 0xa33820 },
    sound: 'plains',
  },
  pens: {   // the Inquisitor prison moon Tessaril: black wet rock at night under a gas giant, rain, a storm over the spire
    sky: { top: 0x05070e, horizon: 0x2a3048, below: 0x10121a, bands: 6, stars: 60,
      sun: { el: 0.42, az: 2.2, color: 0x8a7aa8, halo: 0x4a4466, size: 70, kind: 'moon' },   // the gas giant Tessaril circles
      clouds: { color: 0x3a4058, under: 0x161a26, count: 26, lo: 0.3, hi: 0.95 },
      ridges: [{ color: 0x12141c, h: 0.14, rough: 0.16, spiky: 1.0, seed: 17 }, { color: 0x1c1f2a, h: 0.08, rough: 0.1, spiky: 0.5, seed: 4 }] },
    fog: 0x2a3042, fogStart: 0.45, fogEnd: 2.2,
    light: { sun: 0xb8c0e8, sunI: 1.25, dir: [20, 44, 30], hemiSky: 0x7a88b0, hemiGround: 0x22242c, fill: 0.95, rim: 0xff6a5a, rimI: 0.55 },
    floor: { kind: 'basalt', base: 0x3a3c44, seed: 53 },
    outer: 0x22242c,
    pal: { rock: 0x40424c, rockD: 0x2c2e36, wall: 0x50545e, wallD: 0x30333a, spire: 0x15161b, stripe: 0xb83a2a, crate: 0x5a5448,
           red: 0xff3a2a, lamp: 0xffe0b0, guide: 0x7ad8ff, puddle: 0x1a2230, shock: 0x9a7aff },
    backdrop: [
      { kind: 'cliffs', count: 18, r: [1.9, 2.6], h: [14, 30], w: 0.3, color: 0x1e2028, color2: 0x26282f, skip: [[-Math.PI/2, 0.35]] },
      { kind: 'spires', count: 10, r: [1.5, 2.0], h: [10, 22], color: 0x1a1c22, color2: 0x22242a, skip: [[-Math.PI/2, 0.5]] },
    ],
    ambient: { kind: 'rain', color: 0xa8b8d8, count: 420, size: 0.14, opacity: 0.55 },
      mist: { color: 0x4a5470, count: 36, size: 10, opacity: 0.14 },
    warfront: { flyers: [{ kind: 'tie', count: 1, wing: 2, alt: [40, 90], speed: [70, 100], every: [9, 15], fire: 0x5aff6a }] },
    storm: { every: [4, 9], fill: 1.6, sky: 1.2, ramp: 2, fogFlash: 0.45, color: 0xd8e0ff },
    hazards: { barrel: 0x8a2a30 },
    beats: { fog: 0x343a52, fill: 1.06, tint: 0xa0a8e0 },
    sound: 'plains',
  },
  sith: {   // the Sith amphitheatre on Exegol: a duelling floor in the Citadel, open to the storm
    sky: { top: 0x06060c, horizon: 0x4a5266, below: 0x16141c, bands: 6, stars: 0,
      clouds: { color: 0x525a70, under: 0x20242e, count: 30, lo: 0.25, hi: 0.95 },
      ridges: [{ color: 0x14121a, h: 0.12, rough: 0.12, spiky: 1.2, seed: 21 }] },
    fog: 0x3c485c, fogStart: 0.15, fogEnd: 0.95, haze: { len: 40, max: 0.8 },   // art pass: the Citadel stays a dark shape in the haze
    light: { sun: 0xb4c4e8, sunI: 1.3, dir: [14, 50, 40], hemiSky: 0x8a9cc0, hemiGround: 0x2a2e3c, fill: 0.92, rim: 0x8a9cf0, rimI: 0.7 },
    floor: { kind: 'flagstone', base: 0x4a4452, seed: 41 },
    outer: 0x2c2834,
    pal: { stone: 0x5a5262, stoneD: 0x3a3442, dark: 0x1a1620, robe: 0x141018, metal: 0x4a4652, voidGlow: 0x7f8ee0 },
    backdrop: [
      { kind: 'pyramid', az: -Math.PI/2, r: 2.4, scale: 1.0, size: 1500, color: 0x1a1620, color2: 0x241e2a, glow: 0x8a98e8 },
      { kind: 'spires', count: 12, r: [1.8, 2.5], h: [20, 38], color: 0x221e2a, color2: 0x2c2634, skip: [[-Math.PI/2, 0.45]] },
    ],
    ambient: { kind: 'ash', color: 0xa0aac0, count: 120, size: 0.22, opacity: 0.45 },
      mist: { color: 0x7e8aa4, count: 46, size: 11, opacity: 0.16 },
    warfront: { flyers: [{ kind: 'tie', count: 2, wing: 3, alt: [50, 110], speed: [80, 120], every: [3, 7], color2: 0x4a1218, fire: 0x5aff6a },
      { kind: 'xwing', count: 2, wing: 2, alt: [50, 110], speed: [80, 120], every: [3, 7], fire: 0xff3a2a }],
      blasts: 0.3, flash: 0xc8d4ff, tracers: { rate: 0.8, colors: [0xff3a2a, 0x5aff6a] }, columns: 1, smoke: 0x1e1a24 },
    storm: { every: [2.5, 6], fill: 1.9, sky: 1.4, ramp: 2, fogFlash: 0.55, color: 0xdce6ff },
    hazards: { barrel: 0x8a2a30 },
    beats: { fog: 0x232a40, fill: 1.08, tint: 0x8fa0e0 },
    sound: 'plains',
  },
};

/* BATTLE MAPS — the large open fields for big squad battles (data/battlemaps.js) keep one look whatever WORLD is picked.
   They are two to three times the size of a campaign arena, so fog starts nearer (as a share of the arena) and the
   backdrop sits further out; the sky dome and the sun's shadow box ride along with the hero (world/atmosphere.js). */
export const BATTLE_WORLDS = {
  grassland: {   // the Grass Sea of Lothal: golden grass and rock spires under a big afternoon sky
    sky: { top: 0x3e6aa8, horizon: 0xf0d098, below: 0x9a9a6a, bands: 7, stars: 0,
      sun: { el: 0.22, color: 0xfff0c0, halo: 0xffd890, size: 20 },
      clouds: { color: 0xf8e8d0, under: 0xc0a890, count: 14, lo: 0.45, hi: 0.9 },
      ridges: [{ color: 0x8a9a7a, h: 0.07, rough: 0.05, seed: 6 }, { color: 0x7a8a68, h: 0.04, rough: 0.06, seed: 13 }] },
    fog: 0xc8c4a0, fogStart: 0.42, fogEnd: 1.65,
    light: { sun: 0xfff0d0, sunI: 1.75, dir: [-26, 40, 30], hemiSky: 0xbcd0f0, hemiGround: 0x4a4a32, fill: 0.76, rim: 0xa8c0f0, rimI: 0.45 },
    floor: { kind: 'grass', base: 0x7e8448, seed: 21 },
    outer: 0x767c44,
    pal: { stone: 0x8e8470, stoneD: 0x6a6252, bag: 0x9e9070, metal: 0x7a828e, imperial: 0x3e424a, crate: 0x7e6a50,
           stripe: 0xd9a43a, lamp: 0xffc070, scorch: 0x3a3626, blast: 0xff7a30, beacon: 0xff5040 },
    backdrop: [
      { kind: 'spires', count: 22, r: [1.35, 2.3], h: [18, 40], w: [3, 6], color: 0x7c6c5a, color2: 0x6a5c4c },   // art pass: darker rock, so the spires stand off the pale sky
      { kind: 'dunes', count: 14, r: [1.08, 1.3], h: 4, color: 0x767c44 },
      { kind: 'walker', az: -1.9, r: 1.7, scale: 1.4, color: 0x8a909a, color2: 0x6a7078, glow: 0xff5a3a },
      { kind: 'destroyer', az: -1.3, r: 2.0, y: 46, scale: 1.3, color: 0x8a8c96, color2: 0x767884, glow: 0x9ad8ff },
    ],
    ambient: { kind: 'dust', color: 0xfff0c8, count: 160, size: 0.28 },
    // the liberation of Lothal: X-wings and TIEs dogfighting over the grass, the ground war along both flanks
    warfront: { flyers: [{ kind: 'tie', count: 2, wing: 2, alt: [40, 120], speed: [80, 120], every: [3, 7], fire: 0x5aff6a }, { kind: 'xwing', count: 2, wing: 2, alt: [40, 120], speed: [80, 120], every: [3, 7], fire: 0xff3a2a },
      { kind: 'dropship', count: 1, alt: [50, 80], speed: [22, 32], every: [10, 18] }],
      blasts: 0.7, tracers: { rate: 1.2, colors: [0xff3a2a, 0xff7a3a] }, columns: 4, smoke: 0x4a4436 },
    beats: { fog: 0xd0b088, fill: 1.06, tint: 0xffd0a0 },
    hazards: { barrel: 0xa33820 },
    sound: 'temple',
  },
  icefront: {   // the Ice Front on Hoth: a grey-blue snowfield under low cloud, snow on the wind
    sky: { top: 0x5a6e8a, horizon: 0xc8d4e0, below: 0x8a96a6, bands: 6, stars: 0,
      sun: { el: 0.18, color: 0xf0f4ff, halo: 0xc8d8f0, size: 16 },
      clouds: { color: 0xd8e0ea, under: 0x8a98aa, count: 26, lo: 0.2, hi: 0.9 },
      ridges: [{ color: 0x8a9ab0, h: 0.16, rough: 0.12, spiky: 0.5, seed: 19 }, { color: 0x6e7e96, h: 0.08, rough: 0.08, seed: 4 }] },
    // art pass: the snowfield and haze a step darker and bluer (the white troopers were sinking into it), less flat
    // fill so the drifts and berms show their form, a warm rim from the low sun on the fighters
    fog: 0x909eb4, fogStart: 0.3, fogEnd: 1.35,
    light: { sun: 0xeef4ff, sunI: 1.55, dir: [24, 38, 34], hemiSky: 0xb4c6e2, hemiGround: 0x3e4656, fill: 0.8, rim: 0xffb080, rimI: 0.5 },
    floor: { kind: 'snow', base: 0x66768e, seed: 27 },   // mid grey-blue, never white: the troopers must read against it
    outer: 0x8494a6,
    pal: { snow: 0x909eb2, snowD: 0x6a7a90, bag: 0x8a7a5e, ice: 0x7e96b0, rock: 0x5a6474, plank: 0x6a5a48, metal: 0x8a929c, metalD: 0x4a525c, imperial: 0x3a3e46,
           stripe: 0xd9a43a, lamp: 0xffc070, shield: 0x7ad8ff, scorch: 0x3a4252, blast: 0xff7a40, beacon: 0xff5040 },
    backdrop: [
      { kind: 'cliffs', count: 20, r: [1.4, 2.2], h: [16, 32], w: 0.3, color: 0x6a7a92, color2: 0x58687e, skip: [[-1.0, 0.3]] },
      { kind: 'dunes', count: 16, r: [1.06, 1.3], h: 4, color: 0x7a8aa0 },
      { kind: 'walker', az: -1.0, r: 1.5, scale: 1.6, color: 0x7a8494, color2: 0x5e6878, glow: 0xff5a3a, stand: true },
      { kind: 'walker', az: -2.3, r: 1.8, scale: 1.4, color: 0x7a8494, color2: 0x5e6878, glow: 0xff5a3a, stand: true },
    ],
    ambient: { kind: 'snow', color: 0xf4f8ff, count: 420, size: 0.24, opacity: 0.8 },
    // the Battle of Hoth: AT-ATs marching on the shield generator from the south, snowspeeders circling their legs
    warfront: { walkers: 2, walkerAz: -Math.PI/2, speedersPer: 2, walker: { color: 0x7a8494, color2: 0x5e6878 },
      blasts: 0.6, tracers: { rate: 1.2, colors: [0xff3a2a, 0xff7a3a] }, columns: 3, smoke: 0x3a3e46, wind: [5, 0] },
    beats: { fog: 0x8a90a4, fill: 1.04, tint: 0xd8e0ff },
    hazards: { barrel: 0xa33820 },
    sound: 'plains',
  },
  graveyard: {   // the Starship Graveyard on Jakku: pale sand, hard noon light, a dead Star Destroyer on the horizon
    sky: { top: 0x4a74b0, horizon: 0xf0d0a0, below: 0xc0a070, bands: 7, stars: 0,
      sun: { el: 0.4, color: 0xfff4d0, halo: 0xffe0a0, size: 18 },
      clouds: { color: 0xf4e4c8, under: 0xc8a888, count: 6, lo: 0.55, hi: 0.85 },
      ridges: [{ color: 0xc09a6a, h: 0.06, rough: 0.04, seed: 9 }, { color: 0xa88458, h: 0.04, rough: 0.05, seed: 15 }] },
    fog: 0xdcc098, fogStart: 0.45, fogEnd: 1.7,
    light: { sun: 0xfff0d0, sunI: 1.7, dir: [18, 46, 22], hemiSky: 0xc4d4f0, hemiGround: 0x6a5238, fill: 0.74, rim: 0x9ab4e8, rimI: 0.45 },
    floor: { kind: 'sand', base: 0xa48660, seed: 33 },
    outer: 0xa4865c,
    pal: { hull: 0x8e8e88, hullD: 0x5e5e5a, rust: 0x7a5236, sand: 0xae8e60, cloth: 0x9a6a46, imperial: 0x3a3e46, stripe: 0xd9a43a,
           dark: 0x2a2622, lamp: 0xffc070, plasma: 0x6ad8ff, beacon: 0xff5040 },
    backdrop: [
      { kind: 'wreck', az: -2.2, r: 1.75, scale: 1.2, size: 2400,   // the Inflictor: a whole Star Destroyer, half buried
         color: 0x8a8a86, color2: 0x6e6e6a },
      { kind: 'wreck', az: 0.5, r: 2.0, scale: 0.8, color: 0x8a8a86, color2: 0x6e6e6a, roll: -0.5 },
      { kind: 'mesas', count: 10, r: [1.6, 2.3], h: [10, 22], w: [10, 20], color: 0x9c6c4a, color2: 0x885c40, skip: [[-2.2, 0.5]] },   // art pass: red rock, not the sand's colour
      { kind: 'dunes', count: 18, r: [1.05, 1.35], h: 5, color: 0xa4865c },
    ],
    ambient: { kind: 'dust', color: 0xffe8c0, count: 200, size: 0.3 },
    // after the war: scavengers picking over the wrecks, a freighter lifting off, the odd salvage fight in the dunes
    warfront: { flyers: [{ kind: 'freighter', count: 1, alt: [40, 110], speed: [30, 55], every: [12, 22] }],
      blasts: 0.12, tracers: { rate: 0.3, colors: [0xff3a2a, 0xff7a3a] }, columns: 2, smoke: 0x3a3430 },
    beats: { fog: 0xd8a878, fill: 1.05, tint: 0xffc890 },
    hazards: { barrel: 0xa33820, vent: 0x3a3a3c, ventIdle: 0x1a3a4a, ventActive: 0x6ad8ff },
    sound: 'temple',
  },
  approach: {   // the road to the Citadel on Exegol: the Grass Sea's battle plan laid on Sith ash, the storm overhead
    sky: { top: 0x06060c, horizon: 0x4a5266, below: 0x16141c, bands: 6, stars: 0,
      clouds: { color: 0x525a70, under: 0x20242e, count: 30, lo: 0.25, hi: 0.95 },
      ridges: [{ color: 0x14121a, h: 0.1, rough: 0.12, spiky: 1.2, seed: 17 }] },
    fog: 0x3c485c, fogStart: 0.12, fogEnd: 0.8, haze: { len: 40, max: 0.8 },
    light: { sun: 0xb4c4e8, sunI: 1.3, dir: [14, 50, 40], hemiSky: 0x8a9cc0, hemiGround: 0x2e2a36, fill: 0.88, rim: 0x8a9cf0, rimI: 0.7 },
    floor: { kind: 'ash', base: 0x6a6472, seed: 29 },
    outer: 0x2c2834,
    pal: { stone: 0x5a5262, stoneD: 0x3e3846, bag: 0x6a6258, metal: 0x6a6e7a, imperial: 0x2a2630, crate: 0x5a4e46,
           stripe: 0x7f8ee0, lamp: 0xa8b4f0, scorch: 0x1e1a24, blast: 0x9aa6ee, beacon: 0x7f8ee0 },
    backdrop: [
      { kind: 'pyramid', az: -Math.PI/2, r: 2.2, scale: 1.0, size: 1500, color: 0x1a1620, color2: 0x241e2a, glow: 0x8a98e8 },
      { kind: 'spires', count: 22, r: [1.35, 2.3], h: [18, 40], w: [3, 6], color: 0x221e2a, color2: 0x2c2634, skip: [[-Math.PI/2, 0.4]] },
      { kind: 'dunes', count: 14, r: [1.08, 1.3], h: 4, color: 0x2c2834 },
    ],
    ambient: { kind: 'ash', color: 0xa0aac0, count: 130, size: 0.24, opacity: 0.45 },
    mist: { color: 0x7e8aa4, count: 56, size: 12, opacity: 0.16 },
    warfront: { flyers: [{ kind: 'tie', count: 2, wing: 3, alt: [40, 120], speed: [80, 120], every: [3, 7], color2: 0x4a1218, fire: 0x5aff6a },
      { kind: 'xwing', count: 2, wing: 2, alt: [40, 120], speed: [80, 120], every: [3, 7], fire: 0xff3a2a }],
      blasts: 0.7, flash: 0xc8d4ff, tracers: { rate: 1.2, colors: [0xff3a2a, 0x5aff6a] }, columns: 4, smoke: 0x1e1a24 },
    storm: { every: [2.5, 6], fill: 1.9, sky: 1.4, ramp: 2, fogFlash: 0.55, color: 0xdce6ff },
    beats: { fog: 0x232a40, fill: 1.08, tint: 0x8fa0e0 },
    hazards: { barrel: 0x8a2a30 },
    sound: 'plains',
  },
};

/* the theme for a level (by its layout), or null for unthemed/procedural arenas */
export function themeFor(L){
  if (TRAINING_WORLDS[L.layout]) return TRAINING_WORLDS[L.layout];
  if (MISSION_WORLDS[L.layout]) return MISSION_WORLDS[L.layout];
  if (BATTLE_WORLDS[L.layout]) return BATTLE_WORLDS[L.layout];
  const d = WORLD_DIRECTIONS[WORLD];
  return (d && L.layout && d[L.layout]) || null;
}
