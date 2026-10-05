# Credits

Every asset in the game, with its license. Mark anything made with AI tools: Steam asks about
AI-made content that players see.

Generals uses no outside art, sound, music or fonts (text uses the computer's own system font).
Since session 6B the art and sound are made for this project by an AI coding assistant (Claude
Code), working for the owner: it drew every sprite pixel by pixel, written as rows of
characters in the source code, and wrote every sound effect as a synthesizer recipe and every
piece of music as notes. No image, sound or music generation model was used, and nothing was
traced or copied from other work. All of it is marked AI-made below for Steam's disclosure.

| Asset | File | Made by | License | AI-made |
| --- | --- | --- | --- | --- |
| App icon (three gold chevrons on a dark square) | `desktop/icon.png` | Drawn from simple shapes by a script written for this project by an AI coding assistant | Original work, part of this project | Yes: its drawing script was written by an AI coding assistant |
| Troop sprites: five classes in both sides' colors, standing and walking frames, and the Engineer's turret | `src/game/art/troops.ts` | Pixel art written as text for this project by an AI coding assistant (Claude Code) | Original work, part of this project | Yes |
| The six Generals' portraits | `src/game/art/portraits.ts` | As above | Original work, part of this project | Yes |
| Scenery, arrows, bolts and particles (trees, pines, bushes, rocks, crystals, glass shards, grass, flowers, sparks, smoke, stones) | `src/game/art/props.ts` | As above | Original work, part of this project | Yes |
| Run map and world map icons (battle, elite, event, merchant, camp, boss; the regions and the Capital) | `src/game/art/icons.ts` | As above | Original work, part of this project | Yes |
| Map grounds and walls (each map's soil, laid stone, worn middle line; brick, palisade, rock and iron walls) | `src/game/art/ground.ts`, `src/game/draw.ts` | Drawn by code written for this project by an AI coding assistant | Original work, part of this project | Yes |
| Sound effects (blows, arrows, spells, cards, ultimates, menu clicks, fanfare, lament and the rest) | `src/game/audio/sounds.ts` | Synthesizer recipes written for this project by an AI coding assistant; played by the game's own synthesizer (`src/game/audio/audio.ts`) | Original work, part of this project | Yes |
| Music: the Capital's theme, the battle theme and the rulers' theme | `src/game/audio/music.ts` | Composed as notes for this project by an AI coding assistant; played by the game's own synthesizer | Original work, part of this project | Yes |
| Order reader weights | `models/order-reader.json` | Trained by `tools/reader/train.ts` from orders made by `tools/dataset/generate.ts`; no outside data | Original work, part of this project | A trained model, but players never see text it wrote: it only picks parts of a card |

To replace any of it with art or sound by a person, swap the drawing or recipe in its file (the
formats are explained at the top of each), check it with `npm run art:preview -- sheet.png`, and
update its line here.
