"""Student segments built from predictions + features at the forecast cut-off. Run:  python3 ml/segments.py

A student can belong to several segments (the signals are independent), except that "Stable high performers" is
exclusive of every risk segment. Writes public/data/segments.json.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Dict, List

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT_DIR, PUBLIC_DATA, read_json, write_json  # noqa: E402

SEGMENTS: List[dict] = [
    {
        "id": "high_cgpa_low_placement", "label": "High CGPA, low placement readiness",
        "definition": "CGPA of 7.5 or more, yet the model puts the student's chance of being placement-ready at 40% or lower",
        "rule": lambda d: (d["cgpa"] >= 7.5) & (d["ready_p"] <= 0.40),
    },
    {
        "id": "falling_attendance_engagement", "label": "Falling attendance and engagement",
        "definition": "Attendance fell 5 points or more (since last semester or toward the end of this one) and the engagement-drop forecast is flagged",
        "rule": lambda d: ((d["att_change"] <= -5) | (d["att_trend"] <= -5)) & (d["engagement_level"] != "Low"),
    },
    {
        "id": "backlog_not_clearing", "label": "Backlog at risk of not clearing",
        "definition": "At least one active backlog and the backlog forecast is flagged",
        "rule": lambda d: (d["backlogs"] >= 1) & (d["backlog_level"] != "Low"),
    },
    {
        "id": "silent_decliners", "label": "Silent decliners",
        "definition": "Round 1 risk flag is Low, yet the model rates the SGPA, backlog or engagement-drop risk High",
        "rule": lambda d: (d["round1_flag"] == "Low") & ((d["sgpa_level"] == "High") | (d["backlog_level"] == "High") | (d["engagement_level"] == "High")),
    },
    {
        "id": "capable_disengaged", "label": "Capable but disengaged",
        "definition": "CGPA of 7 or more, recent engagement index below 60 and at most 10 approved activity points",
        "rule": lambda d: (d["cgpa"] >= 7.0) & (d["engagement_recent"] < 60) & (d["points"] <= 10),
    },
    {
        "id": "stable_high_performers", "label": "Stable high performers",
        "definition": "Overall risk Low, CGPA of 7.5 or more, a placement-ready chance of 60% or more, and in no risk segment",
        "rule": lambda d: (d["overall"] == "Low") & (d["cgpa"] >= 7.5) & (d["ready_p"] >= 0.60),
    },
]


def main() -> None:
    predictions = read_json(PUBLIC_DATA / "predictions.json")["students"]
    rows = []
    for sid, s in predictions.items():
        f = s["facts"]
        rows.append({
            "id": sid, "department": f["department"], "cgpa": f["cgpa"], "att": f["att"], "att_change": f["att_change"], "att_trend": f["att_trend"],
            "backlogs": f["backlogs"], "engagement_recent": f["engagement_recent"], "points": f["points"], "round1_flag": f["round1_flag"],
            "overall": s["overall"], "ready_p": s["placement"]["p_ready"], "engagement_level": s["engagement"]["level"], "backlog_level": s["backlog"]["level"], "sgpa_level": s["sgpa_below_6"]["level"],
            "sgpa_p": s["sgpa_below_6"]["p"], "backlog_p": s["backlog"]["p"], "notready_p": s["placement"]["p"], "engagement_p": s["engagement"]["p"],
        })
    df = pd.DataFrame(rows)
    dept_size = df.groupby("department").size().to_dict()
    out = []
    risk_mask = np.zeros(len(df), dtype=bool)
    for seg in SEGMENTS:
        if seg["id"] != "stable_high_performers":
            risk_mask |= seg["rule"](df).to_numpy()
    for seg in SEGMENTS:
        mask = seg["rule"](df)
        if seg["id"] == "stable_high_performers":
            mask = mask & ~pd.Series(risk_mask, index=df.index)   # exclusive of every risk segment, as documented
        members = df[mask]
        by_dept = members.groupby("department").size().to_dict()
        lift = {d: round((by_dept.get(d, 0) / dept_size[d]) / max(len(members) / len(df), 1e-9), 2) if len(members) else 0.0 for d in dept_size}
        out.append({
            "id": seg["id"], "label": seg["label"], "definition": seg["definition"],
            "count": int(len(members)), "share_of_students": round(len(members) / len(df), 4),
            "members": members["id"].tolist(),
            "by_department": {d: int(by_dept.get(d, 0)) for d in sorted(dept_size)},
            "department_lift": lift,
            "mean_risk": {
                "sgpa_below_6": round(float(members["sgpa_p"].mean()), 3) if len(members) else None,
                "backlog": round(float(members["backlog_p"].mean()), 3) if len(members) else None,
                "not_placement_ready": round(float(members["notready_p"].mean()), 3) if len(members) else None,
                "engagement_drop": round(float(members["engagement_p"].mean()), 3) if len(members) else None,
            },
            "mean_cgpa": round(float(members["cgpa"].mean()), 2) if len(members) else None,
            "mean_attendance": round(float(members["att"].mean()), 1) if len(members) else None,
            "overall_high_share": round(float((members["overall"] == "High").mean()), 3) if len(members) else None,
        })
    write_json(PUBLIC_DATA / "segments.json", {
        "forecast_for": "semester 6, using data known at the end of semester 5",
        "note": "Segments overlap by design, except stable high performers, who are in no risk segment. department_lift > 1 means the segment is over-represented in that department.",
        "students": int(len(df)),
        "segments": out,
    }, digits=3)
    for s in out:
        print("%-34s %4d students (%4.1f%%)  mean risks %s" % (s["label"], s["count"], 100 * s["share_of_students"], s["mean_risk"]))


if __name__ == "__main__":
    main()
