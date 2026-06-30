# 罪 Tsumi — Deployment Guide

Step-by-step to take Tsumi from the GitHub repo to a live, fully-featured deploy on
Vercel with auth, persistence, and payments wired up.

> **Tip:** the app runs with *zero* config (AniList needs no key). You can deploy
> first and add Supabase / Clerk / Stripe incrementally — each activates on its own
> once its env vars are present.

---

## 0. Prerequisites

- The repo is pushed to `github.com/souleaterz/tsumi` (done ✅).
- Accounts: [Vercel](https://vercel.com), [Supabase](https://supabase.com),
  [Clerk](https://clerk.com), [Stripe](https://stripe.com). All have free tiers.

---

## 1. Deploy to Vercel (no keys — gets you a live URL)

1. Go to **vercel.com → Add New → Project**.
2. **Import** `souleaterz/tsumi`. Vercel auto-detects Next.js — leave build settings default.
3. Click **Deploy**. In ~2 min you get a URL like `https://tsumi-xxxx.vercel.app`.
4. Open it — the home page, browse, search, and anime details all work on live AniList data.

Set this env var now so absolute URLs (OG tags, sitemap, Stripe redirects) are correct:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL, e.g. `https://tsumi-xxxx.vercel.app` |

> Add env vars in **Vercel → Project → Settings → Environment Variables**, then
> **redeploy** (Deployments → ⋯ → Redeploy) for them to take effect.

---

## 2. Supabase — watchlist, history, progress

1. **supabase.com → New project.** Pick a region near your users; save the DB password.
2. **SQL Editor → New query** → paste the contents of
   [`lib/supabase/schema.sql`](lib/supabase/schema.sql) → **Run**. This creates the
   `watchlist`, `watch_progress`, and `subscriptions` tables with RLS enabled.
3. **Project Settings → API** — copy these into Vercel env:

| Key | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → `anon` `public` key | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` key | **server-only, secret** |

> The service-role key is used only server-side (`lib/subscription.ts`, the Stripe
> webhook). Never expose it to the client.

---

## 3. Clerk — authentication

1. **clerk.com → Create application.** Enable the sign-in methods you want
   (email, Google, etc.).
2. **API Keys** — copy into Vercel env:

| Key | Where |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys → Publishable key |
| `CLERK_SECRET_KEY` | Clerk → API Keys → Secret key |

3. Add these (already the app defaults, but set them explicitly):

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |

> **No Clerk↔Supabase JWT integration needed.** Watchlist/history/progress are written
> through server-side API routes using the Supabase **service-role key** (from step 2),
> with the user resolved from the Clerk session. RLS stays on (it blocks direct client
> access); the service role bypasses it. Just make sure `SUPABASE_SERVICE_ROLE_KEY` is set.

After redeploy, `/profile` becomes a protected route and the watchlist/history persist
to Supabase per user.

---

## 4. Stripe — Tsumi Pro (£0.99/mo)

1. **Stripe Dashboard → Products → Add product.**
   - Name: `Tsumi Pro`
   - Price: **£0.99 / month**, recurring. **Save**, then copy the **Price ID**
     (`price_…`) — this is the real charge amount (the UI figure is display-only).
2. **Developers → API keys** — copy the secret key.
3. Add to Vercel env:

| Key | Where |
| --- | --- |
| `STRIPE_SECRET_KEY` | Developers → API keys → Secret key |
| `STRIPE_PRO_PRICE_ID` | the `price_…` from step 1 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Developers → API keys → Publishable key |

4. **Webhook** — Developers → Webhooks → **Add endpoint**:
   - URL: `https://YOUR_APP_URL/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Save, then copy the **Signing secret** (`whsec_…`):

| Key | Where |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_…` signing secret |

The webhook mirrors subscription state into Supabase `subscriptions`; `getProStatus()`
reads it server-side so Pro users skip the pre-roll ad. (All quality tiers are free.)

> **Test mode first:** use Stripe test keys + card `4242 4242 4242 4242`. Switch to
> live keys when ready.

---

## 4b. Real-Debrid — REQUIRED for video playback (BYO-key, per user)

In-browser torrent streaming (WebTorrent) **cannot play most public anime torrents** —
browsers only peer over WebRTC, and those swarms have none. Real-Debrid fixes this:
Torrentio returns direct HTTPS streams for cached torrents that play natively.

**There is no shared server key.** A single Real-Debrid key shared across all visitors
violates RD's ToS and gets the account banned once the app is public. Instead, **each
signed-in user supplies their own key**:

1. The user signs up at [real-debrid.com](https://real-debrid.com) (~£3/mo).
2. They get their API token at **[real-debrid.com/apitoken](https://real-debrid.com/apitoken)**.
3. They paste it once on their **Profile** page. It's stored per-user in Supabase
   (`public.user_settings`, service-role only) and **never returned to the browser** —
   the settings API reports only whether a key is set, plus a masked hint.

Nothing to configure in Vercel env for Real-Debrid. The watch page resolves each user's
own key server-side, asks Torrentio for their cached torrents, and resolves the final RD
link — the key never leaves the server. Users without a key see a prompt to add one
(or fall back to WebTorrent, which rarely works for public torrents).

> Requires Supabase + Clerk configured (so users can sign in and we can store the key).

> Sources marked ⚡ are RD-cached (instant). Uncached torrents may need RD to download
> first. The source picker prefers cached + highest quality.

## 4c. (Optional, experimental) HiAnime streaming provider — native Sub + Dub

Real-Debrid streams Japanese-audio torrents that must be live-transcoded for the browser,
which stutters and frequently fails ("could not be played", "removed from RD"). For an
English-first experience, enable the HiAnime provider — Tsumi embeds the `aniwatch` npm
scraper directly in its API routes and returns pre-transcoded HLS with native **English
Sub AND Dub** plus real English subtitles. No mkv transcoding, no eviction errors.

**Heads-up — this path is fragile:**
- The `aniwatch` GitHub repo got DMCA-takedown'd (npm package still installs).
- HiAnime updates its HTML periodically, breaking the scraper until upstream patches.
- HiAnime may be blocked or unreachable from some hosting regions.

When the scraper or HiAnime fails, Tsumi **silently falls back to Real-Debrid** so the
site keeps working — but expect needing to monitor and update `aniwatch` over time.

Set in Vercel env:

| Key | Value |
| --- | --- |
| `ENABLE_HIANIME` | `true` |

Redeploy. The watch page now resolves a single `English Dub · HD` or `English Sub · HD`
source per episode from HiAnime, with proper English subtitles attached. HLS routes
through `/api/hls` (Referer injection + CORS) and subtitles through `/api/sub`.

> When HiAnime breaks or is rate-limiting your deployment, Tsumi falls back to each
> user's own Real-Debrid key (section 4b). With no provider and no user key, that user
> sees a prompt to add their Real-Debrid token.

## 5. (Optional) Pre-roll ads & source endpoints

| Key | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_AD_NETWORK` | _(unset)_ | Identifier (`adsense`, `adsterra`, `propellerads` etc.) — any non-empty value turns on the banner ad slots on home / detail / watch pages. Hidden for Pro users. Pair with `NEXT_PUBLIC_AD_SCRIPT`. |
| `NEXT_PUBLIC_AD_SCRIPT` | _(unset)_ | URL of the ad network's loader script (e.g. `https://pagead2.googlesyndication.com/...`). Injected lazily into the root layout. The network's script then fills the `<AdSlot>` divs by their `data-tsumi-ad-slot` attribute. |
| `NEXT_PUBLIC_IMA_AD_TAG` | _(unset)_ | Google IMA ad tag URL for real pre-roll inventory. Without it, free tier shows a 5s house placeholder. |
| `YOUTUBE_API_KEY` | _(unset)_ | YouTube Data API v3 key. When set, detail pages show an English-preferred trailer searched on YouTube instead of AniList's JP-only PV. |
| `OPENSUBTITLES_API_KEY` | _(unset)_ | Free key from [opensubtitles.com/consumers](https://www.opensubtitles.com/consumers). When set, English subtitles are fetched per episode and attached to RD/torrent sources. Set `OPENSUBTITLES_USER_AGENT` alongside (e.g. `Tsumi/1.0`). |
| `NEXT_PUBLIC_TORRENTIO_BASE` | `https://torrentio.strem.fun` | override if self-hosting Torrentio |
| `NEXT_PUBLIC_ANIZIP_BASE` | `https://api.ani.zip` | AniList→Kitsu mapping |
| `NEXT_PUBLIC_NYAA_BASE` | `https://nyaa.si` | fallback source resolver |

---

## 6. Final redeploy & verification

1. With all env vars set, **redeploy** in Vercel.
2. Verify:
   - [ ] Home renders trending anime (live AniList).
   - [ ] Sign up via `/sign-in` → redirected to `/profile`.
   - [ ] Add an anime to your watchlist → reload → it persists (Supabase, not just localStorage).
   - [ ] Open an episode under `/watch/...` → free tier shows the pre-roll, then the player.
   - [ ] `/profile` → **Upgrade to Pro** → complete Stripe test checkout → return shows
         "Tsumi Pro Active" and the pre-roll no longer appears.
   - [ ] `https://YOUR_APP_URL/sitemap.xml`, `/robots.txt`, and `/opengraph-image` all load.

---

## Full env var checklist

```
# App
NEXT_PUBLIC_APP_URL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=

# Real-Debrid — BYO-key (no shared server key; users add their own on Profile)

# Optional
NEXT_PUBLIC_IMA_AD_TAG=
```

That's it — push to `main` and Vercel auto-deploys every commit.
