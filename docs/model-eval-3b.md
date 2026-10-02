# Model test report (session 3B)

Can a small open model, running on the player's computer, read free-form orders into cards?
This report tries two existing models with no training, in the game's own pipeline, and recommends
what to do next.

## Setup

- **Test orders:** the held-out quarter of `tools/dataset/natural.txt`: 249 hand-written orders
  across 83 kinds of card, with slang, typos and long orders. A result counts only if the card
  is exactly right: every condition, step, troop and target.
- **Runtime:** llama.cpp compiled to WebAssembly (wllama 3.8.1), in a Web Worker, CPU only, which
  is what the game ships. Headless Chromium on GitHub's Linux runners. "Desktop" means the
  page is cross-origin isolated the way the desktop app serves it, so the model gets 2 threads
  on these runners. "Browser" means 1 thread, as on GitHub Pages, which can't send the headers
  that multi-threading needs.
- **Prompt:** a short description of the card format plus 8 worked examples, none from the test
  set. The output is forced into the card format by a grammar built from the card schema, so the
  model can only write a card's JSON. Each output still goes through the validator, as every card
  does.
- **Reproduce:** run the "Model eval" workflow from the Actions tab, or locally
  `npx tsx tools/eval/model/run.ts --model qwen2.5-0.5b --isolated`. The parser's own eval is
  `npm run eval`.

## Results

| | Qwen2.5 0.5B Instruct (Q4_K_M) | SmolLM2 360M Instruct (Q8_0) | Rule parser alone |
| --- | --- | --- | --- |
| Exact cards, model alone | **12.4%** (31 of 249) | **2.8%** (7 of 249) | 39.0% (97 of 249) |
| Exact cards, parser first then model (what the game does) | 45.0% | 40.6% | 39.0% |
| Wrong cards (not "no card") | 137 | 148 | 2 |
| Desktop, 2 threads: time per order, median (90th percentile) | 9.5 s (16.9 s) | 14.0 s (16.2 s) | under 1 ms |
| Desktop: first order, which also reads the prompt | 125 s | 96 s | – |
| Browser, 1 thread: time per order, median | 16.5 s | 26.5 s | under 1 ms |
| Browser: first order | 237 s | 174 s | – |
| Download | 491 MB + 8.8 MB runtime | 386 MB + 8.8 MB runtime | 0 |
| License | Apache-2.0 | Apache-2.0 | – |

**In the Windows desktop app** (GitHub's Windows runner, 2 threads, through the installed app):
Qwen downloaded and started in about 30 s, then took 6.5 minutes to read its prompt the first
time. After that each order took about 38 s. Both test orders came out wrong: "yo team just chill
where u are for a sec" became "Rangers hold" (it should be everyone holding), and "drop their
ranger asap" became "Rangers focus the nearest enemy".

### What goes wrong

- **Qwen** usually understands that the order is about a troop class, but puts that class in the
  wrong place. "take out there rangers" becomes "Rangers focus the nearest enemy" instead of
  "Focus enemy Rangers". It also picks the wrong skill ("burst the mage" becomes "Overcharge your
  Rangers"), and now and then invents a condition.
- **SmolLM2** invents a condition in 189 of its 242 misses ("When your Guardian drops below 30%
  HP: Protect your Guardian" for "burst their healer down"), copying the shape of the worked
  examples rather than reading the order.
- **Both** turn almost every order the parser couldn't read into a wrong card instead of no card.
  A wrong card is worse than "I didn't catch that": the player has to notice it and fix it.
- **Speed:** a 0.5B model reads about 10 tokens a second here, and a card's JSON is about 60
  tokens, so each order takes several seconds even after the prompt is cached. The first order
  pays for the whole 1,000-token prompt as well.

## Recommendation: fine-tune, but a smaller model with a shorter output

Don't keep either model as it is: 12% and 3% are far below usable, and 10–40 s per order is too
slow for writing cards. But the problem is narrow and well specified, which suits fine-tuning:

1. **Session 3C, changed slightly:** fine-tune **SmolLM2 135M** (Apache-2.0, about 100 MB at
   8-bit), not a 0.5B model. Train it on `npm run dataset` output plus the training part of
   `natural.txt`.
2. **Teach it a compact card code** instead of JSON, for example `F all >ranger` for "Focus enemy
   Rangers", so a card is 10–20 tokens instead of 60. A fine-tuned model also needs no worked
   examples in its prompt, which removes the slow first order. Together these should bring it to
   roughly 1–2 s per order on 2 threads (an estimate to confirm in 3C).
3. **Bar to ship:** at least 90% exact cards on this same held-out test set, and at most 2 s
   per order in the desktop app. The eval and the Windows check from this session measure both.
4. **If 3C misses the bar**, switch to intent and slots: a few-MB classifier that tags words with
   their roles, plus the rule parser's grammar to assemble the card. It is near-instant, but
   needs more hand-built structure for multi-step orders and conditions.

Until then the parser stays the default reader, and the model setting stays off and marked
experimental.
