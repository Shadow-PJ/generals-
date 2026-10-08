# Setting up Generals on the Epic Games Store

What to set in Epic's Developer Portal (dev.epicgames.com/portal) once the product exists, and
how builds get there (session 7B). Epic's documentation is the authority; check it where this
says so, since the portal's pages move.

## How the game uses Epic

The desktop app talks to **Epic Online Services (EOS)** through Epic's own C SDK, called from
`desktop/eos.ts` with koffi; `desktop/epic.ts` signs the player in and does the rest. The game
itself only names achievements and presence lines, through `src/platform`, as it does for Steam.

- **Epic turns on only in the Epic build, started by the Epic Games Launcher.** The launcher
  passes a one-time code (`-AUTH_PASSWORD=…` with `-AUTH_TYPE=exchangecode`) and the sandbox
  (`-epicsandboxid=…`); the app signs the player in with it, with no login screen, and never
  writes it to its log. Started any other way, without the SDK beside it, or when signing in
  fails, the game plays exactly as it does elsewhere.
- **Achievements:** the 18 in [achievements.md](achievements.md), which Epic requires since
  the game has them on Steam. Signing in takes two steps: the player's Epic account (Epic
  Account Services), then the game's own services (Connect), where achievements live; a
  player's first time creates their user there. The game unlocks each achievement as the save
  earns it, and at start-up any earned before.
- **Presence:** friends see the same lines as on Steam, as text: "On a run in Red Canyon",
  "Facing The Warlord in Red Canyon", "In a versus match" (`desktop/presence.ts`).
- **The overlay:** Epic's overlay (friends, achievement pop-ups) needs the GPU in the app's own
  process, so the app turns on the same two Chromium switches it does for Steam's. If the
  overlay misbehaves, upload with `npm run epic:upload -- --no-overlay` (the game then starts
  with `--eos-no-overlay`).
- **Saves** stay in `%APPDATA%\Generals\saves` on each PC: Epic has no Auto-Cloud like
  Steam's, and EOS's cloud storage would need its own code.
- **Cross-play:** see [below](#cross-play).

## 1. Product, sandboxes and deployments

Under **Product Settings**, note the **Product ID**. The product has three sandboxes, **Live**,
**Stage** and **Dev**; give each a **deployment** (Product Settings > Sandboxes, or Deployments)
and note each sandbox's id with its deployment's id. The launcher names the sandbox but not the
deployment, so the build carries the list.

## 2. A client, and Epic Account Services

1. **Product Settings > Clients:** add a client whose **client policy** lets a game client
   unlock achievements for its own player: the **GameClient** policy type, or a custom one
   allowing Achievements' unlock for the local user and Connect's sign-in. Note its **Client
   ID** and **Client Secret**. They ship inside the game, as every EOS game client's do; the
   policy limits what they can do.
2. **Epic Account Services:** create an application.
   - **Brand settings:** the game's name, website and privacy policy link (required).
   - **Permissions:** **Basic Profile** and **Online Presence**, the two the game asks for.
   - **Linked clients:** the client from step 1.

## 3. Achievements

Enter the 18 under **Game Services > Achievements** as [achievements.md](achievements.md)
says, with their XP and the icons from
`npm run art:achievements -- release/achievements-epic --scale 4`, then publish them to each
sandbox (Dev first, to test).

## 4. The build

The Epic build is the same Windows app as Steam's, plus Epic's SDK library and the game's EOS
settings (`resources/eos/epic.json`) in its folder.

1. **The SDK:** download the **EOS SDK for C** (Developer Portal > SDK & Release Notes) and copy
   `SDK/Bin/EOSSDK-Win64-Shipping.dll` into `desktop/eos/` (git ignores it there). Use a
   current SDK: an older one turns the game's options down, and the log says so.
2. **The Windows app:** run **Actions > Store builds > Run workflow**, download
   **Generals-Steam-Windows** (nothing in it is Steam-only: Steam turns on only under Steam)
   and unpack it: `tar -xzf Generals-Steam-Windows.tar.gz -C release`. Or run
   `npm run desktop:steam` on a Windows PC. Either gives `release/win-unpacked`.
3. **Stage it:**

   ```sh
   export EOS_PRODUCT_ID=<product id> EOS_CLIENT_ID=<client id> EOS_CLIENT_SECRET=<client secret>
   export EOS_DEPLOYMENTS="<live sandbox>:<live deployment>,<stage sandbox>:<stage deployment>,<dev sandbox>:<dev deployment>"
   npm run epic:stage
   ```

   (In PowerShell: `$env:EOS_PRODUCT_ID = "<product id>"` and so on.) This makes
   `release/epic/Generals`: the app with `resources/eos/EOSSDK-Win64-Shipping.dll` and
   `resources/eos/epic.json`. Put Live first: it is used when the launcher names no sandbox.

## 5. Uploading with BuildPatchTool

1. **Product Settings > BPT Credentials** (BuildPatchTool's own client): note its id and secret.
   Under **Artifacts and Binaries**, note the **Artifact ID** of the game's Windows artifact and
   your **Organization ID**, and download **BuildPatchTool**.
2. Upload:

   ```sh
   export EPIC_ORGANIZATION_ID=<organization id> EPIC_ARTIFACT_ID=<artifact id>
   export EPIC_BPT_CLIENT_ID=<BPT client id> EPIC_BPT_CLIENT_SECRET=<BPT client secret>
   export BUILD_PATCH_TOOL=<path to BuildPatchTool>   # if it isn't on the PATH
   npm run epic:upload -- --dry-run   # checks the folder and prints the command
   npm run epic:upload
   ```

   It runs `BuildPatchTool -mode=UploadBinary` on `release/epic/Generals`, with
   `Generals.exe` as the program to start and a version made of the game's version, the commit
   and the time. The BPT secret stays in the environment (`-ClientSecretEnvVar`), never on the
   command line. Check the flags against Epic's BuildPatchTool guide if it complains.
3. **Artifacts and Binaries:** the new binary appears there. Label it for **Windows** in the
   **Dev** sandbox to test it, then in **Live** once it is checked. The upload sets the
   launch program; nothing else needs setting.

## Testing

- **From the launcher:** members of your organization see builds labelled in Dev and Stage in
  their Epic Games Launcher library. Start the game there: the app's log says
  "Epic is on, in sandbox …" and "Epic: signed in."; earn an achievement (or start with a save
  that has some) and it pops up in the overlay and shows in the launcher.
- **Without the launcher:** run Epic's **Developer Authentication Tool** (in the SDK's `Tools`
  folder), sign in on it, and name the credential (say `Ali`) on port 6547. Then start the Epic
  build with
  `release\epic\Generals\Generals.exe --eos-dev-auth=localhost:6547/Ali -epicsandboxid=<dev sandbox>`.
  From the repository, `npm run desktop` does the same with the DLL and an `epic.json` in
  `desktop/eos/` (copy the one `npm run epic:stage` writes).
- **Before any of that:** the tests run the binding against a stand-in for the SDK
  (`desktop/testing/fakeEos.c`), so the struct layouts and callbacks are checked on every pull
  request; only Epic's real servers are left for this testing.

## Cross-play

Epic requires a multiplayer game sold on its store to play with players from other PC stores.
Generals' Versus (session 6D) already does: matches run through the game's own relay server,
not any store's service, so Epic, Steam, desktop and browser players join each other the same
way, by a four-letter room code, with no store account needed on either side. Nothing is set
up for it in the portal; the relay's address is built into the app (the `RELAY_URL` repository
variable the Store builds workflow passes). The game uses none of EOS's lobbies or networking.

## The store page

- **Words:** [../description.md](../description.md); screenshots and the trailer as for Steam.
- **Images:** Epic's sizes differ from Steam's: among others a landscape offer image
  (2560 × 1440), a portrait one (1200 × 1600) and a logo with a transparent background. Take the
  current list from the portal's store page editor, and the art rules from
  [../capsules.md](../capsules.md).
- **Age rating:** the IARC questionnaire in the portal; answers in [../age-rating.md](../age-rating.md).
- **AI content:** if the portal asks about AI-made content, [../ai-disclosure.md](../ai-disclosure.md)
  answers it as for Steam.
