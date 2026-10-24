import { ARCHETYPES } from "./config";
import { cgpaAsOf, successScoreAsOf, type OutcomeRow, TRAINING_CUTOFFS } from "./outcomes";
import type { GeneratedStudent } from "./generate";
import { SEM_DATES } from "./calendar";

export type Check = { name: string; pass: boolean; detail: string };

/** ROC-AUC of `scores` for predicting `positives` (Mann-Whitney U with average ranks for ties). */
export function auc(scores: number[], positives: boolean[]) {
  const order = scores.map((s, i) => ({ s, p: positives[i] })).sort((a, b) => a.s - b.s);
  let rankSum = 0;
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].s === order[i].s) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (order[k].p) rankSum += avgRank;
    i = j + 1;
  }
  const nPos = positives.filter(Boolean).length;
  const nNeg = positives.length - nPos;
  return nPos && nNeg ? (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg) : NaN;
}

export function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);
const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

export const LABELS = [
  { key: "new_backlog_next_sem", title: "New backlog next semester", range: [10, 20], riskIsPositive: true },
  { key: "backlog_risk_any", title: "Backlog risk (new or not cleared)", range: [12, 30], riskIsPositive: true },
  { key: "next_sgpa_below_6", title: "Next-semester SGPA below 6", range: [15, 35], riskIsPositive: true },
  { key: "placement_ready_before_season", title: "Placement-ready before season", range: [30, 50], riskIsPositive: false },
  { key: "engagement_drop_next_weeks", title: "Engagement drop", range: [15, 25], riskIsPositive: true },
] as const;

export function buildReport(all: GeneratedStudent[], outcomes: OutcomeRow[]) {
  const checks: Check[] = [];
  const byId = new Map(all.map((g) => [g.student.id, g]));
  const labelled = outcomes.filter((o) => o.label_available && (TRAINING_CUTOFFS as readonly number[]).includes(o.as_of_semester));

  /* structure */
  checks.push({ name: "800 students", pass: all.length === 800, detail: `${all.length} students` });
  checks.push({ name: "unique ids", pass: new Set(all.map((g) => g.student.id)).size === all.length, detail: "STU-0001 .. STU-0800" });
  checks.push({
    name: "5 semesters per student",
    pass: all.every((g) => [1, 2, 3, 4, 5].every((s) => g.student.results.filter((r) => r.semester === s).length === 6)),
    detail: "6 subjects x 5 semesters = 30 results each",
  });
  checks.push({
    name: "outcome rows",
    pass: outcomes.length === all.length * 4,
    detail: `${outcomes.length} rows = ${all.length} students x cut-offs 2,3,4,5 (cut-off 5 unlabelled)`,
  });

  /* prevalence */
  const prevalence = LABELS.map((l) => {
    const rows = labelled.filter((o) => o[l.key] !== null);
    const positives = rows.filter((o) => o[l.key] === true).length;
    const share = pct(positives, rows.length);
    const perCutoff = [2, 3, 4].map((n) => {
      const rs = rows.filter((o) => o.as_of_semester === n);
      return pct(rs.filter((o) => o[l.key] === true).length, rs.length);
    });
    checks.push({ name: `prevalence: ${l.title}`, pass: share >= l.range[0] && share <= l.range[1], detail: `${f1(share)}% (target ${l.range[0]}-${l.range[1]}%)` });
    return { ...l, share, n: rows.length, perCutoff };
  });

  /* baseline: Round 1 score cannot be a perfect predictor */
  const aucRows = LABELS.map((l) => {
    const rows = labelled.filter((o) => o[l.key] !== null);
    const scores = rows.map((o) => (l.riskIsPositive ? -1 : 1) * successScoreAsOf(byId.get(o.student_id)!, o.as_of_semester));
    const a = auc(scores, rows.map((o) => o[l.key] === true));
    checks.push({ name: `Success Score AUC < 0.95: ${l.title}`, pass: a < 0.95, detail: `AUC ${f2(a)}` });
    return { title: l.title, auc: a };
  });

  /* archetypes */
  const archetypeRows = ARCHETYPES.map((a) => {
    const gs = all.filter((g) => g.archetype === a.id);
    const rows = labelled.filter((o) => byId.get(o.student_id)!.archetype === a.id);
    const rate = (key: (typeof LABELS)[number]["key"]) => pct(rows.filter((o) => o[key] === true).length, rows.filter((o) => o[key] !== null).length);
    const att = (g: GeneratedStudent, sem: number) => g.semesterAttendance[sem];
    return {
      label: a.label,
      share: pct(gs.length, all.length),
      target: a.share * 100,
      cgpa: gs.reduce((s, g) => s + cgpaAsOf(g, 5), 0) / gs.length,
      att1: gs.reduce((s, g) => s + att(g, 1), 0) / gs.length,
      att5: gs.reduce((s, g) => s + att(g, 5), 0) / gs.length,
      backlog: rate("new_backlog_next_sem"),
      ready: rate("placement_ready_before_season"),
      drop: rate("engagement_drop_next_weeks"),
    };
  });
  checks.push({
    name: "archetype shares within 3 points of target",
    pass: archetypeRows.every((a) => Math.abs(a.share - a.target) <= 3),
    detail: archetypeRows.map((a) => `${f1(a.share)}`).join(" / "),
  });
  const rowOf = (label: string) => archetypeRows.find((a) => a.label.startsWith(label))!;
  checks.push({ name: "decliners lose attendance sem 1 -> 5", pass: rowOf("Slow decliner").att5 < rowOf("Slow decliner").att1 - 15, detail: `${f1(rowOf("Slow decliner").att1)} -> ${f1(rowOf("Slow decliner").att5)}` });
  checks.push({ name: "late bloomers gain attendance sem 1 -> 5", pass: rowOf("Late bloomer").att5 > rowOf("Late bloomer").att1 + 15, detail: `${f1(rowOf("Late bloomer").att1)} -> ${f1(rowOf("Late bloomer").att5)}` });
  checks.push({ name: "high CGPA / low placement is never placement-ready", pass: rowOf("High CGPA").ready < 5 && rowOf("High CGPA").cgpa > 7.5, detail: `CGPA ${f2(rowOf("High CGPA").cgpa)}, ready ${f1(rowOf("High CGPA").ready)}%` });
  checks.push({ name: "chronic backlog students keep failing", pass: rowOf("Chronic").backlog > 60, detail: `${f1(rowOf("Chronic").backlog)}% new backlog` });

  /* correlation sanity */
  const pairs = labelled.filter((o) => o.next_sgpa !== null);
  const corr = [
    {
      name: "attendance in semester N vs next SGPA",
      r: pearson(pairs.map((o) => byId.get(o.student_id)!.semesterAttendance[o.as_of_semester]), pairs.map((o) => o.next_sgpa as number)),
    },
    {
      name: "CGPA at N vs next SGPA",
      r: pearson(pairs.map((o) => cgpaAsOf(byId.get(o.student_id)!, o.as_of_semester)), pairs.map((o) => o.next_sgpa as number)),
    },
  ];
  checks.push({ name: "attendance correlates positively with next SGPA", pass: corr[0].r > 0.25 && corr[0].r < 0.9, detail: `r = ${f2(corr[0].r)}` });
  checks.push({ name: "CGPA is predictive but not perfect", pass: corr[1].r > 0.5 && corr[1].r < 0.97, detail: `r = ${f2(corr[1].r)}` });

  /* summary statistics */
  const students = all.map((g) => g.student);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const stats = {
    cgpa: mean(all.map((g) => cgpaAsOf(g, 5))),
    attendance: mean(all.map((g) => g.semesterAttendance[5])),
    withActiveBacklog: pct(students.filter((s) => s.backlogs.some((b) => b.status === "active")).length, students.length),
    departments: ["Computer Science", "Information Technology", "Electronics", "Mechanical Engineering", "Civil Engineering"].map((d) => ({
      name: d,
      n: students.filter((s) => s.profile.department === d).length,
    })),
    lastSemEnd: SEM_DATES[5][1],
  };

  return { checks, prevalence, aucRows, archetypeRows, corr, stats };
}

export type Report = ReturnType<typeof buildReport>;
