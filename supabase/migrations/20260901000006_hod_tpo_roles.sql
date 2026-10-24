-- Two more staff roles, built on the existing policies instead of new ones.
--   hod  Head of Department: reads every student of their own department (their faculty row says which). Needs a faculty_id.
--   tpo  Training and Placement Officer: reads every student (placement work spans departments). No faculty_id.
-- Every policy that says "my mentees" already goes through mentee_ids() / is_my_mentee(), so widening those two functions
-- gives each role exactly its scope. Admin-only rules (role = 'admin') are untouched, so HOD and TPO still cannot do admin work.

do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'c' loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','faculty','student','hod','tpo'));
alter table public.profiles add constraint profiles_student_link check ((role = 'student') = (student_id is not null));
alter table public.profiles add constraint profiles_faculty_link check ((role in ('faculty','hod')) = (faculty_id is not null));

create or replace function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r text := new.raw_app_meta_data ->> 'role';
begin
  -- raw_app_meta_data can only be set by the service role, so a self-signup gets NO profile and therefore NO access.
  if r in ('admin','faculty','student','hod','tpo') then
    insert into public.profiles (id, role, student_id, faculty_id, display_name)
    values (
      new.id, r,
      nullif(new.raw_app_meta_data ->> 'student_id', ''),
      nullif(new.raw_app_meta_data ->> 'faculty_id', ''),
      coalesce(nullif(new.raw_app_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1))
    )
    on conflict (id) do update set
      role = excluded.role, student_id = excluded.student_id, faculty_id = excluded.faculty_id, display_name = excluded.display_name;
  end if;
  return new;
end $$;

create or replace function app_private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('admin','faculty','hod','tpo') from public.profiles p where p.id = (select auth.uid())), false)
$$;

-- the students this person looks after: a mentor's mentees, a HOD's department, everyone for a TPO
create or replace function app_private.mentee_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  where exists (
    select 1 from public.profiles p
    left join public.faculty f on f.id = p.faculty_id
    where p.id = (select auth.uid())
      and ( (p.role = 'faculty' and s.mentor_id = p.faculty_id)
         or (p.role = 'hod' and s.branch_code = f.branch_code)
         or  p.role = 'tpo'))
$$;
create or replace function app_private.is_my_mentee(sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app_private.mentee_ids() m(id) where m.id = sid)
$$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or id = (select app_private.app_student_id())
  or id in (select app_private.mentee_ids()));

-- faculty evaluations are about teachers: admin, faculty and HOD may read the (anonymous, aggregated) summary; the TPO may not
create or replace function public.faculty_evaluation_summary()
returns table (subject_code text, faculty_name text, responses bigint, avg_rating numeric, avg_clarity numeric,
               avg_punctuality numeric, avg_doubt_solving numeric, avg_engagement numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(app_private.app_role(), '') not in ('admin','faculty','hod') then
    raise exception 'Not available for your role' using errcode = '42501';
  end if;
  return query
    select e.subject_code, e.faculty_name, count(*), round(avg(e.rating), 2), round(avg(e.clarity), 2),
           round(avg(e.punctuality), 2), round(avg(e.doubt_solving), 2), round(avg(e.engagement), 2)
    from public.faculty_evaluations e
    group by e.subject_code, e.faculty_name
    having count(*) >= 5;
end $$;
revoke all on function public.faculty_evaluation_summary() from public, anon;
grant execute on function public.faculty_evaluation_summary() to authenticated;
