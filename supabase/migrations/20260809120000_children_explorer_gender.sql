-- SPEC_APP_EXPLORER_GENDER: sexo del explorador + paso choose_gender en onboarding

alter table public.children
  add column if not exists explorer_gender text null;

alter table public.children drop constraint if exists children_explorer_gender_check;
alter table public.children
  add constraint children_explorer_gender_check
  check (explorer_gender is null or explorer_gender in ('male', 'female'));

alter table public.children drop constraint if exists children_onboarding_step_check;
alter table public.children
  add constraint children_onboarding_step_check
  check (onboarding_step in (
    'pending_entry', 'choose_world', 'choose_name', 'choose_age',
    'choose_gender', 'choose_character', 'placement', 'complete'
  ));

comment on column public.children.explorer_gender is
  'Sexo declarado del explorador (male/female); null legacy → masculino en runtime';
