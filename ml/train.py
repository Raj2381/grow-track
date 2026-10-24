"""Train and evaluate the four outcome models. Run:  python3 ml/train.py   (after ml/features.py)

Protocol
  * labelled rows only (N = 2, 3, 4); students, not rows, are split: 20% of students are held out as a final test set,
    touched once at the very end; the other 80% use student-grouped 5-fold CV for every choice that is made;
  * preprocessing lives inside the sklearn Pipeline, so it is re-fitted inside every fold;
  * the model family and hyper-parameters are chosen by cross-validation only;
  * probabilities are calibrated with cross-fit calibration (fitted on out-of-fold predictions);
  * the decision threshold is the one with recall >= 0.80 and the best precision on out-of-fold predictions;
  * every model is reported next to its baselines on the same test students.
"""
from __future__ import annotations

import pickle
import platform
import sys
import time
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import MODEL_DIR, OUT_DIR, PUBLIC_DATA, SEED, read_json, sha256_file, write_json  # noqa: E402
from modeling import (  # noqa: E402
    HGB_GRID, HGB_MARGIN_AUC, HGB_MARGIN_RMSE, LR_GRID, RECALL_REQUIRED, RECALL_TARGET, RIDGE_GRID, Calibrator,
    bootstrap_auc_ci, classification_metrics, cv_oof, fast_auc, grouped_folds, make_classifier,
    make_regressor, pick_threshold, recall_at_precision, reliability_table, sgpa_band,
)

TARGETS = {
    "sgpa_below_6": {"column": "y_next_sgpa_below_6", "title": "Semester performance: SGPA below 6", "risk_class": "next-semester SGPA below 6"},
    "backlog": {"column": "y_backlog_risk_any", "title": "Backlog risk", "risk_class": "new backlog or an existing backlog not cleared"},
    "placement": {"column": "y_placement_not_ready", "title": "Placement readiness", "risk_class": "NOT placement-ready before the season (probability of being ready = 1 - p)"},
    "engagement": {"column": "y_engagement_drop_next_weeks", "title": "Engagement drop", "risk_class": "significant fall in attendance, LMS activity or assignment submission"},
}
CAVEATS = [
    "The data is synthetic: every student, mark and outcome was generated from rules we designed (see data/DATASET.md).",
    "Metrics therefore demonstrate that the pipeline is leakage-free and works end to end; they are not a claim about accuracy on real students.",
    "The test set (20% of students) was used exactly once, after every modelling choice was fixed.",
    "Retrain on the institution's own records before any decision is based on these predictions.",
]


def load_features() -> pd.DataFrame:
    df = pd.read_csv(OUT_DIR / "features.csv")
    df["y_placement_not_ready"] = 1 - df["y_placement_ready_before_season"]
    return df


def at_risk_student_flag(labelled: pd.DataFrame) -> pd.Series:
    flag = (labelled["y_backlog_risk_any"].fillna(0) + labelled["y_next_sgpa_below_6"].fillna(0)) > 0
    return flag.groupby(labelled["student_id"]).max()


def select_classifier(X, y, folds, numeric, categorical) -> dict:
    """Cross-validated search over logistic regression and gradient boosting."""
    best_lr = None
    for C in LR_GRID:
        oof, scores = cv_oof(lambda: make_classifier("logistic", {"C": C}, numeric, categorical), X, y, folds)
        entry = {"family": "logistic", "params": {"C": C}, "cv_auc": float(np.mean(scores)), "cv_auc_std": float(np.std(scores)), "oof": oof}
        if best_lr is None or entry["cv_auc"] > best_lr["cv_auc"]:
            best_lr = entry
    best_hgb = None
    for params in HGB_GRID:
        oof, scores = cv_oof(lambda: make_classifier("hgb", params, numeric, categorical), X, y, folds)
        entry = {"family": "hgb", "params": params, "cv_auc": float(np.mean(scores)), "cv_auc_std": float(np.std(scores)), "oof": oof}
        if best_hgb is None or entry["cv_auc"] > best_hgb["cv_auc"]:
            best_hgb = entry
    chosen = best_hgb if best_hgb["cv_auc"] >= best_lr["cv_auc"] + HGB_MARGIN_AUC else best_lr
    return {"lr": best_lr, "hgb": best_hgb, "chosen": chosen}


def fit_calibrated(entry: dict, X, y, numeric, categorical):
    """Final pipeline on all training rows + a calibrator fitted on the out-of-fold scores."""
    pipeline = make_classifier(entry["family"], entry["params"], numeric, categorical).fit(X, y)
    calibrator = Calibrator(int(y.sum())).fit(entry["oof"], y)
    p_oof = calibrator.transform(entry["oof"])
    threshold = pick_threshold(y, p_oof)
    return pipeline, calibrator, threshold, p_oof


def baseline_block(name, y_test, score_test, groups_test, threshold) -> dict:
    metrics = classification_metrics(y_test, score_test, threshold)
    metrics["roc_auc_ci95"] = bootstrap_auc_ci(y_test, score_test, groups_test)
    metrics["name"] = name
    return metrics


def sliced(test: pd.DataFrame, y_col: str, p: np.ndarray, threshold: float, by: str) -> dict:
    out = {}
    for value, part in test.groupby(by):
        y = part[y_col].to_numpy()
        pp = p[part.index.map(test.index.get_loc)]
        m = classification_metrics(y, pp, threshold)
        out[str(value)] = {k: m[k] for k in ("n", "positives", "roc_auc", "recall", "precision", "false_positive_rate")}
    return out


def evaluate_classifier(key, spec, df, train_ids, test_ids, numeric, categorical, folds_ids, feature_set) -> dict:
    col = spec["column"]
    labelled = df[df["y_label_available"] == 1].reset_index(drop=True)
    train = labelled[labelled["student_id"].isin(train_ids)].reset_index(drop=True)
    test = labelled[labelled["student_id"].isin(test_ids)].reset_index(drop=True)
    inputs = numeric + categorical
    Xtr, ytr = train[inputs], train[col].to_numpy().astype(int)
    Xte, yte = test[inputs], test[col].to_numpy().astype(int)
    folds = grouped_folds(train["student_id"], 5, SEED)

    search = select_classifier(Xtr, ytr, folds, numeric, categorical)
    chosen, lr = search["chosen"], search["lr"]
    pipe, cal, thr, p_oof = fit_calibrated(chosen, Xtr, ytr, numeric, categorical)
    if lr is chosen:
        lr_pipe, lr_cal, lr_thr, p_oof_lr = pipe, cal, thr, p_oof
    else:
        lr_pipe, lr_cal, lr_thr, p_oof_lr = fit_calibrated(lr, Xtr, ytr, numeric, categorical)

    # ---- final test set: touched once
    p_test = cal.transform(pipe.predict_proba(Xte)[:, 1])
    p_test_lr = lr_cal.transform(lr_pipe.predict_proba(Xte)[:, 1])
    model_metrics = classification_metrics(yte, p_test, thr)
    model_metrics["roc_auc_ci95"] = bootstrap_auc_ci(yte, p_test, test["student_id"].to_numpy())
    model_metrics["brier"] = float(np.mean((p_test - yte) ** 2))
    lr_metrics = classification_metrics(yte, p_test_lr, lr_thr)
    lr_metrics["roc_auc_ci95"] = bootstrap_auc_ci(yte, p_test_lr, test["student_id"].to_numpy())

    # ---- baselines on the same test students (thresholds chosen on training students only)
    risk_train = -train["success_score_proxy"].to_numpy()
    risk_test = -test["success_score_proxy"].to_numpy()
    ss_thr = pick_threshold(ytr, (risk_train - risk_train.min()) / (np.ptp(risk_train) + 1e-9))
    scale = lambda v: (v - risk_train.min()) / (np.ptp(risk_train) + 1e-9)
    ss_block = baseline_block("Round 1 Success Score", yte, scale(risk_test), test["student_id"].to_numpy(), ss_thr)
    flag_pred = test["round1_risk_flag"].isin(["High", "Medium"]).astype(int).to_numpy()
    flag_metrics = classification_metrics(yte, flag_pred.astype(float), 0.5)
    flag_metrics["name"] = "Round 1 risk flag (High or Medium)"
    flag_metrics["roc_auc"] = fast_auc(yte, test["round1_risk_flag"].map({"Low": 0, "Medium": 1, "High": 2}).to_numpy())
    everyone = classification_metrics(yte, np.ones(len(yte)), 0.5)
    everyone["name"] = "No skill (flag everyone)"
    everyone["roc_auc"] = 0.5

    gain = {
        "delta_roc_auc_vs_success_score": model_metrics["roc_auc"] - ss_block["roc_auc"],
        "delta_roc_auc_vs_risk_flag": model_metrics["roc_auc"] - flag_metrics["roc_auc"],
        "recall_at_success_score_precision": recall_at_precision(yte, p_test, ss_block["precision"]),
        "success_score_recall": ss_block["recall"],
        "success_score_precision": ss_block["precision"],
    }
    gain["delta_recall_at_fixed_precision"] = gain["recall_at_success_score_precision"] - ss_block["recall"]

    # ---- ablation: same family and parameters, WITHOUT the Round 1 features
    abl_numeric = [c for c in numeric if c not in ("success_score_proxy",)]
    abl_cat = [c for c in categorical if c not in ("round1_risk_flag",)]
    abl_inputs = abl_numeric + abl_cat
    builder = lambda: make_classifier(chosen["family"], chosen["params"], abl_numeric, abl_cat)
    abl_oof, abl_scores = cv_oof(builder, train[abl_inputs], ytr, folds)
    abl_model = builder().fit(train[abl_inputs], ytr)
    abl_cal = Calibrator(int(ytr.sum())).fit(abl_oof, ytr)
    abl_thr = pick_threshold(ytr, abl_cal.transform(abl_oof))
    abl_test = abl_cal.transform(abl_model.predict_proba(test[abl_inputs])[:, 1])
    ablation = classification_metrics(yte, abl_test, abl_thr)
    ablation["cv_auc"] = float(np.mean(abl_scores))
    ablation["delta_roc_auc_vs_full_model"] = ablation["roc_auc"] - model_metrics["roc_auc"]
    ablation["note"] = "Same model family and parameters, trained WITHOUT success_score_proxy and round1_risk_flag."

    # ---- slices on the held-out students
    test_idx = test.copy()
    by_semester = sliced(test_idx, col, p_test, thr, "as_of_semester")
    by_department = sliced(test_idx, col, p_test, thr, "department")
    positives = test_idx[col] == 1
    silent = positives & (test_idx["round1_risk_flag"] == "Low")
    early = {
        "definition": "Held-out rows that became at-risk although the Round 1 flag was Low at the cut-off.",
        "n_rows": int(silent.sum()),
        "caught_by_model": int(((p_test >= thr) & silent.to_numpy()).sum()),
        "share_caught_by_model": float(((p_test >= thr) & silent.to_numpy()).sum() / silent.sum()) if silent.sum() else float("nan"),
        "share_caught_by_success_score": float(((scale(risk_test) >= ss_thr) & silent.to_numpy()).sum() / silent.sum()) if silent.sum() else float("nan"),
        "round1_flag_caught": 0,
    }

    # ---- fairness: every student scored out of sample (CV for training students, held-out predictions for test)
    all_rows = pd.concat([train.assign(p=p_oof), test.assign(p=p_test)], ignore_index=True)
    fairness = {}
    for attr in ("gender", "department", "residence"):
        fairness[attr] = {}
        for value, part in all_rows.groupby(attr):
            m = classification_metrics(part[col].to_numpy(), part["p"].to_numpy(), thr)
            fairness[attr][str(value)] = {k: m[k] for k in ("n", "positives", "recall", "false_positive_rate")}
            fairness[attr][str(value)]["flagged_share"] = float((part["p"] >= thr).mean())

    artifact = {
        "key": key, "column": col, "numeric": numeric, "categorical": categorical,
        "family": chosen["family"], "params": chosen["params"], "pipeline": pipe, "calibrator": cal, "threshold": thr,
        "lr_params": lr["params"], "lr_pipeline": lr_pipe, "lr_calibrator": lr_cal, "lr_threshold": lr_thr,
        "oof": pd.DataFrame({"student_id": train["student_id"], "as_of_semester": train["as_of_semester"], "p": p_oof, "p_lr": p_oof_lr}),
        "test": pd.DataFrame({"student_id": test["student_id"], "as_of_semester": test["as_of_semester"], "p": p_test, "p_lr": p_test_lr}),
    }
    with open(MODEL_DIR / ("%s.pkl" % key), "wb") as handle:
        pickle.dump(artifact, handle)

    return {
        "title": spec["title"],
        "risk_class": spec["risk_class"],
        "model": {"family": chosen["family"], "params": chosen["params"], "chosen_because": (
            "gradient boosting beat the logistic model by >= %.2f cv-AUC" % HGB_MARGIN_AUC if chosen["family"] == "hgb"
            else "logistic regression: boosting did not beat it by >= %.2f cv-AUC, so the simpler, explainable model is used" % HGB_MARGIN_AUC)},
        "candidates": {
            "logistic": {"params": lr["params"], "cv_auc": lr["cv_auc"], "cv_auc_std": lr["cv_auc_std"]},
            "hgb": {"params": best_hgb_params(search), "cv_auc": search["hgb"]["cv_auc"], "cv_auc_std": search["hgb"]["cv_auc_std"]},
        },
        "cv_metrics": {**classification_metrics(ytr, p_oof, thr), "cv_auc_mean_of_folds": chosen["cv_auc"]},
        "test_metrics": model_metrics,
        "logistic_test_metrics": lr_metrics,
        "baselines": {"success_score": ss_block, "round1_risk_flag": flag_metrics, "no_skill": everyone},
        "gain_over_success_score": gain,
        "threshold": thr,
        "threshold_rule": "best precision among thresholds with recall >= %.2f on out-of-fold calibrated probabilities (the brief requires >= %.2f; the extra %.2f is a safety margin for sampling noise on held-out students)" % (RECALL_TARGET, RECALL_REQUIRED, RECALL_TARGET - RECALL_REQUIRED),
        "calibration": {"method": cal.kind, "brier_test": model_metrics["brier"], "reliability_test": reliability_table(yte, p_test),
                        "reliability_cv": reliability_table(ytr, p_oof)},
        "ablation": ablation,
        "by_semester": by_semester,
        "by_department": by_department,
        "early_detection": early,
        "fairness_out_of_sample": fairness,
        "n_train_students": int(train["student_id"].nunique()),
        "n_test_students": int(test["student_id"].nunique()),
        "n_train_rows": int(len(train)),
        "n_test_rows": int(len(test)),
        "prevalence": {"train": float(ytr.mean()), "test": float(yte.mean())},
    }


def best_hgb_params(search: dict) -> dict:
    return search["hgb"]["params"]


def evaluate_regressor(df, train_ids, test_ids, numeric, categorical) -> dict:
    labelled = df[df["y_label_available"] == 1].reset_index(drop=True)
    train = labelled[labelled["student_id"].isin(train_ids)].reset_index(drop=True)
    test = labelled[labelled["student_id"].isin(test_ids)].reset_index(drop=True)
    inputs = numeric + categorical
    Xtr, ytr = train[inputs], train["y_next_sgpa"].to_numpy()
    Xte, yte = test[inputs], test["y_next_sgpa"].to_numpy()
    folds = grouped_folds(train["student_id"], 5, SEED)

    best_r = None
    for alpha in RIDGE_GRID:
        oof, scores = cv_oof(lambda: make_regressor("ridge", {"alpha": alpha}, numeric, categorical), Xtr, ytr, folds, regression=True)
        entry = {"family": "ridge", "params": {"alpha": alpha}, "cv_rmse": float(np.mean(scores)), "oof": oof}
        if best_r is None or entry["cv_rmse"] < best_r["cv_rmse"]:
            best_r = entry
    best_h = None
    grid = [{"max_depth": d, "learning_rate": lr, "max_iter": it, "l2_regularization": l2} for d in (3, 5) for lr in (0.05, 0.1) for it in (100, 250) for l2 in (0.0, 1.0)]
    for params in grid:
        oof, scores = cv_oof(lambda: make_regressor("hgb", params, numeric, categorical), Xtr, ytr, folds, regression=True)
        entry = {"family": "hgb", "params": params, "cv_rmse": float(np.mean(scores)), "oof": oof}
        if best_h is None or entry["cv_rmse"] < best_h["cv_rmse"]:
            best_h = entry
    chosen = best_h if best_h["cv_rmse"] <= best_r["cv_rmse"] * (1 - HGB_MARGIN_RMSE) else best_r
    ridge_final = make_regressor("ridge", best_r["params"], numeric, categorical).fit(Xtr, ytr)
    model = ridge_final if chosen is best_r else make_regressor("hgb", chosen["params"], numeric, categorical).fit(Xtr, ytr)

    pred = model.predict(Xte)
    resid = ytr - chosen["oof"]
    lo, hi = float(np.percentile(resid, 10)), float(np.percentile(resid, 90))

    def reg_metrics(p):
        err = p - yte
        ss_res, ss_tot = float(np.sum(err ** 2)), float(np.sum((yte - yte.mean()) ** 2))
        return {
            "mae": float(np.mean(np.abs(err))), "rmse": float(np.sqrt(np.mean(err ** 2))), "r2": 1 - ss_res / ss_tot,
            "band_accuracy": float(np.mean([sgpa_band(a) == sgpa_band(b) for a, b in zip(p, yte)])),
        }

    persistence = test["sgpa_last"].to_numpy()
    cohort_mean = np.full(len(yte), float(ytr.mean()))
    metrics = reg_metrics(pred)
    metrics["interval80_coverage"] = float(np.mean((yte >= pred + lo) & (yte <= pred + hi)))

    artifact = {
        "numeric": numeric, "categorical": categorical, "family": chosen["family"], "params": chosen["params"],
        "pipeline": model, "ridge_pipeline": ridge_final, "residual_q10": lo, "residual_q90": hi,
        "oof": pd.DataFrame({"student_id": train["student_id"], "as_of_semester": train["as_of_semester"], "pred": chosen["oof"]}),
        "test": pd.DataFrame({"student_id": test["student_id"], "as_of_semester": test["as_of_semester"], "pred": pred}),
    }
    with open(MODEL_DIR / "sgpa_regression.pkl", "wb") as handle:
        pickle.dump(artifact, handle)
    return {
        "title": "Semester performance: expected next-semester SGPA",
        "model": {"family": chosen["family"], "params": chosen["params"], "chosen_because": (
            "gradient boosting cut cv-RMSE by >= %d%%" % round(HGB_MARGIN_RMSE * 100) if chosen["family"] == "hgb"
            else "ridge regression: boosting did not cut cv-RMSE by %d%%, so the simpler, explainable model is used" % round(HGB_MARGIN_RMSE * 100))},
        "candidates": {"ridge": {"params": best_r["params"], "cv_rmse": best_r["cv_rmse"]}, "hgb": {"params": best_h["params"], "cv_rmse": best_h["cv_rmse"]}},
        "cv_rmse": chosen["cv_rmse"],
        "test_metrics": metrics,
        "baselines": {"persistence_last_sgpa": reg_metrics(persistence), "cohort_mean": reg_metrics(cohort_mean)},
        "gain": {"rmse_reduction_vs_persistence": reg_metrics(persistence)["rmse"] - metrics["rmse"],
                 "mae_reduction_vs_persistence": reg_metrics(persistence)["mae"] - metrics["mae"]},
        "prediction_interval80": {"lower_offset": lo, "upper_offset": hi, "test_coverage": metrics["interval80_coverage"]},
        "bands": "Low < 5.5, Average < 7, Good < 8.5, Excellent",
        "n_train_students": int(train["student_id"].nunique()),
        "n_test_students": int(test["student_id"].nunique()),
    }


def summary_table(report: dict) -> str:
    lines = ["", "%-34s %-9s %8s %8s %8s %8s %8s | %8s %8s" % ("target", "model", "AUC", "recall", "prec", "PR-AUC", "thr", "SS AUC", "SS rec")]
    for key, block in report["targets"].items():
        t, s = block["test_metrics"], block["baselines"]["success_score"]
        lines.append("%-34s %-9s %8.3f %8.3f %8.3f %8.3f %8.3f | %8.3f %8.3f" % (
            block["title"][:34], block["model"]["family"], t["roc_auc"], t["recall"], t["precision"], t["pr_auc"], t["threshold"], s["roc_auc"], s["recall"]))
        a = block["ablation"]
        lines.append("%-34s %-9s %8.3f   (ablation without Round 1 score; delta %+0.3f)   early-detection catch %.2f (n=%d)" % (
            "", "", a["roc_auc"], a["delta_roc_auc_vs_full_model"], block["early_detection"]["share_caught_by_model"], block["early_detection"]["n_rows"]))
    r = report["regression"]
    lines.append("")
    lines.append("SGPA regression (%s): MAE %.3f RMSE %.3f R2 %.3f band acc %.3f | persistence RMSE %.3f, cohort-mean RMSE %.3f" % (
        r["model"]["family"], r["test_metrics"]["mae"], r["test_metrics"]["rmse"], r["test_metrics"]["r2"], r["test_metrics"]["band_accuracy"],
        r["baselines"]["persistence_last_sgpa"]["rmse"], r["baselines"]["cohort_mean"]["rmse"]))
    return "\n".join(lines)


def main() -> None:
    started = time.time()
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    df = load_features()
    cols = read_json(OUT_DIR / "feature_columns.json")
    numeric, categorical = cols["numeric"], cols["categorical"]
    labelled = df[df["y_label_available"] == 1]
    flag = at_risk_student_flag(labelled)
    ids = flag.index.to_numpy()
    train_ids, test_ids = train_test_split(ids, test_size=0.2, random_state=SEED, stratify=flag.to_numpy())
    train_ids, test_ids = sorted(train_ids.tolist()), sorted(test_ids.tolist())

    report = {
        "schema": {
            "targets.<key>": "classifier: model, candidates, cv_metrics, test_metrics (+95% bootstrap CI over students), logistic_test_metrics, baselines, gain_over_success_score, threshold, calibration, ablation, by_semester, by_department, early_detection, fairness_out_of_sample, prevalence",
            "regression": "next-semester SGPA: model, test_metrics, baselines, prediction_interval80",
            "threshold": "a calibrated probability at or above it counts as at-risk; tuned for recall >= 0.85 on out-of-fold training predictions (brief requires 0.80)",
            "positive class": "at-risk; for placement it is NOT ready, so probability of being ready = 1 - probability",
        },
        "caveats": CAVEATS,
        "seed": SEED,
        "sklearn_version": sklearn.__version__,
        "python_version": platform.python_version(),
        "generated_at": "deterministic (no wall-clock time is stored so outputs are reproducible)",
        "data_sha256": sha256_file(OUT_DIR / "features.csv"),
        "split": {"train_students": len(train_ids), "test_students": len(test_ids), "labelled_cutoffs": [2, 3, 4], "rule": "students, not rows, are split; test touched once"},
        "targets": {},
    }
    for key, spec in TARGETS.items():
        print("training %-14s ..." % key, flush=True)
        report["targets"][key] = evaluate_classifier(key, spec, df, train_ids, test_ids, numeric, categorical, None, None)
    print("training sgpa regression ...", flush=True)
    report["regression"] = evaluate_regressor(df, train_ids, test_ids, numeric, categorical)
    with open(OUT_DIR / "split.pkl", "wb") as handle:
        pickle.dump({"train": train_ids, "test": test_ids}, handle)
    write_json(PUBLIC_DATA / "model-metrics.json", report, digits=4, indent=1)
    print(summary_table(report))
    print("\nran in %.0fs; wrote public/data/model-metrics.json" % (time.time() - started))


if __name__ == "__main__":
    main()
