-- All GrowTrack migrations in order. Paste into the Supabase SQL editor and run once. Safe to run again.

-- ===== 20260901000001_schema.sql =====
-- GrowTrack schema. Synthetic demo data: see data/DATASET.md.
-- Idempotent: safe to run more than once. Nothing here drops or truncates an existing table.
-- Row Level Security is enabled in 20260901000002_security.sql; run both files, in order.

create schema if not exists app_private;
comment on schema app_private is 'Helper functions used by RLS policies. Not exposed through the API.';

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ===================================================================== reference data
create table if not exists public.departments (
  code text primary key check (code in ('CSE','IT','ECE','MECH','CIVIL')),
  name text not null unique,
  branch text not null
);
comment on table public.departments is 'The five branches. code selects the subject catalog.';

create table if not exists public.faculty (
  id text primary key check (id ~ '^FAC-[A-Z]+-[0-9]+$'),
  name text not null,
  branch_code text not null references public.departments(code)
);
create index if not exists faculty_branch_idx on public.faculty(branch_code);

create table if not exists public.semesters (
  semester int primary key check (semester between 1 and 8),
  start_date date not null,
  end_date date not null,
  check (end_date > start_date)
);

create table if not exists public.subjects (
  code text primary key,
  name text not null,
  short_name text not null,
  credits int not null check (credits between 1 and 6),
  semester int not null check (semester between 1 and 8),
  teacher text not null
);

create table if not exists public.branch_subjects (
  branch_code text not null references public.departments(code),
  semester int not null check (semester between 1 and 8),
  position int not null check (position between 0 and 9),
  subject_code text not null references public.subjects(code),
  primary key (branch_code, semester, position)
);
create index if not exists branch_subjects_subject_idx on public.branch_subjects(subject_code);

-- ===================================================================== students and their history (clean data)
create table if not exists public.students (
  id text primary key check (id ~ '^STU-[0-9]{4}$'),
  name text not null,
  roll_no text not null unique,
  email text not null,
  branch_code text not null references public.departments(code),
  section text not null,
  mentor_id text not null references public.faculty(id),
  gender text not null check (gender in ('Female','Male','Other')),
  residence text not null check (residence in ('Hostel','Day scholar')),
  scholarship boolean not null,
  entry_band text not null check (entry_band in ('Top 10%','Top 25%','Top 50%','Bottom 50%')),
  income_band text not null check (income_band in ('Low','Lower-middle','Middle','High')),
  batch int not null,
  current_semester int not null check (current_semester between 1 and 8)
);
create index if not exists students_branch_idx on public.students(branch_code, section);
create index if not exists students_mentor_idx on public.students(mentor_id);

create table if not exists public.semester_results (
  student_id text not null references public.students(id) on delete cascade,
  subject_code text not null references public.subjects(code),
  semester int not null check (semester between 1 and 8),
  internal int not null check (internal between 0 and 40),
  external int not null check (external between 0 and 60),
  total int not null check (total between 0 and 100),
  grade text not null,
  grade_point int not null check (grade_point between 0 and 10),
  passed boolean not null,
  credits_obtained int not null check (credits_obtained >= 0),
  first_attempt_total int not null check (first_attempt_total between 0 and 100),
  first_attempt_passed boolean not null,
  primary key (student_id, subject_code)
);
comment on table public.semester_results is 'Final marks after supplementary exams; first_attempt_* is the original sitting.';
create index if not exists semester_results_student_sem_idx on public.semester_results(student_id, semester);
create index if not exists semester_results_subject_idx on public.semester_results(subject_code);

create table if not exists public.backlogs (
  student_id text not null references public.students(id) on delete cascade,
  subject_code text not null references public.subjects(code),
  semester int not null check (semester between 1 and 8),
  attempt int not null check (attempt >= 1),
  attempt_date date not null,
  marks int not null check (marks between 0 and 100),
  result text not null check (result in ('Fail','Pass')),
  primary key (student_id, subject_code, attempt)
);
create index if not exists backlogs_student_sem_idx on public.backlogs(student_id, semester);
create index if not exists backlogs_subject_idx on public.backlogs(subject_code);

create table if not exists public.attendance_monthly (
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  subject_code text not null references public.subjects(code),
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  lectures_held int not null check (lectures_held >= 0),
  lectures_attended int not null check (lectures_attended >= 0),
  check (lectures_attended <= lectures_held),
  primary key (student_id, semester, subject_code, month)
);
create index if not exists attendance_monthly_subject_idx on public.attendance_monthly(subject_code);

create table if not exists public.lecture_presence (
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  subject_code text not null references public.subjects(code),
  presence text not null check (presence ~ '^[01]*$'),
  primary key (student_id, semester, subject_code)
);
comment on table public.lecture_presence is '1 = present, one character per lecture date; dates come from lib/dataset/schedule.ts.';
create index if not exists lecture_presence_subject_idx on public.lecture_presence(subject_code);

create table if not exists public.lms_monthly (
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  logins int not null check (logins >= 0),
  hours_online numeric(6,1) not null check (hours_online >= 0),
  assignments_due int not null check (assignments_due >= 0),
  assignments_submitted int not null check (assignments_submitted >= 0),
  assignments_late int not null check (assignments_late >= 0),
  avg_quiz_score int not null check (avg_quiz_score between 0 and 100),
  quizzes_taken int not null check (quizzes_taken >= 0),
  primary key (student_id, semester, month)
);

create table if not exists public.assignments (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  subject_code text not null references public.subjects(code),
  assigned_date date not null,
  due_date date not null,
  submitted boolean not null,
  submitted_date date,
  late boolean not null,
  score int check (score between 0 and 100)
);
create index if not exists assignments_student_sem_idx on public.assignments(student_id, semester);
create index if not exists assignments_subject_idx on public.assignments(subject_code);

create table if not exists public.aptitude_attempts (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  attempt_date date not null,
  pattern text not null,
  quantitative int not null check (quantitative between 0 and 10),
  logical_reasoning int not null check (logical_reasoning between 0 and 10),
  verbal int not null check (verbal between 0 and 10),
  total_percent int not null check (total_percent between 0 and 100),
  time_taken_sec int not null check (time_taken_sec >= 0),
  source text not null default 'historical' check (source in ('historical','portal'))
);
create index if not exists aptitude_student_sem_idx on public.aptitude_attempts(student_id, semester);

create table if not exists public.coding_attempts (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  attempt_date date not null,
  language text not null check (language in ('Java','Python','C','SQL')),
  difficulty text not null,
  score_percent int not null check (score_percent between 0 and 100),
  questions int not null check (questions >= 0),
  correct int not null check (correct >= 0),
  wrong int not null check (wrong >= 0),
  skipped int not null check (skipped >= 0),
  time_taken_sec int not null check (time_taken_sec >= 0),
  topic_scores jsonb not null default '{}'::jsonb,
  source text not null default 'historical' check (source in ('historical','portal'))
);
create index if not exists coding_student_sem_idx on public.coding_attempts(student_id, semester);

create table if not exists public.interview_attempts (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  attempt_date date not null,
  type text not null,
  difficulty text not null,
  score int not null check (score between 0 and 100),
  communication int not null check (communication between 0 and 100),
  technical int not null check (technical between 0 and 100),
  confidence int not null check (confidence between 0 and 100),
  feedback text not null default '',
  source text not null default 'historical' check (source in ('historical','portal'))
);
create index if not exists interview_student_sem_idx on public.interview_attempts(student_id, semester);

create table if not exists public.activities (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  activity_date date not null,
  type text not null check (type in ('event','club','hackathon','certification')),
  title text not null,
  organizer text not null,
  category text not null,
  role text not null,
  proof text not null default '',
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  kind text,
  achievement text,
  description text,
  link text,
  source text not null default 'historical' check (source in ('historical','portal')),
  created_at timestamptz not null default now()
);
create index if not exists activities_student_sem_idx on public.activities(student_id, semester);
create index if not exists activities_status_idx on public.activities(status);

create table if not exists public.skill_assessments (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  kind text not null check (kind in ('technical','soft')),
  skill text not null,
  score int not null check (score between 0 and 100),
  assessed_on date not null,
  source text not null default 'historical' check (source in ('historical','portal'))
);
create index if not exists skills_student_sem_idx on public.skill_assessments(student_id, semester);

create table if not exists public.faculty_remarks (
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  subject_code text not null references public.subjects(code),
  teacher text not null,
  remark_date date not null,
  participation int not null check (participation between 1 and 5),
  discipline int not null check (discipline between 1 and 5),
  attitude int not null check (attitude between 1 and 5),
  comment text not null default '',
  primary key (student_id, semester, subject_code)
);
create index if not exists remarks_subject_idx on public.faculty_remarks(subject_code);

-- ===================================================================== interventions (history + created in the app)
create table if not exists public.interventions (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  semester int check (semester between 1 and 8),
  reason text not null,
  action_plan text not null,
  priority text not null check (priority in ('High','Medium','Low')),
  status text not null check (status in ('Planned','In Progress','Completed')),
  follow_up_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'app' check (source in ('historical','app')),
  created_by uuid
);
create index if not exists interventions_student_idx on public.interventions(student_id, created_at desc);
create index if not exists interventions_status_idx on public.interventions(status);
drop trigger if exists interventions_updated_at on public.interventions;
create trigger interventions_updated_at before update on public.interventions for each row execute function public.set_updated_at();

-- ===================================================================== app state that used to live in localStorage
create table if not exists public.attendance_sessions (
  id text primary key,
  title text not null,
  subject text not null,
  department text not null,
  year text not null,
  section text,
  session_date date not null,
  start_time text not null,
  end_time text not null,
  submitted boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists attendance_sessions_created_by_idx on public.attendance_sessions(created_by);
create index if not exists attendance_sessions_date_idx on public.attendance_sessions(session_date desc);
drop trigger if exists attendance_sessions_updated_at on public.attendance_sessions;
create trigger attendance_sessions_updated_at before update on public.attendance_sessions for each row execute function public.set_updated_at();

create table if not exists public.attendance_records (
  session_id text not null references public.attendance_sessions(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  status text not null default 'absent' check (status in ('present','absent','late')),
  primary key (session_id, student_id)
);
create index if not exists attendance_records_student_idx on public.attendance_records(student_id);

create table if not exists public.declared_results (
  student_id text not null references public.students(id) on delete cascade,
  semester int not null check (semester between 1 and 8),
  declared_at timestamptz not null default now(),
  declared_by uuid,
  primary key (student_id, semester)
);
create table if not exists public.declared_result_subjects (
  student_id text not null,
  semester int not null,
  subject_name text not null check (length(trim(subject_name)) > 0),
  score int not null check (score between 0 and 100),
  primary key (student_id, semester, subject_name),
  foreign key (student_id, semester) references public.declared_results(student_id, semester) on delete cascade
);

create table if not exists public.academic_updates (
  student_id text primary key references public.students(id) on delete cascade,
  current_score int not null check (current_score between 0 and 100),
  previous_score int not null check (previous_score between 0 and 100),
  feedback text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.mock_interview_results (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  role text not null,
  average_score int not null check (average_score between 0 and 100),
  completed_at timestamptz not null default now()
);
create index if not exists mock_interview_student_idx on public.mock_interview_results(student_id, completed_at desc);

create table if not exists public.lms_logins (
  student_id text not null references public.students(id) on delete cascade,
  logged_at timestamptz not null default now(),
  primary key (student_id, logged_at)
);
create table if not exists public.lms_completed_assignments (
  student_id text not null references public.students(id) on delete cascade,
  assignment_id text not null,
  completed_at timestamptz not null default now(),
  primary key (student_id, assignment_id)
);
create table if not exists public.lms_solved_challenges (
  student_id text not null references public.students(id) on delete cascade,
  challenge_id text not null,
  solved_at timestamptz not null default now(),
  primary key (student_id, challenge_id)
);

create table if not exists public.admin_settings (
  user_id uuid primary key,
  name text not null default 'Administrator',
  email text not null default '',
  role text not null default 'Administrator',
  theme text not null default 'light' check (theme in ('light','dark','system')),
  email_notifications boolean not null default true,
  intervention_reminders boolean not null default true,
  minimum_attendance int not null default 75 check (minimum_attendance between 0 and 100),
  minimum_academic_score int not null default 60 check (minimum_academic_score between 0 and 100),
  updated_at timestamptz not null default now()
);
drop trigger if exists admin_settings_updated_at on public.admin_settings;
create trigger admin_settings_updated_at before update on public.admin_settings for each row execute function public.set_updated_at();

create table if not exists public.feedback_entries (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  reference_code text not null unique,
  category text not null,
  feedback_type text not null,
  title text not null,
  description text not null,
  experience_date date not null,
  is_anonymous boolean not null default false,
  rating int not null check (rating between 1 and 5),
  status text not null default 'Submitted' check (status in ('Submitted','Under Review','Resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.feedback_entries is 'General feedback. Faculty evaluations are NOT stored here: see faculty_evaluations.';
create index if not exists feedback_student_idx on public.feedback_entries(student_id, created_at desc);
drop trigger if exists feedback_updated_at on public.feedback_entries;
create trigger feedback_updated_at before update on public.feedback_entries for each row execute function public.set_updated_at();

-- Anonymous faculty evaluations: the evaluation carries NO student id. A separate receipt (student, subject, reference
-- code, no ratings) enforces one evaluation per subject and lets the student see what is still pending. The two rows are
-- written in one transaction by submit_faculty_evaluation() and cannot be joined: ids are random and the evaluation
-- stores a date, not a timestamp.
create table if not exists public.faculty_evaluation_receipts (
  student_id text not null references public.students(id) on delete cascade,
  subject_code text not null references public.subjects(code),
  reference_code text not null,
  faculty_name text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_code)
);
create table if not exists public.faculty_evaluations (
  id uuid primary key default gen_random_uuid(),
  subject_code text not null references public.subjects(code),
  faculty_name text not null,
  rating int not null check (rating between 1 and 5),
  clarity int check (clarity between 1 and 5),
  punctuality int check (punctuality between 1 and 5),
  doubt_solving int check (doubt_solving between 1 and 5),
  engagement int check (engagement between 1 and 5),
  title text not null default '',
  description text not null default '',
  experience_date date,
  evaluated_on date not null default current_date
);
create index if not exists faculty_evaluations_subject_idx on public.faculty_evaluations(subject_code);

create table if not exists public.surveys (
  student_id text primary key references public.students(id) on delete cascade,
  survey_date date not null,
  ratings jsonb not null default '{}'::jsonb,
  comments jsonb not null default '{}'::jsonb
);
create table if not exists public.portal_intro (
  student_id text primary key references public.students(id) on delete cascade,
  intro_date date not null,
  score int not null check (score between 0 and 100),
  feedback text not null default ''
);

-- ===================================================================== machine-learning outputs
create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  data_sha256 text not null,
  seed int,
  python_version text,
  sklearn_version text,
  notes text,
  is_current boolean not null default false
);
create unique index if not exists model_runs_one_current_idx on public.model_runs(is_current) where is_current;

create table if not exists public.predictions (
  student_id text primary key references public.students(id) on delete cascade,
  run_id uuid not null references public.model_runs(id),
  overall text not null check (overall in ('Low','Medium','High')),
  reason text not null default '',
  mentor_id text,
  sgpa_p numeric(5,3) not null check (sgpa_p between 0 and 1),
  sgpa_level text not null check (sgpa_level in ('Low','Medium','High')),
  pred_sgpa numeric(4,2) not null,
  sgpa_lo numeric(4,2) not null,
  sgpa_hi numeric(4,2) not null,
  sgpa_band text not null,
  backlog_p numeric(5,3) not null check (backlog_p between 0 and 1),
  backlog_level text not null check (backlog_level in ('Low','Medium','High')),
  notready_p numeric(5,3) not null check (notready_p between 0 and 1),
  ready_p numeric(5,3) not null check (ready_p between 0 and 1),
  placement_level text not null check (placement_level in ('Low','Medium','High')),
  engagement_p numeric(5,3) not null check (engagement_p between 0 and 1),
  engagement_level text not null check (engagement_level in ('Low','Medium','High')),
  drivers jsonb not null,
  facts jsonb not null
);
comment on column public.predictions.notready_p is 'Probability of the at-risk class for placement: NOT ready. ready_p = 1 - notready_p.';
create index if not exists predictions_overall_idx on public.predictions(overall);
create index if not exists predictions_mentor_idx on public.predictions(mentor_id);
create index if not exists predictions_run_idx on public.predictions(run_id);

create table if not exists public.recommendations (
  id text primary key,
  run_id uuid not null references public.model_runs(id),
  target_type text not null check (target_type in ('student','segment')),
  target_id text not null,
  target_label text not null,
  department text,
  action text not null,
  reason text not null,
  owner text not null check (owner in ('Faculty mentor','Training & Placement cell','Counsellor','Dean / Administrator','Department head')),
  owner_id text,
  priority text not null check (priority in ('Critical','High','Medium','Low')),
  priority_score numeric(5,3) not null check (priority_score between 0 and 1),
  expected_impact text not null,
  due_in_days int not null,
  triggered_by text[] not null default '{}',
  rule_id text not null,
  outcomes text[] not null default '{}',
  status text not null default 'open' check (status in ('open','accepted','done','dismissed')),
  assigned_to text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists recommendations_target_idx on public.recommendations(target_type, target_id);
create index if not exists recommendations_priority_idx on public.recommendations(priority, priority_score desc);
create index if not exists recommendations_status_idx on public.recommendations(status);
create index if not exists recommendations_run_idx on public.recommendations(run_id);

create table if not exists public.segments (
  id text primary key,
  run_id uuid not null references public.model_runs(id),
  label text not null,
  definition text not null,
  member_count int not null,
  share_of_students numeric(6,4) not null,
  by_department jsonb not null,
  department_lift jsonb not null,
  mean_risk jsonb not null,
  mean_cgpa numeric(4,2),
  mean_attendance numeric(5,1),
  overall_high_share numeric(5,3)
);
create table if not exists public.segment_members (
  segment_id text not null references public.segments(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  primary key (segment_id, student_id)
);
create index if not exists segment_members_student_idx on public.segment_members(student_id);

create table if not exists public.risk_trends (run_id uuid primary key references public.model_runs(id) on delete cascade, data jsonb not null);
create table if not exists public.model_metrics (run_id uuid primary key references public.model_runs(id) on delete cascade, data jsonb not null);
create table if not exists public.whatif_model (run_id uuid primary key references public.model_runs(id) on delete cascade, data jsonb not null);
create table if not exists public.cohort_stats (run_id uuid primary key references public.model_runs(id) on delete cascade, data jsonb not null);
create table if not exists public.whatif_inputs (
  student_id text primary key references public.students(id) on delete cascade,
  run_id uuid not null references public.model_runs(id),
  data jsonb not null
);
create index if not exists whatif_inputs_run_idx on public.whatif_inputs(run_id);

-- ===================================================================== identity
create table if not exists public.profiles (
  id uuid primary key,
  role text not null check (role in ('admin','faculty','student')),
  student_id text unique references public.students(id) on delete cascade,
  faculty_id text unique references public.faculty(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  check ((role = 'student') = (student_id is not null)),
  check ((role = 'faculty') = (faculty_id is not null))
);
comment on table public.profiles is 'One row per login. Authorization reads THIS table, never user_metadata (users can edit it).';


-- ===== 20260901000002_security.sql =====
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


-- ===== 20260901000003_attendance_and_realtime.sql =====
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


-- ===== 20260901000004_forecast_views.sql =====
-- Read models for the forecast screens. Both are SECURITY INVOKER, so Row Level Security of the caller applies:
-- a faculty member sees only their mentees' rows and a student only their own, in the list and in every total.

create or replace view public.predictions_directory with (security_invoker = true) as
select
  p.student_id, s.name, s.roll_no, s.branch_code, d.name as department, s.section, s.mentor_id,
  p.overall, p.reason,
  p.sgpa_p, p.sgpa_level, p.pred_sgpa, p.sgpa_lo, p.sgpa_hi, p.sgpa_band,
  p.backlog_p, p.backlog_level,
  p.notready_p, p.ready_p, p.placement_level,
  p.engagement_p, p.engagement_level,
  case p.overall when 'High' then 3 when 'Medium' then 2 else 1 end as overall_rank,
  -- the same severity weights the recommendation engine uses: backlog 1.0, SGPA 0.9, placement 0.7, engagement 0.6
  round(greatest(p.backlog_p * 1.0, p.sgpa_p * 0.9, p.notready_p * 0.7, p.engagement_p * 0.6), 3) as risk_score
from public.predictions p
join public.students s on s.id = p.student_id
join public.departments d on d.code = s.branch_code;
comment on view public.predictions_directory is 'One flat row per visible student: forecast levels and probabilities with name, department, section and mentor, for filtering, searching and sorting.';

revoke all on public.predictions_directory from anon;
grant select on public.predictions_directory to authenticated;

create or replace function public.prediction_summary(p_branch text default null, p_section text default null, p_mentor text default null)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with f as (
    select * from public.predictions_directory
    where (p_branch is null or branch_code = p_branch)
      and (p_section is null or section = p_section)
      and (p_mentor is null or mentor_id = p_mentor)
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'overall', jsonb_build_object(
      'Low', (select count(*) from f where overall = 'Low'),
      'Medium', (select count(*) from f where overall = 'Medium'),
      'High', (select count(*) from f where overall = 'High')),
    'outcomes', jsonb_build_object(
      'sgpa_below_6', jsonb_build_object('Low', (select count(*) from f where sgpa_level = 'Low'), 'Medium', (select count(*) from f where sgpa_level = 'Medium'), 'High', (select count(*) from f where sgpa_level = 'High'), 'mean_p', (select round(avg(sgpa_p), 4) from f), 'mean_sgpa', (select round(avg(pred_sgpa), 2) from f)),
      'backlog', jsonb_build_object('Low', (select count(*) from f where backlog_level = 'Low'), 'Medium', (select count(*) from f where backlog_level = 'Medium'), 'High', (select count(*) from f where backlog_level = 'High'), 'mean_p', (select round(avg(backlog_p), 4) from f)),
      'placement', jsonb_build_object('Low', (select count(*) from f where placement_level = 'Low'), 'Medium', (select count(*) from f where placement_level = 'Medium'), 'High', (select count(*) from f where placement_level = 'High'), 'mean_p', (select round(avg(notready_p), 4) from f), 'mean_ready', (select round(avg(ready_p), 4) from f)),
      'engagement', jsonb_build_object('Low', (select count(*) from f where engagement_level = 'Low'), 'Medium', (select count(*) from f where engagement_level = 'Medium'), 'High', (select count(*) from f where engagement_level = 'High'), 'mean_p', (select round(avg(engagement_p), 4) from f))),
    'by_department', coalesce((
      select jsonb_agg(jsonb_build_object(
        'branch_code', branch_code, 'department', department, 'total', total, 'High', high, 'Medium', medium, 'Low', low,
        'sgpa_high', sgpa_high, 'backlog_high', backlog_high, 'placement_high', placement_high, 'engagement_high', engagement_high,
        'mean_sgpa', mean_sgpa, 'mean_backlog_p', mean_backlog_p) order by branch_code)
      from (
        select branch_code, department, count(*) total,
          count(*) filter (where overall = 'High') high, count(*) filter (where overall = 'Medium') medium, count(*) filter (where overall = 'Low') low,
          count(*) filter (where sgpa_level = 'High') sgpa_high, count(*) filter (where backlog_level = 'High') backlog_high,
          count(*) filter (where placement_level = 'High') placement_high, count(*) filter (where engagement_level = 'High') engagement_high,
          round(avg(pred_sgpa), 2) mean_sgpa, round(avg(backlog_p), 4) mean_backlog_p
        from f group by branch_code, department) g), '[]'::jsonb)
  )
$$;

create or replace function public.recommendation_summary(p_department text default null)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with r as (
    select * from public.recommendations where (p_department is null or department = p_department)
  )
  select jsonb_build_object(
    'total', (select count(*) from r),
    'by_owner', coalesce((select jsonb_object_agg(owner, n) from (select owner, count(*) n from r group by owner) x), '{}'::jsonb),
    'by_priority', coalesce((select jsonb_object_agg(priority, n) from (select priority, count(*) n from r group by priority) x), '{}'::jsonb),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from r group by status) x), '{}'::jsonb),
    'by_target_type', coalesce((select jsonb_object_agg(target_type, n) from (select target_type, count(*) n from r group by target_type) x), '{}'::jsonb),
    'open_critical_or_high', (select count(*) from r where status = 'open' and priority in ('Critical', 'High'))
  )
$$;

revoke all on function public.prediction_summary(text, text, text) from public, anon;
revoke all on function public.recommendation_summary(text) from public, anon;
grant execute on function public.prediction_summary(text, text, text) to authenticated;
grant execute on function public.recommendation_summary(text) to authenticated;


-- ===== 20260901000005_add_student.sql =====
-- Adding students from the app, and letting an administrator manage the student directory.
-- A student added here (or directly in the Supabase table editor) shows up in the app's student list straight away.

drop policy if exists students_admin_write on public.students;
create policy students_admin_write on public.students for all to authenticated
  using ((select app_private.app_role()) = 'admin')
  with check ((select app_private.app_role()) = 'admin');

-- Next free id and roll number, a mentor from the same department (the one with the fewest mentees), sensible defaults.
create or replace function public.add_student(
  p_name text, p_branch text, p_section text, p_semester int default 5,
  p_email text default null, p_gender text default 'Other', p_residence text default 'Day scholar')
returns public.students
language plpgsql security definer set search_path = public, app_private as $$
declare
  n int; new_id text; roll text; mentor text; row public.students;
begin
  if (select app_private.app_role()) is distinct from 'admin' then
    raise exception 'Only an administrator can add students' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.departments where code = p_branch) then raise exception 'Unknown department' using errcode = '22023'; end if;
  if coalesce(trim(p_section), '') = '' then raise exception 'Section is required' using errcode = '22023'; end if;

  select coalesce(max(substring(id from 5)::int), 0) + 1 into n from public.students;
  if n > 9999 then raise exception 'No free student ids left' using errcode = '54000'; end if;
  new_id := 'STU-' || lpad(n::text, 4, '0');
  roll := p_branch || '-' || (extract(year from now())::int) || '-' || lpad(n::text, 4, '0');

  select f.id into mentor from public.faculty f
  left join public.students s on s.mentor_id = f.id
  where f.branch_code = p_branch group by f.id order by count(s.id), f.id limit 1;
  if mentor is null then raise exception 'No mentor exists for this department' using errcode = '22023'; end if;

  insert into public.students (id, name, roll_no, email, branch_code, section, mentor_id, gender, residence, scholarship, entry_band, income_band, batch, current_semester)
  values (new_id, trim(p_name), roll, coalesce(nullif(trim(p_email), ''), lower(new_id) || '@example.com'), p_branch, upper(trim(p_section)), mentor,
          case when p_gender in ('Female','Male','Other') then p_gender else 'Other' end,
          case when p_residence in ('Hostel','Day scholar') then p_residence else 'Day scholar' end,
          false, 'Top 50%', 'Middle', extract(year from now())::int - ((greatest(least(p_semester, 8), 1) + 1) / 2) + 1, greatest(least(p_semester, 8), 1))
  returning * into row;
  return row;
end $$;

revoke all on function public.add_student(text, text, text, int, text, text, text) from public, anon;
grant execute on function public.add_student(text, text, text, int, text, text, text) to authenticated;


-- ===== 20260901000006_hod_tpo_roles.sql =====
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


-- ===== 20260901000007_feedback_windows.sql =====
-- Student feedback is locked until the Head of Department opens it for their department.
-- One row per department: is_open, an optional message to students and an optional closing time.
-- The HOD (or an administrator) writes it; students read the row of their own department; nobody else can.

create table if not exists public.feedback_windows (
  branch_code text primary key references public.departments(code),
  is_open boolean not null default false,
  message text not null default '' check (length(message) <= 300),
  closes_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table public.feedback_windows is 'Whether student feedback is open for a department. Effective state = is_open and (closes_at is null or closes_at > now()).';

-- the department of whoever is asking: a student's own, or the department of a faculty member / HOD
create or replace function app_private.my_branch() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.branch_code from public.students s where s.id = (select p.student_id from public.profiles p where p.id = (select auth.uid()))),
    (select f.branch_code from public.faculty f where f.id = (select p.faculty_id from public.profiles p where p.id = (select auth.uid()))))
$$;
revoke all on function app_private.my_branch() from public, anon;
grant execute on function app_private.my_branch() to authenticated;

alter table public.feedback_windows enable row level security;
revoke all on public.feedback_windows from anon;
grant select, insert, update, delete on public.feedback_windows to authenticated;

drop policy if exists feedback_windows_read on public.feedback_windows;
create policy feedback_windows_read on public.feedback_windows for select to authenticated using (
  (select app_private.app_role()) = 'admin' or branch_code = (select app_private.my_branch()));

drop policy if exists feedback_windows_hod_write on public.feedback_windows;
create policy feedback_windows_hod_write on public.feedback_windows for all to authenticated
  using ((select app_private.app_role()) = 'admin' or ((select app_private.app_role()) = 'hod' and branch_code = (select app_private.my_branch())))
  with check ((select app_private.app_role()) = 'admin' or ((select app_private.app_role()) = 'hod' and branch_code = (select app_private.my_branch())));

-- who changed it and when is recorded by the database, not trusted from the client
create or replace function app_private.stamp_feedback_window() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists feedback_windows_stamp on public.feedback_windows;
create trigger feedback_windows_stamp before insert or update on public.feedback_windows
  for each row execute function app_private.stamp_feedback_window();

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;


-- ===== 20260901000008_student_summary.sql =====
-- One agreed source for the figures the student portal and every staff dashboard both show: CGPA (credit-weighted over every
-- semester result) and attendance (all lectures of the student's current semester). Both are computed from the stored records,
-- so they match what the student sees on their own dashboard. Security invoker: each role sees only the rows it may read.
create or replace view public.student_summary with (security_invoker = true) as
select
  s.id as student_id,
  coalesce((
    select round(sum(r.grade_point::numeric * sub.credits) / nullif(sum(sub.credits), 0), 2)
    from public.semester_results r join public.subjects sub on sub.code = r.subject_code
    where r.student_id = s.id), 0) as cgpa,
  coalesce((
    select round(100.0 * sum(a.lectures_attended) / nullif(sum(a.lectures_held), 0), 1)
    from public.attendance_monthly a
    where a.student_id = s.id and a.semester = s.current_semester), 0) as attendance_pct
from public.students s;
grant select on public.student_summary to authenticated;
revoke all on public.student_summary from anon;
