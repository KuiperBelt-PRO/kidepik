-- Descripción narrativa evolutiva del personaje (tutor + prompts).
alter table public.child_traits
  add column if not exists character_summary text null;
