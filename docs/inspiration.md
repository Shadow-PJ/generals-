# What Generals takes from other games (session 5F)

The owner asked to look at six games, see how they work and why they are good, and bring the best
of it into Generals. This page is that look, and what came of it. Session 5F builds three things;
the rest is noted for later sessions.

## The six games

**Skul: The Hero Slayer** (action roguelite). You carry two skulls, each a whole class with its own
moves, and swap between them with a key; the swap is an attack itself, on a cooldown. Items carry
*Inscriptions*: three items of one Inscription beat three unrelated rarer ones.
*Why it works:* every pickup asks "what does this make with what I have?", and the swap turns two
kits into one rhythm. *Generals has* the Inscription idea already: factions switch on at 2, 4 and
6 fighters (session 5C).

**Hades II** (action roguelite). Gods offer *boons* of rising rarity; holding boons of two gods
can bring a *duo boon* that only that pair offers. The *Oath of the Unseen* lets you take vows
before a run (tougher foes, fewer rewards, harsher bosses), each adding *Fear*, and harder runs pay
more. *Arcana* cards are a meta loadout limited by *Grasp*.
*Why it works:* duo boons reward mixing two directions instead of one; the Oath lets every player
set their own difficulty, and turns a beaten game into a ladder to climb.

**9 Kings** (kingdom builder, auto-battler). Each year you place one card on a small grid, then an
enemy king's army attacks and the battle plays itself, apart from your castle's ability. Beating a
king lets you take a card from *his* deck, so runs mix the kings' kits; *royal decrees* change the
rules. 33 short years, then a boss, then endless.
*Why it works:* tiny, readable choices with big consequences, and taking your enemies' tools.
*Generals has* recruiting beaten rulers as Generals and learning their Legendary actions (5D).

**Thronefall** (minimalist strategy). By day you build with a few coins, choosing between two
upgrades per building; by night you defend, and you can see where the next night's enemies will
come from. *Mutators* make a run harder and multiply its score; perks and a weapon change how you
play.
*Why it works:* almost nothing on screen, every decision is legible, and you plan against an enemy
you can see coming.

**The King is Watching** (roguelite city builder). Only the buildings inside the king's *gaze*, a
grid you move and turn, work. Resources and troops come from where you look, between enemy waves.
*Why it works:* one simple, physical rule makes every moment a choice of where to put your
attention.

**Nordhold** (roguelite tower defense). Towers on a hex map, upgrades that combine into
powerhouses, an economy that pays for the next wave, and the waves are shown ahead.
*Why it works:* you always know what is coming, so losing feels like your plan's fault, and the
plan is yours to fix.

## What they share, and what Generals lacked

1. **You can see what is coming** (Thronefall, Nordhold, 9 Kings). Generals' run map showed only
   what *kind* of stop a node is; the enemy army was a surprise until you stood in front of it.
2. **Difficulty you choose, with a reason to choose it** (Hades II's Oath, Thronefall's mutators).
   Generals had Ironman, and nothing between "normal" and "permadeath".
3. **Mixing two directions pays off** (Hades II's duo boons, 9 Kings taking cards from many
   kings, Skul's pairs of skulls). Generals' factions rewarded going deep into one; nothing
   rewarded two at once.
4. **One simple physical control in the fight** (The King is Watching's gaze, Skul's swap,
   9 Kings' castle ability). Generals has cards and the ultimate; nothing you steer on the field.

## Built in session 5F (the owner picked these)

- **Oaths of Command** (from 1 and 2: Hades II's Oath, Thronefall's mutators). Before a run, take
  vows that make it harder: tougher enemy troops, sharper commanders, a crueler ruler, lean purses,
  lasting wounds. Each rank adds Fear. Fear raises the Insight every battle earns, and winning a
  region at a new highest Fear pays a bounty. See `docs/DESIGN.md`, Oaths of Command.
- **Scouting** (from 1: Thronefall, Nordhold). Every fight on a run's map is fixed when the map is
  made, so picking a node shows its army before you go: troops, rarities, commander and General.
- **Duo boons** (from 3: Hades II's duo boons, 9 Kings' mixed decks). Once two factions' bonuses
  are on in your army, the spoils can offer a duo boon of that pair: it counts for both factions and
  adds an effect of its own.

## Noted for later

- **Two Generals, swap mid-battle** (Skul): lead with two recruited Generals and swap with a key,
  on a cooldown; troop skill, doctrine and ultimate change, and the swap strikes. The biggest change
  to battles; it touches the sim, the Command bar and every General's balance.
- **The General's Banner** (The King is Watching): a zone you steer across the field with the arrow
  keys or a stick; troops near it fight harder. It would give the battle a steady hands-on control
  between card presses, and fits the controller work of session 6C.
- **Endless after the last ruler** (9 Kings): keep fighting stronger armies after the fifth boss,
  for a high score.
- **Taking the beaten General's card** (9 Kings): after an elite fight, pick one of the enemy
  commander's cards as a run-long decree.
- **Two clear choices instead of three** (Thronefall): some stops could offer a sharp either/or.
