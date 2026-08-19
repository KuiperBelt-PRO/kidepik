-- Emails preautorizados para grupos (se aplican al bootstrap/login del tutor).
create table if not exists public.app_group_bootstrap_emails (
    email text not null,
    group_id uuid not null references public.app_groups(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (email, group_id)
);

comment on table public.app_group_bootstrap_emails is
  'Emails que reciben un grupo al hacer bootstrap (p. ej. developers para debug IA)';

insert into public.app_group_bootstrap_emails (email, group_id)
select 'edusernalonso@gmail.com', g.id
from public.app_groups g
where g.slug = 'developers'
on conflict do nothing;

-- Si la cuenta ya existe, conceder ahora.
insert into public.parent_account_groups (parent_id, group_id)
select p.id, b.group_id
from public.parent_accounts p
join public.app_group_bootstrap_emails b on lower(b.email) = lower(p.email)
on conflict do nothing;

revoke all on public.app_group_bootstrap_emails from anon, authenticated;
