// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
export default {
  title: "Steadier frames in big fights",
  status: "done",
  date: "2026-01-01", seq: 73,
  items: [
    "Enemy pathfinding only maps the ground as far as the foes actually are, instead of the whole arena several times a second: up close in a duel it costs a sliver of what it did",
    "The heroes' robes and capes no longer throw off a stream of garbage every frame (about two thirds of all the game made), so the browser stops pausing mid-fight to clean it up",
    "Enemy and boss models are never built in the middle of a fight: whatever the menus didn't get to is finished during the load",
    "The battle music builds its big chords a note at a time, so the top of each bar no longer stalls a frame in boss fights",
    "Every mode: story, missions, training, survival, sandbox and co-op",
  ],
};
