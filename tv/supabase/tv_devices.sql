-- Tsumi TV — device-pairing table.
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- It's additive: it does not touch any table the website uses.

create table if not exists public.tv_devices (
  device_code text primary key,
  user_code   text not null,
  status      text not null default 'pending',
  rd_key      text,
  list        jsonb default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  expires_at  timestamptz not null
);

create index if not exists tv_devices_user_code on public.tv_devices (user_code);
