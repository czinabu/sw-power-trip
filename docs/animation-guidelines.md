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

## Combos and deflects

- **Combo rhythm** (`FLOW` in `src/player/jedi/combat.js`): a press before 50% of a swing is ignored and marks that
  swing as rushed. One press from 50% on queues the next cut. If the swing wasn't rushed the link is *in rhythm*: the
  next cut leaves at 80% (just after the follow-through) with a faint ring, instead of waiting out the recovery to
  100%. Mashing still chains, just on the slower beat. Damage, hit arcs, stamina and swing lengths are unchanged.
- **Flow between cuts:** every cut starts from where the blade actually is. When the last cut ended on the far side
  from the next chamber, the wind-up wraps over the top (hand past the head, blade rolled up and back; laid along the
  forearm in reverse grip) instead of dragging back across the front. A linked cut eases out of the last one's body
  turn, hop and hip drop, and the follow-through settles a little toward the guard rather than freezing.
- **Deflects:** catching a bolt (block or parry) moves the blade to one of the catches in `SABER_DEFLECTS`
  (`src/data/poses.js`): high, mid or low, on the weapon side or across the body, two or three per zone and per grip.
  The side comes from where the bolt arrives; bolts down the middle alternate forehand and cross-body, and the height
  rotates mid/high/mid/low so a volley never repeats one block. Each catch snaps in, flicks the bolt away, and hands
  back to the guard. The form's block decides the hands (Djem So two-handed, Ataru and Niman one-handed). Blocked
  melee blows use the same catches. A swing in flight keeps the blade (the cut already deflects).

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

## Gait

The legs on the ground are solved, not swung (`src/player/anim/gait.js`, tuned in `GAIT` in `src/data/movement.js`).
A stride clock advances with distance travelled; each foot follows a stance path, where its ground contact moves
back at exactly the body's speed so it stays put in the world, then a swing path that leaves and arrives at that same
speed. Two-bone leg IK puts the ankle on the path, compensating for the body's lean. Steps lengthen and quicken with
speed; a walk keeps both feet down for a moment, a run has a flight phase; the foot heel-strikes, rolls and toes off.
Strafing and backpedalling follow the same paths in the direction of travel. A form's `gait` in `data/stances.js`
still sets its character: `amp` scales step length, `lift` the swing foot's height, `bob` the hip dip. Standing, the
stance footwork owns the legs and the two blend by speed. The body also leans with acceleration (a push to start, a
sit-back to stop, a bank into a turn).

A foot in its stance is locked where it touched down, so a hard stop or a turn mid-stride can't drag it; the swing
then starts from wherever the lock left it. Standing and at walking pace the footing (`src/player/anim/footing.js`,
tuned in `FOOTING`) keeps both feet locked on the floor and steps one at a time when a foot is out of place: stopping
out of a run settles in a step or two, turning on the spot steps round (a locked foot keeps its heading by turning at
the ankle), and switching form or sinking into a guard steps the feet to the new width. The stance's leg shape in
`FOOTWORK` (`data/poses.js`) is what the feet are stepped to.

Each foot stands on whatever is under it (`groundAt` in `world/collision.js`): a step, rubble or a crate top. A foot
reaches at most `GAIT.reachDown` below the body's support (past an edge it hangs), and the hips sink to let the lower
foot reach the ground.

**Cuts step.** A grounded cut's forward drive is root motion (`stepIntoCut` in `player/jedi/combat.js`, laid over the
swing by `MOVE.cutTravel` in `locomotion.js`): the same distance the old shove carried, but the body drives through
the strike instead of sliding out ahead of it. The lead foot (the back foot for a back strike) lifts as the cut starts
and plants as the blade lands (`FOOTING.cutStrike`), where the drive will end; the trailing foot follows after. A
spinning finisher pivots the feet with the body. In the air a cut still shoves.

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
