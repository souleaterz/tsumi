'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import {
  MediaPlayer,
  MediaProvider,
  Track,
  isHLSProvider,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { Loader2, AlertCircle, Wifi } from 'lucide-react';
import type { StreamSource } from '@/lib/stream/sources';
import { saveProgress } from '@/lib/progress';
import {
  loadSourcePref,
  pickPreferredIndex,
  saveSourcePref,
} from '@/lib/source-pref';

interface PlayerProps {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  sources: StreamSource[];
  startAt?: number;
  userId?: string | null;
  /** When true, auto-select the English audio track if the stream has one. */
  preferDub?: boolean;
}

const VIDEO_EXT = /\.(mp4|webm|mkv|m4v|mov|avi)$/i;

export function VidstackPlayer({
  anilistId,
  episode,
  title,
  coverImage,
  totalEpisodes,
  sources,
  startAt = 0,
  userId = null,
  preferDub = false,
}: PlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const clientRef = useRef<any>(null);

  const [sourceIdx, setSourceIdx] = useState(0);
  // string = direct file; object = explicit HLS source (engages hls.js).
  const [src, setSrc] = useState<
    string | { src: string; type: 'application/x-mpegurl' } | null
  >(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>(
    sources.length ? 'connecting' : 'error',
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadPct, setDownloadPct] = useState(0);
  const [peers, setPeers] = useState(0);
  const [speed, setSpeed] = useState(0);
  // Progressive-MP4 URL to fall back to if an HLS transcode fails (CORS, etc.).
  const mp4FallbackRef = useRef<string | null>(null);
  const [subtitles, setSubtitles] = useState<{ url: string; lang: string }[]>([]);
  // Indices that already failed — Real-Debrid evicts cached torrents, so the
  // first pick often 404s on older episodes; auto-advance through them.
  const failedRef = useRef<Set<number>>(new Set());
  const [retryNote, setRetryNote] = useState('');
  // Have we applied any remembered source preference for this episode yet?
  // Resolve effect waits for this so we don't load source 0 then immediately
  // jump to the preferred one.
  const [prefChecked, setPrefChecked] = useState(false);
  // Most recently saved source index for this episode; updates if the user
  // switches sources mid-episode so we remember their final choice.
  const lastSavedIdxRef = useRef<number>(-1);

  // ── Resolve the magnet → streamURL via the service-worker server ──
  useEffect(() => {
    if (!sources.length || !prefChecked) return;
    let destroyed = false;
    const source = sources[sourceIdx];
    setStatus('connecting');
    setSrc(null);
    setDownloadPct(0);
    mp4FallbackRef.current = null;
    setSubtitles(source.subtitles ?? []);

    // ── Provider: a ready-to-play (proxied) HLS stream. ──
    if (source.hlsUrl) {
      setSrc({ src: source.hlsUrl, type: 'application/x-mpegurl' });
      setStatus('ready');
      return () => {
        destroyed = true;
      };
    }

    // ── Real-Debrid: resolve a browser-playable stream. No WebTorrent needed. ──
    if (source.playUrl) {
      (async () => {
        try {
          const res = await fetch(source.playUrl!);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Could not resolve this stream.');
          }
          const data: { url: string; hls: boolean; mp4Fallback?: string } =
            await res.json();
          if (destroyed) return;
          mp4FallbackRef.current = data.mp4Fallback ?? null;
          setSrc(
            data.hls ? { src: data.url, type: 'application/x-mpegurl' } : data.url,
          );
          setStatus('ready');
        } catch (err) {
          if (destroyed) return;
          // RD evicted the cached torrent, or the unrestrict link 404'd.
          // Auto-advance to the next source instead of dead-ending the user.
          const msg =
            err instanceof Error && /evict|cache|not cached|unavailable/i.test(err.message)
              ? 'was removed from Real-Debrid'
              : 'could not be resolved';
          tryNextSource(msg);
        }
      })();
      return () => {
        destroyed = true;
      };
    }

    (async () => {
      try {
        if (!source.magnet) {
          throw new Error('This source has no playable stream.');
        }
        // 1. Register the WebTorrent service worker (streams files over fetch).
        if (!('serviceWorker' in navigator)) {
          throw new Error('Your browser does not support service workers.');
        }
        const registration = await navigator.serviceWorker.register('/sw.min.js', {
          scope: '/',
        });
        await navigator.serviceWorker.ready;
        if (destroyed) return;

        // 2. Spin up a WebTorrent client + server bound to the worker.
        const { default: WebTorrent } = await import('webtorrent');
        if (destroyed) return;
        if (!clientRef.current) {
          clientRef.current = new WebTorrent();
          clientRef.current.createServer({ controller: registration });
        }
        const client = clientRef.current;

        // Clear any previously-added torrent before switching sources.
        client.torrents.slice().forEach((t: { destroy: () => void }) => t.destroy());

        client.add(source.magnet, (torrent: any) => {
          if (destroyed) return;
          const file =
            torrent.files
              .filter((f: { name: string }) => VIDEO_EXT.test(f.name))
              .sort(
                (a: { length: number }, b: { length: number }) => b.length - a.length,
              )[0] ?? torrent.files[0];

          if (!file) {
            tryNextSource('had no playable video file');
            return;
          }

          // 3. streamURL is served through the SW — feed it straight to Vidstack.
          //    Vidstack infers the media type from the file extension in the path.
          setSrc(file.streamURL);
          setStatus('ready');

          torrent.on('download', () => {
            if (destroyed) return;
            setDownloadPct(Math.round(torrent.progress * 100));
            setPeers(torrent.numPeers);
            setSpeed(torrent.downloadSpeed);
          });
        });

        client.on('error', (err: Error | string) => {
          if (destroyed) return;
          setStatus('error');
          setErrorMsg(typeof err === 'string' ? err : err.message);
        });
      } catch (err) {
        if (destroyed) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to start stream.');
      }
    })();

    return () => {
      destroyed = true;
    };
  }, [sourceIdx, sources, prefChecked]);

  // Tear down the client on unmount.
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
  }, []);

  // ── Persist progress every 10s while playing ──
  useEffect(() => {
    if (status !== 'ready') return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p || p.paused || !p.duration) return;
      saveProgress(
        {
          anilistId,
          episode,
          title,
          coverImage,
          totalEpisodes,
          positionSec: p.currentTime,
          durationSec: p.duration,
          completed: p.currentTime / p.duration > 0.9,
          updatedAt: Date.now(),
        },
        userId,
      );
    }, 10_000);
    return () => clearInterval(id);
  }, [status, anilistId, episode, title, coverImage, totalEpisodes, userId]);

  // Pick the English (or Japanese) audio track based on the Sub/Dub choice.
  // Works when RD-transcoded HLS carries multiple tracks. Scoring rather than
  // first-match because many dual-audio releases ship tracks labeled "Audio 2"
  // / "Track 2" / "und" — the loose label-only check used to silently leave
  // track 0 (Japanese) selected. With a clear English winner we always pick
  // it; if nothing is labelled but there are exactly 2 tracks, we pick the
  // *non-first* track for Dub (English is virtually always the secondary).
  const selectPreferredAudio = useCallback(() => {
    const p = playerRef.current;
    const tracks = p?.audioTracks as unknown as
      | {
          length: number;
          [i: number]: { label?: string; language?: string; selected: boolean };
        }
      | undefined;
    if (!tracks || tracks.length < 2) return;

    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const s = `${t.label ?? ''} ${t.language ?? ''}`.toLowerCase().trim();
      let score = 0;

      const isEng = /\b(en|eng|english)\b/.test(s);
      const isJpn = /\b(ja|jp|jpn|japanese)\b/.test(s);
      const isDub = /\b(dub|dubbed)\b/.test(s);
      const isOriginal = /\b(sub|subbed|original)\b/.test(s);

      if (preferDub) {
        if (isEng) score += 100;
        if (isDub) score += 60;
        if (isJpn) score -= 100;
        if (isOriginal) score -= 40;
        // Anime dual-audio releases ship JP as track 0 and ENG as track 1.
        // If neither track has language tags, prefer non-first.
        if (i > 0) score += 5;
      } else {
        if (isJpn) score += 100;
        if (isOriginal) score += 50;
        if (isEng) score -= 100;
        if (isDub) score -= 40;
        if (i === 0) score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // Only switch if we found a real preference (positive score) AND it's not
    // already selected — switching mid-playback briefly stalls audio.
    if (bestIdx < 0 || bestScore <= 0) return;
    const currentlySelected = tracks[bestIdx].selected;
    if (currentlySelected) return;

    try {
      tracks[bestIdx].selected = true;
    } catch {
      /* track not selectable */
    }
  }, [preferDub]);

  // RD-transcoded HLS sometimes loads audio renditions asynchronously after
  // the player reports canplay. Re-run the selection a few times in the first
  // ~3s of playback to catch them — the function is idempotent and cheap.
  useEffect(() => {
    if (status !== 'ready') return;
    const id1 = setTimeout(selectPreferredAudio, 500);
    const id2 = setTimeout(selectPreferredAudio, 1500);
    const id3 = setTimeout(selectPreferredAudio, 3000);
    return () => {
      clearTimeout(id1);
      clearTimeout(id2);
      clearTimeout(id3);
    };
  }, [status, selectPreferredAudio, sourceIdx]);

  /**
   * Mark the current source as failed and try the next-ranked working one.
   * Used when RD has evicted a cached torrent, an unrestrict 404s, or the
   * codec just won't play. Only surfaces an error once every source is gone.
   */
  const tryNextSource = useCallback(
    (reason: string) => {
      const failed = failedRef.current;
      failed.add(sourceIdx);
      if (failed.size >= sources.length) {
        setStatus('error');
        setErrorMsg(
          'No working sources for this episode — Real-Debrid may have evicted them, or your browser cannot play their codec.',
        );
        return;
      }
      // Find the next un-tried source.
      let next = (sourceIdx + 1) % sources.length;
      while (failed.has(next)) next = (next + 1) % sources.length;
      setRetryNote(
        `Source ${sourceIdx + 1} ${reason}. Trying source ${next + 1} of ${sources.length}…`,
      );
      setSourceIdx(next);
    },
    [sourceIdx, sources.length],
  );

  // Reset per-episode state when the source list changes (next episode).
  useEffect(() => {
    failedRef.current = new Set();
    setRetryNote('');
    setPrefChecked(false);
    setSourceIdx(0);
    lastSavedIdxRef.current = -1;
  }, [sources]);

  // Apply the remembered "use this release group" preference for this anime
  // before the resolve effect picks the default-ranked source.
  useEffect(() => {
    if (prefChecked || sources.length === 0) return;
    const pref = loadSourcePref(anilistId);
    if (pref) {
      const idx = pickPreferredIndex(sources, pref);
      if (idx > 0) setSourceIdx(idx);
    }
    setPrefChecked(true);
  }, [anilistId, sources, prefChecked]);

  // hls.js config tuned for RD's live transcode — start at the lowest bitrate
  // and refuse to upscale beyond the player's actual size. The default ABR
  // starts at the *highest* and gambles on bandwidth, which is exactly what
  // causes the stutter on the first ~30s of playback.
  const onProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      provider.config = {
        // Bitrate selection — bias hard toward the lowest variant.
        startLevel: 0, // begin at the lowest bitrate, not the highest
        capLevelToPlayerSize: true, // never load levels bigger than the <video>
        autoLevelCapping: -1,
        abrEwmaDefaultEstimate: 1_000_000, // 1 Mbps estimate keeps ABR low
        // Buffer ahead so seeks survive RD's transcode hiccups.
        maxBufferLength: 60,
        maxMaxBufferLength: 180,
        backBufferLength: 30,
        // Aggressive retries — RD frequently hiccups on individual segments.
        maxFragLookUpTolerance: 0.5,
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
      };
    }
  }, []);

  // Whenever a (new) source actually starts playing, remember its release
  // group so the next episode auto-picks the same one. Re-fires when the user
  // switches sources mid-episode so manual choices stick.
  const onPlay = useCallback(() => {
    if (lastSavedIdxRef.current === sourceIdx) return;
    const s = sources[sourceIdx];
    if (s) {
      saveSourcePref(anilistId, s);
      lastSavedIdxRef.current = sourceIdx;
    }
  }, [anilistId, sourceIdx, sources]);

  // Resume from saved position + apply audio preference once ready.
  const onCanPlay = useCallback(() => {
    if (startAt > 0 && playerRef.current) {
      playerRef.current.currentTime = startAt;
    }
    selectPreferredAudio();
  }, [startAt, selectPreferredAudio]);

  // Direct (Real-Debrid / provider HLS) playback vs WebTorrent P2P.
  const active = sources[sourceIdx];
  const isDirect = Boolean(active?.playUrl || active?.hlsUrl);
  const isProvider = Boolean(active?.hlsUrl);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-glow-lg">
      {src && (
        <MediaPlayer
          ref={playerRef}
          src={src}
          title={`${title} — Episode ${episode}`}
          poster={coverImage}
          autoPlay
          playsInline
          onProviderChange={onProviderChange}
          onCanPlay={onCanPlay}
          onPlay={onPlay}
          onAudioTracksChange={selectPreferredAudio}
          onError={() => {
            // If an HLS transcode failed (e.g. CORS) but we have a progressive
            // MP4 fallback, switch to it before giving up on this source.
            if (mp4FallbackRef.current) {
              const mp4 = mp4FallbackRef.current;
              mp4FallbackRef.current = null;
              setSrc(mp4);
              return;
            }
            tryNextSource('could not be played in your browser');
          }}
          className="h-full w-full"
        >
          <MediaProvider>
            {subtitles.map((s, i) => (
              <Track
                key={`${s.lang}-${i}`}
                src={s.url}
                kind="subtitles"
                label={s.lang}
                lang={s.lang.slice(0, 2).toLowerCase()}
                default={/english/i.test(s.lang)}
              />
            ))}
          </MediaProvider>
          <DefaultVideoLayout icons={defaultLayoutIcons} colorScheme="dark" />
        </MediaPlayer>
      )}

      {/* Connecting / error overlay */}
      {status !== 'ready' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-base/90 text-center">
          {status === 'error' ? (
            <>
              <AlertCircle className="h-10 w-10 text-action" />
              <p className="max-w-sm px-4 text-sm text-zinc-300">
                {errorMsg || 'No stream sources found for this episode.'}
              </p>
              {sources.length > 1 && (
                <button
                  onClick={() => setSourceIdx((i) => (i + 1) % sources.length)}
                  className="btn-ghost mt-2 text-sm"
                >
                  Try another source
                </button>
              )}
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-zinc-300">
                {retryNote
                  ? retryNote
                  : isDirect
                    ? 'Loading stream…'
                    : `Connecting to peers… ${downloadPct > 0 ? `${downloadPct}% buffered` : ''}`}
              </p>
              <p className="katakana text-[10px]">ストリーミング準備中</p>
            </>
          )}
        </div>
      )}

      {/* Status + source selector (top overlay) */}
      {status === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
          <span className="flex items-center gap-1.5 rounded-md bg-base/70 px-2 py-1 text-[11px] text-zinc-300 backdrop-blur">
            <Wifi className="h-3 w-3 text-primary" />
            {isDirect
              ? isProvider
                ? 'Direct stream'
                : 'Real-Debrid · direct stream'
              : `${peers} peers · ${(speed / 1024 / 1024).toFixed(1)} MB/s · ${downloadPct}%`}
          </span>
          {sources.length > 1 && (
            <select
              value={sourceIdx}
              onChange={(e) => setSourceIdx(Number(e.target.value))}
              className="pointer-events-auto rounded-md border border-white/10 bg-base/80 px-2 py-1 text-xs text-zinc-200 outline-none backdrop-blur"
            >
              {sources.map((s, i) => (
                <option key={i} value={i}>
                  {s.quality ? s.quality.toUpperCase() : 'Source'}
                  {s.cached ? ' ⚡' : ''}
                  {s.playUrl ? '' : ` · ${s.seeders ?? 0}🌱`}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
