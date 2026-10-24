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
