# Animation guidelines

Rules for the hero animation pass (and anything after it). The goal: every stance, swing and pose should read as the
Star Wars technique it's named after, not as a generic "fast / balanced / strong" preset.

## Lightsaber forms

Each form in `src/data/stances.js` should look like its on-screen and lore counterpart. Gameplay roles can stay, but
the body language comes from the form.

| Form | Who uses it | What it should look like |
|---|---|---|
| I · Shii-Cho | Kit Fisto, Kenobi when teaching | Wide, sweeping, fundamental strokes; open stance; big horizontal arcs that clear space; disarming cuts. Good for crowds. Not especially fast or acrobatic. |
| II · Makashi | Dooku | Upright fencer's stance, one hand, tip forward, small precise wrist cuts and lunges. |
| III · Soresu | Kenobi | Compact, defensive: blade close to the body, tight deflecting loops, little wasted motion. |
| IV · Ataru | Yoda, Qui-Gon | Acrobatic: flips, leaps, spinning strikes, Force-boosted jumps. This is the "fast" form in the films. |
| V · Djem So / Shien | Anakin, Vader, Luke | Djem So: powerful two-handed strikes, block then hammer back. Shien: the same aggression, often with the reverse grip. |
| VI · Niman | Many Clone Wars Jedi | Balanced and moderate; blends saber work with Force pushes. Fits the Force-heavy kit. |
| VII · Juyo / Vaapad | Mace Windu, Maul | Ferocious, unpredictable, aggressive chains. Mace's signature form and a natural future stance. |

The game's three switchable stances, and how they move now:

| Key | Stance | Gameplay role (unchanged) | How it moves |
|---|---|---|---|
| 1 | **IV · Ataru** | fast, crowd-clearing, mobile | Qui-Gon's coiled two-handed ready, a one-handed high cover, short whippy cuts with a little hop, and a leaping spin cut as the finisher. |
| 2 | **VI · Niman** | balanced, Force synergy | One-handed saber with the off hand open to push; the free palm flares out against each cut; a clean spinning finisher. |
| 3 | **V · Djem So** | power vs brutes and bosses | Anakin's two-handed high guard, Vader's level wall block, big two-handed cuts that sink the hips, an overhead hammer finisher, and the riposte as the "block, then strike back". |

The stance ids in code stay `fast` / `medium` / `strong` (saves and unlocks key off them); each carries `form` in
`src/data/stances.js`. **Vaapad (VII)** is still the natural candidate for a fourth or unlockable stance.

## Grip

- **Regular grip:** the blade comes out of the thumb side. This is the default.
- **Reverse grip:** the blade comes out of the pinky side, lying along the forearm (Ahsoka, Starkiller, Shien users).

The grip is a player preference (`GRIP` in the menu settings, saved like the others). It is visual only: hit arcs don't use the blade mesh. Each grip has its own guards and cuts in `src/data/poses.js`: the reverse set keeps the blade back along the arm, drives slashes with the elbow and a hard body turn (the fist leads, the blade trails), and turns the back cut into a stab driven past the hip.

## Mandalorian

- **Blasters:** gunslinger stances (Din Djarin). Quick draw, one-handed hip shots with the pistol, and a two-handed brace for the rifle.
- **Jetpack:** upright hover with small corrections. Lean into travel at speed, and land with a knee-bend absorb. Boba Fett, not Superman, unless boosting.
- **Darksaber:** heavy and effortful, as in Mandalorian season 2–3. It "fights back" against an unsure wielder: wide, weighty swings, often two-handed, with recovery after each blow. Bo-Katan, who wields it confidently, is the cleaner reference for a mastered version.

## Rig features to use

- **New joints** (`src/player/model/rig.js`): chest (upper-body twist separate from the hips), wrists (snap and weapon angle), ankles (foot plant), four robe flaps and the cape pivot (follow-through and secondary motion).
- **Weapon holds:** weapons carry a `hold` tag in `src/player/model/weapons.js` (`saber-1h`, `pistol`, `rifle-2h`). Pose sets should key off hold + grip + form, so new weapon types slot in.

## How poses are authored

Guards and swings live in `src/data/poses.js` as **hand position + blade direction** in chest space (+x the weapon
hand's side, +y up, +z forward), not joint angles. `src/player/anim/ik.js` solves the arm (two-bone IK), points the
blade (splitting the turn between the new wrist joint and the hilt) and closes the off hand on the hilt for
two-handed holds. That means:

- A guard is described the way you'd describe a film still: "both hands by the weapon shoulder, blade up and back".
- A swing is three keys (chamber, strike, follow-through); the hand travels on an arc between them and the blade
  slerps. `SWING_STYLE` sets each form's timing, reach, hop, hip drop, off-hand flare and finisher.
- Timings: every form's strike key sits just after 35% of the swing, where combat.js applies damage, so the blade is
  crossing the front as the hit lands. Swing durations and hit arcs are untouched.
- The Mando's blasters use the same solver (`anim/guns.js`): low at the hip until he shoots, then up one-handed down
  the aim line; the disruptor is shouldered with the off hand on the foregrip.
- Cloth (robe panels, cape) is a damped spring per panel in `animation.js` (`secondaryMotion`).

To preview: `npm run dev`, play, or capture frames with a fixed camera; the poses hot-reload with Vite.
