# Tsumi Desktop (Electron + mpv)

A native shell around the Tsumi website that fixes the in-browser streaming
stutter. The browser is forced to play anime `.mkv` files through Real-Debrid's
**live transcoder**, which pre-encodes only ~20–30 s ahead and then stalls when
the playhead catches up — the classic "stops around 0:30" symptom. This app
sidesteps that entirely by playing the **raw mkv directly with mpv** (the same
approach Stremio uses): no transcode, no wall.

## How it works

- Electron loads the **live deployed website** (`TSUMI_APP_URL`), so the
  Real-Debrid BYO-key flow stays server-side and UI updates ship via Vercel.
- When you press **▶ Play in app** on a watch page, the renderer fetches
  `/api/direct-url/:id/:ep?t=…` (the keyless direct RD link) and asks the shell
  to open it in mpv.
- mpv plays in its own window. Playback position streams back over mpv's JSON
  IPC pipe and is saved through the normal watch-history path.

```
website (webview)  ──playInMpv(url)──▶  main process  ──spawn──▶  mpv window
       ▲                                     │
       └────────────  mpv:progress  ◀────────┘  (time-pos over IPC)
```

## Prerequisites

1. **mpv** must be available. Either:
   - install it and put it on your `PATH` (`winget install mpv` / `brew install mpv` / `apt install mpv`), **or**
   - drop the binary at `electron/bin/mpv.exe` (Windows) / `electron/bin/mpv`, **or**
   - set `TSUMI_MPV_PATH=/full/path/to/mpv`.
2. Node deps installed: `npm install` (pulls in `electron`, `electron-builder`).

## Run in development

```bash
# Option A — one command (starts Next + waits + launches the shell):
npm run app:dev

# Option B — against an already-running site (local or your Vercel URL):
TSUMI_APP_URL=http://localhost:3000 npm run app
TSUMI_APP_URL=https://your-tsumi.vercel.app npm run app   # prod site, native player
```

## Package an installer

```bash
# Put the platform mpv binary in electron/bin/ first so it's bundled.
npm run app:build      # → dist-app/ (NSIS .exe on Windows)
```

Set `TSUMI_APP_URL` to your production site for the packaged build.

## Status

- [x] Phase 0 — `/api/direct-url` keyless direct-link route, `lib/desktop.ts` bridge
- [x] Phase 1 — Electron shell (`main.js`, `preload.js`)
- [x] Phase 2 — mpv playback in a separate window + progress IPC
- [ ] Phase 3 — subtitle fallback chain handed to mpv `--sub-file`
- [ ] Phase 4 — code-signing + auto-update
- [ ] Later — embed mpv into the window (`--wid`) instead of a separate window
