-- Acceso Gmail propio por plaza de tripulación (SPEC_APP_CREW_MEMBER_ACCOUNT).
alter table public.children
  add column if not exists invite_email text null,
  add column if not exists invite_email_canonical text null,
  add column if not exists linked_auth_user_id uuid null,
  add column if not exists linked_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'children_linked_auth_user_id_fkey'
  ) then
    alter table public.children
      add constraint children_linked_auth_user_id_fkey
        foreign key (linked_auth_user_id) references auth.users (id) on delete set null;
  end if;
end $$;

alter table public.children drop constraint if exists children_invite_email_canonical_check;
alter table public.children
  add constraint children_invite_email_canonical_check
    check (
      invite_email_canonical is null
      or invite_email_canonical ~ '^[^@]+@gmail\.com$'
    );

create unique index if not exists children_invite_email_canonical_uidx
  on public.children (invite_email_canonical)
  where invite_email_canonical is not null and status <> 'deleted';

create unique index if not exists children_linked_auth_user_id_uidx
  on public.children (linked_auth_user_id)
  where linked_auth_user_id is not null;

comment on column public.children.invite_email is
  'Gmail mostrado al tutor (tal como lo escribió, trim).';
comment on column public.children.invite_email_canonical is
  'Gmail normalizado para match de login (SPEC_APP_CREW_MEMBER_ACCOUNT).';
