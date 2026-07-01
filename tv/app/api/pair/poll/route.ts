import { NextResponse } from 'next/server';
import { pairingConfigured, db, clean } from '@/lib/pairing-server';

// TV polls with its deviceCode until the phone approves.
export async function GET(req: Request) {
  if (!pairingConfigured()) return NextResponse.json({ configured: false });

  const device = clean(new URL(req.url).searchParams.get('device') ?? '');
  if (!device) return NextResponse.json({ ok: false, error: 'No device code.' });

  const r = await db(`tv_devices?device_code=eq.${device}&select=status,rd_key,list,expires_at`);
  const rows = await r.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return NextResponse.json({ ok: true, status: 'expired' });

  if (row.status === 'approved') {
    return NextResponse.json({ ok: true, status: 'approved', rdKey: row.rd_key || '', list: row.list || [] });
  }
  if (new Date(row.expires_at) < new Date()) return NextResponse.json({ ok: true, status: 'expired' });
  return NextResponse.json({ ok: true, status: 'pending' });
}
