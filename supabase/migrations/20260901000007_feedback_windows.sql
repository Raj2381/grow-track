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
