-- Cuenta padre/tutor vinculada a auth.users (Supabase Auth).
create table if not exists public.parent_accounts (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique,
    email text not null,
    display_name text,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint parent_accounts_auth_user_id_fkey
        foreign key (auth_user_id) references auth.users (id) on delete cascade
);

create index if not exists parent_accounts_email_idx on public.parent_accounts (email);

comment on table public.parent_accounts is 'Cuenta adulta responsable; 1:1 con auth.users';

alter table public.parent_accounts enable row level security;

create policy "parent_select_own"
    on public.parent_accounts
    for select
    to authenticated
    using (auth.uid() = auth_user_id);

revoke insert, update, delete on public.parent_accounts from anon, authenticated;
grant select on public.parent_accounts to authenticated;
