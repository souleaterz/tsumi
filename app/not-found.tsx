import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="font-jp text-7xl text-primary/30">罪</span>
      <h1 className="mt-4 font-heading text-7xl tracking-widest text-white text-glow">
        404
      </h1>
      <p className="katakana mt-1 text-xs">ページが見つかりません</p>
      <p className="mt-4 max-w-sm text-zinc-400">
        This page drifted into the void. The anime you’re looking for may have moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-cta">
          Back Home
        </Link>
        <Link href="/browse" className="btn-ghost">
          Browse Anime
        </Link>
      </div>
    </div>
  );
}
