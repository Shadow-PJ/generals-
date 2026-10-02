# Generals

A 2D top-down strategy game. Armies fight on their own; before a battle you write orders in plain language, your General turns them into Command cards, and during the battle you fire them with keys 1 to 5 and finish with your ultimate on U.

- `docs/DESIGN.md`: the game design, the source of truth for rules and numbers
- `docs/PLAN.md`: the build plan, one session at a time
- `CLAUDE.md`: how the code is organized and the rules it must never break

## Play it

In the browser: https://shadow-pj.github.io/generals-/ (updated on every merge to `main`).

On Windows: every merge to `main` builds an installer. Open the repository's **Actions** tab, pick the latest **Windows installer** run, and download **Generals-Windows-installer** under Artifacts. Unzip it and run `Generals-Setup-<version>.exe`. Windows shows an "unrecognized app" warning because test builds aren't signed yet: choose **More info**, then **Run anyway**. Your cards are saved in `%APPDATA%\Generals\saves`.

Place your troops and press Enter. Write your orders: type them in plain English or build them from the menus, and save them to your card slots. Press B to start the battle, then fire your cards with keys 1 to 5 (a card with a condition glows when its moment comes: press it then for a Perfect timing) and your ultimate with U once the Momentum bar is full. Space pauses and F switches between 1x and 2x speed. Your cards and troop positions are saved as you change them.

On the troop screen, Esc opens Settings: fullscreen or windowed, window size, and resolution. F11 switches fullscreen on any screen.

## Running it

Needs Node 22.12 or newer.

```sh
npm install
npm run dev                 # local dev server
npm test                    # all tests
npm run build               # type check and production build
npm run sim -- --seed 42    # run one battle headless and print the result (add --verbose for skill uses)
npm run desktop             # build and open the desktop app (Electron)
npm run desktop:installer   # build the Windows installer into release/ (run it on Windows)
```

The desktop app lives in `desktop/`: `main.ts` opens the window and serves the same game build as the browser version, and `preload.cts` gives the game its few requests (files, fullscreen, window size). Game code reaches them only through `src/platform`.
