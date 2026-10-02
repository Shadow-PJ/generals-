# Generals — Game Design

## The pitch

**Your army fights on its own. Before battle you write orders in your own words; during battle you fire them at the perfect moment and chain them into combos.**

Generals is a 2D top-down strategy game. Troops fight automatically using their own behaviors. Your General turns your written orders into Command cards, and in battle you trigger those cards with a few keys.

What makes it unique:

- **Orders in your own words.** "If anyone goes after my Ranger, cover her and kill the attacker" becomes a real card, shaped by your General's personality.
- **Timing and combos are the skill.** Fire cards at the right moment, chain them, and finish with your ultimate.
- **Your orders grow with you.** At the start you can only give simple orders. Later you write orders that were impossible at first, such as one that fires again every time a condition happens.
- **Every General plays like a different game.** Each one changes troop skills, the mana rules, and how your orders are read. You recruit each one by beating them.

The skill loop: plan, observe, fire, chain, adapt, unlock.

**Where it ships:** a Windows desktop game on Steam first, then the Epic Games Store, with Steam Deck support. A browser build stays online for quick testing.

## What changed in v2

v2 moves talking to your General to before the battle and keeps the fight to a few keys. It also adds command progression and a combo system, and replaces the mana system.

| Area | v1 | v2 |
| --- | --- | --- |
| Giving orders | Type or speak during battle | Write orders before battle; your General turns them into cards |
| In-battle controls | Order box, quick-order wheel, voice | Keys 1 to 4, a Legendary slot on 5, ultimate on U |
| Mana | One 0 to 100 meter, filled only by battle events, a different cost per command | Command pips that refill over time and from skill, plus a Momentum bar that charges the ultimate |
| General's personality | Could misread you mid-battle | Shows on the card before the fight; you rephrase or keep it |
| Unlocking orders | Every command available from the start | Command Ranks unlock slots, actions, conditions and steps; bosses teach Legendary actions |
| Combos | Troop synergies only | Troop synergies, chains, signature combos and ultimate finishers |
| Ultimate | Charged over time | Charged by Momentum; stronger as the last link of a chain |
| Each General | Troop skill, doctrine, ultimate | Also bends one mana rule |
| Removed | Tactical Focus, order travel delay, the General as a unit on the field | Not needed once orders are written before battle |
| Cost of AI orders | A paid AI call for every order during battle | Parser, validator and personality rules in plain code, plus a small model on the player's computer; free to play |
| Difficulty | Real time only | Optional Tactical mode that pauses every 10 s |
| Platform | Browser game | Windows desktop app on Steam, then Epic, with Steam Deck support; the browser build stays for testing |

Unchanged: the 5 troop classes, troop synergies, the campaign map, boss Generals, Battle IQ, veterans and the Tech Web.

## How a battle plays

A battle takes about 2 to 3 minutes, and each one feeds the next:

1. **Prepare:** pick your General, place your troops, write your orders; the General makes them into cards.
2. **Battle:** troops fight alone; you fire cards on time, chain them into combos, and finish with your ultimate.
3. **Battle IQ:** a report with your biggest mistake, best decision, missed opportunity and an enemy weakness found.
4. **Grow:** earn Command XP, unlock new orders, veterans rank up, pick the next node on the map. Then the next battle.

Before the battle you see the enemy army and the map, place 5 troops and 3 reserves, and write your orders. After it, the Battle IQ report teaches instead of only listing damage, for example: "Your ultimate was ready for 8.4 s before you used it," or "Fall Back then Focus would have made a Feigned Retreat."

**On the battlefield.** All numbers are starting values to tune in playtests.

- **Walls** block movement and shots. A wall works like a shield: a shot that would cross it hits the wall instead and wears it down. A worn-out wall breaks, opening the way for troops and shots alike.
- **Overtime** keeps stalled fights from dragging: from 2:20, all damage grows by 6% every second.
- **Time limit:** if both armies still stand at 3:00, the side with the larger share of its starting HP left wins.
- **Luck** is small: each attack's damage varies by up to 10% either way, set by the battle's seed.
- Without cards, a battle between two starter armies lasts about 1:45. Cards, ultimates and combos are expected to shorten it.

## Command Slots

You command through slots: each slot holds one card, written before the battle and fired during it.

**Writing a card.** Type or speak an order in plain language. Your General turns it into a card with three parts: when it can fire (its condition), what it does (its steps), and its cost in pips. If an order uses something you haven't unlocked, the General says so: "We haven't trained for that yet. Reach Rank III."

A Rank III loadout with the Strategist:

| Slot | You write | Card | Cost |
| --- | --- | --- | --- |
| 1 | "Rangers, focus their healer" | Focus: enemy healer | 1 |
| 2 | "When their Assassin dives, protect my Ranger, then everyone focus him" | When an enemy Assassin reaches your backline: Protect your Ranger, then Focus the Assassin | 2 |
| 3 | "Everyone fall back to the Guardian" | Fall Back to the Guardian | 1 |

**The General's reading.** The card shows how your General understood you, before the fight. The Warlord may turn "fall back" into "regroup, then charge"; you rephrase it or keep it. Rephrasing is free, and misreadings never happen mid-battle.

**Firing cards.** Press 1 to 4 for regular slots, 5 for the Legendary slot, and U for your ultimate. A card with a condition glows when the condition is met; a card without one is ready whenever you have the pips. A fired slot rests for 8 s.

**Auto or manual.** Any card with a condition can be set to Auto, so it fires by itself the moment the condition is met. Manual cards wait for you. Pressing a manual card while it glows is a **Perfect timing**: +25% effect and 1 pip back. Auto is the easy mode; manual is how good players win bigger.

**Threat Readout.** Warnings over units, such as "Ranger falls in ~3 s" or "Enemy ultimate charging", tell you when to fire.

**Tactical mode (optional).** An easier setting: the battle pauses every 10 s so you can choose cards without time pressure. Perfect timing is off in this mode.

## How orders become cards

Every order passes through four steps, and only the translator may use AI. Nothing in the pipeline needs a paid API, so the game costs nothing to play.

1. **You write:** text, voice, or card-builder blocks.
2. **Translator:** the rule parser, then the small model for what the parser can't read; literal only.
3. **Validator:** checks rank, steps and cost. A rejected card goes back to you with "We haven't trained for that yet."
4. **Personality:** the General's rules edit the card.
5. **Card and reply:** the card is saved to a slot, with a template reply line.

**Translator.** Turns your words into a card, literally. It never improves your order: a weak order makes a weak card, and that is part of the skill. The rule parser handles card-builder blocks and simple sentences; a small model on the player's computer handles free-form sentences. Both produce the same card format. The small model is an intent-and-slots reader: it tags each word with its part of the card (condition, step, troops, action, target), and fixed code assembles the card from those parts, so it can't invent a condition or a step that isn't in the words. When it isn't sure, it says it didn't catch the order rather than guessing.

**Validator.** Checks the card against your Command Rank: unlocked actions, number of steps, kind of condition, and total cost against your max pips. An illegal card is rejected and the General answers "We haven't trained for that yet." Even a buggy or over-clever model can't break balance.

**Personality rules.** Each General edits the finished card by fixed rules, then answers with a pre-written line. Several lines per rule keep replies from repeating. Steps a General adds don't count against your rank's step limit and may use any action, but they still cost pips.

| General | Rule on the card | Sample reply |
| --- | --- | --- |
| Captain | None | "Understood." |
| Warlord | Fall Back gets a counter-attack added (Focus the nearest enemy), unless you write "hold back" | "Retreat? We regroup and hit back!" |
| Engineer | Adds Hold before any Move, for 1 extra pip | "Securing the position first." |
| Hive Mother | Keeps at most 2 steps; specific targets become the nearest of that class | "Hunt." |
| Strategist | A card without a condition gets a suggested one, which you accept or ignore | "Wait for their Assassin to commit. Then strike." |
| Conductor | Reorders steps into a signature combo when possible | "On the beat." |

How the rules read in detail (session 3A):

- **Slots keep your card as you wrote it.** Your General's rules are applied when the card is read, so the slot and the battle show the General's version, and switching Generals re-reads every card.
- **Warlord:** a Focus on the nearest enemy, by the troops that fell back, goes right after each Fall Back. Nothing is added when the next step is already a Focus, or when your order says "hold back".
- **Engineer:** a Hold by the same troops goes before each Move, unless they already Hold just before it. Fall Back is not a Move.
- **Hive Mother:** steps after the second are dropped. "The weakest" and named troops become the nearest troop; "him" (the one that set off the condition) becomes the nearest troop of his class.
- **Strategist:** the suggestion depends on the card's first step. Focus waits for the target to reach your backline if it is a Vanguard or Assassin, otherwise for any enemy to; Protect waits for that ally to drop below 50% HP; Fall Back and Call Reserve wait for any ally below 50%; Move, Hold and Overcharge wait for 3 or more enemies close together. There is no suggestion when your rank allows no conditions or the card already has one. Accepting it adds the condition to your card.
- **Conductor:** when no two steps in a row already make a signature combo, it picks the order of your steps that makes the most combos while moving them the least.
- **Cost:** a General's steps cost pips like yours. If they push a card above your max pips it can never fire, and the card screen says so, so you can rephrase.

## Command and Momentum

Two bars run the battle: Command pips pay for cards, and Momentum charges your ultimate. Both reward skill without locking beginners out. All numbers are starting values to tune in playtests.

**Command pips**

- You start each battle with 2 pips. Max pips grow with rank: 4 at Rank I, up to 6 at Rank V.
- 1 pip refills every 6 s, so you always have something to spend.
- A Perfect timing gives 1 pip back.
- Comeback rule: once you've lost half your troops, pips refill twice as fast.
- Pips can't go above the max, so sitting on a full bar wastes them.

**Card costs.** A card costs the sum of its steps. Focus, Move, Fall Back, Protect and Hold cost 1; Overcharge and Call Reserve cost 2; Legendary actions cost 3. Each link in a chain costs 1 less, down to a minimum of 1.

**Momentum**

- Fills slowly over time on its own, so every player gets their ultimate.
- Fills fast from Perfect timings, chains and signature combos, so skilled play gets it much sooner.
- When full, your ultimate is ready. Fired as the last link of a chain of 3 or more, it becomes a Finisher (see Combos).

**Each General bends one rule**

| General | Twist | Effect |
| --- | --- | --- |
| Captain | None | Standard rules, for learning |
| Warlord | Blood Price | When short on pips, pay the rest with 10% HP per pip from your healthiest troop |
| Engineer | Build-Up | Max pips +1 every 30 s of battle, up to +3; slow start, strong finish |
| Hive Mother | Feeding | Pips refill at half speed, but every enemy killed gives 1 pip |
| Strategist | Prepared | Starts every battle with full pips, but refills 25% slower |
| Conductor | Rhythm | Perfect timing gives 2 pips back, and the glow window lasts longer |

## Combos

Combos come in four layers, from automatic to expert. Hidden combos fill in a Combo Codex as you discover them.

**1. Troop synergies (always on).** Pairs of classes in your army trigger effects by themselves.

| Combo | Classes | What happens |
| --- | --- | --- |
| Fire Break | Vanguard + Invoker (Pyromancer) | Enemies Shoved through a fire zone take triple burn damage |
| Execution Protocol | Ranger + Assassin | The Assassin always crits a Marked target |
| Iron Wall | Guardian + Vanguard | A Vanguard with a Barrier can't be knocked back and taunts nearby enemies |
| Crossfire | Ranger + Invoker | Arrows shot through a zone take its element (burn or slow) |
| Shadow Escort | Guardian + Assassin | When an Assassin's Barrier breaks, it turns invisible for 2 s |

**2. Chains (from Rank III).** Fire a card within 3 s of the last one to chain them. Each link costs 1 less pip and doubles Momentum gain. A counter shows the chain: x2, x3, x4.

**3. Signature combos (from Rank III).** Certain steps in a row trigger a bonus. They work across a chain of cards and inside a single card, so a well-written order can be a combo on its own.

| Combo | Steps in a row | Bonus |
| --- | --- | --- |
| Feigned Retreat | Fall Back, then Focus | Enemies that chase are slowed 50% and take +30% damage |
| Ambush | Call Reserve, then Focus | The reserve arrives behind the focused enemy instead of at your edge |
| Overload | Overcharge, then Overcharge on the same troop | Its skill fires at double power; the troop takes 20% self-damage |
| Hammer and Anvil | Move a Vanguard behind enemies, then Overcharge it | Shove pushes them into your line and stuns them for 2 s |
| Iron Shell | Protect, then Hold | Held troops reflect 30% of damage while their Barrier lasts |

**4. Finishers (from Rank IV).** Fire your ultimate as the last link of a chain of 3 or more and it gains +50% power. Example with the Strategist: Fall Back, then Focus (Feigned Retreat), then Gravity Well pulls the chasing enemies together for a Finisher.

## Command progression

Your orders start simple and grow into commands that were impossible at the start. Command Ranks unlock what your orders are allowed to say, and boss Generals teach Legendary actions.

**Command Ranks.** You earn Command XP from every battle, with bonuses for Perfect timings, combos and good Battle IQ grades. Expect about one rank per region.

| Rank | Slots | Max pips | Steps per card | Conditions | New actions and features |
| --- | --- | --- | --- | --- | --- |
| I. Squad Leader | 2 | 4 | 1 | None, manual only | Focus, Move, Fall Back; target troop classes, yours or theirs |
| II. Field Commander | 3 | 4 | 1 | Simple "when"; Auto mode | Overcharge, Protect |
| III. Tactician | 3 | 5 | 2 ("then") | Simple "when" | Call Reserve, Hold; chains and signature combos; target named veterans |
| IV. Warmaster | 4 | 5 | 3 | Combined ("when X and Y") | Finishers |
| V. Legend | 4 | 6 | 3 | Repeating ("every time") | Repeating cards fire again each time the condition returns, at least 10 s apart |

**The Legendary slot.** Beating your first boss General unlocks slot 5, which holds one Legendary card. Every General you defeat teaches you their Legendary action:

| Learned from | Legendary action | Effect |
| --- | --- | --- |
| Hive Mother | Hijack | Control one enemy troop for 5 s |
| Strategist | Swap | Two of your troops trade places instantly |
| Warlord | Blood Pact | Sacrifice one troop to refill all pips and Momentum |
| Engineer | Fortify | Raise a wall line where you point, for 8 s |
| Conductor | Echo | Repeat your last card for free |

**How one order grows.** The same idea, protecting your Ranger from Assassins, at three points in the game:

1. **Rank I:** "Everyone focus their Assassin." Manual, 1 step, cost 1.
2. **Rank III:** "When their Assassin dives, protect my Ranger, then everyone focus him." A condition and 2 steps, cost 2.
3. **Rank V with Swap:** "Every time their Assassin dives my backline, swap my Vanguard into my Ranger's spot, protect him, then everyone focus the Assassin." Repeating, 3 steps, Legendary, cost 5.

## The 5 troop classes

Each class controls one thing on the battlefield, so how you mix them matters. Every troop has a behavior (what it does on its own), a skill, a weakness, and two specializations in the Tech Web.

| Class | Controls | Behavior | Skill | Weakness | Specializations |
| --- | --- | --- | --- | --- | --- |
| Vanguard | Space | Holds the front, protects the nearest ally | Shove: pushes enemies back | Armor-piercing attacks | Breaker (charge and knockback) or Bulwark (shield wall that blocks projectiles) |
| Ranger | Targets | Keeps max range, shoots the nearest threat | Mark: target takes +20% damage | Dies fast once reached | Sniper (armor-piercing shots) or Volley (area arrows) |
| Guardian | Damage | Stays near the most hurt ally | Barrier: shields one ally | Low damage; Assassins hunt it first | Warden (big shields, taunt) or Mender (healing over time) |
| Invoker | Areas | Casts at groups of enemies | Rift: a damaging zone on the ground | Long cast that can be interrupted | Pyromancer (fire zones) or Frostcaller (slowing zones) |
| Assassin | Priority targets | Hunts the weakest or backline enemy | Shadowstep: blinks behind its target and executes it below 15% HP | Fragile; weak to area damage | Blade (burst kills) or Saboteur (silences enemy skills) |

An army is 5 active troops plus 3 in reserve. You start with Vanguard, Ranger and Guardian; Invoker and Assassin are unlocked in the campaign.

## The Generals

Each General leads one of the five factions and stands for one way to win. A General gives every troop a faction skill, changes how troops behave (their doctrine), brings one manual ultimate, bends one mana rule, and writes your cards in their own style. You start with the Captain and recruit the other five by beating them.

### The Captain (starter, no faction)

Hold the line. A balanced General for learning the game.

- **Troop skill:** none.
- **Doctrine:** default troop behaviors.
- **Ultimate, Rally:** all troops heal 20% and gain +30% attack speed for 5 s.
- **Mana twist:** none.
- **Writes your cards:** literally, exactly as written.

### The Warlord (Bloodbound)

Victory is paid in blood. High risk, high reward: health is a resource.

- **Troop skill, Vampiric Link:** a troop drains its own health to give a nearby ally +200% attack speed for a few seconds.
- **Doctrine:** Vanguards attack the strongest enemy; Assassins dive at once.
- **Ultimate, Reaper's Toll:** executes your own troops below 20% HP and turns them into invulnerable shadow wraiths for 10 s.
- **Mana twist:** Blood Price.
- **Writes your cards:** aggressively. Turns retreats into charges unless you insist.

### The Engineer (Forgeborn)

Win before the fight starts. Engine-building and momentum.

- **Troop skill, Venting:** every 5th attack, a troop overheats, dealing area burn damage and taking slight self-damage.
- **Doctrine:** Vanguards hold position; Rangers stay behind cover.
- **Ultimate, Thermal Detonation:** absorbs all heat from your troops, healing them, and fires it as a massive laser.
- **Mana twist:** Build-Up.
- **Writes your cards:** carefully. Often adds a safety step, such as Hold before a Move, which costs an extra pip.

### The Hive Mother (Hive)

Adapt or be eaten. Swarm and mutate.

- **Troop skill, Assimilation:** when a troop kills an enemy, it steals that enemy's trait or grows an armor shell for a while.
- **Doctrine:** troops move as a pack and gang up on one enemy at a time.
- **Ultimate, Forced Evolution:** merges two of your troops into one mutated elite unit.
- **Mana twist:** Feeding.
- **Writes your cards:** on instinct. Simplifies targets and may drop the last step of a long order.

### The Strategist (Voidweavers)

Position is power. Battlefield control.

- **Troop skill, Phase Shift:** once per battle, a troop about to take fatal damage teleports behind the attacker and stuns them.
- **Doctrine:** Vanguards guard the nearest ally; Rangers keep max range.
- **Ultimate, Gravity Well:** a black hole drags every unit, friend and foe, to one point, setting up area attacks.
- **Mana twist:** Prepared.
- **Writes your cards:** precisely, and points out weak spots in your order with a better condition you can accept.

### The Conductor (Resonance)

Everything echoes. Combo chaining and stacking.

- **Troop skill, Echo Strike:** hits add a Vibration stack; at 3 stacks the enemy shatters and loses armor.
- **Doctrine:** troops spread their attacks to stack Vibration on as many enemies as possible.
- **Ultimate, Shatterstorm:** detonates every Vibration stack at once, causing chain explosions.
- **Mana twist:** Rhythm.
- **Writes your cards:** as a perfectionist. Reorders your steps so they land as a signature combo when possible.

## Campaign

Progress is a journey across a world map, not an XP bar. You unlock troops, Generals and Legendary actions by playing the campaign, and grow your army between runs.

**World map.** The Capital is your hub, with five regions around it. Each region has its own terrain and is ruled by one General.

| Region | Terrain | Ruler | Main reward |
| --- | --- | --- | --- |
| Deep Forest | Hidden movement; Assassins are deadly | Hive Mother | Hive Mother, the Assassin class, Hijack |
| Void Ruins | Broken walls and sightlines; ranged control | Strategist | Strategist, the Invoker class, Swap |
| Red Canyon | Narrow paths; tanks shine | Warlord | Warlord, Blood Pact |
| Iron Fortress | Gates and walls; positioning is everything | Engineer | Engineer, Fortify |
| Glass Plains | Open ground; long range dominates | Conductor | Conductor, Echo |

Forest and Ruins open first because they unlock your last two troop classes. Each boss you beat opens the next region, and the Glass Plains come last.

**Expeditions.** Entering a region starts a run: a branching path of battles, elite fights, events, a merchant and rest camps, ending at the ruling General. Artifacts you find are kept once you reach a camp or win; lose the run first and you lose the ones you were carrying.

**Boss Generals.** Each boss tests one idea instead of having huge HP:

- **Hive Mother:** her troops steal traits from your kills, so you protect weak troops and use Fall Back.
- **Strategist:** her troops phase out of your burst, so you save your ultimate until their Phase Shifts are spent.
- **Warlord:** his army gets stronger with every death, so you kill his troops together, not one by one.
- **Engineer:** hides behind walls and turrets, so you need area damage or Assassins to break in.
- **Conductor:** stacks Vibration on your army, so you spread out and interrupt her before Shatterstorm.

Beat a General and they join you, and you learn their Legendary action: you can now play the strategy that once beat you.

**Growing your army**

- **Command Ranks:** what your orders can say (see Command progression).
- **Tech Web:** each class has a branching upgrade web bought with Insight, earned every battle. You choose one specialization per class and can respec for free between runs.
- **Artifacts:** rare items that change how a troop behaves, such as a Lifesteal Core. One slot per troop, equipped in the Capital.
- **Veterans:** every troop is a named individual with a record of battles, kills and boss kills. Ranks go Recruit, Veteran, Elite; each adds one small perk. From Rank III your orders can name them ("Raven, take their healer"). A fallen troop sits out one battle; Ironman mode makes death permanent.
- **General Mastery:** three challenges per General, such as winning with fewer than 3 cards fired. Rewards are titles and new looks.
- **Hard choices:** event nodes force a trade-off, such as taking gold, upgrading a troop now, or giving up 20% HP for a legendary artifact.

## Platforms and release

Generals ships as a Windows desktop game on Steam first, then on the Epic Games Store. A browser build stays online as the quick test build.

- **Desktop app:** the same TypeScript game wrapped in Electron, which bundles its own Chromium, so it runs the same on every PC and on Steam Deck.
- **Voice orders:** on the Orders screen, hold V (or the Talk button) and say the order; it goes through the same translators as a typed one. The browser build uses the browser's own speech recognition (Chrome, Edge and Safari have it; Firefox doesn't), which may send the sound to the browser maker's speech service; the game itself sends nothing. The desktop app has no speech recognition yet, so players type there; a speech model running on the player's computer could add it later. Typing always works.
- **Small model:** the order reader is about 1 MB of weights (270 KB compressed), so it ships inside both builds as an ordinary game file, loaded in the background when the game starts. It needs no download, no GPU and no internet.
- **Saves:** files in the player's app data folder (on Windows, `%APPDATA%\Generals\saves`), synced by Steam Cloud. Display settings (window size, fullscreen, resolution) sit next to that folder in `settings.json` and stay on each computer, since a laptop and a big monitor want different ones. In the browser build, saves live in the browser's local storage.
- **Steam Deck and controllers:** full controller support. Slots map to buttons, and the card builder works without a keyboard.
- **Multiplayer:** runs through a small relay server of our own, so Steam, Epic and browser players can play each other. Epic requires multiplayer games to cross-play with other PC stores.
- **Store features:** Steam achievements, cloud saves and rich presence; Epic achievements, which Epic requires.
- **AI disclosure:** Steam asks about AI-made content that players see. Generals' live AI is the order reader, a small model trained for this game on generated orders, that turns orders into cards. It only ever picks parts of a card (it can't write text), and its guardrails are the fixed card format, the validator and pre-written replies, so it never writes free text for players. The optional experimental language model in Settings is held to the same card format. AI tools used only to write the code don't need disclosing; any AI-made art or sound would be disclosed.

Store fees and launch timing are in phase 7 of `docs/PLAN.md`.

## Brainstorm decisions

The original idea lists had three sets of five (factions, classes, Generals) and two battle resources. This is where each idea ended up in v2.

| Idea | Decision | Why |
| --- | --- | --- |
| Orders by text or voice to AI Generals | Kept, now written before battle as Command Slots | The game's hook, without typing under pressure |
| 5 factions | Merged into the Generals | Every faction skill survives without a third set of five |
| 5 classes | Kept as the troop types | Each controls something different, so the mix matters |
| Flux and the Command meter | Replaced by Command pips and Momentum | Easier to read; rewards skill and keeps beginners in the game |
| Target Painter, Overcharge, Reposition, Retreat, Reinforce | Kept as card actions: Focus, Overcharge, Move, Fall Back, Call Reserve | A small set of actions that unlocks over time |
| Walls and haste zones | Walls became Fortify, the Engineer's Legendary action; haste zones cut | Fewer buttons |
| Rally, Execute, Overwatch | Became the Captain's ultimate, the Assassin skill and Ranger behavior | No separate buttons needed |
| Chronarch and rewind | Cut for now | Overlaps the replay feature; could return as a secret General |
| Leader Bounties and recruit-by-defeat | Kept as the campaign's spine | Bosses now also teach Legendary actions |
| Battle predictions, Battle IQ, reserves, map identity, world map, hard choices | Kept | They all serve plan, observe, fire |
| Tech Web, Artifacts, Veterans, Mastery | Kept | Four kinds of growth: class, item, individual troop, player skill |
| Permadeath | Optional Ironman mode | Losing favorite troops by default is harsh for new players |
| "What if" battle replay | Later | Needs a deterministic battle engine, which is built from day one so it can be added |

## Build order

Seven phases, each one or more Claude Code cloud sessions that end in a branch the owner reviews before merging. After phase 2 is merged, phases 3 and 4 can run as parallel sessions. Each session's checklist is in `docs/PLAN.md`.

1. **Battle core:** a 2D top-down web game with a deterministic battle engine (fixed tick, seeded randomness), one map, Vanguard, Ranger and Guardian with their behaviors and skills, and a win or loss screen.
2. **Command Slots and desktop build:** the card format (condition, steps, cost), the card builder and rule parser, the validator, keys 1 to 5 and U, Command pips and Momentum, Auto and manual, Perfect timing, and Threat Readout; then a Windows desktop build next to the browser build. The game is fully playable here, with no AI.
3. **Personalities and the small model:** personality rules and reply lines for each General, then the small model in stages, stopping once it is good enough:
   1. An existing small open model with a few examples, its output forced into the card format.
   2. If it still makes mistakes, fine-tune it on generated examples: a script combines actions, targets and conditions, and Claude rewrites them into natural phrasings.
   3. Or a tiny intent-and-slots model instead, which tags the parts of a sentence rather than writing text. **Chosen after the 3B test:** the existing models read 3–12% of orders exactly and took 10–40 s each, so 3C builds the intent-and-slots reader instead of a fine-tune.

   Voice input comes last.
4. **Combos and content:** chains, signature combos and finishers; all 5 classes and specializations; the 6 Generals with mana twists; troop synergies; the 5 region maps.
5. **Progression:** Command Ranks, the Legendary slot and actions, the world map, expeditions, boss fights, Tech Web, artifacts, veterans, mastery, the Battle IQ report, and saving.
6. **Polish and multiplayer:** balance, tutorial, art, sound, controller and Steam Deck support, and battles against friends across stores.
7. **Release:** Steam integration and the store kit, then the Epic build.

Playing never needs a paid API: the parser, validator and personality rules are plain code, and the small model runs on the player's computer. Claude is used only while building, for example to write the training sentences in phase 3.
