/** Every tunable threshold and weight of the answer-evaluation pipeline lives here. */
export const EVAL_CONFIG = {
  /** Stage B: minimum semantic similarity to the question / ideal answer. Below this the answer is irrelevant (0). */
  RELEVANCE_THRESHOLD: Number(process.env.EVAL_RELEVANCE_THRESHOLD ?? 0.35),
  /** Stage C: a key concept counts as covered when this share of its terms appears together in the answer. */
  CONCEPT_THRESHOLD: Number(process.env.EVAL_CONCEPT_THRESHOLD ?? 0.5),

  /** Stage A */
  MIN_MEANINGFUL_WORDS: 3,
  MIN_REAL_WORD_RATIO: 0.5,
  MAX_REPEAT_RATIO: 0.6,
  COPY_QUESTION_OVERLAP: 0.8,

  /** Stage C weights (sum to 1). */
  WEIGHTS: { mustHave: 0.4, goodToHave: 0.15, concepts: 0.3, clarity: 0.15 },
  /** Keyword stuffing multiplies the keyword part (must-have + good-to-have) by this. */
  STUFFING_KEYWORD_FACTOR: 0.3,
  /** Answers shorter than the rubric's minWords cannot exceed this share of maxMarks. */
  SHORT_ANSWER_CAP: 0.4,
  /** Marks deducted per contradicted key concept. */
  CONTRADICTION_PENALTY_MARKS: 3,
  /** Marks always given to a bare self-introduction on an intro question (name only is low but not zero). */
  IDENTITY_ONLY_MARKS: 1,

  /** Stage D */
  LLM_TIMEOUT_MS: 5000,
  LLM_ENDPOINT: "https://api.openai.com/v1/chat/completions",
  LLM_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  /** Scores are rounded to the nearest step. */
  ROUND_TO: 0.5,
} as const;

export type EvalConfig = typeof EVAL_CONFIG;
