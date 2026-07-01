import { NextResponse } from 'next/server';
import { pairingConfigured, db, genUserCode } from '@/lib/pairing-server';

// TV asks for a pairing code. Creates a pending device row that expires in 10m.
export async function POST() {
  if (!pairingConfigured()) return NextResponse.json({ configured: false });

  const deviceCode = crypto.randomUUID();
  const userCode = genUserCode();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const r = await db('tv_devices', {
    method: 'POST',
    body: JSON.stringify({ device_code: deviceCode, user_code: userCode, status: 'pending', expires_at }),
  });
  if (!r.ok) return NextResponse.json({ configured: true, ok: false, error: 'Could not start pairing.' });

  return NextResponse.json({ configured: true, ok: true, deviceCode, userCode });
}
