'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Check, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { useUserId } from '@/lib/auth/use-user-id';

// Real-Debrid key management. Each user brings their own key (BYO-key): we
// store it server-side via /api/settings/realdebrid and only ever read back
// whether one is set (plus a masked hint), never the value.
export function RdKeyCard() {
  const { userId, isLoaded } = useUserId();
  const [hasKey, setHasKey] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'loading'>('loading');
  const [error, setError] = useState('');
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setState('idle');
      return;
    }
    fetch('/api/settings/realdebrid')
      .then((r) => r.json())
      .then((d) => {
        setHasKey(Boolean(d.hasKey));
        setMasked(d.masked ?? null);
      })
      .catch(() => {})
      .finally(() => setState('idle'));
  }, [isLoaded, userId]);

  async function save() {
    if (!input.trim()) return;
    setState('saving');
    setError('');
    setSavedName(null);
    try {
      const res = await fetch('/api/settings/realdebrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save your key.');
      } else {
        setHasKey(true);
        setMasked(data.masked ?? null);
        setSavedName(data.username ?? null);
        setInput('');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setState('idle');
    }
  }

  async function remove() {
    setState('saving');
    setError('');
    try {
      await fetch('/api/settings/realdebrid', { method: 'DELETE' });
      setHasKey(false);
      setMasked(null);
      setSavedName(null);
    } catch {
      setError('Could not remove the key.');
    } finally {
      setState('idle');
    }
  }

  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-accent" />
        <h3 className="font-heading text-lg text-white">Real-Debrid</h3>
        {hasKey && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            <Check className="h-3 w-3" /> Connected
          </span>
        )}
      </div>

      <p className="mb-4 text-sm text-zinc-400">
        Tsumi streams through your own Real-Debrid account for fast, reliable
        playback. Your key is stored privately and never shown again.
      </p>

      {!isLoaded || state === 'loading' ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : !userId ? (
        <p className="text-sm text-zinc-500">Sign in to connect Real-Debrid.</p>
      ) : hasKey ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-base/40 px-3 py-2">
            <span className="font-mono text-sm text-zinc-300">{masked ?? '••••'}</span>
            <button
              onClick={remove}
              disabled={state === 'saving'}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 transition hover:text-action disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          {savedName && (
            <p className="text-xs text-emerald-400">Connected as {savedName}.</p>
          )}
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-300">
              Replace key
            </summary>
            <KeyInput
              input={input}
              setInput={setInput}
              save={save}
              saving={state === 'saving'}
            />
          </details>
        </div>
      ) : (
        <KeyInput
          input={input}
          setInput={setInput}
          save={save}
          saving={state === 'saving'}
        />
      )}

      {error && <p className="mt-2 text-xs text-action">{error}</p>}

      <a
        href="https://real-debrid.com/apitoken"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-xs text-accent hover:underline"
      >
        Get your API token <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function KeyInput({
  input,
  setInput,
  save,
  saving,
}: {
  input: string;
  setInput: (v: string) => void;
  save: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <input
        type="password"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="Paste your Real-Debrid API token"
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-base/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-primary/60"
      />
      <button
        onClick={save}
        disabled={saving || !input.trim()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/80 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
      </button>
    </div>
  );
}
