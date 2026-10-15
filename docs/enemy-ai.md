# Enemy AI

How grounded enemies find their way to the hero, and the knobs to tune it. Combat timing (wind-ups, swings, attack
tokens) is unchanged by this and lives in `src/data/enemies.js` (`ENEMY_TYPES`, `ENGAGE`).

![Before and after: enemy paths in Jedha, Mustafar and Exegol](enemy-ai/pathing-before-after.jpg)

## Pathing

| File | Holds |
|---|---|
| `src/enemies/nav.js` | The nav grid and flow field. `buildNav()` runs after every arena build; `updateNav()` refreshes the field toward the hero; `navSteer()` gives a foe its heading. |
| `src/enemies/ai.js` | `updateEnemies()`: uses `navSteer()` in the chase, the fuse rush, the ranged flank, and the stuck check. |
| `src/enemies/director.js` | Hands melee attack tokens to the foes closest by **walking** distance. |

- The grid is 0.6 units a cell. Each cell stores its clearance to the nearest real solid; climbable steps don't count,
  so foes still walk up the Jedha dais and the catwalks.
- Two body sizes path separately: troopers need 0.62 of clearance, brutes and other big bodies (radius above 0.85)
  need 0.95. Keep cover gaps wide enough for a brute (see `world-guidelines.md`).
- A foe walks straight at the hero whenever that line is open. Only when cover or a live hazard is in the way does it
  follow the field, aiming at the farthest point down it that it can reach in a straight line.
- Hazard zones and vents cost extra from just before their warning until they stop firing, so foes walk around a lava
  surge. They are never walls: a foe still crosses when there's no other way, and Push and kicks still throw them in.
- The flow field ignores flyers (jet troopers) and mind-tricked allies; they steer as before.

## Behaviours

- **Stuck check:** a chasing foe that covers less than a third of the ground it tried to in half a second sidesteps
  toward the more open side for 0.6s, then re-routes.
- **No swings through walls:** a melee foe won't wind up on the far side of cover taller than 1.3; it keeps walking
  around. Low cover can still be struck over.
- **Ranged troopers:** out of range they advance along the field. In range with no shot they hide behind cover and
  peek; after 3s they flank for 4s to find a clear shot instead of firing into the wall.

## Checking it

`window.GAME.nav` exposes the grid (`NAV`), `navSteer` and `navDist` in the dev console. `NAV.dist[0]` is the
trooper field and `NAV.dist[1]` the big-body field: walking distance to the hero per cell, row by row from −half.
