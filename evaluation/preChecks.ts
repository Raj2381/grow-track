import { EVAL_CONFIG as C } from "./config";
import { contentStems, isRealWord, normalise, repetitionRatio, stem, tokens } from "./text";
import type { Rubric } from "./types";

export interface PreCheckResult {
  pass: boolean;
  status?: string;
  reason?: string;
  /** Intro question answered with just a name/greeting: scored as a low, non-zero identity answer. */
  identityOnly?: boolean;
}

const FILLER = /^(i (do not|dont|don't|really do not|really don't) know|idk|no idea|i have no idea|not sure|i am not sure|pass|skip|next|hello|hi|hey|ok|okay|yes|no|nothing|none|na|n a|test|testing|sorry|thanks|thank you)\b/;
const SELF_INTRO = /^((hi|hello|hey)\s+)?(my name is|myself|this is|i am from|i'm from|i come from|i study in|i am studying|i'm studying|i am a student|i'm a student|i am|i'm)\b/;
const NAME_ONLY = /^((hi|hello|hey)\s+)?(my name is|myself|this is|i am|i'm)\s+[a-z]+(\s+[a-z]+){0,2}$/;

export function vocabularyOf(rubric: Rubric): Set<string> {
  const text = [rubric.question, rubric.sampleIdealAnswer, ...rubric.mustHaveKeywords, ...rubric.goodToHaveKeywords, ...rubric.keyConcepts].join(" ").replace(/\|/g, " ");
  return new Set(tokens(text).flatMap((t) => [t, stem(t)]));
}

/** Does the answer contain any must-have / good-to-have term? (used to rescue "I am from X, arrays use ..." answers) */
export function hasRubricTerm(rubric: Rubric, answerNorm: string): boolean {
  const ans = new Set(contentStems(answerNorm));
  return [...rubric.mustHaveKeywords, ...rubric.goodToHaveKeywords].some((g) =>
    g.split("|").some((alt) => {
      const parts = contentStems(alt);
      return parts.length > 0 && parts.every((p) => ans.has(p));
    }),
  );
}

export function runPreChecks(rubric: Rubric, rawAnswer: string): PreCheckResult {
  const answer = (rawAnswer ?? "").trim();
  if (!answer) return { pass: false, status: "empty", reason: "No answer was submitted." };

  const norm = normalise(answer);
  const toks = norm.split(" ").filter(Boolean);

  // filler / refusal, only when the whole answer is basically that
  if (toks.length <= 6 && FILLER.test(norm)) {
    return { pass: false, status: "filler", reason: "Irrelevant answer: this is a filler or \"don't know\" response, not an answer to the question." };
  }

  // gibberish
  const vocab = vocabularyOf(rubric);
  const real = toks.filter((t) => isRealWord(t, vocab)).length;
  if (toks.length && real / toks.length < C.MIN_REAL_WORD_RATIO) {
    return { pass: false, status: "gibberish", reason: "Irrelevant answer: the text does not look like real words." };
  }
  if (repetitionRatio(toks) >= C.MAX_REPEAT_RATIO) {
    return { pass: false, status: "gibberish", reason: "Irrelevant answer: the same word is repeated instead of answering." };
  }

  // copies the question
  const q = new Set(contentStems(rubric.question));
  const a = contentStems(answer);
  if (a.length) {
    const overlap = a.filter((s) => q.has(s)).length / a.length;
    const novel = a.filter((s) => !q.has(s)).length;
    const containsQuestion = norm.includes(normalise(rubric.question)) && novel < 3;
    if ((overlap >= C.COPY_QUESTION_OVERLAP && novel < 3) || containsQuestion) {
      return { pass: false, status: "copied", reason: "Irrelevant answer: the answer repeats the question instead of answering it." };
    }
  }

  // identity statement
  if (rubric.intro) {
    if (NAME_ONLY.test(norm) || (a.length <= 2 && SELF_INTRO.test(norm) && !hasRubricTerm(rubric, norm))) {
      return { pass: true, identityOnly: true };
    }
  } else if (SELF_INTRO.test(norm) && a.length <= 8 && !hasRubricTerm(rubric, norm)) {
    return { pass: false, status: "self-intro", reason: "Irrelevant answer: this is a self-introduction, not an answer to the question asked." };
  }

  // too few meaningful words
  if (a.length < C.MIN_MEANINGFUL_WORDS) {
    return { pass: false, status: "too-short", reason: `Irrelevant answer: fewer than ${C.MIN_MEANINGFUL_WORDS} meaningful words.` };
  }
  return { pass: true };
}
