-- POC: tabla mínima para validar PostgREST + cliente Supabase desde la app.
create table if not exists public.poc_health (
    id int primary key default 1 check (id = 1),
    message text not null default 'ok',
    updated_at timestamptz not null default now()
);

insert into public.poc_health (id, message)
values (1, 'poc ready')
on conflict (id) do update set message = excluded.message, updated_at = now();

alter table public.poc_health enable row level security;

grant select on public.poc_health to anon, authenticated;

create policy "Allow public read poc_health"
    on public.poc_health
    for select
    to anon, authenticated
    using (true);
