'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Smartphone, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Focusable } from './focusable';
import { setRdKey } from '@/lib/rdkey';
import { getMyList, toggleMyList, type MyListItem } from '@/lib/mylist';

type Phase = 'starting' | 'waiting' | 'paired' | 'unavailable' | 'error';

/**
 * TV-side pairing: shows a short code, then polls until the phone approves at
 * <origin>/link. On approval it applies the pushed Real-Debrid key + list so the
 * user never types the long key on the remote.
 */
export function PairingOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pollTimer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let device = '';
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch('/api/pair/start', { method: 'POST' });
        const d = await r.json();
        if (cancelled) return;
        if (d.configured === false) {
          setPhase('unavailable');
          return;
        }
        if (!d.ok) {
          setPhase('error');
          setError(d.error || 'Could not start pairing.');
          return;
        }
        device = d.deviceCode;
        setCode(d.userCode);
        setPhase('waiting');

        pollTimer.current = setInterval(async () => {
          const pr = await fetch(`/api/pair/poll?device=${encodeURIComponent(device)}`);
          const pd = await pr.json();
          if (cancelled) return;
          if (pd.status === 'approved') {
            clearInterval(pollTimer.current);
            if (pd.rdKey) setRdKey(pd.rdKey);
            if (Array.isArray(pd.list)) {
              const have = new Set(getMyList().map((m) => m.id));
              (pd.list as MyListItem[]).forEach((m) => {
                if (m?.id && !have.has(m.id)) toggleMyList(m);
              });
            }
            setPhase('paired');
            setTimeout(onClose, 1600);
          } else if (pd.status === 'expired') {
            clearInterval(pollTimer.current);
            setPhase('error');
            setError('The code expired. Close and try again.');
          }
        }, 3000);
      } catch {
        if (!cancelled) {
          setPhase('error');
          setError('Could not start pairing.');
        }
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(pollTimer.current);
    };
  }, [onClose]);

  const linkUrl = `${origin.replace(/^https?:\/\//, '')}/link`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-base px-[var(--tv-safe)] text-center">
      <Smartphone className="h-10 w-10 text-accent" />

      {phase === 'starting' && (
        <p className="flex items-center gap-2 text-zinc-300">
          <Loader2 className="h-5 w-5 animate-spin" /> Preparing…
        </p>
      )}

      {phase === 'waiting' && (
        <>
          <div>
            <p className="text-[0.85rem] text-zinc-400">On your phone, go to</p>
            <p className="mt-1 text-[1.3rem] font-semibold text-white">{linkUrl}</p>
            <p className="mt-1 text-[0.85rem] text-zinc-400">and enter this code:</p>
          </div>
          <div className="flex gap-2">
            {code.split('').map((c, i) => (
              <span key={i} className="flex h-16 w-12 items-center justify-center rounded-xl bg-surface font-heading text-[2.2rem] text-white">
                {c}
              </span>
            ))}
          </div>
          <p className="flex items-center gap-2 text-[0.8rem] text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Waiting for your phone…
          </p>
        </>
      )}

      {phase === 'paired' && (
        <p className="flex items-center gap-2 text-[1.1rem] font-medium text-white">
          <Check className="h-6 w-6 text-accent" /> Paired!
        </p>
      )}

      {phase === 'unavailable' && (
        <p className="max-w-md text-[0.9rem] text-zinc-300">
          Phone pairing isn’t set up on this server yet. You can still add your Real-Debrid key
          directly with the on-screen keyboard.
        </p>
      )}

      {phase === 'error' && <p className="max-w-md text-[0.9rem] text-action">{error}</p>}

      <Focusable ariaLabel="Close" autoFocus onEnterPress={onClose}>
        {(f) => (
          <div className={clsx('rounded-xl px-7 py-3 text-[0.9rem] font-medium', f ? 'bg-white text-base' : 'bg-white/10 text-zinc-200')}>
            {phase === 'paired' ? 'Done' : 'Close'}
          </div>
        )}
      </Focusable>
    </div>
  );
}
