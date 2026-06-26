# 罪 Tsumi — Anime Streaming

A dark, cinematic anime streaming web app inspired by **Solo Leveling**. Built with
Next.js 14 (App Router) and powered by **live AniList data** — no placeholder content.

![stack](https://img.shields.io/badge/Next.js-14-black) ![tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8) ![anilist](https://img.shields.io/badge/AniList-GraphQL-7C3AED)

## Stack

| Concern | Tech |
| --- | --- |
| Framework | Next.js 14 (App Router, RSC) |
| Styling | Tailwind CSS — custom Solo-Leveling palette, glassmorphism, katakana accents |
| Metadata | **AniList GraphQL API** (no key required) |
| Episodes / streams | Torrentio + Anizip (AniList → Kitsu/MAL mapping), Nyaa RSS fallback |
| Playback | **Vidstack** player fed by **WebTorrent** P2P streaming (service-worker `streamURL`) |
| Persistence | Supabase (watchlist, history, episode progress) |
| Auth | Clerk |
| Payments | Stripe — Tsumi Pro £0.99/mo |
| Ads | Google IMA SDK pre-roll (free tier) |

## Quick start

```bash
npm install
cp .env.local.example .env.local   # optional — app runs without any keys
npm run dev                        # http://localhost:3000
```

> **The app runs with zero configuration.** AniList needs no key, so the home page,
> browse, search, and detail pages work immediately with live data. Auth, payments,
> and cloud persistence activate automatically once their keys are added to
> `.env.local` — until then, watchlist/history fall back to `localStorage`.

## Pages

| Route | Description |
| --- | --- |
| `/` | Hero carousel, trending, seasonal picks, continue-watching, popular grid |
| `/browse` | Filter by genre, year, format, status; search; pagination |
| `/anime/[id]` | Cover, synopsis, trailer, episode list, ratings, recommendations |
| `/watch/[id]/[ep]` | Full player with episode navigation + source selection |
| `/profile` | Watchlist, history, stats, Tsumi Pro subscription |

## Architecture

```
AniList GraphQL  ──▶  metadata, covers, episode counts, ratings, seasonal
Anizip           ──▶  AniList → Kitsu/MAL mapping + per-episode titles/thumbnails
Torrentio        ──▶  ranked magnet sources per episode (server-resolved)
Nyaa RSS         ──▶  fallback source resolver (by title+episode) when Torrentio is empty
WebTorrent       ──▶  streams the magnet client-side via a service worker;
                      file.streamURL is fed into the Vidstack player, no redirects
Supabase         ──▶  watchlist / history / progress (per Clerk user)
Stripe webhook   ──▶  mirrors Pro subscription state into Supabase
```

Key directories:

- `app/` — routes, API handlers (`/api/streams`, `/api/stripe`)
- `components/` — `home/`, `ui/`, `browse/`, `anime/`, `watch/`, `profile/`, `layout/`
- `lib/anilist/` — GraphQL client, queries, types
- `lib/stream/` — Torrentio/Anizip source resolution
- `lib/progress.ts`, `lib/watchlist.ts` — Supabase-or-localStorage data layer
- `lib/supabase/schema.sql` — run in Supabase to provision tables

## Environment

See [`.env.local.example`](.env.local.example). All integrations are optional and
fail gracefully when unset. To fully enable everything:

1. **Supabase** — create a project, run `lib/supabase/schema.sql`, set the URL + keys.
2. **Clerk** — set publishable/secret keys; `/profile` becomes protected. The signed-in
   Clerk `userId` is threaded into the data layer (watchlist/history/progress) via the
   `useUserId()` hook; without keys it falls back to `localStorage`. Persistence goes
   through server-side API routes (`/api/watchlist`, `/api/progress`) using the Supabase
   **service-role key** with the user resolved from the Clerk session — so no Clerk↔Supabase
   JWT integration is required.
3. **Stripe** — set secret key + `STRIPE_PRO_PRICE_ID` (create the £0.99/mo Price in the
   Stripe dashboard — the UI figure is display-only), point a webhook at
   `/api/stripe/webhook` with `STRIPE_WEBHOOK_SECRET`. The webhook mirrors subscription
   state into Supabase; `lib/subscription.ts` reads it server-side (service-role) to gate
   Pro — Pro users skip the pre-roll ad. (All quality tiers are free for everyone.)
4. **IMA ads** — set `NEXT_PUBLIC_IMA_AD_TAG` for real pre-roll inventory.

## SEO & social

- Per-section loading skeletons on `/browse`, `/anime/[id]`, `/watch/[id]/[ep]`.
- Generated brand social card at `/opengraph-image`; per-anime `og:image`/`twitter`
  cards on detail pages. `sitemap.xml` (static routes + trending titles) and `robots.txt`.

## Notes

- Torrent streaming is intended for content you are legally entitled to access.
- AniList enforces rate limits; server fetches are cached/revalidated with a 12s timeout.

Deploy to **Vercel** — push the repo and import; add env vars in the dashboard.
