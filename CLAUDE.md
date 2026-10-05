# Generals

A 2D top-down strategy game. Armies fight on their own. Before a battle the player writes orders in plain language; their General turns each order into a Command card. During the battle the player fires cards with keys 1 to 5, chains them into combos, and fires the ultimate with U.

It ships as a Windows desktop game (Electron) on Steam first, then the Epic Games Store, with controller and Steam Deck support. A browser build on GitHub Pages is the quick test build.

- `docs/DESIGN.md`: the full game design. It is the source of truth for rules and numbers.
- `docs/PLAN.md`: the build plan, split into sessions (1A, 1B, 2A ...), each with a checklist.

## Tech stack

- TypeScript (strict), Vite, Phaser (latest stable), Vitest
- Electron for the desktop app (from session 2C), packaged as a Windows installer
- No backend until session 6D, which adds a small relay server for multiplayer
- No paid AI API at runtime, ever. Plain-language orders go through the rule parser or a small model that runs on the player's computer (phase 3). The desktop app ships the model inside it; the browser build downloads it on first use.

## Commands

- `npm run dev`: local dev server
- `npm run build`: production build
- `npm test`: all tests
- `npm run sim -- --seed 42`: run one battle headless and print the result

## Folders

```
src/sim/     battle engine: pure logic, no Phaser, no DOM, no clock
src/cards/   card format, rule parser, validator, personality rules, translator
src/campaign/  world map and roguelite runs: run maps, enemies, spoils, merchant, events (5B);
               pure and seeded like src/sim
src/game/    Phaser scenes and UI; reads sim state and sends player inputs
src/data/    every number and table: units, ranks, Generals, combos, maps, reply lines
src/save/    save format and migrations (phase 5)
src/platform/  everything that differs per build: saves, settings, files, model loading,
               networking, achievements and other store features; browser and desktop versions
desktop/     Electron main process and packaging (session 2C)
server/      multiplayer relay server (session 6D)
tools/       headless sim, dataset generator, model eval, balance scripts
models/      small model files (phase 3)
docs/        DESIGN.md, PLAN.md, CREDITS.md, store/ (store kit, phase 7)
```

Create folders only when a session needs them.

## Rules that must never break

1. **The battle engine is deterministic.** The same seed and the same input log always give the same battle.
   - Fixed tick of 20 per second. Time is counted in ticks, never read from a clock.
   - All randomness comes from the seeded generator in `src/sim`. No `Math.random`, no `Date.now`, no `performance.now` in `src/sim`.
   - In `src/sim`, use only basic arithmetic plus `Math.sqrt`, `Math.floor`, `Math.round`, `Math.abs`, `Math.min` and `Math.max`. No `Math.sin`, `Math.cos`, `Math.atan2`, `Math.pow`, `Math.exp` or `Math.log`: their results can differ between browsers and would break replays and multiplayer sync.
   - Iterate units in a stable order (by id), never in an order that depends on timing.
2. **`src/sim` never imports Phaser or anything from `src/game`.** The renderer only reads sim state; it never changes it. Player inputs reach the sim as events stamped with a tick.
3. **Every gameplay number lives in `src/data`**, never hard-coded in logic. Balance changes should only touch data files.
4. **Orders pass through the pipeline in this order:** translator, then validator, then personality rules.
   - The translator turns words into a card literally. It never improves, adds to or "fixes" an order.
   - The validator always runs and is the only gate for rank rules: unlocked actions, steps per card, kind of condition, cost against max pips.
   - Personality rules edit the card after validation. Steps a General adds do not count against the step limit and may use any action, but they still cost pips.
5. **Cards are plain data**, serializable to JSON, so they can be saved, replayed and sent over the network.
6. **Every battle writes an event log** (damage, deaths, cards fired, combos, ultimates) with ticks. Combos and Battle IQ read from it.
7. **Game code never talks to Electron, Steam, Epic, the file system or the network directly**, only through `src/platform`. Every build (browser, desktop, Steam, Epic) must keep working after every session, and the game must still run when Steam or Epic is not there.
8. **Keyboard and controller share one input layer** with the same actions, and every screen must be usable without a mouse (fully from session 6C; don't build anything before then that blocks it).

## Code style

- Small modules with clear names. Pure functions in `src/sim` and `src/cards` wherever possible.
- Tests sit next to the code as `*.test.ts`. Every rule in `docs/DESIGN.md` that is built gets at least one test.
- No new dependency without a one-line reason in the pull request.
- Art is pixel art written as text in `src/game/art`, and sound is synthesizer recipes and notes in `src/game/audio` (since session 6B); check art with `npm run art:preview`.
- Assets: only original work or assets whose license allows use in a game, each listed with its license in `docs/CREDITS.md`. Mark any asset made with AI there too; Steam asks about AI-made content players see.

## How to work a session

1. Read this file, `docs/DESIGN.md` and the session's checklist in `docs/PLAN.md`.
2. Do only the session you were asked to do. Note ideas for later sessions in the pull request instead of building them.
3. If the design is unclear, pick the simplest reading that fits `docs/DESIGN.md`, follow it, and list it under open questions.
4. If the code needs a design change, update `docs/DESIGN.md` in the same pull request and say why.

## Finishing a session

1. `npm test` and `npm run build` both pass.
2. Tick the finished items in `docs/PLAN.md`. Leave unfinished items unticked and say why.
3. Commit on a branch named after the session, for example `session-1a`.
4. Open a pull request titled `Session 1A: <session name>` with these sections:
   - **What I built**
   - **How to try it**: commands, or what to click in the game
   - **Tests**: what is covered
   - **Open questions**: decisions the owner should make
   - **Notes for later sessions**

## Deployment

- GitHub Actions runs tests and the build on every pull request, and deploys to GitHub Pages on every merge to `main` (set up in session 1B).
- Vite's `base` must be `/<repo name>/` for the GitHub Pages build; the desktop build loads files locally, so it may need a different base.
- From session 2C, GitHub Actions also builds the Windows installer on every merge and attaches it to the run as a download.
