'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { OnScreenKeyboard } from './on-screen-keyboard';
import { Focusable, FocusSection } from './focusable';
import { getRdKey, setRdKey } from '@/lib/rdkey';

/**
 * Full-screen Real-Debrid key entry driven by the on-screen keyboard. The token
 * is validated against Real-Debrid (server-side, /api/rd-check) before it's
 * saved, so a mistyped key can't silently break playback.
 */
export function RdKeyEntry({ onClose }: { onClose: () => void }) {
  const [val, setVal] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const hasExisting = getRdKey().length > 0;

  const save = async () => {
    const key = val.trim();
    if (key.length < 8) {
      setError('That key looks too short.');
      return;
    }
    setChecking(true);
    setError('');
    try {
      const r = await fetch(`/api/rd-check?key=${encodeURIComponent(key)}`);
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || 'Invalid key.');
        setChecking(false);
        return;
      }
      setRdKey(key);
      onClose();
    } catch {
      setError('Could not validate — check your connection.');
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-base px-[var(--tv-safe)]">
      <div className="text-center">
        <h2 className="font-heading text-[2rem] tracking-wide text-white">Real-Debrid key</h2>
        <p className="mt-1 text-[0.8rem] text-zinc-400">
          Get your token at real-debrid.com/apitoken. It’s checked before saving.
        </p>
      </div>

      <div className="flex h-12 min-w-[28rem] max-w-[46rem] items-center overflow-hidden rounded-xl border border-white/15 bg-surface/50 px-4 font-mono text-[1rem] tracking-wider text-white">
        {val || <span className="font-sans text-zinc-500">Type your key…</span>}
        <span className="ml-0.5 inline-block h-6 w-0.5 animate-pulse bg-accent" />
      </div>

      <OnScreenKeyboard
        onKey={(ch) => setVal((v) => v + ch)}
        onDelete={() => setVal((v) => v.slice(0, -1))}
        onSpace={() => {}}
      />

      {error && <p className="text-[0.8rem] text-action">{error}</p>}

      <FocusSection className="flex items-center gap-3">
        <Focusable ariaLabel="Save key" onEnterPress={save}>
          {(f) => (
            <div className={clsx('flex items-center gap-2 rounded-xl px-7 py-3 text-[0.9rem] font-medium', f ? 'bg-white text-base' : 'bg-primary text-white')}>
              {checking && <Loader2 className="h-4 w-4 animate-spin" />}
              {checking ? 'Checking…' : 'Save'}
            </div>
          )}
        </Focusable>
        {hasExisting && (
          <Focusable ariaLabel="Remove key" onEnterPress={() => { setRdKey(''); onClose(); }}>
            {(f) => <div className={clsx('rounded-xl px-7 py-3 text-[0.9rem] font-medium', f ? 'bg-white/20 text-white' : 'bg-white/8 text-zinc-300')}>Remove</div>}
          </Focusable>
        )}
        <Focusable ariaLabel="Cancel" onEnterPress={onClose}>
          {(f) => <div className={clsx('rounded-xl px-7 py-3 text-[0.9rem] font-medium', f ? 'bg-white/20 text-white' : 'bg-white/8 text-zinc-300')}>Cancel</div>}
        </Focusable>
      </FocusSection>
    </div>
  );
}
