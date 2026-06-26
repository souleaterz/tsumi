-- ─────────────────────────────────────────────────────────────
-- Tsumi — Supabase schema
-- Run this in the Supabase SQL editor to provision the tables.
-- User IDs come from Clerk (text subject), not Supabase auth.
-- ─────────────────────────────────────────────────────────────

-- Per-user watchlist
create table if not exists public.watchlist (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  anilist_id   integer not null,
  title        text,
  cover_image  text,
  format       text,
  added_at     timestamptz not null default now(),
  unique (user_id, anilist_id)
);

-- Episode-level watch progress (also powers "Continue Watching")
create table if not exists public.watch_progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  anilist_id     integer not null,
  episode        integer not null,
  title          text,
  cover_image    text,
  total_episodes integer,
  position_sec   double precision not null default 0,
  duration_sec   double precision not null default 0,
  completed      boolean not null default false,
  updated_at     timestamptz not null default now(),
  unique (user_id, anilist_id, episode)
);

-- Subscription state mirrored from Stripe webhooks
create table if not exists public.subscriptions (
  user_id              text primary key,
  stripe_customer_id   text,
  stripe_subscription_id text,
  status               text not null default 'free', -- free | active | canceled | past_due
  tier                 text not null default 'free', -- free | pro
  current_period_end   timestamptz,
  updated_at           timestamptz not null default now()
);

create index if not exists watch_progress_user_updated
  on public.watch_progress (user_id, updated_at desc);
create index if not exists watchlist_user
  on public.watchlist (user_id, added_at desc);

-- Row Level Security: each user only sees their own rows.
alter table public.watchlist        enable row level security;
alter table public.watch_progress   enable row level security;
alter table public.subscriptions    enable row level security;

-- NOTE: RLS is enabled with NO policies, so direct client (anon-key) access is
-- denied. Tsumi reads/writes these tables through server-side API routes
-- (/api/watchlist, /api/progress) using the service-role key, which bypasses
-- RLS, with the user resolved from the Clerk session. No Clerk↔Supabase JWT
-- integration is required.
