-- Placement exams + subject levels (SPEC_APP_PLACEMENT_EXAM)

create table if not exists public.placement_exams (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null,
  status text not null check (status in ('in_progress', 'completed', 'abandoned')),
  general_level text null,
  raw_scores jsonb not null default '{}'::jsonb,
  narrative_variant text null,
  item_queue jsonb not null default '[]'::jsonb,
  current_index int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists placement_exams_child_idx on public.placement_exams (child_id, status);

create table if not exists public.placement_answers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.placement_exams(id) on delete cascade,
  subject_id text not null,
  item_key text not null,
  item_type text not null,
  prompt_text text not null,
  response jsonb not null,
  score numeric not null check (score >= 0 and score <= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.user_subject_levels (
  child_id uuid not null references public.children(id) on delete cascade,
  subject_id text not null,
  level_id text not null check (level_id in ('L1','L2','L3','L4','L5')),
  accuracy_rolling numeric null,
  difficulty_modifier numeric not null default 0,
  source text not null default 'placement',
  updated_at timestamptz not null default now(),
  primary key (child_id, subject_id)
);

create table if not exists public.narrative_quests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  zone_id text not null,
  chapter_id text not null default 'C1_first_zone',
  title_child text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  steps_total int not null default 2,
  steps_done int not null default 0,
  learning_gates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
