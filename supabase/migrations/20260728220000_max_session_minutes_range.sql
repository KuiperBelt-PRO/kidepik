-- Duración máxima de sesión: 5–120 min, step 5 (antes solo 5/10/15/20).
alter table public.child_permissions
  drop constraint if exists child_permissions_max_session_minutes_check;

alter table public.child_permissions
  add constraint child_permissions_max_session_minutes_check
  check (
    max_session_minutes >= 5
    and max_session_minutes <= 120
    and max_session_minutes % 5 = 0
  );
