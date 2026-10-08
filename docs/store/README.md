# Store kit

Everything for putting Generals on a store (session 7A), apart from the art itself.

| File | What it is for |
| --- | --- |
| [description.md](description.md) | The store page's words: short description, long description, feature list, tags |
| [capsules.md](capsules.md) | Every capsule and library image Steam asks for, with its size and what to draw |
| [screenshots.md](screenshots.md) | Which screenshots to take and how to take them sharp |
| [trailer.md](trailer.md) | The trailer, shot by shot |
| [ai-disclosure.md](ai-disclosure.md) | A draft of Steam's AI content disclosure, to paste into the content survey |
| [steam/README.md](steam/README.md) | Setting up the app in Steamworks: depots, launch options, Steam Cloud, achievements, rich presence, uploading builds |
| [steam/achievements.md](steam/achievements.md) | The 18 achievements to enter in Steamworks, with their API names |
| [steam/rich-presence-english.vdf](steam/rich-presence-english.vdf) | The rich presence file to upload |

## In order

1. Steamworks sign-up, the fee and the tax and bank forms (the owner's checklist in `docs/PLAN.md`).
2. Create the app; note its App ID and the two depot ids ([steam/README.md](steam/README.md)).
3. Enter the achievements and upload their icons (`npm run art:achievements`), and upload the rich presence file.
4. Set up Steam Cloud and the launch options.
5. Make the capsules and screenshots, write the page from [description.md](description.md), fill in
   the content survey with [ai-disclosure.md](ai-disclosure.md), and submit the Coming Soon page.
6. Build and upload with `npm run steam:upload`, check it on a test branch, then submit the build
   for review.

The Epic Games Store (session 7B) reuses the words, screenshots and trailer; its image sizes differ.
