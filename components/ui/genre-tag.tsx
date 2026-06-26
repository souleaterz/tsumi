import Link from 'next/link';

// Loose katakana transliterations for common genres — decorative accents.
const GENRE_KANA: Record<string, string> = {
  Action: 'アクション',
  Adventure: 'アドベンチャー',
  Comedy: 'コメディ',
  Drama: 'ドラマ',
  Fantasy: 'ファンタジー',
  Horror: 'ホラー',
  Mystery: 'ミステリー',
  Romance: 'ロマンス',
  'Sci-Fi': 'サイエンス',
  'Slice of Life': 'スライス',
  Sports: 'スポーツ',
  Supernatural: 'サスペンス',
  Thriller: 'スリラー',
  Psychological: 'サイコ',
  Mecha: 'メカ',
  Music: 'ミュージック',
};

export function GenreTag({ genre, asLink = true }: { genre: string; asLink?: boolean }) {
  const kana = GENRE_KANA[genre];
  const inner = (
    <span className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-accent">
      {genre}
      {kana && (
        <span className="font-jp text-[8px] text-accent/40 transition-colors group-hover:text-accent/70">
          {kana}
        </span>
      )}
    </span>
  );

  if (!asLink) return inner;
  return <Link href={`/browse?genre=${encodeURIComponent(genre)}`}>{inner}</Link>;
}
