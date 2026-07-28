-- Preferencias del tutor / hogar (ui_theme, tipografía, defaults crew, etc.)
alter table public.parent_accounts
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.parent_accounts.settings is
  'Preferencias del tutor / hogar (ui_theme, tipografía, defaults crew, etc.)';
