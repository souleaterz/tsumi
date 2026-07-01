// Server-side helpers for device pairing.
//
// The TV app deliberately has no Supabase SDK — we talk to Supabase's PostgREST
// endpoint directly with fetch + the service-role key, so pairing adds ZERO npm
// dependencies and stays optional. When the env vars aren't set the whole feature
// reports "not configured" and the UI falls back to typing the key on the TV.
//
// One-time setup: run tv/supabase/tv_devices.sql in the Supabase SQL editor
// (it's plain SQL — do NOT copy the // comment lines from this file). Additive;
// it touches nothing the website uses.

const REST = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export function pairingConfigured(): boolean {
  return Boolean(REST() && SERVICE());
}

/** A PostgREST call against the tv_devices table. Caller checks res.ok. */
export async function db(path: string, init: RequestInit = {}): Promise<Response> {
  const key = SERVICE()!;
  return fetch(`${REST()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}

/** Only allow safe characters into PostgREST filter values. */
export function clean(v: string): string {
  return String(v).replace(/[^A-Za-z0-9-]/g, '');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 ambiguity
export function genUserCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}
