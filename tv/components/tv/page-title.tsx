/**
 * Standard page heading used across the TV pages (not Home). It's sticky: it
 * pins to the top of the scroll area so the header never scrolls away and the
 * top of the page is always one glance (and one D-pad move) away.
 */
export function PageTitle({ title, jp }: { title: string; jp?: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-baseline gap-3 bg-base/85 px-[var(--tv-safe)] pb-4 pt-8 backdrop-blur-sm">
      <h1 className="font-heading text-[2.4rem] tracking-wide text-white">{title}</h1>
      {jp && <span className="katakana text-[0.7rem]">{jp}</span>}
    </div>
  );
}
