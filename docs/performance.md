# Performance

How smoothly the game runs, measured with `npm run perf` (session 7H): the built game at Steam Deck
size (1280 × 800), a skirmish at double speed with cards and the ultimate fired as it goes, every
frame's time recorded for 30 seconds. Run it again after big changes to the battle screen.

```
npm run build
npm run perf -- [--seconds 30] [--width 1280] [--height 800] [--cpu]
```

`--cpu` adds the functions that took the most time. The browser in the script draws with software
WebGL (no GPU), so its frame rate is far below a real machine's; the **script time** is the part the
game's own code decides, and the part to watch.

## Session 7H (Chromium, software WebGL, 4 cores)

| | Before | After |
| --- | --- | --- |
| Script time a frame | 3.5 ms (5.5% of the time) | 3.1 ms (4.7%) |
| Memory in use | 25 MB | 21 MB |
| Shaders built during play | 13 (11 in the menus, 2 mid-battle), up to 90 ms each | none |
| Time to the title screen | 0.5–0.7 s | 1.2 s |

The frame rate in the script was 15–16 per second either way, all of it software drawing: the
game's code takes about 3 ms of the 16.7 ms a frame has at 60 frames per second, which leaves a
Steam Deck's GPU the rest.

What was fixed:

- **Shaders built in the middle of a battle.** Phaser builds the shader for a batch of sprites to
  fit the number of textures in it, the first time each number comes up; damage numbers bring new
  textures, so new shaders were built mid-fight, each one a stalled frame. The Boot screen now
  draws a batch of every size once, out of sight (`src/game/shaderWarmup.ts`), so all of them are
  ready before the title. It costs about half a second at start with software drawing, much less
  on a GPU.
- **The ultimate's label drawn twice a frame.** The label that says what the ultimate waits for is
  measured once to see if it fits its panel, instead of every frame.

Nothing else stood out: no function of the game's own took more than a fraction of a percent of
the time.
