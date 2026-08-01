-- Traza de intentos LLM (modo debug / telemetría local)
create table if not exists public.ai_call_attempts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  child_id uuid null references public.children(id) on delete set null,
  purpose text not null,
  model_id text not null,
  position int not null,
  ok boolean not null,
  http_status int null,
  latency_ms int null,
  error_class text null,
  error_brief text null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists ai_call_attempts_call_idx on public.ai_call_attempts (call_id);
create index if not exists ai_call_attempts_created_idx on public.ai_call_attempts (created_at desc);
