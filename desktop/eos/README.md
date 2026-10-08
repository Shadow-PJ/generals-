# Epic's SDK library goes here

The Epic build (session 7B) carries Epic's SDK library beside the app. It comes with the EOS SDK
from Epic's Developer Portal, under Epic's license, so it is not in the repository: everything in
this folder but this file is ignored by git.

1. Download the **EOS SDK for C** (Developer Portal > SDK & Release Notes).
2. Copy `SDK/Bin/EOSSDK-Win64-Shipping.dll` from it into this folder.

`npm run epic:stage` copies it into the Epic build (or set `EOS_SDK_DLL` to its path instead).
To try Epic in a desktop app run from the repository (`npm run desktop`), also put an
`epic.json` here (the file `npm run epic:stage` writes into the build) and, on Linux,
`SDK/Bin/libEOSSDK-Linux-Shipping.so`. See `docs/store/epic/README.md`.
