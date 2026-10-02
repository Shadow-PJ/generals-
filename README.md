# Generals

A 2D top-down strategy game. Armies fight on their own; before a battle you write orders in plain language, your General turns them into Command cards, and during the battle you fire them with keys 1 to 5 and finish with your ultimate on U.

- `docs/DESIGN.md`: the game design, the source of truth for rules and numbers
- `docs/PLAN.md`: the build plan, one session at a time
- `CLAUDE.md`: how the code is organized and the rules it must never break

## Play it

In the browser: https://shadow-pj.github.io/generals-/ (updated on every merge to `main`).

On Windows: every merge to `main` builds an installer. Open the repository's **Actions** tab, pick the latest **Windows installer** run, and download **Generals-Windows-installer** under Artifacts. Unzip it and run `Generals-Setup-<version>.exe`. Windows shows an "unrecognized app" warning because test builds aren't signed yet: choose **More info**, then **Run anyway**. Your cards are saved in `%APPDATA%\Generals\saves`.

Place your troops and press Enter. Write your orders: type them in plain English or build them from the menus, and save them to your card slots. Press B to start the battle, then fire your cards with keys 1 to 5 (a card with a condition glows when its moment comes: press it then for a Perfect timing) and your ultimate with U once the Momentum bar is full. Space pauses and F switches between 1x and 2x speed. Your cards and troop positions are saved as you change them.

From Rank III, cards fired within 3 seconds of each other chain: each link costs a pip less and earns double Momentum, and certain steps in a row (Fall Back, then Focus; Protect, then Hold; ...) land a signature combo, in one card or across a chain. From Rank IV, the ultimate at the end of a chain of 3 is a Finisher. Combos you land fill in the Combo Codex (C on the troop screen).

Your General reads every card in their own way: the Warlord turns retreats into counter-attacks, the Engineer adds a Hold before every Move, the Hive Mother keeps orders short and simple, the Strategist suggests a better moment, and the Conductor reorders steps into combos. Until you can recruit them, pick one with the General (debug) switch at the top of the orders screen.

You can also speak an order: on the orders screen, hold V (or the Talk button), say it, and let go. This uses your browser's speech recognition, so it works in Chrome, Edge and Safari but not Firefox, nor yet in the desktop app; typing always works. Orders are read by a rule parser, and what it can't read by the order reader, a small model trained for this game that runs on your computer, at once and offline (`docs/model-eval-3c.md`). It reads slang, typos and long orders, and says so when it isn't sure rather than guess. On the troop screen, Esc opens Settings: fullscreen or windowed, window size, resolution, and order reading, where you can also switch on an experimental language model for what the other two can't read (it downloads once, about 400 MB, and is slow). F11 switches fullscreen on any screen.

## Running it

Needs Node 22.12 or newer.

```sh
npm install
npm run dev                 # local dev server
npm test                    # all tests
npm run build               # type check and production build
npm run sim -- --seed 42    # run one battle headless and print the result (add --verbose for skill uses)
npm run dataset             # write 5,000 generated sentence and card pairs to tools/dataset/out/
npm run eval                # parser and order reader accuracy on the held-out orders, with every failure
npm run eval -- --set fresh # the same on fresh.txt, orders written before the reader existed
npm run train:reader        # train the order reader from generated orders into models/order-reader.json
npx tsx tools/eval/model/run.ts --model qwen2.5-0.5b --isolated   # the experimental language model, in headless Chromium
npm run desktop             # build and open the desktop app (Electron)
npm run desktop:installer   # build the Windows installer into release/ (run it on Windows)
```

The desktop app lives in `desktop/`: `main.ts` opens the window and serves the same game build as the browser version, and `preload.cts` gives the game its few requests (files, fullscreen, window size). Game code reaches them only through `src/platform`.
