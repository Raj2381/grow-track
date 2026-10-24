/**
 * Turns one student's forecast into advice written FOR the student: encouraging, specific, never a verdict.
 * Pure (no network, no React), so it is unit tested over every student (scripts/test-student-advice.ts).
 *
 * Rules the copy follows:
 *  - no raw risk scores and no false certainty: chances are put in words ("a real chance"), never "100%" or "0%";
 *  - risk levels use the student-facing names Low / Watch / High, and an outcome the student can still change is framed as a plan;
 *  - every focus area carries the student's own number, so the advice is checkable;
 *  - a driver whose wording sounds good ("attendance improved") is never listed as a problem, and a driver that sounds bad is
 *    never listed as a strength: the model's sign can differ from how a sentence reads, and a contradiction would confuse.
 */
import type { Driver, OutcomeKey, OutcomePrediction, RiskLevel, StudentPrediction } from "./ml-types";

export const STUDENT_LEVEL_WORDS: Record<RiskLevel, string> = { Low: "On track", Medium: "Worth watching", High: "Needs attention" };

export type OutcomeAdvice = {
  key: OutcomeKey;
  title: string;
  level: RiskLevel;
  /** "On track" / "Worth watching" / "Needs attention" */
  label: string;
  /** one sentence in plain words */
  message: string;
};

export type FocusArea = {
  family: string;
  outcome: OutcomeKey;
  /** the student's own numbers, from the model's driver sentence */
  evidence: string;
  /** why it matters, in one sentence */
  why: string;
  steps: string[];
};

export type PlanStep = { when: "This week" | "This month" | "This semester"; text: string };
export type Target = { label: string; now: string; goal: string };

export type StudentAdvice = {
  overall: { level: RiskLevel; label: string; message: string };
  outcomes: OutcomeAdvice[];
  strengths: string[];
  focus: FocusArea[];
  plan: PlanStep[];
  targets: Target[];
  support: string;
  disclaimer: string;
};

export const ADVICE_DISCLAIMER = "This is an estimate from your past records, made to help you plan. It is not a decision about you, and what you do next semester can change it.";

const OUTCOME_TITLE: Record<OutcomeKey, string> = {
  sgpa_below_6: "Semester performance",
  backlog: "Backlogs",
  placement: "Placement readiness",
  engagement: "Staying engaged",
};

/** Wording that reads as good news / bad news (see the rule at the top of the file). */
const GOOD_WORDS = /\b(improved|grew|rose|increased|up \d+%|passed every|no active backlog|no backlog|above|strong|high(?:er)? than)\b/i;
const BAD_WORDS = /\b(fell|fall|down|below|faded|declin\w*|dropped|low|weak|failed|active backlog|no approved|rejected)\b/i;
export const soundsGood = (text: string) => GOOD_WORDS.test(text) && !BAD_WORDS.test(text);
export const soundsBad = (text: string) => BAD_WORDS.test(text) && !GOOD_WORDS.test(text);

type FamilyAdvice = { why: string; steps: { when: PlanStep["when"]; text: string }[] };

/** What to do about each family of drivers the model reports. Families the student cannot act on are left out on purpose. */
const FAMILY_ADVICE: Record<string, FamilyAdvice> = {
  "Attendance level": {
    why: "Missing classes is one of the strongest early signs of falling behind, and below 75% you can lose exam eligibility.",
    steps: [
      { when: "This week", text: "Plan to attend every class for the next four weeks and tell your mentor about anything that keeps you away." },
      { when: "This month", text: "Check each subject's attendance in the portal and catch up on the notes for classes you missed." },
    ],
  },
  "Attendance trend": {
    why: "A drop in attendance late in the semester tends to show up in marks a few weeks later.",
    steps: [
      { when: "This week", text: "Look at which month attendance started slipping and what changed then; fix that first." },
      { when: "This month", text: "Set a simple rule, such as never missing two classes in a row." },
    ],
  },
  "Academic standing": {
    why: "Internal marks and last semester's result set the starting point for the next one.",
    steps: [
      { when: "This week", text: "List the subjects where your internal marks are lowest and ask those teachers what to revise." },
      { when: "This semester", text: "Aim to raise your internal marks in those subjects before the end-semester exams; they count towards the final grade." },
    ],
  },
  "Backlogs and failures": {
    why: "An old backlog takes study time away from the current subjects and has to be cleared to graduate.",
    steps: [
      { when: "This week", text: "Write down each backlog subject and the next exam date for it." },
      { when: "This month", text: "Join the remedial or supplementary classes and book a weekly slot to practise past papers." },
    ],
  },
  "Assignments and quizzes": {
    why: "Assignments and quizzes are steady marks and show early whether a topic is clear.",
    steps: [
      { when: "This week", text: "Submit anything pending, even if it is not perfect; late work earns nothing." },
      { when: "This month", text: "After each quiz, review the questions you missed the same day." },
    ],
  },
  "LMS activity": {
    why: "Regular logins and time on the LMS usually go with keeping up with the course.",
    steps: [{ when: "This week", text: "Log in on a fixed schedule, for example three times a week, to read new material and notices." }],
  },
  "Faculty feedback": {
    why: "Teachers' notes on participation and attitude often explain marks before the marks arrive.",
    steps: [{ when: "This month", text: "Ask one teacher for specific feedback on how to participate more in class." }],
  },
  "Extracurricular activity": {
    why: "Approved activities add to your profile for placements and keep you connected to campus.",
    steps: [{ when: "This semester", text: "Pick one club, event or project this semester and get it approved in the portal so it is recorded." }],
  },
  "Aptitude tests": {
    why: "Recruiters screen with aptitude tests first, and practice scores climb quickly.",
    steps: [{ when: "This month", text: "Take one aptitude practice test a week; review the sections where you lost the most marks." }],
  },
  "Coding practice": {
    why: "Coding rounds filter many candidates, and regular practice is the surest way to improve.",
    steps: [{ when: "This month", text: "Solve a few practice problems every week and take a coding test to see where you stand." }],
  },
  "Mock interviews": {
    why: "Interview scores improve with practice more than with reading.",
    steps: [{ when: "This month", text: "Book a mock interview and use the feedback to prepare for the next one." }],
  },
  Skills: {
    why: "Recorded technical and communication skills show recruiters what you can already do.",
    steps: [{ when: "This semester", text: "Pick one skill from your latest assessment and set a small weekly goal to improve it." }],
  },
  "Support interventions": {
    why: "Support plans work best when the student is part of them.",
    steps: [{ when: "This week", text: "Review your support plan with your mentor and agree on one thing you will do before the next meeting." }],
  },
  "Recent engagement level": {
    why: "Staying active in classes, the LMS and activities keeps small problems from growing.",
    steps: [{ when: "This week", text: "Choose one habit to restart this week, such as a weekly study group or a regular LMS check-in." }],
  },
};

const chance = (p: number) => (p < 0.1 ? "unlikely" : p < 0.3 ? "a small chance" : p < 0.5 ? "a real chance" : p < 0.7 ? "more likely than not" : "likely");

function outcomeMessage(key: OutcomeKey, pred: StudentPrediction): string {
  const o: OutcomePrediction = pred[key];
  const level = o.level;
  switch (key) {
    case "sgpa_below_6": {
      const expected = o.pred !== undefined ? o.pred.toFixed(1) : null;
      const range = o.lo !== undefined && o.hi !== undefined ? ` (most likely between ${o.lo.toFixed(1)} and ${o.hi.toFixed(1)})` : "";
      const head = expected ? `Your expected SGPA next semester is about ${expected}${range}. ` : "";
      return head + (level === "Low" ? "Falling below 6.0 looks unlikely if you keep going as you are." : level === "Medium" ? "Falling below 6.0 is possible, so it is worth keeping an eye on." : "There is a real chance of falling below 6.0, so the next few weeks matter.");
    }
    case "backlog":
      return level === "Low" ? "A new backlog looks unlikely at the moment." : level === "Medium" ? "A new backlog is possible; clearing any weak subjects early keeps it that way." : `A new backlog is ${chance(o.p)} unless something changes, so start with the subjects you find hardest.`;
    case "placement": {
      const ready = o.p_ready ?? 1 - o.p;
      return level === "Low" ? "You are on a good path to be placement-ready when the season starts." : level === "Medium" ? "You are partway to placement-ready; a little regular practice would close the gap." : `Being placement-ready by the season is ${chance(ready)} right now, but the gap is in things you can practise.`;
    }
    case "engagement":
      return level === "Low" ? "You are staying engaged; keep your routine." : level === "Medium" ? "Your engagement could slip if the semester gets busy; a steady routine helps." : "Your recent activity points to a risk of drifting away from classes; a small routine can turn this around.";
  }
}

const OVERALL_MESSAGE: Record<RiskLevel, string> = {
  Low: "You are on track across the board. Keep your routine and use the spare time to build skills for placements.",
  Medium: "Most things are going well, with a few areas worth watching. Small steady changes now keep them from becoming problems.",
  High: "A few areas need attention this semester. None of this is fixed: the plan sets out the steps most likely to help, and your mentor is there to help you with them.",
};

const num = (n: number, digits = 0) => (Number.isFinite(n) ? n.toFixed(digits) : "-");

function targets(pred: StudentPrediction): Target[] {
  const f = pred.facts;
  const out: Target[] = [];
  if (f.att < 75) out.push({ label: "Attendance", now: `${num(f.att)}%`, goal: "75% or more, to stay eligible for exams" });
  if (f.backlogs > 0) out.push({ label: "Active backlogs", now: String(f.backlogs), goal: "clear them at the next supplementary exam" });
  if (f.sgpa_last < 6) out.push({ label: "Last semester SGPA", now: num(f.sgpa_last, 2), goal: "6.0 or more" });
  if (pred.placement.level !== "Low") {
    if (f.aptitude_attempts === 0 || f.aptitude < 60) out.push({ label: "Aptitude score", now: f.aptitude_attempts === 0 ? "no test yet" : `${num(f.aptitude)}%`, goal: "60 or more" });
    if (f.coding_attempts === 0 || f.coding < 60) out.push({ label: "Coding score", now: f.coding_attempts === 0 ? "no test yet" : `${num(f.coding)}%`, goal: "60 or more" });
    if (f.interview_attempts === 0 || f.interview < 60) out.push({ label: "Mock interview", now: f.interview_attempts === 0 ? "none yet" : num(f.interview), goal: "60 or more" });
  }
  return out;
}

const dedupeByFamily = (items: { d: Driver; outcome: OutcomeKey }[]) => {
  const seen = new Set<string>();
  return items.filter(({ d }) => (seen.has(d.f) ? false : (seen.add(d.f), true)));
};

export function buildStudentAdvice(pred: StudentPrediction, mentorName?: string | null): StudentAdvice {
  const keys: OutcomeKey[] = ["sgpa_below_6", "backlog", "placement", "engagement"];
  const all = keys.flatMap((outcome) => pred[outcome].drivers.map((d) => ({ d, outcome })));

  // only outcomes the student can still influence feed the focus list; a family with no advice entry is skipped
  const raising = all
    .filter(({ d, outcome }) => d.c > 0 && FAMILY_ADVICE[d.f] && !soundsGood(d.t) && pred[outcome].level !== "Low")
    .sort((a, b) => b.d.c - a.d.c);
  const focus: FocusArea[] = dedupeByFamily(raising)
    .slice(0, 3)
    .map(({ d, outcome }) => ({ family: d.f, outcome, evidence: d.t, why: FAMILY_ADVICE[d.f].why, steps: FAMILY_ADVICE[d.f].steps.map((s) => s.text) }));

  // a strength must READ as one: a bare score such as "Best mock interview score is 46" holds the risk down for the average student but is not praise
  const helping = all.filter(({ d }) => d.c < 0 && soundsGood(d.t)).sort((a, b) => a.d.c - b.d.c);
  const strengths = dedupeByFamily(helping).slice(0, 3).map(({ d }) => d.t);

  const plan: PlanStep[] = [];
  const order: PlanStep["when"][] = ["This week", "This month", "This semester"];
  for (const area of focus) for (const s of FAMILY_ADVICE[area.family].steps) if (!plan.some((p) => p.text === s.text)) plan.push(s);
  plan.sort((a, b) => order.indexOf(a.when) - order.indexOf(b.when));

  const worst = (["High", "Medium", "Low"] as RiskLevel[]).find((l) => keys.some((k) => pred[k].level === l)) ?? "Low";
  const anyHigh = keys.some((k) => pred[k].level === "High");
  const name = mentorName?.trim();
  const support = anyHigh
    ? `Talk to ${name ? `your mentor, ${name},` : "your mentor"} this week and share this plan. Asking early is what helps most.`
    : `${name ? `Your mentor, ${name},` : "Your mentor"} is happy to talk it through whenever you like.`;

  return {
    overall: { level: pred.overall, label: STUDENT_LEVEL_WORDS[pred.overall], message: OVERALL_MESSAGE[pred.overall] ?? OVERALL_MESSAGE[worst] },
    outcomes: keys.map((key) => ({ key, title: OUTCOME_TITLE[key], level: pred[key].level, label: STUDENT_LEVEL_WORDS[pred[key].level], message: outcomeMessage(key, pred) })),
    strengths,
    focus,
    plan,
    targets: targets(pred),
    support,
    disclaimer: ADVICE_DISCLAIMER,
  };
}
