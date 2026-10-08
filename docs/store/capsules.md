# Capsule and library art checklist

The images Steam asks for, with their sizes as of the store's 2024 update (Steamworks >
Store Page Admin > Graphical Assets). Steam turned down the old, smaller sizes then, so
check that page's templates before drawing: the sizes and safe areas below should match it.

**House rules for every capsule:**

- Only the game's art and its name. Steam doesn't allow review quotes, awards, prices,
  "sale" or other words on capsules.
- The logo is the title as the game draws it: "Generals" in Jacquard 12, gold on a dark outline
  (`src/game/art/title.ts` draws the title screen it comes from).
- Pixel art scaled by whole numbers only (2×, 3×, 4×...) with nearest-neighbour scaling, so
  the pixels stay square and sharp.
- The look: warm dark plum and gold, the battlefield's greens, blue for your army and red for
  the enemy. A General's portrait and a clash of troops say what the game is at a glance.
- Whoever makes them (a person, or an AI tool) is listed in `docs/CREDITS.md`, marked if
  AI-made: Steam's AI disclosure covers marketing art too.

## Store capsules

| Image | Size (px) | Required | What to draw |
| --- | --- | --- | --- |
| Header capsule | 920 × 430 | Yes | The logo over a battle in full swing: blue army left, red right, a card's gold glow. Readable at small sizes: big logo, few elements |
| Small capsule | 462 × 174 | Yes | The logo almost alone, on a strip of battlefield. Steam shrinks it to 120 × 45, so the logo fills most of it |
| Main capsule | 1232 × 706 | Yes | The front page's big image: the Captain's portrait large on one side, the armies clashing, the logo. More detail than the header |
| Vertical capsule | 748 × 896 | Yes | For seasonal sales: the Captain and a ruler (the Warlord) facing each other, logo at the top |
| Page background | 1438 × 810 | No | A dim, low-contrast field of grass and walls behind the store page; Steam darkens it further |

## Library

| Image | Size (px) | Required | What to draw |
| --- | --- | --- | --- |
| Library capsule | 600 × 900 | Yes | The game's box in the player's library: like the vertical capsule, with the logo |
| Library header | 920 × 430 | Yes | Same as the store header capsule, or a crop of it |
| Library hero | 3840 × 1240 | Yes | A wide battlefield with **no text and no logo** (the logo is laid on top). Keep the important part in the middle |
| Library logo | 1280 wide and/or 720 tall | Yes | The logo alone, transparent PNG. Steam places it over the hero |

## Other images

| Image | Size (px) | Where | Notes |
| --- | --- | --- | --- |
| Community icon | 184 × 184 | Steamworks > Community | Square: the three gold chevrons of the app icon (`desktop/icon.png`) |
| Client icon | .ico, 32 × 32 inside | Installation > Client Images | From `desktop/icon.png` |
| Achievement icons | 256 × 256 | Stats & Achievements | Made by `npm run art:achievements`; see `steam/achievements.md` |
| Screenshots | 1920 × 1080 or larger | Store Page Admin > Screenshots | At least 5; see `screenshots.md` |

## Done when

- [ ] Header, small, main and vertical capsules
- [ ] Library capsule, header, hero and logo
- [ ] Page background (optional)
- [ ] Community and client icons
- [ ] Achievement icons uploaded
- [ ] Each image's maker listed in `docs/CREDITS.md`
