# Screenshot list

Steam wants at least five screenshots of the game itself (no menus-only shots, no mock-ups).
The first four show in search and on hover, so they carry the pitch.

## The quick way: a script

`npm run build`, then `npm run store:shots` (session 7H). It opens the built game in Chromium at
1920 × 1080 with the Captain's tips off, sets up each scene from a save made for it, and writes the
shots to `store-shots/`: the skirmish screen, the orders, a few battle moments (clashes, signature
combos, ultimates), the result, the Capital, a run map, Versus, a ruler's fight, a crossroads and
the road on past the last ruler. Battle moments come as several candidates: keep the best. The game
sits centered with the game's own plum (#15111a) at its sides, ready for Steam.

Chromium comes from `npx playwright install chromium` (once), or set `CHROMIUM_PATH` to a Chrome
or Chromium you have. The shots come from the browser build, which looks the same as the desktop
app.

## By hand

The game is drawn at 960 × 704 and scaled up. For screenshots, draw it at twice that:

1. In the desktop app, open Settings, set the **window size** to the largest (or fullscreen on a
   1440p or 4K screen) and **Resolution** to its sharpest; or in Chrome, press F11 for fullscreen.
2. Take the screenshot with Steam (F12) or Windows (Win + Shift + S, or Win + PrtScn).
3. The game's shape is 15 : 11, not 16 : 9. Steam shows other shapes, but crops them in some
   places: put each shot centered on a 1920 × 1080 canvas of the game's dark plum (#15111a), or
   crop to 16 : 9 where the edges hold nothing important.

Turn the Captain's tips off in Settings first, unless a tip is the point of the shot.

## The list, in order

| # | Screen | What it must show |
| --- | --- | --- |
| 1 | Battle | A big moment: a signature combo banner ("FEIGNED RETREAT!") over a clash of both armies, a chain counter (CHAIN x3) and a gold-glowing card in the slot bar |
| 2 | Orders | An order typed in plain English and the card it became, with the General's reply ("The Warlord: …") and the General's version of the card |
| 3 | Battle | A ruler's fight: the boss banner (for example "BOSS: THE WARLORD" with its rule), troops with effects on them (Rifts, barriers, marks) |
| 4 | Capital | The world map with its five regions, one cleared, your run marked, the region panel |
| 5 | Run map | A run's path of battles, elites, events, a merchant, camps and crossroads, with your army, boons and decree |
| 6 | Battle | The ultimate firing: the screen flash and the ultimate's name, Momentum full |
| 7 | Result | Victory with the Battle IQ report: grade, biggest mistake, best decision |
| 8 | Prep | Placing troops on a region map (Deep Forest's woods or Iron Fortress's walls), reserves and synergies below |
| 9 | Versus | A versus battle, or the lobby with its room code |
| 10 | Crossroads | A won crossroads: two deals side by side, each a gain and a cost (session 7F) |
| 11 | The road on | Past the last ruler: "The Road Goes On", or a lap cleared with its score (session 7G) |
| 12 | Steam Deck | The game on a Steam Deck, held in hands (a photo is allowed as one of the later shots) |

## Done when

- [ ] At least 5 shots, 1920 × 1080 or larger, from the current build
- [ ] The first four are 1 to 4 above
- [ ] No debug text, no browser bars or desktop
