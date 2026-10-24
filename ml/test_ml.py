"""Tests for the modelling outputs. Run:  python3 ml/test_ml.py   (after the pipeline has run)

Covers: driver sentences, explanation faithfulness, evaluation protocol (student-level split, test set size,
calibration), the acceptance numbers in the brief, and the shape of every JSON the app reads.
"""
from __future__ import annotations

import json
import math
import pickle
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import APP_DATA, MODEL_DIR, OUT_DIR, PUBLIC_DATA, read_json  # noqa: E402
from driver_text import TEMPLATES, describe  # noqa: E402
from explain import faithfulness, load_artifact  # noqa: E402
from features import FEATURE_DOCS  # noqa: E402

failures = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print("%-4s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        failures.append(name)


def strict_json(path: Path):
    """Load JSON refusing NaN/Infinity (json.dump would otherwise write them silently)."""
    def refuse(value):
        raise ValueError("non-finite number %s in %s" % (value, path.name))
    return json.loads(path.read_text(), parse_constant=refuse)


def test_driver_text(features: pd.DataFrame) -> None:
    missing = [f for f in FEATURE_DOCS if f not in TEMPLATES]
    check("every feature has a sentence template", not missing, str(missing) if missing else "%d features" % len(FEATURE_DOCS))
    bad = []
    rows = features.sample(n=400, random_state=3).to_dict("records")
    for row in rows:
        for feature in FEATURE_DOCS:
            if feature == "gender":
                continue
            text = describe(feature, row)
            if not text.strip() or re.search(r"\bnan\b|\binf\b|\{|\}|None|undefined", text, flags=re.I):
                bad.append((feature, text))
    check("no sentence is empty or contains nan / braces / None", not bad, str(bad[:3]) if bad else "400 rows x %d features" % (len(FEATURE_DOCS) - 1))


def test_faithfulness(features: pd.DataFrame) -> None:
    worst = 0.0
    for key in ["sgpa_below_6", "backlog", "placement", "engagement"]:
        worst = max(worst, faithfulness(load_artifact(key), features))
    check("contributions + intercept reproduce the logistic decision function (200 rows x 4 targets)", worst < 1e-6, "max abs diff %.1e" % worst)


def test_protocol(metrics: dict) -> None:
    with open(OUT_DIR / "split.pkl", "rb") as handle:
        split = pickle.load(handle)
    train, test = set(split["train"]), set(split["test"])
    check("train and test students are disjoint (split by student, not by row)", not (train & test), "%d / %d students" % (len(train), len(test)))
    check("about 20% of students are held out", abs(len(test) / (len(train) + len(test)) - 0.2) < 0.01, "%d of %d" % (len(test), len(train) + len(test)))
    for key in ["sgpa_below_6", "backlog", "placement", "engagement"]:
        a = load_artifact(key)
        overlap = set(a["oof"]["student_id"]) & set(a["test"]["student_id"])
        check("%s: no student is both cross-validated and tested" % key, not overlap)
    check("caveats say the data is synthetic", any("synthetic" in c.lower() for c in metrics["caveats"]))
    check("metrics carry the seed, versions and a data hash", all(k in metrics for k in ("seed", "sklearn_version", "python_version", "data_sha256")))
    check("no wall-clock timestamp is stored", not re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:", json.dumps(metrics)))


def test_acceptance(metrics: dict) -> None:
    for key, block in metrics["targets"].items():
        t = block["test_metrics"]
        check("%s: held-out recall >= 0.75" % key, t["recall"] >= 0.75, "recall %.3f (CV-tuned threshold %.3f)" % (t["recall"], block["threshold"]))
        check("%s: AUC is plausible (no leakage tell-tale above 0.97)" % key, 0.5 < t["roc_auc"] < 0.97, "AUC %.3f, 95%% CI %s" % (t["roc_auc"], [round(x, 3) for x in t["roc_auc_ci95"]]))
        check("%s: every baseline is reported" % key, all(b in block["baselines"] for b in ("success_score", "round1_risk_flag", "no_skill")))
        check("%s: ablation without the Round 1 score is reported" % key, "delta_roc_auc_vs_full_model" in block["ablation"])
        check("%s: slices and fairness are reported" % key, all(k in block for k in ("by_semester", "by_department", "early_detection", "fairness_out_of_sample")) and set(block["fairness_out_of_sample"]) == {"gender", "department", "residence"})
        check("%s: global drivers are reported" % key, len(block["global_drivers"]["top_features"]) == 10)
        cal = block["calibration"]
        base = block["prevalence"]["test"]
        check("%s: calibrated Brier beats the base-rate predictor" % key, cal["brier_test"] < base * (1 - base), "Brier %.4f vs %.4f" % (cal["brier_test"], base * (1 - base)))
    r = metrics["regression"]
    check("regression: beats last-semester persistence on RMSE", r["test_metrics"]["rmse"] < r["baselines"]["persistence_last_sgpa"]["rmse"], "%.3f vs %.3f" % (r["test_metrics"]["rmse"], r["baselines"]["persistence_last_sgpa"]["rmse"]))
    check("regression: 80% interval covers roughly 80% of held-out cases", 0.7 <= r["prediction_interval80"]["test_coverage"] <= 0.9, "%.3f" % r["prediction_interval80"]["test_coverage"])
    check("explanations were verified faithful", metrics["explanation_faithfulness"]["passed"])
    check("gender is not a model input", True if "gender" not in json.dumps([load_artifact(k)["numeric"] + load_artifact(k)["categorical"] for k in metrics["targets"]]) else False)


def test_predictions() -> None:
    data = strict_json(PUBLIC_DATA / "predictions.json")
    students = data["students"]
    check("predictions cover all 800 students", len(students) == 800 and all(("STU-%04d" % i) in students for i in range(1, 801)))
    keys = ("sgpa_below_6", "backlog", "placement", "engagement")
    problems = []
    for sid, s in students.items():
        if s["overall"] not in ("Low", "Medium", "High"):
            problems.append((sid, "overall"))
        for k in keys:
            e = s[k]
            if not (0 <= e["p"] <= 1) or e["level"] not in ("Low", "Medium", "High"):
                problems.append((sid, k))
            th = data["spec"]["outcomes"][k]["thresholds"]
            expected = "High" if e["p"] >= th["high"] else ("Medium" if e["p"] >= th["screen"] else "Low")
            if expected != e["level"]:
                problems.append((sid, k, "level"))
            if any(not d["t"] or not d["f"] for d in e["drivers"]):
                problems.append((sid, k, "driver"))
        if not (0 <= s["sgpa_below_6"]["lo"] <= s["sgpa_below_6"]["pred"] <= s["sgpa_below_6"]["hi"] <= 10):
            problems.append((sid, "sgpa interval"))
        if abs(s["placement"]["p"] + s["placement"]["p_ready"] - 1) > 0.002:
            problems.append((sid, "placement complement"))
    check("every student has four probabilities, levels, drivers and an SGPA interval", not problems, str(problems[:3]) if problems else "")
    check("a High student always has a reason", all(s["reason"] for s in students.values() if s["overall"] != "Low"))
    highs = [s for s in students.values() if s["overall"] == "High"]
    check("High-risk students exist but are a minority", 0.05 < len(highs) / 800 < 0.40, "%d (%.1f%%)" % (len(highs), len(highs) / 8))
    index = strict_json(APP_DATA / "predictions.index.json")
    check("admin index is small and matches predictions", len(index) == 800 and (APP_DATA / "predictions.index.json").stat().st_size < 300 * 1024 and all(students[r["id"]]["overall"] == r["overall"] for r in index), "%d KB" % ((APP_DATA / "predictions.index.json").stat().st_size // 1024))


def test_other_files() -> None:
    trends = strict_json(PUBLIC_DATA / "risk-trends.json")
    check("risk trends cover cut-offs 2-5 for every outcome, department and section",
          trends["cutoffs"] == [2, 3, 4, 5] and all(len(trends["institution"][k]) == 4 for k in ("sgpa_below_6", "backlog", "placement", "engagement"))
          and len(trends["by_department"]) == 5 and len(trends["by_section"]) >= 10)
    check("observed rates exist for cut-offs 2-4 and not for 5", all(r["observed_rate"] is not None for r in trends["institution"]["backlog"][:3]) and trends["institution"]["backlog"][3]["observed_rate"] is None)
    seg = strict_json(PUBLIC_DATA / "segments.json")
    check("six segments with members and department breakdown", len(seg["segments"]) == 6 and all(set(s["by_department"]) == set(trends["by_department"]) for s in seg["segments"]))
    stable = next(s for s in seg["segments"] if s["id"] == "stable_high_performers")
    risky = set().union(*[set(s["members"]) for s in seg["segments"] if s["id"] != "stable_high_performers"])
    check("stable high performers are in no risk segment", not (set(stable["members"]) & risky), "%d stable, overlap %d" % (len(stable["members"]), len(set(stable["members"]) & risky)))
    model = strict_json(PUBLIC_DATA / "whatif-model.json")
    check("what-if model has all four targets and five editable inputs", len(model["targets"]) == 4 and len(model["editable"]) == 5)
    total = sum(p.stat().st_size for p in PUBLIC_DATA.glob("*.json") if p.name in ("model-metrics.json", "predictions.json", "risk-trends.json", "segments.json", "whatif-model.json", "whatif-inputs.json", "recommendations.json"))
    check("new public data stays under 15 MB", total < 15 * 1024 * 1024, "%.1f MB" % (total / 1024 / 1024))


def main() -> int:
    features = pd.read_csv(OUT_DIR / "features.csv")
    metrics = strict_json(PUBLIC_DATA / "model-metrics.json")
    test_driver_text(features)
    test_faithfulness(features)
    test_protocol(metrics)
    test_acceptance(metrics)
    test_predictions()
    test_other_files()
    print("\n%s" % ("ALL ML TESTS PASSED" if not failures else "FAILED: %s" % failures))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
