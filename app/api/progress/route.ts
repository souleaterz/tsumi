import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/subscription';
import { getSupabaseService } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function rowToEntry(r: Record<string, any>) {
  return {
    anilistId: r.anilist_id,
    episode: r.episode,
    title: r.title,
    coverImage: r.cover_image,
    totalEpisodes: r.total_episodes,
    positionSec: r.position_sec,
    durationSec: r.duration_sec,
    completed: r.completed,
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

/**
 * GET — continue-watching list, or a single episode's progress when
 * ?anilistId= & ?episode= are supplied (used to resume playback).
 */
export async function GET(req: Request) {
  const userId = await currentUserId();
  const supabase = getSupabaseService();
  const sp = new URL(req.url).searchParams;
  const anilistId = sp.get('anilistId');
  const episode = sp.get('episode');

  if (!userId || !supabase) {
    return NextResponse.json(episode ? { entry: null } : { items: [] });
  }

  if (anilistId && episode) {
    const { data } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('anilist_id', Number(anilistId))
      .eq('episode', Number(episode))
      .maybeSingle();
    return NextResponse.json({ entry: data ? rowToEntry(data) : null });
  }

  const limit = Number(sp.get('limit')) || 24;
  // ?all=1 → full history (incl. completed); default → continue-watching only.
  let query = supabase
    .from('watch_progress')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (sp.get('all') !== '1') query = query.eq('completed', false);
  const { data } = await query;
  return NextResponse.json({ items: (data || []).map(rowToEntry) });
}

/** POST — upsert progress for one episode. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  const supabase = getSupabaseService();
  if (!userId || !supabase) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const e = await req.json();
  const { error } = await supabase.from('watch_progress').upsert(
    {
      user_id: userId,
      anilist_id: e.anilistId,
      episode: e.episode,
      title: e.title,
      cover_image: e.coverImage,
      total_episodes: e.totalEpisodes,
      position_sec: e.positionSec,
      duration_sec: e.durationSec,
      completed: e.completed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,anilist_id,episode' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
