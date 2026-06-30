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
const os = require('os');
const path = require('path');
const TSUMI_LUA = require('./tsumi-lua');

let child = null; // current mpv process
let ipc = null; // current IPC socket
let chaptersFile = null; // temp ffmetadata file for the current playback
let luaScriptPath = null; // temp path of our on-video buttons script
const progressCbs = [];
const messageCbs = []; // client-message events from our Lua (e.g. tsumi-next)

// Windows named pipe mpv listens on. (mpv accepts a plain name; Node needs the
// full \\.\pipe\ prefix to connect.)
const PIPE_NAME = 'tsumi-mpv';
const PIPE_PATH =
  process.platform === 'win32' ? `\\\\.\\pipe\\${PIPE_NAME}` : `/tmp/${PIPE_NAME}.sock`;

/** Subscribe to { position, duration, ended } updates. */
function onMpvProgress(cb) {
  progressCbs.push(cb);
}

/** Subscribe to in-player messages (e.g. { type: 'next-episode' }). */
function onMpvMessage(cb) {
  messageCbs.push(cb);
}
function emitMessage(m) {
  for (const cb of messageCbs) {
    try {
      cb(m);
    } catch {
      /* ignore */
    }
  }
}

/** Write the on-video buttons Lua to a temp file (once) and return its path. */
function ensureLuaScript() {
  if (luaScriptPath && fs.existsSync(luaScriptPath)) return luaScriptPath;
  try {
    const file = path.join(os.tmpdir(), 'tsumi-mpv-buttons.lua');
    fs.writeFileSync(file, TSUMI_LUA, 'utf8');
    luaScriptPath = file;
    return file;
  } catch {
    return null;
  }
}

/** Build mpv --script-opts for the Lua from AniSkip times + next-episode flag. */
function buildScriptOpts(opts) {
  const s = opts.skip || {};
  const parts = [
    `tsumi-op_start=${s.op ? s.op.start : -1}`,
    `tsumi-op_end=${s.op ? s.op.end : -1}`,
    `tsumi-ed_start=${s.ed ? s.ed.start : -1}`,
    `tsumi-has_next=${opts.hasNext ? 'yes' : 'no'}`,
  ];
  return parts.join(',');
}

/**
 * Write the AniSkip-derived chapters to a temporary FFMETADATA file so mpv's
 * seek bar shows intro/outro markers (`--chapters-file`). Each chapter's START
 * becomes a notch on the OSC seek bar. Returns the file path, or null.
 * `chapters`: [{ start: seconds, end: seconds, title }]
 */
function writeChaptersFile(chapters) {
  if (!Array.isArray(chapters) || chapters.length === 0) return null;
  let out = ';FFMETADATA1\n';
  for (const c of chapters) {
    if (typeof c.start !== 'number' || typeof c.end !== 'number') continue;
    out += '[CHAPTER]\nTIMEBASE=1/1000\n';
    out += `START=${Math.max(0, Math.round(c.start * 1000))}\n`;
    out += `END=${Math.max(0, Math.round(c.end * 1000))}\n`;
    out += `title=${String(c.title || 'Chapter').replace(/\n/g, ' ')}\n`;
  }
  try {
    const file = path.join(os.tmpdir(), `tsumi-chapters-${Date.now()}.ffmeta`);
    fs.writeFileSync(file, out, 'utf8');
    return file;
  } catch {
    return null;
  }
}

function cleanupChaptersFile() {
  if (chaptersFile) {
    try {
      fs.unlinkSync(chaptersFile);
    } catch {
      /* ignore */
    }
    chaptersFile = null;
  }
}

/** Seek the running mpv instance to an absolute position (seconds). */
function seekMpv(seconds) {
  if (!ipc || typeof seconds !== 'number') return;
  try {
    ipc.write(
      JSON.stringify({ command: ['set_property', 'time-pos', Math.max(0, seconds)] }) +
        '\n',
    );
  } catch {
    /* ignore */
  }
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
      } else if (msg.event === 'client-message') {
        // Our Lua buttons broadcast `script-message tsumi-next`.
        const args = Array.isArray(msg.args) ? msg.args : [];
        if (args[0] === 'tsumi-next') emitMessage({ type: 'next-episode' });
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
      '--keep-open=no',
      '--really-quiet',
      '--hwdec=auto-safe',
      '--cache=yes',
      // Generous network buffering for RD's CDN.
      '--demuxer-max-bytes=200MiB',
      '--demuxer-readahead-secs=60',
      // Keep mpv's on-screen controller (seek bar + chapter markers) visible.
      '--osc=yes',
    ];

    // Embedded mode: render INTO the Electron child window (--wid) so the player
    // is part of the app UI. Without a wid we fall back to mpv's own fullscreen
    // window (e.g. on platforms where embedding isn't wired up).
    if (opts.wid) {
      args.push(`--wid=${opts.wid}`);
    } else {
      args.push('--fullscreen');
    }

    // AniSkip intro/outro markers → chapters on the seek bar.
    cleanupChaptersFile();
    chaptersFile = writeChaptersFile(opts.chapters);
    if (chaptersFile) args.push(`--chapters-file=${chaptersFile}`);

    // On-video Skip Intro / Next Episode buttons (drawn by mpv itself).
    const lua = ensureLuaScript();
    if (lua) {
      args.push(`--script=${lua}`, `--script-opts=${buildScriptOpts(opts)}`);
    }

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
      cleanupChaptersFile();
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
  cleanupChaptersFile();
}

module.exports = { playMpv, stopMpv, seekMpv, onMpvProgress, onMpvMessage };
