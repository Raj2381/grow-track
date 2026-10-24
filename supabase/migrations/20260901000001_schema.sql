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
