# Setting up Generals in Steamworks

What to set in Steamworks once the app exists, and how builds get there (session 7A). Valve's
pages are the authority (partner.steamgames.com/doc); check them where this says so.

## How the game uses Steam

The desktop app talks to Steam through **steamworks.js** (`desktop/steam.ts`); the game itself
only names achievements and presence lines, through `src/platform`. Steam turns on when Steam
starts the game (Steam sets the `SteamAppId` environment variable for the games it starts). Run
any other way (the GitHub installer, the AppImage, the browser), or with Steam not running,
the game plays exactly as before: no achievements, no presence, no overlay. Nothing needs Steam
to work.

- **Achievements:** the 18 in [achievements.md](achievements.md). The game unlocks each as your
  save earns it, and at start-up unlocks any earned before it ran under Steam.
- **Rich presence:** your friends see "On a run in Red Canyon", "Facing the Warlord in Red
  Canyon", "In a versus match" and so on, from [rich-presence-english.vdf](rich-presence-english.vdf).
- **The overlay:** Shift+Tab works in game. The app turns on two Chromium switches for it when
  Steam is running (steamworks.js's `electronEnableSteamOverlay`).
- **Steam Cloud:** set up in Steamworks only (below); the game keeps its saves in one folder for it.

## 1. App and depots

Create two depots under **SteamPipe > Depots**:

| Depot | Operating system | Contents |
| --- | --- | --- |
| Generals Windows | Windows, 64-bit | `release/win-unpacked` |
| Generals Linux | Linux + SteamOS | `release/linux-unpacked` (Linux PCs and the Steam Deck) |

Note the App ID and both depot ids: the upload script needs them.

## 2. Launch options

Under **Installation > General Installation**:

| Operating system | Executable | Arguments |
| --- | --- | --- |
| Windows | `Generals.exe` | none |
| Linux + SteamOS | `generals` | none (see below) |

For the Linux depot, choose **Steam Linux Runtime 3.0 (sniper)** as the launch compatibility
tool. Then test it on a Steam Deck and a Linux PC: if the game won't start there, Chromium's
sandbox is the likely cause; add `--no-sandbox` to the Linux launch option's arguments. The app
only ever shows its own pages, so the sandbox matters less than in a web browser.

## 3. Steam Cloud

Under **Steam Cloud**, set a byte and file quota (1 MB and 10 files is plenty), then use
**Auto-Cloud** with one path:

| Root | Subdirectory | Pattern | OS |
| --- | --- | --- | --- |
| `WinAppDataRoaming` | `Generals/saves` | `*.json` | All OSes |

and a **root override** for Linux:

| Original root | OS | New root | Add or replace path |
| --- | --- | --- | --- |
| `WinAppDataRoaming` | Linux + SteamOS | `LinuxHome` | `.config/Generals/saves` (replace `Generals/saves`) |

That syncs `%APPDATA%\Generals\saves` on Windows and `~/.config/Generals/saves` on Linux and the
Deck, so one save follows the player between them. `settings.json` sits beside the folder, not
in it, on purpose: window size and resolution belong to each computer. Check the root names on
the Steam Cloud page before saving.

## 4. Achievements and rich presence

- **Stats & Achievements > Achievements:** enter the 18 rows from [achievements.md](achievements.md)
  with their API names exactly, and upload the icons from `npm run art:achievements`.
- **Community > Rich Presence:** upload [rich-presence-english.vdf](rich-presence-english.vdf).
- **Publish** both (Steamworks changes go live only when published).

## 5. Controllers and the Steam Deck

The game reads controllers itself, in the standard gamepad layout (A, B, X, Y, bumpers,
triggers, D-pad, View and Menu), so under **Steam Input** a plain gamepad configuration is all
it needs; check the Deck's default one matches the buttons the game shows. Then fill in the
**Steam Deck compatibility** questions:
the game is readable on the Deck's screen (no text under 11 pixels at its scale), plays fully
with the controls, and types orders with its own on-screen keyboard.

## 6. Building and uploading

1. Build the folders: run **Actions > Steam builds > Run workflow**, then download both
   artifacts and unpack them into `release/`:
   `tar -xzf Generals-Steam-Windows.tar.gz -C release` and the same for Linux. (Or run
   `npm run desktop:steam` on a Windows PC and on a Linux PC.)
2. Install **steamcmd** (from Valve's SteamCMD page), and make a Steamworks account just for
   builds, with only the right to upload.
3. Upload:

   ```sh
   export STEAM_APP_ID=<app id> STEAM_DEPOT_WINDOWS=<depot> STEAM_DEPOT_LINUX=<depot>
   export STEAM_USERNAME=<build account>
   npm run steam:upload -- --preview      # checks the build, uploads nothing
   npm run steam:upload -- --live beta    # uploads and sets it live on the beta branch
   ```

   steamcmd asks for the password and the Steam Guard code the first time.
4. In **SteamPipe > Builds**, check the build on the beta branch, then set it live on the
   default branch by hand. The script never does that.

## Testing without the real app

Valve's test app, Spacewar (App ID 480), works for checking the overlay and that Steam starts:
with Steam running and signed in, start the desktop app with `--steam-app-id=480` (or put a
`steam_appid.txt` holding `480` beside it). Achievements won't unlock there, since Spacewar
doesn't have Generals' achievements. The app's log says whether Steam started and why not.
