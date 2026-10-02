# Order reader report (session 3C)

After the 3B report, the owner chose the third route from the design: instead of fine-tuning a
language model, build a tiny intent-and-slots model that only recognises the parts of an order
and fills in their details. This report says how it works and how well it reads orders, with
the same test as 3B, before and after.

## How it works

The order reader (`src/cards/reader/`) reads an order in four steps:

1. **Words.** The order is split into lowercase words; typos are fixed against the 582 words it
   knows (`rangrs` → `rangers`, `hodl` → `hold`), and chat spellings are read (`u` → `you`).
2. **Tags.** Every word gets a tag saying which part of the card it belongs to: the condition
   word ("when", "every time"), a trigger and who sets it off ("their assassin" + "dives"), or a
   step and its role there: who acts, what they do, whom or where ("rangers" + "fall back" +
   "to the healer"). A tagger picks the best tags for the whole order at once.
3. **Kinds.** Three small classifiers decide the kind of each trigger (4 kinds), the action of
   each step (7 actions), and what each step aims at (a troop class, the nearest, the weakest,
   "him", forward, back, behind the enemy, or nothing).
4. **Card.** Fixed code builds the card from those parts and reads the values from the words
   themselves: troop classes from a word list, numbers, and "hurt" = 50% HP from
   `src/data/cards.ts`. It adds nothing that isn't in the words.

It refuses ("I didn't catch that order") when any decision is too close to call, when a word
where the troops or the action should be is one it doesn't know, when it can't find which troops
a step means, or when "him" has no condition naming him. The validator runs after it, as after
every translator, so rank rules can't be broken by it.

**The model** is an averaged perceptron: a linear model, the classic way to train taggers. Its
features are short strings like "the word is *retreat*" or "the word before is *their*", each
with a weight per answer. Reading an order is adding up weights, so it is fast and gives the
same answer on every computer. It is about 27,000 features with whole-number weights.

**Training** (`npm run train:reader`, 35 seconds) uses 30,000 orders from the dataset generator
(`tools/dataset/generate.ts`), which now labels every word with its tag and adds slang, filler
words, plan names ("ambush: ..."), odd word orders ("fall back, rangers") and typos. How sure
the reader must be before it answers is set on the training part of `natural.txt`: the margins
that give the most right cards, counting a wrong card as 4 times worse than no card. Training is
deterministic: CI retrains and checks that `models/order-reader.json` is exactly what the code
makes.

**In the game**, the order goes to the rule parser first, then to the reader, then (only if
switched on in Settings) to the experimental language model from 3B. The weights are a separate
file of the game, loaded in the background at start; the Orders screen asks you to check a card
the reader or the model made.

## Test setup

- **natural.txt, test part:** the same 249 held-out orders as the 3B report (83 kinds of card).
  Nothing trains on them.
- **fresh.txt:** 174 new orders over 22 kinds of card, many of them kinds natural.txt doesn't
  have (Invoker dives, 2 enemies grouped, the reserve Ranger then Rangers forward ...). They
  were written before the reader existed, and nothing trains on them either.
- **Reproduce:** `npm run eval` (test part), `npm run eval -- --set fresh`, `-- --set train`.
  `npm test` checks floors a little under these results.

## Results

| | Rule parser alone (before) | Parser, then Qwen2.5 0.5B (3B) | Parser, then the order reader (now) |
| --- | --- | --- | --- |
| Exact cards, natural.txt test part (249) | 39.0% | 45.0% | **94.0%** (234) |
| Wrong cards there (not "no card") | 2 | most misses (the model alone made 137) | **6** (2 by the parser, 4 by the reader) |
| Exact cards, fresh.txt (174) | 48.9% | not measured | **96.6%** (168) |
| Wrong cards there | 0 | – | **0** |
| Time per order (median, 90th percentile) | 0.04 ms | 9.5 s, 16.9 s (desktop) | **0.10 ms, 0.31 ms** |
| First order | – | 125 s (desktop), 237 s (browser) | ready about 20 ms after the file loads |
| Size | none | 491 MB download + 8.8 MB runtime | **1.0 MB** (270 KB compressed), shipped with the game |

The reader on its own, without the parser in front, reads 94.0% of the test part (6 wrong) and
95.4% of fresh.txt (1 wrong). On the training part of natural.txt the chain reads 94.0% (19 wrong,
of which the parser makes 9).

Done-when check for 3C: under 10 ms an order (under 0.5 ms for 9 orders in 10 here), under 5 MB
(1 MB), and this report.

### What it still gets wrong

- **Ambiguous words**, where it picks the common meaning: "healers on the archers" becomes Focus
  (it should be Protect: "on" usually means attack), "guardians heal the weakest one" becomes
  Focus the weakest enemy, "vanguards take ground" becomes Hold.
- **A troop name swallowed by the condition** when there is no comma: "when their vangaurd
  dives rangers retreat" loses the Rangers and becomes everyone falling back.
- **What it refuses**, rather than misreads: troops it has no word for ("the stabby guy"),
  conditions hidden in the middle of a step ("cover whoever drops below 50%"), words it doesn't
  know ("hide behind the tank", "before he casts again"), and a few orders where it isn't sure
  where a step ends.

### How far to trust these numbers

The same author (Claude) wrote natural.txt, fresh.txt and the generator's word lists, so the
reader has seen the kind of slang these tests use; real players will say things nobody here
thought of, and will find it less accurate. Also, the held-out sets were measured several times
while building it, and one round of fixes came after seeing their failures: the main one was a
bug (common typos counted as known words, so they were never fixed), plus four generator changes
(more "kill X, then Y" orders, more "send the tanks to ...", "dig in everyone" without a comma,
"get the backup healer in"). All later fixes came from the training part of natural.txt only.
The training part (94.0%) agrees with the test results, which suggests they aren't just fitted to
the test.

## Recommendation

Keep the order reader as the default: it reads about nine in ten free-form orders, in a
fraction of a millisecond, with no download, and says so when it isn't sure. Keep the language
model setting as an experimental extra, off by default; it is rarely needed now.

To improve it later: when a playtest shows an order it gets wrong or refuses, add that way of
saying it to the generator, retrain (`npm run train:reader`) and commit the new weights; add the
order to a test set too. When session 4B gives the player Invokers and Assassins, the generator
needs them as your own troops, and the reader a retrain. Voice input (3D) goes through the same
chain.
