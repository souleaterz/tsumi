'use client';

import { useState } from 'react';

/**
 * Phone-side approval page. The user opens this in a normal phone browser (real
 * keyboard) and enters the 6-character code shown on their TV, plus — optionally
 * — their Real-Debrid key so it needn't be typed on the remote. Deliberately a
 * plain form, NOT the D-pad TV UI.
 */
export default function LinkPage() {
  const [code, setCode] = useState('');
  const [rdKey, setRdKey] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/pair/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: code, rdKey: rdKey || undefined }),
      });
      const d = await r.json();
      if (d.configured === false) {
        setState('error');
        setError('Pairing isn’t set up on this server yet.');
        return;
      }
      if (!d.ok) {
        setState('error');
        setError(d.error || 'Could not pair.');
        return;
      }
      setState('done');
    } catch {
      setState('error');
      setError('Network error — try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>Pair your TV</h1>
        <p style={{ marginTop: 6, fontSize: 14, color: '#a1a1aa' }}>
          Enter the code shown on your Tsumi TV. You can also paste your Real-Debrid key so you don’t
          have to type it on the remote.
        </p>

        {state === 'done' ? (
          <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: 'rgba(124,58,237,0.15)', color: '#fff' }}>
            ✓ Paired! Your TV will update in a moment.
          </div>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TV code (e.g. K7P2QX)"
              autoCapitalize="characters"
              maxLength={6}
              style={inputStyle}
            />
            <input
              value={rdKey}
              onChange={(e) => setRdKey(e.target.value)}
              placeholder="Real-Debrid key (optional)"
              style={inputStyle}
            />
            {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
            <button
              type="submit"
              disabled={state === 'sending' || code.length !== 6}
              style={{
                marginTop: 4,
                padding: '12px 16px',
                borderRadius: 12,
                border: 'none',
                background: code.length === 6 ? '#7C3AED' : '#3f3f46',
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {state === 'sending' ? 'Pairing…' : 'Pair TV'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.15)',
  background: '#1E1E2E',
  color: '#fff',
  fontSize: 16,
  letterSpacing: 1,
};
