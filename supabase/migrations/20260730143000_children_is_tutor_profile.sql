-- Perfil del tutor como miembro fijo de tripulación (no eliminable).
alter table public.children
    add column if not exists is_tutor_profile boolean not null default false;

comment on column public.children.is_tutor_profile is
    'true = plaza del propio tutor; siempre visible y no soft-deletable';

create unique index if not exists children_one_tutor_profile_per_parent_idx
    on public.children (parent_id)
    where is_tutor_profile = true and status <> 'deleted';
