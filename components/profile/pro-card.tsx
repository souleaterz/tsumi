'use client';

import { useState } from 'react';
import { Crown, Loader2, Check } from 'lucide-react';

const PRO_PERKS = [
  'Remove all ads',
  'Uninterrupted, instant playback',
  'Early access to new features',
  'Support Tsumi & server costs',
];

export function ProCard({ isPro = false }: { isPro?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function upgrade() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Could not start checkout.');
        setLoading(false);
      }
    } catch {
      setError('Network error starting checkout.');
      setLoading(false);
    }
  }

  if (isPro) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/25 via-surface to-base p-6 shadow-glow">
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="relative z-10 flex items-center gap-3">
          <Crown className="h-8 w-8 text-amber-400" />
          <div>
            <p className="font-heading text-2xl tracking-wide text-white">Tsumi Pro</p>
            <p className="text-sm text-accent">Active · Ad-free</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-surface to-base p-6 shadow-glow">
      <div className="grain pointer-events-none absolute inset-0" />
      <span className="font-jp pointer-events-none absolute -right-3 -top-4 text-7xl text-white/5">
        罪
      </span>
      <div className="relative z-10">
        <span className="katakana text-[10px]">ツミ・プロ</span>
        <div className="mt-1 flex items-baseline gap-2">
          <Crown className="h-6 w-6 text-amber-400" />
          <h3 className="font-heading text-3xl tracking-wide text-white">Tsumi Pro</h3>
        </div>
        <p className="mt-2 text-3xl font-bold text-white">
          £0.99
          <span className="text-[1rem] font-normal text-zinc-400">/month</span>
        </p>
        <ul className="mt-4 space-y-2">
          {PRO_PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-zinc-300">
              <Check className="h-4 w-4 text-accent" /> {p}
            </li>
          ))}
        </ul>
        <button onClick={upgrade} disabled={loading} className="btn-cta mt-5 w-full">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />}
          Upgrade to Pro
        </button>
        {error && <p className="mt-2 text-xs text-action">{error}</p>}
      </div>
    </div>
  );
}
