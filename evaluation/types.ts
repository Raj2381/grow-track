export type Category = "Introduction" | "Technical Knowledge" | "Problem Solving" | "Communication" | "Behavioral";

export interface Contradiction {
  /** Regular expression (case-insensitive) tested on the normalised answer; O(1) is written bigo1. */
  pattern: string;
  /** Plain-language description of the wrong claim, shown to the student. */
  note: string;
}

export interface Rubric {
  id: string;
  category: Category;
  question: string;
  maxMarks: number;
  /** Role names for technical questions (empty/omitted = any role). */
  roles?: string[];
  /** Self-introduction style question: a bare name earns a little credit instead of 0. */
  intro?: boolean;
  /** Each entry may list synonyms: "pointer|reference|address". Multi-word phrases allowed. */
  mustHaveKeywords: string[];
  goodToHaveKeywords: string[];
  /** Ideas a good answer expresses, e.g. "arrays store elements in contiguous memory". Words may use "a|b". */
  keyConcepts: string[];
  minWords: number;
  sampleIdealAnswer: string;
  contradictions?: Contradiction[];
}

/** What the browser is allowed to see: no keywords, no ideal answer. */
export interface PublicQuestion {
  id: string;
  category: Category;
  question: string;
  maxMarks: number;
}

export type Stage = "pre-check" | "relevance" | "rubric" | "llm";

export interface Breakdown {
  mustHave: number; // marks
  goodToHave: number;
  concepts: number;
  clarity: number;
  penalties: number; // marks removed (contradictions, rounding of caps)
}

export interface EvaluationResult {
  questionId: string;
  category: Category;
  /** Marks awarded, rounded to 0.5. */
  score: number;
  maxMarks: number;
  relevant: boolean;
  /** Short machine-friendly status: ok | irrelevant | empty | too-short | gibberish | copied | filler | self-intro | off-topic. */
  status: string;
  /** Human reason when score is 0 (or capped). */
  reason: string;
  breakdown: Breakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  conceptsCovered: string[];
  conceptsMissed: string[];
  incorrectClaims: string[];
  flags: string[]; // e.g. "keyword-stuffing", "short-answer-cap"
  relevanceScore: number | null;
  feedback: string;
  improvedAnswerHint: string;
  sampleIdealAnswer: string;
  stage: Stage;
  llmUsed: boolean;
  ruleScore: number;
  llmScore: number | null;
}
