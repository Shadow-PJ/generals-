# Achievements for the Epic Games Store

The game's 18 achievements (session 7B), the same as Steam's, to enter in the Developer Portal
under **Game Services > Achievements** for the product, then publish there. Epic requires them:
a game with achievements on another PC store must have them on the Epic Games Store too. The
game unlocks them by their **Achievement ID**, so copy those exactly; the names and descriptions
can be changed later. The list lives in `src/data/achievements.ts`, and a test checks this page
matches it and that the XP adds up.

Each achievement is earned from what the save already records (Command Rank, rulers beaten, the
Combo Codex, Mastery titles), so a player who earned one elsewhere gets it the first time the
game runs from the Epic Games Launcher.

**Set each one up as:**

- **Unlock:** by the game (no stats, no thresholds: the game keeps no Epic stats).
- **Hidden:** no.
- **Locked and unlocked names:** both the name below. **Locked description:** the description
  below. **Unlocked description:** the same, or a line of flavour text.
- **Icons:** `npm run art:achievements -- release/achievements-epic --scale 4` draws each one at
  1024×1024 (the 256×256 Steam icons, each pixel four times bigger, so they stay sharp):
  `<ID>.png` unlocked and `<ID>_locked.png` locked. Check the portal's current icon size when
  uploading; `--scale` takes any whole number.
- **XP:** as below. Epic's rules when this was written: each achievement is worth 5 to 200 XP,
  the base game's add up to exactly 1,000 XP, and the tier follows from the XP (Bronze 5–45,
  Silver 50–95, Gold 100–200). Epic adds a Platinum achievement (250 XP) by itself for players who
  unlock all the others. Check the portal's current rules before entering them.

| Achievement ID | Name | Description | XP | Tier |
| --- | --- | --- | --- | --- |
| `RANK_2` | Field Commander | Reach Command Rank II. | 20 | Bronze |
| `RANK_3` | Tactician | Reach Command Rank III. | 40 | Bronze |
| `RANK_4` | Warmaster | Reach Command Rank IV. | 60 | Silver |
| `RANK_5` | Legend | Reach Command Rank V. | 100 | Gold |
| `BOSS_HIVE_MOTHER` | Swarm Breaker | Beat the Hive Mother, ruler of Deep Forest. | 40 | Bronze |
| `BOSS_STRATEGIST` | Outthought | Beat the Strategist, ruler of Void Ruins. | 45 | Bronze |
| `BOSS_WARLORD` | Blood Spent | Beat the Warlord, ruler of Red Canyon. | 50 | Silver |
| `BOSS_ENGINEER` | Walls Come Down | Beat the Engineer, ruler of Iron Fortress. | 55 | Silver |
| `BOSS_CONDUCTOR` | Silence | Beat the Conductor, ruler of Glass Plains. | 60 | Silver |
| `ALL_RULERS` | Master of the Realm | Beat all five rulers. | 100 | Gold |
| `COMBO_FIRST` | Chain Reaction | Land a signature combo. | 15 | Bronze |
| `COMBO_ALL` | Combo Scholar | Land every signature combo. | 60 | Silver |
| `FINISHER` | Finishing Blow | Fire your ultimate as the 3rd link of a chain: a Finisher. | 25 | Bronze |
| `SYNERGY_ALL` | In Harmony | Switch on every troop synergy. | 50 | Silver |
| `CODEX_FULL` | The Complete Codex | Fill every entry of the Combo Codex. | 100 | Gold |
| `MASTERY_FIRST` | Titled | Earn a Mastery title. | 20 | Bronze |
| `MASTERY_GENERAL` | Gold Trim | Meet all three Mastery challenges of one General. | 60 | Silver |
| `MASTERY_ALL` | Grand Master | Meet every Mastery challenge of every General. | 100 | Gold |
