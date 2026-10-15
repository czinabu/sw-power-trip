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

Notes on the current stances:

- **Shii-Cho is labelled FAST.** In lore, Ataru is the fast, acrobatic form. Either rework Shii-Cho toward wide sweeping cuts or swap the fast slot to Ataru (which suits the existing flips).
- **Niman as the balanced, Force-friendly form fits.**
- **Djem So as the power form fits.** Give it the "block, then strike back" rhythm (its parry → riposte).
- **Vaapad is a good candidate for a fourth or unlockable stance,** since the hero is Mace Windu.

## Grip

- **Regular grip:** the blade comes out of the thumb side. This is the default.
- **Reverse grip:** the blade comes out of the pinky side, lying along the forearm (Ahsoka, Starkiller, Shien users).

The grip is a player preference (`GRIP` in the menu settings, saved like the others). It is visual only: hit arcs don't use the blade mesh. Today the swings are the regular-grip ones with the blade flipped. The animation pass should give the reverse grip its own guards and cuts: blade held back along the arm, slashes driven by the elbow and body turn, and stabs backward past the hip.

## Mandalorian

- **Blasters:** gunslinger stances (Din Djarin). Quick draw, one-handed hip shots with the pistol, and a two-handed brace for the rifle.
- **Jetpack:** upright hover with small corrections. Lean into travel at speed, and land with a knee-bend absorb. Boba Fett, not Superman, unless boosting.
- **Darksaber:** heavy and effortful, as in Mandalorian season 2–3. It "fights back" against an unsure wielder: wide, weighty swings, often two-handed, with recovery after each blow. Bo-Katan, who wields it confidently, is the cleaner reference for a mastered version.

## Rig features to use

- **New joints** (`src/player/model/rig.js`): chest (upper-body twist separate from the hips), wrists (snap and weapon angle), ankles (foot plant), four robe flaps and the cape pivot (follow-through and secondary motion).
- **Weapon holds:** weapons carry a `hold` tag in `src/player/model/weapons.js` (`saber-1h`, `pistol`, `rifle-2h`). Pose sets should key off hold + grip + form, so new weapon types slot in.
