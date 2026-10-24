-- GrowTrack security: identity helpers, Row Level Security on EVERY public table, policies, RPCs.
-- Idempotent. Authorization reads public.profiles (written only by the auth trigger / service role), never user_metadata.
--
-- Roles
--   anon      no policy anywhere: sees nothing
--   student   own rows only; may add portal data (activities, test attempts, feedback...), never marks or predictions
--   faculty   students whose mentor_id is theirs; interventions, recommendation status, attendance they created
--   admin     everything; writes staff-managed tables
-- The service_role key bypasses RLS and is used only by server-only scripts (seed, ML load).

-- ===================================================================== profiles <-> auth.users
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

create or replace function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r text := new.raw_app_meta_data ->> 'role';
begin
  -- raw_app_meta_data can only be set by the service role, so a self-signup gets NO profile and therefore NO access.
  if r in ('admin','faculty','student') then
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of raw_app_meta_data on auth.users
  for each row execute function app_private.handle_new_user();

-- ===================================================================== helpers (private schema, not exposed by the API)
create or replace function app_private.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;
create or replace function app_private.app_student_id() returns text
language sql stable security definer set search_path = '' as $$
  select p.student_id from public.profiles p where p.id = (select auth.uid())
$$;
create or replace function app_private.app_faculty_id() returns text
language sql stable security definer set search_path = '' as $$
  select p.faculty_id from public.profiles p where p.id = (select auth.uid())
$$;
create or replace function app_private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('admin','faculty') from public.profiles p where p.id = (select auth.uid())), false)
$$;
create or replace function app_private.mentee_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  where s.mentor_id = (select p.faculty_id from public.profiles p where p.id = (select auth.uid()))
$$;
create or replace function app_private.is_my_mentee(sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students s
    where s.id = sid and s.mentor_id = (select p.faculty_id from public.profiles p where p.id = (select auth.uid()))
  )
$$;
-- attendance helpers are security definer so the sessions and records policies do not recurse into each other
create or replace function app_private.session_created_by_me(sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.attendance_sessions s where s.id = sid and s.created_by = (select auth.uid()))
$$;
create or replace function app_private.session_visible_to_student(sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.attendance_records r join public.attendance_sessions s on s.id = r.session_id
    where r.session_id = sid and s.submitted and r.student_id = (select p.student_id from public.profiles p where p.id = (select auth.uid()))
  )
$$;
create or replace function app_private.session_submitted(sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.submitted from public.attendance_sessions s where s.id = sid), false)
$$;

revoke all on all functions in schema app_private from public, anon;
grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

-- ===================================================================== RLS on every public table, then table grants
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on all tables in schema public to service_role;
  end if;
end $$;
alter default privileges in schema public revoke all on tables from anon;

-- ===================================================================== policies
-- Readable by self, by the mentor of that student, and by admins. No client writes (data is loaded by the service role).
do $$
declare t text; cond text;
begin
  foreach t in array array['semester_results','backlogs','attendance_monthly','lecture_presence','lms_monthly','assignments','faculty_remarks'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select app_private.app_role()) = 'admin'
      or student_id = (select app_private.app_student_id())
      or student_id in (select app_private.mentee_ids()))$p$, t || '_read', t);
  end loop;
end $$;

-- Student-owned data a student may add themselves (portal source only); staff can read, never forge a student's row.
do $$
declare t text;
begin
  foreach t in array array['aptitude_attempts','coding_attempts','interview_attempts','skill_assessments','activities'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select app_private.app_role()) = 'admin'
      or student_id = (select app_private.app_student_id())
      or student_id in (select app_private.mentee_ids()))$p$, t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_student_insert', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (
      student_id = (select app_private.app_student_id()) and source = 'portal')$p$, t || '_student_insert', t);
  end loop;
end $$;
-- a student may only file an activity as Pending; staff decide Approved / Rejected
drop policy if exists activities_student_insert on public.activities;
create policy activities_student_insert on public.activities for insert to authenticated with check (
  student_id = (select app_private.app_student_id()) and source = 'portal' and status = 'Pending');
drop policy if exists activities_staff_update on public.activities;
create policy activities_staff_update on public.activities for update to authenticated
  using ((select app_private.app_role()) = 'admin' or student_id in (select app_private.mentee_ids()))
  with check ((select app_private.app_role()) = 'admin' or student_id in (select app_private.mentee_ids()));

-- students
drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or id = (select app_private.app_student_id())
  or mentor_id = (select app_private.app_faculty_id()));

-- reference data: any signed-in user
do $$
declare t text;
begin
  foreach t in array array['departments','faculty','subjects','branch_subjects','semesters'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- profiles: your own row, or admin
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select app_private.app_role()) = 'admin');

-- interventions
drop policy if exists interventions_read on public.interventions;
create policy interventions_read on public.interventions for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or student_id = (select app_private.app_student_id())
  or student_id in (select app_private.mentee_ids()));
drop policy if exists interventions_staff_insert on public.interventions;
create policy interventions_staff_insert on public.interventions for insert to authenticated with check (
  source = 'app' and created_by = (select auth.uid())
  and ((select app_private.app_role()) = 'admin' or student_id in (select app_private.mentee_ids())));
drop policy if exists interventions_staff_update on public.interventions;
create policy interventions_staff_update on public.interventions for update to authenticated
  using ((select app_private.app_role()) = 'admin' or student_id in (select app_private.mentee_ids()))
  with check ((select app_private.app_role()) = 'admin' or student_id in (select app_private.mentee_ids()));
drop policy if exists interventions_staff_delete on public.interventions;
create policy interventions_staff_delete on public.interventions for delete to authenticated
  using (source = 'app' and ((select app_private.app_role()) = 'admin' or student_id in (select app_private.mentee_ids())));

-- attendance sessions and records
drop policy if exists attendance_sessions_read on public.attendance_sessions;
create policy attendance_sessions_read on public.attendance_sessions for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or created_by = (select auth.uid())
  or (select app_private.session_visible_to_student(id)));
drop policy if exists attendance_sessions_insert on public.attendance_sessions;
create policy attendance_sessions_insert on public.attendance_sessions for insert to authenticated with check (
  created_by = (select auth.uid()) and (select app_private.is_staff()));
drop policy if exists attendance_sessions_update on public.attendance_sessions;
create policy attendance_sessions_update on public.attendance_sessions for update to authenticated
  using ((select app_private.app_role()) = 'admin' or created_by = (select auth.uid()))
  with check ((select app_private.app_role()) = 'admin' or created_by = (select auth.uid()));
drop policy if exists attendance_sessions_delete on public.attendance_sessions;
create policy attendance_sessions_delete on public.attendance_sessions for delete to authenticated
  using ((select app_private.app_role()) = 'admin' or (created_by = (select auth.uid()) and not submitted));

drop policy if exists attendance_records_read on public.attendance_records;
create policy attendance_records_read on public.attendance_records for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or (select app_private.session_created_by_me(session_id))
  or (student_id = (select app_private.app_student_id()) and (select app_private.session_submitted(session_id)))
  or student_id in (select app_private.mentee_ids()));
drop policy if exists attendance_records_write on public.attendance_records;
create policy attendance_records_write on public.attendance_records for all to authenticated
  using ((select app_private.app_role()) = 'admin' or (select app_private.session_created_by_me(session_id)))
  with check ((select app_private.app_role()) = 'admin' or (select app_private.session_created_by_me(session_id)));

-- declared results and academic updates: staff-managed, readable by self and mentor
do $$
declare t text;
begin
  foreach t in array array['declared_results','declared_result_subjects','academic_updates'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select app_private.app_role()) = 'admin'
      or student_id = (select app_private.app_student_id())
      or student_id in (select app_private.mentee_ids()))$p$, t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using ((select app_private.app_role()) = 'admin') with check ((select app_private.app_role()) = 'admin')$p$, t || '_admin_write', t);
  end loop;
end $$;

-- mock interview results: students add their own
drop policy if exists mock_interview_read on public.mock_interview_results;
create policy mock_interview_read on public.mock_interview_results for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or student_id = (select app_private.app_student_id())
  or student_id in (select app_private.mentee_ids()));
drop policy if exists mock_interview_student_insert on public.mock_interview_results;
create policy mock_interview_student_insert on public.mock_interview_results for insert to authenticated with check (
  student_id = (select app_private.app_student_id()));

-- LMS activity: students write their own
do $$
declare t text;
begin
  foreach t in array array['lms_logins','lms_completed_assignments','lms_solved_challenges'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select app_private.app_role()) = 'admin'
      or student_id = (select app_private.app_student_id())
      or student_id in (select app_private.mentee_ids()))$p$, t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (student_id = (select app_private.app_student_id()))
      with check (student_id = (select app_private.app_student_id()))$p$, t || '_own_write', t);
  end loop;
end $$;

-- admin settings: each staff user owns one row
drop policy if exists admin_settings_own on public.admin_settings;
create policy admin_settings_own on public.admin_settings for all to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_staff()))
  with check (user_id = (select auth.uid()) and (select app_private.is_staff()));

-- general feedback: a student writes and reads their own; admins read all and move the status
drop policy if exists feedback_read on public.feedback_entries;
create policy feedback_read on public.feedback_entries for select to authenticated using (
  (select app_private.app_role()) = 'admin' or student_id = (select app_private.app_student_id()));
drop policy if exists feedback_student_insert on public.feedback_entries;
create policy feedback_student_insert on public.feedback_entries for insert to authenticated with check (
  student_id = (select app_private.app_student_id()) and status = 'Submitted');
drop policy if exists feedback_admin_update on public.feedback_entries;
create policy feedback_admin_update on public.feedback_entries for update to authenticated
  using ((select app_private.app_role()) = 'admin') with check ((select app_private.app_role()) = 'admin');

-- anonymous faculty evaluations: receipts are the student's; evaluations have NO policy (RPC and summary only)
drop policy if exists receipts_read on public.faculty_evaluation_receipts;
create policy receipts_read on public.faculty_evaluation_receipts for select to authenticated using (
  student_id = (select app_private.app_student_id()) or (select app_private.app_role()) = 'admin');

-- surveys and the introduction test: the student's own
do $$
declare t text;
begin
  foreach t in array array['surveys','portal_intro'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select app_private.app_role()) = 'admin'
      or student_id = (select app_private.app_student_id())
      or student_id in (select app_private.mentee_ids()))$p$, t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (student_id = (select app_private.app_student_id()))
      with check (student_id = (select app_private.app_student_id()))$p$, t || '_own_write', t);
  end loop;
end $$;

-- ===================================================================== machine-learning outputs
drop policy if exists predictions_read on public.predictions;
create policy predictions_read on public.predictions for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or student_id = (select app_private.app_student_id())
  or student_id in (select app_private.mentee_ids()));
drop policy if exists whatif_inputs_read on public.whatif_inputs;
create policy whatif_inputs_read on public.whatif_inputs for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or student_id = (select app_private.app_student_id())
  or student_id in (select app_private.mentee_ids()));
drop policy if exists segment_members_read on public.segment_members;
create policy segment_members_read on public.segment_members for select to authenticated using (
  (select app_private.app_role()) = 'admin' or student_id in (select app_private.mentee_ids()));

-- recommendations: students see the ones about them; staff see their mentees' plus segment-level ones
drop policy if exists recommendations_read on public.recommendations;
create policy recommendations_read on public.recommendations for select to authenticated using (
  (select app_private.app_role()) = 'admin'
  or (target_type = 'student' and target_id = (select app_private.app_student_id()))
  or (target_type = 'student' and target_id in (select app_private.mentee_ids()))
  or (target_type = 'segment' and (select app_private.is_staff())));
drop policy if exists recommendations_staff_update on public.recommendations;
create policy recommendations_staff_update on public.recommendations for update to authenticated
  using ((select app_private.app_role()) = 'admin' or (target_type = 'student' and target_id in (select app_private.mentee_ids())))
  with check ((select app_private.app_role()) = 'admin' or (target_type = 'student' and target_id in (select app_private.mentee_ids())));

-- staff-only aggregates
do $$
declare t text;
begin
  foreach t in array array['model_runs','segments','risk_trends','cohort_stats'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select app_private.is_staff()))', t || '_staff_read', t);
  end loop;
end $$;

-- the what-if coefficients and the model-performance report hold no personal data: any user WITH a role may read them
-- (students need them for the "try it" panel and the confidence note on their outlook page)
drop policy if exists whatif_model_staff_read on public.whatif_model;
drop policy if exists model_metrics_staff_read on public.model_metrics;
drop policy if exists whatif_model_read on public.whatif_model;
create policy whatif_model_read on public.whatif_model for select to authenticated using ((select app_private.app_role()) is not null);
drop policy if exists model_metrics_read on public.model_metrics;
create policy model_metrics_read on public.model_metrics for select to authenticated using ((select app_private.app_role()) is not null);

-- only status and assignment of a recommendation can change through the API
create or replace function app_private.guard_recommendation_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if (new.id, new.run_id, new.target_type, new.target_id, new.target_label, new.department, new.action, new.reason, new.owner,
        new.owner_id, new.priority, new.priority_score, new.expected_impact, new.due_in_days, new.triggered_by, new.rule_id, new.outcomes)
       is distinct from
       (old.id, old.run_id, old.target_type, old.target_id, old.target_label, old.department, old.action, old.reason, old.owner,
        old.owner_id, old.priority, old.priority_score, old.expected_impact, old.due_in_days, old.triggered_by, old.rule_id, old.outcomes)
    then
      raise exception 'Only the status and the assignment of a recommendation can be changed' using errcode = '42501';
    end if;
    new.updated_at = now();
    new.updated_by = (select auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists recommendations_guard on public.recommendations;
create trigger recommendations_guard before update on public.recommendations
  for each row execute function app_private.guard_recommendation_update();

-- ===================================================================== RPCs (exposed through the API, security definer)
create or replace function public.submit_faculty_evaluation(
  p_subject_code text, p_rating int, p_clarity int, p_punctuality int, p_doubt_solving int, p_engagement int,
  p_title text, p_description text, p_experience_date date, p_reference_code text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  sid text := app_private.app_student_id();
  teacher text;
begin
  if sid is null then
    raise exception 'Only students can submit faculty evaluations' using errcode = '42501';
  end if;
  select b.subject_code, sub.teacher into p_subject_code, teacher
  from public.students s
  join public.branch_subjects b on b.branch_code = s.branch_code and b.semester = s.current_semester
  join public.subjects sub on sub.code = b.subject_code
  where s.id = sid and b.subject_code = p_subject_code;
  if teacher is null then
    raise exception 'That subject is not part of your current semester' using errcode = '22023';
  end if;
  begin
    insert into public.faculty_evaluation_receipts (student_id, subject_code, reference_code, faculty_name)
    values (sid, p_subject_code, p_reference_code, teacher);
  exception when unique_violation then
    raise exception 'You have already evaluated this subject' using errcode = '23505';
  end;
  insert into public.faculty_evaluations (subject_code, faculty_name, rating, clarity, punctuality, doubt_solving, engagement, title, description, experience_date)
  values (p_subject_code, teacher, p_rating, p_clarity, p_punctuality, p_doubt_solving, p_engagement, coalesce(p_title, ''), coalesce(p_description, ''), p_experience_date);
  return p_reference_code;
end $$;

create or replace function public.faculty_evaluation_summary()
returns table (subject_code text, faculty_name text, responses bigint, avg_rating numeric, avg_clarity numeric,
               avg_punctuality numeric, avg_doubt_solving numeric, avg_engagement numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return query
    select e.subject_code, e.faculty_name, count(*), round(avg(e.rating), 2), round(avg(e.clarity), 2),
           round(avg(e.punctuality), 2), round(avg(e.doubt_solving), 2), round(avg(e.engagement), 2)
    from public.faculty_evaluations e
    group by e.subject_code, e.faculty_name
    having count(*) >= 5;   -- small groups are hidden so no single student can be picked out
end $$;

revoke all on function public.submit_faculty_evaluation(text,int,int,int,int,int,text,text,date,text) from public, anon;
revoke all on function public.faculty_evaluation_summary() from public, anon;
grant execute on function public.submit_faculty_evaluation(text,int,int,int,int,int,text,text,date,text) to authenticated;
grant execute on function public.faculty_evaluation_summary() to authenticated;

-- ===================================================================== final lock-down of the private helpers
-- (repeated at the very end so functions created after the first revoke, such as the recommendation guard, are covered)
revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;
