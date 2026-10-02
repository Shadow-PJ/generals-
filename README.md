# Generals

A 2D top-down strategy game. Armies fight on their own; before a battle you write orders in plain language, your General turns them into Command cards, and during the battle you fire them with keys 1 to 5 and finish with your ultimate on U.

- `docs/DESIGN.md`: the game design, the source of truth for rules and numbers
- `docs/PLAN.md`: the build plan, one session at a time
- `CLAUDE.md`: how the code is organized and the rules it must never break

## Running it

Needs Node 22.12 or newer.

```sh
npm install
npm run dev                 # local dev server
npm test                    # all tests
npm run build               # type check and production build
npm run sim -- --seed 42    # run one battle headless and print the result (add --verbose for skill uses)
```
