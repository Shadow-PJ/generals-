# Steam AI disclosure: draft

For the **AI Generated Content** part of Steam's Content Survey (Steamworks > Store Page Admin >
the content survey). Steam shows much of it on the store page. Its two questions are about
content made with AI tools **before** release, and content an AI **makes while the game runs**,
with the guardrails that keep the second safe. A coding assistant used only to write code needs
no disclosure; what players see or hear does.

Read the survey's current wording before pasting: Steam has changed it more than once. The draft
below matches the game as of session 7A; `docs/CREDITS.md` lists every asset and how it was made.

## Pre-generated content

**Does the game include content made with AI tools during development?** Yes.

> Generals' pixel art, sound effects and music were made for this game by an AI coding
> assistant (Claude Code), working for the developer, as source code: every sprite is written as
> rows of characters, every sound effect is a synthesizer recipe, and every piece of music is
> written as notes, all played or drawn by the game's own code. No image, sound or music
> generation model was used, and nothing was traced, sampled or copied from other work. The
> developer reviewed and chose all of it. The fonts (Pixelify Sans, Jacquard 12) are made by
> people and used under the SIL Open Font License.
>
> The store page's capsule art, screenshots and trailer are [made by … / taken from the game:
> fill in once they exist].

## Live-generated content

**Does the game use AI to make content while it runs?** Yes, in one narrow way.

> Players write their orders in plain English, and the game turns each order into a Command
> card. Orders the rule-based parser can't read go to a small model trained only for this game
> (about 1 MB, it runs on the player's computer, offline). It never writes text, images or
> sound: it can only pick parts of a card (an action such as "focus", a troop class, a condition)
> from fixed lists.
>
> Guardrails:
> - **A fixed card format.** Every output is a card made of pre-defined parts; there is no free
>   text in it, so nothing the model produces can be offensive or illegal content.
> - **A validator.** Every card is checked against the game's rules before it can be used, and
>   one that breaks them is turned down.
> - **Pre-written replies.** What the player's General says back is chosen from lines written
>   by the developer, not generated.
> - **The player sees the card before using it**, and can rephrase or edit it from menus.
>
> An optional, experimental setting (off by default) lets players download a small open
> language model (Qwen2.5 0.5B Instruct or SmolLM2 360M Instruct, Apache-2.0) to read orders the
> other two can't. It runs on the player's computer and is held to the same card format,
> validator and pre-written replies: its output is only ever a card.
>
> Players can't use any of this to make or share content with others: in Versus matches only
> armies, cards (checked by both games) and key presses travel.

## Checklist

- [ ] Re-read the survey's current questions and fit the draft to them
- [ ] Fill in who made the capsules, screenshots and trailer
- [ ] Confirm every AI-made asset in `docs/CREDITS.md` is covered above
