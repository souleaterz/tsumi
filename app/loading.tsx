export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <span className="absolute inset-0 flex items-center justify-center font-jp text-2xl text-primary">
          罪
        </span>
      </div>
      <p className="katakana animate-glow-pulse text-xs">読み込み中</p>
    </div>
  );
}
