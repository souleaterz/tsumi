import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/subscription';
import { getUserRdKey, setUserRdKey, maskKey } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const RD_USER = 'https://api.real-debrid.com/rest/1.0/user';

/** Verify a key against Real-Debrid; returns the username on success. */
async function verifyRdKey(key: string): Promise<{ ok: boolean; username?: string }> {
  try {
    const res = await fetch(RD_USER, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: true, username: data?.username };
  } catch {
    return { ok: false };
  }
}

/** GET — report whether the user has a key set (never returns the key itself). */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ hasKey: false }, { status: 200 });
  const key = await getUserRdKey(userId);
  return NextResponse.json(
    { hasKey: Boolean(key), masked: key ? maskKey(key) : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** POST { key } — validate against Real-Debrid, then store for this user. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to save a key.' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === 'string' ? body.key.trim() : '';
  if (!key) {
    return NextResponse.json({ error: 'No key provided.' }, { status: 400 });
  }

  const check = await verifyRdKey(key);
  if (!check.ok) {
    return NextResponse.json(
      { error: 'Real-Debrid rejected this key. Check it and try again.' },
      { status: 400 },
    );
  }

  const saved = await setUserRdKey(userId, key);
  if (!saved) {
    return NextResponse.json(
      { error: 'Could not save your key (storage unavailable).' },
      { status: 500 },
    );
  }
  return NextResponse.json({ hasKey: true, masked: maskKey(key), username: check.username });
}

/** DELETE — remove the user's stored key. */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const ok = await setUserRdKey(userId, null);
  return NextResponse.json({ hasKey: false }, { status: ok ? 200 : 500 });
}
