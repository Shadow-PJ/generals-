# Age rating: questionnaire answers

The Epic Games Store asks every game for an age rating, and gives one free through the
**International Age Rating Coalition (IARC)**: a questionnaire in the Developer Portal's rating
step, whose answers turn into ratings for each region (ESRB, PEGI, USK, ClassInd, ACB and
others). This page drafts the answers for Generals as it is after session 7B (other stores
that use IARC take the same answers).

IARC words its questions its own way and changes them now and then, and a wrong answer can
mean a re-rating or worse, so read each question and answer it from the facts below, not by
matching wording. Everything here is checked against the game's data (`src/data`) and art.

Before starting: the questionnaire asks for an email address for IARC's messages and a public
support email address shown with the rating.

## Category

**Game.** It is a strategy game, played alone or against a friend.

## The game in facts

| Topic | What Generals has |
| --- | --- |
| **Violence** | Fantasy combat between tiny pixel-art soldiers (16×16-pixel sprites) seen from above: swords, bows, shields and magic. A hit shows a small yellow spark and a damage number; a soldier who falls disappears in a gray puff. No blood, no gore, no body parts, no lasting bodies, no cruelty, no violence against people who aren't fighting, no realistic weapons and no realistic people. The player gives orders; they never control one soldier's attacks directly. |
| **Blood** | None shown. Words only: names such as "Bloodbound" (a faction), "Blood Pact" (sacrifice a soldier for power), "Blood Oath", "Blood Spent" (an achievement) and lines such as "Blood will flow." from the Warlord. |
| **Fear and horror** | None. "Fear" is a difficulty score for the vows you take. The Hive Mother's troops grow shells and claws as they win fights ("Adapt or be eaten"), drawn in the same small pixel art. Nothing is meant to scare. |
| **Language** | No swearing, no slurs, no crude words. Generals reply to orders in short lines written for the game. |
| **Sexual content and nudity** | None. |
| **Drugs, alcohol and tobacco** | None. One event mentions a "smoky tent". |
| **Crude humor** | None. |
| **Discrimination** | None. |
| **Gambling** | **Simulated gambling, mildly:** one of the run's ten random events, the Gamblers' Tent ("Dice clatter in a smoky tent. 'Double or nothing, Commander?'"), offers to bet 30 of the run's gold on even odds to win 75. No real money, nothing to buy, no casino games shown, and the gold is lost when the run ends. |
| **Random rewards** | After a won fight the player picks 1 of 3 offers (fighters and boons) rolled by rarity. They are earned by playing, never bought: the game has no purchases at all. |
| **In-game purchases** | None: no real money, no loot boxes, no premium currency, no ads. |
| **Players interacting** | Versus: two friends play a match by sharing a four-letter room code. Only armies, cards (made of fixed parts; the order a player typed travels inside its card but is never shown to the other player) and key presses go between the two games, through the game's relay server. No chat, no voice, no names or profiles shown, no pictures or other content shared, no matching with strangers. |
| **Location and personal data** | The game shares no location and asks for no personal information. The relay keeps nothing. |
| **Internet** | No browser or unrestricted internet inside the game. It goes online only for Versus (the relay), and, in the Epic and Steam builds, for the store's achievements and friends' presence. An optional setting downloads a small open language model for reading orders. |
| **AI** | Orders written in plain English become cards through a rule parser and a small model running on the player's computer; it only ever picks parts of a card from fixed lists, and the General's replies are pre-written (`docs/store/ai-disclosure.md`). |

## Answers

| Question (as IARC asks it, roughly) | Answer |
| --- | --- |
| Violence of any kind? | **Yes**: fantasy violence against fantasy characters, not realistic, no blood or gore. |
| Is the violence realistic, or against humans who look real? | **No**: tiny pixel-art soldiers and creatures. |
| Blood or gore? | **No.** |
| Violence the player must commit to progress? | **Yes**, the battles: mild and cartoonish, as above. |
| Frightening or horror content? | **No.** |
| Sexual content or nudity? | **No.** |
| Crude or offensive language? | **No.** |
| References to or use of drugs, alcohol or tobacco? | **No.** |
| Crude humor? | **No.** |
| Discrimination or hate? | **No.** |
| Simulated gambling? | **Yes**: one event bets in-game gold on even odds (see above); no real money. |
| Real-money gambling? | **No.** |
| Users can chat or share content with others? | **No**: Versus sends only moves, no text, voice or pictures. |
| Shares the user's location? | **No.** |
| Digital purchases? | **No.** |
| Random items bought with real money (loot boxes)? | **No.** |
| Unrestricted internet access? | **No.** |

**Likely result:** a low rating for fantasy violence (around ESRB E10+, PEGI 7, USK 6), with
**simulated gambling** possibly raising it (PEGI, for one, rates simulated gambling 12). That
one event decides it: if a lower rating matters more than the event, change the Gamblers' Tent
to something other than a bet before rating (an owner decision; see the 7B pull request).

## Checklist

- [ ] Re-read each question in the portal and fit the answers to it
- [ ] Decide on the Gamblers' Tent before submitting
- [ ] Enter the IARC and support email addresses
- [ ] Keep the certificate IARC emails; other stores that use IARC can take the same rating
