-- Perfiles infantiles (plazas de tripulación) + permisos por miembro.
create table if not exists public.children (
    id uuid primary key default gen_random_uuid(),
    parent_id uuid not null references public.parent_accounts(id) on delete cascade,
    display_name text null,
    age_years int null check (age_years is null or (age_years between 5 and 14)),
    age_band text null check (age_band is null or age_band in ('age_7', 'age_9')),
    effective_age_band text null
        check (effective_age_band is null or effective_age_band in ('age_7', 'age_9')),
    birth_year int null,
    world_theme text null check (world_theme is null or world_theme in ('fantasy', 'sci-fi')),
    locale text not null default 'es-ES',
    status text not null default 'active'
        check (status in ('active', 'paused', 'deleted')),
    onboarding_step text not null default 'pending_entry'
        check (onboarding_step in (
            'pending_entry', 'choose_world', 'choose_name', 'choose_age',
            'placement', 'complete'
        )),
    placement_status text not null default 'not_started'
        check (placement_status in ('not_started', 'in_progress', 'completed')),
    settings jsonb not null default '{}'::jsonb,
    deleted_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists children_parent_id_idx
    on public.children (parent_id)
    where status <> 'deleted';

comment on table public.children is 'Perfiles / plazas de tripulación bajo una cuenta tutor';

create table if not exists public.child_permissions (
    child_id uuid primary key references public.children(id) on delete cascade,
    allow_solo_start boolean not null default true,
    require_exit_pin boolean not null default false,
    exit_pin_hash text null,
    session_limit_per_day int null
        check (session_limit_per_day is null or (session_limit_per_day between 1 and 12)),
    max_session_minutes int not null default 10
        check (max_session_minutes in (5, 10, 15, 20)),
    allowed_hours jsonb null,
    can_choose_story_branch boolean not null default true,
    lock_world_theme boolean not null default true,
    font_scale_play text not null default 'md'
        check (font_scale_play in ('md', 'lg', 'xl')),
    learning_overrides jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

comment on table public.child_permissions is 'Permisos y límites por miembro de tripulación';

alter table public.children enable row level security;
alter table public.child_permissions enable row level security;

-- Escrituras solo vía API PHP (service role / DATABASE_URL). Lectura authenticated opcional futura.
revoke insert, update, delete on public.children from anon, authenticated;
revoke insert, update, delete on public.child_permissions from anon, authenticated;
