"""Modelling toolkit shared by train.py, explain.py and predict.py (scikit-learn only)."""
from __future__ import annotations

from typing import Dict, List, Sequence, Tuple

import numpy as np
import pandas as pd
from scipy.stats import rankdata
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import average_precision_score, precision_recall_curve, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SEED = 42
RECALL_REQUIRED = 0.80     # what the brief asks for
RECALL_TARGET = 0.85       # used when tuning in CV: a safety margin, because held-out recall moves +/- 5 points
LR_GRID = [0.01, 0.03, 0.1, 0.3, 1.0, 3.0]
HGB_GRID = [
    {"max_depth": d, "learning_rate": lr, "max_iter": it, "l2_regularization": l2}
    for d in (3, 5) for lr in (0.05, 0.1) for it in (100, 250) for l2 in (0.0, 1.0)
]
RIDGE_GRID = [1.0, 10.0, 30.0, 100.0, 300.0, 1000.0]
HGB_MARGIN_AUC = 0.01      # boosting must beat the logistic model by this much to be chosen
HGB_MARGIN_RMSE = 0.02     # ... or by 2% relative RMSE for regression
SGPA_BANDS = [(5.5, "Low"), (7.0, "Average"), (8.5, "Good")]


# --------------------------------------------------------------------------- folds
def grouped_folds(groups: Sequence, k: int = 5, seed: int = SEED) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Student-grouped k-fold with a seeded shuffle: all rows of a student always land in the same fold."""
    groups = np.asarray(groups)
    unique = np.array(sorted(set(groups.tolist())))
    order = np.random.RandomState(seed).permutation(len(unique))
    fold_of = {g: i % k for i, g in zip(range(len(unique)), unique[order])}
    assignment = np.array([fold_of[g] for g in groups])
    return [(np.where(assignment != f)[0], np.where(assignment == f)[0]) for f in range(k)]


# --------------------------------------------------------------------------- pipelines
def make_preprocessor(numeric: List[str], categorical: List[str]) -> ColumnTransformer:
    return ColumnTransformer(
        [
            ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), numeric),
            ("cat", Pipeline([("imp", SimpleImputer(strategy="constant", fill_value="Unknown")),
                              ("oh", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), categorical),
        ],
        sparse_threshold=0.0,
    )


def make_classifier(family: str, params: dict, numeric: List[str], categorical: List[str]) -> Pipeline:
    pre = make_preprocessor(numeric, categorical)
    if family == "logistic":
        model = LogisticRegression(C=params["C"], class_weight="balanced", max_iter=5000, solver="lbfgs")
    else:
        model = HistGradientBoostingClassifier(class_weight="balanced", random_state=SEED, early_stopping=False, **params)
    return Pipeline([("pre", pre), ("model", model)])


def make_regressor(family: str, params: dict, numeric: List[str], categorical: List[str]) -> Pipeline:
    pre = make_preprocessor(numeric, categorical)
    if family == "ridge":
        model = Ridge(alpha=params["alpha"])
    else:
        model = HistGradientBoostingRegressor(random_state=SEED, early_stopping=False, **params)
    return Pipeline([("pre", pre), ("model", model)])


# --------------------------------------------------------------------------- metrics
def fast_auc(y: np.ndarray, score: np.ndarray) -> float:
    y = np.asarray(y).astype(int)
    pos = y == 1
    n_pos, n_neg = int(pos.sum()), int((~pos).sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    ranks = rankdata(score)
    return float((ranks[pos].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def pick_threshold(y: np.ndarray, p: np.ndarray, recall_target: float = RECALL_TARGET) -> float:
    """Threshold with recall >= target and the best precision among those; ties go to the larger threshold."""
    y = np.asarray(y).astype(int)
    best_t, best_prec = None, -1.0
    for t in np.unique(p):
        pred = p >= t
        tp = int((pred & (y == 1)).sum())
        if tp == 0:
            continue
        recall = tp / int((y == 1).sum())
        if recall < recall_target:
            continue
        precision = tp / int(pred.sum())
        if precision > best_prec + 1e-12 or (abs(precision - best_prec) <= 1e-12 and (best_t is None or t > best_t)):
            best_t, best_prec = float(t), precision
    if best_t is None:
        best_t = float(np.min(p))
    return best_t


def classification_metrics(y, p, threshold: float) -> dict:
    y = np.asarray(y).astype(int)
    p = np.asarray(p, dtype=float)
    pred = (p >= threshold).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum())
    fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    tn = int(((pred == 0) & (y == 0)).sum())
    precision = tp / (tp + fp) if tp + fp else float("nan")
    recall = tp / (tp + fn) if tp + fn else float("nan")
    specificity = tn / (tn + fp) if tn + fp else float("nan")
    f1 = 2 * precision * recall / (precision + recall) if tp else 0.0
    return {
        "roc_auc": fast_auc(y, p),
        "pr_auc": float(average_precision_score(y, p)) if len(np.unique(y)) > 1 else float("nan"),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "accuracy": (tp + tn) / len(y),
        "balanced_accuracy": (recall + specificity) / 2,
        "false_positive_rate": 1 - specificity if tn + fp else float("nan"),
        "threshold": float(threshold),
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "n": int(len(y)),
        "positives": int((y == 1).sum()),
    }


def bootstrap_auc_ci(y: np.ndarray, score: np.ndarray, groups: np.ndarray, n_boot: int = 1000, seed: int = SEED) -> List[float]:
    """95% CI of ROC-AUC, resampling whole students (rows of a student stay together)."""
    y, score, groups = np.asarray(y), np.asarray(score), np.asarray(groups)
    students = np.array(sorted(set(groups.tolist())))
    index = {s: np.where(groups == s)[0] for s in students}
    rng = np.random.RandomState(seed)
    values = []
    for _ in range(n_boot):
        pick = rng.choice(students, size=len(students), replace=True)
        rows = np.concatenate([index[s] for s in pick])
        auc = fast_auc(y[rows], score[rows])
        if not np.isnan(auc):
            values.append(auc)
    return [float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5))]


def recall_at_precision(y: np.ndarray, p: np.ndarray, precision_floor: float) -> float:
    if np.isnan(precision_floor):
        return float("nan")
    precision, recall, _ = precision_recall_curve(y, p)
    ok = precision >= precision_floor - 1e-12
    return float(recall[ok].max()) if ok.any() else 0.0


def reliability_table(y: np.ndarray, p: np.ndarray, bins: int = 10) -> List[dict]:
    y, p = np.asarray(y).astype(int), np.asarray(p, dtype=float)
    edges = np.quantile(p, np.linspace(0, 1, bins + 1))
    edges[-1] += 1e-9
    rows = []
    for i in range(bins):
        mask = (p >= edges[i]) & (p < edges[i + 1])
        if mask.sum() == 0:
            continue
        rows.append({"bin": i + 1, "n": int(mask.sum()), "mean_predicted": float(p[mask].mean()), "observed_rate": float(y[mask].mean())})
    return rows


def sgpa_band(value: float) -> str:
    for edge, name in SGPA_BANDS:
        if value < edge:
            return name
    return "Excellent"


# --------------------------------------------------------------------------- calibration
class Calibrator:
    """Maps raw model scores to probabilities. Fitted on out-of-fold predictions only (cross-fit calibration)."""

    def __init__(self, positives: int):
        self.kind = "isotonic" if positives >= 200 else "sigmoid"
        self.model = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0) if self.kind == "isotonic" else LogisticRegression(C=1e6, max_iter=2000)

    @staticmethod
    def _logit(p):
        p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
        return np.log(p / (1 - p)).reshape(-1, 1)

    def fit(self, p, y):
        if self.kind == "isotonic":
            self.model.fit(np.asarray(p, dtype=float), np.asarray(y, dtype=float))
        else:
            self.model.fit(self._logit(p), np.asarray(y).astype(int))
        return self

    def transform(self, p):
        if self.kind == "isotonic":
            return np.asarray(self.model.predict(np.asarray(p, dtype=float)), dtype=float)
        return self.model.predict_proba(self._logit(p))[:, 1]

    def export(self) -> dict:
        """JSON-friendly description so the browser can apply the same mapping."""
        if self.kind == "isotonic":
            return {"type": "isotonic", "x": [float(v) for v in self.model.X_thresholds_], "y": [float(v) for v in self.model.y_thresholds_]}
        return {"type": "sigmoid", "a": float(self.model.coef_[0][0]), "b": float(self.model.intercept_[0])}


# --------------------------------------------------------------------------- cross-validation
def cv_oof(builder, X: pd.DataFrame, y: np.ndarray, folds, regression: bool = False) -> Tuple[np.ndarray, List[float]]:
    """Out-of-fold predictions and the per-fold scores (AUC for classifiers, RMSE for regressors)."""
    oof = np.zeros(len(X))
    scores = []
    for tr, te in folds:
        model = builder()
        model.fit(X.iloc[tr], y[tr])
        if regression:
            pred = model.predict(X.iloc[te])
            scores.append(float(np.sqrt(np.mean((pred - y[te]) ** 2))))
        else:
            pred = model.predict_proba(X.iloc[te])[:, 1]
            scores.append(fast_auc(y[te], pred))
        oof[te] = pred
    return oof, scores
