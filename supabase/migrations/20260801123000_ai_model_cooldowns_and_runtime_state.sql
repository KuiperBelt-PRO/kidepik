-- Cooldown temporal de modelos con fallos recurrentes (reintento tras TTL).
-- SPEC_AI_OPENROUTER_GATEWAY § cooldown + discovery sync.

create table if not exists public.ai_model_cooldowns (
  purpose text not null,
  model_id text not null,
  error_class text not null default 'other',
  http_status int null,
  last_error_brief text null,
  failure_count int not null default 1 check (failure_count >= 1),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (purpose, model_id)
);

create index if not exists ai_model_cooldowns_expires
  on public.ai_model_cooldowns (expires_at);

create index if not exists ai_model_cooldowns_purpose_expires
  on public.ai_model_cooldowns (purpose, expires_at);

-- Estado runtime (última sync discovery, etc.)
create table if not exists public.ai_runtime_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
