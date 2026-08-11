-- Economía y equipaje (SPEC_APP_REWARDS_ECONOMY + SPEC_APP_INVENTORY_BAGGAGE)

create table if not exists public.child_wallets (
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi')),
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  updated_at timestamptz not null default now(),
  primary key (child_id, world_theme)
);

create table if not exists public.child_inventory_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi')),
  item_def_id text not null,
  qty integer not null default 1 check (qty >= 1),
  acquired_at timestamptz not null default now(),
  last_used_at timestamptz null,
  meta jsonb not null default '{}'::jsonb,
  unique (child_id, world_theme, item_def_id)
);

create index if not exists child_inventory_child_world_idx
  on public.child_inventory_items (child_id, world_theme);

create table if not exists public.reward_grants (
  grant_key text primary key,
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi')),
  offer_id text not null default '',
  currency_delta integer not null default 0,
  item_def_id text null,
  item_qty integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists reward_grants_child_world_idx
  on public.reward_grants (child_id, world_theme, created_at desc);
