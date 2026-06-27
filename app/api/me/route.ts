import { NextResponse } from 'next/server';
import { currentUserId, getProStatus } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me
 * Lightweight client identity check — returns the signed-in user id and Pro
 * status. Used by the ad slots and Pro-gated UI bits.
 */
export async function GET() {
  const userId = await currentUserId();
  const isPro = await getProStatus(userId);
  return NextResponse.json(
    { userId, isPro },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
