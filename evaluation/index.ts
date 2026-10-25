import { findRubricByText, getRubric } from "./bank";
import { EVAL_CONFIG as C } from "./config";
import { llmEvaluate, type LlmVerdict } from "./llmEvaluator";
import { runPreChecks } from "./preChecks";
import { checkRelevance } from "./relevance";
import { scoreRubric } from "./rubricScorer";
import type { Breakdown, EvaluationResult, Rubric } from "./types";

export * from "./types";
export { QUESTION_BANK, getRubric, pickInterview, toPublic } from "./bank";
export { setSimilarity } from "./relevance";
export { EVAL_CONFIG } from "./config";

const roundStep = (n: number) => Math.round(n / C.ROUND_TO) * C.ROUND_TO;
const zeroBreakdown: Breakdown = { mustHave: 0, goodToHave: 0, concepts: 0, clarity: 0, penalties: 0 };

function base(rubric: Rubric): EvaluationResult {
  return {
    questionId: rubric.id, category: rubric.category, score: 0, maxMarks: rubric.maxMarks, relevant: false, status: "ok", reason: "",
    breakdown: { ...zeroBreakdown }, matchedKeywords: [], missingKeywords: rubric.mustHaveKeywords.map((g) => g.split("|")[0]),
    conceptsCovered: [], conceptsMissed: rubric.keyConcepts.map(readable), incorrectClaims: [], flags: [], relevanceScore: null,
    feedback: "", improvedAnswerHint: hintFor(rubric, rubric.keyConcepts.map(readable), rubric.mustHaveKeywords.map((g) => g.split("|")[0])),
    sampleIdealAnswer: rubric.sampleIdealAnswer, stage: "pre-check", llmUsed: false, ruleScore: 0, llmScore: null,
  };
}

/** "arrays store pointers|references" -> "arrays store pointers" for display. */
const readable = (c: string) => c.split(" ").map((w) => w.split("|")[0]).join(" ");

function hintFor(_rubric: Rubric, missedConcepts: string[], missingKeywords: string[]): string {
  if (missedConcepts.length) return `Cover points such as: ${missedConcepts.slice(0, 3).join("; ")}.`;
  if (missingKeywords.length) return `Mention key terms like: ${missingKeywords.slice(0, 4).join(", ")}.`;
  return "Add a concrete example to make the answer stand out.";
}

function feedbackFor(r: EvaluationResult): string {
  const pct = r.score / r.maxMarks;
  const bits: string[] = [];
  if (pct >= 0.8) bits.push("Strong, well-covered answer.");
  else if (pct >= 0.5) bits.push("Good start — you covered part of what was expected.");
  else bits.push("Your answer only touched the surface of the question.");
  if (r.incorrectClaims.length) bits.push(`Correct this: ${r.incorrectClaims.join(" ")}`);
  if (r.flags.includes("keyword-stuffing")) bits.push("Listing keywords without sentences earns little credit — explain the ideas.");
  if (r.flags.includes("short-answer-cap")) bits.push("The answer was too short to be complete; expand it to a few sentences.");
  return bits.join(" ");
}

/**
 * Evaluate one answer. Pipeline (any failed gate stops with 0):
 *   A pre-checks → B relevance gate → C rubric scoring → D optional LLM (final = min(rule, LLM), rounded to 0.5).
 * `question` is a rubric, a question id, or the exact question text from the bank.
 */
export async function evaluateAnswer(question: string | Rubric, answer: string, opts: { useLlm?: boolean } = {}): Promise<EvaluationResult> {
  const rubric = typeof question === "string" ? (getRubric(question) ?? findRubricByText(question)) : question;
  if (!rubric) throw new Error("Unknown question");
  const res = base(rubric);
  const text = (answer ?? "").slice(0, 4000);

  // Stage A
  const pre = runPreChecks(rubric, text);
  if (!pre.pass) {
    return { ...res, status: pre.status ?? "irrelevant", reason: pre.reason ?? "Irrelevant answer.", feedback: pre.reason ?? "", stage: "pre-check" };
  }
  if (pre.identityOnly) {
    const score = Math.min(C.IDENTITY_ONLY_MARKS, rubric.maxMarks);
    const reason = "Only your name was given. A strong introduction also covers your education, skills, projects and goals.";
    return { ...res, relevant: true, status: "identity-only", score, ruleScore: score, reason, feedback: reason, stage: "pre-check", breakdown: { ...zeroBreakdown, clarity: score } };
  }

  // Stage B
  const rel = await checkRelevance(rubric, text);
  res.relevanceScore = rel.score;
  if (!rel.relevant) {
    const reason = `Irrelevant answer: it does not address the question (relevance ${rel.score.toFixed(2)} < ${C.RELEVANCE_THRESHOLD}).`;
    return { ...res, status: "irrelevant", reason, feedback: reason, stage: "relevance" };
  }

  // Stage C
  const rs = scoreRubric(rubric, text);
  const ruleScore = roundStep(rs.marks);
  Object.assign(res, {
    relevant: true, stage: "rubric", breakdown: rs.breakdown, matchedKeywords: rs.matchedKeywords, missingKeywords: rs.missingKeywords,
    conceptsCovered: rs.conceptsCovered.map(readable), conceptsMissed: rs.conceptsMissed.map(readable), incorrectClaims: rs.incorrectClaims, flags: rs.flags,
    score: ruleScore, ruleScore, improvedAnswerHint: hintFor(rubric, rs.conceptsMissed.map(readable), rs.missingKeywords),
  });

  // Stage D (optional)
  if (opts.useLlm !== false && ruleScore > 0) {
    const v: LlmVerdict | null = await llmEvaluate(rubric, text);
    if (v) {
      res.llmUsed = true;
      res.llmScore = v.relevant ? roundStep(v.score) : 0;
      res.stage = "llm";
      if (!v.relevant) {
        res.relevant = false; res.status = "irrelevant"; res.score = 0;
        res.reason = "Irrelevant answer: the evaluator judged that it does not address the question.";
      } else {
        res.score = Math.min(ruleScore, res.llmScore);
        res.incorrectClaims = [...new Set([...res.incorrectClaims, ...v.incorrectClaims])];
      }
      if (v.feedback) res.feedback = v.feedback;
      if (v.improvedAnswerHint) res.improvedAnswerHint = v.improvedAnswerHint;
    }
  }
  if (!res.feedback) res.feedback = feedbackFor(res);
  return res;
}
