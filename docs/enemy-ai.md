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

## Duelling

Sword-armed foes with a profile in `DUEL_PROFILES` (`src/data/duel.js`) fight like duellists. The code is
`src/enemies/duel.js`; `ai.js` calls into it when a foe commits to a swing, every wind-up and strike frame, and once a
frame per living duellist.

- **Guard:** a duellist covers one line (left, right or high from the hero's view) and holds its weapon there. Magnaguards
  and Sith acolytes also show a pale arc on that side. A cut on the covered line is turned at the profile's `block`
  chance, other lines at a fraction of it (`DUEL.offLine`). The line a cut comes in on is where its swing starts
  (`cutLine()`): D starts on the left, A on the right, W and finishers come down high.
- **Reading you:** the same line twice in a row and the guard locks onto it (amber arc, `READ YOU`) until you change it.
- **Posture:** each turned blow adds strain (more for finishers and Djem So, a lot for a kick or a jet charge). Past the
  profile's `posture` the guard breaks: the foe staggers, wide open. Posture drains back when left alone.
- **Offence:** each swing is planned when it starts: its line (shown by the wind-up pose), whether it is a feint (it
  switches side at `DUEL.feintAt` and comes in fast, so a reflex parry whiffs), a held strike (waits at the apex), a
  thrust (white tell; a held block can't stop it, parry or dodge), and how many cuts follow in the string.
- **Counter:** a foe that turns a blow may answer at once, outside the attack-token queue.
- **Saber lock:** your cut meeting a duellist's strike mid-arc binds the blades (`LOCK`). Mash LMB to drive through, or
  break it with a kick (stamina) or a Force push (Force). Win and the foe reels with your riposte ready; lose and its
  blade gets through.
- **Bolts:** acolytes bat blaster fire back at the shooter from the front.

`window.GAME.duel` exposes the tables and the lock in the dev console.

## Hitboxes

Every attack that touches a foe tests the same body: `src/enemies/hitbox.js`, with each model's shape in
`src/data/hitbox.js` (legs, torso with the arms, head), measured off the models. The shapes live in the model's own
space, so they turn, scale (elites too) and tip over with it.

- Blaster bolts, rockets, whistling birds and detonators sweep their whole step each frame, so a fast shot can't pass
  through a body, and they hit the first body along their path. Only the head band is a headshot.
- The Mandalorian's crosshair converges on the body it's over, using the same shape.
- Blasts measure to the nearest point of the body, not the feet. Cones and rings (Force push, pull, slam, repulse,
  judgement, the flamethrower, the darksaber slash, the spear) reach any part of the body inside them.
- The saber blade tests the points it sweeps through against the same shape.

Open the game with `?hitbox` in the URL to draw every foe's hitbox as a wireframe (yellow = head).

## Checking it

`window.GAME.nav` exposes the grid (`NAV`), `navSteer` and `navDist` in the dev console. `NAV.dist[0]` is the
trooper field and `NAV.dist[1]` the big-body field: walking distance to the hero per cell, row by row from −half.
