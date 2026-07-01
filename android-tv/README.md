# Tsumi Fire TV shell

A thin native Android TV app that wraps the hosted **Tsumi TV** web app (the
10-foot site in [`../tv`](../tv)) in a full-screen WebView and adds the two
things a Firestick browser can't do:

- **Keyless torrent streaming** — a real BitTorrent client (`TorrentStreamer.kt`,
  TorrentStream-Android) connects to TCP/uTP peers and streams sequentially, the
  Stremio model. No Real-Debrid key required.
- **Smooth native playback** — `PlayerActivity.kt` (libVLC) plays raw mkv (dual
  audio + external subs) and Real-Debrid direct links, with no transcoding.

This mirrors the desktop Electron shell one-to-one: WebView ≈ BrowserWindow,
`TsumiNative`/`lib/tv-native.ts` ≈ preload contextBridge, `TorrentStreamer` ≈
`electron/torrent.js`, libVLC ≈ mpv.

## How the bridge works

Android injects `window.TsumiNative` (see `TsumiNative.kt`) before page scripts
run. The web app's [`tv/lib/tv-native.ts`](../tv/lib/tv-native.ts) detects it and
wraps the sync, string-only methods into the Promise-based `window.tsumiTV`
bridge the UI already uses (`streamTorrent` / `play` / `stop` / `onProgress` /
`onNextEpisode`). Native → web callbacks go through
`WebView.evaluateJavascript("window.__tsumiResolve/… ")`. Keep the method names
in `TsumiNative.kt` and `tv-native.ts` in sync.

## Point it at your TV deployment

The WebView loads `BuildConfig.APP_URL`, set from the `tsumiTvUrl` Gradle
property (default `https://tsumi-tv.vercel.app`). Deploy `../tv` somewhere and
pass your URL at build time:

```
./gradlew assembleDebug -PtsumiTvUrl=https://your-tv-deployment
```

or edit `tsumiTvUrl` in `gradle.properties`.

## Build & sideload

CI (`.github/workflows/build-android-tv.yml`) builds a **debug APK** on a `v*`
tag or manual dispatch and uploads it as an artifact / attaches it to the
release. Debug APKs are self-signed and install directly — no keystore.

Locally (needs the Android SDK + JDK 17):

```
cd android-tv
gradle wrapper --gradle-version 8.7   # once, to create ./gradlew (+ wrapper jar)
./gradlew assembleDebug
```

Sideload onto a Firestick (enable *Developer options → ADB debugging* first):

```
adb connect <firestick-ip>:5555
adb install app/build/outputs/apk/debug/app-debug.apk
```

The app then appears on the Fire TV home row (LEANBACK launcher + banner).

## Status / caveats

- **UNBUILT / UNTESTED on hardware.** This is the scaffold; the exact
  TorrentStream / libVLC API calls and the sequential-file playback need a real
  device pass. Seeking is limited to the downloaded portion of a torrent.
- The gradle-wrapper **jar** is not committed (binary) — `gradle wrapper`
  regenerates it (CI does this automatically).
- Replace the placeholder vector `ic_launcher` / `banner` with real 罪 artwork.
- Real-Debrid + pairing are handled entirely by the web app; the shell just
  plays whatever URL it's handed, so no native RD code is needed here.
