/**
 * The executive brief as data: a short deck (about four minutes) built ONLY from the loaded forecast, so every number on a
 * slide comes from the database and nothing is typed in by hand. The page (/admin/executive-brief) draws these slides and
 * `npm run build:brief` writes the same slides to a PowerPoint file (lib/brief-pptx.ts).
 */
import type { ModelMetricsFile, OutcomeKey, PredictionSummary, RecommendationSummary, RiskTrendsFile, SegmentRecord, StoredRecommendation } from "./ml-types";

export type BriefInputs = {
  summary: PredictionSummary;
  recs: RecommendationSummary;
  trends: RiskTrendsFile;
  metrics: ModelMetricsFile;
  segments: Omit<SegmentRecord, "members">[];
  /** open Critical actions, most urgent first */
  topActions: StoredRecommendation[];
  segmentActions: StoredRecommendation[];
};

export type SlideStat = { label: string; value: string; note?: string };
export type Slide = {
  id: string;
  kicker: string;
  title: string;
  /** one line the presenter can say */
  say: string;
  /** seconds to spend on this slide */
  seconds: number;
  stats?: SlideStat[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
  footnote?: string;
};

const LABEL: Record<OutcomeKey, string> = { sgpa_below_6: "Semester performance", backlog: "Backlog risk", placement: "Placement readiness", engagement: "Engagement drop" };
const OUTCOMES: OutcomeKey[] = ["sgpa_below_6", "backlog", "placement", "engagement"];
const n0 = (n: number) => n.toLocaleString("en-IN");
const p0 = (n: number | null | undefined) => (n === null || n === undefined ? "-" : `${Math.round(n * 100)}%`);
/** like the app's pct(): never claims certainty */
const pct = (p: number | null | undefined, digits = 0) => (p === null || p === undefined ? "-" : p >= 0.995 ? ">99%" : p > 0 && p < 0.005 ? "<1%" : `${(p * 100).toFixed(digits)}%`);
const clean = (label: string) => label.replace(/\s*\(\d+ students\)$/, "");

export function buildBrief(i: BriefInputs): Slide[] {
  const { summary: s, recs, trends, metrics, segments } = i;
  const highShare = s.total ? s.overall.High / s.total : 0;
  const lastBacklog = trends.institution.backlog[trends.institution.backlog.length - 1];
  const prevBacklog = trends.institution.backlog[trends.institution.backlog.length - 2];
  const topDepartments = [...s.by_department].sort((a, b) => b.High / (b.total || 1) - a.High / (a.total || 1)).slice(0, 3);
  const bigSegments = [...segments].sort((a, b) => b.count - a.count).slice(0, 3);
  const metricRows = OUTCOMES.map((k) => {
    const t = metrics.targets[k];
    return [LABEL[k], t.test_metrics.roc_auc.toFixed(2), p0(t.test_metrics.recall), p0(t.test_metrics.precision), t.baselines.success_score.roc_auc.toFixed(2)];
  });
  const owners = Object.entries(recs.by_owner).sort((a, b) => b[1] - a[1]);

  const slides: Slide[] = [
    {
      id: "title", kicker: "KPMG AI-Powered Student Analytics · Round 2", title: "GrowTrack: from data to early action", seconds: 15,
      say: "We predict who is likely to struggle next semester, explain why, and tell the right person what to do.",
      bullets: [`${n0(s.total)} students forecast for semester 6 from data up to semester 5`, "Predictions, reasons, recommended actions and a dashboard for each role, in one product"],
      footnote: "Forecasts are estimates for people to review, not decisions.",
    },
    {
      id: "glance", kicker: "The picture", title: "Next semester at a glance", seconds: 40,
      say: `${pct(highShare)} of students are rated high risk overall, and ${n0(recs.open_critical_or_high)} actions are open at critical or high priority.`,
      stats: [
        { label: "Students forecast", value: n0(s.total), note: "semester 6" },
        { label: "Rated high overall", value: String(s.overall.High), note: `${pct(highShare)} of students · ${s.overall.Medium} more at medium` },
        { label: "Urgent actions open", value: n0(recs.open_critical_or_high), note: "critical or high priority" },
        { label: "Expected average SGPA", value: s.outcomes.sgpa_below_6.mean_sgpa?.toFixed(2) ?? "-", note: `${pct(s.outcomes.placement.mean_ready)} expected placement-ready` },
      ],
      bullets: topDepartments.map((d) => `${d.department}: ${d.High} of ${d.total} students rated high (${pct(d.High / (d.total || 1))})`),
    },
    {
      id: "predictions", kicker: "Predictions", title: "Four forecasts, tested on students the model never saw", seconds: 45,
      say: "Each forecast beats the existing success score, and the stated chances are calibrated.",
      table: { head: ["Forecast", "ROC AUC", "Catches", "Right when flagged", "Success-score AUC"], rows: metricRows },
      bullets: [`Expected SGPA is off by ${metrics.regression.test_metrics.mae.toFixed(2)} points on average; the 80% range holds ${p0(metrics.regression.test_metrics.interval80_coverage)} of the time`],
      footnote: metrics.caveats[1],
    },
    {
      id: "drivers", kicker: "Explainability", title: "Every forecast comes with reasons", seconds: 30,
      say: "Reasons are the model's own arithmetic, written in plain language with the student's own numbers.",
      bullets: OUTCOMES.map((k) => {
        const groups = Object.entries(metrics.targets[k].global_drivers.by_group).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
        return `${LABEL[k]}: mostly ${groups.join(", ")}`;
      }),
      footnote: metrics.explanation_faithfulness.passed ? "Checked: the reasons shown add up to the model's probability." : undefined,
    },
    {
      id: "segments", kicker: "Where to act", title: "Groups that need one shared response", seconds: 35,
      say: "Segments let one action help many students at once.",
      table: { head: ["Segment", "Students", "Share of campus"], rows: bigSegments.map((g) => [clean(g.label), n0(g.count), pct(g.share_of_students, 1)]) },
      bullets: i.segmentActions.slice(0, 3).map((r) => `${clean(r.targetLabel)}: ${r.action}`),
    },
    {
      id: "actions", kicker: "Recommendations", title: "Each action has a target, a reason, an owner and a priority", seconds: 40,
      say: "Staff can accept, complete or dismiss an action, and everyone sees the update.",
      stats: [
        { label: "Actions", value: n0(recs.total), note: `${recs.by_target_type.student ?? 0} for students · ${recs.by_target_type.segment ?? 0} for groups` },
        { label: "Critical", value: n0(recs.by_priority.Critical ?? 0) },
        { label: "High", value: n0(recs.by_priority.High ?? 0) },
        { label: "Owners", value: String(owners.length), note: owners.slice(0, 3).map(([o, c]) => `${o} ${c}`).join(" · ") },
      ],
      bullets: i.topActions.slice(0, 3).map((r) => `${r.targetLabel}: ${r.action}`),
    },
    {
      id: "trend", kicker: "Trend", title: "Forecasts track what happened", seconds: 25,
      say: "Past forecasts matched real outcomes, so the next one is worth acting on.",
      stats: [
        { label: "Backlog risk, forecast for next semester", value: pct(lastBacklog?.share_high), note: "share of students rated high" },
        { label: "Change since last semester", value: `${lastBacklog && prevBacklog ? ((lastBacklog.share_high - prevBacklog.share_high) * 100).toFixed(1) : "0.0"} pts` },
      ],
      bullets: [trends.note],
    },
    {
      id: "responsible", kicker: "Responsible use", title: "Estimates for people to review, not decisions", seconds: 30,
      say: "Humans decide. Retrain on real records before relying on it.",
      bullets: [
        ...metrics.caveats.slice(0, 2),
        "Students see their own outlook in plain words, with a plan and no risk scores",
        "Faculty see only their mentees; the database enforces it",
        "Next: retrain on institutional records, add fairness reviews each term",
      ],
    },
  ];
  return slides;
}

export const totalSeconds = (slides: Slide[]) => slides.reduce((t, x) => t + x.seconds, 0);
