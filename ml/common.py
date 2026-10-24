"""Shared helpers for the Round 2 pipeline. Python 3.9 compatible; no third-party packages beyond numpy/pandas/sklearn."""
from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path
from typing import Dict, List

import warnings

import numpy as np
import pandas as pd

# numpy 2.0 + Apple Accelerate raises spurious 'divide by zero / overflow / invalid in matmul' warnings on finite data
# (verified: results equal an element-wise recomputation to 1e-15). Only that exact message is silenced.
warnings.filterwarnings("ignore", message=".*encountered in matmul", category=RuntimeWarning)

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / "data" / "csv"
OUT_DIR = ROOT / "ml" / "out"
MODEL_DIR = OUT_DIR / "models"
PUBLIC_DATA = ROOT / "public" / "data"
APP_DATA = ROOT / "data"

SEED = 42
LABELLED_CUTOFFS = (2, 3, 4)
ALL_CUTOFFS = (2, 3, 4, 5)


def _parse_calendar() -> Dict[int, str]:
    """Semester end dates, read from the single source of truth (lib/dataset/calendar.ts)."""
    text = (ROOT / "lib" / "dataset" / "calendar.ts").read_text()
    block = text[text.index("export const SEM_DATES"): text.index("export const SEM_MONTHS")]
    found = re.findall(r'(\d):\s*\["(\d{4}-\d{2}-\d{2})",\s*"(\d{4}-\d{2}-\d{2})"\]', block)
    return {int(sem): end for sem, _start, end in found}


def _parse_months() -> Dict[int, List[str]]:
    text = (ROOT / "lib" / "dataset" / "calendar.ts").read_text()
    block = text[text.index("export const SEM_MONTHS"): text.index("export const HOLIDAYS")]
    out: Dict[int, List[str]] = {}
    for sem, body in re.findall(r"(\d):\s*\[([^\]]*)\]", block):
        out[int(sem)] = re.findall(r'"(\d{4}-\d{2})"', body)
    return out


SEM_END = _parse_calendar()
SEM_MONTHS = _parse_months()

BOOL_COLUMNS = {
    "students": ["scholarship"],
    "semester_results": ["passed"],
    "assignments": ["submitted", "late"],
    "outcomes": [
        "label_available", "next_sgpa_below_6", "has_active_backlog_at_asof", "new_backlog_next_sem",
        "failed_to_clear_existing_backlog", "backlog_risk_any", "placement_ready_before_season",
        "engagement_drop_next_weeks",
    ],
}

TABLES = [
    "students", "semester_results", "semester_summary", "backlogs", "attendance_monthly", "lms_monthly",
    "assignments", "aptitude_attempts", "coding_attempts", "interview_attempts", "activities",
    "skill_assessments", "faculty_remarks", "interventions", "outcomes",
]


def load_tables() -> Dict[str, pd.DataFrame]:
    tables: Dict[str, pd.DataFrame] = {}
    for name in TABLES:
        df = pd.read_csv(CSV_DIR / ("%s.csv" % name))
        for col in BOOL_COLUMNS.get(name, []):
            df[col] = df[col].map({"true": True, "false": False, True: True, False: False})
        tables[name] = df
    return tables


def known_at(df: pd.DataFrame, n: int, sem_col: str = None, date_col: str = None) -> pd.DataFrame:
    """The ONE place the leakage rule lives: keep a record only if its semester is <= n and/or its date is on or
    before the last day of semester n."""
    keep = np.ones(len(df), dtype=bool)
    if sem_col is not None:
        keep &= (df[sem_col] <= n).to_numpy()
    if date_col is not None:
        keep &= (df[date_col].astype(str).str.slice(0, 10) <= SEM_END[n]).to_numpy()
    return df[keep].copy()


def clean_json(value):
    """Make a structure JSON-safe and deterministic: NaN/inf -> None, numpy scalars -> python."""
    if isinstance(value, dict):
        return {str(k): clean_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean_json(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        v = float(value)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(value, (np.bool_,)):
        return bool(value)
    return value


def round_floats(value, digits: int = 4):
    if isinstance(value, dict):
        return {k: round_floats(v, digits) for k, v in value.items()}
    if isinstance(value, list):
        return [round_floats(v, digits) for v in value]
    if isinstance(value, float):
        return round(value, digits)
    return value


def write_json(path: Path, payload, digits: int = 4, indent=None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = round_floats(clean_json(payload), digits)
    path.write_text(json.dumps(data, separators=(",", ":") if indent is None else None, indent=indent, ensure_ascii=False) + "\n")


def read_json(path: Path):
    return json.loads(path.read_text())


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def auc_score(y, score) -> float:
    from sklearn.metrics import roc_auc_score
    y = np.asarray(y)
    if len(np.unique(y)) < 2:
        return float("nan")
    return float(roc_auc_score(y, score))
