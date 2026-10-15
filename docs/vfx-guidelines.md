# VFX guidelines

Ability and weapon effects are drawn in the same **Ink** look as the hero and enemy models: flat cel bands, a dark
ink outline, and a white-hot core that the bloom pass catches. The kit lives in `src/fx/ink.js`.

## The language

- **Three bands, hard edges.** Every flare is core (white, pushed over 1.0 so it blooms) → colour → ink rim
  (`0x07060a`, the model outline colour). No soft radial gradients.
- **Stepped timing.** Opacity drops in two or three hard steps and fire cools through a stepped colour ramp
  (white, yellow, orange, ember, smoke). That is what reads as hand-drawn animation rather than a tween.
- **Shapes over particles.** Stars for impacts and muzzle flashes, rings for shock fronts, lumpy shaded puffs for
  fire, smoke and dust. Small debris uses `sparks()`, pooled particles stretched along their velocity.
- **Colour carries meaning.** Blade colour for saber and Force effects (`stance().blade`), green for healing and
  Judgement, gold for parries and ripostes, orange for explosives, blue-white for the jetpack and disruptor.

## Building blocks (`src/fx/ink.js`)

| Call | Use |
|---|---|
| `inkSprite(opts)` | One pooled sprite: `shape` disc / star / ring / puff, size over life, velocity, stepped fade, colour ramp, flat (`normal`) or camera-facing |
| `sparks(pos, color, n, speed, opts)` | Streak sparks (pooled particles) |
| `muzzleFlash(pos, dir, color, size)` | Two-frame star + barrel spike |
| `hitSpark` / `boltImpact` / `clashFlash` | Blade hits, bolt hits, parries and deflects |
| `groundRing(pos, color, r, dur, op)` | Flat shock front along the floor |
| `puff(pos, color, size, life, vel, opts)` | Toon fire / smoke / dust ball (pass `ramp` for fire) |
| `explosion(pos, radius, big)` | Rockets, missile, detonator, whistling birds |
| `dustRing`, `motes`, `thrust`, `jetIgnite` | Landings, healing, jetpack exhaust and ignition |
| `barrierMaterial` / `bindBarrier` | The Force Barrier shell |

`spawnHitSpark`, `spawnParryFlash`, `spawnGroundShock` and `spawnPushWave` in `src/fx/vfx.js` keep their old
signatures and now draw with the kit, so the boss, enemies and hazards pick up the new look for free.

## Performance rules

- Nothing allocates per effect: sprites (260) and particles (420) are fixed pools that recycle the oldest.
- Never add a `PointLight` at runtime (it recompiles every lit material). Use `flashLight()` from `src/fx/lights.js`,
  or keep one light in the scene and fade it (see the saber throw).
- Emit continuous effects (flamethrower, jetpack) by time, not per frame, so cost doesn't scale with frame rate.
- Effects never touch damage, hitboxes or timings; those stay in the ability code.
