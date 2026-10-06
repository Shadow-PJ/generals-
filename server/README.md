# Generals relay

The multiplayer server (session 6D). It pairs two players by a four-letter room code and passes
their messages between them over WebSockets. Both players' computers run the same battle from the
same seed (lockstep), so the relay only carries each player's army and cards before the battle and
their key presses during it. It never runs a battle and keeps nothing: when a player leaves, the
room is gone.

## Run it on your computer

From the repository root:

```
npm run relay
```

It listens on port 8787 (set `PORT` to change it). The game's development build (`npm run dev`)
looks for it at `ws://localhost:8787`, so two browser tabs can play each other right away.

## Host it

Any host that runs Node 22 or a container and allows WebSockets will do; it needs very little
(each match is about 21 small messages a second per player). It must be reachable over `wss://`
(TLS), because the browser build is served over https. Most hosts below add TLS for you.

- **Fly.io, Render or Railway:** point the service at this folder; it has a `Dockerfile`. Expose
  port 8787 (or let the host set `PORT`), and use the health check path `/health`.
- **A small VPS:** copy this folder, then `npm ci && npm run build && npm start`, behind a reverse
  proxy such as Caddy that adds TLS.

Then tell the game where it is, in either way:

- Build the game with `VITE_RELAY_URL=wss://your-relay.example.com`. For the GitHub Pages and
  desktop builds, add a repository variable named `RELAY_URL` (Settings → Secrets and variables →
  Actions → Variables); the workflows pass it to the build.
- Or type the address into the Versus screen's "Server" line; the game remembers it.

## Limits

Each room holds two players. A player may send a burst of 120 messages, refilled at 60 a second;
one who floods it is cut off. A message is at most 32 KB. A room nobody joins closes after 30
minutes, and players who stop answering are dropped within a minute. The numbers are in
`protocol.ts`.
