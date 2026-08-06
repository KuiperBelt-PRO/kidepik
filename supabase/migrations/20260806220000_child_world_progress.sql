-- Progreso canónico por mundo (SPEC_APP_PARALLEL_WORLDS)

create table if not exists public.child_world_progress (
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi')),
  general_level text null,
  rank_id text null,
  placement_status text not null default 'not_started'
    check (placement_status in ('not_started', 'in_progress', 'completed', 'pending')),
  onboarding_step text null,
  updated_at timestamptz not null default now(),
  primary key (child_id, world_theme)
);

alter table public.user_subject_levels
  add column if not exists world_theme text;

update public.user_subject_levels usl
set world_theme = coalesce(
  (select c.world_theme from public.children c where c.id = usl.child_id),
  'fantasy'
)
where world_theme is null;

alter table public.user_subject_levels
  alter column world_theme set default 'fantasy';

update public.user_subject_levels set world_theme = 'fantasy' where world_theme is null;

alter table public.user_subject_levels
  alter column world_theme set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'user_subject_levels_pkey'
  ) then
    alter table public.user_subject_levels drop constraint user_subject_levels_pkey;
  end if;
exception when others then
  null;
end $$;

alter table public.user_subject_levels
  drop constraint if exists user_subject_levels_pkey;

-- Deduplicate before new PK
delete from public.user_subject_levels a
using public.user_subject_levels b
where a.ctid < b.ctid
  and a.child_id = b.child_id
  and a.subject_id = b.subject_id
  and a.world_theme = b.world_theme;

alter table public.user_subject_levels
  add primary key (child_id, world_theme, subject_id);

insert into public.child_world_progress (
  child_id, world_theme, general_level, rank_id, placement_status, onboarding_step, updated_at
)
select
  c.id,
  coalesce(nullif(c.world_theme, ''), 'fantasy'),
  c.general_level,
  c.rank_id,
  case
    when c.placement_status in ('not_started', 'in_progress', 'completed', 'pending')
      then c.placement_status
    else 'not_started'
  end,
  c.onboarding_step,
  now()
from public.children c
where coalesce(c.world_theme, 'fantasy') in ('fantasy', 'sci-fi')
on conflict (child_id, world_theme) do update set
  general_level = excluded.general_level,
  rank_id = excluded.rank_id,
  placement_status = excluded.placement_status,
  onboarding_step = excluded.onboarding_step,
  updated_at = now();

alter table public.children
  add column if not exists active_world_theme text
  check (active_world_theme is null or active_world_theme in ('fantasy', 'sci-fi'));

update public.children
set active_world_theme = world_theme
where active_world_theme is null
  and world_theme in ('fantasy', 'sci-fi');
