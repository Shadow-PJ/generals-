# Achievements for Steamworks

The game's 18 achievements (session 7A), to enter in Steamworks under **Stats & Achievements >
Achievements**, one row each. The game unlocks them by their **API name**, so copy those exactly;
the names and descriptions can be changed later. The list lives in `src/data/achievements.ts`,
and a test checks this page matches it.

Every achievement is earned from what the save already records (Command Rank, rulers beaten, the
Combo Codex, Mastery titles), so a player who earned one before the game ran under Steam gets it
the first time it does. Nothing is earned in the browser build, versus matches or a skirmish
except through those records.

**Icons:** `npm run art:achievements` draws each one, 256×256, into `release/achievements/`:
`<API name>.png` for **Achieved** and `<API name>_locked.png` for **Unachieved**. Check
Steamworks' current icon size on its upload page; Steam shows them at 64×64.

Leave **Hidden** off for all of them, leave them set by the client (the game unlocks them
itself; no game server is involved), and give them no progress stat (the game keeps no Steam stats).

| API name | Name | Description |
| --- | --- | --- |
| `RANK_2` | Field Commander | Reach Command Rank II. |
| `RANK_3` | Tactician | Reach Command Rank III. |
| `RANK_4` | Warmaster | Reach Command Rank IV. |
| `RANK_5` | Legend | Reach Command Rank V. |
| `BOSS_HIVE_MOTHER` | Swarm Breaker | Beat the Hive Mother, ruler of Deep Forest. |
| `BOSS_STRATEGIST` | Outthought | Beat the Strategist, ruler of Void Ruins. |
| `BOSS_WARLORD` | Blood Spent | Beat the Warlord, ruler of Red Canyon. |
| `BOSS_ENGINEER` | Walls Come Down | Beat the Engineer, ruler of Iron Fortress. |
| `BOSS_CONDUCTOR` | Silence | Beat the Conductor, ruler of Glass Plains. |
| `ALL_RULERS` | Master of the Realm | Beat all five rulers. |
| `COMBO_FIRST` | Chain Reaction | Land a signature combo. |
| `COMBO_ALL` | Combo Scholar | Land every signature combo. |
| `FINISHER` | Finishing Blow | Fire your ultimate as the 3rd link of a chain: a Finisher. |
| `SYNERGY_ALL` | In Harmony | Switch on every troop synergy. |
| `CODEX_FULL` | The Complete Codex | Fill every entry of the Combo Codex. |
| `MASTERY_FIRST` | Titled | Earn a Mastery title. |
| `MASTERY_GENERAL` | Gold Trim | Meet all three Mastery challenges of one General. |
| `MASTERY_ALL` | Grand Master | Meet every Mastery challenge of every General. |
