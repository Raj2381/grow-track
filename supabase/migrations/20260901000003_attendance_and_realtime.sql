-- Atomic creation of an attendance session with its register, plus realtime for the live tables.
-- SECURITY INVOKER: every insert runs as the caller, so the Row Level Security policies on both tables still decide.

create or replace function public.create_attendance_session(p_session jsonb, p_records jsonb)
returns text
language plpgsql security invoker set search_path = '' as $$
declare
  sid text := p_session ->> 'id';
begin
  if sid is null or length(sid) < 4 then
    raise exception 'A session id is required' using errcode = '22023';
  end if;
  insert into public.attendance_sessions (id, title, subject, department, year, section, session_date, start_time, end_time, submitted, created_by)
  values (
    sid, p_session ->> 'title', p_session ->> 'subject', p_session ->> 'department', p_session ->> 'year',
    nullif(p_session ->> 'section', ''), (p_session ->> 'session_date')::date, p_session ->> 'start_time', p_session ->> 'end_time',
    false, (select auth.uid())            -- the owner is always the caller, whatever the client sent
  );
  insert into public.attendance_records (session_id, student_id, status)
  select sid, r ->> 'student_id', coalesce(r ->> 'status', 'absent')
  from jsonb_array_elements(p_records) as r;
  return sid;
end $$;

revoke all on function public.create_attendance_session(jsonb, jsonb) from public, anon;
grant execute on function public.create_attendance_session(jsonb, jsonb) to authenticated;

-- Realtime (Supabase only: the publication does not exist in a bare Postgres). Row Level Security still filters events.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['attendance_sessions', 'attendance_records', 'interventions', 'recommendations'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
