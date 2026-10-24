/**
 * Recommendation engine: turns predictions, drivers and segments into specific, owned, prioritised actions.
 * Pure functions, no I/O (scripts/build-recommendations.ts feeds it and writes public/data/recommendations.json).
 *
 * Every recommendation names the target, the action, the reason (with the student's own numbers, the forecast
 * probability and the model's driver), the suggested owner, the priority and the outcome it should move.
 *
 * Priority score
 *   student:  max over the rule's outcomes of (severity weight x probability of the at-risk class)
 *             + 0.05 for every ADDITIONAL outcome rated High, capped at 1.
 *             severity weights: backlog 1.0, SGPA 0.9, placement 0.7, engagement 0.6.
 *   segment:  0.85 x max over outcomes of (weight x segment mean risk) + 0.15 x min(1, members / 15% of students).
 *   Critical >= 0.8, High >= 0.6, Medium >= 0.4, otherwise Low. Stretch actions for strong students are fixed at Low,
 *   supporting actions (study skills) are capped at High, and the attendance contract also scores the attendance
 *   shortfall itself (below 75% exam eligibility is at stake).
 */
import {
  OUTCOME_KEYS,
  type Driver,
  type OutcomeKey,
  type Owner,
  type Priority,
  type PredictionsFile,
  type Recommendation,
  type SegmentRecord,
  type SegmentsFile,
  type StudentPrediction,
} from "./ml-types";

export const SEVERITY_WEIGHT: Record<OutcomeKey, number> = { backlog: 1.0, sgpa_below_6: 0.9, placement: 0.7, engagement: 0.6 };
export const OUTCOME_NAME: Record<OutcomeKey, string> = {
  sgpa_below_6: "semester performance",
  backlog: "backlog risk",
  placement: "placement readiness",
  engagement: "engagement drop",
};
export const OWNERS: Owner[] = ["Faculty mentor", "Training & Placement cell", "Counsellor", "Dean / Administrator", "Department head"];
export const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];
export const MAX_PER_STUDENT = 3;

export type StudentInfo = { id: string; name: string; department: string; mentorId: string | null };
export type OpenIntervention = { id: string; priority: string; status: string; actionPlan: string; reason: string };

export type RuleContext = {
  id: string;
  info: StudentInfo;
  pred: StudentPrediction;
  segments: Set<string>;
  open: OpenIntervention | null;
  highOutcomes: OutcomeKey[];
};

type Theme = "attendance" | "backlog" | "academics" | null;

export type Rule = {
  id: string;
  /** What the rule recommends in one line (documentation). */
  summary: string;
  owner: Owner;
  theme: Theme;
  outcomes: OutcomeKey[];
  dueInDays: number;
  impact: string;
  fixedPriority?: Priority;
  /** Supporting actions never outrank the core remedy, however high the underlying risk. */
  maxPriority?: Priority;
  /** Extra urgency not captured by the forecast probabilities (the larger of the two scores is used). */
  extraScore?: (c: RuleContext) => number;
  when: (c: RuleContext) => boolean;
  action: (c: RuleContext) => string;
  reason: (c: RuleContext) => string;
  triggeredBy: (c: RuleContext) => string[];
};

/** Calibration can output exactly 0 or 1 at the extremes, which would read as certainty: show the ends as ">99%" and "<1%". */
export const pct = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}`;

/** The most important risk-raising driver of an outcome, as a sentence (never empty). */
export function leadDriver(pred: StudentPrediction, outcome: OutcomeKey): Driver | null {
  const drivers = pred[outcome].drivers;
  return drivers.find((d) => d.c > 0) ?? drivers[0] ?? null;
}
/** Lower-cases the first letter of a sentence unless it starts an acronym or a number ("SGPA in...", "CGPA is...", "45 approved..."). */
const lowerFirst = (text: string) => (/^[A-Z][a-z]/.test(text) ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text);
const driverText = (pred: StudentPrediction, outcome: OutcomeKey) => {
  const d = leadDriver(pred, outcome);
  return d ? `Main driver: ${lowerFirst(d.t)}.` : "No single factor dominates.";
};
/** The forecast in words that cannot be misread: for placement the stored probability is of NOT being ready. */
const outcomeChance = (pred: StudentPrediction, outcome: OutcomeKey) =>
  outcome === "placement" ? `${pct(pred.placement.p)} chance of not being placement-ready` : `${OUTCOME_NAME[outcome]} ${pct(pred[outcome].p)}`;
const keys = (pred: StudentPrediction, outcome: OutcomeKey) => pred[outcome].drivers.filter((d) => d.c > 0).slice(0, 2).map((d) => d.k);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const RULES: Rule[] = [
  {
    id: "placement_bootcamp",
    summary: "High academic standing but a low chance of being placement-ready: coding bootcamp plus mock interviews",
    owner: "Training & Placement cell",
    theme: null,
    outcomes: ["placement"],
    dueInDays: 28,
    impact: "Raises the chance of being placement-ready before the season (aptitude, coding and interview benchmarks of 60).",
    when: (c) => c.pred.facts.cgpa >= 7.0 && c.pred.placement.p_ready !== undefined && c.pred.placement.p_ready <= 0.4,
    action: (c) => {
      const f = c.pred.facts;
      const steps: string[] = [];
      steps.push(f.coding_attempts === 0 ? "start with a coding diagnostic test, then join the coding bootcamp (target 60+)" : `join the coding bootcamp to lift the best coding score from ${f.coding.toFixed(0)} to 60+`);
      steps.push(f.interview_attempts === 0 ? "book the first of two mock interviews within 4 weeks" : `book two mock interviews within 4 weeks (best so far ${f.interview.toFixed(0)}, target 60+)`);
      if (f.aptitude < 60) steps.push(`practise aptitude (latest ${f.aptitude.toFixed(0)}%, target 60+)`);
      return `Placement preparation plan: ${steps.join("; ")}.`;
    },
    reason: (c) => `CGPA ${c.pred.facts.cgpa.toFixed(2)} is strong, but the model puts the chance of being placement-ready at ${pct(c.pred.placement.p_ready ?? 0)}. ${driverText(c.pred, "placement")}`,
    triggeredBy: (c) => ["cgpa_at_n", ...keys(c.pred, "placement")],
  },
  {
    id: "attendance_contract",
    summary: "Attendance low or falling and the engagement-drop forecast is flagged: weekly mentor check-in and attendance contract",
    owner: "Faculty mentor",
    theme: "attendance",
    outcomes: ["engagement"],
    dueInDays: 14,
    // below 75% a student can lose exam eligibility, so the shortfall itself is urgent: 0.4 at 74%, +0.015 per point below
    extraScore: (c) => (c.pred.facts.att < 75 ? Math.min(0.9, 0.4 + 0.015 * (75 - c.pred.facts.att)) : 0),
    impact: "Lowers the probability of an engagement drop and protects the 75% attendance requirement.",
    when: (c) => (c.pred.facts.att < 75 || c.pred.facts.att_change <= -5 || c.pred.facts.att_trend <= -5) && c.pred.engagement.level !== "Low",
    action: (c) => {
      const f = c.pred.facts;
      const target = Math.max(80, Math.ceil(f.att / 5) * 5 + 5);
      return `Weekly mentor check-in for six weeks and a signed attendance contract (target ${Math.min(target, 90)}%).`;
    },
    reason: (c) => {
      const f = c.pred.facts;
      return `Attendance is ${f.att.toFixed(0)}% (${signed(f.att_change)} points since last semester, ${signed(f.att_trend)} toward the end of it) and the engagement-drop forecast is ${pct(c.pred.engagement.p)} (${c.pred.engagement.level}). ${driverText(c.pred, "engagement")}`;
    },
    triggeredBy: (c) => ["att_last_sem", "att_change_vs_prev", ...keys(c.pred, "engagement")],
  },
  {
    id: "backlog_remedial",
    summary: "Active backlog with a flagged chance of not clearing it: remedial classes and a supplementary exam plan",
    owner: "Faculty mentor",
    theme: "backlog",
    outcomes: ["backlog"],
    dueInDays: 14,
    impact: "Raises the chance of clearing the backlog at the next supplementary exam and prevents new failures.",
    when: (c) => c.pred.facts.backlogs >= 1 && c.pred.backlog.level !== "Low",
    action: (c) => `Enrol in remedial classes for the ${plural(c.pred.facts.backlogs, "pending subject")} and agree a dated supplementary exam plan with the mentor.`,
    reason: (c) => `${plural(c.pred.facts.backlogs, "active backlog")} and a ${pct(c.pred.backlog.p)} forecast chance of a new or uncleared backlog (${c.pred.backlog.level}). ${driverText(c.pred, "backlog")}`,
    triggeredBy: (c) => ["active_backlogs_at_n", ...keys(c.pred, "backlog")],
  },
  {
    id: "backlog_prevention",
    summary: "No backlog yet but a flagged chance of failing: pre-emptive revision plan for the weakest subjects",
    owner: "Faculty mentor",
    theme: "backlog",
    outcomes: ["backlog"],
    dueInDays: 21,
    impact: "Lowers the probability of a new backlog next semester.",
    when: (c) => c.pred.facts.backlogs === 0 && c.pred.backlog.level !== "Low",
    action: (c) => `Pre-emptive revision plan for the weakest subjects, with a mentor review of internal marks at week 6 (SGPA last semester ${c.pred.facts.sgpa_last.toFixed(1)}).`,
    reason: (c) => `No backlog today, but the forecast chance of failing a subject next semester is ${pct(c.pred.backlog.p)} (${c.pred.backlog.level}). ${driverText(c.pred, "backlog")}`,
    triggeredBy: (c) => keys(c.pred, "backlog"),
  },
  {
    id: "academic_support",
    summary: "High chance of an SGPA below 6: peer tutoring in the weakest subjects and monthly internal-marks review",
    owner: "Faculty mentor",
    theme: "academics",
    outcomes: ["sgpa_below_6"],
    dueInDays: 14,
    impact: "Lifts the expected SGPA above 6 and lowers the chance of a weak semester.",
    when: (c) => c.pred.sgpa_below_6.level === "High",
    action: (c) => `Assign a peer tutor for the weakest subjects and review internal marks monthly (forecast SGPA ${c.pred.sgpa_below_6.pred?.toFixed(1)}, range ${c.pred.sgpa_below_6.lo?.toFixed(1)}–${c.pred.sgpa_below_6.hi?.toFixed(1)}).`,
    reason: (c) => `Forecast chance of an SGPA below 6 is ${pct(c.pred.sgpa_below_6.p)} (${c.pred.sgpa_below_6.level}); expected SGPA ${c.pred.sgpa_below_6.pred?.toFixed(1)}. ${driverText(c.pred, "sgpa_below_6")}`,
    triggeredBy: (c) => keys(c.pred, "sgpa_below_6"),
  },
  {
    id: "study_skills",
    summary: "Low assignment submission or high lateness alongside a flagged outcome: study-skills and time-management workshop",
    owner: "Counsellor",
    theme: null,
    outcomes: ["sgpa_below_6", "backlog", "engagement"],
    dueInDays: 21,
    maxPriority: "High",
    impact: "Improves on-time submission, which feeds the SGPA, backlog and engagement forecasts.",
    when: (c) => {
      const f = c.pred.facts;
      const flagged = c.pred.sgpa_below_6.level !== "Low" || c.pred.backlog.level !== "Low" || c.pred.engagement.level !== "Low";
      return flagged && (f.submit_pct < 50 || f.late_pct >= 40);
    },
    action: (c) => `Study-skills and time-management workshop with a weekly planner check (submission ${c.pred.facts.submit_pct.toFixed(0)}% now, target 85%).`,
    reason: (c) => {
      const f = c.pred.facts;
      const worst = (["sgpa_below_6", "backlog", "engagement"] as OutcomeKey[]).sort((a, b) => c.pred[b].p - c.pred[a].p)[0];
      return `Only ${f.submit_pct.toFixed(0)}% of assignments were submitted, ${f.late_pct.toFixed(0)}% of those late, while the ${OUTCOME_NAME[worst]} forecast is ${pct(c.pred[worst].p)}. ${driverText(c.pred, worst)}`;
    },
    triggeredBy: () => ["submit_pct", "late_pct", "on_time_submit_pct"],
  },
  {
    id: "silent_decliner",
    summary: "Round 1 flag Low but the model sees risk: an early, informal mentor conversation",
    owner: "Faculty mentor",
    theme: null,
    outcomes: ["engagement", "sgpa_below_6", "backlog"],
    dueInDays: 14,
    impact: "Catches students before a Round 1 flag would: lowers the chance of a drop in engagement or results.",
    when: (c) => c.segments.has("silent_decliners"),
    action: () => "Early, informal mentor conversation about workload and wellbeing. No formal flag yet.",
    reason: (c) => {
      const worst = (["engagement", "sgpa_below_6", "backlog"] as OutcomeKey[]).sort((a, b) => c.pred[b].p - c.pred[a].p)[0];
      return `The Round 1 flag is Low (success score ${c.pred.facts.success_score.toFixed(0)}), but the ${OUTCOME_NAME[worst]} forecast is ${pct(c.pred[worst].p)} (${c.pred[worst].level}). ${driverText(c.pred, worst)}`;
    },
    triggeredBy: (c) => ["round1_risk_flag", ...keys(c.pred, "engagement")],
  },
  {
    id: "combined_recovery",
    summary: "Several outcomes High at once: a combined recovery plan with escalation",
    owner: "Dean / Administrator",
    theme: null,
    outcomes: [...OUTCOME_KEYS],
    dueInDays: 7,
    impact: "Coordinates academic, attendance and placement support for a student at risk on several fronts.",
    when: (c) => c.highOutcomes.length >= 2,
    action: (c) => `Combined recovery plan covering ${c.highOutcomes.map((o) => OUTCOME_NAME[o]).join(" and ")}, reviewed fortnightly; escalate to the Dean if there is no improvement in four weeks.`,
    reason: (c) => `Rated High on ${c.highOutcomes.length} outcomes: ${c.highOutcomes.map((o) => outcomeChance(c.pred, o)).join("; ")}. ${driverText(c.pred, c.highOutcomes[0])}`,
    triggeredBy: (c) => c.highOutcomes.flatMap((o) => keys(c.pred, o).slice(0, 1)),
  },
  {
    id: "stretch_opportunity",
    summary: "Stable high performers: stretch opportunities (hackathon, internship referral)",
    owner: "Training & Placement cell",
    theme: null,
    outcomes: ["placement"],
    dueInDays: 60,
    fixedPriority: "Low",
    impact: "Keeps strong students progressing: converts a high readiness chance into offers.",
    when: (c) => c.segments.has("stable_high_performers"),
    action: (c) => `Offer stretch opportunities: a hackathon slot or an internship referral (CGPA ${c.pred.facts.cgpa.toFixed(2)}, placement-ready chance ${pct(c.pred.placement.p_ready ?? 0)}).`,
    reason: (c) => `Every outcome is Low risk, CGPA ${c.pred.facts.cgpa.toFixed(2)} and the placement-ready chance is ${pct(c.pred.placement.p_ready ?? 0)}: a strong student who should not be overlooked.`,
    triggeredBy: () => ["cgpa_at_n", "interview_best"],
  },
];

const PRIORITY_SCORE: Record<Priority, number> = { Low: 0.15, Medium: 0.45, High: 0.65, Critical: 0.85 };

export function priorityFrom(score: number): Priority {
  return score >= 0.8 ? "Critical" : score >= 0.6 ? "High" : score >= 0.4 ? "Medium" : "Low";
}

export function studentPriorityScore(pred: StudentPrediction, outcomes: OutcomeKey[], highOutcomes: OutcomeKey[]): number {
  const base = Math.max(...outcomes.map((o) => SEVERITY_WEIGHT[o] * pred[o].p));
  const extraHigh = Math.max(0, highOutcomes.length - 1);
  return Math.min(1, base + 0.05 * extraHigh);
}

const THEME_WORDS: Record<Exclude<Theme, null>, RegExp> = {
  attendance: /attendance/i,
  backlog: /backlog|remedial|supplementary/i,
  academics: /peer tutor|cgpa/i,
};

function coveredBy(open: OpenIntervention | null, theme: Theme): OpenIntervention | null {
  if (!open || !theme) return null;
  return THEME_WORDS[theme].test(`${open.reason} ${open.actionPlan}`) ? open : null;
}

export function recommendForStudent(c: RuleContext): Recommendation[] {
  const out: Recommendation[] = [];
  for (const rule of RULES) {
    if (!rule.when(c)) continue;
    const covered = coveredBy(c.open, rule.theme);
    let score = rule.fixedPriority ? PRIORITY_SCORE[rule.fixedPriority] : studentPriorityScore(c.pred, rule.outcomes, c.highOutcomes);
    if (rule.extraScore) score = Math.min(1, Math.max(score, rule.extraScore(c)));
    if (rule.maxPriority) score = Math.min(score, PRIORITY_SCORE[rule.maxPriority] - 0.01);
    const owner = rule.owner;
    const ownerId = owner === "Faculty mentor" ? c.info.mentorId : owner === "Training & Placement cell" ? "TNP-CELL" : owner === "Counsellor" ? "COUNSELLING" : owner === "Dean / Administrator" ? "DEAN" : `HOD-${c.info.department}`;
    out.push({
      id: `REC-${c.id.slice(4)}-${rule.id}`,
      targetType: "student",
      targetId: c.id,
      targetLabel: `${c.info.name} (${c.id})`,
      department: c.info.department,
      action: covered ? `Follow up on the open plan ${covered.id} (${covered.status.toLowerCase()}) and escalate if the signs do not improve in two weeks: ${rule.action(c)}` : rule.action(c),
      reason: covered ? `${rule.reason(c)} An open intervention (${covered.id}, ${covered.priority} priority) already covers this, so review it rather than opening a new one.` : rule.reason(c),
      owner,
      ownerId,
      priority: priorityFrom(score),
      priorityScore: Math.round(score * 1000) / 1000,
      expectedImpact: rule.impact,
      dueInDays: rule.dueInDays,
      triggeredBy: rule.triggeredBy(c),
      ruleId: rule.id,
      outcomes: rule.outcomes,
    });
  }
  return out.sort((a, b) => b.priorityScore - a.priorityScore || a.ruleId.localeCompare(b.ruleId)).slice(0, MAX_PER_STUDENT);
}

/* ------------------------------------------------------------------------------------------------ segments */

type SegmentAction = { action: (s: SegmentRecord) => string; owner: Owner; impact: string; outcomes: OutcomeKey[]; dueInDays: number; fixedPriority?: Priority };

const SEGMENT_ACTIONS: Record<string, SegmentAction> = {
  high_cgpa_low_placement: {
    action: (s) => `Run a placement-readiness bootcamp cohort (coding practice plus two mock interviews each) for ${s.count} high-CGPA students.`,
    owner: "Training & Placement cell", outcomes: ["placement"], dueInDays: 30,
    impact: "Moves high-CGPA students over the aptitude, coding and interview benchmarks before the placement season.",
  },
  falling_attendance_engagement: {
    action: (s) => `Launch an attendance recovery drive: weekly mentor check-ins for ${s.count} students whose attendance is falling.`,
    owner: "Dean / Administrator", outcomes: ["engagement"], dueInDays: 21,
    impact: "Stops the fall in attendance and engagement before it turns into backlogs.",
  },
  backlog_not_clearing: {
    action: (s) => `Open a remedial and supplementary-exam clinic for ${s.count} students with backlogs at risk of not clearing.`,
    owner: "Dean / Administrator", outcomes: ["backlog"], dueInDays: 21,
    impact: "Raises backlog clearance at the next supplementary exam.",
  },
  silent_decliners: {
    action: (s) => `Add a model-based early-warning review to mentor meetings for ${s.count} students the Round 1 flag misses.`,
    owner: "Dean / Administrator", outcomes: ["engagement", "sgpa_below_6", "backlog"], dueInDays: 30,
    impact: "Finds students before the Round 1 flag does.",
  },
  capable_disengaged: {
    action: (s) => `Engagement outreach for ${s.count} capable but disengaged students: clubs, projects and peer mentoring offers.`,
    owner: "Counsellor", outcomes: ["engagement", "placement"], dueInDays: 30,
    impact: "Turns academic ability into participation and employability.",
  },
  stable_high_performers: {
    action: (s) => `Create a stretch pathway (hackathons, research projects, internship referrals) for ${s.count} stable high performers.`,
    owner: "Training & Placement cell", outcomes: ["placement"], dueInDays: 60, fixedPriority: "Low",
    impact: "Keeps strong students progressing.",
  },
};

const MEAN_RISK_KEY: Record<OutcomeKey, keyof SegmentRecord["mean_risk"]> = {
  sgpa_below_6: "sgpa_below_6", backlog: "backlog", placement: "not_placement_ready", engagement: "engagement_drop",
};

export function segmentPriorityScore(segment: SegmentRecord, outcomes: OutcomeKey[], totalStudents: number): number {
  const risk = Math.max(...outcomes.map((o) => SEVERITY_WEIGHT[o] * (segment.mean_risk[MEAN_RISK_KEY[o]] ?? 0)));
  return Math.min(1, 0.85 * risk + 0.15 * Math.min(1, segment.count / (0.15 * totalStudents)));
}

export function recommendForSegments(segments: SegmentsFile): Recommendation[] {
  const out: Recommendation[] = [];
  for (const segment of segments.segments) {
    const spec = SEGMENT_ACTIONS[segment.id];
    if (!spec || segment.count === 0) continue;
    const score = spec.fixedPriority ? 0.15 : segmentPriorityScore(segment, spec.outcomes, segments.students);
    const top = Object.entries(segment.by_department).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d, n]) => `${d} ${n}`).join(", ");
    const risk = spec.outcomes.map((o) => `${OUTCOME_NAME[o]} ${pct(segment.mean_risk[MEAN_RISK_KEY[o]] ?? 0)}`).join(", ");
    out.push({
      id: `REC-SEG-${segment.id}`, targetType: "segment", targetId: segment.id, targetLabel: `${segment.label} (${segment.count} students)`, department: null,
      action: spec.action(segment),
      reason: `${segment.count} students (${(segment.share_of_students * 100).toFixed(1)}% of the campus) match "${segment.definition}". Mean forecast risk: ${risk}. Largest groups: ${top}.`,
      owner: spec.owner, ownerId: spec.owner === "Dean / Administrator" ? "DEAN" : spec.owner === "Counsellor" ? "COUNSELLING" : "TNP-CELL",
      priority: priorityFrom(score), priorityScore: Math.round(score * 1000) / 1000, expectedImpact: spec.impact, dueInDays: spec.dueInDays,
      triggeredBy: [segment.id], ruleId: `segment_${segment.id}`, outcomes: spec.outcomes,
    });
    // department-level action where the segment is clearly over-represented
    if (spec.fixedPriority) continue;
    for (const [department, lift] of Object.entries(segment.department_lift)) {
      const n = segment.by_department[department] ?? 0;
      if (lift < 1.3 || n < 5) continue;
      const deptScore = Math.min(1, score * 0.9 + 0.05);
      out.push({
        id: `REC-SEG-${segment.id}-${department.replace(/\s+/g, "")}`, targetType: "segment", targetId: `${segment.id}:${department}`,
        targetLabel: `${segment.label} in ${department} (${n} students)`, department,
        action: `Department review: ${department} has ${lift.toFixed(1)}x its fair share of "${segment.label.toLowerCase()}" (${n} students); agree a department-level plan with the mentors.`,
        reason: `${n} of the ${segment.count} students in this segment study ${department}, ${lift.toFixed(1)}x what the department's size would predict. Mean forecast risk: ${risk}.`,
        owner: "Department head", ownerId: `HOD-${department}`, priority: priorityFrom(deptScore), priorityScore: Math.round(deptScore * 1000) / 1000,
        expectedImpact: spec.impact, dueInDays: spec.dueInDays, triggeredBy: [segment.id], ruleId: `segment_${segment.id}_department`, outcomes: spec.outcomes,
      });
    }
  }
  return out.sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------------------------------------ everything */

export function buildRecommendations(
  predictions: PredictionsFile,
  segments: SegmentsFile,
  infoById: Record<string, StudentInfo>,
  openById: Record<string, OpenIntervention>,
): Recommendation[] {
  const segmentsOf = new Map<string, Set<string>>();
  for (const segment of segments.segments) for (const id of segment.members) segmentsOf.set(id, (segmentsOf.get(id) ?? new Set()).add(segment.id));
  const students: Recommendation[] = [];
  for (const id of Object.keys(predictions.students).sort()) {
    const pred = predictions.students[id];
    const info = infoById[id] ?? { id, name: id, department: pred.facts.department, mentorId: pred.mentorId };
    const highOutcomes = OUTCOME_KEYS.filter((k) => pred[k].level === "High");
    students.push(...recommendForStudent({ id, info, pred, segments: segmentsOf.get(id) ?? new Set(), open: openById[id] ?? null, highOutcomes }));
  }
  const all = [...students, ...recommendForSegments(segments)];
  return all.sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id));
}
