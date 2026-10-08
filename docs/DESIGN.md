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
| Conductor | Rhythm | Perfect timing gives 2 pips back, and the glow window lasts longer (2.5 s instead of 1.5 s) |

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

In detail: every link after the first costs 1 pip less than its card (not 1 less per link so far), and never under 1. Every link after the first adds 8 Momentum, and all the Momentum a chained card earns (that, a Perfect timing, its combos) counts double. Cards that fire by themselves (Auto) chain too, and the ultimate counts as a link.

**3. Signature combos (from Rank III).** Certain steps in a row trigger a bonus. They work across a chain of cards and inside a single card, so a well-written order can be a combo on its own.

| Combo | Steps in a row | Bonus |
| --- | --- | --- |
| Feigned Retreat | Fall Back, then Focus | Enemies that chase are slowed 50% and take +30% damage |
| Ambush | Call Reserve, then Focus | The reserve arrives behind the focused enemy instead of at your edge |
| Overload | Overcharge, then Overcharge on the same troop | Its skill fires at double power; the troop takes 20% self-damage |
| Hammer and Anvil | Move a Vanguard behind enemies, then Overcharge it | Shove pushes them into your line and stuns them for 2 s |
| Iron Shell | Protect, then Hold | Held troops reflect 30% of damage while their Barrier lasts |

In detail: a synergy is on when both classes are in your army, the 5 troops on the field or the 3 in reserve, from the start of the battle. Fire Break needs the Invoker to be a Pyromancer; an enemy pushed into one of your fire Rifts takes 3 of its pulses of burn at once, once per Shove. Execution Protocol makes every hit of your Assassins on a Marked target a critical hit, the Shadowstep strike included. Iron Wall: while one of your Vanguards has a Barrier, Shoves don't move it, and enemies within 90 of it must attack it (renewed every moment they stay close). Crossfire: an arrow of your Rangers that flies through one of your Rifts burns (+50% damage) if the Rift is plain or fire, or slows its target by 30% for 2 s if it is frost. Shadow Escort: when an Assassin's Barrier breaks (not when it runs out), enemies can't pick the Assassin as a target for 2 s, though area attacks still hit it. Each synergy shows its name the first time it takes effect in a battle, and joins your Combo Codex then.

Each signature combo also adds 10 Momentum. In detail: Feigned Retreat slows the enemies within 160 of a retreating troop when it turns to Focus, for 4 s. An Ambush across a chain moves the reserve the last card called in. Overload's self-damage never takes a troop's last point of HP. Hammer and Anvil's stun starts when the push ends. Iron Shell reflects only while the Hold lasts.

**4. Finishers (from Rank IV).** Fire your ultimate as the last link of a chain of 3 or more and it gains +50% power. The cards before it count: two chained cards, then the ultimate, is a Finisher.

**Combo Codex.** Lists the signature combos, the Finisher and the troop synergies, each hidden until you first land it (a synergy, until it first takes effect). Example with the Strategist: Fall Back, then Focus (Feigned Retreat), then Gravity Well pulls the chasing enemies together for a Finisher.

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

**Command XP in detail (session 5A).** Every battle earns Command XP: 50 for a win, 30 for a draw, 20 for a loss, plus 5 for each Perfect timing (up to 6 a battle), 10 for each signature combo (up to 5) and 15 for each Finisher; since session 5E a campaign battle's Battle IQ grade adds 20 (A), 10 (B) or 5 (C). Ranks need 300 XP in all for Rank II, 800 for III, 1,500 for IV and 2,500 for V, so a typical win (about 70 XP) means four to fourteen battles a rank: about one region each. A new player starts at Rank I, and only XP raises the rank. On the Skirmish screen you can practise at any rank instead ("Your rank"); a practice battle earns no XP. Since session 5B only campaign battles earn XP (a lost one too); skirmish is for practice. The result screen shows what the battle earned and, on a rank up, what the new rank brings.

**The Legendary slot in detail (session 5A).** Slot 5 opens with your first boss win and holds one Legendary card: a card with exactly one Legendary action you have learned, plus any regular steps your rank allows. Legendary actions go nowhere else. The Legendary step counts toward your rank's steps per card and costs 3 pips like any Legendary action, so the design's Rank V card (Swap, Protect, Focus) costs 5. The commander does a Legendary action at once when the card fires, before its other steps become troop orders; a card waits (it can't fire) while its Legendary action has nothing to work on. A Perfect timing makes Hijack and Fortify last 25% longer and Echo repeat at that power. The Hive Mother never drops a Legendary step when she shortens a card. A ruler counts as beaten once you win their boss fight at the end of a run (session 5D).

- **Hijack** (any enemy target): the troop fights for you for 5 s. It attacks the nearest troop of its own army and uses no skills; its army doesn't fight back, and your troops and cards leave it alone. A ring in your color marks it.
- **Swap** (who, and the ally to trade with): the ally the card names and the nearest of "who" to it trade places at once.
- **Blood Pact** (one of your troops): it is given up (it falls, killed by no one), and your pips and Momentum fill up. It never gives up your last troop: the card waits instead.
- **Fortify** (forward, back, behind the enemy, or in front of an ally): a wall line 160 long and 20 thick rises across the way between the armies, 110 in front of (or behind) your army's middle, 90 behind theirs, or 50 in front of the ally toward its nearest enemy. It has 400 HP, blocks movement and shots like any wall, and falls after 8 s. Troops where it rises step out of it to their own army's side, so it parts the armies instead of trapping anyone.
- **Echo** (nothing to choose): your last regular card again, as your General read it and aimed at the same units that set it off, for free. It waits until a card has fired.

You write Legendary orders like any other ("hijack their ranger", "swap my vanguard into my ranger's spot", "sacrifice my weakest troop", "build a wall in front of my rangers", "repeat my last card") or build them from the menus on slot 5. The rule parser reads them, and since session 6A so does the order reader ("take control of their archer", "do that again"). Both refuse what the rules don't allow: Hijack, Blood Pact, Fortify and Echo are yours alone, so an order that names troops for them is refused, and Swap only ever trades places between two of your troops.

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

An army is 5 active troops plus 3 in reserve. You start with Vanguard, Ranger and Guardian; Invoker and Assassin are unlocked in the campaign. In a skirmish, the Skirmish screen (see Skirmish below) picks the class of every troop and reserve, one specialization per class (all troops of a class share it), and the battle: the map, both Generals, the enemy's army and its commander. In the campaign your troops are your company and your run's fighters, and the Tech Web sets the specializations (session 5E).

**Invoker in detail.** It keeps its distance like a Ranger (it backs away from enemies closer than 80) and shoots the nearest enemy. When the Rift is ready, it looks for the enemy within 230 with the most other enemies within 60 of it, and casts there if that is 2 or more (or everyone left). The cast takes 1.5 s, standing still; then a Rift of radius 60 opens on that spot for 4 s and hurts every enemy touching it every 0.5 s. A Shove, a stun, a silence, or losing 10% of its max HP during the cast breaks it: no Rift, and the skill is ready again 3 s later instead of 9 s. Overcharge opens the Rift at once, with no cast, on the biggest group anywhere. Invokers count as your backline, like Rangers and Guardians, for "when an enemy reaches my backline".

**Assassin in detail.** It hunts enemy Guardians first, then Rangers and Invokers, then anyone, the weakest of them (by share of HP left), and keeps its prey while the prey stays in the first group that has anyone. When Shadowstep is ready and its prey is within 240, it blinks to just behind the prey (as seen from where it stood) and strikes for 1.5 times a normal hit; a prey left below 15% of its HP dies on the spot. Every hit of an Assassin has a 20% chance to be a critical hit, 1.75 times as strong. It takes 50% more damage from area attacks: Rifts, Shoves, Volley splash and Fire Break burn. Overcharge Shadowsteps to its prey at any distance.

**Specializations in detail.**

| Specialization | What it does |
| --- | --- |
| Breaker | Moves 10% faster; Shove pushes 50% further and deals 50% more damage |
| Bulwark | An enemy shot that crosses its body on the way to another troop hits it instead; moves 10% slower |
| Sniper | Ignores 60% of armor, 20% more range and damage, attacks 20% slower |
| Volley | Each arrow also hits enemies within 45 of the target for half its damage; 15% less damage |
| Warden | Barriers 50% bigger; enemies within 80 of the shielded ally must attack that ally for 2 s |
| Mender | Barriers 40% smaller, but the shielded ally also heals 25 HP a second for 6 s |
| Pyromancer | Fire Rifts: 30% more damage |
| Frostcaller | Frost Rifts: enemies inside are 40% slower; 15% less damage |
| Blade | Shadowstep strikes for 2 times a normal hit and executes below 25% HP |
| Saboteur | Shadowstep silences its target for 4 s: no skills, not even from Overcharge, and a Rift cast breaks |

A taunted troop (Warden, Iron Wall) attacks its taunter whatever its card says; card orders take over again once the taunt ends. A slowed troop keeps the strongest slow on it.

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

- **Troop skill, Vampiric Link:** a troop drains its own health to give a nearby ally +250% attack speed for a few seconds.
- **Doctrine:** Vanguards attack the strongest enemy in reach; Assassins dive at once.
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

- **Troop skill, Assimilation:** when a troop kills an enemy, it steals that enemy's trait or grows an armor shell for the rest of the battle.
- **Doctrine:** troops move as a pack and gang up on one enemy at a time.
- **Ultimate, Forced Evolution:** merges two badly hurt troops into one mutated elite unit at full health.
- **Mana twist:** Feeding.
- **Writes your cards:** on instinct. Simplifies targets and may drop the last step of a long order.

### The Strategist (Voidweavers)

Position is power. Battlefield control.

- **Troop skill, Phase Shift:** once per battle, a troop about to take fatal damage teleports behind the attacker, stuns them and heals a little.
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

### How the Generals play in detail (session 4C)

Your General's troop skill and doctrine work on every troop you field, with or without cards; the ultimate and the mana twist work through your Command bar. The enemy army fights with its own General's troop skill and doctrine, and only an enemy commander (session 4D) fires its ultimate and pays for cards under its mana twist. You choose your General on the General screen (G on the troop screen) or on the Skirmish screen, among the Captain and the rulers you have recruited (session 5D); any General can lead the enemy in a skirmish.

- **Warlord.** Vampiric Link: a troop with at least half its HP, every 14 s (first after 6 s), pays 8% of its max HP to make the nearest ally within 140 that has an enemy in reach attack three and a half times as fast for 1.5 s. Doctrine: Vanguards attack the strongest enemy in reach (most HP left), else fight as usual (until session 6A they crossed the field for the strongest enemy, and kiting Rangers shot them on the way); Assassins start with Shadowstep ready and use it on their prey at any distance. Reaper's Toll: your troops below 20% HP become wraiths for 10 s: they take no damage and hit 50% harder, then fall. It waits until a troop is that low. Blood Price: a card you lack pips for still fires if your healthiest troop (by share of HP) can pay the missing pips with 10% of its max HP each and keep at least 1 HP; pips go first.
- **Engineer.** Venting: every 5th attack a troop vents, dealing 33 burn damage to every enemy within 55 and losing 1.5% of its max HP. Its attacks since the last vent are its heat. Doctrine, for the first 40 s of a battle only (so two Engineers can't wait each other out): Vanguards stay at their spot (where they started, or where a Move or Fall Back left them) unless an enemy comes within 260 of it; Rangers stand 45 behind the nearest Vanguard until an enemy is within their range plus 80. Thermal Detonation: every troop heals 8% of its max HP plus 3% per point of heat, then all the heat fires as a beam from the middle of your army through the middle of the enemy's, hitting every enemy within 30 of the line for 60 damage plus 12 per point of heat. Build-Up: max pips +1 at 30, 60 and 90 s.
- **Hive Mother.** Assimilation: a troop that kills grows a shell (+0.2 armor) from a Vanguard or Guardian, or claws (+25% damage) from any other class, for the rest of the battle (10 s until session 6A); a later kill can trade one for the other. Doctrine: the pack picks the enemy nearest to its middle and keeps it until it falls; Vanguards and Assassins go for it, Rangers and Invokers shoot it whenever it is in range, Guardians keep to their allies. Forced Evolution: your two most hurt troops (by share of HP) merge; the one with more HP left stays as an elite with both max HPs added, at full HP, 50% more damage and +0.1 armor, and the other is gone (it doesn't fall, so no kill is counted). It waits until 2 of your troops are below 50% HP. (Until session 6A it fired as soon as you had 2 troops and added their HPs: merging two healthy troops cost the Hive Mother more than it gave.) Feeding: pips refill at half speed, and every enemy that falls gives you a pip.
- **Strategist.** Phase Shift: once per battle, a blow that would make a troop fall misses; the troop takes no more damage that tick, and at the end of the tick it teleports behind its attacker, stuns it for 2.5 s and heals 7% of its max HP. Doctrine: Vanguards stand between the nearest non-Vanguard ally and the enemy closest to it; Rangers back away from enemies within 75% of their range while they reload. Gravity Well: every unit within 240 of the middle of the enemy army, yours too, is pulled up to 150 toward that point over 0.6 s and can't act meanwhile (Iron Wall Vanguards stand fast). Prepared: you start with full pips; they refill at 75% speed.
- **Conductor.** Echo Strike: every attack that lands adds a Vibration stack (up to 3, fading 4 s after the last hit); the 3rd shatters the enemy: 0.04 less armor for 4 s. Doctrine: a troop about to hit an enemy with 3 stacks hits the nearest enemy in reach with fewer instead (Assassins keep to their prey). Shatterstorm: every enemy with stacks takes 35 damage per stack, and the enemies within 60 of it half that; the stacks are used up. It waits until an enemy has stacks. Rhythm: a Perfect timing gives 2 pips back, and cards glow 2.5 s after their condition ends instead of 1.5 s.
- **Ultimates as Finishers** are 50% stronger: Rally heals and speeds more, wraiths last 50% longer, Thermal Detonation heals and burns more, the elite gets more damage, Gravity Well pulls further, Shatterstorm hurts more.

## Maps, enemy commanders and skirmish (session 4D)

**The region maps.** Every map is 960 by 540 with the same deploy zones, and is a mirror image left to right so neither side starts better off. Walls stop movement and shots until they break (500 HP unless the map says otherwise); rock and iron never break.

| Map | Terrain rule |
| --- | --- |
| Open Field | A few walls in the middle and on the flanks; no special rule |
| Deep Forest | Five woods across the middle. A troop whose middle stands in the woods is seen by an enemy only from within 100: from farther away it can't be attacked, or picked as a target by a pack or a card |
| Void Ruins | Thirteen broken walls of 200 HP cut every line across the middle; they block shots until shot down, which doesn't take long |
| Red Canyon | Two bands of rock that never break leave three narrow paths: top, middle and bottom |
| Iron Fortress | Each army stands behind an iron wall that never breaks, with two gates out; one breakable wall stands in the middle |
| Glass Plains | No walls at all; troops that shoot (Rangers, Guardians, Invokers) reach 15% further |

Two small rules keep battles from stalling on these maps. A troop that sees no enemy walks toward the nearest one hiding in the woods (it knows roughly where they are, but can only attack once it sees them). A troop whose shot would only hit rock or iron walks toward its target until it has a clear line; shots at walls that break still go ahead, since they wear the wall down. On the battle screen, an enemy none of your troops can see is only a faint shape, with no HP bar.

**Enemy commanders.** An enemy commander has a Command bar like yours, at its rank: pips, Momentum, slots, chains and combos, plus its General's mana twist and personality rules (the cards go through the validator, then the personality rules, like yours). Its cards are Auto cards from a simple script, best first, so a rank with fewer slots keeps the best:

1. Its General's signature card: the Captain's Vanguards Overcharge (Shove) when a Vanguard drops below 70%; the Warlord's army focuses the weakest enemy when an ally drops below 60%; the Engineer's army falls back, then holds, when an ally drops below 60%; the Hive Mother's pack focuses the nearest enemy when an ally drops below 70%; the Strategist falls back, then focuses the nearest (Feigned Retreat), when an ally drops below 50%; the Conductor's Guardians protect the Vanguards, then hold (Iron Shell), when your ultimate charges.
2. When an enemy reaches its backline, everyone focuses that enemy.
3. When an ally drops below 40%, the Guardians protect it.
4. When an ally drops below 30%, it calls a reserve.

None of these is met while the armies still stand in their starting lines, so no card is spent before the fight. A lower-rank commander keeps the first steps of a card its rank allows and drops actions it hasn't unlocked (the Strategist's Feigned Retreat is only a Fall Back at Rank II); a Rank I commander can't set cards to Auto, so it fires only its ultimate. The commander fires its ultimate the moment it is ready. "When their ultimate charges" is met once the other side's Momentum is at 80% or more, both for your cards and the commander's. Without a commander the enemy fires no cards and no ultimate.

**Skirmish.** Until the campaign, any General and army can fight any other on any map. The Skirmish screen (T on the troop screen) sets your 5 troops and 3 reserves, a specialization per class, the map, your General, the enemy General, the enemy army (the starter army, or a mirror of your troops, reserves and specializations) and the enemy commander (none, or Rank I to V). Your choices are saved. The troop screen draws the chosen map with its terrain rule and names who leads the enemy; in battle the top bar shows the enemy General, its commander's pips and Momentum (CHARGING! from 80%), the cards and combos it fires, and a banner when its ultimate goes off.

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

**Runs (roguelite).** Entering a region starts a run: a branching path of battles, elite fights, events, a merchant and rest camps, ending at the ruling General. A run starts small and grows with every fight, like a roguelite: it is never hard from the start, and you get stronger as the enemies do. (The owner asked for this in session 5A.)

- **Start:** your General, your cards and your Command Rank (all kept between runs), and a starting squad: the 5 starter troops and 3 reserves.
- **Difficulty grows along the path:** the first fights are small (about 3 enemy troops, no commander); later ones bring full armies, then enemy commanders of rising rank. Elite fights field a Rare or Epic fighter and a commander, and the boss brings their whole style.
- **Spoils after every won fight:** gold, and a pick of 1 of 3 offers: a **fighter** who joins your army for the run, or a **boon**, a buff that lasts the run. You can skip the pick for a little more gold. Elites and bosses offer better rarities.
- **Rarity:** every fighter and boon is Common, Rare, Epic or Legendary. Each offer rolls its rarity with a chance (starting values 60%, 28%, 10% and 2%) that shifts toward the rare ones deeper in the run and after elite fights. Rarer fighters have better stats and a perk; rarer boons are stronger.
- **Fighters and factions:** a fighter is a troop of one of the 5 classes with a faction: Bloodbound, Forgeborn, Hive, Voidweavers or Resonance (the Generals' factions), or none. Two, four and six fighters of one faction in your army switch on that faction's bonus, in the spirit of its General (the Bloodbound heal from the damage they deal, the Forgeborn harden as they heat up, and so on). Drafting one faction makes it strong; mixing keeps more class synergies.
- **Your army in a run:** every fighter you pick joins your run roster; before each fight you choose 5 to field and 3 reserves, and the rest wait.
- **Boons:** troop boons (a class hits harder, a skill comes back sooner), Command boons (a starting pip, faster refills, more Momentum) and faction boons (each counts as one more fighter of its faction). Since session 5F, duo boons too: see Oaths, scouting and duo boons.
- **Merchant and camps:** the merchant sells fighters and boons for gold (priced by rarity), heals wounded troops and rerolls offers. Rest camps heal and bank artifacts.
- **What a run keeps:** win or lose, you keep the Command XP and Insight you earned. Fighters, boons and gold last for the run. Artifacts are kept once banked at a camp or when you win; lose the run first and you lose the ones you were carrying. Beating the boss recruits that General and teaches their Legendary action. Fighters who finish a won run can stay in your company as veterans (session 5E).

**World map and runs in detail (session 5B).** All numbers are starting values to tune; they live in `src/data/regions.ts`, `runs.ts`, `rarity.ts`, `boons.ts`, `events.ts` and `artifacts.ts`.

- **The Capital** is the first screen: the five regions around it, your Command Rank, the Legendary actions you know and your banked artifacts. Deep Forest and Void Ruins are open from the start; each ruler beaten opens one more region, in the order Red Canyon, Iron Fortress, Glass Plains. A cleared region can be run again for XP. You are on one run at a time: leave it waiting in the Capital and carry on later, or abandon it, which counts as a lost run. The General, Codex, Skirmish and Settings screens open from the Capital.
- **A run's map** comes from its seed: 7 floors of 2 to 4 nodes side by side, then the boss alone. Each node leads to one or more nodes on the next floor and no paths cross. The first floor is all battles and the second battles and events; from the third, a node can also be an elite fight, a merchant or a rest camp (by weight: battle 46, event 26, elite 12, merchant 8, camp 8). The fourth floor always has a merchant on one of its paths, and the seventh is all rest camps. Every roll in a run (map, enemies, offers, events) comes from the run's own seeded generator, so a run plays out the same for the same seed and the same choices.
- **Enemies** are the ruler's troops (by the region's own mix of classes) on the region's map, led by the ruler as the enemy General. They grow along the path:

  | Floor | Troops | Reserves | Commander | Epic | Rare |
  | --- | --- | --- | --- | --- | --- |
  | 1 | 3 | 0 | none | 0 | 0 |
  | 2 | 4 | 0 | none | 0 | 0 |
  | 3 | 5 | 0 | none | 0 | 1 |
  | 4 | 5 | 1 | Rank I | 0 | 1 |
  | 5 | 5 | 2 | Rank II | 0 | 2 |
  | 6 | 5 | 3 | Rank II | 1 | 2 |
  | Boss | 5 | 3 | Rank II | by ruler | 3 |

  An elite fight is its floor's army with a commander one rank higher (at least Rank II), one more Epic and one more Rare troop. The boss brings the ruler's own army of 8, with Epic troops by ruler since session 6A, so each boss fight is tuned on its own: the Hive Mother 3 (her region comes first), the Strategist 1 (her army holds the line with two Vanguards), the Warlord 5, the Engineer 1 (her turrets do the rest) and the Conductor 3. Each ruler you had beaten when the run began makes its commanders one rank higher (up to V) and adds one Rare troop; fights with no commander keep none. Without a commander the enemy fires no cards or ultimate, so the first fights are gentle. Played with the bare starter squad and no cards, the first floor is won every time, the second about 95% of the time and floors 3 to 6 about 70 to 90%.
- **Rarity:** Common 60%, Rare 28%, Epic 10%, Legendary 2%. A Rare troop has 10% more HP and damage, an Epic 20%, a Legendary 35%; enemy troops too. A ring in the rarity's color marks it (blue, purple, gold). Since session 5C rarer fighters also have perks, and the chances shift toward the rare ones deeper in a run and after elite fights (see below).
- **Your army in a run** starts as your company (session 5E; at first the starter squad: the 5 starter troops and 3 reserves, all Common), and no gold. Before each fight the Army screen sets who takes the field (up to 5), who waits in reserve (up to 3) and who sits it out; a new fighter takes the field if there is room, else the reserve, else waits. Wounds carry over: after a won fight each fighter keeps the share of HP they ended with, and one who fell gets back up at 25% and sits the next fight out (session 5E; in Ironman mode it dies). Your fighters remember where you placed them. Your cards, General, rank and Tech Web are your own and carry over between runs.
- **A lost fight ends the run** (a draw counts as lost); beating the ruler wins it.
- **Spoils** after a won battle: 18 gold, plus 3 for each floor, plus 0 to 9 by chance; an elite pays 40 instead of 18 and brings an artifact. Then a pick of 1 of 3 offers, each a fighter (a 50% chance) or a boon, of a rolled rarity, or skip them for 15 gold. Fighters come in the classes you have unlocked: Vanguard, Ranger and Guardian, plus the Assassin once the Hive Mother is beaten and the Invoker once the Strategist is. A boon offer is one you don't have yet that helps your army: a class in it, a faction in it, or every troop; if none is left at the rolled rarity, the nearest rarity below, else a fighter. Plunder (a boon) adds 10 gold to every won fight.
- **Boons:** the full list of 30 is under Fighters, factions and boons in detail (session 5C).
- **The merchant** sells 3 fighters and 2 boons, each of a rolled rarity: fighters for 30, 55, 90 or 140 gold by rarity, boons for 35, 60, 95 or 150. Healing every fighter to full costs 25; a new stock costs 15, then 10 more each time.
- **A rest camp** heals every fighter 50% of their HP and banks the artifacts you carry.
- **Artifacts** (10, see Growing your army in detail) come from elite fights and some events. You carry them until a rest camp or a won run banks them for good; a lost run loses the ones you carry. Banked artifacts are equipped on your company's troops in the Capital (session 5E).
- **Events** (10), each a short story and two or three choices; a choice you can't pay for, or that needs something you don't have, can't be taken, and a run meets each event once until it has seen them all:

  | Event | Choices |
  | --- | --- |
  | The Old Shrine | +60 gold · one fighter rises a rarity · every fighter loses 20% HP for an artifact |
  | Sellswords by the Road | −60 gold for a Rare fighter · every fighter loses 15% HP for a Rare boon · walk on |
  | Deserters | two Common fighters join at half HP · +35 gold |
  | Field Hospital | every fighter heals 40% · −30 gold to heal fully · a Rare Guardian joins |
  | The Black Blade | an Epic boon, and every fighter loses 25% HP · leave it |
  | Gamblers' Tent | bet 30 gold on even odds to win 75 · +40 gold, and every fighter loses 10% HP · walk away |
  | Abandoned Armory | one fighter rises a rarity · +45 gold |
  | The Recruiter | a fighter leaves at random and an Epic fighter joins · decline |
  | Storm on the Pass | every fighter loses 15% HP, +40 gold · every fighter heals 15% |
  | The Wandering Tactician | −45 gold for a Rare boon · trade a boon at random for an Epic one · decline |

  Events never hurt a fighter below 10% HP, and never take your last fighter. Where an event's boon or artifact has none left to give, it gives gold instead.
- **Command XP:** only campaign battles earn it, win or lose; skirmish is practice at any rank, for none.
- **The boss:** the ruler's army as above, with the ruler's own boss rule (see Boss fights in detail). Beating them wins the run and counts the ruler as beaten: they join you as a General, you learn their Legendary action, the next region opens and a class may unlock.

**Fighters, factions and boons in detail (session 5C).** Starting values to tune, in `src/data/factions.ts`, `perks.ts`, `boons.ts` and `rarity.ts`.

- **A fighter** is a class, a rarity, a faction (or none) and perks. The starter squad are Common fighters of no faction. A fighter on offer (spoils, the merchant, events) comes in a class you have unlocked and rolls its faction: none by weight 1, each faction by weight 1 plus 0.5 for every fighter of it already in your run, so the factions you draft keep turning up. Names read "Epic Hive Assassin"; a dot in the faction's color marks the fighter on every screen.
- **Perks:** a Rare or Epic fighter has one, a Legendary fighter two, all different, rolled with the fighter. Tough (15% more HP), Fierce (12% more damage), Swift (moves 20% faster), Quick (attacks 12% faster), Hardened (6% more armor), Keen-eyed (reaches 12% further), Leech (heals 10% of the damage its attacks deal), Drilled (its skill comes back 25% sooner). A fighter who rises a rarity (an event) keeps its perks and gains one if its new rarity has room.
- **Faction bonuses:** your army (the fighters on the field and in reserve, plus faction boons) counts its fighters of each faction. At 2, 4 and 6 the faction's bonus switches on, stronger at each step, for the troops of that faction:

  | Faction (General) | Bonus | 2 | 4 | 6 |
  | --- | --- | --- | --- | --- |
  | Bloodbound (Warlord) | Heal this share of the damage their attacks deal | 20% | 35% | 60% |
  | Forgeborn (Engineer) | Harden as they heat up: each attack adds 1% armor, up to | 2.5% | 4.5% | 6% |
  | Hive (Hive Mother) | Hit harder for each other Hive troop still standing | 3% | 3% | 3.5% |
  | Voidweavers (Strategist) | Phase out of every Nth hit from an attack, taking nothing | 16th | 12th | 10th |
  | Resonance (Conductor) | Every 3rd attack resonates for this much more damage | 25% | 25% | 30% |

  Area damage (Rifts, Shoves, splash) is not an attack: Voidweavers can't phase out of it, and lifesteal doesn't heal from it. A troop that phases out shows "Phased!". In a mirror fight of starter armies the faction side wins about 57 to 72% of the time with 2 fighters, 78 to 81% with 4 and 85 to 90% with 6 (session 6A's balance script). The Army screen shows each faction's count and what it switches on. Enemy fighters have no faction yet.
- **Offer chances** move with the run, in percentage points, for each floor past the first: Common −4, Rare +2.5, Epic +1.2, Legendary +0.3; the spoils of an elite fight move them once more: Common −15, Rare +8, Epic +5, Legendary +2. On the sixth floor that is 40/40.5/16/3.5, and after an elite there 25/48.5/21/5.5. The merchant uses its floor's chances; events give the rarity they name.
- **The 30 boons:**
  - Common: Whetstones (Vanguards +15% damage), Fine Fletching (Rangers +15% damage), Thick Plating (Guardians +20% HP), Focus Crystals (Invokers +15% damage), Poisoned Blades (Assassins +15% damage), Field Rations (every troop +8% HP), Quick March (every troop moves 10% faster), Shove Drills, Marking Chalk, Barrier Runes, Rift Lenses and Shadow Cloaks (one class's skill comes back 25% sooner: Shove, Mark, Barrier, Rift, Shadowstep), Plunder (10 more gold from every won fight).
  - Rare: Drill Sergeant (every troop attacks 10% faster), Head Start (every battle starts with 1 more pip), War Drums (every battle starts with 30 Momentum), Shield Wall (Vanguards and Guardians +15% HP), and a faction boon for each faction, counting as 1 more fighter of it: Blood Oath, Forge Brand, Hive Spawn, Void Sigil, Tuning Fork.
  - Epic: Supply Lines (pips refill 25% faster), Veteran Core (every troop +12% damage and HP), Bloodthirst (every troop heals 8% of the damage its attacks deal), Quartermaster (you can hold 1 more pip), Battle Hymn (every troop's skill comes back 20% sooner).
  - Legendary: Conqueror's Banner (every troop +20% damage, and battles start with 50 Momentum), Legion's Standard (counts as 2 more fighters of the faction you field most of; the first in faction order on a tie), Endless Supply (1 more pip to hold, and pips refill 20% faster).

  Bonuses to the same stat add up, rarity's and perks' included. A skill never comes back more than twice as fast. A faction boon is only offered once your run has a fighter of that faction, and Legion's Standard once it has any.

**Boss Generals.** Each boss tests one idea instead of having huge HP:

- **Hive Mother:** her troops steal traits from your kills, so you protect weak troops and use Fall Back.
- **Strategist:** her troops phase out of your burst, so you save your ultimate until their Phase Shifts are spent.
- **Warlord:** his army gets stronger with every death, so you kill his troops together, not one by one.
- **Engineer:** hides behind walls and turrets, so you need area damage or Assassins to break in.
- **Conductor:** stacks Vibration on your army, so you spread out and interrupt her before Shatterstorm.

Beat a General and they join you, and you learn their Legendary action: you can now play the strategy that once beat you.

**Boss fights in detail (session 5D).** Starting values to tune, in `src/data/bosses.ts`. The boss is a run's last node: the ruler's army of 8 on their region's map, led by their commander, with one rule that only their boss fight has. The Army screen shows the rule and how to beat it before the fight, and the battle opens with a banner naming it.

- **Hive Mother:** each of your troops her army kills gives every troop of hers still standing that class's trait, for the rest of the battle: +0.04 armor from a Vanguard, 8% more damage from a Ranger, 12% more max HP (and as much HP) from a Guardian, 8% faster attacks from an Invoker, 12% faster moves from an Assassin. A troop of yours that falls to anything else gives nothing.
- **Strategist:** each of her troops phases out of its first 2 big hits and takes nothing from them; a hit is big when, after armor, it would take 20% of the troop's max HP or more. Smaller hits always land.
- **Warlord:** every troop of his that falls sends the rest into a rage for 8 s: 20% more damage and 15% faster attacks per stack, up to 4 stacks. Each death adds a stack and restarts the 8 s.
- **Engineer:** two turrets stand at the back corners inside her walls, on top of her army of 8: Rangers that never move, with 10% more HP, +0.05 armor and 5% more reach, that take twice the area damage (30%, +0.1 and 15% until session 6A, when the turrets alone won her fight). With her commander's Fall Back and Hold, her army retreats to them.
- **Conductor:** every Vibration stack her troops land also goes to each of your troops within 45 of the one hit, and every stack she lands, spread ones included, gives her commander 0.8 Momentum toward Shatterstorm.

**Recruiting.** You start with the Captain. Beating a ruler's boss fight for the first time recruits them: from then on you can lead with them, chosen on the General screen, where Generals you don't have yet are locked and say where to beat them. A save that names a General you haven't recruited leads with the Captain.

**Growing your army**

- **Command Ranks:** what your orders can say (see Command progression).
- **Tech Web:** each class has a branching upgrade web bought with Insight, earned every battle. You choose one specialization per class and can respec for free between runs.
- **Artifacts:** rare items that change how a troop behaves, such as a Lifesteal Core. One slot per troop, equipped in the Capital.
- **Veterans:** every troop is a named individual with a record of battles, kills and boss kills. Ranks go Recruit, Veteran, Elite; each adds one small perk. From Rank III your orders can name them ("Raven, take their healer"). A fallen troop sits out one battle; Ironman mode makes death permanent.
- **General Mastery:** three challenges per General, such as winning with fewer than 3 cards fired. Rewards are titles and new looks.
- **Hard choices:** event nodes force a trade-off, such as taking gold, upgrading a troop now, or giving up 20% HP for a legendary artifact.

**Growing your army in detail (session 5E).** Starting values to tune, in `src/data/tech.ts`, `artifacts.ts`, `veterans.ts`, `mastery.ts` and `battleIq.ts`.

- **Insight:** every campaign battle earns it, win or lose: 3 for a win, 2 for a draw, 1 for a loss. You keep it when a run ends.
- **Tech Web:** each class has five nodes. Drills (8% more HP, 2 Insight) and Better Arms (8% more damage, 2) come first, in either order; either one opens the class's two specializations (4 each), of which you take one; the specialization opens Honed Skill (the class skill comes back 15% sooner, 6). What a class has works on every troop of that class in your campaign battles, reserves included, and its specialization is the class's specialization there. A class's web can be bought only once the class is unlocked; you can buy during a run, but take a class's web back (for all its Insight, free) only between runs. In a skirmish you still pick specializations freely, and the Tech Web's other nodes don't apply.
- **Artifacts:** 10. Lifesteal Core (heals 15% of the damage it deals), Iron Heart (25% more HP), Courier's Boots (moves 25% faster), Eagle Eye (reaches 15% further), War Horn (its skill comes back 30% sooner), Stoneskin Charm (+0.08 armor), Berserker's Torc (25% more damage, 10% less HP), Quickdraw Gloves (attacks 15% faster), Phoenix Feather (once a battle, instead of falling it gets back up with 30% HP) and Warding Cloak (35% less area damage). Between runs, in the Capital's Company screen, you put each banked artifact on one troop of your company, one per troop; the troop carries it into every battle of its runs. An artifact on a troop who leaves the company goes back to your bank.
- **Your company and its veterans:** the troops you set out with on every run, up to 8 (the first 5 take the field, the next 3 the reserve). A new save starts with eight named Recruits in the starter army's classes; an empty place is filled with a fresh Recruit when you set out. Every fighter, company troop or newcomer, has a name and a record: battles fought (on the field, or called in from reserve), kills, and kills in boss fights. Ranks come with battles: Recruit, Veteran from 4, Elite from 10; reaching Veteran and Elite each adds a perk the troop doesn't have yet. After a won run, you choose who stays in your company, up to 8, from everyone who finished it (your company first, then the rarest and most seasoned, unless you change it); the rest leave. After a lost run your company comes home, records, rank perks and rarity included, and the run's newcomers leave.
- **Wounds and Ironman:** a fighter who falls in a won fight gets back up at 25% HP and sits the next fight out: it leaves the field and the reserves, a reserve steps up to its place on the field, and a waiting fighter fills the reserve. Ironman mode, switched in the Company screen between runs and set for the whole run, makes a fall permanent: the fighter dies and leaves your company, during the run or (for those who fell in a lost run's last fight) when it ends.
- **General Mastery:** three challenges per General, each met by winning a campaign battle while leading with them. Each gives a title (the Capital shows your latest); all three give the General's look, a gold trim on your troops when you lead with them.

  | General | Challenges (titles) |
  | --- | --- |
  | Captain | Win firing 2 cards or fewer (the Calm) · win without losing a troop (the Shepherd) · land 3 Perfect timings in one win (the Punctual) |
  | Warlord | Win in under 60 s (the Swift Blade) · win after losing 3 or more troops (the Unbowed) · fire your ultimate twice in one win (the Reaper) |
  | Engineer | Win without firing a card in the first 30 s (the Patient) · land a Finisher in a win (the Architect) · win without losing a troop (the Ironclad) |
  | Hive Mother | Win in under 75 s (the Ravenous) · win after losing 4 or more troops (the Undying Swarm) · fire your ultimate twice in one win (the Evolved) |
  | Strategist | Land 5 Perfect timings in one win (the Foresighted) · land 2 signature combos in one win (the Schemer) · win without losing a troop (the Flawless) |
  | Conductor | Land 3 signature combos in one win (the Virtuoso) · land a Finisher in a win (the Crescendo) · land 4 Perfect timings in one win (the Metronome) |

- **Battle IQ report:** after every battle (skirmish too), read from its event log. The battle logs two more moments for it: when your ultimate becomes ready, and when your pips fill up.
  - *Biggest mistake*, the heaviest of: your ultimate sitting ready 5 s or more before you fired it (or never fired); your pips sitting full 8 s or more before a card spent them; troops lost in the first 20 s.
  - *Best decision*, the best of: a Finisher, a signature combo, an ultimate followed by 2 or more kills within 4 s, your Perfect timings, a card followed by kills within 4 s.
  - *Missed chance*: two cards fired the other way round from a signature combo (from Rank III, when combos can cross cards), two cards fired within 6 s but too far apart to chain, an ultimate left ready at the end, or no cards fired.
  - *Enemy weakness*: the enemy class that fell first (most of it, earliest), with how to punish it.
  - *Grade*: a score from 50, +20 for a win, +4 per Perfect timing, +8 per combo, +10 per Finisher, −1 per second the ultimate sat ready past 5 s, −0.5 per second the pips sat full past 8 s, −8 per troop lost in the first 20 s; A from 85, B from 65, C from 45, else D. In a campaign battle A earns 20 Command XP, B 10 and C 5.
- **Not built yet:** naming a veteran in an order ("Raven, take their healer", from Rank III) needs the order reader to learn names; it is left for a later session.

## Oaths, scouting and duo boons (session 5F)

After a look at Hades II, Thronefall, Nordhold, 9 Kings, Skul and The King is Watching (`docs/inspiration.md`), three things from them, chosen by the owner. Starting values to tune, in `src/data/oaths.ts` and `src/data/boons.ts`.

- **Oaths of Command** (Hades II's Oath of the Unseen, Thronefall's mutators). In the Capital, O (or the button under Set out) opens the oaths for your next run: vows that make it harder, each rank adding Fear. A run keeps the oaths it began with; you change them for the next one at any time.

  | Oath | Each rank | Ranks | Fear a rank |
  | --- | --- | --- | --- |
  | Veteran Foes | Every enemy army has 1 more Rare troop | 3 | 1 |
  | Elite Guard | Every enemy army has 1 more Epic troop | 2 | 2 |
  | Cunning Commanders | Enemy commanders are 1 rank higher (up to V); fights with no commander keep none | 2 | 2 |
  | Tyrant's Wrath | The ruler's army has 2 more Epic troops and a commander 1 rank higher | 2 | 2 |
  | Lean Purse | 25% less gold from fights and for skipping the spoils | 2 | 1 |
  | Lasting Wounds | A fighter who falls gets back up with 10% HP instead of 25%, and camps heal half as much | 1 | 2 |
  | Short Supply | The merchant asks 50% more, for everything | 1 | 1 |
  | No Quarter | The spoils offer 2 picks instead of 3 | 1 | 1 |

  All of them together are Fear 21. Fear pays: every battle of the run earns 10% more Insight for each point of Fear (rounded), and winning a region's run above its highest Fear yet pays 3 Insight for every point above it (the first win counts from 0). The Capital shows your Fear and each region's highest; the run map shows the run's Fear, and the end of a run its Fear and any bounty.
- **Scouting** (Thronefall, Nordhold). Every fight on a run's map is fixed when the map is made, each node from its own seed, so picking a fight node on the map shows the army waiting there before you go: whose it is, how many troops and reserves, how many are Rare, Epic or Legendary, any turrets, and its commander. Taking the node brings exactly that army. Oaths are counted in what you see. (Until session 5F a fight was rolled when you reached it.)
- **Duo boons** (Hades II's duo boons, 9 Kings' mixed decks). One for each pair of the five factions, ten in all, each Epic. A duo boon is offered only once both of its factions' bonuses are on in your army (2 fighters of each on the field or in reserve, faction boons counted): then each boon offer in the spoils is a duo boon 35% of the time, one you don't have yet. The merchant never sells them. Each counts as one more fighter of both its factions, which can push both toward their next step, and adds an effect of its own:

  | Duo boon | Factions | Its own effect |
  | --- | --- | --- |
  | Blood Forge | Bloodbound + Forgeborn | Every troop heals 5% of the damage its attacks deal |
  | Feeding Frenzy | Bloodbound + Hive | Every troop deals 8% more damage |
  | Phantom Pain | Bloodbound + Voidweavers | Every troop attacks 8% faster |
  | War Pulse | Bloodbound + Resonance | Every battle starts with 25 Momentum |
  | Chitin Plate | Forgeborn + Hive | Every troop has 10% more HP |
  | Null Engine | Forgeborn + Voidweavers | Every troop's skill comes back 15% sooner |
  | Harmonic Anvil | Forgeborn + Resonance | You can hold 1 more pip |
  | Swarm Phase | Hive + Voidweavers | Every troop moves 15% faster |
  | Hive Chorus | Hive + Resonance | Pips refill 15% faster |
  | Echo Rift | Voidweavers + Resonance | Every battle starts with 1 more pip and 10 Momentum |

## The Captain's tips (session 6A)

The tutorial is the Captain, your first General, talking you through your first battles. Each tip is a line or two in a small box, said once, the first time its moment comes; it fades by itself after 12 s (8 s in battle) or at a click, and never takes a key, so the screen under it works as usual. Tips stop once each has been said.

- **On the screens of a run:** the Capital (what a region and a run are), the run's map (what the stops are), the Army screen (field and reserve), placing troops, writing orders (an order in plain words becomes a card for keys 1 to 5; B starts the battle) and the result (the Battle IQ report and its grade).
- **In battle,** most pressing first: the battle starting (troops fight on their own; fire ready cards by their number), the ultimate ready (press U; cards fired one after another chain into combos), a card ready (press its number; fire a glowing card for a Perfect), a troop lost (Call Reserve and Protect cards), and the pips full (spend them).
- **Settings** turns the tips on or off, and Enter there plays them all again from the start. A new save has them on.

The texts are in `src/data/tutorial.ts`.

## Balance (session 6A)

`npm run balance` plays thousands of headless battles per matchup (1,000 by default, on every core) and reports each matchup's win rate with its 95% margin, how big the wins are (the HP edge: the share of its HP the winner keeps, on average), the draws and the average length, and flags what wins too often or too rarely for its fair range. Each battle runs exactly as in the game, from a seed; the player side fires its ultimate the moment it is ready, and commanders fire their scripted cards.

- **Generals:** every General against every other and itself, both with a Rank III commander, the starter armies and reserves. Fair: 40% to 60%.
- **Specializations:** each against none, and against its class's other one, with every class on the field and no commanders. Fair: 50% to 72% against none (a specialization should help a little), 40% to 60% against the other.
- **Factions:** 2, 4 and 6 fighters of a faction against the same army with none. Fair: 52–72%, 58–82% and 62–90%.
- **Bosses:** a strong run army (one Epic and four Rare troops, three reserves, a Rank III commander) against each ruler's boss fight, with and without the boss rule. Fair: 30% to 85% with it.

In the first three, every troop starts up to 30 px off its spot, by the seed: without that, the same two armies fight nearly the same battle on every seed, and a tiny edge wins almost all of them. Mirror matchups swap sides on every other seed. A matchup is flagged only when it is outside its fair range by more than its margin. Number changes the script suggests are proposed in the session's pull request with their measured effect, and applied only once the owner agrees. The first report is `docs/balance-6a.md`: it found 26 matchups out of range, and with the owner's go-ahead its changes (numbers, and new rules for Forced Evolution, Assimilation, Phase Shift, the Warlord's doctrine and each ruler's own boss army) leave none.

## Art and sound (session 6B)

Generals is drawn in pixel art and sounds like a small synthesizer: every picture is a grid of pixels written as text in `src/game/art`, every sound and every note of music a recipe in `src/game/audio`. Nothing is downloaded and there are no image or sound files; `npm run art:preview -- sheet.png` draws every sprite and map ground onto PNG sheets for checking.

- **Troops** are 16×16 sprites drawn twice their size, one drawing per class in its side's colors (blue for you, red for the enemy): the Vanguard a plumed knight with a kite shield, the Ranger a hooded archer, the Guardian a cleric with a round shield and a gold cross, the Invoker a mage with a tall hat and an orb staff, the Assassin a masked rogue with two daggers; the Engineer's turrets are crossbows on stone towers. Each class has a standing frame and two walking frames; a standing troop breathes, a walking one steps and bobs, a melee blow leans toward its target with a white swing, a shot rocks the shooter back, and a hit makes the troop flash bright. A troop faces whoever it fights. A fallen troop is left lying, greyed, where it fell. Elites (Forced Evolution) are drawn a quarter bigger; wraiths (Reaper's Toll) turn violet and faint.
- **The ground** of each map is its own: grass and flowers on the Open Field, dark grass and woods packed with trees in the Deep Forest, purple flagstones and crystals in the Void Ruins, red earth and rocks in the Red Canyon, laid stone in the Iron Fortress and pale glassy ground with shards in the Glass Plains. A dashed worn line marks the middle (and, since the visual overhaul, a worn dirt band on the grass and canyon maps). Scenery never sits on a wall or in a forest, and a map always looks the same. Walls are stone bricks (cracking as they wear down, then rubble), a Fortify wall is a wooden palisade, and unbreakable walls are canyon rock or fortress iron plate, each with a shadow.
- **Effects:** sparks on a blow (fire for burns, magic for Rifts, ice-blue when a Barrier soaks it), smoke when a troop falls, dust and stones flying when a wall breaks, a burst on each skill, gold for an Evolution or a Phoenix Feather, motes circling in a Rift, and arrows and turret bolts flying turned along their path (burning or frozen ones tinted). An ultimate flashes the field in its side's color and shakes it; a breaking wall shakes it a little.
- **Portraits:** each General has a 16×16 portrait in their faction's colors: on the General screen, in the Capital beside each region's ruler, beside both armies in battle, and the Captain's in his tips.
- **Icons:** the run map's stops (crossed swords, a skull for an elite fight, a question mark, a coin bag, a campfire, a crown) and the Capital's regions (a pine, a void crystal, a canyon rock, a fortress, a glass shard, and a castle for the Capital).
- **Sound effects,** each a few synthesized voices: blows, heavy hits, arrows, Barrier blocks and pings, magic, Marks, Shadowsteps, Venting, Shatter, healing, deaths, walls hit and breaking, your cards (brighter) and the enemy's (lower), a Perfect's sparkle, chains, combos, the ultimate's boom and its ready chime, a reserve's horn, the battle's start, Overtime's alarm, a victory fanfare and a defeat's lament, and soft clicks for moving, choosing and going back in the menus. The same sound plays at most every few hundredths of a second, and at most 28 voices sound at once, so a big melee stays clear.
- **Music:** three short looping pieces written for the game: the Capital's theme (a calm march in D minor, on every menu), the battle theme (A minor, driving) and the rulers' theme (faster and darker, in boss fights). One fades into the next; the result screen stops the music for the fanfare or the lament.
- **Settings:** Volume, Music and Sound effects, each 0% to 100% in tenths, and Screen shake on or off, in `settings.json` (they belong to the computer, like the display settings). Browsers allow sound only after the first key press or click, so the game is silent until then.
- **Screens** fade in from dark, buttons light up under the mouse, and Settings shows the chosen line's explanation under the list.

### The look (visual overhaul after 6C)

The owner asked for the game to look at least as good as 9 Kings or Sephiria. Everything stays pixel art drawn by code or written as text, at one pixel size (2 world units, the troops' own), so menus, maps and the battle share one look: warm dark plum and gold, like a war table by lamplight.

- **Fonts:** Pixelify Sans for all reading text and Jacquard 12, a pixel blackletter, for screen titles, region names and the battle's banners, in mixed case ("The Capital", "Victory"). Both are free fonts under the SIL Open Font License, bundled with the game (they work offline) with their licenses in `licenses/`. Every text has a dark drop shadow; titles and banners a dark outline too. Pixelify Sans joins "fi" into one letter, so the game draws text without letter joins.
- **Frames:** every box is a pixel-art frame drawn in code (`src/game/art/frames.ts`): panels with a gold trim and corner studs, list rows (the one in focus warm brown with a gold trim; locked ones dark), buttons standing on a dark lip (lighter under the mouse, gold when on), cards for the battle's slots and sunken wells for bars and text boxes. A controller's focus wears gold corner marks.
- **Backdrop:** every menu stands on a dark cloth lit from above, with a faint woven lattice and motes of gold dust drifting up.
- **The Capital** is a world map: an island in a night sea, the Capital's castle in its heartland of farms, and the five regions around it as their own lands (deep woods, violet ruins with crystals, red mesas, snowy iron mountains, glass plains), joined to the Capital by dirt roads, with beaches and foam on the coast. Each region is a medallion with its emblem and a name plate; locked regions lie under drifting fog with a padlock, cleared ones show a green tick, your run's region has your banner, and the region in focus has gold corner marks and a gold arrow bobbing over it. The map is worked out from the regions' places (`src/game/art/worldMap.ts`), the same every visit.
- **A run's map** lies on its region's land, its stops medallions in their kind's colors on dotted dirt roads (gold where you walked), each named on a plate; your banner marks where you stand and a gold arrow the stop you picked.
- **The battlefield** is lit: warm sun from the top left and shade toward the edges, baked into the ground in dithered steps so troops stay bright and clear. The Open Field, the Deep Forest and the Red Canyon are worn bare down the middle where the armies meet. Walls are pixel-art blocks with a lit top and their front face in shade along the bottom, over a shadow, still within their footprint. Troops cast darker shadows, show HP bars only once hurt, and hits throw up damage numbers (pale on the enemy, red on yours, big and orange for a heavy blow). Each map has its air: pollen on the Open Field, falling leaves in the Deep Forest, violet motes in the Void Ruins, blowing dust in the Red Canyon, embers in the Iron Fortress and glints on the Glass Plains.
- **The battle's bars** are framed; the armies' HP bars are lit, and what an army just lost lingers in pale before draining away. Card slots are cards: gold-trimmed when ready, a dark curtain sinking over them while they rest, their cost in blue pip gems (green when cheaper). Pips are gems in sockets, and Momentum an ember bar with a glint running along it when full. Banners ("Fight!", ultimates, Overtime) land big on a dark gold-edged ribbon across the field; popups pop in before they rise.
- **The result** opens on a framed panel with "Victory" or "Defeat" landing in the display font.
- **A title screen** opens the game: dusk over the realm, the Capital's castle on its hill against the setting sun, mountains behind and stars above, your army and the enemy's facing each other in front, embers rising, and "Generals" in gold. Any key, click or button goes on to the Capital (F11 still only switches fullscreen).

## Controllers and Steam Deck (session 6C)

Every screen and a whole battle play with a controller alone. The game reads any controller the computer sees (Xbox, PlayStation, Switch Pro, the Steam Deck's own) through the standard layout, where A is the bottom face button; buttons map onto the same named actions the keys do, so no screen has its own controller code.

| Button | In the menus | In battle |
| --- | --- | --- |
| D-pad or left stick | move (held, it repeats) | — |
| A | choose | card slot 4 |
| B | back | card slot 3 |
| X | clear (Del) | card slot 1 |
| Y | — | card slot 2 |
| RB / LB | next / previous (Tab) | card slot 5 (Legendary) / speed |
| RT or LT | — | ultimate |
| Menu | start the battle (Orders) | pause |
| View | move among the screen's buttons | the same |

- **View** reaches every on-screen button: it puts a gold ring on the first, the D-pad moves it, A presses it and B leaves. It opens what letter keys open (the General, the Codex, the Tech Web, your company, the Oaths, the Skirmish screen), so those need no button of their own. A small "View: buttons" note shows in the corner while a controller is in use.
- **Hints follow the device in hand.** Button labels and each screen's help line show the keys after a key press or click, and the controller's buttons (Ⓐ, Ⓑ, RB, Menu ...) after a button press; the battle's slots show Ⓧ Ⓨ Ⓑ Ⓐ RB, the ultimate RT, and the Captain's tips name the button to press.
- **Typing orders:** on the order line, A opens the on-screen keyboard: number and letter keys, %, punctuation, space, delete, "read order" and "done". The D-pad moves over the keys, A types, X deletes, Y adds a space, Menu reads the order and B closes it keeping the words. A row of words above the keys finishes the word being typed with words the order reader knows ("ran" offers "ranger"), and offers the commonest first words after a space ("when", "my", "their" ...). Pressing a key on a real keyboard closes it and carries on in the text box. The card builder's menus work with the D-pad as they do with the arrows.
- **Steam Deck (1280×800):** the game keeps its 960×704 layout, drawn about 1.14 times bigger, with bars at the sides. No text is smaller than 11 world pixels, about 12.5 screen pixels on the Deck, above the 9 Valve asks for. Sound starts with the first controller press, and at once in the desktop app, which needs no key press or click to play sound.
- **Linux build:** the desktop app also builds as an AppImage for Linux PCs and the Steam Deck (desktop mode, or added to Steam as a non-Steam game until the Steam release), and as the Steam build's Linux depot (session 7A). Saves are in `~/.config/Generals/saves`, Chromium's caches in `~/.cache/Generals`.

## Versus (session 6D)

Battles against a friend over the internet, opened from the Capital (M, or the Versus button).

- **Lobby:** one player hosts and gets a four-letter room code, made of letters and digits that can't be mixed up (no O and 0, no I and 1); the other joins by typing it, or with a controller by changing each letter with ↑↓. The host picks the map and the rank both armies fight at, and the guest watches them change. The rank is the match's, not the players': both get that rank's slots, pips, actions and conditions, whatever rank they have reached, so a new player and a veteran fight with the same tools. Legendary actions come along: a player who has beaten a boss has slot 5.
- **Setting up:** each player brings their skirmish army (classes, reserves, specializations), General and cards, places their troops on their half and writes orders in secret: the other half of the field is empty on the Prep screen. Versus has no Tactical mode, no pause and no speed-up, since both games must keep the same time. Ready (B) sends your army; it can't be taken back, only the match left.
- **Checking armies:** each game checks the other's army against the match's rules, with the same validator that gates every card: 5 troops of known classes inside the deploy zone, at most 3 reserves, real specializations and General, and every card at the match's rank (with Legendary cards only for actions that player has learned). A refused army sends both players back to their orders, each told whose army it was and what was wrong, so a broken card is never quietly dropped. The host's game picks the battle's seed.
- **The battle (lockstep):** both games run the same battle. The host commands the left side, the guest the right. Only key presses travel: a press is scheduled 3 ticks (150 ms) ahead and sent with every other press for that tick, even when there are none, so the other game knows that tick is settled. A game runs a tick only once it has both players' presses for it, and otherwise waits, saying "Waiting for your opponent…". Both players' presses for a tick reach the engine in the same order in both games. Because the battle engine is deterministic, the same presses give the same battle.
- **Desync check:** every 3 seconds (60 ticks) both games send a fingerprint (hash) of the battle state: every troop, shot, wall, zone, both commands and the random generator. If two fingerprints for the same tick differ, the battle stops as "out of step" in both games.
- **The guest's view:** the guest's screen turns the field around, so each player sees their own army on the left in blue, as in every other battle. All maps are mirror images left to right, so only the view changes; words over the field (damage numbers, banners) are never turned.
- **After the battle:** both games end it on the same tick. The result screen says who won from your side and offers a rematch (same map and rank, both set up again) or leaving. Versus earns no Command XP and has no Battle IQ report or Captain's tips. Leaving mid-battle (Esc twice) or a lost connection stops the other player's battle with a note and takes them back to the Versus screen.
- **The relay:** a small Node server in `server/` pairs players by code and passes their messages; it never runs a battle and keeps nothing. Each room holds two players; a player may send a burst of 120 messages, refilled at 60 a second (a match sends about 21 a second); a message is at most 32 KB; an empty room closes after 30 minutes. The game reaches it only through the platform's network (`src/platform`), at the address its build was made for (`VITE_RELAY_URL`), or one typed on the Versus screen and kept in the settings. One relay serves browser, desktop, Steam and Epic players alike.
- **Trust:** each game knows both armies (it must, to run the battle), so a changed game could read the other player's cards; the checks stop armies that break the rules, not peeking. That is fine between friends. Matches with strangers would need more, such as the relay checking armies itself.

## Steam (session 7A)

The desktop app is also the Steam build: the same files, with Steam's features when Steam starts it.

- **Steam turns on only under Steam.** Steam sets `SteamAppId` for the games it starts; the app then starts Steam's API through steamworks.js, with the overlay. Started any other way (the GitHub installer, the AppImage), or when Steam won't start (not running, game not owned), the app plays exactly as it does elsewhere, and the browser build never has Steam. For testing, `--steam-app-id=480` (Valve's Spacewar) or a `steam_appid.txt` beside the app turns it on.
- **Through the platform.** Game code names achievements and presence lines through `src/platform` (the store: `none` or `steam`); only `desktop/steam.ts` knows Steam. A store the game doesn't run in takes both and does nothing.
- **Achievements:** 18, each earned from what the save already records, so none can be missed and none needs Steam stats: Command Ranks II to V, each of the five rulers and all five, a first signature combo and all of them, the Finisher, every troop synergy, the whole Combo Codex, a first Mastery title, all three of one General's, and every one. The game reports them after every change to the save and once at start-up, so achievements earned before the game ran under Steam (in the browser build, say, with the save carried over) unlock the first time it does. Steam may turn an unlock down for a moment after starting, while it loads the player's stats; the app tries again a few times. The list is in `src/data/achievements.ts`; `npm run art:achievements` draws their icons from the game's own sprites.
- **Rich presence:** what friends see: In the Capital; On a run in (region); Facing (ruler) in (region); Practising in a skirmish; In a versus match. Each screen sets it as it opens.
- **Steam Cloud:** Steam's Auto-Cloud syncs the saves folder (`%APPDATA%\Generals\saves`, and `~/.config/Generals/saves` on Linux and the Deck) with no code in the game; `settings.json` stays on each computer.
- **Builds:** Steam gets the unpacked app, one depot for Windows and one for Linux and the Steam Deck (`npm run desktop:steam`, or the manual "Steam builds" workflow), uploaded with SteamPipe by `npm run steam:upload`, which never sets a build live on the default branch.

`docs/store/` holds the store kit: the page's words, the art and screenshot checklists, the trailer's shot list, the AI disclosure draft and the Steamworks setup.

## Platforms and release

Generals ships as a Windows desktop game on Steam first, then on the Epic Games Store. A browser build stays online as the quick test build.

- **Desktop app:** the same TypeScript game wrapped in Electron, which bundles its own Chromium, so it runs the same on every PC and on Steam Deck.
- **Voice orders:** on the Orders screen, hold V (or the Talk button) and say the order; it goes through the same translators as a typed one. The browser build uses the browser's own speech recognition (Chrome, Edge and Safari have it; Firefox doesn't), which may send the sound to the browser maker's speech service; the game itself sends nothing. The desktop app has no speech recognition yet, so players type there; a speech model running on the player's computer could add it later. Typing always works.
- **Small model:** the order reader is about 1 MB of weights (270 KB compressed), so it ships inside both builds as an ordinary game file, loaded in the background when the game starts. It needs no download, no GPU and no internet.
- **Saves:** files in the player's app data folder (on Windows, `%APPDATA%\Generals\saves`), synced by Steam Cloud. Display and sound settings (window size, fullscreen, resolution, volumes, screen shake) sit next to that folder in `settings.json` and stay on each computer, since a laptop and a big monitor want different ones. In the browser build, saves live in the browser's local storage. Every save carries a version number; a save from an older version is brought up to date step by step when the game starts (migrations), and the old file is kept as `saves/profile-backup.json`. Version 2 (session 5A) turned the old debug rank into the Command XP for that rank, so nobody loses the rank they played at. Version 3 (session 5B) added the run you are on and your banked artifacts; a saved run that doesn't read correctly in every part is dropped, and the rest of the save still loads. Version 4 (session 5C) gave run fighters a faction and perks; those of a run saved before have none. Version 5 (session 5E) added your company, Insight, the Tech Web, Ironman and Mastery. Version 6 (session 6A) added the Captain's tips: on for a new save, off for a save that has already earned XP (Settings turns them back on). Version 7 (session 5F) added your Oaths of Command and the highest Fear won in each region; a run in progress took no oaths.
- **Steam Deck and controllers:** full controller support (session 6C; see Controllers and Steam Deck): slots on buttons, every menu through the same actions, and an on-screen keyboard for typed orders. The desktop app builds for Windows and, as an AppImage, for Linux and the Steam Deck.
- **Multiplayer:** runs through a small relay server of our own (session 6D; see Versus), so Steam, Epic and browser players can play each other. Epic requires multiplayer games to cross-play with other PC stores.
- **Store features:** Steam achievements, cloud saves and rich presence (session 7A; see Steam); Epic achievements, which Epic requires.
- **AI disclosure:** Steam asks about AI-made content that players see. Generals' live AI is the order reader, a small model trained for this game on generated orders, that turns orders into cards. It only ever picks parts of a card (it can't write text), and its guardrails are the fixed card format, the validator and pre-written replies, so it never writes free text for players. The optional experimental language model in Settings is held to the same card format. AI tools used only to write the code don't need disclosing, but the art and sound are AI-made (session 6B): an AI coding assistant drew every sprite pixel by pixel as text and wrote every sound recipe and piece of music as notes, for this game and from no outside material. No image or sound generation model was used. `docs/CREDITS.md` marks each of them, for Steam's disclosure of pre-generated content.

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
5. **Progression:** Command Ranks, the Legendary slot and actions, the world map, roguelite runs (spoils, fighters by rarity, factions, boons, the merchant), boss fights, Tech Web, artifacts, veterans, mastery, the Battle IQ report, and saving.
6. **Polish and multiplayer:** balance, tutorial, art, sound, controller and Steam Deck support, and battles against friends across stores.
7. **Release:** Steam integration and the store kit, then the Epic build.

Playing never needs a paid API: the parser, validator and personality rules are plain code, and the small model runs on the player's computer. Claude is used only while building, for example to write the training sentences in phase 3.
