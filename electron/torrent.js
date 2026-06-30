// Embedded BitTorrent streaming for the desktop shell.
//
// This is what lets Tsumi stream with NO Real-Debrid key — the Stremio model.
// Stremio plays without a debrid service because it ships a native torrent
// client; the desktop app is native too (Electron main = Node), so we run a
// full WebTorrent client here, connect to real TCP/uTP peers (not just the
// WebRTC peers a browser is limited to), expose the file over a local HTTP
// server with byte-range support, and point mpv at http://127.0.0.1:PORT/…
//
// Real-Debrid stays the preferred path when the user has a key (instant cached
// streams, hides their IP). This is the fallback that keeps the app usable with
// zero setup.
//
// NOTE: webtorrent v2 is ESM-only with a top-level await, so it can't be
// require()'d from this CommonJS module — we load it with dynamic import().

const path = require('path');

let clientPromise = null; // memoised WebTorrent client (one per app run)
let server = null; // shared local HTTP server (webtorrent NodeServer)
let port = 0; // the port `server` is listening on
let currentInfoHash = null; // the torrent we're currently streaming

// Public trackers to graft onto a bare infoHash so we can actually find peers.
const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
];

// Seconds to wait for torrent metadata (peers) before giving up so the watch
// page can auto-advance to the next source.
const METADATA_TIMEOUT_MS = 30_000;

const VIDEO_EXT = /\.(mkv|mp4|avi|webm|mov|m4v|ts|flv|ogv)$/i;

/** Lazily create the single WebTorrent client (ESM dynamic import). */
async function getClient() {
  if (!clientPromise) {
    clientPromise = import('webtorrent')
      .then(({ default: WebTorrent }) => new WebTorrent())
      .catch((err) => {
        // Reset so a later attempt can retry, and surface an actionable message.
        clientPromise = null;
        const detail = err && err.message ? err.message : String(err);
        throw new Error(
          'Built-in torrent streaming is unavailable in this build ' +
            `(${detail}). Add a Real-Debrid key to stream this source.`,
        );
      });
  }
  return clientPromise;
}

/** Ensure the shared HTTP server exists and is listening; return its port. */
async function ensureServer(client) {
  if (server && port) return port;
  server = client.createServer();
  await new Promise((resolve, reject) => {
    server.server.once('error', reject);
    // 127.0.0.1 only — never expose the swarm bridge to the network.
    server.listen(0, '127.0.0.1', () => resolve());
  });
  port = server.address().port;
  return port;
}

/** Normalise a magnet / infoHash into something WebTorrent can add. */
function toTorrentId(magnetOrHash) {
  const v = String(magnetOrHash || '').trim();
  if (!v) return null;
  if (v.startsWith('magnet:')) return v;
  // Bare 40-char hex (or 32-char base32) infoHash — wrap it in a magnet with
  // trackers so there's somewhere to find peers.
  const tr = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  return `magnet:?xt=urn:btih:${v}${tr}`;
}

/** Pick the main video file in a torrent (largest video, else largest file). */
function pickVideoFile(torrent) {
  const files = torrent.files || [];
  if (files.length === 0) return null;
  const videos = files.filter((f) => VIDEO_EXT.test(f.name));
  const pool = videos.length ? videos : files;
  return pool.reduce((best, f) => (f.length > best.length ? f : best), pool[0]);
}

/** Build the local stream URL for a file (each path segment URI-encoded). */
function fileUrl(torrent, file) {
  const segments = String(file.path).split(/[\\/]/).map(encodeURIComponent).join('/');
  return `http://127.0.0.1:${port}/webtorrent/${torrent.infoHash}/${segments}`;
}

/** Add (or reuse) a torrent and resolve once its metadata is ready. */
async function addTorrent(client, torrentId) {
  // Reuse if we already have this exact torrent loaded.
  const existing = await client.get(torrentId).catch(() => null);
  if (existing) return existing;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('No peers found for this source (timed out). Try another source.'));
    }, METADATA_TIMEOUT_MS);

    const torrent = client.add(torrentId, { path: streamCachePath() }, (t) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(t);
    });
    torrent.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** Where downloaded pieces are cached on disk (temp; cleared on stop). */
function streamCachePath() {
  const os = require('os');
  return path.join(os.tmpdir(), 'tsumi-torrents');
}

/**
 * Stream a magnet / infoHash and return a local HTTP URL mpv can play.
 * Tears down any previously-streaming torrent to free bandwidth/peers.
 */
async function streamTorrent(magnetOrHash) {
  const torrentId = toTorrentId(magnetOrHash);
  if (!torrentId) throw new Error('No magnet or infoHash provided.');

  const client = await getClient();
  await ensureServer(client);

  const torrent = await addTorrent(client, torrentId);

  // Drop a different torrent we were streaming before (keep this one).
  if (currentInfoHash && currentInfoHash !== torrent.infoHash) {
    await removeTorrent(client, currentInfoHash);
  }
  currentInfoHash = torrent.infoHash;

  const file = pickVideoFile(torrent);
  if (!file) throw new Error('No playable video file in this torrent.');

  // Only download the file we're playing — skip extras / other episodes in a
  // pack. (Selecting the file biases piece priority toward what mpv requests.)
  for (const f of torrent.files) {
    if (f === file) f.select();
    else f.deselect();
  }

  return { url: fileUrl(torrent, file), name: file.name };
}

/** Remove a torrent by infoHash (and delete its cached pieces). */
function removeTorrent(client, infoHash) {
  return new Promise((resolve) => {
    try {
      client.remove(infoHash, { destroyStore: true }, () => resolve());
    } catch {
      resolve();
    }
  });
}

/** Stop all torrent activity (called when playback stops / app quits). */
async function stopTorrents() {
  currentInfoHash = null;
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    await Promise.all(
      (client.torrents || []).map(
        (t) =>
          new Promise((resolve) => {
            try {
              client.remove(t.infoHash, { destroyStore: true }, () => resolve());
            } catch {
              resolve();
            }
          }),
      ),
    );
  } catch {
    /* ignore */
  }
}

module.exports = { streamTorrent, stopTorrents };
