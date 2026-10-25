import { z } from "zod";
import { EVAL_CONFIG as C } from "./config";
import type { Rubric } from "./types";

export const llmVerdictSchema = z.object({
  relevant: z.boolean(),
  score: z.number().min(0),
  matchedKeywords: z.array(z.string()).default([]),
  missingKeywords: z.array(z.string()).default([]),
  conceptsCovered: z.array(z.string()).default([]),
  conceptsMissed: z.array(z.string()).default([]),
  incorrectClaims: z.array(z.string()).default([]),
  feedback: z.string().default(""),
  improvedAnswerHint: z.string().default(""),
});
export type LlmVerdict = z.infer<typeof llmVerdictSchema>;

const SYSTEM = `You are a strict technical interviewer grading a student's answer. The score MUST be 0 if the answer does not address the question asked. Never give credit for keyword lists, for repeating the question, or for introducing yourself when not asked. Penalise factually wrong claims. Respond with JSON only, no prose, in exactly this shape: {"relevant":boolean,"score":number,"matchedKeywords":string[],"missingKeywords":string[],"conceptsCovered":string[],"conceptsMissed":string[],"incorrectClaims":string[],"feedback":string,"improvedAnswerHint":string}. "score" is out of the given maximum marks.`;

export const llmAvailable = () => Boolean(process.env.OPENAI_API_KEY);

async function callOnce(rubric: Rubric, answer: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(C.LLM_ENDPOINT, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: C.LLM_MODEL,
      temperature: 0,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            question: rubric.question,
            maxMarks: rubric.maxMarks,
            referenceAnswer: rubric.sampleIdealAnswer,
            expectedConcepts: rubric.keyConcepts,
            mustHaveKeywords: rubric.mustHaveKeywords,
            studentAnswer: answer.slice(0, 4000),
          }),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (json.choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

/**
 * Stage D (optional). Returns a validated verdict, or null when there is no key, the call times out (LLM_TIMEOUT_MS in
 * total), errors, or returns invalid JSON twice. Callers must then fall back to the rule-based score.
 */
export async function llmEvaluate(rubric: Rubric, answer: string): Promise<LlmVerdict | null> {
  if (!llmAvailable()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.LLM_TIMEOUT_MS);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed = llmVerdictSchema.safeParse(await callOnce(rubric, answer, controller.signal));
        if (parsed.success) return { ...parsed.data, score: Math.min(rubric.maxMarks, parsed.data.score) };
      } catch (e) {
        if (controller.signal.aborted) return null;
        if (e instanceof SyntaxError) continue; // invalid JSON: retry once
        return null;
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
