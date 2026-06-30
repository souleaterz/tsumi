// Native mpv playback for the desktop shell.
//
// mpv plays raw .mkv / HEVC / dual-audio directly over HTTP byte-range — no
// transcoding — which is exactly why the desktop app is smooth where the
// browser stalls (the browser is forced through Real-Debrid's live transcode).
//
// We spawn mpv in its own window (the MVP UX) and talk to it over its JSON IPC
// pipe to (a) observe playback position for watch-history and (b) tear down a
// previous instance when a new episode starts.

const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

let child = null; // current mpv process
let ipc = null; // current IPC socket
const progressCbs = [];

// Windows named pipe mpv listens on. (mpv accepts a plain name; Node needs the
// full \\.\pipe\ prefix to connect.)
const PIPE_NAME = 'tsumi-mpv';
const PIPE_PATH =
  process.platform === 'win32' ? `\\\\.\\pipe\\${PIPE_NAME}` : `/tmp/${PIPE_NAME}.sock`;

/** Subscribe to { position, duration, ended } updates. */
function onMpvProgress(cb) {
  progressCbs.push(cb);
}
function emit(p) {
  for (const cb of progressCbs) {
    try {
      cb(p);
    } catch {
      /* ignore listener errors */
    }
  }
}

/**
 * Locate the mpv binary:
 *   1. TSUMI_MPV_PATH env override
 *   2. bundled with the packaged app (resources/mpv/)
 *   3. dev binary dropped in electron/bin/
 *   4. `mpv` on the system PATH
 */
function resolveMpvBinary() {
  const exe = process.platform === 'win32' ? 'mpv.exe' : 'mpv';
  const candidates = [
    process.env.TSUMI_MPV_PATH,
    process.resourcesPath && path.join(process.resourcesPath, 'mpv', exe),
    path.join(__dirname, 'bin', exe),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return exe; // fall back to PATH lookup
}

/** Turn a raw spawn error into something a human can act on. */
function describeSpawnError(err, bin) {
  const code = err && err.code ? err.code : '';
  // ENOENT: nothing at that path. UNKNOWN/ENOEXEC: a file is there but Windows
  // refused to run it — almost always the WRONG CPU ARCHITECTURE (e.g. an ARM64
  // mpv on an x64 PC, or vice-versa).
  if (code === 'ENOENT') {
    return `mpv not found at "${bin}". Put mpv.exe in electron/bin/, install mpv on your PATH, or set TSUMI_MPV_PATH.`;
  }
  if (code === 'UNKNOWN' || code === 'ENOEXEC') {
    return (
      `Windows refused to run "${bin}" (${code}). This usually means the mpv ` +
      `build is the wrong CPU architecture for this PC. Download the build that ` +
      `matches your CPU — for a normal Intel/AMD PC that's the "x86_64" build, ` +
      `NOT "aarch64"/ARM64 — and replace the file.`
    );
  }
  return `Could not launch mpv ("${bin}"): ${err && err.message ? err.message : String(err)}`;
}

/** Connect to mpv's IPC pipe (retrying until mpv has created it). */
function connectIpc(attempt = 0) {
  const sock = net.connect(PIPE_PATH);
  let buf = '';
  let duration = 0;

  sock.on('connect', () => {
    ipc = sock;
    // Observe position + duration. ids are arbitrary.
    sock.write(JSON.stringify({ command: ['observe_property', 1, 'time-pos'] }) + '\n');
    sock.write(JSON.stringify({ command: ['observe_property', 2, 'duration'] }) + '\n');
  });

  sock.on('data', (chunk) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.event === 'property-change') {
        if (msg.name === 'duration' && typeof msg.data === 'number') {
          duration = msg.data;
        } else if (msg.name === 'time-pos' && typeof msg.data === 'number') {
          emit({ position: msg.data, duration, ended: false });
        }
      }
    }
  });

  sock.on('error', () => {
    // Pipe not ready yet — retry a few times right after spawn.
    if (attempt < 25 && child) {
      setTimeout(() => connectIpc(attempt + 1), 200);
    }
  });
}

/**
 * Play `url` in mpv. Kills any previous instance first.
 * opts: { title?, startAt?, subtitles?: string[] }
 */
function playMpv(url, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('No media URL provided.'));

    // Tear down any existing playback.
    if (ipc) {
      try {
        ipc.destroy();
      } catch {
        /* ignore */
      }
      ipc = null;
    }
    if (child) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      child = null;
    }

    const bin = resolveMpvBinary();
    const args = [
      `--input-ipc-server=${process.platform === 'win32' ? PIPE_NAME : PIPE_PATH}`,
      '--force-window=immediate',
      // Start playback in true fullscreen — the desktop app's whole point is an
      // immersive, chrome-free native player.
      '--fullscreen',
      '--keep-open=no',
      '--really-quiet',
      '--hwdec=auto-safe',
      '--cache=yes',
      // Generous network buffering for RD's CDN.
      '--demuxer-max-bytes=200MiB',
      '--demuxer-readahead-secs=60',
    ];
    if (opts.title) args.push(`--title=${opts.title}`, `--force-media-title=${opts.title}`);
    if (opts.startAt && opts.startAt > 0) args.push(`--start=+${Math.floor(opts.startAt)}`);
    for (const sub of opts.subtitles || []) {
      if (sub) args.push(`--sub-file=${sub}`);
    }
    args.push(url);

    let proc;
    try {
      proc = spawn(bin, args, { stdio: 'ignore', windowsHide: false });
    } catch (err) {
      return reject(new Error(describeSpawnError(err, bin)));
    }

    child = proc;

    proc.on('error', (err) => {
      if (proc === child) child = null;
      reject(new Error(describeSpawnError(err, bin)));
    });

    proc.on('spawn', () => {
      connectIpc();
      resolve();
    });

    proc.on('close', () => {
      if (proc === child) child = null;
      if (ipc) {
        try {
          ipc.destroy();
        } catch {
          /* ignore */
        }
        ipc = null;
      }
      emit({ position: 0, duration: 0, ended: true });
    });
  });
}

/** Stop the current mpv instance (e.g. user chose to watch in-window instead). */
function stopMpv() {
  if (ipc) {
    try {
      // Ask mpv to quit cleanly first; kill the process as a fallback.
      ipc.write(JSON.stringify({ command: ['quit'] }) + '\n');
    } catch {
      /* ignore */
    }
    try {
      ipc.destroy();
    } catch {
      /* ignore */
    }
    ipc = null;
  }
  if (child) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    child = null;
  }
}

module.exports = { playMpv, stopMpv, onMpvProgress };
