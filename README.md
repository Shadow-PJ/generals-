# Generals

A 2D top-down strategy game. Armies fight on their own; before a battle you write orders in plain language, your General turns them into Command cards, and during the battle you fire them with keys 1 to 5 and finish with your ultimate on U.

- `docs/DESIGN.md`: the game design, the source of truth for rules and numbers
- `docs/PLAN.md`: the build plan, one session at a time
- `CLAUDE.md`: how the code is organized and the rules it must never break

## Play it

In the browser: https://shadow-pj.github.io/generals-/ (updated on every merge to `main`).

On Windows: every merge to `main` builds an installer. Open the repository's **Actions** tab, pick the latest **Desktop builds** run, and download **Generals-Windows-installer** under Artifacts. Unzip it and run `Generals-Setup-<version>.exe`. Windows shows an "unrecognized app" warning because test builds aren't signed yet: choose **More info**, then **Run anyway**. Your cards are saved in `%APPDATA%\Generals\saves`.

On Linux and the Steam Deck: the same run has **Generals-Linux-AppImage**. Unzip it, make the file executable (`chmod +x Generals-*.AppImage`, or Properties > Permissions on the Deck's desktop) and run it; on the Deck you can add it to Steam as a non-Steam game to play it in Game Mode. Saves are in `~/.config/Generals/saves`.

With a controller: the D-pad or left stick moves, A chooses and B goes back; View reaches every button on the screen. In battle X, Y, B, A and RB fire the five card slots, RT the ultimate, Menu pauses and LB switches speed. On the orders screen, A on the order line opens an on-screen keyboard that suggests the words orders use. Hints show your controller's buttons once you press one.

In your first battles the Captain, your first General, says a short tip the first time each moment comes: on each screen of a run, and in battle when a card is ready, your ultimate is ready, your pips are full or a troop falls. Tips fade by themselves (or click them); Settings turns them off or plays them all again.

The game opens in the Capital, the world map. Five regions surround it, each ruled by a General; Deep Forest and Void Ruins are open from the start, and each ruler you beat opens the next. Pick a region and press Enter to set out on a run, a roguelite path of battles, elite fights, events, a merchant and rest camps that ends at the ruler. Picking a fight on the run's map scouts it: you see the army waiting there before you go. For a harder run, take Oaths of Command (O in the Capital): tougher enemies, leaner purses, crueler rulers; each adds Fear, and Fear earns more Insight, with a bounty for winning a region above its highest Fear yet. You set out with your company of 8 (5 on the field, 3 in reserve) and no gold; the first fights are small and the enemies grow stronger along the path. Each won fight pays gold and lets you pick 1 of 3 offers: a fighter who joins your army or a boon that lasts the run (30 of them, plus 10 duo boons once two factions' bonuses are on in your army), each Common, Rare, Epic or Legendary by chance, and rarer deeper in a run and after an elite fight. A fighter may belong to one of the five Generals' factions (Bloodbound, Forgeborn, Hive, Voidweavers, Resonance): 2, 4 and 6 of one faction in your army switch on its bonus, so drafting one faction makes it strong. Rarer fighters also have perks, such as Tough or Leech. Wounds carry from fight to fight, and a fighter who falls sits the next fight out. The merchant sells fighters and boons and heals your army, rest camps heal it and bank the artifacts you found, and events make you choose between two good (or two bad) things. Lose a fight and the run is over. The ruler waits at the end, with a boss rule only their fight has (the army screen shows it and how to beat it): the Hive Mother's troops steal from the troops they kill, the Strategist's phase out of big hits, the Warlord's rage as they fall, the Engineer shoots from turrets behind her walls, and the Conductor's Vibration spreads through packed troops. Beat the ruler to win the run: they join you as a General (pick them on the General screen, G), you learn their Legendary action and the next region opens. You start with the Captain. Your run is saved as you go: close the game and carry on later.

Before each fight choose your army, place your troops and press Enter. Write your orders: type them in plain English or build them from the menus, and save them to your card slots. Press B to start the battle, then fire your cards with keys 1 to 5 (a card with a condition glows when its moment comes: press it then for a Perfect timing) and your ultimate with U once the Momentum bar is full. Space pauses and F switches between 1x and 2x speed. Your cards are kept between runs.

Your army grows between runs. Your company (R in the Capital) is eight named troops who set out on every run; each keeps a record of battles and kills, ranks up from Recruit to Veteran to Elite (each rank adds a perk), and can carry one artifact you have banked (10 to find, such as the Phoenix Feather, which brings its troop back once). After a won run you choose who stays in your company, newcomers included. Ironman mode, switched there between runs, makes a fall permanent. Every campaign battle also earns Insight to spend on the Tech Web (K): for each class, Drills and Better Arms, then one of its two specializations, then Honed Skill; take a class's web back for free between runs. After every battle the Battle IQ report shows your biggest mistake, best decision, a missed chance and an enemy weakness, with a grade that earns XP. Each General has three Mastery challenges (on the General screen), each with a title; all three give your troops a gold trim.

You start at Rank I. Every campaign battle earns Command XP (more for wins, Perfect timings, combos and Finishers), and enough XP raises your Command Rank: more slots, pips, steps and conditions. The result screen shows what a battle earned. Beating a ruler opens slot 5, the Legendary slot, for one Legendary order: Hijack an enemy troop, Swap two of yours, a Blood Pact, Fortify (a wall line) or Echo your last card. Skirmish (T in the Capital) is practice: any army, map and enemy, at any rank, for no XP. Saves made by an older version still load: they are brought up to date and the old file is kept as a backup.

From Rank III, cards fired within 3 seconds of each other chain: each link costs a pip less and earns double Momentum, and certain steps in a row (Fall Back, then Focus; Protect, then Hold; ...) land a signature combo, in one card or across a chain. From Rank IV, the ultimate at the end of a chain of 3 is a Finisher. Combos you land fill in the Combo Codex (C in the Capital or on the troop screen).

Five troop classes fight: Vanguards hold the front and Shove, Rangers shoot from range and Mark, Guardians shield the most hurt ally, Invokers open damaging Rifts on groups of enemies (a long cast that a hit can break), and Assassins blink behind the enemy backline and execute the weak. In a skirmish, press T on the troop screen for the Skirmish screen: pick the class of each troop and reserve, a specialization for each class (Breaker or Bulwark, Sniper or Volley, and so on), and the battle: the map, both Generals, whether the enemy brings the starter army or a mirror of yours, and whether an enemy commander fires cards and an ultimate against you (Rank I to V). In the campaign, specializations come from the Tech Web instead. Pairs of classes in your army switch on troop synergies by themselves, such as Iron Wall (Guardian and Vanguard); the troop screen shows which are on.

Your General leads the battle: press G in the Capital or on the troop screen to choose one. Each gives every troop a skill and a way of fighting (the Warlord's troops trade HP for speed, the Engineer's vent heat and dig in early, the Hive Mother's hunt as a pack, the Strategist's dodge a killing blow once, the Conductor's stack Vibration until enemies shatter), brings its own ultimate on U, bends one rule about pips, and reads every card in their own way: the Warlord turns retreats into counter-attacks, the Engineer adds a Hold before every Move, the Hive Mother keeps orders short and simple, the Strategist suggests a better moment, and the Conductor reorders steps into combos. You start with the Captain; each ruler you beat in the campaign joins you, and in a skirmish any General can lead the enemy.

The game is drawn in pixel art and scored with its own synthesized sound and music: a calm theme in the Capital, a driving one in battle and a darker one against the rulers. Sound starts with your first key press or click (browsers allow no sooner).

You can also speak an order: on the orders screen, hold V (or the Talk button), say it, and let go. This uses your browser's speech recognition, so it works in Chrome, Edge and Safari but not Firefox, nor yet in the desktop app; typing always works. Orders are read by a rule parser, and what it can't read by the order reader, a small model trained for this game that runs on your computer, at once and offline (`docs/model-eval-3c.md`). It reads slang, typos and long orders, Legendary ones too ("take control of their archer", "do that again"), and says so when it isn't sure rather than guess. In the Capital, Esc opens Settings: fullscreen or windowed, window size, resolution, volume, music and sound effects, screen shake, the Captain's tips, and order reading, where you can also switch on an experimental language model for what the other two can't read (it downloads once, about 400 MB, and is slow). F11 switches fullscreen on any screen.

## Running it

Needs Node 22.12 or newer.

```sh
npm install
npm run dev                 # local dev server
npm test                    # all tests
npm run build               # type check and production build
npm run sim -- --seed 42    # run one battle headless and print the result (add --verbose for skill uses,
                            # --general warlord and --enemy-general conductor to pick each side's General,
                            # --map redCanyon for a region map, --commanders 3 for both sides' card scripts)
npm run dataset             # write 5,000 generated sentence and card pairs to tools/dataset/out/
npm run eval                # parser and order reader accuracy on the held-out orders, with every failure
npm run eval -- --set fresh # the same on fresh.txt, orders written before the reader existed
npm run eval -- --set legendary   # the same on legendary.txt, Legendary orders written before the reader learned them
npm run balance             # thousands of headless battles per matchup; reports what wins too often or too rarely
                            # (--battles 1000, --suite generals|specs|factions|bosses, --out report.md)
npm run train:reader        # train the order reader from generated orders into models/order-reader.json
npm run art:preview -- sheet.png   # draw every sprite onto sheet.png and every map's ground onto sheet-maps.png
npx tsx tools/eval/model/run.ts --model qwen2.5-0.5b --isolated   # the experimental language model, in headless Chromium
npm run desktop             # build and open the desktop app (Electron)
npm run desktop:installer   # build the Windows installer into release/ (run it on Windows)
npm run desktop:linux       # build the Linux AppImage (Linux PCs and the Steam Deck) into release/
```

The desktop app lives in `desktop/`: `main.ts` opens the window and serves the same game build as the browser version, and `preload.cts` gives the game its few requests (files, fullscreen, window size). Game code reaches them only through `src/platform`.
