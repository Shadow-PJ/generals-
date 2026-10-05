# Balance report (session 6A)

`npm run balance` played 1,000 battles for each of 61 matchups (61,000 battles, about 7 minutes on
3 cores): every General against every other, each specialization, each faction tier and each boss
fight. How it works, and the fair range of each suite, is in `docs/DESIGN.md` (Balance).

The first run found **26 matchups outside their fair range**. I proposed number changes in the
pull request; the owner asked for the rest to be fixed too, with buffs or new things. Everything
below is applied, and in the last run **no matchup is outside its range**.

## How to read the numbers

- *A wins* counts a draw as half. The margin for 1,000 battles is about ±3 points, so a matchup is
  flagged only when it is outside its fair range by more than that.
- *HP edge* is the share of its HP the side keeps at the end, minus the other side's, on average.
  It shows how big the wins are.
- The very first run gave wild numbers (Frostcaller 0% against no specialization, Pyromancer 99%)
  because the same two armies fought nearly the same battle on every seed, so a tiny edge won all
  1,000. The script now starts every troop up to 30 px off its spot, by the seed. Every number
  below is from runs with that.
- To find causes, I switched single parts off (a troop skill, an ultimate, a doctrine, a card) in a
  scratch copy of the game and measured again. Those switches never reached the game.

## What it found

1. **The Conductor beat every General** (76% to 93%). Echo Strike's shatter did it: once a troop
   had 3 Vibration stacks, each new hit kept them topped up and shattered it again the moment the
   last shatter ended, so anything in a fight stayed shattered (10% less armor) almost all the
   time. With Vibration off, the others won 40% to 73% against it.
2. **The Captain beat the other four** (64% to 75%), not because of Rally (halving its heal
   changed little) but because their skills cost them: Vampiric Link's 10% HP decided the
   Warlord's games (at 5% Captain vs Warlord swung from 72% to 29%), and Venting's self-damage
   the Engineer's.
3. **The Hive Mother's Forced Evolution was worth nothing**: with it switched off she did exactly as
   well. She fired it the moment she could, merging two healthy troops into one, which lost a
   troop's worth of attacks for a 50% damage bonus.
4. **The Strategist beat the Warlord 70%** because of how they meet: her Rangers back away between
   shots, and his Vanguards walked across the field for her toughest troop while they did. Without
   her kiting the Warlord won 66%; no Warlord buff (faster links, a charge, longer wraiths) moved it.
5. **Specializations are close to fair.** Only the Frostcaller was a little weak (46%): Crossfire
   makes arrows through a plain or fire Rift hit 50% harder, through a frost Rift only slow.
6. **Factions:** Bloodbound was well tuned. Forgeborn and Voidweavers were too strong at every tier
   (77% with only 2 fighters), Hive and Resonance at 6 (95%).
7. **Boss fights:** a strong run army (one Epic, four Rare, Rank III) beat the Hive Mother, the
   Warlord and the Strategist 92% to 100%, and their rules mattered little: their armies were the
   gap. The Strategist's army was fragile (two Invokers among her five on the field): more Epic
   troops barely moved it (91% to 94%). The Engineer was the opposite: her turrets were the whole fight (8.5% with them, 98.6%
   without). One boss-army setting for all five rulers could not fit both.

## What changed

**Numbers** (all in `src/data`):

| What | Before | After |
| --- | --- | --- |
| Echo Strike shatter (Conductor) | 10% armor | 4% |
| Shatterstorm (Conductor) | 45 a stack | 35 |
| Vampiric Link (Warlord) | costs 10% HP; 3× attack speed | costs 8%; 3.5× |
| Venting (Engineer) | 30 damage; 2% self-damage | 33; 1.5% |
| Phase Shift stun (Strategist) | 1.5 s | 2.5 s |
| Strategist Rangers back away from enemies within | 85% of their range | 75% |
| Pyromancer / Frostcaller Rift damage | ×1.4 / ×0.7 | ×1.3 / ×0.85 |
| Breaker speed | ×1.2 | ×1.1 |
| Forgeborn armor cap at 2/4/6 | 4/7/11% | 2.5/4.5/6% |
| Voidweavers phase-out at 2/4/6 | every 12th/9th/6th hit | 16th/12th/10th |
| Hive damage per Hive troop at 2/4/6 | 2.5/3.5/5% | 3/3/3.5% |
| Resonance bonus at 2/4/6 | 25/30/50% | 25/25/30% |
| Engineer boss turrets | HP +30%, armor +0.1, reach +15% | +10%, +0.05, +5% |
| Conductor boss: Momentum per Vibration stack | 0.5 | 0.8 |
| Boss armies' Epic troops | 2 for every ruler | by ruler: Hive Mother 3, Strategist 1, Warlord 5, Engineer 1, Conductor 3 |

**New rules:**

- **Forced Evolution** waits until two of the Hive Mother's troops are below 50% HP, and the elite
  comes out at full HP (their max HPs together). It now saves two dying troops instead of costing
  two healthy ones. Alone, this moved Captain vs Hive Mother from 74% to 61%.
- **Assimilation** lasts the rest of the battle instead of 10 s: the Hive grows as it kills.
- **Phase Shift** also heals the troop 7% of its max HP, so the dodge can save it. It is strong: at
  25% the Strategist won 64% to 78% against everyone.
- **Warlord doctrine:** Vanguards go for the strongest enemy *in reach*; with none in reach they
  fight as usual instead of crossing the field for the toughest troop.
- **Each ruler has their own boss army** (`BOSS_FIGHTS` in `src/data/runs.ts`), so each boss fight
  is tuned on its own. The Strategist's boss army now has a second Vanguard in place of her first
  Invoker.
- The Hive Mother rules the first region, so her fight stays the easiest. The new-save playthrough
  test now also plays Void Ruins, the other region open from the start: a new company with no
  cards can still win both.

Tried and dropped: Vibration that can't build again while a troop is shattered (a rhythm for Echo
Strike) changed nothing; a faster-moving Warlord didn't reach the Strategist's Rangers.

## Before and after

Both runs: 1,000 battles per matchup, the same seeds. *Before* is the game as it was; *after* has
every change above. Rows that moved by less than 3 points and were never flagged are left out; ⚠
marks a flagged row, and the HP edge is in brackets. **Flagged: 26 before, none after.**

**Generals**

| Matchup | Before | After | |
| --- | ---: | ---: | --- |
| captain vs warlord | 72.2% (+16) ⚠ | 41.9% (−0) | fixed |
| captain vs engineer | 72.5% (+14) ⚠ | 52.6% (+2) | fixed |
| captain vs hiveMother | 75.1% (+24) ⚠ | 58.5% (+7) | fixed |
| captain vs strategist | 64.0% (+17) ⚠ | 59.2% (+15) | fixed |
| captain vs conductor | 21.4% (−17) ⚠ | 48.3% (−1) | fixed |
| warlord vs engineer | 44.6% (−5) | 56.7% (−0) |  |
| warlord vs strategist | 29.7% (−13) ⚠ | 42.9% (−4) | fixed |
| warlord vs conductor | 9.7% (−25) ⚠ | 44.9% (−5) | fixed |
| engineer vs hiveMother | 47.8% (+2) | 52.4% (+2) |  |
| engineer vs strategist | 58.3% (+5) | 45.6% (−1) |  |
| engineer vs conductor | 7.5% (−25) ⚠ | 39.2% (−5) | fixed |
| hiveMother vs strategist | 49.1% (+0) | 62.6% (+20) |  |
| hiveMother vs conductor | 15.7% (−27) ⚠ | 42.5% (−2) | fixed |
| strategist vs conductor | 23.8% (−19) ⚠ | 45.8% (−8) | fixed |

**Specializations**

| Matchup | Before | After | |
| --- | ---: | ---: | --- |
| pyromancer vs none | 61.3% (+11) | 58.1% (+8) |  |
| frostcaller vs none | 46.2% (−3) ⚠ | 51.2% (+2) | fixed |
| breaker vs bulwark | 63.2% (+9) ⚠ | 58.2% (+6) | fixed |
| pyromancer vs frostcaller | 63.3% (+14) ⚠ | 59.6% (+9) | fixed |

**Factions**

| Matchup | Before | After | |
| --- | ---: | ---: | --- |
| forgeborn 2 vs none | 77.1% (+16) ⚠ | 66.1% (+9) | fixed |
| forgeborn 4 vs none | 87.5% (+23) ⚠ | 79.9% (+17) | fixed |
| forgeborn 6 vs none | 94.2% (+33) ⚠ | 86.8% (+23) | fixed |
| hive 4 vs none | 83.0% (+19) | 79.5% (+17) |  |
| hive 6 vs none | 95.0% (+32) ⚠ | 89.4% (+26) | fixed |
| voidweavers 2 vs none | 76.7% (+16) ⚠ | 71.8% (+13) | fixed |
| voidweavers 4 vs none | 84.7% (+21) ⚠ | 78.9% (+17) | fixed |
| voidweavers 6 vs none | 93.8% (+31) ⚠ | 85.1% (+21) | fixed |
| resonance 4 vs none | 84.7% (+20) ⚠ | 80.7% (+17) | fixed |
| resonance 6 vs none | 94.8% (+31) ⚠ | 86.5% (+22) | fixed |

**Boss fights**

| Matchup | Before | After | |
| --- | ---: | ---: | --- |
| vs hiveMother | 92.9% (+40) ⚠ | 81.1% (+27) | fixed |
| vs hiveMother (no boss rule) | 95.9% (+41) | 87.5% (+33) |  |
| vs strategist | 100.0% (+48) ⚠ | 55.7% (+15) | fixed |
| vs strategist (no boss rule) | 100.0% (+48) | 55.7% (+15) |  |
| vs warlord | 92.2% (+26) ⚠ | 64.2% (+10) | fixed |
| vs warlord (no boss rule) | 97.1% (+37) | 86.5% (+20) |  |
| vs engineer | 8.5% (−27) ⚠ | 64.9% (+6) | fixed |
| vs conductor | 43.4% (−3) | 59.5% (+7) |  |
| vs conductor (no boss rule) | 96.2% (+29) | 86.6% (+22) |  |

## Worth knowing

- **The Strategist's boss rule** (phasing out of big hits) never changes her fight: with it or
  without, the strong army wins 55.7%. Hits of 20% of a troop's HP are rare here. Her fight is now
  hard because of her army, not her rule; the rule may want a design look.
- **The Bulwark** does nothing measurable (50% against no specialization). Before the start-spot
  fix it won 79%, all from walking 10% slower; its shield wall rarely matters in these fights.
- **Close to the edge:** Hive Mother vs Strategist 62.6% and Engineer vs Conductor 39.2% are inside
  their range by less than the margin.
- **Fair ranges** are my guesses: 40–60% between Generals, a specialization 50–72% against none, a
  faction 52–72%, 58–82% and 62–90% at 2, 4 and 6, a boss 30–85% for a strong army. The boss
  suite's army is also a guess at a strong army near a run's end. They live in
  `tools/balance/matchups.ts`.

## Full reports

### Before (the game as it was)

A wins: draws count half; ± is the 95% margin. HP edge: on average, the share of its HP A has left at the end minus B's, in points: it says how big the wins are, since a small edge can still win almost every battle.

#### Flagged (26)

- **captain vs warlord** (generals): A wins 72.2%, too often (fair: 40.0% to 60.0%)
- **captain vs engineer** (generals): A wins 72.5%, too often (fair: 40.0% to 60.0%)
- **captain vs hiveMother** (generals): A wins 75.1%, too often (fair: 40.0% to 60.0%)
- **captain vs strategist** (generals): A wins 64.0%, too often (fair: 40.0% to 60.0%)
- **captain vs conductor** (generals): A wins 21.4%, too rarely (fair: 40.0% to 60.0%)
- **warlord vs strategist** (generals): A wins 29.7%, too rarely (fair: 40.0% to 60.0%)
- **warlord vs conductor** (generals): A wins 9.7%, too rarely (fair: 40.0% to 60.0%)
- **engineer vs conductor** (generals): A wins 7.5%, too rarely (fair: 40.0% to 60.0%)
- **hiveMother vs conductor** (generals): A wins 15.7%, too rarely (fair: 40.0% to 60.0%)
- **strategist vs conductor** (generals): A wins 23.8%, too rarely (fair: 40.0% to 60.0%)
- **frostcaller vs none** (specs): A wins 46.2%, too rarely (fair: 50.0% to 72.0%)
- **breaker vs bulwark** (specs): A wins 63.2%, too often (fair: 40.0% to 60.0%)
- **pyromancer vs frostcaller** (specs): A wins 63.3%, too often (fair: 40.0% to 60.0%)
- **forgeborn 2 vs none** (factions): A wins 77.1%, too often (fair: 52.0% to 72.0%)
- **forgeborn 4 vs none** (factions): A wins 87.5%, too often (fair: 58.0% to 82.0%)
- **forgeborn 6 vs none** (factions): A wins 94.2%, too often (fair: 62.0% to 90.0%)
- **hive 6 vs none** (factions): A wins 95.0%, too often (fair: 62.0% to 90.0%)
- **voidweavers 2 vs none** (factions): A wins 76.7%, too often (fair: 52.0% to 72.0%)
- **voidweavers 4 vs none** (factions): A wins 84.7%, too often (fair: 58.0% to 82.0%)
- **voidweavers 6 vs none** (factions): A wins 93.8%, too often (fair: 62.0% to 90.0%)
- **resonance 4 vs none** (factions): A wins 84.7%, too often (fair: 58.0% to 82.0%)
- **resonance 6 vs none** (factions): A wins 94.8%, too often (fair: 62.0% to 90.0%)
- **vs hiveMother** (bosses): A wins 92.9%, too often (fair: 30.0% to 85.0%)
- **vs strategist** (bosses): A wins 100.0%, too often (fair: 30.0% to 85.0%)
- **vs warlord** (bosses): A wins 92.2%, too often (fair: 30.0% to 85.0%)
- **vs engineer** (bosses): A wins 8.5%, too rarely (fair: 30.0% to 85.0%)

#### Generals (A vs B, both with a commander firing its script and ultimate)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| captain vs captain | 51.0% | 3.1% | 2 | +1 | 91 s | 40.0%–60.0% |  |
| captain vs warlord | 72.2% | 2.8% | 0 | +16 | 74 s | 40.0%–60.0% | too often |
| captain vs engineer | 72.5% | 2.8% | 1 | +14 | 79 s | 40.0%–60.0% | too often |
| captain vs hiveMother | 75.1% | 2.7% | 2 | +24 | 86 s | 40.0%–60.0% | too often |
| captain vs strategist | 64.0% | 3.0% | 0 | +17 | 98 s | 40.0%–60.0% | too often |
| captain vs conductor | 21.4% | 2.5% | 1 | −17 | 78 s | 40.0%–60.0% | too rarely |
| warlord vs warlord | 49.1% | 3.1% | 2 | −0 | 72 s | 40.0%–60.0% |  |
| warlord vs engineer | 44.6% | 3.1% | 1 | −5 | 69 s | 40.0%–60.0% |  |
| warlord vs hiveMother | 45.8% | 3.1% | 0 | −5 | 73 s | 40.0%–60.0% |  |
| warlord vs strategist | 29.7% | 2.8% | 0 | −13 | 77 s | 40.0%–60.0% | too rarely |
| warlord vs conductor | 9.7% | 1.8% | 0 | −25 | 65 s | 40.0%–60.0% | too rarely |
| engineer vs engineer | 52.3% | 3.1% | 1 | +1 | 115 s | 40.0%–60.0% |  |
| engineer vs hiveMother | 47.8% | 3.1% | 0 | +2 | 78 s | 40.0%–60.0% |  |
| engineer vs strategist | 58.3% | 3.1% | 1 | +5 | 119 s | 40.0%–60.0% |  |
| engineer vs conductor | 7.5% | 1.6% | 1 | −25 | 68 s | 40.0%–60.0% | too rarely |
| hiveMother vs hiveMother | 51.0% | 3.1% | 1 | +1 | 90 s | 40.0%–60.0% |  |
| hiveMother vs strategist | 49.1% | 3.1% | 0 | +0 | 98 s | 40.0%–60.0% |  |
| hiveMother vs conductor | 15.7% | 2.3% | 0 | −27 | 74 s | 40.0%–60.0% | too rarely |
| strategist vs strategist | 49.8% | 3.1% | 1 | −0 | 153 s | 40.0%–60.0% |  |
| strategist vs conductor | 23.8% | 2.6% | 0 | −19 | 85 s | 40.0%–60.0% | too rarely |
| conductor vs conductor | 51.8% | 3.1% | 1 | +1 | 72 s | 40.0%–60.0% |  |

#### Specializations (every class on the field; no commanders)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| breaker vs none | 59.0% | 3.0% | 4 | +8 | 78 s | 50.0%–72.0% |  |
| bulwark vs none | 50.0% | 3.1% | 3 | −0 | 70 s | 50.0%–72.0% |  |
| sniper vs none | 57.9% | 3.1% | 2 | +7 | 68 s | 50.0%–72.0% |  |
| volley vs none | 51.3% | 3.1% | 2 | +1 | 71 s | 50.0%–72.0% |  |
| warden vs none | 63.2% | 3.0% | 0 | +12 | 68 s | 50.0%–72.0% |  |
| mender vs none | 60.2% | 3.0% | 4 | +9 | 72 s | 50.0%–72.0% |  |
| pyromancer vs none | 61.3% | 3.0% | 3 | +11 | 66 s | 50.0%–72.0% |  |
| frostcaller vs none | 46.2% | 3.1% | 2 | −3 | 73 s | 50.0%–72.0% | too rarely |
| blade vs none | 60.8% | 3.0% | 6 | +9 | 73 s | 50.0%–72.0% |  |
| saboteur vs none | 51.1% | 3.1% | 2 | +1 | 67 s | 50.0%–72.0% |  |
| breaker vs bulwark | 63.2% | 3.0% | 1 | +9 | 75 s | 40.0%–60.0% | too often |
| sniper vs volley | 56.0% | 3.1% | 1 | +5 | 68 s | 40.0%–60.0% |  |
| warden vs mender | 49.2% | 3.1% | 2 | +1 | 72 s | 40.0%–60.0% |  |
| pyromancer vs frostcaller | 63.3% | 3.0% | 1 | +14 | 66 s | 40.0%–60.0% | too often |
| blade vs saboteur | 55.5% | 3.1% | 3 | +5 | 68 s | 40.0%–60.0% |  |

#### Factions (fighters of a faction vs the same army with none; no commanders)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| bloodbound 2 vs none | 64.9% | 3.0% | 0 | +9 | 89 s | 52.0%–72.0% |  |
| bloodbound 4 vs none | 77.5% | 2.6% | 0 | +16 | 89 s | 58.0%–82.0% |  |
| bloodbound 6 vs none | 87.6% | 2.0% | 0 | +28 | 88 s | 62.0%–90.0% |  |
| forgeborn 2 vs none | 77.1% | 2.6% | 1 | +16 | 88 s | 52.0%–72.0% | too often |
| forgeborn 4 vs none | 87.5% | 2.0% | 0 | +23 | 86 s | 58.0%–82.0% | too often |
| forgeborn 6 vs none | 94.2% | 1.4% | 0 | +33 | 84 s | 62.0%–90.0% | too often |
| hive 2 vs none | 55.5% | 3.1% | 0 | +3 | 89 s | 52.0%–72.0% |  |
| hive 4 vs none | 83.0% | 2.3% | 3 | +19 | 83 s | 58.0%–82.0% |  |
| hive 6 vs none | 95.0% | 1.4% | 0 | +32 | 73 s | 62.0%–90.0% | too often |
| voidweavers 2 vs none | 76.7% | 2.6% | 0 | +16 | 87 s | 52.0%–72.0% | too often |
| voidweavers 4 vs none | 84.7% | 2.2% | 0 | +21 | 87 s | 58.0%–82.0% | too often |
| voidweavers 6 vs none | 93.8% | 1.5% | 0 | +31 | 85 s | 62.0%–90.0% | too often |
| resonance 2 vs none | 61.7% | 3.0% | 2 | +6 | 88 s | 52.0%–72.0% |  |
| resonance 4 vs none | 84.7% | 2.2% | 0 | +20 | 82 s | 58.0%–82.0% | too often |
| resonance 6 vs none | 94.8% | 1.4% | 0 | +31 | 74 s | 62.0%–90.0% | too often |

#### Boss fights (a strong run army, Rank III commander, vs the ruler)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| vs hiveMother | 92.9% | 1.6% | 0 | +40 | 75 s | 30.0%–85.0% | too often |
| vs hiveMother (no boss rule) | 95.9% | 1.2% | 0 | +41 | 74 s | 0.0%–100.0% |  |
| vs strategist | 100.0% | 0.0% | 0 | +48 | 61 s | 30.0%–85.0% | too often |
| vs strategist (no boss rule) | 100.0% | 0.0% | 0 | +48 | 61 s | 0.0%–100.0% |  |
| vs warlord | 92.2% | 1.7% | 0 | +26 | 90 s | 30.0%–85.0% | too often |
| vs warlord (no boss rule) | 97.1% | 1.0% | 0 | +37 | 88 s | 0.0%–100.0% |  |
| vs engineer | 8.5% | 1.7% | 0 | −27 | 67 s | 30.0%–85.0% | too rarely |
| vs engineer (no boss rule) | 98.6% | 0.7% | 0 | +39 | 60 s | 0.0%–100.0% |  |
| vs conductor | 43.4% | 3.1% | 0 | −3 | 70 s | 30.0%–85.0% |  |
| vs conductor (no boss rule) | 96.2% | 1.2% | 0 | +29 | 65 s | 0.0%–100.0% |  |

### After (with every change above)

A wins: draws count half; ± is the 95% margin. HP edge: on average, the share of its HP A has left at the end minus B's, in points: it says how big the wins are, since a small edge can still win almost every battle.

Nothing wins or loses too often.


#### Generals (A vs B, both with a commander firing its script and ultimate)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| captain vs captain | 51.0% | 3.1% | 2 | +1 | 91 s | 40.0%–60.0% |  |
| captain vs warlord | 41.9% | 3.1% | 1 | −0 | 75 s | 40.0%–60.0% |  |
| captain vs engineer | 52.6% | 3.1% | 0 | +2 | 82 s | 40.0%–60.0% |  |
| captain vs hiveMother | 58.5% | 3.1% | 1 | +7 | 93 s | 40.0%–60.0% |  |
| captain vs strategist | 59.2% | 3.0% | 0 | +15 | 103 s | 40.0%–60.0% |  |
| captain vs conductor | 48.3% | 3.1% | 0 | −1 | 82 s | 40.0%–60.0% |  |
| warlord vs warlord | 49.6% | 3.1% | 3 | −0 | 73 s | 40.0%–60.0% |  |
| warlord vs engineer | 56.7% | 3.1% | 0 | −0 | 69 s | 40.0%–60.0% |  |
| warlord vs hiveMother | 43.6% | 3.1% | 1 | −10 | 75 s | 40.0%–60.0% |  |
| warlord vs strategist | 42.9% | 3.1% | 0 | −4 | 85 s | 40.0%–60.0% |  |
| warlord vs conductor | 44.9% | 3.1% | 0 | −5 | 70 s | 40.0%–60.0% |  |
| engineer vs engineer | 49.9% | 3.1% | 0 | −0 | 116 s | 40.0%–60.0% |  |
| engineer vs hiveMother | 52.4% | 3.1% | 0 | +2 | 83 s | 40.0%–60.0% |  |
| engineer vs strategist | 45.6% | 3.1% | 0 | −1 | 125 s | 40.0%–60.0% |  |
| engineer vs conductor | 39.2% | 3.0% | 0 | −5 | 75 s | 40.0%–60.0% |  |
| hiveMother vs hiveMother | 52.3% | 3.1% | 0 | +2 | 100 s | 40.0%–60.0% |  |
| hiveMother vs strategist | 62.6% | 3.0% | 0 | +20 | 123 s | 40.0%–60.0% |  |
| hiveMother vs conductor | 42.5% | 3.1% | 0 | −2 | 84 s | 40.0%–60.0% |  |
| strategist vs strategist | 50.2% | 3.1% | 0 | −0 | 159 s | 40.0%–60.0% |  |
| strategist vs conductor | 45.8% | 3.1% | 0 | −8 | 95 s | 40.0%–60.0% |  |
| conductor vs conductor | 51.7% | 3.1% | 1 | +1 | 77 s | 40.0%–60.0% |  |

#### Specializations (every class on the field; no commanders)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| breaker vs none | 59.5% | 3.0% | 3 | +7 | 76 s | 50.0%–72.0% |  |
| bulwark vs none | 50.0% | 3.1% | 3 | −0 | 70 s | 50.0%–72.0% |  |
| sniper vs none | 57.9% | 3.1% | 2 | +7 | 68 s | 50.0%–72.0% |  |
| volley vs none | 51.3% | 3.1% | 2 | +1 | 71 s | 50.0%–72.0% |  |
| warden vs none | 63.2% | 3.0% | 0 | +12 | 68 s | 50.0%–72.0% |  |
| mender vs none | 60.2% | 3.0% | 4 | +9 | 72 s | 50.0%–72.0% |  |
| pyromancer vs none | 58.1% | 3.1% | 1 | +8 | 67 s | 50.0%–72.0% |  |
| frostcaller vs none | 51.2% | 3.1% | 4 | +2 | 70 s | 50.0%–72.0% |  |
| blade vs none | 60.8% | 3.0% | 6 | +9 | 73 s | 50.0%–72.0% |  |
| saboteur vs none | 51.1% | 3.1% | 2 | +1 | 67 s | 50.0%–72.0% |  |
| breaker vs bulwark | 58.2% | 3.1% | 2 | +6 | 74 s | 40.0%–60.0% |  |
| sniper vs volley | 56.0% | 3.1% | 1 | +5 | 68 s | 40.0%–60.0% |  |
| warden vs mender | 49.2% | 3.1% | 2 | +1 | 72 s | 40.0%–60.0% |  |
| pyromancer vs frostcaller | 59.6% | 3.0% | 6 | +9 | 67 s | 40.0%–60.0% |  |
| blade vs saboteur | 55.5% | 3.1% | 3 | +5 | 68 s | 40.0%–60.0% |  |

#### Factions (fighters of a faction vs the same army with none; no commanders)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| bloodbound 2 vs none | 64.9% | 3.0% | 0 | +9 | 89 s | 52.0%–72.0% |  |
| bloodbound 4 vs none | 77.5% | 2.6% | 0 | +16 | 89 s | 58.0%–82.0% |  |
| bloodbound 6 vs none | 87.6% | 2.0% | 0 | +28 | 88 s | 62.0%–90.0% |  |
| forgeborn 2 vs none | 66.1% | 2.9% | 0 | +9 | 89 s | 52.0%–72.0% |  |
| forgeborn 4 vs none | 79.9% | 2.5% | 0 | +17 | 88 s | 58.0%–82.0% |  |
| forgeborn 6 vs none | 86.8% | 2.1% | 1 | +23 | 87 s | 62.0%–90.0% |  |
| hive 2 vs none | 56.8% | 3.1% | 0 | +3 | 89 s | 52.0%–72.0% |  |
| hive 4 vs none | 79.5% | 2.5% | 1 | +17 | 84 s | 58.0%–82.0% |  |
| hive 6 vs none | 89.4% | 1.9% | 0 | +26 | 78 s | 62.0%–90.0% |  |
| voidweavers 2 vs none | 71.8% | 2.8% | 2 | +13 | 88 s | 52.0%–72.0% |  |
| voidweavers 4 vs none | 78.9% | 2.5% | 0 | +17 | 88 s | 58.0%–82.0% |  |
| voidweavers 6 vs none | 85.1% | 2.2% | 2 | +21 | 88 s | 62.0%–90.0% |  |
| resonance 2 vs none | 61.7% | 3.0% | 2 | +6 | 88 s | 52.0%–72.0% |  |
| resonance 4 vs none | 80.7% | 2.4% | 0 | +17 | 83 s | 58.0%–82.0% |  |
| resonance 6 vs none | 86.5% | 2.1% | 1 | +22 | 81 s | 62.0%–90.0% |  |

#### Boss fights (a strong run army, Rank III commander, vs the ruler)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| vs hiveMother | 81.1% | 2.4% | 0 | +27 | 86 s | 30.0%–85.0% |  |
| vs hiveMother (no boss rule) | 87.5% | 2.0% | 0 | +33 | 84 s | 0.0%–100.0% |  |
| vs strategist | 55.7% | 3.1% | 0 | +15 | 123 s | 30.0%–85.0% |  |
| vs strategist (no boss rule) | 55.7% | 3.1% | 0 | +15 | 123 s | 0.0%–100.0% |  |
| vs warlord | 64.2% | 3.0% | 0 | +10 | 91 s | 30.0%–85.0% |  |
| vs warlord (no boss rule) | 86.5% | 2.1% | 0 | +20 | 92 s | 0.0%–100.0% |  |
| vs engineer | 64.9% | 3.0% | 0 | +6 | 75 s | 30.0%–85.0% |  |
| vs engineer (no boss rule) | 96.9% | 1.1% | 0 | +38 | 62 s | 0.0%–100.0% |  |
| vs conductor | 59.5% | 3.0% | 0 | +7 | 73 s | 30.0%–85.0% |  |
| vs conductor (no boss rule) | 86.6% | 2.1% | 0 | +22 | 75 s | 0.0%–100.0% |  |
