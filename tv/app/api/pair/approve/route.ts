import { NextResponse } from 'next/server';
import { pairingConfigured, db, clean } from '@/lib/pairing-server';

// The phone approves a code (optionally pushing an RD key + list to the TV).
export async function POST(req: Request) {
  if (!pairingConfigured()) return NextResponse.json({ configured: false });

  let body: { userCode?: string; rdKey?: string; list?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' });
  }

  const code = clean(String(body.userCode ?? '').toUpperCase());
  if (code.length !== 6) return NextResponse.json({ ok: false, error: 'Enter the 6-character code from your TV.' });

  const r = await db(`tv_devices?user_code=eq.${code}&status=eq.pending&select=device_code,expires_at`);
  const rows = await r.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return NextResponse.json({ ok: false, error: 'That code isn’t valid — check your TV.' });
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'That code expired. Start pairing again on your TV.' });
  }

  // If an RD key was supplied, validate it before pushing it to the TV.
  const rdKey = String(body.rdKey ?? '').trim();
  if (rdKey) {
    const check = await fetch('https://api.real-debrid.com/rest/1.0/user', {
      headers: { Authorization: `Bearer ${rdKey}` },
      cache: 'no-store',
    }).catch(() => null);
    if (!check || !check.ok) return NextResponse.json({ ok: false, error: 'That Real-Debrid key is invalid.' });
  }

  const patch: Record<string, unknown> = { status: 'approved', approved_at: new Date().toISOString() };
  if (rdKey) patch.rd_key = rdKey;
  if (Array.isArray(body.list)) patch.list = body.list;

  const u = await db(`tv_devices?device_code=eq.${clean(row.device_code)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!u.ok) return NextResponse.json({ ok: false, error: 'Could not confirm. Try again.' });

  return NextResponse.json({ ok: true });
}
