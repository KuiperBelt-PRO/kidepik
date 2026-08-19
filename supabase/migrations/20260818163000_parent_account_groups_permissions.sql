-- Grupos de cuenta tutor y permisos especiales (RBAC ligero en servidor).
-- El API (service role) gestiona membresías; el cliente no escribe estas tablas.

create table if not exists public.app_groups (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    label text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.app_permissions (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    label text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.app_group_permissions (
    group_id uuid not null references public.app_groups(id) on delete cascade,
    permission_id uuid not null references public.app_permissions(id) on delete cascade,
    primary key (group_id, permission_id)
);

create table if not exists public.parent_account_groups (
    parent_id uuid not null references public.parent_accounts(id) on delete cascade,
    group_id uuid not null references public.app_groups(id) on delete cascade,
    granted_at timestamptz not null default now(),
    primary key (parent_id, group_id)
);

create index if not exists parent_account_groups_group_id_idx
    on public.parent_account_groups (group_id);

comment on table public.app_groups is 'Grupos de cuenta tutor (developers, admins, …)';
comment on table public.app_permissions is 'Permisos especiales de producto (debug_ai, …)';
comment on table public.parent_account_groups is 'Membresía tutor ↔ grupo';

-- Catálogo inicial
insert into public.app_groups (slug, label) values
    ('developers', 'Desarrolladores'),
    ('admins', 'Administradores')
on conflict (slug) do nothing;

insert into public.app_permissions (slug, label) values
    ('debug_ai', 'Diagnóstico IA')
on conflict (slug) do nothing;

insert into public.app_group_permissions (group_id, permission_id)
select g.id, p.id
from public.app_groups g
cross join public.app_permissions p
where g.slug in ('developers', 'admins')
  and p.slug = 'debug_ai'
on conflict do nothing;

revoke all on public.app_groups from anon, authenticated;
revoke all on public.app_permissions from anon, authenticated;
revoke all on public.app_group_permissions from anon, authenticated;
revoke all on public.parent_account_groups from anon, authenticated;
