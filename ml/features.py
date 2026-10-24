"""Build the feature table: one row per (student_id, as_of_semester) for N = 2, 3, 4, 5.

Leakage control, in order:
  1. every table is cut to what was known at the end of semester N (common.known_at),
  2. THEN cleaned. Imputation statistics (a student's own median) are therefore computed from the past only,
  3. THEN aggregated into features.
Targets are joined last, in separate `y_` columns.

Run:  python3 ml/features.py
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    ALL_CUTOFFS, OUT_DIR, SEM_END, SEM_MONTHS, load_tables, known_at, write_json,
)

POINTS = {"hackathon": 15, "certification": 10, "club": 10, "event": 5}
WEIGHTS = {"academic": 0.25, "attendance": 0.20, "lms": 0.15, "placement": 0.15, "skills": 0.10, "engagement": 0.10, "faculty": 0.05}

# feature -> (group, definition). Drives ml/FEATURES.md, the driver text and permutation-importance grouping.
FEATURE_DOCS: Dict[str, Tuple[str, str]] = {
    "as_of_semester": ("Context", "Cut-off semester N. Students attempt more placement tests as semesters pass, so N matters."),
    "cgpa_at_n": ("Academics", "Credit-weighted CGPA over semesters 1..N, first-attempt marks."),
    "sgpa_last": ("Academics", "SGPA of semester N (first attempt)."),
    "sgpa_slope": ("Academics", "OLS slope of SGPA over semesters 1..N (points per semester)."),
    "sgpa_drop_last": ("Academics", "SGPA of semester N minus SGPA of semester N-1."),
    "internal_avg_last": ("Academics", "Mean internal marks (out of 40) in semester N."),
    "external_avg_last": ("Academics", "Mean external marks (out of 60) in semester N."),
    "subjects_failed_last": ("Academics", "Subjects failed (first attempt) in semester N."),
    "subjects_failed_total": ("Academics", "Subjects failed (first attempt) over semesters 1..N."),
    "active_backlogs_at_n": ("Academics", "Failed subjects whose latest attempt dated on or before the end of N is still a fail."),
    "backlog_attempts_total": ("Academics", "Supplementary attempts (attempt >= 2) taken on or before the end of N."),
    "has_active_backlog_at_asof": ("Academics", "1 if active_backlogs_at_n > 0. Matches outcomes.csv (checked)."),
    "att_last_sem": ("Attendance", "Attendance % over all subjects in semester N."),
    "att_change_vs_prev": ("Attendance", "Attendance % of semester N minus that of N-1 (percentage points)."),
    "att_last_two_months": ("Attendance", "Attendance % over the last two months of semester N."),
    "att_within_sem_trend": ("Attendance", "Attendance % of the last two months of N minus the semester-N average (negative = fading before the break)."),
    "att_lowest_subject": ("Attendance", "Lowest single-subject attendance % in semester N."),
    "att_slope_over_sems": ("Attendance", "OLS slope of semester attendance % over 1..N (points per semester)."),
    "att_months_below_75": ("Attendance", "Months (semesters 1..N) in which attendance fell below 75%."),
    "logins_per_month_last": ("LMS", "Mean LMS logins per month in semester N."),
    "logins_change_vs_prev": ("LMS", "Relative change in monthly logins versus semester N-1."),
    "logins_recent": ("LMS", "Mean logins per month over the last two months of semester N."),
    "logins_within_sem_trend": ("LMS", "Recent logins minus the semester-N average."),
    "engagement_index_recent": ("LMS", "0-100 composite of attendance, logins and assignment submission over the last two months of N (the same recipe the engagement-drop label uses for its 'before' window)."),
    "lms_hours_per_month": ("LMS", "Mean hours online per month in semester N."),
    "quiz_avg_last": ("LMS", "Mean monthly quiz average in semester N."),
    "submit_pct": ("LMS", "% of semester-N assignments submitted by the end of N."),
    "on_time_submit_pct": ("LMS", "% of semester-N assignments submitted on time by the end of N."),
    "late_pct": ("LMS", "% of submitted semester-N assignments that were late."),
    "approved_points_total": ("Engagement", "Approved activity points (hackathon 15, certification 10, club 10, event 5), semesters 1..N."),
    "approved_points_last_sem": ("Engagement", "Approved activity points earned in semester N."),
    "activities_total": ("Engagement", "Activities logged in semesters 1..N, any status."),
    "activities_pending": ("Engagement", "Activities still awaiting verification."),
    "activities_rejected": ("Engagement", "Activities rejected by faculty."),
    "aptitude_latest": ("Placement", "Total % of the most recent aptitude test (0 if none)."),
    "aptitude_best": ("Placement", "Best aptitude total % so far (0 if none)."),
    "aptitude_attempts": ("Placement", "Aptitude tests taken so far."),
    "coding_best": ("Placement", "Best coding score among attempts with >= 5 questions (0 if none)."),
    "coding_attempts": ("Placement", "Coding tests taken so far."),
    "interview_best": ("Placement", "Best mock-interview score so far (0 if none)."),
    "interview_attempts": ("Placement", "Mock interviews taken so far."),
    "tech_skill_avg_latest": ("Placement", "Mean of the 7 technical skill scores at the latest assessment."),
    "soft_comm_latest": ("Placement", "Communication skill score at the latest assessment."),
    "skill_growth": ("Placement", "Latest minus earliest average of technical and soft skills."),
    "has_aptitude": ("Placement", "1 if at least one aptitude test was taken."),
    "has_coding": ("Placement", "1 if at least one coding test with >= 5 questions was taken."),
    "has_interview": ("Placement", "1 if at least one mock interview was taken."),
    "faculty_rating_last": ("Faculty", "Mean faculty remark rating (1-5) in semester N."),
    "faculty_rating_change": ("Faculty", "Faculty rating of N minus that of N-1."),
    "interventions_before_n": ("Interventions", "Support interventions created on or before the end of N."),
    "last_intervention_priority": ("Interventions", "Priority of the most recent intervention (NoIntervention if there was none; not the string None, which pandas reads as missing). Status is deliberately not used: the CSV stores only the final status, which would reveal later information."),
    "department": ("Background", "Department."),
    "section": ("Background", "Class section."),
    "scholarship": ("Background", "1 if the student holds a scholarship."),
    "residence": ("Background", "Hostel or day scholar."),
    "income_band": ("Background", "Family income band (Unknown when missing)."),
    "entry_band": ("Background", "Admission rank band (Unknown when missing)."),
    "gender": ("Background", "Kept in the table for fairness audits only. NEVER a model input."),
    "success_score_proxy": ("Round 1", "Round 1 Success Score rebuilt from data known at N (same weights as the portal's WEIGHTS)."),
    "round1_risk_flag": ("Round 1", "Round 1 academic risk flag: CGPA<6 or backlogs>=2 or attendance<65 = High; CGPA<7 or backlogs==1 or attendance<75 = Medium."),
}
CATEGORICAL = ["department", "section", "residence", "income_band", "entry_band", "last_intervention_priority", "round1_risk_flag"]
EXCLUDED_FROM_MODEL = ["gender"]
ROUND1_FEATURES = ["success_score_proxy", "round1_risk_flag"]
TARGET_COLUMNS = [
    "next_sgpa", "next_sgpa_band", "next_sgpa_below_6", "new_backlog_next_sem", "failed_to_clear_existing_backlog",
    "backlog_risk_any", "placement_ready_before_season", "engagement_drop_next_weeks",
]


# --------------------------------------------------------------------------- filtering
def filter_tables(raw: Dict[str, pd.DataFrame], n: int) -> Dict[str, pd.DataFrame]:
    """Cut every feature table to what was known at the end of semester n. `outcomes` is never passed on."""
    return {
        "students": raw["students"].drop(columns=["archetype_diagnostic"]).copy(),
        "semester_results": known_at(raw["semester_results"], n, sem_col="semester"),
        "backlogs": known_at(raw["backlogs"], n, date_col="attempt_date"),
        "attendance_monthly": known_at(raw["attendance_monthly"], n, sem_col="semester"),
        "lms_monthly": known_at(raw["lms_monthly"], n, sem_col="semester"),
        "assignments": known_at(raw["assignments"], n, sem_col="semester", date_col="due_date"),
        "aptitude_attempts": known_at(raw["aptitude_attempts"], n, date_col="date"),
        "coding_attempts": known_at(raw["coding_attempts"], n, date_col="date"),
        "interview_attempts": known_at(raw["interview_attempts"], n, date_col="date"),
        "activities": known_at(raw["activities"], n, sem_col="semester", date_col="date"),
        "skill_assessments": known_at(raw["skill_assessments"], n, sem_col="semester", date_col="date"),
        "faculty_remarks": known_at(raw["faculty_remarks"], n, sem_col="semester", date_col="date"),
        "interventions": known_at(raw["interventions"], n, sem_col="semester", date_col="created_at"),
    }


# --------------------------------------------------------------------------- cleaning
def _median_fill(df: pd.DataFrame, col: str, by: List[str]) -> int:
    """Fill NaN in df[col] with the group's own median, then the global median. Returns cells changed."""
    missing = df[col].isna()
    count = int(missing.sum())
    if count:
        group_median = df.groupby(by)[col].transform("median")
        df[col] = df[col].fillna(group_median).fillna(df[col].median())
    return count


def clean(t: Dict[str, pd.DataFrame]) -> Tuple[Dict[str, pd.DataFrame], Dict[str, int]]:
    """Apply the cleaning rules of data/DATASET.md section 6 to tables that already contain only past records."""
    t = {k: v.copy() for k, v in t.items()}
    log: Dict[str, int] = {}

    s = t["students"]
    for col in ("income_band", "entry_band"):
        log["students.%s missing -> 'Unknown'" % col] = int(s[col].isna().sum())
        s[col] = s[col].fillna("Unknown")

    r = t["semester_results"]
    miss = r["internal"].isna()
    log["semester_results.internal missing -> total - external"] = int(miss.sum())
    r.loc[miss, "internal"] = (r.loc[miss, "total"] - r.loc[miss, "external"]).clip(0, 40)
    r["total"] = r["total"].clip(0, 100)

    a = t["attendance_monthly"]
    ratio_rows = a.dropna(subset=["lectures_attended"])
    over = int((ratio_rows["lectures_attended"] > ratio_rows["lectures_held"]).sum())
    a["lectures_attended"] = np.minimum(a["lectures_attended"], a["lectures_held"])
    log["attendance_monthly.lectures_attended > held -> capped at held"] = over
    ratio = (a["lectures_attended"] / a["lectures_held"]).groupby(a["student_id"]).transform("median")
    miss = a["lectures_attended"].isna()
    log["attendance_monthly.lectures_attended missing -> student median ratio x held"] = int(miss.sum())
    a.loc[miss, "lectures_attended"] = (ratio[miss].fillna(ratio.median()) * a.loc[miss, "lectures_held"]).round()

    m = t["lms_monthly"]
    m["logins"] = m["logins"].astype(float)
    med_logins = m.groupby("student_id")["logins"].transform("median")
    cap = 3 * med_logins
    capped = m["logins"] > cap
    log["lms_monthly.logins > 3x student median -> capped at 3x median"] = int(capped.sum())
    m.loc[capped, "logins"] = cap[capped]
    log["lms_monthly.avg_quiz_score missing -> student median"] = _median_fill(m, "avg_quiz_score", ["student_id"])
    log["lms_monthly.hours_online missing -> student median"] = _median_fill(m, "hours_online", ["student_id"])
    m["avg_quiz_score"] = m["avg_quiz_score"].clip(0, 100)

    asg = t["assignments"]
    miss = asg["score"].isna() & asg["submitted"]
    log["assignments.score missing (submitted) -> student median"] = int(miss.sum())
    med = asg.groupby("student_id")["score"].transform("median")
    asg.loc[miss, "score"] = med[miss].fillna(asg["score"].median())

    c = t["coding_attempts"]
    bad = c["score_percent"] > 100
    log["coding_attempts.score_percent > 100 -> student median"] = int(bad.sum())
    c.loc[bad, "score_percent"] = np.nan
    log["coding_attempts.score_percent invalid -> student median"] = _median_fill(c, "score_percent", ["student_id"])
    c["score_percent"] = c["score_percent"].clip(0, 100)
    log["coding_attempts.time_taken_sec missing -> student median"] = _median_fill(c, "time_taken_sec", ["student_id"])

    i = t["interview_attempts"]
    miss = i["confidence"].isna()
    log["interview_attempts.confidence missing -> student median"] = int(miss.sum())
    med = i.groupby("student_id")["confidence"].transform("median")
    fallback = (i["communication"] + i["technical"]) / 2
    i["confidence"] = i["confidence"].fillna(med).fillna(fallback)

    k = t["skill_assessments"]
    bad = k["score"] > 100
    log["skill_assessments.score > 100 -> student median of that skill"] = int(bad.sum())
    k.loc[bad, "score"] = np.nan
    _median_fill(k, "score", ["student_id", "skill"])
    k["score"] = k["score"].clip(0, 100)
    return t, log


# --------------------------------------------------------------------------- helpers
def _slope(matrix: pd.DataFrame) -> pd.Series:
    """Row-wise OLS slope of values against their column positions (semester order)."""
    x = np.arange(matrix.shape[1], dtype=float)
    xc = x - x.mean()
    y = matrix.to_numpy(dtype=float)
    yc = y - np.nanmean(y, axis=1, keepdims=True)
    return pd.Series(np.nansum(yc * xc, axis=1) / (xc ** 2).sum(), index=matrix.index)


def _per_sem_ratio(df: pd.DataFrame, num: str, den: str, by=None) -> pd.DataFrame:
    keys = ["student_id", "semester"] + (by or [])
    g = df.groupby(keys)[[num, den]].sum()
    g["pct"] = g[num] / g[den].replace(0, np.nan) * 100
    return g


# --------------------------------------------------------------------------- features
def compute_features(raw: Dict[str, pd.DataFrame], n: int) -> Tuple[pd.DataFrame, Dict[str, int]]:
    t, log = clean(filter_tables(raw, n))
    ids = t["students"]["student_id"].tolist()
    f = pd.DataFrame(index=pd.Index(ids, name="student_id"))
    f["as_of_semester"] = n
    end = SEM_END[n]

    # ---- academics (first-attempt marks)
    r = t["semester_results"].copy()
    r["gpc"] = r["grade_point"] * r["credits"]
    sem = r.groupby(["student_id", "semester"]).agg(
        gpc=("gpc", "sum"), cr=("credits", "sum"), internal=("internal", "mean"), external=("external", "mean"),
        failed=("passed", lambda s: int((~s).sum())),
    )
    sem["sgpa"] = sem["gpc"] / sem["cr"]
    sgpa = sem["sgpa"].unstack("semester").reindex(columns=range(1, n + 1))
    tot = r.groupby("student_id")[["gpc", "credits"]].sum()
    f["cgpa_at_n"] = tot["gpc"] / tot["credits"]
    f["sgpa_last"] = sgpa[n]
    f["sgpa_slope"] = _slope(sgpa)
    f["sgpa_drop_last"] = sgpa[n] - sgpa[n - 1]
    f["internal_avg_last"] = sem["internal"].unstack("semester")[n]
    f["external_avg_last"] = sem["external"].unstack("semester")[n]
    failed = sem["failed"].unstack("semester").reindex(columns=range(1, n + 1))
    f["subjects_failed_last"] = failed[n]
    f["subjects_failed_total"] = failed.sum(axis=1)

    bk = t["backlogs"].sort_values(["student_id", "subject_code", "attempt_date", "attempt"])
    latest = bk.groupby(["student_id", "subject_code"]).tail(1)
    f["active_backlogs_at_n"] = latest[latest["result"] == "Fail"].groupby("student_id").size()
    f["backlog_attempts_total"] = bk[bk["attempt"] >= 2].groupby("student_id").size()
    f["active_backlogs_at_n"] = f["active_backlogs_at_n"].fillna(0)
    f["backlog_attempts_total"] = f["backlog_attempts_total"].fillna(0)
    f["has_active_backlog_at_asof"] = (f["active_backlogs_at_n"] > 0).astype(int)

    # ---- attendance
    am = t["attendance_monthly"]
    per_sem = _per_sem_ratio(am, "lectures_attended", "lectures_held")["pct"].unstack("semester").reindex(columns=range(1, n + 1))
    f["att_last_sem"] = per_sem[n]
    f["att_change_vs_prev"] = per_sem[n] - per_sem[n - 1]
    f["att_slope_over_sems"] = _slope(per_sem)
    last_two = SEM_MONTHS[n][-2:]
    two = am[(am["semester"] == n) & (am["month"].isin(last_two))].groupby("student_id")[["lectures_attended", "lectures_held"]].sum()
    f["att_last_two_months"] = two["lectures_attended"] / two["lectures_held"] * 100
    subj = _per_sem_ratio(am[am["semester"] == n], "lectures_attended", "lectures_held", by=["subject_code"])["pct"]
    f["att_within_sem_trend"] = f["att_last_two_months"] - f["att_last_sem"]
    f["att_lowest_subject"] = subj.groupby("student_id").min()
    month = am.groupby(["student_id", "month"])[["lectures_attended", "lectures_held"]].sum()
    month["pct"] = month["lectures_attended"] / month["lectures_held"] * 100
    f["att_months_below_75"] = (month["pct"] < 75).groupby("student_id").sum()

    # ---- LMS
    lm = t["lms_monthly"]
    lsem = lm.groupby(["student_id", "semester"]).agg(logins=("logins", "mean"), hours=("hours_online", "mean"), quiz=("avg_quiz_score", "mean"))
    logins = lsem["logins"].unstack("semester")
    f["logins_per_month_last"] = logins[n]
    f["logins_change_vs_prev"] = (logins[n] - logins[n - 1]) / np.maximum(logins[n - 1], 1)
    recent = lm[(lm["semester"] == n) & (lm["month"].isin(last_two))].groupby("student_id")["logins"].mean()
    f["logins_recent"] = recent
    f["logins_within_sem_trend"] = recent - f["logins_per_month_last"]
    f["lms_hours_per_month"] = lsem["hours"].unstack("semester")[n]
    f["quiz_avg_last"] = lsem["quiz"].unstack("semester")[n]
    asg = t["assignments"]
    asg = asg[asg["semester"] == n].copy()
    known_sub = asg["submitted"] & (asg["submitted_date"].astype(str).str.slice(0, 10) <= end)
    asg["known_sub"] = known_sub
    asg["on_time"] = known_sub & ~asg["late"]
    asg["late_sub"] = known_sub & asg["late"]
    g = asg.groupby("student_id")[["known_sub", "on_time", "late_sub"]].sum()
    total = asg.groupby("student_id").size()
    f["submit_pct"] = g["known_sub"] / total * 100
    f["on_time_submit_pct"] = g["on_time"] / total * 100
    f["late_pct"] = g["late_sub"] / g["known_sub"].replace(0, np.nan) * 100
    due_recent = asg[asg["due_date"].astype(str).str.slice(0, 7).isin(last_two)]
    gr = due_recent.groupby("student_id")["known_sub"].agg(["sum", "size"])
    submit_recent = (gr["sum"] / gr["size"] * 100).reindex(f.index).fillna(f["submit_pct"])
    f["engagement_index_recent"] = 0.5 * f["att_last_two_months"] + 0.3 * (f["logins_recent"] / 27 * 100).clip(upper=100) + 0.2 * submit_recent

    # ---- engagement
    ac = t["activities"].copy()
    ac["pts"] = ac["type"].map(POINTS) * (ac["status"] == "Approved")
    f["approved_points_total"] = ac.groupby("student_id")["pts"].sum()
    f["approved_points_last_sem"] = ac[ac["semester"] == n].groupby("student_id")["pts"].sum()
    f["activities_total"] = ac.groupby("student_id").size()
    f["activities_pending"] = ac[ac["status"] == "Pending"].groupby("student_id").size()
    f["activities_rejected"] = ac[ac["status"] == "Rejected"].groupby("student_id").size()

    # ---- placement
    ap = t["aptitude_attempts"].sort_values(["student_id", "date"])
    f["aptitude_latest"] = ap.groupby("student_id")["total_percent"].last()
    f["aptitude_best"] = ap.groupby("student_id")["total_percent"].max()
    f["aptitude_attempts"] = ap.groupby("student_id").size()
    co = t["coding_attempts"]
    f["coding_best"] = co[co["questions"] >= 5].groupby("student_id")["score_percent"].max()
    f["coding_attempts"] = co.groupby("student_id").size()
    iv = t["interview_attempts"]
    f["interview_best"] = iv.groupby("student_id")["score"].max()
    f["interview_attempts"] = iv.groupby("student_id").size()
    sk = t["skill_assessments"]
    kind_avg = sk.groupby(["student_id", "semester", "kind"])["score"].mean().unstack("kind")
    last_sem = kind_avg.groupby("student_id").tail(1)
    last_sem = last_sem.reset_index().set_index("student_id")
    first_sem = kind_avg.groupby("student_id").head(1).reset_index().set_index("student_id")
    f["tech_skill_avg_latest"] = last_sem["technical"]
    comm = sk[(sk["skill"] == "Communication")].sort_values(["student_id", "semester"]).groupby("student_id")["score"].last()
    f["soft_comm_latest"] = comm
    f["skill_growth"] = (last_sem["technical"] + last_sem["soft"]) / 2 - (first_sem["technical"] + first_sem["soft"]) / 2
    for col in ("aptitude_latest", "aptitude_best", "aptitude_attempts", "coding_best", "coding_attempts",
                "interview_best", "interview_attempts", "approved_points_total", "approved_points_last_sem",
                "activities_total", "activities_pending", "activities_rejected"):
        f[col] = f[col].fillna(0)
    f["has_aptitude"] = (f["aptitude_attempts"] > 0).astype(int)
    f["has_coding"] = (f["coding_best"] > 0).astype(int)
    f["has_interview"] = (f["interview_attempts"] > 0).astype(int)

    # ---- faculty
    fr = t["faculty_remarks"].copy()
    fr["rating"] = (fr["participation"] + fr["discipline"] + fr["attitude"]) / 3
    fsem = fr.groupby(["student_id", "semester"])["rating"].mean().unstack("semester")
    f["faculty_rating_last"] = fsem[n]
    f["faculty_rating_change"] = fsem[n] - fsem[n - 1]

    # ---- interventions (final status is NOT used; see FEATURE_DOCS)
    inv = t["interventions"].sort_values(["student_id", "created_at"])
    f["interventions_before_n"] = inv.groupby("student_id").size()
    f["interventions_before_n"] = f["interventions_before_n"].fillna(0)
    f["last_intervention_priority"] = inv.groupby("student_id")["priority"].last()
    f["last_intervention_priority"] = f["last_intervention_priority"].fillna("NoIntervention")

    # ---- background
    s = t["students"].set_index("student_id")
    for col in ("department", "section", "residence", "income_band", "entry_band", "gender"):
        f[col] = s[col]
    f["scholarship"] = s["scholarship"].astype(int)

    # ---- Round 1 baseline
    f["round1_risk_flag"] = np.where(
        (f["cgpa_at_n"] < 6) | (f["active_backlogs_at_n"] >= 2) | (f["att_last_sem"] < 65), "High",
        np.where((f["cgpa_at_n"] < 7) | (f["active_backlogs_at_n"] == 1) | (f["att_last_sem"] < 75), "Medium", "Low"),
    )
    f["success_score_proxy"] = success_score(t, f, n)
    return f, log


def success_score(t: Dict[str, pd.DataFrame], f: pd.DataFrame, n: int) -> pd.Series:
    """Port of successScoreAsOf() in lib/dataset/outcomes.ts (same weights as student-portal WEIGHTS).

    Mirrors the TypeScript on purpose, including its quirks: attendance and LMS use semester N only, assignments
    come from the monthly LMS table, and tech/soft skills use the latest assessed semester."""
    academic = ((f["cgpa_at_n"] / 10) * 100 - 10 * f["active_backlogs_at_n"]).clip(0, 100)
    am = t["attendance_monthly"]
    a = am[am["semester"] == n].groupby("student_id")[["lectures_attended", "lectures_held"]].sum()
    attendance = a["lectures_attended"] / a["lectures_held"].clip(lower=1) * 100
    lm = t["lms_monthly"]
    lm = lm[lm["semester"] == n]
    g = lm.groupby("student_id")
    assigned = g["assignments_due"].sum()
    submitted = g["assignments_submitted"].sum()
    login_score = (g["logins"].mean() / 27 * 100).clip(upper=100)
    lms = 0.5 * np.where(assigned > 0, submitted / assigned.replace(0, np.nan) * 100, 0) + 0.3 * login_score + 0.2 * g["avg_quiz_score"].mean()
    sk = t["skill_assessments"]
    def latest_mean(kind: str) -> pd.Series:
        k = sk[sk["kind"] == kind]
        last = k.groupby("student_id")["semester"].transform("max")
        return k[k["semester"] == last].groupby("student_id")["score"].mean()
    tech = latest_mean("technical")
    skills = (tech + latest_mean("soft")) / 2
    placement = 0.35 * f["aptitude_latest"] + 0.30 * f["coding_best"] + 0.25 * f["interview_best"] + 0.10 * tech.reindex(f.index).fillna(0)
    ac = t["activities"]
    pts = (ac["type"].map(POINTS) * (ac["status"] == "Approved")).groupby(ac["student_id"]).sum()
    engagement = pts.reindex(f.index).fillna(0).clip(upper=100)
    fr = t["faculty_remarks"]
    fr = fr[fr["semester"] == n]
    faculty = (fr[["participation", "discipline", "attitude"]].mean(axis=1).groupby(fr["student_id"]).mean() / 5 * 100)
    comps = {
        "academic": academic,
        "attendance": attendance.reindex(f.index),
        "lms": pd.Series(np.asarray(lms), index=g.size().index).reindex(f.index),
        "placement": placement,
        "skills": skills.reindex(f.index).fillna(0),
        "engagement": engagement,
        "faculty": faculty.reindex(f.index),
    }
    return sum(WEIGHTS[k] * comps[k] for k in WEIGHTS)


# --------------------------------------------------------------------------- driver
def numeric_feature_names() -> List[str]:
    return [c for c in FEATURE_DOCS if c not in CATEGORICAL and c not in EXCLUDED_FROM_MODEL]


def build(write: bool = True) -> pd.DataFrame:
    raw = load_tables()
    frames = []
    report: Dict[str, Dict[str, int]] = {}
    for n in ALL_CUTOFFS:
        f, log = compute_features(raw, n)
        frames.append(f.reset_index())
        report["as_of_%d" % n] = log
    df = pd.concat(frames, ignore_index=True).sort_values(["student_id", "as_of_semester"]).reset_index(drop=True)

    out = raw["outcomes"].copy()
    out = out.rename(columns={c: "y_" + c for c in out.columns if c not in ("student_id", "as_of_semester")})
    df = df.merge(out, on=["student_id", "as_of_semester"], how="left", validate="one_to_one")
    for col in df.columns:
        if col.startswith("y_") and df[col].dtype == object and col not in ("y_next_sgpa_band",):
            df[col] = df[col].map({True: 1, False: 0})
        if col.startswith("y_") and df[col].dtype == bool:
            df[col] = df[col].astype(int)
    # semantic check: our active-backlog feature must agree with the label table's has_active_backlog_at_asof
    mismatch = int((df["has_active_backlog_at_asof"] != df["y_has_active_backlog_at_asof"].astype(int)).sum())
    if mismatch:
        raise SystemExit("has_active_backlog_at_asof disagrees with outcomes.csv on %d rows" % mismatch)
    df = df.drop(columns=["y_has_active_backlog_at_asof"])

    # correlation pruning (numeric model inputs only): drop the later of any pair with |r| > 0.95
    numeric = numeric_feature_names()
    keep_always = {"as_of_semester", "success_score_proxy"}
    corr = df[numeric].corr().abs()
    dropped: Dict[str, str] = {}
    for i, a in enumerate(numeric):
        if a in dropped:
            continue
        for b in numeric[i + 1:]:
            if b in dropped or b in keep_always:
                continue
            if corr.loc[a, b] > 0.95:
                dropped[b] = "|r|=%.3f with %s" % (corr.loc[a, b], a)

    quality = {
        "rows": int(len(df)),
        "missing_rate_after_cleaning": {c: round(float(df[c].isna().mean()), 4) for c in df.columns if not c.startswith("y_") and df[c].isna().any()},
        "constant_columns": [c for c in df.columns if not c.startswith("y_") and df[c].nunique(dropna=False) <= 1],
        "dropped_for_correlation": dropped,
    }
    if write:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        df.to_csv(OUT_DIR / "features.csv", index=False, float_format="%.6f")
        write_json(OUT_DIR / "cleaning_report.json", {"changes_per_cutoff": report, "feature_quality": quality}, digits=4, indent=2)
        write_json(OUT_DIR / "feature_columns.json", {
            "numeric": [c for c in numeric if c not in dropped],
            "categorical": CATEGORICAL,
            "excluded_from_model": EXCLUDED_FROM_MODEL,
            "round1_features": ROUND1_FEATURES,
            "dropped_for_correlation": dropped,
            "groups": {k: v[0] for k, v in FEATURE_DOCS.items()},
        }, indent=2)
        write_docs(dropped)
        print_report(df, quality, report)
    return df


def write_docs(dropped: Dict[str, str]) -> None:
    lines = [
        "# Feature definitions",
        "",
        "Generated by `ml/features.py`; do not edit by hand. One row per (student_id, as_of_semester N), N = 2, 3, 4, 5.",
        "",
        "## Leakage rules",
        "",
        "1. Every table is cut to what was known at the end of semester N (`common.known_at`) before anything else.",
        "2. The cut tables are then cleaned, so imputation statistics (a student's own median) use the past only.",
        "3. Features are aggregated from the cleaned past. Targets are joined last as separate `y_` columns.",
        "4. `students.archetype_diagnostic` is dropped before any feature is built. `gender` is kept for fairness audits and never used as a model input.",
        "5. `ml/test_leakage.py` proves (1)-(3): features computed from tables already truncated to <= N equal the features in `features.csv`.",
        "",
        "Deviation from the original plan, on purpose: interventions are described by their **priority** at creation, not by their status, because the CSV stores only the final status, which would reveal what happened after N.",
        "",
        "| Feature | Group | Definition |",
        "|---|---|---|",
    ]
    for name, (group, text) in FEATURE_DOCS.items():
        flag = " (dropped: %s)" % dropped[name] if name in dropped else ""
        lines.append("| `%s` | %s | %s%s |" % (name, group, text, flag))
    lines += ["", "## Targets (`y_` columns, from `data/csv/outcomes.csv`)", ""]
    lines += ["- `y_%s`" % c for c in TARGET_COLUMNS]
    lines.append("- `y_label_available` (false for N = 5, the upcoming semester)")
    (Path(__file__).resolve().parent / "FEATURES.md").write_text("\n".join(lines) + "\n")


def print_report(df: pd.DataFrame, quality: dict, report: dict) -> None:
    print("features.csv: %d rows x %d columns" % (len(df), len(df.columns)))
    for key, log in report.items():
        changed = {k: v for k, v in log.items() if v}
        print("  %s: %d cleaning rules fired, %d cells changed" % (key, len(changed), sum(changed.values())))
    print("missing after cleaning:", quality["missing_rate_after_cleaning"] or "none")
    print("constant columns:", quality["constant_columns"] or "none")
    print("dropped for correlation > 0.95:", quality["dropped_for_correlation"] or "none")


if __name__ == "__main__":
    build()
