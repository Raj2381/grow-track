import { EVAL_CONFIG as C } from "./config";
import { contentStems, normalise, sentences, stem, STOPWORDS, tokens } from "./text";
import type { Breakdown, Rubric } from "./types";

export interface RubricScore {
  marks: number; // unrounded, 0..maxMarks
  breakdown: Breakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  conceptsCovered: string[];
  conceptsMissed: string[];
  incorrectClaims: string[];
  flags: string[];
}

/** First alternative of "a|b|c" is the label shown to students. */
const label = (group: string) => group.split("|")[0].trim();

function containsPhrase(seq: string[], phrase: string[]): boolean {
  if (!phrase.length) return false;
  for (let i = 0; i + phrase.length <= seq.length; i++) {
    if (phrase.every((p, j) => seq[i + j] === p)) return true;
  }
  return false;
}

export function groupMatches(group: string, answerContentStems: string[]): boolean {
  return group.split("|").some((alt) => {
    const phrase = contentStems(alt);
    return containsPhrase(answerContentStems, phrase.length ? phrase : tokens(alt).map(stem));
  });
}

/** Share of a concept's terms (each may be "a|b") present in the window, stop words ignored. */
export function conceptCoverage(concept: string, windowStems: Set<string>): number {
  const words = normalise(concept).split(" ").filter((w) => w && !STOPWORDS.has(w.split("|")[0]));
  if (!words.length) return 0;
  const hit = words.filter((w) => w.split("|").some((alt) => windowStems.has(stem(alt)))).length;
  return hit / words.length;
}

function windows(answer: string): Set<string>[] {
  const sents = sentences(answer);
  const parts = sents.length ? sents : [answer];
  const out = parts.map((s) => new Set(contentStems(s)));
  for (let i = 0; i + 1 < parts.length; i++) out.push(new Set(contentStems(parts[i] + " " + parts[i + 1])));
  return out;
}

const CONNECTORS = /\b(because|therefore|whereas|while|unlike|however|first|second|then|so that|which|since|for example|for instance|such as|as a result|in contrast|on the other hand|whereas)\b/;
const FILLERS = /\b(um+|uh+|like|basically|actually|you know|kind of|sort of)\b/g;

function clarityScore(answer: string, minWords: number): number {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const sents = sentences(answer);
  const avg = sents.length ? words.length / sents.length : words.length;
  const fillers = answer.toLowerCase().match(FILLERS)?.length ?? 0;
  let s = 0;
  if (sents.length >= 2) s += 0.35;
  if (words.length >= minWords) s += 0.25;
  if (CONNECTORS.test(answer.toLowerCase())) s += 0.2;
  if (fillers <= 2) s += 0.1;
  if (avg >= 5 && avg <= 35) s += 0.1;
  return Math.min(1, s);
}

/** Many rubric terms, almost no connecting words, no real sentence structure. */
function isKeywordStuffing(answer: string, matchedCount: number): boolean {
  const toks = tokens(answer);
  if (toks.length < 4 || matchedCount < 3) return false;
  const functionRatio = toks.filter((t) => STOPWORDS.has(t)).length / toks.length;
  const sentenceCount = Math.max(1, sentences(answer).length);
  if (functionRatio < 0.08 && toks.length >= 6) return true;
  return functionRatio < 0.15 && sentenceCount < 2;
}

export function scoreRubric(rubric: Rubric, answer: string): RubricScore {
  const flags: string[] = [];
  const stemsAll = contentStems(answer);
  const words = answer.trim().split(/\s+/).filter(Boolean).length;

  const mustHit = rubric.mustHaveKeywords.filter((g) => groupMatches(g, stemsAll));
  const goodHit = rubric.goodToHaveKeywords.filter((g) => groupMatches(g, stemsAll));
  const mustFrac = rubric.mustHaveKeywords.length ? mustHit.length / rubric.mustHaveKeywords.length : 0;
  // good-to-have is capped: reaching 3 of them (or all, when fewer) already earns the full 15%
  const goodCap = Math.min(3, rubric.goodToHaveKeywords.length) || 1;
  const goodFrac = Math.min(1, goodHit.length / goodCap);

  const wins = windows(answer);
  const covered: string[] = [];
  const missed: string[] = [];
  for (const concept of rubric.keyConcepts) {
    const best = Math.max(0, ...wins.map((w) => conceptCoverage(concept, w)));
    (best >= C.CONCEPT_THRESHOLD ? covered : missed).push(concept);
  }
  const conceptFrac = rubric.keyConcepts.length ? covered.length / rubric.keyConcepts.length : 0;
  const clarity = clarityScore(answer, rubric.minWords);

  let keywordFactor = 1;
  if (isKeywordStuffing(answer, mustHit.length + goodHit.length)) {
    keywordFactor = C.STUFFING_KEYWORD_FACTOR;
    flags.push("keyword-stuffing");
  }

  const M = rubric.maxMarks;
  const W = C.WEIGHTS;
  const breakdown: Breakdown = {
    mustHave: M * W.mustHave * mustFrac * keywordFactor,
    goodToHave: M * W.goodToHave * goodFrac * keywordFactor,
    concepts: M * W.concepts * conceptFrac,
    clarity: M * W.clarity * clarity,
    penalties: 0,
  };
  let marks = breakdown.mustHave + breakdown.goodToHave + breakdown.concepts + breakdown.clarity;

  // contradictions
  const norm = normalise(answer);
  const incorrectClaims: string[] = [];
  for (const c of rubric.contradictions ?? []) {
    if (new RegExp(c.pattern, "i").test(norm)) incorrectClaims.push(c.note);
  }
  if (incorrectClaims.length) {
    const cut = Math.min(marks, incorrectClaims.length * C.CONTRADICTION_PENALTY_MARKS);
    breakdown.penalties += cut;
    marks -= cut;
    flags.push("contradiction");
  }

  // too short to be a complete answer
  if (words < rubric.minWords) {
    const cap = M * C.SHORT_ANSWER_CAP;
    if (marks > cap) {
      breakdown.penalties += marks - cap;
      marks = cap;
    }
    flags.push("short-answer-cap");
  }

  return {
    marks: Math.max(0, Math.min(M, marks)),
    breakdown,
    matchedKeywords: [...mustHit, ...goodHit].map(label),
    missingKeywords: rubric.mustHaveKeywords.filter((g) => !mustHit.includes(g)).map(label),
    conceptsCovered: covered,
    conceptsMissed: missed,
    incorrectClaims,
    flags,
  };
}
