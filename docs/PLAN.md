# Build plan

Seven phases, 24 sessions. Each session ends with a pull request that the owner play-tests and merges before the next one starts. Tick items here as they are finished; "Owner checks" and the owner's release checklist are for the owner, not for Claude.

| Phase | Sessions | Playable after it |
| --- | --- | --- |
| 1. Battle core | 1A, 1B | Troops fight on their own in the browser |
| 2. Command Slots and desktop | 2A to 2C | Write cards, fire them and win battles, in the browser or as a Windows app; no AI needed |
| 3. Personalities and the small model | 3A to 3D | Generals read orders their way; plain-language and voice orders |
| 4. Combos and content | 4A to 4D | Every General, class, combo and map in skirmish mode |
| 5. Progression and campaign | 5A to 5F | The full campaign from Squad Leader to Legend, as roguelite runs |
| 6. Polish and multiplayer | 6A to 6D | Real art and sound, balance, controller and Steam Deck play, battles against friends |
| 7. Release | 7A to 7G | Generals on Steam, then on the Epic Games Store |

## Phase 1: Battle core

Goal: troops fight on their own, the same way every time for the same seed, and you can watch it in the browser.

### 1A. Project and battle engine

- [x] Vite, TypeScript and Phaser (latest stable) project with Vitest; npm scripts `dev`, `build`, `test` and `sim`
- [x] Folders as in `CLAUDE.md`: `src/sim` (pure battle logic), `src/game` (Phaser screens), `src/data` (all numbers)
- [x] Battle engine with a fixed tick of 20 per second and seeded random numbers; no clock
- [x] Unit stats from data: HP, armor, damage, attack speed, range, move speed
- [x] Movement and targeting; walls block movement
- [x] Vanguard (Shove), Ranger (Mark) and Guardian (Barrier) with their behaviors and weaknesses
- [x] A battle ends when one army is gone, or after 3 minutes by remaining HP
- [x] Headless runner: `npm run sim -- --seed 42` prints the winner and a short log
- [x] Determinism test: the same seed and inputs always give the same result
- [x] Walls also stop shots like a shield and break when worn down (owner decision on the 1A pull request)
- [x] Overtime from 2:20 so stalled battles end; class numbers rebalanced so mixed armies beat single-class ones

Done when: tests pass and a full battle runs in the terminal.

### 1B. Watchable battle

- [x] Phaser renderer draws the battle each frame with simple shapes, HP bars and projectiles
- [x] One open-field map with a few walls
- [x] Prep screen: place 5 troops on your half; the enemy army is preset
- [x] Speed controls: pause, 1x, 2x
- [x] Win or loss screen with a rematch button
- [x] GitHub Actions: tests and build on every pull request; deploy to GitHub Pages on every merge to main

Done when: a battle is playable at the GitHub Pages link.

Owner checks: Vanguards hold the front, Rangers keep their distance, Guardians shield the hurt ally, and a battle lasts 1 to 3 minutes.

## Phase 2: Command Slots

Goal: you write cards before battle and fire them during it. The game is fully playable here, with no AI.

### 2A. Cards and the card builder

- [x] Card format: optional condition, steps, targets, cost, Auto or manual; combined ("when X and Y") and repeating ("every time") conditions supported from the start, gated by rank
- [x] Actions: Focus, Move, Fall Back, Overcharge, Protect, Hold, Call Reserve
- [x] Conditions: an enemy class reaches your backline; an ally drops below a set HP; 3 or more enemies close together; the enemy ultimate is charging
- [x] Card builder screen: pick the condition, steps and targets from menus
- [x] Rule parser for simple English orders, tested on 50 or more example sentences
- [x] Validator that reads a rank rules table from `src/data` (rank set by a debug switch for now)
- [x] Rejected cards show the General's "not trained yet" line

Done when: parser and validator tests pass, and cards save to slots.

### 2B. Cards in battle

- [x] Slot bar: keys 1 to 4, key 5 for the Legendary slot (locked for now), U for the ultimate
- [x] Slots glow when their condition is met and rest 8 s after firing
- [x] Command pips: start at 2, +1 every 6 s, max set by rank, double refill after losing half your troops
- [x] Perfect timing: a manual card fired during its glow gets +25% effect and 1 pip back
- [x] Momentum bar and the Captain's ultimate, Rally
- [x] 3 reserve troops and Call Reserve
- [x] Threat Readout warnings over units
- [x] Tactical mode setting that pauses every 10 s
- [x] Every key press is logged by tick, so a seed plus its input log replays the same battle

Done when: you can win a battle with cards, and the replay test passes.

Owner checks: firing cards feels good, and a pip every 6 s is neither too slow nor too fast.

### 2C. Desktop build

- [x] Electron app in `desktop/` that runs the same game build
- [x] A `src/platform` layer: saves, settings and files go through it, with a browser version and a desktop version
- [x] Saves as files in the player's app data folder, ready for Steam Cloud
- [x] Fullscreen and windowed modes, resolution scaling and a basic settings screen
- [x] GitHub Actions builds a Windows installer on every merge and attaches it to the run as a download
- [x] The browser build keeps deploying to GitHub Pages

Done when: the game installs and plays on Windows.

Owner checks: install it, play a battle, close and reopen it, and the cards are still there. An "unrecognized app" warning from Windows is expected for an unsigned test build.

## Phase 3: Personalities and the small model

Goal: Generals read orders their own way, and players can type or speak orders in plain language without a paid API.

### 3A. Personality rules

- [x] Rules engine that edits finished cards, with the rules for all 6 Generals from the design
- [x] Steps a General adds skip the step limit but cost pips
- [x] At least 3 reply lines per rule per General, in a data file
- [x] The card screen shows the General's version and reply; rephrasing is free
- [x] A debug switch to pick the General before battle

Done when: tests cover every rule.

### 3B. Translator and model test

- [x] Translator interface: parser or model, same card output, validator always after it
- [x] Dataset generator script that combines actions, targets and conditions into sentence and card pairs
- [x] 1,000 or more natural sentences written by Claude, including slang, typos and long orders
- [x] A held-out test set and an eval script that prints accuracy and every failure
- [x] Try an existing small open model running on the player's computer, in both the browser and desktop builds, with its output forced into the card format; report accuracy, speed and download size
- [x] Parser fallback when the model is missing or too slow

Done when: the pull request includes the eval report and a recommendation: keep this model, fine-tune it, or switch to an intent-and-slots model.

Owner checks: read the report and decide whether 3C is needed.

### 3C. Intent-and-slots reader (replaces the fine-tune, owner decision on the 3B report)

- [x] The dataset generator labels every word with its part of the card (condition, step, troops, action, target) and adds slang, fillers and typos
- [x] A small model written in TypeScript, trained by a script on the generated data: word taggers and slot classifiers, with its weights in `models/`
- [x] The reader assembles the tags and slots into a card literally, and refuses ("I didn't catch that") when it is unsure; the validator runs after it as always
- [x] Translator order in the game: rule parser, then the reader, then the experimental model if it is switched on
- [x] The eval from 3B runs again, with before and after numbers: exact cards, wrong cards, speed and size

Done when: the reader is fast (under 10 ms per order) and small (under 5 MB), it makes few wrong cards, and the eval report says how many of the held-out free-form orders it reads.

Owner checks: type some orders the rule parser can't read on the Orders screen and see what the reader makes of them.

### 3D. Voice input

- [x] Push-to-talk on the card screen using the browser's speech recognition
- [x] Typing still works when the browser has no speech support

## Phase 4: Combos and content

Goal: everything that happens inside one battle, playable in a skirmish mode.

### 4A. Combos

- [x] Chains: a 3 s window, 1 pip off per link (minimum 1), double Momentum, a chain counter on screen
- [x] The 5 signature combos, working across a chain and inside one card
- [x] Finishers: the ultimate as the last link of a 3+ chain gets +50% power
- [x] Combo Codex screen that fills in as combos are found
- [x] Combo events written to the battle event log, for Battle IQ later

### 4B. Invoker, Assassin and specializations

- [x] Invoker (Rift) and Assassin (Shadowstep) with their behaviors and weaknesses
- [x] Two specializations for each of the 5 classes, chosen in a debug menu for now
- [x] The 5 troop synergies, switched on automatically by the army you bring

### 4C. The 5 Generals

- [x] Warlord, Engineer, Hive Mother, Strategist and Conductor, each with troop skill, doctrine, ultimate and mana twist
- [x] General select screen

Owner checks: each General feels different in a skirmish.

### 4D. Maps, enemy commanders and skirmish

- [x] The 5 region maps with their terrain rules: forest hiding, ruins sightlines, canyon paths, fortress gates, open plains
- [x] Enemy commanders that fire their own cards from simple scripts
- [x] Skirmish mode: any General and army against any other, on any map

Owner checks: play every General on every map at least once.

## Phase 5: Progression and campaign

Goal: the full journey from Squad Leader to Legend.

### 5A. Saves, ranks and Legendary orders

- [x] Save system in the browser with a version number, so old saves still load after updates
- [x] Command XP and Ranks I to V; the validator uses the player's real rank
- [x] The Legendary slot, unlocked by the first boss win, and the 5 Legendary actions

### 5B. World map and runs

- [x] The Capital hub and the 5 regions, in their unlock order
- [x] Run maps made from a seed: battles, elite fights, events, a merchant, rest camps and the boss, with enemies that grow stronger along the path
- [x] Spoils after each won fight: gold, and a pick of 1 of 3 offers (fighters and boons) rolled by rarity
- [x] The run roster: picked fighters join it; choose 5 to field and 3 reserves before each fight
- [x] The merchant (fighters, boons, healing, rerolls) and rest camps
- [x] Artifacts kept at a camp or on a win, lost on a defeat
- [x] 10 hard-choice events
- [x] Only campaign battles earn Command XP; skirmish becomes practice

Owner checks: set out from the Capital, play a run to its ruler, and lose one on purpose.

### 5C. Fighters, factions and boons

- [x] Fighters: a class, a faction and a rarity (Common, Rare, Epic, Legendary), each rarity with its own chance to appear; rarer fighters have better stats and a perk
- [x] Faction bonuses at 2, 4 and 6 fighters of a faction, one per faction, in the spirit of its General
- [x] 30 boons by rarity: troop, Command and faction boons
- [x] Offer chances that shift toward rarer ones deeper in a run and after elite fights

Owner checks: build a run around one faction and feel it grow strong.

### 5D. Boss Generals

- [x] The 5 boss fights, each testing its idea from the design
- [x] Beating a boss recruits that General and teaches their Legendary action (the action and the next region came in 5B; 5D adds recruiting: you lead with the Captain and the rulers you have beaten)

### 5E. Growing your army

- [x] Tech Web for each class, paid with Insight, with free respec between runs
- [x] 10 artifacts, equipped on troops in the Capital (5B brought 5 to find, carry and bank, with no effect in battle yet)
- [x] Veterans: names, records, ranks, perks, wounded status and Ironman mode; fighters who finish a won run can stay as veterans
- [x] General Mastery challenges
- [x] Battle IQ report built from the battle event log

Done when: a new save can be played through the first region and its boss.

### 5F. Oaths, scouting and duo boons

Added after 6A at the owner's request: ideas from Hades II, Thronefall, Nordhold, 9 Kings, Skul and The King is Watching (`docs/inspiration.md`); the owner picked these three.

- [x] A look at the six games, why they work, and what Generals takes now and later (`docs/inspiration.md`)
- [x] Oaths of Command: vows for the next run, each adding Fear; Fear raises Insight, and a new highest Fear won in a region pays a bounty; an Oaths screen in the Capital
- [x] Scouting: every fight on a run's map is fixed when the map is made, and picking it shows its army
- [x] Duo boons: one for each pair of factions, offered once both factions' bonuses are on in your army
- [x] Save version 7 with the oaths and Fear records

Done when: a run can be set out under oaths, its fights scouted from the map, and a duo boon picked from the spoils.

## Phase 6: Polish and multiplayer

Goal: a balanced, good-looking game that plays well with a controller and against friends.

### 6A. Balance and tutorial

- [x] Balance script that runs thousands of headless battles per matchup and reports what wins too often
- [x] Number changes proposed in the pull request, not applied silently
- [x] A tutorial with the Captain for the first battles
- [x] The order reader learns Legendary orders: new generated training sentences, retrained, checked by the eval

### 6B. Art, sound and UI

- [x] Sprites and animations replacing the shapes, plus effects, sounds and music
- [x] Only original assets or ones whose license allows use in a game, each listed with its license in `docs/CREDITS.md`
- [x] Any asset made with AI marked as such in `docs/CREDITS.md`, for Steam's AI disclosure
- [x] UI polish and a settings screen

### 6C. Controller and Steam Deck

- [x] Full controller support: card slots and the ultimate on buttons, and every menu usable without a mouse
- [x] The card builder works with a controller alone; typed orders use the on-screen keyboard
- [x] Layouts and text readable at Steam Deck size (1280×800)
- [x] A Linux build of the desktop app, for Steam Deck

Done when: a whole battle, from writing cards to the result screen, can be played with a controller.

Owner checks: play a battle with a controller only.

### 6D. Multiplayer

- [x] Networking behind one interface in `src/platform`
- [x] A small relay server (Node and WebSockets) in `server/` with room codes, working in the browser and desktop builds, so Steam, Epic and browser players can play each other
- [x] Lockstep sync that sends only key presses by tick, which works because the battle engine is deterministic
- [x] Both players' cards are exchanged and validated before the battle starts
- [x] A desync check: both sides compare a hash of the battle state every few seconds
- [x] The Versus screens: host or join by code, the host's map and rank, secret setup, Ready, the guest's turned-around view, rematch and leaving

Owner checks: play a match against a friend, and choose where to host the server.

## Phase 7: Release

Goal: Generals on sale on Steam, then on the Epic Games Store.

Owner's release checklist (not for Claude to tick):

- Sign up for Steamworks: tax questionnaire, bank details and identity check (the tax review takes 10 to 15 business days)
- Pay the $100 Steam Direct fee; it is paid back once the game earns $1,000
- Put up the Coming Soon page as soon as phase 4 gives good screenshots. It must be live at least 2 weeks before launch; submit it for review about 7 business days ahead
- Release no sooner than 21 days after paying the fee; builds and store pages take 1 to 5 days to review
- Fill in Steam's AI disclosure with the draft from 7A
- For Epic: pay the $100 submission fee and submit after 7B

### 7A. Steam build and store kit

- [x] Steamworks integration through `src/platform`, with a maintained library such as steamworks.js: achievements, Steam Cloud for the save folder, rich presence and the overlay
- [x] An achievements list tied to ranks, bosses, combos and mastery
- [x] Build upload scripts for SteamPipe
- [x] A store kit in `docs/store/`: description, feature list, capsule art checklist, screenshot list and trailer shot list
- [x] A draft of the Steam AI disclosure in `docs/store/`: the live AI that ships (the small model turning orders into cards), its guardrails (fixed card format, validator, pre-written replies) and any AI-made assets from `docs/CREDITS.md`
- [x] Achievement icons drawn from the game's sprites (`npm run art:achievements`), and a manual workflow that builds the folders Steam takes

### 7B. Epic build

- [x] Epic Online Services through `src/platform`, for Epic achievements, which Epic requires
- [x] Cross-play with other PC stores, already covered by the relay server from 6D
- [x] Answers drafted for the age-rating questionnaire, which Epic also requires
- [x] Epic build upload steps written down in `docs/store/`

### 7C. Rating and privacy fixes

Added after 7B at the owner's request: the open items from the 7B pull request.

- [x] The Gamblers' Tent becomes the Quartermaster, an event with no bet, so the age rating has no simulated gambling; saved runs at the old event still load
- [x] Versus sends cards without the words typed for them, and the battle keeps none
- [x] The age-rating answers updated to match

### 7D. Decrees

Added after 7C at the owner's request: from `docs/inspiration.md`, "taking the beaten General's card" (9 Kings).

- [x] After an elite fight's spoils, the beaten commander's cards are offered, fitted to your rank: take one as the run's decree, or march on
- [x] The decree fires by itself in every battle of the run, in a slot of its own with no key, through the validator and your General's personality rules like any card
- [x] The decree shown in battle, on the run map and in the Battle IQ report
- [x] Save version 8 with the run's decree

### 7E. Quality and design pass

Added after 7D at the owner's request ("improve the quality and design of the game"), from a screen-by-screen review in the browser.

- [x] A layout check in development builds that reports words running into buttons, other words or the screen's edge on every screen, and every overlap it found fixed (the Capital's and the skirmish screen's headers)
- [x] The run's stops (spoils, decree, events, merchant, rest camp, the run's end) open on a pixel-art picture of the place in the region's colors, sized to the room the options leave
- [x] Damage numbers on one troop add up into a single number instead of piling into a blur
- [x] A new profile starts with two starter orders that help when pressed whenever ready, and the Orders tip quotes an order Rank I can give
- [x] The Orders screen's General line loses its "debug" label

### 7F. Two clear choices

Added after 7D at the owner's request: from `docs/inspiration.md`, "Two clear choices instead of three" (Thronefall).

- [ ] Some stops offer a sharp either/or: two choices, each with a clear gain and a clear cost, in place of a pick of three
- [ ] Shown on the run map, so you can plan your path around them
- [ ] Saved with the run, and older saves still load

### 7G. Endless after the last ruler

Added after 7D at the owner's request: from `docs/inspiration.md`, "Endless after the last ruler" (9 Kings).

- [ ] Once every region's ruler is beaten, a run can go on past its ruler into ever stronger armies
- [ ] A score for how far an endless run gets, and your best kept with your profile
- [ ] Saved with the run, and older saves still load
