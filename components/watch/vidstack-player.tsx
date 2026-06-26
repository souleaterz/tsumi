'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import {
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { Loader2, AlertCircle, Wifi } from 'lucide-react';
import type { StreamSource } from '@/lib/stream/sources';
import { saveProgress } from '@/lib/progress';

interface PlayerProps {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  sources: StreamSource[];
  startAt?: number;
  userId?: string | null;
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

  // ── Resolve the magnet → streamURL via the service-worker server ──
  useEffect(() => {
    if (!sources.length) return;
    let destroyed = false;
    const source = sources[sourceIdx];
    setStatus('connecting');
    setSrc(null);
    setDownloadPct(0);
    mp4FallbackRef.current = null;

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
          setStatus('error');
          setErrorMsg(
            err instanceof Error ? err.message : 'Could not resolve this stream.',
          );
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
            setStatus('error');
            setErrorMsg('No playable video file found in this source.');
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
  }, [sourceIdx, sources]);

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

  // Resume from saved position once playback is ready.
  const onCanPlay = useCallback(() => {
    if (startAt > 0 && playerRef.current) {
      playerRef.current.currentTime = startAt;
    }
  }, [startAt]);

  // Direct (Real-Debrid) playback vs WebTorrent P2P for the active source.
  const isDirect = Boolean(sources[sourceIdx]?.playUrl);

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
          onCanPlay={onCanPlay}
          onError={() => {
            // If an HLS transcode failed (e.g. CORS) but we have a progressive
            // MP4 fallback, switch to it before giving up on this source.
            if (mp4FallbackRef.current) {
              const mp4 = mp4FallbackRef.current;
              mp4FallbackRef.current = null;
              setSrc(mp4);
              return;
            }
            setStatus('error');
            setErrorMsg('This source could not be played in your browser.');
          }}
          className="h-full w-full"
        >
          <MediaProvider />
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
                {isDirect
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
              ? 'Real-Debrid · direct stream'
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
