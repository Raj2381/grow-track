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
