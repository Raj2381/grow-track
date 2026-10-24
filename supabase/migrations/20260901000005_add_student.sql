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
