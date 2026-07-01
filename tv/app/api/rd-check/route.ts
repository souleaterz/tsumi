import { NextResponse } from 'next/server';

// Validate a Real-Debrid token server-side (the browser can't call RD directly
// due to CORS). Returns whether the key works and the account tier.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key')?.trim();
  if (!key) return NextResponse.json({ ok: false, error: 'No key provided.' });
  try {
    const r = await fetch('https://api.real-debrid.com/rest/1.0/user', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: 'Invalid Real-Debrid key.' });
    const u = await r.json();
    return NextResponse.json({ ok: true, username: u.username, premium: u.type === 'premium' });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not reach Real-Debrid.' });
  }
}
