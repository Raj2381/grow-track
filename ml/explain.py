"""Explanations. Run:  python3 ml/explain.py   (after ml/train.py)

  * Global drivers: permutation importance (ROC-AUC, 20 repeats, seeded) on the held-out test students, written into
    public/data/model-metrics.json under `global_drivers`.
  * Per-student drivers: from the LOGISTIC model of each target, contribution = coefficient x standardized value,
    summed back to the original feature (one-hot columns are merged). Positive = pushes the risk up relative to an
    average student. The top 3 risk-increasing and top 2 risk-decreasing actionable drivers are kept, with a plain
    sentence containing the student's own numbers (ml/driver_text.py).
  * Faithfulness: for 200 random rows per target, sum(contributions) + intercept must equal the model's decision
    function to 1e-6.

Features outside the families (background, Round 1 score, semester index) take part in the model and in the global
importance, but are NOT listed as per-student drivers: they are not actionable, and naming someone's income band as a
"reason" is inappropriate.
"""
from __future__ import annotations

import pickle
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import MODEL_DIR, OUT_DIR, PUBLIC_DATA, SEED, read_json, write_json  # noqa: E402
from driver_text import describe  # noqa: E402
from features import FEATURE_DOCS  # noqa: E402

TARGET_KEYS = ["sgpa_below_6", "backlog", "placement", "engagement"]
N_REPEATS = 20


def load_artifact(key: str) -> dict:
    with open(MODEL_DIR / ("%s.pkl" % key), "rb") as handle:
        return pickle.load(handle)


def group_of(feature: str) -> str:
    return FEATURE_DOCS[feature][0]


def label_of(feature: str) -> str:
    return feature.replace("_", " ")


def contributions(pipeline, X: pd.DataFrame, categorical: List[str]) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Per-original-feature contributions to the logistic log-odds, the intercept, and the decision function.
    The standardized numeric values are kept on `frame.attrs["z"]` for the domain-direction check."""
    pre, model = pipeline.named_steps["pre"], pipeline.named_steps["model"]
    Z = pre.transform(X)
    names = list(pre.get_feature_names_out())
    coef = model.coef_[0]
    per_column = Z * coef
    owner = []
    for name in names:
        if name.startswith("num__"):
            owner.append(name[len("num__"):])
        else:
            body = name[len("cat__"):]
            owner.append(next(c for c in sorted(categorical, key=len, reverse=True) if body.startswith(c + "_")))
    frame = pd.DataFrame(per_column, columns=owner, index=X.index).T.groupby(level=0).sum().T
    decision = Z @ coef + model.intercept_[0]
    z_columns = [i for i, n in enumerate(names) if n.startswith("num__")]
    frame.attrs["z"] = pd.DataFrame(Z[:, z_columns], columns=[names[i][len("num__"):] for i in z_columns], index=X.index)
    return frame, np.full(len(X), model.intercept_[0]), decision


# Correlated features receive offsetting coefficients in a linear model, which makes single-feature contributions
# confusing ("attendance fell 15 points" looking protective). Contributions are therefore summed per driver FAMILY;
# the sum over all families still equals the model's decision function exactly.
FAMILIES: Dict[str, Tuple[str, List[str]]] = {
    "attendance_level": ("Attendance level", ["att_last_sem", "att_last_two_months", "att_lowest_subject", "att_months_below_75"]),
    "attendance_trend": ("Attendance trend", ["att_change_vs_prev", "att_within_sem_trend", "att_slope_over_sems"]),
    "academic_standing": ("Academic standing", ["cgpa_at_n", "sgpa_last", "internal_avg_last", "external_avg_last"]),
    "academic_trend": ("Academic trend", ["sgpa_slope", "sgpa_drop_last"]),
    "backlogs": ("Backlogs and failures", ["active_backlogs_at_n", "has_active_backlog_at_asof", "backlog_attempts_total", "subjects_failed_last", "subjects_failed_total"]),
    "recent_engagement": ("Recent engagement level", ["engagement_index_recent"]),
    "lms_activity": ("LMS activity", ["logins_per_month_last", "logins_recent", "lms_hours_per_month", "logins_change_vs_prev", "logins_within_sem_trend"]),
    "coursework": ("Assignments and quizzes", ["submit_pct", "on_time_submit_pct", "late_pct", "quiz_avg_last"]),
    "activities": ("Extracurricular activity", ["approved_points_total", "approved_points_last_sem", "activities_total", "activities_pending", "activities_rejected"]),
    "aptitude": ("Aptitude tests", ["aptitude_latest", "aptitude_best", "aptitude_attempts", "has_aptitude"]),
    "coding": ("Coding practice", ["coding_best", "coding_attempts", "has_coding"]),
    "interviews": ("Mock interviews", ["interview_best", "interview_attempts", "has_interview"]),
    "skills": ("Skills", ["tech_skill_avg_latest", "soft_comm_latest", "skill_growth"]),
    "faculty": ("Faculty feedback", ["faculty_rating_last", "faculty_rating_change"]),
    "interventions": ("Support interventions", ["interventions_before_n", "last_intervention_priority"]),
}
MIN_CONTRIBUTION = 0.15      # smaller effects are noise, not reasons

# +1: a higher value means higher risk of the bad outcome; -1: a higher value means lower risk.
RISK_DIRECTION: Dict[str, int] = {
    **{f: -1 for f in ("cgpa_at_n", "sgpa_last", "sgpa_slope", "sgpa_drop_last", "internal_avg_last", "external_avg_last",
                       "att_last_sem", "att_change_vs_prev", "att_last_two_months", "att_within_sem_trend", "att_lowest_subject",
                       "att_slope_over_sems", "logins_per_month_last", "logins_change_vs_prev", "logins_recent",
                       "logins_within_sem_trend", "engagement_index_recent", "lms_hours_per_month", "quiz_avg_last",
                       "submit_pct", "on_time_submit_pct", "approved_points_total", "approved_points_last_sem",
                       "activities_total", "aptitude_latest", "aptitude_best", "aptitude_attempts", "coding_best",
                       "coding_attempts", "interview_best", "interview_attempts", "tech_skill_avg_latest",
                       "soft_comm_latest", "skill_growth", "has_aptitude", "has_coding", "has_interview",
                       "faculty_rating_last", "faculty_rating_change")},
    **{f: 1 for f in ("subjects_failed_last", "subjects_failed_total", "active_backlogs_at_n", "has_active_backlog_at_asof",
                      "backlog_attempts_total", "att_months_below_75", "late_pct", "activities_pending",
                      "activities_rejected", "interventions_before_n")},
}
# For the engagement-drop target a student who is highly engaged NOW has more room to fall (regression to the mean),
# so that one feature's direction is reversed.
TARGET_DIRECTION_OVERRIDE = {"engagement": {"engagement_index_recent": 1}}
SUPPRESSION_NOTE = (
    "Per-student drivers are the largest family-level effects that also agree with common-sense direction "
    "(higher attendance means lower risk, more backlogs means higher risk). Effects that run against it come from "
    "offsets between correlated measures; they stay inside the probability but are not shown as reasons."
)


def family_contributions(frame: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({name: frame[[m for m in members if m in frame.columns]].sum(axis=1) for name, (_label, members) in FAMILIES.items()})


def representative(family: str, member_contrib: pd.Series, z_row: pd.Series, total: float, target: str):
    """Member feature that tells the story of the family: largest effect in the family's direction that also agrees
    with domain direction. None when no member qualifies (the family is then not shown as a reason)."""
    best, best_abs = None, 0.0
    for m in FAMILIES[family][1]:
        if m not in member_contrib.index:
            continue
        c = float(member_contrib[m])
        if c * total <= 0:
            continue
        direction = TARGET_DIRECTION_OVERRIDE.get(target, {}).get(m, RISK_DIRECTION.get(m))
        if direction is not None and m in z_row.index:
            z = float(z_row[m])
            if abs(z) > 1e-9 and np.sign(c) != direction * np.sign(z):
                continue
        if abs(c) > best_abs:
            best, best_abs = m, abs(c)
    return best


def top_drivers(contrib_row: pd.Series, family_row: pd.Series, z_row: pd.Series, feature_row: dict, target: str, n_up: int = 3, n_down: int = 2) -> List[dict]:
    out = []
    ups = family_row[family_row >= MIN_CONTRIBUTION].sort_values(ascending=False)
    downs = family_row[family_row <= -MIN_CONTRIBUTION].sort_values()
    for side, series, limit in (("up", ups, n_up), ("down", downs, n_down)):
        shown = 0
        for family, value in series.items():
            feature = representative(family, contrib_row, z_row, float(value), target)
            if feature is None:
                continue
            text = describe(feature, feature_row)
            if target == "engagement" and feature == "engagement_index_recent":
                if value > 0 and float(feature_row[feature]) >= 60:
                    text += ", so there is more room to fall"
                elif value < 0 and float(feature_row[feature]) <= 50:
                    text += ", so there is little room to fall further"
            out.append({"family": FAMILIES[family][0], "feature": feature, "group": group_of(feature), "text": text, "contribution": round(float(value), 3)})
            shown += 1
            if shown == limit:
                break
    return out


def global_importance(artifact: dict, test_X: pd.DataFrame, test_y: np.ndarray, scoring: str, pipeline_key: str = "pipeline") -> dict:
    result = permutation_importance(artifact[pipeline_key], test_X, test_y, scoring=scoring, n_repeats=N_REPEATS, random_state=SEED, n_jobs=1)
    rows = []
    for i, feature in enumerate(test_X.columns):
        rows.append({"feature": feature, "group": group_of(feature), "importance": float(result.importances_mean[i]), "std": float(result.importances_std[i])})
    rows.sort(key=lambda r: (-r["importance"], r["feature"]))
    by_group: Dict[str, float] = {}
    for r in rows:
        by_group[r["group"]] = by_group.get(r["group"], 0.0) + max(r["importance"], 0.0)
    return {
        "method": "permutation importance on held-out students, %d repeats, scoring=%s" % (N_REPEATS, scoring),
        "top_features": [{**r, "label": label_of(r["feature"])} for r in rows[:10]],
        "by_group": {k: v for k, v in sorted(by_group.items(), key=lambda kv: -kv[1])},
    }


def faithfulness(artifact: dict, features: pd.DataFrame) -> float:
    inputs = artifact["numeric"] + artifact["categorical"]
    rows = features.sample(n=200, random_state=SEED)[inputs]
    frame, intercept, decision = contributions(artifact["lr_pipeline"], rows, artifact["categorical"])
    families = family_contributions(frame)
    covered = [f for _l, members in FAMILIES.values() for f in members]
    leftover = frame.drop(columns=[c for c in covered if c in frame.columns])
    total = families.sum(axis=1) + leftover.sum(axis=1)   # families + features outside any family = every feature
    return float(max(np.abs(frame.sum(axis=1).to_numpy() + intercept - decision).max(), np.abs(total.to_numpy() + intercept - decision).max()))


def main() -> None:
    features = pd.read_csv(OUT_DIR / "features.csv")
    with open(OUT_DIR / "split.pkl", "rb") as handle:
        split = pickle.load(handle)
    labelled = features[features["y_label_available"] == 1]
    test = labelled[labelled["student_id"].isin(split["test"])].reset_index(drop=True)
    test = test.assign(y_placement_not_ready=1 - test["y_placement_ready_before_season"])
    report = read_json(PUBLIC_DATA / "model-metrics.json")

    faithful = {}
    drivers_n5: Dict[str, Dict[str, List[dict]]] = {}
    n5 = features[features["as_of_semester"] == 5].reset_index(drop=True)
    for key in TARGET_KEYS:
        artifact = load_artifact(key)
        inputs = artifact["numeric"] + artifact["categorical"]
        report["targets"][key]["global_drivers"] = global_importance(artifact, test[inputs], test[artifact["column"]].to_numpy().astype(int), "roc_auc")
        faithful[key] = faithfulness(artifact, features)
        report["targets"][key]["drivers_explain"] = (
            "logistic model (the forecast itself uses the same model)" if artifact["family"] == "logistic"
            else "the logistic model; the forecast probability comes from gradient boosting, which is stronger but not directly explainable")
        frame, _intercept, _decision = contributions(artifact["lr_pipeline"], n5[inputs], artifact["categorical"])
        families = family_contributions(frame)
        for i, student in enumerate(n5["student_id"]):
            row = n5.iloc[i].to_dict()
            drivers_n5.setdefault(student, {})[key] = top_drivers(frame.iloc[i], families.iloc[i], frame.attrs['z'].iloc[i], row, key)
        print("%-14s top drivers: %s" % (key, ", ".join("%s (%.3f)" % (r["feature"], r["importance"]) for r in report["targets"][key]["global_drivers"]["top_features"][:4])))

    reg = load_artifact("sgpa_regression")
    reg_inputs = reg["numeric"] + reg["categorical"]
    report["regression"]["global_drivers"] = global_importance(reg, test[reg_inputs], test["y_next_sgpa"].to_numpy(), "neg_root_mean_squared_error")
    print("%-14s top drivers: %s" % ("sgpa regression", ", ".join("%s (%.3f)" % (r["feature"], r["importance"]) for r in report["regression"]["global_drivers"]["top_features"][:4])))

    report["explanation_faithfulness"] = {
        "check": "for 200 random rows per target: |sum of per-feature contributions + intercept - logistic decision function|",
        "max_abs_difference": faithful,
        "tolerance": 1e-6,
        "driver_display_rule": SUPPRESSION_NOTE,
        "passed": all(v < 1e-6 for v in faithful.values()),
    }
    assert report["explanation_faithfulness"]["passed"], faithful
    write_json(PUBLIC_DATA / "model-metrics.json", report, digits=4, indent=1)
    write_json(OUT_DIR / "drivers_n5.json", drivers_n5, digits=3)
    print("faithfulness max abs diff:", {k: "%.1e" % v for k, v in faithful.items()})


if __name__ == "__main__":
    main()
