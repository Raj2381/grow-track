"""Baseline reproduction gate: the Python Success Score must reproduce the AUCs printed in data/DATASET.md (+/- 0.02).

If this fails, the feature pipeline and the dataset disagree and nothing downstream can be trusted.
Run:  python3 ml/check_baseline.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import APP_DATA, OUT_DIR, auc_score  # noqa: E402

TOLERANCE = 0.02
# DATASET.md row title -> (label column, True when a LOW score means risk)
TARGETS = {
    "New backlog next semester": "y_new_backlog_next_sem",
    "Backlog risk (new or not cleared)": "y_backlog_risk_any",
    "Next-semester SGPA below 6": "y_next_sgpa_below_6",
    "Placement-ready before season": "y_placement_ready_before_season",
    "Engagement drop": "y_engagement_drop_next_weeks",
}


def documented_aucs() -> dict:
    text = (APP_DATA / "DATASET.md").read_text()
    section = text[text.index("### Round 1 Success Score as a baseline"):]
    out = {}
    for title, value in re.findall(r"^\| ([^|]+?) \| (\d\.\d\d) \|$", section, flags=re.M):
        if title in TARGETS:
            out[title] = float(value)
    return out


def main() -> int:
    df = pd.read_csv(OUT_DIR / "features.csv")
    df = df[df["as_of_semester"].isin([2, 3, 4])]
    documented = documented_aucs()
    ok = True
    print("%-38s %10s %10s %8s" % ("target", "python", "DATASET.md", "diff"))
    for title, col in TARGETS.items():
        rows = df.dropna(subset=[col])
        # risk score = -success score for every target (a low score means more risk); AUC is symmetric in the
        # label for placement, so the "ready" label with +score equals "not ready" with -score.
        sign = 1 if col == "y_placement_ready_before_season" else -1
        mine = auc_score(rows[col], sign * rows["success_score_proxy"])
        diff = mine - documented[title]
        flag = "" if abs(diff) <= TOLERANCE else "   <-- OUTSIDE TOLERANCE"
        ok &= abs(diff) <= TOLERANCE
        print("%-38s %10.3f %10.2f %+8.3f%s" % (title, mine, documented[title], diff, flag))
    print("baseline reproduced within %.2f: %s" % (TOLERANCE, "YES" if ok else "NO"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
