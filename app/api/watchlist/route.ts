import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/subscription';
import { getSupabaseService } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function rowToItem(r: Record<string, any>) {
  return {
    anilistId: r.anilist_id,
    title: r.title,
    coverImage: r.cover_image,
    format: r.format,
    addedAt: new Date(r.added_at).getTime(),
  };
}

/** GET — the signed-in user's watchlist, newest first. */
export async function GET() {
  const userId = await currentUserId();
  const supabase = getSupabaseService();
  if (!userId || !supabase) return NextResponse.json({ items: [] });

  const { data } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  return NextResponse.json({ items: (data || []).map(rowToItem) });
}

/** POST — add/update a watchlist entry for the signed-in user. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  const supabase = getSupabaseService();
  if (!userId || !supabase) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body = await req.json();
  const { error } = await supabase.from('watchlist').upsert(
    {
      user_id: userId,
      anilist_id: body.anilistId,
      title: body.title,
      cover_image: body.coverImage,
      format: body.format,
    },
    { onConflict: 'user_id,anilist_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE ?anilistId= — remove an entry for the signed-in user. */
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  const supabase = getSupabaseService();
  if (!userId || !supabase) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const anilistId = Number(new URL(req.url).searchParams.get('anilistId'));
  if (!Number.isFinite(anilistId)) {
    return NextResponse.json({ error: 'Invalid anilistId' }, { status: 400 });
  }
  await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('anilist_id', anilistId);
  return NextResponse.json({ ok: true });
}
