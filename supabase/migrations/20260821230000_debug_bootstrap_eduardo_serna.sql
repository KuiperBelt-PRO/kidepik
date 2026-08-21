-- Desarrollador local: eduardosernaalonso@gmail.com (debug IA en tutor o tripulante con email bootstrap).

insert into public.app_group_bootstrap_emails (email, group_id)
select 'eduardosernaalonso@gmail.com', g.id
from public.app_groups g
where g.slug = 'developers'
on conflict do nothing;

insert into public.parent_account_groups (parent_id, group_id)
select p.id, b.group_id
from public.parent_accounts p
join public.app_group_bootstrap_emails b on lower(b.email) = lower(p.email)
where lower(b.email) = lower('eduardosernaalonso@gmail.com')
on conflict do nothing;
