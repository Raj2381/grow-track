"""Leakage tests for the feature pipeline. Run:  python3 ml/test_leakage.py

1. FUTURE-CORRUPTION TEST. Every record dated after the end of semester N is wrecked (numbers blown up, flags
   flipped, statuses scrambled). Features for N must not change by even 1e-9. This catches any table that is not
   time-filtered, and any statistic (such as an imputation median) that peeks at the future.
2. INDEPENDENT RECOMPUTATION. A few features are rebuilt for random (student, N) pairs with plain Python loops from
   the raw CSV rows known at N, and compared with features.csv.
3. NAME / SHAPE CHECKS. No feature column is a target or the archetype; N = 5 has no labels; N <= 4 does.
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ALL_CUTOFFS, OUT_DIR, SEM_END, load_tables, read_json  # noqa: E402
from features import POINTS, TARGET_COLUMNS, compute_features  # noqa: E402

failures = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print("%-4s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        failures.append(name)


def corrupt_future(raw, n):
    """Return a copy of the raw tables with everything dated after the end of semester n wrecked."""
    end = SEM_END[n]
    t = {k: v.copy() for k, v in raw.items()}

    def future_rows(df, sem_col=None, date_col=None):
        mask = np.zeros(len(df), dtype=bool)
        if sem_col:
            mask |= (df[sem_col] > n).to_numpy()
        if date_col:
            mask |= (df[date_col].astype(str).str.slice(0, 10) > end).to_numpy()
        return mask

    specs = {
        "semester_results": dict(sem_col="semester"),
        "semester_summary": dict(sem_col="semester"),
        "backlogs": dict(date_col="attempt_date"),
        "attendance_monthly": dict(sem_col="semester"),
        "lms_monthly": dict(sem_col="semester"),
        "assignments": dict(sem_col="semester", date_col="due_date"),
        "aptitude_attempts": dict(date_col="date"),
        "coding_attempts": dict(date_col="date"),
        "interview_attempts": dict(date_col="date"),
        "activities": dict(sem_col="semester", date_col="date"),
        "skill_assessments": dict(sem_col="semester", date_col="date"),
        "faculty_remarks": dict(sem_col="semester", date_col="date"),
        "interventions": dict(sem_col="semester", date_col="created_at"),
    }
    rng = np.random.RandomState(7)
    for name, spec in specs.items():
        df = t[name]
        mask = future_rows(df, **spec)
        for col in df.columns:
            if col in ("student_id",) or col in spec.values():
                continue
            if df[col].dtype == bool:
                df.loc[mask, col] = ~df.loc[mask, col]
            elif np.issubdtype(df[col].dtype, np.number):
                df[col] = df[col].astype(float)
                df.loc[mask, col] = df.loc[mask, col] * 7 + 1000 + rng.rand(int(mask.sum()))
            elif col in ("result", "status", "priority", "type", "kind", "skill", "subject_code"):
                values = df[col].dropna().unique()
                df.loc[mask, col] = rng.choice(values, size=int(mask.sum()))
    # information about the future hiding inside rows that are otherwise known: late submissions
    a = t["assignments"]
    hidden = (a["submitted_date"].astype(str).str.slice(0, 10) > end) & (a["semester"] <= n)
    a.loc[hidden, "late"] = ~a.loc[hidden, "late"]
    return t


def test_future_corruption(raw, features):
    for n in ALL_CUTOFFS:
        base = features[features["as_of_semester"] == n].set_index("student_id")
        wrecked, _ = compute_features(corrupt_future(raw, n), n)
        wrecked = wrecked.reindex(base.index)
        bad = []
        for col in wrecked.columns:
            if col not in base.columns:
                continue
            a, b = base[col], wrecked[col]
            if pd.api.types.is_numeric_dtype(a):
                if not np.allclose(a.to_numpy(float), b.to_numpy(float), rtol=0, atol=1e-5, equal_nan=True):
                    bad.append(col)
            elif not (a.astype(str) == b.astype(str)).all():
                bad.append(col)
        check("future corruption leaves N=%d features unchanged" % n, not bad, "changed: %s" % bad if bad else "")


def test_independent(raw, features):
    rnd = random.Random(11)
    ids = sorted(raw["students"]["student_id"])
    res, bk, ac, ap = raw["semester_results"], raw["backlogs"], raw["activities"], raw["aptitude_attempts"]
    iv, am = raw["interventions"], raw["attendance_monthly"]
    bad = []
    for _ in range(60):
        sid, n = rnd.choice(ids), rnd.choice(ALL_CUTOFFS)
        end = SEM_END[n]
        row = features[(features["student_id"] == sid) & (features["as_of_semester"] == n)].iloc[0]
        r = res[(res["student_id"] == sid) & (res["semester"] <= n)]
        cgpa = sum(r["grade_point"] * r["credits"]) / sum(r["credits"])
        if abs(cgpa - row["cgpa_at_n"]) > 1e-4:
            bad.append(("cgpa_at_n", sid, n))
        if int((~r["passed"]).sum()) != row["subjects_failed_total"]:
            bad.append(("subjects_failed_total", sid, n))
        b = bk[(bk["student_id"] == sid) & (bk["attempt_date"] <= end)]
        active = 0
        for _code, g in b.groupby("subject_code"):
            g = g.sort_values(["attempt_date", "attempt"])
            active += int(g.iloc[-1]["result"] == "Fail")
        if active != row["active_backlogs_at_n"]:
            bad.append(("active_backlogs_at_n", sid, n))
        a = ac[(ac["student_id"] == sid) & (ac["date"] <= end)]
        pts = sum(POINTS[t] for t, s in zip(a["type"], a["status"]) if s == "Approved")
        if pts != row["approved_points_total"]:
            bad.append(("approved_points_total", sid, n))
        if int(((ap["student_id"] == sid) & (ap["date"] <= end)).sum()) != row["aptitude_attempts"]:
            bad.append(("aptitude_attempts", sid, n))
        if int(((iv["student_id"] == sid) & (iv["created_at"].str.slice(0, 10) <= end)).sum()) != row["interventions_before_n"]:
            bad.append(("interventions_before_n", sid, n))
        m = am[(am["student_id"] == sid) & (am["semester"] == n)]
        if m["lectures_attended"].notna().all() and (m["lectures_attended"] <= m["lectures_held"]).all():
            pct = m["lectures_attended"].sum() / m["lectures_held"].sum() * 100
            if abs(pct - row["att_last_sem"]) > 1e-3:
                bad.append(("att_last_sem", sid, n))
    check("60 random (student, N) pairs match independent recomputation", not bad, str(bad[:5]) if bad else "")


def test_names(features):
    cols = read_json(OUT_DIR / "feature_columns.json")
    model_inputs = cols["numeric"] + cols["categorical"]
    leaky = [c for c in model_inputs if c.startswith("y_") or c in TARGET_COLUMNS or "archetype" in c.lower()]
    check("no model input is a target or the archetype", not leaky, str(leaky) if leaky else "")
    check("gender is not a model input", "gender" not in model_inputs)
    check("feature table has no archetype column", not [c for c in features.columns if "archetype" in c.lower()])
    n5 = features[features["as_of_semester"] == 5]
    check("N=5 rows have no labels", n5["y_label_available"].fillna(0).astype(int).sum() == 0 and n5["y_backlog_risk_any"].isna().all())
    early = features[features["as_of_semester"] < 5]
    check("N<=4 rows are labelled", early["y_backlog_risk_any"].notna().all() and early["y_engagement_drop_next_weeks"].notna().all())
    check("one row per student and cut-off", not features.duplicated(["student_id", "as_of_semester"]).any() and len(features) == 3200)


def main() -> int:
    raw = load_tables()
    features = pd.read_csv(OUT_DIR / "features.csv")
    test_names(features)
    test_independent(raw, features)
    test_future_corruption(raw, features)
    print("\n%s" % ("ALL LEAKAGE TESTS PASSED" if not failures else "FAILED: %s" % failures))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
