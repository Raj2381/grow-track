import { EVAL_CONFIG as C } from "./config";
import { contentStems } from "./text";
import type { Rubric } from "./types";

/**
 * Pluggable similarity function (0..1). The default is a local lexical-semantic score so the pipeline runs with no model
 * download and no API key. To use sentence embeddings (e.g. all-MiniLM-L6-v2 via @xenova/transformers) call
 * `setSimilarity(fn)` once at server start with a cosine-of-embeddings function.
 */
export type SimilarityFn = (a: string, b: string) => Promise<number> | number;

function termFreq(stemsList: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of stemsList) m.set(s, (m.get(s) ?? 0) + 1);
  return m;
}

/** Blend of cosine similarity and answer-precision (share of the answer's meaningful terms found in the reference). */
export function lexicalSimilarity(answer: string, reference: string): number {
  const a = contentStems(answer);
  const r = contentStems(reference);
  if (!a.length || !r.length) return 0;
  const fa = termFreq(a);
  const fr = termFreq(r);
  let dot = 0;
  for (const [t, n] of fa) dot += n * (fr.get(t) ?? 0);
  const norm = (f: Map<string, number>) => Math.sqrt([...f.values()].reduce((s, n) => s + n * n, 0));
  const cosine = dot / (norm(fa) * norm(fr) || 1);
  const refSet = new Set(r);
  const precision = a.filter((t) => refSet.has(t)).length / a.length;
  return 0.5 * cosine + 0.5 * precision;
}

let similarity: SimilarityFn = lexicalSimilarity;
export function setSimilarity(fn: SimilarityFn) {
  similarity = fn;
}

export interface RelevanceResult {
  relevant: boolean;
  score: number;
  vsQuestion: number;
  vsIdeal: number;
}

export async function checkRelevance(rubric: Rubric, answer: string): Promise<RelevanceResult> {
  const reference = [rubric.sampleIdealAnswer, ...rubric.keyConcepts, ...rubric.mustHaveKeywords, ...rubric.goodToHaveKeywords].join(" ").replace(/\|/g, " ");
  const vsQuestion = await similarity(answer, rubric.question);
  const vsIdeal = await similarity(answer, reference);
  const score = Math.max(vsQuestion, vsIdeal);
  return { relevant: score >= C.RELEVANCE_THRESHOLD, score: Number(score.toFixed(3)), vsQuestion: Number(vsQuestion.toFixed(3)), vsIdeal: Number(vsIdeal.toFixed(3)) };
}
