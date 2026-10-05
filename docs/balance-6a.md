# Balance report (session 6A)

`npm run balance` played 1,000 battles for each of 61 matchups (61,000 battles, about 7 minutes on
3 cores): every General against every other, each specialization, each faction tier and each boss
fight. How it works, and the fair range of each suite, is in `docs/DESIGN.md` (Balance). This page
says what it found and which numbers I propose to change. **None of the changes below is applied:**
the data files are as they were, until the owner agrees.

## How to read the numbers

- *A wins* counts a draw as half. The margin for 1,000 battles is about ±3 points, so a matchup is
  flagged only when it is outside its fair range by more than that.
- *HP edge* is the share of its HP the side keeps at the end, minus the other side's, on average.
  It shows how big the wins are.
- The first run gave wild numbers (Frostcaller 0% against no specialization, Pyromancer 99%) because
  the same two armies fought nearly the same battle on every seed, so a tiny edge won all 1,000.
  The script now starts every troop up to 30 px off its spot, by the seed. With that, the
  specializations land between 46% and 63%, and every number below is from runs with it.

## What it found

1. **The Conductor beat every General** (76% to 93%). Its troop skill does it: Echo Strike's shatter
   takes 10% armor off a troop hit three times, and the Vanguard (0.4 armor) and Guardian (0.15)
   lean on armor. With no shatter at all, the others win 30% to 58% against it instead of 7% to 24%;
   its Shatterstorm and its Rhythm twist barely change anything.
2. **The Captain beat the other four** (64% to 75%). Not because of Rally (halving its heal changed
   little) but because the others pay for their skills: the Warlord's troops spend 10% of their HP
   on each Vampiric Link, and the Engineer's lose 2% of theirs every time they vent. Those two costs
   decide their fights (Vampiric Link at 5% swings Captain vs Warlord from 72% to 29%).
3. **Specializations are close to fair.** Only the Frostcaller is a little weak (46%), and the
   Pyromancer beats it 63%: Crossfire makes arrows shot through a plain or fire Rift hit 50% harder,
   but through a frost Rift they only slow, and the frost Rift itself hurts 30% less.
4. **Factions:** Bloodbound is well tuned. Forgeborn and Voidweavers are too strong at every tier
   (77% with only 2 fighters), and Hive and Resonance at 6 (95%).
5. **Boss fights:** a strong run army (one Epic, four Rare, Rank III) beats the Hive Mother, the
   Warlord and the Strategist 92% to 100%, and their boss rules matter little (with the rule or
   without it is 3 to 5 points apart): their armies are what is too weak. The Engineer is the
   opposite: her turrets are the whole fight (8.5% with them, 98.6% without). The Conductor's fight
   is about right (43%).

## Proposed changes

| What | Where | Now | Proposed | Why |
| --- | --- | --- | --- | --- |
| Echo Strike shatter (Conductor) | `src/data/generals.ts` `TROOP_SKILLS.echoStrike.shatterArmorLoss` | 0.1 | 0.05 | The Conductor's edge over every General |
| Vampiric Link cost (Warlord) | `TROOP_SKILLS.vampiricLink.hpCostShare` | 0.1 | 0.08 | The Warlord's troops bleed out against the Captain |
| Venting self-damage (Engineer) | `TROOP_SKILLS.venting.selfDamageShare` | 0.02 | 0.015 | The same for the Engineer |
| Phase Shift stun (Strategist) | `TROOP_SKILLS.phaseShift.stunSeconds` | 1.5 | 2.5 | A small lift for the Strategist |
| Pyromancer Rift | `src/data/specializations.ts` `SPEC_RULES.pyromancer.riftDamageMultiplier` | 1.4 | 1.3 | Closer to the Frostcaller |
| Frostcaller Rift | `SPEC_RULES.frostcaller.riftDamageMultiplier` | 0.7 | 0.85 | Its arrows get no Crossfire burn |
| Breaker speed | `SPECIALIZATIONS.breaker.stats.moveSpeed` | 1.2 | 1.1 | It charged ahead of its army; Breaker beat Bulwark 63% |
| Forgeborn armor cap | `src/data/factions.ts` `FACTIONS.forgeborn.values` | 4%, 7%, 11% | 2.5%, 4.5%, 6% | Too strong at every tier |
| Voidweavers phase-out | `FACTIONS.voidweavers.values` | every 12th, 9th, 6th hit | every 16th, 12th, 10th | Too strong at every tier |
| Hive damage per Hive troop | `FACTIONS.hive.values` | 2.5%, 3.5%, 5% | 3%, 3%, 3.5% | Too strong at 6; the bonus already grows with the Hive troops standing |
| Resonance bonus | `FACTIONS.resonance.values` | 25%, 30%, 50% | 25%, 25%, 30% | Too strong at 4 and 6 |
| Engineer boss turrets | `src/data/bosses.ts` `BOSS_RULES.engineer.turret` | HP +30%, armor +0.1, reach +15% | HP +10%, armor +0.05, reach +5% | The turrets were the whole fight |
| Boss armies | `src/data/runs.ts` `BOSS_FIGHT.epic` | 2 | 3 | Three of the five rulers fell too easily |

The texts that show these numbers (the Frostcaller's "hurt 30% less", the Breaker's "20% faster")
would change with them.

## Before and after

Both runs: 1,000 battles per matchup, the same seeds. *After* is with every change above, in a
scratch copy of the game. Rows that moved by less than 3 points and were never flagged are left
out; ⚠ marks a flagged row, and the HP edge is in brackets. **Flagged: 26 before, 8 after.**

**Generals**

| Matchup | Before | After | |
| --- | ---: | ---: | --- |
| captain vs warlord | 72.2% (+16) ⚠ | 52.5% (+6) | fixed |
| captain vs engineer | 72.5% (+14) ⚠ | 58.5% (+5) | fixed |
| captain vs hiveMother | 75.1% (+24) ⚠ | 75.1% (+24) ⚠ | still too often |
| captain vs strategist | 64.0% (+17) ⚠ | 61.2% (+16) | fixed |
| captain vs conductor | 21.4% (−17) ⚠ | 40.3% (−5) | fixed |
| warlord vs engineer | 44.6% (−5) | 48.7% (−4) |  |
| warlord vs hiveMother | 45.8% (−5) | 59.4% (+2) |  |
| warlord vs strategist | 29.7% (−13) ⚠ | 31.5% (−10) ⚠ | still too rarely |
| warlord vs conductor | 9.7% (−25) ⚠ | 35.6% (−10) ⚠ | still too rarely |
| engineer vs hiveMother | 47.8% (+2) | 58.0% (+9) |  |
| engineer vs conductor | 7.5% (−25) ⚠ | 28.0% (−11) ⚠ | still too rarely |
| hiveMother vs conductor | 15.7% (−27) ⚠ | 27.9% (−19) ⚠ | still too rarely |
| strategist vs conductor | 23.8% (−19) ⚠ | 36.3% (−13) ⚠ | still too rarely |

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
| vs hiveMother | 92.9% (+40) ⚠ | 87.0% (+33) | fixed |
| vs hiveMother (no boss rule) | 95.9% (+41) | 92.7% (+37) |  |
| vs strategist | 100.0% (+48) ⚠ | 99.5% (+46) ⚠ | still too often |
| vs warlord | 92.2% (+26) ⚠ | 85.3% (+21) | fixed |
| vs warlord (no boss rule) | 97.1% (+37) | 92.5% (+31) |  |
| vs engineer | 8.5% (−27) ⚠ | 22.9% (−19) ⚠ | still too rarely |
| vs engineer (no boss rule) | 98.6% (+39) | 95.4% (+33) |  |
| vs conductor | 43.4% (−3) | 79.0% (+18) |  |
| vs conductor (no boss rule) | 96.2% (+29) | 82.0% (+18) |  |

## Still open

- **The Conductor** still beats the Warlord, Engineer, Hive Mother and Strategist 64% to 72%.
  Shatter at 0.04 for 3 s instead of 4 s measured inside the noise of 0.05; the next step may be a
  design change rather than a number (for example, shatter only Vanguards and Guardians).
- **The Captain against the Hive Mother** stays at 75%. Nothing I tried moved it much: Feeding's
  pip refill, Assimilation's length and bonus, Forced Evolution's bonus. It may be her commander's
  script or Forced Evolution merging troops too early, worth a look later.
- **The Warlord against the Strategist** stays at 31%.
- **The Strategist's boss fight** stays near 100%: neither her rule (4 phases, from 10% hits) nor a
  stronger army or commander moved it much. Something about her army on the Void Ruins map needs a closer look.
- **The Engineer's boss fight:** weaker turrets alone bring it to about 36%, but the stronger boss
  armies push it back to 23%. One boss-army setting for all five rulers can't fit both; a strength
  setting per ruler would.
- **The Conductor's boss fight** gets much easier with the shatter change (43% to 79%), as her
  troops shatter less too. It stays inside its range, but with the other changes four of the five
  boss fights are now won 79% to 99% by this army.
- **The Bulwark** does nothing measurable: 50% against no specialization. Before the start-spot fix
  it won 79%, and all of that came from walking 10% slower; its shield wall rarely matters here.
- **Fair ranges** are my guesses: 40–60% between Generals, a specialization 50–72% against none, a
  faction 52–72%, 58–82% and 62–90% at 2, 4 and 6, a boss 30–85% for a strong army. They live in
  `tools/balance/matchups.ts`.

## Full reports

### Before (the game as it is)

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

### After (with the proposed changes)

A wins: draws count half; ± is the 95% margin. HP edge: on average, the share of its HP A has left at the end minus B's, in points: it says how big the wins are, since a small edge can still win almost every battle.

#### Flagged (8)

- **captain vs hiveMother** (generals): A wins 75.1%, too often (fair: 40.0% to 60.0%)
- **warlord vs strategist** (generals): A wins 31.5%, too rarely (fair: 40.0% to 60.0%)
- **warlord vs conductor** (generals): A wins 35.6%, too rarely (fair: 40.0% to 60.0%)
- **engineer vs conductor** (generals): A wins 28.0%, too rarely (fair: 40.0% to 60.0%)
- **hiveMother vs conductor** (generals): A wins 27.9%, too rarely (fair: 40.0% to 60.0%)
- **strategist vs conductor** (generals): A wins 36.3%, too rarely (fair: 40.0% to 60.0%)
- **vs strategist** (bosses): A wins 99.5%, too often (fair: 30.0% to 85.0%)
- **vs engineer** (bosses): A wins 22.9%, too rarely (fair: 30.0% to 85.0%)

#### Generals (A vs B, both with a commander firing its script and ultimate)

| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| captain vs captain | 51.0% | 3.1% | 2 | +1 | 91 s | 40.0%–60.0% |  |
| captain vs warlord | 52.5% | 3.1% | 0 | +6 | 77 s | 40.0%–60.0% |  |
| captain vs engineer | 58.5% | 3.1% | 1 | +5 | 82 s | 40.0%–60.0% |  |
| captain vs hiveMother | 75.1% | 2.7% | 2 | +24 | 86 s | 40.0%–60.0% | too often |
| captain vs strategist | 61.2% | 3.0% | 0 | +16 | 99 s | 40.0%–60.0% |  |
| captain vs conductor | 40.3% | 3.0% | 0 | −5 | 81 s | 40.0%–60.0% |  |
| warlord vs warlord | 47.6% | 3.1% | 6 | −1 | 75 s | 40.0%–60.0% |  |
| warlord vs engineer | 48.7% | 3.1% | 0 | −4 | 72 s | 40.0%–60.0% |  |
| warlord vs hiveMother | 59.4% | 3.0% | 1 | +2 | 74 s | 40.0%–60.0% |  |
| warlord vs strategist | 31.5% | 2.9% | 0 | −10 | 80 s | 40.0%–60.0% | too rarely |
| warlord vs conductor | 35.6% | 3.0% | 0 | −10 | 71 s | 40.0%–60.0% | too rarely |
| engineer vs engineer | 50.4% | 3.1% | 3 | +0 | 117 s | 40.0%–60.0% |  |
| engineer vs hiveMother | 58.0% | 3.1% | 1 | +9 | 79 s | 40.0%–60.0% |  |
| engineer vs strategist | 60.2% | 3.0% | 0 | +7 | 120 s | 40.0%–60.0% |  |
| engineer vs conductor | 28.0% | 2.8% | 2 | −11 | 74 s | 40.0%–60.0% | too rarely |
| hiveMother vs hiveMother | 51.0% | 3.1% | 1 | +1 | 90 s | 40.0%–60.0% |  |
| hiveMother vs strategist | 46.6% | 3.1% | 0 | −1 | 99 s | 40.0%–60.0% |  |
| hiveMother vs conductor | 27.9% | 2.8% | 0 | −19 | 77 s | 40.0%–60.0% | too rarely |
| strategist vs strategist | 50.5% | 3.1% | 0 | −0 | 155 s | 40.0%–60.0% |  |
| strategist vs conductor | 36.3% | 3.0% | 0 | −13 | 89 s | 40.0%–60.0% | too rarely |
| conductor vs conductor | 50.5% | 3.1% | 1 | +1 | 75 s | 40.0%–60.0% |  |

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
| vs hiveMother | 87.0% | 2.1% | 0 | +33 | 79 s | 30.0%–85.0% |  |
| vs hiveMother (no boss rule) | 92.7% | 1.6% | 0 | +37 | 77 s | 0.0%–100.0% |  |
| vs strategist | 99.5% | 0.4% | 0 | +46 | 66 s | 30.0%–85.0% | too often |
| vs strategist (no boss rule) | 99.5% | 0.4% | 0 | +46 | 66 s | 0.0%–100.0% |  |
| vs warlord | 85.3% | 2.2% | 0 | +21 | 92 s | 30.0%–85.0% |  |
| vs warlord (no boss rule) | 92.5% | 1.6% | 1 | +31 | 92 s | 0.0%–100.0% |  |
| vs engineer | 22.9% | 2.6% | 0 | −19 | 76 s | 30.0%–85.0% | too rarely |
| vs engineer (no boss rule) | 95.4% | 1.3% | 0 | +33 | 62 s | 0.0%–100.0% |  |
| vs conductor | 79.0% | 2.5% | 0 | +18 | 69 s | 30.0%–85.0% |  |
| vs conductor (no boss rule) | 82.0% | 2.4% | 0 | +18 | 78 s | 0.0%–100.0% |  |
