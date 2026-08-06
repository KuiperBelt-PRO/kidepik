-- Waiting phrases for mentor compose waits (SPEC_APP_WAITING_PHRASES)

create table if not exists public.waiting_phrases (
  id uuid primary key default gen_random_uuid(),
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi', 'neutral')),
  age_band text null,
  phase text not null,
  locale text not null default 'es',
  body text not null check (char_length(body) between 8 and 180),
  weight int not null default 1 check (weight >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists waiting_phrases_lookup_idx
  on public.waiting_phrases (world_theme, phase, active)
  where active;

insert into public.waiting_phrases (world_theme, age_band, phase, body, weight)
select * from (values
  ('fantasy'::text, null::text, 'placement_compose'::text, 'El Guardián consulta las runas un momento…'::text, 2),
  ('fantasy', null, 'placement_compose', 'Respira hondo: las pruebas se preparan con calma.', 1),
  ('fantasy', 'band_early', 'placement_compose', 'Un susurro mágico prepara tu siguiente reto…', 2),
  ('sci-fi', null, 'placement_compose', 'El Arquitecto alinea las balizas de la Academia…', 2),
  ('sci-fi', null, 'placement_compose', 'Sincronizando módulos de evaluación. Un momento.', 1),
  ('sci-fi', 'band_early', 'placement_compose', 'Las luces del casco parpadean: casi listo.', 2),
  ('fantasy', null, 'path_compose', 'Se abren tres senderos en la niebla…', 2),
  ('sci-fi', null, 'path_compose', 'Tres rutas aparecen en el mapa holográfico…', 2),
  ('neutral', null, 'generic', 'Un momento, por favor…', 1),
  ('fantasy', null, 'generic', 'La historia toma aire antes de continuar.', 1),
  ('sci-fi', null, 'generic', 'Procesando el siguiente salto de la misión.', 1),
  ('fantasy', null, 'challenge_compose', 'El reto se forja en silencio…', 1),
  ('sci-fi', null, 'challenge_compose', 'Calibrando el desafío orbital…', 1)
) as v(world_theme, age_band, phase, body, weight)
where not exists (select 1 from public.waiting_phrases limit 1);
