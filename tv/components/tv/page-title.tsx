/** Standard page heading used across the TV pages (not Home). */
export function PageTitle({ title, jp }: { title: string; jp?: string }) {
  return (
    <div className="flex items-baseline gap-3 px-[var(--tv-safe)] pb-6 pt-8">
      <h1 className="font-heading text-[2.4rem] tracking-wide text-white">{title}</h1>
      {jp && <span className="katakana text-[0.7rem]">{jp}</span>}
    </div>
  );
}
