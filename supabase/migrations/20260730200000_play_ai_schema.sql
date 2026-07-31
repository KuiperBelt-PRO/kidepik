-- Play / IA: age bands abiertas, mentor, traits, diálogo, memoria viaje, catálogo modelos
-- SPEC_APP_AGE_BANDS, SPEC_APP_MENTOR, SPEC_APP_CHARACTER_TRAITS, SPEC_APP_JOURNEY_MEMORY, SPEC_AI_OPENROUTER_GATEWAY

-- Ampliar checks de edad / bandas / onboarding (Postgres: dropear checks antiguos por nombre)
alter table public.children drop constraint if exists children_age_years_check;
alter table public.children
  add constraint children_age_years_check
  check (age_years is null or (age_years between 5 and 99));

alter table public.children drop constraint if exists children_age_band_check;
alter table public.children
  add constraint children_age_band_check
  check (
    age_band is null or age_band in (
      'age_7', 'age_9',
      'band_early', 'band_child', 'band_tween', 'band_teen', 'band_adult', 'band_senior'
    )
  );

alter table public.children drop constraint if exists children_effective_age_band_check;
alter table public.children
  add constraint children_effective_age_band_check
  check (
    effective_age_band is null or effective_age_band in (
      'age_7', 'age_9',
      'band_early', 'band_child', 'band_tween', 'band_teen', 'band_adult', 'band_senior'
    )
  );

alter table public.children drop constraint if exists children_onboarding_step_check;
alter table public.children
  add constraint children_onboarding_step_check
  check (onboarding_step in (
    'pending_entry', 'choose_world', 'choose_name', 'choose_age',
    'choose_character', 'placement', 'complete'
  ));

alter table public.children
  add column if not exists mentor_id text null;

alter table public.children
  add column if not exists general_level text null;

alter table public.children
  add column if not exists rank_id text null;

alter table public.children
  add column if not exists rank_track text null
    check (rank_track is null or rank_track in ('fantasy', 'sci-fi'));

-- Migrar bandas legacy cuando sea posible
update public.children
set age_band = case
  when age_band = 'age_7' and coalesce(age_years, 8) <= 7 then 'band_early'
  when age_band = 'age_7' then 'band_child'
  when age_band = 'age_9' and coalesce(age_years, 9) >= 11 then 'band_tween'
  when age_band = 'age_9' then 'band_child'
  else age_band
end
where age_band in ('age_7', 'age_9');

update public.children
set effective_age_band = case
  when effective_age_band = 'age_7' and coalesce(age_years, 8) <= 7 then 'band_early'
  when effective_age_band = 'age_7' then 'band_child'
  when effective_age_band = 'age_9' and coalesce(age_years, 9) >= 11 then 'band_tween'
  when effective_age_band = 'age_9' then 'band_child'
  else effective_age_band
end
where effective_age_band in ('age_7', 'age_9');

create table if not exists public.child_traits (
  child_id uuid primary key references public.children(id) on delete cascade,
  species text not null,
  palette text not null,
  features jsonb not null default '[]'::jsonb,
  vibe text null,
  achievements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.dialogue_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  flow_id text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  mentor_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dialogue_sessions_child_flow_idx
  on public.dialogue_sessions (child_id, flow_id, status);

create table if not exists public.dialogue_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.dialogue_sessions(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  flow_id text not null,
  sequence int not null,
  role text not null check (role in ('mentor', 'explorer', 'system', 'agent', 'child')),
  text text not null default '',
  options jsonb null,
  input_mode text null,
  explorer_reply jsonb null,
  meta jsonb not null default '{}'::jsonb,
  model_used text null,
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);

create index if not exists dialogue_turns_child_idx on public.dialogue_turns (child_id, created_at);

create table if not exists public.story_beats (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  session_id uuid null,
  sequence_num int not null,
  chapter_id text not null default 'C0_arrival',
  zone_id text null,
  beat_kind text not null check (beat_kind in (
    'narration', 'choice', 'challenge_intro', 'challenge_result', 'quest_update', 'ceremony'
  )),
  narrative_text text not null,
  choices_offered jsonb null,
  choice_taken jsonb null,
  learning_ref uuid null,
  dialogue_turn_id uuid null,
  model_used text null,
  created_at timestamptz not null default now(),
  unique (child_id, sequence_num)
);

create table if not exists public.story_summaries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  kind text not null check (kind in ('condensed_full', 'chapter')),
  chapter_id text null,
  up_to_sequence int not null,
  up_to_turn_seq int null,
  summary_text text not null,
  structured jsonb null,
  model_used text null,
  created_at timestamptz not null default now()
);

create table if not exists public.journey_decisions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  decision_key text not null,
  option_id text null,
  label text null,
  beat_id uuid null,
  turn_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_model_catalog (
  model_id text primary key,
  name text null,
  context_length int null,
  pricing_prompt numeric not null default 0,
  pricing_completion numeric not null default 0,
  is_free boolean not null default true,
  top_provider text null,
  raw jsonb null,
  rank_score numeric not null default 0,
  fail_count_window int not null default 0,
  last_success_at timestamptz null,
  last_fail_at timestamptz null,
  fetched_at timestamptz not null default now()
);

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  child_id uuid null references public.children(id) on delete set null,
  purpose text null,
  provider text not null default 'openrouter',
  model text null,
  tokens_in int null,
  tokens_out int null,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_child_day_idx on public.api_usage (child_id, created_at);
