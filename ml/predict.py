"""Predictions for every student. Run:  python3 ml/predict.py   (after ml/train.py and ml/explain.py)

Writes
  public/data/predictions.json      per student: four outcomes (probability, level, drivers), SGPA forecast, overall risk, facts
  data/predictions.index.json       the minimal fields the admin pages import synchronously
  public/data/risk-trends.json      predicted vs observed risk by semester x department / section / institution
  public/data/whatif-model.json     logistic coefficients, scalers, calibration maps and editable inputs for the browser
  public/data/whatif-inputs.json    N = 5 feature rows (already imputed) for the what-if view
  ml/out/whatif_parity.json         Python probabilities used to prove lib/whatif.ts matches (see scripts/test-whatif.ts)

Risk levels (two tiers, documented because the recall-tuned threshold alone flags a third of the campus):
  Low     probability below the recall-tuned screening threshold (>= 85% of true at-risk cases sit above it)
  Medium  at or above the screening threshold: flagged for a look
  High    at or above  min(0.90, max(screening threshold, 2.5 x the outcome's base rate)): at least 2.5x as likely as average
Overall risk follows the brief: High if backlog risk is High or at least two outcomes are High; Medium if any outcome is
High or at least three outcomes are flagged; otherwise Low.
"""
from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import APP_DATA, MODEL_DIR, OUT_DIR, PUBLIC_DATA, read_json, write_json  # noqa: E402
from explain import FAMILIES, load_artifact  # noqa: E402
from modeling import sgpa_band  # noqa: E402

TARGET_KEYS = ["sgpa_below_6", "backlog", "placement", "engagement"]
OUTCOME_LABEL = {
    "sgpa_below_6": "Semester performance",
    "backlog": "Backlog risk",
    "placement": "Placement readiness",
    "engagement": "Engagement drop",
}
HIGH_LIFT = 2.5
HIGH_CAP = 0.90
LEVEL_ORDER = {"Low": 0, "Medium": 1, "High": 2}


def level_thresholds(screen: float, base_rate: float) -> Dict[str, float]:
    # rounded to the 3 decimals the published probabilities use, so a level can be recomputed from the published numbers
    screen = round(float(screen), 3)
    return {"screen": screen, "high": round(float(min(HIGH_CAP, max(screen, HIGH_LIFT * base_rate))), 3)}


def level_of(p: float, th: Dict[str, float]) -> str:
    return "High" if p >= th["high"] else ("Medium" if p >= th["screen"] else "Low")


def overall_risk(levels: Dict[str, str]) -> str:
    highs = sum(1 for v in levels.values() if v == "High")
    flagged = sum(1 for v in levels.values() if v != "Low")
    if levels["backlog"] == "High" or highs >= 2:
        return "High"
    if highs >= 1 or flagged >= 3:
        return "Medium"
    return "Low"


def predict_final(artifact: dict, X: pd.DataFrame, which: str = "chosen") -> np.ndarray:
    if which == "lr":
        return artifact["lr_calibrator"].transform(artifact["lr_pipeline"].predict_proba(X)[:, 1])
    return artifact["calibrator"].transform(artifact["pipeline"].predict_proba(X)[:, 1])


def main() -> None:
    features = pd.read_csv(OUT_DIR / "features.csv")
    metrics = read_json(PUBLIC_DATA / "model-metrics.json")
    drivers = read_json(OUT_DIR / "drivers_n5.json")
    index_rows = read_json(APP_DATA / "students.index.json")
    mentor_of = {r["id"]: r["mentorId"] for r in index_rows}
    n5 = features[features["as_of_semester"] == 5].reset_index(drop=True)

    artifacts = {k: load_artifact(k) for k in TARGET_KEYS}
    with open(MODEL_DIR / "sgpa_regression.pkl", "rb") as handle:
        reg = pickle.load(handle)

    thresholds: Dict[str, Dict[str, float]] = {}
    thresholds_lr: Dict[str, Dict[str, float]] = {}
    for k, a in artifacts.items():
        thresholds[k] = level_thresholds(a["threshold"], float(a["oof"]["p"].mean()))
        thresholds_lr[k] = level_thresholds(a["lr_threshold"], float(a["oof"]["p_lr"].mean()))

    # ---------------------------------------------------------------- N = 5 predictions
    probs = {k: np.round(predict_final(a, n5[a["numeric"] + a["categorical"]]), 3) for k, a in artifacts.items()}
    probs_lr = {k: predict_final(a, n5[a["numeric"] + a["categorical"]], "lr") for k, a in artifacts.items()}
    reg_inputs = reg["numeric"] + reg["categorical"]
    sgpa_pred = np.clip(reg["pipeline"].predict(n5[reg_inputs]), 0, 10)
    sgpa_lo = np.clip(sgpa_pred + reg["residual_q10"], 0, 10)
    sgpa_hi = np.clip(sgpa_pred + reg["residual_q90"], 0, 10)

    students: Dict[str, dict] = {}
    index_out: List[dict] = []
    for i, sid in enumerate(n5["student_id"]):
        row = n5.iloc[i]
        levels = {k: level_of(float(probs[k][i]), thresholds[k]) for k in TARGET_KEYS}
        overall = overall_risk(levels)
        record: Dict[str, dict] = {}
        for k in TARGET_KEYS:
            entry = {"p": round(float(probs[k][i]), 3), "level": levels[k], "drivers": [
                {"f": d["family"], "k": d["feature"], "t": d["text"], "c": d["contribution"]} for d in drivers[sid][k]]}
            if k == "sgpa_below_6":
                entry.update({"pred": round(float(sgpa_pred[i]), 2), "lo": round(float(sgpa_lo[i]), 2), "hi": round(float(sgpa_hi[i]), 2), "band": sgpa_band(float(sgpa_pred[i]))})
            if k == "placement":
                entry["p_ready"] = round(1 - float(probs[k][i]), 3)
            record[k] = entry

        # the headline reason: first driver of the most severe outcome (severity-weighted by how far above its threshold)
        def severity(k: str) -> float:
            th = thresholds[k]
            return LEVEL_ORDER[levels[k]] + float(probs[k][i]) / max(th["high"], 1e-9) * 0.5
        top = max(TARGET_KEYS, key=severity)
        risky = [d for d in record[top]["drivers"] if d["c"] > 0]
        reason = "%s: %s" % (OUTCOME_LABEL[top], (risky[0] if risky else record[top]["drivers"][0] if record[top]["drivers"] else {"t": "no single dominant factor"})["t"]) if overall != "Low" else "No outcome is flagged"
        students[sid] = {
            "overall": overall,
            "reason": reason,
            "mentorId": mentor_of.get(sid),
            **record,
            "facts": {
                "department": row["department"], "section": row["section"],
                "cgpa": round(float(row["cgpa_at_n"]), 2), "sgpa_last": round(float(row["sgpa_last"]), 2),
                "att": round(float(row["att_last_sem"]), 1), "att_change": round(float(row["att_change_vs_prev"]), 1),
                "att_trend": round(float(row["att_within_sem_trend"]), 1),
                "backlogs": int(row["active_backlogs_at_n"]), "failed_total": int(row["subjects_failed_total"]),
                "submit_pct": round(float(row["submit_pct"]), 1), "late_pct": round(float(row["late_pct"]) if not np.isnan(row["late_pct"]) else 0.0, 1),
                "logins": round(float(row["logins_per_month_last"]), 1), "logins_change": round(float(row["logins_change_vs_prev"]), 2),
                "quiz": round(float(row["quiz_avg_last"]), 1), "engagement_recent": round(float(row["engagement_index_recent"]), 1),
                "aptitude": round(float(row["aptitude_latest"]), 1), "aptitude_attempts": int(row["aptitude_attempts"]),
                "coding": round(float(row["coding_best"]), 1), "coding_attempts": int(row["coding_attempts"]),
                "interview": round(float(row["interview_best"]), 1), "interview_attempts": int(row["interview_attempts"]),
                "tech": round(float(row["tech_skill_avg_latest"]), 1), "comm": round(float(row["soft_comm_latest"]), 1),
                "points": int(row["approved_points_total"]), "faculty": round(float(row["faculty_rating_last"]), 2),
                "success_score": round(float(row["success_score_proxy"]), 1), "round1_flag": row["round1_risk_flag"],
                "interventions": int(row["interventions_before_n"]),
            },
        }
        index_out.append({
            "id": sid, "overall": overall,
            "sgpaP": record["sgpa_below_6"]["p"], "sgpaLevel": levels["sgpa_below_6"], "predSgpa": record["sgpa_below_6"]["pred"], "band": record["sgpa_below_6"]["band"],
            "backlogP": record["backlog"]["p"], "backlogLevel": levels["backlog"],
            "readyP": record["placement"]["p_ready"], "placementLevel": levels["placement"],
            "engagementP": record["engagement"]["p"], "engagementLevel": levels["engagement"],
        })

    spec = {
        "forecast_for": "semester 6 (the upcoming semester), made with data known at the end of semester 5",
        "outcomes": {k: {"label": OUTCOME_LABEL[k], "probability_is": metrics["targets"][k]["risk_class"], "model": metrics["targets"][k]["model"]["family"],
                         "thresholds": thresholds[k]} for k in TARGET_KEYS},
        "level_rule": "Low < screening threshold <= Medium < high threshold <= High; high = min(0.90, max(screening, 2.5 x base rate))",
        "overall_rule": "High if backlog risk is High or at least two outcomes are High; Medium if any outcome is High or at least three are flagged; else Low",
        "driver_note": "c is the contribution in the logistic log-odds relative to an average student; positive raises the risk. " + read_json(PUBLIC_DATA / "model-metrics.json")["explanation_faithfulness"]["driver_display_rule"],
        "caveat": "Synthetic data. See model-metrics.json caveats.",
    }
    write_json(PUBLIC_DATA / "predictions.json", {"spec": spec, "students": students}, digits=3)
    write_json(APP_DATA / "predictions.index.json", index_out, digits=3)

    # ---------------------------------------------------------------- risk trends (out-of-sample for everyone)
    def oof_frame(key: str) -> pd.DataFrame:
        a = artifacts[key]
        return pd.concat([a["oof"][["student_id", "as_of_semester", "p"]], a["test"][["student_id", "as_of_semester", "p"]]], ignore_index=True)

    meta_cols = ["student_id", "as_of_semester", "department", "section"] + [c for c in features.columns if c.startswith("y_")]
    meta = features[meta_cols].drop_duplicates(["student_id", "as_of_semester"])
    label_col = {"sgpa_below_6": "y_next_sgpa_below_6", "backlog": "y_backlog_risk_any", "placement": "y_placement_not_ready", "engagement": "y_engagement_drop_next_weeks"}
    meta = meta.assign(y_placement_not_ready=1 - meta["y_placement_ready_before_season"])
    long = []
    for k in TARGET_KEYS:
        frame = oof_frame(k)
        final = pd.DataFrame({"student_id": n5["student_id"], "as_of_semester": 5, "p": probs[k]})
        frame = pd.concat([frame, final], ignore_index=True).merge(meta, on=["student_id", "as_of_semester"], how="left")
        frame["outcome"] = k
        th = thresholds[k]
        frame["high"] = frame["p"] >= th["high"]
        frame["flagged"] = frame["p"] >= th["screen"]
        frame["observed"] = frame[label_col[k]]
        long.append(frame)
    long_df = pd.concat(long, ignore_index=True)

    def summarize(df: pd.DataFrame) -> Dict[str, List[dict]]:
        out: Dict[str, List[dict]] = {}
        for k in TARGET_KEYS:
            rows = []
            for n, part in df[df["outcome"] == k].groupby("as_of_semester"):
                rows.append({
                    "n": int(n), "students": int(part["student_id"].nunique()), "mean_p": round(float(part["p"].mean()), 4),
                    "share_high": round(float(part["high"].mean()), 4), "share_flagged": round(float(part["flagged"].mean()), 4),
                    "observed_rate": None if part["observed"].isna().all() else round(float(part["observed"].mean()), 4),
                })
            out[k] = rows
        return out

    reg_frame = pd.concat([reg["oof"], reg["test"]], ignore_index=True).merge(meta[["student_id", "as_of_semester", "department", "section", "y_next_sgpa"]], on=["student_id", "as_of_semester"])
    final_reg = pd.DataFrame({"student_id": n5["student_id"], "as_of_semester": 5, "pred": sgpa_pred}).merge(meta[["student_id", "as_of_semester", "department", "section"]], on=["student_id", "as_of_semester"])
    reg_all = pd.concat([reg_frame, final_reg], ignore_index=True)

    def sgpa_series(df: pd.DataFrame) -> List[dict]:
        return [{"n": int(n), "predicted_mean": round(float(p["pred"].mean()), 3), "observed_mean": None if p["y_next_sgpa"].isna().all() else round(float(p["y_next_sgpa"].mean()), 3)}
                for n, p in df.groupby("as_of_semester")]

    trends = {
        "cutoffs": [2, 3, 4, 5],
        "note": "Cut-offs 2-4 are out-of-sample predictions (cross-validation for training students, held-out model for test students); cut-off 5 is the forecast for semester 6, which has no observed value yet. Placement figures are for the NOT-ready class.",
        "thresholds": thresholds,
        "institution": {**summarize(long_df), "sgpa": sgpa_series(reg_all)},
        "by_department": {}, "by_section": {},
    }
    for dept, part in long_df.groupby("department"):
        trends["by_department"][dept] = {**summarize(part), "sgpa": sgpa_series(reg_all[reg_all["department"] == dept])}
    for (dept, section), part in long_df.groupby(["department", "section"]):
        trends["by_section"]["%s / %s" % (dept, section)] = summarize(part)
    write_json(PUBLIC_DATA / "risk-trends.json", trends, digits=4)

    export_whatif(features, n5, artifacts, probs_lr, thresholds_lr)
    gz = len(__import__("gzip").compress((PUBLIC_DATA / "predictions.json").read_bytes()))
    shares = pd.Series([s["overall"] for s in students.values()]).value_counts(normalize=True).round(3).to_dict()
    print("predictions.json: %.0f KB raw, %.0f KB gzipped" % ((PUBLIC_DATA / "predictions.json").stat().st_size / 1024, gz / 1024))
    print("predictions.index.json: %.0f KB" % ((APP_DATA / "predictions.index.json").stat().st_size / 1024))
    print("overall risk shares:", shares)
    for k in TARGET_KEYS:
        lv = pd.Series([s[k]["level"] for s in students.values()]).value_counts(normalize=True).round(3).to_dict()
        print("  %-14s thresholds %s  levels %s" % (k, {a: round(b, 3) for a, b in thresholds[k].items()}, lv))


# --------------------------------------------------------------------------- what-if export
EDITABLE = [
    {"key": "att_last_sem", "label": "Attendance this semester (%)", "min": 0, "max": 100, "step": 1,
     "dependents": [
         {"feature": "att_change_vs_prev", "mode": "delta", "factor": 1.0},
         {"feature": "att_slope_over_sems", "mode": "delta", "factor": 0.2},
         {"feature": "success_score_proxy", "mode": "delta", "factor": 0.20},
         {"feature": "engagement_index_recent", "mode": "delta", "factor": 0.5},
     ], "derive": ["round1_risk_flag"]},
    {"key": "logins_per_month_last", "label": "LMS logins per month", "min": 0, "max": 40, "step": 1,
     "dependents": [
         {"feature": "logins_change_vs_prev", "mode": "relative_to_prev", "aux": "logins_prev"},
         {"feature": "lms_hours_per_month", "mode": "delta", "factor": 0.8},
         {"feature": "success_score_proxy", "mode": "delta", "factor": 0.15 * 0.3 * 100 / 27},
         {"feature": "engagement_index_recent", "mode": "delta", "factor": 0.3 * 100 / 27},
     ]},
    {"key": "submit_pct", "label": "Assignments submitted (%)", "min": 0, "max": 100, "step": 1,
     "dependents": [
         {"feature": "on_time_submit_pct", "mode": "delta", "factor": 1.0},
         {"feature": "success_score_proxy", "mode": "delta", "factor": 0.15 * 0.5},
         {"feature": "engagement_index_recent", "mode": "delta", "factor": 0.2},
     ]},
    {"key": "interview_best", "label": "Best mock interview score", "min": 0, "max": 100, "step": 1,
     "dependents": [
         {"feature": "interview_attempts", "mode": "at_least", "value": 1},
         {"feature": "success_score_proxy", "mode": "delta", "factor": 0.15 * 0.25},
     ]},
    {"key": "coding_best", "label": "Best coding test score", "min": 0, "max": 100, "step": 1,
     "dependents": [
         {"feature": "coding_attempts", "mode": "at_least", "value": 1},
         {"feature": "has_coding", "mode": "at_least", "value": 1},
         {"feature": "success_score_proxy", "mode": "delta", "factor": 0.15 * 0.30},
     ]},
]


def export_whatif(features: pd.DataFrame, n5: pd.DataFrame, artifacts: dict, probs_lr: dict, thresholds_lr: dict) -> None:
    model_out: Dict[str, dict] = {}
    numeric = artifacts["backlog"]["numeric"]
    categorical = artifacts["backlog"]["categorical"]
    for k, a in artifacts.items():
        pre, lr = a["lr_pipeline"].named_steps["pre"], a["lr_pipeline"].named_steps["model"]
        num_pipe = pre.named_transformers_["num"]
        medians, mean, scale = num_pipe.named_steps["imp"].statistics_, num_pipe.named_steps["sc"].mean_, num_pipe.named_steps["sc"].scale_
        names = list(pre.get_feature_names_out())
        coef = dict(zip(names, lr.coef_[0]))
        cat_coef: Dict[str, Dict[str, float]] = {}
        for c in categorical:
            levels = {}
            for name, value in coef.items():
                if name.startswith("cat__%s_" % c):
                    levels[name[len("cat__%s_" % c):]] = float(value)
            cat_coef[c] = levels
        model_out[k] = {
            "label": OUTCOME_LABEL[k],
            "probability_is": "probability of the at-risk class" + (" (NOT ready)" if k == "placement" else ""),
            "intercept": float(lr.intercept_[0]),
            "numeric": [{"name": n, "median": float(medians[i]), "mean": float(mean[i]), "scale": float(scale[i]), "coef": float(coef["num__%s" % n])} for i, n in enumerate(a["numeric"])],
            "categorical": [{"name": c, "levels": cat_coef[c]} for c in a["categorical"]],
            "calibration": a["lr_calibrator"].export(),
            "thresholds": thresholds_lr[k],
        }
    inputs = {"numeric": numeric, "categorical": categorical, "students": {}}
    imputed = n5[numeric].copy()
    prev_logins = (n5["logins_per_month_last"] / (1 + n5["logins_change_vs_prev"])).where(n5["logins_change_vs_prev"] > -1, n5["logins_per_month_last"])
    for i, sid in enumerate(n5["student_id"]):
        inputs["students"][sid] = {"n": [round(float(v), 4) for v in imputed.iloc[i]], "c": [str(n5.iloc[i][c]) for c in categorical], "aux": {"logins_prev": round(float(prev_logins.iloc[i]), 3)}}
    write_json(PUBLIC_DATA / "whatif-model.json", {
        "note": "Logistic models re-scored in the browser. Editing an input also moves the features that are computed from it (see `dependents`); everything else is held fixed (ceteris paribus).",
        "editable": EDITABLE, "round1_rule": {"high": {"cgpa_below": 6, "backlogs_at_least": 2, "attendance_below": 65}, "medium": {"cgpa_below": 7, "backlogs_equal": 1, "attendance_below": 75}},
        "targets": model_out}, digits=6)
    write_json(PUBLIC_DATA / "whatif-inputs.json", inputs, digits=4)
    rng = np.random.RandomState(7)
    sample = sorted(rng.choice(n5["student_id"].to_numpy(), size=50, replace=False).tolist())
    pos = {sid: i for i, sid in enumerate(n5["student_id"])}
    write_json(OUT_DIR / "whatif_parity.json", {sid: {k: float(probs_lr[k][pos[sid]]) for k in artifacts} for sid in sample}, digits=6)


if __name__ == "__main__":
    main()
