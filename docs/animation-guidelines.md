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
- **Aimed fire (RMB):** the same IK aim as hip fire, held drawn: both pistols down the crosshair line for dual, and for the single blaster the off arm comes up behind the gauntlet shield. No joint-angle brace (it pointed the muzzles at the sky).
- **Running away:** past ~120° off the aim line on foot he turns and runs like the Jedi instead of backpedalling. Shooting while he runs fires only the gun hand: the chest twists the gun shoulder back, the arm and blaster stay on the crosshair and the helmet turns to it, while the legs keep running. He always turns in over his off-hand shoulder, so the gun side stays toward the target, and turns back the same way, eased rather than whipped. With dual blasters the hand on the target's side shoots (changing hands only once the target is well across). The torso twists at most ~55° and the arm reaches at most ~150° round from the chest, so it never swings through his back. He squares up to fire the rifle. Backpedalling while bracing runs the legs backwards.
- **Cape:** worn under the jetpack (Boba, Din). The top panel hangs in the gap between back plate and pack and only sways sideways; a hinged hem below the pack takes the trail and flutter, so it never swings through the pack.
- **Jetpack:** upright hover with small corrections. Lean into travel at speed, and land with a knee-bend absorb. Boba Fett, not Superman, unless boosting.
- **Darksaber:** heavy and effortful, as in Mandalorian season 2–3. It "fights back" against an unsure wielder: wide, weighty swings, often two-handed, with recovery after each blow. Bo-Katan, who wields it confidently, is the cleaner reference for a mastered version.

## Agility

Dashes, jumps, flips, the Force leap and glide, slam dives, landings and the run move like the form (or the Mando)
too. Speeds, durations, i-frames and hitboxes stay in `data/config.js`, `data/mando.js` and `player/movement.js`; the
body move for each lives in `src/data/agility.js` and is posed by `src/player/anim/agility.js`.

| Move | IV · Ataru | VI · Niman | V · Djem So |
|---|---|---|---|
| Dash (Shift) | butterfly twist to the side, tuck flips forward/back | a smooth spin dodge, arms open | no spin: a low, driven slide, hips sunk |
| Tap jump | tucks and turns a full twist | knee drive, tuck, reach | a short, heavy hop |
| Double jump | front flip with a full twist | clean layout front flip | flipless Force leap, blade cocked overhead |
| Guard + jump evade | back layout full, twisting handspring, no-hands aerial | single back/front/side flips, open arms | tight, heavy tucks, blade held high |
| Force leap / glide | hurdler's leap, cat crouch, blade trailing | upright float, off palm steadying | blade up overhead, ready to bring it down |
| Slam (X) | blade-first plunge, lands kneeling on it | palm-first Force landing | overhead hammer smashed into the ground |
| Landing | deep but springs straight back up | even | sinks deep and wide, rises slowly |
| Run | blade trailing low, light and leaning | blade at the side, off hand pumping | two-handed high carry, heavy |

Knees bend with **+x** on the knee joint (the shin folds back); −x hyperextends. Hips are −x for thigh forward.
Flips turn about the centre of mass, not the feet. A flip is described by turns about the body's axes (somer, twist,
roll, spin) plus a leg shape (tuck, pike, layout, split, slide) and an air guard for the saber hand(s).

The Mando keeps to beskar and jets: the ground dodge is a thruster-shoved slide, a hop tucks the knees, ignition
snaps the legs together under the pack, and a jet slam drops into a three-point landing.

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
