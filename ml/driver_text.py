"""Plain-language sentences for model drivers.

Every sentence is a FACT about the student with their own numbers ("Attendance fell 14 points since last semester
(82% to 68%)"), so it reads correctly whether the factor raises or lowers risk; the UI shows the direction.
Run `python3 ml/test_ml.py` to check every feature has a template and no sentence contains 'nan' or a raw brace.
"""
from __future__ import annotations

import math
from typing import Callable, Dict

Row = Dict[str, object]


def _n(row: Row, key: str) -> float:
    value = row[key]
    return float(value) if value is not None and not (isinstance(value, float) and math.isnan(value)) else 0.0


def _plural(count: float, word: str, plural: str = None) -> str:
    count = int(round(count))
    return "%d %s" % (count, word if count == 1 else (plural or word + "s"))


def _signed_move(delta: float, unit: str, up: str = "rose", down: str = "fell") -> str:
    return "%s %.0f %s" % (up if delta >= 0 else down, abs(delta), unit if abs(round(delta)) != 1 else unit.rstrip("s"))


def _sem(row: Row) -> int:
    return int(_n(row, "as_of_semester"))


def _attempts(row: Row, key: str, noun: str, best_key: str = None, best_label: str = "best") -> str:
    count = int(_n(row, key))
    if count == 0:
        return "No %s taken yet" % noun
    text = "%s taken" % _plural(count, noun)
    if best_key:
        text += " (%s %.0f)" % (best_label, _n(row, best_key))
    return text


def _sgpa_slope(row: Row) -> str:
    slope = _n(row, "sgpa_slope")
    if abs(slope) < 0.05:
        return "SGPA is steady across semesters"
    return "SGPA is %s by %.2f points per semester" % ("rising" if slope > 0 else "falling", abs(slope))


TEMPLATES: Dict[str, Callable[[Row], str]] = {
    "as_of_semester": lambda r: "Forecast made after semester %d" % _sem(r),
    "cgpa_at_n": lambda r: "CGPA is %.2f after semester %d" % (_n(r, "cgpa_at_n"), _sem(r)),
    "sgpa_last": lambda r: "SGPA in semester %d was %.2f" % (_sem(r), _n(r, "sgpa_last")),
    "sgpa_slope": lambda r: _sgpa_slope(r),
    "sgpa_drop_last": lambda r: "SGPA %s %.1f points versus the semester before (%.1f to %.1f)" % (
        "rose" if _n(r, "sgpa_drop_last") >= 0 else "fell", abs(_n(r, "sgpa_drop_last")),
        _n(r, "sgpa_last") - _n(r, "sgpa_drop_last"), _n(r, "sgpa_last")),
    "internal_avg_last": lambda r: "Internal marks average %.0f out of 40" % _n(r, "internal_avg_last"),
    "external_avg_last": lambda r: "External marks average %.0f out of 60" % _n(r, "external_avg_last"),
    "subjects_failed_last": lambda r: ("Failed %s in semester %d" % (_plural(_n(r, "subjects_failed_last"), "subject"), _sem(r)))
        if _n(r, "subjects_failed_last") > 0 else "Passed every subject in semester %d" % _sem(r),
    "subjects_failed_total": lambda r: ("%s failed so far" % _plural(_n(r, "subjects_failed_total"), "subject"))
        if _n(r, "subjects_failed_total") > 0 else "No subject failed so far",
    "active_backlogs_at_n": lambda r: ("%s still to clear" % _plural(_n(r, "active_backlogs_at_n"), "active backlog"))
        if _n(r, "active_backlogs_at_n") > 0 else "No active backlogs",
    "backlog_attempts_total": lambda r: ("Supplementary exams attempted %s" % _plural(_n(r, "backlog_attempts_total"), "time"))
        if _n(r, "backlog_attempts_total") > 0 else "No supplementary exam attempts",
    "has_active_backlog_at_asof": lambda r: "Has an active backlog" if _n(r, "has_active_backlog_at_asof") else "No active backlog",
    "att_last_sem": lambda r: "Attendance in semester %d was %.0f%%" % (_sem(r), _n(r, "att_last_sem")),
    "att_change_vs_prev": lambda r: "Attendance %s since last semester (%.0f%% to %.0f%%)" % (
        _signed_move(_n(r, "att_change_vs_prev"), "points"), _n(r, "att_last_sem") - _n(r, "att_change_vs_prev"), _n(r, "att_last_sem")),
    "att_last_two_months": lambda r: "Attendance over the last two months was %.0f%%" % _n(r, "att_last_two_months"),
    "att_within_sem_trend": lambda r: "Attendance %s toward the end of the semester (last two months %.0f%% against a %.0f%% average)" % (
        "improved" if _n(r, "att_within_sem_trend") >= 0 else "faded", _n(r, "att_last_sem") + _n(r, "att_within_sem_trend"), _n(r, "att_last_sem")),
    "att_lowest_subject": lambda r: "Lowest single-subject attendance is %.0f%%" % _n(r, "att_lowest_subject"),
    "att_slope_over_sems": lambda r: "Attendance is %s about %.0f points per semester" % (
        "rising" if _n(r, "att_slope_over_sems") >= 0 else "falling", abs(_n(r, "att_slope_over_sems"))),
    "att_months_below_75": lambda r: ("Attendance was below 75%% in %s" % _plural(_n(r, "att_months_below_75"), "month"))
        if _n(r, "att_months_below_75") > 0 else "Attendance has never dropped below 75% in a month",
    "logins_per_month_last": lambda r: "Logs in to the LMS about %.0f times a month" % _n(r, "logins_per_month_last"),
    "logins_change_vs_prev": lambda r: "LMS logins %s %.0f%% versus last semester" % (
        "up" if _n(r, "logins_change_vs_prev") >= 0 else "down", abs(_n(r, "logins_change_vs_prev")) * 100),
    "logins_recent": lambda r: "Recent LMS logins average %.0f a month" % _n(r, "logins_recent"),
    "logins_within_sem_trend": lambda r: "Recent LMS logins are %.0f a month %s than the semester average" % (
        abs(_n(r, "logins_within_sem_trend")), "higher" if _n(r, "logins_within_sem_trend") >= 0 else "lower"),
    "engagement_index_recent": lambda r: "Recent engagement index is %.0f out of 100" % _n(r, "engagement_index_recent"),
    "lms_hours_per_month": lambda r: "Spends about %.0f hours a month on the LMS" % _n(r, "lms_hours_per_month"),
    "quiz_avg_last": lambda r: "Quiz average is %.0f%%" % _n(r, "quiz_avg_last"),
    "submit_pct": lambda r: "Submitted %.0f%% of assignments" % _n(r, "submit_pct"),
    "on_time_submit_pct": lambda r: "Submitted %.0f%% of assignments on time" % _n(r, "on_time_submit_pct"),
    "late_pct": lambda r: "%.0f%% of submitted assignments were late" % _n(r, "late_pct"),
    "approved_points_total": lambda r: ("%.0f approved activity points" % _n(r, "approved_points_total"))
        if _n(r, "approved_points_total") > 0 else "No approved extracurricular activity yet",
    "approved_points_last_sem": lambda r: ("%.0f approved activity points in semester %d" % (_n(r, "approved_points_last_sem"), _sem(r)))
        if _n(r, "approved_points_last_sem") > 0 else "No approved activity in semester %d" % _sem(r),
    "activities_total": lambda r: ("%s logged" % _plural(_n(r, "activities_total"), "activity", "activities"))
        if _n(r, "activities_total") > 0 else "No activities logged",
    "activities_pending": lambda r: ("%s awaiting approval" % _plural(_n(r, "activities_pending"), "activity", "activities"))
        if _n(r, "activities_pending") > 0 else "No activities awaiting approval",
    "activities_rejected": lambda r: ("%s rejected" % _plural(_n(r, "activities_rejected"), "activity", "activities"))
        if _n(r, "activities_rejected") > 0 else "No activities rejected",
    "aptitude_latest": lambda r: ("Latest aptitude score is %.0f%%" % _n(r, "aptitude_latest")) if _n(r, "aptitude_attempts") > 0 else "No aptitude test taken yet",
    "aptitude_best": lambda r: ("Best aptitude score is %.0f%%" % _n(r, "aptitude_best")) if _n(r, "aptitude_attempts") > 0 else "No aptitude test taken yet",
    "aptitude_attempts": lambda r: _attempts(r, "aptitude_attempts", "aptitude test", "aptitude_best"),
    "coding_best": lambda r: ("Best coding test score is %.0f%%" % _n(r, "coding_best")) if _n(r, "coding_best") > 0 else "No coding test taken yet",
    "coding_attempts": lambda r: _attempts(r, "coding_attempts", "coding test", "coding_best"),
    "interview_best": lambda r: ("Best mock interview score is %.0f" % _n(r, "interview_best")) if _n(r, "interview_attempts") > 0 else "No mock interview taken yet",
    "interview_attempts": lambda r: _attempts(r, "interview_attempts", "mock interview", "interview_best"),
    "tech_skill_avg_latest": lambda r: "Technical skills average %.0f out of 100" % _n(r, "tech_skill_avg_latest"),
    "soft_comm_latest": lambda r: "Communication skill score is %.0f" % _n(r, "soft_comm_latest"),
    "skill_growth": lambda r: "Skills %s %.0f points since the first assessment" % ("grew" if _n(r, "skill_growth") >= 0 else "declined", abs(_n(r, "skill_growth"))),
    "has_aptitude": lambda r: "Has taken an aptitude test" if _n(r, "has_aptitude") else "Has not taken an aptitude test",
    "has_coding": lambda r: "Has taken a coding test" if _n(r, "has_coding") else "Has not taken a coding test",
    "has_interview": lambda r: "Has done a mock interview" if _n(r, "has_interview") else "Has not done a mock interview",
    "faculty_rating_last": lambda r: "Faculty rate participation, discipline and attitude %.1f out of 5" % _n(r, "faculty_rating_last"),
    "faculty_rating_change": lambda r: "Faculty rating %s %.1f versus last semester" % ("rose" if _n(r, "faculty_rating_change") >= 0 else "fell", abs(_n(r, "faculty_rating_change"))),
    "interventions_before_n": lambda r: ("%s so far" % _plural(_n(r, "interventions_before_n"), "support intervention"))
        if _n(r, "interventions_before_n") > 0 else "No earlier support intervention",
    "last_intervention_priority": lambda r: "No earlier support plan" if r["last_intervention_priority"] in (None, "NoIntervention")
        else "Latest support plan was %s priority" % str(r["last_intervention_priority"]).lower(),
    "department": lambda r: "Department: %s" % r["department"],
    "section": lambda r: "Section %s" % r["section"],
    "scholarship": lambda r: "Holds a scholarship" if _n(r, "scholarship") else "No scholarship",
    "residence": lambda r: "Lives as a %s" % str(r["residence"]).lower(),
    "income_band": lambda r: "Family income band: %s" % r["income_band"],
    "entry_band": lambda r: "Admission rank band: %s" % r["entry_band"],
    "gender": lambda r: "",
    "success_score_proxy": lambda r: "Round 1 Success Score is %.0f out of 100" % _n(r, "success_score_proxy"),
    "round1_risk_flag": lambda r: "Round 1 risk flag is %s" % r["round1_risk_flag"],
}


def describe(feature: str, row: Row) -> str:
    return TEMPLATES[feature](row)
